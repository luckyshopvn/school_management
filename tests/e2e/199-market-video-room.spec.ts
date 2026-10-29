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
  E2E_MULTI_IDENTITY_PORT,
  E2E_MULTI_MARKET_PORT,
  E2E_MULTI_STATE_FILE,
  E2E_MULTI_TUTOR_PORT,
  E2E_TUTOR_HOST,
} from '../e2e-multi-environment.mjs';
import { expect, test } from './fixtures.js';

// DT-27 phần 27j (YCTD-362, spec 199): phòng học video của chợ gia sư với bộ giả lập lớp video. Phụ huynh vào phòng chờ trước khi gia sư
// mở phòng; gia sư mở phòng dạy, thấy học sinh trong phòng chờ, cho vào; phụ huynh thấy lớp video; gia sư kết thúc phòng; hai phía thấy
// điểm danh tự động. Học sinh đủ 18 tuổi nên buổi không bắt buộc ghi hình (đồng ý ghi hình theo gia sư và ghi hình bắt buộc có kiểm thử
// máy chủ CT-27i-5, CT-27j-2). Gia sư, hồ sơ con, buổi đã trả tiền dựng qua API và cơ sở dữ liệu chợ. Dữ liệu giả, không có tiền thật
const IDENTITY = `http://127.0.0.1:${E2E_MULTI_IDENTITY_PORT}`;
const API = `http://127.0.0.1:${E2E_MULTI_API_PORT}`;
const suffix = Math.random().toString(36).slice(2, 8);
const operatorLogin = `phong-hoc-${suffix}`;
const parentEmail = `phu-huynh-phong-${suffix}@example.test`;
const tutorEmail = `gia-su-phong-${suffix}@example.test`;
const tutorName = `Gia sư Lan ${suffix}`;
const childName = `Bé Khoa ${suffix}`;
const subjectName = `Đàn ${suffix}`;
const CODE = '640213';

let runtime: TenancyRuntime;
let marketplace: ReturnType<typeof createDatabase<MarketplaceDatabase>>;
let tutorToken = '';
let parentToken = '';
let bookingId = '';

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

async function register(host: string, kind: 'parent' | 'tutor', email: string, name: string, documents: string[]) {
  const registered = await hostCall(host, 'POST', '/auth/register', undefined, {
    kind,
    email,
    display_name: name,
    password: 'matkhau123',
    accepted_document_ids: documents,
  });
  expect(registered.status).toBe(201);
  const token = registered.body.session_token as string;
  await setKnownCode(email);
  expect((await hostCall(host, 'POST', '/auth/verify', token, { code: CODE })).status).toBe(200);
  return token;
}

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  const state = JSON.parse(readFileSync(E2E_MULTI_STATE_FILE, 'utf8')) as { marketplaceUrl: string };
  marketplace = createDatabase<MarketplaceDatabase>(state.marketplaceUrl, { max: 1 });
  const operator = await createPlatformOperatorWithTotp(runtime.platform, configuration.masterKey, {
    login: operatorLogin,
    fullName: 'Nhân viên vận hành giả',
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
  const operatorToken = ((await response.json()) as { access_token: string }).access_token;
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

  // Gia sư đã duyệt dựng thẳng trong cơ sở dữ liệu chợ
  tutorToken = await register(E2E_TUTOR_HOST, 'tutor', tutorEmail, tutorName, [
    documents.terms ?? '',
    documents.privacy ?? '',
    documents.tutor_terms ?? '',
  ]);
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
  const subject = await marketplace
    .insertInto('market_tutor_subjects')
    .values({
      account_id: tutor.id,
      subject: subjectName,
      school_level: 'THPT',
      grade_from: 10,
      grade_to: 12,
      content_kind: 'enrichment',
      price_per_session: 150_000,
      session_minutes: 60,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
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

  // Phụ huynh, hồ sơ con đủ 18 tuổi, buổi đã trả tiền giả lập rồi dời giờ học về 2 phút trước
  parentToken = await register(E2E_MARKET_HOST, 'parent', parentEmail, 'Phụ huynh phòng học', [
    documents.terms ?? '',
    documents.privacy ?? '',
  ]);
  const child = await hostCall(E2E_MARKET_HOST, 'POST', '/children', parentToken, {
    display_name: childName,
    birth_year: new Date().getFullYear() - 19,
    school_level: 'THPT',
    grade: 12,
    consent_document_id: documents.parent_consent,
  });
  expect(child.status).toBe(201);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + 3 * 24 * 3_600_000),
  );
  const booking = await hostCall(E2E_MARKET_HOST, 'POST', '/bookings', parentToken, {
    tutor_id: tutor.id,
    child_id: child.body.id,
    subject_id: subject.id,
    starts_at: new Date(`${day}T18:00:00+07:00`).toISOString(),
    no_assignment_attested: false,
    recording_consented: false,
  });
  expect(booking.status, JSON.stringify(booking.body)).toBe(201);
  bookingId = booking.body.id as string;
  expect((await hostCall(E2E_MARKET_HOST, 'POST', `/bookings/${bookingId}/mock-pay`, parentToken, {})).status).toBe(
    200,
  );
  await marketplace
    .updateTable('market_bookings')
    .set({ starts_at: new Date(Date.now() - 2 * 60_000) })
    .where('id', '=', bookingId)
    .execute();
});

test.afterAll(async () => {
  await runtime?.platform.deleteFrom('platform_settings').where('key', '=', 'market').execute();
  await marketplace?.destroy();
  await runtime?.close();
});

test('CT-27j-3: phòng chờ, gia sư cho vào, lớp video giả lập, kết thúc buổi có điểm danh hai phía', async ({
  browser,
}) => {
  const marketContext = await browser.newContext({ baseURL: `http://${E2E_MARKET_HOST}:${E2E_MULTI_MARKET_PORT}` });
  await marketContext.addInitScript({
    content: `window.sessionStorage.setItem('cho-gia-su-phien', ${JSON.stringify(parentToken)});`,
  });
  const market = await marketContext.newPage();
  await market.goto('/#buoi-hoc');
  const lesson = market
    .getByRole('region', { name: 'Buổi học của con' })
    .getByRole('listitem')
    .filter({ hasText: subjectName });
  await lesson.getByRole('button', { name: 'Vào phòng học' }).click();
  const parentRoom = market.getByRole('region', { name: 'Phòng học' });
  await expect(parentRoom.getByRole('list', { name: 'Điều kiện vào phòng' })).toContainText('Buổi đã trả tiền');
  await parentRoom.getByRole('button', { name: 'Vào phòng chờ' }).click();
  await expect(parentRoom).toContainText('Gia sư chưa mở phòng');

  // Gia sư mở phòng dạy, cho học sinh vào
  const tutorContext = await browser.newContext({ baseURL: `http://${E2E_TUTOR_HOST}:${E2E_MULTI_TUTOR_PORT}` });
  await tutorContext.addInitScript({
    content: `window.sessionStorage.setItem('cho-gia-su-phien', ${JSON.stringify(tutorToken)});`,
  });
  const tutor = await tutorContext.newPage();
  await tutor.goto('/#buoi-day');
  await tutor
    .getByRole('region', { name: 'Buổi dạy', exact: true })
    .getByRole('listitem')
    .filter({ hasText: subjectName })
    .getByRole('button', { name: 'Mở phòng học' })
    .click();
  const teaching = tutor.getByRole('region', { name: 'Phòng dạy' });
  await teaching.getByRole('button', { name: 'Mở phòng dạy' }).click();
  const host = teaching.getByRole('region', { name: 'Điều khiển phòng' });
  await expect(host).toContainText('đang chờ', { timeout: 15_000 });
  await host.getByRole('button', { name: `Cho ${childName} vào` }).click();

  // Phụ huynh (con học trên máy này) thấy lớp video giả lập
  await expect(parentRoom.getByText('Phòng giả lập')).toBeVisible({ timeout: 15_000 });

  // Gia sư kết thúc phòng: điểm danh tự động ở hai phía
  await host.getByRole('button', { name: 'Kết thúc phòng' }).click();
  await expect(teaching.getByRole('table', { name: 'Điểm danh tự động' })).toContainText(childName);
  await parentRoom.getByRole('button', { name: 'Rời phòng' }).first().click();
  await expect(parentRoom).toContainText('Buổi học đã kết thúc');
  await expect(parentRoom.getByRole('table', { name: 'Điểm danh tự động' })).toContainText(tutorName);
  await tutorContext.close();
  await marketContext.close();
});
