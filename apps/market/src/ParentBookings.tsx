import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { errorText, marketRequest, readSession, type Child } from '@school-management/market-client';

// Đặt buổi và buổi học của con ở Chợ gia sư (DT-27 phần 27h, YCTD-258): chọn con, môn, giờ (giờ Việt Nam), trả tiền qua nhà cung cấp
// (bản này là thanh toán giả lập, không có tiền thật), hủy theo chính sách hủy, mở tranh chấp trong hạn khiếu nại, trình bày, khiếu nại lại
const STATUS_LABELS: Record<string, string> = {
  held: 'Đang giữ chỗ, chờ trả tiền',
  paid: 'Đã trả tiền',
  completed: 'Gia sư đã dạy, trong hạn khiếu nại',
  disputed: 'Đang tranh chấp',
  disbursed: 'Đã hoàn tất',
  refunded: 'Đã hoàn tiền',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn giữ chỗ',
};
const DECISION_LABELS: Record<string, string> = {
  refund_full: 'hoàn đủ',
  refund_partial: 'hoàn một phần',
  release: 'giải ngân cho gia sư',
};

export interface BookableSubject {
  id: string;
  subject: string;
  school_level: string;
  grade_from: number;
  grade_to: number;
  content_kind: string;
  price_per_session: number;
  session_minutes: number;
}

interface Booking {
  id: string;
  tutor_name: string;
  child_name: string;
  subject: string;
  starts_at: string;
  minutes: number;
  price: number;
  status: string;
  refunded_amount: number | null;
  dispute_status: string | null;
  decision: string | null;
  final_decision: string | null;
  decision_note: string | null;
  final_note: string | null;
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
const when = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

// Ô ngày giờ của trình duyệt không có múi giờ: hiểu là giờ Việt Nam (UTC+7)
export function vietnamInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function BookingForm({
  tutorId,
  tutorName,
  subjects,
  schoolTeacher,
}: {
  tutorId: string;
  tutorName: string;
  subjects: BookableSubject[];
  schoolTeacher: boolean;
}) {
  const [children, setChildren] = useState<Child[]>([]);
  const [form, setForm] = useState({ child_id: '', subject_id: subjects[0]?.id ?? '', starts_at: '', attest: false });
  const [booked, setBooked] = useState<Booking>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!readSession()) return;
    marketRequest<{ children: Child[] }>('GET', '/children')
      .then((view) => {
        setChildren(view.children);
        setForm((current) => ({ ...current, child_id: view.children[0]?.id ?? '' }));
      })
      .catch(() => setChildren([]));
  }, []);
  if (!readSession()) return <p className="text-text-secondary">Đăng nhập tài khoản phụ huynh để đặt buổi.</p>;
  if (children.length === 0) return <p className="text-text-secondary">Thêm hồ sơ con trước khi đặt buổi.</p>;
  const subject = subjects.find((item) => item.id === form.subject_id);
  const needsAttest = schoolTeacher && subject?.content_kind === 'curriculum';
  return (
    <form
      aria-label={`Đặt buổi với ${tutorName}`}
      className="flex flex-col gap-2 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        marketRequest<Booking>('POST', '/bookings', {
          tutor_id: tutorId,
          child_id: form.child_id,
          subject_id: form.subject_id,
          starts_at: form.starts_at ? vietnamInputToIso(form.starts_at) : '',
          no_assignment_attested: form.attest,
        })
          .then((result) => {
            setError(undefined);
            setBooked(result);
          })
          .catch((caught: unknown) => setError(errorText(caught)));
      }}
    >
      <h3 className="font-semibold">Đặt buổi</h3>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {booked ? (
        <Alert tone="success">
          Đã giữ chỗ buổi {booked.subject} lúc {when(booked.starts_at)}, {money(booked.price)}. Trả tiền ở mục Buổi học
          của con trong 30 phút.
        </Alert>
      ) : null}
      <label className="flex flex-col">
        Con
        <select
          className={FORM_CONTROL_CLASS}
          value={form.child_id}
          onChange={(event) => setForm({ ...form, child_id: event.target.value })}
        >
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.display_name} (lớp {child.grade})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col">
        Môn
        <select
          className={FORM_CONTROL_CLASS}
          value={form.subject_id}
          onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
        >
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.subject} – {money(item.price_per_session)}/{item.session_minutes} phút
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col">
        Giờ học (giờ Việt Nam)
        <input
          className={FORM_CONTROL_CLASS}
          type="datetime-local"
          value={form.starts_at}
          onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
        />
      </label>
      {needsAttest ? (
        <label>
          <input
            type="checkbox"
            checked={form.attest}
            onChange={(event) => setForm({ ...form, attest: event.target.checked })}
          />{' '}
          Tôi cam kết con không học lớp do gia sư này được phân công dạy ở trường
        </label>
      ) : null}
      <Button type="submit" variant="primary">
        Giữ chỗ buổi học
      </Button>
    </form>
  );
}

function DisputePanel({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const [reason, setReason] = useState('');
  const [statement, setStatement] = useState('');
  const [error, setError] = useState<string>();
  const run = (work: Promise<unknown>) =>
    work
      .then(() => {
        setError(undefined);
        setReason('');
        setStatement('');
        onChange();
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  return (
    <div className="flex flex-col gap-1">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {(booking.status === 'paid' || booking.status === 'completed') &&
      new Date(booking.starts_at).getTime() <= Date.now() ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Lý do khiếu nại
            <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <Button onClick={() => void run(marketRequest('POST', `/bookings/${booking.id}/dispute`, { reason }))}>
            Mở tranh chấp
          </Button>
        </div>
      ) : null}
      {booking.dispute_status === 'open' || booking.dispute_status === 'appealed' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Trình bày thêm
            <input
              className={FORM_CONTROL_CLASS}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
            />
          </label>
          <Button
            onClick={() => void run(marketRequest('POST', `/disputes/${booking.id}/statements`, { body: statement }))}
          >
            Gửi trình bày
          </Button>
        </div>
      ) : null}
      {booking.dispute_status === 'decided' ? (
        <div className="flex flex-wrap items-end gap-2">
          <span>
            Quyết định: {DECISION_LABELS[booking.decision ?? ''] ?? booking.decision} – {booking.decision_note}
          </span>
          <label className="flex flex-col">
            Lý do khiếu nại lại
            <input className={FORM_CONTROL_CLASS} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <Button onClick={() => void run(marketRequest('POST', `/disputes/${booking.id}/appeal`, { reason }))}>
            Khiếu nại lại
          </Button>
        </div>
      ) : null}
      {booking.dispute_status === 'final' ? (
        <span>
          Quyết định cuối: {DECISION_LABELS[booking.final_decision ?? booking.decision ?? ''] ?? ''} –{' '}
          {booking.final_note ?? booking.decision_note}
        </span>
      ) : null}
    </div>
  );
}

export function ParentBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<{ bookings: Booking[] }>('GET', '/bookings')
      .then((view) => setBookings(view.bookings))
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);
  useEffect(load, [load]);
  const run = (work: Promise<unknown>) =>
    work
      .then(() => {
        setError(undefined);
        load();
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  return (
    <section aria-label="Buổi học của con" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Buổi học của con</h2>
      <Button onClick={load}>Tải lại</Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {bookings.length === 0 ? <p className="text-text-secondary">Chưa có buổi học nào.</p> : null}
      <ul className="flex flex-col gap-2">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            aria-label={`Buổi ${booking.subject} ${when(booking.starts_at)}`}
            className="flex flex-col gap-1 rounded-lg border p-2"
          >
            <strong>
              {booking.subject} với {booking.tutor_name} – {booking.child_name}
            </strong>
            <span>
              {when(booking.starts_at)}, {booking.minutes} phút, {money(booking.price)}
            </span>
            <span>
              Trạng thái: {STATUS_LABELS[booking.status] ?? booking.status}
              {booking.refunded_amount ? ` (đã hoàn ${money(booking.refunded_amount)})` : ''}
            </span>
            <div className="flex flex-wrap gap-2">
              {booking.status === 'held' ? (
                <Button
                  variant="primary"
                  onClick={() => void run(marketRequest('POST', `/bookings/${booking.id}/mock-pay`))}
                >
                  Thanh toán giả lập
                </Button>
              ) : null}
              {booking.status === 'held' || booking.status === 'paid' ? (
                <Button onClick={() => void run(marketRequest('POST', `/bookings/${booking.id}/cancel`, {}))}>
                  Hủy buổi
                </Button>
              ) : null}
            </div>
            <DisputePanel booking={booking} onChange={load} />
          </li>
        ))}
      </ul>
    </section>
  );
}
