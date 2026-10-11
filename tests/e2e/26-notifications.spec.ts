import { randomUUID } from 'node:crypto';
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

// Trung tâm thông báo (DT-08 phần 8a, YCTD-64): nhân sự thấy số thông báo chưa đọc, mở và đánh dấu đã đọc
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

test('Kế toán thấy thông báo chưa đọc và đánh dấu đã đọc', async ({ browser }) => {
  const unit = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '!=', 'truong_chinh')
    .orderBy('code')
    .executeTakeFirstOrThrow();
  const accountant = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: unit.id }] });
  const title = `Thông báo kiểm thử ${Date.now() % 1_000_000}`;
  const notification = await schoolYear
    .insertInto('notifications')
    .values({
      org_unit_id: unit.id,
      template_code: 'e2e_test',
      title,
      body: 'Nội dung kiểm thử',
      target_type: 'e2e',
      target_id: randomUUID(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await schoolYear
    .insertInto('notification_recipients')
    .values({ notification_id: notification.id, user_id: accountant.id, channel: 'in_app' })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(accountant.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(accountant.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.getByRole('link', { name: /^Thông báo \(\d+\)$/ }).click();
  const item = page.getByRole('listitem', { name: `Thông báo ${title}` });
  await expect(item).toContainText('Nội dung kiểm thử');
  await item.getByRole('button', { name: 'Đã đọc' }).click();
  await expect(item.getByRole('button', { name: 'Đã đọc' })).toHaveCount(0);
});
