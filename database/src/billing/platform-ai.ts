import { decryptSecret, encryptSecret } from '@school-management/server/tenancy';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { AiUsageConfig, PlatformDatabase } from '../../platform/schema.js';
import { writeAudit } from '../provision-school.js';
import { aiPricingReady, validateAiPricing, type AiModelUsage, type AiPricing } from './ai-pricing.js';

// Phần của nền tảng cho trợ lý AI (DT-23 phần 23d, YCTD-214; tài liệu 47 mục 15): khóa nhà cung cấp AI của nền tảng (cấu hình
// `platform`, GD-102) lưu như khóa cổng thanh toán của S5b (mã hóa AES-256-GCM bằng khóa gốc của nền tảng, chỉ trả bốn ký tự cuối),
// thiết lập nhà cung cấp và mô hình của nền tảng, đơn giá AI theo gói (GD-103), đo token theo trường theo ngày
type Executor = Kysely<PlatformDatabase> | Transaction<PlatformDatabase>;
type Actor = { type: 'operator' | 'system' | 'cli'; id?: string };

export const AI_CONNECTOR = 'ai';

export interface PlatformAiSettings {
  provider: string;
  model: string;
  endpoint: string | null;
}

export const DEFAULT_PLATFORM_AI_SETTINGS: PlatformAiSettings = {
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  endpoint: null,
};

const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
const ENDPOINT_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/;

export class PlatformAiError extends Error {}

export async function readPlatformAiSettings(platform: Executor): Promise<PlatformAiSettings> {
  const row = await platform.selectFrom('platform_settings').select('value').where('key', '=', 'ai').executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  const text = (key: string, fallback: string) =>
    typeof value[key] === 'string' && (value[key] as string).trim() ? (value[key] as string).trim() : fallback;
  return {
    provider: text('provider', DEFAULT_PLATFORM_AI_SETTINGS.provider),
    model: text('model', DEFAULT_PLATFORM_AI_SETTINGS.model),
    endpoint: typeof value.endpoint === 'string' && value.endpoint.trim() ? value.endpoint.trim() : null,
  };
}

export async function savePlatformAiSettings(
  platform: Kysely<PlatformDatabase>,
  settings: PlatformAiSettings,
  actor: Actor,
): Promise<PlatformAiSettings> {
  if (!PROVIDER_PATTERN.test(settings.provider)) {
    throw new PlatformAiError('Mã nhà cung cấp là chữ thường, số, gạch ngang');
  }
  if (!MODEL_PATTERN.test(settings.model)) {
    throw new PlatformAiError('Mã mô hình không hợp lệ');
  }
  if (settings.endpoint !== null && !ENDPOINT_PATTERN.test(settings.endpoint)) {
    throw new PlatformAiError('Địa chỉ phải là http hoặc https');
  }
  const value = { provider: settings.provider, model: settings.model, endpoint: settings.endpoint };
  await platform
    .insertInto('platform_settings')
    .values({ key: 'ai', value: JSON.stringify(value) })
    .onConflict((conflict) =>
      conflict.column('key').doUpdateSet({ value: JSON.stringify(value), updated_at: new Date() }),
    )
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'ai.settings-update',
    details: value,
  });
  return settings;
}

// ---------- Khóa AI của nền tảng

export interface StoredPlatformAiKey {
  enabled: boolean;
  apiKey: string;
  hint: string;
  version: string;
}

const hintOf = (value: string) => (value.length <= 4 ? '••••' : `••••${value.slice(-4)}`);

export async function savePlatformAiKey(
  platform: Kysely<PlatformDatabase>,
  masterKey: Buffer,
  input: { enabled: boolean; apiKey?: string },
  actor: Actor,
): Promise<void> {
  const existing = await readPlatformAiKey(platform, masterKey);
  const apiKey = (input.apiKey ?? '').trim() || existing?.apiKey || '';
  if (!apiKey) {
    throw new PlatformAiError('Thiếu khóa API của nhà cung cấp AI');
  }
  if (/[\r\n\0]/.test(apiKey) || apiKey.length > 500) {
    throw new PlatformAiError('Khóa API không hợp lệ');
  }
  const encrypted = encryptSecret(masterKey, JSON.stringify({ api_key: apiKey }));
  const hints = JSON.stringify({ api_key: hintOf(apiKey) });
  const now = new Date();
  await platform
    .insertInto('platform_integration_secrets')
    .values({
      connector: AI_CONNECTOR,
      enabled: input.enabled,
      values_encrypted: encrypted,
      hints,
      updated_at: now,
      updated_by: actor.id ?? null,
    })
    .onConflict((conflict) =>
      conflict.column('connector').doUpdateSet({
        enabled: input.enabled,
        values_encrypted: encrypted,
        hints,
        updated_at: now,
        updated_by: actor.id ?? null,
      }),
    )
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'ai.key-update',
    details: { enabled: input.enabled },
  });
}

export async function readPlatformAiKey(platform: Executor, masterKey: Buffer): Promise<StoredPlatformAiKey | null> {
  const row = await platform
    .selectFrom('platform_integration_secrets')
    .selectAll()
    .where('connector', '=', AI_CONNECTOR)
    .executeTakeFirst();
  if (!row) {
    return null;
  }
  let apiKey: string;
  try {
    apiKey = (JSON.parse(decryptSecret(masterKey, row.values_encrypted)) as { api_key?: string }).api_key ?? '';
  } catch {
    return null;
  }
  return apiKey
    ? {
        enabled: row.enabled,
        apiKey,
        hint: row.hints.api_key ?? hintOf(apiKey),
        version: `${row.updated_at.getTime()}`,
      }
    : null;
}

// Cho cổng vận hành: chỉ gợi ý, không giá trị
export async function describePlatformAi(platform: Executor) {
  const [row, settings] = await Promise.all([
    platform
      .selectFrom('platform_integration_secrets')
      .select(['enabled', 'hints', 'updated_at'])
      .where('connector', '=', AI_CONNECTOR)
      .executeTakeFirst(),
    readPlatformAiSettings(platform),
  ]);
  return {
    settings,
    key: {
      configured: Boolean(row),
      enabled: row?.enabled ?? false,
      hint: row?.hints.api_key ?? null,
      updated_at: row?.updated_at ?? null,
    },
  };
}

// ---------- Đơn giá AI theo gói

const numberOf = (value: string | number | null): number | null => (value === null ? null : Number(value));

export function pricingOfRow(row: {
  free_tokens: string | number;
  input_price_per_1k: string | number | null;
  output_price_per_1k: string | number | null;
  model_prices: Record<string, { input: number; output: number }>;
  minimum_fee: string | number;
  rounding_step: number;
}): AiPricing {
  return {
    freeTokens: Number(row.free_tokens),
    inputPricePer1k: numberOf(row.input_price_per_1k),
    outputPricePer1k: numberOf(row.output_price_per_1k),
    modelPrices: row.model_prices,
    minimumFee: Number(row.minimum_fee),
    roundingStep: row.rounding_step,
  };
}

export async function readPlanAiPricing(platform: Executor, planId: string): Promise<AiPricing | null> {
  const row = await platform.selectFrom('plan_ai_pricing').selectAll().where('plan_id', '=', planId).executeTakeFirst();
  return row ? pricingOfRow(row) : null;
}

export async function readPlanAiPricingByCode(platform: Executor, planCode: string): Promise<AiPricing | null> {
  const row = await platform
    .selectFrom('plan_ai_pricing')
    .innerJoin('plans', 'plans.id', 'plan_ai_pricing.plan_id')
    .selectAll('plan_ai_pricing')
    .where('plans.code', '=', planCode)
    .executeTakeFirst();
  return row ? pricingOfRow(row) : null;
}

// Mọi gói kèm đơn giá AI (gói chưa đặt thì để trống: miễn phí token 0, đơn giá chưa nhập)
export async function listPlanAiPricing(platform: Executor) {
  const rows = await platform
    .selectFrom('plans')
    .leftJoin('plan_ai_pricing', 'plan_ai_pricing.plan_id', 'plans.id')
    .select([
      'plans.id as plan_id',
      'plans.code',
      'plans.name',
      'plans.status',
      'plans.ai_max_requests',
      'plans.ai_max_tokens',
      'plan_ai_pricing.free_tokens',
      'plan_ai_pricing.input_price_per_1k',
      'plan_ai_pricing.output_price_per_1k',
      'plan_ai_pricing.model_prices',
      'plan_ai_pricing.minimum_fee',
      'plan_ai_pricing.rounding_step',
      'plan_ai_pricing.updated_at',
    ])
    .orderBy('plans.status')
    .orderBy('plans.code')
    .execute();
  return rows.map((row) => {
    const pricing: AiPricing = pricingOfRow({
      free_tokens: row.free_tokens ?? 0,
      input_price_per_1k: row.input_price_per_1k ?? null,
      output_price_per_1k: row.output_price_per_1k ?? null,
      model_prices: row.model_prices ?? {},
      minimum_fee: row.minimum_fee ?? 0,
      rounding_step: row.rounding_step ?? 1,
    });
    return {
      plan_id: row.plan_id,
      code: row.code,
      name: row.name,
      status: row.status,
      ai_max_requests: row.ai_max_requests,
      ai_max_tokens: row.ai_max_tokens,
      configured: row.updated_at !== null,
      ready: aiPricingReady(pricing),
      pricing,
      updated_at: row.updated_at,
    };
  });
}

export async function savePlanAiPricing(
  platform: Kysely<PlatformDatabase>,
  planId: string,
  pricing: AiPricing,
  actor: Actor,
): Promise<void> {
  validateAiPricing(pricing);
  const plan = await platform.selectFrom('plans').select(['id', 'code']).where('id', '=', planId).executeTakeFirst();
  if (!plan) {
    throw new PlatformAiError('Không tìm thấy gói');
  }
  const values = {
    free_tokens: pricing.freeTokens,
    input_price_per_1k: pricing.inputPricePer1k,
    output_price_per_1k: pricing.outputPricePer1k,
    model_prices: JSON.stringify(pricing.modelPrices),
    minimum_fee: pricing.minimumFee,
    rounding_step: pricing.roundingStep,
    updated_by: actor.id ?? null,
  };
  await platform
    .insertInto('plan_ai_pricing')
    .values({ plan_id: planId, ...values })
    .onConflict((conflict) => conflict.column('plan_id').doUpdateSet({ ...values, updated_at: new Date() }))
    .execute();
  await writeAudit(platform, {
    actorType: actor.type,
    ...(actor.id ? { actorId: actor.id } : {}),
    action: 'ai.pricing-update',
    details: { plan_id: planId, plan_code: plan.code, ...pricing },
  });
}

// ---------- Đo token theo trường

export interface AiUsageRow {
  usageDate: string;
  model: string;
  config: AiUsageConfig;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

// Ghi đè tổng theo ngày, mô hình, cấu hình (chạy lặp không cộng trùng)
export async function recordAiTokenUsage(platform: Executor, schoolId: string, rows: AiUsageRow[]): Promise<void> {
  for (const row of rows) {
    await platform
      .insertInto('ai_token_usage')
      .values({
        school_id: schoolId,
        usage_date: row.usageDate,
        model: row.model,
        config: row.config,
        requests: row.requests,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
      })
      .onConflict((conflict) =>
        conflict.columns(['school_id', 'usage_date', 'model', 'config']).doUpdateSet({
          requests: row.requests,
          input_tokens: row.inputTokens,
          output_tokens: row.outputTokens,
          updated_at: new Date(),
        }),
      )
      .execute();
  }
}

// Tổng token của trường trong khoảng ngày [from, to] theo mô hình (chỉ cấu hình cho trước, mặc định `platform` là phần thu phí)
export async function aiUsageBetween(
  platform: Executor,
  schoolId: string,
  from: string,
  to: string,
  config: AiUsageConfig = 'platform',
): Promise<AiModelUsage[]> {
  const rows = await platform
    .selectFrom('ai_token_usage')
    .select([
      'model',
      sql<string>`sum(requests)`.as('requests'),
      sql<string>`sum(input_tokens)`.as('input_tokens'),
      sql<string>`sum(output_tokens)`.as('output_tokens'),
    ])
    .where('school_id', '=', schoolId)
    .where('config', '=', config)
    .where('usage_date', '>=', from)
    .where('usage_date', '<=', to)
    .groupBy('model')
    .orderBy('model')
    .execute();
  return rows.map((row) => ({
    model: row.model,
    requests: Number(row.requests),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
  }));
}
