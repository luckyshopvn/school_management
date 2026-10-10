import { useCallback, useEffect, useState } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge } from '@school-management/ui';
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

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ';
}

export function AttendanceScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState<Sheet>();
  const [marks, setMarks] = useState<Record<string, Status | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(undefined);
    try {
      const loaded = await requestJson<Sheet>(`/api/v1/classes/${myClass.id}/attendance?date=${date}`);
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

  return (
    <div className="min-h-screen">
      <ApplicationHeader title={myClass.name} />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="text" onClick={onBack}>
            Lớp của tôi
          </Button>
          <h1 className="text-section-title font-bold text-text">Bảng điểm danh</h1>
        </div>
        <label className="flex flex-col gap-2 text-label font-medium text-text">
          Ngày
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-content font-normal"
          />
        </label>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        {sheet ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-label">
              <StatusBadge
                tone={sheet.day_status === 'locked' ? 'success' : 'info'}
                label={sheet.day_status === 'locked' ? 'Đã chốt' : 'Chưa chốt'}
              />
              <span>
                {sheet.summary.total} trẻ · còn {unmarked} trẻ chưa đánh dấu · {sheet.summary.meal_count} suất ăn đã lưu
              </span>
            </div>
            <ul className="flex flex-col gap-2" aria-label="Danh sách điểm danh">
              {sheet.children.map((child) => (
                <li
                  key={child.child_id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
                  aria-label={child.full_name}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-content font-semibold">{child.full_name}</span>
                    {child.absence ? (
                      <StatusBadge
                        tone={child.absence.is_advised ? 'info' : 'warning'}
                        label={child.absence.is_advised ? 'Phụ huynh đã báo vắng' : 'Báo vắng muộn'}
                      />
                    ) : null}
                  </div>
                  <select
                    aria-label={`Trạng thái của ${child.full_name}`}
                    value={marks[child.child_id] ?? ''}
                    disabled={!sheet.can_edit}
                    onChange={(event) =>
                      setMarks({ ...marks, [child.child_id]: (event.target.value || null) as Status | null })
                    }
                    className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                  >
                    <option value="">Chưa đánh dấu</option>
                    {(Object.keys(STATUS_LABELS) as Status[]).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  {marks[child.child_id] === 'absent_unnotified' || child.absence ? (
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
              ))}
            </ul>
            {sheet.can_edit ? (
              <div className="flex flex-col gap-2">
                {sheet.day_status === 'locked' ? (
                  <input
                    aria-label="Lý do sửa điểm danh đã chốt"
                    placeholder="Lý do sửa điểm danh đã chốt"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-content"
                  />
                ) : null}
                <Button variant="primary" disabled={busy} onClick={() => void save()}>
                  Lưu điểm danh
                </Button>
                {sheet.day_status === 'open' ? (
                  <Button disabled={busy || unmarked > 0} onClick={() => void lock()}>
                    Chốt điểm danh ngày
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-label text-text-secondary">Bạn chỉ xem được bảng điểm danh của lớp này.</p>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
