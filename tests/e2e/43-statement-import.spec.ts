import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
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

// Nhập tệp sao kê ngân hàng (DT-11 phần 11d, G3-05, YCTD-89): kế toán lưu cấu hình cột của tài khoản, nhập tệp CSV, hệ
// thống đề xuất lập phiếu thu cho dòng có mã hóa đơn còn nợ; kế toán xác nhận thì phiếu thu được lập và dòng đã khớp
// trên trang Đối chiếu ngân hàng (MH-11, MH-70)
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const dmy = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('Kế toán nhập tệp sao kê CSV và xác nhận đề xuất lập phiếu thu', async ({ page }) => {
  const reference = await schoolYear.selectFrom('classes').select(['org_unit_id']).executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const accountant = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-04', orgUnitId: reference.org_unit_id }],
  });
  const accountName = `NH Sao Kê ${suffix}`;
  const accountNumber = `77${suffix}`;
  await schoolYear
    .insertInto('cash_accounts')
    .values({
      org_unit_id: reference.org_unit_id,
      account_type: 'bank',
      name: accountName,
      bank_name: 'VCB',
      account_number: accountNumber,
      opening_balance: 0,
      current_balance: 0,
      created_by: accountant.id,
    })
    .execute();
  await schoolYear
    .insertInto('cashflow_categories')
    .values({
      code: `THU-SK-${suffix}`,
      name: `Thu học phí sao kê ${suffix}`,
      group_name: 'Chung',
      flow_type: 'income',
    })
    .execute();
  const childName = `Bé Sao Kê ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: '2022-03-01',
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '4343',
      photo_consent: 'pending',
      status: 'active',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const invoiceCode = `HD-${String(suffix).padStart(6, '0')}`;
  await schoolYear
    .insertInto('invoices')
    .values({
      code: invoiceCode,
      child_id: child.id,
      org_unit_id: reference.org_unit_id,
      period_year: Number(vietnamToday.slice(0, 4)),
      period_month: Number(vietnamToday.slice(5, 7)),
      invoice_kind: 'supplementary',
      status: 'issued',
      total_amount: 1_250_000,
      basis: JSON.stringify({}),
      due_date: vietnamToday,
      issued_at: new Date(),
      issued_by: accountant.id,
    })
    .execute();

  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await openMenu(page, '/bank-reconciliation');
  await page.getByLabel('Tài khoản ngân hàng').selectOption({ label: `${accountName} (${accountNumber})` });

  const section = page.getByRole('region', { name: 'Nhập tệp sao kê' });
  await section.getByRole('spinbutton', { name: 'Dòng tiêu đề', exact: true }).fill('1');
  await section.getByRole('textbox', { name: 'Cột ngày', exact: true }).fill('Ngày GD');
  await section.getByRole('textbox', { name: 'Cột tiền vào', exact: true }).fill('Ghi có');
  await section.getByRole('textbox', { name: 'Cột tiền ra', exact: true }).fill('Ghi nợ');
  await section.getByRole('textbox', { name: 'Cột diễn giải', exact: true }).fill('Nội dung');
  await section.getByRole('textbox', { name: 'Cột số tham chiếu', exact: true }).fill('Số tham chiếu');
  await section.getByRole('button', { name: 'Lưu cấu hình cột' }).click();
  await expect(section).toContainText('Đã lưu cấu hình cột');

  const csv = [
    'Ngày GD;Ghi có;Ghi nợ;Nội dung;Số tham chiếu',
    `${dmy(vietnamToday)};1.250.000;;Me ${childName} nop ${invoiceCode.replace('-', '')};FT${suffix}A`,
    `${dmy(vietnamToday)};;22.000;Phi chuyen tien;FT${suffix}B`,
    `${dmy(vietnamToday)};khong ro;;Dong loi;FT${suffix}C`,
  ].join('\n');
  await section
    .getByLabel('Tệp sao kê')
    .setInputFiles({ name: 'sao-ke.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await section.getByRole('button', { name: 'Nhập sao kê' }).click();
  const result = section.getByRole('region', { name: 'Kết quả nhập sao kê' });
  await expect(result).toContainText('Đã ghi 2/3 dòng');
  await expect(result).toContainText('đề xuất lập phiếu thu 1');
  await expect(result).toContainText('Dòng 4');

  const statement = page.getByRole('region', { name: 'Sao kê ngân hàng' });
  const row = statement.getByRole('row').filter({ hasText: `Đề xuất lập phiếu thu cho ${invoiceCode}` });
  await expect(row).toContainText(childName);
  await row.getByRole('button', { name: 'Lập phiếu thu' }).click();
  await expect(page.getByRole('status')).toContainText('và khớp dòng sao kê');
  const matched = statement.getByRole('row').filter({ hasText: `nop ${invoiceCode.replace('-', '')}` });
  await expect(matched).toContainText('Đã khớp');
  await expect(matched.getByRole('button', { name: 'Bỏ khớp' })).toBeVisible();
});
