import { useState } from 'react';
import { ActivationScreen } from './screens/ActivationScreen.js';
import { AdmissionsScreen } from './screens/AdmissionsScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { RecruitmentScreen, useRecruitmentRoute } from './screens/RecruitmentScreen.js';
import { DemoBanner } from '@school-management/ui';
import { SessionProvider, useSession } from './session/session.js';

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47 hoặc trang tuyển sinh trực tuyến công khai (MP-21, mở
// bằng nút trên màn hình đăng nhập hoặc địa chỉ có #tuyen-sinh); phiên bằng mật khẩu mặc định về MH-48 (BM-69)
const ADMISSIONS_HASH = '#tuyen-sinh';

function Screens() {
  const session = useSession();
  // Trang tuyển dụng công khai không cần đăng nhập (MH-65, YCTD-87)
  const recruitment = useRecruitmentRoute();
  const [admissions, setAdmissions] = useState(() => window.location.hash === ADMISSIONS_HASH);
  const showAdmissions = (visible: boolean) => {
    window.location.hash = visible ? ADMISSIONS_HASH : '';
    setAdmissions(visible);
  };
  if (recruitment) {
    return <RecruitmentScreen />;
  }
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return admissions ? (
      <AdmissionsScreen onBack={() => showAdmissions(false)} />
    ) : (
      <LoginScreen onAdmissions={() => showAdmissions(true)} />
    );
  }
  if (session.passwordChangeRequired) {
    return <ActivationScreen />;
  }
  return <HomeScreen />;
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
