import { useEffect, useState } from 'react';
import { StudentActivationScreen } from './StudentActivationScreen.js';
import { StudentHomeScreen } from './StudentHomeScreen.js';
import { StudentLoginScreen } from './StudentLoginScreen.js';
import { StudentSessionProvider, useStudentSession } from './student-session.js';

// Màn hình học sinh nằm trong ứng dụng phụ huynh, mở bằng địa chỉ có #hoc-sinh (DT-23 phần 23a; không dựng ứng dụng thứ tư, kênh
// đăng nhập student riêng, cookie riêng nên không đè phiên phụ huynh)
export const STUDENT_HASH = '#hoc-sinh';

export function useStudentRoute(): boolean {
  const [active, setActive] = useState(() => window.location.hash.startsWith(STUDENT_HASH));
  useEffect(() => {
    const onChange = () => setActive(window.location.hash.startsWith(STUDENT_HASH));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return active;
}

function Screens() {
  const session = useStudentSession();
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
