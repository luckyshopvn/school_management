import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TUTORING_ATTENDANCE_LABELS, type TutoringAttendanceStatus } from '@school-management/shared';
import { Alert, Button, FORM_CONTROL_CLASS, Toast } from '@school-management/ui';
import { AppShell } from '../pages/AppShell.js';
import { menuPageTitle } from '../pages/page-title.js';
import { tutoringApi } from './tutoring-api.js';
import { messageOf } from './TutoringProgramsPage.js';

// 2. Lịch buổi học, điểm danh (DT-27 phần 27b, YCTD-252): buổi của chương trình mình dạy (Ban Giám hiệu thấy mọi buổi); điểm danh
// gợi ý từ nhật ký vào ra phòng video (27a, chưa có thì trống), giáo viên xác nhận; vắng báo cha mẹ một lần; hủy buổi báo cha mẹ
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const STATUSES = Object.keys(TUTORING_ATTENDANCE_LABELS) as TutoringAttendanceStatus[];

function AttendancePanel({ sessionId, notify }: { sessionId: string; notify: (text: string) => void }) {
  const queryClient = useQueryClient();
  const view = useQuery({ queryKey: ['tutoring-attendance', sessionId], queryFn: () => tutoringApi.attendance(sessionId) });
  const [marks, setMarks] = useState<Record<string, TutoringAttendanceStatus>>({});
  useEffect(() => {
    if (view.data) {
      setMarks(Object.fromEntries(view.data.students.map((student) => [student.child_id, student.status ?? 'present'])));
    }
  }, [view.data]);
  const confirm = useMutation({
    mutationFn: () => tutoringApi.confirmAttendance(sessionId, Object.entries(marks).map(([child_id, status]) => ({ child_id, status }))),
    onSuccess: async (result) => {
      notify(`Đã xác nhận điểm danh ${result.confirmed} học sinh, báo vắng ${result.notified} cha mẹ`);
      await queryClient.invalidateQueries({ queryKey: ['tutoring-attendance', sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['tutoring-sessions'] });
    },
  });
  if (!view.data) {
    return view.error ? <Alert tone="danger">{messageOf(view.error)}</Alert> : null;
  }
  return (
    <section aria-label={`Điểm danh ${view.data.session.program_name} ${view.data.session.session_date}`} className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-section-title font-semibold">
        Điểm danh {view.data.session.program_name} ngày {view.data.session.session_date}
      </h2>
      {confirm.error ? <Alert tone="danger">{messageOf(confirm.error)}</Alert> : null}
      {view.data.students.length === 0 ? <p>Chưa có học sinh được duyệt đơn.</p> : null}
      <table className="w-full text-content">
        <tbody>
          {view.data.students.map((student) => (
            <tr key={student.child_id}>
              <td>{student.full_name}</td>
              <td>
                <select
                  aria-label={`Điểm danh ${student.full_name}`}
                  className={FORM_CONTROL_CLASS}
                  value={marks[student.child_id] ?? 'present'}
                  onChange={(event) => setMarks({ ...marks, [student.child_id]: event.target.value as TutoringAttendanceStatus })}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {TUTORING_ATTENDANCE_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="text-label text-text-secondary">
                {student.source === 'room_log' && !student.confirmed_at ? 'Gợi ý từ nhật ký phòng' : student.confirmed_at ? 'Đã xác nhận' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="primary" disabled={view.data.students.length === 0 || confirm.isPending} onClick={() => confirm.mutate()}>
        Xác nhận điểm danh
      </Button>
    </section>
  );
}

export function TutoringSessionsPage() {
  const queryClient = useQueryClient();
  const [toastMessage, setToastMessage] = useState<string>();
  const closeToast = useCallback(() => setToastMessage(undefined), []);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 13));
  const [open, setOpen] = useState<string>();
  const sessions = useQuery({ queryKey: ['tutoring-sessions', from, to], queryFn: () => tutoringApi.sessions(from, to) });
  const cancel = useMutation({
    mutationFn: (input: { id: string; reason: string }) => tutoringApi.cancelSession(input.id, input.reason),
    onSuccess: async () => {
      setToastMessage('Đã hủy buổi và báo cha mẹ');
      await queryClient.invalidateQueries({ queryKey: ['tutoring-sessions'] });
    },
  });
  return (
    <AppShell>
      <Toast message={toastMessage} onClose={closeToast} />
      <div className="flex flex-col gap-6">
        <h1 className="text-page-title font-bold text-text">{menuPageTitle('/tutoring/sessions')}</h1>
        <div className="flex gap-2">
          <label className="flex flex-col text-label">
            Từ ngày
            <input type="date" className={FORM_CONTROL_CLASS} value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="flex flex-col text-label">
            Đến ngày
            <input type="date" className={FORM_CONTROL_CLASS} value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {sessions.error ? <Alert tone="danger">{messageOf(sessions.error)}</Alert> : null}
        {cancel.error ? <Alert tone="danger">{messageOf(cancel.error)}</Alert> : null}
        <table aria-label="Buổi học gia sư" className="w-full text-content">
          <thead>
            <tr className="text-left text-text-secondary">
              <th>Ngày</th>
              <th>Giờ</th>
              <th>Chương trình</th>
              <th>Địa điểm</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(sessions.data ?? []).map((session) => (
              <tr key={session.id}>
                <td>{session.session_date}</td>
                <td>
                  {session.start_time}–{session.end_time}
                </td>
                <td>{session.program_name}</td>
                <td>{session.location ?? ''}</td>
                <td>
                  {session.status === 'cancelled'
                    ? `Đã hủy: ${session.cancel_reason ?? ''}`
                    : session.attendance_confirmed_at
                      ? 'Đã điểm danh'
                      : 'Chưa điểm danh'}
                </td>
                <td className="flex gap-2">
                  {session.status === 'scheduled' ? (
                    <>
                      <Button onClick={() => setOpen(open === session.id ? undefined : session.id)}>Điểm danh {session.session_date}</Button>
                      <Button
                        onClick={() => {
                          const reason = window.prompt('Lý do hủy buổi');
                          if (reason) {
                            cancel.mutate({ id: session.id, reason });
                          }
                        }}
                      >
                        Hủy buổi
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {open ? <AttendancePanel sessionId={open} notify={setToastMessage} /> : null}
      </div>
    </AppShell>
  );
}
