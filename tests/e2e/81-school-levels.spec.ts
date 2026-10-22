import { expect, test, type Browser, type Page } from './fixtures.js';
import { createDatabase, readConnectionString, type IdentityDatabase } from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import { openMenu } from './menu.js';

// Nền cấp học của trường (DT-19 phần 19a, YCTD-151), kịch bản CT-19a-6: trường hiện có tự nhận cấp Mầm non, ô ngữ cảnh
// "Cấp MN"; Hiệu trưởng bật Tiểu học ở thẻ "Cấp học của trường" (1.4 Cấu hình trường), ô ngữ cảnh đổi theo; tắt Mầm non
// đang có lớp thì hiện cảnh báo chỉ ẩn; đặt phạm vi cấp học cho một tài khoản; quản lý đơn vị chỉ xem thẻ. Cuối kịch bản trả lại
// cấu hình Mầm non để các kịch bản khác không đổi. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
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

test('CT-19a-6: bật cấp Tiểu học, ô ngữ cảnh đổi theo; tắt cấp có lớp chỉ ẩn; phạm vi cấp của tài khoản; quản lý đơn vị chỉ xem', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: null }] });
  const teacherName = `Quản lý cấp học ${suffix}`;
  await identity.updateTable('users').set({ full_name: teacherName }).where('id', '=', teacher.id).execute();

  const head = await signIn(browser, principal);
  await expect(head.getByTestId('academic-year-context')).toContainText('Cấp MN · ');
  await openMenu(head, '/settings');
  const card = head.getByRole('region', { name: 'Cấp học của trường' });
  await expect(card.getByLabel('Bật cấp MN', { exact: true })).toBeChecked();
  for (const code of ['TH', 'THCS', 'THPT']) {
    await expect(card.getByLabel(`Bật cấp ${code}`, { exact: true })).not.toBeChecked();
  }
  await expect(card.getByLabel('Gọi người học cấp MN', { exact: true })).toHaveValue('Trẻ');

  // Bật Tiểu học: ô ngữ cảnh ghép nhãn hai cấp
  await card.getByLabel('Bật cấp TH', { exact: true }).check();
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(head, 'Đã ghi cấp học của trường')).toBeVisible();
  await expect(head.getByTestId('academic-year-context')).toContainText('Cấp MN, Cấp TH · ');

  // Bỏ tích mọi cấp thì máy chủ từ chối (BR-147)
  await card.getByLabel('Bật cấp MN', { exact: true }).uncheck();
  await card.getByLabel('Bật cấp TH', { exact: true }).uncheck();
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(card.getByText('Trường phải bật ít nhất một cấp học')).toBeVisible();
  await card.getByLabel('Bật cấp TH', { exact: true }).check();
  // Mầm non đang có lớp từ các kịch bản trước: tắt chỉ ẩn, hiện cảnh báo số lớp
  await expect(card.getByText(/Cấp MN đang có \d+ lớp/)).toBeVisible();
  await card.getByLabel('Bật cấp MN', { exact: true }).check();
  await expect(card.getByText(/Cấp MN đang có \d+ lớp/)).toHaveCount(0);

  // Phạm vi cấp học của tài khoản: trường đã bật hai cấp nên khối phạm vi hiện ở chi tiết tài khoản
  await openMenu(head, '/accounts');
  const grid = head.getByRole('region', { name: 'Danh sách người dùng' });
  await grid.getByLabel('Tìm theo tên, số điện thoại, tên đăng nhập', { exact: true }).fill(teacher.username);
  await grid.getByRole('button', { name: `Hồ sơ ${teacherName}` }).click({ timeout: 30_000 });
  const detail = head.getByRole('region', { name: `Tài khoản ${teacherName}` });
  await expect(detail.getByText('PHẠM VI CẤP HỌC')).toBeVisible();
  await detail.getByLabel('Tiểu học', { exact: true }).check();
  await detail.getByRole('button', { name: 'Ghi phạm vi cấp học' }).click();
  await expect(toast(head, 'Đã ghi phạm vi cấp học')).toBeVisible();
  await expect
    .poll(async () =>
      (
        await identity
          .selectFrom('user_school_levels')
          .select('school_level')
          .where('user_id', '=', teacher.id)
          .execute()
      ).map((row) => row.school_level),
    )
    .toEqual(['TH']);

  // Quản lý đơn vị sửa được cấu hình đơn vị nhưng chỉ xem thẻ cấp học (thiếu P01.school-level.manage)
  const teacherPage = await signIn(browser, teacher);
  await teacherPage.goto('/settings');
  const teacherCard = teacherPage.getByRole('region', { name: 'Cấp học của trường' });
  await expect(teacherCard.getByLabel('Bật cấp TH', { exact: true })).toBeDisabled();
  await expect(teacherCard.getByRole('button', { name: 'Ghi cấp học' })).toHaveCount(0);

  // Trả lại cấu hình Mầm non
  await openMenu(head, '/settings');
  await card.getByLabel('Bật cấp TH', { exact: true }).uncheck();
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(head, 'Đã ghi cấp học của trường')).toBeVisible();
  await expect(head.getByTestId('academic-year-context')).toContainText('Cấp MN · ');
  await expect(head.getByTestId('academic-year-context')).not.toContainText('Cấp TH');
  await identity.deleteFrom('user_school_levels').where('user_id', '=', teacher.id).execute();
});
