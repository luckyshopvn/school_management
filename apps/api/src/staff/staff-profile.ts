import type { FieldError } from '@school-management/server';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';
import { MOET_STAFF_COLUMNS, type MoetValueKind } from '../imports/moet-columns.js';

// Hồ sơ cán bộ, giáo viên theo thứ tự ô nhập của Sở (DT-15 phần 15d, YCTD-112). Ô của Sở không có cột riêng trong hồ sơ
// lưu ở `staff.moet_profile` theo đúng khóa của tệp CSDL ngành (YCTD-100) nên nhập lại tệp ngành vẫn đọc được; ô có cột
// riêng (họ tên, ngày sinh, giới tính, số định danh, điện thoại, email, chỗ ở) ghi vào cột riêng
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_NUMBER_PATTERN = /^\d{12}$/;
const SECRET_PATTERN = /^[0-9A-Za-z]{4,20}$/;
const MAXIMUM_TEXT = 500;

// Khóa sửa được: mọi cột không phải cột riêng của tệp ngành, kể cả quận/huyện cũ ở cột không tên
export const EDITABLE_PROFILE_KINDS: ReadonlyMap<string, MoetValueKind> = new Map([
  ...MOET_STAFF_COLUMNS.filter((column) => !column.core).map((column) => [column.key, column.kind] as const),
  ...MOET_STAFF_COLUMNS.filter((column) => column.blankAfter).map(
    (column) => [column.blankAfter ?? '', 'text' as MoetValueKind] as const,
  ),
]);

export interface StaffProfileChanges {
  moetStaffCode?: string | null;
  fullName?: string;
  dob?: string | null;
  gender?: 'male' | 'female' | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  idNumber?: string | null;
  code?: string;
  departmentId?: string | null;
  jobTitleId?: string | null;
  startDate?: string;
  // Giá trị null là xóa ô; ô bí mật (số sổ bảo hiểm xã hội) chỉ nhận số mới
  profile: Record<string, string | boolean | null>;
}

function readDateValue(value: unknown, field: string, errors: FieldError[]): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

function readLimited(body: RequestBody, field: string, errors: FieldError[], maximum: number) {
  const value = readOptionalText(body, field, errors);
  if (typeof value === 'string' && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return undefined;
  }
  return value;
}

// Đọc thân yêu cầu ghi hồ sơ: chỉ các ô có trong thân được đổi
export function readStaffProfileChanges(body: RequestBody, errors: FieldError[]): StaffProfileChanges {
  const changes: StaffProfileChanges = { profile: {} };
  const has = (field: string) => body !== undefined && field in body;
  if (has('moet_staff_code')) {
    changes.moetStaffCode = readLimited(body, 'moet_staff_code', errors, 50) ?? null;
  }
  if (has('full_name')) {
    const fullName = readLimited(body, 'full_name', errors, 200);
    if (!fullName) {
      errors.push({ field: 'full_name', message: 'Bắt buộc nhập' });
    } else {
      changes.fullName = fullName;
    }
  }
  if (has('code')) {
    const code = readLimited(body, 'code', errors, 50);
    if (!code) {
      errors.push({ field: 'code', message: 'Bắt buộc nhập' });
    } else {
      changes.code = code;
    }
  }
  if (has('dob')) {
    changes.dob = readDateValue(body?.dob, 'dob', errors);
  }
  if (has('start_date')) {
    const startDate = readDateValue(body?.start_date, 'start_date', errors);
    if (startDate === null) {
      errors.push({ field: 'start_date', message: 'Bắt buộc nhập' });
    } else if (startDate) {
      changes.startDate = startDate;
    }
  }
  if (has('gender')) {
    const gender = body?.gender;
    if (gender !== null && gender !== '' && gender !== 'male' && gender !== 'female') {
      errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
    } else {
      changes.gender = gender === 'male' || gender === 'female' ? gender : null;
    }
  }
  for (const [field, key] of [
    ['phone', 'phone'],
    ['email', 'email'],
    ['address', 'address'],
  ] as const) {
    if (has(field)) {
      changes[key] = readLimited(body, field, errors, MAXIMUM_TEXT) ?? null;
    }
  }
  if (has('id_number')) {
    const idNumber = readOptionalText(body, 'id_number', errors) ?? null;
    if (idNumber && !ID_NUMBER_PATTERN.test(idNumber)) {
      errors.push({ field: 'id_number', message: 'Số định danh cá nhân gồm mười hai chữ số' });
    } else {
      changes.idNumber = idNumber;
    }
  }
  for (const field of ['department_id', 'job_title_id'] as const) {
    if (has(field)) {
      const value = body?.[field];
      if (value !== null && value !== '' && !isUuid(value)) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      } else {
        changes[field === 'department_id' ? 'departmentId' : 'jobTitleId'] = (value as string) || null;
      }
    }
  }
  const profile = body?.moet_profile;
  if (profile !== undefined) {
    if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
      errors.push({ field: 'moet_profile', message: 'Thông tin theo Sở không hợp lệ' });
      return changes;
    }
    for (const [key, raw] of Object.entries(profile as Record<string, unknown>)) {
      const field = `moet_profile.${key}`;
      const kind = EDITABLE_PROFILE_KINDS.get(key);
      if (!kind) {
        errors.push({ field, message: 'Ô không có trong hồ sơ của Sở' });
        continue;
      }
      if (raw === null || raw === '' || raw === false) {
        changes.profile[key] = null;
      } else if (kind === 'flag') {
        if (raw !== true) {
          errors.push({ field, message: 'Chọn có hoặc không' });
        } else {
          changes.profile[key] = true;
        }
      } else if (kind === 'date') {
        const value = readDateValue(raw, field, errors);
        if (value) {
          changes.profile[key] = value;
        }
      } else if (typeof raw !== 'string' || raw.trim().length > MAXIMUM_TEXT) {
        errors.push({ field, message: `Phải là chữ, tối đa ${MAXIMUM_TEXT} ký tự` });
      } else if (kind === 'secret' && !SECRET_PATTERN.test(raw.replace(/\s/g, ''))) {
        errors.push({ field, message: 'Từ 4 đến 20 chữ hoặc số' });
      } else {
        changes.profile[key] = raw.trim();
      }
    }
  }
  return changes;
}

// Giá trị gốc của các ô theo Sở để biểu mẫu sửa; ô bí mật chỉ trả số đã che
export function profileFieldsOf(profile: unknown): Record<string, string | boolean> {
  const data = profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : {};
  const fields: Record<string, string | boolean> = {};
  for (const [key, kind] of EDITABLE_PROFILE_KINDS) {
    if (kind === 'secret') {
      const lastFour = data[`${key}_last4`];
      if (typeof lastFour === 'string' && lastFour) {
        fields[key] = `********${lastFour}`;
      }
      continue;
    }
    const value = data[key];
    if (value === true) {
      fields[key] = true;
    } else if (typeof value === 'string' && value !== '') {
      fields[key] = value;
    }
  }
  return fields;
}

// Gộp thay đổi vào `moet_profile`; ô bí mật mã hóa kèm bốn số cuối như khi nhập tệp ngành
export function mergeProfile(
  profile: unknown,
  changes: Record<string, string | boolean | null>,
  encrypt: (plainText: string) => string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = profile && typeof profile === 'object' ? { ...(profile as object) } : {};
  for (const [key, value] of Object.entries(changes)) {
    if (EDITABLE_PROFILE_KINDS.get(key) === 'secret') {
      delete merged[`${key}_encrypted`];
      delete merged[`${key}_last4`];
      if (typeof value === 'string') {
        const plain = value.replace(/\s/g, '');
        merged[`${key}_encrypted`] = encrypt(plain);
        merged[`${key}_last4`] = plain.slice(-4);
      }
    } else if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
