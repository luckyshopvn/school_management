import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import {
  deleteCalls,
  fetchCalls,
  isNetworkError,
  messageOf,
  sendCalls,
  type CallRecord,
  type QueuedCall,
} from './classroom-api.js';
import { pickStudent, type RosterStudent } from './classroom-logic.ts';
import { enqueueCall, offlineAllowed, readQueue } from './classroom-store.js';

// Gọi tên ngẫu nhiên (DT-23 phần 23b, YCTD-212): bốc từ danh sách lớp thật, tuỳ chọn không lặp trong một lượt, loại học sinh
// vắng hôm nay, hiệu ứng chọn, ghi lượt gọi (ai, lúc nào) để xem lại và xóa. Mất mạng thì lượt gọi vào hàng đợi trên máy
export interface ToolStudent extends RosterStudent {
  absent: boolean;
}

export interface ToolProperties {
  classId: string;
  students: ToolStudent[];
  online: boolean;
  // Báo màn hình cha cập nhật số mục chờ gửi
  onQueueChanged(): void;
}

const ROLL_MILLISECONDS = 900;
const ROLL_INTERVAL = 70;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function CallTool({ classId, students, online, onQueueChanged }: ToolProperties) {
  const [noRepeat, setNoRepeat] = useState(true);
  const [excludeAbsent, setExcludeAbsent] = useState(true);
  const [calledIds, setCalledIds] = useState<string[]>([]);
  const [current, setCurrent] = useState<ToolStudent | null>(null);
  const [rolling, setRolling] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'info' | 'success'; text: string }>();
  const [history, setHistory] = useState<CallRecord[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadHistory = useCallback(() => {
    if (!online) {
      return;
    }
    fetchCalls(classId)
      .then(setHistory)
      .catch(() => undefined);
  }, [classId, online]);

  useEffect(loadHistory, [loadHistory]);
  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => {
    setCalledIds([]);
    setCurrent(null);
  }, [classId]);

  const record = async (student: ToolStudent) => {
    const call: QueuedCall = {
      client_id: crypto.randomUUID(),
      class_id: classId,
      child_id: student.id,
      called_at: new Date().toISOString(),
    };
    try {
      await sendCalls(classId, [{ client_id: call.client_id, child_id: call.child_id, called_at: call.called_at }]);
      loadHistory();
    } catch (error) {
      if (isNetworkError(error) && offlineAllowed()) {
        enqueueCall(call);
        onQueueChanged();
        setNotice({ tone: 'info', text: 'Chưa có mạng: lượt gọi được giữ trên máy và sẽ gửi khi có mạng' });
      } else {
        setNotice({ tone: 'danger', text: messageOf(error) });
      }
    }
  };

  const call = () => {
    setNotice(undefined);
    const absent = new Set(students.filter((student) => student.absent).map((student) => student.id));
    const result = pickStudent(students, new Set(calledIds), absent, { noRepeat, excludeAbsent }, Math.random);
    if (!result.student) {
      setNotice({
        tone: 'info',
        text: noRepeat && calledIds.length > 0 ? 'Đã gọi hết cả lớp trong lượt này' : 'Lớp không có học sinh để gọi',
      });
      return;
    }
    const chosen = result.student as ToolStudent;
    const finish = () => {
      clearInterval(timer.current);
      setRolling(false);
      setCurrent(chosen);
      setCalledIds((previous) => [...previous, chosen.id]);
      void record(chosen);
      if (result.exhausted) {
        setNotice({ tone: 'info', text: 'Đây là học sinh cuối cùng của lượt; bấm "Lượt mới" để gọi lại từ đầu' });
      }
    };
    if (reducedMotion() || students.length < 2) {
      finish();
      return;
    }
    setRolling(true);
    const started = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      if (Date.now() - started >= ROLL_MILLISECONDS) {
        finish();
        return;
      }
      setCurrent(students[Math.floor(Math.random() * students.length)] ?? null);
    }, ROLL_INTERVAL);
  };

  const pending = readQueue().calls.filter((item) => item.class_id === classId);
  const nameOf = (childId: string) => students.find((student) => student.id === childId)?.full_name ?? 'Học sinh';

  const remove = async (callId?: string) => {
    try {
      await deleteCalls(classId, callId);
      loadHistory();
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    }
  };

  return (
    <section aria-label="Gọi tên ngẫu nhiên" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={noRepeat} onChange={(event) => setNoRepeat(event.target.checked)} />
          Không gọi lặp lại trong một lượt
        </label>
        <label className="flex items-center gap-2 text-content text-text">
          <input type="checkbox" checked={excludeAbsent} onChange={(event) => setExcludeAbsent(event.target.checked)} />
          Loại học sinh vắng hôm nay
        </label>
      </div>
      <div
        aria-live="polite"
        aria-label="Học sinh được gọi"
        className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-border bg-card p-4 text-center"
      >
        {current ? (
          <>
            <span className="text-label text-text-secondary">Số thứ tự {current.order_no}</span>
            <span className={`text-page-title font-bold text-text ${rolling ? 'opacity-60' : ''}`}>
              {current.full_name}
            </span>
          </>
        ) : (
          <span className="text-content text-text-secondary">Bấm "Gọi tên" để chọn một học sinh</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" disabled={rolling || students.length === 0} onClick={call}>
          Gọi tên
        </Button>
        <Button
          disabled={calledIds.length === 0}
          onClick={() => {
            setCalledIds([]);
            setNotice(undefined);
          }}
        >
          Lượt mới
        </Button>
      </div>
      <p className="text-label text-text-secondary">
        Đã gọi {calledIds.length}/{students.length} trong lượt này
      </p>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <div className="flex items-center justify-between">
        <h2 className="text-content font-semibold text-text">Lịch sử gọi</h2>
        {online && history.length > 0 ? <Button onClick={() => void remove()}>Xóa lịch sử của tôi</Button> : null}
      </div>
      <ul aria-label="Lịch sử gọi" className="flex flex-col gap-1">
        {pending.map((item) => (
          <li key={item.client_id} className="rounded-lg border border-border bg-card px-3 py-2 text-label text-text">
            {nameOf(item.child_id)} · {new Date(item.called_at).toLocaleTimeString('vi-VN')} · chờ gửi
          </li>
        ))}
        {history.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-label text-text"
          >
            <span>
              {item.full_name} · {new Date(item.called_at).toLocaleString('vi-VN')} · {item.called_by_name}
            </span>
            <Button variant="text" aria-label={`Xóa lượt gọi ${item.full_name}`} onClick={() => void remove(item.id)}>
              Xóa
            </Button>
          </li>
        ))}
        {pending.length === 0 && history.length === 0 ? (
          <li className="text-label text-text-secondary">Chưa có lượt gọi nào</li>
        ) : null}
      </ul>
    </section>
  );
}
