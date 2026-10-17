import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  describeEvaluation,
  INDICATOR_LABELS,
  messageOf,
  postJson,
  REPORT_TYPE_LABELS,
  SEVERITY_LABELS,
  type Campaign,
  type MedicalEvent,
  type ReportRequest,
  type ResultRow,
  type Schedule,
  type Standard,
} from './health-api.js';

// MH-16 Hồ sơ sức khỏe và đợt khám (P10-06, P10-07, P10-08, P10-10, P10-11; YCTD-74): y tế lập đợt khám, lịch khám,
// ghi và công bố kết quả; xem sự kiện y tế; gửi báo cáo sức khỏe phụ huynh yêu cầu; quản lý tiêu chuẩn sức khỏe.
// Danh sách đợt khám, lịch khám, sự kiện y tế, yêu cầu báo cáo và tiêu chuẩn theo lưới dữ liệu chung, tìm tại chỗ, Mở
// rộng tìm kiếm, Thêm mới mở biểu mẫu; bảng nhập kết quả khám từng học sinh giữ dạng nhập liệu; xóa tiêu chuẩn qua hộp xác
// nhận xóa (DT-16 phần 16b)
type Tab = 'campaigns' | 'events' | 'reports' | 'standards';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const CAMPAIGN_STATUS_LABELS: Record<Campaign['status'], string> = { open: 'Đang mở', closed: 'Đã đóng' };
const GENDER_LABELS: Record<Standard['gender'], string> = { female: 'Nữ', male: 'Nam' };
const parentStatusOf = (event: MedicalEvent) =>
  event.parent_acknowledged_at
    ? `Đã biết lúc ${new Date(event.parent_acknowledged_at).toLocaleString('vi-VN')}`
    : 'Chưa xác nhận';

const CAMPAIGN_COLUMNS: Array<DataGridColumn<Campaign>> = [
  { id: 'name', header: 'Tên đợt khám', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'from_date', header: 'Từ ngày', cell: (row) => row.from_date },
  { id: 'to_date', header: 'Đến ngày', cell: (row) => row.to_date },
  { id: 'status', header: 'Trạng thái', cell: (row) => CAMPAIGN_STATUS_LABELS[row.status] },
];

const SCHEDULE_COLUMNS: Array<DataGridColumn<Schedule>> = [
  { id: 'class_name', header: 'Lớp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.class_name },
  { id: 'check_date', header: 'Ngày khám', cell: (row) => row.check_date },
  { id: 'location', header: 'Nơi khám', cell: (row) => row.location },
];

const EVENT_COLUMNS: Array<DataGridColumn<MedicalEvent>> = [
  { id: 'occurred_at', header: 'Thời điểm', cell: (row) => new Date(row.occurred_at).toLocaleString('vi-VN') },
  { id: 'full_name', header: 'Học sinh', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'symptoms', header: 'Triệu chứng', cell: (row) => row.symptoms },
  { id: 'handling', header: 'Xử lý', cell: (row) => row.handling },
  { id: 'handler_name', header: 'Người xử lý', cell: (row) => row.handler_name },
  { id: 'severity', header: 'Mức độ', cell: (row) => SEVERITY_LABELS[row.severity] },
  { id: 'parent', header: 'Phụ huynh', cell: parentStatusOf },
];

const REPORT_COLUMNS: Array<DataGridColumn<ReportRequest>> = [
  { id: 'full_name', header: 'Học sinh', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'report_type', header: 'Loại', cell: (row) => REPORT_TYPE_LABELS[row.report_type] },
  { id: 'period', header: 'Kỳ', cell: (row) => `${row.period_from} đến ${row.period_to}` },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => (row.status === 'sent' ? 'Đã gửi' : 'Chờ gửi') },
];

const STANDARD_COLUMNS: Array<DataGridColumn<Standard>> = [
  {
    id: 'indicator_code',
    header: 'Chỉ số',
    alwaysVisible: true,
    className: 'font-medium',
    cell: (row) => INDICATOR_LABELS[row.indicator_code],
  },
  { id: 'gender', header: 'Giới tính', cell: (row) => GENDER_LABELS[row.gender] },
  { id: 'age_months', header: 'Tháng tuổi', cell: (row) => `${row.age_month_from} đến ${row.age_month_to}` },
  { id: 'range', header: 'Ngưỡng', cell: (row) => `${Number(row.lower_value)} đến ${Number(row.upper_value)}` },
  { id: 'source_document', header: 'Nguồn', cell: (row) => row.source_document },
];

const standardLabelOf = (row: Standard) =>
  `${INDICATOR_LABELS[row.indicator_code]}, ${GENDER_LABELS[row.gender]}, ${row.age_month_from} đến ${row.age_month_to} tháng tuổi`;

export function HealthPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const tabs: Array<[Tab, string]> = [
    ['campaigns', 'Đợt khám'],
    ['events', 'Sự kiện y tế'],
    ['reports', 'Yêu cầu báo cáo'],
    ['standards', 'Tiêu chuẩn sức khỏe'],
  ];
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/health')}</h1>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Y tế">
          {tabs.map(([code, label]) => (
            <Button
              key={code}
              role="tab"
              aria-selected={tab === code}
              variant={tab === code ? 'secondary' : 'text'}
              onClick={() => setTab(code)}
            >
              {label}
            </Button>
          ))}
        </div>
        {tab === 'campaigns' ? <CampaignsTab onDone={setToastMessage} /> : null}
        {tab === 'events' ? <EventsTab onDone={setToastMessage} /> : null}
        {tab === 'reports' ? <ReportsTab onDone={setToastMessage} /> : null}
        {tab === 'standards' ? <StandardsTab onDone={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}

function CampaignsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('health-campaigns');
  const scheduleGrid = useGridSettings('health-schedules');
  const [campaignId, setCampaignId] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [name, setName] = useState('');
  const [fromDate, setFromDate] = useState(vietnamToday);
  const [toDate, setToDate] = useState(vietnamToday);
  const [classId, setClassId] = useState('');
  const [checkDate, setCheckDate] = useState(vietnamToday);
  const [location, setLocation] = useState('');
  const campaigns = useQuery({
    queryKey: ['health-campaigns', orgUnitId],
    queryFn: () => requestJson<Campaign[]>(`/api/v1/health-check-campaigns?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: Boolean(orgUnitId),
  });
  const schedules = useQuery({
    queryKey: ['health-schedules', campaignId],
    queryFn: () => requestJson<Schedule[]>(`/api/v1/health-check-schedules?campaign_id=${campaignId}`),
    enabled: Boolean(campaignId),
  });
  const results = useQuery({
    queryKey: ['health-results', campaignId],
    queryFn: () => requestJson<ResultRow[]>(`/api/v1/health-check-campaigns/${campaignId}/results`),
    enabled: Boolean(campaignId),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['health-campaigns'] });
    await queryClient.invalidateQueries({ queryKey: ['health-schedules'] });
    await queryClient.invalidateQueries({ queryKey: ['health-results'] });
    onDone(message);
  };
  const createCampaign = useMutation({
    mutationFn: () =>
      postJson<Campaign>('/api/v1/health-check-campaigns', {
        org_unit_id: orgUnitId,
        name,
        from_date: fromDate,
        to_date: toDate,
      }),
    onSuccess: (campaign) => {
      setName('');
      setCreating(false);
      setCampaignId(campaign.id);
      return refresh('Đã lập đợt khám');
    },
  });
  const createSchedule = useMutation({
    mutationFn: () =>
      postJson<{ notified_count: number }>('/api/v1/health-check-schedules', {
        campaign_id: campaignId,
        class_id: classId,
        check_date: checkDate,
        location,
      }),
    onSuccess: (schedule) => refresh(`Đã lập lịch khám, đã báo ${schedule.notified_count} phụ huynh`),
  });
  const publish = useMutation({
    mutationFn: () =>
      postJson<{ published_count: number }>(`/api/v1/health-check-campaigns/${campaignId}/publish-results`, {}),
    onSuccess: (result) => refresh(`Đã công bố ${result.published_count} kết quả`),
  });
  const close = useMutation({
    mutationFn: () => postJson(`/api/v1/health-check-campaigns/${campaignId}/close`, {}),
    onSuccess: () => refresh('Đã đóng đợt khám'),
  });
  const error = [
    campaigns.error,
    createCampaign.error,
    createSchedule.error,
    publish.error,
    close.error,
    grid.error,
    scheduleGrid.error,
  ].find(Boolean);
  const selected = campaigns.data?.find((campaign) => campaign.id === campaignId);
  const rows = (campaigns.data ?? []).filter(
    (campaign) => (statusFilter === '' || campaign.status === statusFilter) && matchesSearch(search, campaign.name),
  );
  const scheduleRows = (schedules.data ?? []).filter((schedule) =>
    matchesSearch(scheduleSearch, schedule.class_name, schedule.location, schedule.check_date),
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect
        units={unitChoice.units}
        selectedId={orgUnitId}
        onSelect={(id) => {
          unitChoice.select(id);
          setCampaignId('');
        }}
      />
      {creating ? (
        <form
          aria-label="Lập đợt khám"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            createCampaign.mutate();
          }}
        >
          <TextField label="Tên đợt khám" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="Từ ngày"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <TextField label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={createCampaign.isPending || name === '' || !orgUnitId}>
              Lập đợt khám
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh sách đợt khám"
        columns={CAMPAIGN_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={campaigns.isLoading}
        emptyText="Chưa có đợt khám."
        search={{ label: 'Tìm theo tên đợt khám', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="open">Đang mở</option>
                <option value="closed">Đã đóng</option>
              </select>
            </label>
          </div>
        }
        toolbar={
          orgUnitId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(row) => (
          <Button variant="text" onClick={() => setCampaignId(row.id)}>
            Xem đợt khám {row.name}
          </Button>
        )}
        activeRowId={campaignId}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />

      {selected ? (
        <section className="flex flex-col gap-3" aria-label="Chi tiết đợt khám">
          <h2 className="text-section-title font-semibold text-text">Đợt khám {selected.name}</h2>
          <div className="flex flex-wrap gap-2">
            <Button disabled={publish.isPending} onClick={() => publish.mutate()}>
              Công bố kết quả
            </Button>
            {selected.status === 'open' ? (
              <Button variant="text" disabled={close.isPending} onClick={() => close.mutate()}>
                Đóng đợt khám
              </Button>
            ) : null}
          </div>
          {selected.status === 'open' ? (
            <form
              aria-label="Lập lịch khám"
              className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                createSchedule.mutate();
              }}
            >
              <label className="text-label font-medium text-text">
                Lớp khám
                <select value={classId} onChange={(event) => setClassId(event.target.value)} className={selectClass}>
                  <option value="">Chọn lớp</option>
                  {(classes.data ?? [])
                    .filter((item) => item.status === 'active')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <TextField
                label="Ngày khám"
                type="date"
                value={checkDate}
                onChange={(event) => setCheckDate(event.target.value)}
              />
              <TextField label="Nơi khám" value={location} onChange={(event) => setLocation(event.target.value)} />
              <div className="flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createSchedule.isPending || classId === '' || location === ''}
                >
                  Lập lịch khám
                </Button>
              </div>
            </form>
          ) : null}
          <DataGrid
            label="Lịch khám"
            columns={SCHEDULE_COLUMNS}
            rows={scheduleRows}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `Lớp ${row.class_name}`}
            loading={schedules.isLoading}
            emptyText="Đợt khám chưa có lịch khám."
            search={{ label: 'Tìm theo lớp, nơi khám', value: scheduleSearch, onChange: setScheduleSearch }}
            settings={scheduleGrid.settings}
            onSettingsChange={scheduleGrid.update}
          />
          {/* Bảng nhập kết quả khám từng học sinh giữ dạng nhập liệu (DT-16 phần 16b) */}
          <table className="w-full text-content" aria-label="Kết quả khám">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Học sinh</th>
                <th>Lớp</th>
                <th>{INDICATOR_LABELS.height_cm}</th>
                <th>{INDICATOR_LABELS.weight_kg}</th>
                <th>Kết luận</th>
                <th>Đánh giá</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(results.data ?? []).map((row) => (
                <ResultRowEditor
                  key={row.child_id}
                  row={row}
                  campaignId={campaignId}
                  editable={selected.status === 'open'}
                  onSaved={() => refresh(`Đã lưu kết quả của ${row.full_name}`)}
                />
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function ResultRowEditor({
  row,
  campaignId,
  editable,
  onSaved,
}: {
  row: ResultRow;
  campaignId: string;
  editable: boolean;
  onSaved(): void;
}) {
  const [height, setHeight] = useState(row.height_cm?.toString() ?? '');
  const [weight, setWeight] = useState(row.weight_kg?.toString() ?? '');
  const [conclusion, setConclusion] = useState(row.conclusion ?? '');
  const save = useMutation({
    mutationFn: () =>
      postJson(
        `/api/v1/health-check-campaigns/${campaignId}/results`,
        {
          child_id: row.child_id,
          height_cm: height === '' ? null : Number(height),
          weight_kg: weight === '' ? null : Number(weight),
          conclusion: conclusion || null,
        },
        'PUT',
      ),
    onSuccess: onSaved,
  });
  const inputClass = 'w-24 rounded border border-border bg-card px-2 py-1';
  return (
    <tr className="border-t border-border" aria-label={`Kết quả của ${row.full_name}`}>
      <td className="py-2">{row.full_name}</td>
      <td>{row.class_name}</td>
      <td>
        <input
          aria-label="Chiều cao"
          className={inputClass}
          value={height}
          disabled={!editable}
          onChange={(event) => setHeight(event.target.value)}
        />
      </td>
      <td>
        <input
          aria-label="Cân nặng"
          className={inputClass}
          value={weight}
          disabled={!editable}
          onChange={(event) => setWeight(event.target.value)}
        />
      </td>
      <td>
        <input
          aria-label="Kết luận"
          className="w-48 rounded border border-border bg-card px-2 py-1"
          value={conclusion}
          disabled={!editable}
          onChange={(event) => setConclusion(event.target.value)}
        />
      </td>
      <td className="text-danger">{describeEvaluation(row.evaluation)}</td>
      <td>{row.published_at ? 'Đã công bố' : row.result_id ? 'Chưa công bố' : 'Chưa khám'}</td>
      <td>
        {editable ? (
          <Button variant="text" disabled={save.isPending} onClick={() => save.mutate()}>
            Lưu
          </Button>
        ) : null}
        {save.error ? <span className="text-danger">{messageOf(save.error)}</span> : null}
      </td>
    </tr>
  );
}

function EventsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const canRecord = useHasPermission(PERMISSION_CODES.medicalEventRecord);
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const grid = useGridSettings('medical-events');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [childId, setChildId] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [handling, setHandling] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const events = useQuery({
    queryKey: ['medical-events', orgUnitId],
    queryFn: () => requestJson<MedicalEvent[]>(`/api/v1/medical-events?org_unit_id=${orgUnitId}`),
    enabled: Boolean(orgUnitId),
  });
  const children = useQuery({
    queryKey: ['health-children', orgUnitId],
    queryFn: () =>
      requestJson<{ items: Array<{ id: string; full_name: string }> }>(
        `/api/v1/children?org_unit_id=${orgUnitId}&status=active&page_size=100`,
      ),
    enabled: Boolean(orgUnitId) && canRecord,
  });
  const record = useMutation({
    mutationFn: () =>
      postJson('/api/v1/medical-events', {
        child_id: childId,
        occurred_at: new Date().toISOString(),
        symptoms,
        handling,
        severity,
      }),
    onSuccess: async () => {
      setSymptoms('');
      setHandling('');
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['medical-events'] });
      onDone('Đã ghi sự kiện y tế và báo phụ huynh');
    },
  });
  const error = [events.error, record.error, grid.error].find(Boolean);
  const rows = (events.data ?? []).filter(
    (event) =>
      (severityFilter === '' || event.severity === severityFilter) &&
      (parentFilter === '' || (parentFilter === 'acknowledged') === Boolean(event.parent_acknowledged_at)) &&
      matchesSearch(search, event.full_name, event.symptoms, event.handling, event.handler_name),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canRecord && creating ? (
        <form
          aria-label="Ghi sự kiện y tế"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            record.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Học sinh
            <select value={childId} onChange={(event) => setChildId(event.target.value)} className={selectClass}>
              <option value="">Chọn học sinh</option>
              {(children.data?.items ?? []).map((child) => (
                <option key={child.id} value={child.id}>
                  {child.full_name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Triệu chứng" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} />
          <TextField label="Cách xử lý" value={handling} onChange={(event) => setHandling(event.target.value)} />
          <label className="text-label font-medium text-text">
            Mức độ
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as 'mild' | 'moderate' | 'severe')}
              className={selectClass}
            >
              <option value="mild">Nhẹ</option>
              <option value="moderate">Vừa</option>
              <option value="severe">Nặng</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={record.isPending || childId === '' || symptoms === '' || handling === ''}
            >
              Ghi sự kiện
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh sách sự kiện y tế"
        columns={EVENT_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        loading={events.isLoading}
        emptyText="Chưa có sự kiện y tế."
        search={{ label: 'Tìm theo học sinh, triệu chứng, xử lý', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Mức độ
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(SEVERITY_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Phụ huynh
              <select
                value={parentFilter}
                onChange={(event) => setParentFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="acknowledged">Đã biết</option>
                <option value="pending">Chưa xác nhận</option>
              </select>
            </label>
          </div>
        }
        toolbar={
          canRecord && orgUnitId ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function ReportsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('health-report-requests');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const reports = useQuery({
    queryKey: ['health-reports'],
    queryFn: () => requestJson<ReportRequest[]>('/api/v1/health-report-requests'),
  });
  const send = useMutation({
    mutationFn: (requestId: string) => postJson(`/api/v1/health-report-requests/${requestId}/send`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['health-reports'] });
      onDone('Đã gửi báo cáo sức khỏe cho phụ huynh');
    },
  });
  const error = [reports.error, send.error, grid.error].find(Boolean);
  const rows = (reports.data ?? []).filter(
    (report) =>
      (statusFilter === '' || report.status === statusFilter) &&
      (typeFilter === '' || report.report_type === typeFilter) &&
      matchesSearch(search, report.full_name, report.note),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <DataGrid
        label="Danh sách yêu cầu báo cáo sức khỏe"
        columns={REPORT_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.full_name}
        getRowAriaLabel={(row) => `Yêu cầu của ${row.full_name}`}
        loading={reports.isLoading}
        emptyText="Chưa có yêu cầu báo cáo."
        search={{ label: 'Tìm theo học sinh, ghi chú', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Loại
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(REPORT_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="pending">Chờ gửi</option>
                <option value="sent">Đã gửi</option>
              </select>
            </label>
          </div>
        }
        rowActions={(row) =>
          row.status === 'pending' ? (
            <Button variant="text" disabled={send.isPending} onClick={() => send.mutate(row.id)}>
              Tổng hợp và gửi
            </Button>
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </div>
  );
}

function StandardsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
  const grid = useGridSettings('health-standards');
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Standard>();
  const [search, setSearch] = useState('');
  const [indicatorFilter, setIndicatorFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [indicator, setIndicator] = useState<'height_cm' | 'weight_kg' | 'bmi'>('weight_kg');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [lower, setLower] = useState('');
  const [upper, setUpper] = useState('');
  const [source, setSource] = useState('');
  const standards = useQuery({
    queryKey: ['health-standards'],
    queryFn: () => requestJson<Standard[]>('/api/v1/health-standards'),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['health-standards'] });
    onDone(message);
  };
  const create = useMutation({
    mutationFn: () =>
      postJson('/api/v1/health-standards', {
        indicator_code: indicator,
        gender,
        age_month_from: Number(fromMonth),
        age_month_to: Number(toMonth),
        lower_value: Number(lower),
        upper_value: Number(upper),
        source_document: source,
      }),
    onSuccess: () => {
      setCreating(false);
      return refresh('Đã thêm tiêu chuẩn');
    },
  });
  const remove = useMutation({
    mutationFn: (standardId: string) => requestJson(`/api/v1/health-standards/${standardId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRemoving(undefined);
      return refresh('Đã xóa tiêu chuẩn');
    },
    onError: () => setRemoving(undefined),
  });
  const error = [standards.error, create.error, remove.error, grid.error].find(Boolean);
  const rows = (standards.data ?? []).filter(
    (row) =>
      (indicatorFilter === '' || row.indicator_code === indicatorFilter) &&
      (genderFilter === '' || row.gender === genderFilter) &&
      matchesSearch(search, INDICATOR_LABELS[row.indicator_code], row.source_document),
  );
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {creating ? (
        <form
          aria-label="Thêm tiêu chuẩn"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Chỉ số
            <select
              value={indicator}
              onChange={(event) => setIndicator(event.target.value as 'height_cm' | 'weight_kg' | 'bmi')}
              className={selectClass}
            >
              {Object.entries(INDICATOR_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label font-medium text-text">
            Giới tính
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value as 'male' | 'female')}
              className={selectClass}
            >
              <option value="female">Nữ</option>
              <option value="male">Nam</option>
            </select>
          </label>
          <TextField label="Từ tháng tuổi" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} />
          <TextField label="Đến tháng tuổi" value={toMonth} onChange={(event) => setToMonth(event.target.value)} />
          <TextField label="Ngưỡng dưới" value={lower} onChange={(event) => setLower(event.target.value)} />
          <TextField label="Ngưỡng trên" value={upper} onChange={(event) => setUpper(event.target.value)} />
          <TextField label="Văn bản nguồn" value={source} onChange={(event) => setSource(event.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={create.isPending || source === ''}>
              Thêm tiêu chuẩn
            </Button>
            <Button variant="text" onClick={() => setCreating(false)}>
              Hủy
            </Button>
          </div>
        </form>
      ) : null}
      <DataGrid
        label="Danh sách tiêu chuẩn sức khỏe"
        columns={STANDARD_COLUMNS}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={standardLabelOf}
        loading={standards.isLoading}
        emptyText="Chưa có tiêu chuẩn sức khỏe."
        search={{ label: 'Tìm theo chỉ số, văn bản nguồn', value: search, onChange: setSearch }}
        advancedSearch={
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-label font-medium text-text">
              Chỉ số
              <select
                value={indicatorFilter}
                onChange={(event) => setIndicatorFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                {Object.entries(INDICATOR_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-label font-medium text-text">
              Giới tính
              <select
                value={genderFilter}
                onChange={(event) => setGenderFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">Tất cả</option>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
              </select>
            </label>
          </div>
        }
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <Button variant="text" disabled={remove.isPending} onClick={() => setRemoving(row)}>
            Xóa
          </Button>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      {removing ? (
        <ConfirmDeleteDialog
          open
          title="Xóa tiêu chuẩn sức khỏe"
          subject={`tiêu chuẩn ${standardLabelOf(removing)}`}
          busy={remove.isPending}
          onCancel={() => setRemoving(undefined)}
          onConfirm={() => remove.mutate(removing.id)}
        />
      ) : null}
    </div>
  );
}
