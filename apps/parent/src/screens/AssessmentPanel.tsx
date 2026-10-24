import { useEffect, useState } from 'react';
import { YEAR_RESULT_LABELS, type YearResultCode } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Kết quả đánh giá của con học Tiểu học (DT-20 phần 20c, YCTD-161): các kỳ nhà trường đã khoá số liệu (mức đạt từng môn,
// điểm bài kiểm tra định kỳ, phẩm chất, năng lực), kết quả cuối năm khi kỳ cuối năm đã khoá, nhận xét thường xuyên
interface ChildAssessment {
  class_name?: string;
  levels: Array<{ scale: string; code: string; name: string }>;
  periods: Array<{
    id: string;
    name: string;
    subjects: Array<{ subject_name: string; level_code: string | null; score: number | null; comment: string | null }>;
    competencies: Array<{ item_name: string; level_code: string | null }>;
  }>;
  year_result: { result: YearResultCode; note: string | null } | null;
  comments: Array<{
    id: string;
    comment_date: string;
    subject_name: string | null;
    content: string;
    author_name: string;
  }>;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export function AssessmentPanel({ child }: { child: { id: string; full_name: string } }) {
  const [data, setData] = useState<ChildAssessment>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    requestJson<ChildAssessment>(`/api/v1/assessment/children/${child.id}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [child.id]);
  const levelName = (scale: string, code: string | null) =>
    code ? (data?.levels.find((level) => level.scale === scale && level.code === code)?.name ?? code) : 'Chưa có';
  return (
    <section className="flex flex-col gap-3" aria-label={`Kết quả đánh giá của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data && data.periods.length === 0 ? (
        <p className="text-content text-text-secondary">Nhà trường chưa công bố kết quả kỳ nào.</p>
      ) : null}
      {data?.year_result ? (
        <p className="text-content font-semibold">Cuối năm: {YEAR_RESULT_LABELS[data.year_result.result]}</p>
      ) : null}
      {data?.periods.map((period) => (
        <div key={period.id} className="flex flex-col gap-1">
          <h3 className="text-content font-semibold">{period.name}</h3>
          <ul className="flex flex-col gap-1 text-content">
            {period.subjects.map((subject) => (
              <li key={subject.subject_name}>
                {subject.subject_name}: {levelName('subject', subject.level_code)}
                {subject.score !== null ? ` · điểm ${subject.score}` : ''}
                {subject.comment ? ` · ${subject.comment}` : ''}
              </li>
            ))}
            {period.competencies.map((item) => (
              <li key={item.item_name} className="text-text-secondary">
                {item.item_name}: {levelName('competency', item.level_code)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {data && data.comments.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-content font-semibold">Nhận xét của thầy cô</h3>
          <ul className="flex flex-col gap-1 text-content">
            {data.comments.map((comment) => (
              <li key={comment.id}>
                {comment.comment_date.split('-').reverse().join('/')}
                {comment.subject_name ? ` · ${comment.subject_name}` : ''}: {comment.content}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
