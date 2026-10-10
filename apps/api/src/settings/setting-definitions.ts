// Danh mục cấu hình theo đơn vị (P01-08, YCTD-40); giờ bắt đầu học mặc định 07:30 (YCTD-47). Ngày chốt công cố định mùng 1 tháng sau nên không có trong danh mục (YCTD-41). Chỉ mục tài liệu đã ghi mặc định mới có mặc định;
// mục khác trống cho tới khi nhà trường cấu hình. Không có mục tắt kiểm tra quỹ tiền mặt vì BR-34 bắt buộc.
export type SettingValueType =
  'closing_day' | 'day_of_month' | 'day_list' | 'boolean' | 'positive_integer' | 'time_of_day' | 'minutes';

export interface SettingDefinition {
  key: string;
  label: string;
  valueType: SettingValueType;
  defaultValue: unknown;
  rule: string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'tuition_closing_day',
    label: 'Ngày chốt học phí',
    valueType: 'closing_day',
    defaultValue: 'next_month_first',
    rule: 'BR-18',
  },
  {
    key: 'payment_due_day',
    label: 'Ngày đến hạn thanh toán',
    valueType: 'day_of_month',
    defaultValue: null,
    rule: 'BR-33',
  },
  {
    key: 'service_registration_closing_day',
    label: 'Ngày chốt đăng ký dịch vụ (trong tháng trước kỳ)',
    valueType: 'day_of_month',
    defaultValue: 25,
    rule: 'BR-26',
  },
  {
    key: 'debt_reminder_days',
    label: 'Các mốc nhắc nợ (số ngày sau ngày đến hạn)',
    valueType: 'day_list',
    defaultValue: [3, 7, 15],
    rule: 'BR-33',
  },
  {
    key: 'block_service_registration_when_overdue',
    label: 'Chặn đăng ký dịch vụ khi còn nợ quá hạn',
    valueType: 'boolean',
    defaultValue: null,
    rule: 'BR-33',
  },
  {
    key: 'data_access_logging',
    label: 'Ghi nhật ký truy cập dữ liệu',
    valueType: 'boolean',
    defaultValue: null,
    rule: 'BR-73',
  },
  {
    key: 'bank_balance_check',
    label: 'Chặn chi khi tài khoản ngân hàng không đủ số dư',
    valueType: 'boolean',
    defaultValue: true,
    rule: 'BR-34',
  },
  {
    key: 'block_stock_overdraw',
    label: 'Chặn xuất quá tồn kho',
    valueType: 'boolean',
    defaultValue: null,
    rule: 'BR-62',
  },
  {
    key: 'no_medical_staff',
    label: 'Đơn vị không có nhân viên y tế',
    valueType: 'boolean',
    defaultValue: null,
    rule: 'BR-86',
  },
  {
    key: 'school_start_time',
    label: 'Giờ bắt đầu học',
    valueType: 'time_of_day',
    defaultValue: '07:30',
    rule: 'BR-13',
  },
  {
    key: 'contract_expiry_warning_days',
    label: 'Số ngày cảnh báo trước khi hợp đồng lao động hết hạn',
    valueType: 'positive_integer',
    defaultValue: null,
    rule: 'BR-38',
  },
  // Giờ làm việc của nhân sự dùng khi chấm công (BR-39, YCTD-59): chưa có mặc định, chưa cấu hình thì chưa xếp đi muộn,
  // về sớm và chưa chốt được bảng công
  {
    key: 'work_start_time',
    label: 'Giờ vào làm của nhân sự',
    valueType: 'time_of_day',
    defaultValue: null,
    rule: 'BR-39',
  },
  {
    key: 'work_end_time',
    label: 'Giờ tan làm của nhân sự',
    valueType: 'time_of_day',
    defaultValue: null,
    rule: 'BR-39',
  },
  {
    key: 'lunch_break_minutes',
    label: 'Số phút nghỉ trưa của nhân sự',
    valueType: 'minutes',
    defaultValue: null,
    rule: 'BR-39',
  },
  {
    key: 'max_class_size',
    label: 'Sĩ số tối đa của lớp',
    valueType: 'positive_integer',
    defaultValue: null,
    rule: 'BR-04',
  },
];

export function findDefinition(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((definition) => definition.key === key);
}

// Trả thông điệp lỗi nếu giá trị không hợp lệ
export function validateSettingValue(definition: SettingDefinition, value: unknown): string | null {
  switch (definition.valueType) {
    // Ngày chốt học phí: mùng 1 tháng sau (mặc định), ngày cuối tháng, hoặc một ngày từ 1 đến 28 trong tháng (YCTD-41)
    case 'closing_day':
      return value === 'next_month_first' ||
        value === 'last' ||
        (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 28)
        ? null
        : 'Ngày chốt là "next_month_first" (mùng 1 tháng sau), "last" (cuối tháng) hoặc ngày từ 1 đến 28';
    case 'day_of_month':
      return value === 'last' || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 28)
        ? null
        : 'Ngày trong tháng từ 1 đến 28, hoặc "last" là ngày cuối tháng';
    case 'day_list':
      return Array.isArray(value) &&
        value.length > 0 &&
        value.every((day) => Number.isInteger(day) && day >= 1 && day <= 365) &&
        value.every((day, index) => index === 0 || day > (value[index - 1] as number))
        ? null
        : 'Danh sách số ngày tăng dần, mỗi số từ 1 đến 365';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Giá trị là bật hoặc tắt';
    case 'positive_integer':
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100
        ? null
        : 'Số nguyên từ 1 đến 100';
    case 'minutes':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 480
        ? null
        : 'Số phút từ 0 đến 480';
    // Giờ dạng HH:MM theo giờ Việt Nam (BR-13, YCTD-47)
    case 'time_of_day':
      return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
        ? null
        : 'Giờ dạng HH:MM, ví dụ 07:30';
  }
}
