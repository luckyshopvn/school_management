// Đường dẫn mở thẳng Hộp công cụ giảng dạy (DT-29, YCTD-325): `?man=hop-cong-cu` (lối tắt trên màn hình chính, liên kết gửi cho
// giáo viên). Tên cũ `?man=cong-cu-lop-hoc` của Công cụ lớp học vẫn mở được và đổi sang tên mới để liên kết cũ không gãy.
// Hàm thuần, không đụng tới window, để kiểm thử bằng node --test
export const TOOLBOX_PARAMETER = 'man';
export const TOOLBOX_VALUE = 'hop-cong-cu';
const OLD_TOOLBOX_VALUES: readonly string[] = ['cong-cu-lop-hoc'];

// Trả chuỗi truy vấn chuẩn (có ?) khi đường dẫn mở Hộp công cụ, null khi không
export function toolboxLinkSearch(search: string): string | null {
  const parameters = new URLSearchParams(search);
  const value = parameters.get(TOOLBOX_PARAMETER);
  if (value !== TOOLBOX_VALUE && (value === null || !OLD_TOOLBOX_VALUES.includes(value))) {
    return null;
  }
  parameters.set(TOOLBOX_PARAMETER, TOOLBOX_VALUE);
  return `?${parameters.toString()}`;
}

// Chuỗi truy vấn khi mở (true) hoặc đóng (false) Hộp công cụ, giữ các tham số khác
export function withToolboxSearch(search: string, open: boolean): string {
  const parameters = new URLSearchParams(search);
  if (open) {
    parameters.set(TOOLBOX_PARAMETER, TOOLBOX_VALUE);
  } else {
    parameters.delete(TOOLBOX_PARAMETER);
  }
  const text = parameters.toString();
  return text ? `?${text}` : '';
}
