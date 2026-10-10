import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError, fetchCurrentUser, requestJson, type CurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { AuthorizedPickupsPanel, PickupConfirmations } from './PickupSections.js';
import { ServicesPanel } from './ServicesPanel.js';

// Trang chủ ứng dụng phụ huynh: danh sách con, báo vắng (MP-06), điểm danh của con theo tháng (MP-02),
// người đón trẻ và xác nhận người đón (MP-18), đăng ký dịch vụ và học hè (MP-12)
interface Child {
  id: string;
  full_name: string;
  class_name: string | null;
}

interface MonthAttendance {
  records: Array<{ attendance_date: string; status: string; note: string | null }>;
  absences: Array<{ absence_date: string; reason: string | null; is_advised: boolean }>;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Có mặt',
  absent_notified: 'Nghỉ có báo',
  absent_unnotified: 'Nghỉ không báo',
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  late_and_early_leave: 'Đi muộn và về sớm',
};

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

function vietnamToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function AbsenceForm({ child, onDone }: { child: Child; onDone(message: string): void }) {
  const [fromDate, setFromDate] = useState(vietnamToday());
  const [toDate, setToDate] = useState(vietnamToday());
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      const records = await requestJson<Array<{ absence_date: string; is_advised: boolean }>>('/api/v1/absences', {
        method: 'POST',
        body: JSON.stringify({ child_id: child.id, from_date: fromDate, to_date: toDate, reason: reason || null }),
      });
      const late = records.some((record) => !record.is_advised);
      onDone(
        late
          ? 'Báo vắng đã ghi nhận, tính là báo muộn vì sau giờ bắt đầu học'
          : `Đã báo vắng ${records.length} ngày học cho ${child.full_name}`,
      );
    } catch (error) {
      setErrorMessage(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-label={`Báo vắng cho ${child.full_name}`}>
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      <TextField label="Từ ngày" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
      <TextField label="Đến ngày" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
      <TextField label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" variant="primary" disabled={submitting}>
        Gửi báo vắng
      </Button>
    </form>
  );
}

function ChildCard({ child, onMessage }: { child: Child; onMessage(message: string): void }) {
  const [view, setView] = useState<'none' | 'absence' | 'attendance' | 'pickups' | 'services'>('none');
  const [attendance, setAttendance] = useState<MonthAttendance>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const month = vietnamToday().slice(0, 7);

  const loadAttendance = useCallback(async () => {
    try {
      setAttendance(await requestJson<MonthAttendance>(`/api/v1/children/${child.id}/attendance?month=${month}`));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id, month]);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label={child.full_name}>
      <div className="flex items-center justify-between">
        <span className="text-content font-semibold">{child.full_name}</span>
        <span className="text-label text-text-secondary">{child.class_name ?? ''}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setView(view === 'absence' ? 'none' : 'absence')}>Báo vắng</Button>
        <Button
          onClick={() => {
            setView(view === 'attendance' ? 'none' : 'attendance');
            void loadAttendance();
          }}
        >
          Điểm danh tháng này
        </Button>
        <Button onClick={() => setView(view === 'pickups' ? 'none' : 'pickups')}>Người đón</Button>
        <Button onClick={() => setView(view === 'services' ? 'none' : 'services')}>Dịch vụ</Button>
      </div>
      {view === 'pickups' ? <AuthorizedPickupsPanel child={child} /> : null}
      {view === 'services' ? <ServicesPanel child={child} /> : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {view === 'absence' ? (
        <AbsenceForm
          child={child}
          onDone={(message) => {
            setView('none');
            onMessage(message);
          }}
        />
      ) : null}
      {view === 'attendance' && attendance ? (
        <ul className="flex flex-col gap-1 text-content" aria-label={`Điểm danh của ${child.full_name}`}>
          {attendance.records.length === 0 ? (
            <li className="text-text-secondary">Chưa có điểm danh trong tháng.</li>
          ) : null}
          {attendance.records.map((record) => (
            <li key={record.attendance_date} className="flex items-center justify-between">
              <span>{record.attendance_date}</span>
              <StatusBadge
                tone={record.status === 'absent_unnotified' ? 'warning' : 'neutral'}
                label={STATUS_LABELS[record.status] ?? record.status}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function HomeScreen() {
  const session = useSession();
  const [user, setUser] = useState<CurrentUser>();
  const [children, setChildren] = useState<Child[]>();
  const [notice, setNotice] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setFailed(true));
    requestJson<{ items: Child[] }>('/api/v1/children?page_size=50&status=active')
      .then((page) => setChildren(page.items))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="min-h-screen">
      <ApplicationHeader title="Ứng dụng phụ huynh" />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        {failed ? <Alert tone="danger">Không tải được thông tin, vui lòng thử lại</Alert> : null}
        {user ? (
          <h1 className="text-page-title font-bold text-text">Xin chào, {user.full_name}</h1>
        ) : (
          <div className="h-8 w-48 animate-pulse rounded bg-border" aria-hidden="true" />
        )}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <PickupConfirmations />
        {children && children.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có thông tin của con.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {(children ?? []).map((child) => (
            <ChildCard key={child.id} child={child} onMessage={setNotice} />
          ))}
        </ul>
        <div>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </div>
      </main>
    </div>
  );
}
