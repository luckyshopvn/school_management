import ExcelJS from 'exceljs';
import { expect, test } from './fixtures.js';
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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d, YCTD-135): Hiệu trưởng nhập danh sách phân tuyến từ Excel ở 1.4, tích giấy tờ
// đã nộp và phụ huynh đồng ý nhập học, bổ sung dị ứng và giấy khai sinh; 1.5 gửi thông báo; 1.6 chuyển hồ sơ sang CSDL và xem
// kết quả; 1.7 hủy nhập học hồ sơ vừa chuyển; 5.11 mở được. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

async function routingWorkbook(name: string, nationalId: string, relationship: string): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Danh sách phân tuyến');
  sheet.addRow([
    'Họ và tên (*)',
    'Ngày sinh (*)',
    'Giới tính (*)',
    'Nơi sinh',
    'Số ĐDCN',
    'Diện cư trú',
    'Nơi ở hiện tại (VNEID)',
    'Tổ',
    'Khu phố',
    'Phường/Xã',
    'Thành phố (Tỉnh)',
    'Họ tên cha',
    'Họ tên mẹ',
    'Người liên hệ (*)',
    'Số điện thoại (*)',
    'Thư điện tử',
    'Quan hệ với học sinh',
    'Phường/Xã cuối cấp',
    'Trường cuối cấp',
    'Tiêu chí',
    'Kết quả học tập và thành tích',
    'Ngày đăng ký',
  ]);
  sheet.addRow([
    name,
    '12/04/2023',
    'Nữ',
    'Thành phố Kiểm Thử',
    nationalId,
    'Thường trú',
    'Số 9 Đường Kiểm Thử',
    'Tổ 2',
    'Khu phố 3',
    'Phường Kiểm Thử',
    'Thành phố Kiểm Thử',
    'Cha Kiểm Thử',
    'Mẹ Kiểm Thử',
    'Mẹ Kiểm Thử',
    `09${String(Date.now() % 100_000_000).padStart(8, '0')}`,
    '',
    relationship,
    'Phường Kiểm Thử',
    'Trường Mầm non Kiểm Thử',
    '',
    '',
    '',
  ]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

test('CT-17d-11: 1.4 nhập phân tuyến, lưu giấy tờ; 1.5 gửi thông báo; 1.6 chuyển sang CSDL; 1.7 hủy nhập học', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  // Đợt của đơn vị đang dùng, năm học nhận trẻ là năm học đang mở
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('status', '=', 'active')
    .orderBy('unit_type')
    .executeTakeFirstOrThrow();
  const system = createDatabase<SystemDatabase>(
    replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
  );
  const year = await system
    .selectFrom('academic_years')
    .select('id')
    .where('status', '=', 'open')
    .executeTakeFirstOrThrow();
  await system.destroy();
  const suffix = Date.now() % 1_000_000;
  const campaignName = `Tuyển sinh đầu cấp ${suffix}`;
  const childName = `Trẻ Phân Tuyến ${suffix}`;
  const nationalId = `079${String(Date.now() % 1_000_000_000).padStart(9, '0')}`;
  await schoolYear
    .insertInto('catalog_items')
    .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
    .onConflict((conflict) => conflict.columns(['catalog_type', 'code']).doNothing())
    .execute();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('name')
    .where('catalog_type', '=', 'parent_relationship')
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  await schoolYear
    .insertInto('admission_campaigns')
    .values({
      org_unit_id: unit.id,
      name: campaignName,
      quota: 20,
      open_from: '2026-03-01',
      open_to: '2026-08-31',
      status: 'open',
      program_type: 'general',
      target_academic_year_id: year.id,
      created_by: principal.id,
    })
    .execute();

  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // 1.4 Nhập danh sách phân tuyến từ Excel
  await openMenu(page, '/entry-admissions/intake');
  await expect(page.getByRole('heading', { name: '1.4. Tiếp nhận hồ sơ tuyển sinh' })).toBeVisible();
  const searchForm = page.getByRole('form', { name: 'Tìm kiếm hồ sơ tiếp nhận' });
  await searchForm.getByLabel('Đợt tuyển sinh').selectOption({ label: `${campaignName} (Đại trà)` });
  await searchForm.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
  const importDialog = page.getByRole('dialog');
  await importDialog.getByLabel('Tệp Excel').setInputFiles({
    name: 'phan-tuyen.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await routingWorkbook(childName, nationalId, relationship.name),
  });
  await importDialog.getByRole('button', { name: 'Nhập', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã nhập 1 dòng' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: childName });
  await expect(row).toContainText(`********${nationalId.slice(-4)}`);
  await expect(row).toContainText('Phân tuyến');

  // Giấy tờ đã nộp, phụ huynh đồng ý nhập học, Lưu dữ liệu
  await page.getByLabel(`Giấy báo nhập học: ${childName}`).check();
  await page.getByLabel(`Phụ huynh đồng ý nhập học: ${childName}`).check();
  await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu 1 hồ sơ' })).toBeVisible();

  // Cập nhật: khai báo dị ứng, tải giấy khai sinh
  await row.getByRole('button', { name: 'Cập nhật' }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Dị ứng').selectOption('false');
  await editDialog
    .getByLabel('Tệp giấy tờ')
    .setInputFiles({ name: 'khai-sinh.png', mimeType: 'image/png', buffer: PNG });
  await editDialog.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `Đã cập nhật hồ sơ của ${childName}` })).toBeVisible();
  await expect(row).toContainText('khai-sinh.png');

  // 1.5 Gửi thông báo
  await openMenu(page, '/entry-admissions/notices');
  await expect(page.getByRole('heading', { name: '1.5. Gửi thông báo tuyển sinh đầu cấp' })).toBeVisible();
  const noticeForm = page.getByRole('form', { name: 'Tìm kiếm người nhận' });
  await noticeForm.getByLabel('Đợt tuyển sinh').selectOption({ label: `${campaignName} (Đại trà)` });
  await noticeForm.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await page.getByLabel('Nội dung tin nhắn', { exact: true }).fill('Mời phụ huynh nộp hồ sơ nhập học');
  await page.getByLabel(`Chọn ${childName}`).check();
  await page.getByRole('button', { name: 'Gửi thông báo' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Gửi thông báo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã gửi 0/1 người nhận' })).toBeVisible();

  // 1.6 Chuyển hồ sơ sang CSDL
  await openMenu(page, '/entry-admissions/transfer');
  await expect(page.getByRole('heading', { name: '1.6. Chuyển hồ sơ trúng tuyển sang CSDL' })).toBeVisible();
  const transferRow = page.getByRole('row').filter({ hasText: childName });
  await expect(transferRow).toContainText('Chưa chuyển');
  await page.getByLabel(`Chọn ${childName}`).check();
  await page.getByRole('button', { name: 'Chuyển hồ sơ sang CSDL' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chuyển hồ sơ' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'chuyển thành công 1/1 hồ sơ' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Xem kết quả đồng bộ' })).toHaveAttribute('aria-selected', 'true');
  const resultRow = page.getByRole('row').filter({ hasText: childName });
  await expect(resultRow).toContainText('Thành công');

  // 1.7 Danh sách kết quả chuyển hồ sơ, Hủy nhập học
  await openMenu(page, '/entry-admissions/transfer-results');
  await expect(page.getByRole('heading', { name: '1.7. Danh sách kết quả chuyển hồ sơ' })).toBeVisible();
  const transferredRow = page.getByRole('row').filter({ hasText: childName });
  await expect(transferredRow).toContainText('Đã chuyển');
  await expect(transferredRow).toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  await page.getByLabel(`Chọn ${childName}`).check();
  await page.getByRole('button', { name: 'Hủy nhập học' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy nhập học' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã hủy nhập học 1/1 học sinh' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: childName })).toContainText('Đã hủy nhập học');

  // 1.3 và 5.11 mở được
  await openMenu(page, '/entry-admissions/advanced');
  await expect(page.getByRole('heading', { name: '1.3. Danh sách học sinh đăng ký trường tiên tiến' })).toBeVisible();
  await openMenu(page, '/admitted-students');
  await expect(page.getByRole('heading', { name: '5.11. Danh sách trúng tuyển Tuyển sinh đầu cấp' })).toBeVisible();
});
