import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  applyDiscount,
  assignPayment,
  BillingError,
  cancelEInvoice,
  EINVOICE_PROVIDER_CODES,
  grantFreePeriod,
  invoiceDetail,
  isPlatformPaymentConnector,
  issueEInvoice,
  issueInvoice,
  listInvoices,
  listPlatformConnectors,
  listUnmatchedPayments,
  loadBillingPlan,
  periodContaining,
  PricingError,
  readBillingSettings,
  receivables,
  recordManualPayment,
  saveBillingSettings,
  savePlatformConnector,
  validatePriceRule,
  vietnamDate,
  voidInvoice,
  writeAudit,
  type BillingPeriod,
  type BillingSettings,
  type PlatformDatabase,
  type PriceComponent,
  type PriceRule,
  type StudentTier,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, readBearerToken, validationError, type FieldError } from '@school-management/server';
import { isPlanModuleKey, PLAN_MODULES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { PlatformOperatorsService } from './platform-operators.js';

// Thu phí ở cổng vận hành nền tảng (DT-SaaS phần S5b, YCTD-196; tài liệu 32 mục 14.5): quy tắc tính phí, hóa đơn và công nợ, lập hóa
// đơn tay, điều chỉnh tay có lý do (giảm giá, tặng kỳ, ghi nhận tiền tay, hủy hóa đơn, gán giao dịch chưa khớp), hóa đơn điện tử, cấu
// hình thu phí và khóa cổng thanh toán của nền tảng (lưu mã hóa bằng khóa gốc của nền tảng). Chỉ phục vụ ở tên miền của cổng nền tảng
// với mã phiên vận hành. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPONENTS: PriceComponent[] = ['per_student', 'per_school', 'per_module'];
const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'yearly'];
const MODULE_KEYS = PLAN_MODULES.filter((module) => !module.core).map((module) => module.key);
const MODULE_LABELS = Object.fromEntries(PLAN_MODULES.map((module) => [module.key, module.label]));

type Body_ = Record<string, unknown> | undefined;

function assertId(id: string): string {
  if (!UUID.test(id)) {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
  }
  return id;
}

const asApplicationError = (error: unknown): unknown => {
  if (error instanceof BillingError) {
    return new ApplicationError(
      error.code === 'not_found' ? 'ERR_NOT_FOUND' : error.code === 'conflict' ? 'ERR_CONFLICT' : 'ERR_VALIDATION',
      error.message,
    );
  }
  if (error instanceof PricingError) {
    return validationError([{ field: 'rule', message: error.message }]);
  }
  return error;
};

async function mapped<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    throw asApplicationError(error);
  }
}

function wholeNumber(body: Body_, field: string, errors: FieldError[], options: { min?: number; max?: number } = {}) {
  const value = body?.[field] ?? 0;
  const min = options.min ?? 0;
  const max = options.max ?? 1_000_000_000_000;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, message: `Số nguyên từ ${min} đến ${max}` });
    return 0;
  }
  return value;
}

function text(body: Body_, field: string): string {
  return typeof body?.[field] === 'string' ? (body[field] as string).trim() : '';
}

export interface PriceRuleInput {
  code: string;
  name: string;
  rule: PriceRule;
  status: 'active' | 'archived';
}

export function parsePriceRuleInput(body: Body_): PriceRuleInput {
  const errors: FieldError[] = [];
  const code = text(body, 'code').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(code)) {
    errors.push({ field: 'code', message: 'Mã gồm chữ thường, số, gạch nối, tối đa 41 ký tự' });
  }
  const name = text(body, 'name');
  if (name.length < 1 || name.length > 200) {
    errors.push({ field: 'name', message: 'Tên từ 1 đến 200 ký tự' });
  }
  const components = Array.isArray(body?.components) ? [...new Set(body.components as unknown[])] : ['per_student'];
  if (components.length === 0 || components.some((item) => !COMPONENTS.includes(item as PriceComponent))) {
    errors.push({ field: 'components', message: 'Thành phần là per_student, per_school, per_module (ít nhất một)' });
  }
  const tiers: StudentTier[] = [];
  if (body?.student_tiers !== undefined) {
    if (!Array.isArray(body.student_tiers)) {
      errors.push({ field: 'student_tiers', message: 'Bảng giá theo học sinh là danh sách bậc' });
    } else {
      for (const tier of body.student_tiers as Array<Record<string, unknown>>) {
        const upTo = tier?.up_to === null || tier?.up_to === undefined || tier?.up_to === '' ? null : tier.up_to;
        tiers.push({ up_to: upTo as number | null, unit_price: tier?.unit_price as number });
      }
    }
  }
  const tierMode = body?.tier_mode ?? 'graduated';
  if (tierMode !== 'graduated' && tierMode !== 'volume') {
    errors.push({ field: 'tier_mode', message: 'Cách tính bậc là graduated hoặc volume' });
  }
  const modulePrices: Record<string, number> = {};
  if (body?.module_prices !== undefined && body.module_prices !== null) {
    if (typeof body.module_prices !== 'object' || Array.isArray(body.module_prices)) {
      errors.push({ field: 'module_prices', message: 'Giá từng phân hệ: mã phân hệ → số tiền' });
    } else {
      for (const [key, value] of Object.entries(body.module_prices as Record<string, unknown>)) {
        if (!isPlanModuleKey(key) || typeof value !== 'number') {
          errors.push({ field: `module_prices.${key}`, message: 'Mã phân hệ hợp lệ, số tiền nguyên không âm' });
          continue;
        }
        modulePrices[key] = value;
      }
    }
  }
  const period = (body?.period ?? 'monthly') as BillingPeriod;
  if (!PERIODS.includes(period)) {
    errors.push({ field: 'period', message: 'Kỳ là monthly, quarterly hoặc yearly' });
  }
  const status = body?.status ?? 'active';
  if (status !== 'active' && status !== 'archived') {
    errors.push({ field: 'status', message: 'Trạng thái là active hoặc archived' });
  }
  const rule: PriceRule = {
    code,
    name,
    components: components as PriceComponent[],
    studentTiers: tiers,
    tierMode: tierMode as 'graduated' | 'volume',
    schoolFee: wholeNumber(body, 'school_fee', errors),
    modulePrices,
    minimumFee: wholeNumber(body, 'minimum_fee', errors),
    period,
    vatPercent: wholeNumber(body, 'vat_percent', errors, { max: 100 }),
    dueDays: body?.due_days === undefined ? 15 : wholeNumber(body, 'due_days', errors, { max: 120 }),
  };
  if (errors.length === 0) {
    try {
      validatePriceRule(rule);
    } catch (error) {
      errors.push({ field: 'student_tiers', message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return { code, name, rule, status: status as 'active' | 'archived' };
}

export function parseBillingSettings(body: Body_, current: BillingSettings): BillingSettings {
  const errors: FieldError[] = [];
  const prefix =
    body?.invoice_prefix === undefined ? current.invoicePrefix : text(body, 'invoice_prefix').toUpperCase();
  if (!/^[A-Z]{1,6}$/.test(prefix)) {
    errors.push({ field: 'invoice_prefix', message: 'Tiền tố mã hóa đơn từ 1 đến 6 chữ cái' });
  }
  const account = (body?.receiving_account ?? {}) as Record<string, unknown>;
  const accountText = (key: string, fallback: string | null) =>
    account[key] === undefined
      ? fallback
      : typeof account[key] === 'string' && account[key]
        ? String(account[key]).trim()
        : null;
  const bankBin = accountText('bank_bin', current.receivingAccount.bankBin);
  if (bankBin !== null && !/^\d{6}$/.test(bankBin)) {
    errors.push({ field: 'receiving_account.bank_bin', message: 'Mã BIN ngân hàng gồm 6 chữ số' });
  }
  const accountNumber = accountText('account_number', current.receivingAccount.accountNumber);
  if (accountNumber !== null && !/^\d{4,30}$/.test(accountNumber)) {
    errors.push({ field: 'receiving_account.account_number', message: 'Số tài khoản gồm 4 đến 30 chữ số' });
  }
  const provider = body?.einvoice_provider === undefined ? current.einvoiceProvider : text(body, 'einvoice_provider');
  if (!(EINVOICE_PROVIDER_CODES as readonly string[]).includes(provider)) {
    errors.push({ field: 'einvoice_provider', message: 'Bộ nối hóa đơn điện tử là none hoặc development' });
  }
  const dayList = (field: string, fallback: number[]) => {
    const value = body?.[field];
    if (value === undefined) {
      return fallback;
    }
    if (
      !Array.isArray(value) ||
      value.some((day) => !Number.isInteger(day) || day < 0 || day > 120) ||
      value.length > 10
    ) {
      errors.push({ field, message: 'Danh sách số ngày từ 0 đến 120' });
      return fallback;
    }
    return [...new Set(value as number[])].sort((left, right) => right - left);
  };
  const channels = body?.channels === undefined ? current.channels : body.channels;
  if (!Array.isArray(channels) || channels.some((channel) => channel !== 'in_app' && channel !== 'sms')) {
    errors.push({ field: 'channels', message: 'Kênh nhắc là in_app, sms' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    invoicePrefix: prefix,
    receivingAccount: {
      bankBin,
      accountNumber,
      accountName: accountText('account_name', current.receivingAccount.accountName),
    },
    einvoiceProvider: provider,
    autoIssueEinvoice:
      typeof body?.auto_issue_einvoice === 'boolean' ? body.auto_issue_einvoice : current.autoIssueEinvoice,
    remindDaysBefore: dayList('remind_days_before', current.remindDaysBefore),
    remindDaysAfter: dayList('remind_days_after', current.remindDaysAfter),
    channels: channels as string[],
  };
}

@Injectable()
export class PlatformBillingService {
  constructor(
    private readonly operators: PlatformOperatorsService,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  async authorize(request: Request): Promise<{ platform: Kysely<PlatformDatabase>; operatorId: string }> {
    this.operators.assertConsoleHost(request);
    const operator = await this.operators.me(readBearerToken(request.header('authorization')));
    return { platform: this.operators.platformDatabase(), operatorId: operator.id };
  }

  today(): string {
    return vietnamDate(this.clock.now());
  }

  private masterKey(): Buffer {
    if (!this.tenancy) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
    }
    return this.tenancy.configuration.masterKey;
  }

  async overview(platform: Kysely<PlatformDatabase>) {
    const settings = await readBillingSettings(platform);
    return {
      settings: {
        invoice_prefix: settings.invoicePrefix,
        receiving_account: {
          bank_bin: settings.receivingAccount.bankBin,
          account_number: settings.receivingAccount.accountNumber,
          account_name: settings.receivingAccount.accountName,
        },
        einvoice_provider: settings.einvoiceProvider,
        auto_issue_einvoice: settings.autoIssueEinvoice,
        remind_days_before: settings.remindDaysBefore,
        remind_days_after: settings.remindDaysAfter,
        channels: settings.channels,
      },
      einvoice_providers: EINVOICE_PROVIDER_CODES,
      connectors: await listPlatformConnectors(platform),
      receivables: await receivables(platform, this.today()),
      unmatched_payments: await listUnmatchedPayments(platform),
      modules: PLAN_MODULES.filter((module) => !module.core),
    };
  }

  async saveSettings(platform: Kysely<PlatformDatabase>, operatorId: string, body: Body_) {
    const settings = parseBillingSettings(body, await readBillingSettings(platform));
    await saveBillingSettings(platform, settings, { type: 'operator', id: operatorId });
    return this.overview(platform);
  }

  async saveConnector(platform: Kysely<PlatformDatabase>, operatorId: string, connector: string, body: Body_) {
    if (!isPlatformPaymentConnector(connector)) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy kết nối');
    }
    const values = (body?.values ?? {}) as Record<string, unknown>;
    const strings = Object.fromEntries(
      Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    try {
      await savePlatformConnector(
        platform,
        this.masterKey(),
        { connector, enabled: body?.enabled !== false, values: strings },
        { type: 'operator', id: operatorId },
      );
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      throw validationError([{ field: 'values', message: error instanceof Error ? error.message : String(error) }]);
    }
    return listPlatformConnectors(platform);
  }

  async listRules(platform: Kysely<PlatformDatabase>) {
    const rows = await platform.selectFrom('price_rules').selectAll().orderBy('status').orderBy('code').execute();
    const used = await platform
      .selectFrom('plans')
      .select(['price_rule_id', 'code'])
      .where('price_rule_id', 'is not', null)
      .execute();
    return rows.map((row) => ({
      ...row,
      school_fee: Number(row.school_fee),
      minimum_fee: Number(row.minimum_fee),
      plans: used.filter((plan) => plan.price_rule_id === row.id).map((plan) => plan.code),
    }));
  }

  async saveRule(platform: Kysely<PlatformDatabase>, operatorId: string, id: string | null, input: PriceRuleInput) {
    const duplicate = await platform
      .selectFrom('price_rules')
      .select('id')
      .where('code', '=', input.code)
      .executeTakeFirst();
    if (duplicate && duplicate.id !== id) {
      throw new ApplicationError('ERR_CONFLICT', 'Mã quy tắc đã có');
    }
    const values = {
      code: input.code,
      name: input.name,
      components: JSON.stringify(input.rule.components),
      student_tiers: JSON.stringify(input.rule.studentTiers),
      tier_mode: input.rule.tierMode,
      school_fee: input.rule.schoolFee,
      module_prices: JSON.stringify(input.rule.modulePrices),
      minimum_fee: input.rule.minimumFee,
      period: input.rule.period,
      vat_percent: input.rule.vatPercent,
      due_days: input.rule.dueDays,
      status: input.status,
    };
    const saved =
      id === null
        ? await platform.insertInto('price_rules').values(values).returning('id').executeTakeFirstOrThrow()
        : await platform
            .updateTable('price_rules')
            .set({ ...values, updated_at: this.clock.now() })
            .where('id', '=', id)
            .returning('id')
            .executeTakeFirst();
    if (!saved) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy quy tắc');
    }
    await writeAudit(platform, {
      actorType: 'operator',
      actorId: operatorId,
      action: id === null ? 'billing.price-rule-create' : 'billing.price-rule-update',
      details: { code: input.code, rule: input.rule },
    });
    return { id: saved.id };
  }

  invoices(platform: Kysely<PlatformDatabase>, query: Record<string, string | undefined>) {
    const status = query.status;
    return listInvoices(platform, {
      today: this.today(),
      ...(status === 'issued' || status === 'paid' || status === 'void' || status === 'overdue' ? { status } : {}),
      ...(query.school_id && UUID.test(query.school_id) ? { schoolId: query.school_id } : {}),
    });
  }

  async invoice(platform: Kysely<PlatformDatabase>, id: string) {
    const detail = await invoiceDetail(platform, assertId(id), this.today());
    if (!detail) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy hóa đơn');
    }
    return detail;
  }

  // Lập hóa đơn tay cho kỳ đang chạy (trường dùng thử muốn chuyển hoạt động, trả trước): số học sinh lấy số chốt gần nhất hoặc số người
  // vận hành nhập
  async createInvoice(platform: Kysely<PlatformDatabase>, operatorId: string, body: Body_) {
    const errors: FieldError[] = [];
    const schoolId = text(body, 'school_id');
    if (!UUID.test(schoolId)) {
      errors.push({ field: 'school_id', message: 'Chọn trường' });
    }
    const given = body?.active_students;
    if (given !== undefined && given !== null && (typeof given !== 'number' || !Number.isInteger(given) || given < 0)) {
      errors.push({ field: 'active_students', message: 'Số học sinh là số nguyên không âm' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const today = this.today();
    const plan = await loadBillingPlan(platform, schoolId, today);
    if (!plan) {
      throw new ApplicationError('ERR_CONFLICT', 'Trường chưa gán gói dịch vụ');
    }
    const latest = await platform
      .selectFrom('usage_snapshots')
      .select(['active_students', 'storage_mb', 'school_levels'])
      .where('school_id', '=', schoolId)
      .orderBy('period_start', 'desc')
      .executeTakeFirst();
    const activeStudents = typeof given === 'number' ? given : (latest?.active_students ?? null);
    if (activeStudents === null && plan.rule.components.includes('per_student')) {
      throw validationError([
        { field: 'active_students', message: 'Chưa có số liệu chốt kỳ, nhập số học sinh đang học' },
      ]);
    }
    const range = periodContaining(today, plan.rule.period);
    const issued = await mapped(
      issueInvoice(
        platform,
        {
          schoolId,
          range,
          usage: {
            activeStudents: activeStudents ?? 0,
            storageMb: latest?.storage_mb ?? 0,
            schoolLevels: latest?.school_levels ?? 0,
            modules: plan.modules,
          },
          plan,
          kind: 'manual',
          actor: { type: 'operator', id: operatorId },
          now: this.clock.now(),
          today,
          note: text(body, 'note').slice(0, 500) || null,
        },
        { allModules: MODULE_KEYS, moduleLabels: MODULE_LABELS },
      ),
    );
    return { id: issued.id, code: issued.code, total: issued.total, due_on: issued.dueOn };
  }

  async adjust(platform: Kysely<PlatformDatabase>, operatorId: string, id: string, action: string, body: Body_) {
    const actor = { type: 'operator' as const, id: operatorId };
    const now = this.clock.now();
    const invoiceId = assertId(id);
    const reason = text(body, 'reason');
    const errors: FieldError[] = [];
    switch (action) {
      case 'discount': {
        const amount = wholeNumber(body, 'amount', errors, { min: 1 });
        if (errors.length > 0) {
          throw validationError(errors);
        }
        return mapped(applyDiscount(platform, { invoiceId, amount, reason, now }, actor));
      }
      case 'manual-payment': {
        const amount = wholeNumber(body, 'amount', errors, { min: 1 });
        if (errors.length > 0) {
          throw validationError(errors);
        }
        return mapped(
          recordManualPayment(platform, { invoiceId, amount, reference: text(body, 'reference'), reason, now }, actor),
        );
      }
      case 'void':
        await mapped(voidInvoice(platform, { invoiceId, reason, now }, actor));
        return { voided: true };
      case 'einvoice':
        return mapped(issueEInvoice(platform, { invoiceId, now }, actor));
      case 'einvoice-cancel':
        await mapped(cancelEInvoice(platform, { invoiceId, reason, now }, actor));
        return { cancelled: true };
      default:
        throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
    }
  }

  assign(platform: Kysely<PlatformDatabase>, operatorId: string, paymentId: string, body: Body_) {
    const invoiceId = text(body, 'invoice_id');
    if (!UUID.test(invoiceId)) {
      throw validationError([{ field: 'invoice_id', message: 'Chọn hóa đơn' }]);
    }
    return mapped(
      assignPayment(
        platform,
        { paymentId: assertId(paymentId), invoiceId, reason: text(body, 'reason'), now: this.clock.now() },
        { type: 'operator', id: operatorId },
      ),
    );
  }

  freePeriod(platform: Kysely<PlatformDatabase>, operatorId: string, schoolId: string, body: Body_) {
    const errors: FieldError[] = [];
    const months = wholeNumber(body, 'months', errors, { min: 1, max: 24 });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return mapped(
      grantFreePeriod(
        platform,
        {
          schoolId: assertId(schoolId),
          months,
          reason: text(body, 'reason'),
          today: this.today(),
          now: this.clock.now(),
        },
        { type: 'operator', id: operatorId },
      ),
    );
  }
}

@Controller('auth/platform/billing')
export class PlatformBillingController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get()
  async overview(@Req() request: Request) {
    const { platform } = await this.billing.authorize(request);
    return this.billing.overview(platform);
  }

  @Put('settings')
  async settings(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.saveSettings(platform, operatorId, body);
  }

  @Put('connectors/:connector')
  async connector(@Param('connector') connector: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.saveConnector(platform, operatorId, connector, body);
  }

  @Get('price-rules')
  async rules(@Req() request: Request) {
    const { platform } = await this.billing.authorize(request);
    return this.billing.listRules(platform);
  }

  @Post('price-rules')
  async createRule(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.saveRule(platform, operatorId, null, parsePriceRuleInput(body));
  }

  @Put('price-rules/:id')
  async updateRule(@Param('id') id: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.saveRule(platform, operatorId, assertId(id), parsePriceRuleInput(body));
  }

  @Get('invoices')
  async invoices(@Query() query: Record<string, string | undefined>, @Req() request: Request) {
    const { platform } = await this.billing.authorize(request);
    return this.billing.invoices(platform, query);
  }

  @Post('invoices')
  async createInvoice(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.createInvoice(platform, operatorId, body);
  }

  @Get('invoices/:id')
  async invoice(@Param('id') id: string, @Req() request: Request) {
    const { platform } = await this.billing.authorize(request);
    return this.billing.invoice(platform, id);
  }

  @Post('invoices/:id/:action')
  @HttpCode(200)
  async adjust(@Param('id') id: string, @Param('action') action: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.adjust(platform, operatorId, id, action, body);
  }

  @Post('payments/:id/assign')
  @HttpCode(200)
  async assign(@Param('id') id: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.assign(platform, operatorId, id, body);
  }

  @Post('schools/:id/free-period')
  @HttpCode(200)
  async freePeriod(@Param('id') id: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.billing.authorize(request);
    return this.billing.freePeriod(platform, operatorId, id, body);
  }
}
