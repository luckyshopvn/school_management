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

// Sổ kế toán kép (DT-11 phần 11c, YCTD-88): kế toán trưởng ghi sổ chứng từ (hóa đơn đã phát hành thành bút toán Nợ 131 /
// Có 531), ghi một bút toán thủ công cân và xem bảng cân đối số phát sinh trên trang Sổ kế toán (MH-67, MH-68)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

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

test('Kế toán trưởng ghi sổ chứng từ, ghi bút toán thủ công và xem bảng cân đối số phát sinh', async ({ browser }) => {
  const reference = await schoolYear.selectFrom('classes').select(['org_unit_id']).executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const chief = await createTestUser(identity, { roles: [{ roleCode: 'VT-05', orgUnitId: reference.org_unit_id }] });
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: `Bé Sổ Kế Toán ${suffix}`,
      dob: '2022-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '4242',
      photo_consent: 'pending',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const invoiceCode = `HD-L${suffix}`;
  await schoolYear
    .insertInto('invoices')
    .values({
      code: invoiceCode,
      child_id: child.id,
      org_unit_id: reference.org_unit_id,
      period_year: Number(vietnamToday.slice(0, 4)),
      period_month: Number(vietnamToday.slice(5, 7)),
      invoice_kind: 'main',
      status: 'issued',
      total_amount: 1_234_000,
      basis: JSON.stringify({}),
      due_date: vietnamToday,
      issued_at: new Date(),
      issued_by: chief.id,
    })
    .execute();

  const page = await signIn(browser, chief);
  await openMenu(page, '/ledger');
  await expect(page.getByRole('heading', { name: 'Sổ kế toán' })).toBeVisible();
  await page.getByRole('button', { name: 'Ghi sổ chứng từ' }).click();
  await expect(page.getByText(/Đã ghi sổ \d+ chứng từ/)).toBeVisible();
  const journal = page.getByRole('region', { name: 'Sổ nhật ký chung' });
  await expect(journal.getByText(`Hóa đơn ${invoiceCode}`)).toBeVisible();

  const form = page.getByRole('form', { name: 'Bút toán thủ công' });
  await form.getByLabel('Diễn giải').fill(`Trích khấu hao ${suffix}`);
  await form
    .getByLabel('Tài khoản dòng 1')
    .selectOption({ label: '642 - Chi phí quản lý của hoạt động sản xuất, kinh doanh, dịch vụ' });
  await form.getByLabel('Nợ dòng 1').fill('150000');
  await form.getByLabel('Tài khoản dòng 2').selectOption({ label: '214 - Khấu hao và hao mòn lũy kế tài sản cố định' });
  await form.getByLabel('Có dòng 2').fill('120000');
  await form.getByRole('button', { name: 'Ghi sổ bút toán' }).click();
  await expect(form.getByText(/Tổng Nợ phải bằng tổng Có|phải bằng tổng Có/)).toBeVisible();
  await form.getByLabel('Có dòng 2').fill('150000');
  await form.getByRole('button', { name: 'Ghi sổ bút toán' }).click();
  await expect(page.getByText(/Đã ghi bút toán BT-\d{6}/)).toBeVisible();
  await expect(journal.getByText(`Trích khấu hao ${suffix}`)).toBeVisible();

  await page.getByRole('tab', { name: 'Cân đối số phát sinh' }).click();
  await expect(page.getByText('Sổ cân: tổng Nợ bằng tổng Có')).toBeVisible();
  const trial = page.getByRole('region', { name: 'Bảng cân đối số phát sinh' });
  await expect(trial.getByText('214 Khấu hao và hao mòn lũy kế tài sản cố định')).toBeVisible();
});
