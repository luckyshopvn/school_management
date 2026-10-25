import {
  issueInvoice,
  loadBillingPlan,
  readTenancyConfiguration,
  TenancyRuntime,
  vietnamDate,
  type IdentityDatabase,
  type TenantContext,
} from '@school-management/database';
import { createTestUser, type TestUser } from '@school-management/identity/testing';
import { E2E_MULTI_PORTAL_PORT, schoolHost } from '../e2e-multi-environment.mjs';
import { expect, test, type Page } from './fixtures.js';

// DT-SaaS phần S5b (YCTD-196, spec 135), kịch bản CT-S5b-11: trường alpha có hóa đơn dịch vụ quá hạn và đang ở chế độ chỉ đọc; quản trị
// trường mở "Hóa đơn dịch vụ", thấy hóa đơn, tạo mã QR qua cổng giả lập của nền tảng, giả lập chuyển tiền; hóa đơn chuyển đã thanh toán
// và trường mở lại (hết dải chỉ đọc). Cuối kịch bản trả lại như cũ. Chỉ chạy ở dự án nhiều trường (pnpm --filter @school-management/tests
// e2e:multi). Dữ liệu giả
let runtime: TenancyRuntime;
let tenant: TenantContext;
let user: TestUser;
let ruleId = '';
let planId = '';
let invoiceCode = '';

test.beforeAll(async () => {
  const configuration = readTenancyConfiguration(process.env);
  if (!configuration) {
    throw new Error('Thiếu cấu hình nền tảng nhiều trường: chạy bằng pnpm --filter @school-management/tests e2e:multi');
  }
  runtime = new TenancyRuntime(configuration);
  const resolved = await runtime.registry.resolveHost(schoolHost('alpha'));
  if (!resolved) {
    throw new Error('Chưa dựng trường alpha');
  }
  tenant = resolved;
  user = await createTestUser(runtime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity'), {
    roles: [{ roleCode: 'VT-02', orgUnitId: null }],
  });
  const platform = runtime.platform;
  const suffix = Date.now() % 1_000_000;
  const rule = await platform
    .insertInto('price_rules')
    .values({
      code: `e2e-${suffix}`,
      name: 'Phí theo trường (e2e)',
      components: JSON.stringify(['per_school']),
      school_fee: 1_500_000,
      period: 'monthly',
      due_days: 10,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  ruleId = rule.id;
  const plan = await platform
    .insertInto('plans')
    .values({ code: `e2e-thu-${suffix}`, name: 'Gói thu phí (e2e)', price_rule_id: ruleId })
    .returning('id')
    .executeTakeFirstOrThrow();
  planId = plan.id;
  await platform
    .insertInto('school_plans')
    .values({ school_id: tenant.schoolId, plan_id: planId, effective_from: '2020-01-01' })
    .execute();
  const now = new Date();
  const billingPlan = await loadBillingPlan(platform, tenant.schoolId, vietnamDate(now));
  if (!billingPlan) {
    throw new Error('Không đọc được gói vừa gán');
  }
  const issued = await issueInvoice(
    platform,
    {
      schoolId: tenant.schoolId,
      range: { start: '2020-01-01', end: '2020-01-31' },
      usage: { activeStudents: 0, storageMb: 0, schoolLevels: 1, modules: null },
      plan: billingPlan,
      kind: 'manual',
      actor: { type: 'cli' },
      now,
      today: '2020-02-01',
    },
    { allModules: [] },
  );
  invoiceCode = issued.code;
  await platform
    .updateTable('schools')
    .set({ status: 'read_only', paid_until: issued.dueOn })
    .where('id', '=', tenant.schoolId)
    .execute();
});

test.afterAll(async () => {
  if (runtime) {
    const platform = runtime.platform;
    await platform.deleteFrom('invoices').where('school_id', '=', tenant.schoolId).execute();
    await platform.deleteFrom('dunning_events').where('school_id', '=', tenant.schoolId).execute();
    await platform.deleteFrom('school_plans').where('plan_id', '=', planId).execute();
    await platform.deleteFrom('plans').where('id', '=', planId).execute();
    await platform.deleteFrom('price_rules').where('id', '=', ruleId).execute();
    await platform
      .updateTable('schools')
      .set({ status: 'active', paid_until: null })
      .where('id', '=', tenant.schoolId)
      .execute();
    await runtime.close();
  }
});

async function signIn(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('CT-S5b-11: quản trị trường xem hóa đơn dịch vụ, trả bằng mã QR của cổng giả lập; trường chỉ đọc được mở lại', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: `http://${schoolHost('alpha')}:${E2E_MULTI_PORTAL_PORT}` });
  const page = await context.newPage();
  await signIn(page);
  await expect(page.getByRole('alert', { name: 'Chế độ chỉ đọc' })).toBeVisible();
  await page.goto('/service-invoices');
  await expect(page.getByRole('heading', { name: 'Hóa đơn dịch vụ' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Hóa đơn dịch vụ' });
  await expect(table.getByRole('row', { name: new RegExp(invoiceCode) })).toContainText('1.500.000 đồng');
  await expect(table.getByRole('row', { name: new RegExp(invoiceCode) })).toContainText('quá hạn');

  await page.getByRole('button', { name: `Thanh toán ${invoiceCode}` }).click();
  const panel = page.getByRole('region', { name: `Thanh toán ${invoiceCode}` });
  await expect(panel.getByRole('img', { name: `Mã QR thanh toán ${invoiceCode}` })).toBeVisible();
  await expect(panel).toContainText(invoiceCode.replace('-', ''));
  await panel.getByRole('button', { name: 'Giả lập đã chuyển tiền' }).click();
  await expect(panel.getByText(`hóa đơn ${invoiceCode} đã thanh toán`)).toBeVisible();
  await expect(table.getByRole('row', { name: new RegExp(invoiceCode) })).toContainText('Đã thanh toán');

  // Ngữ cảnh trường được làm mới sau TENANT_CACHE_SECONDS: tải lại đến khi hết dải chỉ đọc
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hóa đơn dịch vụ' })).toBeVisible();
    await expect(page.getByRole('alert', { name: 'Chế độ chỉ đọc' })).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
  await context.close();
});
