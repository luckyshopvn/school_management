import { createServer, type IncomingMessage, type Server } from 'node:http';
import { request as playwrightRequest } from '@playwright/test';
import { readTenancyConfiguration, TenancyRuntime } from '@school-management/database';
import { createPlatformOperatorWithTotp, operatorOtp } from '@school-management/identity/testing';
import worker, { runScheduled } from '../../deploy/profiles/trial/cloudflare/src/worker.mjs';
import { createRouter } from '../../deploy/profiles/trial/container/router.mjs';
import {
  E2E_CONSOLE_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_SCHEDULER_SECRET,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-SaaS phần S9 (YCTD-203, spec 140): hồ sơ thử nghiệm chạy bằng mã của chính nó trước dịch vụ định danh và máy chủ API của
// dự án nhiều trường (bố cục database hoặc schema theo E2E_TENANT_LAYOUT): cổng biên Cloudflare Worker chạy bằng Node, bộ định
// tuyến của container gộp; Cron gọi tick thật; máy chủ ngủ thì trình duyệt thấy trang đang khởi động kèm biểu ngữ thử nghiệm;
// chính sách dữ liệu consent-required ở bước setup của cổng nền tảng. Dữ liệu giả hoàn toàn
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const PASSWORD = 'MatKhauVanHanh2026';
const operatorLogin = `van-hanh-${Math.random().toString(36).slice(2, 8)}`;

let runtime: TenancyRuntime;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
const servers: Server[] = [];

function listen(server: Server): Promise<string> {
  servers.push(server);
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`);
    }),
  );
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Chạy Worker như Cloudflare: đổi yêu cầu Node thành Request chuẩn, gọi fetch của Worker, ghi Response ra
function workerServer(env: Record<string, unknown>): Server {
  return createServer(async (incoming, outgoing) => {
    const body = await readBody(incoming);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      }
    }
    const request = new Request(`http://${incoming.headers.host ?? 'localhost'}${incoming.url ?? '/'}`, {
      method: incoming.method ?? 'GET',
      headers,
      ...(body.length > 0 ? { body } : {}),
    });
    const response = await worker.fetch(request, env, { waitUntil: () => undefined });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
}

let edgeUrl: string;
let asleepUrl: string;
let routerUrl: string;

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  operator = await createPlatformOperatorWithTotp(runtime.platform, runtime.configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Người vận hành giả',
    password: PASSWORD,
  });
  routerUrl = await listen(createRouter({ identity: E2E_MULTI_IDENTITY_PORT, api: E2E_MULTI_API_PORT }));
  const assets = {
    fetch: async (request: Request) =>
      new URL(request.url).pathname === '/quan-ly/index.html'
        ? new Response('<html><body><h1>Cổng quản trị giả</h1></body></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        : new Response('Không có', { status: 404 }),
  };
  const base = {
    ROOT_DOMAIN: 'e2e.localhost',
    CONSOLE_HOST: 'nen-tang-khac.e2e.localhost',
    EDGE_HOST_HEADER: 'x-school-host',
    EDGE_SHARED_SECRET: 'bi-mat-canh-gia',
    INTERNAL_JOB_TOKEN: E2E_SCHEDULER_SECRET,
    DATA_POLICY: 'consent-required',
    ASSETS: assets,
  };
  edgeUrl = await listen(workerServer({ ...base, ORIGIN_URL: routerUrl, ORIGIN_TIMEOUT_MS: '10000' }));
  asleepUrl = await listen(workerServer({ ...base, ORIGIN_URL: 'http://127.0.0.1:9', ORIGIN_TIMEOUT_MS: '1000' }));
});

test.afterAll(async () => {
  for (const server of servers) {
    server.close();
  }
  await runtime?.close();
});

test('Cổng biên và container gộp chuyển yêu cầu tới máy chủ thật; Cron gọi tick của bộ lập lịch', async () => {
  const context = await playwrightRequest.newContext();
  try {
    const health = await context.get(`${edgeUrl}/api/v1/health`);
    expect(health.status()).toBe(200);
    // Bộ định tuyến chuyển nhóm định danh sang dịch vụ định danh: tên miền cổng nền tảng không khớp nên 404 chung, không phải lỗi cổng
    const identity = await context.get(`${routerUrl}/api/v1/auth/platform/me`);
    expect(identity.status()).toBe(404);
  } finally {
    await context.dispose();
  }
  const result = (await runScheduled({ ORIGIN_URL: routerUrl, INTERNAL_JOB_TOKEN: E2E_SCHEDULER_SECRET })) as {
    jobs: string[];
    failed: string[];
  };
  expect(result.jobs.length).toBeGreaterThan(0);
  expect(result.failed).toEqual([]);
});

test('Máy chủ ngủ: trình duyệt thấy trang đang khởi động kèm biểu ngữ môi trường thử nghiệm; ứng dụng tĩnh qua cổng biên', async ({
  page,
}) => {
  const response = await page.goto(`${asleepUrl}/gioi-thieu`);
  expect(response?.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'Hệ thống đang khởi động' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('máy chủ đặt ngoài Việt Nam');
  await page.goto(`${edgeUrl}/quan-ly/hoc-sinh`);
  await expect(page.getByRole('heading', { name: 'Cổng quản trị giả' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('văn bản đồng ý');
});

test('Chính sách consent-required: không nhận loại production, dữ liệu thật thiếu hồ sơ bị từ chối', async () => {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: E2E_CONSOLE_HOST } });
  try {
    const login = await context.post(`${IDENTITY}/api/v1/auth/platform/login`, {
      data: {
        login: operatorLogin,
        password: PASSWORD,
        otp_code: await operatorOtp(runtime.platform, operator.id, operator.secret),
      },
    });
    expect(login.status()).toBe(200);
    const token = ((await login.json()) as { access_token: string }).access_token;
    const setup = (dataClass: string) => ({
      code: `chinh-sach-${dataClass}`,
      name: 'Trường kiểm chính sách (dữ liệu giả)',
      levels: ['TH'],
      domain: { mode: 'system' },
      data_class: dataClass,
      admin: { full_name: 'Quản trị giả', login: 'quantri' },
      terms: { version: 'PL-04 v1', accepted: true, accepted_by_name: 'Hiệu trưởng giả' },
    });
    const production = await context.post(`${IDENTITY}/api/v1/auth/platform/schools`, {
      headers: { authorization: `Bearer ${token}` },
      data: setup('production'),
    });
    expect(production.status()).toBe(400);
    const productionError = (await production.json()) as {
      error: { details: Array<{ field: string; message: string }> };
    };
    expect(productionError.error.details.find((detail) => detail.field === 'data_class')?.message).toContain(
      'thử nghiệm',
    );
    const consented = await context.post(`${IDENTITY}/api/v1/auth/platform/schools`, {
      headers: { authorization: `Bearer ${token}` },
      data: setup('consented'),
    });
    expect(consented.status()).toBe(400);
    const consentedError = (await consented.json()) as { error: { details: Array<{ field: string }> } };
    expect(consentedError.error.details.some((detail) => detail.field === 'consents')).toBe(true);
  } finally {
    await context.dispose();
  }
});
