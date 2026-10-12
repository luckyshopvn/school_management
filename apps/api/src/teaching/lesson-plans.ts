import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { LessonPlanReviewStage, LessonPlanStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readInteger,
  readOptionalUuid,
  readRequiredInteger,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { LEADER_ROLE, MANAGER_ROLE, TeachingAccess } from './teaching-access.js';
import { check, optionalQueryDate, readDate, readText } from './teaching-fields.js';

// Giáo án (P03-02; BR-64; YCTD-80): giáo viên được phân công lớp soạn giáo án từ bài học của mình hoặc bài học được chia
// sẻ, gửi duyệt; tổ trưởng chuyên môn duyệt trước (chờ quản lý duyệt), quản lý đơn vị duyệt sau và công bố; người duyệt
// trả lại kèm góp ý thì giáo viên sửa và gửi lại. Quản lý đơn vị duyệt được cả giáo án chưa qua tổ trưởng để đơn vị chưa
// có tổ trưởng không bị tắc. Không ai duyệt giáo án của chính mình
const EDITABLE: LessonPlanStatus[] = ['draft', 'returned'];
const STATUSES: LessonPlanStatus[] = ['draft', 'submitted', 'leader_approved', 'approved', 'returned'];

interface PlanInput {
  lesson_id?: string;
  class_id?: string;
  planned_date?: string;
  activities?: string;
  duration_minutes?: number;
  materials?: string | null;
}

@Injectable()
export class LessonPlansService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: TeachingAccess,
    private readonly clock: Clock,
  ) {}

  private async findPlan(database: Kysely<SchoolYearDatabase>, planId: string) {
    const plan = await database.selectFrom('lesson_plans').selectAll().where('id', '=', planId).executeTakeFirst();
    if (!plan) {
      throw notFoundError('Không tìm thấy giáo án', 'lesson_plan');
    }
    return plan;
  }

  // Bài học dùng được cho giáo án của lớp: đang dùng, của mình hoặc được chia sẻ, thuộc đơn vị của lớp hoặc Trường chính
  private async assertUsableLesson(
    database: Kysely<SchoolYearDatabase>,
    currentUser: CurrentUser,
    lessonId: string,
    classUnitId: string,
  ) {
    const lesson = await database.selectFrom('lessons').selectAll().where('id', '=', lessonId).executeTakeFirst();
    const root = await this.access.rootUnitId(database);
    if (
      !lesson ||
      lesson.status !== 'active' ||
      ![classUnitId, root].includes(lesson.org_unit_id) ||
      (lesson.created_by !== currentUser.id && !lesson.is_shared)
    ) {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'lesson_id', message: 'Bài học không dùng được cho lớp này' },
      ]);
    }
    return lesson;
  }

  private async assertTeacherOfClass(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, classId: string) {
    const found = await this.access.findClass(database, classId);
    if (
      !currentUser.hasPermission(PERMISSION_CODES.lessonManage) ||
      !(await this.access.assignmentOf(database, currentUser, classId))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên được phân công lớp soạn giáo án cho lớp');
    }
    return found;
  }

  async create(currentUser: CurrentUser, input: Required<PlanInput>, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.assertTeacherOfClass(currentUser, database, input.class_id);
    await this.assertUsableLesson(database, currentUser, input.lesson_id, found.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('lesson_plans')
        .values({
          lesson_id: input.lesson_id,
          class_id: found.id,
          org_unit_id: found.org_unit_id,
          teacher_id: currentUser.id,
          teacher_name: currentUser.description.full_name,
          planned_date: input.planned_date,
          activities: input.activities,
          duration_minutes: input.duration_minutes,
          materials: input.materials,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.org_unit_id,
        entityName: 'lesson_plans',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async update(currentUser: CurrentUser, planId: string, input: PlanInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.findPlan(database, planId);
    if (before.teacher_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người soạn sửa được giáo án');
    }
    if (!EDITABLE.includes(before.status)) {
      throw ruleViolationError('P03-02', 'Chỉ sửa được giáo án nháp hoặc bị trả lại');
    }
    await this.assertTeacherOfClass(currentUser, database, before.class_id);
    if (input.lesson_id) {
      await this.assertUsableLesson(database, currentUser, input.lesson_id, before.org_unit_id);
    }
    const changes = { ...input };
    delete changes.class_id;
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('lesson_plans')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', planId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'lesson_plans',
        entityId: planId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  async submit(currentUser: CurrentUser, planId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.findPlan(database, planId);
    if (before.teacher_id !== currentUser.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người soạn gửi duyệt được giáo án');
    }
    if (!EDITABLE.includes(before.status)) {
      throw ruleViolationError('P03-02', 'Giáo án đã gửi duyệt hoặc đã duyệt');
    }
    const found = await this.assertTeacherOfClass(currentUser, database, before.class_id);
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('lesson_plans')
        .set({ status: 'submitted', submitted_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', planId)
        .returningAll()
        .executeTakeFirstOrThrow();
      // Tổ trưởng và quản lý của đơn vị nhận thông báo chờ duyệt
      await queueNotification(transaction, {
        orgUnitId: before.org_unit_id,
        templateCode: 'lesson_plan_submitted',
        title: 'Giáo án chờ duyệt',
        body: `${before.teacher_name} gửi giáo án lớp ${found.name} ngày ${before.planned_date}`,
        targetType: 'lesson_plans',
        targetId: planId,
        recipients: [
          { roleCode: LEADER_ROLE, orgUnitId: before.org_unit_id, channel: 'in_app' },
          { roleCode: MANAGER_ROLE, orgUnitId: before.org_unit_id, channel: 'in_app' },
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'lesson_plans',
        entityId: planId,
        action: 'update',
        before: { status: before.status },
        after: { status: 'submitted' },
      });
      return after;
    });
  }

  // Bước duyệt của người dùng với giáo án ở đơn vị: quản lý đơn vị duyệt bước sau, tổ trưởng duyệt bước trước
  private async reviewStage(currentUser: CurrentUser, orgUnitId: string): Promise<LessonPlanReviewStage | null> {
    const permission = PERMISSION_CODES.lessonPlanReview;
    if (this.access.inScope(await this.access.scopeOfRoles(currentUser, [MANAGER_ROLE], permission), orgUnitId)) {
      return 'manager';
    }
    if (this.access.inScope(await this.access.scopeOfRoles(currentUser, [LEADER_ROLE], permission), orgUnitId)) {
      return 'leader';
    }
    return null;
  }

  async review(
    currentUser: CurrentUser,
    planId: string,
    decision: 'approved' | 'returned',
    comment: string | null,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await this.findPlan(database, planId);
    const stage = await this.reviewStage(currentUser, before.org_unit_id);
    if (!stage) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt giáo án của đơn vị này');
    }
    if (before.teacher_id === currentUser.id) {
      throw ruleViolationError('P03-02', 'Không duyệt giáo án của chính mình');
    }
    const reviewable: LessonPlanStatus[] = stage === 'manager' ? ['submitted', 'leader_approved'] : ['submitted'];
    if (!reviewable.includes(before.status)) {
      throw ruleViolationError(
        'P03-02',
        before.status === 'leader_approved'
          ? 'Giáo án đã qua tổ trưởng, chờ quản lý đơn vị duyệt'
          : 'Giáo án không ở trạng thái chờ duyệt',
      );
    }
    const now = this.clock.now();
    const nextStatus: LessonPlanStatus =
      decision === 'returned' ? 'returned' : stage === 'manager' ? 'approved' : 'leader_approved';
    const lesson = await database
      .selectFrom('lessons')
      .select('name')
      .where('id', '=', before.lesson_id)
      .executeTakeFirstOrThrow();
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('lesson_plans')
        .set({
          status: nextStatus,
          review_comment: decision === 'returned' ? comment : (comment ?? before.review_comment),
          updated_at: now,
          ...(stage === 'leader' ? { leader_reviewed_by: currentUser.id, leader_reviewed_at: now } : {}),
          ...(nextStatus === 'approved' ? { approved_by: currentUser.id, approved_at: now } : {}),
        })
        .where('id', '=', planId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('lesson_plan_reviews')
        .values({
          lesson_plan_id: planId,
          reviewer_id: currentUser.id,
          reviewer_name: currentUser.description.full_name,
          stage,
          decision,
          comment,
        })
        .execute();
      const message =
        nextStatus === 'returned'
          ? `Giáo án "${lesson.name}" ngày ${before.planned_date} bị trả lại: ${comment ?? ''}`
          : nextStatus === 'approved'
            ? `Giáo án "${lesson.name}" ngày ${before.planned_date} đã được duyệt và công bố`
            : `Giáo án "${lesson.name}" ngày ${before.planned_date} đã qua tổ trưởng, chờ quản lý đơn vị duyệt`;
      await queueNotification(transaction, {
        orgUnitId: before.org_unit_id,
        templateCode: 'lesson_plan_reviewed',
        title: 'Kết quả duyệt giáo án',
        body: message,
        targetType: 'lesson_plans',
        targetId: planId,
        recipients: [
          { userId: before.teacher_id, channel: 'in_app' },
          ...(nextStatus === 'leader_approved'
            ? [{ roleCode: MANAGER_ROLE, orgUnitId: before.org_unit_id, channel: 'in_app' as const }]
            : []),
        ],
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'lesson_plans',
        entityId: planId,
        action: 'update',
        before: { status: before.status },
        after: { status: nextStatus, review_comment: comment },
      });
      return after;
    });
  }

  // Danh sách giáo án: của tôi; chờ tôi duyệt theo bước; hoặc theo lớp cho người xem được lớp
  async list(
    currentUser: CurrentUser,
    filter: {
      view: 'mine' | 'review' | null;
      classId: string | null;
      from: string | null;
      to: string | null;
      status: LessonPlanStatus | null;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('lesson_plans')
      .innerJoin('lessons', 'lessons.id', 'lesson_plans.lesson_id')
      .innerJoin('classes', 'classes.id', 'lesson_plans.class_id')
      .selectAll('lesson_plans')
      .select(['lessons.name as lesson_name', 'lessons.objectives as lesson_objectives', 'classes.name as class_name'])
      .orderBy('lesson_plans.planned_date', 'desc')
      .orderBy('lesson_plans.created_at', 'desc');
    if (filter.view === 'mine') {
      query = query.where('lesson_plans.teacher_id', '=', currentUser.id);
    } else if (filter.view === 'review') {
      const permission = PERMISSION_CODES.lessonPlanReview;
      const managerScope = await this.access.scopeOfRoles(currentUser, [MANAGER_ROLE], permission);
      const leaderScope = await this.access.scopeOfRoles(currentUser, [LEADER_ROLE], permission);
      const managerUnits = managerScope.wholeSchool ? null : managerScope.orgUnitIds;
      const leaderUnits = leaderScope.wholeSchool ? null : leaderScope.orgUnitIds;
      if (managerUnits?.length === 0 && leaderUnits?.length === 0) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền duyệt giáo án');
      }
      query = query.where('lesson_plans.teacher_id', '<>', currentUser.id).where((expression) => {
        const conditions = [];
        if (managerUnits === null || managerUnits.length > 0) {
          conditions.push(
            expression.and([
              expression('lesson_plans.status', 'in', ['submitted', 'leader_approved']),
              ...(managerUnits ? [expression('lesson_plans.org_unit_id', 'in', managerUnits)] : []),
            ]),
          );
        }
        if (leaderUnits === null || leaderUnits.length > 0) {
          conditions.push(
            expression.and([
              expression('lesson_plans.status', '=', 'submitted'),
              ...(leaderUnits ? [expression('lesson_plans.org_unit_id', 'in', leaderUnits)] : []),
            ]),
          );
        }
        return expression.or(conditions);
      });
    } else {
      if (!filter.classId) {
        throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
          { field: 'class_id', message: 'Chọn lớp hoặc view là mine, review' },
        ]);
      }
      const found = await this.access.findClass(database, filter.classId);
      if (!(await this.access.canViewClass(currentUser, database, found))) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được giáo án của lớp này');
      }
    }
    if (filter.classId) {
      query = query.where('lesson_plans.class_id', '=', filter.classId);
    }
    if (filter.from) {
      query = query.where('lesson_plans.planned_date', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('lesson_plans.planned_date', '<=', filter.to);
    }
    if (filter.status) {
      query = query.where('lesson_plans.status', '=', filter.status);
    }
    return query.execute();
  }

  // Chi tiết giáo án kèm lịch sử duyệt và góp ý
  async detail(currentUser: CurrentUser, planId: string) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.findPlan(database, planId);
    const found = await this.access.findClass(database, plan.class_id);
    if (
      plan.teacher_id !== currentUser.id &&
      !(await this.reviewStage(currentUser, plan.org_unit_id)) &&
      !(await this.access.canViewClass(currentUser, database, found))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được giáo án này');
    }
    const lesson = await database
      .selectFrom('lessons')
      .select(['name', 'objectives', 'materials'])
      .where('id', '=', plan.lesson_id)
      .executeTakeFirstOrThrow();
    const reviews = await database
      .selectFrom('lesson_plan_reviews')
      .selectAll()
      .where('lesson_plan_id', '=', planId)
      .orderBy('created_at')
      .execute();
    return { ...plan, class_name: found.name, lesson, reviews };
  }
}

function readPlanInput(body: RequestBody, creating: boolean): PlanInput {
  const errors: FieldError[] = [];
  const input: PlanInput = {};
  for (const field of ['lesson_id', 'class_id'] as const) {
    if (!creating && field === 'class_id') {
      continue;
    }
    const value = readOptionalUuid(body, field, errors);
    if (value) {
      input[field] = value;
    } else if (creating) {
      errors.push({ field, message: field === 'lesson_id' ? 'Bắt buộc chọn bài học' : 'Bắt buộc chọn lớp' });
    }
  }
  if (creating || body?.planned_date !== undefined) {
    input.planned_date = readDate(body, 'planned_date', errors, true) ?? '';
  }
  if (creating || body?.activities !== undefined) {
    input.activities = readText(body, 'activities', errors, { required: true }) ?? '';
  }
  if (creating) {
    input.duration_minutes = readRequiredInteger(body, 'duration_minutes', errors, { min: 5, max: 480 });
  } else {
    const duration = readInteger(body, 'duration_minutes', errors, { min: 5, max: 480 });
    if (duration !== undefined) {
      input.duration_minutes = duration;
    }
  }
  if (creating || body?.materials !== undefined) {
    input.materials = readText(body, 'materials', errors);
  }
  check(errors);
  return input;
}

@Controller()
export class LessonPlansController {
  constructor(private readonly plans: LessonPlansService) {}

  @Get('lesson-plans')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.class_id !== undefined && !isUuid(query.class_id)) {
      errors.push({ field: 'class_id', message: 'Mã lớp không hợp lệ' });
    }
    if (query.view !== undefined && query.view !== 'mine' && query.view !== 'review') {
      errors.push({ field: 'view', message: 'Chế độ xem là mine hoặc review' });
    }
    if (query.status !== undefined && !STATUSES.includes(query.status as LessonPlanStatus)) {
      errors.push({ field: 'status', message: `Trạng thái là ${STATUSES.join(', ')}` });
    }
    check(errors);
    return this.plans.list(currentUser, {
      view: (query.view as 'mine' | 'review' | undefined) ?? null,
      classId: query.class_id ?? null,
      from: optionalQueryDate(query.from, 'from'),
      to: optionalQueryDate(query.to, 'to'),
      status: (query.status as LessonPlanStatus | undefined) ?? null,
    });
  }

  @Post('lesson-plans')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.plans.create(
      currentUser,
      readPlanInput(body, true) as Required<PlanInput>,
      originOf(request, currentUser),
    );
  }

  @Get('lesson-plans/:id')
  detail(
    @Param('id', uuidParameter('Mã giáo án không hợp lệ')) planId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.detail(currentUser, planId);
  }

  @Patch('lesson-plans/:id')
  update(
    @Param('id', uuidParameter('Mã giáo án không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.update(currentUser, planId, readPlanInput(body, false), originOf(request, currentUser));
  }

  @Post('lesson-plans/:id/submit')
  @HttpCode(200)
  submit(
    @Param('id', uuidParameter('Mã giáo án không hợp lệ')) planId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.submit(currentUser, planId, originOf(request, currentUser));
  }

  @Post('lesson-plans/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã giáo án không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const comment = readText(body, 'comment', errors);
    check(errors);
    return this.plans.review(currentUser, planId, 'approved', comment, originOf(request, currentUser));
  }

  @Post('lesson-plans/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã giáo án không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const comment = readText(body, 'comment', errors, { required: true });
    check(errors);
    return this.plans.review(currentUser, planId, 'returned', comment, originOf(request, currentUser));
  }
}
