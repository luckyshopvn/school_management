import { useEffect, useState } from 'react';
import { Alert, Button } from '@school-management/ui';
import { readTutorOverview, type TutorOverview } from './ai-tutor-api.js';
import { ParentRequestButton } from './ParentRequestButton.js';
import { TurnMeter } from './TurnMeter.js';

// Thẻ "Gia sư AI" ở trang chủ của em (YCTD-383 lát L2, MH-596): chưa có gói thì nhờ cha mẹ đăng ký trong ứng dụng phụ huynh; có gói thì
// thấy số lượt còn lại và mở trang trò chuyện. Học sinh Mầm non hoặc chưa xếp lớp thì không hiện thẻ. Lát L5: chưa có gói hoặc hết lượt
// thì có nút "Gửi lời nhờ cha mẹ"
export function StudentAiTutorCard({ onOpen }: { onOpen(): void }) {
  const [overview, setOverview] = useState<TutorOverview | null>(null);

  useEffect(() => {
    readTutorOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  // Bản triển khai chưa có gia sư AI (một trường, nền tảng chưa bật khóa) và em chưa có gói, chưa có hội thoại thì không hiện thẻ
  if (
    !overview ||
    !overview.child.school_level ||
    (!overview.ready && !overview.subscribed && overview.conversations.length === 0)
  ) {
    return null;
  }
  return (
    <section
      aria-label="Gia sư AI"
      className="flex flex-col gap-2 rounded-xl border border-brand bg-selected p-4 shadow-sm"
    >
      <h2 className="text-body font-semibold text-text">Gia sư AI</h2>
      <p className="text-label text-text">
        Hỏi bài các môn ở trường. Gia sư gợi ý từng bước để em tự làm, không đưa đáp án ngay.
      </p>
      {overview.subscribed ? (
        <TurnMeter balance={overview.balance} />
      ) : (
        <Alert tone="warning">Em chưa có gói. Nhờ cha mẹ đăng ký Gia sư AI trong ứng dụng phụ huynh.</Alert>
      )}
      <ParentRequestButton key={JSON.stringify(overview.parent_request)} initial={overview.parent_request} />
      {overview.subscribed && overview.unavailable_reason ? (
        <Alert tone="info">{overview.unavailable_reason}</Alert>
      ) : null}
      {/* Hết gói vẫn xem lại được hội thoại cũ trong 12 tháng */}
      {overview.subscribed || overview.conversations.length > 0 ? (
        <div>
          <Button onClick={onOpen}>{overview.subscribed ? 'Mở gia sư AI' : 'Xem hội thoại cũ'}</Button>
        </div>
      ) : null}
    </section>
  );
}
