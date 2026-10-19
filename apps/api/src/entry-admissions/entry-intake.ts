import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  ADMISSION_DECISION_LABELS,
  ADMISSION_DOCUMENT_LABELS,
  ADMISSION_DOCUMENTS,
  ADMISSION_PROGRAM_LABELS,
  ADMISSION_PROGRAM_TYPES,
  ADMISSION_RECORD_TYPE_LABELS,
  ADVANCED_REVIEW_LABELS,
  ADVANCED_REVIEW_STATUSES,
  FINAL_YEAR_FILE_KIND_LABELS,
  FINAL_YEAR_FILE_KINDS,
  FINAL_YEAR_LEVELS,
  FINAL_YEAR_RESIDENCE_LABELS,
  FINAL_YEAR_RESIDENCE_TYPES,
  PERMISSION_CODES,
  type AdmissionDecision,
  type AdmissionDocument,
  type AdmissionProgramType,
  type AdmissionRecordType,
  type AdvancedReviewStatus,
  type FinalYearFileKind,
  type FinalYearResidenceType,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { APPLICATION_CODE_PREFIX, APPLICATION_DOCUMENT_TYPE } from '../admissions/admission-applications.js';
import { readText } from '../admissions/admission-fields.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildStudentWorkbook } from '../children/student-workbook.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { CONTENT_TYPES } from '../exports/table-file.js';
import { fileStamp, type ExportedFile } from '../facilities/facilities-workbook.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import {
  buildErrorWorkbook,
  buildTemplate,
  parseDate,
  readSheet,
  type ImportColumn,
  type RowError,
} from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildFinalYearPdf, buildZip, type FinalYearSheet } from './final-year-pdf.js';

// Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d, YCTD-135; khảo sát mục 10.2.4): 1.3 Danh sách học sinh đăng ký trường tiên tiến,
// 1.4 Tiếp nhận hồ sơ tuyển sinh và phần dùng chung của 1.5 đến 1.7, 5.11. Hồ sơ là hồ sơ tuyển sinh của phân hệ Tuyển sinh
// (YCTD-86): hồ sơ trực tuyến hoặc do nhân viên nhập đã đạt, và hồ sơ "phân tuyến" nhập từ Excel (bản chạy nội bộ thay kết nối
// phân tuyến của Sở). Hồ sơ phân tuyến của đợt đại trà, khảo sát ghi là đạt ngay vì đã được phân tuyến về trường; của đợt tiên
// tiến chờ trường xác nhận ở 1.3 (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11). Số định danh trên lưới che bốn số
// cuối; tệp Excel, phiếu in đủ số khi người tải có quyền xem số định danh, mọi lần tải ghi nhật ký xuất (BR-74)
export const ENTRY_INTAKE_RULE = 'YCTD-135';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const INTAKE_VIEW = [
  PERMISSION_CODES.entryIntakeView,
  PERMISSION_CODES.entryIntakeManage,
  PERMISSION_CODES.entryIntakeTransfer,
];
const MANAGE = PERMISSION_CODES.entryIntakeManage;
const PHONE_PATTERN = /^0\d{9,10}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export interface IntakeFile {
  id: string;
  kind: FinalYearFileKind;
  file_name: string;
  content_type: string;
  uploaded_by_name: string;
  created_at: Date;
}

export interface IntakeRow {
  id: string;
  code: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  program_type: AdmissionProgramType;
  target_academic_year_id: string | null;
  org_unit_id: string;
  org_unit_name: string;
  org_unit_type: string;
  source: 'online' | 'staff' | 'routing';
  status: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  place_of_birth: string | null;
  national_id: string;
  has_national_id: boolean;
  residence_type: FinalYearResidenceType | null;
  current_residence: string | null;
  address: string | null;
  residential_group: string | null;
  quarter: string | null;
  ward: string | null;
  province: string | null;
  guardian_full_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  guardian_relationship_item_id: string | null;
  relationship_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  final_year_ward: string | null;
  final_year_school: string | null;
  routed: boolean;
  submitted_documents: AdmissionDocument[];
  admission_decision: AdmissionDecision;
  admission_decision_at: Date | null;
  advanced_criteria: string | null;
  advanced_achievements: string | null;
  registered_at: string | null;
  school_review: AdvancedReviewStatus;
  school_reviewed_by_name: string | null;
  ward_review: AdvancedReviewStatus;
  child_has_allergies: boolean | null;
  notice_content: string | null;
  last_notice_at: Date | null;
  record_type: AdmissionRecordType;
  has_parent_account: boolean;
  target_org_unit_id: string | null;
  target_org_unit_name: string | null;
  planned_class_id: string | null;
  planned_class_name: string | null;
  planned_class_unit_id: string | null;
  created_child_id: string | null;
  student_code: string | null;
  child_status: string | null;
  transfer_package_code: string | null;
  transfer_guid: string | null;
  transferred_at: Date | null;
  transferred_by_name: string | null;
  last_transfer_note: string | null;
  last_transfer_succeeded: boolean | null;
  cancelled_at: Date | null;
  cancelled_by_name: string | null;
  files: IntakeFile[];
  // Chỉ dùng trong máy chủ để lọc số định danh đủ 12 chữ số; bỏ trước khi trả về
  national_id_hash?: string | null;
}

export type YesNo = 'yes' | 'no';
export interface IntakeFilter {
  campaign_id: string | null;
  final_year_school: string | null;
  residence_type: FinalYearResidenceType | null;
  ward: string | null;
  quarter: string | null;
  province: string | null;
  national_id: string | null;
  q: string | null;
  dob: string | null;
  father_name: string | null;
  mother_name: string | null;
  decision: 'accepted' | 'not_accepted' | null;
  doc_admission_notice: YesNo | null;
  doc_declaration: YesNo | null;
  doc_birth_certificate_copy: YesNo | null;
  program_type: AdmissionProgramType | null;
  routed: YesNo | null;
  has_phone: YesNo | null;
  notice_sent: YesNo | null;
  school_review: AdvancedReviewStatus | null;
  ward_review: AdvancedReviewStatus | null;
  transferred: YesNo | null;
  record_type: AdmissionRecordType | null;
  package_code: string | null;
  guid: string | null;
  student_code: string | null;
}

const FILTER_TEXT_KEYS = [
  'final_year_school',
  'ward',
  'quarter',
  'province',
  'national_id',
  'q',
  'father_name',
  'mother_name',
  'package_code',
  'guid',
  'student_code',
] as const;
const YES_NO_KEYS = [
  'doc_admission_notice',
  'doc_declaration',
  'doc_birth_certificate_copy',
  'routed',
  'has_phone',
  'notice_sent',
  'transferred',
] as const;

function optionOf<Value extends string>(
  query: Record<string, unknown>,
  field: string,
  values: readonly Value[],
  errors: FieldError[],
): Value | null {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !values.includes(value as Value)) {
    errors.push({ field, message: `Giá trị là ${values.join(', ')}` });
    return null;
  }
  return value as Value;
}

export function readIntakeFilter(query: Record<string, unknown>, errors: FieldError[]): IntakeFilter {
  const text = (field: string) => {
    const value = query[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }
    if (value.length > 200) {
      errors.push({ field, message: 'Tối đa 200 ký tự' });
      return null;
    }
    return value.trim();
  };
  const campaignId = text('campaign_id');
  if (campaignId && !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    errors.push({ field: 'campaign_id', message: 'Mã đợt tuyển sinh không hợp lệ' });
  }
  const dob = text('dob');
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    errors.push({ field: 'dob', message: 'Ngày dạng YYYY-MM-DD' });
  }
  const reviews = ADVANCED_REVIEW_STATUSES.map((item) => item.value);
  const filter = {
    campaign_id: campaignId,
    dob,
    residence_type: optionOf(
      query,
      'residence_type',
      FINAL_YEAR_RESIDENCE_TYPES.map((item) => item.value),
      errors,
    ),
    decision: optionOf(query, 'decision', ['accepted', 'not_accepted'] as const, errors),
    program_type: optionOf(
      query,
      'program_type',
      ADMISSION_PROGRAM_TYPES.map((item) => item.value),
      errors,
    ),
    school_review: optionOf(query, 'school_review', reviews, errors),
    ward_review: optionOf(query, 'ward_review', reviews, errors),
    record_type: optionOf(query, 'record_type', ['account', 'free'] as const, errors),
  } as Partial<IntakeFilter>;
  for (const key of FILTER_TEXT_KEYS) {
    filter[key] = text(key);
  }
  for (const key of YES_NO_KEYS) {
    filter[key] = optionOf(query, key, ['yes', 'no'] as const, errors);
  }
  return filter as IntakeFilter;
}

const normalize = (text: string) =>
  text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .trim();
const contains = (value: string | null, part: string | null) => !part || normalize(value ?? '').includes(normalize(part));
const yesNo = (expected: YesNo | null, actual: boolean) => expected === null || (expected === 'yes') === actual;

// Hồ sơ của 1.4: hồ sơ phân tuyến và hồ sơ đã đạt (kể cả đã chuyển, đã hủy nhập học) của tuyển sinh trực tuyến
export function isIntakeRow(row: Pick<IntakeRow, 'source' | 'status'>): boolean {
  return row.source === 'routing' || ['passed', 'converted', 'cancelled'].includes(row.status);
}

// Hồ sơ chuyển được sang hồ sơ học sinh (1.6, 5.11): đạt, phụ huynh chưa từ chối; đợt tiên tiến cần trường xác nhận trúng
// tuyển ở 1.3
export function isTransferable(
  row: Pick<IntakeRow, 'status' | 'admission_decision' | 'program_type' | 'school_review'>,
): boolean {
  return (
    row.status === 'passed' &&
    row.admission_decision !== 'declined' &&
    (row.program_type !== 'advanced' || row.school_review === 'admitted')
  );
}

export function applyIntakeFilter(rows: IntakeRow[], filter: IntakeFilter, hashOf: (text: string) => string) {
  const nationalId = filter.national_id?.replace(/\s/g, '') ?? null;
  const nationalHash = nationalId && NATIONAL_ID_PATTERN.test(nationalId) ? hashOf(nationalId) : null;
  return rows.filter(
    (row) =>
      (!filter.campaign_id || row.campaign_id === filter.campaign_id) &&
      contains(row.final_year_school, filter.final_year_school) &&
      (!filter.residence_type || row.residence_type === filter.residence_type) &&
      contains(row.ward, filter.ward) &&
      contains(row.quarter, filter.quarter) &&
      contains(row.province, filter.province) &&
      (!nationalId ||
        (nationalHash ? row.national_id_hash === nationalHash : row.national_id.replace(/\D/g, '').endsWith(nationalId))) &&
      (contains(row.full_name, filter.q) || (filter.q !== null && row.code === filter.q)) &&
      (!filter.dob || row.dob === filter.dob) &&
      contains(row.father_name, filter.father_name) &&
      contains(row.mother_name, filter.mother_name) &&
      (!filter.decision || (filter.decision === 'accepted') === (row.admission_decision === 'accepted')) &&
      yesNo(filter.doc_admission_notice, row.submitted_documents.includes('admission_notice')) &&
      yesNo(filter.doc_declaration, row.submitted_documents.includes('declaration')) &&
      yesNo(filter.doc_birth_certificate_copy, row.submitted_documents.includes('birth_certificate_copy')) &&
      (!filter.program_type || row.program_type === filter.program_type) &&
      yesNo(filter.routed, row.routed) &&
      yesNo(filter.has_phone, row.guardian_phone !== '') &&
      yesNo(filter.notice_sent, row.last_notice_at !== null) &&
      (!filter.school_review || row.school_review === filter.school_review) &&
      (!filter.ward_review || row.ward_review === filter.ward_review) &&
      yesNo(filter.transferred, row.transfer_guid !== null && row.status === 'converted') &&
      (!filter.record_type || row.record_type === filter.record_type) &&
      contains(row.transfer_package_code, filter.package_code) &&
      contains(row.transfer_guid, filter.guid) &&
      (contains(row.student_code, filter.student_code) || (filter.student_code !== null && row.code === filter.student_code)),
  );
}

export const EMPTY_FILTER: IntakeFilter = readIntakeFilter({}, []);

export interface IntakeInput {
  residence_type?: FinalYearResidenceType | null;
  current_residence?: string | null;
  address?: string | null;
  residential_group?: string | null;
  quarter?: string | null;
  ward?: string | null;
  province?: string | null;
  place_of_birth?: string | null;
  guardian_full_name?: string;
  guardian_phone?: string;
  guardian_email?: string | null;
  guardian_relationship_item_id?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  final_year_ward?: string | null;
  final_year_school?: string | null;
  advanced_criteria?: string | null;
  advanced_achievements?: string | null;
  registered_at?: string | null;
  ward_review?: AdvancedReviewStatus;
  child_has_allergies?: boolean | null;
  national_id?: string;
}

const INPUT_TEXTS: Array<[keyof IntakeInput, number]> = [
  ['current_residence', 300],
  ['address', 300],
  ['residential_group', 100],
  ['quarter', 100],
  ['ward', 100],
  ['province', 100],
  ['place_of_birth', 200],
  ['father_name', 100],
  ['mother_name', 100],
  ['final_year_ward', 100],
  ['final_year_school', 200],
  ['advanced_criteria', 1000],
  ['advanced_achievements', 2000],
];

// Ô sửa được ở "Cập nhật" của 1.3, 1.4; ô không gửi lên giữ nguyên
export function readIntakeInput(body: Record<string, unknown>, errors: FieldError[]): IntakeInput {
  const input: IntakeInput = {};
  for (const [field, maximum] of INPUT_TEXTS) {
    if (field in body) {
      (input as Record<string, unknown>)[field] = readText(body, field, errors, maximum);
    }
  }
  if ('residence_type' in body) {
    input.residence_type = optionOf(
      body,
      'residence_type',
      FINAL_YEAR_RESIDENCE_TYPES.map((item) => item.value),
      errors,
    );
  }
  if ('guardian_full_name' in body) {
    input.guardian_full_name = readText(body, 'guardian_full_name', errors, 100, true) ?? '';
  }
  if ('guardian_phone' in body) {
    const phone = readText(body, 'guardian_phone', errors, 20, true) ?? '';
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.push({ field: 'guardian_phone', message: 'Số điện thoại gồm 10 hoặc 11 chữ số, bắt đầu bằng 0' });
    }
    input.guardian_phone = phone;
  }
  if ('guardian_email' in body) {
    const email = readText(body, 'guardian_email', errors, 200);
    if (email && !EMAIL_PATTERN.test(email)) {
      errors.push({ field: 'guardian_email', message: 'Thư điện tử không hợp lệ' });
    }
    input.guardian_email = email;
  }
  if ('guardian_relationship_item_id' in body) {
    const value = body.guardian_relationship_item_id;
    if (value !== null && value !== '' && (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value))) {
      errors.push({ field: 'guardian_relationship_item_id', message: 'Quan hệ không hợp lệ' });
    }
    input.guardian_relationship_item_id = typeof value === 'string' && value !== '' ? value : null;
  }
  if ('registered_at' in body) {
    const value = body.registered_at;
    if (value !== null && value !== '' && (typeof value !== 'string' || parseDate(value) === null)) {
      errors.push({ field: 'registered_at', message: 'Ngày dạng YYYY-MM-DD' });
    }
    input.registered_at = typeof value === 'string' && value !== '' ? parseDate(value) : null;
  }
  if ('ward_review' in body) {
    input.ward_review =
      optionOf(
        body,
        'ward_review',
        ADVANCED_REVIEW_STATUSES.map((item) => item.value),
        errors,
      ) ?? 'pending';
  }
  if ('child_has_allergies' in body) {
    const value = body.child_has_allergies;
    if (value !== null && typeof value !== 'boolean') {
      errors.push({ field: 'child_has_allergies', message: 'Giá trị là true, false hoặc null' });
    }
    input.child_has_allergies = typeof value === 'boolean' ? value : null;
  }
  if ('national_id' in body && body.national_id !== null && body.national_id !== '') {
    const value = typeof body.national_id === 'string' ? body.national_id.trim() : '';
    if (!NATIONAL_ID_PATTERN.test(value)) {
      errors.push({ field: 'national_id', message: 'Số định danh cá nhân gồm 12 chữ số' });
    }
    input.national_id = value;
  }
  return input;
}

const dateText = (value: Date | string | null) =>
  value === null
    ? ''
    : (value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)).split('-').reverse().join('/');
const documentText = (row: IntakeRow) =>
  row.submitted_documents.map((item) => ADMISSION_DOCUMENT_LABELS[item]).join('; ');
const filesText = (row: IntakeRow, kind: FinalYearFileKind) =>
  row.files
    .filter((file) => file.kind === kind)
    .map((file) => file.file_name)
    .join('; ');

// Cột tệp Excel theo màn hình; cột ID để đối chiếu khi cần
export type IntakeScreen = 'intake' | 'advanced' | 'notices' | 'transfer' | 'transferred';
interface ExportColumn {
  key: string;
  label: string;
  value: (row: IntakeRow) => unknown;
}
const COMMON_COLUMNS: ExportColumn[] = [
  { key: 'code', label: 'Mã hồ sơ', value: (row) => row.code },
  { key: 'full_name', label: 'Họ và tên', value: (row) => row.full_name },
  { key: 'dob', label: 'Ngày sinh', value: (row) => dateText(row.dob) },
  { key: 'gender', label: 'Giới tính', value: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
  { key: 'national_id', label: 'Số ĐDCN', value: (row) => row.national_id },
];
const ADDRESS_COLUMNS: ExportColumn[] = [
  { key: 'residential_group', label: 'Tổ', value: (row) => row.residential_group },
  { key: 'quarter', label: 'Khu phố', value: (row) => row.quarter },
  { key: 'ward', label: 'Phường/Xã', value: (row) => row.ward },
  { key: 'province', label: 'Thành phố (Tỉnh)', value: (row) => row.province },
];
const RESIDENCE: ExportColumn = {
  key: 'current_residence',
  label: 'Nơi ở hiện tại (VNEID)',
  value: (row) =>
    [row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : null, row.current_residence]
      .filter(Boolean)
      .join(': '),
};
export const EXPORT_COLUMNS: Record<IntakeScreen, ExportColumn[]> = {
  intake: [
    ...COMMON_COLUMNS,
    RESIDENCE,
    { key: 'contact', label: 'Thông tin liên hệ', value: (row) => `${row.guardian_full_name} ${row.guardian_phone}` },
    { key: 'campaign', label: 'Đợt tuyển sinh', value: (row) => row.campaign_name },
    { key: 'final_year_ward', label: 'Phường/Xã cuối cấp', value: (row) => row.final_year_ward },
    { key: 'final_year_school', label: 'Trường cuối cấp', value: (row) => row.final_year_school },
    ...ADDRESS_COLUMNS,
    { key: 'documents', label: 'Giấy tờ đã nộp', value: documentText },
    { key: 'decision', label: 'Phụ huynh đồng ý nhập học', value: (row) => ADMISSION_DECISION_LABELS[row.admission_decision] },
  ],
  advanced: [
    ...COMMON_COLUMNS,
    { key: 'place_of_birth', label: 'Nơi sinh', value: (row) => row.place_of_birth },
    { key: 'final_year_school', label: 'Thông tin cuối cấp', value: (row) => row.final_year_school },
    RESIDENCE,
    { key: 'father_name', label: 'Họ tên cha', value: (row) => row.father_name },
    { key: 'mother_name', label: 'Họ tên mẹ', value: (row) => row.mother_name },
    { key: 'phone', label: 'Số điện thoại', value: (row) => row.guardian_phone },
    { key: 'program', label: 'Loại trường', value: (row) => ADMISSION_PROGRAM_LABELS[row.program_type] },
    { key: 'school', label: 'Tên trường', value: (row) => row.org_unit_name },
    { key: 'criteria', label: 'Tiêu chí', value: (row) => row.advanced_criteria },
    { key: 'achievements', label: 'Kết quả học tập và thành tích', value: (row) => row.advanced_achievements },
    { key: 'registered_at', label: 'Ngày đăng ký', value: (row) => dateText(row.registered_at) },
    { key: 'evidence', label: 'Hình ảnh minh chứng', value: (row) => filesText(row, 'evidence') },
    { key: 'school_review', label: 'Trạng thái trường', value: (row) => ADVANCED_REVIEW_LABELS[row.school_review] },
    { key: 'ward_review', label: 'Trạng thái xã/phường', value: (row) => ADVANCED_REVIEW_LABELS[row.ward_review] },
    { key: 'decision', label: 'Đồng ý nhập học', value: (row) => ADMISSION_DECISION_LABELS[row.admission_decision] },
    { key: 'class', label: 'Lớp', value: (row) => row.planned_class_name },
    ...ADDRESS_COLUMNS,
  ],
  notices: [
    ...COMMON_COLUMNS,
    { key: 'phone', label: 'Số điện thoại', value: (row) => row.guardian_phone },
    { key: 'notice_content', label: 'Nội dung gửi', value: (row) => row.notice_content },
    { key: 'final_year_school', label: 'Cuối Cấp', value: (row) => row.final_year_school },
  ],
  transfer: [
    { key: 'code', label: 'Mã học sinh', value: (row) => row.student_code ?? row.code },
    ...COMMON_COLUMNS.slice(1),
    { key: 'transferred', label: 'Chuyển hồ sơ sang CSDL', value: (row) => (row.status === 'converted' ? 'Đã chuyển' : 'Chưa chuyển') },
    { key: 'record_type', label: 'Loại hồ sơ', value: (row) => ADMISSION_RECORD_TYPE_LABELS[row.record_type] },
    { key: 'unit', label: 'Điểm trường', value: (row) => row.target_org_unit_name ?? row.org_unit_name },
    { key: 'class', label: 'Xếp lớp', value: (row) => row.planned_class_name },
    RESIDENCE,
    ...ADDRESS_COLUMNS,
    { key: 'package', label: 'Mã gói tin', value: (row) => row.transfer_package_code },
  ],
  transferred: [
    { key: 'code', label: 'Mã học sinh', value: (row) => row.student_code ?? row.code },
    ...COMMON_COLUMNS.slice(1),
    { key: 'final_year_school', label: 'Lớp cuối cấp', value: (row) => row.final_year_school },
    { key: 'record_type', label: 'Tự do', value: (row) => (row.record_type === 'free' ? 'x' : '') },
    { key: 'phone', label: 'Điện thoại liên hệ', value: (row) => row.guardian_phone },
    { key: 'class', label: 'Xếp lớp', value: (row) => row.planned_class_name },
    { key: 'guid', label: 'Mã GUID', value: (row) => row.transfer_guid },
    { key: 'package', label: 'Mã gói tin', value: (row) => row.transfer_package_code },
    { key: 'status', label: 'Trạng thái', value: (row) => (row.status === 'cancelled' ? 'Đã hủy nhập học' : 'Đã chuyển') },
  ],
};

// Mẫu nhập danh sách phân tuyến (1.4 "Nhập từ Excel"): cột có dấu * là bắt buộc
const ROUTING_COLUMNS: Array<ImportColumn & { field: string }> = [
  { key: 'full_name', field: 'full_name', header: 'Họ và tên (*)', note: 'Họ và tên của học sinh' },
  { key: 'dob', field: 'dob', header: 'Ngày sinh (*)', note: 'DD/MM/YYYY hoặc YYYY-MM-DD' },
  { key: 'gender', field: 'gender', header: 'Giới tính (*)', note: 'Nam hoặc Nữ' },
  { key: 'place_of_birth', field: 'place_of_birth', header: 'Nơi sinh', note: '' },
  { key: 'national_id', field: 'national_id', header: 'Số ĐDCN', note: '12 chữ số' },
  { key: 'residence_type', field: 'residence_type', header: 'Diện cư trú', note: 'Thường trú, Tạm trú hoặc Khác' },
  { key: 'current_residence', field: 'current_residence', header: 'Nơi ở hiện tại (VNEID)', note: '' },
  { key: 'residential_group', field: 'residential_group', header: 'Tổ', note: '' },
  { key: 'quarter', field: 'quarter', header: 'Khu phố', note: '' },
  { key: 'ward', field: 'ward', header: 'Phường/Xã', note: '' },
  { key: 'province', field: 'province', header: 'Thành phố (Tỉnh)', note: '' },
  { key: 'father_name', field: 'father_name', header: 'Họ tên cha', note: '' },
  { key: 'mother_name', field: 'mother_name', header: 'Họ tên mẹ', note: '' },
  { key: 'guardian_full_name', field: 'guardian_full_name', header: 'Người liên hệ (*)', note: 'Cha, mẹ hoặc người giám hộ' },
  { key: 'guardian_phone', field: 'guardian_phone', header: 'Số điện thoại (*)', note: '10 hoặc 11 chữ số, bắt đầu bằng 0' },
  { key: 'guardian_email', field: 'guardian_email', header: 'Thư điện tử', note: '' },
  { key: 'relationship', field: 'relationship', header: 'Quan hệ với học sinh', note: 'Tên trong danh mục quan hệ' },
  { key: 'final_year_ward', field: 'final_year_ward', header: 'Phường/Xã cuối cấp', note: '' },
  { key: 'final_year_school', field: 'final_year_school', header: 'Trường cuối cấp', note: '' },
  { key: 'advanced_criteria', field: 'advanced_criteria', header: 'Tiêu chí', note: 'Đợt tiên tiến' },
  {
    key: 'advanced_achievements',
    field: 'advanced_achievements',
    header: 'Kết quả học tập và thành tích',
    note: 'Đợt tiên tiến',
  },
  { key: 'registered_at', field: 'registered_at', header: 'Ngày đăng ký', note: 'DD/MM/YYYY' },
];

function detectContentType(body: Buffer): string | undefined {
  return IMAGE_SIGNATURES.find((signature) => signature.bytes.every((byte, index) => body[index] === byte))
    ?.contentType;
}

export interface ActionResult {
  done: number;
  skipped: Array<{ id: string; full_name: string; reason: string }>;
}

@Injectable()
export class EntryIntakeService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async database(): Promise<Kysely<SchoolYearDatabase>> {
    return (await this.currentSchoolYear.require()).database;
  }

  hash(text: string): string {
    return this.protection.hash(text);
  }

  // Đơn vị trong phạm vi của các quyền; null là toàn trường
  async scopeUnits(currentUser: CurrentUser, permissions: string[]): Promise<string[] | null> {
    const units = new Set<string>();
    let granted = false;
    for (const permission of permissions) {
      if (!currentUser.hasPermission(permission)) {
        continue;
      }
      granted = true;
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return null;
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    if (!granted || units.size === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với hồ sơ tuyển sinh đầu cấp');
    }
    return [...units];
  }

  async assertUnit(currentUser: CurrentUser, permission: string | string[], orgUnitId: string): Promise<void> {
    const units = await this.scopeUnits(currentUser, Array.isArray(permission) ? permission : [permission]);
    if (units && !units.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ nằm ngoài phạm vi đơn vị của bạn');
    }
  }

  async canSeeNationalIds(currentUser: CurrentUser, unitIds: string[]): Promise<boolean> {
    if (!currentUser.hasPermission(PERMISSION_CODES.nationalIdView)) {
      return false;
    }
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.nationalIdView);
    return scope.wholeSchool || (unitIds.length > 0 && unitIds.every((id) => scope.orgUnitIds.includes(id)));
  }

  // Đợt tuyển sinh kèm loại hình, năm học nhận trẻ (ô "Đợt tuyển sinh" của 1.4 đến 1.7)
  async campaigns(currentUser: CurrentUser) {
    const units = await this.scopeUnits(currentUser, INTAKE_VIEW);
    const database = await this.database();
    let query = database
      .selectFrom('admission_campaigns')
      .select([
        'id',
        'name',
        'status',
        'org_unit_id',
        'program_type',
        'target_academic_year_id',
        'open_from',
        'open_to',
      ])
      .orderBy('open_from', 'desc');
    if (units) {
      query = query.where('org_unit_id', 'in', units);
    }
    return { items: await query.execute() };
  }

  async updateCampaign(
    currentUser: CurrentUser,
    campaignId: string,
    input: { program_type: AdmissionProgramType; target_academic_year_id: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const campaign = await database
      .selectFrom('admission_campaigns')
      .select(['id', 'org_unit_id', 'program_type', 'target_academic_year_id'])
      .where('id', '=', campaignId)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt tuyển sinh', 'admission_campaign');
    }
    await this.assertUnit(currentUser, MANAGE, campaign.org_unit_id);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_campaigns')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', campaignId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'admission_campaigns',
        entityId: campaignId,
        action: 'update',
        before: { program_type: campaign.program_type, target_academic_year_id: campaign.target_academic_year_id },
        after: input,
      });
    });
    return { updated: true };
  }

  async loadRows(
    database: Executor,
    options: { unitIds: string[] | null; ids?: string[]; campaignId?: string | null; fullNationalId?: boolean },
  ): Promise<IntakeRow[]> {
    let query = database
      .selectFrom('admission_applications as a')
      .innerJoin('admission_campaigns as c', 'c.id', 'a.campaign_id')
      .innerJoin('org_units as u', 'u.id', 'a.org_unit_id')
      .leftJoin('org_units as t', 't.id', 'a.target_org_unit_id')
      .leftJoin('classes as k', 'k.id', 'a.planned_class_id')
      .leftJoin('children as ch', 'ch.id', 'a.created_child_id')
      .leftJoin('catalog_items as rel', 'rel.id', 'a.guardian_relationship_item_id')
      .selectAll('a')
      .select([
        'c.name as campaign_name',
        'c.status as campaign_status',
        'c.program_type',
        'c.target_academic_year_id',
        'u.name as org_unit_name',
        'u.unit_type as org_unit_type',
        't.name as target_org_unit_name',
        'k.name as planned_class_name',
        'k.org_unit_id as planned_class_unit_id',
        'ch.moet_student_code',
        'ch.status as child_status',
        'rel.name as relationship_name',
      ])
      .orderBy('a.child_full_name')
      .orderBy('a.code');
    if (options.unitIds) {
      query = query.where('a.org_unit_id', 'in', options.unitIds);
    }
    if (options.ids) {
      if (options.ids.length === 0) {
        return [];
      }
      query = query.where('a.id', 'in', options.ids);
    }
    if (options.campaignId) {
      query = query.where('a.campaign_id', '=', options.campaignId);
    }
    const rows = await query.execute();
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const files = await database
      .selectFrom('admission_application_files')
      .innerJoin('files', 'files.id', 'admission_application_files.file_id')
      .select([
        'admission_application_files.application_id',
        'admission_application_files.kind',
        'admission_application_files.uploaded_by_name',
        'admission_application_files.created_at',
        'files.id',
        'files.file_name',
        'files.content_type',
      ])
      .where('admission_application_files.application_id', 'in', ids)
      .orderBy('admission_application_files.created_at')
      .execute();
    const notices = await database
      .selectFrom('entry_admission_notice_recipients')
      .select(['application_id', (expression) => expression.fn.max('created_at').as('last_at')])
      .where('application_id', 'in', ids)
      .where('delivered', '=', true)
      .groupBy('application_id')
      .execute();
    const results = await database
      .selectFrom('admission_transfer_results')
      .select(['application_id', 'succeeded', 'note', 'created_at'])
      .where('application_id', 'in', ids)
      .where('kind', '=', 'transfer')
      .orderBy('created_at', 'desc')
      .execute();
    const phones = [...new Set(rows.map((row) => row.guardian_phone).filter((phone) => phone !== ''))];
    const accounts = new Set(
      phones.length === 0
        ? []
        : (
            await database
              .selectFrom('guardians')
              .select('phone')
              .where('phone', 'in', phones)
              .where('user_id', 'is not', null)
              .execute()
          ).map((row) => row.phone),
    );
    return rows.map((row) => {
      const latest = results.find((result) => result.application_id === row.id);
      const lastNotice = notices.find((notice) => notice.application_id === row.id)?.last_at ?? null;
      return {
        id: row.id,
        code: row.code,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        campaign_status: row.campaign_status,
        program_type: row.program_type,
        target_academic_year_id: row.target_academic_year_id,
        org_unit_id: row.org_unit_id,
        org_unit_name: row.org_unit_name,
        org_unit_type: row.org_unit_type,
        source: row.source,
        status: row.status,
        full_name: row.child_full_name,
        dob: String(row.child_dob).slice(0, 10),
        gender: row.child_gender,
        place_of_birth: row.place_of_birth,
        national_id:
          options.fullNationalId && row.child_national_id_encrypted
            ? this.protection.decrypt(row.child_national_id_encrypted)
            : row.child_national_id_last4
              ? maskNationalId(row.child_national_id_last4)
              : '',
        has_national_id: row.child_national_id_hash !== null,
        national_id_hash: row.child_national_id_hash,
        residence_type: row.residence_type,
        current_residence: row.current_residence,
        address: row.address,
        residential_group: row.residential_group,
        quarter: row.quarter,
        ward: row.ward,
        province: row.province,
        guardian_full_name: row.guardian_full_name,
        guardian_phone: row.guardian_phone,
        guardian_email: row.guardian_email,
        guardian_relationship_item_id: row.guardian_relationship_item_id,
        relationship_name: row.relationship_name,
        father_name: row.father_name,
        mother_name: row.mother_name,
        final_year_ward: row.final_year_ward,
        final_year_school: row.final_year_school,
        routed: row.routed,
        submitted_documents: row.submitted_documents as AdmissionDocument[],
        admission_decision: row.admission_decision,
        admission_decision_at: row.admission_decision_at,
        advanced_criteria: row.advanced_criteria,
        advanced_achievements: row.advanced_achievements,
        registered_at: row.registered_at ? String(row.registered_at).slice(0, 10) : null,
        school_review: row.school_review,
        school_reviewed_by_name: row.school_reviewed_by_name,
        ward_review: row.ward_review,
        child_has_allergies: row.child_has_allergies,
        notice_content: row.notice_content,
        last_notice_at: lastNotice ? new Date(lastNotice) : null,
        record_type: row.record_type,
        has_parent_account: accounts.has(row.guardian_phone),
        target_org_unit_id: row.target_org_unit_id,
        target_org_unit_name: row.target_org_unit_name,
        planned_class_id: row.planned_class_id,
        planned_class_name: row.planned_class_name,
        planned_class_unit_id: row.planned_class_unit_id,
        created_child_id: row.created_child_id,
        student_code: row.moet_student_code,
        child_status: row.child_status,
        transfer_package_code: row.transfer_package_code,
        transfer_guid: row.transfer_guid,
        transferred_at: row.converted_at,
        transferred_by_name: row.transferred_by_name,
        last_transfer_note: latest?.note ?? null,
        last_transfer_succeeded: latest?.succeeded ?? null,
        cancelled_at: row.cancelled_at,
        cancelled_by_name: row.cancelled_by_name,
        files: files
          .filter((file) => file.application_id === row.id)
          .map((file) => ({
            id: file.id,
            kind: file.kind,
            file_name: file.file_name,
            content_type: file.content_type,
            uploaded_by_name: file.uploaded_by_name,
            created_at: file.created_at,
          })),
      } satisfies IntakeRow;
    });
  }

  strip(rows: IntakeRow[]): IntakeRow[] {
    return rows.map(({ national_id_hash: _hash, ...row }) => row);
  }

  // Hồ sơ của từng màn hình trong phạm vi, đã lọc
  async screenRows(
    currentUser: CurrentUser,
    screen: IntakeScreen,
    filter: IntakeFilter,
    options: { ids?: string[]; fullNationalId?: boolean; permissions?: string[] } = {},
  ): Promise<{ database: Kysely<SchoolYearDatabase>; rows: IntakeRow[]; units: string[] | null }> {
    const units = await this.scopeUnits(currentUser, options.permissions ?? INTAKE_VIEW);
    const database = await this.database();
    const all = await this.loadRows(database, {
      unitIds: units,
      ids: options.ids,
      campaignId: filter.campaign_id,
      fullNationalId: options.fullNationalId,
    });
    const rows = applyIntakeFilter(
      all.filter((row) => {
        switch (screen) {
          case 'intake':
          case 'notices':
            return isIntakeRow(row);
          case 'advanced':
            return isIntakeRow(row) && row.program_type === 'advanced';
          case 'transfer':
            return isTransferable(row) || (row.status === 'converted' && row.transfer_guid !== null);
          case 'transferred':
            return row.transfer_guid !== null && (row.status === 'converted' || row.status === 'cancelled');
        }
      }),
      filter,
      (text) => this.hash(text),
    );
    return { database, rows, units };
  }

  async list(currentUser: CurrentUser, screen: IntakeScreen, filter: IntakeFilter) {
    const { rows } = await this.screenRows(currentUser, screen, filter);
    return { items: this.strip(rows) };
  }

  async find(database: Executor, applicationId: string) {
    const application = await database
      .selectFrom('admission_applications')
      .innerJoin('admission_campaigns', 'admission_campaigns.id', 'admission_applications.campaign_id')
      .selectAll('admission_applications')
      .select(['admission_campaigns.program_type', 'admission_campaigns.status as campaign_status'])
      .where('admission_applications.id', '=', applicationId)
      .executeTakeFirst();
    if (!application) {
      throw notFoundError('Không tìm thấy hồ sơ tuyển sinh', 'admission_application');
    }
    return application;
  }

  private async assertRelationship(database: Executor, relationshipId: string | null | undefined): Promise<void> {
    if (!relationshipId) {
      return;
    }
    const found = await database
      .selectFrom('catalog_items')
      .select('id')
      .where('id', '=', relationshipId)
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!found) {
      throw validationError([{ field: 'guardian_relationship_item_id', message: 'Quan hệ không có trong danh mục' }]);
    }
  }

  // "Cập nhật" ở từng dòng của 1.3, 1.4: hồ sơ đã chuyển, đã hủy nhập học không sửa được
  async update(currentUser: CurrentUser, applicationId: string, input: IntakeInput, origin: ChangeOrigin) {
    const database = await this.database();
    const application = await this.find(database, applicationId);
    await this.assertUnit(currentUser, MANAGE, application.org_unit_id);
    if (application.status === 'converted' || application.status === 'cancelled') {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Hồ sơ đã chuyển sang hồ sơ học sinh hoặc đã hủy nhập học');
    }
    await this.assertRelationship(database, input.guardian_relationship_item_id);
    const { national_id: nationalId, ...rest } = input;
    const values: Record<string, unknown> = { ...rest };
    if (nationalId) {
      values.child_national_id_encrypted = this.protection.encrypt(nationalId);
      values.child_national_id_hash = this.protection.hash(nationalId);
      values.child_national_id_last4 = nationalId.slice(-4);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('admission_applications')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', applicationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: application.org_unit_id,
        entityName: 'admission_applications',
        entityId: applicationId,
        action: 'update',
        before: null,
        after: { ...rest, national_id: nationalId ? maskNationalId(nationalId.slice(-4)) : undefined },
      });
    });
    const [row] = await this.loadRows(database, { unitIds: null, ids: [applicationId] });
    return this.strip([row!])[0];
  }

  // "Lưu dữ liệu" của 1.4: ô tích giấy tờ đã nộp, phụ huynh đồng ý hoặc từ chối nhập học của các dòng trên lưới
  async save(
    currentUser: CurrentUser,
    items: Array<{ id: string; submitted_documents: AdmissionDocument[]; admission_decision: AdmissionDecision }>,
    origin: ChangeOrigin,
  ): Promise<ActionResult> {
    const units = await this.scopeUnits(currentUser, [MANAGE]);
    const database = await this.database();
    const rows = await this.loadRows(database, { unitIds: units, ids: items.map((item) => item.id) });
    const result: ActionResult = { done: 0, skipped: [] };
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const row = rows.find((candidate) => candidate.id === item.id);
        if (!row) {
          result.skipped.push({ id: item.id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (row.status === 'cancelled') {
          result.skipped.push({ id: row.id, full_name: row.full_name, reason: 'đã hủy nhập học' });
          continue;
        }
        const documents = ADMISSION_DOCUMENTS.map((document) => document.value).filter((value) =>
          item.submitted_documents.includes(value),
        );
        const decisionChanged = item.admission_decision !== row.admission_decision;
        if (decisionChanged && row.status === 'converted') {
          result.skipped.push({ id: row.id, full_name: row.full_name, reason: 'đã chuyển sang hồ sơ học sinh' });
          continue;
        }
        if (!decisionChanged && documents.join() === row.submitted_documents.join()) {
          continue;
        }
        await transaction
          .updateTable('admission_applications')
          .set({
            submitted_documents: documents,
            admission_decision: item.admission_decision,
            admission_decision_at: decisionChanged ? now : row.admission_decision_at,
            updated_at: now,
          })
          .where('id', '=', row.id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: row.id,
          action: 'update',
          before: { submitted_documents: row.submitted_documents, admission_decision: row.admission_decision },
          after: { submitted_documents: documents, admission_decision: item.admission_decision },
        });
        result.done += 1;
      }
    });
    return result;
  }

  // 1.3 "Xác nhận hồ sơ", "Không đồng ý", "Chưa xác nhận": trạng thái trường duyệt; trúng tuyển thì hồ sơ đạt để chuyển
  async review(
    currentUser: CurrentUser,
    ids: string[],
    review: AdvancedReviewStatus,
    origin: ChangeOrigin,
  ): Promise<ActionResult> {
    const units = await this.scopeUnits(currentUser, [MANAGE]);
    const database = await this.database();
    const rows = await this.loadRows(database, { unitIds: units, ids });
    const result: ActionResult = { done: 0, skipped: [] };
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const id of ids) {
        const row = rows.find((candidate) => candidate.id === id);
        if (!row) {
          result.skipped.push({ id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (row.program_type !== 'advanced') {
          result.skipped.push({ id, full_name: row.full_name, reason: 'không thuộc đợt tiên tiến' });
          continue;
        }
        if (row.status === 'converted' || row.status === 'cancelled' || row.status === 'rejected') {
          result.skipped.push({ id, full_name: row.full_name, reason: 'hồ sơ đã chuyển, đã hủy hoặc không đạt' });
          continue;
        }
        const status = review === 'admitted' ? 'passed' : 'received';
        await transaction
          .updateTable('admission_applications')
          .set({
            school_review: review,
            school_reviewed_by_name: review === 'pending' ? null : origin.actorName,
            school_reviewed_at: review === 'pending' ? null : now,
            status,
            reviewed_by: origin.actorUserId,
            reviewed_at: now,
            updated_at: now,
          })
          .where('id', '=', id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: id,
          action: 'update',
          before: { school_review: row.school_review, status: row.status },
          after: { school_review: review, status },
        });
        result.done += 1;
      }
    });
    return result;
  }

  // 1.3 "Xóa": chỉ hồ sơ phân tuyến nhập từ Excel chưa chuyển sang hồ sơ học sinh; hồ sơ trực tuyến xét ở phân hệ Tuyển sinh
  async remove(currentUser: CurrentUser, ids: string[], origin: ChangeOrigin): Promise<ActionResult> {
    const units = await this.scopeUnits(currentUser, [MANAGE]);
    const database = await this.database();
    const rows = await this.loadRows(database, { unitIds: units, ids });
    const result: ActionResult = { done: 0, skipped: [] };
    const storageKeys: string[] = [];
    await database.transaction().execute(async (transaction) => {
      for (const id of ids) {
        const row = rows.find((candidate) => candidate.id === id);
        if (!row) {
          result.skipped.push({ id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (row.source !== 'routing' || row.created_child_id !== null) {
          result.skipped.push({
            id,
            full_name: row.full_name,
            reason: row.created_child_id ? 'đã chuyển sang hồ sơ học sinh' : 'hồ sơ trực tuyến xóa ở phân hệ Tuyển sinh',
          });
          continue;
        }
        const files = await transaction
          .selectFrom('admission_application_files')
          .innerJoin('files', 'files.id', 'admission_application_files.file_id')
          .select(['files.id', 'files.storage_key'])
          .where('admission_application_files.application_id', '=', id)
          .execute();
        await transaction.deleteFrom('admission_applications').where('id', '=', id).execute();
        if (files.length > 0) {
          await transaction
            .deleteFrom('files')
            .where(
              'id',
              'in',
              files.map((file) => file.id),
            )
            .execute();
          storageKeys.push(...files.map((file) => file.storage_key));
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: id,
          action: 'delete',
          before: { code: row.code, full_name: row.full_name },
          after: null,
        });
        result.done += 1;
      }
    });
    for (const key of storageKeys) {
      await this.fileStorage.delete(key);
    }
    return result;
  }

  // "Hủy nhập học" của 1.4: hồ sơ chưa chuyển sang hồ sơ học sinh; hồ sơ đã chuyển hủy ở 1.7
  async cancelPending(currentUser: CurrentUser, ids: string[], origin: ChangeOrigin): Promise<ActionResult> {
    const units = await this.scopeUnits(currentUser, [MANAGE]);
    const database = await this.database();
    const rows = await this.loadRows(database, { unitIds: units, ids });
    const result: ActionResult = { done: 0, skipped: [] };
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const id of ids) {
        const row = rows.find((candidate) => candidate.id === id);
        if (!row) {
          result.skipped.push({ id, full_name: '', reason: 'không có trong phạm vi của bạn' });
          continue;
        }
        if (row.status === 'converted') {
          result.skipped.push({ id, full_name: row.full_name, reason: 'đã chuyển, hủy ở 1.7 Danh sách kết quả chuyển hồ sơ' });
          continue;
        }
        if (row.status === 'cancelled' || row.status === 'rejected') {
          result.skipped.push({ id, full_name: row.full_name, reason: 'đã hủy nhập học hoặc không đạt' });
          continue;
        }
        await transaction
          .updateTable('admission_applications')
          .set({ status: 'cancelled', cancelled_at: now, cancelled_by_name: origin.actorName, updated_at: now })
          .where('id', '=', id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'admission_applications',
          entityId: id,
          action: 'update',
          before: { status: row.status },
          after: { status: 'cancelled' },
        });
        result.done += 1;
      }
    });
    return result;
  }

  async importTemplate(): Promise<Buffer> {
    return buildTemplate('Danh sách phân tuyến', ROUTING_COLUMNS, {
      catalogs: [
        {
          key: 'residence',
          title: 'Diện cư trú',
          column: 'Diện cư trú',
          items: FINAL_YEAR_RESIDENCE_TYPES.map((item) => ({ code: item.label, name: item.label })),
        },
      ],
    });
  }

  // 1.4 "Nhập từ Excel": danh sách phân tuyến về trường (bản chạy nội bộ thay kết nối phân tuyến của Sở). Kiểm tra toàn bộ
  // tệp trước; có lỗi thì không ghi dòng nào ("Tải danh sách lỗi" trả tệp kèm cột nội dung lỗi). Trùng số định danh trong
  // đợt là lỗi
  async importRouting(
    currentUser: CurrentUser,
    campaignId: string,
    body: Buffer,
    origin: ChangeOrigin,
    errorFile: boolean,
  ): Promise<{ created: number; errors: RowError[] } | { errorWorkbook: Buffer }> {
    const database = await this.database();
    const campaign = await database
      .selectFrom('admission_campaigns')
      .select(['id', 'org_unit_id', 'status', 'program_type'])
      .where('id', '=', campaignId)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt tuyển sinh', 'admission_campaign');
    }
    await this.assertUnit(currentUser, MANAGE, campaign.org_unit_id);
    if (campaign.status === 'closed') {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Đợt tuyển sinh đã đóng, không nhận thêm hồ sơ');
    }
    const sheet = await readSheet(body, ROUTING_COLUMNS);
    const relationships = await database
      .selectFrom('catalog_items')
      .select(['id', 'name'])
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .execute();
    const existing = new Set(
      (
        await database
          .selectFrom('admission_applications')
          .select('child_national_id_hash')
          .where('campaign_id', '=', campaignId)
          .where('child_national_id_hash', 'is not', null)
          .where('status', '!=', 'cancelled')
          .execute()
      ).map((row) => row.child_national_id_hash),
    );
    const errors: RowError[] = [];
    const values: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    const header = (key: string) => ROUTING_COLUMNS.find((column) => column.key === key)?.header ?? key;
    for (const row of sheet) {
      const text = (key: string) => (row.values[key] ?? '').trim();
      const fail = (key: string, message: string) => errors.push({ row: row.row, column: header(key), message });
      const fieldErrors: FieldError[] = [];
      const raw: Record<string, unknown> = {};
      for (const column of ROUTING_COLUMNS) {
        raw[column.field] = text(column.key) || null;
      }
      const residence = text('residence_type');
      raw.residence_type = residence
        ? (FINAL_YEAR_RESIDENCE_TYPES.find((item) => normalize(item.label) === normalize(residence))?.value ?? residence)
        : null;
      const registered = text('registered_at');
      raw.registered_at = registered ? (parseDate(registered) ?? registered) : null;
      const relationshipName = text('relationship');
      const relationship = relationshipName
        ? relationships.find((item) => normalize(item.name) === normalize(relationshipName))
        : undefined;
      if (relationshipName && !relationship) {
        fail('relationship', 'Quan hệ không có trong danh mục');
      }
      delete raw.relationship;
      delete raw.full_name;
      delete raw.dob;
      delete raw.gender;
      const nationalId = text('national_id');
      delete raw.national_id;
      const input = readIntakeInput(raw, fieldErrors);
      for (const error of fieldErrors) {
        const column = ROUTING_COLUMNS.find((item) => item.field === error.field);
        fail(column?.key ?? error.field, error.message);
      }
      const fullName = text('full_name');
      if (!fullName || fullName.length > 100) {
        fail('full_name', 'Bắt buộc nhập, tối đa 100 ký tự');
      }
      const dob = parseDate(text('dob'));
      if (!dob) {
        fail('dob', 'Ngày sinh dạng DD/MM/YYYY');
      }
      const gender = normalize(text('gender')) === 'nam' ? 'male' : normalize(text('gender')) === 'nữ' ? 'female' : null;
      if (!gender) {
        fail('gender', 'Giới tính là Nam hoặc Nữ');
      }
      let nationalHash: string | null = null;
      if (nationalId) {
        if (!NATIONAL_ID_PATTERN.test(nationalId)) {
          fail('national_id', 'Số định danh cá nhân gồm 12 chữ số');
        } else {
          nationalHash = this.protection.hash(nationalId);
          if (existing.has(nationalHash) || seen.has(nationalHash)) {
            fail('national_id', 'Số định danh đã có hồ sơ trong đợt tuyển sinh');
          }
          seen.add(nationalHash);
        }
      }
      if (errors.some((error) => error.row === row.row)) {
        continue;
      }
      values.push({
        ...input,
        campaign_id: campaign.id,
        org_unit_id: campaign.org_unit_id,
        source: 'routing',
        routed: true,
        // Đợt tiên tiến chờ trường xác nhận ở 1.3; đợt đại trà, khảo sát đã phân tuyến về trường nên đạt ngay
        status: campaign.program_type === 'advanced' ? 'received' : 'passed',
        received_by: origin.actorUserId,
        received_at: this.clock.now(),
        child_full_name: fullName,
        child_dob: dob,
        child_gender: gender,
        child_national_id_encrypted: nationalId && nationalHash ? this.protection.encrypt(nationalId) : null,
        child_national_id_hash: nationalHash,
        child_national_id_last4: nationalId && nationalHash ? nationalId.slice(-4) : null,
        guardian_relationship_item_id: relationship?.id ?? null,
        created_by: origin.actorUserId,
      });
    }
    if (errorFile) {
      return { errorWorkbook: buildErrorWorkbook(body, errors, 1) };
    }
    if (errors.length > 0) {
      return { created: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      for (const value of values) {
        const code = await nextDocumentCode(transaction, APPLICATION_DOCUMENT_TYPE, APPLICATION_CODE_PREFIX);
        const created = await transaction
          .insertInto('admission_applications')
          .values({ ...value, code } as never)
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: campaign.org_unit_id,
          entityName: 'admission_applications',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { code, source: 'routing', campaign_id: campaign.id },
        });
      }
    });
    return { created: values.length, errors: [] };
  }

  async attach(
    currentUser: CurrentUser,
    applicationId: string,
    input: { kind: FinalYearFileKind; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ): Promise<IntakeFile> {
    const database = await this.database();
    const application = await this.find(database, applicationId);
    await this.assertUnit(currentUser, MANAGE, application.org_unit_id);
    if (application.status === 'converted' || application.status === 'cancelled') {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Hồ sơ đã chuyển sang hồ sơ học sinh hoặc đã hủy nhập học');
    }
    if (!FINAL_YEAR_FILE_KINDS.some((item) => item.value === input.kind)) {
      throw validationError([{ field: 'kind', message: 'Loại giấy tờ là birth_certificate, residence hoặc evidence' }]);
    }
    if (input.body.length === 0 || input.body.length > MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 10 MB' }]);
    }
    const contentType = detectContentType(input.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Chỉ nhận ảnh JPEG, PNG hoặc tệp PDF' }]);
    }
    const storageKey = `admission_document/${randomUUID()}`;
    await this.fileStorage.put(storageKey, input.body, contentType);
    return database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: application.org_unit_id,
          purpose: 'admission_document',
          file_name: input.fileName.slice(0, 200),
          content_type: contentType,
          size_bytes: input.body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'file_name', 'content_type'])
        .executeTakeFirstOrThrow();
      const link = await transaction
        .insertInto('admission_application_files')
        .values({
          application_id: applicationId,
          file_id: file.id,
          kind: input.kind,
          uploaded_by: origin.actorUserId,
          uploaded_by_name: origin.actorName,
        })
        .returning('created_at')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: application.org_unit_id,
        entityName: 'admission_application_files',
        entityId: file.id,
        action: 'create',
        before: null,
        after: { application_id: applicationId, kind: input.kind, file_name: file.file_name },
      });
      return {
        id: file.id,
        kind: input.kind,
        file_name: file.file_name,
        content_type: file.content_type,
        uploaded_by_name: origin.actorName,
        created_at: link.created_at,
      };
    });
  }

  private async findFile(database: Executor, fileId: string) {
    const file = await database
      .selectFrom('admission_application_files')
      .innerJoin('files', 'files.id', 'admission_application_files.file_id')
      .innerJoin('admission_applications', 'admission_applications.id', 'admission_application_files.application_id')
      .select([
        'files.id',
        'files.file_name',
        'files.content_type',
        'files.storage_key',
        'admission_application_files.kind',
        'admission_application_files.application_id',
        'admission_applications.org_unit_id',
        'admission_applications.status',
      ])
      .where('files.id', '=', fileId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'file');
    }
    return file;
  }

  async download(currentUser: CurrentUser, fileId: string) {
    const database = await this.database();
    const file = await this.findFile(database, fileId);
    const units = await this.scopeUnits(currentUser, INTAKE_VIEW);
    if (units && !units.includes(file.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  async removeFile(currentUser: CurrentUser, fileId: string, origin: ChangeOrigin) {
    const database = await this.database();
    const file = await this.findFile(database, fileId);
    await this.assertUnit(currentUser, MANAGE, file.org_unit_id);
    if (file.status === 'converted' || file.status === 'cancelled') {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Hồ sơ đã chuyển sang hồ sơ học sinh hoặc đã hủy nhập học');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('admission_application_files').where('file_id', '=', fileId).execute();
      await transaction.deleteFrom('files').where('id', '=', fileId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: file.org_unit_id,
        entityName: 'admission_application_files',
        entityId: fileId,
        action: 'delete',
        before: { application_id: file.application_id, kind: file.kind, file_name: file.file_name },
        after: null,
      });
    });
    await this.fileStorage.delete(file.storage_key);
    return { removed: true };
  }

  // 1.3 "Tải minh chứng": minh chứng của hồ sơ đã chọn gói trong tệp nén, mỗi hồ sơ một thư mục theo mã hồ sơ
  async evidenceZip(currentUser: CurrentUser, ids: string[], ipAddress: string | null) {
    const { database, rows } = await this.screenRows(currentUser, 'intake', EMPTY_FILTER, { ids });
    const entries: Array<{ name: string; body: Buffer }> = [];
    for (const row of rows) {
      for (const file of row.files.filter((item) => item.kind === 'evidence')) {
        const stored = await database
          .selectFrom('files')
          .select('storage_key')
          .where('id', '=', file.id)
          .executeTakeFirstOrThrow();
        entries.push({ name: `${row.code}/${file.file_name}`, body: await this.fileStorage.get(stored.storage_key) });
      }
    }
    if (entries.length === 0) {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Hồ sơ đã chọn chưa có minh chứng');
    }
    const createdAt = this.clock.now();
    const fileName = `minh-chung-${fileStamp(createdAt)}.zip`;
    const log = await this.writeExportLog(database, currentUser, {
      reportCode: 'entry_intake_evidence',
      filters: { selected: ids.length },
      units: [...new Set(rows.map((row) => row.org_unit_id))],
      rowCount: rows.length,
      fileName,
      ipAddress,
    });
    return { buffer: buildZip(entries, createdAt), fileName, contentType: 'application/zip', logId: log };
  }

  async writeExportLog(
    database: Executor,
    currentUser: CurrentUser,
    input: {
      reportCode: string;
      filters: Record<string, unknown>;
      units: string[];
      rowCount: number;
      fileName: string;
      ipAddress: string | null;
    },
  ): Promise<string> {
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: input.reportCode,
        filters_data: JSON.stringify(input.filters),
        org_unit_ids: input.units,
        row_count: input.rowCount,
        contains_personal_data: true,
        file_name: input.fileName,
        ip_address: input.ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return log.id;
  }

  // Tệp Excel theo màn hình; số định danh in đủ khi người tải có quyền xem số định danh ở mọi đơn vị của các hồ sơ
  async exportWorkbook(
    currentUser: CurrentUser,
    screen: IntakeScreen,
    filter: IntakeFilter,
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    const masked = await this.screenRows(currentUser, screen, filter);
    const units = [...new Set(masked.rows.map((row) => row.org_unit_id))];
    const rows =
      masked.rows.length > 0 && (await this.canSeeNationalIds(currentUser, units))
        ? (
            await this.screenRows(currentUser, screen, filter, {
              ids: masked.rows.map((row) => row.id),
              fullNationalId: true,
            })
          ).rows
        : masked.rows;
    const createdAt = this.clock.now();
    const columns = EXPORT_COLUMNS[screen];
    const titles: Record<IntakeScreen, [string, string]> = {
      intake: ['Tiếp nhận hồ sơ tuyển sinh', 'tiep-nhan-ho-so'],
      advanced: ['Danh sách học sinh đăng ký trường tiên tiến', 'dang-ky-truong-tien-tien'],
      notices: ['Danh sách người nhận thông báo tuyển sinh', 'nguoi-nhan-thong-bao'],
      transfer: ['Chuyển hồ sơ trúng tuyển sang CSDL', 'chuyen-ho-so'],
      transferred: ['Danh sách kết quả chuyển hồ sơ', 'ket-qua-chuyen-ho-so'],
    };
    return buildStudentWorkbook({
      database: masked.database,
      currentUser,
      reportCode: `entry_intake_${screen}`,
      title: titles[screen][0],
      fileName: `${titles[screen][1]}-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: units,
      columns: columns.map((column) => ({ key: column.key, label: column.label })),
      rows: rows.map((row) => Object.fromEntries(columns.map((column) => [column.key, column.value(row) ?? '']))),
      ipAddress,
      createdAt,
    });
  }

  // "Tải phiếu thông tin", "In phiếu đăng ký" (1.4) và "In phiếu" (1.3): mỗi hồ sơ một trang A5
  async forms(
    currentUser: CurrentUser,
    ids: string[],
    kind: 'information' | 'registration',
    ipAddress: string | null,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string; logId: string }> {
    const masked = await this.screenRows(currentUser, 'intake', EMPTY_FILTER, { ids });
    const units = [...new Set(masked.rows.map((row) => row.org_unit_id))];
    if (masked.rows.length === 0) {
      throw ruleViolationError(ENTRY_INTAKE_RULE, 'Không có hồ sơ để in');
    }
    const full = await this.canSeeNationalIds(currentUser, units);
    const rows = full
      ? (await this.screenRows(currentUser, 'intake', EMPTY_FILTER, { ids, fullNationalId: true })).rows
      : masked.rows;
    const root = await masked.database
      .selectFrom('org_units')
      .select('name')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    const sheets = rows.map((row) => this.sheetOf(row, root?.name ?? '', kind));
    const createdAt = this.clock.now();
    const fileName = `${kind === 'registration' ? 'phieu-dang-ky' : 'phieu-thong-tin'}-${fileStamp(createdAt)}.pdf`;
    const buffer = await buildFinalYearPdf(
      sheets,
      'a5',
      kind === 'registration' ? 'declaration' : 'information',
      createdAt,
    );
    const logId = await this.writeExportLog(masked.database, currentUser, {
      reportCode: `entry_intake_${kind}`,
      filters: { selected: ids.length },
      units,
      rowCount: rows.length,
      fileName,
      ipAddress,
    });
    return { buffer, fileName, contentType: CONTENT_TYPES.pdf, logId };
  }

  sheetOf(row: IntakeRow, schoolName: string, kind: 'information' | 'registration'): FinalYearSheet {
    const level = FINAL_YEAR_LEVELS.preschool.label.toUpperCase();
    return {
      file_stem: row.code,
      school_name: schoolName,
      level_label: FINAL_YEAR_LEVELS.preschool.label,
      title:
        kind === 'registration'
          ? `PHIẾU ĐĂNG KÝ NHẬP HỌC ${level}`
          : `PHIẾU THÔNG TIN HỒ SƠ TUYỂN SINH ${level}`,
      sections: [
        {
          title: 'I. Thông tin học sinh',
          rows: [
            ['Mã hồ sơ', row.code],
            ['Họ và tên', row.full_name],
            ['Ngày sinh', dateText(row.dob)],
            ['Giới tính', row.gender === 'male' ? 'Nam' : 'Nữ'],
            ['Nơi sinh', row.place_of_birth],
            ['Số định danh cá nhân', row.national_id],
          ],
        },
        {
          title: 'II. Nơi ở và liên hệ',
          rows: [
            ['Diện cư trú', row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : null],
            ['Nơi ở hiện tại (theo VNeID)', row.current_residence],
            ['Tổ, khu phố', [row.residential_group, row.quarter].filter(Boolean).join(', ') || null],
            ['Phường/Xã', row.ward],
            ['Thành phố (Tỉnh)', row.province],
            ['Họ tên cha', row.father_name],
            ['Họ tên mẹ', row.mother_name],
            ['Người liên hệ', row.guardian_full_name],
            ['Điện thoại liên hệ', row.guardian_phone],
          ],
        },
        {
          title: 'III. Tuyển sinh',
          rows: [
            ['Đợt tuyển sinh', row.campaign_name],
            ['Loại hình', ADMISSION_PROGRAM_LABELS[row.program_type]],
            ['Trường cuối cấp', row.final_year_school],
            ['Phường/Xã cuối cấp', row.final_year_ward],
            ...(row.program_type === 'advanced'
              ? ([
                  ['Tiêu chí', row.advanced_criteria],
                  ['Kết quả học tập và thành tích', row.advanced_achievements],
                ] as Array<[string, string | null]>)
              : []),
            ['Giấy tờ đã nộp', documentText(row) || null],
            [
              'Giấy tờ đính kèm',
              [...new Set(row.files.map((file) => FINAL_YEAR_FILE_KIND_LABELS[file.kind]))].join('; ') || null,
            ],
          ],
        },
      ],
      status_rows: [
        ['Phụ huynh đồng ý nhập học', ADMISSION_DECISION_LABELS[row.admission_decision]],
        ...(row.program_type === 'advanced'
          ? ([
              ['Trạng thái trường', ADVANCED_REVIEW_LABELS[row.school_review]],
              ['Trạng thái xã/phường', ADVANCED_REVIEW_LABELS[row.ward_review]],
            ] as Array<[string, string | null]>)
          : []),
      ],
    };
  }
}
