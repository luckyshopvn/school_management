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

// DT-27 phần 27i (YCTD-259, spec 198): phụ huynh nhắn tin cho gia sư (số điện thoại bị che, có cảnh báo), đặt buổi có đồng ý ghi hình,
// trả tiền giả lập, báo cáo mức nghiêm trọng; gia sư bị tạm khóa ngay; gia sư thấy tạm khóa ở ứng dụng Gia sư; nhân viên nền tảng thấy
// chỉ số, chữ gốc của tin nhắn, ghi quyết định tạm khóa có lý do thì buổi mới được hoàn đủ (YCTD-322). Gia sư đã duyệt dựng thẳng trong
// cơ sở dữ liệu chợ. Chỉ chạy ở dự án nhiều trường. Dữ liệu giả, không có tiền thật
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);
const operatorLogin = `kiem-duyet-${suffix}`;
const parentEmail = `phu-huynh-an-toan-${suffix}@example.test`;
const tutorEmail = `gia-su-an-toan-${suffix}@example.test`;
const tutorName = `Gia sư Hòa ${suffix}`;
const subjectName = `Vẽ ${suffix}`;
const CODE = '531902';

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
    fullName: 'Nhân viên kiểm duyệt giả',
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
    .values(
      (['identity', 'criminal_record'] as const).map((kind) => ({
        account_id: tutor.id,
        kind,
        status: 'approved' as const,
        details: '{}',
        document_id: null,
        decided_at: new Date(),
        decided_by: 'e2e',
        note: null,
        valid_until: kind === 'criminal_record' ? `${new Date().getFullYear() + 1}-12-31` : null,
      })),
    )
    .execute();
});

test.afterAll(async () => {
  await runtime?.platform.deleteFrom('platform_settings').where('key', '=', 'market').execute();
  await marketplace?.destroy();
  await runtime?.close();
});

test('CT-27i-6: tin nhắn bị che, báo cáo nghiêm trọng tạm khóa gia sư, nền tảng xem bằng chứng và quyết định', async ({
  browser,
}) => {
  // Phụ huynh đăng ký, tạo hồ sơ con
  const marketContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  const market = await marketContext.newPage();
  await market.goto('/');
  await market.getByRole('button', { name: 'Đăng ký' }).click();
  const register = market.getByRole('form', { name: 'Đăng ký tài khoản chợ gia sư' });
  await register.getByLabel('Thư điện tử hoặc số điện thoại').fill(parentEmail);
  await register.getByLabel('Tên hiển thị').fill('Phụ huynh an toàn');
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
  await add.getByLabel('Tên hiển thị của con').fill('Bé An');
  await add.getByLabel('Năm sinh').fill(String(new Date().getFullYear() - 12));
  await add.getByLabel('Cấp học').selectOption({ label: 'Trung học cơ sở' });
  await add.getByLabel('Lớp').selectOption({ label: 'Lớp 7' });
  await add.getByLabel(new RegExp(`đồng ý Văn bản parent_consent ${suffix} \\(phiên bản \\d+\\)`)).check();
  await add.getByRole('button', { name: 'Thêm hồ sơ con' }).click();
  await expect(market.getByRole('listitem', { name: 'Hồ sơ Bé An' })).toContainText('Đã đồng ý cho hồ sơ con');
  await expect(market.getByRole('region', { name: 'Chính sách an toàn trẻ em' }).first()).toContainText('111');

  // Mở trang gia sư: nhắn tin có số điện thoại thì bị che và có cảnh báo
  const search = market.getByRole('form', { name: 'Lọc gia sư' });
  await search.getByLabel('Môn').fill(subjectName);
  await search.getByRole('button', { name: 'Tìm' }).click();
  await market
    .getByRole('listitem', { name: `Gia sư ${tutorName}` })
    .getByRole('button', { name: `Xem gia sư ${tutorName}` })
    .click();
  await market.getByRole('button', { name: 'Nhắn tin cho gia sư' }).click();
  const thread = market.getByRole('region', { name: `Tin nhắn với ${tutorName}` });
  await thread.getByLabel('Nội dung').fill('Thầy gọi em số 0912 345 678 nhé');
  await thread.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(thread).toContainText('đã bị che');
  await expect(thread.getByRole('list', { name: 'Các tin nhắn' })).not.toContainText('0912');

  // Đặt buổi (đồng ý ghi hình), trả tiền giả lập
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + 3 * 24 * 3_600_000),
  );
  const booking = market.getByRole('form', { name: `Đặt buổi với ${tutorName}` });
  await booking.getByLabel('Giờ học (giờ Việt Nam)').fill(`${day}T19:00`);
  await booking.getByRole('button', { name: 'Giữ chỗ buổi học' }).click();
  await expect(booking).toContainText('đồng ý ghi hình');
  await booking.getByLabel(/Tôi đồng ý buổi học được ghi hình/).check();
  await booking.getByRole('button', { name: 'Giữ chỗ buổi học' }).click();
  await expect(booking).toContainText('Đã giữ chỗ buổi');
  await market.getByRole('button', { name: 'Quay lại danh sách' }).click();
  const lessons = market.getByRole('region', { name: 'Buổi học của con' });
  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  const lesson = lessons.getByRole('listitem').filter({ hasText: subjectName });
  await lesson.getByRole('button', { name: 'Thanh toán giả lập' }).click();
  await expect(lesson).toContainText('Đã trả tiền');
  await expect(lesson).toContainText('Buổi học được ghi hình để bảo vệ trẻ');

  // Báo cáo mức nghiêm trọng của phụ huynh đã trả tiền: gia sư bị tạm khóa ngay; buổi chờ nhân viên xác nhận mới hủy
  await lesson.getByRole('button', { name: 'Báo cáo vi phạm' }).click();
  const report = lesson.getByRole('form', { name: `Báo cáo vi phạm ${tutorName}` });
  await expect(report).toContainText('111');
  await report.getByLabel('Loại vi phạm').selectOption({ label: 'An toàn trẻ em' });
  await report.getByLabel('Mức độ').selectOption({ label: 'Nghiêm trọng (xử lý trong 4 giờ)' });
  await report.getByLabel('Mô tả sự việc').fill('Gia sư rủ con gặp riêng ngoài giờ');
  await report.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(report).toContainText('Gia sư đã bị tạm khóa');
  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  await expect(lesson).toContainText('Đã trả tiền');

  // Gia sư thấy tài khoản đang tạm khóa
  const tutorContext = await browser.newContext({ baseURL: `http://${E2E_TUTOR_HOST}:${E2E_MULTI_TUTOR_PORT}` });
  await tutorContext.addInitScript({
    content: `window.sessionStorage.setItem('cho-gia-su-phien', ${JSON.stringify(tutorToken)});`,
  });
  const tutor = await tutorContext.newPage();
  await tutor.goto('/');
  await expect(tutor.getByRole('region', { name: 'Kiểm duyệt và an toàn' })).toContainText('Tài khoản đang tạm khóa');
  await tutorContext.close();

  // Nhân viên nền tảng: chỉ số, bằng chứng (chữ gốc), quyết định có lý do
  const consoleContext = await browser.newContext({ baseURL: `http://${E2E_CONSOLE_HOST}:${E2E_MULTI_CONSOLE_PORT}` });
  const consolePage = await consoleContext.newPage();
  await consolePage.goto('/');
  await signInConsole(consolePage, operatorLogin, OPERATOR_TEST_PASSWORD, () =>
    operatorOtp(runtime.platform, operator.id, operator.secret),
  );
  await consolePage.getByRole('navigation', { name: 'Menu' }).getByRole('button', { name: 'Chợ gia sư' }).click();
  const safety = consolePage.getByRole('region', { name: 'Kiểm duyệt và an toàn trẻ em của chợ' });
  await expect(safety.getByRole('list', { name: 'Gia sư đang tạm khóa' })).toContainText(tutorName);
  await safety.getByRole('button', { name: `Xem báo cáo về ${tutorName}` }).click();
  const review = safety.getByRole('region', { name: `Báo cáo về ${tutorName}` });
  await expect(review).toContainText('Gia sư rủ con gặp riêng ngoài giờ');
  await expect(review.getByRole('list', { name: 'Bằng chứng tin nhắn' })).toContainText('0912 345 678');
  const decision = review.getByRole('form', { name: 'Quyết định báo cáo' });
  await decision.getByLabel('Quyết định', { exact: true }).selectOption({ label: 'Tạm khóa' });
  await decision.getByLabel('Lý do quyết định').fill('Vi phạm an toàn trẻ em, giữ tạm khóa');
  await decision.getByRole('button', { name: 'Ghi quyết định' }).click();
  await expect(review).toContainText('đã quyết định');
  await expect(review.getByRole('list', { name: 'Nhật ký kiểm duyệt' })).toContainText('report.decide');
  await consoleContext.close();
  // Nhân viên quyết định tạm khóa: buổi sắp tới được hủy, hoàn đủ
  await lessons.getByRole('button', { name: 'Tải lại' }).click();
  await expect(lesson).toContainText('Đã hoàn tiền');
  await marketContext.close();
});
