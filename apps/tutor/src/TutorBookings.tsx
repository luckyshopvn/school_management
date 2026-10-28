import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, FORM_CONTROL_CLASS } from '@school-management/ui';
import { errorText, marketRequest, RecordingPlayer, ReportForm } from '@school-management/market-client';

// Buổi dạy và thu nhập của gia sư (DT-27 phần 27h, YCTD-258): buổi đã trả tiền, đánh dấu đã dạy sau giờ kết thúc, hủy (phụ huynh được
// hoàn đủ), trình bày khi có tranh chấp, khiếu nại lại quyết định; thu nhập đã giải ngân, đang chờ (sau hạn khiếu nại), hoa hồng của nền
// tảng. Thanh toán ở bản này là giả lập, không có tiền thật
const STATUS_LABELS: Record<string, string> = {
  paid: 'Đã trả tiền, chưa học',
  completed: 'Đã dạy, chờ hết hạn khiếu nại',
  disputed: 'Phụ huynh khiếu nại, tiền đang giữ',
  disbursed: 'Đã giải ngân',
  refunded: 'Đã hoàn tiền cho phụ huynh',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn giữ chỗ',
};

interface Booking {
  id: string;
  child_name: string;
  subject: string;
  grade: number;
  starts_at: string;
  minutes: number;
  price: number;
  commission: number;
  status: string;
  released_amount: number | null;
  parent_id: string;
  recording_required: boolean;
}

interface Dispute {
  status: string;
  reason: string;
  decision: string | null;
  decision_note: string | null;
  statements: Array<{ role: string; body: string; created_at: string }>;
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
const when = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function DisputeBox({ id, onChange }: { id: string; onChange: () => void }) {
  const [dispute, setDispute] = useState<Dispute>();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<Dispute>('GET', `/tutor/bookings/${id}/dispute`)
      .then(setDispute)
      .catch(() => setDispute(undefined));
  }, [id]);
  useEffect(load, [load]);
  if (!dispute) return null;
  const send = (path: string, body: unknown) =>
    marketRequest('POST', path, body)
      .then(() => {
        setError(undefined);
        setText('');
        load();
        onChange();
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  return (
    <div className="flex flex-col gap-1 rounded border p-2" aria-label="Tranh chấp">
      <span>Phụ huynh khiếu nại: {dispute.reason}</span>
      {dispute.statements.map((item, index) => (
        <span key={index}>
          {item.role === 'tutor' ? 'Bạn' : 'Phụ huynh'}: {item.body}
        </span>
      ))}
      {dispute.decision ? <span>Quyết định của nền tảng: {dispute.decision_note}</span> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {dispute.status === 'open' || dispute.status === 'appealed' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Trình bày của bạn
            <input className={FORM_CONTROL_CLASS} value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          <Button onClick={() => void send(`/disputes/${id}/statements`, { body: text })}>Gửi trình bày</Button>
        </div>
      ) : null}
      {dispute.status === 'decided' ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            Lý do khiếu nại lại
            <input className={FORM_CONTROL_CLASS} value={text} onChange={(event) => setText(event.target.value)} />
          </label>
          <Button onClick={() => void send(`/disputes/${id}/appeal`, { reason: text })}>Khiếu nại lại</Button>
        </div>
      ) : null}
    </div>
  );
}

// Phòng học của buổi (27i): mở phòng từ 15 phút trước giờ học (buổi có trẻ vị thành niên bắt đầu ghi hình, không ghi được thì không
// mở), kết thúc phòng, xem bản ghi, báo cáo phụ huynh
function SessionRoom({ booking }: { booking: Booking }) {
  const [state, setState] = useState<{ recording: string | null; open: boolean }>({ recording: null, open: false });
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    marketRequest<{ status: string | null }>('GET', `/tutor/bookings/${booking.id}/recording`)
      .then((result) => setState((current) => ({ ...current, recording: result.status })))
      .catch(() => undefined);
  }, [booking.id]);
  const act = (path: string, open: boolean) =>
    marketRequest<{ recording: boolean | string | null }>('POST', path)
      .then((result) => {
        setError(undefined);
        const recording =
          typeof result.recording === 'string' ? result.recording : result.recording ? 'recording' : state.recording;
        setState({ recording, open });
      })
      .catch((caught: unknown) => setError(errorText(caught)));
  return (
    <div className="flex flex-col gap-1">
      {booking.recording_required ? <span>Buổi học với trẻ dưới 18 tuổi: luôn ghi hình.</span> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {state.open ? (
        <Alert tone="info">Phòng học đang mở{state.recording === 'recording' ? ' · Đang ghi hình' : ''}.</Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {booking.status === 'paid' && !state.open ? (
          <Button onClick={() => void act(`/tutor/bookings/${booking.id}/session/start`, true)}>Mở phòng học</Button>
        ) : null}
        {state.open ? (
          <Button onClick={() => void act(`/tutor/bookings/${booking.id}/session/end`, false)}>
            Kết thúc phòng học
          </Button>
        ) : null}
        {booking.status !== 'expired' ? <Button onClick={() => setReporting(true)}>Báo cáo phụ huynh</Button> : null}
      </div>
      {state.recording === 'ready' ? (
        <RecordingPlayer
          path={`/tutor/bookings/${booking.id}/recording/stream`}
          label={`Bản ghi buổi ${booking.subject}`}
        />
      ) : null}
      {reporting ? (
        <ReportForm subjectId={booking.parent_id} subjectName="phụ huynh" targetKind="session" targetId={booking.id} />
      ) : null}
    </div>
  );
}

export function TutorBookings() {
  const [view, setView] = useState<{
    bookings: Booking[];
    earnings: { released: number; pending: number; commission: number };
  }>();
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    marketRequest<typeof view>('GET', '/tutor/bookings')
      .then(setView)
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
    <section aria-label="Buổi dạy và thu nhập" className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">Buổi dạy và thu nhập</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {view ? (
        <p aria-label="Thu nhập">
          Đã giải ngân: <strong>{money(view.earnings.released)}</strong>; đang chờ: {money(view.earnings.pending)}; hoa
          hồng nền tảng đã thu: {money(view.earnings.commission)} (thanh toán giả lập)
        </p>
      ) : null}
      <Button onClick={load}>Tải lại</Button>
      <ul className="flex flex-col gap-2">
        {(view?.bookings ?? []).map((booking) => {
          const ended = new Date(booking.starts_at).getTime() + booking.minutes * 60_000 <= Date.now();
          return (
            <li
              key={booking.id}
              aria-label={`Buổi dạy ${booking.subject} ${when(booking.starts_at)}`}
              className="flex flex-col gap-1 rounded-lg border p-2"
            >
              <strong>
                {booking.subject} – {booking.child_name} (lớp {booking.grade})
              </strong>
              <span>
                {when(booking.starts_at)}, {booking.minutes} phút, {money(booking.price)} (hoa hồng{' '}
                {money(booking.commission)})
              </span>
              <span>Trạng thái: {STATUS_LABELS[booking.status] ?? booking.status}</span>
              <div className="flex flex-wrap gap-2">
                {booking.status === 'paid' && ended ? (
                  <Button
                    variant="primary"
                    onClick={() => void run(marketRequest('POST', `/tutor/bookings/${booking.id}/complete`))}
                  >
                    Đánh dấu đã dạy
                  </Button>
                ) : null}
                {booking.status === 'paid' && !ended ? (
                  <Button onClick={() => void run(marketRequest('POST', `/tutor/bookings/${booking.id}/cancel`, {}))}>
                    Hủy buổi
                  </Button>
                ) : null}
              </div>
              {booking.status === 'disputed' || booking.status === 'disbursed' || booking.status === 'refunded' ? (
                <DisputeBox id={booking.id} onChange={load} />
              ) : null}
              <SessionRoom booking={booking} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
