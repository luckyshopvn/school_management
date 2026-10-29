import type { EffectiveSetting } from './settings-api.js';

// Nhóm của trang 1.4 Cấu hình trường theo thiết kế "Cổng quản trị trường" (YCTD-335): danh sách nhóm ở bên trái, bấm nhóm thì
// cuộn tới khối của nhóm. Thứ tự ở đây là thứ tự hiện trên trang
export const SETTING_GROUPS = [
  { key: 'general', label: 'Thông tin chung' },
  { key: 'levels', label: 'Cấp học' },
  { key: 'fees', label: 'Học phí, dịch vụ' },
  { key: 'staff', label: 'Nhân sự, chấm công' },
  { key: 'health', label: 'Y tế, bán trú, kho' },
  { key: 'conduct', label: 'Nề nếp, thi đua' },
  { key: 'security', label: 'Nhật ký, bảo mật' },
] as const;

export type SettingGroupKey = (typeof SETTING_GROUPS)[number]['key'];

// Cách xếp mục cấu hình theo đơn vị (khóa ở apps/api/src/settings/setting-definitions.ts) vào nhóm, theo khóa:
// - Thông tin chung: giờ bắt đầu học, sĩ số tối đa của lớp (thông tin vận hành chung của đơn vị);
// - Học phí, dịch vụ: ngày chốt học phí, ngày đến hạn, ngày chốt đăng ký dịch vụ, mốc nhắc nợ, chặn đăng ký khi nợ quá hạn và hai
//   mục ngân hàng (chặn chi khi thiếu số dư, số ngày lệch khi đối soát sao kê) vì cùng thuộc thu chi;
// - Nhân sự, chấm công: cảnh báo hợp đồng lao động, giờ vào làm, giờ tan làm, nghỉ trưa, hệ số làm thêm giờ và giờ nhắc giáo viên
//   ghi nhật ký (việc của cán bộ, giáo viên);
// - Y tế, bán trú, kho: đơn vị không có nhân viên y tế, chặn xuất quá tồn kho;
// - Nhật ký, bảo mật: ghi nhật ký truy cập dữ liệu.
// Khóa mới chưa có ở đây thì xếp theo từ khóa trong tên mục (unitSettingGroup), không khớp từ nào thì vào Thông tin chung
const GROUP_BY_KEY: Record<string, SettingGroupKey> = {
  school_start_time: 'general',
  max_class_size: 'general',
  tuition_closing_day: 'fees',
  payment_due_day: 'fees',
  service_registration_closing_day: 'fees',
  debt_reminder_days: 'fees',
  block_service_registration_when_overdue: 'fees',
  bank_balance_check: 'fees',
  bank_match_days: 'fees',
  contract_expiry_warning_days: 'staff',
  work_start_time: 'staff',
  work_end_time: 'staff',
  lunch_break_minutes: 'staff',
  overtime_rate_percent: 'staff',
  journal_reminder_time: 'staff',
  no_medical_staff: 'health',
  block_stock_overdraw: 'health',
  data_access_logging: 'security',
};

// Từ khóa trong tên mục cho khóa chưa xếp ở trên, xét theo thứ tự
const GROUP_BY_LABEL: Array<[RegExp, SettingGroupKey]> = [
  [/học phí|thanh toán|dịch vụ|nhắc nợ|ngân hàng|sao kê/i, 'fees'],
  [/nhân sự|hợp đồng lao động|chấm công|làm thêm|nghỉ trưa/i, 'staff'],
  [/y tế|bán trú|suất ăn|kho/i, 'health'],
  [/nề nếp|thi đua/i, 'conduct'],
  [/truy cập|bảo mật|mật khẩu/i, 'security'],
];

export function unitSettingGroup(setting: Pick<EffectiveSetting, 'key' | 'label'>): SettingGroupKey {
  return GROUP_BY_KEY[setting.key] ?? GROUP_BY_LABEL.find(([pattern]) => pattern.test(setting.label))?.[1] ?? 'general';
}

export function groupElementId(key: SettingGroupKey): string {
  return `settings-group-${key}`;
}
