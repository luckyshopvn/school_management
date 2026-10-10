import { Body, Controller, Delete, Get, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import type { FeeType, SchoolYearDatabase } from '@school-management/database';
import { Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely, type Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredText, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readAmount } from './fee-catalog-fields.js';

// Biểu phí dùng chung toàn trường theo phiên bản (P05-01, BR-17, BR-18, YCTD-49): mỗi phiên bản bắt đầu từ ngày 1 của
// một tháng, phiên bản sau đặt ngày kết thúc cho phiên bản trước. Phiên bản đã tới ngày hiệu lực không sửa được
export interface FeeScheduleItemInput {
  grade_level: string;
  fee_type: FeeType;
  service_id: string | null;
  amount: number;
}

const FIRST_DAY_PATTERN = /^\d{4}-\d{2}-01$/;
const SCHEDULE_COLUMNS = ['id', 'name', 'effective_from', 'effective_to'] as const;

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

@Injectable()
export class FeeSchedulesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async list() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    const schedules = await current.database
      .selectFrom('fee_schedules')
      .select(SCHEDULE_COLUMNS)
      .orderBy('effective_from', 'desc')
      .execute();
    const items = await this.items(
      current.database,
      schedules.map((schedule) => schedule.id),
    );
    const today = this.today();
    return schedules.map((schedule) => this.present(schedule, items, today));
  }

  async read(scheduleId: string) {
    const { database } = await this.currentSchoolYear.require();
    const schedule = await this.find(database, scheduleId);
    return this.present(schedule, await this.items(database, [scheduleId]), this.today());
  }

  // Phiên bản mới phải sau phiên bản mới nhất; phiên bản trước kết thúc ngay trước ngày hiệu lực mới
  async create(input: { name: string; effectiveFrom: string; items: FeeScheduleItemInput[] }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    await this.validateItems(database, input.items);
    const latest = await database
      .selectFrom('fee_schedules')
      .select(SCHEDULE_COLUMNS)
      .orderBy('effective_from', 'desc')
      .executeTakeFirst();
    if (latest && latest.effective_from >= input.effectiveFrom) {
      throw ruleViolationError(
        'BR-18',
        `Phiên bản mới phải có hiệu lực sau phiên bản mới nhất (từ ${latest.effective_from})`,
      );
    }
    const created = await database.transaction().execute(async (transaction) => {
      if (latest) {
        await transaction
          .updateTable('fee_schedules')
          .set({ effective_to: dayBefore(input.effectiveFrom), updated_at: this.clock.now() })
          .where('id', '=', latest.id)
          .execute();
      }
      const schedule = await transaction
        .insertInto('fee_schedules')
        .values({ name: input.name, effective_from: input.effectiveFrom, created_by: origin.actorUserId })
        .returning(SCHEDULE_COLUMNS)
        .executeTakeFirstOrThrow();
      await this.insertItems(transaction, schedule.id, input.items);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'fee_schedules',
        entityId: schedule.id,
        action: 'create',
        before: null,
        after: { ...schedule, items: input.items },
      });
      return schedule;
    });
    return this.read(created.id);
  }

  // Chỉ sửa được phiên bản chưa tới ngày hiệu lực; muốn đổi giá đang áp dụng thì tạo phiên bản mới (BR-18)
  async replace(scheduleId: string, input: { name: string; items: FeeScheduleItemInput[] }, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const schedule = await this.find(database, scheduleId);
    this.assertNotEffective(schedule.effective_from);
    await this.validateItems(database, input.items);
    const before = await this.read(scheduleId);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('fee_schedules')
        .set({ name: input.name, updated_at: this.clock.now() })
        .where('id', '=', scheduleId)
        .execute();
      await transaction.deleteFrom('fee_schedule_items').where('fee_schedule_id', '=', scheduleId).execute();
      await this.insertItems(transaction, scheduleId, input.items);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'fee_schedules',
        entityId: scheduleId,
        action: 'update',
        before,
        after: { name: input.name, items: input.items },
      });
    });
    return this.read(scheduleId);
  }

  // Xóa phiên bản mới nhất chưa tới ngày hiệu lực; phiên bản trước lại không có ngày kết thúc
  async remove(scheduleId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const schedule = await this.find(database, scheduleId);
    this.assertNotEffective(schedule.effective_from);
    if (schedule.effective_to !== null) {
      throw ruleViolationError('BR-18', 'Chỉ xóa được phiên bản mới nhất');
    }
    const before = await this.read(scheduleId);
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('fee_schedules').where('id', '=', scheduleId).execute();
      await transaction
        .updateTable('fee_schedules')
        .set({ effective_to: null, updated_at: this.clock.now() })
        .where('effective_to', '=', dayBefore(schedule.effective_from))
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'fee_schedules',
        entityId: scheduleId,
        action: 'delete',
        before,
        after: null,
      });
    });
    return { id: scheduleId, deleted: true };
  }

  private assertNotEffective(effectiveFrom: string): void {
    if (effectiveFrom <= this.today()) {
      throw ruleViolationError('BR-18', 'Biểu phí đã có hiệu lực, tạo phiên bản mới để thay đổi');
    }
  }

  private async find(database: Kysely<SchoolYearDatabase>, scheduleId: string) {
    const schedule = await database
      .selectFrom('fee_schedules')
      .select(SCHEDULE_COLUMNS)
      .where('id', '=', scheduleId)
      .executeTakeFirst();
    if (!schedule) {
      throw notFoundError('Không tìm thấy biểu phí', 'fee_schedule');
    }
    return schedule;
  }

  private async items(database: Kysely<SchoolYearDatabase>, scheduleIds: string[]) {
    if (scheduleIds.length === 0) {
      return [];
    }
    return database
      .selectFrom('fee_schedule_items')
      .leftJoin('services', 'services.id', 'fee_schedule_items.service_id')
      .select([
        'fee_schedule_items.fee_schedule_id',
        'fee_schedule_items.grade_level',
        'fee_schedule_items.fee_type',
        'fee_schedule_items.service_id',
        'services.name as service_name',
        'fee_schedule_items.amount',
      ])
      .where('fee_schedule_items.fee_schedule_id', 'in', scheduleIds)
      .orderBy('fee_schedule_items.grade_level')
      .orderBy('fee_schedule_items.fee_type', 'desc')
      .orderBy(sql`services.name nulls first`)
      .execute();
  }

  private present(
    schedule: { id: string; name: string; effective_from: string; effective_to: string | null },
    items: Awaited<ReturnType<FeeSchedulesService['items']>>,
    today: string,
  ) {
    return {
      ...schedule,
      is_editable: schedule.effective_from > today,
      items: items
        .filter((item) => item.fee_schedule_id === schedule.id)
        .map((item) => ({
          grade_level: item.grade_level,
          fee_type: item.fee_type,
          service_id: item.service_id,
          service_name: item.service_name,
          amount: Number(item.amount),
        })),
    };
  }

  // Bậc học và dịch vụ phải có trong danh mục; mỗi bậc học một dòng học phí, mỗi dịch vụ một giá
  private async validateItems(database: Kysely<SchoolYearDatabase>, items: FeeScheduleItemInput[]): Promise<void> {
    const gradeLevels = new Set(
      (await database.selectFrom('grade_levels').select('code').execute()).map((row) => row.code),
    );
    const services = new Map(
      (await database.selectFrom('services').select(['id', 'status']).execute()).map((row) => [row.id, row.status]),
    );
    const errors: FieldError[] = [];
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (!gradeLevels.has(item.grade_level)) {
        errors.push({ field: `items.${index}.grade_level`, message: 'Bậc học không có trong danh mục' });
      }
      if (item.fee_type === 'service' && services.get(item.service_id ?? '') !== 'active') {
        errors.push({ field: `items.${index}.service_id`, message: 'Dịch vụ không có hoặc đã ngừng sử dụng' });
      }
      const key = `${item.grade_level}:${item.fee_type}:${item.service_id ?? ''}`;
      if (seen.has(key)) {
        errors.push({ field: `items.${index}`, message: 'Trùng giá của cùng bậc học và khoản phí' });
      }
      seen.add(key);
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  private async insertItems(
    transaction: Transaction<SchoolYearDatabase>,
    scheduleId: string,
    items: FeeScheduleItemInput[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await transaction
      .insertInto('fee_schedule_items')
      .values(items.map((item) => ({ ...item, fee_schedule_id: scheduleId })))
      .execute();
  }
}

function readItems(body: RequestBody, errors: FieldError[]): FeeScheduleItemInput[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push({ field: 'items', message: 'Cần ít nhất một dòng giá' });
    return [];
  }
  return raw.map((value, index) => {
    const item = (value ?? {}) as Record<string, unknown>;
    if (typeof item.grade_level !== 'string' || item.grade_level.trim() === '') {
      errors.push({ field: `items.${index}.grade_level`, message: 'Bắt buộc chọn bậc học' });
    }
    if (item.fee_type !== 'tuition' && item.fee_type !== 'service') {
      errors.push({ field: `items.${index}.fee_type`, message: 'Loại phí là tuition hoặc service' });
    }
    const serviceId = item.fee_type === 'service' ? item.service_id : null;
    if (item.fee_type === 'service' && !isUuid(serviceId)) {
      errors.push({ field: `items.${index}.service_id`, message: 'Bắt buộc chọn dịch vụ' });
    }
    return {
      grade_level: String(item.grade_level ?? '').trim(),
      fee_type: item.fee_type as FeeType,
      service_id: (serviceId as string | null) ?? null,
      amount: readAmount(item.amount, `items.${index}.amount`, errors),
    };
  });
}

// Mọi người đã đăng nhập xem được để biết mức phí; kế toán tạo phiên bản (P05-01)
@Controller('fee-schedules')
export class FeeSchedulesController {
  constructor(private readonly feeSchedulesService: FeeSchedulesService) {}

  @Get()
  list() {
    return this.feeSchedulesService.list();
  }

  @Get(':id')
  read(@Param('id', uuidParameter('Mã biểu phí không hợp lệ')) scheduleId: string) {
    return this.feeSchedulesService.read(scheduleId);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.feeCatalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const effectiveFrom = body?.effective_from;
    if (
      typeof effectiveFrom !== 'string' ||
      !FIRST_DAY_PATTERN.test(effectiveFrom) ||
      Number.isNaN(Date.parse(effectiveFrom))
    ) {
      errors.push({ field: 'effective_from', message: 'Ngày hiệu lực là ngày 1 của một tháng, dạng YYYY-MM-01' });
    }
    const items = readItems(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.feeSchedulesService.create(
      { name, effectiveFrom: effectiveFrom as string, items },
      originOf(request, currentUser),
    );
  }

  @Put(':id')
  @RequirePermission(PERMISSION_CODES.feeCatalogManage)
  replace(
    @Param('id', uuidParameter('Mã biểu phí không hợp lệ')) scheduleId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readRequiredText(body, 'name', errors);
    const items = readItems(body, errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.feeSchedulesService.replace(scheduleId, { name, items }, originOf(request, currentUser));
  }

  @Delete(':id')
  @RequirePermission(PERMISSION_CODES.feeCatalogManage)
  remove(
    @Param('id', uuidParameter('Mã biểu phí không hợp lệ')) scheduleId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.feeSchedulesService.remove(scheduleId, originOf(request, currentUser));
  }
}
