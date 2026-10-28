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
  OPERATOR_TEST_PASSWORD,
  operatorOtp,
} from '@school-management/identity/testing';
import {
  E2E_CONSOLE_HOST,
  E2E_MARKET_HOST,
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

// DT-27 phần 27h (YCTD-258, spec 197): phụ huynh ở Chợ gia sư đặt buổi với gia sư đã duyệt, thanh toán giả lập; gia sư đánh dấu đã dạy ở
// ứng dụng Gia sư; phụ huynh mở tranh chấp; nhân viên nền tảng quyết định hoàn đủ ở cổng nền tảng, chốt; phụ huynh thấy đã hoàn tiền. Gia
// sư đã duyệt dựng thẳng trong cơ sở dữ liệu chợ (luồng duyệt ở spec 196). Chỉ chạy ở dự án nhiều trường. Không có tiền thật
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);
const operatorLogin = `van-hanh-dat-buoi-${suffix}`;
const parentEmail = `phu-huynh-dat-${suffix}@example.test`;
const tutorEmail = `gia-su-dat-${suffix}@example.test`;
const tutorName = `Gia sư Lan ${suffix}`;
const subjectName = `Cờ tướng ${suffix}`;
const CODE = '864201';

let runtime: TenancyRuntime;
let marketplace: ReturnType<typeof createDatabase<MarketplaceDatabase>>;
let operator: Awaited<ReturnType<typeof createPlatformOperatorWithTotp>>;
let operatorToken = '';
let tutorToken = '';

async function hostCall(host: string, method: string, path: string, token?: string, data?: unknown) {
  const context = await playwrightRequest.newContext({ extraHTTPHeaders: { Host: host } });
  try {
    const response = await context.fetch(`${API}/api/v1/market${path}`, {
      method,
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  } finally {
    await context.dispose();
  }
}

// Mã xác nhận gửi vào hộp thư giả lập trong bộ nhớ máy chủ: đặt mã đã biết vào bản ghi mã mới nhất (cơ sở dữ liệu chỉ giữ băm)
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
  const state = JSON.parse(readFileSync(E2E_MULTI_STATE_FILE, 'utf8')) as { marketplaceUrl: string };
  marketplace = createDatabase<MarketplaceDatabase>(state.marketplaceUrl, { max: 1 });
  operator = await createPlatformOperatorWithTotp(runtime.platform, configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Nhân viên thanh toán giả',
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
  operatorToken = ((await response.json()) as { access_token: string }).access_token;
  await context.dispose();
  const admin = (method: string, path: string, data?: unknown) =>
    hostCall(E2E_CONSOLE_HOST, method, `/admin${path}`, operatorToken, data);
  expect(
    (await admin('PUT', '/settings', { enabled: true, host: E2E_MARKET_HOST, tutor_host: E2E_TUTOR_HOST })).status,
  ).toBe(200);
  const documents: Record<string, string> = {};
  for (const kind of ['terms', 'privacy', 'parent_consent', 'tutor_terms']) {
    const published = await admin('POST', '/documents', {
      kind,
      title: `Văn bản ${kind} ${suffix}`,
      body: 'Nội dung giả',
    });
    documents[kind] = published.body.id as string;
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  expect(
    (await admin('POST', '/payments/commission-rules', { percent: 10, minimum: 0, effective_from: today })).status,
  ).toBe(200);

  // Gia sư: đăng ký qua ứng dụng Gia sư, rồi dựng hồ sơ đã duyệt thẳng trong cơ sở dữ liệu chợ
  const registered = await hostCall(E2E_TUTOR_HOST, 'POST', '/auth/register', undefined, {
    kind: 'tutor',
    email: tutorEmail,
    display_name: tutorName,
    password: 'matkhau123',
    accepted_document_ids: [documents.terms, documents.privacy, documents.tutor_terms],
  });
  expect(registered.status).toBe(201);
  tutorToken = registered.body.session_token as string;
  await setKnownCode(tutorEmail);
  expect((await hostCall(E2E_TUTOR_HOST, 'POST', '/auth/verify', tutorToken, { code: CODE })).status).toBe(200);
  const tutor = await marketplace
    .selectFrom('market_accounts')
    .select('id')
    .where('email', '=', tutorEmail)
    .executeTakeFirstOrThrow();
  await marketplace
    .updateTable('market_tutor_profiles')
    .set({ status: 'approved', published_at: new Date() })
    .where('account_id', '=', tutor.id)
    .execute();
  await marketplace
    .insertInto('market_tutor_subjects')
    .values({
      account_id: tutor.id,
      subject: subjectName,
      school_level: 'THCS',
      grade_from: 6,
      grade_to: 9,
      content_kind: 'enrichment',
      price_per_session: 150_000,
      session_minutes: 60,
    })
    .execute();
  await marketplace
    .insertInto('market_tutor_availability')
    .values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ account_id: tutor.id, weekday, start_minute: 0, end_minute: 1440 })),
    )
    .execute();
  await marketplace
    .insertInto('market_tutor_verifications')
    .values([
      {
        account_id: tutor.id,
        kind: 'identity',
        status: 'approved',
        details: '{}',
        document_id: null,
        decided_at: new Date(),
        decided_by: 'oidc',
        note: null,
        valid_until: null,
      },
      {
        account_id: tutor.id,
        kind: 'criminal_record',
        status: 'approved',
        details: '{}',
        document_id: null,
        decided_at: new Date(),
        decided_by: 'e2e',
        note: null,
        valid_until: `${new Date().getFullYear() + 1}-12-31`,
      },
    ])
    .execute();
});

test.afterAll(async () => {
  await runtime?.platform.deleteFrom('platform_settings').where('key', '=', 'market').execute();
  await marketplace?.destroy();
  await runtime?.close();
});

test('CT-27h-7: đặt buổi, thanh toán giả lập, gia sư đánh dấu đã dạy, phụ huynh khiếu nại, nền tảng hoàn đủ', async ({
  browser,
}) => {
  // Phụ huynh đăng ký, tạo hồ sơ con
  const marketContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  const market = await marketContext.newPage();
  await market.goto('/');
  await market.getByRole('button', { name: 'Đăng ký' }).click();
  const register = market.getByRole('form', { name: 'Đăng ký tài khoản chợ gia sư' });
  await register.getByLabel('Thư điện tử hoặc số điện thoại').fill(parentEmail);
  await register.getByLabel('Tên hiển thị').fill('Phụ huynh đặt buổi');
  await register.getByLabel('Mật khẩu (ít nhất 8 ký tự, có chữ và số)').fill('matkhau123');
  await register.getByLabel(`Tôi đồng ý Văn bản terms ${suffix}`).check();
  await register.getByLabel(`Tôi đồng ý Văn bản privacy ${suffix}`).check();
  await register.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(market.getByRole('form', { name: 'Xác nhận tài khoản' })).toBeVisible();
  await setKnownCode(parentEmail);
  const verify = market.getByRole('form', { name: 'Xác nhận tài khoản' });
  await verify.getByLabel('Mã xác nhận').fill(CODE);
  await verify.getByRole('button', { name: 'Xác nhận' }).click();
  const add = market.getByRole('form', { name: 'Thêm hồ sơ con' });
  await add.getByLabel('Tên hiển thị của con').fill('Bé Minh');
  await add.getByLabel('Năm sinh').fill(String(new Date().getFullYear() - 12));
  await add.getByLabel('Cấp học').selectOption({ label: 'Trung học cơ sở' });
  await add.getByLabel('Lớp').selectOption({ label: 'Lớp 7' });
  // Spec khác có thể đã đăng văn bản đồng ý trước nên không giả định số phiên bản
  await add.getByLabel(new RegExp(`đồng ý Văn bản parent_consent ${suffix} \\(phiên bản \\d+\\)`)).check();
  await add.getByRole('button', { name: 'Thêm hồ sơ con' }).click();
  await expect(market.getByRole('listitem', { name: 'Hồ sơ Bé Minh' })).toContainText('Đã đồng ý cho hồ sơ con');

  // Tìm gia sư, đặt buổi 3 ngày tới lúc 18:00 giờ Việt Nam
  const search = market.getByRole('form', { name: 'Lọc gia sư' });
  await search.getByLabel('Môn').fill(subjectName);
  await search.getByRole('button', { name: 'Tìm' }).click();
  await market
    .getByRole('listitem', { name: `Gia sư ${tutorName}` })
    .getByRole('button', { name: `Xem gia sư ${tutorName}` })
    .click();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + 3 * 24 * 3_600_000),
  );
  const booking = market.getByRole('form', { name: `Đặt buổi với ${tutorName}` });
  await booking.getByLabel('Giờ học (giờ Việt Nam)').fill(`${day}T18:00`);
  await booking.getByRole('button', { name: 'Giữ chỗ buổi học' }).click();
  await expect(booking).toContainText('Đã giữ chỗ buổi');
  await market.getByRole('button', { name: 'Quay lại danh sách' }).click();
  const lessons = market.getByRole('region', { name: 'Buổi học của con' });
  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  const lesson = lessons.getByRole('listitem').filter({ hasText: subjectName });
  await expect(lesson).toContainText('Đang giữ chỗ, chờ trả tiền');
  await lesson.getByRole('button', { name: 'Thanh toán giả lập' }).click();
  await expect(lesson).toContainText('Đã trả tiền');

  // Giả lập buổi đã diễn ra: dời giờ học về 2 giờ trước
  const row = await marketplace
    .selectFrom('market_bookings')
    .select('id')
    .where('subject', '=', subjectName)
    .executeTakeFirstOrThrow();
  await marketplace
    .updateTable('market_bookings')
    .set({ starts_at: new Date(Date.now() - 2 * 3_600_000) })
    .where('id', '=', row.id)
    .execute();

  // Gia sư đánh dấu đã dạy ở ứng dụng Gia sư (phiên đặt sẵn vào bộ nhớ của thẻ)
  const tutorContext = await browser.newContext({ baseURL: `http://${E2E_TUTOR_HOST}:${E2E_MULTI_TUTOR_PORT}` });
  await tutorContext.addInitScript({
    content: `window.sessionStorage.setItem('cho-gia-su-phien', ${JSON.stringify(tutorToken)});`,
  });
  const tutor = await tutorContext.newPage();
  await tutor.goto('/');
  const taught = tutor
    .getByRole('region', { name: 'Buổi dạy và thu nhập' })
    .getByRole('listitem')
    .filter({ hasText: subjectName });
  await taught.getByRole('button', { name: 'Đánh dấu đã dạy' }).click();
  await expect(taught).toContainText('Đã dạy, chờ hết hạn khiếu nại');
  await tutorContext.close();

  // Phụ huynh khiếu nại trong hạn
  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  await lesson.getByLabel('Lý do khiếu nại').fill('Buổi học chỉ 20 phút');
  await lesson.getByRole('button', { name: 'Mở tranh chấp' }).click();
  await expect(lesson).toContainText('Đang tranh chấp');

  // Nhân viên nền tảng quyết định hoàn đủ, chốt
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_TEST_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Chợ gia sư' }).click();
  const payments = consolePage.getByRole('region', { name: 'Buổi học và thanh toán của chợ' });
  await payments.getByRole('button', { name: `Xem tranh chấp ${subjectName}` }).click();
  const dispute = payments.getByRole('region', { name: `Tranh chấp buổi ${subjectName}` });
  await expect(dispute).toContainText('Buổi học chỉ 20 phút');
  const decision = dispute.getByRole('form', { name: 'Quyết định tranh chấp' });
  await decision.getByLabel('Quyết định', { exact: true }).selectOption({ label: 'Hoàn đủ cho phụ huynh' });
  await decision.getByLabel('Lý do quyết định').fill('Buổi học thiếu giờ');
  await decision.getByRole('button', { name: 'Ghi quyết định' }).click();
  await expect(dispute).toContainText('đã quyết định');
  await dispute.getByRole('button', { name: 'Chốt quyết định và chuyển tiền' }).click();
  await expect(dispute).toContainText('đã chốt');
  await consoleContext.close();

  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  await expect(lesson).toContainText('Đã hoàn tiền');
  await expect(lesson).toContainText('đã hoàn 150.000 đồng');
  await marketContext.close();
});
