import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as playwrightRequest } from '@playwright/test';
import {
  canConnect,
  createDatabase,
  readTenancyConfiguration,
  TenancyRuntime,
  type IdentityDatabase,
  type MarketplaceDatabase,
} from '@school-management/database';
import {
  createPlatformOperatorWithTotp,
  createTestUser,
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MARKET_HOST,
  E2E_TUTOR_HOST,
  E2E_MULTI_API_PORT,
  E2E_MULTI_CONSOLE_PORT,
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_MARKET_PORT,
  E2E_MULTI_TUTOR_PORT,
  E2E_MULTI_STATE_FILE,
  schoolHost,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';
import { signInConsole } from './platform-console.js';

// DT-27 phần 27f (YCTD-256, spec 195): nền chợ gia sư và cách ly chợ với các trường. Người vận hành bật chợ ở cổng nền tảng (tên miền
// dành riêng, văn bản pháp lý có phiên bản; thu tiền thật không có công tắc), phụ huynh đăng ký ở ứng dụng chợ, xác nhận mã, tạo hồ sơ
// con có đồng ý, rút đồng ý; chợ không phục vụ ở tên miền của trường, phiên chợ và mã phiên của trường không dùng chéo, vai trò cơ sở dữ
// liệu của chợ không vào được cơ sở dữ liệu của trường. Chỉ chạy ở dự án nhiều trường. Dữ liệu giả, không gọi dịch vụ thật
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);
const operatorLogin = `van-hanh-cho-${suffix}`;
const parentEmail = `phu-huynh-${suffix}@example.test`;
const tutorEmail = `gia-su-${suffix}@example.test`;
const CODE = '246810';

let runtime: TenancyRuntime;
let marketplace: ReturnType<typeof createDatabase<MarketplaceDatabase>>;
let marketplaceUrl = '';
let schoolToken = '';
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;

async function hostCall(host: string, method: string, path: string, token?: string, data?: unknown) {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: host } });
  try {
    const response = await context.fetch(`${API}/api/v1${path}`, {
      method,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      ...(data === undefined ? {} : { data }),
    });
    return response.status();
  } finally {
    await context.dispose();
  }
}

// Mã gửi qua hộp thư giả lập trong bộ nhớ máy chủ: kiểm thử đặt mã đã biết vào bản ghi mã mới nhất (cơ sở dữ liệu chỉ giữ băm)
async function setKnownCode(email: string): Promise<void> {
  const account = await marketplace
    .selectFrom('market_accounts')
    .select('id')
    .where('email', '=', email)
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
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  marketplaceUrl = (JSON.parse(readFileSync(E2E_MULTI_STATE_FILE, 'utf8')) as { marketplaceUrl: string })
    .marketplaceUrl;
  marketplace = createDatabase<MarketplaceDatabase>(marketplaceUrl, { max: 1 });
  operator = await createPlatformOperatorWithTotp(runtime.platform, configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Người vận hành chợ giả',
    password: OPERATOR_TEST_PASSWORD,
  });
  const tenant = await runtime.registry.resolveHost(schoolHost('alpha'));
  if (!tenant) {
    throw new Error('Chưa dựng trường alpha');
  }
  const user = await createTestUser(runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity'), {
    roles: [{ roleCode: 'VT-02', orgUnitId: null }],
  });
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: schoolHost('alpha') } });
  const response = await context.post(`${IDENTITY}/api/v1/auth/login`, {
    data: { login: user.username, password: user.password, channel: 'portal' },
  });
  expect(response.status()).toBe(200);
  schoolToken = ((await response.json()) as { access_token: string }).access_token;
  await context.dispose();
});

test.afterAll(async () => {
  // Trả chợ về tắt để lần chạy khác bắt đầu như mới
  await runtime?.platform.deleteFrom('platform_settings').where('key', '=', 'market').execute();
  await marketplace?.destroy();
  await runtime?.close();
});

test('CT-27f-6: cổng nền tảng bật chợ, phụ huynh đăng ký và tạo hồ sơ con có đồng ý; chợ cách ly với các trường', async ({
  browser,
}) => {
  // Chợ tắt: tên miền của chợ và tên miền của trường đều 404
  expect(await hostCall(E2E_MARKET_HOST, 'GET', '/market/public/site')).toBe(404);
  expect(await hostCall(schoolHost('alpha'), 'GET', '/market/public/site')).toBe(404);

  // Người vận hành bật chợ, đăng văn bản pháp lý
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_TEST_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Chợ gia sư' }).click();
  const page = consolePage.getByRole('region', { name: 'Chợ gia sư' });
  await expect(page).toContainText('Thu tiền thật ở chợ: tắt');
  const settings = page.getByRole('form', { name: 'Cấu hình chợ gia sư' });
  await settings.getByLabel('Bật chợ gia sư').check();
  await settings.getByLabel('Tên miền con dành riêng của chợ').fill(E2E_MARKET_HOST);
  await settings
    .getByLabel('Tên miền cũ của ứng dụng Gia sư, chuyển hướng về chợ (không bắt buộc)')
    .fill(E2E_TUTOR_HOST);
  await settings.getByRole('button', { name: 'Lưu cấu hình chợ' }).click();
  await expect(page.getByRole('status')).toHaveText('Đã lưu cấu hình chợ gia sư');
  const publish = page.getByRole('form', { name: 'Đăng văn bản pháp lý của chợ' });
  for (const [kind, title] of [
    ['Điều khoản sử dụng', `Điều khoản giả ${suffix}`],
    ['Chính sách dữ liệu cá nhân', `Chính sách giả ${suffix}`],
    ['Đồng ý của cha mẹ cho hồ sơ con', `Đồng ý của cha mẹ giả ${suffix}`],
    ['Điều khoản dành cho gia sư', `Điều khoản gia sư giả ${suffix}`],
  ] as const) {
    await publish.getByLabel('Loại văn bản').selectOption({ label: kind });
    await publish.getByLabel('Tiêu đề').fill(title);
    await publish.getByLabel('Nội dung').fill(`Nội dung giả của ${title}`);
    await publish.getByRole('button', { name: 'Đăng phiên bản mới' }).click();
    await expect(page.getByRole('table', { name: 'Văn bản pháp lý đã đăng' })).toContainText(title);
  }
  await consoleContext.close();

  // Chợ chỉ phục vụ ở tên miền dành riêng, không ở tên miền của trường
  expect(await hostCall(E2E_MARKET_HOST, 'GET', '/market/public/site')).toBe(200);
  expect(await hostCall(schoolHost('alpha'), 'GET', '/market/public/site')).toBe(404);

  // Phụ huynh đăng ký ở ứng dụng chợ
  const marketContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  const market = await marketContext.newPage();
  await market.goto('/');
  await expect(market.getByText('thanh toán là giả lập')).toBeVisible();
  await market.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  const register = market.getByRole('form', { name: 'Đăng ký tài khoản chợ gia sư' });
  await register.getByLabel('Thư điện tử hoặc số điện thoại').fill(parentEmail);
  await register.getByLabel('Tên hiển thị').fill('Phụ huynh giả');
  await register.getByLabel('Mật khẩu (ít nhất 8 ký tự, có chữ và số)').fill('matkhau123');
  await register.getByLabel(`Tôi đồng ý Điều khoản giả ${suffix}`).check();
  await register.getByLabel(`Tôi đồng ý Chính sách giả ${suffix}`).check();
  await register.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(market.getByRole('form', { name: 'Xác nhận tài khoản' })).toBeVisible();

  await setKnownCode(parentEmail);
  const verify = market.getByRole('form', { name: 'Xác nhận tài khoản' });
  await verify.getByLabel('Mã xác nhận').fill(CODE);
  await verify.getByRole('button', { name: 'Xác nhận' }).click();

  // Hồ sơ con tối thiểu, có đồng ý của cha mẹ; rút đồng ý
  const add = market.getByRole('form', { name: 'Thêm hồ sơ con' });
  await add.getByLabel('Tên hiển thị của con').fill('Bé Na');
  await add.getByLabel('Năm sinh').fill(String(new Date().getFullYear() - 12));
  await add.getByLabel('Cấp học').selectOption({ label: 'Trung học cơ sở' });
  await add.getByLabel('Lớp').selectOption({ label: 'Lớp 7' });
  await add
    .getByLabel(`Tôi là cha mẹ hoặc người giám hộ và đồng ý Đồng ý của cha mẹ giả ${suffix} (phiên bản 1)`)
    .check();
  await add.getByRole('button', { name: 'Thêm hồ sơ con' }).click();
  const child = market.getByRole('listitem', { name: 'Hồ sơ Bé Na' });
  await expect(child).toContainText('Đã đồng ý cho hồ sơ con');
  await child.getByRole('button', { name: 'Rút đồng ý cho Bé Na' }).click();
  await expect(child).toContainText('Chưa đồng ý (con chưa học được ở chợ)');
  // Ứng dụng chung (YCTD-368): phụ huynh chỉ thấy bộ màn của phụ huynh
  const parentNavigation = market.getByRole('navigation', { name: 'Điều hướng khu phụ huynh' });
  await expect(parentNavigation.getByRole('button', { name: 'Buổi học của con' })).toBeVisible();
  await expect(market.getByRole('button', { name: 'Hồ sơ và môn dạy' })).toHaveCount(0);

  // Phiên chợ không dùng được ở trường, mã phiên của trường không dùng được ở chợ
  const session = (await market.evaluate("window.sessionStorage.getItem('cho-gia-su-phien')")) as string | null;
  expect(session).toBeTruthy();
  expect(await hostCall(schoolHost('alpha'), 'GET', '/parent-org-consents', session ?? '')).toBe(401);
  expect(await hostCall(E2E_MARKET_HOST, 'GET', '/market/me', schoolToken)).toBe(401);
  expect(await hostCall(E2E_MARKET_HOST, 'GET', '/market/me', session ?? '')).toBe(200);
  await marketContext.close();

  // Ứng dụng chung (YCTD-368, CT-368-2): tên miền cũ của ứng dụng Gia sư chuyển hướng về chợ, giữ đường dẫn và truy vấn; máy chủ API
  // không phục vụ tên miền cũ. Gia sư đăng ký ở chợ, chọn loại tài khoản gia sư, rồi thấy bộ màn của gia sư
  expect(await hostCall(E2E_TUTOR_HOST, 'GET', '/market/me', session ?? '')).toBe(404);
  const tutorContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  const tutor = await tutorContext.newPage();
  await tutor.goto(`http://${E2E_TUTOR_HOST}:${E2E_MULTI_TUTOR_PORT}/?moi=phong-hoc`);
  await expect(tutor).toHaveURL(`http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}/?moi=phong-hoc`);
  await expect(tutor.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
  await tutor.getByRole('button', { name: 'Đăng ký làm gia sư' }).click();
  const tutorRegister = tutor.getByRole('form', { name: 'Đăng ký tài khoản chợ gia sư' });
  await expect(tutorRegister.getByLabel('Gia sư, kể cả giáo viên dạy kèm ngoài trường')).toBeChecked();
  await tutorRegister.getByLabel('Thư điện tử hoặc số điện thoại').fill(tutorEmail);
  await tutorRegister.getByLabel('Tên hiển thị').fill('Gia sư giả');
  await tutorRegister.getByLabel('Mật khẩu (ít nhất 8 ký tự, có chữ và số)').fill('matkhau123');
  await tutorRegister.getByLabel(`Tôi đồng ý Điều khoản giả ${suffix}`).check();
  await tutorRegister.getByLabel(`Tôi đồng ý Chính sách giả ${suffix}`).check();
  await tutorRegister.getByLabel(`Tôi đồng ý Điều khoản gia sư giả ${suffix}`).check();
  await tutorRegister.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(tutor.getByRole('form', { name: 'Xác nhận tài khoản' })).toBeVisible();
  await setKnownCode(tutorEmail);
  const tutorVerify = tutor.getByRole('form', { name: 'Xác nhận tài khoản' });
  await tutorVerify.getByLabel('Mã xác nhận').fill(CODE);
  await tutorVerify.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(tutor.getByRole('navigation', { name: 'Điều hướng khu phụ huynh' })).toHaveCount(0);
  await tutor
    .getByRole('navigation', { name: 'Điều hướng khu gia sư' })
    .getByRole('button', { name: 'Hồ sơ và môn dạy' })
    .click();
  const tutorProfile = tutor.getByRole('region', { name: 'Hồ sơ gia sư' });
  await tutorProfile.getByLabel('Dòng giới thiệu').fill('Dạy Toán THCS');
  await tutorProfile.getByRole('button', { name: 'Lưu giới thiệu' }).click();
  await expect(tutorProfile.getByText('Đã lưu giới thiệu')).toBeVisible();
  await tutorContext.close();

  // Vai trò cơ sở dữ liệu của chợ không vào được cơ sở dữ liệu của trường
  const tenant = await runtime.registry.resolveHost(schoolHost('alpha'));
  const schoolUrl = new URL(runtime.registry.connectionString(tenant!, 'system', 'system'));
  const marketUrl = new URL(marketplaceUrl);
  schoolUrl.username = marketUrl.username;
  schoolUrl.password = marketUrl.password;
  expect(await canConnect(schoolUrl.toString())).toBe(false);
});
