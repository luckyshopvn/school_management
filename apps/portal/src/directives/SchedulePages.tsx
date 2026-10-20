import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSION_CODES,
  ROOM_BOOKING_STATUS_LABELS,
  SCHEDULE_SESSION_LABELS,
  WEEKDAY_LABELS,
  type RoomBookingStatusKey,
  type ScheduleSessionKey,
} from '@school-management/shared';
import {
  Alert,
  Button,
  ConfirmDeleteDialog,
  DataGrid,
  FORM_CONTROL_CLASS,
  FormBlock,
  FormRow,
  StatusBadge,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { useGridSettings } from '../pages/grid-settings.js';
import { useHasPermission } from '../session/permissions.js';
import { fieldErrorsOf, formatDate, messageOf, selectClass, useArchiveUnits } from '../archives/archive-ui.js';
import { listDocumentStaff } from '../incoming-documents/incoming-api.js';
import {
  applyTemplate,
  cancelBooking,
  createBooking,
  decideBooking,
  deleteEntry,
  deleteRoom,
  deleteTemplate,
  exportEntries,
  listBookings,
  listEntries,
  listRooms,
  listTemplates,
  publishEntries,
  saveEntry,
  saveRoom,
  saveTemplate,
  type MeetingRoom,
  type RoomBooking,
  type ScheduleEntry,
  type ScheduleQuery,
  type ScheduleTemplate,
  type ScheduleTemplateItem,
} from './directives-api.js';
import { formatTime, mondayOf, Page, shiftDate, Tabs, todayText, useToast } from './directive-ui.js';

// Quản lý lịch đơn vị theo VNPT iOffice (DT-18 phần 18c, YCTD-141): 6.1 Đăng ký lịch đơn vị (lịch tuần thứ Hai đến Chủ
// nhật theo buổi sáng, chiều; công bố; áp mẫu lịch), 6.2 Lịch họp (tuần, tháng, tất cả, lịch của tôi; lọc đơn vị, địa điểm,
// thành phần; Xuất Excel, Xuất PDF, In lịch), 6.3 Đăng ký phòng họp (chờ phê duyệt, phê duyệt, bị từ chối), 6.4 Phòng họp,
// 6.5 Mẫu lịch
const MANAGE = PERMISSION_CODES.scheduleManage;
const ROOMS = PERMISSION_CODES.meetingRoomManage;
const SESSIONS = Object.entries(SCHEDULE_SESSION_LABELS) as Array<[ScheduleSessionKey, string]>;
const BOOKING_TONES: Record<RoomBookingStatusKey, StatusTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};
const weekdayOf = (date: string) => WEEKDAY_LABELS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] ?? '';

// ---- Bảng lịch theo ngày và buổi ----

function ScheduleTable({
  from,
  to,
  entries,
  actions,
  addButton,
}: {
  from: string;
  to: string;
  entries: ScheduleEntry[];
  actions?(entry: ScheduleEntry): ReactNode;
  addButton?(date: string, session: ScheduleSessionKey): ReactNode;
}) {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDate(day, 1)) {
    days.push(day);
  }
  // Ngày không có lịch ở lịch tháng, tất cả thì bỏ cho gọn; lịch tuần hiện đủ bảy ngày để đăng ký
  const shown = addButton ? days : days.filter((day) => entries.some((entry) => entry.entry_date === day));
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-content" aria-label="Lịch công tác">
        <thead>
          <tr className="border-b border-border text-left text-label text-text-secondary">
            <th className="p-2">Thứ, ngày</th>
            <th className="p-2">Buổi</th>
            <th className="p-2">Giờ</th>
            <th className="p-2">Nội dung</th>
            <th className="p-2">Chủ trì</th>
            <th className="p-2">Thành phần</th>
            <th className="p-2">Địa điểm</th>
            <th className="p-2">Ghi chú</th>
            {actions || addButton ? <th className="p-2 print:hidden">Thao tác</th> : null}
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 ? (
            <tr>
              <td className="p-3 text-text-secondary" colSpan={9}>
                Không có lịch trong khoảng ngày đã chọn.
              </td>
            </tr>
          ) : null}
          {shown.flatMap((day) => {
            const dayRows = SESSIONS.flatMap(([session, sessionLabel]) => {
              const items = entries.filter((entry) => entry.entry_date === day && entry.session === session);
              if (!addButton && items.length === 0) {
                return [];
              }
              const list: Array<ScheduleEntry | null> = items.length > 0 ? items : [null];
              return list.map((entry, index) => ({
                entry,
                session,
                sessionLabel: index === 0 ? sessionLabel : '',
                last: index === list.length - 1,
              }));
            });
            return dayRows.map(({ entry, session, sessionLabel, last }, position) => (
              <tr key={`${day}-${session}-${entry?.id ?? 'empty'}`} className="border-b border-border align-top">
                <td className="p-2 font-semibold">
                  {position === 0 ? (
                    <>
                      {weekdayOf(day)}
                      <span className="block font-normal">{formatDate(day)}</span>
                    </>
                  ) : null}
                </td>
                <td className="p-2">{sessionLabel}</td>
                <td className="p-2">{entry ? [entry.start_time, entry.end_time].filter(Boolean).join(' – ') : ''}</td>
                <td className="p-2">
                  {entry ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{entry.content}</span>
                      {entry.status === 'draft' ? <StatusBadge tone="neutral" label="Nháp" /> : null}
                      {entry.room_status && entry.room_status !== 'approved' ? (
                        <StatusBadge
                          tone={BOOKING_TONES[entry.room_status]}
                          label={`Phòng họp: ${ROOM_BOOKING_STATUS_LABELS[entry.room_status].toLowerCase()}`}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </td>
                <td className="p-2">{entry?.chair_name ?? ''}</td>
                <td className="p-2">
                  {entry?.participants ?? ''}
                  {entry && entry.attendees.length > 0 ? (
                    <span className="block text-label text-text-secondary">
                      {entry.attendees.map((attendee) => attendee.user_name).join(', ')}
                    </span>
                  ) : null}
                </td>
                <td className="p-2">{entry ? (entry.location ?? entry.room_name ?? '') : ''}</td>
                <td className="p-2">{entry?.note ?? ''}</td>
                {actions || addButton ? (
                  <td className="p-2 print:hidden">
                    <span className="flex flex-wrap gap-1">
                      {entry && actions ? actions(entry) : null}
                      {last && addButton ? addButton(day, session) : null}
                    </span>
                  </td>
                ) : null}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekPicker({ monday, onChange }: { monday: string; onChange(monday: string): void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button variant="secondary" onClick={() => onChange(shiftDate(monday, -7))}>
        Tuần trước
      </Button>
      <label className="text-label font-medium text-text">
        Tuần có ngày
        <input
          type="date"
          className={selectClass}
          value={monday}
          onChange={(event) => event.target.value && onChange(mondayOf(event.target.value))}
        />
      </label>
      <Button variant="secondary" onClick={() => onChange(shiftDate(monday, 7))}>
        Tuần sau
      </Button>
      <span className="pb-2 text-content text-text-secondary">
        Từ {formatDate(monday)} đến {formatDate(shiftDate(monday, 6))}
      </span>
    </div>
  );
}

function UnitSelect({
  value,
  onChange,
  permission,
  allLabel,
}: {
  value: string;
  onChange(value: string): void;
  permission: string;
  allLabel: string;
}) {
  const units = useArchiveUnits(permission);
  return (
    <label className="text-label font-medium text-text">
      Đơn vị
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {units.units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---- Biểu mẫu dòng lịch ----

function EntryForm({
  entry,
  initial,
  orgUnitId,
  onSaved,
  onCancel,
}: {
  entry?: ScheduleEntry;
  initial?: { entry_date: string; session: ScheduleSessionKey };
  orgUnitId: string;
  onSaved(entry: ScheduleEntry): void;
  onCancel(): void;
}) {
  const rooms = useQuery({ queryKey: ['meeting-rooms', 'active'], queryFn: () => listRooms(true) });
  const staff = useQuery({ queryKey: ['document-staff'], queryFn: listDocumentStaff });
  const [values, setValues] = useState({
    entry_date: entry?.entry_date ?? initial?.entry_date ?? todayText(),
    session: entry?.session ?? initial?.session ?? 'morning',
    start_time: entry?.start_time ?? '',
    end_time: entry?.end_time ?? '',
    content: entry?.content ?? '',
    chair_name: entry?.chair_name ?? '',
    participants: entry?.participants ?? '',
    location: entry?.room_id ? '' : (entry?.location ?? ''),
    note: entry?.note ?? '',
    room_id: entry?.room_id ?? '',
    attendee_ids: entry?.attendees.map((attendee) => attendee.user_id) ?? [],
  });
  const save = useMutation({
    mutationFn: () =>
      saveEntry(entry?.id ?? null, {
        ...values,
        org_unit_id: entry ? entry.org_unit_id : orgUnitId || null,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        room_id: values.room_id || null,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: Exclude<keyof typeof values, 'attendee_ids'>, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const text = (key: 'content' | 'chair_name' | 'participants' | 'location' | 'note', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input className={FORM_CONTROL_CLASS} value={values[key]} onChange={(event) => set(key, event.target.value)} />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={entry ? `Sửa lịch ${entry.content}` : 'Thêm lịch'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Nội dung lịch">
        <FormRow label="Ngày" error={errors.entry_date}>
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={values.entry_date}
            onChange={(event) => set('entry_date', event.target.value)}
          />
        </FormRow>
        <FormRow label="Buổi" error={errors.session}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.session}
            onChange={(event) => set('session', event.target.value)}
          >
            {SESSIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Giờ bắt đầu" error={errors.start_time}>
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={values.start_time}
            onChange={(event) => set('start_time', event.target.value)}
          />
        </FormRow>
        <FormRow label="Giờ kết thúc" error={errors.end_time}>
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={values.end_time}
            onChange={(event) => set('end_time', event.target.value)}
          />
        </FormRow>
        {text('content', 'Nội dung')}
        {text('chair_name', 'Chủ trì')}
        {text('participants', 'Thành phần')}
        <FormRow label="Phòng họp" error={errors.room_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.room_id}
            onChange={(event) => set('room_id', event.target.value)}
          >
            <option value="">Không đăng ký phòng họp</option>
            {(rooms.data ?? []).map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </FormRow>
        {text('location', 'Địa điểm')}
        <FormRow label="Người tham dự" error={errors.attendee_ids}>
          <select
            multiple
            className={`${FORM_CONTROL_CLASS} h-32`}
            value={values.attendee_ids}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                attendee_ids: [...event.target.selectedOptions].map((option) => option.value),
              }))
            }
          >
            {(staff.data ?? []).map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
              </option>
            ))}
          </select>
        </FormRow>
        {text('note', 'Ghi chú')}
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

// ---- 6.1 Đăng ký lịch đơn vị ----

export function UnitSchedulePage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const [monday, setMonday] = useState(mondayOf(todayText()));
  const [orgUnitId, setOrgUnitId] = useState('');
  const [editing, setEditing] = useState<{ entry?: ScheduleEntry; date?: string; session?: ScheduleSessionKey }>();
  const [deleting, setDeleting] = useState<ScheduleEntry>();
  const [templateId, setTemplateId] = useState('');
  const sunday = shiftDate(monday, 6);
  const filter: ScheduleQuery = { from: monday, to: sunday, org_unit_id: orgUnitId };
  const entries = useQuery({ queryKey: ['unit-schedules', filter], queryFn: () => listEntries(filter) });
  const templates = useQuery({ queryKey: ['schedule-templates'], queryFn: listTemplates });
  // Lịch của đơn vị đang chọn; "Toàn trường" chỉ hiện lịch toàn trường để đăng ký, công bố đúng lịch đó
  const rows = (entries.data ?? []).filter((entry) => (entry.org_unit_id ?? '') === orgUnitId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['unit-schedules'] });
  const publish = useMutation({
    mutationFn: () => publishEntries({ from: monday, to: sunday, org_unit_id: orgUnitId || null }),
    onSuccess: async (result) => {
      await refresh();
      setToast(`Đã công bố ${result.published} nội dung`);
    },
  });
  const apply = useMutation({
    mutationFn: () => applyTemplate(templateId, monday, orgUnitId || null),
    onSuccess: async (result) => {
      await refresh();
      setToast(`Đã thêm ${result.created} dòng nháp từ mẫu lịch`);
    },
  });
  const remove = useMutation({
    mutationFn: (entry: ScheduleEntry) => deleteEntry(entry.id),
    onSuccess: async () => {
      setDeleting(undefined);
      await refresh();
      setToast('Đã xóa dòng lịch');
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/unit-schedules" toast={toast} onToastClose={close}>
      <div className="flex flex-wrap items-end gap-3">
        <WeekPicker monday={monday} onChange={setMonday} />
        <div className="min-w-60">
          <UnitSelect value={orgUnitId} onChange={setOrgUnitId} permission={MANAGE} allLabel="Toàn trường" />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="primary" disabled={publish.isPending} onClick={() => publish.mutate()}>
          Công bố lịch tuần
        </Button>
        <label className="text-label font-medium text-text">
          Mẫu lịch
          <select className={selectClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">— Chọn mẫu —</option>
            {(templates.data ?? []).map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={!templateId || apply.isPending} onClick={() => apply.mutate()}>
          Áp mẫu vào tuần
        </Button>
        <Button variant="secondary" onClick={() => void exportEntries(filter, 'pdf')}>
          Xuất PDF
        </Button>
      </div>
      {[entries.error, publish.error, apply.error, remove.error].filter(Boolean).map((error, index) => (
        <Alert key={index} tone="danger">
          {messageOf(error)}
        </Alert>
      ))}
      {editing ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <EntryForm
            key={editing.entry?.id ?? `${editing.date}-${editing.session}`}
            entry={editing.entry}
            initial={editing.date ? { entry_date: editing.date, session: editing.session ?? 'morning' } : undefined}
            orgUnitId={orgUnitId}
            onCancel={() => setEditing(undefined)}
            onSaved={async () => {
              setEditing(undefined);
              await refresh();
              setToast('Đã ghi lịch');
            }}
          />
        </section>
      ) : null}
      <ScheduleTable
        from={monday}
        to={sunday}
        entries={rows}
        actions={(entry) =>
          entry.can_edit ? (
            <>
              <Button variant="text" onClick={() => setEditing({ entry })}>
                Sửa
              </Button>
              <Button variant="text" onClick={() => setDeleting(entry)}>
                Xóa
              </Button>
            </>
          ) : null
        }
        addButton={(date, session) => (
          <Button variant="text" onClick={() => setEditing({ date, session })}>
            {`Thêm ${SCHEDULE_SESSION_LABELS[session].toLowerCase()} ${formatDate(date)}`}
          </Button>
        )}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.content ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- 6.2 Lịch họp ----

type MeetingView = 'week' | 'month' | 'all' | 'mine';

export function MeetingSchedulePage() {
  const [view, setView] = useState<MeetingView>('week');
  const [monday, setMonday] = useState(mondayOf(todayText()));
  const [month, setMonth] = useState(todayText().slice(0, 7));
  const [range, setRange] = useState({ from: shiftDate(todayText(), -30), to: shiftDate(todayText(), 30) });
  const [orgUnitId, setOrgUnitId] = useState('');
  const [location, setLocation] = useState('');
  const [participant, setParticipant] = useState('');
  const [exportError, setExportError] = useState<string>();
  const monthEnd = (() => {
    const [year, monthNumber] = month.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  })();
  const period =
    view === 'month'
      ? { from: `${month}-01`, to: monthEnd }
      : view === 'all'
        ? range
        : { from: monday, to: shiftDate(monday, 6) };
  const filter: ScheduleQuery = {
    ...period,
    org_unit_id: orgUnitId,
    view: view === 'mine' ? 'mine' : '',
    location,
    participant,
  };
  const entries = useQuery({ queryKey: ['unit-schedules', 'meetings', filter], queryFn: () => listEntries(filter) });
  const download = (format: 'xlsx' | 'pdf') => {
    setExportError(undefined);
    exportEntries(filter, format).catch((error: unknown) => setExportError(messageOf(error)));
  };
  return (
    <Page path="/meeting-schedules">
      <div className="print:hidden">
        <Tabs<MeetingView>
          label="Xem lịch họp"
          value={view}
          options={[
            { value: 'week', label: 'Lịch tuần' },
            { value: 'month', label: 'Lịch tháng' },
            { value: 'all', label: 'Tất cả' },
            { value: 'mine', label: 'Lịch của tôi' },
          ]}
          onChange={setView}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        {view === 'week' || view === 'mine' ? <WeekPicker monday={monday} onChange={setMonday} /> : null}
        {view === 'month' ? (
          <label className="text-label font-medium text-text">
            Tháng
            <input
              type="month"
              className={selectClass}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        ) : null}
        {view === 'all' ? (
          <>
            <label className="text-label font-medium text-text">
              Từ ngày
              <input
                type="date"
                className={selectClass}
                value={range.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              />
            </label>
            <label className="text-label font-medium text-text">
              Đến ngày
              <input
                type="date"
                className={selectClass}
                value={range.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </label>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 print:hidden">
        <UnitSelect
          value={orgUnitId}
          onChange={setOrgUnitId}
          permission={PERMISSION_CODES.scheduleView}
          allLabel="Tất cả"
        />
        <label className="text-label font-medium text-text">
          Địa điểm
          <input className={selectClass} value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label className="text-label font-medium text-text">
          Thành phần
          <input className={selectClass} value={participant} onChange={(event) => setParticipant(event.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="secondary" onClick={() => download('xlsx')}>
          Xuất Excel
        </Button>
        <Button variant="secondary" onClick={() => download('pdf')}>
          Xuất PDF
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          In lịch
        </Button>
      </div>
      {entries.error ? <Alert tone="danger">{messageOf(entries.error)}</Alert> : null}
      {exportError ? <Alert tone="danger">{exportError}</Alert> : null}
      <ScheduleTable
        from={period.from}
        to={period.to}
        entries={(entries.data ?? []).filter((entry) => entry.status === 'published')}
      />
    </Page>
  );
}

// ---- 6.3 Đăng ký phòng họp ----

function BookingForm({ onSaved, onCancel }: { onSaved(booking: RoomBooking): void; onCancel(): void }) {
  const rooms = useQuery({ queryKey: ['meeting-rooms', 'active'], queryFn: () => listRooms(true) });
  const [values, setValues] = useState({
    room_id: '',
    title: '',
    chair_name: '',
    participants: '',
    date: todayText(),
    start_time: '08:00',
    end_time: '09:00',
    note: '',
  });
  const save = useMutation({
    mutationFn: () => createBooking({ ...values, chair_name: values.chair_name || null }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (key: keyof typeof values, label: string, type = 'text') => (
    <FormRow label={label} error={errors[key]}>
      <input
        type={type}
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label="Đăng ký sử dụng phòng họp"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Đăng ký sử dụng">
        <FormRow label="Phòng họp" error={errors.room_id}>
          <select
            className={FORM_CONTROL_CLASS}
            value={values.room_id}
            onChange={(event) => set('room_id', event.target.value)}
          >
            <option value="">— Chọn phòng họp —</option>
            {(rooms.data ?? []).map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </FormRow>
        {input('title', 'Tiêu đề')}
        {input('chair_name', 'Chủ trì')}
        {input('participants', 'Thành phần')}
        {input('date', 'Ngày', 'date')}
        {input('start_time', 'Từ giờ', 'time')}
        {input('end_time', 'Đến giờ', 'time')}
        {input('note', 'Ghi chú')}
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Đăng ký sử dụng
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const BOOKING_COLUMNS: Array<DataGridColumn<RoomBooking>> = [
  { id: 'room_name', header: 'Phòng họp', cell: (row) => row.room_name },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (row) => <StatusBadge tone={BOOKING_TONES[row.status]} label={ROOM_BOOKING_STATUS_LABELS[row.status]} />,
  },
  {
    id: 'time',
    header: 'Thời gian',
    cell: (row) =>
      `${formatDate(row.starts_at.slice(0, 10))} ${formatTime(row.starts_at)} – ${formatTime(row.ends_at)}`,
  },
  { id: 'title', header: 'Tiêu đề', alwaysVisible: true, className: 'font-medium', cell: (row) => row.title },
  { id: 'chair_name', header: 'Chủ trì', cell: (row) => row.chair_name ?? '' },
  { id: 'requested_by_name', header: 'Người đăng ký', cell: (row) => row.requested_by_name },
  {
    id: 'decision',
    header: 'Người duyệt',
    hiddenByDefault: true,
    cell: (row) => [row.decided_by_name, row.decision_note].filter(Boolean).join(': '),
  },
];

export function RoomBookingsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('room-bookings');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState({
    from: shiftDate(todayText(), -7),
    to: shiftDate(todayText(), 30),
    status: '' as RoomBookingStatusKey | '',
    mine: false,
  });
  const [rejecting, setRejecting] = useState<RoomBooking>();
  const [reason, setReason] = useState('');
  const bookings = useQuery({ queryKey: ['room-bookings', filter], queryFn: () => listBookings(filter) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
  const decide = useMutation({
    mutationFn: (input: { booking: RoomBooking; approve: boolean; note: string | null }) =>
      decideBooking(input.booking.id, input.approve, input.note),
    onSuccess: async (booking) => {
      setRejecting(undefined);
      setReason('');
      await refresh();
      setToast(`${ROOM_BOOKING_STATUS_LABELS[booking.status]}: ${booking.title}`);
    },
  });
  const cancel = useMutation({
    mutationFn: (booking: RoomBooking) => cancelBooking(booking.id),
    onSuccess: async () => {
      await refresh();
      setToast('Đã hủy đăng ký');
    },
  });
  return (
    <Page path="/room-bookings" toast={toast} onToastClose={close}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-label font-medium text-text">
          Từ ngày
          <input
            type="date"
            className={selectClass}
            value={filter.from}
            onChange={(event) => setFilter((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label className="text-label font-medium text-text">
          Đến ngày
          <input
            type="date"
            className={selectClass}
            value={filter.to}
            onChange={(event) => setFilter((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <label className="text-label font-medium text-text">
          Trạng thái
          <select
            className={selectClass}
            value={filter.status}
            onChange={(event) =>
              setFilter((current) => ({ ...current, status: event.target.value as RoomBookingStatusKey | '' }))
            }
          >
            <option value="">Tất cả</option>
            {(Object.entries(ROOM_BOOKING_STATUS_LABELS) as Array<[RoomBookingStatusKey, string]>).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6 text-label font-medium text-text">
          <input
            type="checkbox"
            checked={filter.mine}
            onChange={(event) => setFilter((current) => ({ ...current, mine: event.target.checked }))}
          />
          Chỉ đăng ký của tôi
        </label>
      </div>
      {[bookings.error, decide.error, cancel.error].filter(Boolean).map((error, index) => (
        <Alert key={index} tone="danger">
          {messageOf(error)}
        </Alert>
      ))}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <BookingForm
            onCancel={() => setCreating(false)}
            onSaved={async (booking) => {
              setCreating(false);
              await refresh();
              setToast(`Đã đăng ký: ${ROOM_BOOKING_STATUS_LABELS[booking.status].toLowerCase()}`);
            }}
          />
        </section>
      ) : null}
      {rejecting ? (
        <section className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4">
          <label className="text-label font-medium text-text">
            Lý do từ chối “{rejecting.title}”
            <input className={selectClass} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <Button
            variant="primary"
            onClick={() => decide.mutate({ booking: rejecting, approve: false, note: reason || null })}
          >
            Từ chối
          </Button>
          <Button variant="text" onClick={() => setRejecting(undefined)}>
            Thôi
          </Button>
        </section>
      ) : null}
      <DataGrid
        label="Đăng ký phòng họp"
        columns={BOOKING_COLUMNS}
        rows={bookings.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.title}
        loading={!bookings.data && !bookings.error}
        emptyText="Chưa có lượt đăng ký phòng họp."
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Đăng ký sử dụng
          </Button>
        }
        rowActions={(row) => (
          <span className="flex justify-end gap-1">
            {row.can_decide ? (
              <>
                <Button variant="text" onClick={() => decide.mutate({ booking: row, approve: true, note: null })}>
                  Phê duyệt
                </Button>
                <Button variant="text" onClick={() => setRejecting(row)}>
                  Từ chối
                </Button>
              </>
            ) : null}
            {row.can_cancel ? (
              <Button variant="text" onClick={() => cancel.mutate(row)}>
                Hủy đăng ký
              </Button>
            ) : null}
          </span>
        )}
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
    </Page>
  );
}

// ---- 6.4 Phòng họp ----

function RoomForm({
  room,
  onSaved,
  onCancel,
}: {
  room?: MeetingRoom;
  onSaved(room: MeetingRoom): void;
  onCancel(): void;
}) {
  const [values, setValues] = useState({
    name: room?.name ?? '',
    location: room?.location ?? '',
    capacity: room?.capacity ? String(room.capacity) : '',
    equipment: room?.equipment ?? '',
    sort_order: String(room?.sort_order ?? 0),
    active: room?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () =>
      saveRoom(room?.id ?? null, {
        ...values,
        capacity: values.capacity ? Number(values.capacity) || values.capacity : null,
        sort_order: Number(values.sort_order) || 0,
      }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const field = (key: 'name' | 'location' | 'capacity' | 'equipment' | 'sort_order', label: string) => (
    <FormRow label={label} error={errors[key]}>
      <input
        className={FORM_CONTROL_CLASS}
        value={values[key]}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
      />
    </FormRow>
  );
  return (
    <form
      noValidate
      aria-label={room ? `Sửa phòng ${room.name}` : 'Thêm mới phòng họp'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thông tin phòng họp">
        {field('name', 'Tên phòng họp')}
        {field('location', 'Địa điểm')}
        {field('capacity', 'Sức chứa')}
        {field('equipment', 'Trang thiết bị')}
        {field('sort_order', 'STT hiển thị')}
        <FormRow label="Đang sử dụng">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => setValues((current) => ({ ...current, active: event.target.checked }))}
          />
        </FormRow>
      </FormBlock>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const ROOM_COLUMNS: Array<DataGridColumn<MeetingRoom>> = [
  { id: 'name', header: 'Tên phòng họp', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'location', header: 'Địa điểm', cell: (row) => row.location ?? '' },
  { id: 'capacity', header: 'Sức chứa', cell: (row) => row.capacity ?? '' },
  { id: 'equipment', header: 'Trang thiết bị', cell: (row) => row.equipment ?? '' },
  { id: 'active', header: 'Đang sử dụng', cell: (row) => (row.active ? 'Có' : 'Không') },
];

export function MeetingRoomsPage() {
  const canManage = useHasPermission(ROOMS);
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('meeting-rooms');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<MeetingRoom>();
  const rooms = useQuery({ queryKey: ['meeting-rooms', 'all'], queryFn: () => listRooms() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['meeting-rooms'] });
  const remove = useMutation({
    mutationFn: (room: MeetingRoom) => deleteRoom(room.id),
    onSuccess: async (_result, room) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${room.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/meeting-rooms" toast={toast} onToastClose={close}>
      {rooms.error ? <Alert tone="danger">{messageOf(rooms.error)}</Alert> : null}
      {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <RoomForm
            onCancel={() => setCreating(false)}
            onSaved={async (room) => {
              setCreating(false);
              await refresh();
              setToast(`Đã thêm ${room.name}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Danh sách phòng họp"
        columns={ROOM_COLUMNS}
        rows={rooms.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!rooms.data && !rooms.error}
        emptyText="Chưa khai báo phòng họp."
        toolbar={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Thêm mới
            </Button>
          ) : null
        }
        rowActions={(row) =>
          canManage ? (
            <span className="flex justify-end gap-1">
              <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
                Sửa
              </Button>
              <Button variant="text" onClick={() => setDeleting(row)}>
                Xóa
              </Button>
            </span>
          ) : null
        }
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <RoomForm
              key={row.id}
              room={row}
              onCancel={() => setEditingId(undefined)}
              onSaved={async (room) => {
                setEditingId(undefined);
                await refresh();
                setToast(`Đã ghi ${room.name}`);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.name ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}

// ---- 6.5 Mẫu lịch ----

const blankItem = (): ScheduleTemplateItem => ({
  weekday: 1,
  session: 'morning',
  start_time: null,
  end_time: null,
  content: '',
  chair_name: null,
  participants: null,
  location: null,
  note: null,
});

function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template?: ScheduleTemplate;
  onSaved(template: ScheduleTemplate): void;
  onCancel(): void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [orgUnitId, setOrgUnitId] = useState(template?.org_unit_id ?? '');
  const [items, setItems] = useState<ScheduleTemplateItem[]>(template?.items ?? [blankItem()]);
  const save = useMutation({
    mutationFn: () => saveTemplate(template?.id ?? null, { name, org_unit_id: orgUnitId || null, items }),
    onSuccess: onSaved,
  });
  const errors = fieldErrorsOf(save.error);
  const update = (index: number, patch: Partial<ScheduleTemplateItem>) =>
    setItems((current) => current.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  return (
    <form
      noValidate
      aria-label={template ? `Sửa mẫu ${template.name}` : 'Thêm mới mẫu lịch'}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Mẫu lịch">
        <FormRow label="Tên mẫu" error={errors.name}>
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
      </FormBlock>
      <div className="max-w-sm">
        <UnitSelect value={orgUnitId} onChange={setOrgUnitId} permission={MANAGE} allLabel="Toàn trường" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content">
          <thead>
            <tr className="border-b border-border text-left text-label text-text-secondary">
              <th className="p-2">Thứ</th>
              <th className="p-2">Buổi</th>
              <th className="p-2">Giờ</th>
              <th className="p-2">Nội dung</th>
              <th className="p-2">Chủ trì</th>
              <th className="p-2">Thành phần</th>
              <th className="p-2">Địa điểm</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-border">
                <td className="p-1">
                  <select
                    aria-label={`Thứ của dòng ${index + 1}`}
                    className={FORM_CONTROL_CLASS}
                    value={item.weekday}
                    onChange={(event) => update(index, { weekday: Number(event.target.value) })}
                  >
                    {WEEKDAY_LABELS.map((label, position) => (
                      <option key={label} value={position + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    aria-label={`Buổi của dòng ${index + 1}`}
                    className={FORM_CONTROL_CLASS}
                    value={item.session}
                    onChange={(event) => update(index, { session: event.target.value as ScheduleSessionKey })}
                  >
                    {SESSIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <input
                    type="time"
                    aria-label={`Giờ của dòng ${index + 1}`}
                    className={FORM_CONTROL_CLASS}
                    value={item.start_time ?? ''}
                    onChange={(event) => update(index, { start_time: event.target.value || null })}
                  />
                </td>
                {(['content', 'chair_name', 'participants', 'location'] as const).map((key) => (
                  <td key={key} className="p-1">
                    <input
                      aria-label={`${key === 'content' ? 'Nội dung' : key === 'chair_name' ? 'Chủ trì' : key === 'participants' ? 'Thành phần' : 'Địa điểm'} của dòng ${index + 1}`}
                      className={FORM_CONTROL_CLASS}
                      value={item[key] ?? ''}
                      onChange={(event) =>
                        update(index, { [key]: key === 'content' ? event.target.value : event.target.value || null })
                      }
                    />
                  </td>
                ))}
                <td className="p-1">
                  <Button
                    variant="text"
                    onClick={() => setItems((current) => current.filter((_, position) => position !== index))}
                  >
                    Bỏ dòng
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Object.entries(errors)
        .filter(([field]) => field.startsWith('items'))
        .map(([field, message]) => (
          <Alert key={field} tone="danger">
            {field}: {message}
          </Alert>
        ))}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setItems((current) => [...current, blankItem()])}>
          Thêm dòng
        </Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Ghi
        </Button>
        <Button variant="text" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

const TEMPLATE_COLUMNS: Array<DataGridColumn<ScheduleTemplate>> = [
  { id: 'name', header: 'Tên mẫu', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'items', header: 'Số dòng', cell: (row) => row.items.length },
  {
    id: 'content',
    header: 'Nội dung',
    cell: (row) =>
      row.items
        .map(
          (item) =>
            `${WEEKDAY_LABELS[item.weekday - 1]} ${SCHEDULE_SESSION_LABELS[item.session].toLowerCase()}: ${item.content}`,
        )
        .join('; '),
  },
];

export function ScheduleTemplatesPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const grid = useGridSettings('schedule-templates');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [deleting, setDeleting] = useState<ScheduleTemplate>();
  const templates = useQuery({ queryKey: ['schedule-templates'], queryFn: listTemplates });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
  const remove = useMutation({
    mutationFn: (template: ScheduleTemplate) => deleteTemplate(template.id),
    onSuccess: async (_result, template) => {
      setDeleting(undefined);
      await refresh();
      setToast(`Đã xóa ${template.name}`);
    },
    onError: () => setDeleting(undefined),
  });
  return (
    <Page path="/schedule-templates" toast={toast} onToastClose={close}>
      {templates.error ? <Alert tone="danger">{messageOf(templates.error)}</Alert> : null}
      {creating ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <TemplateForm
            onCancel={() => setCreating(false)}
            onSaved={async (template) => {
              setCreating(false);
              await refresh();
              setToast(`Đã thêm ${template.name}`);
            }}
          />
        </section>
      ) : null}
      <DataGrid
        label="Danh sách mẫu lịch"
        columns={TEMPLATE_COLUMNS}
        rows={templates.data ?? []}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        loading={!templates.data && !templates.error}
        emptyText="Chưa có mẫu lịch."
        toolbar={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Thêm mới
          </Button>
        }
        rowActions={(row) => (
          <span className="flex justify-end gap-1">
            <Button variant="text" onClick={() => setEditingId(editingId === row.id ? undefined : row.id)}>
              Sửa
            </Button>
            <Button variant="text" onClick={() => setDeleting(row)}>
              Xóa
            </Button>
          </span>
        )}
        activeRowId={editingId}
        renderRowDetail={(row) =>
          editingId === row.id ? (
            <TemplateForm
              key={row.id}
              template={row}
              onCancel={() => setEditingId(undefined)}
              onSaved={async (template) => {
                setEditingId(undefined);
                await refresh();
                setToast(`Đã ghi ${template.name}`);
              }}
            />
          ) : null
        }
        settings={grid.settings}
        onSettingsChange={grid.update}
      />
      <ConfirmDeleteDialog
        open={deleting !== undefined}
        subject={deleting?.name ?? ''}
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(undefined)}
      />
    </Page>
  );
}
