import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import ExcelJS from 'exceljs';
import { openMenu } from './menu.js';

// Hồ sơ trường, khai báo cơ sở vật chất, thiết bị dạy học, báo cáo EMIS đầu năm (DT-14 phần 14d, YCTD-102). Chạy sau
// 02-academic-years và 03-org-units (năm học đang mở, có Trường chính). Dữ liệu là dữ liệu giả của riêng kịch bản này
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

test('Hiệu trưởng ghi hồ sơ trường, khai báo phòng, nhập thiết bị, xem và xuất báo cáo EMIS', async ({ browser }) => {
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // Hồ sơ trường: thông tin chung, một tiêu chí, Ghi
  await openMenu(page, '/school-profile');
  await expect(page.getByRole('heading', { name: '1.1. Hồ sơ trường' })).toBeVisible();
  await page.getByLabel('Loại hình trường').selectOption('private');
  await page.getByLabel('Tên theo quyết định thành lập').fill('Trường Mầm non Thử Nghiệm 50');
  await page.getByLabel('Diện tích đất (m²)').fill('1500');
  await page.getByRole('tab', { name: 'Thông tin khác' }).click();
  await page.getByLabel('Có bếp ăn tại trường').check();
  await page.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByText('Đã ghi hồ sơ trường')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Tên theo quyết định thành lập')).toHaveValue('Trường Mầm non Thử Nghiệm 50');

  // Khai báo cơ sở vật chất: thêm phòng khối nuôi dưỡng, chăm sóc và giáo dục, lọc theo hiện trạng
  const roomCode = `CSVC50-${randomUUID().slice(0, 4)}`;
  await openMenu(page, '/facility-rooms');
  await expect(page.getByRole('heading', { name: '1.1. Khai báo cơ sở vật chất' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('region', { name: 'Thêm phòng' });
  await form.getByLabel('Mã phòng').fill(roomCode);
  await form.getByLabel('Tên phòng').fill('Phòng sinh hoạt chung thử 50');
  await form.getByLabel('Sức chứa').fill('30');
  await form.getByLabel('Khối phòng').selectOption('care_education');
  await form.getByLabel('Loại phòng').selectOption('group_room');
  await form.getByLabel('Hiện trạng').selectOption('permanent');
  await form.getByLabel('Diện tích (m²)').fill('54.5');
  await form.getByLabel('Số chỗ ngủ').fill('28');
  await form.getByRole('button', { name: 'Lưu phòng' }).click();
  await expect(page.getByText('Đã lưu phòng')).toBeVisible();
  // Danh sách phòng là lưới dữ liệu chung (DT-16 phần 16b): lọc hiện trạng ở Mở rộng tìm kiếm, tìm tại chỗ theo mã phòng
  const list = page.getByRole('region', { name: 'Danh sách phòng' });
  await list.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await list.getByLabel('Hiện trạng').selectOption('permanent');
  await list.getByRole('searchbox', { name: 'Tìm theo tên, mã phòng, điểm trường' }).fill(roomCode);
  await expect(list).toContainText('Phòng sinh hoạt chung thử 50');
  await expect(list).toContainText('Số chỗ ngủ: 28');
  await expect(page.getByRole('region', { name: 'Tổng hợp cơ sở vật chất' })).toContainText('Tổng số');

  // Thiết bị dạy học: nhập số hiện có của kho chung rồi xem tổng hợp
  await openMenu(page, '/equipment');
  await expect(page.getByRole('heading', { name: '2.1. Tổng hợp thiết bị dạy học' })).toBeVisible();
  await page.getByRole('tab', { name: 'Nhập số hiện có' }).click();
  await page.getByLabel('Nhóm tuổi').selectOption('mg_5_6');
  await page.getByLabel('Hiện có MG5-DD-03').fill('3');
  await page.getByRole('button', { name: 'Ghi số hiện có' }).click();
  await expect(page.getByText('Đã ghi số hiện có của 1 thiết bị')).toBeVisible();
  await page.getByRole('tab', { name: 'Tổng hợp' }).click();
  const summary = page.getByRole('region', { name: 'Tổng hợp thiết bị dạy học' });
  await summary.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
  await summary.getByLabel('Nhóm tuổi').selectOption('mg_5_6');
  await expect(summary).toContainText('Giá để đồ chơi và học liệu');
  await page.getByRole('tab', { name: 'Danh mục tối thiểu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Danh mục thiết bị' })).toContainText('Cần đối chiếu văn bản');

  // Báo cáo EMIS đầu năm: xem thẻ Học sinh, xuất Excel năm trang
  await openMenu(page, '/emis');
  await expect(page.getByRole('heading', { name: '1.1 Báo cáo EMIS đầu năm' })).toBeVisible();
  await page.getByRole('tab', { name: 'Phòng học' }).click();
  await expect(page.getByRole('region', { name: 'Phòng học' })).toContainText('Kiên cố');
  await page.getByRole('tab', { name: 'Học sinh', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Học sinh', exact: true })).toContainText('Tổng số học sinh');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^emis-dau-nam-\d{8}-\d{4}\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'Trường – lớp học',
    'Học sinh',
    'Học sinh theo độ tuổi',
    'Đội ngũ',
    'Phòng học',
  ]);
});
