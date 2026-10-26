import { useEffect, useState } from 'react';
import { TUTORING_ATTENDANCE_LABELS, type TutoringAttendanceStatus } from '@school-management/shared';
import { Alert, ApplicationHeader, Button } from '@school-management/ui';
import { ApiError, requestJson } from '../session/api-client.js';

// Gia sư trong trường trên ứng dụng giáo viên (DT-27 phần 27b, YCTD-252): buổi dạy hai tuần tới của chương trình mình dạy, điểm danh
// (gợi ý từ nhật ký phòng video khi 27a gộp), xác nhận; vắng thì máy chủ báo cha mẹ một lần
interface Session {
  id: string;
  program_name: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  status: 'scheduled' | 'cancelled';
  attendance_confirmed_at: string | null;
}

interface Attendance {
  students: Array<{ child_id: string; full_name: string; status: TutoringAttendanceStatus | null; confirmed_at: string | null }>;
}

const STATUSES = Object.keys(TUTORING_ATTENDANCE_LABELS) as TutoringAttendanceStatus[];
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : 'Không kết nối được tới máy chủ');

export function TutoringScreen({ onBack }: { onBack(): void }) {
  const [sessions, setSessions] = useState<Session[]>();
  const [open, setOpen] = useState<Session>();
  const [marks, setMarks] = useState<Record<string, TutoringAttendanceStatus>>({});
  const [students, setStudents] = useState<Attendance['students']>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = () =>
    requestJson<Session[]>(`/api/v1/tutoring/sessions?from=${today()}&to=${addDays(today(), 14)}`)
      .then(setSessions)
      .catch((error: unknown) => setErrorMessage(messageOf(error)));
  useEffect(() => {
    void load();
  }, []);

  const openSession = async (session: Session) => {
    setNotice(undefined);
    try {
      const attendance = await requestJson<Attendance>(`/api/v1/tutoring/sessions/${session.id}/attendance`);
      setStudents(attendance.students);
      setMarks(Object.fromEntries(attendance.students.map((student) => [student.child_id, student.status ?? 'present'])));
      setOpen(session);
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  const confirm = async () => {
    if (!open) {
      return;
    }
    try {
      const result = await requestJson<{ confirmed: number; notified: number }>(`/api/v1/tutoring/sessions/${open.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ entries: Object.entries(marks).map(([child_id, status]) => ({ child_id, status })) }),
      });
      setNotice(`Đã điểm danh ${result.confirmed} học sinh, báo vắng ${result.notified} cha mẹ`);
      setOpen(undefined);
      await load();
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  };

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Gia sư trong trường" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <Button variant="text" onClick={open ? () => setOpen(undefined) : onBack}>
            Quay lại
          </Button>
        </div>
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {open ? (
          <section className="flex flex-col gap-3" aria-label={`Điểm danh ${open.program_name}`}>
            <h2 className="text-section-title font-semibold">
              {open.program_name} · {open.session_date} {open.start_time}
            </h2>
            {students.length === 0 ? <p className="text-content text-text-secondary">Chưa có học sinh được duyệt đơn.</p> : null}
            <ul className="flex flex-col gap-2">
              {students.map((student) => (
                <li key={student.child_id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                  <span className="text-content font-semibold">{student.full_name}</span>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Điểm danh ${student.full_name}`}>
                    {STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={marks[student.child_id] === status ? 'primary' : 'secondary'}
                        aria-pressed={marks[student.child_id] === status}
                        onClick={() => setMarks({ ...marks, [student.child_id]: status })}
                      >
                        {TUTORING_ATTENDANCE_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="primary" disabled={students.length === 0} onClick={() => void confirm()}>
              Xác nhận điểm danh
            </Button>
          </section>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Buổi dạy gia sư">
            {sessions && sessions.length === 0 ? (
              <li className="text-content text-text-secondary">Không có buổi dạy gia sư trong hai tuần tới.</li>
            ) : null}
            {(sessions ?? []).map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-content">
                <span>
                  <span className="font-semibold">
                    {session.session_date} {session.start_time}–{session.end_time}
                  </span>
                  <br />
                  {session.program_name}
                  {session.location ? ` · ${session.location}` : ''}
                  {session.status === 'cancelled' ? ' · Đã hủy' : session.attendance_confirmed_at ? ' · Đã điểm danh' : ''}
                </span>
                {session.status === 'scheduled' ? <Button onClick={() => void openSession(session)}>Điểm danh</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
