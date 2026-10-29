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

  test('bật chợ cần tên miền của chợ; tên miền cũ của ứng dụng Gia sư không bắt buộc, khác tên miền chợ (YCTD-368)', () => {
    assert.throws(() => parseMarketSettings({ enabled: true }), MarketSettingsError);
    assert.equal(parseMarketSettings({ enabled: true, host: 'cho.example.vn' }).tutorHost, null);
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

describe('mốc phòng học video (YCTD-362, GD-164)', () => {
  test('mặc định theo quyết định của Eric ngày 2026-10-29', () => {
    assert.deepEqual(parseMarketSettings({}).room, {
      opensBeforeMinutes: 10,
      lateAbsentMinutes: 15,
      tutorNoShowMinutes: 10,
      fullAttendancePercent: 80,
      autoConfirmHours: 24,
    });
  });

  test('chỉnh được trong khoảng, ngoài khoảng bị từ chối', () => {
    const settings = parseMarketSettings({ room_opens_before_minutes: 5, full_attendance_percent: 90 });
    assert.equal(settings.room.opensBeforeMinutes, 5);
    assert.equal(settings.room.fullAttendancePercent, 90);
    assert.throws(
      () => parseMarketSettings({ full_attendance_percent: 30 }),
      (error: unknown) => error instanceof MarketSettingsError && error.field === 'full_attendance_percent',
    );
    assert.throws(() => parseMarketSettings({ auto_confirm_hours: 0 }), MarketSettingsError);
  });
});

describe('gói buổi (YCTD-365, GD-165)', () => {
  test('mặc định dùng trong 56 ngày, chỉnh được từ 7 đến 365 ngày', () => {
    assert.equal(parseMarketSettings({}).packageValidDays, 56);
    assert.equal(parseMarketSettings({ package_valid_days: 30 }).packageValidDays, 30);
    assert.throws(() => parseMarketSettings({ package_valid_days: 3 }), MarketSettingsError);
  });
});
