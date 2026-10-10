import { useState } from 'react';
import { AttendanceScreen } from './screens/AttendanceScreen.js';
import { ChangePasswordScreen } from './screens/ChangePasswordScreen.js';
import { ClassesScreen, type MyClass } from './screens/ClassesScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { SessionProvider, useSession } from './session/session.js';

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47; bắt buộc đổi mật khẩu về MH-48 (BM-07)
function Screens() {
  const session = useSession();
  const [openClass, setOpenClass] = useState<MyClass>();
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return <LoginScreen />;
  }
  if (session.passwordChangeRequired) {
    return <ChangePasswordScreen />;
  }
  if (openClass) {
    return <AttendanceScreen myClass={openClass} onBack={() => setOpenClass(undefined)} />;
  }
  return <ClassesScreen onOpen={setOpenClass} />;
}

// Giao diện chỉ gọi giao diện lập trình ứng dụng, không chứa quy tắc nghiệp vụ (QU-09)
export function Application() {
  return (
    <SessionProvider>
      <Screens />
    </SessionProvider>
  );
}
