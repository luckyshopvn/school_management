import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { ApiError } from '../session/api-client.js';
import {
  AI_DRAFT_NOTICE,
  aiStatus,
  draftLessonPlan,
  draftQuestions,
  type LessonPlanDraftInput,
  type QuestionDraftInput,
} from './ai-api.js';

// Nút "Soạn nháp bằng AI" ở ngân hàng câu hỏi (22g1) và kho học liệu (22h1) (DT-23 phần 23d, YCTD-214). Nút chỉ hiện khi trường đã bật AI
// và đủ khóa (máy chủ báo `ready`); tắt hoặc thiếu khóa thì không hiện gì, các màn hình khác chạy như cũ. Giao diện ghi rõ chỉ gửi nội dung
// chương trình, kết quả là bản nháp cần kiểm tra và duyệt
const COGNITIVE = [
  ['recognition', 'Nhận biết'],
  ['comprehension', 'Thông hiểu'],
  ['application', 'Vận dụng'],
  ['high_application', 'Vận dụng cao'],
] as const;
const TYPES = [
  ['multiple_choice', 'Nhiều lựa chọn'],
  ['true_false', 'Đúng sai'],
  ['short_answer', 'Trả lời ngắn'],
  ['essay', 'Tự luận'],
] as const;

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';

export function useAiReady(): boolean {
  const status = useQuery({ queryKey: ['ai-status'], queryFn: aiStatus, retry: false, staleTime: 60_000 });
  return status.data?.ready === true;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-label font-medium text-text">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export interface QuestionScope {
  level: string | undefined;
  subjectId: string;
  grade: string;
}

export function AiQuestionDraftPanel({
  scope,
  topics,
  onDone,
}: {
  scope: QuestionScope;
  topics: Array<{ id: string; name: string }>;
  onDone(message: string): void;
}) {
  const ready = useAiReady();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    topic_id: '',
    cognitive_level: 'recognition',
    question_type: 'multiple_choice',
    count: '3',
    requirement: '',
    extra: '',
  });
  const run = useMutation({
    mutationFn: () => {
      const input: QuestionDraftInput = {
        school_level: scope.level ?? 'THCS',
        subject_id: scope.subjectId,
        grade_level_code: scope.grade,
        topic_id: form.topic_id || null,
        cognitive_level: form.cognitive_level,
        question_type: form.question_type,
        count: Number(form.count),
        requirement: form.requirement.trim() || null,
        extra: form.extra.trim() || null,
      };
      return draftQuestions(input);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      setOpen(false);
      onDone(`Đã soạn ${result.questions.length} câu hỏi nháp do AI soạn; kiểm tra, sửa rồi gửi thẩm định`);
    },
  });
  if (!ready) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Soạn nháp bằng AI">
      {!open ? (
        <div>
          <Button onClick={() => setOpen(true)}>Soạn nháp bằng AI</Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-lg bg-card p-4"
          aria-label="Soạn câu hỏi nháp bằng AI"
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate();
          }}
        >
          <h2 className="text-section-title font-semibold text-text">Soạn câu hỏi nháp bằng AI</h2>
          <Alert tone="info">{AI_DRAFT_NOTICE}</Alert>
          {run.error ? <Alert tone="danger">{messageOf(run.error)}</Alert> : null}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Chủ đề">
              <select
                aria-label="Chủ đề cần soạn"
                className={FORM_CONTROL_CLASS}
                value={form.topic_id}
                onChange={(event) => setForm({ ...form, topic_id: event.target.value })}
              >
                <option value="">Không chọn</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mức nhận thức">
              <select
                aria-label="Mức nhận thức cần soạn"
                className={FORM_CONTROL_CLASS}
                value={form.cognitive_level}
                onChange={(event) => setForm({ ...form, cognitive_level: event.target.value })}
              >
                {COGNITIVE.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dạng câu hỏi">
              <select
                aria-label="Dạng câu hỏi cần soạn"
                className={FORM_CONTROL_CLASS}
                value={form.question_type}
                onChange={(event) => setForm({ ...form, question_type: event.target.value })}
              >
                {TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số câu (1 đến 10)">
              <input
                aria-label="Số câu cần soạn"
                className={`w-24 ${FORM_CONTROL_CLASS}`}
                inputMode="numeric"
                value={form.count}
                onChange={(event) => setForm({ ...form, count: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Yêu cầu cần đạt">
            <textarea
              aria-label="Yêu cầu cần đạt"
              className={`w-full ${FORM_CONTROL_CLASS}`}
              rows={2}
              maxLength={1000}
              value={form.requirement}
              onChange={(event) => setForm({ ...form, requirement: event.target.value })}
            />
          </Field>
          <Field label="Mô tả thêm (không nhập thông tin cá nhân)">
            <textarea
              aria-label="Mô tả thêm cho AI"
              className={`w-full ${FORM_CONTROL_CLASS}`}
              rows={2}
              maxLength={500}
              value={form.extra}
              onChange={(event) => setForm({ ...form, extra: event.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={run.isPending}>
              {run.isPending ? 'Đang soạn…' : 'Soạn nháp'}
            </Button>
            <Button onClick={() => setOpen(false)}>Đóng</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export interface LessonScope {
  subjects: Array<{ code: string; name: string; school_level: string }>;
  grades: Array<{ code: string; name: string; school_level: string }>;
}

export function AiLessonPlanPanel({
  scope,
  onDone,
}: {
  scope: LessonScope;
  onDone(id: string, message: string): void;
}) {
  const ready = useAiReady();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const levels = [...new Set(scope.subjects.map((subject) => subject.school_level))].filter((level) => level !== 'MN');
  const [form, setForm] = useState({
    school_level: '',
    grade_level_code: '',
    subject_code: '',
    topic_text: '',
    duration_minutes: '45',
    requirement: '',
    extra: '',
  });
  const level = form.school_level || levels[0] || '';
  const run = useMutation({
    mutationFn: () => {
      const input: LessonPlanDraftInput = {
        school_level: level,
        subject_code: form.subject_code,
        grade_level_code: form.grade_level_code,
        topic_text: form.topic_text.trim(),
        duration_minutes: Number(form.duration_minutes),
        requirement: form.requirement.trim() || null,
        extra: form.extra.trim() || null,
      };
      return draftLessonPlan(input);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['resources'] });
      await queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      setOpen(false);
      onDone(result.resource.id, `Đã soạn kế hoạch bài dạy nháp "${result.resource.title}" (do AI soạn, riêng tư)`);
    },
  });
  if (!ready) {
    return null;
  }
  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>Soạn nháp bằng AI</Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-card p-4"
      aria-label="Soạn kế hoạch bài dạy nháp bằng AI"
      onSubmit={(event) => {
        event.preventDefault();
        run.mutate();
      }}
    >
      <h3 className="text-section-title font-semibold text-text">Soạn kế hoạch bài dạy nháp bằng AI</h3>
      <Alert tone="info">{AI_DRAFT_NOTICE}</Alert>
      {run.error ? <Alert tone="danger">{messageOf(run.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        {levels.length > 1 ? (
          <Field label="Cấp học">
            <select
              aria-label="Cấp học của bài"
              className={FORM_CONTROL_CLASS}
              value={level}
              onChange={(event) =>
                setForm({ ...form, school_level: event.target.value, subject_code: '', grade_level_code: '' })
              }
            >
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Môn">
          <select
            aria-label="Môn của bài"
            className={FORM_CONTROL_CLASS}
            value={form.subject_code}
            onChange={(event) => setForm({ ...form, subject_code: event.target.value })}
          >
            <option value="">Chọn môn</option>
            {scope.subjects
              .filter((subject) => subject.school_level === level)
              .map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Khối">
          <select
            aria-label="Khối của bài"
            className={FORM_CONTROL_CLASS}
            value={form.grade_level_code}
            onChange={(event) => setForm({ ...form, grade_level_code: event.target.value })}
          >
            <option value="">Chọn khối</option>
            {scope.grades
              .filter((grade) => grade.school_level === level)
              .map((grade) => (
                <option key={grade.code} value={grade.code}>
                  {grade.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Thời lượng (phút)">
          <input
            aria-label="Thời lượng của bài"
            className={`w-24 ${FORM_CONTROL_CLASS}`}
            inputMode="numeric"
            value={form.duration_minutes}
            onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Tên bài hoặc chủ đề">
        <input
          aria-label="Tên bài hoặc chủ đề"
          className={`w-full ${FORM_CONTROL_CLASS}`}
          maxLength={200}
          value={form.topic_text}
          onChange={(event) => setForm({ ...form, topic_text: event.target.value })}
        />
      </Field>
      <Field label="Yêu cầu cần đạt">
        <textarea
          aria-label="Yêu cầu cần đạt của bài"
          className={`w-full ${FORM_CONTROL_CLASS}`}
          rows={2}
          maxLength={1000}
          value={form.requirement}
          onChange={(event) => setForm({ ...form, requirement: event.target.value })}
        />
      </Field>
      <Field label="Mô tả thêm (không nhập thông tin cá nhân)">
        <textarea
          aria-label="Mô tả thêm cho AI về bài"
          className={`w-full ${FORM_CONTROL_CLASS}`}
          rows={2}
          maxLength={500}
          value={form.extra}
          onChange={(event) => setForm({ ...form, extra: event.target.value })}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={run.isPending || !form.subject_code || !form.grade_level_code || !form.topic_text.trim()}
        >
          {run.isPending ? 'Đang soạn…' : 'Soạn nháp'}
        </Button>
        <Button onClick={() => setOpen(false)}>Đóng</Button>
      </div>
    </form>
  );
}
