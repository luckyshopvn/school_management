import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sendJson, startApiTestEnvironment, type ApiTestEnvironment, type LoggedInUser } from '../test-support.js';
import { parseGridKey, parseGridSettings } from './grid-settings.js';

// Cấu hình lưới dữ liệu theo người dùng (DT-15 phần 15a); kịch bản CT-15a-1 đến CT-15a-6
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; details?: Array<{ field: string; message: string }> };

describe('Kiểm tra cấu hình lưới', () => {
  it('nhận khóa lưới trong danh sách, từ chối khóa lạ', () => {
    assert.equal(parseGridKey('staff'), 'staff');
    assert.equal(parseGridKey('default'), 'default');
    for (const key of ['khong-co', '', '../accounts', 42, undefined]) {
      assert.throws(() => parseGridKey(key), { code: 'ERR_VALIDATION' });
    }
  });

  it('nhận cột theo thứ tự và số dòng hợp lệ; bỏ trống là mặc định', () => {
    assert.deepEqual(parseGridSettings('staff', { columns: ['full_name', 'code'], page_size: 50 }), {
      columns: ['full_name', 'code'],
      page_size: 50,
    });
    assert.deepEqual(parseGridSettings('staff', {}), { columns: null, page_size: null });
    assert.deepEqual(parseGridSettings('default', { page_size: 200, columns: null }), {
      columns: null,
      page_size: 200,
    });
  });

  it('từ chối số dòng ngoài danh sách, cột trùng, cột rỗng, cột ở cấu hình chung', () => {
    for (const body of [
      { page_size: 15 },
      { page_size: '20' },
      { page_size: 0 },
      { columns: [] },
      { columns: 'full_name' },
      { columns: ['code', 'code'] },
      { columns: ['co de'] },
      { columns: [7] },
      { columns: Array.from({ length: 101 }, (_, index) => `c${index}`) },
    ]) {
      assert.throws(() => parseGridSettings('staff', body), { code: 'ERR_VALIDATION' });
    }
    assert.throws(() => parseGridSettings('default', { columns: ['code'] }), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseGridSettings('staff', null), { code: 'ERR_VALIDATION' });
    assert.throws(() => parseGridSettings('staff', [1]), { code: 'ERR_VALIDATION' });
  });
});

describe('Điểm cuối cấu hình lưới', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let other: LoggedInUser;
  const url = (gridKey: string) => `${environment.baseUrl}/me/grid-settings/${gridKey}`;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    other = await environment.loginAs('VT-02', null);
  });

  after(async () => {
    await environment.close();
  });

  it('CT-15a-1: chưa đăng nhập thì bị từ chối', async () => {
    assert.equal((await sendJson('GET', url('staff'), undefined)).status, 401);
    assert.equal((await sendJson('PUT', url('staff'), undefined, { page_size: 50 })).status, 401);
  });

  it('CT-15a-2: chưa lưu thì trả mặc định rỗng', async () => {
    const response = await sendJson('GET', url('staff'), principal.accessToken);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { columns: null, page_size: null });
  });

  it('CT-15a-3: lưu cột theo thứ tự và số dòng rồi đọc lại; lưu lần hai ghi đè', async () => {
    const saved = await sendJson('PUT', url('staff'), principal.accessToken, {
      columns: ['full_name', 'code', 'status'],
      page_size: 50,
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, { columns: ['full_name', 'code', 'status'], page_size: 50 });
    await sendJson('PUT', url('staff'), principal.accessToken, { columns: ['code'], page_size: 100 });
    const read = await sendJson('GET', url('staff'), principal.accessToken);
    assert.deepEqual(read.body, { columns: ['code'], page_size: 100 });
    const reset = await sendJson('PUT', url('staff'), principal.accessToken, { columns: null, page_size: null });
    assert.deepEqual(reset.body, { columns: null, page_size: null });
  });

  it('CT-15a-4: cấu hình riêng từng tài khoản và từng lưới', async () => {
    await sendJson('PUT', url('accounts'), principal.accessToken, { page_size: 10 });
    await sendJson('PUT', url('default'), principal.accessToken, { page_size: 200 });
    assert.deepEqual((await sendJson('GET', url('accounts'), other.accessToken)).body, {
      columns: null,
      page_size: null,
    });
    assert.deepEqual((await sendJson('GET', url('accounts'), principal.accessToken)).body, {
      columns: null,
      page_size: 10,
    });
    assert.deepEqual((await sendJson('GET', url('default'), principal.accessToken)).body, {
      columns: null,
      page_size: 200,
    });
  });

  it('CT-15a-5: khóa lưới lạ bị từ chối', async () => {
    const read = await sendJson('GET', url('khong-co'), principal.accessToken);
    assert.equal(read.status, 400);
    assert.equal(errorOf(read.body).details?.[0]?.field, 'gridKey');
    assert.equal((await sendJson('PUT', url('khong-co'), principal.accessToken, { page_size: 20 })).status, 400);
  });

  it('CT-15a-6: dữ liệu sai bị từ chối, cấu hình cũ giữ nguyên', async () => {
    const rejected = await sendJson('PUT', url('accounts'), principal.accessToken, { page_size: 30 });
    assert.equal(rejected.status, 400);
    assert.equal(errorOf(rejected.body).code, 'ERR_VALIDATION');
    assert.equal(errorOf(rejected.body).details?.[0]?.field, 'page_size');
    const duplicated = await sendJson('PUT', url('accounts'), principal.accessToken, { columns: ['a', 'a'] });
    assert.equal(duplicated.status, 400);
    assert.deepEqual((await sendJson('GET', url('accounts'), principal.accessToken)).body, {
      columns: null,
      page_size: 10,
    });
  });
});
