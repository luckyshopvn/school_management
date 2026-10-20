import { expect, test } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import type { Browser, Page } from '@playwright/test';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Phân hệ KPI (DT-18 phần 18d, YCTD-139): Hiệu trưởng gán đối tượng đánh giá, lập kỳ, thêm việc vào danh mục chung, giao
// việc; giáo viên xác nhận, ghi số ký hiệu văn bản, tự đánh giá; Hiệu trưởng chấm; giáo viên nộp bản tự đánh giá; Hiệu
// trưởng kết luận, khóa kỳ, xem bảng tổng hợp và tải tệp. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
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

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-18d-01: giao việc, tự đánh giá, chấm, kết luận, khóa kỳ và tải bảng tổng hợp KPI', async ({ browser }) => {
  test.setTimeout(300_000);
  const unit = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('status', '=', 'active')
    .orderBy('unit_type')
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const teacherName = `Giáo Viên KPI ${suffix}`;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unit.id }] });
  await schoolYear
    .insertInto('staff')
    .values({
      org_unit_id: unit.id,
      code: `KPI-${suffix}`,
      full_name: teacherName,
      start_date: '2026-01-01',
      user_id: teacher.id,
    })
    .execute();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  const page = await signIn(browser, principal);

  // 1.3 Gán đối tượng đánh giá theo Bộ quy tắc 1, nhóm cán bộ
  await openMenu(page, '/kpi/profiles');
  await expect(page.getByRole('heading', { name: '1.3. Đối tượng đánh giá' })).toBeVisible();
  await page.getByLabel('Đơn vị', { exact: true }).selectOption(unit.id);
  await page.getByRole('row').filter({ hasText: teacherName }).getByRole('button', { name: 'Gán', exact: true }).click();
  const profileForm = page.getByRole('form', { name: 'Gán đối tượng đánh giá' });
  await profileForm.getByLabel('Bộ quy tắc').selectOption({ label: 'Bộ quy tắc 1' });
  await profileForm.getByLabel('Nhóm đối tượng').selectOption('staff');
  await profileForm.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã ghi đối tượng đánh giá cho 1 người' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: teacherName })).toContainText('Bộ quy tắc 1');

  // 1.2 Xem cấu hình bộ quy tắc
  await openMenu(page, '/kpi/rule-sets');
  await page.getByRole('row', { name: 'Bộ quy tắc BQT-1' }).getByRole('button', { name: 'Cấu hình' }).click();
  await expect(page.getByLabel('Tóm tắt cấu hình')).toContainText('Trọng số: tiến độ 30%, kết quả 70%');

  // 1.1 Lập kỳ
  await openMenu(page, '/kpi/periods');
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const periodForm = page.getByRole('form', { name: 'Thêm kỳ đánh giá' });
  await periodForm.getByLabel('Mã kỳ').fill(`KPI-${suffix}`);
  await periodForm.getByLabel('Tên kỳ').fill(`Kỳ KPI ${suffix}`);
  await periodForm.getByLabel('Từ ngày', { exact: true }).fill(shift(-10));
  await periodForm.getByLabel('Đến ngày', { exact: true }).fill(shift(60));
  await periodForm.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã thêm kỳ đánh giá' })).toBeVisible();

  // 2.1 Thêm việc vào danh mục chung
  await openMenu(page, '/kpi/catalog');
  await page.getByLabel('Bộ quy tắc', { exact: true }).selectOption({ label: 'Bộ quy tắc 1' });
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const catalogForm = page.getByRole('form', { name: 'Thêm công việc' });
  await catalogForm.getByLabel('Mã công việc').fill(`DM-${suffix}`);
  await catalogForm.getByLabel('Tên công việc').fill(`Báo cáo tháng ${suffix}`);
  await catalogForm.getByRole('button', { name: 'Ghi', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã thêm công việc vào danh mục' })).toBeVisible();

  // 3.2 Giao việc
  await openMenu(page, '/kpi/assignments');
  await page.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý)` });
  await page.getByRole('button', { name: 'Giao việc' }).click();
  const assignForm = page.getByRole('form', { name: 'Giao việc' });
  await assignForm.getByLabel('Người thực hiện').selectOption({ label: `${teacherName} — ${unit.name}` });
  await assignForm.getByLabel('Chọn từ danh mục').selectOption({ label: `DM-${suffix} — Báo cáo tháng ${suffix}` });
  await assignForm.getByRole('button', { name: 'Giao việc' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã giao việc' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: teacherName })).toContainText('Chờ xác nhận');

  // 3.1 Giáo viên xác nhận, ghi số ký hiệu văn bản, tự đánh giá
  const teacherPage = await signIn(browser, teacher);
  await openMenu(teacherPage, '/kpi/my-tasks');
  await teacherPage.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý)` });
  const taskRow = teacherPage.getByRole('row').filter({ hasText: `Báo cáo tháng ${suffix}` });
  await taskRow.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(teacherPage.getByRole('status').filter({ hasText: 'Đã xác nhận việc' })).toBeVisible();
  await taskRow.getByRole('button', { name: 'Chi tiết' }).click();
  const detail = teacherPage.getByLabel(`Chi tiết việc Báo cáo tháng ${suffix}`);
  await detail.getByLabel('Số ký hiệu văn bản').fill('15/BC-TRƯỜNG ngày 05/10/2026');
  await detail.getByLabel('Tự đánh giá kết quả').selectOption({ index: 1 });
  await detail.getByRole('button', { name: 'Nộp kết quả tự đánh giá' }).click();
  await expect(teacherPage.getByRole('status').filter({ hasText: 'Đã nộp kết quả tự đánh giá' })).toBeVisible();
  await expect(taskRow).toContainText('Chờ chấm');

  // 3.3 Hiệu trưởng chấm
  await openMenu(page, '/kpi/grading');
  await page.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý)` });
  await page.getByRole('row').filter({ hasText: teacherName }).getByRole('button', { name: 'Chấm', exact: true }).click();
  const gradeForm = page.getByRole('form', { name: `Chấm việc Báo cáo tháng ${suffix}` });
  await expect(gradeForm).toContainText('15/BC-TRƯỜNG ngày 05/10/2026');
  await gradeForm.getByLabel('Mức kết quả').selectOption({ index: 1 });
  await gradeForm.getByRole('button', { name: 'Chấm', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã chấm việc' })).toBeVisible();

  // 4.1 Giáo viên nộp bản tự đánh giá
  await openMenu(teacherPage, '/kpi/my-evaluation');
  await teacherPage.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý)` });
  await expect(teacherPage.getByLabel('Tổng hợp điểm')).toContainText('Kết quả nhiệm vụ: 70/70');
  await teacherPage.getByLabel('Tự đề xuất xếp loại').selectOption({ label: 'Hoàn thành tốt nhiệm vụ' });
  await teacherPage.getByRole('button', { name: 'Nộp bản tự đánh giá' }).click();
  await expect(teacherPage.getByRole('status').filter({ hasText: 'Đã nộp bản tự đánh giá' })).toBeVisible();

  // 4.2 Hiệu trưởng kết luận
  await openMenu(page, '/kpi/evaluations');
  await page.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý)` });
  await page.getByRole('row', { name: `Phiếu của ${teacherName}` }).getByRole('button', { name: 'Đánh giá' }).click();
  const conclude = page.getByLabel(`Đánh giá ${teacherName}`);
  await conclude.getByLabel('Mức xếp loại').selectOption({ label: 'Hoàn thành tốt nhiệm vụ' });
  await conclude.getByRole('button', { name: 'Kết luận' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã kết luận đánh giá' })).toBeVisible();

  // 1.1 Khóa kỳ
  await openMenu(page, '/kpi/periods');
  await page.getByRole('row', { name: `Kỳ KPI-${suffix}` }).getByRole('button', { name: 'Khóa kỳ' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Khóa kỳ' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã khóa kỳ' })).toBeVisible();

  // 5.1 Bảng tổng hợp và tải tệp
  await openMenu(page, '/kpi/reports');
  await page.getByLabel('Kỳ đánh giá').selectOption({ label: `Kỳ KPI ${suffix} (Quý, đã khóa)` });
  await expect(page.getByRole('row').filter({ hasText: teacherName })).toContainText('Hoàn thành tốt nhiệm vụ');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Bảng tổng hợp kết quả đánh giá, xếp loại (Excel)' }).click();
  expect((await download).suggestedFilename()).toMatch(/^tong-hop-xep-loai-.*\.xlsx$/);
});
