import { useEffect, useState } from 'react';
import { Alert, StatusBadge } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Con đến và về trường trong 7 ngày gần nhất (YCTD-389 lát L1, MH-643): lượt quét thẻ ở cổng; lượt nhà trường báo nhận nhầm hiện
// gạch ngang kèm nhãn đính chính. "Ra khỏi cổng" chỉ cho biết con đã ra cổng, không cho biết con đã về đến nhà
interface GatePass {
  id: string;
  direction: 'in' | 'out';
  passed_at: string;
  method: string;
  review_status: 'confirmed' | 'rejected';
  review_note: string | null;
}

const DAYS = 7;
const METHOD_LABELS: Record<string, string> = {
  qr: 'thẻ QR',
  rfid: 'thẻ RFID',
  device: 'máy chấm công',
  camera: 'camera',
};
const DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const DAY_LABEL = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
});
const TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

export function GatePassesPanel({ child }: { child: { id: string; full_name: string } }) {
  const [passes, setPasses] = useState<GatePass[]>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    const now = new Date();
    const to = DATE.format(now);
    const from = DATE.format(new Date(now.getTime() - (DAYS - 1) * 86_400_000));
    requestJson<GatePass[]>(`/api/v1/children/${child.id}/gate-passes?from=${from}&to=${to}`)
      .then(setPasses)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  }, [child.id]);

  const days = new Map<string, GatePass[]>();
  for (const pass of [...(passes ?? [])].reverse()) {
    const day = DATE.format(new Date(pass.passed_at));
    days.set(day, [...(days.get(day) ?? []), pass]);
  }

  return (
    <section className="flex flex-col gap-3" aria-label={`Đến và về trường của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {!passes && !errorMessage ? <p className="text-content text-text-secondary">Đang tải…</p> : null}
      {passes && passes.length === 0 ? (
        <p className="text-content text-text-secondary">
          Chưa có lượt qua cổng nào trong {DAYS} ngày gần nhất. Nếu con đã đến trường, có thể thiết bị chưa nhận ra con;
          cô chủ nhiệm vẫn điểm danh trong lớp.
        </p>
      ) : null}
      {[...days.entries()].map(([day, rows]) => (
        <div key={day} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
          <h3 className="text-content font-bold text-text">{DAY_LABEL.format(new Date(`${day}T12:00:00+07:00`))}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {[...rows].reverse().map((pass) => (
              <li key={pass.id} className="flex flex-wrap items-center gap-2 py-2 text-content">
                <span className="w-14 font-semibold">{TIME.format(new Date(pass.passed_at))}</span>
                <span className={pass.review_status === 'rejected' ? 'line-through text-text-secondary' : ''}>
                  {pass.direction === 'in' ? 'Vào trường' : 'Ra khỏi cổng'} · {METHOD_LABELS[pass.method] ?? ''}
                </span>
                {pass.review_status === 'rejected' ? <StatusBadge tone="warning" label="Đã đính chính" /> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-label text-text-secondary">
        Thông báo đến và về nằm ở nhóm “Con đến và về trường” trong cài đặt thông báo đẩy. “Ra khỏi cổng” không cho biết
        con đã về đến nhà.
      </p>
    </section>
  );
}
