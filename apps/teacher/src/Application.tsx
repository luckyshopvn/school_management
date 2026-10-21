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
import { PayslipsScreen } from './screens/PayslipsScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { MedicationScreen } from './screens/MedicationScreen.js';
import { PickupScreen } from './screens/PickupScreen.js';
import { StocktakeScreen } from './screens/StocktakeScreen.js';
import { TeachingScreen } from './screens/TeachingScreen.js';
import { WorkScreen } from './screens/WorkScreen.js';
import { DemoBanner } from '@school-management/ui';
import { SessionProvider, useSession } from './session/session.js';

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function Screens() {
  const session = useSession();
  const [opened, setOpened] = useState<
    | {
        screen:
          'attendance' | 'pickup' | 'journal' | 'care' | 'messages' | 'activity' | 'meal' | 'medication' | 'teaching';
        myClass: MyClass;
      }
    | { screen: 'gate'; orgUnitIds: string[] }
    | { screen: 'leave' }
    | { screen: 'payslips' }
    | { screen: 'work' }
    | { screen: 'stocktake' }
  >();
  const back = () => setOpened(undefined);
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return <LoginScreen />;
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
      onOpenMedication={(myClass) => setOpened({ screen: 'medication', myClass })}
      onOpenGate={(orgUnitIds) => setOpened({ screen: 'gate', orgUnitIds })}
      onOpenLeave={() => setOpened({ screen: 'leave' })}
      onOpenPayslips={() => setOpened({ screen: 'payslips' })}
      onOpenWork={() => setOpened({ screen: 'work' })}
      onOpenStocktake={() => setOpened({ screen: 'stocktake' })}
    />
  );
}

// Giao diện chỉ gọi giao diện lập trình ứng dụng, không chứa quy tắc nghiệp vụ (QU-09)
export function Application() {
  return (
    <SessionProvider>
      {/* Dải bản trình diễn (DT-18 phần 18h) */}
      <DemoBanner />
      <Screens />
    </SessionProvider>
  );
}
