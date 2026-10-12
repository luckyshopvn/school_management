import { validationError, type FieldError } from '@school-management/server';
import { readOptionalText, readRequiredText, type RequestBody } from '../common/request-fields.js';

// Đọc dữ liệu vào của phân hệ tuyển sinh (P16; YCTD-86); dùng chung cho điểm cuối công khai và điểm cuối của nhân viên
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^0\d{9}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

export function readDate(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | undefined {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập ngày' });
    }
    return undefined;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push({ field, message: 'Ngày dạng YYYY-MM-DD' });
    return undefined;
  }
  return value;
}

// Chữ bắt buộc hoặc không bắt buộc, có giới hạn độ dài; không bắt buộc và trống trả null
export function readText(
  body: RequestBody,
  field: string,
  errors: FieldError[],
  maximum: number,
  required = false,
): string | null {
  const value = required ? readRequiredText(body, field, errors) : (readOptionalText(body, field, errors) ?? null);
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value || null;
}

export function readPhone(body: RequestBody, field: string, errors: FieldError[]): string {
  const value = readRequiredText(body, field, errors);
  if (value && !PHONE_PATTERN.test(value)) {
    errors.push({ field, message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' });
  }
  return value;
}

export function readEmail(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = readText(body, field, errors, 200);
  if (value && !EMAIL_PATTERN.test(value)) {
    errors.push({ field, message: 'Thư điện tử không hợp lệ' });
  }
  return value;
}

export function readNationalId(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !NATIONAL_ID_PATTERN.test(value.trim())) {
    errors.push({ field, message: 'Số định danh cá nhân gồm mười hai chữ số' });
    return null;
  }
  return value.trim();
}

// Có hoặc không có dị ứng; trống trả null khi không bắt buộc
export function readAllergyFlag(body: RequestBody, field: string, errors: FieldError[], required: boolean) {
  const value = body?.[field];
  if (value === undefined || value === null) {
    if (required) {
      errors.push({ field, message: 'Cần khai báo trẻ có dị ứng hay không' });
    }
    return null;
  }
  if (typeof value !== 'boolean') {
    errors.push({ field, message: 'Chọn có hoặc không có dị ứng' });
    return null;
  }
  return value;
}

export interface ApplicationInput {
  campaign_id: string;
  child_full_name: string;
  child_dob: string;
  child_gender: 'male' | 'female';
  child_national_id: string | null;
  child_has_allergies: boolean | null;
  child_allergies: string | null;
  guardian_full_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  guardian_relationship_item_id: string | null;
  address: string | null;
  note: string | null;
}

// Hồ sơ tuyển sinh: thông tin trẻ và phụ huynh (P16-02). Trực tuyến bắt buộc khai báo dị ứng để đủ điều kiện BR-06
export function readApplication(body: RequestBody, options: { requireAllergyFlag: boolean }): ApplicationInput {
  const errors: FieldError[] = [];
  const campaignId = body?.campaign_id;
  if (typeof campaignId !== 'string' || !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    errors.push({ field: 'campaign_id', message: 'Bắt buộc chọn đợt tuyển sinh' });
  }
  const childFullName = readText(body, 'child_full_name', errors, 100, true) ?? '';
  const childDob = readDate(body, 'child_dob', errors, true) ?? '';
  if (childDob && childDob > VIETNAM_DATE.format(new Date())) {
    errors.push({ field: 'child_dob', message: 'Ngày sinh không lớn hơn ngày hiện tại' });
  }
  const gender = body?.child_gender;
  if (gender !== 'male' && gender !== 'female') {
    errors.push({ field: 'child_gender', message: 'Giới tính là male hoặc female' });
  }
  const hasAllergies = readAllergyFlag(body, 'child_has_allergies', errors, options.requireAllergyFlag);
  const allergies = readText(body, 'child_allergies', errors, 500);
  if (hasAllergies === true && !allergies) {
    errors.push({ field: 'child_allergies', message: 'Cần ghi dị ứng gì' });
  }
  const relationship = body?.guardian_relationship_item_id;
  if (
    relationship !== undefined &&
    relationship !== null &&
    relationship !== '' &&
    (typeof relationship !== 'string' || !/^[0-9a-f-]{36}$/i.test(relationship))
  ) {
    errors.push({ field: 'guardian_relationship_item_id', message: 'Quan hệ không hợp lệ' });
  }
  const input: ApplicationInput = {
    campaign_id: typeof campaignId === 'string' ? campaignId : '',
    child_full_name: childFullName,
    child_dob: childDob,
    child_gender: gender === 'female' ? 'female' : 'male',
    child_national_id: readNationalId(body, 'child_national_id', errors),
    child_has_allergies: hasAllergies,
    child_allergies: hasAllergies === false ? null : allergies,
    guardian_full_name: readText(body, 'guardian_full_name', errors, 100, true) ?? '',
    guardian_phone: readPhone(body, 'guardian_phone', errors),
    guardian_email: readEmail(body, 'guardian_email', errors),
    guardian_relationship_item_id: typeof relationship === 'string' && relationship !== '' ? relationship : null,
    address: readText(body, 'address', errors, 300),
    note: readText(body, 'note', errors, 1000),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}
