import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError, requestJson } from '../session/api-client.js';

// Bán trú lớp Tiểu học (DT-20 phần 20b, YCTD-159): danh sách ăn theo ngày là học sinh đăng ký dịch vụ bán trú của tháng,
// trừ học sinh báo cắt suất. Giáo viên chủ nhiệm hoặc người quản lý bán trú báo cắt suất thay, chốt số suất cho bếp; ngày
// đã chốt mở lại kèm lý do. Lớp Mầm non không dùng trang này, vẫn tính suất theo điểm danh
interface Roster {
  class_id: string;
  class_name: string;
  date: string;
  registered_count: number;
  headcount: number;
  closed: boolean;
  closed_by_name: string | null;
  closed_at: string | null;
  children: Array<{
    child_id: string;
    full_name: string;
    cut: { reason: string | null; source: string; created_by_name: string } | null;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  parent: 'Phụ huynh báo',
  teacher: 'Giáo viên báo',
  school: 'Nhà trường báo',
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function BoardingPage() {
  const queryClient = useQueryClient();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(vietnamToday());
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);

  const classes = useQuery({
    queryKey: ['classes', orgUnitId],
    queryFn: () => listClasses(orgUnitId ?? ''),
    enabled: orgUnitId !== undefined,
  });
  const boardingClasses = (classes.data ?? []).filter((item) => item.status === 'active' && item.school_level === 'TH');
  const selectedClassId = classId || boardingClasses[0]?.id || '';
  const rosterKey = ['boarding-roster', selectedClassId, date];
  const roster = useQuery({
    queryKey: rosterKey,
    queryFn: () => requestJson<Roster>(`/api/v1/boarding/classes/${selectedClassId}/roster?date=${date}`),
    enabled: selectedClassId !== '' && date !== '',
    retry: false,
  });
  const refresh = async (message: string) => {
    setReason('');
    await queryClient.invalidateQueries({ queryKey: rosterKey });
    setToastMessage(message);
  };
  const toggleCut = useMutation({
    mutationFn: (input: { childId: string; cut: boolean }) =>
      requestJson(`/api/v1/boarding/classes/${selectedClassId}/cuts`, {
        method: 'POST',
        body: JSON.stringify({ child_id: input.childId, date, cut: input.cut, reason: reason || null }),
      }),
    onSuccess: (_result, input) => refresh(input.cut ? 'Đã báo cắt suất' : 'Đã bỏ cắt suất'),
  });
  const close = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/boarding/classes/${selectedClassId}/close`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      }),
    onSuccess: () => refresh('Đã chốt số suất'),
  });
  const reopen = useMutation({
    mutationFn: () =>
      requestJson(`/api/v1/boarding/classes/${selectedClassId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ date, reason }),
      }),
    onSuccess: () => refresh('Đã mở lại ngày đã chốt'),
  });
  const actionError = toggleCut.error ?? close.error ?? reopen.error;
  const data = roster.data;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/boarding')}</h1>
        <div className="flex flex-wrap items-end gap-4">
          <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Lớp
            <select
              value={selectedClassId}
              onChange={(event) => setClassId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {boardingClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        {classes.data && boardingClasses.length === 0 ? (
          <Alert tone="info">Đơn vị chưa có lớp Tiểu học đang học.</Alert>
        ) : null}
        {roster.isError ? <Alert tone="warning">{messageOf(roster.error)}</Alert> : null}
        {actionError ? <Alert tone="danger">{messageOf(actionError)}</Alert> : null}
        {data ? (
          <section
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
            aria-label="Danh sách ăn bán trú"
          >
            <div className="flex flex-wrap items-center gap-3 text-content">
              <StatusBadge tone={data.closed ? 'success' : 'info'} label={data.closed ? 'Đã chốt' : 'Chưa chốt'} />
              <span>
                {data.registered_count} học sinh đăng ký · {data.registered_count - data.headcount} cắt suất ·{' '}
                <strong>{data.headcount} suất</strong>
                {data.closed && data.closed_by_name ? ` · chốt bởi ${data.closed_by_name}` : ''}
              </span>
            </div>
            {data.children.length === 0 ? (
              <p className="text-content text-text-secondary">
                Lớp chưa có học sinh đăng ký bán trú trong tháng. Đăng ký ở Dịch vụ của học sinh.
              </p>
            ) : (
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Học sinh</th>
                    <th className="px-3 py-2">Suất ăn</th>
                    <th className="px-3 py-2">Lý do, người báo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.children.map((child) => (
                    <tr key={child.child_id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{child.full_name}</td>
                      <td className="px-3 py-2">{child.cut ? 'Cắt suất' : 'Ăn'}</td>
                      <td className="px-3 py-2">
                        {child.cut
                          ? [
                              child.cut.reason,
                              `${SOURCE_LABELS[child.cut.source] ?? ''} (${child.cut.created_by_name})`,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : ''}
                      </td>
                      <td className="px-3 py-2">
                        {data.closed ? null : (
                          <Button
                            aria-label={`${child.cut ? 'Bỏ cắt suất' : 'Cắt suất'} của ${child.full_name}`}
                            disabled={toggleCut.isPending}
                            onClick={() => toggleCut.mutate({ childId: child.child_id, cut: child.cut === null })}
                          >
                            {child.cut ? 'Bỏ cắt suất' : 'Cắt suất'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label={data.closed ? 'Lý do mở lại' : 'Lý do cắt suất'}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {data.closed ? (
                <Button disabled={reopen.isPending || reason.trim() === ''} onClick={() => reopen.mutate()}>
                  Mở lại ngày đã chốt
                </Button>
              ) : (
                <Button variant="primary" disabled={close.isPending} onClick={() => close.mutate()}>
                  Chốt số suất
                </Button>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
