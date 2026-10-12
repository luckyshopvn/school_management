import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { ProgressLevel, ProgressPeriod, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { ChildScope } from '../children/child-scope.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds, isGuardianOf } from '../finance/receivables.js';
import { ClassTeachingService } from './class-teaching.js';
import { TeachingAccess } from './teaching-access.js';
import { addDays, check, mondayOf, PROGRESS_PERIODS, readPeriod, readText } from './teaching-fields.js';

// Tiến độ học tập của trẻ (P03-06; BR-15; YCTD-80): giáo viên được phân công lớp hiện tại của trẻ ghi chỉ số phát triển và
// nhận xét theo kỳ (học kỳ hoặc tháng); công bố cả phiếu của kỳ cho phụ huynh, phiếu đã công bố không sửa được. Phụ huynh chỉ
// xem phiếu đã công bố của con mình; trang học tập của con gồm thời khóa biểu và lịch hoạt động đã công bố của lớp (MP-04,
// MP-05)
const LEVELS: ProgressLevel[] = ['achieved', 'developing', 'not_yet'];
const MAXIMUM_ITEMS = 50;
const LEARNING_SCHEDULE_DAYS = 14;

interface ProgressItem {
  indicator_code: string;
  level: ProgressLevel;
  comment: string | null;
  domain_id: string | null;
}

@Injectable()
export class ChildProgressService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: TeachingAccess,
    private readonly childScope: ChildScope,
    private readonly classTeaching: ClassTeachingService,
    private readonly clock: Clock,
  ) {}

  private async childWithClass(database: Kysely<SchoolYearDatabase>, childId: string) {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .select(['children.id', 'children.org_unit_id', 'children.full_name', 'class_enrollments.class_id'])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy hồ sơ trẻ', 'child');
    }
    return child;
  }

  // Người ghi: giáo viên có quyền ghi tiến độ và đang được phân công lớp hiện tại của trẻ
  private async assertCanRecord(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    const child = await this.childWithClass(database, childId);
    if (
      !currentUser.hasPermission(PERMISSION_CODES.progressRecord) ||
      !child.class_id ||
      !(await this.access.assignmentOf(database, currentUser, child.class_id))
    ) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên được phân công lớp của trẻ ghi tiến độ học tập');
    }
    return { ...child, class_id: child.class_id };
  }

  // Người xem: phụ huynh của trẻ chỉ thấy phiếu đã công bố; nhân sự theo phạm vi xem trẻ thấy cả bản nháp
  private async readerOf(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, childId: string) {
    await this.childWithClass(database, childId);
    const guardian = await isGuardianOf(database, childId, currentUser.id);
    if (!guardian) {
      await this.childScope.assertCanRead(currentUser, database, childId);
    }
    return { publishedOnly: guardian && !this.access.hasOfficeRole(currentUser) && !this.access.isTeacher(currentUser) };
  }

  async list(currentUser: CurrentUser, childId: string, period: { type: ProgressPeriod | null; value: string | null }) {
    const { database } = await this.currentSchoolYear.require();
    const { publishedOnly } = await this.readerOf(currentUser, database, childId);
    return this.progressOf(database, childId, period, publishedOnly);
  }

  private async progressOf(
    database: Kysely<SchoolYearDatabase>,
    childId: string,
    period: { type: ProgressPeriod | null; value: string | null },
    publishedOnly: boolean,
  ) {
    let query = database
      .selectFrom('child_progress')
      .leftJoin('lesson_domains', 'lesson_domains.id', 'child_progress.domain_id')
      .select([
        'child_progress.id',
        'child_progress.period_type',
        'child_progress.period_value',
        'child_progress.domain_id',
        'lesson_domains.name as domain_name',
        'child_progress.indicator_code',
        'child_progress.level',
        'child_progress.comment',
        'child_progress.published_at',
        'child_progress.updated_at',
      ])
      .where('child_progress.child_id', '=', childId)
      .orderBy('child_progress.period_value', 'desc')
      .orderBy('child_progress.indicator_code');
    if (period.type) {
      query = query.where('child_progress.period_type', '=', period.type);
    }
    if (period.value) {
      query = query.where('child_progress.period_value', '=', period.value);
    }
    if (publishedOnly) {
      query = query.where('child_progress.published_at', 'is not', null);
    }
    return query.execute();
  }

  // Ghi hoặc cập nhật các chỉ số của kỳ; kỳ đã công bố thì không sửa được
  async record(
    currentUser: CurrentUser,
    childId: string,
    input: { period_type: ProgressPeriod; period_value: string; items: ProgressItem[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.assertCanRecord(currentUser, database, childId);
    const published = await database
      .selectFrom('child_progress')
      .select('id')
      .where('child_id', '=', childId)
      .where('period_type', '=', input.period_type)
      .where('period_value', '=', input.period_value)
      .where('published_at', 'is not', null)
      .executeTakeFirst();
    if (published) {
      throw ruleViolationError('P03-06', 'Phiếu tiến độ của kỳ này đã công bố, không sửa được');
    }
    const domainIds = [...new Set(input.items.map((item) => item.domain_id).filter((id): id is string => id !== null))];
    if (domainIds.length > 0) {
      const found = await database.selectFrom('lesson_domains').select('id').where('id', 'in', domainIds).execute();
      if (found.length !== domainIds.length) {
        throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
          { field: 'items.domain_id', message: 'Không tìm thấy lĩnh vực' },
        ]);
      }
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      for (const item of input.items) {
        await transaction
          .insertInto('child_progress')
          .values({
            child_id: childId,
            class_id: child.class_id,
            period_type: input.period_type,
            period_value: input.period_value,
            domain_id: item.domain_id,
            indicator_code: item.indicator_code,
            level: item.level,
            comment: item.comment,
            recorded_by: origin.actorUserId,
          })
          .onConflict((conflict) =>
            conflict.columns(['child_id', 'period_type', 'period_value', 'indicator_code']).doUpdateSet({
              level: item.level,
              comment: item.comment,
              domain_id: item.domain_id,
              class_id: child.class_id,
              recorded_by: origin.actorUserId,
              updated_at: now,
            }),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_progress',
        entityId: childId,
        action: 'update',
        before: null,
        after: input,
      });
    });
    return this.progressOf(database, childId, { type: input.period_type, value: input.period_value }, false);
  }

  async publish(
    currentUser: CurrentUser,
    childId: string,
    period: { period_type: ProgressPeriod; period_value: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.assertCanRecord(currentUser, database, childId);
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('child_progress')
        .set({ published_at: this.clock.now(), published_by: currentUser.id, updated_at: this.clock.now() })
        .where('child_id', '=', childId)
        .where('period_type', '=', period.period_type)
        .where('period_value', '=', period.period_value)
        .where('published_at', 'is', null)
        .returning('id')
        .execute();
      if (published.length === 0) {
        throw ruleViolationError('P03-06', 'Không có chỉ số chưa công bố của kỳ này');
      }
      await queueNotification(transaction, {
        orgUnitId: child.org_unit_id,
        templateCode: 'child_progress_published',
        title: 'Phiếu tiến độ học tập của con',
        body: `Đã có phiếu tiến độ học tập kỳ ${period.period_value} của ${child.full_name}`,
        targetType: 'children',
        targetId: childId,
        recipients: (await guardianUserIds(transaction, childId)).map((userId) => ({
          userId,
          channel: 'in_app' as const,
        })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_progress',
        entityId: childId,
        action: 'update',
        before: { ...period, published: false },
        after: { ...period, published: true, count: published.length },
      });
      return { published_count: published.length };
    });
  }

  // Trang học tập của con cho phụ huynh: thời khóa biểu tuần này, lịch hoạt động 14 ngày tới, phiếu tiến độ đã công bố
  async learning(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childWithClass(database, childId);
    const { publishedOnly } = await this.readerOf(currentUser, database, childId);
    const today = VIETNAM_DATE.format(this.clock.now());
    const found = child.class_id ? await this.access.findClass(database, child.class_id) : null;
    return {
      child_id: childId,
      class_id: found?.id ?? null,
      class_name: found?.name ?? null,
      timetable: found ? await this.classTeaching.timetableOf(database, found, mondayOf(today), true) : null,
      activities: found
        ? await this.classTeaching.schedulesOf(database, found.id, today, addDays(today, LEARNING_SCHEDULE_DAYS - 1), true)
        : [],
      progress: await this.progressOf(database, childId, { type: null, value: null }, publishedOnly),
    };
  }
}

function readItems(body: RequestBody, errors: FieldError[]): ProgressItem[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAXIMUM_ITEMS) {
    errors.push({ field: 'items', message: `Từ 1 đến ${MAXIMUM_ITEMS} chỉ số` });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((entry: unknown, index) => {
    const item = (entry ?? {}) as RequestBody;
    const itemErrors: FieldError[] = [];
    const indicator = readText(item, 'indicator_code', itemErrors, { required: true, maximum: 200 }) ?? '';
    const level = item?.level as ProgressLevel;
    if (!LEVELS.includes(level)) {
      itemErrors.push({ field: 'level', message: 'Mức là achieved, developing hoặc not_yet' });
    }
    if (indicator && seen.has(indicator)) {
      itemErrors.push({ field: 'indicator_code', message: 'Chỉ số bị lặp' });
    }
    seen.add(indicator);
    const value = {
      indicator_code: indicator,
      level,
      comment: readText(item, 'comment', itemErrors, { maximum: 1000 }),
      domain_id: readOptionalUuid(item, 'domain_id', itemErrors) ?? null,
    };
    errors.push(...itemErrors.map((error) => ({ ...error, field: `items[${index}].${error.field}` })));
    return value;
  });
}

@Controller()
export class ChildProgressController {
  constructor(private readonly progress: ChildProgressService) {}

  @Get('children/:id/progress')
  list(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Query() query: Record<string, string | undefined>,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    let period: { type: ProgressPeriod | null; value: string | null } = { type: null, value: null };
    if (query.period_type !== undefined || query.period_value !== undefined) {
      const errors: FieldError[] = [];
      const read = readPeriod(query, errors, PROGRESS_PERIODS);
      check(errors);
      period = { type: read.period_type, value: read.period_value };
    }
    return this.progress.list(currentUser, childId, period);
  }

  @Post('children/:id/progress')
  @HttpCode(200)
  record(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const period = readPeriod(body, errors, PROGRESS_PERIODS);
    const items = readItems(body, errors);
    check(errors);
    return this.progress.record(currentUser, childId, { ...period, items }, originOf(request, currentUser));
  }

  @Post('children/:id/progress/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const period = readPeriod(body, errors, PROGRESS_PERIODS);
    check(errors);
    return this.progress.publish(currentUser, childId, period, originOf(request, currentUser));
  }

  @Get('children/:id/learning')
  learning(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.progress.learning(currentUser, childId);
  }
}
