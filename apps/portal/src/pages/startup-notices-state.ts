// Hộp thông báo khi vào trang (DT-16 phần 16c) chỉ hiện một lần mỗi lần đăng nhập trên một thẻ trình duyệt; đăng xuất thì
// xóa dấu để lần đăng nhập sau hiện lại. Bộ nhớ phiên có thể bị chặn (chế độ riêng tư) thì hiện lại mỗi lần tải trang
export const STARTUP_NOTICES_KEY = 'portal.startup-notices-shown';

export function startupNoticesShown(): boolean {
  try {
    return sessionStorage.getItem(STARTUP_NOTICES_KEY) === '1';
  } catch {
    return false;
  }
}

export function markStartupNoticesShown(): void {
  try {
    sessionStorage.setItem(STARTUP_NOTICES_KEY, '1');
  } catch {
    // Không ghi được thì lần tải trang sau hiện lại
  }
}

export function clearStartupNoticesShown(): void {
  try {
    sessionStorage.removeItem(STARTUP_NOTICES_KEY);
  } catch {
    // Bỏ qua khi bộ nhớ phiên bị chặn
  }
}
