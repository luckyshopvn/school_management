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
import { AppShell } from '../pages/AppShell.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createHoliday,
  createSchoolDayChange,
  deleteHoliday,
  deleteSchoolDayChange,
  listSchoolDays,
  SCHOOL_DAY_CHANGE_LABELS,
  updateHoliday,
  type Holiday,
  type SchoolDayChange,
  type SchoolDayChangeType,
} from './staff-attendance-api.js';

// MH-37 Ngày lễ và lịch bù (P08-09, P08-10; BR-84; YCTD-59): lịch chung toàn trường theo năm dương lịch. Phòng nhân sự
// gán ở Trường chính lập ngày nghỉ lễ; Ban Giám hiệu lập ngày học bù thứ bảy và ngày nghỉ bù. Chỉ đổi ngày từ ngày mai.
// Giao diện chung theo Sở (DT-15 phần 15f2): hai lưới dữ liệu (khóa `holidays`, `school-day-changes`), Thêm mới mở biểu
// mẫu theo khối có nút Ghi, xóa qua hộp xác nhận xóa
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const weekdayName = (date: string) => WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
const matches = (keyword: string, ...values: Array<string | null>) =>
  keyword === '' || values.some((value) => (value ?? '').toLocaleLowerCase('vi').includes(keyword));

const HOLIDAY_COLUMNS: Array<DataGridColumn<Holiday>> = [
  { id: 'holiday_date', header: 'Ngày', alwaysVisible: true, cell: (row) => row.holiday_date },
  { id: 'weekday', header: 'Thứ', cell: (row) => weekdayName(row.holiday_date) },
  { id: 'name', header: 'Tên ngày lễ', className: 'font-medium', cell: (row) => row.name },
  { id: 'is_paid', header: 'Hưởng lương', cell: (row) => (row.is_paid ? 'Có' : 'Không') },
];

const CHANGE_COLUMNS: Array<DataGridColumn<SchoolDayChange>> = [
  { id: 'change_date', header: 'Ngày', alwaysVisible: true, cell: (row) => row.change_date },
  { id: 'weekday', header: 'Thứ', cell: (row) => weekdayName(row.change_date) },
  {
    id: 'change_type',
    header: 'Loại lịch',
    className: 'font-medium',
    cell: (row) => SCHOOL_DAY_CHANGE_LABELS[row.change_type],
  },
  { id: 'note', header: 'Ghi chú', cell: (row) => row.note ?? '' },
];

function HolidayForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [paid, setPaid] = useState('co');
  const save = useMutation({
    mutationFn: () => createHoliday({ holiday_date: date, name, is_paid: paid === 'co' }),
    onSuccess: (holiday) => onSaved(`Đã thêm ngày lễ ${holiday.holiday_date}`),
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm ngày nghỉ lễ"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thêm ngày nghỉ lễ">
        <FormRow label="Ngày lễ">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Tên ngày lễ">
          <input className={FORM_CONTROL_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Hưởng lương">
          <select className={FORM_CONTROL_CLASS} value={paid} onChange={(event) => setPaid(event.target.value)}>
            <option value="co">Có hưởng lương</option>
            <option value="khong">Không hưởng lương</option>
          </select>
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

function ChangeForm({ onSaved, onCancel }: { onSaved(message: string): void; onCancel(): void }) {
  const [date, setDate] = useState('');
  const [changeType, setChangeType] = useState<SchoolDayChangeType>('makeup_school_day');
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => createSchoolDayChange({ change_date: date, change_type: changeType, note: note || null }),
    onSuccess: (change) =>
      onSaved(`Đã thêm ${SCHOOL_DAY_CHANGE_LABELS[change.change_type].toLowerCase()} ngày ${change.change_date}`),
  });
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Thêm ngày học bù hoặc nghỉ bù"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <FormBlock title="Thêm ngày học bù hoặc nghỉ bù">
        <FormRow label="Loại lịch">
          <select
            className={FORM_CONTROL_CLASS}
            value={changeType}
            onChange={(event) => setChangeType(event.target.value as SchoolDayChangeType)}
          >
            <option value="makeup_school_day">Học bù thứ bảy</option>
            <option value="compensatory_day_off">Nghỉ bù (thứ hai đến thứ sáu)</option>
          </select>
        </FormRow>
        <FormRow label="Ngày áp dụng">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormRow>
        <FormRow label="Ghi chú lịch">
          <input className={FORM_CONTROL_CLASS} value={note} onChange={(event) => setNote(event.target.value)} />
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

function HolidayActions({
  holiday,
  onChanged,
  onDelete,
}: {
  holiday: Holiday;
  onChanged(message: string): void;
  onDelete(holiday: Holiday): void;
}) {
  const toggle = useMutation({
    mutationFn: () => updateHoliday(holiday.id, { name: holiday.name, is_paid: !holiday.is_paid }),
    onSuccess: () => onChanged('Đã đổi hưởng lương của ngày lễ'),
  });
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex justify-end gap-2">
        <Button variant="text" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {holiday.is_paid ? 'Đổi thành không lương' : 'Đổi thành có lương'}
        </Button>
        <Button variant="text" onClick={() => onDelete(holiday)}>
          Xóa
        </Button>
      </span>
      {toggle.error ? <span className="text-label text-danger">{messageOf(toggle.error)}</span> : null}
    </span>
  );
}

export function SchoolDaysPage() {
  const canManageHolidays = useHasPermission(PERMISSION_CODES.holidayManage);
  const canManageChanges = useHasPermission(PERMISSION_CODES.schoolDayChangeManage);
  const queryClient = useQueryClient();
  const holidayGrid = useGridSettings('holidays');
  const changeGrid = useGridSettings('school-day-changes');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const schoolDays = useQuery({ queryKey: ['school-days', year], queryFn: () => listSchoolDays(year) });
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [holidaySearch, setHolidaySearch] = useState('');
  const [changeSearch, setChangeSearch] = useState('');
  const [changeType, setChangeType] = useState<SchoolDayChangeType | ''>('');
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [addingChange, setAddingChange] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'holiday'; holiday: Holiday } | { kind: 'change'; change: SchoolDayChange }
  >();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['school-days'] });
    setToastMessage(message);
  };
  const remove = useMutation({
    mutationFn: () =>
      pendingDelete?.kind === 'holiday'
        ? deleteHoliday(pendingDelete.holiday.id)
        : deleteSchoolDayChange(pendingDelete?.change.id ?? ''),
    onSuccess: async () => {
      setPendingDelete(undefined);
      await refresh('Đã xóa khỏi lịch');
    },
  });
  const holidayKeyword = holidaySearch.trim().toLocaleLowerCase('vi');
  const changeKeyword = changeSearch.trim().toLocaleLowerCase('vi');
  const holidays = (schoolDays.data?.holidays ?? []).filter((holiday) =>
    matches(holidayKeyword, holiday.name, holiday.holiday_date),
  );
  const changes = (schoolDays.data?.changes ?? []).filter(
    (change) =>
      (changeType === '' || change.change_type === changeType) &&
      matches(changeKeyword, change.note, change.change_date),
  );
  const gridError = holidayGrid.error ?? changeGrid.error;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        title="Xóa khỏi lịch"
        subject={
          pendingDelete?.kind === 'holiday'
            ? `ngày lễ ${pendingDelete.holiday.holiday_date}`
            : `lịch ngày ${pendingDelete?.change.change_date ?? ''}`
        }
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setPendingDelete(undefined);
          remove.reset();
        }}
      >
        <p>
          {pendingDelete?.kind === 'holiday'
            ? `Xóa ngày lễ ${pendingDelete.holiday.holiday_date} (${pendingDelete.holiday.name})?`
            : `Xóa lịch ngày ${pendingDelete?.change.change_date ?? ''}?`}
        </p>
        {remove.error ? <Alert tone="danger">{messageOf(remove.error)}</Alert> : null}
      </ConfirmDeleteDialog>
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/school-days')}</h1>
        <p className="text-content text-text-secondary">
          Lịch chung toàn trường. Thứ bảy mặc định nghỉ. Ngày lễ và ngày nghỉ bù học sinh không học, nhân sự nghỉ; ngày
          học bù thứ bảy là ngày học của mọi lớp và ngày làm việc của mọi nhân sự.
        </p>
        <div className="w-40">
          <TextField
            label="Năm"
            type="number"
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </div>
        {schoolDays.error ? <Alert tone="danger">{messageOf(schoolDays.error)}</Alert> : null}
        {gridError ? <Alert tone="danger">{messageOf(gridError)}</Alert> : null}

        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Ngày nghỉ lễ</h2>
          {addingHoliday ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <HolidayForm
                onCancel={() => setAddingHoliday(false)}
                onSaved={(message) => {
                  setAddingHoliday(false);
                  void refresh(message);
                }}
              />
            </section>
          ) : null}
          <DataGrid
            label="Ngày nghỉ lễ"
            columns={HOLIDAY_COLUMNS}
            rows={holidays}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `ngày lễ ${row.holiday_date}`}
            getRowAriaLabel={(row) => `Ngày lễ ${row.holiday_date}`}
            loading={schoolDays.isPending}
            emptyText="Năm này chưa có ngày nghỉ lễ."
            search={{ label: 'Tìm theo tên, ngày', value: holidaySearch, onChange: setHolidaySearch }}
            toolbar={
              canManageHolidays ? (
                <Button variant="primary" onClick={() => setAddingHoliday(true)}>
                  Thêm mới
                </Button>
              ) : null
            }
            rowActions={
              canManageHolidays
                ? (row) => (
                    <HolidayActions
                      holiday={row}
                      onChanged={refresh}
                      onDelete={(target) => setPendingDelete({ kind: 'holiday', holiday: target })}
                    />
                  )
                : undefined
            }
            settings={holidayGrid.settings}
            onSettingsChange={holidayGrid.update}
          />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-section-title font-semibold text-text">Lịch học bù và nghỉ bù</h2>
          {addingChange ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <ChangeForm
                onCancel={() => setAddingChange(false)}
                onSaved={(message) => {
                  setAddingChange(false);
                  void refresh(message);
                }}
              />
            </section>
          ) : null}
          <DataGrid
            label="Lịch học bù và nghỉ bù"
            columns={CHANGE_COLUMNS}
            rows={changes}
            getRowId={(row) => row.id}
            getRowLabel={(row) => `lịch ngày ${row.change_date}`}
            getRowAriaLabel={(row) => `Lịch ngày ${row.change_date}`}
            loading={schoolDays.isPending}
            emptyText="Năm này chưa có lịch học bù hoặc nghỉ bù."
            search={{ label: 'Tìm theo ngày, ghi chú', value: changeSearch, onChange: setChangeSearch }}
            advancedSearch={
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-label font-medium text-text">
                  Loại lịch
                  <select
                    value={changeType}
                    onChange={(event) => setChangeType(event.target.value as SchoolDayChangeType | '')}
                    className={`mt-1 ${FORM_CONTROL_CLASS}`}
                  >
                    <option value="">Tất cả</option>
                    <option value="makeup_school_day">{SCHOOL_DAY_CHANGE_LABELS.makeup_school_day}</option>
                    <option value="compensatory_day_off">{SCHOOL_DAY_CHANGE_LABELS.compensatory_day_off}</option>
                  </select>
                </label>
              </div>
            }
            toolbar={
              canManageChanges ? (
                <Button variant="primary" onClick={() => setAddingChange(true)}>
                  Thêm mới
                </Button>
              ) : null
            }
            rowActions={
              canManageChanges
                ? (row) => (
                    <Button variant="text" onClick={() => setPendingDelete({ kind: 'change', change: row })}>
                      Xóa
                    </Button>
                  )
                : undefined
            }
            settings={changeGrid.settings}
            onSettingsChange={changeGrid.update}
          />
        </div>
      </div>
    </AppShell>
  );
}
