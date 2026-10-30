import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, StatusBadge, TextField, Toast } from '@school-management/ui';
import { UnitSelect, useUnitChoice } from '../catalogs/UnitSelect.js';
import { listClasses } from '../classes/classes-api.js';
import { AppShell } from '../pages/AppShell.js';
import { useSchoolLevelTerms } from '../school-levels/working-level.js';
import { ApiError, requestJson } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { GateCardsPanel } from './GateCardsPanel.js';

// Điểm danh trên cổng quản trị (P04-01, P04-06, QT-02): xem bảng của lớp theo ngày; quản lý đơn vị chốt thay,
// sửa sau khi chốt kèm lý do, mở lại ngày đã chốt (ghi chú 15 của tài liệu 08, YCTD-47). YCTD-334 (thiết kế lại cổng quản
// trị): bộ lọc gọn một hàng, ô Đơn vị chỉ hiện khi có từ hai đơn vị, nút ngày trước, ngày sau; tóm tắt thành từng ô số; nút
// thao tác ở đầu bảng, thêm "Đánh dấu tất cả có mặt" cho các dòng chưa đánh dấu (vẫn phải bấm Lưu). YCTD-389: cột "Cổng trường"
// là gợi ý từ lượt quét thẻ (MH-640); không có lượt thì để trống, không gợi ý vắng; báo nhận nhầm hủy lượt và gửi đính chính
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
    gate: {
      first_in_pass_id: string | null;
      first_in: string | null;
      last_out: string | null;
      first_in_method: string | null;
      suggested_status: 'present' | 'late' | null;
    } | null;
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

const METHOD_LABELS: Record<string, string> = {
  qr: 'thẻ QR',
  rfid: 'thẻ RFID',
  device: 'máy chấm công',
  camera: 'camera',
};

function timeOf(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// Ngày liền trước hoặc liền sau dạng yyyy-mm-dd, tính theo lịch (không theo múi giờ máy)
function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  // "Trẻ" ở Mầm non, "Học sinh" ở cấp khác (DT-19 phần 19c)
  const terms = useSchoolLevelTerms();
  const unitChoice = useUnitChoice();
  const orgUnitId = unitChoice.selectedId;
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(vietnamToday());
  const [marks, setMarks] = useState<Record<string, Status | ''>>({});
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string>();
  const canManageCards = useHasPermission('P04.gate-card.manage');
  const [showCards, setShowCards] = useState(false);
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
  const reject = useMutation({
    mutationFn: (passId: string) =>
      requestJson(`/api/v1/gate-passes/${passId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Giáo viên báo nhận nhầm' }),
      }),
    onSuccess: () => refresh('Đã hủy lượt và gửi đính chính cho phụ huynh'),
  });
  const actionError = save.error ?? lock.error ?? unlock.error ?? reject.error;
  const data = sheet.data;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-page-title font-bold text-text">Điểm danh</h1>
          <div className="flex flex-wrap items-end gap-3">
            {unitChoice.units.length > 1 ? (
              <UnitSelect units={unitChoice.units} selectedId={orgUnitId} onSelect={unitChoice.select} />
            ) : null}
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
            <div className="flex items-end gap-1">
              <Button aria-label="Hôm trước" onClick={() => setDate(shiftDate(date, -1))}>
                <span aria-hidden="true">‹</span>
              </Button>
              <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <Button aria-label="Hôm sau" onClick={() => setDate(shiftDate(date, 1))}>
                <span aria-hidden="true">›</span>
              </Button>
            </div>
          </div>
        </div>
        {canManageCards && selectedClassId ? (
          <div className="flex flex-col gap-3">
            <div>
              <Button aria-expanded={showCards} onClick={() => setShowCards(!showCards)}>
                {showCards ? 'Ẩn thẻ QR của lớp' : 'Thẻ QR của lớp'}
              </Button>
            </div>
            {showCards ? <GateCardsPanel classId={selectedClassId} learner={terms.learner} /> : null}
          </div>
        ) : null}
        {sheet.isError ? <Alert tone="warning">{messageOf(sheet.error)}</Alert> : null}
        {actionError ? <Alert tone="danger">{messageOf(actionError)}</Alert> : null}
        {data ? (
          <section
            className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
            aria-label="Bảng điểm danh"
          >
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                tone={data.day_status === 'locked' ? 'success' : 'info'}
                label={data.day_status === 'locked' ? 'Đã chốt' : 'Chưa chốt'}
              />
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-content" aria-label="Tóm tắt điểm danh">
                {[
                  [terms.learner, data.summary.total],
                  ['Có mặt', data.summary.present],
                  ['Đi muộn', data.summary.late],
                  ['Về sớm', data.summary.early_leave],
                  ['Nghỉ có báo', data.summary.absent_notified],
                  ['Nghỉ không báo', data.summary.absent_unnotified],
                  ['Chưa đánh dấu', data.summary.unmarked],
                  ['Suất ăn', data.summary.meal_count],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <dt className="text-label text-text-secondary">{label}</dt>
                    <dd
                      className={`font-semibold ${label === 'Chưa đánh dấu' && Number(value) > 0 ? 'text-warning' : ''}`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {data.can_edit ? (
              <div className="flex flex-wrap items-end gap-3">
                {data.day_status === 'locked' ? (
                  <TextField
                    label="Lý do sửa hoặc mở lại"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                ) : null}
                <Button
                  disabled={data.children.every((child) => marks[child.child_id])}
                  onClick={() =>
                    setMarks(
                      Object.fromEntries(
                        data.children.map((child) => [child.child_id, marks[child.child_id] || 'present']),
                      ),
                    )
                  }
                >
                  Đánh dấu tất cả có mặt
                </Button>
                <Button
                  disabled={!data.children.some((child) => !marks[child.child_id] && child.gate?.suggested_status)}
                  onClick={() =>
                    setMarks(
                      Object.fromEntries(
                        data.children.map((child) => [
                          child.child_id,
                          marks[child.child_id] || child.gate?.suggested_status || '',
                        ]),
                      ),
                    )
                  }
                >
                  Điền theo cổng trường
                </Button>
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
            <div className="relative overflow-x-auto">
              <table className="w-full text-content">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">{terms.learner}</th>
                    <th className="px-3 py-2">Cổng trường</th>
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
                        {child.gate?.first_in ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              tone={child.gate.suggested_status === 'late' ? 'warning' : 'success'}
                              label={`Vào ${timeOf(child.gate.first_in)} · ${METHOD_LABELS[child.gate.first_in_method ?? ''] ?? ''}`}
                            />
                            {child.gate.last_out ? (
                              <span className="text-label text-text-secondary">Ra {timeOf(child.gate.last_out)}</span>
                            ) : null}
                            {data.can_edit && child.gate.first_in_pass_id ? (
                              <Button
                                variant="text"
                                disabled={reject.isPending}
                                onClick={() => {
                                  if (
                                    child.gate?.first_in_pass_id &&
                                    window.confirm(
                                      `Báo nhận nhầm lượt vào của ${child.full_name}? Phụ huynh sẽ nhận tin đính chính, không hoàn tác được.`,
                                    )
                                  ) {
                                    reject.mutate(child.gate.first_in_pass_id);
                                  }
                                }}
                              >
                                Báo nhận nhầm
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-label text-text-secondary">Chưa thấy qua cổng</span>
                        )}
                      </td>
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
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
