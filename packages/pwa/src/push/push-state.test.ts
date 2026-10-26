import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeBase64Url, detectPushState, deviceLabel, type PushEnvironment } from './push-state.ts';

const ready: PushEnvironment = {
  pushApi: true,
  ios: false,
  standalone: false,
  inAppBrowser: false,
  serviceWorker: true,
  serverEnabled: true,
  permission: 'default',
  subscribed: false,
};

describe('trạng thái thông báo đẩy trên máy (26b)', () => {
  it('máy đủ điều kiện: chưa bật, đã bật', () => {
    assert.equal(detectPushState(ready), 'off');
    assert.equal(detectPushState({ ...ready, permission: 'granted', subscribed: true }), 'on');
    // Còn đăng ký nhưng quyền bị thu hồi thì coi như chưa bật
    assert.equal(detectPushState({ ...ready, permission: 'default', subscribed: true }), 'off');
  });

  it('iPhone chưa cài lên màn hình chính phải cài trước, đã cài thì dùng được', () => {
    assert.equal(detectPushState({ ...ready, ios: true, pushApi: false }), 'needs-install');
    assert.equal(detectPushState({ ...ready, ios: true, standalone: true }), 'off');
  });

  it('trình duyệt nhúng, trình duyệt cũ, chưa có service worker, nền tảng chưa bật, đã chặn', () => {
    assert.equal(detectPushState({ ...ready, inAppBrowser: true }), 'unsupported');
    assert.equal(detectPushState({ ...ready, pushApi: false }), 'unsupported');
    assert.equal(detectPushState({ ...ready, serviceWorker: false }), 'no-service-worker');
    assert.equal(detectPushState({ ...ready, serverEnabled: false }), 'server-disabled');
    assert.equal(detectPushState({ ...ready, permission: 'denied' }), 'denied');
  });

  it('giải mã khóa VAPID base64url', () => {
    assert.deepEqual(Array.from(decodeBase64Url('AQID_-8')), [1, 2, 3, 255, 239]);
    assert.equal(decodeBase64Url('A'.repeat(87)).length, 65);
  });

  it('nhãn thiết bị ngắn, không chứa chuỗi nhận dạng đầy đủ', () => {
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
      'iPhone · Safari',
    );
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
      'Android · Chrome',
    );
    assert.equal(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0',
      ),
      'Windows · Edge',
    );
  });
});
