import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { SchoolSplitStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request, Response } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { ChildDataProtection } from '../common/child-data-protection.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { fileStamp, sendWorkbook } from '../facilities/facilities-workbook.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { childMoetSheet, moetWorkbookBuffer, staffMoetSheet } from '../imports/moet-export.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// 1.8 Tách trường theo Sở, bản chạy nội bộ (DT-16 phần 16e; quyết định của Eric ngày 2026-10-16: tính năng cần hệ thống bên
// ngoài thì làm bản chạy nội bộ). Yêu cầu tách hồ sơ ghi trường đến, lý do, danh sách học sinh và nhân sự được tách. Hồ sơ gửi
// đi là tệp theo mẫu CSDL ngành của Bộ (82 cột học sinh, 75 cột nhân sự) để trường đến nhập ở màn hình nhập dữ liệu của họ;
// hệ thống không truyền dữ liệu sang trường khác. "Xác nhận đi" và "Đánh dấu đã tiếp nhận" là trạng thái người dùng đánh dấu
// kèm ngày và người đánh dấu. Xác nhận đi không tự đổi trạng thái hồ sơ học sinh, nhân sự: chuyển đi, thôi việc làm ở 4.2 Biến
// động học sinh và hồ sơ nhân sự như mọi trường hợp. Chỗ nối để thay bằng truyền thật sau này là `SchoolSplitTransport`.
// Cần quyền cập nhật hồ sơ trường và phạm vi toàn trường; tải tệp hồ sơ cần thêm quyền xuất dữ liệu (BR-74)
const MANAGE = PERMISSION_CODES.schoolProfileManage;
const RULE_CODE = 'YCTD-124';
const MAXIMUM_SUBJECTS = 2000;
const MAXIMUM_TEXT = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SchoolSplitInput {
  destination_school: string;
  destination_code: string | null;
  reason: string;
  child_ids: string[];
  staff_ids: string[];
}

// Chỗ nối truyền hồ sơ sang trường đến. Bản nội bộ chỉ tạo tệp để tải về; khi Sở có giao diện lập trình thì thay lớp này
export interface SchoolSplitTransport {
  readonly sendsElectronically: boolean;
}

export const LOCAL_SCHOOL_SPLIT_TRANSPORT: SchoolSplitTransport = { sendsElectronically: false };

function readText(body: RequestBody, field: string, errors: FieldError[], required: boolean): string | null {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > MAXIMUM_TEXT) {
    errors.push({ field, message: `Chữ, tối đa ${MAXIMUM_TEXT} ký tự` });
    return null;
  }
  return value.trim();
}

function readIds(body: RequestBody, field: string, errors: FieldError[]): string[] {
  const value = body?.[field] ?? [];
  if (
    !Array.isArray(value) ||
    value.length > MAXIMUM_SUBJECTS ||
    value.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))
  ) {
    errors.push({ field, message: `Danh sách mã, tối đa ${MAXIMUM_SUBJECTS}` });
    return [];
  }
  return [...new Set(value as string[])];
}

export function readSchoolSplitInput(body: RequestBody, errors: FieldError[]): SchoolSplitInput {
  const input = {
    destination_school: readText(body, 'destination_school', errors, true) ?? '',
    destination_code: readText(body, 'destination_code', errors, false),
    reason: readText(body, 'reason', errors, true) ?? '',
    child_ids: readIds(body, 'child_ids', errors),
    staff_ids: readIds(body, 'staff_ids', errors),
  };
  if (errors.length === 0 && input.child_ids.length === 0 && input.staff_ids.length === 0) {
    errors.push({ field: 'child_ids', message: 'Chọn ít nhất một học sinh hoặc nhân sự' });
  }
  return input;
}

const REQUEST_COLUMNS = [
  'id',
  'code',
  'destination_school',
  'destination_code',
  'reason',
  'status',
  'confirmed_at',
  'confirmed_by',
  'received_at',
  'received_by',
  'received_note',
  'created_by',
  'created_at',
  'updated_at',
] as const;

@Injectable()
export class SchoolSplitsService {
  readonly transport: SchoolSplitTransport = LOCAL_SCHOOL_SPLIT_TRANSPORT;

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly protection: ChildDataProtection,
    private readonly clock: Clock,
  ) {}

  private async database(currentUser: CurrentUser): Promise<Kysely<SchoolYearDatabase>> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, MANAGE);
    if (!scope.wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người có phạm vi toàn trường làm tách trường');
    }
    return (await this.currentSchoolYear.require()).database;
  }

  async list(currentUser: CurrentUser) {
    const database = await this.database(currentUser);
    const requests = await database
      .selectFrom('school_split_requests')
      .select(REQUEST_COLUMNS)
      .orderBy('created_at', 'desc')
      .execute();
    const counts = await database
      .selectFrom('school_split_items')
      .select([
        'request_id',
        (expression) => expression.fn.count<string>('child_id').as('child_count'),
        (expression) => expression.fn.count<string>('staff_id').as('staff_count'),
      ])
      .groupBy('request_id')
      .execute();
    return requests.map((request) => {
      const count = counts.find((item) => item.request_id === request.id);
      return {
        ...request,
        child_count: Number(count?.child_count ?? 0),
        staff_count: Number(count?.staff_count ?? 0),
      };
    });
  }

  async read(currentUser: CurrentUser, requestId: string) {
    const database = await this.database(currentUser);
    const request = await this.find(database, requestId);
    const [children, staff] = await Promise.all([
      database
        .selectFrom('school_split_items')
        .innerJoin('children', 'children.id', 'school_split_items.child_id')
        .leftJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .select([
          'children.id',
          'children.full_name',
          'children.dob',
          'children.moet_student_code',
          'children.status',
          'classes.name as class_name',
        ])
        .where('school_split_items.request_id', '=', requestId)
        .orderBy('classes.name')
        .orderBy('children.full_name')
        .execute(),
      database
        .selectFrom('school_split_items')
        .innerJoin('staff', 'staff.id', 'school_split_items.staff_id')
        .select(['staff.id', 'staff.code', 'staff.full_name', 'staff.moet_staff_code', 'staff.status'])
        .where('school_split_items.request_id', '=', requestId)
        .orderBy('staff.full_name')
        .execute(),
    ]);
    return { ...request, children, staff };
  }

  // Học sinh đang học và nhân sự đang làm việc để chọn vào yêu cầu tách; tìm theo tên, mã
  async candidates(currentUser: CurrentUser, type: 'child' | 'staff', q: string | undefined) {
    const database = await this.database(currentUser);
    const pattern = q ? `%${q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    if (type === 'child') {
      let query = database
        .selectFrom('children')
        .leftJoin('class_enrollments', (join) =>
          join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
        )
        .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
        .select(['children.id', 'children.full_name', 'children.dob', 'classes.name as class_name'])
        .where('children.status', '=', 'active');
      if (pattern) {
        query = query.where((builder) =>
          builder.or([
            builder('children.full_name', 'ilike', pattern),
            builder('children.moet_student_code', 'ilike', pattern),
            builder('classes.name', 'ilike', pattern),
          ]),
        );
      }
      return query.orderBy('classes.name').orderBy('children.full_name').limit(500).execute();
    }
    let query = database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'dob'])
      .where('status', '=', 'active');
    if (pattern) {
      query = query.where((builder) =>
        builder.or([builder('full_name', 'ilike', pattern), builder('code', 'ilike', pattern)]),
      );
    }
    return query.orderBy('full_name').limit(500).execute();
  }

  async create(currentUser: CurrentUser, input: SchoolSplitInput, origin: ChangeOrigin) {
    const database = await this.database(currentUser);
    await this.assertSubjects(database, input);
    const id = await database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('school_split_requests')
        .values({
          code: await nextDocumentCode(transaction, 'school_split', 'TT'),
          destination_school: input.destination_school,
          destination_code: input.destination_code,
          reason: input.reason,
          created_by: origin.actorUserId,
        })
        .returning(REQUEST_COLUMNS)
        .executeTakeFirstOrThrow();
      await this.replaceItems(transaction, created.id, input);
      await this.audit(transaction, origin, created.id, 'create', null, { ...created, ...this.subjects(input) });
      return created.id;
    });
    return this.read(currentUser, id);
  }

  // Sửa trường đến, lý do, danh sách khi chưa xác nhận đi
  async update(currentUser: CurrentUser, requestId: string, input: SchoolSplitInput, origin: ChangeOrigin) {
    const database = await this.database(currentUser);
    const before = await this.find(database, requestId);
    this.assertStatus(before.status, 'draft', 'Yêu cầu đã xác nhận đi, không sửa được');
    await this.assertSubjects(database, input);
    await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('school_split_requests')
        .set({
          destination_school: input.destination_school,
          destination_code: input.destination_code,
          reason: input.reason,
          updated_at: this.clock.now(),
        })
        .where('id', '=', requestId)
        .returning(REQUEST_COLUMNS)
        .executeTakeFirstOrThrow();
      await this.replaceItems(transaction, requestId, input);
      await this.audit(transaction, origin, requestId, 'update', before, { ...updated, ...this.subjects(input) });
    });
    return this.read(currentUser, requestId);
  }

  async remove(currentUser: CurrentUser, requestId: string, origin: ChangeOrigin): Promise<void> {
    const database = await this.database(currentUser);
    const before = await this.find(database, requestId);
    this.assertStatus(before.status, 'draft', 'Yêu cầu đã xác nhận đi, không xóa được; hủy xác nhận trước');
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('school_split_requests').where('id', '=', requestId).execute();
      await this.audit(transaction, origin, requestId, 'delete', before, null);
    });
  }

  // Xác nhận đi, hủy xác nhận, đánh dấu trường đến đã tiếp nhận (trạng thái do người dùng đánh dấu, kèm ngày, người)
  async changeStatus(
    currentUser: CurrentUser,
    requestId: string,
    action: 'confirm' | 'unconfirm' | 'receive',
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.database(currentUser);
    const before = await this.find(database, requestId);
    const now = this.clock.now();
    let changes: Partial<{
      status: SchoolSplitStatus;
      confirmed_at: Date | null;
      confirmed_by: string | null;
      received_at: Date | null;
      received_by: string | null;
      received_note: string | null;
    }>;
    if (action === 'confirm') {
      this.assertStatus(before.status, 'draft', 'Chỉ xác nhận đi yêu cầu chưa xác nhận');
      changes = { status: 'confirmed', confirmed_at: now, confirmed_by: origin.actorUserId };
    } else if (action === 'unconfirm') {
      this.assertStatus(before.status, 'confirmed', 'Chỉ hủy xác nhận yêu cầu đã xác nhận đi, chưa tiếp nhận');
      changes = { status: 'draft', confirmed_at: null, confirmed_by: null };
    } else {
      this.assertStatus(before.status, 'confirmed', 'Chỉ đánh dấu đã tiếp nhận sau khi xác nhận đi');
      changes = { status: 'received', received_at: now, received_by: origin.actorUserId, received_note: note };
    }
    await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('school_split_requests')
        .set({ ...changes, updated_at: now })
        .where('id', '=', requestId)
        .returning(REQUEST_COLUMNS)
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, requestId, 'update', before, updated);
    });
    return this.read(currentUser, requestId);
  }

  // Tệp hồ sơ học sinh (82 cột) hoặc nhân sự (75 cột) của yêu cầu; ghi nhật ký xuất có dữ liệu cá nhân (BR-74)
  async exportFile(
    currentUser: CurrentUser,
    requestId: string,
    subject: 'children' | 'staff',
    ipAddress: string | null,
  ) {
    const database = await this.database(currentUser);
    const request = await this.find(database, requestId);
    const items = await database
      .selectFrom('school_split_items')
      .select(['child_id', 'staff_id'])
      .where('request_id', '=', requestId)
      .execute();
    const ids = items
      .map((item) => (subject === 'children' ? item.child_id : item.staff_id))
      .filter((id): id is string => id !== null);
    if (ids.length === 0) {
      throw ruleViolationError(
        RULE_CODE,
        subject === 'children' ? 'Yêu cầu không có học sinh nào' : 'Yêu cầu không có nhân sự nào',
      );
    }
    const decrypt = (text: string) => this.protection.decrypt(text);
    const sheet =
      subject === 'children'
        ? await childMoetSheet(database, ids, decrypt)
        : await staffMoetSheet(database, ids, decrypt);
    const buffer = await moetWorkbookBuffer(sheet, subject === 'children' ? 'Học sinh' : 'Cán bộ, giáo viên');
    const createdAt = this.clock.now();
    const fileName = `tach-truong-${request.code}-${subject === 'children' ? 'hoc-sinh' : 'nhan-su'}-${fileStamp(createdAt)}.xlsx`;
    const log = await database
      .insertInto('export_logs')
      .values({
        user_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        report_code: subject === 'children' ? 'school-split-children' : 'school-split-staff',
        filters_data: JSON.stringify({ request_id: requestId, code: request.code }),
        org_unit_ids: [],
        row_count: sheet.rows.length,
        contains_personal_data: true,
        file_name: fileName,
        ip_address: ipAddress,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { buffer, fileName, logId: log.id, rowCount: sheet.rows.length };
  }

  private async find(database: Kysely<SchoolYearDatabase>, requestId: string) {
    const request = await database
      .selectFrom('school_split_requests')
      .select(REQUEST_COLUMNS)
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy yêu cầu tách trường', 'school_split_request');
    }
    return request;
  }

  private assertStatus(actual: SchoolSplitStatus, expected: SchoolSplitStatus, message: string): void {
    if (actual !== expected) {
      throw ruleViolationError(RULE_CODE, message);
    }
  }

  // Học sinh, nhân sự phải có trong năm học; không nằm trong yêu cầu khác chưa tiếp nhận
  private async assertSubjects(database: Kysely<SchoolYearDatabase>, input: SchoolSplitInput): Promise<void> {
    const [children, staff] = await Promise.all([
      input.child_ids.length === 0
        ? []
        : database.selectFrom('children').select('id').where('id', 'in', input.child_ids).execute(),
      input.staff_ids.length === 0
        ? []
        : database.selectFrom('staff').select('id').where('id', 'in', input.staff_ids).execute(),
    ]);
    const errors: FieldError[] = [];
    if (children.length !== input.child_ids.length) {
      errors.push({ field: 'child_ids', message: 'Có học sinh không tìm thấy' });
    }
    if (staff.length !== input.staff_ids.length) {
      errors.push({ field: 'staff_ids', message: 'Có nhân sự không tìm thấy' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  private async replaceItems(
    transaction: Transaction<SchoolYearDatabase>,
    requestId: string,
    input: SchoolSplitInput,
  ): Promise<void> {
    await transaction.deleteFrom('school_split_items').where('request_id', '=', requestId).execute();
    const rows = [
      ...input.child_ids.map((childId) => ({ request_id: requestId, child_id: childId, staff_id: null })),
      ...input.staff_ids.map((staffId) => ({ request_id: requestId, child_id: null, staff_id: staffId })),
    ];
    if (rows.length > 0) {
      await transaction.insertInto('school_split_items').values(rows).execute();
    }
  }

  private subjects(input: SchoolSplitInput) {
    return { child_ids: input.child_ids, staff_ids: input.staff_ids };
  }

  private async audit(
    transaction: Transaction<SchoolYearDatabase>,
    origin: ChangeOrigin,
    requestId: string,
    action: 'create' | 'update' | 'delete',
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: null,
      entityName: 'school_split_requests',
      entityId: requestId,
      action,
      before,
      after,
    });
  }
}

@Controller('school-splits')
export class SchoolSplitsController {
  constructor(private readonly splits: SchoolSplitsService) {}

  @Get()
  @RequirePermission(MANAGE)
  list(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.splits.list(currentUser);
  }

  // Khai báo trước ':id' để không bị hiểu là mã yêu cầu
  @Get('candidates')
  @RequirePermission(MANAGE)
  candidates(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    if (query.type !== 'child' && query.type !== 'staff') {
      throw validationError([{ field: 'type', message: 'Loại là child hoặc staff' }]);
    }
    return this.splits.candidates(currentUser, query.type, query.q?.trim() || undefined);
  }

  @Get(':id')
  @RequirePermission(MANAGE)
  read(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.splits.read(currentUser, requestId);
  }

  @Post()
  @RequirePermission(MANAGE)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = readSchoolSplitInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.splits.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(MANAGE)
  update(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readSchoolSplitInput(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.splits.update(currentUser, requestId, input, originOf(request, currentUser));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission(MANAGE)
  async remove(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.splits.remove(currentUser, requestId, originOf(request, currentUser));
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  changeStatus(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const action = body?.action;
    const errors: FieldError[] = [];
    if (action !== 'confirm' && action !== 'unconfirm' && action !== 'receive') {
      errors.push({ field: 'action', message: 'Thao tác là confirm, unconfirm hoặc receive' });
    }
    const note = readText(body, 'note', errors, false);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.splits.changeStatus(
      currentUser,
      requestId,
      action as 'confirm' | 'unconfirm' | 'receive',
      note,
      originOf(request, currentUser),
    );
  }

  @Post(':id/export')
  @HttpCode(200)
  @RequirePermission(MANAGE)
  async exportFile(
    @Param('id', uuidParameter('Mã yêu cầu không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.dataExport)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xuất dữ liệu');
    }
    const subject = body?.subject;
    if (subject !== 'children' && subject !== 'staff') {
      throw validationError([{ field: 'subject', message: 'Hồ sơ là children hoặc staff' }]);
    }
    sendWorkbook(response, await this.splits.exportFile(currentUser, requestId, subject, request.ip ?? null));
  }
}
