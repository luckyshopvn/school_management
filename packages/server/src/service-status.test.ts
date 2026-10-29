import assert from 'node:assert/strict';
import { it } from 'node:test';
import { platformCacheKey, type PlatformCacheNamespace } from './resource-names.js';
import { API_STATUS_KEY, checkState, SLOW_MILLISECONDS, timedCheck, WORKER_HEARTBEAT_KEY } from './service-status.js';

// Tình trạng dịch vụ (YCTD-376), kịch bản CT-376-1: đo thời gian, lỗi không giữ nội dung, ngưỡng Chậm 1 giây
it('đo thời gian lần kiểm; lỗi thì ok = false; phân loại Hoạt động, Chậm, Lỗi theo ngưỡng 1 giây', async () => {
  let clock = 1000;
  const now = () => clock;
  const passed = await timedCheck(async () => {
    clock += 250;
  }, now);
  assert.deepEqual(passed, { ok: true, milliseconds: 250 });
  const failed = await timedCheck(async () => {
    clock += 40;
    throw new Error('mật khẩu sai ở chuỗi kết nối');
  }, now);
  assert.deepEqual(failed, { ok: false, milliseconds: 40 });
  assert.equal(checkState({ ok: true, milliseconds: SLOW_MILLISECONDS }), 'ok');
  assert.equal(checkState({ ok: true, milliseconds: SLOW_MILLISECONDS + 1 }), 'slow');
  assert.equal(checkState({ ok: false, milliseconds: 5 }), 'error');
});

// Khóa cấp nền tảng (YCTD-376), kịch bản CT-376-8: tiền tố platform:, chỉ nhận nhóm trong danh sách cố định
it('khóa cấp nền tảng có tiền tố platform: và chỉ nhận nhóm trong danh sách', () => {
  assert.equal(API_STATUS_KEY, 'platform:service-status:api');
  assert.equal(WORKER_HEARTBEAT_KEY, 'platform:worker:heartbeat');
  assert.throws(() => platformCacheKey('captcha' as PlatformCacheNamespace, 'x'), /không được phép/);
  assert.throws(() => platformCacheKey('worker', 'có dấu cách'));
});
