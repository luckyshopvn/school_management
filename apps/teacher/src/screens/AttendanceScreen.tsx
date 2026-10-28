import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, StatusBadge, type StatusTone } from '@school-management/ui';
import {
  enqueue,
  flushQueue,
  isNetworkError,
  pendingFor,
  sendAttendance,
  type PendingAttendance,
} from '../attendance/offline-queue.js';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// MG-02 Bảng điểm danh của lớp (P04-01, P04-06, QT-02): đánh dấu từng trẻ, lưu, chốt ngày; mất mạng thì lưu tạm
type Status = 'present' | 'absent_notified' | 'absent_unnotified' | 'late' | 'early_leave' | 'late_and_early_leave';

const STATUS_LABELS: Record<Status, string> = {
  present: 'Có mặt',
  absent_notified: 'Nghỉ có báo',
  absent_unnotified: 'Nghỉ không báo',
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  late_and_early_leave: 'Muộn và về sớm',
};

// Chạm vào dòng của trẻ thì đổi lần lượt ba trạng thái hay dùng; trạng thái khác chọn ở ô chọn bên phải dòng
const CYCLE: Status[] = ['present', 'absent_notified', 'absent_unnotified'];

// Màu nhãn trạng thái theo tông của StatusBadge: có mặt xanh lá, nghỉ có báo vàng, nghỉ không báo đỏ, muộn hoặc về sớm xanh dương
const STATUS_TONES: Record<Status, StatusTone> = {
  present: 'success',
  absent_notified: 'warning',
  absent_unnotified: 'danger',
  late: 'info',
  early_leave: 'info',
  late_and_early_leave: 'info',
};

const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-neutral/10 text-neutral',
};

interface SheetChild {
  child_id: string;
  full_name: string;
  status: Status | null;
  saved: boolean;
  note: string | null;
  absence: { reason: string | null; is_advised: boolean } | null;
}

interface Sheet {
  date: string;
  day_status: 'open' | 'locked';
  can_edit: boolean;
  children: SheetChild[];
  summary: { total: number; unmarked: number; meal_count: number };
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// Thứ và ngày tháng của ngày điểm danh trên thanh đầu trang, ví dụ "Thứ Tư, 28/10"
function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

// `embedded`: đặt trong khung phải của chế độ lớp học (DT-26 phần 26d), bỏ đầu trang và nút quay lại
export function AttendanceScreen({
  myClass,
  onBack,
  embedded = false,
}: {
  myClass: MyClass;
  onBack(): void;
  embedded?: boolean;
}) {
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<Sheet>();
  const [marks, setMarks] = useState<Record<string, Status | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  // Đổi ngày nhanh thì kết quả của ngày cũ có thể về sau; chỉ nhận kết quả của lần tải mới nhất
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const requestNumber = ++latestRequest.current;
    setMessage(undefined);
    try {
      const loaded = await requestJson<Sheet>(`/api/v1/classes/${myClass.id}/attendance?date=${date}`);
      if (requestNumber !== latestRequest.current) {
        return;
      }
      setSheet(loaded);
      // Bản lưu tạm chưa gửi được ưu tiên hiển thị để giáo viên không mất thao tác
      const pending = pendingFor(myClass.id, date);
      setMarks(
        Object.fromEntries(
          loaded.children.map((child) => [
            child.child_id,
            (pending?.entries.find((entry) => entry.child_id === child.child_id)?.status as Status | undefined) ??
              child.status,
          ]),
        ),
      );
      setNotes(Object.fromEntries(loaded.children.map((child) => [child.child_id, child.note ?? ''])));
      if (pending) {
        setMessage({ tone: 'warning', text: 'Dữ liệu chưa đồng bộ, sẽ tự gửi khi có mạng' });
      }
    } catch (error) {
      if (requestNumber !== latestRequest.current) {
        return;
      }
      setSheet(undefined);
      setMessage({ tone: 'danger', text: messageOf(error) });
    }
  }, [myClass.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Có mạng lại thì gửi các bản lưu tạm
  useEffect(() => {
    const handleOnline = () => {
      void flushQueue().then((result) => {
        if (result.sent > 0) {
          void load().then(() => setMessage({ tone: 'success', text: 'Đã gửi điểm danh lưu tạm' }));
        }
        if (result.rejected.length > 0) {
          setMessage({ tone: 'danger', text: result.rejected.map((item) => item.message).join('. ') });
        }
      });
    };
    window.addEventListener('online', handleOnline);
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, [load]);

  async function save() {
    if (!sheet) {
      return;
    }
    const item: PendingAttendance = {
      classId: myClass.id,
      date,
      recordedAt: new Date().toISOString(),
      entries: sheet.children
        .filter((child) => marks[child.child_id])
        .map((child) => ({
          child_id: child.child_id,
          status: marks[child.child_id] as Status,
          note: notes[child.child_id]?.trim() || null,
        })),
    };
    if (item.entries.length === 0) {
      setMessage({ tone: 'warning', text: 'Chưa đánh dấu trẻ nào' });
      return;
    }
    setBusy(true);
    try {
      if (sheet.day_status === 'locked') {
        await requestJson(`/api/v1/classes/${myClass.id}/attendance`, {
          method: 'PUT',
          body: JSON.stringify({ date, entries: item.entries, reason }),
        });
      } else {
        await sendAttendance(item, false);
      }
      await load();
      setMessage({ tone: 'success', text: 'Đã lưu điểm danh' });
    } catch (error) {
      if (isNetworkError(error) && sheet.day_status !== 'locked') {
        enqueue(item);
        setMessage({ tone: 'warning', text: 'Dữ liệu chưa đồng bộ, sẽ tự gửi khi có mạng' });
      } else {
        setMessage({ tone: 'danger', text: messageOf(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setBusy(true);
    try {
      await requestJson(`/api/v1/classes/${myClass.id}/attendance/lock`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      await load();
      setMessage({ tone: 'success', text: 'Đã chốt điểm danh ngày' });
    } catch (error) {
      setMessage({ tone: 'danger', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }

  const unmarked = sheet ? sheet.children.filter((child) => !marks[child.child_id]).length : 0;
  // Ba ô đếm trên đầu bảng theo trạng thái đang đánh dấu (kể cả chưa lưu): đi muộn, về sớm vẫn tính là có mặt
  const marked = sheet ? sheet.children.map((child) => marks[child.child_id]) : [];
  const counters = [
    {
      label: STATUS_LABELS.present,
      value: marked.filter((status) => status && status !== 'absent_notified' && status !== 'absent_unnotified').length,
    },
    { label: STATUS_LABELS.absent_notified, value: marked.filter((status) => status === 'absent_notified').length },
    { label: STATUS_LABELS.absent_unnotified, value: marked.filter((status) => status === 'absent_unnotified').length },
  ];
  const pad = embedded ? '' : 'px-4';

  function cycle(child: SheetChild) {
    const current = marks[child.child_id];
    const next = CYCLE[(current ? CYCLE.indexOf(current) + 1 : 0) % CYCLE.length] ?? 'present';
    setMarks({ ...marks, [child.child_id]: next });
  }

  const counterGrid = sheet ? (
    <div className="grid grid-cols-3 gap-2">
      {counters.map((counter, index) => (
        <div key={counter.label} className="flex flex-col rounded-lg bg-header-strong px-3 py-2 text-white">
          <span className={`text-section-title font-bold tabular-nums ${index === 2 ? 'text-header-accent' : ''}`}>
            {counter.value}
          </span>
          <span className="text-xs text-selected">{counter.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className={embedded ? undefined : 'flex min-h-screen flex-col'}>
      {/* Thanh đầu trang xanh: quay lại, tên lớp, ngày đang xem và ba ô đếm (mẫu giao diện giáo viên) */}
      {embedded ? null : (
        <header className="bg-header text-white">
          <div className="mx-auto flex max-w-md flex-col gap-3 px-4 pb-4 pt-5 md:max-w-3xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Lớp của tôi"
                onClick={onBack}
                className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-header-strong"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <h1 className="truncate text-section-title font-bold">{myClass.name}</h1>
                <span className="text-label text-selected">Bảng điểm danh · {dayLabel(date)}</span>
              </div>
            </div>
            {counterGrid}
          </div>
        </header>
      )}
      <main
        className={
          embedded ? 'flex flex-col gap-4' : 'mx-auto flex w-full max-w-md flex-1 flex-col gap-3 py-4 md:max-w-3xl'
        }
      >
        {embedded ? (
          <>
            <h1 className="text-section-title font-bold text-text">Bảng điểm danh</h1>
            {counterGrid ? <div className="rounded-xl bg-header p-2">{counterGrid}</div> : null}
          </>
        ) : null}
        <label className={`flex items-center gap-3 text-label font-medium text-text ${pad}`}>
          Ngày
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(event) => setDate(event.target.value)}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
          />
        </label>
        {message ? (
          <div className={pad}>
            <Alert tone={message.tone}>{message.text}</Alert>
          </div>
        ) : null}
        {sheet ? (
          <>
            <div className={`flex flex-wrap items-center gap-2 text-label ${pad}`}>
              <StatusBadge
                tone={sheet.day_status === 'locked' ? 'success' : 'info'}
                label={sheet.day_status === 'locked' ? 'Đã chốt' : 'Chưa chốt'}
              />
              <span>
                {sheet.summary.total} trẻ · còn {unmarked} trẻ chưa đánh dấu · {sheet.summary.meal_count} suất ăn đã lưu
              </span>
            </div>
            <div className="overflow-hidden border-y border-border bg-card md:rounded-xl md:border">
              {sheet.can_edit ? (
                <p className="border-b border-border px-4 py-2.5 text-label text-text-secondary">
                  Chạm vào tên để đổi trạng thái; trạng thái khác chọn ở nhãn bên phải.
                </p>
              ) : null}
              <ul className="flex flex-col" aria-label="Danh sách điểm danh">
                {sheet.children.map((child, index) => {
                  const status = marks[child.child_id] ?? null;
                  return (
                    <li
                      key={child.child_id}
                      className="flex flex-col gap-2 border-b border-border px-4 py-2 last:border-b-0"
                      aria-label={child.full_name}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={!sheet.can_edit}
                          onClick={() => cycle(child)}
                          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        >
                          <span className="w-7 shrink-0 text-label tabular-nums text-text-secondary">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="text-content font-medium text-text">{child.full_name}</span>
                            {child.absence ? (
                              <span className="flex flex-wrap items-center gap-1 text-xs text-text-secondary">
                                <StatusBadge
                                  tone={child.absence.is_advised ? 'info' : 'warning'}
                                  label={child.absence.is_advised ? 'Phụ huynh đã báo vắng' : 'Báo vắng muộn'}
                                />
                                {child.absence.reason}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <select
                          aria-label={`Trạng thái của ${child.full_name}`}
                          value={status ?? ''}
                          disabled={!sheet.can_edit}
                          onChange={(event) =>
                            setMarks({ ...marks, [child.child_id]: (event.target.value || null) as Status | null })
                          }
                          className={`max-w-[45%] shrink-0 rounded-full border-0 px-3 py-1 text-label font-semibold ${
                            TONE_CLASSES[status ? STATUS_TONES[status] : 'neutral']
                          }`}
                        >
                          <option value="">Chưa đánh dấu</option>
                          {(Object.keys(STATUS_LABELS) as Status[]).map((item) => (
                            <option key={item} value={item}>
                              {STATUS_LABELS[item]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {status === 'absent_unnotified' || child.absence ? (
                        <input
                          aria-label={`Ghi chú của ${child.full_name}`}
                          placeholder="Lý do nghỉ"
                          value={notes[child.child_id] ?? ''}
                          disabled={!sheet.can_edit}
                          onChange={(event) => setNotes({ ...notes, [child.child_id]: event.target.value })}
                          className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            {sheet.can_edit ? null : (
              <p className={`text-label text-text-secondary ${pad}`}>Bạn chỉ xem được bảng điểm danh của lớp này.</p>
            )}
          </>
        ) : null}
      </main>
      {/* Nút lưu dính đáy màn hình trên ứng dụng giáo viên; trong chế độ lớp học nằm cuối bảng như trước */}
      {sheet?.can_edit ? (
        <div className={embedded ? 'mt-4' : 'sticky bottom-0 border-t border-border bg-card'}>
          <div
            className={
              embedded ? 'flex flex-col gap-2' : 'mx-auto flex max-w-md flex-col gap-2 px-4 pb-6 pt-3 md:max-w-3xl'
            }
          >
            {sheet.day_status === 'locked' ? (
              <input
                aria-label="Lý do sửa điểm danh đã chốt"
                placeholder="Lý do sửa điểm danh đã chốt"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-content"
              />
            ) : null}
            <Button variant="primary" className="h-12" disabled={busy} onClick={() => void save()}>
              Lưu điểm danh
            </Button>
            {sheet.day_status === 'open' ? (
              <Button disabled={busy || unmarked > 0} onClick={() => void lock()}>
                Chốt điểm danh ngày
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
