import { expect, test } from '@playwright/test';
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

// Kết nối ngoài (DT-11 phần 11e, YCTD-90; CT-202, CT-203): Hiệu trưởng bật Fanpage trên trang Kết nối ngoài; quản lý đơn
// vị đăng hoạt động đã công bố lên Fanpage (máy chủ kiểm thử dùng bộ giả lập FACEBOOK_PUBLISHER=development)
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

test('Hiệu trưởng bật Fanpage; quản lý đơn vị đăng hoạt động đã công bố lên Fanpage', async ({ browser }) => {
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const reference = await schoolYear.selectFrom('classes').select(['id', 'org_unit_id']).executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: root.id }] });
  const manager = await createTestUser(identity, { roles: [{ roleCode: 'VT-03', orgUnitId: reference.org_unit_id }] });
  const category = await schoolYear
    .insertInto('activity_categories')
    .values({ org_unit_id: reference.org_unit_id, name: `Fanpage ${suffix}`, created_by: manager.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const title = `Bé trồng cây ${suffix}`;
  await schoolYear
    .insertInto('activities')
    .values({
      org_unit_id: reference.org_unit_id,
      class_id: reference.id,
      category_id: category.id,
      title,
      content: 'Các bé trồng cây trong vườn trường',
      activity_date: '2026-10-01',
      status: 'published',
      created_by: manager.id,
      created_by_name: 'Quản lý',
      approved_by: manager.id,
      approved_at: new Date(),
      published_at: new Date(),
    })
    .execute();

  const principalPage = await (await browser.newContext()).newPage();
  await principalPage.goto('/');
  await principalPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await principalPage.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await principalPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await principalPage.getByRole('link', { name: 'Kết nối ngoài' }).click();
  const facebookForm = principalPage.getByRole('form', { name: 'Fanpage Facebook' });
  await expect(facebookForm).toContainText('Đã có khóa truy cập ở máy chủ');
  await facebookForm.getByLabel('Bật kết nối Fanpage Facebook').check();
  await facebookForm.getByLabel('Mã trang').fill('1234567890');
  await facebookForm.getByLabel('Tên trang').fill('Trường Mầm non');
  await facebookForm.getByRole('button', { name: 'Lưu Fanpage Facebook' }).click();
  await expect(principalPage.getByText('Đã lưu Fanpage Facebook')).toBeVisible();

  const managerPage = await (await browser.newContext()).newPage();
  await managerPage.goto('/');
  await managerPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(manager.username);
  await managerPage.getByLabel('Mật khẩu', { exact: true }).fill(manager.password);
  await managerPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await managerPage.getByRole('link', { name: 'Hoạt động và tin tức' }).click();
  await managerPage.getByLabel('Trạng thái').selectOption('published');
  const article = managerPage.getByRole('article', { name: title });
  await article.getByRole('button', { name: 'Đăng lên Fanpage' }).click();
  await expect(article).toContainText('Đã đăng lên Fanpage');
});
