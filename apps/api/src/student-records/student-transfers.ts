import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { SchoolYearDatabase, StudentTransferDirection, StudentTransferStatus } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { ChildLifecycleService } from '../children/child-lifecycle.js';
import { CHILD_STATUS_LABELS } from '../children/student-list.js';
import { fileStamp, sendWorkbook } from '../children/student-workbook.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { buildTableFile, CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_IMPORT_BYTES, type RowError } from '../imports/excel.js';
import { MOET_CHILD_COLUMNS } from '../imports/moet-columns.js';
import { MoetImports } from '../imports/moet-imports.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { buildMoetChildFile, loadMoetChildRows } from './moet-child-file.js';
import {
  inScope,
  logExportedFile,
  STUDENT_RECORDS_RULE_CODE,
  studentEditScope,
  VIETNAM_DATE,
  XLSX_TYPE,
} from './student-records-common.js';

// Chuyển trường chạy nội bộ (mục 4.2 của Sở "tiếp nhận học sinh chuyển đến (từ tỉnh, xã, trường); duyệt chuyển đi", DT-16
// phần 16g). Các trường chưa liên thông nên không gửi, nhận qua mạng; theo quyết định của Eric ngày 2026-10-16, bước ngoài
// hệ thống thay bằng tệp:
// - Chuyển đi: người lập hồ sơ ghi đề nghị (trường, tỉnh, xã chuyển đến, ngày, lý do), chờ duyệt; người duyệt "Duyệt" thì
//   học sinh thôi học theo quy trình thôi học (lý do "Chuyển trường") hoặc "Từ chối" kèm lý do. Hồ sơ chuyển xuất dạng PDF
//   (phiếu thông tin học sinh) hoặc tệp theo mẫu 82 cột của Bộ để trường nhận tiếp nhận;
// - Tiếp nhận chuyển đến: tải tệp hồ sơ chuyển theo mẫu của Bộ kèm trường, tỉnh, xã chuyển đến từ; mỗi dòng tạo một hồ sơ
//   nháp (chưa xếp lớp), nhà trường bổ sung giấy khai sinh rồi gửi duyệt và xếp lớp như hồ sơ mới.
const MAXIMUM_TEXT = 200;
const MAXIMUM_REASON = 500;
const PAGE_LIMIT = 200;
const DIRECTIONS: StudentTransferDirection[] = ['out', 'in'];
const STATUSES: StudentTransferStatus[] = ['pending', 'approved', 'rejected', 'received'];

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface TransferPlace {
  school_name: string;
  province_name: string | null;
  ward_name: string | null;
  transfer_date: string;
  reason: string | null;
}

const formatDate = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

@Injectable()
export class StudentTransfersService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly lifecycle: ChildLifecycleService,
    private readonly moet: MoetImports,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async list(
    currentUser: CurrentUser,
    filter: { direction: StudentTransferDirection | null; status: StudentTransferStatus | null; q: string | null },
    page: number,
    pageSize: number,
  ) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { items: [], page, page_size: pageSize, total: 0, total_pages: 1, counts: {} };
    }
    const database = current.database;
    const scope = await studentEditScope(this.organizationScopes, currentUser);
    let query = database
      .selectFrom('student_transfers')
      .innerJoin('org_units', 'org_units.id', 'student_transfers.org_unit_id')
      .leftJoin('children', 'children.id', 'student_transfers.child_id');
    if (!scope.wholeSchool) {
      query = query.where('student_transfers.org_unit_id', 'in', scope.orgUnitIds.length ? scope.orgUnitIds : ['']);
    }
    if (filter.q) {
      query = query.where('student_transfers.full_name', 'ilike', `%${filter.q.replace(/[%_\\]/g, '\\$&')}%`);
    }
    const counts = await query
      .select(['student_transfers.direction', 'student_transfers.status'])
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .groupBy(['student_transfers.direction', 'student_transfers.status'])
      .execute();
    if (filter.direction) {
      query = query.where('student_transfers.direction', '=', filter.direction);
    }
    if (filter.status) {
      query = query.where('student_transfers.status', '=', filter.status);
    }
    const total = await query.select((expression) => expression.fn.countAll<string>().as('count')).executeTakeFirst();
    const items = await query
      .select([
        'student_transfers.id',
        'student_transfers.direction',
        'student_transfers.status',
        'student_transfers.child_id',
        'student_transfers.full_name',
        'student_transfers.dob',
        'student_transfers.school_name',
        'student_transfers.province_name',
        'student_transfers.ward_name',
        'student_transfers.transfer_date',
        'student_transfers.reason',
        'student_transfers.requested_by_name',
        'student_transfers.decided_by_name',
        'student_transfers.decided_at',
        'student_transfers.decision_note',
        'student_transfers.created_at',
        'student_transfers.package_code',
        'org_units.name as org_unit_name',
        'children.moet_student_code',
        'children.status as child_status',
      ])
      .orderBy('student_transfers.created_at', 'desc')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .execute();
    const count = Number(total?.count ?? 0);
    return {
      items,
      page,
      page_size: pageSize,
      total: count,
      total_pages: Math.max(1, Math.ceil(count / pageSize)),
      counts: Object.fromEntries(counts.map((row) => [`${row.direction}:${row.status}`, Number(row.count)])),
    };
  }

  // Đề nghị chuyển đi của học sinh đang học hoặc tạm nghỉ; mỗi học sinh một đề nghị chờ duyệt
  async requestOut(currentUser: CurrentUser, childId: string, place: TransferPlace, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'full_name', 'dob', 'status'])
      .where('id', '=', childId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    const scope = await studentEditScope(this.organizationScopes, currentUser);
    if (!child || !inScope(scope, child.org_unit_id)) {
      throw notFoundError('Hồ sơ không tồn tại hoặc nằm ngoài phạm vi của bạn', 'child');
    }
    if (child.status !== 'active' && child.status !== 'paused') {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Chỉ đề nghị chuyển đi cho học sinh đang học hoặc tạm nghỉ');
    }
    const pending = await database
      .selectFrom('student_transfers')
      .select('id')
      .where('child_id', '=', childId)
      .where('direction', '=', 'out')
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (pending) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Học sinh đã có đề nghị chuyển đi đang chờ duyệt');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('student_transfers')
        .values({
          direction: 'out',
          status: 'pending',
          child_id: child.id,
          org_unit_id: child.org_unit_id,
          full_name: child.full_name,
          dob: child.dob,
          ...place,
          requested_by_name: origin.actorName,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'student_transfers',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { direction: 'out', child_id: child.id, ...place },
      });
      return created;
    });
  }

  private async findTransfer(database: Kysely<SchoolYearDatabase>, transferId: string) {
    const transfer = await database
      .selectFrom('student_transfers')
      .selectAll()
      .where('id', '=', transferId)
      .executeTakeFirst();
    if (!transfer) {
      throw notFoundError('Không tìm thấy hồ sơ chuyển trường', 'student_transfer');
    }
    return transfer;
  }

  // Duyệt chuyển đi: học sinh thôi học theo quy trình thôi học (lớp kết thúc, hủy dịch vụ các tháng sau, BR-23); từ chối
  // thì ghi lý do
  async decide(
    currentUser: CurrentUser,
    transferId: string,
    decision: { approve: boolean; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const transfer = await this.findTransfer(database, transferId);
    await this.organizationScopes.assertCanAccess(currentUser, PERMISSION_CODES.childApprove, transfer.org_unit_id);
    if (transfer.direction !== 'out' || transfer.status !== 'pending' || !transfer.child_id) {
      throw ruleViolationError(
        STUDENT_RECORDS_RULE_CODE,
        'Chỉ duyệt hoặc từ chối được đề nghị chuyển đi đang chờ duyệt',
      );
    }
    if (!decision.approve && !decision.note) {
      throw validationError([{ field: 'note', message: 'Nhập lý do từ chối' }]);
    }
    if (decision.approve) {
      if (transfer.transfer_date > this.today()) {
        throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Chưa đến ngày chuyển đi; duyệt từ ngày chuyển');
      }
      await this.lifecycle.withdraw(
        currentUser,
        transfer.child_id,
        { leaveDate: transfer.transfer_date, reason: `Chuyển trường: ${transfer.school_name}` },
        origin,
      );
    }
    const status: StudentTransferStatus = decision.approve ? 'approved' : 'rejected';
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('student_transfers')
        .set({
          status,
          decided_by: origin.actorUserId,
          decided_by_name: origin.actorName,
          decided_at: this.clock.now(),
          decision_note: decision.note,
          updated_at: this.clock.now(),
        })
        .where('id', '=', transfer.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: transfer.org_unit_id,
        entityName: 'student_transfers',
        entityId: transfer.id,
        action: 'update',
        before: { status: transfer.status },
        after: { status, decision_note: decision.note },
      });
      return updated;
    });
  }

  // Hồ sơ chuyển: PDF phiếu thông tin học sinh hoặc tệp theo mẫu 82 cột của Bộ; có số định danh đầy đủ nên cần quyền xem số
  // định danh cùng quyền xuất dữ liệu, ghi nhật ký xuất (BR-74)
  async dossier(currentUser: CurrentUser, transferId: string, format: 'xlsx' | 'pdf', ipAddress: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const transfer = await this.findTransfer(database, transferId);
    const scope = await studentEditScope(this.organizationScopes, currentUser);
    if (!inScope(scope, transfer.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ chuyển trường nằm ngoài phạm vi của bạn');
    }
    if (transfer.direction !== 'out' || !transfer.child_id) {
      throw ruleViolationError(STUDENT_RECORDS_RULE_CODE, 'Hồ sơ chuyển chỉ có ở học sinh chuyển đi');
    }
    const [row] = await loadMoetChildRows(database, this.protection, [transfer.child_id]);
    if (!row) {
      throw notFoundError('Không tìm thấy hồ sơ học sinh', 'child');
    }
    const createdAt = this.clock.now();
    const name = `ho-so-chuyen-truong-${fileStamp(createdAt)}`;
    let buffer: Buffer;
    if (format === 'xlsx') {
      buffer = await buildMoetChildFile([row.values]);
    } else {
      const child = await database
        .selectFrom('children')
        .select('status')
        .where('id', '=', transfer.child_id)
        .executeTakeFirstOrThrow();
      const labels = new Map<string, string>(
        MOET_CHILD_COLUMNS.flatMap((column) => [
          [column.key, column.header] as [string, string],
          ...(column.blankAfter ? [[column.blankAfter, `Quận/Huyện cũ (${column.header})`] as [string, string]] : []),
        ]),
      );
      const facts: Array<{ label: string; value: string }> = [
        { label: 'Trường chuyển đến', value: transfer.school_name },
        { label: 'Tỉnh/Thành phố chuyển đến', value: transfer.province_name ?? '' },
        { label: 'Xã/Phường chuyển đến', value: transfer.ward_name ?? '' },
        { label: 'Ngày chuyển', value: formatDate(transfer.transfer_date) },
        { label: 'Lý do', value: transfer.reason ?? '' },
        { label: 'Trạng thái hồ sơ', value: CHILD_STATUS_LABELS[child.status] },
        ...Object.entries(row.values)
          .filter(([key, value]) => value && key !== 'row_number')
          .map(([key, value]) => ({ label: labels.get(key) ?? key, value })),
      ];
      buffer = await buildTableFile(
        'pdf',
        [
          {
            title: 'Hồ sơ chuyển trường',
            heading: ['HỒ SƠ HỌC SINH CHUYỂN TRƯỜNG', `${transfer.full_name} – ${formatDate(transfer.dob)}`],
            columns: [
              { key: 'label', label: 'Thông tin', width: 40 },
              { key: 'value', label: 'Nội dung', width: 60 },
            ],
            rows: facts,
          },
        ],
        createdAt,
      );
    }
    return logExportedFile(database, currentUser, {
      reportCode: 'student-transfer-dossier',
      fileName: `${name}.${format}`,
      buffer,
      rowCount: 1,
      orgUnitIds: [transfer.org_unit_id],
      filters: { transfer_id: transfer.id, format },
      ipAddress,
      contentType: CONTENT_TYPES[format],
    });
  }

  // Tiếp nhận chuyển đến từ tệp hồ sơ chuyển theo mẫu của Bộ: kiểm tra toàn bộ tệp, có dòng lỗi thì không tạo hồ sơ nào
  async receive(
    currentUser: CurrentUser,
    accessToken: string,
    input: { orgUnitId: string; place: TransferPlace; fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ): Promise<{ created: number; errors: RowError[]; transfers: Array<{ id: string; child_id: string }> }> {
    const { database } = await this.currentSchoolYear.require();
    const validation = await this.moet.validateChildren(database, currentUser, input.orgUnitId, input.body, {
      transferIn: true,
    });
    if (validation.errors.length > 0 || validation.plans.length === 0) {
      return {
        created: 0,
        errors: validation.errors.length
          ? validation.errors
          : [{ row: 0, column: null, message: 'Tệp không có học sinh nào để tiếp nhận' }],
        transfers: [],
      };
    }
    const storageKey = `import/${randomUUID()}`;
    await this.fileStorage.put(storageKey, input.body, XLSX_TYPE);
    const { fileId, jobId } = await database.transaction().execute(async (transaction) => {
      const file = await transaction
        .insertInto('files')
        .values({
          org_unit_id: input.orgUnitId,
          purpose: 'import',
          file_name: input.fileName.slice(0, 200),
          content_type: XLSX_TYPE,
          size_bytes: input.body.length,
          storage_key: storageKey,
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const job = await transaction
        .insertInto('data_import_jobs')
        .values({
          import_type: 'moet_children',
          org_unit_id: input.orgUnitId,
          preview: JSON.stringify(validation.preview),
          file_id: file.id,
          status: 'validated',
          total_rows: validation.totalRows,
          error_rows: 0,
          errors: JSON.stringify([]),
          created_by: origin.actorUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return { fileId: file.id, jobId: job.id };
    });
    const childIds = await this.moet.commitChildren(database, accessToken, validation.plans, jobId, origin, {
      asDraft: true,
    });
    const transfers = await database.transaction().execute(async (transaction) => {
      const rows: Array<{ id: string; child_id: string }> = [];
      for (const [index, childId] of childIds.entries()) {
        const plan = validation.plans[index];
        const created = await transaction
          .insertInto('student_transfers')
          .values({
            direction: 'in',
            status: 'received',
            child_id: childId,
            org_unit_id: plan?.org_unit_id ?? input.orgUnitId,
            full_name: plan?.full_name ?? '',
            dob: plan?.dob ?? null,
            ...input.place,
            requested_by_name: origin.actorName,
            decided_by: origin.actorUserId,
            decided_by_name: origin.actorName,
            decided_at: this.clock.now(),
            file_id: fileId,
            created_by: origin.actorUserId,
          })
          .returning(['id', 'child_id'])
          .executeTakeFirstOrThrow();
        rows.push({ id: created.id, child_id: childId });
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: plan?.org_unit_id ?? input.orgUnitId,
          entityName: 'student_transfers',
          entityId: created.id,
          action: 'create',
          before: null,
          after: { direction: 'in', child_id: childId, import_job_id: jobId, ...input.place },
        });
      }
      return rows;
    });
    return { created: transfers.length, errors: [], transfers };
  }
}

function readPlace(body: RequestBody, errors: FieldError[], today: string): TransferPlace {
  const text = (field: string, maximum: number, required: boolean) => {
    const value = body?.[field];
    if (value === undefined || value === null || value === '') {
      if (required) {
        errors.push({ field, message: 'Bắt buộc nhập' });
      }
      return null;
    }
    if (typeof value !== 'string' || value.trim().length > maximum) {
      errors.push({ field, message: `Tối đa ${maximum} ký tự` });
      return null;
    }
    return value.trim() || null;
  };
  const date = body?.transfer_date;
  let transferDate = today;
  if (date !== undefined && date !== null && date !== '') {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      errors.push({ field: 'transfer_date', message: 'Ngày dạng YYYY-MM-DD' });
    } else {
      transferDate = date;
    }
  }
  return {
    school_name: text('school_name', MAXIMUM_TEXT, true) ?? '',
    province_name: text('province_name', MAXIMUM_TEXT, false),
    ward_name: text('ward_name', MAXIMUM_TEXT, false),
    transfer_date: transferDate,
    reason: text('reason', MAXIMUM_REASON, false),
  };
}

@Controller('student-transfers')
export class StudentTransfersController {
  constructor(
    private readonly service: StudentTransfersService,
    private readonly clock: Clock,
  ) {}

  private today() {
    return VIETNAM_DATE.format(this.clock.now());
  }

  @Get()
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.page_size ?? 20);
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: 'page', message: 'Số trang bắt đầu từ 1' });
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_LIMIT) {
      errors.push({ field: 'page_size', message: `Cỡ trang từ 1 đến ${PAGE_LIMIT}` });
    }
    const direction = query.direction || null;
    if (direction && !DIRECTIONS.includes(direction as StudentTransferDirection)) {
      errors.push({ field: 'direction', message: 'Chiều chuyển là out hoặc in' });
    }
    const status = query.status || null;
    if (status && !STATUSES.includes(status as StudentTransferStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    const q = query.q?.trim() || null;
    if (q && q.length > 100) {
      errors.push({ field: 'q', message: 'Tối đa 100 ký tự' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.list(
      currentUser,
      {
        direction: direction as StudentTransferDirection | null,
        status: status as StudentTransferStatus | null,
        q,
      },
      page,
      pageSize,
    );
  }

  @Post('out')
  @RequirePermission(PERMISSION_CODES.childManage, PERMISSION_CODES.childApprove)
  requestOut(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.child_id)) {
      errors.push({ field: 'child_id', message: 'Chọn học sinh' });
    }
    const place = readPlace(body, errors, this.today());
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.service.requestOut(currentUser, body?.child_id as string, place, originOf(request, currentUser));
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  approve(
    @Param('id', uuidParameter('Mã hồ sơ chuyển không hợp lệ')) transferId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, MAXIMUM_REASON) : null;
    return this.service.decide(currentUser, transferId, { approve: true, note }, originOf(request, currentUser));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childApprove)
  reject(
    @Param('id', uuidParameter('Mã hồ sơ chuyển không hợp lệ')) transferId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, MAXIMUM_REASON) : null;
    return this.service.decide(currentUser, transferId, { approve: false, note }, originOf(request, currentUser));
  }

  @Get(':id/dossier')
  @RequirePermission(PERMISSION_CODES.dataExport)
  async dossier(
    @Param('id', uuidParameter('Mã hồ sơ chuyển không hợp lệ')) transferId: string,
    @Query('format') format: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.nationalIdView)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Hồ sơ chuyển có số định danh, cần quyền xem số định danh');
    }
    if (format !== 'xlsx' && format !== 'pdf') {
      throw validationError([{ field: 'format', message: 'Định dạng là xlsx hoặc pdf' }]);
    }
    sendWorkbook(response, await this.service.dossier(currentUser, transferId, format, request.ip ?? null));
  }

  @Post('in')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.childManage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_IMPORT_BYTES, files: 1 } }))
  receive(
    @UploadedFile() file: UploadedPart | undefined,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!file || file.size === 0) {
      errors.push({ field: 'file', message: 'Chọn tệp hồ sơ chuyển theo mẫu của Bộ' });
    }
    if (!isUuid(body?.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Chọn đơn vị tiếp nhận' });
    }
    const place = readPlace(body, errors, this.today());
    if (place.transfer_date > this.today()) {
      errors.push({ field: 'transfer_date', message: 'Ngày chuyển đến không sau hôm nay' });
    }
    if (errors.length > 0 || !file) {
      throw validationError(errors);
    }
    return this.service.receive(
      currentUser,
      readBearerToken(request.header('authorization')),
      {
        orgUnitId: body?.org_unit_id as string,
        place,
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        body: file.buffer,
      },
      originOf(request, currentUser),
    );
  }
}
