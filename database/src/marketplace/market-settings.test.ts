import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MarketSettingsError, parseMarketSettings, REAL_PAYMENTS_BLOCKED_MESSAGE } from './market-settings.js';

// Cấu hình chợ gia sư (DT-27 phần 27f, YCTD-256, CT-27f-1): thu tiền thật không bật được ở bản này; bật chợ cần tên miền dành riêng

describe('parseMarketSettings (CT-27f-1)', () => {
  test('mặc định: chợ tắt, thu tiền thật tắt, hoa hồng để trống', () => {
    const settings = parseMarketSettings({});
    assert.equal(settings.enabled, false);
    assert.equal(settings.realPaymentsEnabled, false);
    assert.equal(settings.defaultCommissionPercent, null);
    assert.equal(settings.recordRetentionDays, 30);
    assert.equal(settings.complaintWindowHours, 48);
  });

  test('bật thu tiền thật bị chặn kể cả khi mọi trường khác hợp lệ', () => {
    assert.throws(
      () =>
        parseMarketSettings({
          enabled: true,
          host: 'cho.example.vn',
          tutor_host: 'gia-su.example.vn',
          real_payments_enabled: true,
        }),
      (error: unknown) =>
        error instanceof MarketSettingsError &&
        error.field === 'real_payments_enabled' &&
        error.message === REAL_PAYMENTS_BLOCKED_MESSAGE,
    );
  });

  test('bật chợ cần tên miền của chợ và của ứng dụng Gia sư (khác nhau), tên miền chuẩn hóa chữ thường', () => {
    assert.throws(() => parseMarketSettings({ enabled: true }), MarketSettingsError);
    assert.throws(() => parseMarketSettings({ enabled: true, host: 'cho.example.vn' }), MarketSettingsError);
    assert.throws(
      () => parseMarketSettings({ enabled: true, host: 'cho.example.vn', tutor_host: 'cho.example.vn' }),
      MarketSettingsError,
    );
    const settings = parseMarketSettings({ enabled: true, host: ' Cho.Example.VN ', tutor_host: 'Gia-Su.Example.VN' });
    assert.equal(settings.tutorHost, 'gia-su.example.vn');
    assert.equal(settings.host, 'cho.example.vn');
    assert.equal(settings.realPaymentsEnabled, false);
  });

  test('từ chối tên miền, hạn, tỷ lệ ngoài khoảng', () => {
    assert.throws(() => parseMarketSettings({ host: 'cho example' }), MarketSettingsError);
    assert.throws(() => parseMarketSettings({ record_retention_days: 3 }), MarketSettingsError);
    assert.throws(() => parseMarketSettings({ complaint_window_hours: 0 }), MarketSettingsError);
    assert.throws(() => parseMarketSettings({ default_commission_percent: 80 }), MarketSettingsError);
    assert.equal(parseMarketSettings({ default_commission_percent: 12.345 }).defaultCommissionPercent, 12.35);
  });
});
