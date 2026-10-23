import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Cắt suất bán trú của con học Tiểu học (DT-20 phần 20b, YCTD-159): phụ huynh báo con không ăn bán trú một ngày học, từ hôm
// nay trở đi; báo cho hôm nay phải trước giờ vào học của trường, sau đó nhờ giáo viên chủ nhiệm. Ngày lớp đã chốt suất thì
// không sửa được. Tiền ăn tính theo ngày ăn thực tế nên ngày cắt suất không thu tiền ăn
interface MonthCuts {
  registered: boolean;
  cuts: Array<{ meal_date: string; reason: string | null; source: string }>;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function BoardingPanel({ child }: { child: { id: string; full_name: string } }) {
  const [date, setDate] = useState(vietnamToday());
  const [reason, setReason] = useState('');
  const [data, setData] = useState<MonthCuts>();
  const [message, setMessage] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);
  const month = (date || vietnamToday()).slice(0, 7);

  const load = useCallback(async () => {
    try {
      setData(await requestJson<MonthCuts>(`/api/v1/boarding/children/${child.id}/cuts?month=${month}`));
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    }
  }, [child.id, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (call: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await call();
      setMessage({ text: done, failed: false });
      setReason('');
      await load();
    } catch (error) {
      setMessage({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`Bán trú của ${child.full_name}`}>
      {message ? <Alert tone={message.failed ? 'danger' : 'success'}>{message.text}</Alert> : null}
      {data && !data.registered ? (
        <p className="text-content text-text-secondary">Con chưa đăng ký bán trú tháng này. Đăng ký ở mục Dịch vụ.</p>
      ) : null}
      {data?.registered ? (
        <div className="flex flex-col gap-2">
          <TextField label="Ngày không ăn" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <TextField label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button
            variant="primary"
            disabled={busy || date === ''}
            onClick={() =>
              void act(
                () =>
                  requestJson(`/api/v1/boarding/children/${child.id}/cuts`, {
                    method: 'POST',
                    body: JSON.stringify({ date, reason: reason || null }),
                  }),
                'Đã báo cắt suất',
              )
            }
          >
            Báo cắt suất
          </Button>
        </div>
      ) : null}
      {data && data.cuts.length > 0 ? (
        <ul className="flex flex-col gap-1 text-content" aria-label={`Ngày cắt suất của ${child.full_name}`}>
          {data.cuts.map((cut) => (
            <li key={cut.meal_date} className="flex items-center justify-between gap-2">
              <span>
                {cut.meal_date.split('-').reverse().join('/')}
                {cut.reason ? ` · ${cut.reason}` : ''}
              </span>
              {cut.meal_date >= vietnamToday() ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        requestJson(`/api/v1/boarding/children/${child.id}/cuts/${cut.meal_date}`, {
                          method: 'DELETE',
                        }),
                      'Đã hủy cắt suất',
                    )
                  }
                >
                  Hủy
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
