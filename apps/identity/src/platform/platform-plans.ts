import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Req } from '@nestjs/common';
import { applyPlanLifecycle, asDateText, writeAudit, type PlatformDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  isPlanModuleKey,
  PLAN_BILLING_CYCLES,
  PLAN_MODULES,
  PLAN_PRICING_MODES,
  type PlanBillingCycle,
  type PlanPricingMode,
} from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { PlatformOperatorsService } from './platform-operators.js';

// Gói dịch vụ ở cổng vận hành nền tảng (DT-SaaS phần S5a, YCTD-194; tài liệu 32 mục 14.5): người vận hành lập gói (phân hệ, giới
// hạn, giá niêm yết cho S5b), gán gói cho trường có ngày hiệu lực, đặt hạn dùng thử, hạn đã trả phí, đổi trạng thái (dùng thử, hoạt
// động, chỉ đọc, tạm ngưng), chạy chuyển trạng thái theo hạn. Chỉ phục vụ ở tên miền của cổng nền tảng với mã phiên vận hành.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const PLAN_RULE_CODE = 'YCTD-194';
const SCHOOL_PLAN_STATUSES = ['trial', 'active', 'read_only', 'suspended'] as const;
type SchoolPlanStatus = (typeof SCHOOL_PLAN_STATUSES)[number];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string): string {
  if (!UUID.test(id)) {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
  }
  return id;
}

type Body_ = Record<string, unknown> | undefined;

function optionalCount(body: Body_, field: string, errors: FieldError[], max = 10_000_000): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    errors.push({ field, message: `Số nguyên từ 0 đến ${max}, để trống là không giới hạn` });
    return null;
  }
  return value;
}

function money(body: Body_, field: string, errors: FieldError[]): number {
  const value = body?.[field] ?? 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000_000_000) {
    errors.push({ field, message: 'Số tiền (đồng) là số nguyên không âm' });
    return 0;
  }
  return value;
}

function optionalDate(body: Body_, field: string, errors: FieldError[]): string | null | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push({ field, message: 'Ngày dạng yyyy-mm-dd' });
    return undefined;
  }
  return value;
}

export interface PlanInput {
  code: string;
  name: string;
  description: string | null;
  modules: string[] | null;
  max_active_students: number | null;
  max_storage_mb: number | null;
  max_school_levels: number | null;
  trial_days: number;
  pricing_mode: PlanPricingMode;
  unit_price: number;
  minimum_fee: number;
  module_prices: Record<string, number>;
  billing_cycle: PlanBillingCycle;
  status: 'active' | 'archived';
  // Quy tắc tính phí (S5b); trống là tính theo giá niêm yết của gói
  price_rule_id: string | null;
}

export function parsePlanInput(body: Body_): PlanInput {
  const errors: FieldError[] = [];
  const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : '';
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(code)) {
    errors.push({ field: 'code', message: 'Mã gói gồm chữ thường, số, gạch nối, tối đa 41 ký tự' });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 200) {
    errors.push({ field: 'name', message: 'Tên gói từ 1 đến 200 ký tự' });
  }
  const description =
    typeof body?.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 2000) : null;
  let modules: string[] | null = null;
  if (body?.modules !== undefined && body.modules !== null) {
    if (!Array.isArray(body.modules) || body.modules.some((module) => !isPlanModuleKey(module))) {
      errors.push({ field: 'modules', message: 'Danh sách mã phân hệ hợp lệ; để trống là mọi phân hệ' });
    } else {
      modules = [...new Set(body.modules as string[])];
    }
  }
  const maxSchoolLevels = optionalCount(body, 'max_school_levels', errors, 4);
  if (maxSchoolLevels === 0) {
    errors.push({ field: 'max_school_levels', message: 'Từ 1 đến 4 cấp học' });
  }
  const trialDays = optionalCount(body, 'trial_days', errors, 365) ?? 30;
  const pricingMode = (body?.pricing_mode ?? 'per_student') as PlanPricingMode;
  if (!PLAN_PRICING_MODES.includes(pricingMode)) {
    errors.push({ field: 'pricing_mode', message: 'Cách tính là per_student, per_school hoặc per_module' });
  }
  const billingCycle = (body?.billing_cycle ?? 'monthly') as PlanBillingCycle;
  if (!PLAN_BILLING_CYCLES.includes(billingCycle)) {
    errors.push({ field: 'billing_cycle', message: 'Kỳ thu là monthly, term hoặc yearly' });
  }
  const modulePrices: Record<string, number> = {};
  if (body?.module_prices !== undefined && body.module_prices !== null) {
    if (typeof body.module_prices !== 'object' || Array.isArray(body.module_prices)) {
      errors.push({ field: 'module_prices', message: 'Giá từng phân hệ: mã phân hệ → số tiền' });
    } else {
      for (const [key, value] of Object.entries(body.module_prices as Record<string, unknown>)) {
        if (!isPlanModuleKey(key) || typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
          errors.push({ field: `module_prices.${key}`, message: 'Mã phân hệ hợp lệ, số tiền nguyên không âm' });
          continue;
        }
        modulePrices[key] = value;
      }
    }
  }
  const status = body?.status ?? 'active';
  if (status !== 'active' && status !== 'archived') {
    errors.push({ field: 'status', message: 'Trạng thái là active hoặc archived' });
  }
  const priceRuleId =
    typeof body?.price_rule_id === 'string' && body.price_rule_id.trim()
      ? body.price_rule_id.trim().toLowerCase()
      : null;
  if (priceRuleId !== null && !UUID.test(priceRuleId)) {
    errors.push({ field: 'price_rule_id', message: 'Mã quy tắc tính phí không hợp lệ' });
  }
  const input: PlanInput = {
    code,
    name,
    description,
    modules,
    max_active_students: optionalCount(body, 'max_active_students', errors),
    max_storage_mb: optionalCount(body, 'max_storage_mb', errors),
    max_school_levels: maxSchoolLevels,
    trial_days: trialDays,
    pricing_mode: pricingMode,
    unit_price: money(body, 'unit_price', errors),
    minimum_fee: money(body, 'minimum_fee', errors),
    module_prices: modulePrices,
    billing_cycle: billingCycle,
    status: status as 'active' | 'archived',
    price_rule_id: priceRuleId,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

@Injectable()
export class PlatformPlansService {
  constructor(
    private readonly operators: PlatformOperatorsService,
    private readonly clock: Clock,
  ) {}

  // Tên miền của cổng nền tảng và mã phiên vận hành còn hiệu lực
  async authorize(request: Request): Promise<{ platform: Kysely<PlatformDatabase>; operatorId: string }> {
    this.operators.assertConsoleHost(request);
    const operator = await this.operators.me(readBearerToken(request.header('authorization')));
    return { platform: this.operators.platformDatabase(), operatorId: operator.id };
  }

  async listPlans(platform: Kysely<PlatformDatabase>) {
    const today = this.today();
    const rows = await platform.selectFrom('plans').selectAll().orderBy('status').orderBy('code').execute();
    const assigned = await platform
      .selectFrom('school_plans')
      .select(['plan_id', 'school_id'])
      .where('effective_from', '<=', today)
      .where((expression) =>
        expression.or([expression('effective_to', 'is', null), expression('effective_to', '>', today)]),
      )
      .execute();
    return rows.map((row) => ({
      ...row,
      unit_price: Number(row.unit_price),
      minimum_fee: Number(row.minimum_fee),
      school_count: new Set(assigned.filter((item) => item.plan_id === row.id).map((item) => item.school_id)).size,
    }));
  }

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now());
  }

  async savePlan(platform: Kysely<PlatformDatabase>, operatorId: string, id: string | null, input: PlanInput) {
    const duplicate = await platform.selectFrom('plans').select('id').where('code', '=', input.code).executeTakeFirst();
    if (input.price_rule_id) {
      const rule = await platform
        .selectFrom('price_rules')
        .select('id')
        .where('id', '=', input.price_rule_id)
        .executeTakeFirst();
      if (!rule) {
        throw validationError([{ field: 'price_rule_id', message: 'Không tìm thấy quy tắc tính phí' }]);
      }
    }
    if (duplicate && duplicate.id !== id) {
      throw new ApplicationError('ERR_CONFLICT', 'Mã gói đã có');
    }
    const values = {
      ...input,
      modules: input.modules === null ? null : JSON.stringify(input.modules),
      module_prices: JSON.stringify(input.module_prices),
    };
    let saved;
    if (id === null) {
      saved = await platform.insertInto('plans').values(values).returning('id').executeTakeFirstOrThrow();
    } else {
      saved = await platform
        .updateTable('plans')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();
      if (!saved) {
        throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy gói');
      }
    }
    await writeAudit(platform, {
      actorType: 'operator',
      actorId: operatorId,
      action: id === null ? 'plan.create' : 'plan.update',
      details: { plan_id: saved.id, code: input.code },
    });
    return (await this.listPlans(platform)).find((row) => row.id === saved.id);
  }

  // Trường kèm gói hiện hành, trạng thái và hạn
  async listSchools(platform: Kysely<PlatformDatabase>) {
    const today = this.today();
    const schools = await platform
      .selectFrom('schools')
      .select(['id', 'code', 'name', 'status', 'data_class', 'trial_ends_on', 'paid_until', 'status_changed_at'])
      .where('status', 'not in', ['provisioning', 'deleted'])
      .orderBy('code')
      .execute();
    const assignments = await platform
      .selectFrom('school_plans')
      .innerJoin('plans', 'plans.id', 'school_plans.plan_id')
      .select([
        'school_plans.school_id',
        'school_plans.effective_from',
        'school_plans.effective_to',
        'plans.id as plan_id',
        'plans.code as plan_code',
        'plans.name as plan_name',
      ])
      .where('school_plans.effective_from', '<=', today)
      .where((expression) =>
        expression.or([
          expression('school_plans.effective_to', 'is', null),
          expression('school_plans.effective_to', '>', today),
        ]),
      )
      .orderBy('school_plans.effective_from', 'desc')
      .orderBy('school_plans.created_at', 'desc')
      .execute();
    return schools.map((school) => {
      const current = assignments.find((row) => row.school_id === school.id);
      return {
        ...school,
        trial_ends_on: asDateText(school.trial_ends_on),
        paid_until: asDateText(school.paid_until),
        plan: current
          ? {
              id: current.plan_id,
              code: current.plan_code,
              name: current.plan_name,
              effective_from: asDateText(current.effective_from),
            }
          : null,
      };
    });
  }

  // Gán gói (từ ngày hiệu lực, mặc định hôm nay) và/hoặc đặt hạn, trạng thái của một trường
  async updateSchool(platform: Kysely<PlatformDatabase>, operatorId: string, schoolId: string, body: Body_) {
    const errors: FieldError[] = [];
    const planId = body?.plan_id;
    if (planId !== undefined && typeof planId !== 'string') {
      errors.push({ field: 'plan_id', message: 'Chọn gói' });
    }
    const effectiveFrom = optionalDate(body, 'effective_from', errors) ?? this.today();
    const trialEndsOn = optionalDate(body, 'trial_ends_on', errors);
    const paidUntil = optionalDate(body, 'paid_until', errors);
    const status = body?.status;
    if (status !== undefined && !SCHOOL_PLAN_STATUSES.includes(status as SchoolPlanStatus)) {
      errors.push({ field: 'status', message: 'Trạng thái là trial, active, read_only hoặc suspended' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const school = await platform
      .selectFrom('schools')
      .select(['id', 'status', 'trial_ends_on', 'paid_until'])
      .where('id', '=', schoolId)
      .executeTakeFirst();
    if (!school || school.status === 'deleted') {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy trường');
    }
    if (status !== undefined && !SCHOOL_PLAN_STATUSES.includes(school.status as SchoolPlanStatus)) {
      throw ruleViolationError(PLAN_RULE_CODE, 'Trường đang khởi tạo hoặc chờ xóa, không đổi trạng thái gói được');
    }
    const now = this.clock.now();
    await platform.transaction().execute(async (transaction) => {
      if (typeof planId === 'string') {
        assertId(planId);
        const plan = await transaction
          .selectFrom('plans')
          .select(['id', 'status', 'trial_days'])
          .where('id', '=', planId)
          .executeTakeFirst();
        if (!plan || plan.status !== 'active') {
          throw validationError([{ field: 'plan_id', message: 'Gói không có hoặc đã ngừng dùng' }]);
        }
        // Bản gán trước còn hiệu lực đến ngày gói mới bắt đầu; bản gán bắt đầu từ ngày đó trở đi bị thay
        await transaction
          .deleteFrom('school_plans')
          .where('school_id', '=', schoolId)
          .where('effective_from', '>=', effectiveFrom)
          .execute();
        await transaction
          .updateTable('school_plans')
          .set({ effective_to: effectiveFrom })
          .where('school_id', '=', schoolId)
          .where((expression) =>
            expression.or([expression('effective_to', 'is', null), expression('effective_to', '>', effectiveFrom)]),
          )
          .execute();
        await transaction
          .insertInto('school_plans')
          .values({ school_id: schoolId, plan_id: planId, effective_from: effectiveFrom, assigned_by: operatorId })
          .execute();
      }
      const changes: Record<string, unknown> = {};
      if (trialEndsOn !== undefined) changes.trial_ends_on = trialEndsOn;
      if (paidUntil !== undefined) changes.paid_until = paidUntil;
      if (status !== undefined && status !== school.status) {
        changes.status = status;
        changes.status_changed_at = now;
      }
      if (Object.keys(changes).length > 0) {
        await transaction
          .updateTable('schools')
          .set({ ...changes, updated_at: now })
          .where('id', '=', schoolId)
          .execute();
      }
      await writeAudit(transaction, {
        actorType: 'operator',
        actorId: operatorId,
        action: 'school.plan-update',
        schoolId,
        details: { plan_id: planId ?? null, effective_from: planId ? effectiveFrom : null, ...changes },
      });
    });
    return (await this.listSchools(platform)).find((row) => row.id === schoolId);
  }

  async runLifecycle(platform: Kysely<PlatformDatabase>, operatorId: string) {
    return applyPlanLifecycle(platform, this.clock.now(), { type: 'operator', id: operatorId });
  }
}

@Controller('auth/platform')
export class PlatformPlansController {
  constructor(private readonly plans: PlatformPlansService) {}

  @Get('plan-modules')
  async modules(@Req() request: Request) {
    await this.plans.authorize(request);
    return PLAN_MODULES;
  }

  @Get('plans')
  async list(@Req() request: Request) {
    const { platform } = await this.plans.authorize(request);
    return this.plans.listPlans(platform);
  }

  @Post('plans')
  async create(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.plans.authorize(request);
    return this.plans.savePlan(platform, operatorId, null, parsePlanInput(body));
  }

  @Put('plans/:id')
  async update(@Param('id') id: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.plans.authorize(request);
    return this.plans.savePlan(platform, operatorId, assertId(id), parsePlanInput(body));
  }

  @Get('plan-schools')
  async schools(@Req() request: Request) {
    const { platform } = await this.plans.authorize(request);
    return this.plans.listSchools(platform);
  }

  @Put('plan-schools/:id')
  async updateSchool(@Param('id') id: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.plans.authorize(request);
    return this.plans.updateSchool(platform, operatorId, assertId(id), body);
  }

  @Post('plan-lifecycle')
  @HttpCode(200)
  async lifecycle(@Req() request: Request) {
    const { platform, operatorId } = await this.plans.authorize(request);
    return this.plans.runLifecycle(platform, operatorId);
  }
}
