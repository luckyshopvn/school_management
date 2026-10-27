import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';
import { messageOf } from './TutoringProgramsPage.js';

// Hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255): hàng chờ câu hỏi của chương trình mình dạy (câu chưa trả lời, câu
// học sinh báo chưa hiểu), thời hạn trả lời theo chương trình; "Gợi ý bằng AI" cho bản nháp chỉ giáo viên thấy, giáo viên sửa rồi mới
// gửi, câu gửi từ bản nháp mang dấu "có AI hỗ trợ". Hỏi, hỏi thêm, xác nhận câu trả lời, báo cáo là của bộ máy hỏi đáp 28e
interface QueueView {
  programs: Array<{ program_id: string; program_name: string; answer_hours: number }>;
  questions: Array<{
    id: string;
    program_name: string;
    title: string;
    author_name: string;
    due_at: string;
    overdue: boolean;
    reason: 'unanswered' | 'not_understood';
  }>;
}

interface QuestionView {
  id: string;
  program_name: string;
  title: string;
  body: string;
  author_name: string;
  ai_available: boolean;
  posts: Array<{ id: string; body: string; author_name: string; hidden: boolean; ai_assisted: boolean }>;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function QuestionAnswer({ id, onSent }: { id: string; onSent: () => void }) {
  const view = useQuery({
    queryKey: ['tutoring-question', id],
    queryFn: () => requestJson<QuestionView>(`/api/v1/tutoring/questions/${id}`),
  });
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<{ request_id: string; notice: string }>();
  const suggest = useMutation({
    mutationFn: () =>
      requestJson<{ request_id: string; answer: string; notice: string }>(
        `/api/v1/tutoring/questions/${id}/ai-draft`,
        json('POST', {}),
      ),
    onSuccess: (result) => {
      setText(result.answer);
      setDraft({ request_id: result.request_id, notice: result.notice });
    },
  });
  const send = useMutation({
    mutationFn: () =>
      requestJson(
        `/api/v1/tutoring/questions/${id}/answer`,
        json('POST', { body: text, ...(draft ? { ai_request_id: draft.request_id } : {}) }),
      ),
    onSuccess: () => {
      setText('');
      setDraft(undefined);
      onSent();
    },
  });
  if (!view.data) {
    return view.error ? <Alert tone="danger">{messageOf(view.error)}</Alert> : null;
  }
  return (
    <section aria-label={`Trả lời câu hỏi ${view.data.title}`} className="flex flex-col gap-2 rounded-lg border p-3">
      <h4 className="font-semibold">{view.data.title}</h4>
      <p className="text-label text-text-secondary">
        {view.data.author_name} · {view.data.program_name}
      </p>
      <p className="whitespace-pre-wrap">{view.data.body}</p>
      <ul className="flex flex-col gap-1 text-label">
        {view.data.posts.map((post) => (
          <li key={post.id}>
            <strong>{post.author_name}:</strong> {post.body}
            {post.ai_assisted ? <span className="text-text-secondary"> (có AI hỗ trợ)</span> : null}
            {post.hidden ? <span className="text-text-secondary"> (đã ẩn)</span> : null}
          </li>
        ))}
      </ul>
      {suggest.error ? <Alert tone="danger">{messageOf(suggest.error)}</Alert> : null}
      {send.error ? <Alert tone="danger">{messageOf(send.error)}</Alert> : null}
      {draft ? <Alert tone="warning">{draft.notice} Bản nháp chỉ bạn thấy cho đến khi bạn gửi.</Alert> : null}
      <label className="flex flex-col text-label">
        Câu trả lời
        <textarea
          className={FORM_CONTROL_CLASS}
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {view.data.ai_available ? (
          <Button onClick={() => suggest.mutate()} disabled={suggest.isPending}>
            Gợi ý bằng AI
          </Button>
        ) : null}
        <Button onClick={() => send.mutate()} disabled={send.isPending || text.trim() === ''}>
          Gửi câu trả lời
        </Button>
      </div>
    </section>
  );
}

export function TutoringQuestionsPanel({ notify }: { notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const queue = useQuery({
    queryKey: ['tutoring-questions'],
    queryFn: () => requestJson<QueueView>('/api/v1/tutoring/questions'),
    retry: false,
  });
  const [open, setOpen] = useState<string>();
  const [hours, setHours] = useState<Record<string, string>>({});
  const saveHours = useMutation({
    mutationFn: ({ programId, value }: { programId: string; value: number }) =>
      requestJson(`/api/v1/tutoring/programs/${programId}/answer-hours`, json('PUT', { answer_hours: value })),
    onSuccess: async () => {
      notify('Đã lưu thời hạn trả lời');
      await queryClient.invalidateQueries({ queryKey: ['tutoring-questions'] });
    },
  });
  if (!queue.data || queue.data.programs.length === 0) {
    return null;
  }
  return (
    <section aria-label="Hỏi đáp bài tập" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Hỏi đáp bài tập</h2>
      {saveHours.error ? <Alert tone="danger">{messageOf(saveHours.error)}</Alert> : null}
      <ul className="flex flex-col gap-1 text-label">
        {queue.data.programs.map((program) => (
          <li key={program.program_id} className="flex flex-wrap items-center gap-2">
            <span>{program.program_name}: trả lời trong</span>
            <input
              aria-label={`Thời hạn trả lời (giờ) của ${program.program_name}`}
              className={`${FORM_CONTROL_CLASS} w-24`}
              type="number"
              min={1}
              max={336}
              step={1}
              value={hours[program.program_id] ?? String(program.answer_hours)}
              onChange={(event) => setHours({ ...hours, [program.program_id]: event.target.value })}
            />
            <span>giờ</span>
            <Button
              onClick={() =>
                saveHours.mutate({
                  programId: program.program_id,
                  value: Number(hours[program.program_id] ?? program.answer_hours),
                })
              }
            >
              Lưu thời hạn
            </Button>
          </li>
        ))}
      </ul>
      {queue.data.questions.length === 0 ? (
        <p className="text-label text-text-secondary">Không có câu hỏi đang chờ.</p>
      ) : (
        <table aria-label="Câu hỏi đang chờ" className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th>Câu hỏi</th>
              <th>Học sinh</th>
              <th>Chương trình</th>
              <th>Hạn trả lời</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.data.questions.map((question) => (
              <tr key={question.id}>
                <td>
                  {question.title}
                  {question.reason === 'not_understood' ? ' (em báo chưa hiểu)' : ''}
                </td>
                <td>{question.author_name}</td>
                <td>{question.program_name}</td>
                <td>
                  {new Date(question.due_at).toLocaleString('vi-VN')}
                  {question.overdue ? ' (quá hạn)' : ''}
                </td>
                <td>
                  <Button onClick={() => setOpen(open === question.id ? undefined : question.id)}>
                    Trả lời {question.title}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open ? (
        <QuestionAnswer
          key={open}
          id={open}
          onSent={() => {
            notify('Đã gửi câu trả lời');
            setOpen(undefined);
            void queryClient.invalidateQueries({ queryKey: ['tutoring-questions'] });
          }}
        />
      ) : null}
    </section>
  );
}
