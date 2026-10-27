import { useCallback, useEffect, useState } from 'react';
import {
  TUTORING_ATTENDANCE_LABELS,
  TUTORING_AUDIENCE_LABELS,
  TUTORING_CONTENT_TYPE_LABELS,
  TUTORING_REGISTRATION_STATUS_LABELS,
  type TutoringAttendanceStatus,
  type TutoringAudience,
  type TutoringContentType,
  type TutoringRegistrationStatus,
} from '@school-management/shared';
import { Alert, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';
import { ChildTutoringCourses } from './ChildTutoringCourses.js';
import { ChildTutoringQuestions } from './ChildTutoringQuestions.js';
import { ChildVideoPanel } from './ChildVideoPanel.js';

// Gia sư trong trường của con (DT-27 phần 27b, YCTD-252): chương trình nhà trường mở cho con, đọc nội dung và gửi đơn đăng ký (cha mẹ
// xác nhận văn bản đơn, nhà trường lưu bản chụp), rút đơn, lịch học và điểm danh đã xác nhận; đường dây nóng của trường và nút phản
// ánh dạy thêm trái quy định (vào hộp thư góp ý của trường, Thông tư 19/2026 Điều 5)
interface Program {
  id: string;
  name: string;
  content_type: TutoringContentType;
  audience: TutoringAudience | null;
  charges_fee: boolean;
  // Mức thu của chương trình bổ trợ có thu, thu trên hóa đơn của trường (YCTD-253)
  fee_basis: 'per_session' | 'per_program' | null;
  fee_amount: string | null;
  // Ghi hình lớp video của chương trình (YCTD-251)
  recording_enabled?: boolean;
  description: string | null;
  registration_form: string;
  starts_on: string;
  ends_on: string;
  subject_name: string | null;
  registered: boolean;
}

interface Overview {
  programs: Program[];
  registrations: Array<{
    id: string;
    program_name: string;
    status: TutoringRegistrationStatus;
    reject_reason: string | null;
  }>;
  sessions: Array<{
    id: string;
    program_name: string;
    session_date: string;
    start_time: string;
    end_time: string;
    location: string | null;
    status: 'scheduled' | 'cancelled';
    cancel_reason: string | null;
    attendance: TutoringAttendanceStatus | null;
  }>;
}

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');

export function TutoringPanel({ child }: { child: { id: string; full_name: string } }) {
  const [overview, setOverview] = useState<Overview>();
  const [reading, setReading] = useState<Program>();
  const [agree, setAgree] = useState(false);
  const [hotline, setHotline] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    try {
      setOverview(await requestJson<Overview>(`/api/v1/children/${child.id}/tutoring`));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id]);
  useEffect(() => {
    void load();
    fetch('/api/v1/auth/login-options')
      .then((response) => (response.ok ? (response.json() as Promise<{ hotline: string | null }>) : null))
      .then((options) => setHotline(options?.hotline ?? null))
      .catch(() => setHotline(null));
  }, [load]);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setErrorMessage(undefined);
    try {
      await work();
      setNotice(done);
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`Gia sư của ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <ChildVideoPanel child={child} programs={overview?.programs ?? []} />
      <ChildTutoringCourses
        childId={child.id}
        programIds={(overview?.programs ?? []).filter((program) => program.registered).map((program) => program.id)}
      />
      <ChildTutoringQuestions childId={child.id} />
      <h3 className="text-content font-semibold">Chương trình nhà trường mở cho con</h3>
      {overview && overview.programs.length === 0 ? (
        <p className="text-label text-text-secondary">Hiện chưa có chương trình nào mở cho con.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(overview?.programs ?? []).map((program) => (
          <li key={program.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span className="font-semibold">{program.name}</span>
            <span className="text-label text-text-secondary">
              {program.subject_name ? `${program.subject_name} · ` : ''}
              {TUTORING_CONTENT_TYPE_LABELS[program.content_type]}
              {program.audience ? ` · ${TUTORING_AUDIENCE_LABELS[program.audience]}` : ''} · {program.starts_on} đến{' '}
              {program.ends_on}
            </span>
            <span className="text-label">
              {program.content_type === 'curriculum'
                ? 'Không thu tiền (dạy thêm trong nhà trường không thu tiền của học sinh)'
                : program.charges_fee
                  ? program.fee_amount
                    ? `Thu ${Number(program.fee_amount).toLocaleString('vi-VN')} đ ${
                        program.fee_basis === 'per_session' ? 'mỗi buổi học' : 'trọn gói'
                      } trên hóa đơn học phí của trường; buổi do trường hủy được trừ hoặc hoàn`
                    : 'Có thu tiền theo thông báo của nhà trường'
                  : 'Không thu tiền'}
            </span>
            {program.registered ? (
              <span className="text-label text-success">Đã gửi đơn</span>
            ) : (
              <Button
                onClick={() => {
                  setReading(program);
                  setAgree(false);
                }}
              >
                Đăng ký {program.name}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {reading ? (
        <section
          aria-label={`Đơn đăng ký ${reading.name}`}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <h4 className="font-semibold">Đơn đăng ký: {reading.name}</h4>
          {reading.description ? <p className="text-content">{reading.description}</p> : null}
          <p className="whitespace-pre-wrap rounded bg-page p-2 text-content">{reading.registration_form}</p>
          <label className="flex items-start gap-2 text-content">
            <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
            Tôi đã đọc và đồng ý nội dung đơn, đăng ký cho {child.full_name}
          </label>
          <Button
            variant="primary"
            disabled={!agree}
            onClick={() =>
              void run(async () => {
                await requestJson(`/api/v1/children/${child.id}/tutoring/registrations`, {
                  method: 'POST',
                  body: JSON.stringify({ program_id: reading.id, agree: true }),
                });
                setReading(undefined);
              }, 'Đã gửi đơn đăng ký, chờ nhà trường duyệt')
            }
          >
            Gửi đơn đăng ký
          </Button>
        </section>
      ) : null}

      <h3 className="text-content font-semibold">Đơn đã gửi</h3>
      <ul className="flex flex-col gap-1">
        {(overview?.registrations ?? []).map((registration) => (
          <li key={registration.id} className="flex items-center justify-between gap-2 text-content">
            <span>
              {registration.program_name}: {TUTORING_REGISTRATION_STATUS_LABELS[registration.status]}
              {registration.reject_reason ? ` (${registration.reject_reason})` : ''}
            </span>
            {registration.status === 'pending' || registration.status === 'approved' ? (
              <Button
                variant="text"
                onClick={() =>
                  void run(
                    () =>
                      requestJson(`/api/v1/children/${child.id}/tutoring/registrations/${registration.id}/withdraw`, {
                        method: 'POST',
                      }),
                    'Đã rút đơn',
                  )
                }
              >
                Rút đơn
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <h3 className="text-content font-semibold">Lịch học và điểm danh</h3>
      <ul className="flex flex-col gap-1" aria-label="Lịch học gia sư">
        {(overview?.sessions ?? []).map((session) => (
          <li key={session.id} className="text-content">
            {session.session_date} {session.start_time}–{session.end_time} · {session.program_name}
            {session.location ? ` · ${session.location}` : ''}
            {session.status === 'cancelled' ? ` · Hủy: ${session.cancel_reason ?? ''}` : ''}
            {session.attendance ? ` · ${TUTORING_ATTENDANCE_LABELS[session.attendance]}` : ''}
          </li>
        ))}
      </ul>

      <h3 className="text-content font-semibold">Phản ánh dạy thêm</h3>
      {hotline ? <p className="text-content">Đường dây nóng của trường: {hotline}</p> : null}
      <textarea
        aria-label="Nội dung phản ánh dạy thêm"
        className="rounded-lg border border-border p-2 text-content"
        value={report}
        onChange={(event) => setReport(event.target.value)}
      />
      <Button
        disabled={report.trim() === ''}
        onClick={() =>
          void run(async () => {
            await requestJson('/api/v1/feedbacks', {
              method: 'POST',
              body: JSON.stringify({
                child_id: child.id,
                category: 'teaching',
                content: `[Phản ánh dạy thêm] ${report.trim()}`,
                privacy_level: 'named',
              }),
            });
            setReport('');
          }, 'Đã gửi phản ánh tới nhà trường')
        }
      >
        Gửi phản ánh
      </Button>
    </section>
  );
}
