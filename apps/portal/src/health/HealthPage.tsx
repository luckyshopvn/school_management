import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
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
// ghi và công bố kết quả; xem sự kiện y tế; gửi báo cáo sức khỏe phụ huynh yêu cầu; quản lý tiêu chuẩn sức khỏe
type Tab = 'campaigns' | 'events' | 'reports' | 'standards';
const selectClass = 'mt-2 block w-full rounded-lg border border-border bg-card px-3 py-2 text-content font-normal';
const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

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
        <h1 className="text-page-title font-bold text-text">Y tế học đường</h1>
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
  const [campaignId, setCampaignId] = useState('');
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
  const error = [campaigns.error, createCampaign.error, createSchedule.error, publish.error, close.error].find(Boolean);
  const selected = campaigns.data?.find((campaign) => campaign.id === campaignId);

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-4">
        <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
        <label className="text-label font-medium text-text">
          Đợt khám
          <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className={selectClass}>
            <option value="">Chọn đợt khám</option>
            {(campaigns.data ?? []).map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.status === 'open' ? 'đang mở' : 'đã đóng'})
              </option>
            ))}
          </select>
        </label>
      </div>
      <form
        aria-label="Lập đợt khám"
        className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          createCampaign.mutate();
        }}
      >
        <TextField label="Tên đợt khám" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Từ ngày" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <TextField label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={createCampaign.isPending || name === '' || !orgUnitId}>
            Lập đợt khám
          </Button>
        </div>
      </form>

      {selected ? (
        <section className="flex flex-col gap-3" aria-label="Chi tiết đợt khám">
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
          <ul className="text-content text-text">
            {(schedules.data ?? []).map((schedule) => (
              <li key={schedule.id}>
                Lớp {schedule.class_name}: {schedule.check_date} tại {schedule.location}
              </li>
            ))}
          </ul>
          <table className="w-full text-content">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2">Trẻ</th>
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
      await queryClient.invalidateQueries({ queryKey: ['medical-events'] });
      onDone('Đã ghi sự kiện y tế và báo phụ huynh');
    },
  });
  const error = [events.error, record.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
      {canRecord ? (
        <form
          aria-label="Ghi sự kiện y tế"
          className="grid grid-cols-1 gap-3 rounded-lg bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            record.mutate();
          }}
        >
          <label className="text-label font-medium text-text">
            Trẻ
            <select value={childId} onChange={(event) => setChildId(event.target.value)} className={selectClass}>
              <option value="">Chọn trẻ</option>
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
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              disabled={record.isPending || childId === '' || symptoms === '' || handling === ''}
            >
              Ghi sự kiện
            </Button>
          </div>
        </form>
      ) : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Thời điểm</th>
            <th>Trẻ</th>
            <th>Triệu chứng</th>
            <th>Xử lý</th>
            <th>Người xử lý</th>
            <th>Mức độ</th>
            <th>Phụ huynh</th>
          </tr>
        </thead>
        <tbody>
          {(events.data ?? []).map((event) => (
            <tr key={event.id} className="border-t border-border">
              <td className="py-2">{new Date(event.occurred_at).toLocaleString('vi-VN')}</td>
              <td>{event.full_name}</td>
              <td>{event.symptoms}</td>
              <td>{event.handling}</td>
              <td>{event.handler_name}</td>
              <td>{SEVERITY_LABELS[event.severity]}</td>
              <td>
                {event.parent_acknowledged_at
                  ? `Đã biết lúc ${new Date(event.parent_acknowledged_at).toLocaleString('vi-VN')}`
                  : 'Chưa xác nhận'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
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
  const error = [reports.error, send.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Trẻ</th>
            <th>Loại</th>
            <th>Kỳ</th>
            <th>Ghi chú</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(reports.data ?? []).map((report) => (
            <tr key={report.id} className="border-t border-border" aria-label={`Yêu cầu của ${report.full_name}`}>
              <td className="py-2">{report.full_name}</td>
              <td>{REPORT_TYPE_LABELS[report.report_type]}</td>
              <td>
                {report.period_from} đến {report.period_to}
              </td>
              <td>{report.note}</td>
              <td>{report.status === 'sent' ? 'Đã gửi' : 'Chờ gửi'}</td>
              <td>
                {report.status === 'pending' ? (
                  <Button variant="text" disabled={send.isPending} onClick={() => send.mutate(report.id)}>
                    Tổng hợp và gửi
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.data?.length === 0 ? <p className="text-content text-text-secondary">Chưa có yêu cầu báo cáo.</p> : null}
    </div>
  );
}

function StandardsTab({ onDone }: { onDone(message: string): void }) {
  const queryClient = useQueryClient();
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
    onSuccess: () => refresh('Đã thêm tiêu chuẩn'),
  });
  const remove = useMutation({
    mutationFn: (standardId: string) => requestJson(`/api/v1/health-standards/${standardId}`, { method: 'DELETE' }),
    onSuccess: () => refresh('Đã xóa tiêu chuẩn'),
  });
  const error = [standards.error, create.error, remove.error].find(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
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
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={create.isPending || source === ''}>
            Thêm tiêu chuẩn
          </Button>
        </div>
      </form>
      <table className="w-full text-content">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2">Chỉ số</th>
            <th>Giới tính</th>
            <th>Tháng tuổi</th>
            <th>Ngưỡng</th>
            <th>Nguồn</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(standards.data ?? []).map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="py-2">{INDICATOR_LABELS[row.indicator_code]}</td>
              <td>{row.gender === 'female' ? 'Nữ' : 'Nam'}</td>
              <td>
                {row.age_month_from} đến {row.age_month_to}
              </td>
              <td>
                {Number(row.lower_value)} đến {Number(row.upper_value)}
              </td>
              <td>{row.source_document}</td>
              <td>
                <Button variant="text" disabled={remove.isPending} onClick={() => remove.mutate(row.id)}>
                  Xóa
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
