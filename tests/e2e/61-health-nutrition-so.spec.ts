import { randomUUID } from 'node:crypto';
import { expect, test, type Browser } from './fixtures.js';
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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h): y tế nhập thông tin sức khỏe theo học
// kỳ (4.6.1) và "Lấy dữ liệu từ 4.3"; quản lý đơn vị xem tổng hợp cân đo theo học kỳ (4.3.2) và thống kê học sinh 5.3 (biết
// bơi, bệnh về mắt theo học kỳ, biểu đồ hoàn thành chương trình); bếp lập thực đơn có tên, khối áp dụng và mở nhập thực đơn
// từ Excel (4.5). Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(readConnectionString('system'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dateText = (value: unknown) => String(value instanceof Date ? value.toISOString() : value).slice(0, 10);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await system.destroy();
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

test('Y tế nhập sức khỏe theo học kỳ, lấy số đo 4.3; quản lý xem tổng hợp, thống kê 5.3; bếp lập thực đơn theo Sở', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  // Học kỳ chứa hôm nay theo lịch năm học như máy chủ tính
  const terms = await system
    .selectFrom('academic_terms')
    .select(['term_type', 'start_date'])
    .where('academic_year_id', '=', reference.academic_year_id)
    .execute();
  const second = terms.find((term) => term.term_type === 'second_term');
  const term =
    terms.length === 0
      ? Number(vietnamToday.slice(5, 7)) >= 8
        ? 'first_term'
        : 'second_term'
      : second && vietnamToday >= dateText(second.start_date)
        ? 'second_term'
        : 'first_term';
  const termLabel = term === 'first_term' ? 'Học kỳ I' : 'Học kỳ II';
  const suffix = Date.now() % 1_000_000;
  const nurse = await createTestUser(identity, { roles: [{ roleCode: 'VT-09', orgUnitId: reference.org_unit_id }] });
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  const kitchen = await createTestUser(identity, { roles: [{ roleCode: 'VT-10', orgUnitId: reference.org_unit_id }] });
  const className = `Lớp sức khỏe ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `SK-${suffix}`,
      name: className,
      grade_level: 'MAM',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const names = [`Học sinh Mắt ${suffix}`, `Học sinh Cân ${suffix}`];
  const childIds: string[] = [];
  for (const [index, name] of names.entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: addDays(vietnamToday, -Math.round((40 + index) * 30.4375)),
        gender: index === 0 ? 'female' : 'male',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '6060',
        photo_consent: 'pending',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds.push(child.id);
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: addDays(vietnamToday, -30) })
      .execute();
  }
  // Đợt cân đo hôm nay của đơn vị có số đo của học sinh thứ hai (4.3.1)
  const round = await schoolYear
    .insertInto('growth_rounds')
    .values({
      org_unit_id: reference.org_unit_id,
      name: `Cân đo sức khỏe ${suffix}`,
      measured_on: vietnamToday,
      created_by: randomUUID(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('health_measurements')
    .values({
      child_id: childIds[1] ?? '',
      measured_on: vietnamToday,
      growth_round_id: round.id,
      weight_kg: 15.2,
      height_cm: 99,
      vision_left: null,
      vision_right: null,
      note: null,
      recorded_by: randomUUID(),
    })
    .execute();

  // 4.6.1: y tế nhập thông tin sức khỏe theo học kỳ, lấy số đo từ 4.3
  const nursePage = await signIn(browser, nurse);
  await openMenu(nursePage, '/student-health');
  await expect(nursePage.getByRole('heading', { name: '4.6.1. Nhập thông tin sức khỏe học sinh' })).toBeVisible();
  await nursePage.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
  await nursePage.getByLabel('Học kỳ', { exact: true }).selectOption(term);
  const table = nursePage.getByRole('region', { name: 'Bảng thông tin sức khỏe' });
  await expect(table).toContainText(names[0] ?? '');
  await table.getByLabel(`Giáo dục thể chất của ${names[0]}`).selectOption({ label: 'Đạt' });
  await table.getByLabel(`Biết bơi của ${names[0]}`).selectOption({ label: 'Có' });
  await table.getByLabel(`Cận thị của ${names[0]}`).check();
  await table.getByLabel(`Lác của ${names[0]}`).check();
  await table.getByRole('button', { name: 'Ghi' }).click();
  await expect(nursePage.getByText('Đã ghi thông tin sức khỏe của 1 học sinh')).toBeVisible();
  await table.getByRole('button', { name: 'Lấy dữ liệu từ 4.3' }).click();
  await expect(nursePage.getByText('Đã lấy số đo của 1 học sinh từ 4.3')).toBeVisible();
  await expect(table.getByLabel(`Cân nặng của ${names[1]}`)).toHaveValue('15.2');
  await expect(table.getByLabel(`Cận thị của ${names[0]}`)).toBeChecked();
  const downloadPromise = nursePage.waitForEvent('download');
  await table.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^suc-khoe-hoc-sinh-hk[12]\.xlsx$/);

  // 4.3.2: tổng hợp theo học kỳ
  const managerPage = await signIn(browser, manager);
  await openMenu(managerPage, '/growth-report');
  await managerPage.getByLabel('Tổng hợp theo').selectOption('term');
  await managerPage.getByLabel('Học kỳ', { exact: true }).selectOption(term);
  await managerPage.getByRole('button', { name: 'Xem tổng hợp' }).click();
  await expect(managerPage.getByRole('region', { name: 'Theo lớp' })).toContainText(className);

  // 5.3: biết bơi, bệnh về mắt theo học kỳ; biểu đồ hoàn thành chương trình
  await openMenu(managerPage, '/student-statistics');
  await expect(managerPage.getByRole('heading', { name: '5.3. Thống kê học sinh' })).toBeVisible();
  await managerPage.getByLabel('Học kỳ', { exact: true }).selectOption(term);
  await managerPage.getByRole('tab', { name: 'Biết bơi, bệnh về mắt theo học kỳ' }).click();
  await expect(managerPage.getByText(termLabel, { exact: false }).first()).toBeVisible();
  await expect(managerPage.getByRole('region', { name: 'Bệnh về mắt theo học kỳ' })).toContainText('Lác');
  await managerPage.getByRole('tab', { name: 'Biểu đồ hoàn thành chương trình' }).click();
  await expect(managerPage.getByRole('region', { name: 'Biểu đồ hoàn thành chương trình' })).toContainText(
    'Con thương binh, liệt sĩ',
  );
  await managerPage.getByRole('tab', { name: 'Tìm học sinh thiếu thông tin' }).click();
  await expect(managerPage.getByRole('button', { name: /hồ sơ thiếu Tôn giáo$/ })).toBeVisible();

  // 4.5: bếp lập thực đơn có tên, khối áp dụng; mở nhập thực đơn từ Excel
  const kitchenPage = await signIn(browser, kitchen);
  await openMenu(kitchenPage, '/kitchen');
  const weekStart = (() => {
    const date = addDays(vietnamToday, 7 * (320 + (suffix % 200)));
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return addDays(date, -(day === 0 ? 6 : day - 1));
  })();
  const createForm = kitchenPage.getByRole('form', { name: 'Lập thực đơn' });
  await createForm.getByLabel('Tên thực đơn').fill(`Thực đơn Sở ${suffix}`);
  await createForm.getByLabel('Từ ngày').fill(weekStart);
  await createForm.getByLabel('Đến ngày').fill(addDays(weekStart, 4));
  await createForm.getByRole('button', { name: 'Lập thực đơn' }).click();
  await expect(kitchenPage.getByText('Đã lập thực đơn nháp')).toBeVisible();
  const detail = kitchenPage.getByRole('region', { name: 'Chi tiết thực đơn' });
  await expect(detail).toContainText(`Thực đơn Sở ${suffix}`);
  await detail.getByRole('button', { name: 'Thay đổi' }).click();
  const headerForm = detail.getByRole('form', { name: 'Thay đổi thông tin thực đơn' });
  await headerForm.getByLabel('Tên thực đơn').fill(`Thực đơn Sở sửa ${suffix}`);
  await headerForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(kitchenPage.getByText('Đã thay đổi thông tin thực đơn')).toBeVisible();
  await expect(detail).toContainText(`Thực đơn Sở sửa ${suffix}`);
  await createForm.getByRole('button', { name: 'Nhập từ Excel' }).click();
  const importPanel = kitchenPage.getByRole('region', { name: 'Nhập thực đơn bữa ăn từ Excel' });
  await importPanel.getByRole('button', { name: 'Tra cứu danh mục' }).click();
  await expect(importPanel.getByRole('combobox', { name: 'Danh mục' })).toBeVisible();
  const templatePromise = kitchenPage.waitForEvent('download');
  await importPanel.getByRole('button', { name: 'Tải file mẫu' }).click();
  expect((await templatePromise).suggestedFilename()).toBe('mau-nhap-thuc-don.xlsx');
});
