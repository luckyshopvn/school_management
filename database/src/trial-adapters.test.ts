import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  databaseHostSettings,
  neonPoolerHost,
  readDatabaseHostOptions,
  supabaseProjectRef,
} from './database-host-adapter.js';
import { createDomainProvider, type FetchFunction } from './domain-provider.js';
import { lifecycleSettingsFrom } from './lifecycle-environment.js';
import { dataPolicyProblem } from './school-lifecycle.js';

// Bộ nối của hồ sơ thử nghiệm (DT-SaaS phần S9, YCTD-203): nơi đặt PostgreSQL, tên miền riêng qua giao diện lập trình của
// nhà cung cấp (máy chủ giả, không gọi dịch vụ thật), chính sách dữ liệu của môi trường. Giá trị trong kiểm thử đều giả
describe('bộ nối nơi đặt PostgreSQL', () => {
  it('neon: máy chủ gom kết nối có hậu tố -pooler', () => {
    assert.equal(
      neonPoolerHost('ep-gia-123.ap-southeast-1.aws.neon.tech'),
      'ep-gia-123-pooler.ap-southeast-1.aws.neon.tech',
    );
    assert.equal(
      neonPoolerHost('ep-gia-123-pooler.ap-southeast-1.aws.neon.tech'),
      'ep-gia-123-pooler.ap-southeast-1.aws.neon.tech',
    );
    const settings = databaseHostSettings(
      readDatabaseHostOptions({ DB_HOST_ADAPTER: 'neon' }),
      'postgres://quan_tri:gia@ep-gia-123.ap-southeast-1.aws.neon.tech/neondb',
    );
    assert.deepEqual(settings, {
      host: 'ep-gia-123-pooler.ap-southeast-1.aws.neon.tech',
      port: 5432,
      revokePublicConnect: true,
    });
  });

  it('supabase: bộ gom dùng chung cổng 6543, tên đăng nhập <vai trò>.<mã dự án>, không thu hồi kết nối của PUBLIC', () => {
    assert.equal(supabaseProjectRef('db.abcdefgh.supabase.co'), 'abcdefgh');
    const settings = databaseHostSettings(
      readDatabaseHostOptions({
        DB_HOST_ADAPTER: 'supabase',
        DB_POOLER_HOST: 'aws-0-ap-southeast-1.pooler.supabase.com',
      }),
      'postgres://postgres:gia@db.abcdefgh.supabase.co:5432/postgres',
    );
    assert.deepEqual(settings, {
      host: 'aws-0-ap-southeast-1.pooler.supabase.com',
      port: 6543,
      loginSuffix: '.abcdefgh',
      revokePublicConnect: false,
    });
    assert.throws(
      () =>
        databaseHostSettings(
          readDatabaseHostOptions({ DB_HOST_ADAPTER: 'supabase' }),
          'postgres://a:b@khac.example.test/x',
        ),
      /DB_POOLER_HOST/,
    );
  });

  it('plain: địa chỉ của tài khoản quản trị hoặc PgBouncer; giá trị lạ bị từ chối', () => {
    assert.deepEqual(databaseHostSettings(readDatabaseHostOptions({}), 'postgres://a:b@may-chu.example.test:5433/x'), {
      host: 'may-chu.example.test',
      port: 5433,
      revokePublicConnect: true,
    });
    assert.deepEqual(
      databaseHostSettings(
        readDatabaseHostOptions({ DB_POOLER_HOST: 'pgbouncer', DB_POOLER_PORT: '6432' }),
        'postgres://a:b@may-chu.example.test:5433/x',
      ),
      { host: 'pgbouncer', port: 6432, revokePublicConnect: true },
    );
    assert.throws(() => readDatabaseHostOptions({ DB_HOST_ADAPTER: 'khac' }), /DB_HOST_ADAPTER/);
  });
});

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeApi(handler: (call: Call) => { status?: number; body: unknown }): { calls: Call[]; fetch: FetchFunction } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      const call: Call = {
        url,
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
      calls.push(call);
      const reply = handler(call);
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
    },
  };
}

describe('bộ nối tên miền cloudflare-saas', () => {
  it('tạo custom hostname, hỏi trạng thái, gỡ; khóa đặt ở tiêu đề Authorization', async () => {
    let state = 'pending';
    const api = fakeApi((call) => {
      if (call.method === 'POST') {
        return {
          body: {
            success: true,
            result: {
              id: 'ch-1',
              hostname: 'truong-gia.example.test',
              ownership_verification: {
                type: 'txt',
                name: '_cf-custom-hostname.truong-gia.example.test',
                value: 'ma-gia',
              },
            },
          },
        };
      }
      if (call.method === 'DELETE') {
        return { body: { success: true, result: { id: 'ch-1' } } };
      }
      return {
        body: {
          success: true,
          result: [{ id: 'ch-1', hostname: 'truong-gia.example.test', status: state, ssl: { status: state } }],
        },
      };
    });
    const provider = createDomainProvider('cloudflare-saas', {
      cloudflare: { apiToken: 'khoa-gia', zoneId: 'vung-gia', apiBase: 'https://cf.example.test/v4' },
      fetch: api.fetch,
    });
    const request = await provider.request('truong-gia.example.test', 'vao.truong.example.test');
    assert.equal(request.cnameTarget, 'vao.truong.example.test');
    assert.equal(request.verificationToken, '_cf-custom-hostname.truong-gia.example.test ma-gia');
    assert.equal(api.calls[0]?.url, 'https://cf.example.test/v4/zones/vung-gia/custom_hostnames');
    assert.equal(api.calls[0]?.headers.authorization, 'Bearer khoa-gia');
    assert.deepEqual(api.calls[0]?.body, { hostname: 'truong-gia.example.test', ssl: { method: 'http', type: 'dv' } });

    const pending = await provider.status('truong-gia.example.test', request);
    assert.equal(pending.verified, false);
    assert.ok(pending.problems.length >= 1);
    state = 'active';
    assert.deepEqual(await provider.status('truong-gia.example.test', request), { verified: true, problems: [] });
    await provider.remove('truong-gia.example.test');
    assert.equal(api.calls.at(-1)?.method, 'DELETE');
    assert.equal(api.calls.at(-1)?.url, 'https://cf.example.test/v4/zones/vung-gia/custom_hostnames/ch-1');
  });

  it('lỗi của nhà cung cấp báo rõ; thiếu khóa thì không dựng được bộ nối', async () => {
    const api = fakeApi(() => ({
      status: 403,
      body: { success: false, errors: [{ message: 'Khóa không đủ quyền' }] },
    }));
    const provider = createDomainProvider('cloudflare-saas', {
      cloudflare: { apiToken: 'khoa-gia', zoneId: 'vung-gia' },
      fetch: api.fetch,
    });
    await assert.rejects(() => provider.request('a.example.test', null), /Cloudflare trả 403: Khóa không đủ quyền/);
    assert.throws(() => createDomainProvider('cloudflare-saas'), /CLOUDFLARE_API_TOKEN/);
  });
});

describe('bộ nối tên miền vercel-domains', () => {
  it('thêm tên miền vào dự án, xác nhận, gỡ; teamId ở chuỗi truy vấn', async () => {
    let verified = false;
    const api = fakeApi((call) => {
      if (call.url.includes('/verify')) {
        return { body: { verified } };
      }
      if (call.method === 'DELETE') {
        return { body: {} };
      }
      return {
        body: {
          name: 'truong-gia.example.test',
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.example.test', value: 'vc-domain-verify=gia', reason: 'pending' },
          ],
        },
      };
    });
    const provider = createDomainProvider('vercel-domains', {
      vercel: { token: 'khoa-gia', projectId: 'du-an-gia', teamId: 'nhom-gia', apiBase: 'https://vc.example.test' },
      fetch: api.fetch,
    });
    const request = await provider.request('truong-gia.example.test', null);
    assert.equal(api.calls[0]?.url, 'https://vc.example.test/v10/projects/du-an-gia/domains?teamId=nhom-gia');
    assert.equal(request.cnameTarget, 'cname.vercel-dns.com');
    assert.equal(request.verificationToken, 'TXT _vercel.example.test vc-domain-verify=gia');
    assert.equal((await provider.status('truong-gia.example.test', request)).verified, false);
    verified = true;
    assert.equal((await provider.status('truong-gia.example.test', request)).verified, true);
    await provider.remove('truong-gia.example.test');
    assert.equal(
      api.calls.at(-1)?.url,
      'https://vc.example.test/v9/projects/du-an-gia/domains/truong-gia.example.test?teamId=nhom-gia',
    );
  });
});

describe('cấu hình vòng đời và chính sách dữ liệu', () => {
  it('đọc khóa bộ nối và chính sách từ cấu hình', () => {
    const settings = lifecycleSettingsFrom({
      DOMAIN_PROVIDER: 'cloudflare-saas',
      CLOUDFLARE_API_TOKEN: 'khoa-gia',
      CLOUDFLARE_ZONE_ID: 'vung-gia',
      PLATFORM_DATA_POLICY: 'consent-required',
    });
    assert.equal(settings.domainProvider, 'cloudflare-saas');
    assert.deepEqual(settings.domainProviderOptions?.cloudflare, { apiToken: 'khoa-gia', zoneId: 'vung-gia' });
    assert.equal(settings.dataPolicy, 'consent-required');
    assert.throws(() => lifecycleSettingsFrom({ PLATFORM_DATA_POLICY: 'khac' }), /PLATFORM_DATA_POLICY/);
  });

  it('consent-required không nhận production; synthetic-only chỉ nhận dữ liệu giả', () => {
    assert.equal(dataPolicyProblem('any', 'production'), null);
    assert.equal(dataPolicyProblem('consent-required', 'consented'), null);
    assert.ok(dataPolicyProblem('consent-required', 'production'));
    assert.ok(dataPolicyProblem('synthetic-only', 'consented'));
    assert.equal(dataPolicyProblem('synthetic-only', 'synthetic'), null);
  });
});
