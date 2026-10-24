import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { fetchCurrentUser } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, NO_LEVEL_MESSAGE, ScopeFilters, useExamScope } from './exam-filters.js';
import {
  COGNITIVE_LABELS,
  createExam,
  downloadFile,
  examAction,
  EXAM_STATUS_LABELS,
  listExams,
  listMatrices,
  listPlans,
  listQuestions,
  listStaff,
  QUESTION_TYPE_LABELS,
  readExam,
  removeExamQuestion,
} from './exams-api.js';

// 8.4 Đề kiểm tra (DT-21 phần 22g1, YCTD-168): người quản lý giao đề (kế hoạch, ma trận, người ra đề, người thẩm định, hạn
// nộp, số mã đề); người ra đề bốc câu theo ma trận, thêm, bỏ câu, trộn mã đề, gửi thẩm định; người thẩm định duyệt hoặc trả
// lại; người quản lý khoá, mở khoá có lý do; tải đề từng mã, đáp án ra Word, PDF. Đề chỉ người được giao và người quản lý thấy
function ExamDetail({ examId, onMessage }: { examId: string; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const userId = currentUser.data?.id ?? '';
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const exam = useQuery({ queryKey: ['exam', examId], queryFn: () => readExam(examId) });
  const data = exam.data;
  const isAuthor = data?.author_user_id === userId && data.status === 'draft';
  const essays = useQuery({
    queryKey: ['questions', data?.subject_id, data?.grade_level_code, 'approved'],
    queryFn: () =>
      listQuestions({ subject_id: data?.subject_id, grade_level_code: data?.grade_level_code, status: 'approved' }),
    enabled: Boolean(data && isAuthor),
  });
  const act = useMutation({
    mutationFn: (input: { action: Parameters<typeof examAction>[1]; body?: unknown; message: string }) =>
      examAction(examId, input.action, input.body),
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      onMessage(input.message);
    },
  });
  const remove = useMutation({
    mutationFn: (questionId: string) => removeExamQuestion(examId, questionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      onMessage('Đã bỏ câu khỏi đề');
    },
  });
  const [extra, setExtra] = useState('');
  const [code, setCode] = useState('');
  if (!data) {
    return exam.error ? <Alert tone="danger">{messageOf(exam.error)}</Alert> : null;
  }
  const canReview = data.status === 'submitted' && (data.reviewer_user_id === userId || manager);
  const download = (part: 'paper' | 'answers', format: 'pdf' | 'docx') =>
    void downloadFile(
      `/api/v1/exams/${examId}/export?part=${part}&format=${format}${part === 'paper' ? `&code=${code || data.variants[0]?.code}` : ''}`,
      `${part === 'paper' ? `de-${code || data.variants[0]?.code}` : 'dap-an'}.${format}`,
    );
  return (
    <section className="flex flex-col gap-3" aria-label={`Đề ${data.title}`}>
      <h2 className="text-section-title font-semibold text-text">
        {data.title} · {EXAM_STATUS_LABELS[data.status]}
      </h2>
      <p className="text-content text-text">
        {data.subject_name} {data.grade_level_code}, {data.duration_minutes} phút; ra đề: {data.author_name}; thẩm định:{' '}
        {data.reviewer_name ?? 'chưa giao'}; ma trận: {data.matrix?.name ?? 'chưa chọn'}; tổng điểm {data.total_score}
      </p>
      {data.review_note ? <Alert tone="warning">Thẩm định: {data.review_note}</Alert> : null}
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {isAuthor ? (
          <>
            <Button onClick={() => act.mutate({ action: 'generate', message: 'Đã bốc câu theo ma trận' })}>
              Bốc câu theo ma trận
            </Button>
            <Button onClick={() => act.mutate({ action: 'variants', message: 'Đã trộn mã đề' })}>Trộn mã đề</Button>
            <Button variant="primary" onClick={() => act.mutate({ action: 'submit', message: 'Đã gửi thẩm định đề' })}>
              Gửi thẩm định
            </Button>
          </>
        ) : null}
        {canReview ? (
          <>
            <Button
              variant="primary"
              onClick={() =>
                act.mutate({ action: 'review', body: { decision: 'approve' }, message: 'Đã thẩm định đề' })
              }
            >
              Duyệt đề
            </Button>
            <Button
              onClick={() => {
                const note = window.prompt('Lý do trả lại');
                if (note)
                  act.mutate({ action: 'review', body: { decision: 'return', note }, message: 'Đã trả lại đề' });
              }}
            >
              Trả lại
            </Button>
          </>
        ) : null}
        {manager && data.status === 'approved' ? (
          <Button variant="primary" onClick={() => act.mutate({ action: 'lock', message: 'Đã khoá đề' })}>
            Khoá đề
          </Button>
        ) : null}
        {manager && data.status === 'locked' ? (
          <Button
            onClick={() => {
              const reason = window.prompt('Lý do mở khoá');
              if (reason) act.mutate({ action: 'unlock', body: { reason }, message: 'Đã mở khoá đề' });
            }}
          >
            Mở khoá
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Câu của đề">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Thứ tự</th>
              <th className="px-3 py-2">Nội dung</th>
              <th className="px-3 py-2">Mức</th>
              <th className="px-3 py-2">Dạng</th>
              <th className="px-3 py-2">Điểm</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.questions.map((question) => (
              <tr key={question.question_id} className="border-t border-border">
                <td className="px-3 py-2">{question.order_no}</td>
                <td className="px-3 py-2">{question.snapshot.content}</td>
                <td className="px-3 py-2">{COGNITIVE_LABELS[question.snapshot.cognitive_level]}</td>
                <td className="px-3 py-2">{QUESTION_TYPE_LABELS[question.snapshot.question_type]}</td>
                <td className="px-3 py-2">{question.score}</td>
                <td className="px-3 py-2 text-right">
                  {isAuthor ? (
                    <Button variant="text" onClick={() => remove.mutate(question.question_id)}>
                      Bỏ
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAuthor ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-label font-medium text-text">
            Thêm câu đã duyệt
            <select
              aria-label="Thêm câu đã duyệt"
              className={`mt-2 block max-w-xl ${FORM_CONTROL_CLASS}`}
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
            >
              <option value="">Chọn câu</option>
              {(essays.data ?? [])
                .filter((question) => !data.questions.some((row) => row.question_id === question.id))
                .map((question) => (
                  <option key={question.id} value={question.id}>
                    {QUESTION_TYPE_LABELS[question.question_type]}: {question.content.slice(0, 80)}
                  </option>
                ))}
            </select>
          </label>
          <Button
            disabled={!extra}
            onClick={() =>
              act.mutate({ action: 'questions', body: { question_id: extra }, message: 'Đã thêm câu vào đề' })
            }
          >
            Thêm câu
          </Button>
        </div>
      ) : null}
      {data.variants.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Mã đề">
          <p className="text-content text-text">Mã đề: {data.variants.map((variant) => variant.code).join(', ')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-label font-medium text-text">
              Mã đề tải
              <select
                aria-label="Mã đề tải"
                className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              >
                {data.variants.map((variant) => (
                  <option key={variant.code} value={variant.code}>
                    {variant.code}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => download('paper', 'pdf')}>Tải đề PDF</Button>
            <Button onClick={() => download('paper', 'docx')}>Tải đề Word</Button>
            <Button onClick={() => download('answers', 'pdf')}>Tải đáp án PDF</Button>
            <Button onClick={() => download('answers', 'docx')}>Tải đáp án Word</Button>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function ExamsPage() {
  const scope = useExamScope();
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const exams = useQuery({
    queryKey: ['exams', scope.level],
    queryFn: () => listExams(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const plans = useQuery({
    queryKey: ['assessment-plans', scope.level],
    queryFn: () => listPlans(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level && manager),
  });
  const matrices = useQuery({
    queryKey: ['exam-matrices', scope.level],
    queryFn: () => listMatrices(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level && manager),
  });
  const staff = useQuery({ queryKey: ['exam-staff'], queryFn: listStaff, enabled: manager });
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({
    plan_id: '',
    matrix_id: '',
    title: '',
    author_user_id: '',
    reviewer_user_id: '',
    due_date: '',
    variant_count: '4',
  });
  const create = useMutation({
    mutationFn: () =>
      createExam({
        school_level: scope.level,
        subject_id: scope.subjectId,
        grade_level_code: scope.grade,
        plan_id: form.plan_id || null,
        matrix_id: form.matrix_id || null,
        title: form.title,
        author_user_id: form.author_user_id,
        reviewer_user_id: form.reviewer_user_id || null,
        due_date: form.due_date || null,
        variant_count: Number(form.variant_count),
      }),
    onSuccess: async (exam) => {
      await queryClient.invalidateQueries({ queryKey: ['exams'] });
      setSelected(exam.id);
      setToastMessage(`Đã giao đề ${exam.title}`);
    },
  });
  const choose = (label: string, key: keyof typeof form, options: Array<[string, string]>, empty: string) => (
    <label className="text-label font-medium text-text">
      {label}
      <select
        aria-label={label}
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      >
        <option value="">{empty}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/exams')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-content" aria-label="Đề kiểm tra">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Đề</th>
                    <th className="px-3 py-2">Môn, khối</th>
                    <th className="px-3 py-2">Người ra đề</th>
                    <th className="px-3 py-2">Thẩm định</th>
                    <th className="px-3 py-2">Hạn nộp</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(exams.data ?? []).map((exam) => (
                    <tr key={exam.id} className="border-t border-border">
                      <td className="px-3 py-2">{exam.title}</td>
                      <td className="px-3 py-2">
                        {exam.subject_name} {exam.grade_level_code}
                      </td>
                      <td className="px-3 py-2">{exam.author_name}</td>
                      <td className="px-3 py-2">{exam.reviewer_name ?? ''}</td>
                      <td className={`px-3 py-2 ${exam.overdue ? 'text-danger' : ''}`}>
                        {exam.due_date?.split('-').reverse().join('/') ?? ''}
                        {exam.overdue ? ' (quá hạn)' : ''}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={exam.status === 'locked' ? 'success' : 'neutral'}
                          label={EXAM_STATUS_LABELS[exam.status] ?? exam.status}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => setSelected(exam.id)}>
                          Mở
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {exams.data && exams.data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-text-secondary">
                        Chưa có đề nào được giao cho bạn.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {selected ? <ExamDetail key={selected} examId={selected} onMessage={setToastMessage} /> : null}
            {manager ? (
              <section className="flex flex-col gap-3" aria-label="Giao đề">
                <h2 className="text-section-title font-semibold text-text">Giao đề</h2>
                {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
                <ScopeFilters scope={scope} />
                <div className="flex flex-wrap items-end gap-3">
                  {choose(
                    'Kế hoạch',
                    'plan_id',
                    (plans.data ?? [])
                      .filter((plan) => plan.status === 'approved')
                      .map((plan) => [plan.id, `${plan.term} ${plan.grade_level_code} ${plan.subject_name}`]),
                    'Không theo kế hoạch',
                  )}
                  {choose(
                    'Ma trận',
                    'matrix_id',
                    (matrices.data ?? [])
                      .filter(
                        (matrix) => matrix.subject_id === scope.subjectId && matrix.grade_level_code === scope.grade,
                      )
                      .map((matrix) => [matrix.id, matrix.name]),
                    'Chưa chọn',
                  )}
                  {choose(
                    'Người ra đề',
                    'author_user_id',
                    (staff.data ?? []).map((row) => [row.user_id, row.name]),
                    'Chọn người',
                  )}
                  {choose(
                    'Người thẩm định',
                    'reviewer_user_id',
                    (staff.data ?? []).map((row) => [row.user_id, row.name]),
                    'Chọn người',
                  )}
                  <label className="text-label font-medium text-text">
                    Tên đề
                    <input
                      aria-label="Tên đề"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                    />
                  </label>
                  <label className="text-label font-medium text-text">
                    Số mã đề
                    <input
                      type="number"
                      aria-label="Số mã đề"
                      className={`mt-2 block w-20 ${FORM_CONTROL_CLASS}`}
                      value={form.variant_count}
                      onChange={(event) => setForm({ ...form, variant_count: event.target.value })}
                    />
                  </label>
                  <label className="text-label font-medium text-text">
                    Hạn nộp
                    <input
                      type="date"
                      aria-label="Hạn nộp"
                      className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                      value={form.due_date}
                      onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                    />
                  </label>
                  <Button
                    variant="primary"
                    disabled={
                      !form.title.trim() || !form.author_user_id || !scope.subjectId || !scope.grade || create.isPending
                    }
                    onClick={() => create.mutate()}
                  >
                    Giao đề
                  </Button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
