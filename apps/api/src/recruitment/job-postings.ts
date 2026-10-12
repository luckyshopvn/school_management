import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { JobPostingStatus, SchoolYearDatabase } from '@school-management/database';
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
import { notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { check, optionalEnumQuery, optionalUuidQuery } from '../inventory/inventory-common.js';
import { LONG_TEXT, readDateValue, readString, RecruitmentAccess } from './recruitment-common.js';

// Tin tuyển dụng (P18-02; BR-69, BR-75; YCTD-87). Nhân sự (VT-06) soạn tin từ đề nghị đã được Ban Giám hiệu duyệt, sửa
// khi tin chưa đóng, công bố và đóng tin. Phạm vi công bố của tin tuyển dụng là công khai: tin đã công bố và còn hạn nộp
// hiện trên trang tuyển dụng không cần tài khoản (bổ sung BR-69). Hết hạn nộp thì trang công khai không hiện tin và không
// nhận hồ sơ; tin không xóa, chỉ đóng (BR-75)
export const POSTING_STATUSES: JobPostingStatus[] = ['draft', 'published', 'closed'];
const VIEW_PERMISSIONS = [
  PERMISSION_CODES.recruitmentManage,
  PERMISSION_CODES.interviewManage,
  PERMISSION_CODES.recruitmentRequestApprove,
];

interface PostingInput {
  title: string;
  description: string;
  requirements: string;
  deadline: string;
}

@Injectable()
export class JobPostingsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: RecruitmentAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async create(currentUser: CurrentUser, input: PostingInput & { request_id: string }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const request = await database
      .selectFrom('recruitment_requests')
      .select(['id', 'code', 'org_unit_id', 'status'])
      .where('id', '=', input.request_id)
      .executeTakeFirst();
    if (!request) {
      throw notFoundError('Không tìm thấy đề nghị tuyển dụng', 'recruitment_request');
    }
    await this.assertManage(currentUser, request.org_unit_id);
    if (request.status !== 'approved') {
      throw ruleViolationError('BR-80', 'Chỉ soạn tin tuyển dụng từ đề nghị đã được Ban Giám hiệu duyệt');
    }
    this.assertDeadline(input.deadline);
    const created = await database.transaction().execute(async (transaction) => {
      const posting = await transaction
        .insertInto('job_postings')
        .values({
          request_id: request.id,
          org_unit_id: request.org_unit_id,
          title: input.title,
          description: input.description,
          requirements: input.requirements,
          deadline: input.deadline,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: request.org_unit_id,
        entityName: 'job_postings',
        entityId: posting.id,
        action: 'create',
        before: null,
        after: posting,
      });
      return posting;
    });
    return this.read(currentUser, created.id);
  }

  async update(currentUser: CurrentUser, postingId: string, input: PostingInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await this.load(database, postingId);
    await this.assertManage(currentUser, posting.org_unit_id);
    if (posting.status === 'closed') {
      throw ruleViolationError('BR-75', 'Tin tuyển dụng đã đóng, không sửa được');
    }
    this.assertDeadline(input.deadline);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('job_postings')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', postingId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: posting.org_unit_id,
        entityName: 'job_postings',
        entityId: postingId,
        action: 'update',
        before: posting,
        after: input,
      });
    });
    return this.read(currentUser, postingId);
  }

  async publish(currentUser: CurrentUser, postingId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await this.load(database, postingId);
    await this.assertManage(currentUser, posting.org_unit_id);
    if (posting.status !== 'draft') {
      throw ruleViolationError('BR-69', 'Chỉ công bố được tin đang soạn');
    }
    const request = await database
      .selectFrom('recruitment_requests')
      .select('status')
      .where('id', '=', posting.request_id)
      .executeTakeFirstOrThrow();
    if (request.status !== 'approved') {
      throw ruleViolationError('BR-80', 'Đề nghị tuyển dụng của tin không còn ở trạng thái đã duyệt');
    }
    if (posting.deadline < this.today()) {
      throw validationError([{ field: 'deadline', message: 'Hạn nộp hồ sơ đã qua, sửa hạn nộp trước khi công bố' }]);
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const claimed = await transaction
        .updateTable('job_postings')
        .set({ status: 'published', published_at: now, published_by: origin.actorUserId, updated_at: now })
        .where('id', '=', postingId)
        .where('status', '=', 'draft')
        .returning('id')
        .executeTakeFirst();
      if (!claimed) {
        throw ruleViolationError('BR-69', 'Tin đã được công bố hoặc đóng');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: posting.org_unit_id,
        entityName: 'job_postings',
        entityId: postingId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'published', scope: 'public' },
      });
    });
    return this.read(currentUser, postingId);
  }

  async close(currentUser: CurrentUser, postingId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await this.load(database, postingId);
    await this.assertManage(currentUser, posting.org_unit_id);
    if (posting.status === 'closed') {
      throw ruleViolationError('BR-75', 'Tin tuyển dụng đã đóng');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('job_postings')
        .set({ status: 'closed', closed_at: now, closed_by: origin.actorUserId, updated_at: now })
        .where('id', '=', postingId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: posting.org_unit_id,
        entityName: 'job_postings',
        entityId: postingId,
        action: 'update',
        before: { status: posting.status },
        after: { status: 'closed' },
      });
    });
    return this.read(currentUser, postingId);
  }

  async list(
    currentUser: CurrentUser,
    filter: { status: JobPostingStatus | null; requestId: string | null; orgUnitId: string | null },
  ) {
    const scope = await this.access.requireScope(
      currentUser,
      VIEW_PERMISSIONS,
      'Bạn không có quyền xem tin tuyển dụng',
    );
    const { database } = await this.currentSchoolYear.require();
    let query = this.postingQuery(database).orderBy('job_postings.created_at', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('job_postings.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.status) {
      query = query.where('job_postings.status', '=', filter.status);
    }
    if (filter.requestId) {
      query = query.where('job_postings.request_id', '=', filter.requestId);
    }
    if (filter.orgUnitId) {
      query = query.where('job_postings.org_unit_id', '=', filter.orgUnitId);
    }
    return (await query.execute()).map((row) => this.toView(row));
  }

  async read(currentUser: CurrentUser, postingId: string) {
    const { database } = await this.currentSchoolYear.require();
    const posting = await this.postingQuery(database).where('job_postings.id', '=', postingId).executeTakeFirst();
    if (!posting) {
      throw notFoundError('Không tìm thấy tin tuyển dụng', 'job_posting');
    }
    await this.access.assertUnit(
      currentUser,
      VIEW_PERMISSIONS,
      posting.org_unit_id,
      'Bạn không được xem tin tuyển dụng này',
    );
    return this.toView(posting);
  }

  private toView<Row extends { candidate_count: number | null; deadline: string; status: JobPostingStatus }>(row: Row) {
    return {
      ...row,
      candidate_count: Number(row.candidate_count ?? 0),
      // Tin đã công bố và còn hạn thì hiện trên trang công khai
      is_open: row.status === 'published' && row.deadline >= this.today(),
    };
  }

  private postingQuery(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('job_postings')
      .innerJoin('recruitment_requests', 'recruitment_requests.id', 'job_postings.request_id')
      .innerJoin('org_units', 'org_units.id', 'job_postings.org_unit_id')
      .selectAll('job_postings')
      .select((expression) => [
        'recruitment_requests.code as request_code',
        'recruitment_requests.position',
        'recruitment_requests.quantity',
        'org_units.name as unit_name',
        expression
          .selectFrom('candidates')
          .select(sql<number>`count(*)::int`.as('count'))
          .whereRef('candidates.posting_id', '=', 'job_postings.id')
          .as('candidate_count'),
      ]);
  }

  private async load(database: Kysely<SchoolYearDatabase>, postingId: string) {
    const posting = await database
      .selectFrom('job_postings')
      .selectAll()
      .where('id', '=', postingId)
      .executeTakeFirst();
    if (!posting) {
      throw notFoundError('Không tìm thấy tin tuyển dụng', 'job_posting');
    }
    return posting;
  }

  private assertDeadline(deadline: string) {
    if (deadline < this.today()) {
      throw validationError([{ field: 'deadline', message: 'Hạn nộp hồ sơ không trước hôm nay' }]);
    }
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    if (!(await this.access.canAccess(currentUser, [PERMISSION_CODES.recruitmentManage], orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý tin tuyển dụng của đơn vị này');
    }
  }
}

function readPostingInput(body: RequestBody, errors: FieldError[]): PostingInput {
  return {
    title: readString(body, 'title', errors, { required: true }) ?? '',
    description: readString(body, 'description', errors, { required: true, max: LONG_TEXT }) ?? '',
    requirements: readString(body, 'requirements', errors, { required: true, max: LONG_TEXT }) ?? '',
    deadline: readDateValue(body, 'deadline', errors, true) ?? '',
  };
}

@Controller('job-postings')
export class JobPostingsController {
  constructor(private readonly postings: JobPostingsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      request_id: readRequiredUuid(body, 'request_id', errors, 'Bắt buộc chọn đề nghị tuyển dụng đã duyệt'),
      ...readPostingInput(body, errors),
    };
    check(errors);
    return this.postings.create(currentUser, input, originOf(request, currentUser));
  }

  @Get()
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.postings.list(currentUser, {
      status: optionalEnumQuery(query.status, 'status', POSTING_STATUSES),
      requestId: optionalUuidQuery(query.request_id, 'request_id'),
      orgUnitId: optionalUuidQuery(query.org_unit_id, 'org_unit_id'),
    });
  }

  @Get(':id')
  read(
    @Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.postings.read(currentUser, postingId);
  }

  @Put(':id')
  update(
    @Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = readPostingInput(body, errors);
    check(errors);
    return this.postings.update(currentUser, postingId, input, originOf(request, currentUser));
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.postings.publish(currentUser, postingId, originOf(request, currentUser));
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã tin tuyển dụng không hợp lệ')) postingId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.postings.close(currentUser, postingId, originOf(request, currentUser));
  }
}
