import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectNativePushState, nativePush, type NativePushPlugin } from './native-push.ts';

const plugin = {} as NativePushPlugin;

describe('đẩy gốc trong ứng dụng cài đặt (26g)', () => {
  it('chỉ dùng đẩy gốc khi trang chạy trong vỏ có plugin PushNotifications; iOS dùng APNs, Android dùng FCM', () => {
    assert.equal(nativePush({}), null);
    assert.equal(
      nativePush({ Capacitor: { isNativePlatform: () => false, Plugins: { PushNotifications: plugin } } }),
      null,
    );
    assert.equal(nativePush({ Capacitor: { isNativePlatform: () => true, Plugins: {} } }), null);
    assert.equal(
      nativePush({
        Capacitor: {
          isNativePlatform: () => true,
          isPluginAvailable: () => false,
          Plugins: { PushNotifications: plugin },
        },
      }),
      null,
    );
    const android = nativePush({
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { PushNotifications: plugin } },
    });
    assert.equal(android?.kind, 'fcm');
    const ios = nativePush({
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { PushNotifications: plugin } },
    });
    assert.equal(ios?.kind, 'apns');
    assert.equal(ios?.ready, true);
    // Bản dựng Android chưa có cấu hình Firebase: có cầu nối nhưng chưa lấy được mã thiết bị
    const unconfigured = nativePush({
      DAY_GOC_SAN_SANG: false,
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { PushNotifications: plugin } },
    });
    assert.equal(unconfigured?.ready, false);
  });

  it('trạng thái: nền tảng chưa có khóa, máy chặn, chưa bật, đã bật', () => {
    assert.equal(
      detectNativePushState({ serverEnabled: false, permission: 'granted', stored: true }),
      'server-disabled',
    );
    assert.equal(detectNativePushState({ serverEnabled: true, permission: 'denied', stored: true }), 'denied');
    assert.equal(detectNativePushState({ serverEnabled: true, permission: 'prompt', stored: false }), 'off');
    assert.equal(detectNativePushState({ serverEnabled: true, permission: 'prompt', stored: true }), 'off');
    assert.equal(detectNativePushState({ serverEnabled: true, permission: 'granted', stored: true }), 'on');
  });
});
