import { Injectable, Logger } from '@nestjs/common';
import type { ArchiveRecordStatus, ArchiveRetention, SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import { sql, type Kysely, type SelectQueryBuilder } from 'kysely';
import { randomUUID } from 'node:crypto';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { conflictOnDuplicate, notFoundError } from '../common/request-fields.js';
import { buildStudentWorkbook, fileStamp } from '../children/student-workbook.js';
import { buildFacilitiesWorkbook } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import {
  ARCHIVE_RETENTION_LABELS,
  ARCHIVE_RULE_CODE,
  ARCHIVE_STATUS_LABELS,
  type ArchiveFondInput,
  type ArchiveHoldingInput,
  type ArchiveRecordFilter,
  type ArchiveRecordInput,
} from './archive-fields.js';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-117): hồ sơ tài liệu hoàn thành, chưa hoàn thành kèm tệp đính
// kèm; phông lưu trữ; thông tin lưu trữ theo phông và giai đoạn; báo cáo lưu trữ cộng theo phông, giai đoạn. Dữ liệu ở cơ
// sở dữ liệu hệ thống nên giữ qua các năm học; nhật ký thao tác và nhật ký xuất ghi vào năm học đang dùng như các màn hình
// khác, nên chưa mở năm học thì không ghi, không xuất được (BR-93)
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
  holding_count: number;
  record_count: number;
  updated_at: Date;
}

export interface ArchiveHoldingView {
  id: string;
  fond_id: string;
  fond_code: string;
  fond_name: string;
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
  updated_at: Date;
}

export interface ArchiveReportFilter {
  fond_id: string | null;
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

type RecordQuery = SelectQueryBuilder<
  SystemDatabase,
  'archive_records' | 'archive_fonds',
  Record<string, unknown>
>;

const NO_RECORD_FILTER: ArchiveRecordFilter = {
  status: null,
  search: null,
  fond_id: null,
  handler: null,
  due_from: null,
  due_to: null,
  overdue: false,
};

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);

@Injectable()
export class ArchivesService {
  private readonly logger = new Logger('Archives');

  constructor(
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private get database(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  // ---- Phông lưu trữ ----

  async listFonds(): Promise<ArchiveFondView[]> {
    const rows = await this.database
      .selectFrom('archive_fonds')
      .select((expression) => [
        'archive_fonds.id',
        'archive_fonds.code',
        'archive_fonds.name',
        'archive_fonds.note',
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
      ])
      .orderBy('archive_fonds.code')
      .execute();
    return rows.map((row) => ({
      ...row,
      holding_count: toNumber(row.holding_count),
      record_count: toNumber(row.record_count),
    }));
  }

  async createFond(input: ArchiveFondInput, origin: ChangeOrigin): Promise<ArchiveFondView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
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
      orgUnitId: null,
      entityName: 'archive_fonds',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findFond(row.id);
  }

  async updateFond(fondId: string, input: ArchiveFondInput, origin: ChangeOrigin): Promise<ArchiveFondView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const before = await this.database
      .selectFrom('archive_fonds')
      .select(['code', 'name', 'note'])
      .where('id', '=', fondId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy phông lưu trữ', 'archive_fond');
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
      orgUnitId: null,
      entityName: 'archive_fonds',
      entityId: fondId,
      action: 'update',
      before,
      after: input,
    });
    return this.findFond(fondId);
  }

  // Phông còn thông tin lưu trữ hoặc hồ sơ thì không xóa được, phải chuyển hoặc xóa các dòng đó trước
  async deleteFond(fondId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const fond = await this.findFond(fondId);
    if (fond.holding_count > 0 || fond.record_count > 0) {
      throw this.fondInUseError(fond);
    }
    try {
      await this.database.deleteFrom('archive_fonds').where('id', '=', fondId).execute();
    } catch (error) {
      // Dòng mới thêm cùng lúc vào phông này
      if ((error as { code?: string }).code === '23503') {
        throw this.fondInUseError(await this.findFond(fondId));
      }
      throw error;
    }
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_fonds',
      entityId: fondId,
      action: 'delete',
      before: { code: fond.code, name: fond.name, note: fond.note },
      after: null,
    });
  }

  private fondInUseError(fond: ArchiveFondView): ApplicationError {
    return ruleViolationError(
      ARCHIVE_RULE_CODE,
      `Phông ${fond.name} còn ${fond.holding_count} dòng thông tin lưu trữ và ${fond.record_count} hồ sơ, không xóa được`,
    );
  }

  private async findFond(fondId: string): Promise<ArchiveFondView> {
    const fond = (await this.listFonds()).find((row) => row.id === fondId);
    if (!fond) {
      throw notFoundError('Không tìm thấy phông lưu trữ', 'archive_fond');
    }
    return fond;
  }

  private async assertFondExists(fondId: string | null): Promise<void> {
    if (!fondId) {
      return;
    }
    const fond = await this.database
      .selectFrom('archive_fonds')
      .select('id')
      .where('id', '=', fondId)
      .executeTakeFirst();
    if (!fond) {
      throw validationError([{ field: 'fond_id', message: 'Không tìm thấy phông lưu trữ' }]);
    }
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

  async listHoldings(fondId: string | null): Promise<ArchiveHoldingView[]> {
    let query = this.holdingsQuery();
    if (fondId) {
      query = query.where('archive_holdings.fond_id', '=', fondId);
    }
    const rows = await query
      .orderBy('archive_fonds.code')
      .orderBy('archive_holdings.period_from_year')
      .orderBy('archive_holdings.period_to_year')
      .execute();
    return rows.map((row) => ({ ...row, shelf_meters: toNumber(row.shelf_meters) }));
  }

  private async findHolding(holdingId: string): Promise<ArchiveHoldingView> {
    const row = await this.holdingsQuery().where('archive_holdings.id', '=', holdingId).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy thông tin lưu trữ', 'archive_holding');
    }
    return { ...row, shelf_meters: toNumber(row.shelf_meters) };
  }

  async createHolding(input: ArchiveHoldingInput, origin: ChangeOrigin): Promise<ArchiveHoldingView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    await this.assertFondExists(input.fond_id);
    const now = this.clock.now();
    const row = await this.database
      .insertInto('archive_holdings')
      .values({ ...input, created_at: now, updated_at: now, created_by: origin.actorUserId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_holdings',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findHolding(row.id);
  }

  async updateHolding(holdingId: string, input: ArchiveHoldingInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const before = await this.findHolding(holdingId);
    await this.assertFondExists(input.fond_id);
    await this.database
      .updateTable('archive_holdings')
      .set({ ...input, updated_at: this.clock.now(), updated_by: origin.actorUserId })
      .where('id', '=', holdingId)
      .execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_holdings',
      entityId: holdingId,
      action: 'update',
      before,
      after: input,
    });
    return this.findHolding(holdingId);
  }

  async deleteHolding(holdingId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const before = await this.findHolding(holdingId);
    await this.database.deleteFrom('archive_holdings').where('id', '=', holdingId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_holdings',
      entityId: holdingId,
      action: 'delete',
      before,
      after: null,
    });
  }

  // ---- Báo cáo lưu trữ ----

  // Cộng thông tin lưu trữ theo phông và giai đoạn: tổng số mét giá, chia theo đã chỉnh lý, chưa chỉnh lý, hết giá trị,
  // vĩnh viễn, có thời hạn; số bó, số hộp; các nơi bảo quản
  async report(filter: ArchiveReportFilter): Promise<ArchiveReport> {
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
    const report = await this.report(filter);
    const fondName = filter.fond_id ? report.rows[0]?.fond_name : undefined;
    const createdAt = this.clock.now();
    const totalRow = { fond: 'Tổng cộng', period: '', ...report.totals, storage_locations: '' };
    return buildFacilitiesWorkbook({
      database,
      currentUser,
      reportCode: 'archive-report',
      fileName: `bao-cao-luu-tru-${fileStamp(createdAt)}.xlsx`,
      filters: { ...filter },
      orgUnitIds: [],
      sheets: [
        {
          title: 'Báo cáo lưu trữ',
          heading: [
            'BÁO CÁO LƯU TRỮ',
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

  private applyRecordFilter(query: RecordQuery, filter: ArchiveRecordFilter, today: string): RecordQuery {
    let result = query;
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
    return result;
  }

  private async recordRows(
    filter: ArchiveRecordFilter,
    page: { limit: number; offset: number },
    recordId?: string,
  ): Promise<{ total: number; items: ArchiveRecordView[] }> {
    const today = this.today();
    let filtered = this.applyRecordFilter(this.recordsQuery(), filter, today);
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
      .orderBy(sql`archive_records.due_date asc nulls last`)
      .orderBy(sql`archive_records.completed_on desc nulls last`)
      .orderBy('archive_records.code')
      .limit(page.limit)
      .offset(page.offset)
      .execute();
    return {
      total: toNumber(count.count as string),
      items: rows.map((row) => {
        const record = row as unknown as Omit<ArchiveRecordView, 'file_count' | 'overdue'> & {
          file_count: string | null;
        };
        return {
          ...record,
          file_count: toNumber(record.file_count),
          overdue: record.status === 'pending' && record.due_date !== null && record.due_date < today,
        };
      }),
    };
  }

  async searchRecords(filter: ArchiveRecordFilter, page: number, pageSize: number) {
    const { total, items } = await this.recordRows(filter, { limit: pageSize, offset: (page - 1) * pageSize });
    return { items, page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findRecord(recordId: string): Promise<ArchiveRecordView & { files: ArchiveRecordFileView[] }> {
    const { items } = await this.recordRows(NO_RECORD_FILTER, { limit: 1, offset: 0 }, recordId);
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

  async createRecord(input: ArchiveRecordInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    await this.assertFondExists(input.fond_id);
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
      orgUnitId: null,
      entityName: 'archive_records',
      entityId: row.id,
      action: 'create',
      before: null,
      after: input,
    });
    return this.findRecord(row.id);
  }

  async updateRecord(recordId: string, input: ArchiveRecordInput, origin: ChangeOrigin) {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const before = await this.recordSnapshot(recordId);
    await this.assertFondExists(input.fond_id);
    await conflictOnDuplicate(
      this.database
        .updateTable('archive_records')
        .set({ ...input, updated_at: this.clock.now(), updated_by: origin.actorUserId })
        .where('id', '=', recordId)
        .execute(),
      'Số, ký hiệu hồ sơ đã có',
      'code',
    );
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_records',
      entityId: recordId,
      action: 'update',
      before,
      after: input,
    });
    return this.findRecord(recordId);
  }

  // Xóa hồ sơ xóa luôn tệp đính kèm ở kho tệp; tệp không xóa được ở kho thì chỉ ghi cảnh báo, hồ sơ vẫn xóa
  async deleteRecord(recordId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const before = await this.recordSnapshot(recordId);
    const files = await this.database
      .selectFrom('archive_record_files')
      .select(['storage_key', 'file_name'])
      .where('record_id', '=', recordId)
      .execute();
    await this.database.deleteFrom('archive_records').where('id', '=', recordId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
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

  private async recordSnapshot(recordId: string) {
    const row = await this.database
      .selectFrom('archive_records')
      .select([
        'code',
        'title',
        'fond_id',
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
    if (!row) {
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
    const { total, items } = await this.recordRows(filter, { limit: ARCHIVE_EXPORT_ROW_LIMIT, offset: 0 });
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
      orgUnitIds: [],
      columns: columns.map((column) => ({ key: column.id, label: column.label })),
      rows: items.map((item) => Object.fromEntries(columns.map((column) => [column.id, column.value(item)]))),
      ipAddress,
      createdAt,
    });
  }

  // ---- Tệp đính kèm của hồ sơ ----

  async addFile(
    recordId: string,
    upload: { fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ): Promise<ArchiveRecordFileView> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    await this.recordSnapshot(recordId);
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
      orgUnitId: null,
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

  async readFile(recordId: string, fileId: string) {
    const file = await this.findFile(recordId, fileId);
    return { fileName: file.file_name, contentType: file.content_type, body: await this.fileStorage.get(file.storage_key) };
  }

  async deleteFile(recordId: string, fileId: string, origin: ChangeOrigin): Promise<void> {
    const { database: schoolYear } = await this.currentSchoolYear.require();
    const file = await this.findFile(recordId, fileId);
    await this.database.deleteFrom('archive_record_files').where('id', '=', fileId).execute();
    await writeAuditLog(schoolYear, {
      origin,
      orgUnitId: null,
      entityName: 'archive_record_files',
      entityId: fileId,
      action: 'delete',
      before: { record_id: recordId, file_name: file.file_name, content_type: file.content_type, size: file.size },
      after: null,
    });
    await this.removeStoredFile(file.storage_key);
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    try {
      await this.fileStorage.delete(storageKey);
    } catch (error) {
      this.logger.warn(`Không xóa được tệp ${storageKey} ở kho tệp: ${(error as Error).message}`);
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
