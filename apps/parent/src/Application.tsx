import { ActivationScreen } from './screens/ActivationScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { RecruitmentScreen, useRecruitmentRoute } from './screens/RecruitmentScreen.js';
import { SessionProvider, useSession } from './session/session.js';

// Chọn màn hình theo trạng thái phiên: chưa đăng nhập về MH-47; phiên bằng mật khẩu mặc định về MH-48 (BM-69)
function Screens() {
  const session = useSession();
  // Trang tuyển dụng công khai không cần đăng nhập (MH-65, YCTD-87)
  const recruitment = useRecruitmentRoute();
  if (recruitment) {
    return <RecruitmentScreen />;
  }
  if (session.status === 'checking') {
    return <div className="min-h-screen animate-pulse bg-page" aria-busy="true" />;
  }
  if (session.status === 'signed-out') {
    return <LoginScreen />;
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
      <Screens />
    </SessionProvider>
  );
}
