import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { useHasPermission } from '../session/permissions.js';
import { messageOf, NO_LEVEL_MESSAGE, useExamScope } from '../exams/exam-filters.js';
import { downloadFile } from '../exams/exams-api.js';
import {
  classesForExam,
  createSession,
  importSheets,
  listSessions,
  lockedExams,
  parseAnswer,
  readSession,
  saveSheet,
  SCORE_KIND_LABELS,
  sessionAction,
  SESSION_STATUS_LABELS,
  TERM_LABELS,
  type SessionDetail,
  type SheetRow,
} from './grading-api.js';

// 8.5 Chấm bài kiểm tra (DT-21 phần 22g2, YCTD-173): tạo bài kiểm tra của lớp từ đề đã khoá; in phiếu trả lời; nhập bài tay
// hoặc nhập tệp quét phiếu theo mẫu; điểm tự luận (chấm hai người); người quản lý khoá, mở khoá có lý do; giáo viên dạy môn
// chuyển điểm vào sổ điểm
function SheetEditor({
  session,
  row,
  onSaved,
  onCancel,
}: {
  session: SessionDetail;
  row: SheetRow;
  onSaved(message: string): void;
  onCancel(): void;
}) {
  const queryClient = useQueryClient();
  const [absent, setAbsent] = useState(row.sheet?.absent ?? false);
  const [code, setCode] = useState(row.sheet?.variant_code ?? session.variants[0]?.code ?? '');
  const variant = session.variants.find((item) => item.code === code);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(row.sheet?.answers ?? {}).map(([number, values]) => [
        number,
        values.join(values.some((value) => value.length > 1) ? ',' : ''),
      ]),
    ),
  );
  const [marks, setMarks] = useState<Record<string, { first: string; second: string }>>(() =>
    Object.fromEntries(
      Object.entries(row.sheet?.essay ?? {}).map(([id, value]) => [
        id,
        { first: value.first?.toString() ?? '', second: value.second?.toString() ?? '' },
      ]),
    ),
  );
  const save = useMutation({
    mutationFn: () =>
      saveSheet(session.id, row.child_id, {
        absent,
        variant_code: absent ? null : code,
        answers: Object.fromEntries(
          (variant?.items ?? [])
            .filter((item) => item.question_type !== 'essay')
            .map((item) => [String(item.number), parseAnswer(item.question_type, answers[item.number] ?? '')]),
        ),
        essay: Object.fromEntries(
          (variant?.items ?? [])
            .filter((item) => item.question_type === 'essay')
            .map((item) => {
              const value = marks[item.question_id];
              const read = (text: string | undefined) =>
                text && text.trim() !== '' ? Number(text.replace(',', '.')) : null;
              return [item.question_id, { first: read(value?.first), second: read(value?.second) }];
            }),
        ),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(['exam-session', session.id], data);
      await queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      onSaved(`Đã lưu bài của ${row.full_name}`);
    },
  });
  return (
    <section className="flex flex-col gap-3 rounded border border-border p-3" aria-label={`Bài của ${row.full_name}`}>
      <h3 className="text-label font-semibold text-text">Bài của {row.full_name}</h3>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-label font-medium text-text">
          <input type="checkbox" checked={absent} onChange={(event) => setAbsent(event.target.checked)} /> Vắng
        </label>
        {!absent ? (
          <label className="text-label font-medium text-text">
            Mã đề
            <select
              aria-label="Mã đề"
              className={`mt-2 block ${FORM_CONTROL_CLASS}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            >
              {session.variants.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {!absent && variant ? (
        <div className="flex flex-wrap gap-3">
          {variant.items.map((item) =>
            item.question_type === 'essay' ? (
              <fieldset key={item.number} className="flex items-end gap-2">
                <label className="text-label text-text">
                  Câu {item.number} (tự luận, {item.score} điểm)
                  <input
                    aria-label={`Câu ${item.number} người chấm 1`}
                    className={`mt-2 block w-20 ${FORM_CONTROL_CLASS}`}
                    value={marks[item.question_id]?.first ?? ''}
                    onChange={(event) =>
                      setMarks({
                        ...marks,
                        [item.question_id]: {
                          first: event.target.value,
                          second: marks[item.question_id]?.second ?? '',
                        },
                      })
                    }
                  />
                </label>
                {session.double_marking ? (
                  <label className="text-label text-text">
                    Người chấm 2
                    <input
                      aria-label={`Câu ${item.number} người chấm 2`}
                      className={`mt-2 block w-20 ${FORM_CONTROL_CLASS}`}
                      value={marks[item.question_id]?.second ?? ''}
                      onChange={(event) =>
                        setMarks({
                          ...marks,
                          [item.question_id]: {
                            first: marks[item.question_id]?.first ?? '',
                            second: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ) : null}
              </fieldset>
            ) : (
              <label key={item.number} className="text-label text-text">
                Câu {item.number}
                <input
                  aria-label={`Câu ${item.number}`}
                  className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                  placeholder={
                    item.question_type === 'true_false'
                      ? 'ĐSĐĐ'
                      : item.question_type === 'short_answer'
                        ? 'Đáp số'
                        : 'A'
                  }
                  value={answers[item.number] ?? ''}
                  onChange={(event) => setAnswers({ ...answers, [item.number]: event.target.value })}
                />
              </label>
            ),
          )}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Lưu bài
        </Button>
        <Button variant="text" onClick={onCancel}>
          Đóng
        </Button>
      </div>
    </section>
  );
}

function SessionPanel({ sessionId, onMessage }: { sessionId: string; onMessage(message: string): void }) {
  const queryClient = useQueryClient();
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const session = useQuery({ queryKey: ['exam-session', sessionId], queryFn: () => readSession(sessionId) });
  const [editing, setEditing] = useState<string>();
  const [file, setFile] = useState<File>();
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['exam-session', sessionId] });
    await queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
    onMessage(message);
  };
  const act = useMutation({
    mutationFn: (input: { action: 'lock' | 'unlock' | 'transfer'; body?: unknown; message: string }) =>
      sessionAction(sessionId, input.action, input.body),
    onSuccess: async (data, input) =>
      refresh(input.action === 'transfer' ? `Đã chuyển ${data.written ?? 0} điểm vào sổ điểm` : input.message),
  });
  const upload = useMutation({
    mutationFn: () => importSheets(sessionId, file as File),
    onSuccess: async (result) => {
      if (result.errors.length === 0) await refresh(`Đã nhập ${result.imported} bài từ tệp quét`);
    },
  });
  const data = session.data;
  if (!data) {
    return session.error ? <Alert tone="danger">{messageOf(session.error)}</Alert> : null;
  }
  const grading = data.status === 'grading';
  const blockers = [
    data.blockers.missing.length > 0 ? `Chưa có bài: ${data.blockers.missing.join(', ')}` : null,
    data.blockers.incomplete.length > 0 ? `Thiếu điểm tự luận: ${data.blockers.incomplete.join(', ')}` : null,
    data.blockers.review.length > 0
      ? `Hai người chấm lệch quá ${data.mark_tolerance} điểm: ${data.blockers.review.join(', ')}`
      : null,
  ].filter(Boolean);
  const editingRow = data.students.find((row) => row.child_id === editing);
  return (
    <section className="flex flex-col gap-3" aria-label={`Bài kiểm tra ${data.exam_title} lớp ${data.class_name}`}>
      <h2 className="text-section-title font-semibold text-text">
        {data.exam_title} · Lớp {data.class_name} · {SESSION_STATUS_LABELS[data.status]}
      </h2>
      <p className="text-content text-text">
        {data.subject_name}, {TERM_LABELS[data.term_type]}, điểm {SCORE_KIND_LABELS[data.score_kind]?.toLowerCase()}
        {data.score_kind === 'regular' ? ` lần ${data.score_seq}` : ''}; tổng điểm đề {data.total_score};{' '}
        {data.double_marking ? `chấm hai người (ngưỡng lệch ${data.mark_tolerance})` : 'một người chấm'}; học sinh vắng{' '}
        {data.absent_policy === 'zero' ? 'ghi 0' : 'không ghi điểm'}
        {data.locked_by_name ? `; khoá: ${data.locked_by_name}` : ''}
        {data.transferred_by_name ? `; chuyển sổ điểm: ${data.transferred_by_name}` : ''}
      </p>
      {act.error ? <Alert tone="danger">{messageOf(act.error)}</Alert> : null}
      {grading && blockers.length > 0 ? <Alert tone="warning">{blockers.join('. ')}</Alert> : null}
      <div className="flex flex-wrap items-end gap-2">
        <Button
          onClick={() =>
            void downloadFile(`/api/v1/exam-grading/sessions/${sessionId}/answer-sheet`, 'phieu-tra-loi.pdf')
          }
        >
          Tải phiếu trả lời
        </Button>
        <Button
          onClick={() =>
            void downloadFile(
              `/api/v1/exam-grading/sessions/${sessionId}/import-template`,
              'mau-ket-qua-quet-phieu.xlsx',
            )
          }
        >
          Tải mẫu tệp quét
        </Button>
        {grading ? (
          <>
            <input
              type="file"
              accept=".xlsx"
              aria-label="Tệp kết quả quét"
              className="text-label"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
            <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              Nhập tệp quét
            </Button>
          </>
        ) : null}
        {manager && grading ? (
          <Button
            variant="primary"
            onClick={() => act.mutate({ action: 'lock', message: 'Đã khoá điểm bài kiểm tra' })}
          >
            Khoá điểm
          </Button>
        ) : null}
        {manager && data.status === 'locked' ? (
          <Button
            onClick={() => {
              const reason = window.prompt('Lý do mở khoá');
              if (reason) act.mutate({ action: 'unlock', body: { reason }, message: 'Đã mở khoá điểm' });
            }}
          >
            Mở khoá
          </Button>
        ) : null}
        {data.status === 'locked' ? (
          <Button
            variant="primary"
            onClick={() => {
              if (window.confirm('Chuyển điểm bài kiểm tra vào sổ điểm của lớp?'))
                act.mutate({ action: 'transfer', message: '' });
            }}
          >
            Chuyển vào sổ điểm
          </Button>
        ) : null}
      </div>
      {upload.error ? <Alert tone="danger">{messageOf(upload.error)}</Alert> : null}
      {upload.data && upload.data.errors.length > 0 ? (
        <Alert tone="danger">
          Tệp có lỗi, chưa ghi bài nào:{' '}
          {upload.data.errors
            .map((error) => `dòng ${error.row}${error.column ? ` (${error.column})` : ''}: ${error.message}`)
            .join('; ')}
        </Alert>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-content" aria-label="Bài làm của học sinh">
          <thead className="text-left text-label font-medium text-text-secondary">
            <tr>
              <th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2">Mã đề</th>
              <th className="px-3 py-2">Trắc nghiệm</th>
              <th className="px-3 py-2">Tự luận</th>
              <th className="px-3 py-2">Tổng</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.students.map((row) => (
              <tr key={row.child_id} className="border-t border-border">
                <td className="px-3 py-2">{row.full_name}</td>
                <td className="px-3 py-2">{row.sheet?.absent ? 'Vắng' : (row.sheet?.variant_code ?? '')}</td>
                <td className="px-3 py-2">{row.sheet?.objective_score ?? ''}</td>
                <td className="px-3 py-2">{row.sheet?.essay_score ?? ''}</td>
                <td className="px-3 py-2 font-semibold">{row.sheet?.total_score ?? ''}</td>
                <td className="px-3 py-2">
                  {row.sheet?.needs_review ? 'Cần xem lại' : ''}
                  {row.sheet && !row.sheet.absent && row.sheet.total_score === null ? 'Thiếu điểm tự luận' : ''}
                  {row.sheet?.source === 'import' ? ' (tệp quét)' : ''}
                </td>
                <td className="px-3 py-2 text-right">
                  {grading ? (
                    <Button variant="text" onClick={() => setEditing(row.child_id)}>
                      {row.sheet ? 'Sửa bài' : 'Nhập bài'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingRow && grading ? (
        <SheetEditor
          key={editingRow.child_id}
          session={data}
          row={editingRow}
          onSaved={(message) => {
            setEditing(undefined);
            onMessage(message);
          }}
          onCancel={() => setEditing(undefined)}
        />
      ) : null}
    </section>
  );
}

export function ExamGradingPage() {
  const queryClient = useQueryClient();
  const scope = useExamScope();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [selected, setSelected] = useState<string>();
  const sessions = useQuery({
    queryKey: ['exam-sessions', scope.level],
    queryFn: () => listSessions(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const exams = useQuery({
    queryKey: ['locked-exams', scope.level],
    queryFn: () => lockedExams(scope.level ?? 'THCS'),
    enabled: Boolean(scope.level),
  });
  const [form, setForm] = useState({
    exam_id: '',
    class_id: '',
    term_type: 'first_term',
    score_kind: 'mid',
    score_seq: '1',
    true_false_rule: 'tiered',
    double_marking: false,
    mark_tolerance: '1',
    absent_policy: 'skip',
  });
  const classes = useQuery({
    queryKey: ['exam-grading-classes', form.exam_id],
    queryFn: () => classesForExam(form.exam_id),
    enabled: Boolean(form.exam_id),
  });
  const create = useMutation({
    mutationFn: () =>
      createSession({
        ...form,
        score_seq: Number(form.score_seq),
        mark_tolerance: Number(form.mark_tolerance.replace(',', '.')),
      }),
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ['exam-sessions'] });
      setSelected(session.id);
      setToastMessage(`Đã tạo bài kiểm tra lớp ${session.class_name}`);
    },
  });
  const choose = (
    label: string,
    key: 'exam_id' | 'class_id' | 'term_type' | 'score_kind' | 'true_false_rule' | 'absent_policy',
    options: Array<[string, string]>,
    empty?: string,
  ) => (
    <label className="text-label font-medium text-text">
      {label}
      <select
        aria-label={label}
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={form[key]}
        onChange={(event) =>
          setForm({ ...form, [key]: event.target.value, ...(key === 'exam_id' ? { class_id: '' } : {}) })
        }
      >
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const grader = useHasPermission(PERMISSION_CODES.examGrade);
  const manager = useHasPermission(PERMISSION_CODES.examManage);
  const canCreate = grader || manager;

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/exam-grading')}</h1>
        {!scope.level ? (
          <Alert tone="info">{NO_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-content" aria-label="Bài kiểm tra của lớp">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Đề</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Học kỳ, loại điểm</th>
                    <th className="px-3 py-2">Đã chấm</th>
                    <th className="px-3 py-2">Trung bình</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(sessions.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.exam_title}</td>
                      <td className="px-3 py-2">{row.class_name}</td>
                      <td className="px-3 py-2">
                        {TERM_LABELS[row.term_type]}, {SCORE_KIND_LABELS[row.score_kind]?.toLowerCase()}
                        {row.score_kind === 'regular' ? ` lần ${row.score_seq}` : ''}
                      </td>
                      <td className="px-3 py-2">{row.graded}</td>
                      <td className="px-3 py-2">{row.average ?? ''}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          tone={row.status === 'grading' ? 'neutral' : 'success'}
                          label={SESSION_STATUS_LABELS[row.status] ?? row.status}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => setSelected(row.id)}>
                          Mở
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sessions.data && sessions.data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-text-secondary">
                        Chưa có bài kiểm tra nào của lớp bạn dạy.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {selected ? <SessionPanel key={selected} sessionId={selected} onMessage={setToastMessage} /> : null}
            {canCreate ? (
              <section className="flex flex-col gap-3" aria-label="Tạo bài kiểm tra của lớp">
                <h2 className="text-section-title font-semibold text-text">Tạo bài kiểm tra của lớp</h2>
                {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
                <div className="flex flex-wrap items-end gap-3">
                  {choose(
                    'Đề đã khoá',
                    'exam_id',
                    (exams.data ?? []).map((exam) => [
                      exam.id,
                      `${exam.title} (${exam.subject_name} ${exam.grade_level_code})`,
                    ]),
                    'Chọn đề',
                  )}
                  {choose(
                    'Lớp',
                    'class_id',
                    (classes.data ?? []).map((row) => [row.id, row.name]),
                    'Chọn lớp',
                  )}
                  {choose('Học kỳ', 'term_type', Object.entries(TERM_LABELS))}
                  {choose('Loại điểm', 'score_kind', Object.entries(SCORE_KIND_LABELS))}
                  {form.score_kind === 'regular' ? (
                    <label className="text-label font-medium text-text">
                      Lần
                      <input
                        type="number"
                        aria-label="Lần"
                        className={`mt-2 block w-20 ${FORM_CONTROL_CLASS}`}
                        value={form.score_seq}
                        onChange={(event) => setForm({ ...form, score_seq: event.target.value })}
                      />
                    </label>
                  ) : null}
                  {choose('Chấm đúng sai', 'true_false_rule', [
                    ['tiered', 'Bậc thang (0,1; 0,25; 0,5; 1)'],
                    ['proportional', 'Theo tỉ lệ ý đúng'],
                  ])}
                  {choose('Học sinh vắng', 'absent_policy', [
                    ['skip', 'Không ghi điểm'],
                    ['zero', 'Ghi 0'],
                  ])}
                  <label className="text-label font-medium text-text">
                    <input
                      type="checkbox"
                      checked={form.double_marking}
                      onChange={(event) => setForm({ ...form, double_marking: event.target.checked })}
                    />{' '}
                    Chấm tự luận hai người
                  </label>
                  {form.double_marking ? (
                    <label className="text-label font-medium text-text">
                      Ngưỡng lệch
                      <input
                        aria-label="Ngưỡng lệch"
                        className={`mt-2 block w-20 ${FORM_CONTROL_CLASS}`}
                        value={form.mark_tolerance}
                        onChange={(event) => setForm({ ...form, mark_tolerance: event.target.value })}
                      />
                    </label>
                  ) : null}
                  <Button
                    variant="primary"
                    disabled={!form.exam_id || !form.class_id || create.isPending}
                    onClick={() => create.mutate()}
                  >
                    Tạo bài kiểm tra
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
