import { useState } from 'react';
import { AttendanceScreen } from './screens/AttendanceScreen.js';
import { ActivityScreen } from './screens/ActivityScreen.js';
import { CareScreen } from './screens/CareScreen.js';
import { ChangePasswordScreen } from './screens/ChangePasswordScreen.js';
import { ClassesScreen, type MyClass } from './screens/ClassesScreen.js';
import { GateCheckScreen } from './screens/GateCheckScreen.js';
import { JournalScreen } from './screens/JournalScreen.js';
import { LeaveScreen } from './screens/LeaveScreen.js';
import { MessagesScreen } from './screens/MessagesScreen.js';
import { MealReportScreen } from './screens/MealReportScreen.js';
import { BoardingScreen } from './screens/BoardingScreen.js';
import { MyLibraryScreen } from './screens/MyLibraryScreen.js';
import { AssessmentScreen } from './screens/AssessmentScreen.js';
import { ScoreScreen } from './screens/ScoreScreen.js';
import { PayslipsScreen } from './screens/PayslipsScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { ExternalSignInCallback, isExternalCallbackLocation } from '@school-management/ui';
import { externalRequest } from './session/external-request.js';
import { MedicationScreen } from './screens/MedicationScreen.js';
import { PickupScreen } from './screens/PickupScreen.js';
import { StocktakeScreen } from './screens/StocktakeScreen.js';
import { MyTimetableScreen } from './screens/MyTimetableScreen.js';
import { OnlineClassesScreen } from './screens/OnlineClassesScreen.js';
import { ClassLogScreen } from './screens/ClassLogScreen.js';
import { ClassroomModeScreen } from './screens/ClassroomModeScreen.js';
import { TrainingScreen } from './screens/TrainingScreen.js';
import { TeachingScreen } from './screens/TeachingScreen.js';
import { WorkScreen } from './screens/WorkScreen.js';
import { UpdateBanner, usePushSync } from '@school-management/pwa';
import { Button, DemoBanner, MaintenanceBanner, type MaintenanceNoticeItem } from '@school-management/ui';
import { requestJson } from './session/api-client.js';
import { ClassroomOfflineManager } from './tools/ClassroomOfflineManager.js';
import { ClassroomToolsScreen } from './tools/ClassroomToolsScreen.js';
import { toolboxLinkSearch, withToolboxSearch } from './tools/toolbox-link.js';
import { readRosters } from './tools/classroom-store.js';
import { SessionProvider, useSession } from './session/session.js';

// Thông báo bảo trì của nhà vận hành nền tảng khi đã đăng nhập (DT-SaaS phần S4)
const readPlatformNotices = () => requestJson<{ maintenance: MaintenanceNoticeItem[] }>('/api/v1/platform-notices');

function PlatformMaintenanceBanner() {
  const session = useSession();
  return session.status === 'signed-in' ? <MaintenanceBanner load={readPlatformNotices} /> : null;
}

// Màn hình khi mất mạng lúc mở ứng dụng: công cụ lớp học với bản chụp danh sách lớp còn hạn, không thì báo cần mạng
function OfflineScreen() {
  const session = useSession();
  const [, refresh] = useState(0);
  if (Object.keys(readRosters(new Date())).length === 0) {
    return (
      <main className="mx-auto flex max-w-md flex-col md:max-w-3xl gap-4 px-4 py-6">
        <h1 className="text-page-title font-bold text-text">Chưa có kết nối</h1>
        <p className="text-content text-text-secondary">
          Ứng dụng cần có mạng để đăng nhập. Hộp công cụ giảng dạy dùng được khi mất mạng sau khi bạn đã mở lớp ít nhất
          một lần có mạng trong thời gian lưu danh sách lớp.
        </p>
        <Button variant="primary" onClick={session.retry}>
          Thử kết nối lại
        </Button>
      </main>
    );
  }
  return <ClassroomToolsScreen classes={null} onCleared={() => refresh((value) => value + 1)} />;
}

type Opened =
  | {
      screen:
        | 'attendance'
        | 'pickup'
        | 'journal'
        | 'care'
        | 'messages'
        | 'activity'
        | 'meal'
        | 'boarding'
        | 'assessment'
        | 'scores'
        | 'medication'
        | 'teaching';
      myClass: MyClass;
    }
  | { screen: 'gate'; orgUnitIds: string[] }
  | { screen: 'leave' }
  | { screen: 'payslips' }
  | { screen: 'work' }
  | { screen: 'stocktake' }
  | { screen: 'timetable' }
  | { screen: 'library' }
  | { screen: 'class-log' }
  | { screen: 'training' }
  // classes undefined: mở bằng đường dẫn, màn tự tải lớp của tôi
  | { screen: 'classroom-tools'; classes: MyClass[] | undefined; classId?: string }
  | { screen: 'classroom-mode'; classes: MyClass[] }
  | { screen: 'online-classes' };

// Đường dẫn mở thẳng Hộp công cụ (DT-29, YCTD-325): tên cũ đổi sang tên mới ngay khi mở ứng dụng
function initialOpened(): Opened | undefined {
  const search = toolboxLinkSearch(window.location.search);
  if (search === null) {
    return undefined;
  }
  if (search !== window.location.search) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }
  return { screen: 'classroom-tools', classes: undefined };
}

function setToolboxLocation(open: boolean) {
  const search = withToolboxSearch(window.location.search, open);
  if (search !== window.location.search) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }
}

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function Screens() {
  const session = useSession();
  const [opened, setOpenedState] = useState<Opened | undefined>(initialOpened);
  // Màn mở từ Hộp công cụ quay lại Hộp công cụ
  const [returnTo, setReturnTo] = useState<Opened>();
  const setOpened = (next: Opened | undefined) => {
    setToolboxLocation(next?.screen === 'classroom-tools');
    setOpenedState(next);
  };
  const back = () => {
    setOpened(returnTo);
    setReturnTo(undefined);
  };
  const openFromToolbox = (toolKey: string, myClass: MyClass) => {
    const next: Opened | undefined =
      toolKey === 'lesson-plans'
        ? { screen: 'teaching', myClass }
        : toolKey === 'class-log'
          ? { screen: 'class-log' }
          : toolKey === 'online-classes'
            ? { screen: 'online-classes' }
            : undefined;
    if (next && opened?.screen === 'classroom-tools') {
      setReturnTo({ ...opened, classId: myClass.id });
      setOpened(next);
    }
  };
  // Quay về từ nhà cung cấp định danh bên ngoài (DT-25 bước 25b)
  if (isExternalCallbackLocation(import.meta.env.BASE_URL)) {
    return (
      <ExternalSignInCallback
        request={externalRequest}
        basePath={import.meta.env.BASE_URL}
        ready={session.status !== 'checking'}
        afterLink={import.meta.env.BASE_URL}
      />
    );
  }
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return <LoginScreen />;
  }
  // Mất mạng lúc mở ứng dụng: chỉ công cụ lớp học dùng được, với danh sách lớp đã lưu còn hạn (DT-23 phần 23b, GD-108)
  if (session.status === 'offline') {
    return <OfflineScreen />;
  }
  if (session.passwordChangeRequired) {
    return <ChangePasswordScreen />;
  }
  if (opened?.screen === 'attendance') {
    return <AttendanceScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'journal') {
    return <JournalScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'care') {
    return <CareScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'messages') {
    return <MessagesScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'activity') {
    return <ActivityScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'meal') {
    return <MealReportScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'assessment') {
    return <AssessmentScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'scores') {
    return <ScoreScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'boarding') {
    return <BoardingScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'medication') {
    return <MedicationScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'teaching') {
    return <TeachingScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'pickup') {
    return <PickupScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'payslips') {
    return <PayslipsScreen onBack={back} />;
  }
  if (opened?.screen === 'work') {
    return <WorkScreen onBack={back} />;
  }
  if (opened?.screen === 'leave') {
    return <LeaveScreen onBack={back} />;
  }
  if (opened?.screen === 'timetable') {
    return <MyTimetableScreen onBack={back} />;
  }
  if (opened?.screen === 'library') {
    return <MyLibraryScreen onBack={back} />;
  }
  if (opened?.screen === 'class-log') {
    return <ClassLogScreen onBack={back} />;
  }
  if (opened?.screen === 'training') {
    return <TrainingScreen onBack={back} />;
  }
  if (opened?.screen === 'classroom-mode') {
    return <ClassroomModeScreen classes={opened.classes} onBack={back} />;
  }
  if (opened?.screen === 'classroom-tools') {
    return (
      <ClassroomToolsScreen
        classes={opened.classes}
        initialClassId={opened.classId}
        onBack={back}
        onOpenLink={openFromToolbox}
      />
    );
  }
  if (opened?.screen === 'online-classes') {
    return <OnlineClassesScreen onBack={back} />;
  }
  if (opened?.screen === 'stocktake') {
    return <StocktakeScreen onBack={back} />;
  }
  if (opened?.screen === 'gate') {
    return <GateCheckScreen orgUnitIds={opened.orgUnitIds} onBack={back} />;
  }
  return (
    <ClassesScreen
      onOpen={(myClass) => setOpened({ screen: 'attendance', myClass })}
      onOpenPickup={(myClass) => setOpened({ screen: 'pickup', myClass })}
      onOpenJournal={(myClass) => setOpened({ screen: 'journal', myClass })}
      onOpenCare={(myClass) => setOpened({ screen: 'care', myClass })}
      onOpenTeaching={(myClass) => setOpened({ screen: 'teaching', myClass })}
      onOpenMessages={(myClass) => setOpened({ screen: 'messages', myClass })}
      onOpenActivity={(myClass) => setOpened({ screen: 'activity', myClass })}
      onOpenMealReport={(myClass) => setOpened({ screen: 'meal', myClass })}
      onOpenBoarding={(myClass) => setOpened({ screen: 'boarding', myClass })}
      onOpenAssessment={(myClass) => setOpened({ screen: 'assessment', myClass })}
      onOpenScores={(myClass) => setOpened({ screen: 'scores', myClass })}
      onOpenMedication={(myClass) => setOpened({ screen: 'medication', myClass })}
      onOpenGate={(orgUnitIds) => setOpened({ screen: 'gate', orgUnitIds })}
      onOpenLeave={() => setOpened({ screen: 'leave' })}
      onOpenPayslips={() => setOpened({ screen: 'payslips' })}
      onOpenWork={() => setOpened({ screen: 'work' })}
      onOpenStocktake={() => setOpened({ screen: 'stocktake' })}
      onOpenTimetable={() => setOpened({ screen: 'timetable' })}
      onOpenLibrary={() => setOpened({ screen: 'library' })}
      onOpenClassLog={() => setOpened({ screen: 'class-log' })}
      onOpenTraining={() => setOpened({ screen: 'training' })}
      onOpenClassroomTools={(classes) => setOpened({ screen: 'classroom-tools', classes })}
      onOpenClassroomMode={(classes) => setOpened({ screen: 'classroom-mode', classes })}
      onOpenOnlineClasses={() => setOpened({ screen: 'online-classes' })}
    />
  );
}

// Đã đăng nhập: báo lại đăng ký đẩy của máy cho máy chủ (DT-26 phần 26b)
function PushSync() {
  const session = useSession();
  usePushSync('teacher', import.meta.env.BASE_URL, requestJson, session.status === 'signed-in');
  return null;
}

// Giao diện chỉ gọi giao diện lập trình ứng dụng, không chứa quy tắc nghiệp vụ (QU-09)
export function Application() {
  return (
    <SessionProvider>
      {/* Dải bản trình diễn (DT-18 phần 18h) */}
      <DemoBanner />
      <PlatformMaintenanceBanner />
      {/* Có bản mới của ứng dụng: hỏi tải lại (DT-26 phần 26a) */}
      <UpdateBanner />
      <ClassroomOfflineManager />
      <PushSync />
      <Screens />
    </SessionProvider>
  );
}
