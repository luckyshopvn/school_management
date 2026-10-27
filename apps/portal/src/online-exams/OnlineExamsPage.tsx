import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  EXAM_ATTEMPT_POLICY_LABELS,
  EXAM_CAMERA_FALLBACK_LABELS,
  EXAM_MODE_LABELS,
  EXAM_RESULT_MODE_LABELS,
  EXAM_SINGLE_SESSION_LABELS,
  EXAM_VARIANT_MODE_LABELS,
  EXAM_VIOLATION_ACTION_LABELS,
  type SchoolLevelCode,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { messageOf } from '../exams/exam-filters.js';
import { useEnabledSchoolLevels } from '../school-levels/enabled-levels.js';
import {
  createAssignment,
  listAssignments,
  listClassesForExam,
  listLockedExams,
  readSchoolSettings,
  type AssignmentSummary,
} from './online-exams-api.js';

// 1. Giao đề thi trực tuyến (DT-23 phần 23a, YCTD-211): giáo viên giao đề đã khoá cho lớp hoặc học sinh với giờ mở, giờ đóng,
// thời lượng, số lần làm, đảo câu và đáp án, chế độ hiện kết quả, khóa toàn màn hình và camera (GD-106). Điểm chuyển vào sổ điểm
// theo luồng 8.5 Chấm bài kiểm tra, có giáo viên xác nhận
export const ONLINE_EXAM_LEVELS: SchoolLevelCode[] = ['TH', 'THCS', 'THPT'];

export function useOnlineExamLevel() {
  const enabled = useEnabledSchoolLevels();
  const levels = enabled.levels.filter((item) => ONLINE_EXAM_LEVELS.includes(item.value));
  const [chosen, setChosen] = useState<SchoolLevelCode>();
  const level = levels.find((item) => item.value === chosen)?.value ?? levels[0]?.value;
  return { levels, level, setLevel: setChosen };
}

export const NO_ONLINE_LEVEL_MESSAGE = 'Trường chưa bật cấp học nào có thi trực tuyến (từ Tiểu học trở lên).';

const WINDOW_LABELS = { upcoming: 'Chưa mở', open: 'Đang mở', closed: 'Đã đóng' } as const;

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(iso),
  );

// Giá trị của ô giờ trên trang (giờ Việt Nam) đổi sang thời điểm chuẩn gửi máy chủ
function localToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

function defaultLocal(minutesFromNow: number): string {
  const moment = new Date(Date.now() + minutesFromNow * 60_000 + 7 * 3_600_000);
  return moment.toISOString().slice(0, 16);
}

function Select<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: Array<[Value, string]>;
  onChange(value: Value): void;
}) {
  return (
    <label className="text-label font-medium text-text">
      {label}
      <select
        aria-label={label}
        className={`mt-2 block ${FORM_CONTROL_CLASS}`}
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {options.map(([optionValue, text]) => (
          <option key={optionValue} value={optionValue}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

interface Form {
  exam_id: string;
  exam_mode: string;
  class_id: string;
  title: string;
  opens: string;
  closes: string;
  duration: string;
  max_attempts: string;
  attempt_policy: string;
  variant_mode: string;
  fixed_variant_code: string;
  result_mode: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  fullscreen_required: boolean;
  max_violations: string;
  violation_action: string;
  camera_enabled: boolean;
  camera_fallback: string;
  proctor_live: boolean;
  proctor_record: boolean;
  single_session_mode: string;
  term_type: string;
  score_kind: string;
  score_seq: string;
}

const emptyForm = (): Form => ({
  exam_id: '',
  exam_mode: '',
  class_id: '',
  title: '',
  opens: defaultLocal(0),
  closes: defaultLocal(120),
  duration: '45',
  max_attempts: '1',
  attempt_policy: 'best',
  variant_mode: 'random',
  fixed_variant_code: '101',
  result_mode: 'after_close',
  shuffle_questions: true,
  shuffle_options: true,
  fullscreen_required: true,
  max_violations: '3',
  violation_action: 'flag',
  camera_enabled: true,
  camera_fallback: 'flag',
  proctor_live: false,
  proctor_record: false,
  single_session_mode: 'reject_new',
  term_type: 'first_term',
  score_kind: 'regular',
  score_seq: '1',
});

export function OnlineExamsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const scope = useOnlineExamLevel();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [form, setForm] = useState<Form>(emptyForm);
  const level = scope.level;
  const assignments = useQuery({
    queryKey: ['online-exam-assignments', level],
    queryFn: () => listAssignments(level ?? 'THCS'),
    enabled: Boolean(level),
  });
  const exams = useQuery({
    queryKey: ['online-exam-exams', level],
    queryFn: () => listLockedExams(level ?? 'THCS'),
    enabled: Boolean(level),
  });
  const classes = useQuery({
    queryKey: ['online-exam-classes', form.exam_id],
    queryFn: () => listClassesForExam(form.exam_id),
    enabled: Boolean(form.exam_id),
  });
  const schoolSettings = useQuery({ queryKey: ['online-exam-school-settings'], queryFn: readSchoolSettings });
  const effectiveMode = form.exam_mode || schoolSettings.data?.default_exam_mode || 'at-school';
  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        exam_id: form.exam_id,
        class_ids: form.class_id ? [form.class_id] : [],
        exam_mode: effectiveMode,
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
        opens_at: localToIso(form.opens),
        closes_at: localToIso(form.closes),
        duration_minutes: Number(form.duration),
        max_attempts: Number(form.max_attempts),
        attempt_policy: form.attempt_policy,
        variant_mode: form.variant_mode,
        ...(form.variant_mode === 'fixed' ? { fixed_variant_code: form.fixed_variant_code } : {}),
        result_mode: form.result_mode,
        shuffle_questions: form.shuffle_questions,
        shuffle_options: form.shuffle_options,
        fullscreen_required: form.fullscreen_required,
        max_violations: Number(form.max_violations),
        violation_action: form.violation_action,
        camera_enabled: form.camera_enabled,
        camera_fallback: form.camera_fallback,
        proctor_live: form.camera_enabled && form.proctor_live,
        proctor_record: form.camera_enabled && form.proctor_record,
        single_session_mode: form.single_session_mode,
        term_type: form.term_type,
        score_kind: form.score_kind,
        score_seq: Number(form.score_seq),
      }),
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ['online-exam-assignments'] });
      setToastMessage(`Đã giao đề "${detail.title}"`);
      setForm(emptyForm());
    },
  });
  const set = <Key extends keyof Form>(key: Key, value: Form[Key]) => setForm({ ...form, [key]: value });
  const check = (
    label: string,
    key:
      | 'shuffle_questions'
      | 'shuffle_options'
      | 'fullscreen_required'
      | 'camera_enabled'
      | 'proctor_live'
      | 'proctor_record',
  ) => (
    <label className="text-label font-medium text-text">
      <input type="checkbox" checked={form[key]} onChange={(event) => set(key, event.target.checked)} /> {label}
    </label>
  );
  const number = (label: string, key: 'duration' | 'max_attempts' | 'max_violations' | 'score_seq') => (
    <label className="text-label font-medium text-text">
      {label}
      <input
        type="number"
        aria-label={label}
        className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const labelled = (labels: Record<string, string>) => Object.entries(labels) as Array<[string, string]>;
  const open = (row: AssignmentSummary) =>
    void navigate({ to: '/online-exams/monitor', search: { assignment: row.id } });

  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/online-exams')}</h1>
        {!level ? (
          <Alert tone="info">{NO_ONLINE_LEVEL_MESSAGE}</Alert>
        ) : (
          <>
            {scope.levels.length > 1 ? (
              <Select
                label="Cấp học"
                value={level}
                options={scope.levels.map((item): [SchoolLevelCode, string] => [item.value, item.label])}
                onChange={(value) => scope.setLevel(value as SchoolLevelCode)}
              />
            ) : null}
            {assignments.error ? <Alert tone="danger">{messageOf(assignments.error)}</Alert> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-content" aria-label="Bài thi đã giao">
                <thead className="text-left text-label font-medium text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Bài thi</th>
                    <th className="px-3 py-2">Môn</th>
                    <th className="px-3 py-2">Giờ mở, giờ đóng</th>
                    <th className="px-3 py-2">Giao, đã vào, đã nộp</th>
                    <th className="px-3 py-2">Cần xét</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(assignments.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.subject_name}</td>
                      <td className="px-3 py-2">
                        {formatTime(row.opens_at)} – {formatTime(row.closes_at)} ({row.duration_minutes} phút)
                      </td>
                      <td className="px-3 py-2">
                        {row.students}, {row.started}, {row.submitted}
                      </td>
                      <td className="px-3 py-2">{row.flagged}</td>
                      <td className="px-3 py-2">
                        {row.status === 'cancelled' ? (
                          <StatusBadge tone="danger" label="Đã huỷ" />
                        ) : (
                          <StatusBadge
                            tone={row.window === 'open' ? 'success' : 'neutral'}
                            label={WINDOW_LABELS[row.window]}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="text" onClick={() => open(row)}>
                          Theo dõi
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {assignments.data && assignments.data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-text-secondary">
                        Chưa có bài thi nào được giao.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <section className="flex flex-col gap-3" aria-label="Giao đề thi trực tuyến">
              <h2 className="text-section-title font-semibold text-text">Giao đề thi trực tuyến</h2>
              <Alert tone="info">
                Học sinh làm bài ở ứng dụng phụ huynh (địa chỉ có #hoc-sinh) bằng tài khoản ở 4.1.10 Tài khoản học và
                thi. Camera chỉ xử lý ngay trên máy học sinh, không gửi hình hay video lên máy chủ; sự kiện chỉ để giáo
                viên xét, không tự trừ điểm. Chỉ giao được đề đã khoá; đề có câu tự luận chỉ cho làm một lần.
              </Alert>
              {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-label font-medium text-text">
                  Đề đã khoá
                  <select
                    aria-label="Đề đã khoá"
                    className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                    value={form.exam_id}
                    onChange={(event) => setForm({ ...form, exam_id: event.target.value, class_id: '' })}
                  >
                    <option value="">Chọn đề</option>
                    {(exams.data ?? []).map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title} ({exam.subject_name} {exam.grade_level_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-label font-medium text-text">
                  Lớp
                  <select
                    aria-label="Lớp"
                    className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                    value={form.class_id}
                    onChange={(event) => set('class_id', event.target.value)}
                  >
                    <option value="">Chọn lớp</option>
                    {(classes.data ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-label font-medium text-text">
                  Tên bài thi (bỏ trống thì lấy tên đề)
                  <input
                    aria-label="Tên bài thi"
                    className={`mt-2 block w-64 ${FORM_CONTROL_CLASS}`}
                    value={form.title}
                    onChange={(event) => set('title', event.target.value)}
                  />
                </label>
                <label className="text-label font-medium text-text">
                  Giờ mở
                  <input
                    type="datetime-local"
                    aria-label="Giờ mở"
                    className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                    value={form.opens}
                    onChange={(event) => set('opens', event.target.value)}
                  />
                </label>
                <label className="text-label font-medium text-text">
                  Giờ đóng
                  <input
                    type="datetime-local"
                    aria-label="Giờ đóng"
                    className={`mt-2 block ${FORM_CONTROL_CLASS}`}
                    value={form.closes}
                    onChange={(event) => set('closes', event.target.value)}
                  />
                </label>
                {number('Thời lượng (phút)', 'duration')}
                {number('Số lần làm', 'max_attempts')}
                <Select
                  label="Chế độ thi"
                  value={effectiveMode}
                  options={labelled(EXAM_MODE_LABELS).filter(
                    ([mode]) => mode === 'at-school' || schoolSettings.data?.allow_remote,
                  )}
                  onChange={(value) => set('exam_mode', value)}
                />
                <Select
                  label="Cách tính các lần"
                  value={form.attempt_policy}
                  options={labelled(EXAM_ATTEMPT_POLICY_LABELS)}
                  onChange={(value) => set('attempt_policy', value)}
                />
                <Select
                  label="Phát mã đề"
                  value={form.variant_mode}
                  options={labelled(EXAM_VARIANT_MODE_LABELS)}
                  onChange={(value) => set('variant_mode', value)}
                />
                {form.variant_mode === 'fixed' ? (
                  <label className="text-label font-medium text-text">
                    Mã đề
                    <input
                      aria-label="Mã đề"
                      className={`mt-2 block w-24 ${FORM_CONTROL_CLASS}`}
                      value={form.fixed_variant_code}
                      onChange={(event) => set('fixed_variant_code', event.target.value)}
                    />
                  </label>
                ) : null}
                <Select
                  label="Hiện kết quả"
                  value={form.result_mode}
                  options={labelled(EXAM_RESULT_MODE_LABELS)}
                  onChange={(value) => set('result_mode', value)}
                />
                {check('Đảo thứ tự câu hỏi', 'shuffle_questions')}
                {check('Đảo thứ tự đáp án', 'shuffle_options')}
                {check('Khóa toàn màn hình', 'fullscreen_required')}
                {number('Số lần rời bài cho phép', 'max_violations')}
                <Select
                  label="Khi quá số lần rời bài"
                  value={form.violation_action}
                  options={labelled(EXAM_VIOLATION_ACTION_LABELS)}
                  onChange={(value) => set('violation_action', value)}
                />
                {check('Kiểm tra camera', 'camera_enabled')}
                {form.camera_enabled ? (
                  <Select
                    label="Khi không có camera"
                    value={form.camera_fallback}
                    options={labelled(EXAM_CAMERA_FALLBACK_LABELS)}
                    onChange={(value) => set('camera_fallback', value)}
                  />
                ) : null}
                {form.camera_enabled && schoolSettings.data?.allow_live_proctoring
                  ? check(
                      'Giáo viên xem camera trực tiếp (cần cha mẹ đồng ý với học sinh dưới 16 tuổi)',
                      'proctor_live',
                    )
                  : null}
                {form.camera_enabled && schoolSettings.data?.allow_recording
                  ? check('Ghi hình camera (lưu mã hoá, tự xoá sau thời hạn của trường)', 'proctor_record')
                  : null}
                <Select
                  label="Phiên đăng nhập thứ hai"
                  value={form.single_session_mode}
                  options={labelled(EXAM_SINGLE_SESSION_LABELS)}
                  onChange={(value) => set('single_session_mode', value)}
                />
                {level !== 'TH' ? (
                  <>
                    <Select
                      label="Học kỳ"
                      value={form.term_type}
                      options={[
                        ['first_term', 'Học kỳ I'],
                        ['second_term', 'Học kỳ II'],
                      ]}
                      onChange={(value) => set('term_type', value)}
                    />
                    <Select
                      label="Loại điểm"
                      value={form.score_kind}
                      options={[
                        ['regular', 'Thường xuyên'],
                        ['mid', 'Giữa kỳ'],
                        ['final', 'Cuối kỳ'],
                      ]}
                      onChange={(value) => set('score_kind', value)}
                    />
                    {form.score_kind === 'regular' ? number('Lần', 'score_seq') : null}
                  </>
                ) : null}
                <Button
                  variant="primary"
                  disabled={!form.exam_id || !form.class_id || create.isPending}
                  onClick={() => create.mutate()}
                >
                  Giao đề
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
