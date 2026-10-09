import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { createApplication } from './create-application.js';

describe('Dịch vụ định danh: kiểm tra sức khỏe', () => {
  let application: INestApplication;
  let baseUrl: string;

  before(async () => {
    application = await createApplication();
    await application.listen(0);
    const address = application.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await application.close();
  });

  it('GET /api/v1/health trả trạng thái hoạt động', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'identity' });
  });
});
