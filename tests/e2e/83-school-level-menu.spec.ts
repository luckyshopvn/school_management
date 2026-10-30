import { expect, test, type Browser, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openGroup, openMenu, openWorkingContext, selectSchoolLevel, selectWorkspace, workspaceMenu } from './menu.js';

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

  // Kịch bản 82 trả cấu hình Mầm non thẳng trong cơ sở dữ liệu, máy chủ API còn giữ cấp cũ trong bộ nhớ đệm tới 30 giây: ghi
  // lại cấu hình Mầm non qua 1.4 để xóa bộ nhớ đệm trước khi kiểm tra
  await setPrimaryEnabled(page, false);
  await page.goto('/');

  // Trường chỉ có Mầm non: không có bộ chọn cấp, phân hệ và mục 4.3 như của Sở
  await expect(context).toContainText('Cấp MN · ');
  // Bộ chọn cấp nằm trong hộp ngữ cảnh (YCTD-331): mở hộp rồi mới kiểm tra
  await openWorkingContext(page);
  await expect(switcher).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Trẻ đang học', { exact: true })).toBeVisible();
  await openMenu(page, '/growth');

  try {
    // Bật Tiểu học: phân hệ thành "Quản lý giáo dục", bộ chọn cấp hiện, mặc định "Tất cả" nên mục Mầm non vẫn còn
    await setPrimaryEnabled(page, true);
    await openWorkingContext(page);
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveValue('all');
    await expect(context).toContainText('Cấp MN, Cấp TH · ');
    await selectWorkspace(page, 'Quản lý giáo dục');
    const education = workspaceMenu(page, 'Quản lý giáo dục');
    await openGroup(education, '4. Học sinh');
    await expect(education.getByRole('button', { name: '4.3. Cân nặng, chiều cao', exact: true })).toBeVisible();

    // Chọn Tiểu học: mục chỉ của Mầm non ẩn, tên phân hệ, ô ngữ cảnh và nhãn đổi theo cấp
    await selectSchoolLevel(page, 'TH');
    await expect(context).not.toContainText('Cấp MN');
    await selectWorkspace(page, 'Quản lý giáo dục Tiểu học');
    const primary = workspaceMenu(page, 'Quản lý giáo dục Tiểu học');
    await openGroup(primary, '4. Học sinh');
    await expect(primary.getByRole('link', { name: '4.2. Biến động học sinh', exact: true })).toBeVisible();
    await expect(primary.getByRole('button', { name: '4.3. Cân nặng, chiều cao', exact: true })).toHaveCount(0);
    await expect(primary.getByRole('link', { name: '4.4. Hoàn thành chương trình', exact: true })).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByText('Học sinh đang học', { exact: true })).toBeVisible();

    // Lựa chọn lưu theo tài khoản: tải lại vẫn là Tiểu học
    await page.reload();
    await openWorkingContext(page);
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
    await openWorkingContext(page);
    await switcher.selectOption('all');
    await expect(context).toContainText('Cấp MN, Cấp TH · ');
    await expect(page.getByText('Trẻ đang học', { exact: true })).toHaveCount(0);
  } finally {
    // Trả lại cấu hình Mầm non
    await setPrimaryEnabled(page, false);
    await identity.deleteFrom('user_preferences').where('user_id', '=', principal.id).execute();
  }
  await page.reload();
  // Bộ chọn cấp nằm trong hộp ngữ cảnh (YCTD-331): mở hộp rồi mới kiểm tra
  await openWorkingContext(page);
  await expect(switcher).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(context).toContainText('Cấp MN · ');
  await expect(page.getByRole('button', { name: 'Phân hệ: Quản lý giáo dục Mầm non', exact: true })).toBeVisible();
});

// YCTD-388: trường liên cấp không còn thấy tên dự phòng "Quản lý giáo dục Mầm non" ở hộp chọn trang của Truy cập nhanh và ở
// 1.2 Phân quyền nhóm theo phần mềm; chọn một cấp thì Truy cập nhanh theo tên cấp đó. Cuối kịch bản trả lại cấu hình Mầm non
test('CT-19c-11: trường liên cấp: Truy cập nhanh, 1.2 dùng tên phân hệ theo cấp, không còn tên Mầm non', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const page = await signIn(browser, principal);
  const quickAccess = page.getByRole('region', { name: 'Truy cập nhanh' });
  const picker = quickAccess.getByRole('dialog', { name: 'Chọn trang thêm vào truy cập nhanh' });
  try {
    await setPrimaryEnabled(page, true);

    // "Tất cả": nhóm trang của phân hệ là "Quản lý giáo dục"
    await page.goto('/');
    await quickAccess.getByRole('button', { name: 'Thêm truy cập nhanh' }).click();
    await expect(picker.getByRole('region', { name: 'Phân hệ Quản lý giáo dục', exact: true })).toBeVisible();
    await expect(picker.getByRole('region', { name: 'Phân hệ Quản lý giáo dục Mầm non', exact: true })).toHaveCount(0);
    await picker.getByRole('button', { name: 'Đóng' }).click();

    // Chọn Tiểu học: nhóm trang theo tên cấp
    await selectSchoolLevel(page, 'TH');
    await page.keyboard.press('Escape');
    await quickAccess.getByRole('button', { name: 'Thêm truy cập nhanh' }).click();
    await expect(picker.getByRole('region', { name: 'Phân hệ Quản lý giáo dục Tiểu học', exact: true })).toBeVisible();
    await expect(picker.getByRole('region', { name: 'Phân hệ Quản lý giáo dục Mầm non', exact: true })).toHaveCount(0);
    await picker.getByRole('button', { name: 'Đóng' }).click();

    // 1.2 theo cấp trường đã bật (Mầm non, Tiểu học): "Quản lý giáo dục"
    await page.goto('/role-workspaces');
    const choices = page.getByRole('region', { name: /^Phân hệ của / });
    await expect(choices.getByLabel('Quản lý giáo dục', { exact: true })).toBeVisible();
    await expect(choices.getByLabel('Quản lý giáo dục Mầm non', { exact: true })).toHaveCount(0);
  } finally {
    await setPrimaryEnabled(page, false);
    await identity.deleteFrom('user_preferences').where('user_id', '=', principal.id).execute();
  }

  // Trường chỉ có Mầm non: 1.2 giữ "Quản lý giáo dục Mầm non" như Sở
  await page.goto('/role-workspaces');
  await expect(
    page.getByRole('region', { name: /^Phân hệ của / }).getByLabel('Quản lý giáo dục Mầm non', { exact: true }),
  ).toBeVisible();
});
