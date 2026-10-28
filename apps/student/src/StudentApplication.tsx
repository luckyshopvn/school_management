import { usePushSync } from '@school-management/pwa';
import { requestStudentJson } from './student-api.js';
import { StudentActivationScreen } from './StudentActivationScreen.js';
import { StudentHomeScreen } from './StudentHomeScreen.js';
import { StudentLoginScreen } from './StudentLoginScreen.js';
import { StudentSessionProvider, useStudentSession } from './student-session.js';

// Ứng dụng học sinh (DT-23 phần 23a, YCTD-211; tách khỏi ứng dụng phụ huynh theo quyết định ngày 2026-10-28, YCTD-300). Kênh đăng
// nhập student riêng, cookie riêng; địa chỉ cũ `<ứng dụng phụ huynh>#hoc-sinh` chuyển sang đây
function Screens() {
  const session = useStudentSession();
  // Đã đăng nhập: báo lại đăng ký đẩy của máy cho máy chủ (DT-26 phần 26b)
  usePushSync('student', import.meta.env.BASE_URL, requestStudentJson, session.status === 'signed-in');
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return <StudentLoginScreen />;
  }
  if (session.passwordChangeRequired) {
    return <StudentActivationScreen />;
  }
  return <StudentHomeScreen />;
}

export function StudentApplication() {
  return (
    <StudentSessionProvider>
      <Screens />
    </StudentSessionProvider>
  );
}
