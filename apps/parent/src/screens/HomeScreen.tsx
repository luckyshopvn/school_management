import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Alert, ApplicationHeader, Button, StatusBadge, TextField } from '@school-management/ui';
import { ApiError, fetchCurrentUser, requestJson, type CurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { AuthorizedPickupsPanel, PickupConfirmations } from './PickupSections.js';
import { InvoicesPanel } from './InvoicesPanel.js';
import { JournalPanel } from './JournalPanel.js';
import { ActivitiesPanel } from './ActivitiesPanel.js';
import { HealthPanel } from './HealthPanel.js';
import { LearningPanel } from './LearningPanel.js';
import { InteractionsPanel } from './InteractionsPanel.js';
import { PollsPanel } from './PollsPanel.js';
import { MenuPanel } from './MenuPanel.js';
import { MedicationPanel } from './MedicationPanel.js';
import { PhotoConsentPanel } from './PhotoConsentPanel.js';
import { NotificationsPanel } from './NotificationsPanel.js';
import { ServicesPanel } from './ServicesPanel.js';
import { FinalYearPanel } from './FinalYearPanel.js';
import { BoardingPanel } from './BoardingPanel.js';
import { TimetablePanel } from './TimetablePanel.js';
import { PeriodAttendancePanel } from './PeriodAttendancePanel.js';
import { hasLevelFeature, levelOf } from '@school-management/shared';
import { useSchoolLevelNames } from './school-levels.js';

// Trang chủ ứng dụng phụ huynh: danh sách con, báo vắng (MP-06), điểm danh của con theo tháng (MP-02),
// người đón trẻ và xác nhận người đón (MP-18), đăng ký dịch vụ và học hè (MP-12), học phí (MP-11)
interface Child {
  id: string;
  full_name: string;
  org_unit_id: string;
  class_name: string | null;
  // Cấp của lớp đang học (DT-19 phần 19e); chưa xếp lớp hoặc máy chủ cũ là Mầm non
  school_level?: string | null;
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

// Mỗi con hiện theo cấp của lớp (DT-19 phần 19e): chức năng chỉ của Mầm non (báo vắng, điểm danh theo ngày, nhật ký, hồ sơ
// cuối cấp) chỉ hiện ở con học lớp Mầm non; con ở cấp khác có các chức năng dùng chung. levelName có khi các con học ở nhiều
// cấp, hiện cạnh tên lớp
function ChildCard({
  child,
  levelName,
  onMessage,
}: {
  child: Child;
  levelName?: string;
  onMessage(message: string): void;
}) {
  const has = (feature: Parameters<typeof hasLevelFeature>[1]) => hasLevelFeature(child.school_level, feature);
  const [view, setView] = useState<
    | 'none'
    | 'absence'
    | 'attendance'
    | 'journal'
    | 'pickups'
    | 'services'
    | 'invoices'
    | 'consent'
    | 'health'
    | 'learning'
    | 'interactions'
    | 'activities'
    | 'menu'
    | 'medication'
    | 'final-year'
    | 'boarding'
    | 'timetable'
    | 'period-attendance'
  >('none');
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
        <span className="text-label text-text-secondary">
          {[levelName, child.class_name].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Báo vắng theo ngày dùng chung cho mọi cấp có điểm danh (DT-20 phần 20d) */}
        {has('daily_attendance') || has('period_attendance') ? (
          <Button onClick={() => setView(view === 'absence' ? 'none' : 'absence')}>Báo vắng</Button>
        ) : null}
        {has('daily_attendance') ? (
          <>
            <Button
              onClick={() => {
                setView(view === 'attendance' ? 'none' : 'attendance');
                void loadAttendance();
              }}
            >
              Điểm danh tháng này
            </Button>
          </>
        ) : null}
        {has('daily_journal') ? (
          <Button onClick={() => setView(view === 'journal' ? 'none' : 'journal')}>Nhật ký</Button>
        ) : null}
        <Button onClick={() => setView(view === 'pickups' ? 'none' : 'pickups')}>Người đón</Button>
        <Button onClick={() => setView(view === 'services' ? 'none' : 'services')}>Dịch vụ</Button>
        <Button onClick={() => setView(view === 'invoices' ? 'none' : 'invoices')}>Học phí</Button>
        <Button onClick={() => setView(view === 'consent' ? 'none' : 'consent')}>Hình ảnh</Button>
        <Button onClick={() => setView(view === 'health' ? 'none' : 'health')}>Sức khỏe</Button>
        <Button onClick={() => setView(view === 'learning' ? 'none' : 'learning')}>Học tập</Button>
        <Button onClick={() => setView(view === 'interactions' ? 'none' : 'interactions')}>Trao đổi</Button>
        <Button onClick={() => setView(view === 'activities' ? 'none' : 'activities')}>Hoạt động</Button>
        <Button onClick={() => setView(view === 'menu' ? 'none' : 'menu')}>Thực đơn</Button>
        {has('boarding_meal') ? (
          <Button onClick={() => setView(view === 'boarding' ? 'none' : 'boarding')}>Cắt suất bán trú</Button>
        ) : null}
        <Button onClick={() => setView(view === 'medication' ? 'none' : 'medication')}>Dặn thuốc</Button>
        {has('period_timetable') ? (
          <Button onClick={() => setView(view === 'timetable' ? 'none' : 'timetable')}>Thời khoá biểu</Button>
        ) : null}
        {has('period_attendance') ? (
          <Button onClick={() => setView(view === 'period-attendance' ? 'none' : 'period-attendance')}>
            Điểm danh theo tiết
          </Button>
        ) : null}
        {has('final_year_record') ? (
          <Button onClick={() => setView(view === 'final-year' ? 'none' : 'final-year')}>Hồ sơ cuối cấp</Button>
        ) : null}
      </div>
      {view === 'journal' ? <JournalPanel child={child} /> : null}
      {view === 'medication' ? <MedicationPanel child={child} /> : null}
      {view === 'consent' ? <PhotoConsentPanel child={child} /> : null}
      {view === 'health' ? <HealthPanel child={child} schoolLevel={child.school_level} /> : null}
      {view === 'learning' ? <LearningPanel child={child} /> : null}
      {view === 'interactions' ? <InteractionsPanel child={child} /> : null}
      {view === 'activities' ? <ActivitiesPanel child={child} /> : null}
      {view === 'menu' ? <MenuPanel child={child} /> : null}
      {view === 'pickups' ? <AuthorizedPickupsPanel child={child} /> : null}
      {view === 'services' ? <ServicesPanel child={child} /> : null}
      {view === 'invoices' ? <InvoicesPanel child={child} /> : null}
      {view === 'final-year' ? <FinalYearPanel child={child} /> : null}
      {view === 'boarding' ? <BoardingPanel child={child} /> : null}
      {view === 'timetable' ? <TimetablePanel child={child} /> : null}
      {view === 'period-attendance' ? <PeriodAttendancePanel child={child} month={month} /> : null}
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
  const levelName = useSchoolLevelNames();
  const multiLevel = new Set((children ?? []).map((child) => levelOf(child.school_level))).size > 1;

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
        <NotificationsPanel />
        <PickupConfirmations />
        <PollsPanel />
        {children && children.length === 0 ? (
          <p className="text-content text-text-secondary">Chưa có thông tin của con.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {(children ?? []).map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              levelName={multiLevel ? levelName(child.school_level) : undefined}
              onMessage={setNotice}
            />
          ))}
        </ul>
        <div>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </div>
      </main>
    </div>
  );
}
