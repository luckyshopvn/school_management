import { randomUUID } from 'node:crypto';
import { expect, test, type Browser } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Tài chính giai đoạn 2 (DT-10 phần 10i, YCTD-82): kế toán gửi nhắc nợ cho hóa đơn quá hạn và lập đề xuất xử lý; Phó Hiệu
// trưởng ghi quyết định trên trang Nhắc nợ và xử lý quá hạn (MH-08); số tiền công nợ không đổi
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('Kế toán nhắc nợ và đề xuất xử lý công nợ quá hạn; Phó Hiệu trưởng ghi quyết định', async ({ browser }) => {
  const reference = await schoolYear.selectFrom('classes').select(['org_unit_id']).executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const accountant = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-04', orgUnitId: reference.org_unit_id }],
  });
  const vicePrincipal = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-15', orgUnitId: reference.org_unit_id }],
  });
  const childName = `Bé Nợ Quá Hạn ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2022-03-01',
      gender: 'male',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '3333',
      photo_consent: 'pending',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  // Hóa đơn đã phát hành quá hạn 8 ngày: tới mốc 7 theo cấu hình mặc định 3, 7, 15
  await schoolYear
    .insertInto('invoices')
    .values({
      code: `HD-E${suffix}`,
      child_id: child.id,
      org_unit_id: reference.org_unit_id,
      period_year: Number(vietnamToday.slice(0, 4)),
      period_month: Number(vietnamToday.slice(5, 7)),
      invoice_kind: 'main',
      status: 'issued',
      total_amount: 1_800_000,
      basis: JSON.stringify({}),
      due_date: addDays(vietnamToday, -8),
      issued_at: new Date(),
      issued_by: accountant.id,
    })
    .execute();

  const accountantPage = await signIn(browser, accountant);
  await openMenu(accountantPage, '/debt-collection');
  const reminders = accountantPage.getByRole('region', { name: 'Danh sách nhắc nợ' });
  const row = reminders.getByRole('row').filter({ hasText: childName });
  await expect(row).toContainText('Cần nhắc mốc 7');
  await row.getByRole('checkbox').check();
  await reminders.getByRole('button', { name: 'Gửi nhắc nợ (1)' }).click();
  await expect(accountantPage.getByRole('status')).toContainText('Đã gửi 1 nhắc nợ');
  await expect(row).toContainText('Mốc 7');

  await row.getByRole('button', { name: 'Đề xuất xử lý' }).click();
  const form = accountantPage.getByRole('region', { name: 'Lập đề xuất xử lý công nợ' });
  await form.getByLabel('Nội dung đề xuất').fill('Gia hạn tới cuối tháng, mời phụ huynh trao đổi');
  await form.getByRole('button', { name: 'Gửi đề xuất' }).click();
  const proposals = accountantPage.getByRole('region', { name: 'Đề xuất xử lý công nợ quá hạn' });
  const proposal = proposals.getByRole('listitem').filter({ hasText: childName });
  await expect(proposal).toContainText('Chờ quyết định');
  await expect(proposal.getByRole('button', { name: 'Ghi quyết định' })).toHaveCount(0);

  const vicePage = await signIn(browser, vicePrincipal);
  await openMenu(vicePage, '/debt-collection');
  const pending = vicePage
    .getByRole('region', { name: 'Đề xuất xử lý công nợ quá hạn' })
    .getByRole('listitem')
    .filter({ hasText: childName });
  await pending.getByLabel('Quyết định').fill('Đồng ý gia hạn tới ngày cuối tháng');
  await pending.getByRole('button', { name: 'Ghi quyết định' }).click();
  await expect(pending).toContainText('Đã quyết định');
  await expect(pending).toContainText('Quyết định: Đồng ý gia hạn tới ngày cuối tháng');
  await expect(pending).toContainText('1.800.000');
});
