import type { ChildGender, ChildStatus, SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import { sql, type Kysely, type Transaction } from 'kysely';
import { isUuid } from '../common/request-fields.js';
import type { ChildReadScope, ChildScope } from './child-scope.js';

// Danh sách học sinh theo mục 4.1.1 và 4.1.4 của Sở (DT-15 phần 15c, YCTD-108): bộ lọc mở rộng (khối, lớp, trạng thái,
// giới tính, dân tộc, diện chính sách, khuyết tật, học 2 buổi, bán trú, biết bơi, nhóm học sinh, mã định danh Bộ, số định
// danh), sắp xếp A–Z theo tên rồi họ theo thứ tự tiếng Việt; dùng chung cho lưới và tệp Excel. Dân tộc, diện chính sách,
// khuyết tật, biết bơi lấy từ cột CSDL ngành (`moet_profile`, YCTD-100) vì hồ sơ chưa có cột riêng
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const CHILD_STATUSES: ChildStatus[] = ['draft', 'pending', 'active', 'paused', 'withdrawn', 'graduated'];
export const CHILD_STATUS_LABELS: Record<ChildStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  withdrawn: 'Thôi học',
  graduated: 'Đã tốt nghiệp',
};
const GENDERS: ChildGender[] = ['male', 'female'];
const NATIONAL_ID_PATTERN = /^\d{12}$/;

export interface StudentListFilter {
  orgUnitId?: string;
  classId?: string;
  // Lọc theo nhóm học sinh (YCTD-102); phạm vi xem trẻ vẫn áp dụng
  groupId?: string;
  status?: ChildStatus;
  q?: string;
  missingBirthCertificate?: boolean;
  gender?: ChildGender;
  gradeLevel?: string;
  ethnicity?: string;
  policy?: boolean;
  disability?: boolean;
  twoSessions?: boolean;
  boarding?: boolean;
  canSwim?: boolean;
  moetCode?: string;
  nationalId?: string;
  // Học sinh chưa có mã định danh Bộ GD&ĐT (DT-16 phần 16g)
  missingMoetCode?: boolean;
}

// Bộ lọc theo cột CSDL ngành cùng nhóm vai trò xem sức khỏe (BR-53, YCTD-100)
export const SENSITIVE_FILTERS = ['ethnicity', 'policy', 'disability'] as const;

function readYesNo(query: Record<string, unknown>, field: string, errors: FieldError[]): boolean | undefined {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  errors.push({ field, message: 'Chọn true hoặc false' });
  return undefined;
}

function readText(query: Record<string, unknown>, field: string, errors: FieldError[], maximum: number) {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > maximum) {
    errors.push({ field, message: `Tối đa ${maximum} ký tự` });
    return undefined;
  }
  return value.trim() || undefined;
}

// Đọc bộ lọc từ chuỗi truy vấn (lưới) hoặc thân yêu cầu (xuất Excel)
export function readStudentListFilter(query: Record<string, unknown>, errors: FieldError[]): StudentListFilter {
  for (const field of ['org_unit_id', 'class_id', 'group_id']) {
    const value = query[field];
    if (value !== undefined && value !== null && value !== '' && !isUuid(value)) {
      errors.push({ field, message: 'Mã không hợp lệ' });
    }
  }
  const status = query.status;
  if (status !== undefined && status !== '' && !CHILD_STATUSES.includes(status as ChildStatus)) {
    errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
  }
  const gender = query.gender;
  if (gender !== undefined && gender !== '' && !GENDERS.includes(gender as ChildGender)) {
    errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
  }
  const nationalId = readText(query, 'national_id', errors, 12);
  if (nationalId && !NATIONAL_ID_PATTERN.test(nationalId)) {
    errors.push({ field: 'national_id', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  const uuid = (field: string) => {
    const value = query[field];
    return typeof value === 'string' && isUuid(value) ? value : undefined;
  };
  return {
    orgUnitId: uuid('org_unit_id'),
    classId: uuid('class_id'),
    groupId: uuid('group_id'),
    status: (status || undefined) as ChildStatus | undefined,
    q: readText(query, 'q', errors, 100),
    missingBirthCertificate: query.missing_birth_certificate === 'true' || query.missing_birth_certificate === true,
    gender: (gender || undefined) as ChildGender | undefined,
    gradeLevel: readText(query, 'grade_level', errors, 50),
    ethnicity: readText(query, 'ethnicity', errors, 50),
    policy: readYesNo(query, 'policy', errors),
    disability: readYesNo(query, 'disability', errors),
    twoSessions: readYesNo(query, 'two_sessions_per_day', errors),
    boarding: readYesNo(query, 'boarding', errors),
    canSwim: readYesNo(query, 'can_swim', errors),
    moetCode: readText(query, 'moet_student_code', errors, 50),
    nationalId: nationalId && NATIONAL_ID_PATTERN.test(nationalId) ? nationalId : undefined,
    missingMoetCode: query.missing_moet_code === 'true' || query.missing_moet_code === true,
  };
}

export function usesSensitiveFilter(filter: StudentListFilter): boolean {
  return filter.ethnicity !== undefined || filter.policy !== undefined || filter.disability !== undefined;
}

const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&');
const profileText = (key: string) => sql<string | null>`children.moet_profile->>${sql.lit(key)}`;
const profileFilled = (key: string) => sql<boolean>`coalesce(children.moet_profile->>${sql.lit(key)}, '') <> ''`;

// Câu truy vấn đã lọc theo phạm vi xem trẻ và bộ lọc; chưa chọn cột
function filteredStudents(
  database: Executor,
  childScope: ChildScope,
  scope: ChildReadScope,
  filter: StudentListFilter,
  nationalIdHash: string | null,
) {
  let selection = database
    .selectFrom('children')

    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .leftJoin('class_enrollments', (join) =>
      join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
    )
    .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .leftJoin('grade_levels', 'grade_levels.code', 'classes.grade_level')
    .where(childScope.filter(scope));
  if (filter.orgUnitId) {
    selection = selection.where('children.org_unit_id', '=', filter.orgUnitId);
  }
  if (filter.classId) {
    selection = selection.where('class_enrollments.class_id', '=', filter.classId);
  }
  if (filter.groupId) {
    const groupId = filter.groupId;
    selection = selection.where('children.id', 'in', (expression) =>
      expression
        .selectFrom('child_group_members')
        .select('child_group_members.child_id')
        .where('group_id', '=', groupId),
    );
  }
  if (filter.status) {
    selection = selection.where('children.status', '=', filter.status);
  }
  if (filter.missingBirthCertificate) {
    selection = selection.where('children.birth_certificate_file_id', 'is', null);
  }
  if (filter.q) {
    selection = selection.where('children.full_name', 'ilike', `%${escapeLike(filter.q)}%`);
  }
  if (filter.gender) {
    selection = selection.where('children.gender', '=', filter.gender);
  }
  if (filter.gradeLevel) {
    selection = selection.where('classes.grade_level', '=', filter.gradeLevel);
  }
  if (filter.ethnicity) {
    selection = selection.where(profileText('ethnicity'), 'ilike', `%${escapeLike(filter.ethnicity)}%`);
  }
  for (const [value, key] of [
    [filter.policy, 'policy_target'],
    [filter.disability, 'disability_type'],
  ] as const) {
    if (value !== undefined) {
      selection = selection.where(value ? profileFilled(key) : sql<boolean>`not ${profileFilled(key)}`);
    }
  }
  if (filter.canSwim !== undefined) {
    const swims = sql<boolean>`coalesce(children.moet_profile->>'can_swim' = 'true', false)`;
    selection = selection.where(filter.canSwim ? swims : sql<boolean>`not ${swims}`);
  }
  if (filter.twoSessions !== undefined) {
    selection = selection.where('children.two_sessions_per_day', '=', filter.twoSessions);
  }
  if (filter.boarding !== undefined) {
    selection = selection.where('children.boarding', '=', filter.boarding);
  }
  if (filter.moetCode) {
    selection = selection.where('children.moet_student_code', 'ilike', `%${escapeLike(filter.moetCode)}%`);
  }
  if (nationalIdHash) {
    selection = selection.where('children.national_id_hash', '=', nationalIdHash);
  }
  if (filter.missingMoetCode) {
    selection = selection.where((expression) =>
      expression.or([
        expression('children.moet_student_code', 'is', null),
        expression('children.moet_student_code', '=', ''),
      ]),
    );
  }
  return selection;
}

// Cột của một dòng học sinh; số điện thoại liên hệ là số của phụ huynh liên hệ chính, điện thoại nhận tin là số của phụ
// huynh được chọn nhận tin (mục 4.1.5 của Sở)
function selectStudentColumns(selection: ReturnType<typeof filteredStudents>) {
  return selection.select((expression) => [
    'children.id',
    'children.org_unit_id',
    'org_units.name as org_unit_name',
    'children.full_name',
    'children.dob',
    'children.gender',
    'children.status',
    'children.national_id_last4',
    'children.moet_student_code',
    'children.photo_consent',
    'children.two_sessions_per_day',
    'children.boarding',
    'children.birth_certificate_file_id',
    'classes.id as class_id',
    'classes.name as class_name',
    'classes.grade_level',
    'grade_levels.name as grade_name',
    profileText('ethnicity').as('ethnicity'),
    profileText('policy_target').as('policy_target'),
    profileText('disability_type').as('disability_type'),
    sql<boolean>`coalesce(children.moet_profile->>'can_swim' = 'true', false)`.as('can_swim'),
    expression
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.phone')
      .whereRef('child_guardians.child_id', '=', 'children.id')
      .where('child_guardians.is_primary', '=', true)
      .limit(1)
      .as('contact_phone'),
    expression
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.phone')
      .whereRef('child_guardians.child_id', '=', 'children.id')
      .where('child_guardians.receives_sms', '=', true)
      .limit(1)
      .as('sms_phone'),
  ]);
}

// A–Z theo tên (từ cuối của họ tên) rồi theo họ tên, thứ tự chữ cái tiếng Việt (mục 4.1.3 của Sở)
const GIVEN_NAME_ORDER = sql`regexp_replace(trim(children.full_name), '^.*\\s', '') collate "vi-x-icu"`;
const FULL_NAME_ORDER = sql`children.full_name collate "vi-x-icu"`;

// Dòng học sinh đọc từ cơ sở dữ liệu, trước khi che số định danh và cột CSDL ngành
export interface StudentRecord {
  id: string;
  org_unit_id: string;
  org_unit_name: string;
  full_name: string;
  dob: string;
  gender: ChildGender;
  status: ChildStatus;
  national_id_last4: string;
  moet_student_code: string | null;
  photo_consent: string;
  two_sessions_per_day: boolean;
  boarding: boolean;
  birth_certificate_file_id: string | null;
  class_id: string | null;
  class_name: string | null;
  grade_level: string | null;
  grade_name: string | null;
  ethnicity: string | null;
  policy_target: string | null;
  disability_type: string | null;
  can_swim: boolean | null;
  contact_phone: string | null;
  sms_phone: string | null;
}

// Đếm và đọc một trang (hoặc tất cả khi không truyền trang) học sinh trong phạm vi theo bộ lọc
export async function findStudents(
  database: Executor,
  childScope: ChildScope,
  scope: ChildReadScope,
  filter: StudentListFilter,
  nationalIdHash: string | null,
  page: { limit: number; offset: number } | null,
): Promise<{ total: number; rows: StudentRecord[] }> {
  const selection = filteredStudents(database, childScope, scope, filter, nationalIdHash);
  const counted = await selection
    .select((expression) => expression.fn.countAll<string>().as('count'))
    .executeTakeFirstOrThrow();
  let query = selectStudentColumns(selection);
  // Lọc theo một lớp thì theo số thứ tự cố định trong lớp (mục 4.1.3 của Sở, DT-16 phần 16g), chưa có số thì xếp sau
  if (filter.classId) {
    query = query.orderBy(sql`class_enrollments.order_number nulls last`);
  }
  query = query.orderBy(GIVEN_NAME_ORDER).orderBy(FULL_NAME_ORDER).orderBy('children.id');
  if (page) {
    query = query.limit(page.limit).offset(page.offset);
  }
  return { total: Number(counted.count), rows: (await query.execute()) as StudentRecord[] };
}

// Cột của tệp Excel, cùng mã cột với lưới ở cổng quản trị
export interface StudentRow {
  moet_student_code: string | null;
  full_name: string;
  dob: string;
  gender: ChildGender;
  ethnicity: string | null;
  status: ChildStatus;
  contact_phone: string | null;
  sms_phone: string | null;
  grade_name: string | null;
  grade_level: string | null;
  class_name: string | null;
  two_sessions_per_day: boolean;
  boarding: boolean;
  policy_target: string | null;
  disability_type: string | null;
  can_swim: boolean | null;
  national_id_masked: string;
  org_unit_name: string;
}

const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
const yes = (value: boolean | null) => (value ? 'Có' : '');

export const STUDENT_EXPORT_COLUMNS: Array<{ id: string; label: string; value(row: StudentRow): string }> = [
  { id: 'moet_student_code', label: 'Mã định danh Bộ GD&ĐT', value: (row) => row.moet_student_code ?? '' },
  { id: 'full_name', label: 'Họ tên', value: (row) => row.full_name },
  { id: 'dob', label: 'Ngày sinh', value: (row) => formatDate(row.dob) },
  { id: 'gender', label: 'Giới tính', value: (row) => (row.gender === 'male' ? 'Nam' : 'Nữ') },
  { id: 'ethnicity', label: 'Dân tộc', value: (row) => row.ethnicity ?? '' },
  { id: 'status', label: 'Trạng thái', value: (row) => CHILD_STATUS_LABELS[row.status] },
  { id: 'contact_phone', label: 'Số điện thoại liên hệ', value: (row) => row.contact_phone ?? '' },
  { id: 'grade', label: 'Khối', value: (row) => row.grade_name ?? row.grade_level ?? '' },
  { id: 'class', label: 'Lớp', value: (row) => row.class_name ?? '' },
  { id: 'sms_phone', label: 'Điện thoại nhận tin', value: (row) => row.sms_phone ?? '' },
  { id: 'two_sessions_per_day', label: 'Học 2 buổi/ngày', value: (row) => yes(row.two_sessions_per_day) },
  { id: 'boarding', label: 'Bán trú', value: (row) => yes(row.boarding) },
  { id: 'policy_target', label: 'Diện chính sách', value: (row) => row.policy_target ?? '' },
  { id: 'disability_type', label: 'Khuyết tật', value: (row) => row.disability_type ?? '' },
  { id: 'can_swim', label: 'Biết bơi', value: (row) => yes(row.can_swim) },
  { id: 'national_id', label: 'Số định danh', value: (row) => row.national_id_masked },
  { id: 'org_unit', label: 'Đơn vị', value: (row) => row.org_unit_name },
];

// Cột mặc định của lưới (mục 4.1.1 và 4.1.4 của Sở) khi người xuất không gửi danh sách cột
export const DEFAULT_STUDENT_EXPORT_COLUMNS = [
  'moet_student_code',
  'full_name',
  'dob',
  'gender',
  'ethnicity',
  'status',
  'contact_phone',
  'grade',
  'class',
];
