import { useCallback, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, ConfirmDialog, StatusBadge, TextField, Toast, type StatusTone } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  createAcademicYear,
  listAcademicYears,
  listWeeks,
  openAcademicYear,
  readCalendar,
  saveCalendar,
  updateWeeks,
  type AcademicYear,
  type AcademicYearStatus,
} from './academic-years-api.js';
import { CalendarForm } from './CalendarForm.js';
import { WeeksTable } from './WeeksTable.js';

// MH-45 Lịch năm học và MH-43 Mở năm học mới (P01-02, BR-91, BR-93)
const STATUS_LABELS: Record<AcademicYearStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Chưa mở', tone: 'neutral' },
  open: { label: 'Đang dùng', tone: 'success' },
  closed: { label: 'Đã đóng', tone: 'info' },
};

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
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-border pt-4">
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
  const calendar = useQuery({ queryKey: ['academic-year-calendar', year.id], queryFn: () => readCalendar(year.id) });
  const weeks = useQuery({ queryKey: ['academic-year-weeks', year.id], queryFn: () => listWeeks(year.id) });
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
              await saveCalendar(year.id, value);
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
            editable={editable}
            onSave={async (changes) => {
              await updateWeeks(year.id, changes);
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

  const years = academicYears.data ?? [];
  const selected =
    years.find((year) => year.id === selectedId) ?? years.find((year) => year.status === 'open') ?? years[0];

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Năm học</h1>
        {academicYears.isError ? <Alert tone="danger">{messageOf(academicYears.error)}</Alert> : null}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-3 self-start rounded-xl border border-border bg-card p-4">
            {academicYears.isPending ? (
              <div className="h-24 animate-pulse rounded bg-border" aria-hidden="true" />
            ) : years.length === 0 ? (
              <p className="text-content text-text-secondary">Chưa có năm học nào.</p>
            ) : (
              <ul className="flex flex-col gap-1" aria-label="Danh sách năm học">
                {years.map((year) => (
                  <li key={year.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(year.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-content hover:bg-selected ${selected?.id === year.id ? 'bg-selected font-medium' : ''}`}
                    >
                      {year.name}
                      <StatusBadge {...STATUS_LABELS[year.status]} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <CreateAcademicYearForm
                onCreated={(year) => {
                  setSelectedId(year.id);
                  void queryClient.invalidateQueries({ queryKey: ['academic-years'] });
                  setToastMessage(`Đã tạo năm học ${year.name}`);
                }}
              />
            ) : null}
          </aside>
          {selected ? (
            <AcademicYearDetail key={selected.id} year={selected} canManage={canManage} onChanged={setToastMessage} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
