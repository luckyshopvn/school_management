import { usePushSync } from '@school-management/pwa';
import { useEffect, useState } from 'react';
import { requestStudentJson, setSupportViewChild } from './student-api.js';
import { hasSupportViewChild, readSupportStatus, SupportViewBar, SupportViewPicker } from './SupportViewPicker.js';
import { StudentActivationScreen } from './StudentActivationScreen.js';
import { StudentHomeScreen } from './StudentHomeScreen.js';
import { StudentLoginScreen } from './StudentLoginScreen.js';
import { StudentSessionProvider, useStudentSession } from './student-session.js';

// Ứng dụng học sinh (DT-23 phần 23a, YCTD-211; tách khỏi ứng dụng phụ huynh theo quyết định ngày 2026-10-28, YCTD-300). Kênh đăng
// nhập student riêng, cookie riêng; địa chỉ cũ `<ứng dụng phụ huynh>#hoc-sinh` chuyển sang đây
// Phiên quản trị nền tảng vào thẳng (YCTD-315b): chọn học sinh để xem trước, có thanh "Đổi học sinh"; phiên thường không đổi
function SupportAwareHome() {
  const [mode, setMode] = useState<'checking' | 'student' | 'support'>('checking');
  const [picked, setPicked] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    readSupportStatus()
      .then((status) => setMode(status.support?.full_access ? 'support' : 'student'))
      .catch(() => setMode('student'));
  }, []);
  if (mode === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (mode === 'student') {
    return <StudentHomeScreen />;
  }
  if (!hasSupportViewChild()) {
    return (
      <SupportViewPicker
        onPicked={(name) => {
          setPicked(name);
          setVersion((value) => value + 1);
        }}
      />
    );
  }
  return (
    <>
      <SupportViewBar
        name={picked}
        onChange={() => {
          setSupportViewChild(null);
          setPicked(null);
          setVersion((value) => value + 1);
        }}
      />
      <StudentHomeScreen key={version} />
    </>
  );
}

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
  return <SupportAwareHome />;
}

export function StudentApplication() {
  return (
    <StudentSessionProvider>
      <Screens />
    </StudentSessionProvider>
  );
}
