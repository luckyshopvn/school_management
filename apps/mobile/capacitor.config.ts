import type { CapacitorConfig } from '@capacitor/cli';

// Vỏ ứng dụng cài đặt bằng Capacitor, bản demo trên máy giả lập (DT-26 phần 26f, YCTD-236). Ứng dụng mở trang khởi động trong `www`
// (chọn trường, vai trò), rồi tải ứng dụng web giáo viên hoặc phụ huynh của trường đó trong WebView. Bản demo chưa đóng gói bản dựng
// tĩnh của hai ứng dụng, chưa có lớp HTTP gốc, mã làm mới trong Keychain, Keystore, sinh trắc học, liên kết sâu (phần còn lại của 26f
// khi có tài khoản nhà phát triển); chưa ký bản phát hành (26h). Đẩy gốc FCM, APNs (26g, YCTD-237): plugin PushNotifications;
// `MainActivity` chèn cầu nối kèm plugin này vào trang của các tên miền được phép. Dự án Android chỉ bật Firebase khi có
// `android/app/google-services.json` (Eric tạo ở dự án Firebase, không đưa vào kho); không có tệp thì đẩy gốc báo không dùng được.
//
// Máy chủ được phép mở trong WebView: localhost (máy giả lập Android chuyển cổng bằng `adb reverse`, iOS Simulator dùng chung mạng của máy
// Mac), 10.0.2.2 (địa chỉ của máy thật nhìn từ máy giả lập Android), *.localhost (tên miền con của môi trường nhiều trường); thêm máy chủ
// khác bằng biến môi trường CAP_CHO_PHEP_MAY_CHU (cách nhau bằng dấu phẩy) khi chạy `cap sync`
const extraHosts = (process.env.CAP_CHO_PHEP_MAY_CHU ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const config: CapacitorConfig = {
  // Mã ứng dụng của bản demo; bản phát hành dùng mã đăng ký với cửa hàng ở 26h
  appId: 'vn.schoolmanagement.demo',
  appName: 'School Management',
  webDir: 'www',
  server: {
    // Tên máy của vỏ khác `localhost` để yêu cầu tới máy chủ phát triển ở localhost không bị vỏ chặn lại làm tệp nội bộ
    hostname: 'vo-ung-dung',
    androidScheme: 'https',
    // Máy chủ phát triển chạy http; bản phát hành chỉ dùng https
    cleartext: true,
    // Hai địa chỉ http của máy chủ phát triển ghi đủ giao thức, cổng để cầu nối gốc nhận tin từ trang ở đó (đẩy gốc, 26g); tên miền
    // không có giao thức được hiểu là https
    allowNavigation: [
      'localhost',
      '10.0.2.2',
      '*.localhost',
      'http://localhost:5174',
      'http://localhost:5175',
      ...extraHosts,
    ],
  },
  plugins: {
    // Thông báo đến khi ứng dụng đang mở vẫn hiện trên thanh thông báo của máy
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
  android: {
    // Gỡ lỗi WebView bằng chrome://inspect ở bản debug
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
