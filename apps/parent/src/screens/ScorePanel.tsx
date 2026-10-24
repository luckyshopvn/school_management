import { useEffect, useState } from 'react';
import { RATING_LABELS, SCORE_TERM_LABELS, SUBJECT_PASS_LABELS, type RatingCode } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Điểm của con học THCS, THPT (DT-21 phần 21c, YCTD-170): các học kỳ nhà trường đã khoá điểm (điểm từng môn, trung bình,
// xếp loại học tập, rèn luyện); xếp loại cả năm khi học kỳ II đã khoá
interface Rating {
  learning: RatingCode | null;
  conduct: RatingCode | null;
  comment: string | null;
}

interface ChildScores {
  class_name?: string;
  terms: Array<{
    term_type: 'first_term' | 'second_term';
    subjects: Array<{
      subject_name: string;
      mode: 'score' | 'comment';
      regular: number[];
      mid: number | null;
      final: number | null;
      average: number | null;
      result: 'pass' | 'fail' | null;
      comment: string | null;
    }>;
    rating: Rating | null;
  }>;
  year_rating?: Rating | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

const ratingText = (rating: Rating | null | undefined) =>
  rating
    ? `Học tập: ${rating.learning ? RATING_LABELS[rating.learning] : 'Chưa xếp loại'}; rèn luyện: ${
        rating.conduct ? RATING_LABELS[rating.conduct] : 'Chưa xếp loại'
      }`
    : 'Chưa xếp loại';

export function ScorePanel({ child }: { child: { id: string; full_name: string } }) {
  const [data, setData] = useState<ChildScores>();
  const [errorMessage, setErrorMessage] = useState<string>();
  useEffect(() => {
    requestJson<ChildScores>(`/api/v1/scores/children/${child.id}`)
      .then(setData)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  }, [child.id]);
  return (
    <section className="flex flex-col gap-3" aria-label={`Điểm của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {data && data.terms.length === 0 ? (
        <p className="text-content text-text-secondary">Nhà trường chưa công bố điểm học kỳ nào.</p>
      ) : null}
      {data?.year_rating ? <p className="text-content font-semibold">Cả năm: {ratingText(data.year_rating)}</p> : null}
      {data?.terms.map((term) => (
        <article key={term.term_type} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          <h3 className="text-content font-semibold">{SCORE_TERM_LABELS[term.term_type]}</h3>
          <p className="text-label">{ratingText(term.rating)}</p>
          <ul className="flex flex-col gap-1">
            {term.subjects.map((subject) => (
              <li key={subject.subject_name} className="text-label">
                <span className="font-medium">{subject.subject_name}</span>:{' '}
                {subject.mode === 'score'
                  ? `${subject.regular.length > 0 ? `TX ${subject.regular.join(', ')}` : 'chưa có TX'}; giữa kỳ ${
                      subject.mid ?? '-'
                    }; cuối kỳ ${subject.final ?? '-'}; trung bình ${subject.average ?? '-'}`
                  : subject.result
                    ? SUBJECT_PASS_LABELS[subject.result]
                    : 'Chưa có'}
                {subject.comment ? ` (${subject.comment})` : ''}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
