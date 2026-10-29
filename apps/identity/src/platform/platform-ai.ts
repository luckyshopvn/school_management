import { Body, Controller, Get, Inject, Injectable, Optional, Param, Put, Query, Req } from '@nestjs/common';
import {
  describePlatformAi,
  listPlanAiPricing,
  PlatformAiError,
  PricingError,
  savePlanAiPricing,
  savePlatformAiKey,
  savePlatformAiSettings,
  validateAiPricing,
  vietnamDate,
  type AiPricing,
  type PlatformDatabase,
  type PlatformOperatorRole,
  type TenancyRuntime,
} from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import type { Request } from 'express';
import { sql, type Kysely } from 'kysely';
import { TENANCY_RUNTIME } from '../common/configuration.js';
import { PlatformOperatorsService } from './platform-operators.js';
import { operatorRolesFor } from '@school-management/shared';

// Trợ lý AI ở cổng vận hành nền tảng (DT-23 phần 23d, YCTD-214; tài liệu 47 mục 15, GD-102, GD-103): khóa nhà cung cấp AI dùng chung của
// nền tảng (cấu hình `platform`, mã hóa bằng khóa gốc, chỉ trả bốn ký tự cuối), nhà cung cấp và mã mô hình của nền tảng, màn hình thiết lập
// riêng đơn giá AI của từng gói (token miễn phí mỗi kỳ, đơn giá token vào và ra theo một nghìn token, đơn giá riêng theo mô hình, phí tối
// thiểu, bước làm tròn; số tiền để trống cho đến khi nhập lúc triển khai), số token đã dùng của từng trường. Chỉ phục vụ ở tên miền của
// cổng nền tảng với mã phiên vận hành. Giới hạn số yêu cầu và token của gói đặt ở trang Gói dịch vụ (`plans.ai_max_*`)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMUM_MONEY = 1_000_000_000_000;

type Body_ = Record<string, unknown> | undefined;

function assertId(id: string): string {
  if (!UUID.test(id)) {
    throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
  }
  return id;
}

function wholeNumber(
  body: Body_,
  field: string,
  errors: FieldError[],
  options: { min?: number; max?: number; nullable?: boolean } = {},
): number | null {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    if (options.nullable) {
      return null;
    }
    errors.push({ field, message: 'Bắt buộc nhập' });
    return options.min ?? 0;
  }
  const min = options.min ?? 0;
  const max = options.max ?? MAXIMUM_MONEY;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, message: `Số nguyên từ ${min} đến ${max}` });
    return min;
  }
  return value;
}

export function parseAiPricing(body: Body_): AiPricing {
  const errors: FieldError[] = [];
  const modelPrices: AiPricing['modelPrices'] = {};
  const raw = body?.model_prices;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ field: 'model_prices', message: 'Đơn giá theo mô hình: mã mô hình → { input, output }' });
    } else {
      for (const [model, price] of Object.entries(raw as Record<string, unknown>)) {
        const entry = price as { input?: unknown; output?: unknown } | null;
        const valid = (value: unknown): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAXIMUM_MONEY;
        if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(model) || !valid(entry?.input) || !valid(entry?.output)) {
          errors.push({
            field: `model_prices.${model}`,
            message: 'Mã mô hình hợp lệ, đơn giá vào và ra là số nguyên không âm',
          });
          continue;
        }
        modelPrices[model] = { input: entry.input, output: entry.output };
      }
    }
  }
  const pricing: AiPricing = {
    freeTokens: wholeNumber(body, 'free_tokens', errors, { nullable: true }) ?? 0,
    inputPricePer1k: wholeNumber(body, 'input_price_per_1k', errors, { nullable: true }),
    outputPricePer1k: wholeNumber(body, 'output_price_per_1k', errors, { nullable: true }),
    modelPrices,
    minimumFee: wholeNumber(body, 'minimum_fee', errors, { nullable: true }) ?? 0,
    roundingStep: wholeNumber(body, 'rounding_step', errors, { min: 1, max: 1_000_000, nullable: true }) ?? 1,
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return pricing;
}

@Injectable()
export class PlatformAiService {
  constructor(
    private readonly operators: PlatformOperatorsService,
    private readonly clock: Clock,
    @Optional() @Inject(TENANCY_RUNTIME) private readonly tenancy: TenancyRuntime | null = null,
  ) {}

  // Vai trò được làm việc này theo OPERATOR_PERMISSIONS (YCTD-323)
  async authorize(
    request: Request,
    roles: readonly PlatformOperatorRole[],
  ): Promise<{ platform: Kysely<PlatformDatabase>; operatorId: string }> {
    const operator = await this.operators.authorize(request, roles);
    return { platform: this.operators.platformDatabase(), operatorId: operator.id };
  }

  private masterKey(): Buffer {
    if (!this.tenancy) {
      throw new ApplicationError('ERR_NOT_FOUND', 'Không tìm thấy');
    }
    return this.tenancy.configuration.masterKey;
  }

  async overview(platform: Kysely<PlatformDatabase>) {
    const [ai, plans] = await Promise.all([describePlatformAi(platform), listPlanAiPricing(platform)]);
    return { ...ai, plans };
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof PlatformAiError || error instanceof PricingError) {
        throw validationError([{ field: 'values', message: error.message }]);
      }
      throw error;
    }
  }

  async saveSettings(platform: Kysely<PlatformDatabase>, operatorId: string, body: Body_) {
    const text = (field: string) => (typeof body?.[field] === 'string' ? (body[field] as string).trim() : '');
    await this.guard(() =>
      savePlatformAiSettings(
        platform,
        { provider: text('provider'), model: text('model'), endpoint: text('endpoint') || null },
        { type: 'operator', id: operatorId },
      ),
    );
    return this.overview(platform);
  }

  async saveKey(platform: Kysely<PlatformDatabase>, operatorId: string, body: Body_) {
    await this.guard(() =>
      savePlatformAiKey(
        platform,
        this.masterKey(),
        {
          enabled: body?.enabled !== false,
          ...(typeof body?.api_key === 'string' ? { apiKey: body.api_key } : {}),
        },
        { type: 'operator', id: operatorId },
      ),
    );
    return this.overview(platform);
  }

  async savePricing(platform: Kysely<PlatformDatabase>, operatorId: string, planId: string, body: Body_) {
    const pricing = parseAiPricing(body);
    await this.guard(async () => {
      validateAiPricing(pricing);
      await savePlanAiPricing(platform, assertId(planId), pricing, { type: 'operator', id: operatorId });
    });
    return this.overview(platform);
  }

  // Token đã dùng theo trường trong khoảng ngày (mặc định tháng hiện tại)
  async usage(platform: Kysely<PlatformDatabase>, query: Record<string, string | undefined>) {
    const today = vietnamDate(this.clock.now());
    const errors: FieldError[] = [];
    const from = query.from ?? `${today.slice(0, 7)}-01`;
    const to = query.to ?? today;
    for (const [field, value] of [
      ['from', from],
      ['to', to],
    ] as const) {
      if (!DATE.test(value)) {
        errors.push({ field, message: 'Ngày dạng yyyy-mm-dd' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const rows = await platform
      .selectFrom('ai_token_usage')
      .innerJoin('schools', 'schools.id', 'ai_token_usage.school_id')
      .select([
        'schools.id as school_id',
        'schools.code',
        'schools.name',
        'ai_token_usage.config',
        'ai_token_usage.model',
        sql<string>`sum(ai_token_usage.requests)`.as('requests'),
        sql<string>`sum(ai_token_usage.input_tokens)`.as('input_tokens'),
        sql<string>`sum(ai_token_usage.output_tokens)`.as('output_tokens'),
      ])
      .where('ai_token_usage.usage_date', '>=', from)
      .where('ai_token_usage.usage_date', '<=', to)
      .groupBy(['schools.id', 'schools.code', 'schools.name', 'ai_token_usage.config', 'ai_token_usage.model'])
      .orderBy('schools.code')
      .execute();
    return {
      from,
      to,
      rows: rows.map((row) => ({
        school_id: row.school_id,
        code: row.code,
        name: row.name,
        config: row.config,
        model: row.model,
        requests: Number(row.requests),
        input_tokens: Number(row.input_tokens),
        output_tokens: Number(row.output_tokens),
      })),
    };
  }
}

@Controller('auth/platform/ai')
export class PlatformAiController {
  constructor(private readonly ai: PlatformAiService) {}

  @Get()
  async overview(@Req() request: Request) {
    const { platform } = await this.ai.authorize(request, operatorRolesFor('ai.view'));
    return this.ai.overview(platform);
  }

  @Put('settings')
  async settings(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.ai.authorize(request, operatorRolesFor('ai.settings'));
    return this.ai.saveSettings(platform, operatorId, body);
  }

  @Put('key')
  async key(@Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.ai.authorize(request, operatorRolesFor('ai.settings'));
    return this.ai.saveKey(platform, operatorId, body);
  }

  @Put('pricing/:planId')
  async pricing(@Param('planId') planId: string, @Body() body: Body_, @Req() request: Request) {
    const { platform, operatorId } = await this.ai.authorize(request, operatorRolesFor('ai.pricing'));
    return this.ai.savePricing(platform, operatorId, planId, body);
  }

  @Get('usage')
  async usage(@Query() query: Record<string, string | undefined>, @Req() request: Request) {
    const { platform } = await this.ai.authorize(request, operatorRolesFor('ai.view'));
    return this.ai.usage(platform, query);
  }
}
