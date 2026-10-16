import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  TextField,
  Toast,
  type DataGridColumn,
} from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { listStaff } from '../staff/staff-api.js';

// MH-56 Lịch nghỉ và lịch công tác (P08-02, YCTD-68): phòng nhân sự, quản lý đơn vị lập lịch nháp theo tháng rồi công bố
// cho nhân sự; xóa lịch khi kỳ công còn mở. Giao diện chung theo Sở (DT-15 phần 15f2): lưới dữ liệu (khóa
// `work-schedules`) tìm theo nhân sự, mở rộng tìm kiếm theo loại và trạng thái; Thêm mới mở biểu mẫu theo khối có nút Ghi;
// xóa qua hộp xác nhận xóa
interface WorkSchedule {
  id: string;
  staff_id: string;
  full_name: string;
  schedule_date: string;
  schedule_type: 'business_trip' | 'day_off';
  note: string | null;
  status: 'draft' | 'published';
}

type ScheduleType = WorkSchedule['schedule_type'];

const TYPE_LABELS = { business_trip: 'Công tác', day_off: 'Nghỉ theo lịch' } as const;
const STATUS_LABELS = { draft: 'Nháp', published: 'Đã công bố' } as const;
const filterClass = `mt-1 ${FORM_CONTROL_CLASS}`;
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const COLUMNS: Array<DataGridColumn<WorkSchedule>> = [
  { id: 'schedule_date', header: 'Ngày', cell: (row) => row.schedule_date },
  { id: 'full_name', header: 'Nhân sự', alwaysVisible: true, className: 'font-medium', cell: (row) => row.full_name },
  { id: 'schedule_type', header: 'Loại', cell: (row) => TYPE_LABELS[row.schedule_type] },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
  { id: 'status', header: 'Trạng thái', cell: (row) => STATUS_LABELS[row.status] },
];

function ScheduleForm({
  orgUnitId,
  onSaved,
  onCancel,
}: {
  orgUnitId: string;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const [staffId, setStaffId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('business_trip');
  const [note, setNote] = useState('');
  const staff = useQuery({ queryKey: ['staff', orgUnitId, ''], queryFn: () => listStaff(orgUnitId, '') });
  const create = useMutation({
    mutationFn: () =>
      requestJson('/api/v1/work-schedules', {
        method: 'POST',
        body: JSON.stringify({
          staff_id: staffId,
          schedule_date: scheduleDate,
          schedule_type: scheduleType,
          note: note || null,
        }),
      }),
    onSuccess: () => onSaved('Đã thêm lịch nháp'),
  });
  return (
    <form
      aria-label="Thêm lịch"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
      {staff.error ? <Alert tone="danger">{messageOf(staff.error)}</Alert> : null}
      <FormBlock title="Thêm lịch">
        <FormRow label="Nhân sự">
          <select className={FORM_CONTROL_CLASS} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">Chọn nhân sự</option>
            {(staff.data ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={scheduleDate}
            onChange={(event) => setScheduleDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Loại lịch">
          <select
            className={FORM_CONTROL_CLASS}
            value={scheduleType}
            onChange={(event) => setScheduleType(event.target.value as ScheduleType)}
          >
            <option value="business_trip">Công tác</option>
            <option value="day_off">Nghỉ theo lịch</option>
          </select>
        </FormRow>
        <FormRow label="Ghi chú lịch">
          <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={create.isPending || staffId === '' || scheduleDate === ''}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export function WorkSchedulesPage() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(PERMISSION_CODES.workScheduleManage);
  const grid = useGridSettings('work-schedules');
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [month, setMonth] = useState(vietnamMonth);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ScheduleType | ''>('');
  const [statusFilter, setStatusFilter] = useState<WorkSchedule['status'] | ''>('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WorkSchedule>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const schedules = useQuery({
    queryKey: ['work-schedules', orgUnitId, month],
    queryFn: () => requestJson<WorkSchedule[]>(`/api/v1/work-schedules?org_unit_id=${orgUnitId}&month=${month}`),
    enabled: Boolean(orgUnitId) && /^\d{4}-\d{2}$/.test(month),
  });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['work-schedules'] });
    setToastMessage(message);
  };
  const publish = useMutation({
    mutationFn: () =>
      requestJson<{ published_count: number }>('/api/v1/work-schedules/publish', {
        method: 'POST',
        body: JSON.stringify({ org_unit_id: orgUnitId, month }),
      }),
    onSuccess: (result) => refresh(`Đã công bố ${result.published_count} lịch`),
  });
  const remove = useMutation({
    mutationFn: (scheduleId: string) => requestJson(`/api/v1/work-schedules/${scheduleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(undefined);
      return refresh('Đã xóa lịch');
    },
  });
  const error = [schedules.error, publish.error, grid.error].find(Boolean);
  const keyword = search.trim().toLocaleLowerCase('vi');
  const rows = (schedules.data ?? []).filter(
    (row) =>
      (typeFilter === '' || row.schedule_type === typeFilter) &&
      (statusFilter === '' || row.status === statusFilter) &&
      (keyword === '' || row.full_name.toLocaleLowerCase('vi').includes(keyword)),
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/work-schedules')}</h1>
        {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <div className="w-48">
            <TextField
              label="Tháng của lịch"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </div>
        {creating && orgUnitId ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <ScheduleForm
              key={orgUnitId}
              orgUnitId={orgUnitId}
              onCancel={() => setCreating(false)}
              onSaved={(message) => {
                setCreating(false);
                void refresh(message);
              }}
            />
          </section>
        ) : null}
        <DataGrid
          label="Danh sách lịch công tác"
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `lịch của ${row.full_name} ngày ${row.schedule_date}`}
          getRowAriaLabel={(row) => `Lịch của ${row.full_name} ngày ${row.schedule_date}`}
          loading={Boolean(orgUnitId) && schedules.isPending}
          emptyText="Tháng này chưa có lịch."
          search={{ label: 'Tìm theo nhân sự', value: search, onChange: setSearch }}
          advancedSearch={
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-label font-medium text-text">
                Loại
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as ScheduleType | '')}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  <option value="business_trip">{TYPE_LABELS.business_trip}</option>
                  <option value="day_off">{TYPE_LABELS.day_off}</option>
                </select>
              </label>
              <label className="text-label font-medium text-text">
                Trạng thái
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as WorkSchedule['status'] | '')}
                  className={filterClass}
                >
                  <option value="">Tất cả</option>
                  <option value="draft">{STATUS_LABELS.draft}</option>
                  <option value="published">{STATUS_LABELS.published}</option>
                </select>
              </label>
            </div>
          }
          toolbar={
            canManage ? (
              <>
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Thêm mới
                </Button>
                <Button disabled={publish.isPending} onClick={() => publish.mutate()}>
                  Công bố lịch tháng
                </Button>
              </>
            ) : null
          }
          rowActions={
            canManage
              ? (row) => (
                  <Button variant="text" onClick={() => setDeleting(row)}>
                    Xóa
                  </Button>
                )
              : undefined
          }
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
      </div>
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        subject={deleting ? `lịch của ${deleting.full_name} ngày ${deleting.schedule_date}` : ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => {
          setDeleting(undefined);
          remove.reset();
        }}
      >
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      </ConfirmDeleteDialog>
    </AppShell>
  );
}
