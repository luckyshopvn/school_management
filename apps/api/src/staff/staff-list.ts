import type { ContractType, SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { isUuid } from '../common/request-fields.js';

// Danh sách cán bộ, giáo viên theo mục 3.1.1 và 3.1.4 của Sở (DT-15 phần 15d, YCTD-112): bộ lọc mở rộng (đơn vị, phòng
// ban, trạng thái, giới tính, mã định danh Bộ, số định danh cá nhân, Đảng viên, tuổi từ–đến, vị trí việc làm), sắp xếp
// A–Z theo tên rồi họ theo thứ tự tiếng Việt; dùng chung cho lưới và tệp Excel. Dân tộc, vị trí việc làm, nhóm chức vụ,
// hình thức hợp đồng, trình độ chuyên môn, Đảng viên lấy từ cột CSDL ngành (`moet_profile`, YCTD-100) vì hồ sơ chưa có cột
// riêng; vị trí việc làm trống thì lấy chức danh của trường
export const STAFF_STATUS_LABELS = { active: 'Đang làm việc', terminated: 'Đã nghỉ việc' } as const;
// Trạng thái xác thực số định danh với CSDLQG về dân cư, bản chạy nội bộ (mục 3.1.5, DT-16 phần 16f)
export const ID_VERIFICATION_LABELS = {
  unverified: 'Chưa xác thực',
  verified: 'Đã xác thực',
  invalid: 'Sai thông tin',
} as const;
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  probation: 'Thử việc',
  fixed_term: 'Có thời hạn',
  indefinite: 'Không thời hạn',
};
const ID_NUMBER_PATTERN = /^\d{12}$/;
const MAXIMUM_AGE = 100;

export interface StaffListFilter {
  orgUnitId?: string;
  departmentId?: string;
  status?: 'active' | 'terminated';
  q?: string;
  gender?: 'male' | 'female';
  moetCode?: string;
  idNumber?: string;
  partyMember?: boolean;
  ageFrom?: number;
  ageTo?: number;
  jobPosition?: string;
  // Xã đặc biệt khó khăn (lọc của mục 3.1.4, DT-16 phần 16f)
  specialDifficultyCommune?: boolean;
  // Trạng thái xác thực số định danh (mục 3.1.5, DT-16 phần 16f)
  idVerification?: 'unverified' | 'verified' | 'invalid';
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

function readAge(query: Record<string, unknown>, field: string, errors: FieldError[]): number | undefined {
  const value = query[field];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const age = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(age) || age < 0 || age > MAXIMUM_AGE) {
    errors.push({ field, message: `Tuổi từ 0 đến ${MAXIMUM_AGE}` });
    return undefined;
  }
  return age;
}

// Đọc bộ lọc từ chuỗi truy vấn (lưới) hoặc thân yêu cầu (xuất Excel)
export function readStaffListFilter(query: Record<string, unknown>, errors: FieldError[]): StaffListFilter {
  const uuid = (field: string) => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (!isUuid(value)) {
      errors.push({ field, message: 'Mã không hợp lệ' });
      return undefined;
    }
    return value;
  };
  const choice = <Value extends string>(field: string, values: readonly Value[], message: string) => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (!values.includes(value as Value)) {
      errors.push({ field, message });
      return undefined;
    }
    return value as Value;
  };
  const idNumber = readText(query, 'id_number', errors, 12);
  if (idNumber && !ID_NUMBER_PATTERN.test(idNumber)) {
    errors.push({ field: 'id_number', message: 'Số định danh cá nhân gồm mười hai chữ số' });
  }
  const flagOf = (field: string) => {
    const value = query[field];
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (!['true', 'false', true, false].includes(value as string)) {
      errors.push({ field, message: 'Chọn true hoặc false' });
      return undefined;
    }
    return value === 'true' || value === true;
  };
  const partyMember = flagOf('party_member');
  const ageFrom = readAge(query, 'age_from', errors);
  const ageTo = readAge(query, 'age_to', errors);
  if (ageFrom !== undefined && ageTo !== undefined && ageFrom > ageTo) {
    errors.push({ field: 'age_to', message: 'Tuổi đến phải từ tuổi từ trở lên' });
  }
  return {
    orgUnitId: uuid('org_unit_id'),
    departmentId: uuid('department_id'),
    status: choice('status', ['active', 'terminated'] as const, 'Trạng thái là active hoặc terminated'),
    q: readText(query, 'q', errors, 100),
    gender: choice('gender', ['male', 'female'] as const, 'Giới tính là male hoặc female'),
    moetCode: readText(query, 'moet_staff_code', errors, 50),
    idNumber: idNumber && ID_NUMBER_PATTERN.test(idNumber) ? idNumber : undefined,
    partyMember,
    ageFrom,
    ageTo,
    jobPosition: readText(query, 'job_position', errors, 100),
    specialDifficultyCommune: flagOf('special_difficulty_commune'),
    idVerification: choice(
      'id_verification',
      ['unverified', 'verified', 'invalid'] as const,
      'Trạng thái xác thực là unverified, verified hoặc invalid',
    ),
  };
}

const escapeLike = (value: string) => value.replace(/[%_\\]/g, '\\$&');
const profileText = (key: string) => sql<string | null>`staff.moet_profile->>${sql.lit(key)}`;
const PARTY_MEMBER = sql<boolean>`coalesce(staff.moet_profile->>'party_member' = 'true', false)`;
const JOB_POSITION = sql<string | null>`coalesce(nullif(staff.moet_profile->>'job_position', ''), job_titles.name)`;

// Phạm vi đơn vị đã kiểm ở tầng nghiệp vụ: toàn trường hoặc danh sách đơn vị; `matchedIds` là kết quả lọc số định danh
function filteredStaff(
  database: Kysely<SchoolYearDatabase>,
  orgUnitIds: string[] | null,
  filter: StaffListFilter,
  today: string,
  matchedIds: string[] | null,
) {
  let selection = database
    .selectFrom('staff')
    .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
    .leftJoin('departments', 'departments.id', 'staff.department_id')
    .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id');
  if (filter.orgUnitId) {
    selection = selection.where('staff.org_unit_id', '=', filter.orgUnitId);
  } else if (orgUnitIds) {
    selection = selection.where('staff.org_unit_id', 'in', orgUnitIds.length > 0 ? orgUnitIds : ['']);
  }
  if (filter.departmentId) {
    selection = selection.where('staff.department_id', '=', filter.departmentId);
  }
  if (filter.status) {
    selection = selection.where('staff.status', '=', filter.status);
  }
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    selection = selection.where((expression) =>
      expression.or([expression('staff.full_name', 'ilike', pattern), expression('staff.code', 'ilike', pattern)]),
    );
  }
  if (filter.gender) {
    selection = selection.where('staff.gender', '=', filter.gender);
  }
  if (filter.moetCode) {
    selection = selection.where('staff.moet_staff_code', 'ilike', `%${escapeLike(filter.moetCode)}%`);
  }
  if (matchedIds) {
    selection = selection.where(
      'staff.id',
      'in',
      matchedIds.length > 0 ? matchedIds : ['00000000-0000-0000-0000-000000000000'],
    );
  }
  if (filter.partyMember !== undefined) {
    selection = selection.where(filter.partyMember ? PARTY_MEMBER : sql<boolean>`not ${PARTY_MEMBER}`);
  }
  // Tuổi tròn tính đến hôm nay theo ngày sinh; hồ sơ chưa có ngày sinh không khớp bộ lọc tuổi
  const age = sql<number>`extract(year from age(${today}::date, staff.dob))`;
  if (filter.ageFrom !== undefined) {
    selection = selection.where(sql<boolean>`${age} >= ${filter.ageFrom}`);
  }
  if (filter.ageTo !== undefined) {
    selection = selection.where(sql<boolean>`${age} <= ${filter.ageTo}`);
  }
  if (filter.jobPosition) {
    selection = selection.where(JOB_POSITION, 'ilike', `%${escapeLike(filter.jobPosition)}%`);
  }
  if (filter.specialDifficultyCommune !== undefined) {
    selection = selection.where('staff.special_difficulty_commune', '=', filter.specialDifficultyCommune);
  }
  if (filter.idVerification) {
    selection = selection.where('staff.id_verification_status', '=', filter.idVerification);
  }
  return selection;
}

// Hồ sơ trong phạm vi có cùng bốn số cuối số định danh; tầng nghiệp vụ giải mã để so đủ mười hai số
export function idNumberCandidates(
  database: Kysely<SchoolYearDatabase>,
  orgUnitIds: string[] | null,
  filter: StaffListFilter,
  today: string,
  lastFour: string,
): Promise<Array<{ id: string; id_number_encrypted: string | null }>> {
  return filteredStaff(database, orgUnitIds, { orgUnitId: filter.orgUnitId }, today, null)
    .select(['staff.id', 'staff.id_number_encrypted'])
    .where('staff.id_number_last4', '=', lastFour)
    .execute();
}

// A–Z theo tên (từ cuối của họ tên) rồi theo họ tên, thứ tự chữ cái tiếng Việt, như danh sách học sinh (YCTD-108)
const GIVEN_NAME_ORDER = sql`regexp_replace(trim(staff.full_name), '^.*\\s', '') collate "vi-x-icu"`;
const FULL_NAME_ORDER = sql`staff.full_name collate "vi-x-icu"`;

export interface StaffRecord {
  id: string;
  org_unit_id: string;
  unit_name: string;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  status: 'active' | 'terminated';
  start_date: string;
  user_id: string | null;
  id_number_last4: string | null;
  moet_staff_code: string | null;
  department_name: string | null;
  job_title_name: string | null;
  ethnicity: string | null;
  job_position: string | null;
  position_group: string | null;
  contract_form: string | null;
  professional_qualification: string | null;
  party_member: boolean;
  special_difficulty_commune: boolean;
  id_verification_status: 'unverified' | 'verified' | 'invalid';
  bank_account_number: string | null;
  tax_code: string | null;
}

// Đếm và đọc một trang (hoặc tối đa `page.limit` dòng khi xuất) nhân sự theo bộ lọc
export async function findStaff(
  database: Kysely<SchoolYearDatabase>,
  orgUnitIds: string[] | null,
  filter: StaffListFilter,
  today: string,
  matchedIds: string[] | null,
  page: { limit: number; offset: number },
): Promise<{ total: number; rows: StaffRecord[] }> {
  const selection = filteredStaff(database, orgUnitIds, filter, today, matchedIds);
  const counted = await selection
    .select((expression) => expression.fn.countAll<string>().as('count'))
    .executeTakeFirstOrThrow();
  const rows = await selection
    .select([
      'staff.id',
      'staff.org_unit_id',
      'org_units.name as unit_name',
      'staff.code',
      'staff.full_name',
      'staff.dob',
      'staff.gender',
      'staff.phone',
      'staff.email',
      'staff.status',
      'staff.start_date',
      'staff.user_id',
      'staff.id_number_last4',
      'staff.moet_staff_code',
      'departments.name as department_name',
      'job_titles.name as job_title_name',
      profileText('ethnicity').as('ethnicity'),
      JOB_POSITION.as('job_position'),
      profileText('position_group').as('position_group'),
      profileText('contract_form').as('contract_form'),
      profileText('professional_qualification').as('professional_qualification'),
      PARTY_MEMBER.as('party_member'),
      'staff.special_difficulty_commune',
      'staff.id_verification_status',
      'staff.bank_account_number',
      'staff.tax_code',
    ])
    .orderBy(GIVEN_NAME_ORDER)
    .orderBy(FULL_NAME_ORDER)
    .orderBy('staff.id')
    .limit(page.limit)
    .offset(page.offset)
    .execute();
  return { total: Number(counted.count), rows: rows as StaffRecord[] };
}

// Dòng của lưới và tệp Excel; cột hợp đồng chỉ có giá trị với người xem được hợp đồng của đơn vị (BR-46)
export interface StaffRow {
  moet_staff_code: string | null;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  status: 'active' | 'terminated';
  ethnicity: string | null;
  phone: string | null;
  job_position: string | null;
  position_group: string | null;
  contract_form: string | null;
  professional_qualification: string | null;
  department_name: string | null;
  job_title_name: string | null;
  party_member: boolean;
  special_difficulty_commune: boolean;
  id_verification_status: 'unverified' | 'verified' | 'invalid';
  bank_account_number: string | null;
  tax_code: string | null;
  email: string | null;
  start_date: string;
  id_number_masked: string | null;
  has_account: boolean;
  unit_name: string;
  contract_no: string | null;
  contract_type: ContractType | null;
  contract_end_date: string | null;
  base_salary: number | null;
}

const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
const GENDER_LABELS = { male: 'Nam', female: 'Nữ' } as const;

export const STAFF_EXPORT_COLUMNS: Array<{
  id: string;
  label: string;
  contract?: boolean;
  value(row: StaffRow): string;
}> = [
  { id: 'moet_staff_code', label: 'Mã định danh Bộ GD&ĐT', value: (row) => row.moet_staff_code ?? '' },
  { id: 'code', label: 'Mã nhân sự', value: (row) => row.code },
  { id: 'full_name', label: 'Họ tên', value: (row) => row.full_name },
  { id: 'dob', label: 'Ngày sinh', value: (row) => formatDate(row.dob) },
  { id: 'gender', label: 'Giới tính', value: (row) => (row.gender ? GENDER_LABELS[row.gender] : '') },
  { id: 'status', label: 'Trạng thái', value: (row) => STAFF_STATUS_LABELS[row.status] },
  { id: 'ethnicity', label: 'Dân tộc', value: (row) => row.ethnicity ?? '' },
  { id: 'phone', label: 'Điện thoại', value: (row) => row.phone ?? '' },
  { id: 'job_position', label: 'Vị trí việc làm', value: (row) => row.job_position ?? '' },
  { id: 'position_group', label: 'Nhóm chức vụ', value: (row) => row.position_group ?? '' },
  { id: 'contract_form', label: 'Hình thức hợp đồng', value: (row) => row.contract_form ?? '' },
  {
    id: 'professional_qualification',
    label: 'Trình độ chuyên môn',
    value: (row) => row.professional_qualification ?? '',
  },
  { id: 'department', label: 'Phòng ban', value: (row) => row.department_name ?? '' },
  { id: 'job_title', label: 'Chức danh', value: (row) => row.job_title_name ?? '' },
  { id: 'party_member', label: 'Đảng viên', value: (row) => (row.party_member ? 'Có' : '') },
  { id: 'email', label: 'Email', value: (row) => row.email ?? '' },
  { id: 'start_date', label: 'Ngày vào làm', value: (row) => formatDate(row.start_date) },
  { id: 'id_number', label: 'Số định danh', value: (row) => row.id_number_masked ?? '' },
  { id: 'account', label: 'Tài khoản', value: (row) => (row.has_account ? 'Đã liên kết' : 'Chưa có') },
  { id: 'unit', label: 'Đơn vị', value: (row) => row.unit_name },
  {
    id: 'special_difficulty_commune',
    label: 'Xã ĐBKK',
    value: (row) => (row.special_difficulty_commune ? 'Có' : ''),
  },
  {
    id: 'id_verification',
    label: 'Xác thực số định danh',
    value: (row) => ID_VERIFICATION_LABELS[row.id_verification_status],
  },
  { id: 'bank_account', label: 'Tài khoản ngân hàng', value: (row) => row.bank_account_number ?? '' },
  { id: 'tax_code', label: 'Mã số thuế', value: (row) => row.tax_code ?? '' },
  { id: 'contract_no', label: 'Số hợp đồng', contract: true, value: (row) => row.contract_no ?? '' },
  {
    id: 'contract_end_date',
    label: 'Hợp đồng đến ngày',
    contract: true,
    value: (row) => formatDate(row.contract_end_date),
  },
  {
    id: 'base_salary',
    label: 'Lương thỏa thuận',
    contract: true,
    value: (row) => (row.base_salary === null ? '' : String(row.base_salary)),
  },
];

// Cột mặc định của lưới (mục 3.1.1 của Sở và mã nhân sự của trường) khi người xuất không gửi danh sách cột
export const DEFAULT_STAFF_EXPORT_COLUMNS = [
  'moet_staff_code',
  'code',
  'full_name',
  'dob',
  'gender',
  'status',
  'ethnicity',
  'phone',
  'job_position',
  'position_group',
  'contract_form',
  'professional_qualification',
];
