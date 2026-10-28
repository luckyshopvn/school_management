import { useState } from 'react';
import { ActivationScreen } from './screens/ActivationScreen.js';
import { AdmissionsScreen } from './screens/AdmissionsScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { RecruitmentScreen, useRecruitmentRoute } from './screens/RecruitmentScreen.js';
import { UpdateBanner, usePushSync } from '@school-management/pwa';
import {
  DemoBanner,
  ExternalSignInCallback,
  isExternalCallbackLocation,
  MaintenanceBanner,
  type MaintenanceNoticeItem,
} from '@school-management/ui';
import { externalRequest } from './session/external-request.js';
import { requestJson } from './session/api-client.js';
import { SessionProvider, useSession } from './session/session.js';

// Thông báo bảo trì của nhà vận hành nền tảng khi đã đăng nhập (DT-SaaS phần S4)
const readPlatformNotices = () => requestJson<{ maintenance: MaintenanceNoticeItem[] }>('/api/v1/platform-notices');

function PlatformMaintenanceBanner() {
  const session = useSession();
  return session.status === 'signed-in' ? <MaintenanceBanner load={readPlatformNotices} /> : null;
}

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

// Đã đăng nhập: báo lại đăng ký đẩy của máy cho máy chủ (DT-26 phần 26b)
function PushSync() {
  const session = useSession();
  usePushSync('parent', import.meta.env.BASE_URL, requestJson, session.status === 'signed-in');
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
      <PushSync />
      <Screens />
    </SessionProvider>
  );
}
