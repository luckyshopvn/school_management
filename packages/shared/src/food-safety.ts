import type { CodeLabel } from './facilities.js';

// Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b, YCTD-146). Ngưỡng theo Quyết định 1246/QĐ-BYT ngày
// 31/3/2017 của Bộ Y tế (hướng dẫn thực hiện chế độ kiểm thực ba bước và lưu mẫu thức ăn); máy chủ dùng để kiểm tra dữ liệu,
// cổng quản trị dùng để dựng biểu mẫu và sổ in

// Lưu mẫu: tối thiểu 100 gam thức ăn đặc, 150 ml thức ăn lỏng; bảo quản 2–8 °C; lưu ít nhất 24 giờ từ lúc lấy mẫu; áp dụng
// cho mọi món của bữa từ 30 suất trở lên
export const FOOD_SAMPLE_MINIMUM = { solid: 100, liquid: 150 } as const;
export const FOOD_SAMPLE_TEMPERATURE = { minimum: 2, maximum: 8 } as const;
export const FOOD_SAMPLE_RETENTION_HOURS = 24;
export const FOOD_SAMPLE_SERVINGS_THRESHOLD = 30;

// Cảnh báo giấy tờ của nhà cung cấp sắp hết hạn trong số ngày này; lô hàng sắp hết hạn dùng trong số ngày này (Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11)
export const FOOD_CERTIFICATE_WARNING_DAYS = 30;
export const FOOD_LOT_EXPIRY_WARNING_DAYS = 3;

export const FOOD_CERTIFICATE_TYPES = [
  { value: 'food_safety', label: 'Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm' },
  { value: 'business_registration', label: 'Giấy chứng nhận đăng ký kinh doanh' },
  { value: 'veterinary', label: 'Giấy chứng nhận vệ sinh thú y' },
  { value: 'quarantine', label: 'Giấy chứng nhận kiểm dịch' },
  { value: 'product_declaration', label: 'Bản tự công bố sản phẩm' },
  { value: 'contract', label: 'Hợp đồng cung cấp thực phẩm' },
  { value: 'other', label: 'Giấy tờ khác' },
] as const satisfies ReadonlyArray<CodeLabel>;

// Tình trạng hiệu lực của giấy tờ tính theo ngày xem
export const FOOD_CERTIFICATE_VALIDITY = [
  { value: 'valid', label: 'Còn hiệu lực' },
  { value: 'expiring', label: 'Sắp hết hạn' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'revoked', label: 'Đã thu hồi' },
] as const satisfies ReadonlyArray<CodeLabel>;
export type FoodCertificateValidity = (typeof FOOD_CERTIFICATE_VALIDITY)[number]['value'];

// Nhóm thực phẩm của lô theo hai bảng của mẫu số 1
export const FOOD_LOT_CATEGORIES = [
  { value: 'fresh', label: 'Tươi sống, đông lạnh' },
  { value: 'dry', label: 'Khô, bao gói sẵn, phụ gia' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_STORAGE_CONDITIONS = [
  { value: 'ambient', label: 'Nhiệt độ thường' },
  { value: 'chilled', label: 'Bảo quản lạnh' },
  { value: 'frozen', label: 'Đông lạnh' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_LOT_STATUSES = [
  { value: 'pending', label: 'Chờ kiểm tra' },
  { value: 'accepted', label: 'Đạt, đã nhận' },
  { value: 'rejected', label: 'Không đạt' },
  { value: 'used_up', label: 'Đã dùng hết' },
  { value: 'disposed', label: 'Đã hủy' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_REJECTION_ACTIONS = [
  { value: 'returned', label: 'Trả lại nhà cung cấp' },
  { value: 'destroyed', label: 'Hủy bỏ' },
  { value: 'other', label: 'Xử lý khác' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_INSPECTION_STEPS = [
  { value: '1', label: 'Bước 1: Kiểm tra trước khi chế biến' },
  { value: '2', label: 'Bước 2: Kiểm tra khi chế biến' },
  { value: '3', label: 'Bước 3: Kiểm tra trước khi ăn' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_CHECK_RESULTS = [
  { value: 'pass', label: 'Đạt' },
  { value: 'fail', label: 'Không đạt' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_SAMPLE_FORMS = [
  { value: 'solid', label: 'Thức ăn đặc, khô (gam)' },
  { value: 'liquid', label: 'Thức ăn lỏng (ml)' },
] as const satisfies ReadonlyArray<CodeLabel>;

export const FOOD_SAMPLE_STATUSES = [
  { value: 'stored', label: 'Đang lưu' },
  { value: 'held', label: 'Giữ mẫu, chưa được hủy' },
  { value: 'destroyed', label: 'Đã hủy' },
] as const satisfies ReadonlyArray<CodeLabel>;

// Hiệu lực của giấy tờ vào một ngày: thu hồi; hết hạn khi ngày hết hạn trước ngày xem; sắp hết hạn khi còn trong số ngày cảnh
// báo; không ghi ngày hết hạn là còn hiệu lực
export function foodCertificateValidity(
  certificate: { status: 'active' | 'revoked'; expires_on: string | null },
  today: string,
  warningDays = FOOD_CERTIFICATE_WARNING_DAYS,
): FoodCertificateValidity {
  if (certificate.status === 'revoked') {
    return 'revoked';
  }
  if (!certificate.expires_on) {
    return 'valid';
  }
  if (certificate.expires_on < today) {
    return 'expired';
  }
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + warningDays * 86_400_000).toISOString().slice(0, 10);
  return certificate.expires_on <= limit ? 'expiring' : 'valid';
}
