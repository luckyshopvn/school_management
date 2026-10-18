// Thống kê theo tiêu chí ngành (DT-14 phần 14a, YCTD-102; mục 5.1, 5.2, 5.3, 5.8, 5.9 của hệ thống Sở). Hàm thuần, không đọc
// cơ sở dữ liệu. Dữ liệu chưa có cột riêng trong hồ sơ lấy từ `moet_profile` của tệp CSDL ngành (YCTD-100)

export type AgeGroupKey =
  | 'under_3_months'
  | 'months_3_12'
  | 'months_13_24'
  | 'months_25_36'
  | 'years_3_4'
  | 'years_4_5'
  | 'years_5_6'
  | 'over_6';

export const AGE_GROUPS: Array<{ key: AgeGroupKey; label: string; stage: 'nursery' | 'kindergarten' | 'other' }> = [
  { key: 'under_3_months', label: 'Dưới 3 tháng', stage: 'other' },
  { key: 'months_3_12', label: 'Nhà trẻ 3–12 tháng', stage: 'nursery' },
  { key: 'months_13_24', label: 'Nhà trẻ 13–24 tháng', stage: 'nursery' },
  { key: 'months_25_36', label: 'Nhà trẻ 25–36 tháng', stage: 'nursery' },
  { key: 'years_3_4', label: 'Mẫu giáo 3–4 tuổi', stage: 'kindergarten' },
  { key: 'years_4_5', label: 'Mẫu giáo 4–5 tuổi', stage: 'kindergarten' },
  { key: 'years_5_6', label: 'Mẫu giáo 5–6 tuổi', stage: 'kindergarten' },
  { key: 'over_6', label: 'Trên 6 tuổi', stage: 'other' },
];

// Nhóm tuổi của trẻ theo số tháng tuổi tròn tại ngày xét: 3–12, 13–24, 25–36 tháng; 37–48 tháng là 3–4 tuổi, 49–60 là 4–5
// tuổi, 61–72 là 5–6 tuổi
export function childAgeGroup(months: number): AgeGroupKey {
  if (months < 3) {
    return 'under_3_months';
  }
  if (months <= 12) {
    return 'months_3_12';
  }
  if (months <= 24) {
    return 'months_13_24';
  }
  if (months <= 36) {
    return 'months_25_36';
  }
  if (months <= 48) {
    return 'years_3_4';
  }
  if (months <= 60) {
    return 'years_4_5';
  }
  return months <= 72 ? 'years_5_6' : 'over_6';
}

// Nhóm tuổi của lớp theo tháng tuổi bắt đầu của bậc học (danh mục bậc học của trường): dưới 12 tháng là nhóm 3–12 tháng,
// dưới 24 là 13–24, dưới 36 là 25–36, dưới 48 là mẫu giáo 3–4 tuổi, dưới 60 là 4–5 tuổi, còn lại 5–6 tuổi
export function classAgeGroup(ageFromMonths: number): AgeGroupKey {
  if (ageFromMonths < 12) {
    return 'months_3_12';
  }
  if (ageFromMonths < 24) {
    return 'months_13_24';
  }
  if (ageFromMonths < 36) {
    return 'months_25_36';
  }
  if (ageFromMonths < 48) {
    return 'years_3_4';
  }
  return ageFromMonths < 60 ? 'years_4_5' : 'years_5_6';
}

export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part * 10000) / whole) / 100 : 0);

export interface Breakdown {
  value: string;
  count: number;
  female: number;
  percent: number;
}

export const NOT_ENTERED = 'Chưa nhập';

// Đếm theo giá trị (giá trị trống gom vào "Chưa nhập"), kèm số nữ và tỷ lệ trên tổng; sắp theo số lượng giảm dần
export function breakdown<T extends { gender: string | null }>(
  rows: T[],
  valueOf: (row: T) => string | null | undefined,
): Breakdown[] {
  const counts = new Map<string, { count: number; female: number }>();
  for (const row of rows) {
    const raw = valueOf(row);
    const value = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : NOT_ENTERED;
    const entry = counts.get(value) ?? { count: 0, female: 0 };
    entry.count += 1;
    entry.female += row.gender === 'female' ? 1 : 0;
    counts.set(value, entry);
  }
  return [...counts.entries()]
    .map(([value, entry]) => ({ value, ...entry, percent: percentOf(entry.count, rows.length) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'vi'));
}

export function profileText(profile: Record<string, unknown> | null, key: string): string | null {
  const value = profile?.[key];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value === true ? 'Có' : String(value);
}

const blank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

// Hồ sơ trẻ để xét thiếu trường thông tin (5.8)
export interface ChildProfileFacts {
  full_name: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  national_id_last4: string | null;
  moet_profile: Record<string, unknown> | null;
  guardians: Array<{
    full_name: string | null;
    phone: string | null;
    occupation: string | null;
    birth_year: number | null;
    id_number_last4: string | null;
  }>;
}

export interface MissingFieldRule<T> {
  key: string;
  label: string;
  isMissing(record: T): boolean;
}

const moet = (record: { moet_profile: Record<string, unknown> | null }, key: string) =>
  blank(record.moet_profile?.[key]);
const noGuardianWith = (record: ChildProfileFacts, field: keyof ChildProfileFacts['guardians'][number]) =>
  !record.guardians.some((guardian) => !blank(guardian[field]));

// Trường thông tin của hồ sơ học sinh theo mục 5.8 của hệ thống Sở; thông tin cha mẹ xét trên mọi người giám hộ đã gắn với
// trẻ (thiếu khi không người nào có)
export const CHILD_FIELD_RULES: MissingFieldRule<ChildProfileFacts>[] = [
  { key: 'full_name', label: 'Họ tên', isMissing: (record) => blank(record.full_name) },
  { key: 'dob', label: 'Ngày sinh', isMissing: (record) => blank(record.dob) },
  { key: 'gender', label: 'Giới tính', isMissing: (record) => blank(record.gender) },
  { key: 'ethnicity', label: 'Dân tộc', isMissing: (record) => moet(record, 'ethnicity') },
  { key: 'religion', label: 'Tôn giáo', isMissing: (record) => moet(record, 'religion') },
  { key: 'national_id', label: 'Số định danh cá nhân', isMissing: (record) => blank(record.national_id_last4) },
  {
    key: 'permanent_address',
    label: 'Địa chỉ thường trú',
    isMissing: (record) => moet(record, 'permanent_province') || moet(record, 'permanent_ward'),
  },
  {
    key: 'hometown',
    label: 'Quê quán',
    isMissing: (record) => moet(record, 'hometown_province') || moet(record, 'hometown_ward'),
  },
  {
    key: 'birth_registration',
    label: 'Nơi khai sinh',
    isMissing: (record) => moet(record, 'birth_registration_province'),
  },
  {
    key: 'current_address',
    label: 'Chỗ ở hiện nay',
    isMissing: (record) => blank(record.address) && moet(record, 'current_province'),
  },
  {
    key: 'phone',
    label: 'Số điện thoại liên hệ',
    isMissing: (record) => moet(record, 'contact_phone') && noGuardianWith(record, 'phone'),
  },
  {
    key: 'guardian_name',
    label: 'Họ tên cha, mẹ, người giám hộ',
    isMissing: (record) => noGuardianWith(record, 'full_name'),
  },
  {
    key: 'guardian_occupation',
    label: 'Nghề nghiệp cha, mẹ',
    isMissing: (record) => noGuardianWith(record, 'occupation'),
  },
  {
    key: 'guardian_birth_year',
    label: 'Năm sinh cha, mẹ',
    isMissing: (record) => noGuardianWith(record, 'birth_year'),
  },
  {
    key: 'guardian_id_number',
    label: 'Số CCCD của cha, mẹ',
    isMissing: (record) => noGuardianWith(record, 'id_number_last4'),
  },
];

// Hồ sơ nhân sự để xét thiếu trường thông tin (5.9)
export interface StaffProfileFacts {
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  id_number_last4: string | null;
  has_active_contract: boolean;
  moet_profile: Record<string, unknown> | null;
  bank_account_number: string | null;
  tax_code: string | null;
}

// Trường thông tin của hồ sơ nhân sự theo mục 5.9 của hệ thống Sở; tài khoản ngân hàng, mã số thuế thêm ở DT-16 phần 16f
export const STAFF_FIELD_RULES: MissingFieldRule<StaffProfileFacts>[] = [
  { key: 'dob', label: 'Ngày sinh', isMissing: (record) => blank(record.dob) },
  { key: 'gender', label: 'Giới tính', isMissing: (record) => blank(record.gender) },
  { key: 'ethnicity', label: 'Dân tộc', isMissing: (record) => moet(record, 'ethnicity') },
  { key: 'religion', label: 'Tôn giáo', isMissing: (record) => moet(record, 'religion') },
  { key: 'hometown', label: 'Quê quán', isMissing: (record) => moet(record, 'hometown_province') },
  {
    key: 'permanent_address',
    label: 'Địa chỉ thường trú',
    isMissing: (record) => blank(record.address) && moet(record, 'permanent_province'),
  },
  { key: 'id_number', label: 'Số CCCD', isMissing: (record) => blank(record.id_number_last4) },
  { key: 'email', label: 'Email', isMissing: (record) => blank(record.email) },
  { key: 'phone', label: 'Điện thoại di động', isMissing: (record) => blank(record.phone) },
  {
    key: 'social_insurance',
    label: 'Số sổ BHXH',
    isMissing: (record) => moet(record, 'social_insurance_number_last4'),
  },
  { key: 'position_group', label: 'Nhóm chức vụ', isMissing: (record) => moet(record, 'position_group') },
  {
    key: 'contract',
    label: 'Hình thức hợp đồng',
    isMissing: (record) => !record.has_active_contract && moet(record, 'contract_form'),
  },
  { key: 'recruitment_date', label: 'Ngày tuyển dụng', isMissing: (record) => moet(record, 'recruitment_date') },
  {
    key: 'qualification',
    label: 'Trình độ chuyên môn',
    isMissing: (record) => moet(record, 'professional_qualification'),
  },
  { key: 'major', label: 'Chuyên ngành chính', isMissing: (record) => moet(record, 'main_major') },
  { key: 'bank_account', label: 'Tài khoản ngân hàng', isMissing: (record) => blank(record.bank_account_number) },
  { key: 'tax_code', label: 'Mã số thuế', isMissing: (record) => blank(record.tax_code) },
];

export function countMissing<T>(rules: MissingFieldRule<T>[], records: T[]) {
  return rules.map((rule) => ({
    key: rule.key,
    label: rule.label,
    missing_count: records.filter((record) => rule.isMissing(record)).length,
  }));
}
