import assert from 'node:assert/strict';
import { it } from 'node:test';
import { collectApiStatus } from './service-status-reporter.js';

// Máy chủ API tự kiểm (YCTD-376), kịch bản CT-376-3: cơ sở dữ liệu lỗi ghi ok = false, không có nội dung lỗi; không dùng lưu trữ
// tệp dùng chung thì storage = null
it('máy chủ API tự kiểm cơ sở dữ liệu và lưu trữ tệp, không giữ nội dung lỗi', async () => {
  const at = new Date('2030-01-02T03:04:05.000Z');
  const failed = await collectApiStatus(
    async () => {
      throw new Error('password authentication failed for user "api"');
    },
    async () => undefined,
    at,
  );
  assert.equal(failed.checked_at, at.toISOString());
  assert.equal(failed.database.ok, false);
  assert.equal(failed.storage?.ok, true);
  assert.ok(!JSON.stringify(failed).includes('password'));

  const noStorage = await collectApiStatus(async () => undefined, null, at);
  assert.equal(noStorage.database.ok, true);
  assert.equal(noStorage.storage, null);
});
