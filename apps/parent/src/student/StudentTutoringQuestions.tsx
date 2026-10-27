import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { requestStudentJson, StudentApiError } from './student-api.js';

// Hỏi đáp bài tập ở khoá gia sư (DT-27 phần 27e, YCTD-255; kênh student): em hỏi giáo viên của chương trình (qua bộ máy hỏi đáp 28e
// ở khoá học ghi sẵn), xem câu trả lời (dấu "có AI hỗ trợ"), báo đã hiểu hoặc chưa hiểu (chưa hiểu thì câu trở lại hàng chờ của giáo
// viên); hỏi thêm bằng câu hỏi mới
interface Question {
  id: string;
  program_name: string;
  title: string;
  body: string;
  understood: boolean | null;
  posts: Array<{ id: string; body: string; author_name: string; author_kind: string; ai_assisted: boolean }>;
}

interface Course {
  program_id: string;
  program_name: string;
  course: { id: string; title: string } | null;
}

const post = (path: string, body: unknown) =>
  requestStudentJson(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export function StudentTutoringQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ space_id: '', title: '', body: '' });
  const [errorMessage, setErrorMessage] = useState<string>();
  const load = useCallback(() => {
    requestStudentJson<{ questions: Question[] }>('/api/v1/student/tutoring/questions')
      .then((view) => setQuestions(view.questions))
      .catch(() => setQuestions([]));
    requestStudentJson<Course[]>('/api/v1/student/tutoring/courses')
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);
  useEffect(load, [load]);
  const withCourse = courses.filter((row) => row.course !== null);
  if (withCourse.length === 0 && questions.length === 0) {
    return null;
  }
  const run = (work: Promise<unknown>) =>
    work
      .then(() => {
        setErrorMessage(undefined);
        load();
      })
      .catch((error: unknown) =>
        setErrorMessage(error instanceof StudentApiError ? error.message : 'Không kết nối được tới máy chủ'),
      );
  const spaceId = form.space_id || withCourse[0]?.course?.id || '';
  return (
    <section aria-label="Hỏi đáp bài tập" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Hỏi đáp bài tập</h2>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {withCourse.length > 0 ? (
        <form
          aria-label="Gửi câu hỏi cho giáo viên"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              post(`/api/v1/student/discussions/spaces/${spaceId}/threads`, {
                kind: 'question',
                title: form.title,
                body: form.body,
              }).then(() => setForm({ space_id: form.space_id, title: '', body: '' })),
            );
          }}
        >
          <label className="flex flex-col text-label">
            Khoá học
            <select
              className={FORM_CONTROL_CLASS}
              value={spaceId}
              onChange={(event) => setForm({ ...form, space_id: event.target.value })}
            >
              {withCourse.map((row) => (
                <option key={row.program_id} value={row.course?.id}>
                  {row.program_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-label">
            Câu hỏi ngắn
            <input
              className={FORM_CONTROL_CLASS}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Em chưa hiểu chỗ nào
            <textarea
              className={FORM_CONTROL_CLASS}
              rows={3}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </label>
          <Button type="submit" disabled={form.title.trim() === '' || form.body.trim() === ''}>
            Gửi câu hỏi
          </Button>
        </form>
      ) : null}
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li key={question.id} className="flex flex-col gap-1 rounded-lg border p-2 text-label">
            <strong>
              {question.title} ({question.program_name})
            </strong>
            <span className="whitespace-pre-wrap">{question.body}</span>
            {question.posts.length === 0 ? (
              <span className="text-text-secondary">Đang chờ giáo viên trả lời.</span>
            ) : null}
            {question.posts.map((item) => (
              <span key={item.id}>
                {item.author_name}: {item.body}
                {item.ai_assisted ? <span className="text-text-secondary"> (có AI hỗ trợ)</span> : null}
              </span>
            ))}
            {question.posts.some((item) => item.author_kind === 'teacher') ? (
              <div className="flex flex-wrap items-center gap-2">
                {question.understood === true ? <span>Em đã hiểu</span> : null}
                {question.understood === false ? <span>Em báo chưa hiểu, chờ giáo viên giải thích thêm</span> : null}
                <Button
                  onClick={() =>
                    void run(post(`/api/v1/student/tutoring/questions/${question.id}/understood`, { understood: true }))
                  }
                >
                  Em đã hiểu: {question.title}
                </Button>
                <Button
                  onClick={() =>
                    void run(
                      post(`/api/v1/student/tutoring/questions/${question.id}/understood`, { understood: false }),
                    )
                  }
                >
                  Em chưa hiểu: {question.title}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
