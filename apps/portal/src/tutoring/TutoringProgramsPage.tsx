import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TUTORING_AUDIENCE_LABELS,
  TUTORING_CANCEL_REFUND_LABELS,
  TUTORING_CONTENT_TYPE_HELP,
  TUTORING_FEE_BASIS_LABELS,
  TUTORING_FUNDING_SOURCE_LABELS,
  TUTORING_NO_FEE_BASIS,
  type TutoringCancelRefund,
  type TutoringFeeBasis,
  type TutoringFundingSource,
  TUTORING_CONTENT_TYPE_LABELS,
  TUTORING_DELIVERY_LABELS,
  TUTORING_PROGRAM_STATUS_LABELS,
  TUTORING_REGISTRATION_STATUS_LABELS,
  type SchoolLevelCode,
  type TutoringAudience,
  type TutoringContentType,
  type TutoringDelivery,
} from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { ApiError } from '../session/api-client.js';
import { tutoringApi, type ProgramDetail } from './tutoring-api.js';

// 1. Chương trình gia sư (DT-27 phần 27b, YCTD-252): giáo viên lập chương trình (loại nội dung bắt buộc, có giải thích ngay trên màn
// hình), nộp; Ban Giám hiệu duyệt; giáo viên xếp buổi lặp theo tuần, xác nhận danh sách học sinh (gợi ý từ sổ điểm), duyệt đơn của cha
// mẹ, nhắn cha mẹ. Mọi khóa của Thông tư 29/2024 sửa bởi Thông tư 19/2026 kiểm ở máy chủ; màn hình hiện lý do khi bị chặn
export function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details?.map((detail) => detail.message).filter(Boolean) ?? [];
    return details.length > 0 ? details.join('; ') : error.message;
  }
  return 'Không thực hiện được, vui lòng thử lại';
}

const LEVELS: SchoolLevelCode[] = ['TH', 'THCS', 'THPT'];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const emptyForm = () => ({
  name: '',
  school_level: 'THCS' as SchoolLevelCode,
  subject_id: '',
  topic: '',
  content_type: 'curriculum' as TutoringContentType,
  audience: 'below_standard' as TutoringAudience | '',
  charges_fee: false,
  delivery: 'live_video' as TutoringDelivery,
  description: '',
  registration_form:
    'Tôi là cha mẹ (người giám hộ) của học sinh, tự nguyện đăng ký cho con tham gia chương trình này theo lịch nhà trường thông báo.',
  max_students: '',
  starts_on: today(),
  ends_on: today(),
  class_ids: [] as string[],
  fee_basis: 'per_session' as TutoringFeeBasis,
  fee_amount: '',
  cancel_refund: 'deduct_next' as TutoringCancelRefund,
  pay_rate_per_period: '',
  funding_source: 'school_budget' as TutoringFundingSource,
});

const money = (amount: string | number) => `${Number(amount).toLocaleString('vi-VN')} đ`;

function ProgramDetailPanel({
  id,
  onChanged,
  notify,
}: {
  id: string;
  onChanged: () => void;
  notify: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['tutoring-program', id], queryFn: () => tutoringApi.program(id) });
  const [error, setError] = useState<string>();
  const [weekly, setWeekly] = useState({
    weekdays: [] as number[],
    from: '',
    to: '',
    start_time: '17:00',
    end_time: '17:45',
    location: '',
  });
  const [suggested, setSuggested] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messageChild, setMessageChild] = useState('');
  const [messageText, setMessageText] = useState('');
  const program: ProgramDetail | undefined = detail.data;
  useEffect(() => {
    if (program) {
      setSelected(program.candidates.map((candidate) => candidate.id));
      setWeekly((current) => ({
        ...current,
        from: current.from || program.starts_on,
        to: current.to || program.ends_on,
      }));
    }
  }, [program]);
  const run = useMutation({
    mutationFn: async (work: () => Promise<string>) => work(),
    onSuccess: async (text) => {
      setError(undefined);
      notify(text);
      await queryClient.invalidateQueries({ queryKey: ['tutoring-program', id] });
      onChanged();
    },
    onError: (caught) => setError(messageOf(caught)),
  });
  if (!program) {
    return detail.error ? <Alert tone="danger">{messageOf(detail.error)}</Alert> : null;
  }
  const act = (action: 'submit' | 'approve' | 'reject' | 'close') =>
    run.mutate(async () => {
      const reason = action === 'reject' ? (window.prompt('Lý do không duyệt') ?? '') : undefined;
      await tutoringApi.transition(id, action, reason);
      return 'Đã cập nhật trạng thái chương trình';
    });
  return (
    <section
      aria-label={`Chương trình ${program.name}`}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      <h2 className="text-section-title font-semibold">{program.name}</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-content">
        {TUTORING_CONTENT_TYPE_LABELS[program.content_type]}
        {program.audience ? ` · ${TUTORING_AUDIENCE_LABELS[program.audience]}` : ''} ·{' '}
        {TUTORING_PROGRAM_STATUS_LABELS[program.status]}
        {program.content_type === 'curriculum'
          ? ' · Không thu tiền (Thông tư 29)'
          : program.charges_fee
            ? program.fee_basis && program.fee_amount
              ? ` · Thu ${money(program.fee_amount)} ${program.fee_basis === 'per_session' ? 'mỗi buổi' : 'trọn gói'}`
              : ' · Có thu tiền, chưa đặt giá'
            : ' · Không thu tiền'}
      </p>
      <p className="text-label text-text-secondary">
        Thù lao giáo viên:{' '}
        {program.pay_rate_per_period ? `${money(program.pay_rate_per_period)} mỗi tiết` : 'chưa đặt đơn giá'} · Nguồn
        chi: {TUTORING_FUNDING_SOURCE_LABELS[program.funding_source]}
        {program.charges_fee ? ` · Buổi hủy: ${TUTORING_CANCEL_REFUND_LABELS[program.cancel_refund]}` : ''}
      </p>
      {program.reject_reason ? <Alert tone="warning">Lý do không duyệt: {program.reject_reason}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {program.can_teach && ['draft', 'rejected'].includes(program.status) ? (
          <Button onClick={() => act('submit')}>Nộp duyệt</Button>
        ) : null}
        {program.can_manage && program.status === 'submitted' ? (
          <>
            <Button variant="primary" onClick={() => act('approve')}>
              Duyệt chương trình
            </Button>
            <Button onClick={() => act('reject')}>Không duyệt</Button>
          </>
        ) : null}
        {program.can_manage && program.status === 'approved' ? (
          <Button onClick={() => act('close')}>Đóng chương trình</Button>
        ) : null}
      </div>

      <h3 className="font-semibold">Học sinh được đăng ký</h3>
      <p className="text-label text-text-secondary">
        Để trống là mọi học sinh của lớp đối tượng; có danh sách thì chỉ học sinh trong danh sách đăng ký được.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            run.mutate(async () => {
              const rows = await tutoringApi.suggestions(id);
              setSuggested(rows);
              setSelected((current) => [...new Set([...current, ...rows.map((row) => row.id)])]);
              return `Gợi ý ${rows.length} học sinh chưa đạt môn ở kỳ gần nhất`;
            })
          }
        >
          Gợi ý từ sổ điểm
        </Button>
        <Button
          onClick={() =>
            run.mutate(async () => {
              await tutoringApi.setCandidates(
                id,
                selected,
                suggested.map((row) => row.id),
              );
              return 'Đã xác nhận danh sách học sinh';
            })
          }
        >
          Xác nhận danh sách
        </Button>
      </div>
      <ul aria-label="Danh sách học sinh của chương trình" className="flex flex-wrap gap-3">
        {[...new Map([...program.candidates, ...suggested].map((child) => [child.id, child])).values()].map((child) => (
          <li key={child.id}>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selected.includes(child.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? [...selected, child.id] : selected.filter((item) => item !== child.id),
                  )
                }
              />
              {child.full_name}
            </label>
          </li>
        ))}
      </ul>

      <h3 className="font-semibold">Buổi học</h3>
      <form
        aria-label="Xếp buổi học lặp theo tuần"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run.mutate(async () => {
            const result = await tutoringApi.createSessions(id, {
              weekly: { from: weekly.from, to: weekly.to, weekdays: weekly.weekdays },
              start_time: weekly.start_time,
              end_time: weekly.end_time,
              location: weekly.location,
            });
            return `Đã xếp ${result.count} buổi, mỗi buổi ${result.periods} tiết`;
          });
        }}
      >
        <fieldset className="flex gap-2">
          <legend className="text-label">Các thứ trong tuần</legend>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <label key={day} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={weekly.weekdays.includes(day)}
                onChange={(event) =>
                  setWeekly({
                    ...weekly,
                    weekdays: event.target.checked
                      ? [...weekly.weekdays, day]
                      : weekly.weekdays.filter((item) => item !== day),
                  })
                }
              />
              {day === 7 ? 'CN' : `T${day + 1}`}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col text-label">
          Từ ngày
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={weekly.from}
            onChange={(event) => setWeekly({ ...weekly, from: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          Đến ngày
          <input
            type="date"
            className={FORM_CONTROL_CLASS}
            value={weekly.to}
            onChange={(event) => setWeekly({ ...weekly, to: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          Bắt đầu
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={weekly.start_time}
            onChange={(event) => setWeekly({ ...weekly, start_time: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          Kết thúc
          <input
            type="time"
            className={FORM_CONTROL_CLASS}
            value={weekly.end_time}
            onChange={(event) => setWeekly({ ...weekly, end_time: event.target.value })}
          />
        </label>
        <label className="flex flex-col text-label">
          Địa điểm
          <input
            className={FORM_CONTROL_CLASS}
            value={weekly.location}
            onChange={(event) => setWeekly({ ...weekly, location: event.target.value })}
          />
        </label>
        <Button type="submit">Xếp buổi</Button>
      </form>
      <table aria-label="Buổi học của chương trình" className="w-full text-content">
        <tbody>
          {program.sessions.map((session) => (
            <tr key={session.id}>
              <td>{session.session_date}</td>
              <td>
                {session.start_time}–{session.end_time}
              </td>
              <td>{session.periods} tiết</td>
              <td>{session.location ?? ''}</td>
              <td>{session.status === 'cancelled' ? `Đã hủy: ${session.cancel_reason ?? ''}` : 'Đã xếp'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="font-semibold">Đơn đăng ký của cha mẹ</h3>
      <table aria-label="Đơn đăng ký" className="w-full text-content">
        <tbody>
          {program.registrations.map((registration) => (
            <tr key={registration.id}>
              <td>{registration.child_name}</td>
              <td>{registration.guardian_name}</td>
              <td>{TUTORING_REGISTRATION_STATUS_LABELS[registration.status]}</td>
              <td className="flex gap-2">
                {registration.status === 'pending' ? (
                  <>
                    <Button
                      onClick={() =>
                        run.mutate(async () => {
                          await tutoringApi.decide(registration.id, true);
                          return `Đã duyệt đơn của ${registration.child_name}`;
                        })
                      }
                    >
                      Duyệt đơn {registration.child_name}
                    </Button>
                    <Button
                      onClick={() =>
                        run.mutate(async () => {
                          await tutoringApi.decide(registration.id, false, window.prompt('Lý do không duyệt') ?? '');
                          return 'Đã ghi không duyệt';
                        })
                      }
                    >
                      Không duyệt
                    </Button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        aria-label="Nhắn cha mẹ"
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run.mutate(async () => {
            await tutoringApi.message(id, messageChild, messageText);
            setMessageText('');
            return 'Đã gửi tin nhắn tới cha mẹ';
          });
        }}
      >
        <p className="text-label text-text-secondary">
          Tin nhắn của chương trình luôn gửi tới cha mẹ của học sinh (luồng Trao đổi), không có luồng riêng với học
          sinh.
        </p>
        <label className="flex flex-col text-label">
          Học sinh
          <select
            className={FORM_CONTROL_CLASS}
            value={messageChild}
            onChange={(event) => setMessageChild(event.target.value)}
          >
            <option value="">Chọn học sinh</option>
            {program.registrations
              .filter((registration) => registration.status === 'pending' || registration.status === 'approved')
              .map((registration) => (
                <option key={registration.child_id} value={registration.child_id}>
                  {registration.child_name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col text-label">
          Nội dung
          <textarea
            className={FORM_CONTROL_CLASS}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={!messageChild || !messageText}>
          Gửi cha mẹ
        </Button>
      </form>
    </section>
  );
}

export function TutoringProgramsPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const meta = useQuery({ queryKey: ['tutoring-meta'], queryFn: tutoringApi.meta });
  const programs = useQuery({ queryKey: ['tutoring-programs'], queryFn: tutoringApi.programs });
  const [form, setForm] = useState(emptyForm());
  const [open, setOpen] = useState<string>();
  const charging = form.content_type === 'enrichment' && form.charges_fee;
  const create = useMutation({
    mutationFn: () =>
      tutoringApi.createProgram({
        ...form,
        subject_id: form.subject_id || null,
        audience: form.audience || null,
        charges_fee: form.content_type === 'curriculum' ? false : form.charges_fee,
        max_students: form.max_students ? Number(form.max_students) : null,
        // Giá chỉ gửi khi chương trình bổ trợ có thu; môn học trong trường luôn chi từ kinh phí của trường (YCTD-253)
        fee_basis: charging ? form.fee_basis : null,
        fee_amount: charging && form.fee_amount ? Number(form.fee_amount) : null,
        pay_rate_per_period: form.pay_rate_per_period ? Number(form.pay_rate_per_period) : null,
        funding_source: form.content_type === 'curriculum' ? 'school_budget' : form.funding_source,
      }),
    onSuccess: async (created) => {
      setToastMessage('Đã lập chương trình (nháp)');
      setForm(emptyForm());
      setOpen(created.id);
      await queryClient.invalidateQueries({ queryKey: ['tutoring-programs'] });
    },
  });
  const subjects = meta.data?.subjects.filter((subject) => subject.school_level === form.school_level) ?? [];
  const classes = meta.data?.classes.filter((item) => item.school_level === form.school_level) ?? [];
  const blocked =
    meta.data?.rules.curriculumBlockedLevels.includes(form.school_level) && form.content_type === 'curriculum';
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/tutoring')}</h1>
        {programs.error ? <Alert tone="danger">{messageOf(programs.error)}</Alert> : null}
        <table aria-label="Chương trình gia sư" className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th>Tên</th>
              <th>Cấp</th>
              <th>Môn</th>
              <th>Loại nội dung</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(programs.data ?? []).map((program) => (
              <tr key={program.id}>
                <td>{program.name}</td>
                <td>{program.school_level}</td>
                <td>{program.subject_name ?? ''}</td>
                <td>{program.content_type === 'curriculum' ? 'Môn học (Thông tư 29)' : 'Bổ trợ'}</td>
                <td>
                  {program.starts_on} – {program.ends_on}
                </td>
                <td>{TUTORING_PROGRAM_STATUS_LABELS[program.status]}</td>
                <td>
                  <Button onClick={() => setOpen(open === program.id ? undefined : program.id)}>
                    Xem {program.name}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {open ? (
          <ProgramDetailPanel
            id={open}
            notify={setToastMessage}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['tutoring-programs'] })}
          />
        ) : null}

        <form
          aria-label="Lập chương trình gia sư"
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <h2 className="text-section-title font-semibold">Lập chương trình</h2>
          {create.error ? <Alert tone="danger">{messageOf(create.error)}</Alert> : null}
          <label className="flex flex-col text-label">
            Tên chương trình
            <input
              className={FORM_CONTROL_CLASS}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-label font-medium">Loại nội dung (bắt buộc)</legend>
            {(Object.keys(TUTORING_CONTENT_TYPE_LABELS) as TutoringContentType[]).map((type) => (
              <label key={type} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="content_type"
                  checked={form.content_type === type}
                  onChange={() =>
                    setForm({ ...form, content_type: type, audience: type === 'curriculum' ? 'below_standard' : '' })
                  }
                />
                <span>
                  <span className="font-medium">{TUTORING_CONTENT_TYPE_LABELS[type]}</span>
                  <span className="block text-label text-text-secondary">{TUTORING_CONTENT_TYPE_HELP[type]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col text-label">
            Cấp học
            <select
              className={FORM_CONTROL_CLASS}
              value={form.school_level}
              onChange={(event) =>
                setForm({ ...form, school_level: event.target.value as SchoolLevelCode, subject_id: '', class_ids: [] })
              }
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          {blocked ? (
            <Alert tone="warning">
              Không tổ chức dạy thêm môn học cho học sinh tiểu học; chọn loại bổ trợ nếu là nghệ thuật, thể thao, kỹ
              năng sống.
            </Alert>
          ) : null}
          <label className="flex flex-col text-label">
            Môn học
            <select
              className={FORM_CONTROL_CLASS}
              value={form.subject_id}
              onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
            >
              <option value="">{form.content_type === 'curriculum' ? 'Chọn môn' : 'Không theo môn'}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          {form.content_type === 'curriculum' ? (
            <label className="flex flex-col text-label">
              Nhóm đối tượng
              <select
                className={FORM_CONTROL_CLASS}
                value={form.audience}
                onChange={(event) => setForm({ ...form, audience: event.target.value as TutoringAudience })}
              >
                {(Object.keys(TUTORING_AUDIENCE_LABELS) as TutoringAudience[]).map((audience) => (
                  <option key={audience} value={audience}>
                    {TUTORING_AUDIENCE_LABELS[audience]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.charges_fee}
                onChange={(event) => setForm({ ...form, charges_fee: event.target.checked })}
              />
              Có thu tiền (thu theo quy định thu của trường)
            </label>
          )}
          {form.content_type === 'curriculum' ? (
            <p className="text-label text-text-secondary">{TUTORING_NO_FEE_BASIS}</p>
          ) : null}
          {form.content_type === 'enrichment' && form.charges_fee ? (
            <fieldset className="flex flex-col gap-3 rounded border border-border p-3">
              <legend className="text-label font-medium">Mức thu (thu trên hóa đơn của trường)</legend>
              <label className="flex flex-col text-label">
                Cách tính
                <select
                  className={FORM_CONTROL_CLASS}
                  value={form.fee_basis}
                  onChange={(event) => setForm({ ...form, fee_basis: event.target.value as TutoringFeeBasis })}
                >
                  {(Object.keys(TUTORING_FEE_BASIS_LABELS) as TutoringFeeBasis[]).map((basis) => (
                    <option key={basis} value={basis}>
                      {TUTORING_FEE_BASIS_LABELS[basis]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-label">
                Số tiền (đồng)
                <input
                  type="number"
                  min={1}
                  step={1000}
                  className={FORM_CONTROL_CLASS}
                  value={form.fee_amount}
                  onChange={(event) => setForm({ ...form, fee_amount: event.target.value })}
                />
              </label>
              <label className="flex flex-col text-label">
                Buổi bị hủy sau khi đã thu
                <select
                  className={FORM_CONTROL_CLASS}
                  value={form.cancel_refund}
                  onChange={(event) => setForm({ ...form, cancel_refund: event.target.value as TutoringCancelRefund })}
                >
                  {(Object.keys(TUTORING_CANCEL_REFUND_LABELS) as TutoringCancelRefund[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {TUTORING_CANCEL_REFUND_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ) : null}
          <label className="flex flex-col text-label">
            Thù lao giáo viên mỗi tiết (đồng)
            <input
              type="number"
              min={1}
              step={1000}
              className={FORM_CONTROL_CLASS}
              value={form.pay_rate_per_period}
              onChange={(event) => setForm({ ...form, pay_rate_per_period: event.target.value })}
            />
          </label>
          {form.content_type === 'enrichment' ? (
            <label className="flex flex-col text-label">
              Nguồn chi thù lao
              <select
                className={FORM_CONTROL_CLASS}
                value={form.funding_source}
                onChange={(event) => setForm({ ...form, funding_source: event.target.value as TutoringFundingSource })}
              >
                {(Object.keys(TUTORING_FUNDING_SOURCE_LABELS) as TutoringFundingSource[]).map((source) => (
                  <option key={source} value={source}>
                    {TUTORING_FUNDING_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col text-label">
            Hình thức
            <select
              className={FORM_CONTROL_CLASS}
              value={form.delivery}
              onChange={(event) => setForm({ ...form, delivery: event.target.value as TutoringDelivery })}
            >
              {(Object.keys(TUTORING_DELIVERY_LABELS) as TutoringDelivery[]).map((delivery) => (
                <option key={delivery} value={delivery}>
                  {TUTORING_DELIVERY_LABELS[delivery]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="text-label">Lớp đối tượng</legend>
            {classes.map((item) => (
              <label key={item.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.class_ids.includes(item.id)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      class_ids: event.target.checked
                        ? [...form.class_ids, item.id]
                        : form.class_ids.filter((id) => id !== item.id),
                    })
                  }
                />
                {item.name}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col text-label">
            Từ ngày
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={form.starts_on}
              onChange={(event) => setForm({ ...form, starts_on: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Đến ngày
            <input
              type="date"
              className={FORM_CONTROL_CLASS}
              value={form.ends_on}
              onChange={(event) => setForm({ ...form, ends_on: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Mô tả
            <textarea
              className={FORM_CONTROL_CLASS}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <label className="flex flex-col text-label">
            Mẫu đơn đăng ký của cha mẹ
            <textarea
              className={FORM_CONTROL_CLASS}
              value={form.registration_form}
              onChange={(event) => setForm({ ...form, registration_form: event.target.value })}
            />
          </label>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            Lập chương trình
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
