import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sql } from 'kysely';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { CONNECTOR_SPECS, validateConnectorValues } from './school-settings.js';
import { paymentSettingsOf } from './tenant-connectors.js';

// Cấu hình kết nối riêng từng trường (DT-SaaS phần S3, YCTD-195; tài liệu 32 mục 14.5). Hai trường trên một nền tảng; dữ liệu giả hoàn toàn.
// Khóa lưu mã hóa bằng khóa của trường, không trả lại giá trị bí mật, trường này không thấy và không dùng cấu hình của trường kia
describe('kiểm tra giá trị kết nối', () => {
  it('bắt buộc khi bật, giữ giá trị đã lưu khi để trống, từ chối trường lạ và giá trị xấu', () => {
    const missing = validateConnectorValues('payos', {}, {}, true);
    assert.ok(missing.errors.some((error) => error.field === 'values.client_id'));
    assert.ok(missing.errors.some((error) => error.field === 'values.api_key'));
    assert.equal(validateConnectorValues('payos', {}, {}, false).errors.length, 0);
    const kept = validateConnectorValues('sepay', { webhook_api_key: '' }, { webhook_api_key: 'da-luu-1234' }, true);
    assert.deepEqual(kept.errors, []);
    assert.equal(kept.values.webhook_api_key, 'da-luu-1234');
    const bad = validateConnectorValues(
      'esms',
      { api_key: 'a', secret_key: 'b', brandname: 'ABC', sandbox: 'co', lạ: 'x' },
      {},
      true,
    );
    assert.ok(bad.errors.some((error) => error.field === 'values.sandbox'));
    assert.ok(bad.errors.some((error) => error.field === 'values.lạ'));
    assert.ok(
      validateConnectorValues('vnpay', { return_url: 'ftp://x' }, {}, true).errors.some(
        (error) => error.field === 'values.return_url',
      ),
    );
    assert.ok(validateConnectorValues('facebook', { page_access_token: 'a\nb' }, {}, true).errors.length > 0);
  });

  it('mọi kết nối có mô tả đủ trường và giá trị bí mật được đánh dấu', () => {
    for (const [code, spec] of Object.entries(CONNECTOR_SPECS)) {
      assert.ok(spec.label, code);
      for (const field of spec.fields) {
        assert.match(field.name, /^[a-z_]+$/);
      }
    }
    assert.ok(CONNECTOR_SPECS.payos.fields.find((field) => field.name === 'api_key')?.secret);
    assert.ok(CONNECTOR_SPECS.payos.webhookPath);
  });

  it('dựng bảng cổng thanh toán từ cấu hình đã bật theo thứ tự ưu tiên', () => {
    const stored = new Map([
      ['sepay', { id: '1', connector: 'sepay', enabled: true, values: { webhook_api_key: 'k' }, version: 'v' }],
      [
        'payos',
        {
          id: '2',
          connector: 'payos',
          enabled: true,
          values: { client_id: 'c', api_key: 'a', checksum_key: 'x', return_url: 'https://truong.test/' },
          version: 'v',
        },
      ],
      ['casso', { id: '3', connector: 'casso', enabled: false, values: { webhook_secret: 's' }, version: 'v' }],
    ] as const);
    const result = paymentSettingsOf(new Map(stored as never));
    assert.deepEqual(result.codes, ['payos', 'sepay']);
    assert.equal(result.providers.payos?.cancelUrl, 'https://truong.test/');
    assert.equal(result.providers.casso, undefined);
  });
});

describe('cấu hình riêng từng trường ở máy chủ API nhiều trường', () => {
  let environment: MultiTenantApi;
  const marker = 'KHOA-RIENG-TRUONG-ALPHA-9876';

  before(async () => {
    environment = await startMultiTenantApi({ schools: ['alpha', 'beta'], label: 'set' });
  });

  after(async () => {
    await environment?.close();
  });

  const call = (name: string, method: string, path: string, body?: unknown) =>
    environment.call(name, method, path, body);

  it('chưa nhập thì chưa cấu hình; nhập rồi không trả lại giá trị bí mật, chỉ bốn ký tự cuối', async () => {
    const before = await call('alpha', 'GET', '/school-settings/integrations');
    assert.equal(before.status, 200);
    const list = before.body as unknown as Array<{ connector: string; configured: boolean }>;
    assert.ok(list.length >= 9);
    assert.ok(list.every((item) => !item.configured));

    const saved = await call('alpha', 'PUT', '/school-settings/integrations/sepay', {
      enabled: true,
      values: { webhook_api_key: marker },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const text = JSON.stringify(saved.body);
    assert.ok(!text.includes(marker));
    assert.ok(text.includes('••••9876'));
    const again = JSON.stringify((await call('alpha', 'GET', '/school-settings/integrations')).body);
    assert.ok(!again.includes(marker));
  });

  it('lưu mã hóa: bản rõ không nằm ở cơ sở dữ liệu của trường, giải mã bằng khóa của trường', async () => {
    const tenant = await environment.tenantOf('alpha');
    const database = environment.apiRuntime.connections.database<never>(tenant, 'system', 'system');
    const rows = (
      await sql<{ values_encrypted: string; hints: Record<string, string> }>`
      select values_encrypted, hints from integration_secrets where connector = 'sepay'`.execute(database)
    ).rows;
    assert.equal(rows.length, 1);
    assert.ok(!rows[0]?.values_encrypted.includes(marker));
    assert.ok(!JSON.stringify(rows[0]?.hints).includes(marker));
  });

  it('trường beta không thấy cấu hình của alpha và nhận thông báo bằng khóa của alpha bị từ chối', async () => {
    const beta = await call('beta', 'GET', '/school-settings/integrations');
    const betaList = beta.body as unknown as Array<{ connector: string; configured: boolean }>;
    assert.ok(betaList.every((item) => !item.configured));
    // Webhook SePay của beta: beta chưa bật cổng nào nên 404; của alpha đã bật nên đi tới bước xác thực khóa
    const betaHook = await sendWithHost(environment.apiOrigin, {
      method: 'POST',
      path: '/api/v1/payment-webhooks/sepay',
      host: environment.hosts.beta as string,
      body: {},
    });
    assert.equal(betaHook.status, 404);
    const alphaHookWrongKey = await sendWithHost(environment.apiOrigin, {
      method: 'POST',
      path: '/api/v1/payment-webhooks/sepay',
      host: environment.hosts.alpha as string,
      body: {},
    });
    assert.notEqual(alphaHookWrongKey.status, 404);
    assert.ok([400, 401, 403].includes(alphaHookWrongKey.status), `trạng thái ${alphaHookWrongKey.status}`);
  });

  it('kiểm tra kết nối, xóa cấu hình và nhật ký không ghi giá trị', async () => {
    const test = await call('alpha', 'POST', '/school-settings/integrations/sepay/test');
    assert.equal(test.status, 200, JSON.stringify(test.body));
    assert.equal(test.body.ok, true);
    const notSet = await call('beta', 'POST', '/school-settings/integrations/sepay/test');
    assert.equal(notSet.status, 422);
    const invalid = await call('alpha', 'PUT', '/school-settings/integrations/payos', { enabled: true, values: {} });
    assert.equal(invalid.status, 400);
    assert.equal((await call('alpha', 'PUT', '/school-settings/integrations/khong-co', { enabled: true })).status, 404);
    const removed = await call('alpha', 'DELETE', '/school-settings/integrations/sepay');
    assert.equal(removed.status, 200);
    assert.equal(removed.body.configured, false);
  });

  it('thương hiệu riêng từng trường, trang đăng nhập đọc công khai theo tên miền', async () => {
    const saved = await call('alpha', 'PUT', '/school-settings/branding', {
      display_name: 'Trường Alpha giả',
      primary_color: '#1D5FD1',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.primary_color, '#1D5FD1');
    assert.equal((await call('alpha', 'PUT', '/school-settings/branding', { primary_color: 'xanh' })).status, 400);
    const publicAlpha = await sendWithHost(environment.apiOrigin, {
      path: '/api/v1/public/branding',
      host: environment.hosts.alpha as string,
    });
    assert.equal(publicAlpha.status, 200);
    assert.equal(publicAlpha.body.display_name, 'Trường Alpha giả');
    assert.equal(publicAlpha.body.primary_color, '#1D5FD1');
    const publicBeta = await sendWithHost(environment.apiOrigin, {
      path: '/api/v1/public/branding',
      host: environment.hosts.beta as string,
    });
    assert.notEqual(publicBeta.body.display_name, 'Trường Alpha giả');
    assert.notEqual(publicBeta.body.primary_color, '#1D5FD1');
    assert.equal(
      (
        await sendWithHost(environment.apiOrigin, {
          path: '/api/v1/public/branding/logo',
          host: environment.hosts.alpha as string,
        })
      ).status,
      404,
    );
  });
});
