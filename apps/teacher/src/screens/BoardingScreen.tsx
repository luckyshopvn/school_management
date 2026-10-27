import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ApplicationHeader, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import type { MyClass } from './ClassesScreen.js';

// Bán trú lớp Tiểu học (DT-20 phần 20b, YCTD-159): giáo viên chủ nhiệm xem danh sách ăn của ngày (học sinh đăng ký bán trú
// trừ học sinh cắt suất), báo cắt suất thay phụ huynh và chốt số suất cho bếp. Lớp Mầm non vẫn dùng báo cơm
interface Roster {
  date: string;
  registered_count: number;
  headcount: number;
  closed: boolean;
  children: Array<{
    child_id: string;
    full_name: string;
    cut: { reason: string | null; source: string; created_by_name: string } | null;
  }>;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function BoardingScreen({ myClass, onBack }: { myClass: MyClass; onBack(): void }) {
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState<Roster>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  // Đổi ngày khi danh sách của ngày trước chưa tải xong: chỉ nhận kết quả của lần tải mới nhất, kết quả cũ về sau bị bỏ
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const loaded = await requestJson<Roster>(`/api/v1/boarding/classes/${myClass.id}/roster?date=${date}`);
      if (request === latest.current) {
        setRoster(loaded);
      }
    } catch (error) {
      if (request === latest.current) {
        setRoster(undefined);
        setMessage({ text: messageOf(error), failed: true });
      }
    }
  }, [myClass.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (path: string, body: object, done: string) => {
    setBusy(true);
    try {
      await requestJson(`/api/v1/boarding/classes/${myClass.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ date, ...body }),
      });
      setMessage({ text: done, failed: false });
      await load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <ApplicationHeader title={`Bán trú lớp ${myClass.name}`} />
      <main className="mx-auto flex max-w-xl flex-col md:max-w-3xl gap-4 p-4">
        <div>
          <Button variant="text" onClick={onBack}>
            Quay lại
          </Button>
        </div>
        {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
        <TextField label="Ngày" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        {roster ? (
          <section
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            aria-label="Danh sách ăn"
          >
            <p className="text-content text-text">
              {roster.registered_count} học sinh đăng ký bán trú; {roster.headcount} suất
              {roster.closed ? ' (đã chốt)' : ''}.
            </p>
            <ul className="flex flex-col gap-2">
              {roster.children.map((child) => (
                <li key={child.child_id} className="flex items-center justify-between gap-2">
                  <span className={child.cut ? 'text-text-secondary line-through' : 'text-text'}>
                    {child.full_name}
                    {child.cut?.reason ? ` · ${child.cut.reason}` : ''}
                  </span>
                  {roster.closed ? null : (
                    <Button
                      aria-label={`${child.cut ? 'Bỏ cắt suất' : 'Cắt suất'} của ${child.full_name}`}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          'cuts',
                          { child_id: child.child_id, cut: child.cut === null, reason: null },
                          child.cut ? 'Đã bỏ cắt suất' : 'Đã báo cắt suất',
                        )
                      }
                    >
                      {child.cut ? 'Bỏ cắt suất' : 'Cắt suất'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {roster.closed ? (
              <Alert tone="info">Đã chốt số suất. Cần sửa thì nhờ người quản lý bán trú mở lại.</Alert>
            ) : (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void run('close', {}, `Đã chốt ${roster.headcount} suất cho bếp`)}
              >
                Chốt số suất
              </Button>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
