import { expect, test, type Browser, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { menubar, openMenu, selectWorkspace } from './menu.js';

// Menu và phân hệ theo cấp học (DT-19 phần 19c, YCTD-153), kịch bản CT-19c-9: trường mầm non giữ y hệt menu, không có bộ
// chọn cấp; Hiệu trưởng bật Tiểu học thì phân hệ thành "Quản lý giáo dục" và có bộ chọn cấp ("Tất cả" mặc định); chọn Tiểu
// học thì mục chỉ của Mầm non ẩn, tên phân hệ, ô ngữ cảnh, nhãn "Học sinh" đổi theo; lựa chọn giữ sau khi tải lại. Cuối kịch
// bản trả lại cấu hình Mầm non để các kịch bản khác không đổi. Chạy sau 02-academic-years, 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));

test.afterAll(async () => {
  await identity.destroy();
});

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập', { exact: true }).fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setPrimaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const primary = card.getByLabel('Bật cấp TH', { exact: true });
  if (enabled) {
    await primary.check();
  } else {
    await primary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-19c-9: trường mầm non giữ menu; bật Tiểu học có bộ chọn cấp, menu, tên phân hệ, nhãn theo cấp đang làm việc', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await signIn(browser, principal);
  const switcher = page.getByTestId('school-level-switcher');
  const context = page.getByTestId('academic-year-context');

  // Trường chỉ có Mầm non: không có bộ chọn cấp, phân hệ và mục 4.3 như của Sở
  await expect(context).toContainText('Cấp MN · ');
  await expect(switcher).toHaveCount(0);
  await expect(page.getByText('Trẻ đang học', { exact: true })).toBeVisible();
  await openMenu(page, '/growth');

  try {
    // Bật Tiểu học: phân hệ thành "Quản lý giáo dục", bộ chọn cấp hiện, mặc định "Tất cả" nên mục Mầm non vẫn còn
    await setPrimaryEnabled(page, true);
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveValue('all');
    await expect(context).toContainText('Cấp MN, Cấp TH · ');
    await selectWorkspace(page, 'Quản lý giáo dục');
    const education = menubar(page, 'Quản lý giáo dục');
    await education.getByRole('menuitem', { name: '4. Học sinh', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '4.3. Cân nặng, chiều cao', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Chọn Tiểu học: mục chỉ của Mầm non ẩn, tên phân hệ, ô ngữ cảnh và nhãn đổi theo cấp
    await switcher.selectOption('TH');
    await expect(context).toContainText('Cấp TH · ');
    await expect(context).not.toContainText('Cấp MN');
    await selectWorkspace(page, 'Quản lý giáo dục Tiểu học');
    const primary = menubar(page, 'Quản lý giáo dục Tiểu học');
    await primary.getByRole('menuitem', { name: '4. Học sinh', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '4.2. Biến động học sinh', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '4.3. Cân nặng, chiều cao', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: '4.4. Hoàn thành chương trình', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/');
    await expect(page.getByText('Học sinh đang học', { exact: true })).toBeVisible();

    // Lựa chọn lưu theo tài khoản: tải lại vẫn là Tiểu học
    await page.reload();
    await expect(switcher).toHaveValue('TH');
    await expect(context).toContainText('Cấp TH · ');
    await expect
      .poll(
        async () =>
          (
            await identity
              .selectFrom('user_preferences')
              .select('working_school_level')
              .where('user_id', '=', principal.id)
              .executeTakeFirst()
          )?.working_school_level,
      )
      .toBe('TH');

    // Về "Tất cả"
    await switcher.selectOption('all');
    await expect(context).toContainText('Cấp MN, Cấp TH · ');
    await expect(page.getByText('Trẻ đang học', { exact: true })).toHaveCount(0);
  } finally {
    // Trả lại cấu hình Mầm non
    await setPrimaryEnabled(page, false);
    await identity.deleteFrom('user_preferences').where('user_id', '=', principal.id).execute();
  }
  await page.reload();
  await expect(switcher).toHaveCount(0);
  await expect(context).toContainText('Cấp MN · ');
  await expect(page.getByRole('button', { name: 'Phân hệ: Quản lý giáo dục Mầm non', exact: true })).toBeVisible();
});
