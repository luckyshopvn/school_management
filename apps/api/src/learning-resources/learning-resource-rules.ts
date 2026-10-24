import { validationError, type FieldError } from '@school-management/server';
import { ENABLED_RESOURCE_VISIBILITIES, type ResourceVisibility } from '@school-management/shared';
import { isUuid, readOptionalText, type RequestBody } from '../common/request-fields.js';

// Quy tắc thuần của kho học liệu số (DT-22 phần 22h1, YCTD-183): đọc metadata, kiểm định dạng tệp, liên kết ngoài, phân
// luồng duyệt theo rủi ro, điều kiện gửi duyệt theo giấy phép. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const LEARNING_RESOURCE_RULE_CODE = 'YCTD-183';
const LEVELS = ['MN', 'TH', 'THCS', 'THPT'];

export interface LearningResourceInput {
  title: string;
  description: string | null;
  type_id: string;
  school_level: string | null;
  grade_level_code: string | null;
  subject_code: string | null;
  topic_id: string | null;
  week_no: number | null;
  keywords: string[];
  author_name: string | null;
  language: string;
  duration_minutes: number | null;
  license_id: string | null;
  license_source: string | null;
  origin: string | null;
  responsible_name: string | null;
  license_expires_on: string | null;
  visibility: ResourceVisibility;
}

function limit(value: string | null | undefined, field: string, maximum: number, errors: FieldError[]) {
  if (value && value.length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
  }
  return value ?? null;
}

function optionalUuid(body: RequestBody, field: string, errors: FieldError[]): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    errors.push({ field, message: 'Mã không hợp lệ' });
    return null;
  }
  return value;
}

function optionalInteger(body: RequestBody, field: string, min: number, max: number, errors: FieldError[]) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, message: `Số nguyên từ ${min} đến ${max}` });
    return null;
  }
  return value;
}

export function parseLearningResource(body: RequestBody): LearningResourceInput {
  const errors: FieldError[] = [];
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title === '' || title.length > 300) {
    errors.push({ field: 'title', message: 'Tiêu đề từ 1 đến 300 ký tự' });
  }
  if (!isUuid(body?.type_id)) {
    errors.push({ field: 'type_id', message: 'Bắt buộc chọn loại học liệu' });
  }
  const level =
    body?.school_level === undefined || body.school_level === null || body.school_level === ''
      ? null
      : body.school_level;
  if (level !== null && !LEVELS.includes(level as string)) {
    errors.push({ field: 'school_level', message: 'Cấp học là MN, TH, THCS hoặc THPT' });
  }
  const visibility = (body?.visibility ?? 'private') as ResourceVisibility;
  if (!ENABLED_RESOURCE_VISIBILITIES.includes(visibility)) {
    errors.push({
      field: 'visibility',
      message:
        visibility === 'network'
          ? 'Chia sẻ liên trường chưa bật, chờ phần nhiều trường (DT-SaaS)'
          : 'Phạm vi xem là private, unit hoặc school',
    });
  }
  const rawKeywords = body?.keywords ?? [];
  const keywords = Array.isArray(rawKeywords)
    ? [
        ...new Set(
          rawKeywords.filter((value): value is string => typeof value === 'string').map((value) => value.trim()),
        ),
      ]
        .filter((value) => value !== '')
        .slice(0, 30)
    : [];
  if (!Array.isArray(rawKeywords) || keywords.some((value) => value.length > 50)) {
    errors.push({ field: 'keywords', message: 'Từ khoá là danh sách, mỗi từ khoá tối đa 50 ký tự' });
  }
  const expires = body?.license_expires_on;
  if (
    expires !== undefined &&
    expires !== null &&
    expires !== '' &&
    (typeof expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expires))
  ) {
    errors.push({ field: 'license_expires_on', message: 'Ngày dạng YYYY-MM-DD' });
  }
  const language = typeof body?.language === 'string' && body.language.trim() !== '' ? body.language.trim() : 'vi';
  const input: LearningResourceInput = {
    title,
    description: limit(readOptionalText(body, 'description', errors), 'description', 2000, errors),
    type_id: body?.type_id as string,
    school_level: level as string | null,
    grade_level_code: limit(readOptionalText(body, 'grade_level_code', errors), 'grade_level_code', 20, errors),
    subject_code: limit(readOptionalText(body, 'subject_code', errors), 'subject_code', 50, errors),
    topic_id: optionalUuid(body, 'topic_id', errors),
    week_no: optionalInteger(body, 'week_no', 1, 60, errors),
    keywords,
    author_name: limit(readOptionalText(body, 'author_name', errors), 'author_name', 200, errors),
    language: language.slice(0, 20),
    duration_minutes: optionalInteger(body, 'duration_minutes', 1, 10000, errors),
    license_id: optionalUuid(body, 'license_id', errors),
    license_source: limit(readOptionalText(body, 'license_source', errors), 'license_source', 500, errors),
    origin: limit(readOptionalText(body, 'origin', errors), 'origin', 500, errors),
    responsible_name: limit(readOptionalText(body, 'responsible_name', errors), 'responsible_name', 200, errors),
    license_expires_on: (expires || null) as string | null,
    visibility,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

// Liên kết ngoài chỉ nhận địa chỉ http, https; chỉ lưu địa chỉ và tiêu đề, không tải về, không nhúng
export function parseExternalLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000) {
    throw validationError([{ field: 'url', message: 'Địa chỉ liên kết tối đa 2000 ký tự' }]);
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw validationError([{ field: 'url', message: 'Địa chỉ liên kết không hợp lệ' }]);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw validationError([{ field: 'url', message: 'Liên kết phải bắt đầu bằng http:// hoặc https://' }]);
  }
  return url.toString();
}

const startsWith = (body: Buffer, bytes: number[], offset = 0) =>
  body.length >= offset + bytes.length && bytes.every((byte, index) => body[offset + index] === byte);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const OFFICE: Record<string, { signature: number[]; contentType: string }> = {
  docx: { signature: ZIP, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { signature: ZIP, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pptx: { signature: ZIP, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  doc: { signature: OLE, contentType: 'application/msword' },
  xls: { signature: OLE, contentType: 'application/vnd.ms-excel' },
  ppt: { signature: OLE, contentType: 'application/vnd.ms-powerpoint' },
};

// Định dạng nhận: PDF, ảnh JPEG, PNG, GIF, Word, Excel, PowerPoint, video MP4; nhận theo chữ ký đầu tệp, không theo tên
export function detectResourceFileType(fileName: string, body: Buffer): string | undefined {
  if (startsWith(body, [0x25, 0x50, 0x44, 0x46])) {
    return 'application/pdf';
  }
  if (startsWith(body, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(body, [0x89, 0x50, 0x4e, 0x47])) {
    return 'image/png';
  }
  if (startsWith(body, [0x47, 0x49, 0x46, 0x38])) {
    return 'image/gif';
  }
  if (startsWith(body, [0x66, 0x74, 0x79, 0x70], 4)) {
    return 'video/mp4';
  }
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  const office = OFFICE[extension];
  return office && startsWith(body, office.signature) ? office.contentType : undefined;
}

// Tên tệp chuẩn hoá: bỏ đường dẫn, ký tự điều khiển, ký tự cấm của hệ điều hành; tối đa 200 ký tự
export function normalizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'hoc-lieu').slice(0, 200);
}

export interface ReviewRouteInput {
  typeCode: string;
  typeRequiresSchool: boolean;
  versionKind: 'file' | 'link' | 'lesson_plan';
  licenseRequiresGrant: boolean;
}

// Phân luồng theo rủi ro: liên kết ngoài, video, tài liệu có xin phép hoặc loại do trường chọn thêm bước Ban Giám hiệu
export function needsSchoolReview(input: ReviewRouteInput): boolean {
  return (
    input.typeRequiresSchool || input.typeCode === 'video' || input.versionKind === 'link' || input.licenseRequiresGrant
  );
}

// Điều kiện gửi duyệt: có phiên bản, phạm vi không phải cá nhân, có giấy phép đang dùng, giấy phép không bị chặn, không phải
// loại chỉ xem cá nhân, giấy phép có xin phép thì ghi nơi cấp phép; trả danh sách lý do không gửi được
export function submitProblems(input: {
  hasVersion: boolean;
  visibility: ResourceVisibility;
  license: { blocked: boolean; private_only: boolean; requires_grant_source: boolean; status: string } | null;
  licenseSource: string | null;
}): string[] {
  const problems: string[] = [];
  if (!input.hasVersion) {
    problems.push('Chưa có tệp, liên kết hoặc kế hoạch bài dạy');
  }
  if (input.visibility === 'private') {
    problems.push('Học liệu cá nhân không cần duyệt; đổi phạm vi xem sang tổ hoặc toàn trường để gửi duyệt');
  }
  if (!input.license || input.license.status !== 'active') {
    problems.push('Chưa chọn giấy phép');
  } else {
    if (input.license.blocked) {
      problems.push('Giấy phép bị trường chặn, không công bố được');
    }
    if (input.license.private_only) {
      problems.push('Học liệu không rõ giấy phép chỉ xem cá nhân');
    }
    if (input.license.requires_grant_source && !input.licenseSource) {
      problems.push('Tài liệu có xin phép phải ghi nơi cấp phép');
    }
  }
  return problems;
}
