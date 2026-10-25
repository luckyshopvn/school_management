import {
  Inject,
  Injectable,
  Optional,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JobScheduler } from '../common/job-scheduler.js';
import { currentTenant, isMultiTenantMode } from '@school-management/server';
import type {
  ArchiveRecordStatus,
  ArchiveRetention,
  SchoolYearDatabase,
  SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { sql, type Kysely, type SelectQueryBuilder } from 'kysely';
import { randomUUID } from 'node:crypto';
import { PERMISSION_CODES } from '@school-management/shared';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { conflictOnDuplicate, notFoundError } from '../common/request-fields.js';
import { buildStudentWorkbook, fileStamp } from '../children/student-workbook.js';
import { buildFacilitiesWorkbook } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  ARCHIVE_RETENTION_LABELS,
  ARCHIVE_RULE_CODE,
  ARCHIVE_STATUS_LABELS,
  type ArchiveFondInput,
  type ArchiveHoldingInput,
  type ArchiveRecordFilter,
  type ArchiveRecordInput,
} from './archive-fields.js';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-118): hồ sơ tài liệu hoàn thành, chưa hoàn thành kèm tệp đính
// kèm; phông lưu trữ; thông tin lưu trữ theo phông và giai đoạn; báo cáo lưu trữ cộng theo phông, giai đoạn. Dữ liệu ở cơ
// sở dữ liệu hệ thống nên giữ qua các năm học; nhật ký thao tác và nhật ký xuất ghi vào năm học đang dùng như các màn hình
// khác, nên chưa mở năm học thì không ghi, không xuất được (BR-93). YCTD-122: phông, hồ sơ thuộc đơn vị và lọc theo phạm vi
// đơn vị của người dùng; người giải quyết chọn từ nhân sự; nhắc hạn; tệp xóa lỗi ở kho tệp được thử xóa lại
export const MAXIMUM_ARCHIVE_FILE_BYTES = 10 * 1024 * 1024;
export const MAXIMUM_FILES_PER_RECORD = 20;
export const ARCHIVE_EXPORT_ROW_LIMIT = 5000;

// Tệp đính kèm: PDF, ảnh, văn bản và bảng tính Office; tệp Office mới là tệp nén nên xác định theo đuôi tên tệp
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];
const IMAGE_SIGNATURES: Array<{ contentType: string; bytes: number[] }> = [
  { contentType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0];
const OFFICE_TYPES: Record<string, { signature: number[]; contentType: string }> = {
  docx: {
    signature: ZIP_SIGNATURE,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  xlsx: { signature: ZIP_SIGNATURE, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  doc: { signature: OLE_SIGNATURE, contentType: 'application/msword' },
  xls: { signature: OLE_SIGNATURE, contentType: 'application/vnd.ms-excel' },
};

const startsWith = (body: Buffer, bytes: number[]) => bytes.every((byte, index) => body[index] === byte);

export function detectArchiveFileType(fileName: string, body: Buffer): string | undefined {
  if (startsWith(body, PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  const image = IMAGE_SIGNATURES.find((signature) => startsWith(body, signature.bytes));
  if (image) {
    return image.contentType;
  }
  const extension = /\.([a-z]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  const office = OFFICE_TYPES[extension];
  return office && startsWith(body, office.signature) ? office.contentType : undefined;
}

export interface ArchiveFondView {
  id: string;
  code: string;
  name: string;
  note: string | null;
  org_unit_id: string | null;
  org_unit_name: string | null;
  holding_count: number;
  record_count: number;
  updated_at: Date;
}

export interface ArchiveHoldingView {
  id: string;
  fond_id: string;
  fond_code: string;
  fond_name: string;
  // Đơn vị của phông chứa dòng thông tin lưu trữ
  org_unit_id: string | null;
  period_from_year: number;
  period_to_year: number;
  arranged: boolean;
  expired: boolean;
  retention: ArchiveRetention;
  retention_years: number | null;
  bundle_count: number;
  box_count: number;
  shelf_meters: number;
  storage_location: string;
  note: string | null;
  updated_at: Date;
}

export interface ArchiveRecordFileView {
  id: string;
  file_name: string;
  content_type: string;
  size: number;
  created_at: Date;
}

export interface ArchiveRecordView {
  id: string;
  code: string;
  title: string;
  fond_id: string | null;
  fond_code: string | null;
  fond_name: string | null;
  org_unit_id: string | null;
  org_unit_name: string | null;
  handler_staff_id: string | null;
  handler_name: string;
  opened_on: string;
  due_date: string | null;
  status: ArchiveRecordStatus;
  completed_on: string | null;
  retention: ArchiveRetention;
  retention_years: number | null;
  sheet_count: number | null;
  note: string | null;
  file_count: number;
  // Chưa hoàn thành mà đã qua thời hạn (theo ngày ở Việt Nam)
  overdue: boolean;
  // Chưa hoàn thành, thời hạn trong ARCHIVE_DUE_SOON_DAYS ngày tới, kể cả hôm nay (YCTD-122)
  due_soon: boolean;
  updated_at: Date;
}

export interface ArchiveHandlerView {
  id: string;
  code: string;
  full_name: string;
  org_unit_id: string;
}

export interface ArchiveReportFilter {
  fond_id: string | null;
  org_unit_id: string | null;
  storage_location: string | null;
}

export interface ArchiveReportRow {
  fond_id: string;
  fond_code: string;
  fond_name: string;
  period_from_year: number;
  period_to_year: number;
  total_meters: number;
  arranged_meters: number;
  unarranged_meters: number;
  expired_meters: number;
  permanent_meters: number;
  limited_meters: number;
  bundle_count: number;
  box_count: number;
  storage_locations: string;
}

const REPORT_SUM_FIELDS = [
  'total_meters',
  'arranged_meters',
  'unarranged_meters',
  'expired_meters',
  'permanent_meters',
  'limited_meters',
  'bundle_count',
  'box_count',
] as const;

export interface ArchiveReport {
  rows: ArchiveReportRow[];
  totals: Record<(typeof REPORT_SUM_FIELDS)[number], number>;
}

// Cột của tệp Excel danh sách hồ sơ, cùng mã cột với lưới ở cổng quản trị
const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');
const retentionText = (retention: ArchiveRetention, years: number | null) =>
  retention === 'limited' && years ? `${years} năm` : ARCHIVE_RETENTION_LABELS[retention];

export const ARCHIVE_RECORD_EXPORT_COLUMNS: Array<{
  id: string;
  label: string;
  value(row: ArchiveRecordView): unknown;
}> = [
  { id: 'code', label: 'Số, ký hiệu hồ sơ', value: (row) => row.code },
  { id: 'title', label: 'Tiêu đề hồ sơ', value: (row) => row.title },
  { id: 'fond', label: 'Phông lưu trữ', value: (row) => row.fond_name ?? '' },
  { id: 'org_unit', label: 'Đơn vị', value: (row) => row.org_unit_name ?? 'Toàn trường' },
  { id: 'handler_name', label: 'Người giải quyết', value: (row) => row.handler_name },
  { id: 'opened_on', label: 'Ngày mở hồ sơ', value: (row) => formatDate(row.opened_on) },
  { id: 'due_date', label: 'Thời hạn giải quyết', value: (row) => formatDate(row.due_date) },
  { id: 'status', label: 'Trạng thái', value: (row) => ARCHIVE_STATUS_LABELS[row.status] },
  { id: 'completed_on', label: 'Ngày hoàn thành', value: (row) => formatDate(row.completed_on) },
  {
    id: 'retention',
    label: 'Thời hạn bảo quản',
    value: (row) => retentionText(row.retention, row.retention_years),
  },
  { id: 'sheet_count', label: 'Số tờ', value: (row) => row.sheet_count ?? '' },
  { id: 'file_count', label: 'Số tệp đính kèm', value: (row) => row.file_count },
  { id: 'note', label: 'Ghi chú', value: (row) => row.note ?? '' },
];
export const DEFAULT_ARCHIVE_RECORD_EXPORT_COLUMNS = ARCHIVE_RECORD_EXPORT_COLUMNS.filter(
  (column) => column.id !== 'note',
).map((column) => column.id);

// Nhắc hạn (YCTD-122): hồ sơ chưa hoàn thành có thời hạn trong 3 ngày tới thì nhắc "sắp đến hạn" một lần, đã qua thời hạn
// thì nhắc "quá hạn" một lần, gửi trong ứng dụng cho tài khoản của nhân sự giải quyết. Tệp chờ xóa ở kho tệp thử lại tối
// đa 20 lần
export const ARCHIVE_DUE_SOON_DAYS = 3;
export const MAXIMUM_FILE_DELETION_ATTEMPTS = 20;
const NO_UNIT = '00000000-0000-0000-0000-000000000000';
const DAY_MILLISECONDS = 86_400_000;

type RecordQuery = SelectQueryBuilder<SystemDatabase, 'archive_records' | 'archive_fonds', Record<string, unknown>>;

const NO_RECORD_FILTER: ArchiveRecordFilter = {
  status: null,
  search: null,
  fond_id: null,
  org_unit_id: null,
  handler: null,
  due_from: null,
  due_to: null,
  overdue: false,
  due_soon: false,
};

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MILLISECONDS).toISOString().slice(0, 10);

// Mã đơn vị được lọc; null là toàn trường, không lọc. Người chỉ có phạm vi đơn vị không thấy dữ liệu toàn trường
// (đơn vị trống) vì dữ liệu đó thuộc Trường chính
function scopeIds(scope: OrganizationScope): string[] | null {
  if (scope.wholeSchool) {
    return null;
  }
  return scope.orgUnitIds.length > 0 ? scope.orgUnitIds : [NO_UNIT];
}

function inScope(scope: OrganizationScope, orgUnitId: string | null): boolean {
  return scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId));
}

function outOfScopeError(): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn', [
    { field: 'org_unit_id', message: PERMISSION_CODES.archiveManage },
  ]);
}

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger('Archives');

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  private get database(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // ---- Phạm vi đơn vị (YCTD-122) ----

  // Xem: hợp phạm vi của ba quyền văn thư lưu trữ
  async viewScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    const scopes = await Promise.all(
      [PERMISSION_CODES.archiveView, PERMISSION_CODES.archiveManage, PERMISSION_CODES.archiveExport]
        .filter((code) => currentUser.hasPermission(code))
        .map((code) => this.organizationScopes.resolve(currentUser, code)),
    );
    if (scopes.some((scope) => scope.wholeSchool)) {
      return { wholeSchool: true, orgUnitIds: [] };
    }
    return { wholeSchool: false, orgUnitIds: [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))] };
  }

  manageScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    return this.organizationScopes.resolve(currentUser, PERMISSION_CODES.archiveManage);
  }

  // Đơn vị phải có ở năm học đang dùng
  private async assertUnit(schoolYear: Kysely<SchoolYearDatabase>, orgUnitId: string | null): Promise<void> {
    if (!orgUnitId) {
      return;
    }
    const unit = await schoolYear.selectFrom('org_units').select('id').where('id', '=', orgUnitId).executeTakeFirst();
    if (!unit) {
      throw validationError([{ field: 'org_unit_id', message: 'Không tìm thấy đơn vị' }]);
    }
  }

  // Tên đơn vị đọc ở năm học đang dùng; chưa có năm học thì để trống
  private async unitNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unitIds = [...new Set(ids.filter((id): id is string => id !== null))];
    const names = new Map<string, string>();
    const current = unitIds.length > 0 ? await this.currentSchoolYear.find() : undefined;
    if (current) {
      for (const unit of await current.database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .where('id', 'in', unitIds)
        .execute()) {
        names.set(unit.id, unit.name);
      }
    }
    return names;
  }

  // ---- Phông lưu trữ ----

  async listFonds(scope: OrganizationScope): Promise<ArchiveFondView[]> {
    let query = this.database
      .selectFrom('archive_fonds')
      .select((expression) => [
        'archive_fonds.id',
        'archive_fonds.code',
        'archive_fonds.name',
        'archive_fonds.note',
        'archive_fonds.org_unit_id',
        'archive_fonds.updated_at',
        expression
          .selectFrom('archive_holdings')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('archive_holdings.fond_id', '=', 'archive_fonds.id')
          .as('holding_count'),
        expression
          .selectFrom('archive_records')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('archive_records.fond_id', '=', 'archive_fonds.id')
          .as('record_count'),
      ]);
    const ids = scopeIds(scope);
    if (ids) {
      query = query.where('archive_fonds.org_unit_id', 'in', ids);
    }
    const rows = await query.orderBy('archive_fonds.code').execute();
    const names = await this.unitNames(rows.map((row) => row.org_unit_id));
    return rows.map((row) => ({
      ...row,
      org_unit_name: row.org_unit_id ? (names.get(row.org_unit_id) ?? null) : null,
      holding_count: toNumber(row.holding_count),
      record_count: toNumber(row.record_count),
    }));
  }

  async createFond(currentUser: CurrentUser, input: ArchiveFondInput, origin: ChangeOrigin): Promise<ArchiveFondView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    if (!inScope(scope, input.org_unit_id)) {
      throw outOfScopeError();
    }
    await this.assertUnit(schoolYear, input.org_unit_id);
    const now = this.clock.now();
    const row = await conflictOnDuplicate(
      this.database
        .insertInto('archive_fonds')
        .values({ ...input, created_at: now, updated_at: now, created_by: origin.actorUserId })
        .returning('id')
        .executeTakeFirstOrThrow(),
      'Mã phông đã có',
      'code',
    );
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: input.org_unit_id,
      entityName: 'archive_fonds',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findFond(scope, row.id);
  }

  async updateFond(
    currentUser: CurrentUser,
    fondId: string,
    input: ArchiveFondInput,
    origin: ChangeOrigin,
  ): Promise<ArchiveFondView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const before = await this.findFond(scope, fondId);
    if (!inScope(scope, input.org_unit_id)) {
      throw outOfScopeError();
    }
    await this.assertUnit(schoolYear, input.org_unit_id);
    // Phông thuộc một đơn vị thì hồ sơ của phông phải cùng đơn vị đó
    if (input.org_unit_id) {
      const other = await this.database
        .selectFrom('archive_records')
        .select('id')
        .where('fond_id', '=', fondId)
        .where((expression) =>
          expression.or([
            expression('org_unit_id', 'is', null),
            expression('org_unit_id', '!=', input.org_unit_id as string),
          ]),
        )
        .executeTakeFirst();
      if (other) {
        throw validationError([{ field: 'org_unit_id', message: 'Phông còn hồ sơ của đơn vị khác hoặc toàn trường' }]);
      }
    }
    await conflictOnDuplicate(
      this.database
        .updateTable('archive_fonds')
        .set({ ...input, updated_at: this.clock.now(), updated_by: origin.actorUserId })
        .where('id', '=', fondId)
        .execute(),
      'Mã phông đã có',
      'code',
    );
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: input.org_unit_id,
      entityName: 'archive_fonds',
      entityId: fondId,
      action: 'update',
      before: { code: before.code, name: before.name, note: before.note, org_unit_id: before.org_unit_id },
      after: input,
    });
    return this.findFond(scope, fondId);
  }

  // Phông còn thông tin lưu trữ hoặc hồ sơ thì không xóa được, phải chuyển hoặc xóa các dòng đó trước
  async deleteFond(currentUser: CurrentUser, fondId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const fond = await this.findFond(scope, fondId);
    if (fond.holding_count > 0 || fond.record_count > 0) {
      throw this.fondInUseError(fond);
    }
    try {
      await this.database.deleteFrom('archive_fonds').where('id', '=', fondId).execute();
    } catch (error) {
      // Dòng mới thêm cùng lúc vào phông này
      if ((error as { code?: string }).code === '23503') {
        throw this.fondInUseError(await this.findFond(scope, fondId));
      }
      throw error;
    }
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: fond.org_unit_id,
      entityName: 'archive_fonds',
      entityId: fondId,
      action: 'delete',
      before: { code: fond.code, name: fond.name, note: fond.note, org_unit_id: fond.org_unit_id },
      after: null,
    });
  }

  private fondInUseError(fond: ArchiveFondView): ApplicationError {
    return ruleViolationError(
      ARCHIVE_RULE_CODE,
      `Phông ${fond.name} còn ${fond.holding_count} dòng thông tin lưu trữ và ${fond.record_count} hồ sơ, không xóa được`,
    );
  }

  // Phông ngoài phạm vi coi như không có
  private async findFond(scope: OrganizationScope, fondId: string): Promise<ArchiveFondView> {
    const fond = (await this.listFonds(scope)).find((row) => row.id === fondId);
    if (!fond) {
      throw notFoundError('Không tìm thấy phông lưu trữ', 'archive_fond');
    }
    return fond;
  }

  // Phông phải có và nằm trong phạm vi; phông của một đơn vị chỉ nhận hồ sơ của đúng đơn vị đó
  private async assertFond(
    scope: OrganizationScope,
    fondId: string | null,
    recordUnitId?: string | null,
  ): Promise<{ org_unit_id: string | null } | undefined> {
    if (!fondId) {
      return undefined;
    }
    const fond = await this.database
      .selectFrom('archive_fonds')
      .select(['id', 'org_unit_id'])
      .where('id', '=', fondId)
      .executeTakeFirst();
    if (!fond || !inScope(scope, fond.org_unit_id)) {
      throw validationError([{ field: 'fond_id', message: 'Không tìm thấy phông lưu trữ' }]);
    }
    if (recordUnitId !== undefined && fond.org_unit_id !== null && fond.org_unit_id !== recordUnitId) {
      throw validationError([{ field: 'fond_id', message: 'Phông thuộc đơn vị khác với hồ sơ' }]);
    }
    return fond;
  }

  // ---- Thông tin lưu trữ ----

  private holdingsQuery() {
    return this.database
      .selectFrom('archive_holdings')
      .innerJoin('archive_fonds', 'archive_fonds.id', 'archive_holdings.fond_id')
      .select([
        'archive_holdings.id',
        'archive_holdings.fond_id',
        'archive_fonds.code as fond_code',
        'archive_fonds.name as fond_name',
        'archive_fonds.org_unit_id',
        'archive_holdings.period_from_year',
        'archive_holdings.period_to_year',
        'archive_holdings.arranged',
        'archive_holdings.expired',
        'archive_holdings.retention',
        'archive_holdings.retention_years',
        'archive_holdings.bundle_count',
        'archive_holdings.box_count',
        'archive_holdings.shelf_meters',
        'archive_holdings.storage_location',
        'archive_holdings.note',
        'archive_holdings.updated_at',
      ]);
  }

  async listHoldings(scope: OrganizationScope, fondId: string | null): Promise<ArchiveHoldingView[]> {
    let query = this.holdingsQuery();
    if (fondId) {
      query = query.where('archive_holdings.fond_id', '=', fondId);
    }
    const ids = scopeIds(scope);
    if (ids) {
      query = query.where('archive_fonds.org_unit_id', 'in', ids);
    }
    const rows = await query
      .orderBy('archive_fonds.code')
      .orderBy('archive_holdings.period_from_year')
      .orderBy('archive_holdings.period_to_year')
      .execute();
    return rows.map((row) => ({ ...row, shelf_meters: toNumber(row.shelf_meters) }));
  }

  private async findHolding(scope: OrganizationScope, holdingId: string): Promise<ArchiveHoldingView> {
    const row = await this.holdingsQuery().where('archive_holdings.id', '=', holdingId).executeTakeFirst();
    if (!row || !inScope(scope, row.org_unit_id)) {
      throw notFoundError('Không tìm thấy thông tin lưu trữ', 'archive_holding');
    }
    return { ...row, shelf_meters: toNumber(row.shelf_meters) };
  }

  async createHolding(
    currentUser: CurrentUser,
    input: ArchiveHoldingInput,
    origin: ChangeOrigin,
  ): Promise<ArchiveHoldingView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const fond = await this.assertFond(scope, input.fond_id);
    const now = this.clock.now();
    const row = await this.database
      .insertInto('archive_holdings')
      .values({ ...input, created_at: now, updated_at: now, created_by: origin.actorUserId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: fond?.org_unit_id ?? null,
      entityName: 'archive_holdings',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findHolding(scope, row.id);
  }

  async updateHolding(currentUser: CurrentUser, holdingId: string, input: ArchiveHoldingInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const before = await this.findHolding(scope, holdingId);
    const fond = await this.assertFond(scope, input.fond_id);
    await this.database
      .updateTable('archive_holdings')
      .set({ ...input, updated_at: this.clock.now(), updated_by: origin.actorUserId })
      .where('id', '=', holdingId)
      .execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: fond?.org_unit_id ?? null,
      entityName: 'archive_holdings',
      entityId: holdingId,
      action: 'update',
      before,
      after: input,
    });
    return this.findHolding(scope, holdingId);
  }

  async deleteHolding(currentUser: CurrentUser, holdingId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const before = await this.findHolding(scope, holdingId);
    await this.database.deleteFrom('archive_holdings').where('id', '=', holdingId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: before.org_unit_id,
      entityName: 'archive_holdings',
      entityId: holdingId,
      action: 'delete',
      before,
      after: null,
    });
  }

  // ---- Báo cáo lưu trữ ----

  // Cộng thông tin lưu trữ theo phông và giai đoạn: tổng số mét giá, chia theo đã chỉnh lý, chưa chỉnh lý, hết giá trị,
  // vĩnh viễn, có thời hạn; số bó, số hộp; các nơi bảo quản. Chỉ phông trong phạm vi đơn vị của người xem
  async report(scope: OrganizationScope, filter: ArchiveReportFilter): Promise<ArchiveReport> {
    const meters = (condition: ReturnType<typeof sql<boolean>>) =>
      sql<string>`coalesce(sum(archive_holdings.shelf_meters) filter (where ${condition}), 0)`;
    let query = this.database
      .selectFrom('archive_holdings')
      .innerJoin('archive_fonds', 'archive_fonds.id', 'archive_holdings.fond_id')
      .select([
        'archive_fonds.id as fond_id',
        'archive_fonds.code as fond_code',
        'archive_fonds.name as fond_name',
        'archive_holdings.period_from_year',
        'archive_holdings.period_to_year',
        sql<string>`sum(archive_holdings.shelf_meters)`.as('total_meters'),
        meters(sql<boolean>`archive_holdings.arranged`).as('arranged_meters'),
        meters(sql<boolean>`not archive_holdings.arranged`).as('unarranged_meters'),
        meters(sql<boolean>`archive_holdings.expired`).as('expired_meters'),
        meters(sql<boolean>`archive_holdings.retention = 'permanent'`).as('permanent_meters'),
        meters(sql<boolean>`archive_holdings.retention = 'limited'`).as('limited_meters'),
        sql<string>`sum(archive_holdings.bundle_count)`.as('bundle_count'),
        sql<string>`sum(archive_holdings.box_count)`.as('box_count'),
        sql<string>`string_agg(distinct archive_holdings.storage_location, '; ' order by archive_holdings.storage_location)`.as(
          'storage_locations',
        ),
      ])
      .groupBy([
        'archive_fonds.id',
        'archive_fonds.code',
        'archive_fonds.name',
        'archive_holdings.period_from_year',
        'archive_holdings.period_to_year',
      ]);
    const ids = scopeIds(scope);
    if (ids) {
      query = query.where('archive_fonds.org_unit_id', 'in', ids);
    }
    if (filter.org_unit_id) {
      query = query.where('archive_fonds.org_unit_id', '=', filter.org_unit_id);
    }
    if (filter.fond_id) {
      query = query.where('archive_holdings.fond_id', '=', filter.fond_id);
    }
    if (filter.storage_location) {
      query = query.where('archive_holdings.storage_location', 'ilike', `%${escapeLike(filter.storage_location)}%`);
    }
    const rows = (
      await query
        .orderBy('archive_fonds.code')
        .orderBy('archive_holdings.period_from_year')
        .orderBy('archive_holdings.period_to_year')
        .execute()
    ).map((row) => ({
      ...row,
      total_meters: toNumber(row.total_meters),
      arranged_meters: toNumber(row.arranged_meters),
      unarranged_meters: toNumber(row.unarranged_meters),
      expired_meters: toNumber(row.expired_meters),
      permanent_meters: toNumber(row.permanent_meters),
      limited_meters: toNumber(row.limited_meters),
      bundle_count: toNumber(row.bundle_count),
      box_count: toNumber(row.box_count),
      storage_locations: row.storage_locations ?? '',
    }));
    const totals = Object.fromEntries(
      REPORT_SUM_FIELDS.map((field) => [
        field,
        // Cộng theo phần trăm mét để tránh sai số dấu phẩy động
        Math.round(rows.reduce((sum, row) => sum + row[field] * 100, 0)) / 100,
      ]),
    ) as ArchiveReport['totals'];
    return { rows, totals };
  }

  async exportReport(currentUser: CurrentUser, filter: ArchiveReportFilter, ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.viewScope(currentUser);
    const report = await this.report(scope, filter);
    const fondName = filter.fond_id ? report.rows[0]?.fond_name : undefined;
    const unitName = filter.org_unit_id
      ? (await this.unitNames([filter.org_unit_id])).get(filter.org_unit_id)
      : undefined;
    const createdAt = this.clock.now();
    const totalRow = { fond: 'Tổng cộng', period: '', ...report.totals, storage_locations: '' };
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'archive-report',
      fileName: `bao-cao-luu-tru-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: filter.org_unit_id ? [filter.org_unit_id] : scope.orgUnitIds,
      sheets: [
        {
          title: 'Báo cáo lưu trữ',
          heading: [
            'BÁO CÁO LƯU TRỮ',
            ...(unitName ? [`Đơn vị: ${unitName}`] : []),
            ...(fondName ? [`Phông: ${fondName}`] : []),
            ...(filter.storage_location ? [`Nơi bảo quản: ${filter.storage_location}`] : []),
            `Ngày lập: ${formatDate(this.today())}`,
          ],
          columns: [
            { key: 'fond', label: 'Phông lưu trữ', width: 30 },
            { key: 'period', label: 'Giai đoạn', width: 14 },
            { key: 'total_meters', label: 'Tổng số mét giá' },
            { key: 'arranged_meters', label: 'Đã chỉnh lý (mét)' },
            { key: 'unarranged_meters', label: 'Chưa chỉnh lý (mét)' },
            { key: 'expired_meters', label: 'Hết giá trị (mét)' },
            { key: 'permanent_meters', label: 'Bảo quản vĩnh viễn (mét)' },
            { key: 'limited_meters', label: 'Bảo quản có thời hạn (mét)' },
            { key: 'bundle_count', label: 'Số bó' },
            { key: 'box_count', label: 'Số hộp' },
            { key: 'storage_locations', label: 'Nơi bảo quản', width: 30 },
          ],
          rows: [
            ...report.rows.map((row) => ({
              ...row,
              fond: `${row.fond_code} - ${row.fond_name}`,
              period: periodText(row.period_from_year, row.period_to_year),
            })),
            totalRow,
          ],
        },
      ],
      ipAddress,
      createdAt,
    });
  }

  // ---- Hồ sơ tài liệu ----

  private recordsQuery(): RecordQuery {
    return this.database
      .selectFrom('archive_records')
      .leftJoin('archive_fonds', 'archive_fonds.id', 'archive_records.fond_id') as unknown as RecordQuery;
  }

  private applyRecordFilter(
    query: RecordQuery,
    scope: OrganizationScope,
    filter: ArchiveRecordFilter,
    today: string,
  ): RecordQuery {
    let result = query;
    const ids = scopeIds(scope);
    if (ids) {
      result = result.where('archive_records.org_unit_id', 'in', ids);
    }
    if (filter.org_unit_id) {
      result = result.where('archive_records.org_unit_id', '=', filter.org_unit_id);
    }
    if (filter.status) {
      result = result.where('archive_records.status', '=', filter.status);
    }
    if (filter.search) {
      const pattern = `%${escapeLike(filter.search)}%`;
      result = result.where((expression) =>
        expression.or([
          expression('archive_records.code', 'ilike', pattern),
          expression('archive_records.title', 'ilike', pattern),
        ]),
      );
    }
    if (filter.fond_id) {
      result = result.where('archive_records.fond_id', '=', filter.fond_id);
    }
    if (filter.handler) {
      result = result.where('archive_records.handler_name', 'ilike', `%${escapeLike(filter.handler)}%`);
    }
    if (filter.due_from) {
      result = result.where('archive_records.due_date', '>=', filter.due_from);
    }
    if (filter.due_to) {
      result = result.where('archive_records.due_date', '<=', filter.due_to);
    }
    if (filter.overdue) {
      result = result.where('archive_records.status', '=', 'pending').where('archive_records.due_date', '<', today);
    }
    if (filter.due_soon) {
      result = result
        .where('archive_records.status', '=', 'pending')
        .where('archive_records.due_date', '>=', today)
        .where('archive_records.due_date', '<=', addDays(today, ARCHIVE_DUE_SOON_DAYS));
    }
    return result;
  }

  private async recordRows(
    scope: OrganizationScope,
    filter: ArchiveRecordFilter,
    page: { limit: number; offset: number },
    recordId?: string,
  ): Promise<{ total: number; items: ArchiveRecordView[] }> {
    const today = this.today();
    const soon = addDays(today, ARCHIVE_DUE_SOON_DAYS);
    let filtered = this.applyRecordFilter(this.recordsQuery(), scope, filter, today);
    if (recordId) {
      filtered = filtered.where('archive_records.id', '=', recordId);
    }
    const count = await filtered
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    // Chưa hoàn thành: thời hạn gần nhất trước; hoàn thành: mới hoàn thành trước
    const rows = await filtered
      .select((expression) => [
        'archive_records.id',
        'archive_records.code',
        'archive_records.title',
        'archive_records.fond_id',
        'archive_fonds.code as fond_code',
        'archive_fonds.name as fond_name',
        'archive_records.org_unit_id',
        'archive_records.handler_staff_id',
        'archive_records.handler_name',
        'archive_records.opened_on',
        'archive_records.due_date',
        'archive_records.status',
        'archive_records.completed_on',
        'archive_records.retention',
        'archive_records.retention_years',
        'archive_records.sheet_count',
        'archive_records.note',
        'archive_records.updated_at',
        expression
          .selectFrom('archive_record_files')
          .select(expression.fn.countAll<string>().as('count'))
          .whereRef('archive_record_files.record_id', '=', 'archive_records.id')
          .as('file_count'),
      ])
      .orderBy(sql`case when archive_records.status = 'pending' then 0 else 1 end`)
      .orderBy(sql`case when archive_records.status = 'pending' then archive_records.due_date end asc nulls last`)
      .orderBy(sql`archive_records.completed_on desc nulls last`)
      .orderBy('archive_records.code')
      .limit(page.limit)
      .offset(page.offset)
      .execute();
    const records = rows as unknown as Array<
      Omit<ArchiveRecordView, 'file_count' | 'overdue' | 'due_soon' | 'org_unit_name'> & { file_count: string | null }
    >;
    const names = await this.unitNames(records.map((record) => record.org_unit_id));
    return {
      total: toNumber(count.count as string),
      items: records.map((record) => {
        const pending = record.status === 'pending' && record.due_date !== null;
        return {
          ...record,
          org_unit_name: record.org_unit_id ? (names.get(record.org_unit_id) ?? null) : null,
          file_count: toNumber(record.file_count),
          overdue: pending && (record.due_date as string) < today,
          due_soon: pending && (record.due_date as string) >= today && (record.due_date as string) <= soon,
        };
      }),
    };
  }

  async searchRecords(currentUser: CurrentUser, filter: ArchiveRecordFilter, page: number, pageSize: number) {
    const scope = await this.viewScope(currentUser);
    const { total, items } = await this.recordRows(scope, filter, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  // Hồ sơ ngoài phạm vi coi như không có
  async findRecord(
    scope: OrganizationScope,
    recordId: string,
  ): Promise<ArchiveRecordView & { files: ArchiveRecordFileView[] }> {
    const { items } = await this.recordRows(scope, NO_RECORD_FILTER, { limit: 1, offset: 0 }, recordId);
    const record = items[0];
    if (!record) {
      throw notFoundError('Không tìm thấy hồ sơ tài liệu', 'archive_record');
    }
    const files = await this.database
      .selectFrom('archive_record_files')
      .select(['id', 'file_name', 'content_type', 'size', 'created_at'])
      .where('record_id', '=', recordId)
      .orderBy('created_at')
      .execute();
    return { ...record, files };
  }

  async readRecord(currentUser: CurrentUser, recordId: string) {
    return this.findRecord(await this.viewScope(currentUser), recordId);
  }

  // Nhân sự đang làm việc để chọn người giải quyết, trong phạm vi quản lý văn thư; chưa có năm học thì trống
  async listHandlers(currentUser: CurrentUser): Promise<ArchiveHandlerView[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'org_unit_id'])
      .where('status', '=', 'active');
    const ids = scopeIds(await this.manageScope(currentUser));
    if (ids) {
      query = query.where('org_unit_id', 'in', ids);
    }
    return query.orderBy('full_name').orderBy('code').execute();
  }

  // Chọn nhân sự thì tên người giải quyết lấy theo hồ sơ nhân sự đang làm việc ở năm học đang dùng
  private async resolveHandler(
    schoolYear: Kysely<SchoolYearDatabase>,
    input: ArchiveRecordInput,
  ): Promise<ArchiveRecordInput> {
    if (!input.handler_staff_id) {
      return input;
    }
    const staff = await schoolYear
      .selectFrom('staff')
      .select(['full_name'])
      .where('id', '=', input.handler_staff_id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!staff) {
      throw validationError([{ field: 'handler_staff_id', message: 'Không tìm thấy nhân sự đang làm việc' }]);
    }
    return { ...input, handler_name: staff.full_name.slice(0, 200) };
  }

  async createRecord(currentUser: CurrentUser, rawInput: ArchiveRecordInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    if (!inScope(scope, rawInput.org_unit_id)) {
      throw outOfScopeError();
    }
    await this.assertUnit(schoolYear, rawInput.org_unit_id);
    await this.assertFond(scope, rawInput.fond_id, rawInput.org_unit_id);
    const input = await this.resolveHandler(schoolYear, rawInput);
    const now = this.clock.now();
    const row = await conflictOnDuplicate(
      this.database
        .insertInto('archive_records')
        .values({ ...input, created_at: now, updated_at: now, created_by: origin.actorUserId })
        .returning('id')
        .executeTakeFirstOrThrow(),
      'Số, ký hiệu hồ sơ đã có',
      'code',
    );
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: input.org_unit_id,
      entityName: 'archive_records',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findRecord(scope, row.id);
  }

  // Đổi thời hạn, người giải quyết hoặc trạng thái thì nhắc hạn lại từ đầu
  async updateRecord(currentUser: CurrentUser, recordId: string, rawInput: ArchiveRecordInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const before = await this.recordSnapshot(scope, recordId);
    if (!inScope(scope, rawInput.org_unit_id)) {
      throw outOfScopeError();
    }
    await this.assertUnit(schoolYear, rawInput.org_unit_id);
    await this.assertFond(scope, rawInput.fond_id, rawInput.org_unit_id);
    const input = await this.resolveHandler(schoolYear, rawInput);
    const remindAgain =
      before.due_date !== input.due_date ||
      before.handler_staff_id !== input.handler_staff_id ||
      before.status !== input.status;
    await conflictOnDuplicate(
      this.database
        .updateTable('archive_records')
        .set({
          ...input,
          ...(remindAgain ? { due_reminded_at: null, overdue_reminded_at: null } : {}),
          updated_at: this.clock.now(),
          updated_by: origin.actorUserId,
        })
        .where('id', '=', recordId)
        .execute(),
      'Số, ký hiệu hồ sơ đã có',
      'code',
    );
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: input.org_unit_id,
      entityName: 'archive_records',
      entityId: recordId,
      action: 'update',
      before,
      after: input,
    });
    return this.findRecord(scope, recordId);
  }

  // Xóa hồ sơ xóa luôn tệp đính kèm ở kho tệp; tệp chưa xóa được ở kho thì vào hàng chờ xóa lại
  async deleteRecord(currentUser: CurrentUser, recordId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const before = await this.recordSnapshot(scope, recordId);
    const files = await this.database
      .selectFrom('archive_record_files')
      .select(['storage_key', 'file_name'])
      .where('record_id', '=', recordId)
      .execute();
    await this.database.deleteFrom('archive_records').where('id', '=', recordId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: before.org_unit_id,
      entityName: 'archive_records',
      entityId: recordId,
      action: 'delete',
      before: { ...before, files: files.map((file) => file.file_name) },
      after: null,
    });
    for (const file of files) {
      await this.removeStoredFile(file.storage_key);
    }
  }

  private async recordSnapshot(scope: OrganizationScope, recordId: string) {
    const row = await this.database
      .selectFrom('archive_records')
      .select([
        'code',
        'title',
        'fond_id',
        'org_unit_id',
        'handler_staff_id',
        'handler_name',
        'opened_on',
        'due_date',
        'status',
        'completed_on',
        'retention',
        'retention_years',
        'sheet_count',
        'note',
      ])
      .where('id', '=', recordId)
      .executeTakeFirst();
    if (!row || !inScope(scope, row.org_unit_id)) {
      throw notFoundError('Không tìm thấy hồ sơ tài liệu', 'archive_record');
    }
    return row;
  }

  async exportRecords(
    currentUser: CurrentUser,
    filter: ArchiveRecordFilter,
    columnIds: string[],
    ipAddress: string | null,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.viewScope(currentUser);
    const { total, items } = await this.recordRows(scope, filter, { limit: ARCHIVE_EXPORT_ROW_LIMIT, offset: 0 });
    if (total > ARCHIVE_EXPORT_ROW_LIMIT) {
      throw ruleViolationError(
        ARCHIVE_RULE_CODE,
        `Danh sách có hơn ${ARCHIVE_EXPORT_ROW_LIMIT} hồ sơ, hãy thu hẹp bộ lọc trước khi xuất Excel`,
      );
    }
    const columns = columnIds.flatMap((id) => ARCHIVE_RECORD_EXPORT_COLUMNS.filter((column) => column.id === id));
    const createdAt = this.clock.now();
    const title =
      filter.status === 'completed'
        ? 'Hồ sơ tài liệu hoàn thành'
        : filter.status === 'pending'
          ? 'Hồ sơ tài liệu chưa hoàn thành'
          : 'Hồ sơ tài liệu';
    // Tệp có tên người giải quyết nên ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
    return buildStudentWorkbook({
      database,
      currentUser,
      reportCode: 'archive-records',
      title,
      fileName: `ho-so-tai-lieu-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter, columns: columnIds },
      orgUnitIds: [...new Set(items.map((item) => item.org_unit_id).filter((id): id is string => id !== null))],
      columns: columns.map((column) => ({ key: column.id, label: column.label })),
      rows: items.map((item) => Object.fromEntries(columns.map((column) => [column.id, column.value(item)]))),
      ipAddress,
      createdAt,
    });
  }

  // ---- Tệp đính kèm của hồ sơ ----

  async addFile(
    currentUser: CurrentUser,
    recordId: string,
    upload: { fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ): Promise<ArchiveRecordFileView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const record = await this.recordSnapshot(await this.manageScope(currentUser), recordId);
    if (upload.body.length > MAXIMUM_ARCHIVE_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp đính kèm tối đa 10 MB' }]);
    }
    const contentType = detectArchiveFileType(upload.fileName, upload.body);
    if (!contentType) {
      throw validationError([
        { field: 'file', message: 'Tệp đính kèm là PDF, ảnh JPEG, PNG, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)' },
      ]);
    }
    const fileName = upload.fileName.slice(0, 200);
    const storageKey = `archive-records/${recordId}/${randomUUID()}`;
    await this.fileStorage.put(storageKey, upload.body, contentType);
    let fileId: string;
    try {
      fileId = await this.database.transaction().execute(async (transaction) => {
        // Khóa theo hồ sơ để hai lần tải cùng lúc không vượt số tệp tối đa
        await sql`select pg_advisory_xact_lock(hashtext(${`archive-record-files:${recordId}`}))`.execute(transaction);
        const existing = await transaction
          .selectFrom('archive_record_files')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('record_id', '=', recordId)
          .executeTakeFirstOrThrow();
        if (toNumber(existing.count) >= MAXIMUM_FILES_PER_RECORD) {
          throw ruleViolationError(
            ARCHIVE_RULE_CODE,
            `Mỗi hồ sơ đính kèm tối đa ${MAXIMUM_FILES_PER_RECORD} tệp, hãy xóa bớt tệp cũ`,
          );
        }
        const row = await transaction
          .insertInto('archive_record_files')
          .values({
            record_id: recordId,
            storage_key: storageKey,
            file_name: fileName,
            content_type: contentType,
            size: upload.body.length,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        return row.id;
      });
    } catch (error) {
      await this.removeStoredFile(storageKey);
      throw error;
    }
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: record.org_unit_id,
      entityName: 'archive_record_files',
      entityId: fileId,
      action: 'create',
      before: null,
      after: { record_id: recordId, file_name: fileName, content_type: contentType, size: upload.body.length },
    });
    return this.findFile(recordId, fileId);
  }

  private async findFile(recordId: string, fileId: string) {
    const file = await this.database
      .selectFrom('archive_record_files')
      .select(['id', 'file_name', 'content_type', 'size', 'created_at', 'storage_key'])
      .where('id', '=', fileId)
      .where('record_id', '=', recordId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'archive_record_file');
    }
    return file;
  }

  async readFile(currentUser: CurrentUser, recordId: string, fileId: string) {
    await this.recordSnapshot(await this.viewScope(currentUser), recordId);
    const file = await this.findFile(recordId, fileId);
    return {
      fileName: file.file_name,
      contentType: file.content_type,
      body: await this.fileStorage.get(file.storage_key),
    };
  }

  async deleteFile(currentUser: CurrentUser, recordId: string, fileId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const record = await this.recordSnapshot(await this.manageScope(currentUser), recordId);
    const file = await this.findFile(recordId, fileId);
    await this.database.deleteFrom('archive_record_files').where('id', '=', fileId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: record.org_unit_id,
      entityName: 'archive_record_files',
      entityId: fileId,
      action: 'delete',
      before: { record_id: recordId, file_name: file.file_name, content_type: file.content_type, size: file.size },
      after: null,
    });
    await this.removeStoredFile(file.storage_key);
  }

  // Xóa ở kho tệp lỗi thì ghi vào hàng chờ để tiến trình chạy nền thử lại, không để tệp mồ côi (YCTD-122)
  private async removeStoredFile(storageKey: string): Promise<void> {
    try {
      await this.fileStorage.delete(storageKey);
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      this.logger.warn(`Không xóa được tệp ${storageKey} ở kho tệp, sẽ thử lại: ${message}`);
      await this.database
        .insertInto('archive_file_deletions')
        .values({ storage_key: storageKey, attempts: 1, last_error: message, last_attempt_at: this.clock.now() })
        .onConflict((conflict) => conflict.column('storage_key').doNothing())
        .execute();
    }
  }

  // Thử xóa lại các tệp trong hàng chờ; xóa được thì bỏ khỏi hàng chờ, lỗi thì tăng số lần thử
  async retryFileDeletions(): Promise<{ deleted: number; failed: number }> {
    const pending = await this.database
      .selectFrom('archive_file_deletions')
      .select(['storage_key', 'attempts'])
      .where('attempts', '<', MAXIMUM_FILE_DELETION_ATTEMPTS)
      .orderBy('created_at')
      .limit(50)
      .execute();
    let deleted = 0;
    let failed = 0;
    for (const item of pending) {
      try {
        await this.fileStorage.delete(item.storage_key);
        await this.database.deleteFrom('archive_file_deletions').where('storage_key', '=', item.storage_key).execute();
        deleted += 1;
      } catch (error) {
        failed += 1;
        await this.database
          .updateTable('archive_file_deletions')
          .set({
            attempts: item.attempts + 1,
            last_error: (error as Error).message.slice(0, 500),
            last_attempt_at: this.clock.now(),
          })
          .where('storage_key', '=', item.storage_key)
          .execute();
        if (item.attempts + 1 >= MAXIMUM_FILE_DELETION_ATTEMPTS) {
          this.logger.error(`Thôi thử xóa tệp ${item.storage_key} sau ${MAXIMUM_FILE_DELETION_ATTEMPTS} lần lỗi`);
        }
      }
    }
    return { deleted, failed };
  }

  // ---- Nhắc hạn (YCTD-122) ----

  // Hồ sơ chưa hoàn thành có nhân sự giải quyết đã liên kết tài khoản: sắp đến hạn (trong 3 ngày tới, kể cả hôm nay) nhắc
  // một lần, quá hạn nhắc một lần; thông báo trong ứng dụng ghi ở năm học đang dùng, chưa có năm học thì không nhắc
  async remindDueRecords(): Promise<{ dueSoon: number; overdue: number }> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { dueSoon: 0, overdue: 0 };
    }
    const today = this.today();
    const soon = addDays(today, ARCHIVE_DUE_SOON_DAYS);
    const candidates = await this.database
      .selectFrom('archive_records')
      .select(['id', 'code', 'title', 'due_date', 'org_unit_id', 'handler_staff_id', 'due_reminded_at'])
      .where('status', '=', 'pending')
      .where('handler_staff_id', 'is not', null)
      .where('due_date', 'is not', null)
      .where((expression) =>
        expression.or([
          expression.and([expression('due_date', '<', today), expression('overdue_reminded_at', 'is', null)]),
          expression.and([
            expression('due_date', '>=', today),
            expression('due_date', '<=', soon),
            expression('due_reminded_at', 'is', null),
          ]),
        ]),
      )
      .limit(500)
      .execute();
    if (candidates.length === 0) {
      return { dueSoon: 0, overdue: 0 };
    }
    const accounts = new Map(
      (
        await current.database
          .selectFrom('staff')
          .select(['id', 'user_id'])
          .where('id', 'in', [...new Set(candidates.map((record) => record.handler_staff_id as string))])
          .where('user_id', 'is not', null)
          .execute()
      ).map((staff) => [staff.id, staff.user_id as string]),
    );
    const counts = { dueSoon: 0, overdue: 0 };
    for (const record of candidates) {
      const userId = accounts.get(record.handler_staff_id as string);
      if (!userId) {
        // Nhân sự chưa có tài khoản thì chưa nhắc được; liên kết tài khoản rồi sẽ được nhắc ở lượt sau
        continue;
      }
      const overdue = (record.due_date as string) < today;
      await queueNotification(current.database, {
        orgUnitId: record.org_unit_id,
        templateCode: overdue ? 'archive_record_overdue' : 'archive_record_due_soon',
        title: overdue ? 'Hồ sơ tài liệu đã quá hạn' : 'Hồ sơ tài liệu sắp đến hạn',
        body: `Hồ sơ ${record.code} "${record.title.slice(0, 200)}" có thời hạn giải quyết ${formatDate(record.due_date)}`,
        targetType: 'archive_record',
        targetId: record.id,
        recipients: [{ userId, channel: 'in_app' }],
      });
      const now = this.clock.now();
      await this.database
        .updateTable('archive_records')
        // Quá hạn thì nhắc sắp đến hạn coi như đã qua
        .set(
          overdue
            ? { overdue_reminded_at: now, due_reminded_at: record.due_reminded_at ?? now }
            : { due_reminded_at: now },
        )
        .where('id', '=', record.id)
        .execute();
      counts[overdue ? 'overdue' : 'dueSoon'] += 1;
    }
    return counts;
  }
}

// Tiến trình chạy nền của văn thư lưu trữ (YCTD-122): nhắc hạn hồ sơ và thử xóa lại tệp ở kho tệp, cùng nhịp với tiến
// trình gửi thông báo; nhịp bằng 0 (kiểm thử) thì không chạy, kiểm thử gọi trực tiếp các hàm của ArchivesService
@Injectable()
export class ArchiveJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('ArchiveJobs');
  private timer: NodeJS.Timeout | null = null;
  private readonly running = new Set<string>();

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly archives: ArchivesService,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    // Nhiều trường (DT-SaaS phần S1b): bộ lập lịch gọi tick cho từng trường đang phục vụ, trong ngữ cảnh của trường
    if (isMultiTenantMode()) {
      this.scheduler?.register({
        name: 'archives',
        intervalSeconds: this.configuration.notificationDispatchIntervalSeconds ?? 60,
        run: () => this.tick(),
      });
      return;
    }
    const seconds = this.configuration.notificationDispatchIntervalSeconds ?? 60;
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    if (this.running.has(currentTenant()?.code ?? '')) {
      return;
    }
    const tenantKey = currentTenant()?.code ?? '';
    this.running.add(tenantKey);
    try {
      await this.archives.remindDueRecords();
      await this.archives.retryFileDeletions();
    } catch (error) {
      this.logger.error('Tiến trình văn thư lưu trữ lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running.delete(tenantKey);
    }
  }
}

export function periodText(fromYear: number, toYear: number): string {
  return fromYear === toYear ? String(fromYear) : `${fromYear}–${toYear}`;
}

// Ký tự đại diện của LIKE trong chữ người dùng nhập được hiểu đúng là ký tự
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
