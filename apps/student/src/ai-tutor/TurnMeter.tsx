import { remainingPercent } from './ai-tutor-math.js';
import type { TutorBalance } from './ai-tutor-api.js';

// Thanh số lượt còn lại của các gói đang dùng (MH-596, MH-597); lượt mua thêm ghi riêng
export function TurnMeter({ balance }: { balance: TutorBalance }) {
  const percent = remainingPercent(balance.remaining, balance.total);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-label text-text">
        Còn <strong>{balance.remaining}</strong>/{balance.total} lượt hỏi
        {balance.top_up > 0 ? <span className="text-text-secondary"> (có {balance.top_up} lượt mua thêm)</span> : null}
      </p>
      <div
        role="meter"
        aria-label="Lượt hỏi còn lại"
        aria-valuemin={0}
        aria-valuemax={balance.total}
        aria-valuenow={balance.remaining}
        className="h-2 overflow-hidden rounded-full border border-border bg-page"
      >
        <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
