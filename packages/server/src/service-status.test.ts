import assert from 'node:assert/strict';
import { it } from 'node:test';
import { checkState, SLOW_MILLISECONDS, timedCheck } from './service-status.js';

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
