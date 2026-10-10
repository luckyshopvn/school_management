import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { ApiError, requestJson } from '../session/api-client.js';

// Điểm danh trên cổng quản trị (P04-01, P04-06, QT-02): xem bảng của lớp theo ngày; quản lý đơn vị chốt thay,
// sửa sau khi chốt kèm lý do, mở lại ngày đã chốt (ghi chú 15 của tài liệu 08, YCTD-47)
type Status = 'present' | 'absent_notified' | 'absent_unnotified' | 'late' | 'early_leave' | 'late_and_early_leave';

const STATUS_LABELS: Record<Status, string> = {
  present: 'Có mặt',
  absent_notified: 'Nghỉ có báo',
  absent_unnotified: 'Nghỉ không báo',
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  late_and_early_leave: 'Đi muộn và về sớm',
};

interface Sheet {
  date: string;
  day_status: 'open' | 'locked';
  can_edit: boolean;
  children: Array<{
    child_id: string;
    full_name: string;
    status: Status | null;
    saved: boolean;
    note: string | null;
    is_backfilled: boolean;
    absence: { reason: string | null; is_advised: boolean } | null;
  }>;
  summary: {
    total: number;
    unmarked: number;
    present: number;
    late: number;
    early_leave: number;
    absent_notified: number;
    absent_unnotified: number;
    meal_count: number;
  };
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(vietnamToday());
  const [marks, setMarks] = useState<Record<string, Status | ''>>({});
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const activeClasses = (classes.data ?? []).filter((item) => item.status === 'active');
  const selectedClassId = classId || activeClasses[0]?.id || '';
  const sheet = useQuery({
    queryKey: ['attendance', selectedClassId, date],
    queryFn: () => requestJson<Sheet>(`/api/v1/classes/${selectedClassId}/attendance?date=${date}`),
    enabled: selectedClassId !== '',
    retry: false,
  });
  useEffect(() => {
    if (sheet.data) {
      setMarks(Object.fromEntries(sheet.data.children.map((child) => [child.child_id, child.status ?? ''])));
    }
  }, [sheet.data]);

  const refresh = async (message: string) => {
    setReason('');
    await queryClient.invalidateQueries({ queryKey: ['attendance', selectedClassId, date] });
    setToastMessage(message);
  };
  const save = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/classes/${selectedClassId}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({
          date,
          reason: reason || null,
          entries: (sheet.data?.children ?? [])
            .filter((child) => marks[child.child_id])
            .map((child) => ({ child_id: child.child_id, status: marks[child.child_id], note: child.note })),
        }),
      }),
    onSuccess: () => refresh('Đã lưu điểm danh'),
  });
  const lock = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/classes/${selectedClassId}/attendance/lock`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      }),
    onSuccess: () => refresh('Đã chốt điểm danh ngày'),
  });
  const unlock = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/classes/${selectedClassId}/attendance/unlock`, {
        method: 'POST',
        body: JSON.stringify({ date, reason }),
      }),
    onSuccess: () => refresh('Đã mở lại ngày đã chốt'),
  });
  const actionError = save.error ?? lock.error ?? unlock.error;
  const data = sheet.data;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">Điểm danh</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={selectedClassId}
              onChange={(event) => setClassId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {activeClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        {sheet.isError ? <Alert tone="warning">{messageOf(sheet.error)}</Alert> : null}
        {actionError ? <Alert tone="danger">{messageOf(actionError)}</Alert> : null}
        {data ? (
          <section
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
            aria-label="Bảng điểm danh"
          >
            <div className="flex flex-wrap items-center gap-3 text-content">
              <StatusBadge
                tone={data.day_status === 'locked' ? 'success' : 'info'}
                label={data.day_status === 'locked' ? 'Đã chốt' : 'Chưa chốt'}
              />
              <span>
                {data.summary.total} trẻ · có mặt {data.summary.present} · đi muộn {data.summary.late} · về sớm{' '}
                {data.summary.early_leave} · nghỉ có báo {data.summary.absent_notified} · nghỉ không báo{' '}
                {data.summary.absent_unnotified} · chưa đánh dấu {data.summary.unmarked} · {data.summary.meal_count}{' '}
                suất ăn
              </span>
            </div>
            <table className="w-full text-content">
              <thead className="text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Trẻ</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Báo vắng</th>
                  <th className="px-3 py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data.children.map((child) => (
                  <tr key={child.child_id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{child.full_name}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Trạng thái của ${child.full_name}`}
                        value={marks[child.child_id] ?? ''}
                        disabled={!data.can_edit}
                        onChange={(event) =>
                          setMarks({ ...marks, [child.child_id]: event.target.value as Status | '' })
                        }
                        className="rounded-lg border border-border bg-card px-2 py-1"
                      >
                        <option value="">Chưa đánh dấu</option>
                        {(Object.keys(STATUS_LABELS) as Status[]).map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      {child.is_backfilled ? (
                        <span className="ml-2 text-label text-text-secondary">nhập bù</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {child.absence ? (child.absence.is_advised ? 'Đã báo trước' : 'Báo muộn') : ''}
                    </td>
                    <td className="px-3 py-2">{child.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.can_edit ? (
              <div className="flex flex-wrap items-end gap-3">
                {data.day_status === 'locked' ? (
                  <TextField
                    label="Lý do sửa hoặc mở lại"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                ) : null}
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                  Lưu điểm danh
                </Button>
                {data.day_status === 'open' ? (
                  <Button disabled={lock.isPending} onClick={() => lock.mutate()}>
                    Chốt điểm danh ngày
                  </Button>
                ) : (
                  <Button disabled={unlock.isPending || reason.trim() === ''} onClick={() => unlock.mutate()}>
                    Mở lại ngày đã chốt
                  </Button>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
