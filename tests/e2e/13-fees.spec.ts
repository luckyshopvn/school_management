import { expect, test, type Browser, type Page } from '@playwright/test';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';

// Danh mục học phí và tài chính (DT-05 phần 5a, YCTD-49). Chạy sau 06-catalogs.spec.ts: đã có bậc học Mầm
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

async function signInAs(browser: Browser, roleCode: string): Promise<Page> {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId: null }] });
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

test('Kế toán thêm dịch vụ STEM, tạo biểu phí khối Mầm và loại miễn giảm; bán trú có sẵn và bắt buộc', async ({
  browser,
}) => {
  const page = await signInAs(browser, 'VT-04');
  await page.getByRole('link', { name: 'Biểu phí và dịch vụ' }).click();
  const services = page.getByRole('region', { name: 'Danh mục dịch vụ' });
  await expect(services.getByRole('row').filter({ hasText: 'BAN_TRU' })).toContainText('Bắt buộc');
  await services.getByLabel('Mã').fill('STEM');
  await services.getByLabel('Tên dịch vụ').fill('STEM');
  await services.getByRole('button', { name: 'Thêm' }).click();
  await expect(services.getByRole('row').filter({ hasText: 'STEM' })).toContainText('Theo tháng');

  const schedules = page.getByRole('region', { name: 'Biểu phí' });
  await schedules.getByRole('button', { name: 'Tạo phiên bản biểu phí' }).click();
  const form = schedules.getByRole('group', { name: 'Biểu mẫu biểu phí' });
  await form.getByLabel('Tên biểu phí').fill('Biểu phí thử nghiệm');
  await form.getByLabel('Hiệu lực từ tháng').fill('2099-01');
  await form.getByLabel('Học phí chính khóa (tháng) Mầm').fill('2200000');
  await form.getByLabel('Bán trú (ngày) Mầm').fill('35000');
  await form.getByLabel('STEM (tháng) Mầm').fill('440000');
  await form.getByRole('button', { name: 'Lưu biểu phí' }).click();
  const created = schedules.getByRole('article', { name: 'Biểu phí Biểu phí thử nghiệm' });
  await expect(created).toContainText('Chưa hiệu lực');
  await expect(created).toContainText('Từ 2099-01-01');
  await expect(created.getByRole('row').filter({ hasText: 'Học phí chính khóa' })).toContainText('2.200.000');
  await expect(created.getByRole('row').filter({ hasText: 'STEM' })).toContainText('440.000');

  const discounts = page.getByRole('region', { name: 'Loại miễn giảm' });
  await discounts.getByLabel('Mã').fill('ANH_CHI_EM');
  await discounts.getByLabel('Tên loại miễn giảm').fill('Anh chị em ruột');
  await discounts.getByLabel('Mức giảm (%)').fill('10');
  await discounts.getByRole('checkbox', { name: 'Bán trú' }).check();
  await discounts.getByRole('button', { name: 'Thêm loại miễn giảm' }).click();
  await expect(discounts.getByRole('row').filter({ hasText: 'ANH_CHI_EM' })).toContainText('10%');
});

test('Kế toán trưởng thêm khoản mục thu; quản lý đơn vị chỉ xem', async ({ browser }) => {
  const page = await signInAs(browser, 'VT-05');
  await page.getByRole('link', { name: 'Khoản mục thu chi' }).click();
  const categories = page.getByRole('region', { name: 'Khoản mục và nhóm thu chi' });
  await categories.getByLabel('Mã').fill('THU_HOC_PHI');
  await categories.getByLabel('Tên khoản mục').fill('Thu học phí');
  await categories.getByLabel('Nhóm thu chi').fill('Thu từ hoạt động giáo dục');
  await categories.getByRole('button', { name: 'Thêm' }).click();
  await expect(categories.getByRole('row').filter({ hasText: 'THU_HOC_PHI' })).toContainText('Thu');

  const manager = await signInAs(browser, 'VT-03');
  await manager.getByRole('link', { name: 'Biểu phí và dịch vụ' }).click();
  await expect(manager.getByRole('region', { name: 'Biểu phí' })).toContainText('Biểu phí thử nghiệm');
  await expect(manager.getByRole('button', { name: 'Tạo phiên bản biểu phí' })).toHaveCount(0);
});
