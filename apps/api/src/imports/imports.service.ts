import { Injectable } from '@nestjs/common';
import type { ImportType, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely, Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { IdentityClient } from '../authentication/identity-client.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { MAXIMUM_AMOUNT } from '../fees/fee-catalog-fields.js';
import { RegistrationPeriods } from '../fees/registration-periods.js';
import { FileStorage } from '../files/file-storage.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  buildErrorWorkbook,
  buildTemplate,
  findHeaderRowNumber,
  parseDate,
  readSheet,
  type ImportCatalog,
  type ImportColumn,
  type RowError,
  type SheetRow,
} from './excel.js';
import { MOET_CHILD_HEADERS, MOET_STAFF_HEADERS, MoetImports, type MoetPreview } from './moet-imports.js';
import {
  isStudentImportType,
  STUDENT_IMPORT_COLUMNS,
  STUDENT_IMPORT_LOCKED,
  STUDENT_IMPORT_PERMISSIONS,
  STUDENT_IMPORT_TITLES,
  STUDENT_IMPORT_TYPES,
  StudentImports,
  type StudentImportType,
} from './student-imports.js';

// Loại nhập theo mẫu của trường (có tệp mẫu); tệp CSDL ngành dùng mẫu của Bộ, không có tệp mẫu ở đây (YCTD-100)
export type TemplateImportType = Exclude<ImportType, 'moet_children' | 'moet_staff'>;
export type MoetImportType = 'moet_children' | 'moet_staff';

// Nhập dữ liệu ban đầu: lớp, trẻ kèm phụ huynh (P01-13), mã định danh ngành (P02-12) (YCTD-46) và công nợ đầu kỳ
// (P01-13, AC-184; YCTD-54)
export const IMPORT_COLUMNS: Record<TemplateImportType, ImportColumn[]> = {
  classes: [
    { key: 'unit_code', header: 'Mã đơn vị', note: 'Mã của Trường chính, Phân hiệu hoặc Điểm trường, bắt buộc' },
    { key: 'class_code', header: 'Mã lớp', note: 'Không trùng trong một đơn vị, bắt buộc' },
    { key: 'class_name', header: 'Tên lớp', note: 'Bắt buộc' },
    { key: 'grade_level', header: 'Mã bậc học', note: 'Mã trong danh mục bậc học đang dùng, bắt buộc' },
    { key: 'max_size', header: 'Sĩ số tối đa', note: 'Số nguyên từ 1 đến 200, bắt buộc' },
    { key: 'room_code', header: 'Mã phòng', note: 'Mã phòng học đang dùng của cùng đơn vị, để trống nếu chưa có' },
  ],
  children: [
    { key: 'unit_code', header: 'Mã đơn vị', note: 'Mã đơn vị của lớp, bắt buộc' },
    { key: 'class_code', header: 'Mã lớp', note: 'Lớp đang dùng của đơn vị, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Tối đa 100 ký tự, bắt buộc' },
    { key: 'dob', header: 'Ngày sinh', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY, bắt buộc' },
    { key: 'gender', header: 'Giới tính', note: 'Nam hoặc Nữ, bắt buộc' },
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số, không trùng, bắt buộc' },
    { key: 'moet_code', header: 'Mã định danh ngành', note: 'Để trống nếu chưa có' },
    { key: 'place_of_birth', header: 'Nơi sinh', note: 'Không bắt buộc' },
    { key: 'address', header: 'Địa chỉ', note: 'Không bắt buộc' },
    {
      key: 'allergies',
      header: 'Dị ứng',
      note: 'Ghi "Không" nếu không có dị ứng, hoặc ghi dị ứng gì; bắt buộc (BR-06)',
    },
    { key: 'chronic_conditions', header: 'Bệnh nền', note: 'Không bắt buộc' },
    { key: 'enroll_date', header: 'Ngày vào lớp', note: 'Để trống là ngày nhập' },
    { key: 'guardian1_name', header: 'Họ tên phụ huynh 1', note: 'Bắt buộc; phụ huynh 1 là liên hệ chính' },
    {
      key: 'guardian1_relationship',
      header: 'Quan hệ phụ huynh 1',
      note: 'Tên hoặc mã trong danh mục Quan hệ với trẻ, bắt buộc',
    },
    { key: 'guardian1_phone', header: 'Số điện thoại phụ huynh 1', note: '10 chữ số bắt đầu bằng 0' },
    { key: 'guardian2_name', header: 'Họ tên phụ huynh 2', note: 'Không bắt buộc' },
    { key: 'guardian2_relationship', header: 'Quan hệ phụ huynh 2', note: 'Bắt buộc khi có phụ huynh 2' },
    { key: 'guardian2_phone', header: 'Số điện thoại phụ huynh 2', note: '10 chữ số bắt đầu bằng 0' },
  ],
  moet_codes: [
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số, bắt buộc' },
    { key: 'moet_code', header: 'Mã định danh ngành', note: 'Mã do cơ sở dữ liệu ngành cấp, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Để đối chiếu, không bắt buộc' },
  ],
  staff: [
    { key: 'unit_code', header: 'Mã đơn vị', note: 'Mã đơn vị chính của nhân sự, bắt buộc' },
    { key: 'code', header: 'Mã nhân sự', note: 'Không trùng, bắt buộc' },
    { key: 'full_name', header: 'Họ tên', note: 'Bắt buộc' },
    { key: 'dob', header: 'Ngày sinh', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY' },
    { key: 'gender', header: 'Giới tính', note: 'Nam hoặc Nữ' },
    { key: 'phone', header: 'Số điện thoại', note: '10 chữ số bắt đầu bằng 0' },
    { key: 'email', header: 'Thư điện tử', note: 'Không bắt buộc' },
    { key: 'id_number', header: 'Số định danh cá nhân', note: 'Mười hai chữ số, không bắt buộc' },
    { key: 'department', header: 'Phòng ban', note: 'Tên phòng ban đang dùng của đơn vị, không bắt buộc' },
    { key: 'job_title', header: 'Chức danh', note: 'Tên chức danh đang dùng của đơn vị, không bắt buộc' },
    { key: 'start_date', header: 'Ngày vào làm', note: 'Bắt buộc' },
  ],
  opening_debts: [
    { key: 'national_id', header: 'Số định danh cá nhân', note: 'Mười hai chữ số của trẻ đã có, bắt buộc' },
    { key: 'full_name', header: 'Họ tên trẻ', note: 'Để đối chiếu; ghi thì phải khớp hồ sơ' },
    { key: 'amount', header: 'Số tiền', note: 'Số nguyên đồng lớn hơn 0, bắt buộc' },
    { key: 'due_date', header: 'Ngày đến hạn', note: 'Dạng ngày của Excel, YYYY-MM-DD hoặc DD/MM/YYYY, bắt buộc' },
    { key: 'note', header: 'Ghi chú', note: 'Không bắt buộc, tối đa 500 ký tự' },
  ],
  // Điện thoại nhận tin, số định danh, địa chỉ mới của học sinh (DT-16 phần 16g)
  ...STUDENT_IMPORT_COLUMNS,
};

const TEMPLATE_TITLES: Record<TemplateImportType, string> = {
  classes: 'Lớp học',
  children: 'Trẻ và phụ huynh',
  moet_codes: 'Mã định danh ngành',
  opening_debts: 'Công nợ đầu kỳ',
  staff: 'Nhân sự',
  ...STUDENT_IMPORT_TITLES,
};

// Công cụ nhập dùng chung (DT-16 phần 16a, khảo sát mục 2.3 của Sở: tải file mẫu kèm dữ liệu, tra cứu danh mục, chọn cột để
// nhập, xuất file lỗi). Cột khóa và cột bắt buộc luôn nhập; cột khác người dùng chọn có nhập hay không, cột không chọn coi
// như để trống. Lớp học khớp theo mã đơn vị và mã lớp: dòng của lớp đã có thì cập nhật các cột được chọn, dòng mới thì thêm
export const IMPORT_TOOLS_RULE_CODE = 'YCTD-121';
export const LOCKED_IMPORT_COLUMNS: Record<TemplateImportType, string[]> = {
  classes: ['unit_code', 'class_code'],
  children: [
    'unit_code',
    'class_code',
    'full_name',
    'dob',
    'gender',
    'national_id',
    'allergies',
    'guardian1_name',
    'guardian1_relationship',
  ],
  moet_codes: ['national_id', 'moet_code'],
  staff: ['unit_code', 'code', 'full_name', 'start_date'],
  opening_debts: ['national_id', 'amount', 'due_date'],
  ...STUDENT_IMPORT_LOCKED,
};
// Loại nhập cập nhật được bản ghi đã có và có "Tải file mẫu kèm dữ liệu"
export const UPDATING_IMPORT_TYPES: TemplateImportType[] = ['classes', ...STUDENT_IMPORT_TYPES];
// Cột phải chọn khi thêm lớp mới
const CLASS_CREATE_COLUMNS: Array<[string, string]> = [
  ['class_name', 'Tên lớp'],
  ['grade_level', 'Mã bậc học'],
  ['max_size', 'Sĩ số tối đa'],
];

export interface ImportColumnInfo {
  key: string;
  header: string;
  note: string;
  locked: boolean;
}

// Quyền nhập theo loại, như máy chủ kiểm tra ở bộ điều khiển
function permissionOfImport(type: TemplateImportType): string {
  if (isStudentImportType(type)) {
    return STUDENT_IMPORT_PERMISSIONS[type];
  }
  return type === 'moet_codes'
    ? PERMISSION_CODES.childManage
    : type === 'opening_debts'
      ? PERMISSION_CODES.openingDebtImport
      : type === 'staff'
        ? PERMISSION_CODES.importStaff
        : PERMISSION_CODES.importChildren;
}

const PHONE_PATTERN = /^0\d{9}$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

interface ClassRow {
  org_unit_id: string;
  code: string;
  name: string;
  grade_level: string;
  max_size: number;
  room_id: string | null;
}

// Dòng của lớp đã có: cập nhật các cột được chọn
interface ClassUpdate {
  id: string;
  org_unit_id: string;
  changes: Partial<Pick<ClassRow, 'name' | 'max_size' | 'room_id'>>;
}

interface ChildRow {
  org_unit_id: string;
  class_id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  national_id: string;
  moet_student_code: string | null;
  place_of_birth: string | null;
  address: string | null;
  has_allergies: boolean;
  allergies: string | null;
  chronic_conditions: string | null;
  enroll_date: string;
  guardians: Array<{ full_name: string; phone: string | null; relationship_item_id: string }>;
}

interface StaffRow {
  org_unit_id: string;
  code: string;
  full_name: string;
  dob: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  department_id: string | null;
  job_title_id: string | null;
  start_date: string;
}

interface OpeningDebtRow {
  child_id: string;
  org_unit_id: string;
  amount: number;
  due_date: string;
  note: string | null;
}

type UploadType = 'classes' | 'children' | 'opening_debts' | 'staff' | MoetImportType | StudentImportType;
type TemplateUploadType = Exclude<UploadType, MoetImportType | StudentImportType>;

const isMoetType = (type: string): type is MoetImportType => type === 'moet_children' || type === 'moet_staff';

function selectedColumnsOf(preview: unknown): string[] | null {
  const value = (preview as { selected_columns?: unknown } | null)?.selected_columns;
  return Array.isArray(value) ? (value as string[]) : null;
}

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Tệp xls bắt đầu bằng chữ ký OLE2 D0 CF
const contentTypeOf = (body: Buffer) =>
  body[0] === 0xd0 && body[1] === 0xcf ? 'application/vnd.ms-excel' : XLSX_CONTENT_TYPE;

export interface ImportJobView {
  id: string;
  import_type: ImportType;
  org_unit_id: string | null;
  preview: MoetPreview | null;
  // Cột được chọn để nhập; null là mọi cột (DT-16 phần 16a)
  selected_columns: string[] | null;
  status: 'validated' | 'failed' | 'committed';
  total_rows: number;
  error_rows: number;
  errors: RowError[];
  created_at: Date;
  committed_at: Date | null;
}

type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

@Injectable()
export class ImportsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly fileStorage: FileStorage,
    private readonly protection: ChildDataProtection,
    private readonly identityClient: IdentityClient,
    private readonly periods: RegistrationPeriods,
    private readonly clock: Clock,
    private readonly moet: MoetImports,
    private readonly studentImports: StudentImports,
  ) {}

  // Tệp mẫu có trang Danh mục; kèm dữ liệu thì điền các bản ghi đang có trong phạm vi người tải để sửa rồi nhập lại
  // Tệp kèm dữ liệu là một lần xuất dữ liệu nên ghi nhật ký xuất (BR-74)
  async template(
    currentUser: CurrentUser,
    type: TemplateImportType,
    withData: boolean,
    ipAddress: string | null = null,
  ): Promise<Buffer> {
    const { database } = await this.currentSchoolYear.require();
    if (withData && !UPDATING_IMPORT_TYPES.includes(type)) {
      throw ruleViolationError(IMPORT_TOOLS_RULE_CODE, 'Loại dữ liệu này chưa có tệp mẫu kèm dữ liệu');
    }
    const catalogs = await this.catalogs(currentUser, type);
    const rows = withData ? await this.templateRows(database, currentUser, type) : undefined;
    const buffer = await buildTemplate(TEMPLATE_TITLES[type], IMPORT_COLUMNS[type], { rows, catalogs });
    if (rows) {
      await database
        .insertInto('export_logs')
        .values({
          user_id: currentUser.id,
          actor_name: currentUser.description.full_name,
          report_code: `import-template-${type}`,
          filters_data: JSON.stringify({ with_data: true }),
          org_unit_ids: [],
          row_count: rows.length,
          contains_personal_data: false,
          file_name: `mau-nhap-${type}-kem-du-lieu.xlsx`,
          ip_address: ipAddress,
        })
        .execute();
    }
    return buffer;
  }

  // Cột của mẫu kèm cờ cột khóa, bắt buộc (luôn nhập) để màn hình cho chọn cột
  columns(type: TemplateImportType) {
    return {
      columns: IMPORT_COLUMNS[type].map((column): ImportColumnInfo => ({
        ...column,
        locked: LOCKED_IMPORT_COLUMNS[type].includes(column.key),
      })),
      updates_existing: UPDATING_IMPORT_TYPES.includes(type),
      template_with_data: UPDATING_IMPORT_TYPES.includes(type),
    };
  }

  // Cột được chọn để nhập; bỏ trống là mọi cột. Cột khóa, bắt buộc luôn được thêm vào
  selection(type: TemplateImportType, keys: string[] | undefined): Set<string> {
    const all = IMPORT_COLUMNS[type].map((column) => column.key);
    if (!keys) {
      return new Set(all);
    }
    const unknown = keys.filter((key) => !all.includes(key));
    if (unknown.length > 0) {
      throw validationError([{ field: 'columns', message: `Cột không có trong mẫu: ${unknown.join(', ')}` }]);
    }
    return new Set([...LOCKED_IMPORT_COLUMNS[type], ...keys]);
  }

  // "Tra cứu danh mục": mã, tên của các danh mục dùng trong tệp, trong phạm vi của người nhập
  async catalogs(currentUser: CurrentUser, type: TemplateImportType): Promise<ImportCatalog[]> {
    const { database } = await this.currentSchoolYear.require();
    if (isStudentImportType(type)) {
      return this.studentImports.catalogs(database, currentUser, type);
    }
    const scope = await this.organizationScopes.resolve(currentUser, permissionOfImport(type));
    const units = (
      await database
        .selectFrom('org_units')
        .select(['id', 'code', 'name'])
        .where('status', '=', 'active')
        .orderBy('code')
        .execute()
    ).filter((unit) => scope.wholeSchool || scope.orgUnitIds.includes(unit.id));
    const unitIds = units.map((unit) => unit.id);
    const unitCode = new Map(units.map((unit) => [unit.id, unit.code]));
    const inUnit = (orgUnitId: string) => `Đơn vị ${unitCode.get(orgUnitId) ?? ''}`;
    const unitCatalog: ImportCatalog = {
      key: 'org_units',
      title: 'Đơn vị',
      column: 'Mã đơn vị',
      items: units.map((unit) => ({ code: unit.code, name: unit.name })),
    };
    if (type === 'classes') {
      const gradeLevels = await database
        .selectFrom('grade_levels')
        .select(['code', 'name'])
        .where('status', '=', 'active')
        .orderBy('code')
        .execute();
      const rooms =
        unitIds.length === 0
          ? []
          : await database
              .selectFrom('rooms')
              .select(['code', 'name', 'org_unit_id'])
              .where('status', '=', 'active')
              .where('org_unit_id', 'in', unitIds)
              .orderBy('code')
              .execute();
      return [
        unitCatalog,
        { key: 'grade_levels', title: 'Bậc học', column: 'Mã bậc học', items: gradeLevels },
        {
          key: 'rooms',
          title: 'Phòng học',
          column: 'Mã phòng',
          items: rooms.map((room) => ({ code: room.code, name: room.name, note: inUnit(room.org_unit_id) })),
        },
      ];
    }
    if (type === 'children') {
      const classes =
        unitIds.length === 0
          ? []
          : await database
              .selectFrom('classes')
              .select(['code', 'name', 'org_unit_id'])
              .where('status', '=', 'active')
              .where('org_unit_id', 'in', unitIds)
              .orderBy('code')
              .execute();
      const relationships = await database
        .selectFrom('catalog_items')
        .select(['code', 'name'])
        .where('catalog_type', '=', 'parent_relationship')
        .where('status', '=', 'active')
        .orderBy('code')
        .execute();
      return [
        unitCatalog,
        {
          key: 'classes',
          title: 'Lớp học',
          column: 'Mã lớp',
          items: classes.map((row) => ({ code: row.code, name: row.name, note: inUnit(row.org_unit_id) })),
        },
        {
          key: 'parent_relationships',
          title: 'Quan hệ với trẻ',
          column: 'Quan hệ phụ huynh 1, 2',
          items: relationships,
        },
      ];
    }
    if (type === 'staff') {
      const named = async (table: 'departments' | 'job_titles') =>
        unitIds.length === 0
          ? []
          : (
              await database
                .selectFrom(table)
                .select(['name', 'org_unit_id'])
                .where('status', '=', 'active')
                .where('org_unit_id', 'in', unitIds)
                .orderBy('name')
                .execute()
            ).map((row) => ({
              code: unitCode.get(row.org_unit_id) ?? '',
              name: row.name,
              note: 'Ghi tên; mã là mã đơn vị',
            }));
      return [
        unitCatalog,
        { key: 'departments', title: 'Phòng ban', column: 'Phòng ban', items: await named('departments') },
        { key: 'job_titles', title: 'Chức danh', column: 'Chức danh', items: await named('job_titles') },
      ];
    }
    return [];
  }

  // Dữ liệu điền sẵn của "Tải file mẫu kèm dữ liệu": lớp đang dùng trong phạm vi của người tải
  private async templateRows(
    database: Executor,
    currentUser: CurrentUser,
    type: TemplateImportType,
  ): Promise<Array<Record<string, unknown>>> {
    if (isStudentImportType(type)) {
      return this.studentImports.templateRows(database, currentUser, type);
    }
    if (type !== 'classes') {
      return [];
    }
    const scope = await this.organizationScopes.resolve(currentUser, permissionOfImport(type));
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    let query = database
      .selectFrom('classes')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .leftJoin('rooms', 'rooms.id', 'classes.room_id')
      .select([
        'org_units.code as unit_code',
        'classes.code as class_code',
        'classes.name as class_name',
        'classes.grade_level',
        'classes.max_size',
        'rooms.code as room_code',
      ])
      .where('classes.status', '=', 'active')
      .orderBy('org_units.code')
      .orderBy('classes.code');
    if (!scope.wholeSchool) {
      query = query.where('classes.org_unit_id', 'in', scope.orgUnitIds);
    }
    return query.execute();
  }

  // "Xuất file lỗi": tệp gốc của lần nhập kèm cột Nội dung lỗi theo từng dòng
  async errorFile(jobId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const { database } = await this.currentSchoolYear.require();
    const job = await database
      .selectFrom('data_import_jobs')
      .innerJoin('files', 'files.id', 'data_import_jobs.file_id')
      .select(['data_import_jobs.import_type', 'data_import_jobs.errors', 'files.storage_key', 'files.file_name'])
      .where('data_import_jobs.id', '=', jobId)
      .executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    const errors = job.errors as RowError[];
    if (errors.length === 0) {
      throw ruleViolationError(IMPORT_TOOLS_RULE_CODE, 'Lần nhập này không có dòng lỗi');
    }
    const body = await this.fileStorage.get(job.storage_key);
    const headerRow =
      job.import_type === 'moet_children'
        ? findHeaderRowNumber(body, MOET_CHILD_HEADERS)
        : job.import_type === 'moet_staff'
          ? findHeaderRowNumber(body, MOET_STAFF_HEADERS)
          : 1;
    const baseName = job.file_name.replace(/\.(xlsx|xls)$/i, '');
    return { buffer: buildErrorWorkbook(body, errors, headerRow), fileName: `${baseName}-loi.xlsx` };
  }

  // Tải tệp lên và kiểm tra toàn bộ; lưu tệp gốc ở kho tệp để ghi lại khi không còn dòng lỗi (P01-13)
  async upload(
    currentUser: CurrentUser,
    type: UploadType,
    fileName: string,
    body: Buffer,
    origin: ChangeOrigin,
    orgUnitId: string | null = null,
    selectedKeys?: string[],
  ): Promise<ImportJobView> {
    const { database } = await this.currentSchoolYear.require();
    let errors: RowError[];
    let totalRows: number;
    let preview: MoetPreview | { selected_columns: string[] } | null = null;
    if (isMoetType(type)) {
      ({ errors, totalRows, preview } = await this.validateMoet(database, currentUser, type, orgUnitId ?? '', body));
    } else {
      // Cột được chọn lưu kèm lần nhập để bước ghi đọc tệp đúng như lúc kiểm tra (DT-16 phần 16a)
      const selected = this.selection(type, selectedKeys);
      const rows = await readSheet(body, IMPORT_COLUMNS[type], selectedKeys ? selected : undefined);
      errors = isStudentImportType(type)
        ? (await this.studentImports.validate(database, currentUser, type, rows, selected)).errors
        : (await this.validate(database, currentUser, type, rows, selected)).errors;
      totalRows = rows.length;
      preview = selectedKeys ? { selected_columns: [...selected] } : null;
    }
    const storageKey = `import/${randomUUID()}`;
    const contentType = contentTypeOf(body);
    await this.fileStorage.put(storageKey, body, contentType);
    return database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: null,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: contentType,
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const job = await transaction
        .insertInto('data_import_jobs')
        .values({
          import_type: type,
          org_unit_id: isMoetType(type) ? orgUnitId : null,
          preview: preview ? JSON.stringify(preview) : null,
          file_id: file.id,
          status: errors.length > 0 ? 'failed' : 'validated',
          total_rows: totalRows,
          error_rows: new Set(errors.map((error) => error.row)).size,
          errors: JSON.stringify(errors),
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return this.readJob(transaction, job.id);
    });
  }

  async get(jobId: string): Promise<ImportJobView> {
    const { database } = await this.currentSchoolYear.require();
    return this.readJob(database, jobId);
  }

  // Kiểm tra lại toàn bộ rồi mới ghi; còn dòng lỗi thì không ghi dòng nào (AC-183)
  async commit(
    currentUser: CurrentUser,
    accessToken: string,
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const { database, academicYearId } = await this.currentSchoolYear.require();
    const job = await database
      .selectFrom('data_import_jobs')
      .innerJoin('files', 'files.id', 'data_import_jobs.file_id')
      .select([
        'data_import_jobs.id',
        'data_import_jobs.import_type',
        'data_import_jobs.org_unit_id',
        'data_import_jobs.status',
        'data_import_jobs.preview',
        'files.storage_key',
      ])
      .where('data_import_jobs.id', '=', jobId)
      .executeTakeFirst();
    if (!job || job.import_type === 'moet_codes') {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    if (job.status !== 'validated') {
      throw ruleViolationError(
        'P01-13',
        job.status === 'committed' ? 'Lần nhập này đã ghi dữ liệu' : 'Tệp còn dòng lỗi; sửa tệp và tải lên lại',
      );
    }
    const type = job.import_type;
    if (isMoetType(type)) {
      return this.commitMoet(database, currentUser, accessToken, type, job, origin);
    }
    const selectedKeys = selectedColumnsOf(job.preview);
    const selected = this.selection(type, selectedKeys ?? undefined);
    const rows = await readSheet(
      await this.fileStorage.get(job.storage_key),
      IMPORT_COLUMNS[type],
      selectedKeys ? selected : undefined,
    );
    if (isStudentImportType(type)) {
      return this.commitStudentImport(database, currentUser, type, rows, selected, jobId, origin);
    }
    const validated = await this.validate(database, currentUser, type, rows, selected);
    if (validated.errors.length > 0) {
      await database
        .updateTable('data_import_jobs')
        .set({
          status: 'failed',
          errors: JSON.stringify(validated.errors),
          error_rows: new Set(validated.errors.map((error) => error.row)).size,
        })
        .where('id', '=', jobId)
        .execute();
      throw ruleViolationError('P01-13', 'Dữ liệu đã thay đổi từ lúc kiểm tra; tệp còn dòng lỗi, không ghi dòng nào');
    }

    // Tài khoản phụ huynh tạo trước khi ghi; gọi lại với cùng số điện thoại không tạo trùng
    const accounts = new Map<string, { userId: string; created: boolean }>();
    if (type === 'opening_debts') {
      return this.commitOpeningDebts(database, validated.openingDebts, jobId, origin);
    }
    if (type === 'staff') {
      return this.commitStaff(database, validated.staff, jobId, origin);
    }
    if (type === 'children') {
      for (const row of validated.children) {
        for (const guardian of row.guardians) {
          if (guardian.phone && !accounts.has(guardian.phone)) {
            const account = await this.identityClient.ensureGuardianAccount(accessToken, {
              phone: guardian.phone,
              full_name: guardian.full_name,
              org_unit_id: row.org_unit_id,
            });
            accounts.set(guardian.phone, { userId: account.user_id, created: account.created });
          }
        }
      }
    }

    return database.transaction().execute(async (transaction) => {
      if (type === 'classes') {
        for (const row of validated.classes) {
          const created = await transaction
            .insertInto('classes')
            .values({ ...row, academic_year_id: academicYearId, created_by: origin.actorUserId })
            .returning(['id', 'org_unit_id', 'code', 'name', 'grade_level', 'room_id', 'max_size'])
            .executeTakeFirstOrThrow();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: created.org_unit_id,
            entityName: 'classes',
            entityId: created.id,
            action: 'create',
            before: null,
            after: { ...created, import_job_id: jobId },
          });
        }
        // Lớp đã có: cập nhật các cột được chọn (DT-16 phần 16a)
        for (const update of validated.classUpdates) {
          const before = await transaction
            .selectFrom('classes')
            .select(['id', 'org_unit_id', 'code', 'name', 'grade_level', 'room_id', 'max_size'])
            .where('id', '=', update.id)
            .executeTakeFirstOrThrow();
          const updated = await transaction
            .updateTable('classes')
            .set({ ...update.changes, updated_at: this.clock.now() })
            .where('id', '=', update.id)
            .returning(['id', 'org_unit_id', 'code', 'name', 'grade_level', 'room_id', 'max_size'])
            .executeTakeFirstOrThrow();
          await writeAuditLog(transaction, {
            origin,
            orgUnitId: update.org_unit_id,
            entityName: 'classes',
            entityId: update.id,
            action: 'update',
            before,
            after: { ...updated, import_job_id: jobId },
          });
        }
      } else {
        for (const row of validated.children) {
          await this.insertImportedChild(transaction, row, accounts, origin, jobId);
        }
        await queueNotification(transaction, {
          orgUnitId: null,
          templateCode: 'guardian_account_created',
          title: 'Tài khoản phụ huynh đã được tạo',
          body: 'Tài khoản ứng dụng phụ huynh đã được tạo, đăng nhập bằng mật khẩu mặc định nhà trường cung cấp',
          targetType: 'data_import_jobs',
          targetId: jobId,
          recipients: [...accounts.values()]
            .filter((account) => account.created)
            .map((account) => ({ userId: account.userId, channel: 'sms' as const })),
        });
      }
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  // Điện thoại nhận tin, số định danh, địa chỉ mới của học sinh (DT-16 phần 16g): kiểm tra lại rồi mới ghi
  private async commitStudentImport(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    type: StudentImportType,
    rows: SheetRow[],
    selected: Set<string>,
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const validated = await this.studentImports.validate(database, currentUser, type, rows, selected);
    if (validated.errors.length > 0) {
      await database
        .updateTable('data_import_jobs')
        .set({
          status: 'failed',
          errors: JSON.stringify(validated.errors),
          error_rows: new Set(validated.errors.map((error) => error.row)).size,
        })
        .where('id', '=', jobId)
        .execute();
      throw ruleViolationError('P01-13', 'Dữ liệu đã thay đổi từ lúc kiểm tra; tệp còn dòng lỗi, không ghi dòng nào');
    }
    return database.transaction().execute(async (transaction) => {
      await this.studentImports.apply(transaction, validated.changes, jobId, origin);
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  // Nhập mã ngành: dòng khớp số định danh được gán ngay; dòng không khớp hoặc trùng mã được báo (P02-12, AC-202)
  async importMoetCodes(
    currentUser: CurrentUser,
    fileName: string,
    body: Buffer,
    origin: ChangeOrigin,
    selectedKeys?: string[],
  ) {
    const { database } = await this.currentSchoolYear.require();
    const selected = this.selection('moet_codes', selectedKeys);
    const rows = await readSheet(body, IMPORT_COLUMNS.moet_codes, selectedKeys ? selected : undefined);
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.childManage);
    const errors: RowError[] = [];
    const codesInFile = new Map<string, number>();
    for (const { row, values } of rows) {
      if (values.moet_code) {
        codesInFile.set(values.moet_code, (codesInFile.get(values.moet_code) ?? 0) + 1);
      }
      if (!NATIONAL_ID_PATTERN.test(values.national_id ?? '')) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Số định danh cá nhân gồm mười hai chữ số' });
      }
      if (!values.moet_code) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Bắt buộc nhập' });
      }
    }
    const assignments: Array<{ childId: string; orgUnitId: string; code: string; before: string | null }> = [];
    for (const { row, values } of rows) {
      if (errors.some((error) => error.row === row)) {
        continue;
      }
      const code = values.moet_code ?? '';
      if ((codesInFile.get(code) ?? 0) > 1) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Mã này xuất hiện nhiều lần trong tệp' });
        continue;
      }
      const child = await database
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'moet_student_code'])
        .where('national_id_hash', '=', this.protection.hash(values.national_id ?? ''))
        .executeTakeFirst();
      if (!child || (!scope.wholeSchool && !scope.orgUnitIds.includes(child.org_unit_id))) {
        errors.push({
          row,
          column: 'Số định danh cá nhân',
          message: 'Không có trẻ nào khớp số định danh này trong phạm vi của bạn',
        });
        continue;
      }
      const owner = await database
        .selectFrom('children')
        .select('id')
        .where('moet_student_code', '=', code)
        .where('id', '!=', child.id)
        .executeTakeFirst();
      if (owner) {
        errors.push({ row, column: 'Mã định danh ngành', message: 'Mã đã gán cho trẻ khác' });
        continue;
      }
      assignments.push({ childId: child.id, orgUnitId: child.org_unit_id, code, before: child.moet_student_code });
    }
    return database.transaction().execute(async (transaction) => {
      for (const assignment of assignments) {
        await transaction
          .updateTable('children')
          .set({ moet_student_code: assignment.code, updated_at: this.clock.now() })
          .where('id', '=', assignment.childId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: assignment.orgUnitId,
          entityName: 'children',
          entityId: assignment.childId,
          action: 'update',
          before: { moet_student_code: assignment.before },
          after: { moet_student_code: assignment.code },
        });
      }
      const storageKey = `import/${randomUUID()}`;
      await this.fileStorage.put(storageKey, body, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: null,
          purpose: 'import',
          file_name: fileName.slice(0, 200),
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const job = await transaction
        .insertInto('data_import_jobs')
        .values({
          import_type: 'moet_codes',
          file_id: file.id,
          status: 'committed',
          total_rows: rows.length,
          error_rows: new Set(errors.map((error) => error.row)).size,
          errors: JSON.stringify(errors),
          created_by: origin.actorUserId,
          committed_by: origin.actorUserId,
          committed_at: this.clock.now(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { ...(await this.readJob(transaction, job.id)), assigned_rows: assignments.length };
    });
  }

  private async readJob(database: Executor, jobId: string): Promise<ImportJobView> {
    const job = await database
      .selectFrom('data_import_jobs')
      .select([
        'id',
        'import_type',
        'org_unit_id',
        'status',
        'total_rows',
        'error_rows',
        'errors',
        'preview',
        'created_at',
        'committed_at',
      ])
      .where('id', '=', jobId)
      .executeTakeFirst();
    if (!job) {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    // Lần nhập theo mẫu của trường dùng cột preview để lưu cột được chọn; lần nhập tệp CSDL ngành lưu bản xem trước
    const moet = isMoetType(job.import_type);
    return {
      ...job,
      errors: job.errors as RowError[],
      preview: moet ? ((job.preview ?? null) as MoetPreview | null) : null,
      selected_columns: moet ? null : selectedColumnsOf(job.preview),
    };
  }

  private validateMoet(
    database: Executor,
    currentUser: CurrentUser,
    type: MoetImportType,
    orgUnitId: string,
    body: Buffer,
  ) {
    return type === 'moet_children'
      ? this.moet.validateChildren(database, currentUser, orgUnitId, body)
      : this.moet.validateStaff(database, currentUser, orgUnitId, body);
  }

  // Tệp CSDL ngành: kiểm tra lại theo đơn vị đã chọn lúc tải lên rồi mới ghi; còn dòng lỗi thì không ghi dòng nào
  private async commitMoet(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    accessToken: string,
    type: MoetImportType,
    job: { id: string; org_unit_id: string | null; storage_key: string },
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const body = await this.fileStorage.get(job.storage_key);
    const orgUnitId = job.org_unit_id ?? '';
    const children =
      type === 'moet_children' ? await this.moet.validateChildren(database, currentUser, orgUnitId, body) : null;
    const staff = type === 'moet_staff' ? await this.moet.validateStaff(database, currentUser, orgUnitId, body) : null;
    const validated = children ?? staff;
    if (!validated) {
      throw notFoundError('Không tìm thấy lần nhập', 'data_import_job');
    }
    if (validated.errors.length > 0) {
      await database
        .updateTable('data_import_jobs')
        .set({
          status: 'failed',
          errors: JSON.stringify(validated.errors),
          error_rows: new Set(validated.errors.map((error) => error.row)).size,
          preview: JSON.stringify(validated.preview),
        })
        .where('id', '=', job.id)
        .execute();
      throw ruleViolationError('P01-13', 'Dữ liệu đã thay đổi từ lúc kiểm tra; tệp còn dòng lỗi, không ghi dòng nào');
    }
    await database
      .updateTable('data_import_jobs')
      .set({ preview: JSON.stringify(validated.preview) })
      .where('id', '=', job.id)
      .execute();
    if (children) {
      await this.moet.commitChildren(database, accessToken, children.plans, job.id, origin);
    } else if (staff) {
      await this.moet.commitStaff(database, staff.plans, job.id, origin);
    }
    return this.readJob(database, job.id);
  }

  private async validate(
    database: Executor,
    currentUser: CurrentUser,
    type: TemplateUploadType,
    rows: SheetRow[],
    selected: Set<string>,
  ): Promise<{
    errors: RowError[];
    classes: ClassRow[];
    classUpdates: ClassUpdate[];
    children: ChildRow[];
    openingDebts: OpeningDebtRow[];
    staff: StaffRow[];
  }> {
    if (type === 'opening_debts') {
      const errors: RowError[] = [];
      const openingDebts = await this.validateOpeningDebts(database, currentUser, rows, errors);
      return { errors, classes: [], classUpdates: [], children: [], openingDebts, staff: [] };
    }
    if (type === 'staff') {
      const errors: RowError[] = [];
      const staff = await this.validateStaff(database, currentUser, rows, errors);
      return { errors, classes: [], classUpdates: [], children: [], openingDebts: [], staff };
    }
    const units = await database.selectFrom('org_units').select(['id', 'code', 'status']).execute();
    const scope = await this.organizationScopes.resolve(currentUser, PERMISSION_CODES.importChildren);
    const errors: RowError[] = [];
    const resolveUnit = (row: number, code: string | undefined) => {
      const unit = units.find((item) => item.code === code);
      if (!unit || unit.status !== 'active') {
        errors.push({ row, column: 'Mã đơn vị', message: 'Không có đơn vị đang dùng với mã này' });
        return undefined;
      }
      if (!scope.wholeSchool && !scope.orgUnitIds.includes(unit.id)) {
        errors.push({ row, column: 'Mã đơn vị', message: 'Đơn vị này nằm ngoài phạm vi của bạn' });
        return undefined;
      }
      return unit.id;
    };
    if (type === 'classes') {
      const { creates, updates } = await this.validateClasses(database, rows, resolveUnit, errors, selected);
      return { errors, classes: creates, classUpdates: updates, children: [], openingDebts: [], staff: [] };
    }
    return {
      errors,
      classes: [],
      classUpdates: [],
      children: await this.validateChildren(database, rows, resolveUnit, errors),
      openingDebts: [],
      staff: [],
    };
  }

  // Trẻ tìm theo số định danh trong phạm vi của kế toán; mỗi trẻ một hóa đơn đầu kỳ trong năm học (YCTD-54)
  private async validateOpeningDebts(
    database: Executor,
    currentUser: CurrentUser,
    rows: SheetRow[],
    errors: RowError[],
  ): Promise<OpeningDebtRow[]> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.openingDebtImport);
    const seen = new Set<string>();
    const result: OpeningDebtRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const amount = Number(values.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > MAXIMUM_AMOUNT) {
        errors.push({ row, column: 'Số tiền', message: 'Số nguyên đồng lớn hơn 0' });
      }
      const dueDate = parseDate(values.due_date ?? '');
      if (!dueDate) {
        errors.push({ row, column: 'Ngày đến hạn', message: 'Ngày không hợp lệ' });
      }
      const note = values.note || null;
      if (note && note.length > 500) {
        errors.push({ row, column: 'Ghi chú', message: 'Tối đa 500 ký tự' });
      }
      if (!NATIONAL_ID_PATTERN.test(values.national_id ?? '')) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Số định danh cá nhân gồm mười hai chữ số' });
        continue;
      }
      const child = await database
        .selectFrom('children')
        .select(['id', 'org_unit_id', 'full_name'])
        .where('national_id_hash', '=', this.protection.hash(values.national_id ?? ''))
        .executeTakeFirst();
      if (!child || (!scope.wholeSchool && !scope.orgUnitIds.includes(child.org_unit_id))) {
        errors.push({
          row,
          column: 'Số định danh cá nhân',
          message: 'Không có trẻ nào khớp số định danh này trong phạm vi của bạn',
        });
        continue;
      }
      if (values.full_name && values.full_name.trim() !== child.full_name) {
        errors.push({ row, column: 'Họ tên trẻ', message: `Không khớp hồ sơ: ${child.full_name}` });
      }
      if (seen.has(child.id)) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Trẻ xuất hiện nhiều lần trong tệp' });
      }
      seen.add(child.id);
      const existing = await database
        .selectFrom('invoices')
        .select('id')
        .where('child_id', '=', child.id)
        .where('invoice_kind', '=', 'opening')
        .executeTakeFirst();
      if (existing) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Trẻ đã có công nợ đầu kỳ trong năm học' });
      }
      if (errors.length === before) {
        result.push({ child_id: child.id, org_unit_id: child.org_unit_id, amount, due_date: dueDate ?? '', note });
      }
    }
    return result;
  }

  // Hồ sơ nhân sự theo đơn vị trong phạm vi người nhập; mã nhân sự không trùng; phòng ban, chức danh tìm theo tên (YCTD-58)
  private async validateStaff(
    database: Executor,
    currentUser: CurrentUser,
    rows: SheetRow[],
    errors: RowError[],
  ): Promise<StaffRow[]> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.importStaff);
    const units = await database.selectFrom('org_units').select(['id', 'code', 'status']).execute();
    const departments = await database
      .selectFrom('departments')
      .select(['id', 'org_unit_id', 'name'])
      .where('status', '=', 'active')
      .execute();
    const jobTitles = await database
      .selectFrom('job_titles')
      .select(['id', 'org_unit_id', 'name'])
      .where('status', '=', 'active')
      .execute();
    const existingCodes = new Set((await database.selectFrom('staff').select('code').execute()).map((row) => row.code));
    const seen = new Set<string>();
    const result: StaffRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const unit = units.find((item) => item.code === values.unit_code);
      if (!unit || unit.status !== 'active') {
        errors.push({ row, column: 'Mã đơn vị', message: 'Không có đơn vị đang dùng với mã này' });
      } else if (!scope.wholeSchool && !scope.orgUnitIds.includes(unit.id)) {
        errors.push({ row, column: 'Mã đơn vị', message: 'Đơn vị này nằm ngoài phạm vi của bạn' });
      }
      const code = values.code ?? '';
      if (!code) {
        errors.push({ row, column: 'Mã nhân sự', message: 'Bắt buộc nhập' });
      } else if (seen.has(code)) {
        errors.push({ row, column: 'Mã nhân sự', message: 'Mã nhân sự trùng với dòng khác trong tệp' });
      } else if (existingCodes.has(code)) {
        errors.push({ row, column: 'Mã nhân sự', message: 'Mã nhân sự đã có' });
      }
      seen.add(code);
      if (!values.full_name) {
        errors.push({ row, column: 'Họ tên', message: 'Bắt buộc nhập' });
      }
      const dob = values.dob ? parseDate(values.dob) : null;
      if (values.dob && !dob) {
        errors.push({ row, column: 'Ngày sinh', message: 'Ngày không hợp lệ' });
      }
      const startDate = parseDate(values.start_date ?? '');
      if (!startDate) {
        errors.push({ row, column: 'Ngày vào làm', message: 'Ngày không hợp lệ' });
      }
      const gender = values.gender === 'Nam' ? 'male' : values.gender === 'Nữ' ? 'female' : null;
      if (values.gender && !gender) {
        errors.push({ row, column: 'Giới tính', message: 'Nam hoặc Nữ' });
      }
      if (values.phone && !PHONE_PATTERN.test(values.phone)) {
        errors.push({ row, column: 'Số điện thoại', message: '10 chữ số bắt đầu bằng 0' });
      }
      if (values.id_number && !NATIONAL_ID_PATTERN.test(values.id_number)) {
        errors.push({ row, column: 'Số định danh cá nhân', message: 'Mười hai chữ số' });
      }
      const department = values.department
        ? departments.find((item) => item.org_unit_id === unit?.id && item.name === values.department)
        : undefined;
      if (values.department && !department) {
        errors.push({ row, column: 'Phòng ban', message: 'Không có phòng ban đang dùng với tên này ở đơn vị' });
      }
      const jobTitle = values.job_title
        ? jobTitles.find((item) => item.org_unit_id === unit?.id && item.name === values.job_title)
        : undefined;
      if (values.job_title && !jobTitle) {
        errors.push({ row, column: 'Chức danh', message: 'Không có chức danh đang dùng với tên này ở đơn vị' });
      }
      if (errors.length === before && unit && startDate) {
        result.push({
          org_unit_id: unit.id,
          code,
          full_name: values.full_name ?? '',
          dob,
          gender,
          phone: values.phone || null,
          email: values.email || null,
          id_number: values.id_number || null,
          department_id: department?.id ?? null,
          job_title_id: jobTitle?.id ?? null,
          start_date: startDate,
        });
      }
    }
    return result;
  }

  private async commitStaff(
    database: Kysely<SchoolYearDatabase>,
    rows: StaffRow[],
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    return database.transaction().execute(async (transaction) => {
      for (const { id_number: idNumber, ...row } of rows) {
        const created = await transaction
          .insertInto('staff')
          .values({
            ...row,
            id_number_encrypted: idNumber ? this.protection.encrypt(idNumber) : null,
            id_number_last4: idNumber ? idNumber.slice(-4) : null,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'staff',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { ...row, import_job_id: jobId },
        });
      }
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  // Mỗi dòng thành một hóa đơn đầu kỳ đã phát hành ở tháng đầu năm học, thu bằng phiếu thu như hóa đơn thường
  private async commitOpeningDebts(
    database: Kysely<SchoolYearDatabase>,
    rows: OpeningDebtRow[],
    jobId: string,
    origin: ChangeOrigin,
  ): Promise<ImportJobView> {
    const first = (await this.periods.list())[0];
    if (!first) {
      throw ruleViolationError('P01-13', 'Năm học chưa có lịch học kỳ');
    }
    const [year, month] = first.period.split('-').map(Number);
    return database.transaction().execute(async (transaction) => {
      for (const row of rows) {
        const code = await nextDocumentCode(transaction, 'invoice', 'HD');
        const invoice = await transaction
          .insertInto('invoices')
          .values({
            code,
            child_id: row.child_id,
            org_unit_id: row.org_unit_id,
            period_year: year ?? 0,
            period_month: month ?? 0,
            invoice_kind: 'opening',
            status: 'issued',
            total_amount: row.amount,
            basis: JSON.stringify({ import_job_id: jobId }),
            review_flags: JSON.stringify([]),
            due_date: row.due_date,
            issued_at: this.clock.now(),
            issued_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('invoice_items')
          .values({
            invoice_id: invoice.id,
            item_type: 'opening',
            service_id: null,
            description: 'Công nợ đầu kỳ',
            quantity: 1,
            unit_price: row.amount,
            amount: row.amount,
            basis_note: row.note,
          })
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: row.org_unit_id,
          entityName: 'invoices',
          entityId: invoice.id,
          action: 'create',
          before: null,
          after: { code, invoice_kind: 'opening', amount: row.amount, due_date: row.due_date, import_job_id: jobId },
        });
      }
      await transaction
        .updateTable('data_import_jobs')
        .set({ status: 'committed', committed_by: origin.actorUserId, committed_at: this.clock.now() })
        .where('id', '=', jobId)
        .execute();
      return this.readJob(transaction, jobId);
    });
  }

  // Lớp mới cần đủ cột bắt buộc; lớp đã có (cùng mã đơn vị, mã lớp) cập nhật các cột được chọn, không đổi bậc học ở đây vì
  // bậc học ràng buộc nhóm tuổi, lớp ghép của 2.1 Hồ sơ lớp học (DT-16 phần 16a)
  private async validateClasses(
    database: Executor,
    rows: SheetRow[],
    resolveUnit: (row: number, code: string | undefined) => string | undefined,
    errors: RowError[],
    selected: Set<string>,
  ): Promise<{ creates: ClassRow[]; updates: ClassUpdate[] }> {
    const gradeLevels = await database
      .selectFrom('grade_levels')
      .select('code')
      .where('status', '=', 'active')
      .execute();
    const rooms = await database
      .selectFrom('rooms')
      .select(['id', 'org_unit_id', 'code'])
      .where('status', '=', 'active')
      .execute();
    const existing = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'code', 'grade_level'])
      .execute();
    const seen = new Set<string>();
    const creates: ClassRow[] = [];
    const updates: ClassUpdate[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const orgUnitId = resolveUnit(row, values.unit_code);
      if (!values.class_code) {
        errors.push({ row, column: 'Mã lớp', message: 'Bắt buộc nhập' });
      }
      const current = orgUnitId
        ? existing.find((item) => item.org_unit_id === orgUnitId && item.code === values.class_code)
        : undefined;
      // Lớp mới: cột bắt buộc phải được chọn và có giá trị; lớp đã có: cột được chọn không để trống tên lớp
      for (const [key, header] of CLASS_CREATE_COLUMNS) {
        if (!current && !selected.has(key)) {
          errors.push({ row, column: header, message: 'Thêm lớp mới cần chọn nhập cột này' });
        } else if (selected.has(key) && !values[key]) {
          errors.push({ row, column: header, message: 'Bắt buộc nhập' });
        }
      }
      if (values.grade_level && !gradeLevels.some((level) => level.code === values.grade_level)) {
        errors.push({ row, column: 'Mã bậc học', message: 'Bậc học không có hoặc đã ngừng sử dụng' });
      } else if (
        current &&
        selected.has('grade_level') &&
        values.grade_level &&
        values.grade_level !== current.grade_level
      ) {
        errors.push({
          row,
          column: 'Mã bậc học',
          message: 'Đổi bậc học của lớp đã có làm ở 2.1 Hồ sơ lớp học; bỏ chọn cột này hoặc giữ bậc học hiện tại',
        });
      }
      const maxSize = Number(values.max_size);
      if (selected.has('max_size') && values.max_size && (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 200)) {
        errors.push({ row, column: 'Sĩ số tối đa', message: 'Số nguyên từ 1 đến 200' });
      }
      const room = values.room_code
        ? rooms.find((item) => item.code === values.room_code && item.org_unit_id === orgUnitId)
        : undefined;
      if (values.room_code && !room) {
        errors.push({ row, column: 'Mã phòng', message: 'Không có phòng đang dùng với mã này ở đơn vị của lớp' });
      }
      const key = `${orgUnitId}:${values.class_code}`;
      if (orgUnitId && values.class_code) {
        if (seen.has(key)) {
          errors.push({ row, column: 'Mã lớp', message: 'Mã lớp trùng với dòng khác trong tệp' });
        }
        seen.add(key);
      }
      if (errors.length !== before || !orgUnitId) {
        continue;
      }
      if (current) {
        const changes: ClassUpdate['changes'] = {};
        if (selected.has('class_name')) {
          changes.name = values.class_name ?? '';
        }
        if (selected.has('max_size')) {
          changes.max_size = maxSize;
        }
        if (selected.has('room_code')) {
          changes.room_id = room?.id ?? null;
        }
        updates.push({ id: current.id, org_unit_id: orgUnitId, changes });
      } else {
        creates.push({
          org_unit_id: orgUnitId,
          code: values.class_code ?? '',
          name: values.class_name ?? '',
          grade_level: values.grade_level ?? '',
          max_size: maxSize,
          room_id: room?.id ?? null,
        });
      }
    }
    return { creates, updates };
  }

  private async validateChildren(
    database: Executor,
    rows: SheetRow[],
    resolveUnit: (row: number, code: string | undefined) => string | undefined,
    errors: RowError[],
  ): Promise<ChildRow[]> {
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'org_unit_id', 'code'])
      .where('status', '=', 'active')
      .execute();
    const relationships = await database
      .selectFrom('catalog_items')
      .select(['id', 'code', 'name'])
      .where('catalog_type', '=', 'parent_relationship')
      .where('status', '=', 'active')
      .execute();
    const findRelationship = (text: string) =>
      relationships.find(
        (item) => item.code.toLowerCase() === text.toLowerCase() || item.name.toLowerCase() === text.toLowerCase(),
      );
    const today = VIETNAM_DATE.format(this.clock.now());
    const nationalIdsInFile = new Map<string, number>();
    const moetCodesInFile = new Map<string, number>();
    for (const { values } of rows) {
      if (values.national_id) {
        nationalIdsInFile.set(values.national_id, (nationalIdsInFile.get(values.national_id) ?? 0) + 1);
      }
      if (values.moet_code) {
        moetCodesInFile.set(values.moet_code, (moetCodesInFile.get(values.moet_code) ?? 0) + 1);
      }
    }
    const result: ChildRow[] = [];
    for (const { row, values } of rows) {
      const before = errors.length;
      const fail = (column: string, message: string) => errors.push({ row, column, message });
      const orgUnitId = resolveUnit(row, values.unit_code);
      const classRecord = classes.find((item) => item.code === values.class_code && item.org_unit_id === orgUnitId);
      if (orgUnitId && !classRecord) {
        fail('Mã lớp', 'Không có lớp đang dùng với mã này ở đơn vị');
      }
      const fullName = values.full_name ?? '';
      if (!fullName) {
        fail('Họ tên trẻ', 'Bắt buộc nhập');
      } else if (fullName.length > 100) {
        fail('Họ tên trẻ', 'Tối đa 100 ký tự');
      }
      const dob = values.dob ? parseDate(values.dob) : null;
      if (!values.dob) {
        fail('Ngày sinh', 'Bắt buộc nhập');
      } else if (!dob || dob > today) {
        fail('Ngày sinh', 'Ngày không hợp lệ hoặc lớn hơn ngày hiện tại');
      }
      const gender =
        values.gender?.toLowerCase() === 'nam' ? 'male' : values.gender?.toLowerCase() === 'nữ' ? 'female' : null;
      if (!gender) {
        fail('Giới tính', 'Ghi Nam hoặc Nữ');
      }
      const nationalId = values.national_id ?? '';
      if (!NATIONAL_ID_PATTERN.test(nationalId)) {
        fail('Số định danh cá nhân', 'Số định danh cá nhân gồm mười hai chữ số');
      } else if ((nationalIdsInFile.get(nationalId) ?? 0) > 1) {
        fail('Số định danh cá nhân', 'Trùng với dòng khác trong tệp');
      } else if (
        await database
          .selectFrom('children')
          .select('id')
          .where('national_id_hash', '=', this.protection.hash(nationalId))
          .executeTakeFirst()
      ) {
        fail('Số định danh cá nhân', 'Đã có hồ sơ trẻ với số định danh này');
      }
      const moetCode = values.moet_code || null;
      if (moetCode) {
        if ((moetCodesInFile.get(moetCode) ?? 0) > 1) {
          fail('Mã định danh ngành', 'Trùng với dòng khác trong tệp');
        } else if (
          await database
            .selectFrom('children')
            .select('id')
            .where('moet_student_code', '=', moetCode)
            .executeTakeFirst()
        ) {
          fail('Mã định danh ngành', 'Mã đã gán cho trẻ khác');
        }
      }
      const allergyText = values.allergies ?? '';
      if (!allergyText) {
        fail('Dị ứng', 'Ghi "Không" hoặc ghi dị ứng gì (BR-06)');
      }
      const enrollDate = values.enroll_date ? parseDate(values.enroll_date) : today;
      if (!enrollDate) {
        fail('Ngày vào lớp', 'Ngày không hợp lệ');
      }
      const guardians: ChildRow['guardians'] = [];
      for (const index of [1, 2] as const) {
        const name = values[`guardian${index}_name`] ?? '';
        const relationshipText = values[`guardian${index}_relationship`] ?? '';
        const phone = values[`guardian${index}_phone`] || null;
        if (index === 2 && !name && !relationshipText && !phone) {
          continue;
        }
        if (!name) {
          fail(`Họ tên phụ huynh ${index}`, 'Bắt buộc nhập');
        }
        const relationship = findRelationship(relationshipText);
        if (!relationship) {
          fail(`Quan hệ phụ huynh ${index}`, 'Không có trong danh mục Quan hệ với trẻ');
        }
        if (phone && !PHONE_PATTERN.test(phone)) {
          fail(`Số điện thoại phụ huynh ${index}`, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0');
        }
        if (relationship) {
          guardians.push({ full_name: name, phone, relationship_item_id: relationship.id });
        }
      }
      if (guardians.length === 2 && guardians[0]?.phone && guardians[0].phone === guardians[1]?.phone) {
        fail('Số điện thoại phụ huynh 2', 'Hai phụ huynh không dùng chung một số điện thoại');
      }
      if (!guardians.some((guardian) => guardian.phone)) {
        fail('Số điện thoại phụ huynh 1', 'Cần ít nhất một người liên hệ có số điện thoại (BR-06)');
      }
      if (errors.length === before && orgUnitId && classRecord && dob && gender && enrollDate) {
        const noAllergy = allergyText.toLowerCase() === 'không';
        result.push({
          org_unit_id: orgUnitId,
          class_id: classRecord.id,
          full_name: fullName,
          dob,
          gender,
          national_id: nationalId,
          moet_student_code: moetCode,
          place_of_birth: values.place_of_birth || null,
          address: values.address || null,
          has_allergies: !noAllergy,
          allergies: noAllergy ? null : allergyText,
          chronic_conditions: values.chronic_conditions || null,
          enroll_date: enrollDate,
          guardians,
        });
      }
    }
    return result;
  }

  // Trẻ nhập vào thẳng trạng thái đang học; giấy khai sinh bổ sung sau; đồng ý hình ảnh chờ phụ huynh xác nhận (YCTD-46)
  private async insertImportedChild(
    transaction: Transaction<SchoolYearDatabase>,
    row: ChildRow,
    accounts: Map<string, { userId: string; created: boolean }>,
    origin: ChangeOrigin,
    jobId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const child = await transaction
      .insertInto('children')
      .values({
        org_unit_id: row.org_unit_id,
        full_name: row.full_name,
        dob: row.dob,
        gender: row.gender,
        place_of_birth: row.place_of_birth,
        address: row.address,
        national_id_encrypted: this.protection.encrypt(row.national_id),
        national_id_hash: this.protection.hash(row.national_id),
        national_id_last4: row.national_id.slice(-4),
        moet_student_code: row.moet_student_code,
        birth_certificate_file_id: null,
        status: 'active',
        photo_consent: 'pending',
        photo_consent_by: origin.actorUserId,
        photo_consent_at: now,
        enroll_date: row.enroll_date,
        approved_by: origin.actorUserId,
        approved_at: now,
        created_by: origin.actorUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('health_profiles')
      .values({
        child_id: child.id,
        has_allergies: row.has_allergies,
        allergies: row.allergies,
        chronic_conditions: row.chronic_conditions,
        created_by: origin.actorUserId,
      })
      .execute();
    await transaction
      .insertInto('photo_consent_histories')
      .values({ child_id: child.id, action: 'pending', actor_user_id: origin.actorUserId })
      .execute();
    for (const [index, guardian] of row.guardians.entries()) {
      const existing = guardian.phone
        ? await transaction.selectFrom('guardians').select('id').where('phone', '=', guardian.phone).executeTakeFirst()
        : undefined;
      const account = guardian.phone ? accounts.get(guardian.phone) : undefined;
      const guardianId =
        existing?.id ??
        (
          await transaction
            .insertInto('guardians')
            .values({
              full_name: guardian.full_name,
              phone: guardian.phone,
              user_id: account?.userId ?? null,
              created_by: origin.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id;
      if (existing && account) {
        await transaction
          .updateTable('guardians')
          .set({ user_id: account.userId })
          .where('id', '=', existing.id)
          .execute();
      }
      await transaction
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: guardianId,
          relationship_item_id: guardian.relationship_item_id,
          is_primary: index === 0,
          created_by: origin.actorUserId,
        })
        .execute();
    }
    await transaction
      .insertInto('class_enrollments')
      .values({
        child_id: child.id,
        class_id: row.class_id,
        from_date: row.enroll_date,
        reason: 'Nhập dữ liệu ban đầu',
        created_by: origin.actorUserId,
      })
      .execute();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: row.org_unit_id,
      entityName: 'children',
      entityId: child.id,
      action: 'create',
      before: null,
      after: {
        full_name: row.full_name,
        dob: row.dob,
        class_id: row.class_id,
        status: 'active',
        import_job_id: jobId,
        national_id_masked: `********${row.national_id.slice(-4)}`,
      },
    });
  }

  assertImportType(value: unknown): TemplateImportType {
    if (
      value === 'classes' ||
      value === 'children' ||
      value === 'moet_codes' ||
      value === 'opening_debts' ||
      value === 'staff' ||
      isStudentImportType(String(value))
    ) {
      return value as TemplateImportType;
    }
    throw new ApplicationError(
      'ERR_VALIDATION',
      'Loại dữ liệu nhập là classes, children, moet_codes hoặc opening_debts',
      [{ field: 'type', message: 'Loại không hợp lệ' }],
    );
  }
}
