import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COMPETENCY_TERM_LABELS,
  PERMISSION_CODES,
  STAFF_CERTIFICATE_KIND_LABELS,
  TRAINING_COURSE_STATUS_LABELS,
  TRAINING_MODE_LABELS,
  TRAINING_ORGANIZER_LABELS,
  TRAINING_PROGRAM_LABELS,
  TRAINING_REGISTRATION_STATUS_LABELS,
  TRAINING_RESULT_LABELS,
  type CompetencyTerm,
  type TrainingMode,
  type TrainingOrganizerKind,
  type TrainingResult,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, StatusBadge } from '@school-management/ui';
import { formatDate, messageOf } from '../archives/archive-ui.js';
import { Page, Tabs, useToast } from '../directives/directive-ui.js';
import { useHasPermission } from '../session/permissions.js';
import {
  addStaffCertificate,
  cancelTrainingRegistration,
  confirmCompetency,
  createTrainingCourse,
  deleteStaffCertificate,
  downloadCourseCertificates,
  downloadTrainingCertificate,
  issueTrainingCertificates,
  listTrainingCourses,
  readCompetencyTable,
  readMyCompetency,
  readMyTraining,
  readTrainingCatalog,
  readTrainingCourse,
  readTrainingRecords,
  registerTrainingCourse,
  reissueTrainingCertificate,
  reviewTrainingRegistration,
  revokeTrainingCertificate,
  saveCompetencyDomain,
  saveTrainingResults,
  saveTrainingSettings,
  saveTrainingTopic,
  setTrainingCourseStatus,
  submitMyCompetency,
  verifyTrainingCertificate,
  type CompetencyTable,
  type TrainingCourseDetail,
  type TrainingCourseInput,
} from './training-api.js';

// Hồ sơ bồi dưỡng giáo viên (DT-22 phần 22e, YCTD-182): 6.1 Bồi dưỡng của tôi, 6.2 Khoá bồi dưỡng, 6.3 Hồ sơ bồi dưỡng, 6.4
// Năng lực số, 6.5 Danh mục bồi dưỡng của phân hệ Hồ sơ chuyên môn; trang tra cứu chứng nhận công khai
const TERMS = Object.keys(COMPETENCY_TERM_LABELS) as CompetencyTerm[];
const TERM_OPTIONS = TERMS.map((term) => ({ value: term, label: COMPETENCY_TERM_LABELS[term] }));
const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-label font-medium text-text">
      {label}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={title}>
      <h2 className="text-section-title font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

const cell = 'px-3 py-2';
const head = 'text-left text-label font-medium text-text-secondary';

// ---- 6.1 Bồi dưỡng của tôi ----

function CertificateForm({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    issued_by: '',
    issued_date: todayInVietnam(),
    expire_date: '',
    periods: '',
  });
  const save = useMutation({
    mutationFn: () =>
      addStaffCertificate({
        name: form.name,
        issued_by: form.issued_by,
        issued_date: form.issued_date,
        expire_date: form.expire_date || null,
        periods: form.periods ? Number(form.periods) : null,
        certificate_no: null,
      }),
    onSuccess: async () => {
      setForm({ name: '', issued_by: '', issued_date: todayInVietnam(), expire_date: '', periods: '' });
      await queryClient.invalidateQueries({ queryKey: ['training-mine'] });
      onSaved('Đã thêm chứng chỉ');
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} aria-label="Thêm chứng chỉ" className="flex flex-wrap items-end gap-3">
      <Field label="Tên chứng chỉ">
        <input
          className={FORM_CONTROL_CLASS}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="Nơi cấp">
        <input
          className={FORM_CONTROL_CLASS}
          value={form.issued_by}
          onChange={(event) => setForm({ ...form, issued_by: event.target.value })}
        />
      </Field>
      <Field label="Ngày cấp">
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={form.issued_date}
          onChange={(event) => setForm({ ...form, issued_date: event.target.value })}
        />
      </Field>
      <Field label="Ngày hết hạn">
        <input
          type="date"
          className={FORM_CONTROL_CLASS}
          value={form.expire_date}
          onChange={(event) => setForm({ ...form, expire_date: event.target.value })}
        />
      </Field>
      <Field label="Số tiết">
        <input
          type="number"
          min={0}
          className={FORM_CONTROL_CLASS}
          value={form.periods}
          onChange={(event) => setForm({ ...form, periods: event.target.value })}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={save.isPending}>
        Thêm chứng chỉ
      </Button>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </form>
  );
}

function MyCompetencySection({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState<CompetencyTerm>('year');
  const [levels, setLevels] = useState<Record<string, number>>({});
  const data = useQuery({ queryKey: ['training-competency-mine', term], queryFn: () => readMyCompetency(term) });
  useEffect(() => {
    setLevels(
      Object.fromEntries((data.data?.assessment?.scores ?? []).map((score) => [score.domain_code, score.self_level])),
    );
  }, [data.data]);
  const submit = useMutation({
    mutationFn: () =>
      submitMyCompetency(
        term,
        Object.entries(levels).map(([domain_code, level]) => ({ domain_code, level })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['training-competency-mine'] });
      await queryClient.invalidateQueries({ queryKey: ['training-mine'] });
      onSaved('Đã gửi tự đánh giá năng lực số');
    },
  });
  const confirmed = data.data?.assessment?.status === 'confirmed';
  return (
    <Section title="Năng lực số của tôi">
      <Tabs<CompetencyTerm> label="Kỳ đánh giá" value={term} options={TERM_OPTIONS} onChange={setTerm} />
      {confirmed ? <Alert tone="success">Đã được xác nhận bởi {data.data?.assessment?.confirmed_by_name}</Alert> : null}
      <table className="w-full text-content" aria-label="Tự đánh giá năng lực số">
        <thead className={head}>
          <tr>
            <th className={cell}>Miền năng lực</th>
            <th className={cell}>Mức tự đánh giá</th>
            <th className={cell}>Mức xác nhận</th>
          </tr>
        </thead>
        <tbody>
          {(data.data?.domains ?? []).map((domain) => {
            const score = data.data?.assessment?.scores.find((item) => item.domain_code === domain.code);
            return (
              <tr key={domain.code} className="border-t border-border">
                <td className={cell}>{domain.name}</td>
                <td className={cell}>
                  <select
                    aria-label={`Mức ${domain.name}`}
                    className={FORM_CONTROL_CLASS}
                    disabled={confirmed}
                    value={levels[domain.code] ?? ''}
                    onChange={(event) => setLevels({ ...levels, [domain.code]: Number(event.target.value) })}
                  >
                    <option value="">Chọn mức</option>
                    {(data.data?.levels ?? []).map((level) => (
                      <option key={level.level_no} value={level.level_no}>
                        {level.level_no}. {level.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  {score?.confirmed_level ?? ''}
                  {score?.reason ? ` (${score.reason})` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {confirmed ? null : (
        <div>
          <Button variant="primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Gửi tự đánh giá
          </Button>
        </div>
      )}
      {submit.error ? <Alert tone="danger">{messageOf(submit.error)}</Alert> : null}
      {(data.data?.gaps ?? []).length > 0 ? (
        <div className="flex flex-col gap-1" aria-label="Gợi ý bồi dưỡng">
          <h3 className="text-content font-semibold">Gợi ý bồi dưỡng theo khoảng trống năng lực</h3>
          <ul className="list-disc pl-6 text-content">
            {(data.data?.gaps ?? []).map((gap) => (
              <li key={gap.domain_code}>
                {gap.domain_name} (mức {gap.level}):{' '}
                {gap.topics.length > 0
                  ? gap.topics.map((topic) => topic.name).join('; ')
                  : 'chưa có chuyên đề gắn miền này'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

export function MyTrainingPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const mine = useQuery({ queryKey: ['training-mine'], queryFn: readMyTraining, retry: false });
  const courses = useQuery({ queryKey: ['training-courses'], queryFn: listTrainingCourses });
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['training-mine'] });
    await queryClient.invalidateQueries({ queryKey: ['training-courses'] });
    setToast(message);
  };
  const register = useMutation({
    mutationFn: (id: string) => registerTrainingCourse(id, null),
    onSuccess: () => refresh('Đã đăng ký khoá bồi dưỡng'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelTrainingRegistration(id),
    onSuccess: () => refresh('Đã huỷ đăng ký'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteStaffCertificate(id),
    onSuccess: () => refresh('Đã xoá chứng chỉ'),
  });
  const open = (courses.data ?? []).filter(
    (course) =>
      course.status === 'open' &&
      (!course.my_registration || ['cancelled', 'rejected'].includes(course.my_registration.status)),
  );
  const data = mine.data;
  const error = mine.error ?? register.error ?? cancel.error ?? remove.error;
  return (
    <Page path="/training/mine" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {data ? (
        <Alert tone={data.missing_periods > 0 ? 'info' : 'success'}>
          Năm học {data.year_name}: đã có {data.total_periods}/{data.required_periods} tiết bồi dưỡng
          {data.missing_periods > 0 ? `, còn thiếu ${data.missing_periods} tiết` : ', đã đủ định mức'}
        </Alert>
      ) : null}
      <Section title="Khoá đang mở đăng ký">
        {open.length === 0 ? <p className="text-content text-text-secondary">Không có khoá nào đang mở.</p> : null}
        <table className="w-full text-content" aria-label="Khoá đang mở đăng ký">
          <tbody>
            {open.map((course) => (
              <tr key={course.id} className="border-t border-border">
                <td className={cell}>{course.name}</td>
                <td className={cell}>
                  {formatDate(course.start_date)} – {formatDate(course.end_date)}
                </td>
                <td className={cell}>{course.periods} tiết</td>
                <td className={cell}>
                  {course.registration_deadline ? `Hạn ${formatDate(course.registration_deadline)}` : ''}
                </td>
                <td className={`${cell} text-right`}>
                  <Button disabled={register.isPending} onClick={() => register.mutate(course.id)}>
                    Đăng ký
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Khoá của tôi">
        <table className="w-full text-content" aria-label="Khoá của tôi">
          <thead className={head}>
            <tr>
              <th className={cell}>Khoá</th>
              <th className={cell}>Thời gian</th>
              <th className={cell}>Trạng thái</th>
              <th className={cell}>Kết quả</th>
              <th className={cell}>Tiết ghi nhận</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {(data?.registrations ?? []).map((registration) => (
              <tr key={registration.id} className="border-t border-border">
                <td className={cell}>{registration.course_name}</td>
                <td className={cell}>
                  {formatDate(registration.start_date)} – {formatDate(registration.end_date)}
                </td>
                <td className={cell}>{TRAINING_REGISTRATION_STATUS_LABELS[registration.status]}</td>
                <td className={cell}>{registration.result ? TRAINING_RESULT_LABELS[registration.result] : ''}</td>
                <td className={cell}>{registration.credited_periods ?? ''}</td>
                <td className={`${cell} text-right`}>
                  {registration.status === 'pending' || registration.status === 'team_approved' ? (
                    <Button variant="text" onClick={() => cancel.mutate(registration.id)}>
                      Huỷ đăng ký
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Chứng chỉ, chứng nhận">
        <table className="w-full text-content" aria-label="Chứng chỉ của tôi">
          <thead className={head}>
            <tr>
              <th className={cell}>Tên</th>
              <th className={cell}>Loại</th>
              <th className={cell}>Nơi cấp</th>
              <th className={cell}>Ngày cấp</th>
              <th className={cell}>Hết hạn</th>
              <th className={cell}>Số tiết</th>
              <th className={cell}>Mã tra cứu</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {(data?.certificates ?? []).map((certificate) => (
              <tr key={certificate.id} className="border-t border-border">
                <td className={cell}>{certificate.name}</td>
                <td className={cell}>{STAFF_CERTIFICATE_KIND_LABELS[certificate.kind]}</td>
                <td className={cell}>{certificate.issued_by}</td>
                <td className={cell}>{formatDate(certificate.issued_date)}</td>
                <td className={cell}>
                  {formatDate(certificate.expire_date)}
                  {certificate.expiring_soon ? ' (sắp hết hạn)' : ''}
                </td>
                <td className={cell}>{certificate.periods ?? ''}</td>
                <td className={cell}>
                  {certificate.lookup_code ?? ''}
                  {certificate.revoked_at ? ' (đã thu hồi)' : ''}
                </td>
                <td className={`${cell} text-right`}>
                  {certificate.kind === 'school' && !certificate.revoked_at ? (
                    <Button variant="text" onClick={() => void downloadTrainingCertificate(certificate.id)}>
                      Tải chứng nhận
                    </Button>
                  ) : null}
                  {certificate.kind === 'manual' ? (
                    <Button variant="text" onClick={() => remove.mutate(certificate.id)}>
                      Xoá
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CertificateForm onSaved={setToast} />
      </Section>
      <MyCompetencySection onSaved={setToast} />
    </Page>
  );
}

// ---- 6.2 Khoá bồi dưỡng ----

const EMPTY_COURSE: TrainingCourseInput = {
  name: '',
  topic_id: null,
  organizer_kind: 'school',
  organizer_name: null,
  mode: 'in_person',
  location: null,
  start_date: '',
  end_date: '',
  periods: 0,
  sessions: 1,
  quota: null,
  registration_deadline: null,
  issues_certificate: false,
};

function CourseForm({ onSaved }: { onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ['training-catalog'], queryFn: readTrainingCatalog });
  const [form, setForm] = useState<TrainingCourseInput>(EMPTY_COURSE);
  const save = useMutation({
    mutationFn: () => createTrainingCourse(form),
    onSuccess: async (course) => {
      setForm(EMPTY_COURSE);
      await queryClient.invalidateQueries({ queryKey: ['training-courses'] });
      onSaved(`Đã tạo khoá ${course.name}`);
    },
  });
  const text = (key: keyof TrainingCourseInput) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value || null });
  const number = (key: keyof TrainingCourseInput) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value === '' ? null : Number(event.target.value) });
  return (
    <form
      aria-label="Tạo khoá bồi dưỡng"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Tên khoá">
          <input
            className={FORM_CONTROL_CLASS}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Chuyên đề">
          <select
            className={FORM_CONTROL_CLASS}
            value={form.topic_id ?? ''}
            onChange={(event) => {
              const topic = catalog.data?.topics.find((item) => item.id === event.target.value);
              setForm({
                ...form,
                topic_id: topic?.id ?? null,
                periods: form.periods || topic?.default_periods || 0,
              });
            }}
          >
            <option value="">Không gắn chuyên đề</option>
            {(catalog.data?.topics ?? [])
              .filter((topic) => topic.status === 'active')
              .map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Đơn vị tổ chức">
          <select
            className={FORM_CONTROL_CLASS}
            value={form.organizer_kind}
            onChange={(event) =>
              setForm({
                ...form,
                organizer_kind: event.target.value as TrainingOrganizerKind,
                issues_certificate: event.target.value === 'school' ? form.issues_certificate : false,
              })
            }
          >
            {(Object.keys(TRAINING_ORGANIZER_LABELS) as TrainingOrganizerKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {TRAINING_ORGANIZER_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tên đơn vị tổ chức">
          <input className={FORM_CONTROL_CLASS} value={form.organizer_name ?? ''} onChange={text('organizer_name')} />
        </Field>
        <Field label="Hình thức">
          <select
            className={FORM_CONTROL_CLASS}
            value={form.mode}
            onChange={(event) => setForm({ ...form, mode: event.target.value as TrainingMode })}
          >
            {(Object.keys(TRAINING_MODE_LABELS) as TrainingMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {TRAINING_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Địa điểm">
          <input className={FORM_CONTROL_CLASS} value={form.location ?? ''} onChange={text('location')} />
        </Field>
        <Field label="Từ ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
          />
        </Field>
        <Field label="Đến ngày">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
          />
        </Field>
        <Field label="Hạn đăng ký">
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={form.registration_deadline ?? ''}
            onChange={text('registration_deadline')}
          />
        </Field>
        <Field label="Số tiết">
          <input
            type="number"
            min={1}
            className={FORM_CONTROL_CLASS}
            value={form.periods || ''}
            onChange={number('periods')}
          />
        </Field>
        <Field label="Số buổi">
          <input
            type="number"
            min={1}
            className={FORM_CONTROL_CLASS}
            value={form.sessions || ''}
            onChange={number('sessions')}
          />
        </Field>
        <Field label="Chỉ tiêu">
          <input
            type="number"
            min={1}
            className={FORM_CONTROL_CLASS}
            value={form.quota ?? ''}
            onChange={number('quota')}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-content">
        <input
          type="checkbox"
          checked={form.issues_certificate}
          disabled={form.organizer_kind !== 'school'}
          onChange={(event) => setForm({ ...form, issues_certificate: event.target.checked })}
        />
        Trường cấp chứng nhận cho người đạt
      </label>
      <div>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Tạo khoá
        </Button>
      </div>
      {save.error ? <Alert tone="danger">{messageOf(save.error)}</Alert> : null}
    </form>
  );
}

function CourseDetail({ detail, onSaved }: { detail: TrainingCourseDetail; onSaved(message: string): void }) {
  const queryClient = useQueryClient();
  const { course, can_manage: canManage } = detail;
  const [results, setResults] = useState<
    Record<string, { attended_sessions: string; result: TrainingResult | ''; comment: string }>
  >({});
  const [revoking, setRevoking] = useState<{ id: string; reason: string }>();
  useEffect(() => {
    setResults(
      Object.fromEntries(
        detail.registrations.map((row) => [
          row.id,
          {
            attended_sessions: row.attended_sessions === null ? '' : String(row.attended_sessions),
            result: row.result ?? '',
            comment: row.result_comment ?? '',
          },
        ]),
      ),
    );
  }, [detail]);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['training-course', course.id] });
    await queryClient.invalidateQueries({ queryKey: ['training-courses'] });
    onSaved(message);
  };
  const review = useMutation({
    mutationFn: (input: { id: string; decision: 'approve' | 'reject' }) =>
      reviewTrainingRegistration(input.id, input.decision, null),
    onSuccess: (_data, input) => refresh(input.decision === 'approve' ? 'Đã duyệt đăng ký' : 'Đã không duyệt đăng ký'),
  });
  const status = useMutation({
    mutationFn: (next: 'open' | 'closed' | 'completed') => setTrainingCourseStatus(course.id, next),
    onSuccess: () => refresh('Đã đổi trạng thái khoá'),
  });
  const approved = detail.registrations.filter((row) => row.status === 'approved');
  const saveResults = useMutation({
    mutationFn: () =>
      saveTrainingResults(
        course.id,
        approved.map((row) => {
          const value = results[row.id];
          return {
            registration_id: row.id,
            attended_sessions: value?.attended_sessions ? Number(value.attended_sessions) : null,
            result: value?.result || null,
            comment: value?.comment || null,
          };
        }),
      ),
    onSuccess: () => refresh('Đã ghi kết quả bồi dưỡng'),
  });
  const issue = useMutation({
    mutationFn: () => issueTrainingCertificates(course.id),
    onSuccess: (data) => refresh(`Đã cấp ${data.issued} chứng nhận`),
  });
  const revoke = useMutation({
    mutationFn: (input: { id: string; reason: string }) => revokeTrainingCertificate(input.id, input.reason),
    onSuccess: () => {
      setRevoking(undefined);
      return refresh('Đã thu hồi chứng nhận');
    },
  });
  const reissue = useMutation({
    mutationFn: (id: string) => reissueTrainingCertificate(id),
    onSuccess: () => refresh('Đã cấp lại chứng nhận'),
  });
  const error = review.error ?? status.error ?? saveResults.error ?? issue.error ?? revoke.error ?? reissue.error;
  return (
    <Section title={`Khoá ${course.name}`}>
      <p className="text-content">
        {TRAINING_ORGANIZER_LABELS[course.organizer_kind]}
        {course.organizer_name ? ` (${course.organizer_name})` : ''} · {TRAINING_MODE_LABELS[course.mode]} ·{' '}
        {course.periods} tiết, {course.sessions} buổi · {TRAINING_COURSE_STATUS_LABELS[course.status]}
      </p>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {course.status === 'open' ? <Button onClick={() => status.mutate('closed')}>Đóng đăng ký</Button> : null}
          {course.status === 'closed' ? <Button onClick={() => status.mutate('open')}>Mở lại đăng ký</Button> : null}
          {course.status !== 'completed' ? (
            <Button onClick={() => status.mutate('completed')}>Kết thúc khoá</Button>
          ) : null}
          {course.issues_certificate ? (
            <>
              <Button variant="primary" disabled={issue.isPending} onClick={() => issue.mutate()}>
                Cấp chứng nhận
              </Button>
              <Button onClick={() => void downloadCourseCertificates(course.id)}>Tải chứng nhận (PDF)</Button>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Đăng ký khoá">
        <thead className={head}>
          <tr>
            <th className={cell}>Giáo viên</th>
            <th className={cell}>Tổ</th>
            <th className={cell}>Trạng thái</th>
            <th className={cell}>Số buổi có mặt</th>
            <th className={cell}>Kết quả</th>
            <th className={cell}>Nhận xét</th>
            <th className={cell}>Chứng nhận</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {detail.registrations.map((row) => {
            const value = results[row.id];
            const editable = canManage && row.status === 'approved';
            const reviewable =
              row.can_team_review || (canManage && (row.status === 'pending' || row.status === 'team_approved'));
            return (
              <tr key={row.id} className="border-t border-border">
                <td className={cell}>{row.staff_name}</td>
                <td className={cell}>{row.department_name ?? ''}</td>
                <td className={cell}>
                  <StatusBadge
                    tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'info'}
                    label={TRAINING_REGISTRATION_STATUS_LABELS[row.status]}
                  />
                </td>
                <td className={cell}>
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      aria-label={`Số buổi có mặt của ${row.staff_name}`}
                      className={`${FORM_CONTROL_CLASS} w-20`}
                      value={value?.attended_sessions ?? ''}
                      onChange={(event) =>
                        setResults({ ...results, [row.id]: { ...value!, attended_sessions: event.target.value } })
                      }
                    />
                  ) : (
                    (row.attended_sessions ?? '')
                  )}
                </td>
                <td className={cell}>
                  {editable ? (
                    <select
                      aria-label={`Kết quả của ${row.staff_name}`}
                      className={FORM_CONTROL_CLASS}
                      value={value?.result ?? ''}
                      onChange={(event) =>
                        setResults({
                          ...results,
                          [row.id]: { ...value!, result: event.target.value as TrainingResult | '' },
                        })
                      }
                    >
                      <option value="">Chưa có</option>
                      <option value="passed">{TRAINING_RESULT_LABELS.passed}</option>
                      <option value="failed">{TRAINING_RESULT_LABELS.failed}</option>
                    </select>
                  ) : row.result ? (
                    `${TRAINING_RESULT_LABELS[row.result]} (${row.credited_periods ?? 0} tiết)`
                  ) : (
                    ''
                  )}
                </td>
                <td className={cell}>
                  {editable ? (
                    <input
                      aria-label={`Nhận xét của ${row.staff_name}`}
                      className={FORM_CONTROL_CLASS}
                      value={value?.comment ?? ''}
                      onChange={(event) =>
                        setResults({ ...results, [row.id]: { ...value!, comment: event.target.value } })
                      }
                    />
                  ) : (
                    (row.result_comment ?? '')
                  )}
                </td>
                <td className={cell}>{row.certificate?.lookup_code ?? ''}</td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  {reviewable ? (
                    <>
                      <Button variant="text" onClick={() => review.mutate({ id: row.id, decision: 'approve' })}>
                        Duyệt
                      </Button>
                      <Button variant="text" onClick={() => review.mutate({ id: row.id, decision: 'reject' })}>
                        Không duyệt
                      </Button>
                    </>
                  ) : null}
                  {canManage && row.certificate ? (
                    <>
                      <Button variant="text" onClick={() => setRevoking({ id: row.certificate!.id, reason: '' })}>
                        Thu hồi
                      </Button>
                      <Button variant="text" onClick={() => reissue.mutate(row.certificate!.id)}>
                        Cấp lại
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {revoking ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Lý do thu hồi">
            <input
              className={FORM_CONTROL_CLASS}
              value={revoking.reason}
              onChange={(event) => setRevoking({ ...revoking, reason: event.target.value })}
            />
          </Field>
          <Button variant="primary" onClick={() => revoke.mutate(revoking)}>
            Xác nhận thu hồi
          </Button>
          <Button variant="text" onClick={() => setRevoking(undefined)}>
            Bỏ qua
          </Button>
        </div>
      ) : null}
      {canManage && approved.length > 0 ? (
        <div>
          <Button variant="primary" disabled={saveResults.isPending} onClick={() => saveResults.mutate()}>
            Ghi kết quả
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

export function TrainingCoursesPage() {
  const canManage = useHasPermission(PERMISSION_CODES.trainingManage);
  const { toast, setToast, close } = useToast();
  const [opened, setOpened] = useState<string>();
  const courses = useQuery({ queryKey: ['training-courses'], queryFn: listTrainingCourses });
  const detail = useQuery({
    queryKey: ['training-course', opened],
    queryFn: () => readTrainingCourse(opened ?? ''),
    enabled: Boolean(opened),
  });
  return (
    <Page path="/training/courses" toast={toast} onToastClose={close}>
      {courses.error ? <Alert tone="danger">{messageOf(courses.error)}</Alert> : null}
      <table className="w-full text-content" aria-label="Khoá bồi dưỡng">
        <thead className={head}>
          <tr>
            <th className={cell}>Tên khoá</th>
            <th className={cell}>Chuyên đề</th>
            <th className={cell}>Thời gian</th>
            <th className={cell}>Số tiết</th>
            <th className={cell}>Đăng ký</th>
            <th className={cell}>Trạng thái</th>
            <th className={cell} />
          </tr>
        </thead>
        <tbody>
          {(courses.data ?? []).map((course) => (
            <tr key={course.id} className="border-t border-border">
              <td className={cell}>{course.name}</td>
              <td className={cell}>
                {course.topic_name ?? ''}
                {course.program_no ? ` (${TRAINING_PROGRAM_LABELS[course.program_no]})` : ''}
              </td>
              <td className={cell}>
                {formatDate(course.start_date)} – {formatDate(course.end_date)}
              </td>
              <td className={cell}>{course.periods}</td>
              <td className={cell}>
                {course.approved}/{course.registered}
                {course.quota ? ` (chỉ tiêu ${course.quota})` : ''}
              </td>
              <td className={cell}>{TRAINING_COURSE_STATUS_LABELS[course.status]}</td>
              <td className={`${cell} text-right`}>
                <Button variant="text" onClick={() => setOpened(course.id)}>
                  Mở
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.data ? <CourseDetail detail={detail.data} onSaved={setToast} /> : null}
      {canManage ? (
        <Section title="Tạo khoá bồi dưỡng">
          <CourseForm onSaved={setToast} />
        </Section>
      ) : null}
    </Page>
  );
}

// ---- 6.3 Hồ sơ bồi dưỡng ----

export function TrainingRecordsPage() {
  const records = useQuery({ queryKey: ['training-records'], queryFn: readTrainingRecords });
  const data = records.data;
  return (
    <Page path="/training/records">
      {records.error ? <Alert tone="danger">{messageOf(records.error)}</Alert> : null}
      {data ? (
        <>
          <p className="text-content">
            Năm học {data.year_name}; định mức {data.required_periods} tiết; kế hoạch: {data.plan.completed}/
            {data.plan.courses} khoá đã kết thúc
          </p>
          <table className="w-full text-content" aria-label="Hoàn thành định mức theo tổ">
            <thead className={head}>
              <tr>
                <th className={cell}>Tổ</th>
                <th className={cell}>Số người</th>
                <th className={cell}>Đủ định mức</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((row) => (
                <tr key={row.department_id ?? 'none'} className="border-t border-border">
                  <td className={cell}>{row.department_name ?? 'Chưa xếp tổ'}</td>
                  <td className={cell}>{row.staff}</td>
                  <td className={cell}>{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-content" aria-label="Hồ sơ bồi dưỡng theo cá nhân">
            <thead className={head}>
              <tr>
                <th className={cell}>Cán bộ, giáo viên</th>
                <th className={cell}>Tổ</th>
                <th className={cell}>Số khoá đạt</th>
                <th className={cell}>Tiết từ khoá</th>
                <th className={cell}>Tiết từ chứng chỉ</th>
                <th className={cell}>Tổng tiết</th>
                <th className={cell}>Còn thiếu</th>
                <th className={cell}>Chứng chỉ sắp hết hạn</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.staff_id} className="border-t border-border">
                  <td className={cell}>{row.full_name}</td>
                  <td className={cell}>{row.department_name ?? ''}</td>
                  <td className={cell}>{row.courses}</td>
                  <td className={cell}>{row.course_periods}</td>
                  <td className={cell}>{row.manual_periods}</td>
                  <td className={cell}>{row.total_periods}</td>
                  <td className={cell}>{row.missing_periods > 0 ? row.missing_periods : 'Đủ'}</td>
                  <td className={cell}>{row.expiring_certificates || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </Page>
  );
}

// ---- 6.4 Năng lực số ----

function ConfirmForm({
  row,
  table,
  onDone,
}: {
  row: CompetencyTable['rows'][number];
  table: CompetencyTable;
  onDone(message: string): void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, { level: number; reason: string }>>(
    Object.fromEntries(
      row.scores.map((score) => [
        score.domain_code,
        { level: score.confirmed_level ?? score.self_level, reason: score.reason ?? '' },
      ]),
    ),
  );
  const confirm = useMutation({
    mutationFn: () =>
      confirmCompetency(
        row.id,
        Object.entries(values).map(([domain_code, value]) => ({
          domain_code,
          level: value.level,
          reason: value.reason || null,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['training-competency'] });
      onDone(`Đã xác nhận năng lực số của ${row.staff_name}`);
    },
  });
  return (
    <Section title={`Xác nhận năng lực số của ${row.staff_name}`}>
      <table className="w-full text-content">
        <thead className={head}>
          <tr>
            <th className={cell}>Miền</th>
            <th className={cell}>Tự đánh giá</th>
            <th className={cell}>Mức xác nhận</th>
            <th className={cell}>Lý do đổi mức</th>
          </tr>
        </thead>
        <tbody>
          {row.scores.map((score) => {
            const value = values[score.domain_code];
            return (
              <tr key={score.domain_code} className="border-t border-border">
                <td className={cell}>{score.domain_name}</td>
                <td className={cell}>{score.self_level}</td>
                <td className={cell}>
                  <select
                    aria-label={`Mức xác nhận ${score.domain_name}`}
                    className={FORM_CONTROL_CLASS}
                    value={value?.level ?? score.self_level}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [score.domain_code]: { level: Number(event.target.value), reason: value?.reason ?? '' },
                      })
                    }
                  >
                    {table.levels.map((level) => (
                      <option key={level.level_no} value={level.level_no}>
                        {level.level_no}. {level.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <input
                    aria-label={`Lý do ${score.domain_name}`}
                    className={FORM_CONTROL_CLASS}
                    value={value?.reason ?? ''}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [score.domain_code]: { level: value?.level ?? score.self_level, reason: event.target.value },
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div>
        <Button variant="primary" disabled={confirm.isPending} onClick={() => confirm.mutate()}>
          Xác nhận
        </Button>
      </div>
      {confirm.error ? <Alert tone="danger">{messageOf(confirm.error)}</Alert> : null}
    </Section>
  );
}

export function CompetencyPage() {
  const { toast, setToast, close } = useToast();
  const [term, setTerm] = useState<CompetencyTerm>('year');
  const [opened, setOpened] = useState<string>();
  const table = useQuery({ queryKey: ['training-competency', term], queryFn: () => readCompetencyTable(term) });
  const data = table.data;
  const levelOf = (row: CompetencyTable['rows'][number], code: string) => {
    const score = row.scores.find((item) => item.domain_code === code);
    return score ? (score.confirmed_level ?? score.self_level) : null;
  };
  const tone = (level: number | null) =>
    level === null ? '' : level < (data?.gap_level ?? 2) ? 'bg-danger/10' : 'bg-success/10';
  const row = data?.rows.find((item) => item.id === opened);
  return (
    <Page path="/training/competency" toast={toast} onToastClose={close}>
      <Tabs<CompetencyTerm> label="Kỳ đánh giá" value={term} options={TERM_OPTIONS} onChange={setTerm} />
      {table.error ? <Alert tone="danger">{messageOf(table.error)}</Alert> : null}
      {data ? (
        <div className="overflow-x-auto">
          <table className="text-content" aria-label="Bản đồ năng lực số">
            <thead className={head}>
              <tr>
                <th className={cell}>Cán bộ, giáo viên</th>
                <th className={cell}>Tổ</th>
                {data.domains.map((domain) => (
                  <th key={domain.code} className={cell}>
                    {domain.name}
                  </th>
                ))}
                <th className={cell}>Trạng thái</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className={cell}>{item.staff_name}</td>
                  <td className={cell}>{item.department_name ?? ''}</td>
                  {data.domains.map((domain) => {
                    const level = levelOf(item, domain.code);
                    return (
                      <td key={domain.code} className={`${cell} text-center ${tone(level)}`}>
                        {level ?? ''}
                      </td>
                    );
                  })}
                  <td className={cell}>{item.status === 'confirmed' ? 'Đã xác nhận' : 'Chờ xác nhận'}</td>
                  <td className={`${cell} text-right`}>
                    {item.status === 'submitted' ? (
                      <Button variant="text" onClick={() => setOpened(item.id)}>
                        Xác nhận
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className={cell}>Trung bình</td>
                <td className={cell} />
                {data.domains.map((domain) => (
                  <td key={domain.code} className={`${cell} text-center`}>
                    {data.averages.find((average) => average.domain_code === domain.code)?.average ?? ''}
                  </td>
                ))}
                <td className={cell} />
                <td className={cell} />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {row && data ? (
        <ConfirmForm
          key={row.id}
          row={row}
          table={data}
          onDone={(message) => {
            setOpened(undefined);
            setToast(message);
          }}
        />
      ) : null}
    </Page>
  );
}

// ---- 6.5 Danh mục bồi dưỡng ----

export function TrainingSettingsPage() {
  const queryClient = useQueryClient();
  const { toast, setToast, close } = useToast();
  const catalog = useQuery({ queryKey: ['training-catalog'], queryFn: readTrainingCatalog });
  const [settings, setSettings] = useState({
    annual_required_periods: '',
    competency_gap_level: '',
    certificate_issuer: '',
  });
  const [topic, setTopic] = useState({
    code: '',
    name: '',
    program_no: '3',
    default_periods: '',
    competency_domain_code: '',
  });
  const [domain, setDomain] = useState({ code: '', name: '', description: '' });
  useEffect(() => {
    const current = catalog.data?.settings;
    if (current) {
      setSettings({
        annual_required_periods: String(current.annual_required_periods),
        competency_gap_level: String(current.competency_gap_level),
        certificate_issuer: current.certificate_issuer ?? '',
      });
    }
  }, [catalog.data]);
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['training-catalog'] });
    setToast(message);
  };
  const saveSettings = useMutation({
    mutationFn: () =>
      saveTrainingSettings({
        annual_required_periods: Number(settings.annual_required_periods),
        competency_gap_level: Number(settings.competency_gap_level),
        certificate_issuer: settings.certificate_issuer || null,
      }),
    onSuccess: () => refresh('Đã ghi thiết lập bồi dưỡng'),
  });
  const addTopic = useMutation({
    mutationFn: () =>
      saveTrainingTopic(null, {
        code: topic.code,
        name: topic.name,
        program_no: Number(topic.program_no),
        default_periods: topic.default_periods ? Number(topic.default_periods) : 0,
        competency_domain_code: topic.competency_domain_code || null,
      }),
    onSuccess: async () => {
      setTopic({ code: '', name: '', program_no: '3', default_periods: '', competency_domain_code: '' });
      await refresh('Đã thêm chuyên đề');
    },
  });
  const toggleTopic = useMutation({
    mutationFn: (input: { id: string; status: 'active' | 'inactive' }) =>
      saveTrainingTopic(input.id, { status: input.status }),
    onSuccess: () => refresh('Đã đổi trạng thái chuyên đề'),
  });
  const addDomain = useMutation({
    mutationFn: () =>
      saveCompetencyDomain(null, { code: domain.code, name: domain.name, description: domain.description || null }),
    onSuccess: async () => {
      setDomain({ code: '', name: '', description: '' });
      await refresh('Đã thêm miền năng lực');
    },
  });
  const error = catalog.error ?? saveSettings.error ?? addTopic.error ?? toggleTopic.error ?? addDomain.error;
  return (
    <Page path="/training/settings" toast={toast} onToastClose={close}>
      {error ? <Alert tone="danger">{messageOf(error)}</Alert> : null}
      {catalog.data?.settings.legal_basis ? (
        <p className="text-content text-text-secondary">Căn cứ: {catalog.data.settings.legal_basis}</p>
      ) : null}
      <Section title="Thiết lập">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Định mức tiết mỗi năm học">
            <input
              type="number"
              min={0}
              className={FORM_CONTROL_CLASS}
              value={settings.annual_required_periods}
              onChange={(event) => setSettings({ ...settings, annual_required_periods: event.target.value })}
            />
          </Field>
          <Field label="Ngưỡng mức năng lực gợi ý bồi dưỡng">
            <input
              type="number"
              min={1}
              className={FORM_CONTROL_CLASS}
              value={settings.competency_gap_level}
              onChange={(event) => setSettings({ ...settings, competency_gap_level: event.target.value })}
            />
          </Field>
          <Field label="Đơn vị cấp in trên chứng nhận">
            <input
              className={FORM_CONTROL_CLASS}
              value={settings.certificate_issuer}
              onChange={(event) => setSettings({ ...settings, certificate_issuer: event.target.value })}
            />
          </Field>
          <Button variant="primary" onClick={() => saveSettings.mutate()}>
            Ghi thiết lập
          </Button>
        </div>
      </Section>
      <Section title="Chuyên đề bồi dưỡng">
        <table className="w-full text-content" aria-label="Chuyên đề bồi dưỡng">
          <thead className={head}>
            <tr>
              <th className={cell}>Mã</th>
              <th className={cell}>Tên</th>
              <th className={cell}>Chương trình</th>
              <th className={cell}>Số tiết</th>
              <th className={cell}>Miền năng lực</th>
              <th className={cell}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(catalog.data?.topics ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className={cell}>{item.code}</td>
                <td className={cell}>{item.name}</td>
                <td className={cell}>{TRAINING_PROGRAM_LABELS[item.program_no]}</td>
                <td className={cell}>{item.default_periods}</td>
                <td className={cell}>{item.competency_domain_code ?? ''}</td>
                <td className={cell}>
                  <Button
                    variant="text"
                    onClick={() =>
                      toggleTopic.mutate({ id: item.id, status: item.status === 'active' ? 'inactive' : 'active' })
                    }
                  >
                    {item.status === 'active' ? 'Đang dùng' : 'Ngừng dùng'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          aria-label="Thêm chuyên đề"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addTopic.mutate();
          }}
        >
          <Field label="Mã chuyên đề">
            <input
              className={FORM_CONTROL_CLASS}
              value={topic.code}
              onChange={(event) => setTopic({ ...topic, code: event.target.value })}
            />
          </Field>
          <Field label="Tên chuyên đề">
            <input
              className={FORM_CONTROL_CLASS}
              value={topic.name}
              onChange={(event) => setTopic({ ...topic, name: event.target.value })}
            />
          </Field>
          <Field label="Chương trình">
            <select
              className={FORM_CONTROL_CLASS}
              value={topic.program_no}
              onChange={(event) => setTopic({ ...topic, program_no: event.target.value })}
            >
              {[1, 2, 3].map((program) => (
                <option key={program} value={program}>
                  {TRAINING_PROGRAM_LABELS[program]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số tiết mặc định">
            <input
              type="number"
              min={0}
              className={FORM_CONTROL_CLASS}
              value={topic.default_periods}
              onChange={(event) => setTopic({ ...topic, default_periods: event.target.value })}
            />
          </Field>
          <Field label="Gắn miền năng lực số">
            <select
              className={FORM_CONTROL_CLASS}
              value={topic.competency_domain_code}
              onChange={(event) => setTopic({ ...topic, competency_domain_code: event.target.value })}
            >
              <option value="">Không gắn</option>
              {(catalog.data?.domains ?? []).map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="primary">
            Thêm chuyên đề
          </Button>
        </form>
      </Section>
      <Section title="Khung năng lực số">
        <ul className="list-disc pl-6 text-content">
          {(catalog.data?.levels ?? []).map((level) => (
            <li key={level.level_no}>
              Mức {level.level_no}. {level.name}
              {level.description ? `: ${level.description}` : ''}
            </li>
          ))}
        </ul>
        <table className="w-full text-content" aria-label="Miền năng lực số">
          <thead className={head}>
            <tr>
              <th className={cell}>Mã</th>
              <th className={cell}>Miền</th>
              <th className={cell}>Mô tả</th>
            </tr>
          </thead>
          <tbody>
            {(catalog.data?.domains ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className={cell}>{item.code}</td>
                <td className={cell}>{item.name}</td>
                <td className={cell}>{item.description ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          aria-label="Thêm miền năng lực"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addDomain.mutate();
          }}
        >
          <Field label="Mã miền">
            <input
              className={FORM_CONTROL_CLASS}
              value={domain.code}
              onChange={(event) => setDomain({ ...domain, code: event.target.value })}
            />
          </Field>
          <Field label="Tên miền">
            <input
              className={FORM_CONTROL_CLASS}
              value={domain.name}
              onChange={(event) => setDomain({ ...domain, name: event.target.value })}
            />
          </Field>
          <Field label="Mô tả">
            <input
              className={FORM_CONTROL_CLASS}
              value={domain.description}
              onChange={(event) => setDomain({ ...domain, description: event.target.value })}
            />
          </Field>
          <Button type="submit" variant="primary">
            Thêm miền
          </Button>
        </form>
      </Section>
    </Page>
  );
}

// ---- Trang tra cứu chứng nhận công khai ----

function initialCode(): string {
  return new URLSearchParams(window.location.search).get('ma')?.trim().toUpperCase() ?? '';
}

export function VerifyTrainingCertificatePage() {
  const [input, setInput] = useState(initialCode);
  const [code, setCode] = useState(initialCode);
  const result = useQuery({
    queryKey: ['training-verify', code],
    queryFn: () => verifyTrainingCertificate(code),
    enabled: code.length > 0,
    retry: false,
  });
  const data = result.data;
  const row = (label: string, value: string | number | null | undefined) => (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-2 md:grid-cols-[12rem_1fr]">
      <dt className="text-label font-medium text-text-secondary">{label}</dt>
      <dd className="break-all text-content text-text">{value ?? ''}</dd>
    </div>
  );
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 bg-page p-4">
      <h1 className="text-page-title font-bold text-text">Tra cứu chứng nhận bồi dưỡng</h1>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCode(input.trim().toUpperCase());
        }}
      >
        <label className="flex flex-col gap-1 text-label font-medium text-text">
          Mã tra cứu
          <input className={FORM_CONTROL_CLASS} value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <Button type="submit" variant="primary">
          Tra cứu
        </Button>
      </form>
      {result.error ? <Alert tone="danger">{messageOf(result.error)}</Alert> : null}
      {data ? (
        <section aria-label="Kết quả tra cứu" className="rounded-xl border border-border bg-card p-4">
          {data.status === 'valid' ? (
            <Alert tone="success">Chứng nhận còn hiệu lực</Alert>
          ) : (
            <Alert tone="danger">Chứng nhận đã bị thu hồi</Alert>
          )}
          <dl>
            {row('Người được cấp', data.staff_name)}
            {row('Khoá bồi dưỡng', data.course_name)}
            {row('Đơn vị cấp', data.issued_by)}
            {row('Ngày cấp', formatDate(data.issued_date))}
            {row('Số tiết', data.periods)}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
