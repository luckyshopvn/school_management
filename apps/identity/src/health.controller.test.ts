import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { getJson, startTestApplication, type TestContext } from './test-support.js';

describe('Dịch vụ định danh: kiểm tra sức khỏe', () => {
  let context: TestContext;

  before(async () => {
    context = await startTestApplication();
  });

  after(async () => {
    await context.close();
  });

  it('GET /api/v1/health trả trạng thái hoạt động, không cần mã phiên', async () => {
    const response = await getJson(`${context.baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok', service: 'identity' });
  });
});
