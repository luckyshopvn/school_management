// Ứng dụng học sinh tách khỏi ứng dụng phụ huynh (quyết định ngày 2026-10-28, YCTD-300). Thẻ QR, liên kết kích hoạt và lối tắt đã
// cài trước đó mở `<ứng dụng phụ huynh>#hoc-sinh`: chuyển sang địa chỉ của ứng dụng học sinh (đường dẫn tương đối tính theo trang
// hiện tại). Không mang theo phần sau `#hoc-sinh` vì ứng dụng học sinh không định tuyến bằng hash
export const STUDENT_HASH = '#hoc-sinh';

export function studentAppRedirect(currentHref: string, studentAppUrl: string): string | undefined {
  const current = new URL(currentHref);
  if (!current.hash.startsWith(STUDENT_HASH)) {
    return undefined;
  }
  return new URL(studentAppUrl, current).href;
}
