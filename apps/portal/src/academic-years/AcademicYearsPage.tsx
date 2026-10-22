import { useCallback, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES, SCHOOL_LEVELS, type SchoolLevelCode } from '@school-management/shared';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataGrid,
  StatusBadge,
  TextField,
  Toast,
  type DataGridColumn,
  type StatusTone,
} from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { matchesSearch } from '../pages/grid-search.js';
import { useGridSettings } from '../pages/grid-settings.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createAcademicYear,
  listAcademicYears,
  listWeeks,
  openAcademicYear,
  readCalendar,
  resetLevelCalendar,
  saveCalendar,
  updateWeeks,
  type AcademicYear,
  type AcademicYearStatus,
} from './academic-years-api.js';
import { CalendarForm } from './CalendarForm.js';
import { WeeksTable } from './WeeksTable.js';
import { menuPageTitle } from '../pages/page-title.js';

// MH-45 Lịch năm học và MH-43 Mở năm học mới (P01-02, BR-91, BR-93). Danh sách năm học theo lưới dữ liệu chung, tìm tại
// chỗ theo tên năm học, bấm dòng để xem lịch; danh sách tuần giữ bảng nhập trực tiếp từng ô (DT-16 phần 16b). Trường có khối
// ngoài Mầm non chọn được cấp để xem, khai báo lịch riêng của cấp (DT-19 phần 19b, YCTD-152); trường chỉ có Mầm non chỉ có
// lịch chung như cũ
const STATUS_LABELS: Record<AcademicYearStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Chưa mở', tone: 'neutral' },
  open: { label: 'Đang dùng', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'info' },
};

function formatDate(value: string | null): string {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const YEAR_COLUMNS: Array<DataGridColumn<AcademicYear>> = [
  { id: 'name', header: 'Tên năm học', alwaysVisible: true, className: 'font-medium', cell: (row) => row.name },
  { id: 'start_date', header: 'Từ ngày', cell: (row) => formatDate(row.start_date) },
  { id: 'end_date', header: 'Đến ngày', cell: (row) => formatDate(row.end_date) },
  { id: 'status', header: 'Trạng thái', cell: (row) => <StatusBadge {...STATUS_LABELS[row.status]} /> },
];

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function CreateAcademicYearForm({ onCreated }: { onCreated(year: AcademicYear): void }) {
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const create = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: (year) => {
      setName('');
      onCreated(year);
    },
    onError: (error) => setErrorMessage(messageOf(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    create.mutate(name);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Tạo năm học mới"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <TextField
        label="Tên năm học mới"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errorMessage}
      />
      <Button type="submit" disabled={create.isPending}>
        Tạo năm học
      </Button>
    </form>
  );
}

function AcademicYearDetail({
  year,
  canManage,
  onChanged,
}: {
  year: AcademicYear;
  canManage: boolean;
  onChanged(message: string): void;
}) {
  const queryClient = useQueryClient();
  const editable = canManage && year.status !== 'closed';
  const { levels: enabledLevels, multiLevel } = useEnabledSchoolLevels();
  const [level, setLevel] = useState<SchoolLevelCode | null>(null);
  const calendar = useQuery({
    queryKey: ['academic-year-calendar', year.id, level],
    queryFn: () => readCalendar(year.id, level),
  });
  const weeks = useQuery({
    queryKey: ['academic-year-weeks', year.id, level],
    queryFn: () => listWeeks(year.id, level),
  });
  const inherited = calendar.data?.inherited ?? false;
  const levelName = SCHOOL_LEVELS.find((item) => item.value === level)?.label;
  const reset = useMutation({
    mutationFn: () => resetLevelCalendar(year.id, level ?? 'MN'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['academic-year-calendar', year.id] });
      await queryClient.invalidateQueries({ queryKey: ['academic-year-weeks', year.id] });
      onChanged(`Cấp ${levelName ?? ''} quay về theo lịch chung`);
    },
  });
  const [confirmingOpen, setConfirmingOpen] = useState(false);
  const [openError, setOpenError] = useState<string>();

  const open = useMutation({
    mutationFn: () => openAcademicYear(year.id),
    onSuccess: async () => {
      setConfirmingOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      onChanged(`Đã mở năm học ${year.name}`);
    },
    onError: (error) => {
      setConfirmingOpen(false);
      setOpenError(messageOf(error));
    },
  });

  return (
    <section className="flex flex-col gap-6" aria-label={`Năm học ${year.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section-title font-semibold text-text">Năm học {year.name}</h2>
        <StatusBadge {...STATUS_LABELS[year.status]} />
        {canManage && year.status === 'draft' ? (
          <Button className="ml-auto" onClick={() => setConfirmingOpen(true)}>
            Mở năm học
          </Button>
        ) : null}
      </div>
      {openError ? <Alert tone="danger">{openError}</Alert> : null}
      {multiLevel ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-label font-medium text-text">
            Lịch của cấp
            <select
              className="mt-2 block rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
              value={level ?? ''}
              onChange={(event) => setLevel((event.target.value || null) as SchoolLevelCode | null)}
            >
              <option value="">Lịch chung cả trường</option>
              {enabledLevels.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {level && !inherited && editable ? (
            <Button variant="text" disabled={reset.isPending} onClick={() => reset.mutate()}>
              Bỏ lịch riêng của cấp
            </Button>
          ) : null}
        </div>
      ) : null}
      {level && inherited ? (
        <Alert tone="info">
          Cấp {levelName} đang theo lịch chung. Ghi lịch dưới đây để khai báo học kỳ, tuần, ngày học riêng của cấp.
        </Alert>
      ) : null}
      {reset.error ? <Alert tone="danger">{messageOf(reset.error)}</Alert> : null}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 text-label font-semibold text-text-secondary">LỊCH NĂM HỌC</h3>
        {calendar.isPending ? (
          <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
        ) : calendar.isError ? (
          <Alert tone="danger">{messageOf(calendar.error)}</Alert>
        ) : (
          <CalendarForm
            calendar={calendar.data}
            editable={editable}
            onSave={async (value) => {
              await saveCalendar(year.id, value, level);
              await queryClient.invalidateQueries({ queryKey: ['academic-year-calendar', year.id] });
              await queryClient.invalidateQueries({ queryKey: ['academic-year-weeks', year.id] });
              await queryClient.invalidateQueries({ queryKey: ['academic-years'] });
              onChanged('Đã lưu lịch năm học');
            }}
          />
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 text-label font-semibold text-text-secondary">DANH SÁCH TUẦN</h3>
        {weeks.isPending ? (
          <div className="h-40 animate-pulse rounded bg-border" aria-hidden="true" />
        ) : weeks.isError ? (
          <Alert tone="danger">{messageOf(weeks.error)}</Alert>
        ) : (
          <WeeksTable
            weeks={weeks.data}
            editable={editable && !(level && inherited)}
            onSave={async (changes) => {
              await updateWeeks(year.id, changes, level);
              await queryClient.invalidateQueries({ queryKey: ['academic-year-weeks', year.id] });
              onChanged('Đã lưu tuần nghỉ');
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmingOpen}
        title={`Mở năm học ${year.name}?`}
        confirmLabel="Mở năm học"
        busy={open.isPending}
        onCancel={() => setConfirmingOpen(false)}
        onConfirm={() => open.mutate()}
      >
        Hệ thống tạo cơ sở dữ liệu cho năm học {year.name} và chuyển dữ liệu dùng chung sang. Năm học đang dùng (nếu có)
        sẽ chuyển sang đã đóng và chỉ còn xem được, không sửa được nữa. Thao tác này không hoàn tác được.
      </ConfirmDialog>
    </section>
  );
}

export function AcademicYearsPage() {
  const canManage = useHasPermission(PERMISSION_CODES.academicYearManage);
  const academicYears = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const [selectedId, setSelectedId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const queryClient = useQueryClient();
  const grid = useGridSettings('academic-years');
  const [search, setSearch] = useState('');

  const years = academicYears.data ?? [];
  const selected =
    years.find((year) => year.id === selectedId) ?? years.find((year) => year.status === 'open') ?? years[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/academic-years')}</h1>
        {academicYears.isError ? <Alert tone="danger">{messageOf(academicYears.error)}</Alert> : null}
        {grid.error ? <Alert tone="danger">{messageOf(grid.error)}</Alert> : null}
        <DataGrid
          label="Danh sách năm học"
          columns={YEAR_COLUMNS}
          rows={years.filter((year) => matchesSearch(search, year.name))}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.name}
          loading={academicYears.isPending}
          emptyText="Chưa có năm học nào."
          search={{ label: 'Tìm theo tên năm học', value: search, onChange: setSearch }}
          rowActions={(row) => (
            <Button variant="text" onClick={() => setSelectedId(row.id)}>
              Xem năm học {row.name}
            </Button>
          )}
          onRowClick={(row) => setSelectedId(row.id)}
          activeRowId={selected?.id}
          settings={grid.settings}
          onSettingsChange={grid.update}
        />
        {canManage ? (
          <CreateAcademicYearForm
            onCreated={(year) => {
              setSelectedId(year.id);
              void queryClient.invalidateQueries({ queryKey: ['academic-years'] });
              setToastMessage(`Đã tạo năm học ${year.name}`);
            }}
          />
        ) : null}
        {selected ? (
          <AcademicYearDetail key={selected.id} year={selected} canManage={canManage} onChanged={setToastMessage} />
        ) : null}
      </div>
    </AppShell>
  );
}
