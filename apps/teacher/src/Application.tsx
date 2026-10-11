import { useState } from 'react';
import { AttendanceScreen } from './screens/AttendanceScreen.js';
import { ChangePasswordScreen } from './screens/ChangePasswordScreen.js';
import { ClassesScreen, type MyClass } from './screens/ClassesScreen.js';
import { GateCheckScreen } from './screens/GateCheckScreen.js';
import { JournalScreen } from './screens/JournalScreen.js';
import { LeaveScreen } from './screens/LeaveScreen.js';
import { PayslipsScreen } from './screens/PayslipsScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { PickupScreen } from './screens/PickupScreen.js';
import { SessionProvider, useSession } from './session/session.js';

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function Screens() {
  const session = useSession();
  const [opened, setOpened] = useState<
    | { screen: 'attendance' | 'pickup' | 'journal'; myClass: MyClass }
    | { screen: 'gate'; orgUnitIds: string[] }
    | { screen: 'leave' }
    | { screen: 'payslips' }
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
  if (opened?.screen === 'pickup') {
    return <PickupScreen myClass={opened.myClass} onBack={back} />;
  }
  if (opened?.screen === 'payslips') {
    return <PayslipsScreen onBack={back} />;
  }
  if (opened?.screen === 'leave') {
    return <LeaveScreen onBack={back} />;
  }
  if (opened?.screen === 'gate') {
    return <GateCheckScreen orgUnitIds={opened.orgUnitIds} onBack={back} />;
  }
  return (
    <ClassesScreen
      onOpen={(myClass) => setOpened({ screen: 'attendance', myClass })}
      onOpenPickup={(myClass) => setOpened({ screen: 'pickup', myClass })}
      onOpenJournal={(myClass) => setOpened({ screen: 'journal', myClass })}
      onOpenGate={(orgUnitIds) => setOpened({ screen: 'gate', orgUnitIds })}
      onOpenLeave={() => setOpened({ screen: 'leave' })}
      onOpenPayslips={() => setOpened({ screen: 'payslips' })}
    />
  );
}

// Giao diện chỉ gọi giao diện lập trình ứng dụng, không chứa quy tắc nghiệp vụ (QU-09)
export function Application() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}
