import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, TextField } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// MP-17 Bình chọn, biểu quyết, khảo sát (P15-03 đến P15-06; BR-66, BR-67, BR-68; YCTD-79): phụ huynh thấy các bình chọn
// đang mở dành cho mình ngay ở trang chủ, gửi phiếu một lần, xem kết quả khi nhà trường công bố, bình luận và thích
type AnswerType = 'single_choice' | 'multiple_choice' | 'text' | 'rating';

interface PollSummary {
  id: string;
  poll_type: 'poll' | 'vote' | 'survey';
  title: string;
  end_at: string;
  is_open_now: boolean;
  has_responded: boolean;
  can_respond: boolean;
  results_published_at: string | null;
}

interface PollDetail extends PollSummary {
  description: string | null;
  like_count: number;
  liked_by_me: boolean;
  questions: Array<{
    id: string;
    question_text: string;
    answer_type: AnswerType;
    is_required: boolean;
    options: Array<{ id: string; label: string }>;
  }>;
}

interface Results {
  response_count: number;
  questions: Array<{
    id: string;
    question_text: string;
    options: Array<{ id: string; label: string; count: number }>;
    average: number | null;
  }>;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  is_hidden: boolean;
  like_count: number;
  liked_by_me: boolean;
}

interface Answer {
  option_ids: string[];
  text: string;
  number: string;
}

const TYPE_LABELS = { poll: 'Bình chọn', vote: 'Biểu quyết', survey: 'Khảo sát' };

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join(': ')
    : 'Không kết nối được tới máy chủ';
}

const post = <Result,>(path: string, body: unknown) =>
  requestJson<Result>(path, { method: 'POST', body: JSON.stringify(body) });

function PollCard({ summary, onChanged }: { summary: PollSummary; onChanged(): void }) {
  const [detail, setDetail] = useState<PollDetail>();
  const [results, setResults] = useState<Results>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<{ text: string; failed: boolean }>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pollDetail, commentRows] = await Promise.all([
        requestJson<PollDetail>(`/api/v1/polls/${summary.id}`),
        requestJson<Comment[]>(`/api/v1/interaction-comments?target_type=poll&target_id=${summary.id}`),
      ]);
      setDetail(pollDetail);
      setComments(commentRows);
      if (pollDetail.results_published_at) {
        setResults(await requestJson<Results>(`/api/v1/polls/${summary.id}/results`));
      }
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    }
  }, [summary.id]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      setNotice({ text: success, failed: false });
      await load();
      onChanged();
    } catch (error) {
      setNotice({ text: messageOf(error), failed: true });
    } finally {
      setBusy(false);
    }
  };

  const answerOf = (questionId: string): Answer => answers[questionId] ?? { option_ids: [], text: '', number: '' };
  const setAnswer = (questionId: string, change: Partial<Answer>) =>
    setAnswers((current) => ({ ...current, [questionId]: { ...answerOf(questionId), ...change } }));

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label={summary.title}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-content font-semibold">
          {TYPE_LABELS[summary.poll_type]}: {summary.title}
        </span>
        <Button variant="text" onClick={() => (detail ? setDetail(undefined) : void load())}>
          {detail ? 'Thu gọn' : summary.has_responded ? 'Xem' : 'Trả lời'}
        </Button>
      </div>
      <span className="text-label text-text-secondary">
        Hạn: {new Date(summary.end_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
        {summary.has_responded ? ' · Đã gửi phiếu' : ''}
      </span>
      {notice ? <Alert tone={notice.failed ? 'danger' : 'success'}>{notice.text}</Alert> : null}
      {detail ? (
        <div className="flex flex-col gap-3">
          {detail.description ? <p className="text-content">{detail.description}</p> : null}
          {detail.can_respond
            ? detail.questions.map((question) => (
                <fieldset key={question.id} className="flex flex-col gap-1">
                  <legend className="text-content font-medium">
                    {question.question_text}
                    {question.is_required ? ' *' : ''}
                  </legend>
                  {question.answer_type === 'single_choice' || question.answer_type === 'multiple_choice'
                    ? question.options.map((option) => (
                        <label key={option.id} className="flex items-center gap-2 text-content">
                          <input
                            type={question.answer_type === 'single_choice' ? 'radio' : 'checkbox'}
                            name={question.id}
                            checked={answerOf(question.id).option_ids.includes(option.id)}
                            onChange={(event) => {
                              const current = answerOf(question.id).option_ids;
                              setAnswer(question.id, {
                                option_ids:
                                  question.answer_type === 'single_choice'
                                    ? [option.id]
                                    : event.target.checked
                                      ? [...current, option.id]
                                      : current.filter((id) => id !== option.id),
                              });
                            }}
                          />
                          {option.label}
                        </label>
                      ))
                    : null}
                  {question.answer_type === 'text' ? (
                    <TextField
                      label="Câu trả lời"
                      value={answerOf(question.id).text}
                      onChange={(event) => setAnswer(question.id, { text: event.target.value })}
                    />
                  ) : null}
                  {question.answer_type === 'rating' ? (
                    <TextField
                      label="Điểm từ 1 đến 5"
                      type="number"
                      value={answerOf(question.id).number}
                      onChange={(event) => setAnswer(question.id, { number: event.target.value })}
                    />
                  ) : null}
                </fieldset>
              ))
            : null}
          {detail.can_respond ? (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    post(`/api/v1/polls/${detail.id}/responses`, {
                      answers: detail.questions.map((question) => {
                        const answer = answerOf(question.id);
                        return {
                          question_id: question.id,
                          option_ids: answer.option_ids,
                          text: answer.text || undefined,
                          number: answer.number === '' ? undefined : Number(answer.number),
                        };
                      }),
                    }),
                  'Đã gửi phiếu',
                )
              }
            >
              Gửi phiếu
            </Button>
          ) : null}
          {results ? (
            <section aria-label="Kết quả" className="flex flex-col gap-1 text-content">
              <span className="font-medium">Kết quả ({results.response_count} phiếu)</span>
              {results.questions.map((question) => (
                <div key={question.id}>
                  <span>{question.question_text}</span>
                  <ul>
                    {question.options.map((option) => (
                      <li key={option.id}>
                        {option.label}: {option.count}
                      </li>
                    ))}
                    {question.average !== null ? <li>Điểm trung bình: {question.average}</li> : null}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              variant="text"
              onClick={() =>
                void run(
                  () => post('/api/v1/interaction-likes', { target_type: 'poll', target_id: detail.id }),
                  'Đã cập nhật lượt thích',
                )
              }
            >
              {detail.liked_by_me ? 'Bỏ thích' : 'Thích'} ({detail.like_count})
            </Button>
          </div>
          <section aria-label="Bình luận" className="flex flex-col gap-1">
            <ul className="flex flex-col gap-1 text-content">
              {comments.map((row) => (
                <li key={row.id}>
                  <span className="font-medium">{row.author_name}</span>: {row.content}
                  {row.is_hidden ? ' (đã bị ẩn)' : ''}
                </li>
              ))}
            </ul>
            <TextField label="Bình luận" value={comment} onChange={(event) => setComment(event.target.value)} />
            <Button
              disabled={busy || comment.trim() === ''}
              onClick={() =>
                void run(async () => {
                  await post('/api/v1/interaction-comments', {
                    target_type: 'poll',
                    target_id: detail.id,
                    content: comment,
                  });
                  setComment('');
                }, 'Đã gửi bình luận')
              }
            >
              Gửi bình luận
            </Button>
          </section>
        </div>
      ) : null}
    </li>
  );
}

export function PollsPanel() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const rows = await requestJson<PollSummary[]>('/api/v1/polls?open=true');
      if (request === latestRequest.current) {
        setPolls(rows);
      }
    } catch {
      // Không có bình chọn thì không hiện mục này
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (polls.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Bình chọn và khảo sát">
      <h2 className="text-section-title font-semibold text-text">Bình chọn và khảo sát đang mở</h2>
      <ul className="flex flex-col gap-2">
        {polls.map((poll) => (
          <PollCard key={poll.id} summary={poll} onChanged={() => void load()} />
        ))}
      </ul>
    </section>
  );
}
