import { useEffect, useState } from 'react';
import { ApiError, requestJson } from '../session/api-client.js';

// "Tháng này của con" ở trang Gia sư AI cho con (YCTD-383 lát L1a, lát L5; bản mẫu MH-598): số lượt đã dùng của gói tháng, lượt mua thêm
// còn lại, số lượt con đã hỏi trong tháng và chủ đề nhiều nhất. Cha mẹ không xem được nội dung hội thoại hay trích đoạn câu con hỏi (Q6);
// cờ tự hại, bị bắt nạt đến cha mẹ bằng thông báo riêng (lát L3). Hiện chung cho cả hai nơi mua
export interface MonthlyUsage {
  plan_name: string;
  used_turns: number;
  turns: number;
}

interface Topics {
  month: string;
  turns_this_month: number;
  top_topics: Array<{ topic: string; turns: number }>;
}

export function AiTutorChildUsage({
  childId,
  currentMonth,
  monthly,
  topUpRemaining,
}: {
  childId: string;
  currentMonth: string;
  monthly: MonthlyUsage | undefined;
  topUpRemaining: number;
}) {
  const [topics, setTopics] = useState<Topics>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    requestJson<Topics>(`/api/v1/children/${childId}/ai-tutor/topics`)
      .then(setTopics)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : 'Không tải được chủ đề con đã hỏi'),
      );
  }, [childId]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3" aria-label="Lượt hỏi của con">
      <p className="text-content font-semibold text-text">Tháng {Number(currentMonth.slice(5, 7))} của con</p>
      {monthly ? (
        <>
          <p className="text-content text-text">
            Đã dùng {monthly.used_turns} / {monthly.turns} lượt ({monthly.plan_name})
          </p>
          <progress
            className="h-2 w-full"
            max={monthly.turns}
            value={monthly.used_turns}
            aria-label="Lượt đã dùng trong tháng"
          />
        </>
      ) : (
        <p className="text-content text-text-secondary">Con chưa có gói tháng trong tháng này</p>
      )}
      <p className="text-content text-text">Lượt mua thêm còn {topUpRemaining}</p>
      {topics ? (
        <>
          <p className="text-content text-text">Con đã hỏi {topics.turns_this_month} lượt trong tháng</p>
          <p className="text-content text-text">
            Chủ đề nhiều nhất:{' '}
            {topics.top_topics.length > 0 ? topics.top_topics.map((item) => item.topic).join(', ') : 'chưa có'}
          </p>
        </>
      ) : null}
      {errorMessage ? <p className="text-label text-text-secondary">{errorMessage}</p> : null}
    </div>
  );
}
