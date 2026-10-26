import { expect, test, type Browser, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import {
  E2E_PARENT_PORT,
  E2E_SCHOOL_YEAR_DATABASE_PREFIX,
  E2E_SYSTEM_DATABASE_NAME,
  E2E_TEACHER_PORT,
} from '../e2e-environment.mjs';

// Vỏ ứng dụng web cài được dùng chung (DT-26 phần 26a, YCTD-231), kịch bản CT-26a-01: ứng dụng phụ huynh đăng ký service worker
// chung, bộ nhớ đệm chỉ giữ vỏ ứng dụng (không có lời gọi /api); manifest và biểu tượng sinh theo thương hiệu của trường (tên,
// tên ngắn, màu); ứng dụng giáo viên trỏ manifest sang bản của trường; mời cài lên màn hình chính: iPhone hướng dẫn "Thêm vào MH
// chính", mở trong Zalo hướng dẫn mở bằng trình duyệt, "Để sau" không mời lại. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const systemUrl = readConnectionString('system');
const system = createDatabase<SystemDatabase>(replaceDatabaseName(systemUrl, E2E_SYSTEM_DATABASE_NAME));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PARENT_URL = `http://localhost:${E2E_PARENT_PORT}`;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_ZALO =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 Zalo android/12100';

// Mã chạy trong trang dùng kiểu của trình duyệt, gói kiểm thử không nạp thư viện kiểu DOM (ép kiểu ngay trong hàm)
type BrowserGlobals = {
  navigator: { serviceWorker: { ready: Promise<{ scope: string }> } };
  caches: {
    keys(): Promise<string[]>;
    open(name: string): Promise<{ keys(): Promise<Array<{ url: string }>> }>;
  };
  document: { querySelector(selector: string): { getAttribute(name: string): string | null } | null };
};

test.beforeAll(async () => {
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
  await identity.destroy();
});

async function signInTeacher(browser: Browser, userAgent?: string): Promise<Page> {
  const reference = await schoolYear.selectFrom('org_units').select('id').executeTakeFirstOrThrow();
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: reference.id }] });
  const page = await (await browser.newContext(userAgent ? { userAgent } : {})).newPage();
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page;
}

test('CT-26a-01: service worker chung, manifest theo thương hiệu trường, mời cài lên màn hình chính', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const previous = await system.selectFrom('school_branding').selectAll().where('id', '=', 1).executeTakeFirst();
  const suffix = Date.now() % 100_000;
  const shortName = `Thu${suffix}`.slice(0, 9);
  await system
    .insertInto('school_branding')
    .values({ id: 1, display_name: `Trường thử PWA ${suffix}`, primary_color: '#127A3E', app_short_name: shortName })
    .onConflict((conflict) =>
      conflict
        .column('id')
        .doUpdateSet({ display_name: `Trường thử PWA ${suffix}`, primary_color: '#127A3E', app_short_name: shortName }),
    )
    .execute();
  try {
    // Ứng dụng phụ huynh: service worker chung đăng ký ngay cả khi chưa đăng nhập, bộ nhớ đệm có tiền tố riêng của ứng dụng
    const parent = await (await browser.newContext()).newPage();
    await parent.goto(PARENT_URL);
    const scope = await parent.evaluate(async () => {
      const ready = await (globalThis as unknown as BrowserGlobals).navigator.serviceWorker.ready;
      return ready.scope;
    });
    expect(scope).toBe(`${PARENT_URL}/`);
    await expect
      .poll(
        async () =>
          await parent.evaluate(async () =>
            (await (globalThis as unknown as BrowserGlobals).caches.keys()).filter((name) =>
              name.startsWith('phu-huynh-v-'),
            ),
          ),
        { timeout: 15_000 },
      )
      .toHaveLength(1);
    await parent.reload();
    // Bộ nhớ đệm chỉ có vỏ ứng dụng, không có phản hồi /api
    const cachedUrls = await parent.evaluate(async () => {
      const globals = globalThis as unknown as BrowserGlobals;
      const urls: string[] = [];
      for (const name of await globals.caches.keys()) {
        for (const request of await (await globals.caches.open(name)).keys()) {
          urls.push(request.url);
        }
      }
      return urls;
    });
    expect(cachedUrls.length).toBeGreaterThan(0);
    expect(cachedUrls.filter((url) => url.includes('/api/'))).toEqual([]);

    // Manifest của trường thay manifest tĩnh
    await expect
      .poll(() =>
        parent.evaluate(
          () =>
            (globalThis as unknown as BrowserGlobals).document
              .querySelector('link[rel="manifest"]')
              ?.getAttribute('href') ?? '',
        ),
      )
      .toContain('/api/v1/public/pwa/parent.webmanifest');
    const manifest = await parent.request.get(`${PARENT_URL}/api/v1/public/pwa/parent.webmanifest?base=%2F`);
    expect(manifest.ok()).toBe(true);
    expect(manifest.headers()['content-type']).toContain('application/manifest+json');
    const parentManifest = await manifest.json();
    expect(parentManifest.name).toBe(`Trường thử PWA ${suffix} – Phụ huynh`);
    expect(parentManifest.short_name).toBe(`${shortName} PH`);
    expect(parentManifest.theme_color).toBe('#127A3E');
    expect(parentManifest.display).toBe('standalone');
    expect(parentManifest.start_url).toBe('/');
    const icon = await parent.request.get(`${PARENT_URL}${parentManifest.icons[0].src}`);
    expect(icon.headers()['content-type']).toContain('image/svg+xml');
    expect(await icon.text()).toContain('#127A3E');
    await parent.context().close();

    // Ứng dụng giáo viên: manifest của trường, service worker chung ở /sw.js với tiền tố của công cụ lớp học (23b)
    const serviceWorker = await (await browser.newContext()).request.get(`${TEACHER_URL}/sw.js`);
    expect(await serviceWorker.text()).toContain("const CACHE_PREFIX = 'cong-cu-lop-hoc-v-'");

    // iPhone mở bằng Safari: hướng dẫn thêm vào màn hình chính; "Để sau" thì không mời lại
    const iphone = await signInTeacher(browser, IPHONE_SAFARI);
    await expect
      .poll(() =>
        iphone.evaluate(
          () =>
            (globalThis as unknown as BrowserGlobals).document
              .querySelector('meta[name="apple-mobile-web-app-title"]')
              ?.getAttribute('content') ?? '',
        ),
      )
      .toBe(`${shortName} GV`);
    const invitation = iphone.getByRole('region', { name: 'Cài ứng dụng lên màn hình chính' });
    await expect(invitation).toContainText('Thêm vào MH chính');
    await invitation.getByRole('button', { name: 'Để sau' }).click();
    await expect(invitation).toBeHidden();
    await iphone.reload();
    await expect(iphone.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await expect(iphone.getByRole('region', { name: 'Cài ứng dụng lên màn hình chính' })).toBeHidden();
    await iphone.context().close();

    // Mở trong Zalo: không cài được, hướng dẫn mở bằng trình duyệt
    const zalo = await signInTeacher(browser, ANDROID_ZALO);
    await expect(zalo.getByRole('region', { name: 'Cài ứng dụng lên màn hình chính' })).toContainText(
      'Mở bằng trình duyệt',
    );
    await zalo.context().close();
  } finally {
    if (previous) {
      await system
        .updateTable('school_branding')
        .set({
          display_name: previous.display_name,
          primary_color: previous.primary_color,
          app_short_name: previous.app_short_name,
        })
        .where('id', '=', 1)
        .execute();
    } else {
      await system.deleteFrom('school_branding').where('id', '=', 1).execute();
    }
  }
});
