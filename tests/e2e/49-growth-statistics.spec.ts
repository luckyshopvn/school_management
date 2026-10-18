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

// Cân nặng, chiều cao và thống kê theo tiêu chí ngành (DT-14 phần 14a, YCTD-102): y tế lập đợt cân đo, nhập số đo, "Tính và
// lưu" ra kênh tăng trưởng; quản lý đơn vị xem tổng hợp lọc theo kênh và xuất Excel, xem thống kê 5.1, 5.3 và hồ sơ chưa
// nhập đủ 5.8, mở hồ sơ học sinh từ danh sách. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

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

test('Y tế nhập cân đo, tính kênh tăng trưởng; quản lý xem tổng hợp, thống kê và hồ sơ chưa nhập đủ', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const nurse = await createTestUser(identity, { roles: [{ roleCode: 'VT-09', orgUnitId: reference.org_unit_id }] });
  const manager = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }],
  });
  const className = `Lớp cân đo ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `CD-${suffix}`,
      name: className,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const childName = `Học sinh Cân Đo ${suffix}`;
  const child = await schoolYear
    .insertInto('children')
    .values({
      org_unit_id: reference.org_unit_id,
      full_name: childName,
      dob: addDays(vietnamToday, -Math.round(40 * 30.4375)),
      gender: 'female',
      national_id_encrypted: 'ma-hoa',
      national_id_hash: randomUUID(),
      national_id_last4: '4949',
      photo_consent: 'pending',
      status: 'active',
      moet_profile: JSON.stringify({ ethnicity: `Dân tộc thử ${suffix}` }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('class_enrollments')
    .values({ child_id: child.id, class_id: classRow.id, from_date: addDays(vietnamToday, -30) })
    .execute();

  // 4.3.1: y tế lập đợt, nhập số đo, tính và lưu
  const nursePage = await signIn(browser, nurse);
  await openMenu(nursePage, '/growth');
  await expect(nursePage.getByRole('heading', { name: '4.3.1. Nhập kết quả sức khỏe nuôi dưỡng' })).toBeVisible();
  await nursePage.getByLabel('Tên đợt cân đo').fill(`Cân đo ${suffix}`);
  await nursePage.getByRole('button', { name: 'Lập đợt' }).click();
  await expect(nursePage.getByText('Đã lập đợt cân đo')).toBeVisible();
  await nursePage.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
  await nursePage.getByLabel(`Cân nặng của ${childName}`).fill('10,5');
  await nursePage.getByLabel(`Chiều cao của ${childName}`).fill('88');
  await nursePage.getByRole('button', { name: 'Tính và lưu' }).click();
  await expect(nursePage.getByText('Đã tính và lưu 1 học sinh')).toBeVisible();
  await expect(nursePage.getByTestId(`kenh-${child.id}`)).toContainText('Suy dinh dưỡng thể nhẹ cân');
  await expect(nursePage.getByTestId(`kenh-${child.id}`)).toContainText('Suy dinh dưỡng thể thấp còi');
  await nursePage.getByRole('button', { name: `Biểu đồ của ${childName}` }).click();
  await expect(nursePage.getByRole('img', { name: 'Cân nặng theo tuổi' })).toBeVisible();

  // 4.3.2: quản lý đơn vị lọc kênh nhẹ cân, xuất Excel
  const managerPage = await signIn(browser, manager);
  await openMenu(managerPage, '/growth-report');
  await expect(managerPage.getByRole('heading', { name: '4.3.2. Tổng hợp cân nặng, chiều cao' })).toBeVisible();
  await managerPage.getByLabel('Kênh').selectOption('underweight');
  await managerPage.getByRole('button', { name: 'Xem tổng hợp' }).click();
  await expect(managerPage.getByRole('region', { name: /Danh sách học sinh/ })).toContainText(childName);
  await expect(managerPage.getByRole('region', { name: 'Theo lớp' })).toContainText(className);
  const downloadPromise = managerPage.waitForEvent('download');
  await managerPage.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^tong-hop-can-do-.*\.xlsx$/);

  // 5.1, 5.3: thống kê lớp học, học sinh
  await openMenu(managerPage, '/statistics');
  await expect(managerPage.getByRole('heading', { name: '5.1 Thống kê lớp học' })).toBeVisible();
  await expect(managerPage.getByRole('region', { name: 'Lớp theo nhóm tuổi' })).toContainText('Mẫu giáo 3–4 tuổi');
  await managerPage.getByRole('tab', { name: '5.3 Thống kê học sinh' }).click();
  await expect(managerPage.getByRole('heading', { name: '5.3 Thống kê học sinh', level: 1 })).toBeVisible();
  // Thẻ 5.3 dùng màn hình thống kê học sinh đủ các phần của Sở (DT-16 phần 16h): bảng dân tộc ở phần Học sinh dân tộc
  await managerPage.getByRole('tab', { name: 'Học sinh dân tộc' }).click();
  await expect(managerPage.getByRole('region', { name: 'Học sinh theo dân tộc' })).toContainText(
    `Dân tộc thử ${suffix}`,
  );

  // 5.8: hồ sơ học sinh thiếu tôn giáo, mở hồ sơ từ danh sách
  await openMenu(managerPage, '/missing-profiles');
  await expect(managerPage.getByRole('heading', { name: '5.8 Thống kê hồ sơ học sinh chưa nhập đủ' })).toBeVisible();
  await managerPage.getByRole('button', { name: /hồ sơ thiếu Tôn giáo$/ }).click();
  const list = managerPage.getByRole('region', { name: 'Danh sách hồ sơ thiếu' });
  await list.getByRole('button', { name: childName }).click();
  await expect(managerPage.getByRole('region', { name: 'Hồ sơ đang mở' })).toContainText(childName);
  await managerPage.getByRole('tab', { name: 'Hồ sơ nhân sự' }).click();
  await expect(managerPage.getByRole('heading', { name: '5.9 Thống kê hồ sơ nhân sự chưa nhập đủ' })).toBeVisible();
});
