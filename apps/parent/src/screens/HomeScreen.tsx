import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { InstallPrompt, PushSettingsPanel } from '@school-management/pwa';
import { Alert, Button, ExternalLinksPanel, StatusBadge, TextField } from '@school-management/ui';
import { externalRequest } from '../session/external-request.js';
import { ApiError, fetchCurrentUser, requestJson, type CurrentUser } from '../session/api-client.js';
import { useSession } from '../session/session.js';
import { AuthorizedPickupsPanel, PickupConfirmations } from './PickupSections.js';
import { InvoicesPanel } from './InvoicesPanel.js';
import { DueInvoicesCard, RecentScoresCard } from './ChildSummaryCards.js';
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
import { SupportViewPicker } from './SupportViewPicker.js';
import { FinalYearPanel } from './FinalYearPanel.js';
import { BoardingPanel } from './BoardingPanel.js';
import { LibraryPanel } from './LibraryPanel.js';
import { OnlineLearningPanel } from './OnlineLearningPanel.js';
import { TimetablePanel } from './TimetablePanel.js';
import { AssessmentPanel } from './AssessmentPanel.js';
import { ScorePanel } from './ScorePanel.js';
import { PeriodAttendancePanel } from './PeriodAttendancePanel.js';
import { LearningRecordPanel } from './LearningRecordPanel.js';
import { ProctorConsentPanel } from './ProctorConsentPanel.js';
import { TutoringPanel } from './TutoringPanel.js';
import { AiTutorPanel } from '../ai-tutor/AiTutorPanel.js';
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

// Chữ viết tắt trên ảnh đại diện của con: chữ đầu của hai tiếng cuối trong họ tên, ví dụ "Nguyễn Minh Anh" thành "MA"
function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi'))
    .join('');
}

// Biểu tượng nét của lối tắt (mẫu giao diện phụ huynh); chỉ để trang trí, tên nút là chữ bên dưới
function ShortcutIcon({ path }: { path: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const SHORTCUT_ICONS = {
  absence: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 15l2 2 4-4',
  timetable: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  menu: 'M7 2v9a2 2 0 0 0 2 2v9M11 2v7M3 2v7a4 4 0 0 0 4 4M17 22V2c-2 2-3 5-3 8h3',
  invoices: 'M3 6h18v12H3ZM3 10h18M7 15h3',
};

function ShortcutButton({ icon, onClick, children }: { icon: string; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg text-center text-xs font-medium text-text-secondary"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-selected text-brand">
        <ShortcutIcon path={icon} />
      </span>
      {children}
    </button>
  );
}

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
    | 'assessment'
    | 'library'
    | 'scores'
    | 'period-attendance'
    | 'learning-record'
    | 'proctor-consent'
    | 'online-learning'
    | 'tutoring'
    | 'ai-tutor'
  >('none');
  const [attendance, setAttendance] = useState<MonthAttendance>();
  const [errorMessage, setErrorMessage] = useState<string>();
  // Điểm danh hôm nay của con học lớp có điểm danh theo ngày, lấy từ điểm danh tháng này; lỗi thì chỉ không hiện dòng hôm nay
  const [todayStatus, setTodayStatus] = useState<{ tone: 'success' | 'warning'; text: string }>();
  const month = vietnamToday().slice(0, 7);
  const dailyAttendance = has('daily_attendance');

  const loadToday = useCallback(async () => {
    const day = vietnamToday();
    try {
      const loaded = await requestJson<MonthAttendance>(
        `/api/v1/children/${child.id}/attendance?month=${day.slice(0, 7)}`,
      );
      const record = loaded.records.find((item) => item.attendance_date === day);
      const absence = loaded.absences.find((item) => item.absence_date === day);
      if (record) {
        const absent = record.status === 'absent_notified' || record.status === 'absent_unnotified';
        setTodayStatus({
          tone: absent ? 'warning' : 'success',
          text: `Hôm nay: ${STATUS_LABELS[record.status] ?? record.status}`,
        });
      } else {
        setTodayStatus(absence ? { tone: 'warning', text: 'Hôm nay: phụ huynh đã báo vắng' } : undefined);
      }
    } catch {
      setTodayStatus(undefined);
    }
  }, [child.id]);

  useEffect(() => {
    if (dailyAttendance) {
      void loadToday();
    }
  }, [dailyAttendance, loadToday]);

  const loadAttendance = useCallback(async () => {
    try {
      setAttendance(await requestJson<MonthAttendance>(`/api/v1/children/${child.id}/attendance?month=${month}`));
    } catch (error) {
      setErrorMessage(messageOf(error));
    }
  }, [child.id, month]);

  return (
    <li className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4" aria-label={child.full_name}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-selected font-bold text-brand-strong"
          aria-hidden="true"
        >
          {initialsOf(child.full_name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold text-text">{child.full_name}</span>
          <span className="text-label text-text-secondary">
            {[levelName, child.class_name].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>
      {todayStatus ? (
        <p
          className={`rounded-lg px-3 py-2.5 text-label font-medium ${
            todayStatus.tone === 'success' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}
        >
          {todayStatus.text}
        </p>
      ) : null}
      {/* Thẻ tóm tắt Khoản cần nộp, Điểm mới (YCTD-320); không có dữ liệu thì ẩn */}
      <DueInvoicesCard childId={child.id} onOpen={() => setView('invoices')} />
      {has('student_scores') ? <RecentScoresCard childId={child.id} onOpen={() => setView('scores')} /> : null}
      {/* Lối tắt bốn ô (mẫu giao diện phụ huynh): báo vắng, thời khoá biểu, thực đơn, học phí; ô nào cấp của con không có thì ẩn */}
      <div className="grid grid-cols-4 gap-2">
        {/* Báo vắng theo ngày dùng chung cho mọi cấp có điểm danh (DT-20 phần 20d) */}
        {has('daily_attendance') || has('period_attendance') ? (
          <ShortcutButton
            icon={SHORTCUT_ICONS.absence}
            onClick={() => setView(view === 'absence' ? 'none' : 'absence')}
          >
            Báo vắng
          </ShortcutButton>
        ) : null}
        {has('period_timetable') ? (
          <ShortcutButton
            icon={SHORTCUT_ICONS.timetable}
            onClick={() => setView(view === 'timetable' ? 'none' : 'timetable')}
          >
            Thời khoá biểu
          </ShortcutButton>
        ) : null}
        <ShortcutButton icon={SHORTCUT_ICONS.menu} onClick={() => setView(view === 'menu' ? 'none' : 'menu')}>
          Thực đơn
        </ShortcutButton>
        <ShortcutButton
          icon={SHORTCUT_ICONS.invoices}
          onClick={() => setView(view === 'invoices' ? 'none' : 'invoices')}
        >
          Học phí
        </ShortcutButton>
      </div>
      <div className="flex flex-wrap gap-2">
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
        <Button onClick={() => setView(view === 'consent' ? 'none' : 'consent')}>Hình ảnh</Button>
        <Button onClick={() => setView(view === 'health' ? 'none' : 'health')}>Sức khỏe</Button>
        <Button onClick={() => setView(view === 'learning' ? 'none' : 'learning')}>Học tập</Button>
        <Button onClick={() => setView(view === 'interactions' ? 'none' : 'interactions')}>Trao đổi</Button>
        <Button onClick={() => setView(view === 'activities' ? 'none' : 'activities')}>Hoạt động</Button>
        {has('learning_record') ? (
          <Button onClick={() => setView(view === 'learning-record' ? 'none' : 'learning-record')}>Học bạ</Button>
        ) : null}
        {has('student_assessment') ? (
          <Button onClick={() => setView(view === 'assessment' ? 'none' : 'assessment')}>Kết quả đánh giá</Button>
        ) : null}
        {has('student_scores') ? (
          <Button onClick={() => setView(view === 'scores' ? 'none' : 'scores')}>Điểm học tập</Button>
        ) : null}
        {has('boarding_meal') ? (
          <Button onClick={() => setView(view === 'boarding' ? 'none' : 'boarding')}>Cắt suất bán trú</Button>
        ) : null}
        {has('library_loans') ? (
          <Button onClick={() => setView(view === 'library' ? 'none' : 'library')}>Sách thư viện</Button>
        ) : null}
        <Button onClick={() => setView(view === 'medication' ? 'none' : 'medication')}>Dặn thuốc</Button>
        {has('period_attendance') ? (
          <Button onClick={() => setView(view === 'period-attendance' ? 'none' : 'period-attendance')}>
            Điểm danh theo tiết
          </Button>
        ) : null}
        {has('learning_record') ? (
          <Button onClick={() => setView(view === 'proctor-consent' ? 'none' : 'proctor-consent')}>
            Giám sát thi trực tuyến
          </Button>
        ) : null}
        {has('online_learning') ? (
          <Button onClick={() => setView(view === 'online-learning' ? 'none' : 'online-learning')}>
            Học trực tuyến
          </Button>
        ) : null}
        {/* Gia sư trong trường (DT-27 phần 27b): từ Tiểu học trở lên */}
        {has('period_timetable') ? (
          <Button onClick={() => setView(view === 'tutoring' ? 'none' : 'tutoring')}>Gia sư</Button>
        ) : null}
        {/* Gia sư AI trả phí (YCTD-383 lát L1a): Tiểu học, Trung học cơ sở, Trung học phổ thông */}
        {['TH', 'THCS', 'THPT'].includes(child.school_level ?? '') ? (
          <Button onClick={() => setView(view === 'ai-tutor' ? 'none' : 'ai-tutor')}>Gia sư AI</Button>
        ) : null}
        {has('final_year_record') ? (
          <Button onClick={() => setView(view === 'final-year' ? 'none' : 'final-year')}>Hồ sơ cuối cấp</Button>
        ) : null}
      </div>
      {view === 'journal' ? <JournalPanel child={child} /> : null}
      {view === 'medication' ? <MedicationPanel child={child} /> : null}
      {view === 'tutoring' ? <TutoringPanel child={child} /> : null}
      {view === 'ai-tutor' ? <AiTutorPanel child={child} /> : null}
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
      {view === 'assessment' ? <AssessmentPanel child={child} /> : null}
      {view === 'library' ? <LibraryPanel child={child} /> : null}
      {view === 'scores' ? <ScorePanel child={child} /> : null}
      {view === 'period-attendance' ? <PeriodAttendancePanel child={child} month={month} /> : null}
      {view === 'learning-record' ? <LearningRecordPanel child={child} /> : null}
      {view === 'proctor-consent' ? <ProctorConsentPanel child={child} /> : null}
      {view === 'online-learning' ? <OnlineLearningPanel child={child} /> : null}
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {view === 'absence' ? (
        <AbsenceForm
          child={child}
          onDone={(message) => {
            setView('none');
            onMessage(message);
            if (dailyAttendance) {
              void loadToday();
            }
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

type ParentTab = 'home' | 'schedule' | 'messages' | 'account';

const TAB_TITLES: Record<ParentTab, string> = {
  home: 'Trang chủ',
  schedule: 'Lịch học',
  messages: 'Tin nhắn',
  account: 'Tài khoản',
};

const TAB_ICONS: Record<ParentTab, ReactNode> = {
  home: <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
  schedule: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  messages: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />,
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
};

// Thanh điều hướng dưới cố định (YCTD-351): bốn mục, mỗi mục cao 52 px; mục đang mở có aria-current
function BottomNav({ current, onSelect }: { current: ParentTab; onSelect(tab: ParentTab): void }) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 md:max-w-3xl">
        {(Object.keys(TAB_TITLES) as ParentTab[]).map((tab) => (
          <li key={tab}>
            <button
              type="button"
              aria-current={current === tab ? 'page' : undefined}
              onClick={() => {
                onSelect(tab);
                window.scrollTo({ top: 0 });
              }}
              className={`flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 text-xs ${
                current === tab ? 'font-semibold text-brand-strong' : 'font-medium text-text-secondary'
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {TAB_ICONS[tab]}
              </svg>
              {TAB_TITLES[tab]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
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

  // Phiên quản trị nền tảng vào thẳng (YCTD-315b): không tải "con của tôi" mà chọn lớp, học sinh để xem
  const supportView = user?.support?.full_access === true;
  useEffect(() => {
    fetchCurrentUser()
      .then((current) => {
        setUser(current);
        if (current.support?.full_access) {
          setChildren([]);
          return;
        }
        return requestJson<{ items: Child[] }>('/api/v1/children?page_size=50&status=active').then((page) =>
          setChildren(page.items),
        );
      })
      .catch(() => setFailed(true));
  }, []);
  const viewChild = (classId: string, childId: string) => {
    requestJson<{ items: Child[] }>(`/api/v1/children?page_size=200&status=active&class_id=${classId}`)
      .then((page) => setChildren(page.items.filter((child) => child.id === childId)))
      .catch(() => setFailed(true));
  };
  // Thanh điều hướng dưới và nút Đổi con theo mẫu giao diện phụ huynh (YCTD-351): mặc định hiện mọi con; chọn một con thì
  // trang chủ, lịch học, tin nhắn chỉ của con đó
  const [tab, setTab] = useState<ParentTab>('home');
  const [selectedId, setSelectedId] = useState('');
  const shown = (children ?? []).filter((child) => selectedId === '' || child.id === selectedId);
  const childPicker =
    children && children.length > 1 ? (
      <label className="flex items-center gap-2 text-label font-medium text-white">
        Đổi con
        <select
          aria-label="Đổi con"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="min-h-11 rounded-lg border border-selected bg-header-strong px-3 text-content text-white"
        >
          <option value="">Tất cả các con</option>
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.full_name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  if (tab !== 'home') {
    return (
      <div className="min-h-screen pb-24">
        <header className="bg-header text-white">
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 px-4 py-4 md:max-w-3xl">
            <h1 className="text-section-title font-bold">{TAB_TITLES[tab]}</h1>
            {tab === 'account' ? null : childPicker}
          </div>
        </header>
        <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4 md:max-w-3xl">
          {tab === 'schedule'
            ? shown.map((child) => (
                <section
                  key={child.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                  aria-label={`Lịch học của ${child.full_name}`}
                >
                  <h2 className="text-content font-semibold text-text">{child.full_name}</h2>
                  {/* Cấp phổ thông xem thời khoá biểu theo tiết; Mầm non xem lịch hoạt động ở bảng Học tập */}
                  {hasLevelFeature(child.school_level, 'period_timetable') ? (
                    <TimetablePanel child={child} />
                  ) : (
                    <LearningPanel child={child} />
                  )}
                </section>
              ))
            : null}
          {tab === 'messages' ? (
            <>
              <NotificationsPanel />
              {shown.map((child) => (
                <section
                  key={child.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                  aria-label={`Trao đổi về ${child.full_name}`}
                >
                  <h2 className="text-content font-semibold text-text">{child.full_name}</h2>
                  <InteractionsPanel child={child} />
                </section>
              ))}
            </>
          ) : null}
          {tab === 'account' ? (
            <>
              <section
                className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4"
                aria-label="Tài khoản"
              >
                <span className="text-content font-semibold text-text">{user?.full_name ?? ''}</span>
                {children && children.length > 0 ? (
                  <span className="text-label text-text-secondary">
                    Phụ huynh của {children.map((child) => child.full_name).join(', ')}
                  </span>
                ) : null}
              </section>
              <InstallPrompt applicationName="ứng dụng phụ huynh" />
              <PushSettingsPanel application="parent" base={import.meta.env.BASE_URL} request={requestJson} />
              <ExternalLinksPanel request={externalRequest} basePath={import.meta.env.BASE_URL} />
              <div>
                <Button onClick={() => void session.logout()}>Đăng xuất</Button>
              </div>
            </>
          ) : null}
        </main>
        <BottomNav current={tab} onSelect={setTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Thanh chào xanh (mẫu giao diện phụ huynh); thẻ của con ở cột đầu đè lên mép dưới của thanh */}
      <header className="bg-header text-white">
        <div className="mx-auto max-w-md px-4 pb-14 pt-6 md:max-w-5xl lg:max-w-6xl">
          {user ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="flex flex-col gap-1">
                <span className="text-label font-normal text-selected">Xin chào,</span>{' '}
                <span className="text-xl font-bold">{user.full_name}</span>
              </h1>
              {childPicker}
            </div>
          ) : (
            <div className="flex flex-col gap-2" aria-hidden="true">
              <div className="h-4 w-20 animate-pulse rounded bg-header-strong" />
              <div className="h-6 w-48 animate-pulse rounded bg-header-strong" />
            </div>
          )}
        </div>
      </header>
      {/* Máy tính bảng (DT-26 phần 26d): hai cột, trái là thẻ của từng con; phải là thông báo, đón trả, khảo sát; điện thoại một cột,
          thẻ của con lên đầu theo mẫu giao diện phụ huynh */}
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-6 md:grid md:max-w-5xl md:grid-cols-2 md:items-start lg:max-w-6xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative -mt-10 flex flex-col gap-4">
          {failed ? <Alert tone="danger">Không tải được thông tin, vui lòng thử lại</Alert> : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {supportView ? <SupportViewPicker onPick={viewChild} /> : null}
          {!supportView && children && children.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-4 text-content text-text-secondary">
              Chưa có thông tin của con.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {shown.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                levelName={multiLevel ? levelName(child.school_level) : undefined}
                onMessage={setNotice}
              />
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4 md:mt-4">
          {/* Mời cài lên màn hình chính (DT-26 phần 26a) */}
          <InstallPrompt applicationName="ứng dụng phụ huynh" />
          <NotificationsPanel />
          {/* Bật, tắt thông báo đẩy và chọn nhóm (DT-26 phần 26b) */}
          <PushSettingsPanel application="parent" base={import.meta.env.BASE_URL} request={requestJson} />
          <PickupConfirmations />
          <PollsPanel />
          <ExternalLinksPanel request={externalRequest} basePath={import.meta.env.BASE_URL} />
          <div>
            <Button onClick={() => void session.logout()}>Đăng xuất</Button>
          </div>
        </div>
      </main>
      <BottomNav current={tab} onSelect={setTab} />
    </div>
  );
}
