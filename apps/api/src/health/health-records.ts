import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { ChildGender, HealthIndicator, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { guardianUserIds } from '../finance/receivables.js';
import { ageInMonths, HealthAccess, type HealthChild } from './health-access.js';
import { readDecimal, readHealthDate, readNote } from './health-fields.js';

// Hồ sơ sức khỏe theo lần đo, tiêu chuẩn sức khỏe, đợt khám, lịch khám, kết quả khám (P10-01, P10-06, P10-10, P10-11;
// BR-51, BR-53, BR-69; YCTD-74). Y tế ghi trong phạm vi đơn vị; kết quả khám công bố thì phụ huynh mới thấy; chỉ số được
// so với tiêu chuẩn theo giới tính và tháng tuổi tại ngày đo
const INDICATORS: HealthIndicator[] = ['height_cm', 'weight_kg', 'bmi'];
const GENDERS: ChildGender[] = ['male', 'female'];
const HEIGHT_RANGE = { minimum: 30, maximum: 200 };
const WEIGHT_RANGE = { minimum: 1, maximum: 150 };

export type IndicatorStatus = 'below' | 'normal' | 'above';

interface StandardRow {
  indicator_code: HealthIndicator;
  gender: ChildGender;
  age_month_from: number;
  age_month_to: number;
  lower_value: string;
  upper_value: string;
}

// So chỉ số với tiêu chuẩn; chưa có tiêu chuẩn phù hợp thì không đánh giá
export function evaluate(
  standards: StandardRow[],
  child: { gender: ChildGender; dob: string },
  onDate: string,
  values: { height_cm: number | null; weight_kg: number | null },
): Partial<Record<HealthIndicator, IndicatorStatus>> {
  const months = ageInMonths(child.dob, onDate);
  const bmi =
    values.height_cm && values.weight_kg
      ? Math.round((values.weight_kg / (values.height_cm / 100) ** 2) * 10) / 10
      : null;
  const all: Record<HealthIndicator, number | null> = { height_cm: values.height_cm, weight_kg: values.weight_kg, bmi };
  const result: Partial<Record<HealthIndicator, IndicatorStatus>> = {};
  for (const indicator of INDICATORS) {
    const value = all[indicator];
    if (value === null) {
      continue;
    }
    const standard = standards.find(
      (row) =>
        row.indicator_code === indicator &&
        row.gender === child.gender &&
        row.age_month_from <= months &&
        row.age_month_to >= months,
    );
    if (!standard) {
      continue;
    }
    result[indicator] =
      value < Number(standard.lower_value) ? 'below' : value > Number(standard.upper_value) ? 'above' : 'normal';
  }
  return result;
}

const toNumber = (value: string | null) => (value === null ? null : Number(value));

@Injectable()
export class HealthRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: HealthAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private standards(database: Kysely<SchoolYearDatabase>) {
    return database
      .selectFrom('health_standards')
      .select(['indicator_code', 'gender', 'age_month_from', 'age_month_to', 'lower_value', 'upper_value'])
      .execute();
  }

  // P10-01: chỉ số theo lần đo kèm đánh giá theo tiêu chuẩn
  async measurements(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanRead(currentUser, database, childId);
    const standards = await this.standards(database);
    const rows = await database
      .selectFrom('health_measurements')
      .select(['id', 'measured_on', 'height_cm', 'weight_kg', 'vision_left', 'vision_right', 'note'])
      .where('child_id', '=', childId)
      .orderBy('measured_on', 'desc')
      .execute();
    return rows.map((row) => {
      const values = { height_cm: toNumber(row.height_cm), weight_kg: toNumber(row.weight_kg) };
      return { ...row, ...values, evaluation: evaluate(standards, child, row.measured_on, values) };
    });
  }

  async addMeasurement(
    currentUser: CurrentUser,
    childId: string,
    input: {
      measured_on: string;
      height_cm: number | null;
      weight_kg: number | null;
      vision_left: string | null;
      vision_right: string | null;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.access.assertCanWrite(currentUser, database, childId, PERMISSION_CODES.healthManage);
    if (input.measured_on > this.today() || input.measured_on < child.dob) {
      throw validationError([{ field: 'measured_on', message: 'Ngày đo không sau hôm nay và không trước ngày sinh' }]);
    }
    if (
      input.height_cm === null &&
      input.weight_kg === null &&
      input.vision_left === null &&
      input.vision_right === null
    ) {
      throw validationError([{ field: 'height_cm', message: 'Cần nhập ít nhất một chỉ số' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('health_measurements')
        .values({ child_id: childId, ...input, recorded_by: origin.actorUserId })
        .returning(['id', 'measured_on', 'height_cm', 'weight_kg', 'vision_left', 'vision_right', 'note'])
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'health_measurements',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // P10-11: bảng tiêu chuẩn chung toàn trường
  async listStandards(currentUser: CurrentUser) {
    if (!currentUser.hasPermission(PERMISSION_CODES.healthManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tiêu chuẩn sức khỏe');
    }
    const { database } = await this.currentSchoolYear.require();
    return database
      .selectFrom('health_standards')
      .selectAll()
      .orderBy('indicator_code')
      .orderBy('gender')
      .orderBy('age_month_from')
      .execute();
  }

  async addStandard(
    currentUser: CurrentUser,
    input: {
      indicator_code: HealthIndicator;
      gender: ChildGender;
      age_month_from: number;
      age_month_to: number;
      lower_value: number;
      upper_value: number;
      source_document: string;
    },
    origin: ChangeOrigin,
  ) {
    if (!currentUser.hasPermission(PERMISSION_CODES.healthManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý tiêu chuẩn sức khỏe');
    }
    const { database } = await this.currentSchoolYear.require();
    const overlap = await database
      .selectFrom('health_standards')
      .select('id')
      .where('indicator_code', '=', input.indicator_code)
      .where('gender', '=', input.gender)
      .where('age_month_from', '<=', input.age_month_to)
      .where('age_month_to', '>=', input.age_month_from)
      .executeTakeFirst();
    if (overlap) {
      throw ruleViolationError('P10-11', 'Khoảng tháng tuổi trùng với tiêu chuẩn đã có của cùng chỉ số và giới tính');
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('health_standards')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'health_standards',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async removeStandard(currentUser: CurrentUser, standardId: string, origin: ChangeOrigin) {
    if (!currentUser.hasPermission(PERMISSION_CODES.healthManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý tiêu chuẩn sức khỏe');
    }
    const { database } = await this.currentSchoolYear.require();
    await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom('health_standards')
        .where('id', '=', standardId)
        .returningAll()
        .executeTakeFirst();
      if (!removed) {
        throw notFoundError('Không tìm thấy tiêu chuẩn', 'health_standard');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'health_standards',
        entityId: standardId,
        action: 'delete',
        before: removed,
        after: null,
      });
    });
  }

  // P10-06: đợt khám theo đơn vị
  async listCampaigns(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.officeUnitScope(currentUser, PERMISSION_CODES.healthManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem đợt khám');
    }
    let query = database.selectFrom('health_check_campaigns').selectAll().orderBy('from_date', 'desc');
    if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    }
    return query.execute();
  }

  async createCampaign(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string; from_date: string; to_date: string },
    origin: ChangeOrigin,
  ) {
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, input.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền lập đợt khám của đơn vị này');
    }
    if (input.to_date < input.from_date) {
      throw validationError([{ field: 'to_date', message: 'Ngày kết thúc không trước ngày bắt đầu' }]);
    }
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('health_check_campaigns')
        .values({ ...input, created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'health_check_campaigns',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  private async campaignForWrite(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>, campaignId: string) {
    const campaign = await database
      .selectFrom('health_check_campaigns')
      .selectAll()
      .where('id', '=', campaignId)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt khám', 'health_check_campaign');
    }
    if (!(await this.access.canWriteUnit(currentUser, PERMISSION_CODES.healthManage, campaign.org_unit_id))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền với đợt khám của đơn vị này');
    }
    return campaign;
  }

  async closeCampaign(currentUser: CurrentUser, campaignId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.campaignForWrite(currentUser, database, campaignId);
    if (campaign.status === 'closed') {
      throw ruleViolationError('P10-06', 'Đợt khám đã đóng');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('health_check_campaigns')
        .set({ status: 'closed' })
        .where('id', '=', campaignId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'health_check_campaigns',
        entityId: campaignId,
        action: 'update',
        before: { status: campaign.status },
        after: { status: 'closed' },
      });
    });
    return { ...campaign, status: 'closed' as const };
  }

  // P10-10: lịch khám của lớp trong đợt; lập xong thì phụ huynh của trẻ đang học trong lớp nhận thông báo (BR-69)
  async listSchedules(currentUser: CurrentUser, campaignId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.campaignForWrite(currentUser, database, campaignId);
    return database
      .selectFrom('health_check_schedules')
      .innerJoin('classes', 'classes.id', 'health_check_schedules.class_id')
      .select([
        'health_check_schedules.id',
        'health_check_schedules.class_id',
        'classes.name as class_name',
        'health_check_schedules.check_date',
        'health_check_schedules.location',
        'health_check_schedules.published_at',
      ])
      .where('health_check_schedules.campaign_id', '=', campaignId)
      .orderBy('health_check_schedules.check_date')
      .execute();
  }

  async createSchedule(
    currentUser: CurrentUser,
    input: { campaign_id: string; class_id: string; check_date: string; location: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.campaignForWrite(currentUser, database, input.campaign_id);
    if (campaign.status !== 'open') {
      throw ruleViolationError('P10-10', 'Đợt khám đã đóng');
    }
    const classRecord = await database
      .selectFrom('classes')
      .select(['id', 'name', 'org_unit_id', 'status'])
      .where('id', '=', input.class_id)
      .executeTakeFirst();
    if (!classRecord || classRecord.status !== 'active' || classRecord.org_unit_id !== campaign.org_unit_id) {
      throw validationError([{ field: 'class_id', message: 'Lớp phải đang mở và thuộc đơn vị của đợt khám' }]);
    }
    if (input.check_date < campaign.from_date || input.check_date > campaign.to_date) {
      throw validationError([{ field: 'check_date', message: 'Ngày khám phải trong thời gian của đợt khám' }]);
    }
    const existing = await database
      .selectFrom('health_check_schedules')
      .select('id')
      .where('campaign_id', '=', input.campaign_id)
      .where('class_id', '=', input.class_id)
      .executeTakeFirst();
    if (existing) {
      throw new ApplicationError('ERR_CONFLICT', 'Lớp đã có lịch khám trong đợt này', [
        { field: 'class_id', message: 'Lớp đã có lịch khám trong đợt này' },
      ]);
    }
    const children = await database
      .selectFrom('class_enrollments')
      .select('child_id')
      .where('class_id', '=', input.class_id)
      .where('is_current', '=', true)
      .execute();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('health_check_schedules')
        .values({ ...input, published_at: this.clock.now(), created_by: origin.actorUserId })
        .returningAll()
        .executeTakeFirstOrThrow();
      const recipients = new Set<string>();
      for (const child of children) {
        for (const userId of await guardianUserIds(transaction, child.child_id)) {
          recipients.add(userId);
        }
      }
      await queueNotification(transaction, {
        orgUnitId: campaign.org_unit_id,
        templateCode: 'health_check_scheduled',
        title: 'Lịch khám sức khỏe',
        body: `${campaign.name}: lớp ${classRecord.name} khám ngày ${input.check_date} tại ${input.location}`,
        targetType: 'health_check_schedules',
        targetId: created.id,
        recipients: [...recipients].map((userId) => ({ userId, channel: 'in_app' as const })),
      });
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'health_check_schedules',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return { ...created, class_name: classRecord.name, notified_count: recipients.size };
    });
  }

  // Kết quả khám của trẻ đang học trong đơn vị của đợt, lọc theo lớp
  async listResults(currentUser: CurrentUser, campaignId: string, classId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.campaignForWrite(currentUser, database, campaignId);
    const standards = await this.standards(database);
    let children = database
      .selectFrom('children')
      .innerJoin('class_enrollments', 'class_enrollments.child_id', 'children.id')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .leftJoin('health_check_results', (join) =>
        join
          .onRef('health_check_results.child_id', '=', 'children.id')
          .on('health_check_results.campaign_id', '=', campaignId),
      )
      .select([
        'children.id as child_id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'classes.id as class_id',
        'classes.name as class_name',
        'health_check_results.id as result_id',
        'health_check_results.height_cm',
        'health_check_results.weight_kg',
        'health_check_results.result_data',
        'health_check_results.conclusion',
        'health_check_results.note',
        'health_check_results.recorded_at',
        'health_check_results.published_at',
      ])
      .where('class_enrollments.is_current', '=', true)
      .where('classes.org_unit_id', '=', campaign.org_unit_id)
      .where('children.status', '=', 'active');
    if (classId) {
      children = children.where('classes.id', '=', classId);
    }
    const rows = await children.orderBy('classes.name').orderBy('children.full_name').execute();
    const onDate = campaign.to_date < this.today() ? campaign.to_date : this.today();
    return rows.map((row) => {
      const values = { height_cm: toNumber(row.height_cm), weight_kg: toNumber(row.weight_kg) };
      return {
        ...row,
        ...values,
        evaluation: row.result_id ? evaluate(standards, row, onDate, values) : {},
      };
    });
  }

  async saveResult(
    currentUser: CurrentUser,
    campaignId: string,
    input: {
      child_id: string;
      height_cm: number | null;
      weight_kg: number | null;
      result_data: Record<string, string>;
      conclusion: string | null;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.campaignForWrite(currentUser, database, campaignId);
    if (campaign.status !== 'open') {
      throw ruleViolationError('P10-06', 'Đợt khám đã đóng, không ghi thêm kết quả');
    }
    const child = await this.access.findChild(database, input.child_id);
    if (child.org_unit_id !== campaign.org_unit_id) {
      throw validationError([{ field: 'child_id', message: 'Trẻ không thuộc đơn vị của đợt khám' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const before = await transaction
        .selectFrom('health_check_results')
        .selectAll()
        .where('campaign_id', '=', campaignId)
        .where('child_id', '=', input.child_id)
        .executeTakeFirst();
      const values = {
        height_cm: input.height_cm,
        weight_kg: input.weight_kg,
        result_data: JSON.stringify(input.result_data),
        conclusion: input.conclusion,
        note: input.note,
        recorded_by: origin.actorUserId,
        recorded_at: this.clock.now(),
      };
      const saved = before
        ? await transaction
            .updateTable('health_check_results')
            .set(values)
            .where('id', '=', before.id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('health_check_results')
            .values({ campaign_id: campaignId, child_id: input.child_id, ...values })
            .returningAll()
            .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'health_check_results',
        entityId: saved.id,
        action: before ? 'update' : 'create',
        before: before ?? null,
        after: saved,
      });
      return saved;
    });
  }

  // Công bố kết quả đã ghi chưa công bố; phụ huynh của từng trẻ nhận thông báo
  async publishResults(currentUser: CurrentUser, campaignId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const campaign = await this.campaignForWrite(currentUser, database, campaignId);
    return database.transaction().execute(async (transaction) => {
      const published = await transaction
        .updateTable('health_check_results')
        .set({ published_at: this.clock.now() })
        .where('campaign_id', '=', campaignId)
        .where('published_at', 'is', null)
        .returning(['id', 'child_id'])
        .execute();
      if (published.length === 0) {
        throw ruleViolationError('P10-06', 'Không có kết quả mới để công bố');
      }
      for (const row of published) {
        const recipients = await guardianUserIds(transaction, row.child_id);
        await queueNotification(transaction, {
          orgUnitId: campaign.org_unit_id,
          templateCode: 'health_check_result',
          title: 'Kết quả khám sức khỏe',
          body: `${campaign.name}: đã có kết quả khám của con`,
          targetType: 'health_check_results',
          targetId: row.id,
          recipients: recipients.map((userId) => ({ userId, channel: 'in_app' as const })),
        });
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: campaign.org_unit_id,
        entityName: 'health_check_campaigns',
        entityId: campaignId,
        action: 'update',
        before: null,
        after: { published_count: published.length },
      });
      return { published_count: published.length };
    });
  }

  // Kết quả khám đã công bố của một trẻ; phụ huynh và người được xem sức khỏe của trẻ đều đọc được
  async publishedResultsOf(database: Kysely<SchoolYearDatabase>, child: HealthChild) {
    const standards = await this.standards(database);
    const rows = await database
      .selectFrom('health_check_results')
      .innerJoin('health_check_campaigns', 'health_check_campaigns.id', 'health_check_results.campaign_id')
      .select([
        'health_check_results.id',
        'health_check_campaigns.name as campaign_name',
        'health_check_campaigns.to_date',
        'health_check_results.height_cm',
        'health_check_results.weight_kg',
        'health_check_results.result_data',
        'health_check_results.conclusion',
        'health_check_results.published_at',
      ])
      .where('health_check_results.child_id', '=', child.id)
      .where('health_check_results.published_at', 'is not', null)
      .orderBy('health_check_campaigns.to_date', 'desc')
      .execute();
    return rows.map((row) => {
      const values = { height_cm: toNumber(row.height_cm), weight_kg: toNumber(row.weight_kg) };
      return { ...row, ...values, evaluation: evaluate(standards, child, row.to_date, values) };
    });
  }
}

function readIndicatorFields(body: RequestBody, errors: FieldError[]) {
  return {
    height_cm: readDecimal(body, 'height_cm', errors, HEIGHT_RANGE),
    weight_kg: readDecimal(body, 'weight_kg', errors, WEIGHT_RANGE),
  };
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller()
export class HealthRecordsController {
  constructor(private readonly records: HealthRecordsService) {}

  @Get('children/:id/health-measurements')
  measurements(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.measurements(currentUser, childId);
  }

  @Post('children/:id/health-measurements')
  @HttpCode(201)
  addMeasurement(
    @Param('id', uuidParameter('Mã trẻ không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      measured_on: readHealthDate(body, 'measured_on', errors, true) ?? '',
      ...readIndicatorFields(body, errors),
      vision_left: readNote(body, 'vision_left', errors),
      vision_right: readNote(body, 'vision_right', errors),
      note: readNote(body, 'note', errors),
    };
    check(errors);
    return this.records.addMeasurement(currentUser, childId, input, originOf(request, currentUser));
  }

  @Get('health-standards')
  listStandards(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.records.listStandards(currentUser);
  }

  @Post('health-standards')
  @HttpCode(201)
  addStandard(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const indicator = body?.indicator_code as HealthIndicator;
    if (!INDICATORS.includes(indicator)) {
      errors.push({ field: 'indicator_code', message: 'Chỉ số là height_cm, weight_kg hoặc bmi' });
    }
    const gender = body?.gender as ChildGender;
    if (!GENDERS.includes(gender)) {
      errors.push({ field: 'gender', message: 'Giới tính là male hoặc female' });
    }
    const months = (field: string) => {
      const value = body?.[field];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 120) {
        errors.push({ field, message: 'Số tháng tuổi nguyên từ 0 đến 120' });
        return 0;
      }
      return value;
    };
    const from = months('age_month_from');
    const to = months('age_month_to');
    const lower = readDecimal(body, 'lower_value', errors, { minimum: 0, maximum: 1000 });
    const upper = readDecimal(body, 'upper_value', errors, { minimum: 0, maximum: 1000 });
    if (lower === null) {
      errors.push({ field: 'lower_value', message: 'Bắt buộc nhập ngưỡng dưới' });
    }
    if (upper === null) {
      errors.push({ field: 'upper_value', message: 'Bắt buộc nhập ngưỡng trên' });
    }
    if (to < from) {
      errors.push({ field: 'age_month_to', message: 'Tháng tuổi đến không nhỏ hơn tháng tuổi từ' });
    }
    if (lower !== null && upper !== null && upper < lower) {
      errors.push({ field: 'upper_value', message: 'Ngưỡng trên không nhỏ hơn ngưỡng dưới' });
    }
    const source = readNote(body, 'source_document', errors, true);
    check(errors);
    return this.records.addStandard(
      currentUser,
      {
        indicator_code: indicator,
        gender,
        age_month_from: from,
        age_month_to: to,
        lower_value: lower ?? 0,
        upper_value: upper ?? 0,
        source_document: source ?? '',
      },
      originOf(request, currentUser),
    );
  }

  @Delete('health-standards/:id')
  @HttpCode(204)
  async removeStandard(
    @Param('id', uuidParameter('Mã tiêu chuẩn không hợp lệ')) standardId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.records.removeStandard(currentUser, standardId, originOf(request, currentUser));
  }

  @Get('health-check-campaigns')
  listCampaigns(@Query('org_unit_id') orgUnitId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã đơn vị không hợp lệ' }]);
    }
    return this.records.listCampaigns(currentUser, (orgUnitId as string | undefined) ?? null);
  }

  @Post('health-check-campaigns')
  @HttpCode(201)
  createCampaign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      org_unit_id: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readNote(body, 'name', errors, true) ?? '',
      from_date: readHealthDate(body, 'from_date', errors, true) ?? '',
      to_date: readHealthDate(body, 'to_date', errors, true) ?? '',
    };
    check(errors);
    return this.records.createCampaign(currentUser, input, originOf(request, currentUser));
  }

  @Post('health-check-campaigns/:id/close')
  @HttpCode(200)
  closeCampaign(
    @Param('id', uuidParameter('Mã đợt khám không hợp lệ')) campaignId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.closeCampaign(currentUser, campaignId, originOf(request, currentUser));
  }

  @Get('health-check-schedules')
  listSchedules(@Query('campaign_id') campaignId: unknown, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(campaignId)) {
      throw validationError([{ field: 'campaign_id', message: 'Mã đợt khám không hợp lệ' }]);
    }
    return this.records.listSchedules(currentUser, campaignId);
  }

  @Post('health-check-schedules')
  @HttpCode(201)
  createSchedule(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      campaign_id: readRequiredUuid(body, 'campaign_id', errors, 'Bắt buộc chọn đợt khám'),
      class_id: readRequiredUuid(body, 'class_id', errors, 'Bắt buộc chọn lớp'),
      check_date: readHealthDate(body, 'check_date', errors, true) ?? '',
      location: readNote(body, 'location', errors, true) ?? '',
    };
    check(errors);
    return this.records.createSchedule(currentUser, input, originOf(request, currentUser));
  }

  @Get('health-check-campaigns/:id/results')
  listResults(
    @Param('id', uuidParameter('Mã đợt khám không hợp lệ')) campaignId: string,
    @Query('class_id') classId: unknown,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (classId !== undefined && !isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Mã lớp không hợp lệ' }]);
    }
    return this.records.listResults(currentUser, campaignId, (classId as string | undefined) ?? null);
  }

  @Put('health-check-campaigns/:id/results')
  saveResult(
    @Param('id', uuidParameter('Mã đợt khám không hợp lệ')) campaignId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const resultData: Record<string, string> = {};
    const raw = body?.result_data;
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push({ field: 'result_data', message: 'Kết quả từng chỉ số dạng tên chỉ số và giá trị' });
      } else {
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value !== 'string' || key.length > 100 || value.length > 500) {
            errors.push({
              field: 'result_data',
              message: 'Tên chỉ số tối đa 100 ký tự, giá trị là chữ tối đa 500 ký tự',
            });
            break;
          }
          resultData[key] = value;
        }
      }
    }
    const input = {
      child_id: readRequiredUuid(body, 'child_id', errors, 'Bắt buộc chọn trẻ'),
      ...readIndicatorFields(body, errors),
      result_data: resultData,
      conclusion: readNote(body, 'conclusion', errors),
      note: readNote(body, 'note', errors),
    };
    check(errors);
    return this.records.saveResult(currentUser, campaignId, input, originOf(request, currentUser));
  }

  @Post('health-check-campaigns/:id/publish-results')
  @HttpCode(200)
  publishResults(
    @Param('id', uuidParameter('Mã đợt khám không hợp lệ')) campaignId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.records.publishResults(currentUser, campaignId, originOf(request, currentUser));
  }
}
