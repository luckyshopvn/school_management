import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { expect, test, type Page } from './fixtures.js';
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

// Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k, YCTD-130): Hiệu trưởng khai báo chứng thư số nhà trường kèm ảnh con
// dấu, đăng ký kí nội bộ, đánh dấu đã đồng bộ; tạo hồ sơ lớp, kí xác nhận nội bộ, tải tệp đã kí; xuất dữ liệu sổ đầu bài;
// xác nhận hoàn thành và đánh dấu đã gửi. Không có nút giả vờ kí số. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const SEAL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function confirm(page: Page, label: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('Hiệu trưởng khai báo chứng thư, tạo và kí xác nhận nội bộ hồ sơ lớp, xác nhận hoàn thành, đánh dấu đã gửi', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const className = `Lớp kí hồ sơ ${suffix}`;
  await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `KHS-${suffix}`,
      name: className,
      grade_level: 'MAM',
      max_size: 30,
    })
    .execute();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 1.1 Chứng thư số nhà trường: ghi thông tin, tải ảnh con dấu, đăng ký kí nội bộ
  await openMenu(page, '/signing-certificate');
  await expect(page.getByRole('heading', { name: '1.1. Chứng thư số nhà trường' })).toBeVisible();
  if (await page.getByRole('button', { name: 'Hủy đăng ký' }).isVisible()) {
    await page.getByRole('button', { name: 'Hủy đăng ký' }).click();
    await confirm(page, 'Hủy đăng ký');
  }
  await page.getByLabel('Kiểu chữ ký').selectOption('remote');
  await page.getByLabel('Nhà phát hành').fill('Nhà cung cấp thử nghiệm');
  await page.getByLabel('Người đứng tên').fill('Hiệu trưởng thử nghiệm');
  await page.getByLabel('Chức danh').fill('Hiệu trưởng');
  await page.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi thông tin chứng thư')).toBeVisible();
  await page
    .getByLabel('Chọn ảnh con dấu (PNG, JPEG, tối đa 1 MB)')
    .setInputFiles({ name: 'con-dau.png', mimeType: 'image/png', buffer: SEAL });
  await expect(page.getByRole('img', { name: 'Ảnh con dấu' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng ký kí nội bộ' }).click();
  await confirm(page, 'Đăng ký');
  await expect(page.getByText('Đã đăng ký kí nội bộ', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Nhà phát hành')).toBeDisabled();

  // 2.1 Đồng bộ chứng thư số: đánh dấu đã đồng bộ kèm ngày
  await openMenu(page, '/signing-certificate-sync');
  await expect(page.getByRole('heading', { name: '2.1. Đồng bộ chứng thư số' })).toBeVisible();
  if (await page.getByRole('button', { name: 'Đặt lại chưa đồng bộ' }).isVisible()) {
    await page.getByRole('button', { name: 'Đặt lại chưa đồng bộ' }).click();
    await confirm(page, 'Đặt lại');
  }
  await page.getByRole('button', { name: 'Đánh dấu đã đồng bộ' }).click();
  await confirm(page, 'Đánh dấu');
  await expect(page.getByText('Đã đánh dấu đồng bộ', { exact: true })).toBeVisible();

  // 2.2 Kí hồ sơ: thẻ Lớp, tạo hồ sơ, kí xác nhận nội bộ, tải tệp đã kí; không có nút kí số giả
  await openMenu(page, '/signing-dossiers');
  await expect(page.getByRole('heading', { name: '2.2. Kí hồ sơ trường, lớp, nhân sự, học sinh' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ký số|Đăng nhập và kí/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Lớp', exact: true }).click();
  await page.getByLabel('Tìm theo tên, thông tin, mã hồ sơ').fill(className);
  const grid = page.getByRole('table', { name: 'Danh sách hồ sơ kí' });
  await expect(grid.getByText(className)).toBeVisible();
  await expect(grid.getByText('Chưa tạo hồ sơ')).toBeVisible();
  await page.getByLabel(`Chọn ${className}`).check();
  await page.getByRole('button', { name: 'Tạo hồ sơ', exact: true }).click();
  await confirm(page, 'Tạo hồ sơ');
  await expect(page.getByText(/Đã tạo 1 hồ sơ: KHS-\d{6}/)).toBeVisible();
  await expect(grid.getByText('Đã tạo, chưa kí')).toBeVisible();
  await page.getByLabel(`Chọn ${className}`).check();
  await page.getByRole('button', { name: 'Kí xác nhận nội bộ', exact: true }).click();
  await confirm(page, 'Kí xác nhận nội bộ');
  await expect(page.getByText('Đã kí xác nhận nội bộ 1 hồ sơ')).toBeVisible();
  await expect(grid.getByText('Đã kí nội bộ')).toBeVisible();
  const code = (await grid.getByRole('button', { name: /^KHS-\d{6}\.pdf$/ }).innerText()).replace('.pdf', '');
  const signedDownload = page.waitForEvent('download');
  await grid.getByRole('button', { name: `${code}-da-ki.pdf` }).click();
  const signedFile = await signedDownload;
  expect(signedFile.suggestedFilename()).toBe(`${code}-da-ki.pdf`);
  expect((await readFile(await signedFile.path())).subarray(0, 4).toString()).toBe('%PDF');

  // Sổ đầu bài: xuất dữ liệu của lớp trong tháng ra Excel
  await page.getByRole('tab', { name: 'Sổ đầu bài', exact: true }).click();
  await expect(page.getByLabel('Tháng của sổ đầu bài')).toBeVisible();
  await page.getByLabel('Tìm theo tên, thông tin, mã hồ sơ').fill(className);
  await page.getByLabel(`Chọn ${className}`).check();
  const logDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất dữ liệu sổ đầu bài' }).click();
  const logFile = await logDownload;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await readFile(await logFile.path())) as unknown as ArrayBuffer);
  expect(String(workbook.worksheets[0]?.getRow(1).getCell(1).value)).toContain(`Sổ đầu bài: ${className}`);

  // 2.3 Xác nhận hoàn thành và đánh dấu đã gửi
  await openMenu(page, '/signing-submissions');
  await expect(page.getByRole('heading', { name: '2.3. Xác nhận hoàn thành và gửi hồ sơ' })).toBeVisible();
  const submissions = page.getByRole('table', { name: 'Danh sách hồ sơ đã kí' });
  const row = submissions.getByRole('row').filter({ hasText: code });
  await expect(row.getByText('Đã kí nội bộ')).toBeVisible();
  await page.getByLabel(`Chọn ${code} ${className}`).check();
  await page.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click();
  await confirm(page, 'Xác nhận hoàn thành');
  await expect(row.getByText('Đã xác nhận hoàn thành')).toBeVisible();
  await page.getByLabel(`Chọn ${code} ${className}`).check();
  await page.getByRole('button', { name: 'Đánh dấu đã gửi', exact: true }).click();
  await confirm(page, 'Đánh dấu');
  await expect(row.getByText('Đã đánh dấu gửi')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Hủy xác nhận' })).toHaveCount(0);
});
