import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Hỏi đáp bài tập của con ở các chương trình gia sư (DT-27 phần 27e, YCTD-255): cha mẹ xem câu hỏi, câu trả lời (dấu "có AI hỗ trợ"),
// con đã hiểu chưa; bật tắt việc giáo viên dùng trợ lý AI gợi ý câu trả lời cho câu hỏi của con (mặc định cho phép)
export interface TutoringQuestion {
  id: string;
  program_name: string;
  title: string;
  body: string;
  understood: boolean | null;
  posts: Array<{ id: string; body: string; author_name: string; author_kind: string; ai_assisted: boolean }>;
}

export function QuestionList({ questions }: { questions: TutoringQuestion[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {questions.map((question) => (
        <li key={question.id} className="flex flex-col gap-1 rounded-lg border p-2 text-label">
          <strong>
            {question.title} ({question.program_name})
          </strong>
          <span className="whitespace-pre-wrap">{question.body}</span>
          {question.posts.length === 0 ? <span className="text-text-secondary">Chưa có câu trả lời.</span> : null}
          {question.posts.map((post) => (
            <span key={post.id}>
              {post.author_name}: {post.body}
              {post.ai_assisted ? <span className="text-text-secondary"> (có AI hỗ trợ)</span> : null}
            </span>
          ))}
          {question.understood === true ? <span className="text-text-secondary">Đã hiểu</span> : null}
          {question.understood === false ? <span className="text-text-secondary">Còn chưa hiểu</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function ChildTutoringQuestions({ childId }: { childId: string }) {
  const [view, setView] = useState<{ questions: TutoringQuestion[]; ai_allowed: boolean }>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(() => {
    requestJson<{ questions: TutoringQuestion[]; ai_allowed: boolean }>(
      `/api/v1/children/${childId}/tutoring/questions`,
    )
      .then(setView)
      .catch(() => setView(undefined));
  }, [childId]);
  useEffect(load, [load]);
  if (!view) {
    return null;
  }
  return (
    <section aria-label="Hỏi đáp bài tập của con" className="flex flex-col gap-2">
      <h3 className="text-content font-semibold">Hỏi đáp bài tập</h3>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <label className="flex items-center gap-2 text-label">
        <input
          type="checkbox"
          checked={view.ai_allowed}
          onChange={(event) => {
            const allowed = event.target.checked;
            setView({ ...view, ai_allowed: allowed });
            requestJson(`/api/v1/children/${childId}/tutoring/ai-consent`, {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ allowed }),
            })
              .then(() => setErrorMessage(undefined))
              .catch((error: unknown) => {
                setView({ ...view, ai_allowed: !allowed });
                setErrorMessage(error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');
              });
          }}
        />
        Cho phép giáo viên dùng trợ lý AI gợi ý câu trả lời (chỉ gửi chữ của câu hỏi, không gửi ảnh, tên của con)
      </label>
      {view.questions.length === 0 ? (
        <p className="text-label text-text-secondary">Con chưa gửi câu hỏi nào.</p>
      ) : (
        <QuestionList questions={view.questions} />
      )}
    </section>
  );
}
