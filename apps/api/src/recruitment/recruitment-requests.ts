import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { RecruitmentRequestStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readOptionalUuid, readRequiredInteger, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { check, optionalEnumQuery, optionalUuidQuery } from '../inventory/inventory-common.js';
import { hrRecipients, LONG_TEXT, readDateValue, readString, RecruitmentAccess } from './recruitment-common.js';

// Đề nghị tuyển dụng (P18-01; BR-80; YCTD-87). Nhân sự (VT-06) hoặc quản lý đơn vị (VT-03) lập đề nghị cho đơn vị trong
// phạm vi; đề nghị trình Ban Giám hiệu ngay: Hiệu trưởng (toàn trường) hoặc Phó Hiệu trưởng trong phạm vi đơn vị duyệt hoặc
// từ chối kèm lý do; người lập không tự duyệt. Đề nghị không có giá trị tiền nên không áp hạn mức phê duyệt. Mọi lần duyệt,
// từ chối ghi nhật ký thao tác kèm người duyệt, thời điểm, vị trí, số lượng và lý do (BR-80). Người lập hoặc nhân sự đóng
// đề nghị khi đã tuyển đủ hoặc không cần nữa; đóng đề nghị thì đóng các tin tuyển dụng còn mở của đề nghị
export const REQUEST_STATUSES: RecruitmentRequestStatus[] = ['pending', 'approved', 'rejected', 'closed'];
const REQUEST_VIEWS = ['mine', 'pending', 'all'] as const;
type RequestView = (typeof REQUEST_VIEWS)[number];
const VIEW_PERMISSIONS = [
  PERMISSION_CODES.recruitmentRequestCreate,
  PERMISSION_CODES.recruitmentRequestApprove,
  PERMISSION_CODES.recruitmentManage,
  PERMISSION_CODES.interviewManage,
];

export interface RecruitmentRequestInput {
  org_unit_id: string | null;
  position: string;
  quantity: number;
  requirements: string;
  reason: string;
  needed_by: string | null;
}

@Injectable()
export class RecruitmentRequestsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: RecruitmentAccess,
    private readonly clock: Clock,
  ) {}

  async create(currentUser: CurrentUser, input: RecruitmentRequestInput, origin: ChangeOrigin) {
    const scope = await this.access.requireScope(
      currentUser,
      [PERMISSION_CODES.recruitmentRequestCreate],
      'Bạn không có quyền lập đề nghị tuyển dụng',
    );
    let orgUnitId = input.org_unit_id;
    if (!orgUnitId) {
      if (scope.wholeSchool || scope.orgUnitIds.length !== 1) {
        throw validationError([{ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị đề nghị' }]);
      }
      orgUnitId = scope.orgUnitIds[0] ?? '';
    } else if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không lập được đề nghị tuyển dụng cho đơn vị này');
    }
    if (input.needed_by && input.needed_by < VIETNAM_DATE.format(this.clock.now())) {
      throw validationError([{ field: 'needed_by', message: 'Thời hạn cần người không trước hôm nay' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select(['id', 'status'])
      .where('id', '=', orgUnitId)
      .executeTakeFirst();
    if (!unit || unit.status !== 'active') {
      throw validationError([{ field: 'org_unit_id', message: 'Đơn vị không tồn tại hoặc đã ngừng hoạt động' }]);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const request = await transaction
        .insertInto('recruitment_requests')
        .values({
          code: await nextDocumentCode(transaction, 'recruitment_request', 'DNTD'),
          org_unit_id: orgUnitId,
          position: input.position,
          quantity: input.quantity,
          requirements: input.requirements,
          reason: input.reason,
          needed_by: input.needed_by,
          requester_id: currentUser.id,
          requester_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const root = await transaction
        .selectFrom('org_units')
        .select('id')
        .where('unit_type', '=', 'truong_chinh')
        .executeTakeFirst();
      await queueNotification(transaction, {
        orgUnitId,
        templateCode: 'recruitment_request_pending',
        title: 'Có đề nghị tuyển dụng cần phê duyệt',
        body: `${request.code} của ${origin.actorName}: ${input.quantity} ${input.position}. ${input.reason}`,
        targetType: 'recruitment_requests',
        targetId: request.id,
        recipients: [
          { roleCode: 'VT-15', orgUnitId, channel: 'in_app' },
          ...(root ? [{ roleCode: 'VT-02', orgUnitId: root.id, channel: 'in_app' as const }] : []),
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'recruitment_requests',
        entityId: request.id,
        action: 'create',
        before: null,
        after: request,
      });
      return request;
    });
    return this.read(currentUser, created.id);
  }

  async list(
    currentUser: CurrentUser,
    filter: { view: RequestView; status: RecruitmentRequestStatus | null; orgUnitId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = this.requestQuery(database).orderBy('recruitment_requests.created_at', 'desc');
    if (filter.view === 'mine') {
      query = query.where('recruitment_requests.requester_id', '=', currentUser.id);
    } else {
      const scope = await this.access.requireScope(
        currentUser,
        filter.view === 'pending' ? [PERMISSION_CODES.recruitmentRequestApprove] : VIEW_PERMISSIONS,
        'Bạn không có quyền xem đề nghị tuyển dụng',
      );
      if (!scope.wholeSchool) {
        query = query.where('recruitment_requests.org_unit_id', 'in', scope.orgUnitIds);
      }
      if (filter.view === 'pending') {
        query = query
          .where('recruitment_requests.status', '=', 'pending')
          .where('recruitment_requests.requester_id', '<>', currentUser.id);
      }
    }
    if (filter.status) {
      query = query.where('recruitment_requests.status', '=', filter.status);
    }
    if (filter.orgUnitId) {
      query = query.where('recruitment_requests.org_unit_id', '=', filter.orgUnitId);
    }
    return (await query.execute()).map((row) => this.toView(row));
  }

  async read(currentUser: CurrentUser, requestId: string) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.requestQuery(database)
      .where('recruitment_requests.id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị tuyển dụng', 'recruitment_request');
    }
    if (
      request.requester_id !== currentUser.id &&
      !(await this.access.canAccess(currentUser, VIEW_PERMISSIONS, request.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem đề nghị tuyển dụng này');
    }
    return this.toView(request);
  }

  async decide(
    currentUser: CurrentUser,
    requestId: string,
    decision: { approve: boolean; reason: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, requestId);
    await this.access.assertUnit(
      currentUser,
      [PERMISSION_CODES.recruitmentRequestApprove],
      request.org_unit_id,
      'Bạn không có quyền duyệt đề nghị tuyển dụng của đơn vị này',
    );
    if (request.status !== 'pending') {
      throw ruleViolationError('BR-80', 'Đề nghị tuyển dụng này không chờ duyệt');
    }
    if (request.requester_id === currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Người duyệt không được là người lập đề nghị');
    }
    if (!decision.approve && !decision.reason) {
      throw validationError([{ field: 'reason', message: 'Bắt buộc nhập lý do từ chối' }]);
    }
    const status = decision.approve ? 'approved' : 'rejected';
    const decidedAt = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('recruitment_requests')
        .set({
          status,
          approved_by: origin.actorUserId,
          approver_name: origin.actorName,
          approved_at: decidedAt,
          reject_reason: decision.approve ? null : decision.reason,
          updated_at: decidedAt,
        })
        .where('id', '=', requestId)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-80', 'Đề nghị tuyển dụng đã được người khác xử lý');
      }
      await queueNotification(transaction, {
        orgUnitId: request.org_unit_id,
        templateCode: decision.approve ? 'recruitment_request_approved' : 'recruitment_request_rejected',
        title: decision.approve ? 'Đề nghị tuyển dụng đã được duyệt' : 'Đề nghị tuyển dụng bị từ chối',
        body: `${request.code}: ${request.quantity} ${request.position}${decision.reason ? `. Lý do: ${decision.reason}` : ''}`,
        targetType: 'recruitment_requests',
        targetId: requestId,
        recipients: [
          { userId: request.requester_id, channel: 'in_app' },
          ...(decision.approve ? await hrRecipients(transaction, request.org_unit_id) : []),
        ],
      });
      // BR-80: người phê duyệt, thời điểm, giá trị chứng từ (vị trí, số lượng) và lý do từ chối
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'recruitment_requests',
        entityId: requestId,
        action: 'update',
        before: { status: 'pending' },
        after: {
          status,
          approved_by: origin.actorUserId,
          approver_name: origin.actorName,
          approved_at: decidedAt.toISOString(),
          position: request.position,
          quantity: request.quantity,
          reason: decision.reason,
        },
      });
    });
    return this.read(currentUser, requestId);
  }

  // Đóng đề nghị đang chờ duyệt hoặc đã duyệt; tin tuyển dụng còn mở của đề nghị cũng đóng theo
  async close(currentUser: CurrentUser, requestId: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await this.load(database, requestId);
    if (
      request.requester_id !== currentUser.id &&
      !(await this.access.canAccess(currentUser, [PERMISSION_CODES.recruitmentManage], request.org_unit_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người lập hoặc nhân sự của đơn vị đóng được đề nghị này');
    }
    if (request.status !== 'pending' && request.status !== 'approved') {
      throw ruleViolationError('BR-80', 'Chỉ đóng được đề nghị đang chờ duyệt hoặc đã duyệt');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('recruitment_requests')
        .set({ status: 'closed', closed_by: origin.actorUserId, closed_at: now, close_reason: reason, updated_at: now })
        .where('id', '=', requestId)
        .where('status', '=', request.status)
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-80', 'Đề nghị tuyển dụng đã được người khác xử lý');
      }
      const postings = await transaction
        .updateTable('job_postings')
        .set({ status: 'closed', closed_by: origin.actorUserId, closed_at: now, updated_at: now })
        .where('request_id', '=', requestId)
        .where('status', 'in', ['draft', 'published'])
        .returning('id')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'recruitment_requests',
        entityId: requestId,
        action: 'update',
        before: { status: request.status },
        after: { status: 'closed', reason, closed_posting_ids: postings.map((posting) => posting.id) },
      });
    });
    return this.read(currentUser, requestId);
  }

  async load(database: Kysely<SchoolYearDatabase>, requestId: string) {
    const request = await database
      .selectFrom('recruitment_requests')
      .selectAll()
      .where('id', '=', requestId)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị tuyển dụng', 'recruitment_request');
    }
    return request;
  }

  // Kèm tên đơn vị và số ứng viên đã tuyển qua các tin của đề nghị để so với số lượng cần
  private requestQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('recruitment_requests')
      .innerJoin('org_units', 'org_units.id', 'recruitment_requests.org_unit_id')
      .selectAll('recruitment_requests')
      .select((expression) => [
        'org_units.name as unit_name',
        expression
          .selectFrom('candidates')
          .innerJoin('job_postings', 'job_postings.id', 'candidates.posting_id')
          .select(sql<number>`count(*)::int`.as('count'))
          .whereRef('job_postings.request_id', '=', 'recruitment_requests.id')
          .where('candidates.status', '=', 'hired')
          .as('hired_count'),
      ]);
  }

  private toView<Row extends { hired_count: number | null }>(row: Row) {
    return { ...row, hired_count: Number(row.hired_count ?? 0) };
  }
}

@Controller('recruitment-requests')
export class RecruitmentRequestsController {
  constructor(private readonly requests: RecruitmentRequestsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input: RecruitmentRequestInput = {
      org_unit_id: readOptionalUuid(body, 'org_unit_id', errors) ?? null,
      position: readString(body, 'position', errors, { required: true }) ?? '',
      quantity: readRequiredInteger(body, 'quantity', errors, { min: 1, max: 1000 }),
      requirements: readString(body, 'requirements', errors, { required: true, max: LONG_TEXT }) ?? '',
      reason: readString(body, 'reason', errors, { required: true, max: LONG_TEXT }) ?? '',
      needed_by: readDateValue(body, 'needed_by', errors, false),
    };
    check(errors);
    return this.requests.create(currentUser, input, originOf(request, currentUser));
  }

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.requests.list(currentUser, {
      view: optionalEnumQuery(query.view, 'view', REQUEST_VIEWS) ?? 'mine',
      status: optionalEnumQuery(query.status, 'status', REQUEST_STATUSES),
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
    });
  }

  @Get(':id')
  read(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.requests.read(currentUser, requestId);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.requests.decide(
      currentUser,
      requestId,
      { approve: true, reason: null },
      originOf(request, currentUser),
    );
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readString(body, 'reason', errors, { required: true, max: LONG_TEXT });
    check(errors);
    return this.requests.decide(currentUser, requestId, { approve: false, reason }, originOf(request, currentUser));
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã đề nghị không hợp lệ')) requestId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readString(body, 'reason', errors, { required: true, max: LONG_TEXT }) ?? '';
    check(errors);
    return this.requests.close(currentUser, requestId, reason, originOf(request, currentUser));
  }
}
