import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  FINAL_YEAR_CHECK_LABELS,
  FINAL_YEAR_FILE_KIND_LABELS,
  FINAL_YEAR_IDENTITY_LABELS,
  FINAL_YEAR_IDENTITY_TYPES,
  FINAL_YEAR_LEVELS,
  FINAL_YEAR_REGISTRATION_SOURCES,
  FINAL_YEAR_RESIDENCE_LABELS,
  FINAL_YEAR_RESIDENCE_TYPES,
  FINAL_YEAR_REVIEW_LABELS,
  FINAL_YEAR_SOURCE_LABELS,
  FINAL_YEAR_STATUS_LABELS,
  FINAL_YEAR_STATUSES,
  PERMISSION_CODES,
  type EntryAdmissionLevel,
  type FinalYearCheckItem,
  type FinalYearFileKind,
  type FinalYearIdentityType,
  type FinalYearRegistrationSource,
  type FinalYearResidenceType,
  type FinalYearReviewStatus,
  type FinalYearStatus,
} from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildStudentWorkbook } from '../children/student-workbook.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection, maskNationalId } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { CONTENT_TYPES } from '../exports/table-file.js';
import { fileStamp, type ExportedFile } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { buildErrorWorkbook, readSheet, type ImportColumn, type RowError } from '../imports/excel.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  approvalProblem,
  assertBeforeDeadline,
  checkRecord,
  compareVietnameseNames,
  ENTRY_ADMISSION_RULE,
  nextStatus,
  type FinalYearAction,
} from './final-year-rules.js';
import {
  buildFinalYearPdf,
  buildZip,
  type FinalYearPdfFormat,
  type FinalYearPdfKind,
  type FinalYearSheet,
} from './final-year-pdf.js';

// 1.1 Hồ sơ học sinh cuối cấp, 1.2 Gửi xác nhận hoàn thành hồ sơ cuối cấp, 4.1 Thống kê hồ sơ cuối cấp và màn hình "Hồ sơ cuối
// cấp" của ứng dụng phụ huynh (DT-17 phần 17c, YCTD-134; khảo sát mục 10.2.3). Hồ sơ lấy từ trẻ đang học lớp năm cuối cấp của
// năm học đang dùng (cấp Mầm non: bậc học có tháng tuổi bắt đầu từ 60); mỗi lần đọc danh sách thêm hồ sơ cho trẻ mới vào lớp
// cuối cấp. Hồ sơ của trẻ đã thôi học hoặc chuyển khỏi lớp cuối cấp giữ lại nhưng không hiện. Số định danh trên lưới luôn che
// bốn số cuối; tệp Excel, PDF in đủ số khi người tải có quyền xem số định danh và mọi lần tải ghi nhật ký xuất (BR-74)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const VIEW = [PERMISSION_CODES.finalYearView, PERMISSION_CODES.finalYearManage, PERMISSION_CODES.finalYearApprove];
const LEVEL: EntryAdmissionLevel = 'preschool';
export const DEADLINE_SETTING_KEY = 'final_year_edit_deadline';
const MAXIMUM_TEXT = 300;
const MAXIMUM_PROPOSAL = 1000;
const PHONE_PATTERN = /^0\d{9,10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const IMAGE_SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { contentType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

export interface FinalYearFileView {
  id: string;
  kind: FinalYearFileKind;
  file_name: string;
  content_type: string;
  uploaded_by_name: string;
  uploaded_by_parent: boolean;
  created_at: Date;
}

export interface FinalYearGuardianView {
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  is_primary: boolean;
}

export interface FinalYearRecordView {
  id: string;
  child_id: string;
  org_unit_id: string;
  org_unit_name: string;
  class_id: string;
  class_name: string;
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  place_of_birth: string | null;
  national_id: string;
  identity_type: FinalYearIdentityType;
  residence_type: FinalYearResidenceType | null;
  current_residence: string | null;
  house_number: string | null;
  street: string | null;
  residential_group: string | null;
  quarter: string | null;
  ward: string | null;
  province: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  guardians: FinalYearGuardianView[];
  latitude: number | null;
  longitude: number | null;
  routed_school: string | null;
  beneficiary: string | null;
  priority_form: string | null;
  registration_source: FinalYearRegistrationSource;
  parent_proposal: string | null;
  parent_proposed_at: Date | null;
  status: FinalYearStatus;
  review_status: FinalYearReviewStatus;
  confirmed_at: Date | null;
  confirmed_by_name: string | null;
  confirmed_by_school: boolean;
  approved_at: Date | null;
  approved_by_name: string | null;
  admission_consent: boolean;
  admission_consent_at: Date | null;
  missing: FinalYearCheckItem[];
  check_text: string;
  files: FinalYearFileView[];
  has_parent_account: boolean;
  updated_at: Date;
}

export interface FinalYearFilter {
  orgUnitId?: string;
  classId?: string;
  nationalId?: string;
  q?: string;
  check?: 'complete' | 'missing';
  identityType?: FinalYearIdentityType;
  status?: FinalYearStatus;
  source?: FinalYearRegistrationSource;
  review?: FinalYearReviewStatus;
  location?: boolean;
  consent?: boolean;
  // Xem theo: A–Z toàn trường hoặc A–Z theo lớp
  order?: 'school' | 'class';
}

// Ô hồ sơ trường sửa được ở 1.1 và cập nhật từ Excel
export interface FinalYearRecordInput {
  identity_type?: FinalYearIdentityType;
  residence_type?: FinalYearResidenceType | null;
  current_residence?: string | null;
  house_number?: string | null;
  street?: string | null;
  residential_group?: string | null;
  quarter?: string | null;
  ward?: string | null;
  province?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  routed_school?: string | null;
  beneficiary?: string | null;
  priority_form?: string | null;
  registration_source?: FinalYearRegistrationSource;
}

const TEXT_INPUTS = [
  'current_residence',
  'house_number',
  'street',
  'residential_group',
  'quarter',
  'ward',
  'province',
  'contact_name',
  'routed_school',
  'beneficiary',
  'priority_form',
] as const;

function optionOf<Value extends string>(
  body: Record<string, unknown>,
  field: string,
  options: ReadonlyArray<{ value: Value }>,
  errors: FieldError[],
  nullable: boolean,
): Value | null | undefined {
  const value = body[field];
  if (value === undefined) {
    return undefined;
  }
  if ((value === null || value === '') && nullable) {
    return null;
  }
  if (typeof value !== 'string' || !options.some((option) => option.value === value)) {
    errors.push({ field, message: 'Giá trị không có trong danh sách' });
    return undefined;
  }
  return value as Value;
}

function coordinateOf(body: Record<string, unknown>, field: string, limit: number, errors: FieldError[]) {
  const value = body[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > limit) {
    errors.push({ field, message: `Tọa độ là số từ -${limit} đến ${limit}` });
    return undefined;
  }
  return Math.round(number * 1_000_000) / 1_000_000;
}

// Đọc ô hồ sơ trong thân yêu cầu (sửa ở lưới) hoặc dòng của tệp Excel đã đổi sang mã giá trị
export function readFinalYearInput(
  body: Record<string, unknown> | undefined,
  errors: FieldError[],
): FinalYearRecordInput {
  const source = body ?? {};
  const input: FinalYearRecordInput = {};
  for (const field of TEXT_INPUTS) {
    const value = source[field];
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value !== 'string') {
      errors.push({ field, message: 'Phải là chữ' });
    } else if (typeof value === 'string' && value.trim().length > MAXIMUM_TEXT) {
      errors.push({ field, message: `Tối đa ${MAXIMUM_TEXT} ký tự` });
    } else {
      input[field] = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    }
  }
  const phone = source.contact_phone;
  if (phone !== undefined) {
    const text = typeof phone === 'string' ? phone.replace(/[\s.]/g, '') : phone;
    if (text === null || text === '') {
      input.contact_phone = null;
    } else if (typeof text !== 'string' || !PHONE_PATTERN.test(text)) {
      errors.push({ field: 'contact_phone', message: 'Số điện thoại gồm 10 hoặc 11 chữ số, bắt đầu bằng 0' });
    } else {
      input.contact_phone = text;
    }
  }
  const email = source.contact_email;
  if (email !== undefined) {
    if (email === null || email === '') {
      input.contact_email = null;
    } else if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()) || email.trim().length > 200) {
      errors.push({ field: 'contact_email', message: 'Địa chỉ thư điện tử không hợp lệ' });
    } else {
      input.contact_email = email.trim();
    }
  }
  const identity = optionOf(source, 'identity_type', FINAL_YEAR_IDENTITY_TYPES, errors, false);
  if (identity) {
    input.identity_type = identity;
  }
  const residence = optionOf(source, 'residence_type', FINAL_YEAR_RESIDENCE_TYPES, errors, true);
  if (residence !== undefined) {
    input.residence_type = residence;
  }
  const registration = optionOf(source, 'registration_source', FINAL_YEAR_REGISTRATION_SOURCES, errors, false);
  if (registration) {
    input.registration_source = registration;
  }
  const latitude = coordinateOf(source, 'latitude', 90, errors);
  if (latitude !== undefined) {
    input.latitude = latitude;
  }
  const longitude = coordinateOf(source, 'longitude', 180, errors);
  if (longitude !== undefined) {
    input.longitude = longitude;
  }
  return input;
}

export function readFinalYearFilter(query: Record<string, unknown>, errors: FieldError[]): FinalYearFilter {
  const text = (field: string, maximum: number) => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value !== 'string' || value.trim().length > maximum) {
      errors.push({ field, message: `Tối đa ${maximum} ký tự` });
      return undefined;
    }
    return value.trim() || undefined;
  };
  const choice = <Value extends string>(field: string, values: readonly Value[]) => {
    const value = text(field, 50);
    if (value !== undefined && !values.includes(value as Value)) {
      errors.push({ field, message: 'Giá trị không có trong danh sách' });
      return undefined;
    }
    return value as Value | undefined;
  };
  const yesNo = (field: string) => {
    const value = choice(field, ['true', 'false']);
    return value === undefined ? undefined : value === 'true';
  };
  const uuid = (field: string) => {
    const value = text(field, 36);
    if (value !== undefined && !/^[0-9a-f-]{36}$/i.test(value)) {
      errors.push({ field, message: 'Mã không hợp lệ' });
      return undefined;
    }
    return value;
  };
  const nationalId = text('national_id', 12);
  if (nationalId !== undefined && !NATIONAL_ID_PATTERN.test(nationalId)) {
    errors.push({ field: 'national_id', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  return {
    orgUnitId: uuid('org_unit_id'),
    classId: uuid('class_id'),
    nationalId: nationalId && NATIONAL_ID_PATTERN.test(nationalId) ? nationalId : undefined,
    q: text('q', 100),
    check: choice('check', ['complete', 'missing']),
    identityType: choice(
      'identity_type',
      FINAL_YEAR_IDENTITY_TYPES.map((item) => item.value),
    ),
    status: choice(
      'status',
      FINAL_YEAR_STATUSES.map((item) => item.value),
    ),
    source: choice(
      'registration_source',
      FINAL_YEAR_REGISTRATION_SOURCES.map((item) => item.value),
    ),
    review: choice('review_status', ['pending', 'approved']),
    location: yesNo('has_location'),
    consent: yesNo('admission_consent'),
    order: choice('order', ['school', 'class']),
  };
}

const toNumber = (value: string | null) => (value === null ? null : Number(value));
const dateText = (value: Date | string | null) =>
  value === null
    ? ''
    : typeof value === 'string'
      ? value.split('-').reverse().join('/')
      : value.toLocaleString('vi-VN');

function detectContentType(body: Buffer): string | undefined {
  return IMAGE_SIGNATURES.find((signature) => signature.bytes.every((byte, index) => body[index] === byte))
    ?.contentType;
}

// Cột của tệp Excel hồ sơ cuối cấp; cột ID dùng để cập nhật lại từ chính tệp đã xuất ("Cập nhật từ Excel"). Cột chỉ đọc bỏ
// qua khi cập nhật
interface WorkbookColumn {
  key: string;
  label: string;
  value: (row: FinalYearRecordView) => unknown;
  // Cột cập nhật được: mã ô hồ sơ và cách đổi chữ trong tệp sang giá trị
  input?: { field: keyof FinalYearRecordInput; parse?: (text: string) => string | null };
}

const byLabel = (items: ReadonlyArray<{ value: string; label: string }>) => (text: string) =>
  text === '' ? null : (items.find((item) => item.label.toLowerCase() === text.toLowerCase())?.value ?? text);

export const FINAL_YEAR_COLUMNS: WorkbookColumn[] = [
  { key: 'id', label: 'ID', value: (row) => row.id },
  { key: 'moet_student_code', label: 'Mã định danh', value: (row) => row.moet_student_code },
  { key: 'full_name', label: 'Họ và tên', value: (row) => row.full_name },
  { key: 'dob', label: 'Ngày sinh', value: (row) => dateText(row.dob) },
  { key: 'gender', label: 'Giới tính', value: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
  { key: 'place_of_birth', label: 'Nơi sinh', value: (row) => row.place_of_birth },
  { key: 'class_name', label: 'Lớp', value: (row) => row.class_name },
  { key: 'national_id', label: 'Số định danh cá nhân', value: (row) => row.national_id },
  {
    key: 'identity_type',
    label: 'Loại định danh',
    value: (row) => FINAL_YEAR_IDENTITY_LABELS[row.identity_type],
    input: { field: 'identity_type', parse: byLabel(FINAL_YEAR_IDENTITY_TYPES) },
  },
  {
    key: 'residence_type',
    label: 'Diện cư trú',
    value: (row) => (row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : ''),
    input: { field: 'residence_type', parse: byLabel(FINAL_YEAR_RESIDENCE_TYPES) },
  },
  {
    key: 'current_residence',
    label: 'Nơi ở hiện tại (nhập theo VNeID)',
    value: (row) => row.current_residence,
    input: { field: 'current_residence' },
  },
  { key: 'contact_name', label: 'Người liên hệ', value: (row) => row.contact_name, input: { field: 'contact_name' } },
  {
    key: 'contact_phone',
    label: 'Điện thoại liên hệ',
    value: (row) => row.contact_phone,
    input: { field: 'contact_phone' },
  },
  { key: 'contact_email', label: 'Thư điện tử', value: (row) => row.contact_email, input: { field: 'contact_email' } },
  { key: 'check_text', label: 'Nội dung kiểm dò', value: (row) => row.check_text },
  { key: 'parent_proposal', label: 'PHHS đề xuất', value: (row) => row.parent_proposal },
  { key: 'status', label: 'Trạng thái hồ sơ', value: (row) => FINAL_YEAR_STATUS_LABELS[row.status] },
  { key: 'review_status', label: 'Trạng thái duyệt', value: (row) => FINAL_YEAR_REVIEW_LABELS[row.review_status] },
  {
    key: 'registration_source',
    label: 'PHHS đăng ký',
    value: (row) => FINAL_YEAR_SOURCE_LABELS[row.registration_source],
    input: { field: 'registration_source', parse: byLabel(FINAL_YEAR_REGISTRATION_SOURCES) },
  },
  {
    key: 'routed_school',
    label: 'Trường phân tuyến',
    value: (row) => row.routed_school,
    input: { field: 'routed_school' },
  },
  { key: 'admission_consent', label: 'PH đồng ý nhập học', value: (row) => (row.admission_consent ? 'Đã đồng ý' : '') },
  { key: 'beneficiary', label: 'Đối tượng', value: (row) => row.beneficiary, input: { field: 'beneficiary' } },
  {
    key: 'priority_form',
    label: 'Hình thức ưu tiên',
    value: (row) => row.priority_form,
    input: { field: 'priority_form' },
  },
  { key: 'latitude', label: 'Vĩ độ', value: (row) => row.latitude, input: { field: 'latitude' } },
  { key: 'longitude', label: 'Kinh độ', value: (row) => row.longitude, input: { field: 'longitude' } },
  { key: 'house_number', label: 'Số nhà', value: (row) => row.house_number, input: { field: 'house_number' } },
  { key: 'street', label: 'Đường', value: (row) => row.street, input: { field: 'street' } },
  {
    key: 'residential_group',
    label: 'Tổ',
    value: (row) => row.residential_group,
    input: { field: 'residential_group' },
  },
  { key: 'quarter', label: 'Khu phố', value: (row) => row.quarter, input: { field: 'quarter' } },
  { key: 'ward', label: 'Phường/Xã', value: (row) => row.ward, input: { field: 'ward' } },
  { key: 'province', label: 'Thành phố (Tỉnh)', value: (row) => row.province, input: { field: 'province' } },
];

const IMPORT_COLUMNS: ImportColumn[] = FINAL_YEAR_COLUMNS.filter((column) => column.key === 'id' || column.input).map(
  (column) => ({ key: column.key, header: column.label, note: '' }),
);

export interface PdfRequest {
  format: FinalYearPdfFormat;
  kind: FinalYearPdfKind;
  split: boolean;
  ids: string[] | null;
  filter: FinalYearFilter;
}

@Injectable()
export class FinalYearRecordsService {
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

  today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  // Đơn vị trong phạm vi của các quyền (bỏ vai trò phụ huynh); null là toàn trường
  async scopeUnits(currentUser: CurrentUser, permissions: string[]): Promise<string[] | null> {
    const units = new Set<string>();
    for (const permission of permissions) {
      const scope = await this.organizationScopes.resolveStaff(currentUser, permission);
      if (scope.wholeSchool) {
        return null;
      }
      scope.orgUnitIds.forEach((id) => units.add(id));
    }
    if (units.size === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem hồ sơ cuối cấp');
    }
    return [...units];
  }

  async root(database: Executor) {
    const root = await database
      .selectFrom('org_units')
      .select(['id', 'code', 'name'])
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!root) {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, 'Chưa khai báo Trường chính ở cây đơn vị');
    }
    return root;
  }

  async deadline(database: Executor): Promise<string | null> {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', DEADLINE_SETTING_KEY)
      .executeTakeFirst();
    return typeof row?.value === 'string' ? row.value : null;
  }

  // Lớp năm cuối cấp đang dùng của năm học; hồ sơ cuối cấp hiện chỉ của cấp Mầm non, hồ sơ chuyển cấp của cấp khác là DT-20,
  // DT-21 (DT-19 phần 19d, YCTD-154)
  finalYearClasses(database: Executor) {
    return database
      .selectFrom('classes')
      .innerJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .where('classes.status', '=', 'active')
      .where('classes.school_level', '=', 'MN')
      .where('grade_levels.age_from_months', '>=', FINAL_YEAR_LEVELS[LEVEL].minimumAgeMonths);
  }

  // Thêm hồ sơ cho trẻ đang học lớp năm cuối cấp chưa có hồ sơ; hồ sơ đã có giữ nguyên, đơn vị theo đơn vị hiện tại của trẻ
  async synchronize(database: Executor): Promise<void> {
    const candidates = await this.finalYearClasses(database)
      .innerJoin('class_enrollments', 'class_enrollments.class_id', 'classes.id')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .leftJoin('final_year_records', 'final_year_records.child_id', 'children.id')
      .select(['children.id as child_id', 'children.org_unit_id', 'final_year_records.id as record_id'])
      .select('final_year_records.org_unit_id as record_unit_id')
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .execute();
    const missing = candidates.filter((row) => row.record_id === null);
    if (missing.length > 0) {
      await database
        .insertInto('final_year_records')
        .values(missing.map((row) => ({ child_id: row.child_id, org_unit_id: row.org_unit_id })))
        .onConflict((conflict) => conflict.column('child_id').doNothing())
        .execute();
    }
    for (const row of candidates.filter((item) => item.record_id && item.record_unit_id !== item.org_unit_id)) {
      await database
        .updateTable('final_year_records')
        .set({ org_unit_id: row.org_unit_id })
        .where('id', '=', row.record_id as string)
        .execute();
    }
  }

  // Đọc hồ sơ kèm thông tin trẻ, lớp, phụ huynh, tệp; điều kiện là trẻ còn học lớp năm cuối cấp. Số định danh che bốn số cuối,
  // trừ khi người gọi cần số đầy đủ để in tệp (đã kiểm tra quyền xem số định danh)
  async loadViews(
    database: Executor,
    options: { unitIds?: string[] | null; recordIds?: string[]; guardianUserId?: string; fullNationalId?: boolean },
  ): Promise<Array<FinalYearRecordView & { national_id_hash: string }>> {
    let query = this.finalYearClasses(database)
      .innerJoin('class_enrollments', 'class_enrollments.class_id', 'classes.id')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .innerJoin('final_year_records as record', 'record.child_id', 'children.id')
      .innerJoin('org_units as child_unit', 'child_unit.id', 'children.org_unit_id')
      .selectAll('record')
      .select([
        'classes.id as class_id',
        'classes.name as class_name',
        'child_unit.name as org_unit_name',
        'children.full_name',
        'children.dob',
        'children.gender',
        'children.place_of_birth',
        'children.moet_student_code',
        'children.national_id_encrypted',
        'children.national_id_hash',
        'children.national_id_last4',
        'children.birth_certificate_file_id',
      ])
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null);
    if (options.unitIds) {
      query = query.where('children.org_unit_id', 'in', options.unitIds.length ? options.unitIds : [randomUUID()]);
    }
    if (options.recordIds) {
      query = query.where('record.id', 'in', options.recordIds.length ? options.recordIds : [randomUUID()]);
    }
    if (options.guardianUserId) {
      const userId = options.guardianUserId;
      query = query.where('children.id', 'in', (expression) =>
        expression
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('child_guardians.child_id')
          .where('guardians.user_id', '=', userId),
      );
    }
    const rows = await query.execute();
    if (rows.length === 0) {
      return [];
    }
    const childIds = rows.map((row) => row.child_id);
    const [guardians, files] = await Promise.all([
      database
        .selectFrom('child_guardians')
        .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
        .leftJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
        .select([
          'child_guardians.child_id',
          'child_guardians.is_primary',
          'guardians.full_name',
          'guardians.phone',
          'guardians.email',
          'guardians.user_id',
          'catalog_items.name as relationship',
        ])
        .where('child_guardians.child_id', 'in', childIds)
        .orderBy('child_guardians.is_primary', 'desc')
        .orderBy('guardians.full_name')
        .execute(),
      database
        .selectFrom('final_year_record_files')
        .innerJoin('files', 'files.id', 'final_year_record_files.file_id')
        .select([
          'final_year_record_files.record_id',
          'final_year_record_files.kind',
          'final_year_record_files.uploaded_by_name',
          'final_year_record_files.uploaded_by_parent',
          'final_year_record_files.created_at',
          'files.id',
          'files.file_name',
          'files.content_type',
        ])
        .where(
          'final_year_record_files.record_id',
          'in',
          rows.map((row) => row.id),
        )
        .orderBy('final_year_record_files.created_at')
        .execute(),
    ]);
    return rows.map((row) => {
      const childGuardians = guardians
        .filter((guardian) => guardian.child_id === row.child_id)
        .map((guardian) => ({
          full_name: guardian.full_name,
          relationship: guardian.relationship,
          phone: guardian.phone,
          email: guardian.email,
          user_id: guardian.user_id,
          is_primary: guardian.is_primary,
        }));
      const recordFiles = files
        .filter((file) => file.record_id === row.id)
        .map((file) => ({
          id: file.id,
          kind: file.kind,
          file_name: file.file_name,
          content_type: file.content_type,
          uploaded_by_name: file.uploaded_by_name,
          uploaded_by_parent: file.uploaded_by_parent,
          created_at: file.created_at,
        }));
      // Liên hệ mặc định là phụ huynh liên hệ chính có số điện thoại; trường hoặc tệp Excel ghi đè được
      const primary = childGuardians.find((guardian) => guardian.phone);
      const contactPhone = row.contact_phone ?? primary?.phone ?? null;
      const missing = checkRecord({
        identity_type: row.identity_type,
        current_residence: row.current_residence,
        ward: row.ward,
        province: row.province,
        contact_phone: contactPhone,
        has_birth_certificate:
          row.birth_certificate_file_id !== null || recordFiles.some((file) => file.kind === 'birth_certificate'),
        has_residence_proof: recordFiles.some((file) => file.kind === 'residence'),
      });
      return {
        id: row.id,
        child_id: row.child_id,
        org_unit_id: row.org_unit_id,
        org_unit_name: row.org_unit_name,
        class_id: row.class_id,
        class_name: row.class_name,
        moet_student_code: row.moet_student_code,
        full_name: row.full_name,
        dob: row.dob,
        gender: row.gender,
        place_of_birth: row.place_of_birth,
        national_id: options.fullNationalId
          ? this.revealNationalId(row.national_id_encrypted, row.national_id_last4)
          : maskNationalId(row.national_id_last4),
        national_id_hash: row.national_id_hash,
        identity_type: row.identity_type,
        residence_type: row.residence_type,
        current_residence: row.current_residence,
        house_number: row.house_number,
        street: row.street,
        residential_group: row.residential_group,
        quarter: row.quarter,
        ward: row.ward,
        province: row.province,
        contact_name: row.contact_name ?? primary?.full_name ?? null,
        contact_phone: contactPhone,
        contact_email: row.contact_email ?? primary?.email ?? null,
        guardians: childGuardians,
        latitude: toNumber(row.latitude),
        longitude: toNumber(row.longitude),
        routed_school: row.routed_school,
        beneficiary: row.beneficiary,
        priority_form: row.priority_form,
        registration_source: row.registration_source,
        parent_proposal: row.parent_proposal,
        parent_proposed_at: row.parent_proposed_at,
        status: row.status,
        review_status: row.review_status,
        confirmed_at: row.confirmed_at,
        confirmed_by_name: row.confirmed_by_name,
        confirmed_by_school: row.confirmed_by_school,
        approved_at: row.approved_at,
        approved_by_name: row.approved_by_name,
        admission_consent: row.admission_consent,
        admission_consent_at: row.admission_consent_at,
        missing,
        check_text: missing.length ? missing.map((item) => FINAL_YEAR_CHECK_LABELS[item]).join('; ') : 'Đủ thông tin',
        files: recordFiles,
        has_parent_account: childGuardians.some((guardian) => guardian.user_id !== null),
        updated_at: row.updated_at,
      };
    });
  }

  // Số định danh đầy đủ cho tệp in; bản mã hỏng (ví dụ dữ liệu nhập lỗi) thì in số đã che thay vì làm hỏng cả tệp
  private revealNationalId(encrypted: string, lastFour: string): string {
    try {
      return this.protection.decrypt(encrypted);
    } catch {
      return maskNationalId(lastFour);
    }
  }

  applyFilter<Row extends FinalYearRecordView & { national_id_hash: string }>(
    rows: Row[],
    filter: FinalYearFilter,
  ): Row[] {
    const nationalIdHash = filter.nationalId ? this.protection.hash(filter.nationalId) : null;
    const q = filter.q?.toLocaleLowerCase('vi');
    const filtered = rows.filter(
      (row) =>
        (!filter.orgUnitId || row.org_unit_id === filter.orgUnitId) &&
        (!filter.classId || row.class_id === filter.classId) &&
        (!nationalIdHash || row.national_id_hash === nationalIdHash) &&
        (!q || row.full_name.toLocaleLowerCase('vi').includes(q)) &&
        (!filter.check || (filter.check === 'complete') === (row.missing.length === 0)) &&
        (!filter.identityType || row.identity_type === filter.identityType) &&
        (!filter.status || row.status === filter.status) &&
        (!filter.source || row.registration_source === filter.source) &&
        (!filter.review || row.review_status === filter.review) &&
        (filter.location === undefined || filter.location === (row.latitude !== null && row.longitude !== null)) &&
        (filter.consent === undefined || filter.consent === row.admission_consent),
    );
    return filtered.sort(
      (left, right) =>
        (filter.order === 'class' ? left.class_name.localeCompare(right.class_name, 'vi') : 0) ||
        compareVietnameseNames(left.full_name, right.full_name),
    );
  }

  private strip(rows: Array<FinalYearRecordView & { national_id_hash: string }>): FinalYearRecordView[] {
    return rows.map((row) => {
      const view: FinalYearRecordView & { national_id_hash?: string } = { ...row };
      delete view.national_id_hash;
      return view;
    });
  }

  async list(currentUser: CurrentUser, filter: FinalYearFilter) {
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    await this.synchronize(database);
    const rows = this.applyFilter(await this.loadViews(database, { unitIds }), filter);
    return { items: this.strip(rows), edit_deadline: await this.deadline(database), today: this.today() };
  }

  private async assertManage(
    currentUser: CurrentUser,
    orgUnitId: string,
    permission: string = PERMISSION_CODES.finalYearManage,
  ) {
    await this.organizationScopes.assertCanAccess(currentUser, permission, orgUnitId);
  }

  private async findRecord(database: Executor, recordId: string) {
    const record = await database
      .selectFrom('final_year_records')
      .selectAll()
      .where('id', '=', recordId)
      .executeTakeFirst();
    if (!record) {
      throw notFoundError('Không tìm thấy hồ sơ cuối cấp', 'final_year_record');
    }
    return record;
  }

  private async writeEvent(
    executor: Executor,
    entry: {
      recordId: string;
      action: string;
      from?: string | null;
      to?: string | null;
      note?: string | null;
      origin: ChangeOrigin;
      byParent?: boolean;
    },
  ) {
    await executor
      .insertInto('final_year_record_events')
      .values({
        record_id: entry.recordId,
        action: entry.action,
        from_status: entry.from ?? null,
        to_status: entry.to ?? null,
        note: entry.note ?? null,
        actor_user_id: entry.origin.actorUserId,
        actor_name: entry.origin.actorName,
        by_parent: entry.byParent ?? false,
      })
      .execute();
  }

  async update(currentUser: CurrentUser, recordId: string, input: FinalYearRecordInput, origin: ChangeOrigin) {
    const database = await this.database();
    const record = await this.findRecord(database, recordId);
    await this.assertManage(currentUser, record.org_unit_id);
    if (record.review_status === 'approved') {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, 'Hồ sơ đã duyệt; hủy duyệt trước khi sửa');
    }
    if (Object.keys(input).length === 0) {
      throw validationError([{ field: 'body', message: 'Không có thông tin cần cập nhật' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('final_year_records')
        .set({ ...input, updated_by: origin.actorUserId, updated_at: this.clock.now() })
        .where('id', '=', recordId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.writeEvent(transaction, { recordId, action: 'update', note: Object.keys(input).join(', '), origin });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: record.org_unit_id,
        entityName: 'final_year_records',
        entityId: recordId,
        action: 'update',
        before: record,
        after,
      });
    });
    return this.view(database, recordId);
  }

  async view(database: Executor, recordId: string): Promise<FinalYearRecordView> {
    const [row] = await this.loadViews(database, { recordIds: [recordId] });
    if (!row) {
      throw notFoundError('Hồ sơ không còn thuộc lớp năm cuối cấp', 'final_year_record');
    }
    return this.strip([row])[0]!;
  }

  // Xác nhận hồ sơ (thay phụ huynh), Đã chỉnh sửa thông tin, Duyệt, Hủy duyệt cho các hồ sơ đã chọn; hồ sơ không làm được thì
  // bỏ qua kèm lý do
  async act(
    currentUser: CurrentUser,
    action: 'confirm' | 'edited' | 'approve' | 'unapprove',
    recordIds: string[],
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const permission =
      action === 'approve' || action === 'unapprove'
        ? PERMISSION_CODES.finalYearApprove
        : PERMISSION_CODES.finalYearManage;
    const views = await this.loadViews(database, { recordIds });
    const skipped: Array<{ id: string; full_name: string; reason: string }> = [];
    let done = 0;
    for (const id of recordIds) {
      const view = views.find((row) => row.id === id);
      if (!view) {
        skipped.push({ id, full_name: '', reason: 'Hồ sơ không còn thuộc lớp năm cuối cấp' });
        continue;
      }
      const skip = (reason: string) => skipped.push({ id, full_name: view.full_name, reason });
      try {
        await this.assertManage(currentUser, view.org_unit_id, permission);
      } catch {
        skip('Hồ sơ nằm ngoài phạm vi của bạn');
        continue;
      }
      const now = this.clock.now();
      if (action === 'approve' || action === 'unapprove') {
        if (action === 'approve') {
          const problem =
            view.review_status === 'approved' ? 'Hồ sơ đã duyệt' : approvalProblem(view.status, view.missing);
          if (problem) {
            skip(problem);
            continue;
          }
        } else if (view.review_status !== 'approved') {
          skip('Hồ sơ chưa duyệt');
          continue;
        }
        await database.transaction().execute(async (transaction) => {
          await transaction
            .updateTable('final_year_records')
            .set(
              action === 'approve'
                ? {
                    review_status: 'approved',
                    approved_at: now,
                    approved_by: origin.actorUserId,
                    approved_by_name: origin.actorName,
                    updated_at: now,
                  }
                : {
                    review_status: 'pending',
                    approved_at: null,
                    approved_by: null,
                    approved_by_name: null,
                    updated_at: now,
                  },
            )
            .where('id', '=', id)
            .execute();
          await this.writeEvent(transaction, { recordId: id, action, origin });
        });
        done += 1;
        continue;
      }
      const transition = nextStatus(
        action === 'confirm' ? 'school_confirm' : 'school_edited',
        view.status,
        view.review_status,
      );
      if (!transition.ok || !transition.status) {
        skip(transition.reason ?? 'Không đổi được trạng thái');
        continue;
      }
      const status = transition.status;
      await database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('final_year_records')
          .set(
            action === 'confirm'
              ? {
                  status,
                  confirmed_at: now,
                  confirmed_by: origin.actorUserId,
                  confirmed_by_name: origin.actorName,
                  confirmed_by_school: true,
                  updated_at: now,
                }
              : { status, school_edited_at: now, updated_at: now },
          )
          .where('id', '=', id)
          .execute();
        await this.writeEvent(transaction, { recordId: id, action, from: view.status, to: status, origin });
        if (action === 'edited') {
          // Báo phụ huynh có tài khoản xem lại hồ sơ đã chỉnh sửa trên ứng dụng phụ huynh
          await queueNotification(transaction, {
            orgUnitId: view.org_unit_id,
            templateCode: 'final_year_record_edited',
            title: 'Hồ sơ cuối cấp đã được chỉnh sửa',
            body: `Nhà trường đã chỉnh sửa hồ sơ cuối cấp của ${view.full_name}. Phụ huynh vui lòng xem và xác nhận lại.`,
            targetType: 'final_year_record',
            targetId: id,
            recipients: view.guardians
              .filter((guardian) => guardian.user_id)
              .map((guardian) => ({ userId: guardian.user_id as string, channel: 'in_app' as const })),
          });
        }
      });
      done += 1;
    }
    return { done, skipped };
  }

  async readSettings(currentUser: CurrentUser) {
    await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    return { edit_deadline: await this.deadline(database), today: this.today() };
  }

  // Hạn điều chỉnh thông tin của cả trường: chỉ người có quyền cập nhật hồ sơ ở phạm vi toàn trường đặt
  async saveSettings(currentUser: CurrentUser, deadline: string | null, origin: ChangeOrigin) {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.finalYearManage);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người có phạm vi toàn trường đặt hạn điều chỉnh thông tin');
    }
    const database = await this.database();
    const root = await this.root(database);
    const before = await this.deadline(database);
    await database.transaction().execute(async (transaction) => {
      if (deadline === null) {
        await transaction
          .deleteFrom('settings')
          .where('org_unit_id', '=', root.id)
          .where('key', '=', DEADLINE_SETTING_KEY)
          .execute();
      } else {
        await transaction
          .insertInto('settings')
          .values({
            org_unit_id: root.id,
            key: DEADLINE_SETTING_KEY,
            value: JSON.stringify(deadline),
            value_type: 'string',
            updated_by: origin.actorUserId,
          })
          .onConflict((conflict) =>
            conflict.columns(['org_unit_id', 'key']).doUpdateSet({
              value: JSON.stringify(deadline),
              updated_by: origin.actorUserId,
              updated_at: this.clock.now(),
            }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: root.id,
        entityName: 'settings',
        entityId: root.id,
        action: 'update',
        before: { [DEADLINE_SETTING_KEY]: before },
        after: { [DEADLINE_SETTING_KEY]: deadline },
      });
    });
    return { edit_deadline: deadline, today: this.today() };
  }

  // Tải giấy tờ vào hồ sơ: ảnh JPEG, PNG hoặc PDF tối đa 10 MB; trường tải khi có quyền cập nhật, phụ huynh tải trước hạn
  // điều chỉnh. Hồ sơ đã duyệt không thêm giấy tờ
  async attach(
    database: Executor,
    record: { id: string; org_unit_id: string; review_status: string },
    input: { kind: FinalYearFileKind; fileName: string; body: Buffer },
    origin: ChangeOrigin,
    byParent: boolean,
  ): Promise<FinalYearFileView> {
    if (record.review_status === 'approved') {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, 'Hồ sơ đã duyệt; hủy duyệt trước khi thêm giấy tờ');
    }
    if (input.body.length === 0 || input.body.length > MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 10 MB' }]);
    }
    const contentType = detectContentType(input.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Chỉ nhận ảnh JPEG, PNG hoặc tệp PDF' }]);
    }
    const storageKey = `final_year_document/${randomUUID()}`;
    await this.fileStorage.put(storageKey, input.body, contentType);
    return database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: record.org_unit_id,
          purpose: 'final_year_document',
          file_name: input.fileName.slice(0, 200),
          content_type: contentType,
          size_bytes: input.body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'file_name', 'content_type'])
        .executeTakeFirstOrThrow();
      const link = await transaction
        .insertInto('final_year_record_files')
        .values({
          record_id: record.id,
          file_id: file.id,
          kind: input.kind,
          uploaded_by: origin.actorUserId,
          uploaded_by_name: origin.actorName,
          uploaded_by_parent: byParent,
        })
        .returning(['created_at'])
        .executeTakeFirstOrThrow();
      await this.writeEvent(transaction, {
        recordId: record.id,
        action: 'attach',
        note: `${FINAL_YEAR_FILE_KIND_LABELS[input.kind]}: ${file.file_name}`,
        origin,
        byParent,
      });
      return {
        id: file.id,
        kind: input.kind,
        file_name: file.file_name,
        content_type: file.content_type,
        uploaded_by_name: origin.actorName,
        uploaded_by_parent: byParent,
        created_at: link.created_at,
      };
    });
  }

  async attachBySchool(
    currentUser: CurrentUser,
    recordId: string,
    input: { kind: FinalYearFileKind; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const record = await this.findRecord(database, recordId);
    await this.assertManage(currentUser, record.org_unit_id);
    return this.attach(database, record, input, origin, false);
  }

  // Tệp của hồ sơ cuối cấp: người xem hồ sơ trong phạm vi hoặc phụ huynh của trẻ
  async download(currentUser: CurrentUser, fileId: string) {
    const database = await this.database();
    const file = await database
      .selectFrom('final_year_record_files')
      .innerJoin('files', 'files.id', 'final_year_record_files.file_id')
      .innerJoin('final_year_records', 'final_year_records.id', 'final_year_record_files.record_id')
      .select([
        'files.id',
        'files.file_name',
        'files.content_type',
        'files.storage_key',
        'final_year_records.org_unit_id',
        'final_year_records.child_id',
      ])
      .where('files.id', '=', fileId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'file');
    }
    if (!(await this.isGuardian(database, currentUser.id, file.child_id))) {
      const unitIds = await this.scopeUnits(currentUser, VIEW);
      if (unitIds && !unitIds.includes(file.org_unit_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tệp này');
      }
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // Gỡ tệp: trường có quyền cập nhật, hoặc phụ huynh gỡ tệp chính mình tải trước hạn; hồ sơ đã duyệt không gỡ được
  async removeFile(currentUser: CurrentUser, fileId: string, origin: ChangeOrigin) {
    const database = await this.database();
    const link = await database
      .selectFrom('final_year_record_files')
      .innerJoin('final_year_records', 'final_year_records.id', 'final_year_record_files.record_id')
      .innerJoin('files', 'files.id', 'final_year_record_files.file_id')
      .select([
        'final_year_record_files.id',
        'final_year_record_files.record_id',
        'final_year_record_files.kind',
        'final_year_record_files.uploaded_by',
        'final_year_record_files.uploaded_by_parent',
        'final_year_records.org_unit_id',
        'final_year_records.child_id',
        'final_year_records.review_status',
        'files.file_name',
        'files.storage_key',
      ])
      .where('final_year_record_files.file_id', '=', fileId)
      .executeTakeFirst();
    if (!link) {
      throw notFoundError('Không tìm thấy tệp', 'file');
    }
    const byParent = link.uploaded_by_parent && link.uploaded_by === currentUser.id;
    if (byParent) {
      assertBeforeDeadline(await this.deadline(database), this.today());
    } else {
      await this.assertManage(currentUser, link.org_unit_id);
    }
    if (link.review_status === 'approved') {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, 'Hồ sơ đã duyệt; hủy duyệt trước khi gỡ giấy tờ');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('final_year_record_files').where('id', '=', link.id).execute();
      await transaction.deleteFrom('files').where('id', '=', fileId).execute();
      await this.writeEvent(transaction, {
        recordId: link.record_id,
        action: 'remove_file',
        note: `${FINAL_YEAR_FILE_KIND_LABELS[link.kind]}: ${link.file_name}`,
        origin,
        byParent,
      });
    });
    await this.fileStorage.delete(link.storage_key);
    return { removed: true };
  }

  async isGuardian(database: Executor, userId: string, childId: string): Promise<boolean> {
    const row = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('child_guardians.child_id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', userId)
      .executeTakeFirst();
    return Boolean(row);
  }

  async events(currentUser: CurrentUser, recordId: string) {
    const database = await this.database();
    const record = await this.findRecord(database, recordId);
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    if (unitIds && !unitIds.includes(record.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ nằm ngoài phạm vi của bạn');
    }
    return database
      .selectFrom('final_year_record_events')
      .select(['id', 'action', 'from_status', 'to_status', 'note', 'actor_name', 'by_parent', 'created_at'])
      .where('record_id', '=', recordId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  // Thông tin tài khoản: tài khoản phụ huynh sẵn có của hồ sơ đã chọn (phụ huynh có số điện thoại được tạo tài khoản khi duyệt
  // hồ sơ trẻ); "Khởi tạo mật khẩu" ở cổng quản trị cấp mật khẩu tạm cho các tài khoản này qua dịch vụ định danh
  async accounts(currentUser: CurrentUser, recordIds: string[]) {
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    const views = await this.loadViews(database, { unitIds, recordIds });
    return {
      items: views.flatMap((view) =>
        view.guardians.map((guardian) => ({
          record_id: view.id,
          child_name: view.full_name,
          class_name: view.class_name,
          guardian_name: guardian.full_name,
          relationship: guardian.relationship,
          phone: guardian.phone,
          user_id: guardian.user_id,
          has_account: guardian.user_id !== null,
        })),
      ),
    };
  }

  // Người gọi có quyền xem số định danh ở mọi đơn vị của các hồ sơ thì tệp in đủ số
  private async canSeeNationalIds(currentUser: CurrentUser, unitIds: string[]): Promise<boolean> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.nationalIdView);
    return scope.wholeSchool || (unitIds.length > 0 && unitIds.every((id) => scope.orgUnitIds.includes(id)));
  }

  private async exportRows(currentUser: CurrentUser, filter: FinalYearFilter, ids: string[] | null) {
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    await this.synchronize(database);
    const masked = this.applyFilter(await this.loadViews(database, { unitIds, recordIds: ids ?? undefined }), filter);
    const units = [...new Set(masked.map((row) => row.org_unit_id))];
    const full = masked.length > 0 && (await this.canSeeNationalIds(currentUser, units));
    const rows = full
      ? this.applyFilter(
          await this.loadViews(database, { recordIds: masked.map((row) => row.id), fullNationalId: true }),
          filter,
        )
      : masked;
    return { database, rows: this.strip(rows), units, full };
  }

  async exportWorkbook(
    currentUser: CurrentUser,
    filter: FinalYearFilter,
    ipAddress: string | null,
  ): Promise<ExportedFile> {
    const { database, rows, units } = await this.exportRows(currentUser, filter, null);
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'final_year_records',
      title: 'Hồ sơ học sinh cuối cấp',
      fileName: `ho-so-cuoi-cap-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: units,
      columns: FINAL_YEAR_COLUMNS.map((column) => ({ key: column.key, label: column.label })),
      rows: rows.map((row) =>
        Object.fromEntries(FINAL_YEAR_COLUMNS.map((column) => [column.key, column.value(row) ?? ''])),
      ),
      ipAddress,
      createdAt,
    });
  }

  // Cập nhật từ Excel: tệp có cột ID và các cột cập nhật được (tệp "Xuất Excel" dùng lại được, cột chỉ đọc bỏ qua). Kiểm tra
  // toàn bộ tệp trước; có lỗi thì không ghi dòng nào và trả danh sách lỗi ("Tải danh sách lỗi" tải tệp kèm cột nội dung lỗi)
  async importWorkbook(
    currentUser: CurrentUser,
    body: Buffer,
    origin: ChangeOrigin,
    errorFile: boolean,
  ): Promise<{ updated: number; errors: RowError[] } | { errorWorkbook: Buffer }> {
    const unitIds = await this.scopeUnits(currentUser, [PERMISSION_CODES.finalYearManage]);
    const database = await this.database();
    const headers = new Set(IMPORT_COLUMNS.map((column) => column.key));
    const sheet = await readSheet(body, IMPORT_COLUMNS, headers);
    const views = await this.loadViews(database, { unitIds });
    const errors: RowError[] = [];
    const changes: Array<{ view: FinalYearRecordView; input: FinalYearRecordInput }> = [];
    for (const row of sheet) {
      const id = row.values.id ?? '';
      const view = views.find((item) => item.id === id);
      if (!view) {
        errors.push({ row: row.row, column: 'ID', message: 'Không tìm thấy hồ sơ cuối cấp trong phạm vi của bạn' });
        continue;
      }
      if (view.review_status === 'approved') {
        errors.push({ row: row.row, column: 'ID', message: 'Hồ sơ đã duyệt; hủy duyệt trước khi cập nhật' });
        continue;
      }
      const raw: Record<string, unknown> = {};
      for (const column of FINAL_YEAR_COLUMNS) {
        if (!column.input) {
          continue;
        }
        const text = (row.values[column.key] ?? '').trim();
        raw[column.input.field] = column.input.parse ? column.input.parse(text) : text;
      }
      const fieldErrors: FieldError[] = [];
      const input = readFinalYearInput(raw, fieldErrors);
      for (const error of fieldErrors) {
        const column = FINAL_YEAR_COLUMNS.find((item) => item.input?.field === error.field);
        errors.push({ row: row.row, column: column?.label ?? error.field, message: error.message });
      }
      if (fieldErrors.length === 0) {
        changes.push({ view, input });
      }
    }
    if (errorFile) {
      return { errorWorkbook: buildErrorWorkbook(body, errors, 1) };
    }
    if (errors.length > 0) {
      return { updated: 0, errors };
    }
    await database.transaction().execute(async (transaction) => {
      for (const change of changes) {
        await transaction
          .updateTable('final_year_records')
          .set({ ...change.input, updated_by: origin.actorUserId, updated_at: this.clock.now() })
          .where('id', '=', change.view.id)
          .execute();
        await this.writeEvent(transaction, { recordId: change.view.id, action: 'import', origin });
      }
    });
    return { updated: changes.length, errors: [] };
  }

  // Xuất PDF và In phiếu: hồ sơ theo bộ lọc (toàn bộ) hoặc hồ sơ đã chọn; tách tệp thì trả tệp nén
  async pdf(
    currentUser: CurrentUser,
    request: PdfRequest,
    ipAddress: string | null,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string; logId: string }> {
    const { database, rows, units } = await this.exportRows(currentUser, request.filter, request.ids);
    if (rows.length === 0) {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, 'Không có hồ sơ để xuất');
    }
    const root = await this.root(database);
    const sheets = rows.map((row) => this.sheetOf(row, root.name));
    const createdAt = this.clock.now();
    const stem = `${request.kind === 'declaration' ? 'phieu-ke-khai' : 'ho-so-cuoi-cap'}-${request.format === 'a5' ? 'a5' : 'a4-gap-doi'}`;
    let buffer: Buffer;
    let fileName: string;
    let contentType: string;
    if (request.split) {
      const entries = [];
      for (const sheet of sheets) {
        entries.push({
          name: `${sheet.file_stem}.pdf`,
          body: await buildFinalYearPdf([sheet], request.format, request.kind, createdAt),
        });
      }
      buffer = buildZip(entries, createdAt);
      fileName = `${stem}-${fileStamp(createdAt)}.zip`;
      contentType = 'application/zip';
    } else {
      buffer = await buildFinalYearPdf(sheets, request.format, request.kind, createdAt);
      fileName = `${stem}-${fileStamp(createdAt)}.pdf`;
      contentType = CONTENT_TYPES.pdf;
    }
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: 'final_year_records_pdf',
        filters_data: JSON.stringify({
          ...request.filter,
          format: request.format,
          kind: request.kind,
          split: request.split,
          selected: request.ids?.length ?? null,
        }),
        org_unit_ids: units,
        row_count: rows.length,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, contentType, logId: log.id };
  }

  sheetOf(row: FinalYearRecordView, schoolName: string): FinalYearSheet {
    const guardians = row.guardians
      .map(
        (guardian) =>
          `${guardian.relationship ? `${guardian.relationship}: ` : ''}${guardian.full_name}${guardian.phone ? ` (${guardian.phone})` : ''}`,
      )
      .join('; ');
    const stem = `${row.class_name}-${row.full_name}-${row.id.slice(0, 8)}`
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9-]+/g, '-');
    return {
      file_stem: stem,
      school_name: schoolName,
      level_label: FINAL_YEAR_LEVELS[LEVEL].label,
      sections: [
        {
          title: 'I. Thông tin học sinh',
          rows: [
            ['Họ và tên', row.full_name],
            ['Ngày sinh', dateText(row.dob)],
            ['Giới tính', row.gender === 'male' ? 'Nam' : 'Nữ'],
            ['Nơi sinh', row.place_of_birth],
            ['Lớp', row.class_name],
            ['Mã định danh', row.moet_student_code],
            ['Số định danh cá nhân', row.national_id],
            ['Loại định danh', FINAL_YEAR_IDENTITY_LABELS[row.identity_type]],
          ],
        },
        {
          title: 'II. Nơi ở và liên hệ',
          rows: [
            ['Diện cư trú', row.residence_type ? FINAL_YEAR_RESIDENCE_LABELS[row.residence_type] : null],
            ['Nơi ở hiện tại (theo VNeID)', row.current_residence],
            ['Số nhà, đường', [row.house_number, row.street].filter(Boolean).join(', ') || null],
            ['Tổ, khu phố', [row.residential_group, row.quarter].filter(Boolean).join(', ') || null],
            ['Phường/Xã', row.ward],
            ['Thành phố (Tỉnh)', row.province],
            ['Người liên hệ', row.contact_name],
            ['Điện thoại liên hệ', row.contact_phone],
            ['Thư điện tử', row.contact_email],
            ['Cha mẹ, người giám hộ', guardians || null],
          ],
        },
        {
          title: 'III. Tuyển sinh',
          rows: [
            ['Trường phân tuyến', row.routed_school],
            ['Đối tượng', row.beneficiary],
            ['Hình thức ưu tiên', row.priority_form],
            ['PHHS đăng ký', FINAL_YEAR_SOURCE_LABELS[row.registration_source]],
            ['PH đồng ý nhập học', row.admission_consent ? 'Đã đồng ý' : null],
            [
              'Giấy tờ đã nộp',
              row.files.length
                ? [...new Set(row.files.map((file) => FINAL_YEAR_FILE_KIND_LABELS[file.kind]))].join('; ')
                : null,
            ],
          ],
        },
      ],
      status_rows: [
        ['Trạng thái hồ sơ', FINAL_YEAR_STATUS_LABELS[row.status]],
        ['Trạng thái duyệt', FINAL_YEAR_REVIEW_LABELS[row.review_status]],
        ['Nội dung kiểm dò', row.check_text],
        ['PHHS đề xuất', row.parent_proposal],
      ],
    };
  }

  // 1.2: lớp năm cuối cấp trong phạm vi kèm số hồ sơ, số đủ thông tin, số thiếu và lần xác nhận hoàn thành
  async completion(currentUser: CurrentUser) {
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    await this.synchronize(database);
    let classQuery = this.finalYearClasses(database)
      .leftJoin('final_year_class_confirmations', 'final_year_class_confirmations.class_id', 'classes.id')
      .select([
        'classes.id',
        'classes.name',
        'classes.org_unit_id',
        'org_units.name as org_unit_name',
        'final_year_class_confirmations.confirmed',
        'final_year_class_confirmations.confirmed_by_name',
        'final_year_class_confirmations.confirmed_at',
      ])
      .orderBy('org_units.code')
      .orderBy('classes.name');
    if (unitIds) {
      classQuery = classQuery.where('classes.org_unit_id', 'in', unitIds);
    }
    const [classes, views] = await Promise.all([classQuery.execute(), this.loadViews(database, { unitIds })]);
    return {
      items: classes.map((item) => {
        const records = views.filter((view) => view.class_id === item.id);
        const complete = records.filter((view) => view.missing.length === 0).length;
        return {
          class_id: item.id,
          class_name: item.name,
          org_unit_id: item.org_unit_id,
          org_unit_name: item.org_unit_name,
          total: records.length,
          complete,
          missing: records.length - complete,
          confirmed: item.confirmed ?? false,
          confirmed_by_name: item.confirmed_by_name ?? null,
          confirmed_at: item.confirmed_at ?? null,
        };
      }),
    };
  }

  // Ghi xác nhận hoàn thành theo lớp: trạng thái đánh dấu tay (không có kết nối với cấp trên), ghi người và ngày xác nhận
  async saveCompletion(
    currentUser: CurrentUser,
    items: Array<{ class_id: string; confirmed: boolean }>,
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const classes = await this.finalYearClasses(database)
      .select(['classes.id', 'classes.org_unit_id'])
      .where(
        'classes.id',
        'in',
        items.map((item) => item.class_id),
      )
      .execute();
    for (const item of items) {
      const found = classes.find((row) => row.id === item.class_id);
      if (!found) {
        throw validationError([{ field: 'items', message: 'Lớp không phải lớp năm cuối cấp đang dùng' }]);
      }
      await this.assertManage(currentUser, found.org_unit_id);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const values = item.confirmed
          ? {
              confirmed: true,
              confirmed_by: origin.actorUserId,
              confirmed_by_name: origin.actorName,
              confirmed_at: now,
            }
          : { confirmed: false, confirmed_by: null, confirmed_by_name: null, confirmed_at: null };
        const before = await transaction
          .selectFrom('final_year_class_confirmations')
          .select(['confirmed'])
          .where('class_id', '=', item.class_id)
          .executeTakeFirst();
        if ((before?.confirmed ?? false) === item.confirmed) {
          continue;
        }
        await transaction
          .insertInto('final_year_class_confirmations')
          .values({ class_id: item.class_id, ...values })
          .onConflict((conflict) => conflict.column('class_id').doUpdateSet({ ...values, updated_at: now }))
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: classes.find((row) => row.id === item.class_id)?.org_unit_id ?? null,
          entityName: 'final_year_class_confirmations',
          entityId: item.class_id,
          action: 'update',
          before: before ?? null,
          after: values,
        });
      }
    });
    return this.completion(currentUser);
  }

  async exportCompletion(currentUser: CurrentUser, ipAddress: string | null): Promise<ExportedFile> {
    const { items } = await this.completion(currentUser);
    const database = await this.database();
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'final_year_completion',
      title: 'Xác nhận hoàn thành hồ sơ cuối cấp',
      fileName: `xac-nhan-hoan-thanh-ho-so-cuoi-cap-${fileStamp(createdAt)}.xlsx`,
      filters: {},
      orgUnitIds: [...new Set(items.map((item) => item.org_unit_id))],
      columns: [
        { key: 'org_unit_name', label: 'Đơn vị' },
        { key: 'class_name', label: 'Lớp' },
        { key: 'total', label: 'Tổng số hồ sơ cuối cấp' },
        { key: 'ratio', label: 'Số hồ sơ đủ thông tin/Tổng số' },
        { key: 'missing', label: 'Hồ sơ thiếu thông tin' },
        { key: 'confirmed', label: 'Xác nhận hoàn thành hồ sơ cuối cấp' },
        { key: 'confirmed_by_name', label: 'Người xác nhận' },
        { key: 'confirmed_at', label: 'Ngày xác nhận' },
      ],
      rows: items.map((item) => ({
        ...item,
        ratio: `${item.complete}/${item.total}`,
        confirmed: item.confirmed ? 'Đã xác nhận' : 'Chưa xác nhận',
        confirmed_at: item.confirmed_at ? dateText(item.confirmed_at) : '',
      })),
      ipAddress,
      createdAt,
      containsPersonalData: false,
    });
  }

  // 4.1: theo đơn vị (Trường chính, phân hiệu, điểm trường có hồ sơ): tổng số hồ sơ, số thiếu thông tin, tỷ lệ đủ thông tin
  async statistics(currentUser: CurrentUser) {
    const unitIds = await this.scopeUnits(currentUser, VIEW);
    const database = await this.database();
    await this.synchronize(database);
    const views = await this.loadViews(database, { unitIds });
    let unitQuery = database
      .selectFrom('org_units')
      .select(['id', 'code', 'name', 'unit_type'])
      .where('status', '=', 'active')
      .orderBy('code');
    if (unitIds) {
      unitQuery = unitQuery.where('id', 'in', unitIds);
    }
    const units = await unitQuery.execute();
    const items = units
      .map((unit) => {
        const records = views.filter((view) => view.org_unit_id === unit.id);
        const missing = records.filter((view) => view.missing.length > 0).length;
        return {
          org_unit_id: unit.id,
          org_unit_name: unit.name,
          unit_type: unit.unit_type,
          total: records.length,
          missing,
          complete_rate:
            records.length === 0 ? 0 : Math.round(((records.length - missing) / records.length) * 10_000) / 100,
        };
      })
      .filter((item) => item.unit_type !== 'diem_truong' || item.total > 0);
    return { items };
  }

  async exportStatistics(currentUser: CurrentUser, ipAddress: string | null): Promise<ExportedFile> {
    const { items } = await this.statistics(currentUser);
    const database = await this.database();
    const createdAt = this.clock.now();
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'final_year_statistics',
      title: 'Thống kê hồ sơ cuối cấp',
      fileName: `thong-ke-ho-so-cuoi-cap-${fileStamp(createdAt)}.xlsx`,
      filters: {},
      orgUnitIds: items.map((item) => item.org_unit_id),
      columns: [
        { key: 'org_unit_name', label: 'Đơn vị' },
        { key: 'total', label: 'Tổng số hồ sơ cuối cấp đã lấy sang TSDC' },
        { key: 'missing', label: 'Tổng số hồ sơ thiếu thông tin' },
        { key: 'complete_rate', label: 'Tỷ lệ số hồ sơ đủ thông tin/tổng hồ sơ cuối cấp (%)' },
      ],
      rows: items,
      ipAddress,
      createdAt,
      containsPersonalData: false,
    });
  }

  // Ứng dụng phụ huynh: hồ sơ cuối cấp của con (số định danh che bốn số cuối)
  async listForParent(currentUser: CurrentUser) {
    const database = await this.database();
    await this.synchronize(database);
    const rows = await this.loadViews(database, { guardianUserId: currentUser.id });
    return {
      // Phụ huynh không cần danh sách tài khoản phụ huynh của hồ sơ
      items: this.strip(rows).map((row) => ({ ...row, guardians: [] })),
      edit_deadline: await this.deadline(database),
      today: this.today(),
    };
  }

  private async parentRecord(database: Executor, currentUser: CurrentUser, recordId: string) {
    const record = await this.findRecord(database, recordId);
    if (!(await this.isGuardian(database, currentUser.id, record.child_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ này không phải của con bạn');
    }
    return record;
  }

  // Phụ huynh xác nhận hoặc đề xuất sửa (ghi nội dung) trước hạn điều chỉnh
  async parentAct(
    currentUser: CurrentUser,
    recordId: string,
    action: Extract<FinalYearAction, 'parent_confirm' | 'parent_propose'>,
    proposal: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const record = await this.parentRecord(database, currentUser, recordId);
    assertBeforeDeadline(await this.deadline(database), this.today());
    if (action === 'parent_propose' && (!proposal || proposal.length > MAXIMUM_PROPOSAL)) {
      throw validationError([
        { field: 'content', message: `Nhập nội dung đề xuất sửa, tối đa ${MAXIMUM_PROPOSAL} ký tự` },
      ]);
    }
    const transition = nextStatus(action, record.status, record.review_status);
    if (!transition.ok || !transition.status) {
      throw ruleViolationError(ENTRY_ADMISSION_RULE, transition.reason ?? 'Không đổi được trạng thái');
    }
    const status = transition.status;
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('final_year_records')
        .set(
          action === 'parent_confirm'
            ? {
                status,
                confirmed_at: now,
                confirmed_by: origin.actorUserId,
                confirmed_by_name: origin.actorName,
                confirmed_by_school: false,
                updated_at: now,
              }
            : { status, parent_proposal: proposal, parent_proposed_at: now, updated_at: now },
        )
        .where('id', '=', recordId)
        .execute();
      await this.writeEvent(transaction, {
        recordId,
        action,
        from: record.status,
        to: status,
        note: proposal,
        origin,
        byParent: true,
      });
    });
    return this.view(database, recordId);
  }

  async parentConsent(currentUser: CurrentUser, recordId: string, consent: boolean, origin: ChangeOrigin) {
    const database = await this.database();
    const record = await this.parentRecord(database, currentUser, recordId);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('final_year_records')
        .set({ admission_consent: consent, admission_consent_at: consent ? now : null, updated_at: now })
        .where('id', '=', record.id)
        .execute();
      await this.writeEvent(transaction, {
        recordId,
        action: consent ? 'consent' : 'withdraw_consent',
        origin,
        byParent: true,
      });
    });
    return this.view(database, recordId);
  }

  async parentAttach(
    currentUser: CurrentUser,
    recordId: string,
    input: { kind: FinalYearFileKind; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ) {
    const database = await this.database();
    const record = await this.parentRecord(database, currentUser, recordId);
    assertBeforeDeadline(await this.deadline(database), this.today());
    return this.attach(database, record, input, origin, true);
  }
}
