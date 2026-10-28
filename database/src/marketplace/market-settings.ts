import type { Kysely } from 'kysely';
import type { PlatformDatabase } from '../../platform/schema.js';
import { writeAudit } from '../provision-school.js';

// Cấu hình chợ gia sư ở cổng nền tảng (DT-27 phần 27f, YCTD-256; tài liệu 32 mục 19.5, 19.10, 19.11): lưu ở `platform_settings` khóa
// `market` như cấu hình AI của 23d. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 và quyết định ngày 2026-10-28 ("làm mã, tiền
// giả lập"):
// - chợ tắt mặc định; bật thì máy chủ API phục vụ `/api/v1/market/*` ở tên miền con dành riêng của chợ (`host`, ứng dụng phụ huynh) và
//   của ứng dụng Gia sư (`tutor_host`, YCTD-262); hai tên miền phải khác nhau;
// - hạn giữ bản ghi (GD-132), hạn khiếu nại trước khi giải ngân (GD-133), tỷ lệ hoa hồng mặc định (E-01, để trống đến khi Eric chốt)
//   là dữ liệu, 27h dùng;
// - **thu tiền thật luôn tắt** ở bản này: lưu `real_payments_enabled = true` bị từ chối cho đến khi xong E-01 đến E-07 (luật sư, tổ
//   chức có giấy phép, pháp nhân), không có đường nào khác để bật. Bỏ chặn là một thay đổi mã có YCTD riêng, không phải một công tắc
export const MARKET_SETTINGS_KEY = 'market';

export interface MarketSettings {
  enabled: boolean;
  host: string | null;
  tutorHost: string | null;
  recordRetentionDays: number;
  complaintWindowHours: number;
  defaultCommissionPercent: number | null;
  realPaymentsEnabled: false;
}

export const DEFAULT_MARKET_SETTINGS: MarketSettings = {
  enabled: false,
  host: null,
  tutorHost: null,
  recordRetentionDays: 30,
  complaintWindowHours: 48,
  defaultCommissionPercent: null,
  realPaymentsEnabled: false,
};

export const REAL_PAYMENTS_BLOCKED_MESSAGE =
  'Chưa bật được thu tiền thật ở chợ: cần xong E-01 đến E-07 (hoa hồng, tổ chức có giấy phép, luật sư, pháp nhân; tài liệu 32 mục 19.10). Bản này chỉ chạy thanh toán giả lập';

const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

export class MarketSettingsError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

function integerOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

export async function readMarketSettings(platform: Kysely<PlatformDatabase>): Promise<MarketSettings> {
  const row = await platform
    .selectFrom('platform_settings')
    .select('value')
    .where('key', '=', MARKET_SETTINGS_KEY)
    .executeTakeFirst();
  const value = (row?.value ?? {}) as Record<string, unknown>;
  return {
    enabled: value.enabled === true,
    host: typeof value.host === 'string' && value.host ? value.host : null,
    tutorHost: typeof value.tutor_host === 'string' && value.tutor_host ? value.tutor_host : null,
    recordRetentionDays: integerOr(value.record_retention_days, DEFAULT_MARKET_SETTINGS.recordRetentionDays),
    complaintWindowHours: integerOr(value.complaint_window_hours, DEFAULT_MARKET_SETTINGS.complaintWindowHours),
    defaultCommissionPercent:
      typeof value.default_commission_percent === 'number' ? value.default_commission_percent : null,
    // Giá trị lưu ở cơ sở dữ liệu không mở được thu tiền thật: luôn đọc là tắt
    realPaymentsEnabled: false,
  };
}

// Kiểm và chuẩn hóa dữ liệu nhập ở cổng nền tảng; lỗi đầu tiên ném MarketSettingsError
export function parseMarketSettings(body: Record<string, unknown> | undefined): MarketSettings {
  if (body?.real_payments_enabled === true) {
    throw new MarketSettingsError('real_payments_enabled', REAL_PAYMENTS_BLOCKED_MESSAGE);
  }
  const host = typeof body?.host === 'string' ? body.host.trim().toLowerCase() : '';
  if (host && !HOST_PATTERN.test(host)) {
    throw new MarketSettingsError('host', 'Tên miền chỉ gồm chữ thường, số, gạch ngang, dấu chấm');
  }
  const enabled = body?.enabled === true;
  if (enabled && !host) {
    throw new MarketSettingsError('host', 'Bật chợ cần tên miền con dành riêng của chợ');
  }
  const tutorHost = typeof body?.tutor_host === 'string' ? body.tutor_host.trim().toLowerCase() : '';
  if (tutorHost && !HOST_PATTERN.test(tutorHost)) {
    throw new MarketSettingsError('tutor_host', 'Tên miền chỉ gồm chữ thường, số, gạch ngang, dấu chấm');
  }
  if (enabled && !tutorHost) {
    throw new MarketSettingsError('tutor_host', 'Bật chợ cần tên miền con dành riêng của ứng dụng Gia sư');
  }
  if (tutorHost && tutorHost === host) {
    throw new MarketSettingsError('tutor_host', 'Ứng dụng Gia sư cần tên miền khác tên miền của chợ');
  }
  const retention = body?.record_retention_days ?? DEFAULT_MARKET_SETTINGS.recordRetentionDays;
  if (typeof retention !== 'number' || !Number.isInteger(retention) || retention < 7 || retention > 365) {
    throw new MarketSettingsError('record_retention_days', 'Hạn giữ bản ghi là số ngày từ 7 đến 365');
  }
  const window = body?.complaint_window_hours ?? DEFAULT_MARKET_SETTINGS.complaintWindowHours;
  if (typeof window !== 'number' || !Number.isInteger(window) || window < 1 || window > 720) {
    throw new MarketSettingsError('complaint_window_hours', 'Hạn khiếu nại là số giờ từ 1 đến 720');
  }
  const commission = body?.default_commission_percent ?? null;
  if (
    commission !== null &&
    (typeof commission !== 'number' || !Number.isFinite(commission) || commission < 0 || commission > 50)
  ) {
    throw new MarketSettingsError(
      'default_commission_percent',
      'Tỷ lệ hoa hồng từ 0 đến 50 phần trăm, để trống khi chưa chốt',
    );
  }
  return {
    enabled,
    host: host || null,
    tutorHost: tutorHost || null,
    recordRetentionDays: retention,
    complaintWindowHours: window,
    defaultCommissionPercent: commission === null ? null : Math.round(commission * 100) / 100,
    realPaymentsEnabled: false,
  };
}

export async function saveMarketSettings(
  platform: Kysely<PlatformDatabase>,
  settings: MarketSettings,
  operatorId: string,
): Promise<MarketSettings> {
  const value = JSON.stringify({
    enabled: settings.enabled,
    host: settings.host,
    tutor_host: settings.tutorHost,
    record_retention_days: settings.recordRetentionDays,
    complaint_window_hours: settings.complaintWindowHours,
    default_commission_percent: settings.defaultCommissionPercent,
    real_payments_enabled: false,
  });
  await platform
    .insertInto('platform_settings')
    .values({ key: MARKET_SETTINGS_KEY, value })
    .onConflict((conflict) => conflict.column('key').doUpdateSet({ value, updated_at: new Date() }))
    .execute();
  await writeAudit(platform, {
    actorType: 'operator',
    actorId: operatorId,
    action: 'market.settings-update',
    details: JSON.parse(value) as unknown,
  });
  return settings;
}
