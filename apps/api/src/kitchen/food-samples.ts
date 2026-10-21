import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Query, Req } from '@nestjs/common';
import type { FoodSampleForm, FoodSampleStatus, MealType, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { FOOD_SAMPLE_FORMS, FOOD_SAMPLE_STATUSES, PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { actorNameOf, originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FoodInspectionsService } from './food-inspections.js';
import {
  earliestDestroyAt,
  readMoment,
  sampleDestroyState,
  sampleRequired,
  sampleViolations,
} from './food-safety-calc.js';
import { KitchenAccess } from './kitchen-access.js';
import { MEAL_TYPES, check, queryDate, queryUuid, readDate, readText } from './kitchen-fields.js';

// Lưu và hủy mẫu thức ăn (DT-18 phần 22b, YCTD-146; BR-142) theo mẫu số 5 của Quyết định 1246/QĐ-BYT: mỗi món một mẫu, ghi
// bữa, số suất, khối lượng hoặc thể tích, dụng cụ chứa, nhiệt độ bảo quản, thời điểm lấy, người lưu; hủy sau ít nhất 24 giờ,
// ghi người hủy, thời điểm hủy và chất lượng mẫu. Khi có phản ánh, nghi ngộ độc hoặc cơ quan quản lý yêu cầu thì giữ mẫu, mẫu
// giữ không hủy được đến khi bỏ giữ. Người lưu, hủy cần quyền P12.food-safety.inspect của đơn vị
const MAXIMUM_BATCH = 100;

@Injectable()
export class FoodSamplesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: KitchenAccess,
    private readonly inspections: FoodInspectionsService,
    private readonly clock: Clock,
  ) {}

  private async assertInspect(currentUser: CurrentUser, orgUnitId: string) {
    await this.access.assert(
      currentUser,
      PERMISSION_CODES.foodSafetyInspect,
      orgUnitId,
      'Bạn không có quyền lưu, hủy mẫu thức ăn của đơn vị này',
    );
  }

  async list(
    currentUser: CurrentUser,
    filter: { orgUnitId: string; from: string | null; to: string | null; status: FoodSampleStatus | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, filter.orgUnitId);
    const rows = await database
      .selectFrom('food_samples')
      .selectAll()
      .where('org_unit_id', '=', filter.orgUnitId)
      .$if(filter.from !== null, (query) => query.where('sample_date', '>=', filter.from ?? ''))
      .$if(filter.to !== null, (query) => query.where('sample_date', '<=', filter.to ?? ''))
      .$if(filter.status !== null, (query) => query.where('status', '=', filter.status ?? 'stored'))
      .orderBy('sample_date', 'desc')
      .orderBy('sampled_at', 'desc')
      .execute();
    const now = this.clock.now();
    return rows.map((row) => this.view(row, now));
  }

  view<Row extends { status: FoodSampleStatus; sampled_at: Date; quantity: string; storage_temperature: string }>(
    row: Row,
    now: Date,
  ) {
    return {
      ...row,
      quantity: Number(row.quantity),
      storage_temperature: Number(row.storage_temperature),
      earliest_destroy_at: earliestDestroyAt(row.sampled_at),
      destroy_state: sampleDestroyState(row, now),
    };
  }

  // Món của ngày theo thực đơn đã công bố và số suất, kèm mẫu đã lưu; bữa từ 30 suất phải lưu mẫu mọi món
  async suggestions(currentUser: CurrentUser, orgUnitId: string, date: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.access.assertRead(currentUser, orgUnitId);
    const dishes = await this.inspections.suggestedLines(database, orgUnitId, date, 3);
    const saved = await database
      .selectFrom('food_samples')
      .select(['meal_type', 'dish_id', 'dish_name'])
      .where('org_unit_id', '=', orgUnitId)
      .where('sample_date', '=', date)
      .execute();
    return dishes.map((dish) => ({
      meal_type: dish.meal_type,
      dish_id: dish.dish_id,
      dish_name: dish.dish_name,
      servings: dish.servings ?? 0,
      required: sampleRequired(dish.servings ?? 0),
      sampled: saved.some(
        (row) =>
          row.meal_type === dish.meal_type && (row.dish_id ?? row.dish_name) === (dish.dish_id ?? dish.dish_name),
      ),
    }));
  }

  async create(
    currentUser: CurrentUser,
    input: {
      org_unit_id: string;
      sample_date: string;
      meal_type: MealType;
      dish_id: string | null;
      dish_name: string;
      servings: number;
      food_form: FoodSampleForm;
      quantity: number;
      container: string;
      storage_temperature: number;
      sampled_at: Date;
      note: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertInspect(currentUser, input.org_unit_id);
    const errors = sampleViolations(input);
    if (input.sampled_at.getTime() > this.clock.now().getTime() + 5 * 60_000) {
      errors.push({ field: 'sampled_at', message: 'Thời điểm lấy mẫu không ở tương lai' });
    }
    if (input.dish_id) {
      const dish = await database
        .selectFrom('dishes')
        .select('org_unit_id')
        .where('id', '=', input.dish_id)
        .executeTakeFirst();
      if (!dish || dish.org_unit_id !== input.org_unit_id) {
        errors.push({ field: 'dish_id', message: 'Món phải thuộc đơn vị' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const created = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('food_samples')
        .values({
          ...input,
          sampled_by: currentUser.id,
          sampled_by_name: actorNameOf(currentUser),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'food_samples',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
    return this.view(created, this.clock.now());
  }

  // Hủy một hoặc nhiều mẫu đến hạn (đã đủ 24 giờ, không bị giữ); người hủy là người đăng nhập
  async destroy(
    currentUser: CurrentUser,
    ids: string[],
    input: { quality_note: string | null; destroyed_at: Date | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const samples = await database.selectFrom('food_samples').selectAll().where('id', 'in', ids).execute();
    if (samples.length !== ids.length) {
      throw notFoundError('Không tìm thấy mẫu thức ăn', 'food_sample');
    }
    for (const orgUnitId of new Set(samples.map((sample) => sample.org_unit_id))) {
      await this.assertInspect(currentUser, orgUnitId);
    }
    const now = this.clock.now();
    const destroyedAt = input.destroyed_at ?? now;
    if (destroyedAt.getTime() > now.getTime() + 5 * 60_000) {
      throw validationError([{ field: 'destroyed_at', message: 'Thời điểm hủy không ở tương lai' }]);
    }
    const problems: string[] = [];
    for (const sample of samples) {
      if (sample.status === 'held') {
        problems.push(`Mẫu ${sample.dish_name} ngày ${sample.sample_date} đang giữ, chưa được hủy`);
      } else if (sample.status === 'destroyed') {
        problems.push(`Mẫu ${sample.dish_name} ngày ${sample.sample_date} đã hủy`);
      } else if (destroyedAt.getTime() < earliestDestroyAt(sample.sampled_at).getTime()) {
        problems.push(`Mẫu ${sample.dish_name} ngày ${sample.sample_date} chưa lưu đủ 24 giờ`);
      }
    }
    if (problems.length > 0) {
      throw ruleViolationError('BR-142', problems.join('; '));
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('food_samples')
        .set({
          status: 'destroyed',
          destroyed_at: destroyedAt,
          destroyed_by: currentUser.id,
          destroyed_by_name: actorNameOf(currentUser),
          quality_note: input.quality_note,
          updated_at: now,
        })
        .where('id', 'in', ids)
        .where('status', '=', 'stored')
        .execute();
      for (const sample of samples) {
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: sample.org_unit_id,
          entityName: 'food_samples',
          entityId: sample.id,
          action: 'update',
          before: { status: sample.status },
          after: { status: 'destroyed', destroyed_at: destroyedAt, quality_note: input.quality_note },
        });
      }
    });
    return this.listByIds(database, ids);
  }

  // Giữ mẫu khi có phản ánh, nghi ngộ độc hoặc cơ quan quản lý yêu cầu; bỏ giữ thì mẫu về đang lưu
  async hold(currentUser: CurrentUser, id: string, reason: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const sample = await this.find(database, id);
    await this.assertInspect(currentUser, sample.org_unit_id);
    const holding = reason !== null;
    if (holding ? sample.status !== 'stored' : sample.status !== 'held') {
      throw ruleViolationError('BR-142', holding ? 'Chỉ giữ được mẫu đang lưu' : 'Mẫu không ở trạng thái giữ');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('food_samples')
        .set({
          status: holding ? 'held' : 'stored',
          hold_reason: holding ? reason : sample.hold_reason,
          held_by: holding ? currentUser.id : sample.held_by,
          held_at: holding ? new Date() : sample.held_at,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: sample.org_unit_id,
        entityName: 'food_samples',
        entityId: id,
        action: 'update',
        before: { status: sample.status },
        after: { status: holding ? 'held' : 'stored', hold_reason: reason },
      });
    });
    return (await this.listByIds(database, [id]))[0];
  }

  private async find(database: Kysely<SchoolYearDatabase>, id: string) {
    const sample = await database.selectFrom('food_samples').selectAll().where('id', '=', id).executeTakeFirst();
    if (!sample) {
      throw notFoundError('Không tìm thấy mẫu thức ăn', 'food_sample');
    }
    return sample;
  }

  private async listByIds(database: Kysely<SchoolYearDatabase>, ids: string[]) {
    const rows = await database.selectFrom('food_samples').selectAll().where('id', 'in', ids).execute();
    const now = this.clock.now();
    return rows.map((row) => this.view(row, now));
  }
}

function readNumber(body: RequestBody, field: string, errors: FieldError[]): number {
  const value = body?.[field];
  const number = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < -50 || number > 100_000) {
    errors.push({ field, message: 'Bắt buộc nhập số' });
    return 0;
  }
  return Math.round(number * 10) / 10;
}

@Controller()
export class FoodSamplesController {
  constructor(private readonly samples: FoodSamplesService) {}

  @Get('food-samples')
  list(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    const status = query.status as FoodSampleStatus | undefined;
    if (status !== undefined && !FOOD_SAMPLE_STATUSES.some((item) => item.value === status)) {
      throw validationError([{ field: 'status', message: 'Trạng thái là stored, held hoặc destroyed' }]);
    }
    return this.samples.list(currentUser, {
      orgUnitId: queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      from: queryDate(query.from, 'from'),
      to: queryDate(query.to, 'to'),
      status: status ?? null,
    });
  }

  @Get('food-samples/suggestions')
  suggestions(@Query() query: Record<string, unknown>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.samples.suggestions(
      currentUser,
      queryUuid(query.org_unit_id, 'org_unit_id', true) ?? '',
      queryDate(query.date, 'date', true) ?? '',
    );
  }

  @Post('food-samples')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị');
    const sampleDate = readDate(body, 'sample_date', errors, true) ?? '';
    const mealType = body?.meal_type as MealType;
    if (!MEAL_TYPES.includes(mealType)) {
      errors.push({ field: 'meal_type', message: 'Bữa là breakfast, lunch hoặc snack' });
    }
    const foodForm = body?.food_form as FoodSampleForm;
    if (!FOOD_SAMPLE_FORMS.some((item) => item.value === foodForm)) {
      errors.push({ field: 'food_form', message: 'Dạng thức ăn là solid hoặc liquid' });
    }
    const servings = body?.servings;
    if (typeof servings !== 'number' || !Number.isInteger(servings) || servings < 0 || servings > 100_000) {
      errors.push({ field: 'servings', message: 'Số suất là số nguyên không âm' });
    }
    const input = {
      org_unit_id: orgUnitId,
      sample_date: sampleDate,
      meal_type: mealType,
      dish_id: readOptionalUuid(body, 'dish_id', errors) ?? null,
      dish_name: readText(body, 'dish_name', errors, true) ?? '',
      servings: typeof servings === 'number' ? servings : 0,
      food_form: foodForm,
      quantity: readNumber(body, 'quantity', errors),
      container: readText(body, 'container', errors, true) ?? '',
      storage_temperature: readNumber(body, 'storage_temperature', errors),
      sampled_at: readMoment(body?.sampled_at, 'sampled_at', errors, true) ?? new Date(0),
      note: readText(body, 'note', errors),
    };
    check(errors);
    return this.samples.create(currentUser, input, originOf(request, currentUser));
  }

  @Post('food-samples/destroy')
  @HttpCode(200)
  destroy(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMUM_BATCH || !ids.every((id) => isUuid(id))) {
      errors.push({ field: 'ids', message: `Chọn từ 1 đến ${MAXIMUM_BATCH} mẫu` });
    }
    const qualityNote = readText(body, 'quality_note', errors);
    const destroyedAt = readMoment(body?.destroyed_at, 'destroyed_at', errors, false);
    check(errors);
    return this.samples.destroy(
      currentUser,
      [...new Set(ids as string[])],
      { quality_note: qualityNote, destroyed_at: destroyedAt },
      originOf(request, currentUser),
    );
  }

  @Post('food-samples/:id/hold')
  @HttpCode(200)
  hold(
    @Param('id', uuidParameter('Mã mẫu thức ăn không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readText(body, 'hold_reason', errors, true);
    check(errors);
    return this.samples.hold(currentUser, id, reason, originOf(request, currentUser));
  }

  @Post('food-samples/:id/release')
  @HttpCode(200)
  release(
    @Param('id', uuidParameter('Mã mẫu thức ăn không hợp lệ')) id: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.samples.hold(currentUser, id, null, originOf(request, currentUser));
  }
}
