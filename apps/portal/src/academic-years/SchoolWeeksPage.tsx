import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import {
  listAcademicYears,
  listWeeks,
  TERM_LABELS,
  updateWeeks,
  type SchoolWeek,
  type TermType,
  type WeekChange,
} from './academic-years-api.js';

// 3.4. Khai báo tuần theo Sở (DT-16 phần 16e, khảo sát mục 3.3 dòng 3.4): tuần học, ngày bắt đầu, ngày kết thúc, học kỳ, hiển
// thị, tuần đệm, tên tuần đệm. Dùng chung danh sách tuần của lịch năm học (2.1 Năm học ở Quản trị hệ thống): tuần đệm là tuần
// nghỉ, tên tuần đệm là ghi chú của tuần, nên lịch năm học chỉ có một nguồn dữ liệu. Học kỳ mặc định theo lịch, chọn riêng
// được; sửa cần quyền quản lý năm học, máy chủ kiểm tra
function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function formatDate(value: string): string {
  return value.split('-').reverse().join('/');
}

const cellInput = 'rounded border border-border bg-card px-2 py-1 disabled:border-transparent disabled:bg-transparent';

export function SchoolWeeksPage() {
  const canManage = useHasPermission(PERMISSION_CODES.academicYearManage);
  const queryClient = useQueryClient();
  const years = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const [yearId, setYearId] = useState<string>();
  const selectedYear =
    years.data?.find((year) => year.id === yearId) ??
    years.data?.find((year) => year.status === 'open') ??
    years.data?.[0];
  const weeks = useQuery({
    queryKey: ['academic-years', selectedYear?.id, 'weeks'],
    queryFn: () => listWeeks(selectedYear?.id ?? ''),
    enabled: selectedYear !== undefined,
  });
  const [draft, setDraft] = useState<SchoolWeek[]>([]);
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  useEffect(() => setDraft(weeks.data ?? []), [weeks.data]);
  const editable = canManage && selectedYear?.status !== 'closed';

  const changes: WeekChange[] = draft.flatMap((week) => {
    const original = weeks.data?.find((item) => item.week_no === week.week_no);
    if (
      !original ||
      (original.is_off === week.is_off &&
        (original.note ?? '') === (week.note ?? '') &&
        original.term_type === week.term_type &&
        original.is_visible === week.is_visible)
    ) {
      return [];
    }
    return [
      {
        week_no: week.week_no,
        is_off: week.is_off,
        note: week.note || null,
        term_type: week.term_type,
        is_visible: week.is_visible,
      },
    ];
  });
  const save = useMutation({
    mutationFn: () => updateWeeks(selectedYear?.id ?? '', changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['academic-years', selectedYear?.id, 'weeks'] });
      setToastMessage(`Đã ghi ${changes.length} tuần`);
    },
  });
  const patch = (weekNo: number, next: Partial<SchoolWeek>) =>
    setDraft((current) => current.map((week) => (week.week_no === weekNo ? { ...week, ...next } : week)));

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/school-weeks')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-label font-medium text-text">
            Năm học
            <select
              value={selectedYear?.id ?? ''}
              onChange={(event) => setYearId(event.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
            >
              {(years.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-label text-text-secondary">
            Tuần được đánh số theo lịch năm học ở 2.1 Năm học. Tuần đệm là tuần nghỉ học; tên tuần đệm ghi lý do nghỉ. Bỏ
            tích Hiển thị thì tuần không hiện ở các màn hình chọn tuần.
          </p>
        </div>
        {years.isError ? <Alert tone="danger">{messageOf(years.error)}</Alert> : null}
        {weeks.isError ? <Alert tone="danger">{messageOf(weeks.error)}</Alert> : null}
        {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
        {weeks.data && weeks.data.length === 0 ? (
          <Alert tone="warning">Năm học chưa có lịch. Lưu lịch năm học ở 2.1 Năm học để hệ thống đánh số tuần.</Alert>
        ) : null}
        {draft.length > 0 ? (
          <div className="overflow-auto rounded-xl border border-border bg-card">
            <table className="w-full text-content" aria-label="Danh sách tuần">
              <thead className="sticky top-0 bg-page text-left text-label font-medium text-text-secondary">
                <tr>
                  <th className="px-3 py-2">Tuần học</th>
                  <th className="px-3 py-2">Ngày bắt đầu</th>
                  <th className="px-3 py-2">Ngày kết thúc</th>
                  <th className="px-3 py-2">Học kỳ</th>
                  <th className="px-3 py-2">Hiển thị</th>
                  <th className="px-3 py-2">Tuần đệm</th>
                  <th className="px-3 py-2">Tên tuần đệm</th>
                </tr>
              </thead>
              <tbody>
                {draft.map((week) => (
                  <tr key={week.week_no} className={`border-t border-border ${week.is_off ? 'bg-warning/5' : ''}`}>
                    <td className="px-3 py-2 font-medium">Tuần {week.week_no}</td>
                    <td className="px-3 py-2">{formatDate(week.start_date)}</td>
                    <td className="px-3 py-2">{formatDate(week.end_date)}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Học kỳ của tuần ${week.week_no}`}
                        className={cellInput}
                        disabled={!editable}
                        value={week.term_type ?? ''}
                        onChange={(event) => {
                          const termType = (event.target.value || null) as TermType | null;
                          const calendarTerm = weeks.data?.find((item) => item.week_no === week.week_no);
                          patch(week.week_no, {
                            term_type: termType,
                            term: termType ?? (calendarTerm?.term_type ? null : (calendarTerm?.term ?? null)),
                          });
                        }}
                      >
                        <option value="">
                          Theo lịch
                          {week.term_type === null && week.term ? ` (${TERM_LABELS[week.term]})` : ''}
                        </option>
                        {(Object.keys(TERM_LABELS) as TermType[]).map((term) => (
                          <option key={term} value={term}>
                            {TERM_LABELS[term]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Hiển thị tuần ${week.week_no}`}
                        checked={week.is_visible}
                        disabled={!editable}
                        onChange={(event) => patch(week.week_no, { is_visible: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Tuần ${week.week_no} là tuần đệm`}
                        checked={week.is_off}
                        disabled={!editable}
                        onChange={(event) => patch(week.week_no, { is_off: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Tên tuần đệm tuần ${week.week_no}`}
                        className={`w-full ${cellInput}`}
                        value={week.note ?? ''}
                        disabled={!editable}
                        onChange={(event) => patch(week.week_no, { note: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {editable && draft.length > 0 ? (
          <div>
            <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending || changes.length === 0}>
              Ghi
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
