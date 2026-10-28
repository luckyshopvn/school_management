import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as playwrightRequest } from '@playwright/test';
import {
  createDatabase,
  readTenancyConfiguration,
  TenancyRuntime,
  type MarketplaceDatabase,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  MockOidcServer,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MARKET_HOST,
  E2E_MARKET_OIDC_CLIENT_ID,
  E2E_MARKET_OIDC_CLIENT_SECRET,
  E2E_MARKET_OIDC_PORT,
  E2E_MULTI_API_PORT,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_MARKET_PORT,
  E2E_MULTI_STATE_FILE,
  E2E_MULTI_TUTOR_PORT,
  E2E_TUTOR_HOST,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// DT-27 phần 27g (YCTD-257, spec 196): gia sư ở ứng dụng Gia sư xác minh danh tính qua nhà cung cấp OIDC giả lập (đủ 18 tuổi), khai hồ sơ
// dạy, nộp phiếu lý lịch tư pháp (mã hóa ở máy chủ), gửi duyệt; nhân viên nền tảng duyệt ở cổng nền tảng; phụ huynh thấy gia sư ở Chợ
// gia sư, mở trang theo Mẫu 02. Chỉ chạy ở dự án nhiều trường. Dữ liệu giả, không gọi dịch vụ thật
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);
const operatorLogin = `van-hanh-duyet-${suffix}`;
const tutorEmail = `gia-su-xac-minh-${suffix}@example.test`;
const tutorName = `Gia sư Hòa ${suffix}`;
const CODE = '135790';
const PDF = Buffer.from('%PDF-1.4\n% phieu ly lich tu phap gia\n');

let runtime: TenancyRuntime;
let marketplace: ReturnType<typeof createDatabase<MarketplaceDatabase>>;
let mock: MockOidcServer;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
let operatorToken = '';

async function admin(method: string, path: string, data?: unknown) {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: E2E_CONSOLE_HOST } });
  try {
    const response = await context.fetch(`${API}/api/v1/market/admin${path}`, {
      method,
      headers: { authorization: `Bearer ${operatorToken}` },
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: (await response.json()) as Record<string, unknown> };
  } finally {
    await context.dispose();
  }
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  const state = JSON.parse(readFileSync(E2E_MULTI_STATE_FILE, 'utf8')) as { marketplaceUrl: string };
  marketplace = createDatabase<MarketplaceDatabase>(state.marketplaceUrl, { max: 1 });
  mock = await new MockOidcServer({
    port: E2E_MARKET_OIDC_PORT,
    clientId: E2E_MARKET_OIDC_CLIENT_ID,
    clientSecret: E2E_MARKET_OIDC_CLIENT_SECRET,
  }).start();
  operator = await createPlatformOperatorWithTotp(runtime.platform, configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Nhân viên duyệt gia sư giả',
    password: OPERATOR_TEST_PASSWORD,
  });
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: E2E_CONSOLE_HOST } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/platform/login`, {
    data: {
      login: operatorLogin,
      password: OPERATOR_TEST_PASSWORD,
      otp_code: await operatorOtp(runtime.platform, operator.id, operator.secret),
    },
  });
  expect(response.status()).toBe(200);
  operatorToken = ((await response.json()) as { access_token: string }).access_token;
  await context.dispose();
  expect(
    (await admin('PUT', '/settings', { enabled: true, host: E2E_MARKET_HOST, tutor_host: E2E_TUTOR_HOST })).status,
  ).toBe(200);
  for (const kind of ['terms', 'privacy', 'tutor_terms']) {
    expect(
      (await admin('POST', '/documents', { kind, title: `Văn bản ${kind} ${suffix}`, body: 'Nội dung giả' })).status,
    ).toBe(201);
  }
});

test.afterAll(async () => {
  await runtime?.platform.deleteFrom('platform_settings').where('key', '=', 'market').execute();
  await marketplace?.destroy();
  await mock?.stop();
  await runtime?.close();
});

test('CT-27g-5: gia sư xác minh, khai hồ sơ, nộp lý lịch; nền tảng duyệt; phụ huynh tìm thấy theo Mẫu 02', async ({
  browser,
}) => {
  // Đăng ký gia sư ở ứng dụng Gia sư
  const tutorContext = await browser.newContext({ baseURL: `http://${E2E_TUTOR_HOST}:${E2E_MULTI_TUTOR_PORT}` });
  const tutor = await tutorContext.newPage();
  await tutor.goto('/');
  await tutor.getByRole('button', { name: 'Đăng ký' }).click();
  const register = tutor.getByRole('form', { name: 'Đăng ký tài khoản gia sư' });
  await register.getByLabel('Thư điện tử hoặc số điện thoại').fill(tutorEmail);
  await register.getByLabel('Tên hiển thị').fill(tutorName);
  await register.getByLabel('Mật khẩu (ít nhất 8 ký tự, có chữ và số)').fill('matkhau123');
  for (const kind of ['terms', 'privacy', 'tutor_terms']) {
    await register.getByLabel(`Tôi đồng ý Văn bản ${kind} ${suffix}`).check();
  }
  await register.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(tutor.getByRole('form', { name: 'Xác nhận tài khoản' })).toBeVisible();
  // Mã gửi vào hộp thư giả lập trong bộ nhớ máy chủ: đặt mã đã biết vào bản ghi mã mới nhất (cơ sở dữ liệu chỉ giữ băm)
  const account = await marketplace
    .selectFrom('market_accounts')
    .select('id')
    .where('email', '=', tutorEmail)
    .executeTakeFirstOrThrow();
  const latest = await marketplace
    .selectFrom('market_verification_codes')
    .select('id')
    .where('account_id', '=', account.id)
    .orderBy('created_at', 'desc')
    .executeTakeFirstOrThrow();
  await marketplace
    .updateTable('market_verification_codes')
    .set({ code_hash: createHash('sha256').update(`market-code:${account.id}:${CODE}`).digest('hex') })
    .where('id', '=', latest.id)
    .execute();
  const verify = tutor.getByRole('form', { name: 'Xác nhận tài khoản' });
  await verify.getByLabel('Mã xác nhận').fill(CODE);
  await verify.getByRole('button', { name: 'Xác nhận' }).click();

  // Xác minh danh tính: sang nhà cung cấp giả lập rồi quay về /xac-minh
  mock.nextIdentity = { subject: `gia-su-e2e-${suffix}`, birthdate: `${new Date().getFullYear() - 30}-03-08` };
  const identity = tutor.getByRole('region', { name: 'Danh tính' });
  await tutor.getByRole('button', { name: 'Xác minh bằng Định danh giả lập' }).click();
  await expect(tutor.getByText('Đã xác minh danh tính')).toBeVisible();
  await expect(tutor).toHaveURL(/\/$/);
  await expect(identity).toContainText('Đã xác minh');

  // Hồ sơ dạy: một môn năng khiếu, một khung giờ
  const listing = tutor.getByRole('region', { name: 'Hồ sơ dạy' });
  await listing.getByRole('button', { name: 'Thêm môn' }).click();
  const subject = listing.getByRole('group', { name: 'Môn 1' });
  await subject.getByLabel('Tên môn').fill(`Cờ vua ${suffix}`);
  await subject.getByLabel('Giá mỗi buổi (đồng)').fill('120000');
  await listing.getByRole('button', { name: 'Thêm khung giờ' }).click();
  await listing.getByRole('button', { name: 'Lưu hồ sơ dạy' }).click();
  await expect(listing.getByText('Đã lưu hồ sơ dạy')).toBeVisible();

  // Phiếu lý lịch tư pháp cấp hôm nay
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const record = tutor.getByRole('form', { name: 'Phiếu lý lịch tư pháp' });
  await record.getByLabel('Ngày cấp').fill(today);
  await record.getByLabel('Tệp (PDF, JPEG, PNG, tối đa 10 MB)').setInputFiles({
    name: 'ly-lich.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await record.getByRole('button', { name: 'Nộp phiếu lý lịch tư pháp' }).click();
  await expect(record).toContainText('Đang chờ duyệt');
  await tutor.getByRole('region', { name: 'Hồ sơ dạy' }).getByRole('button', { name: 'Gửi nền tảng duyệt' }).click();
  await expect(tutor.getByRole('region', { name: 'Hồ sơ dạy' })).toContainText('Đang chờ nền tảng duyệt');
  await tutorContext.close();

  // Nhân viên nền tảng duyệt lý lịch rồi duyệt hồ sơ ở cổng nền tảng
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_TEST_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Chợ gia sư' }).click();
  const queue = consolePage.getByRole('region', { name: 'Hàng chờ duyệt gia sư' });
  await queue.getByRole('button', { name: `Mở ${tutorName}` }).click();
  const review = consolePage.getByRole('region', { name: `Duyệt gia sư ${tutorName}` });
  await expect(review.getByRole('button', { name: 'Duyệt hồ sơ' })).toBeDisabled();
  await review.getByRole('button', { name: 'Duyệt Lý lịch tư pháp' }).click();
  await expect(review.getByRole('list', { name: 'Trạng thái xác minh' })).toContainText('Lý lịch tư pháp: đã duyệt');
  await review.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
  await expect(review).toContainText('Hồ sơ: approved');
  await consoleContext.close();

  // Phụ huynh tìm thấy gia sư ở Chợ gia sư, mở trang theo Mẫu 02; không có thư điện tử của gia sư
  const marketContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  const market = await marketContext.newPage();
  await market.goto('/');
  const search = market.getByRole('form', { name: 'Lọc gia sư' });
  await search.getByLabel('Môn').fill(`Cờ vua ${suffix}`);
  await search.getByRole('button', { name: 'Tìm' }).click();
  const card = market.getByRole('listitem', { name: `Gia sư ${tutorName}` });
  await expect(card).toContainText('120.000 đồng');
  await expect(card).toContainText('Đã xác minh lý lịch tư pháp');
  await card.getByRole('button', { name: `Xem gia sư ${tutorName}` }).click();
  const form02 = market.getByRole('region', { name: 'Thông tin công khai theo Mẫu 02' });
  await expect(form02).toContainText('Trực tuyến qua Chợ gia sư');
  await expect(form02).toContainText(`Cờ vua ${suffix}`);
  await expect(market.getByText(tutorEmail)).toHaveCount(0);
  await marketContext.close();
});
