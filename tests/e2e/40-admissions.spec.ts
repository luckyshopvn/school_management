import { randomInt } from 'node:crypto';
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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';

// Tuyển sinh trực tuyến (DT-11 phần 11a, YCTD-86): phụ huynh không đăng nhập xem tin tuyển sinh kèm thời hạn (CT-124)
// và nộp hồ sơ trên ứng dụng phụ huynh; nhân viên tuyển sinh kiêm quản lý đơn vị tiếp nhận, xét đạt và chuyển thành hồ
// sơ trẻ đang học trên cổng quản trị (CT-076); phụ huynh tra cứu thấy đã nhập học
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

test.beforeAll(async () => {
  const systemUrl = readConnectionString('system');
  const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
  schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
});

test.afterAll(async () => {
  await schoolYear.destroy();
  await identity.destroy();
});

test('CT-124, CT-076: phụ huynh nộp hồ sơ trực tuyến; nhà trường xét đạt và chuyển thành hồ sơ trẻ đang học', async ({
  browser,
}) => {
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .executeTakeFirstOrThrow();
  const suffix = Date.now() % 1_000_000;
  const staff = await createTestUser(identity, {
    roles: [
      { roleCode: 'VT-12', orgUnitId: reference.org_unit_id },
      { roleCode: 'VT-03', orgUnitId: reference.org_unit_id },
    ],
  });
  const className = `Lớp tuyển sinh ${suffix}`;
  await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `TS-${suffix}`,
      name: className,
      grade_level: 'MAM',
      max_size: 30,
    })
    .execute();
  const relationship = await schoolYear
    .selectFrom('catalog_items')
    .select('name')
    .where('catalog_type', '=', 'parent_relationship')
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  const campaignName = `Tuyển sinh e2e ${suffix}`;
  const campaign = await schoolYear
    .insertInto('admission_campaigns')
    .values({
      org_unit_id: reference.org_unit_id,
      name: campaignName,
      quota: 10,
      open_from: addDays(vietnamToday, -1),
      open_to: addDays(vietnamToday, 20),
      status: 'open',
      opened_at: new Date(),
      created_by: staff.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const postTitle = `Thông báo tuyển sinh ${suffix}`;
  await schoolYear
    .insertInto('admission_posts')
    .values({
      campaign_id: campaign.id,
      title: postTitle,
      content: 'Nhận hồ sơ trẻ từ 24 tháng tuổi.',
      publish_from: vietnamToday,
      publish_to: addDays(vietnamToday, 15),
      status: 'published',
      published_at: new Date(),
      created_by: staff.id,
    })
    .execute();

  const childName = `Bé Tuyển Sinh ${suffix}`;
  const phone = `07${String(suffix).padStart(8, '0')}`;
  const parentPage = await (await browser.newContext()).newPage();
  await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
  await parentPage.getByRole('button', { name: 'Tuyển sinh trực tuyến' }).click();
  const post = parentPage.getByRole('listitem', { name: postTitle });
  await expect(post).toContainText('Nhận hồ sơ trẻ từ 24 tháng tuổi.');
  await expect(post).toContainText(`Thời hạn: ${addDays(vietnamToday, 15)}`);
  const form = parentPage.getByRole('form', { name: 'Nộp hồ sơ tuyển sinh' });
  await form.getByLabel('Đợt tuyển sinh').selectOption({ label: campaignName });
  await form.getByLabel('Họ tên trẻ').fill(childName);
  await form.getByLabel('Ngày sinh của trẻ').fill('2023-05-20');
  await form.getByLabel('Trẻ có dị ứng không').selectOption({ label: 'Không có dị ứng' });
  await form.getByLabel('Họ tên phụ huynh').fill('Phụ huynh tuyển sinh');
  await form.getByLabel('Số điện thoại phụ huynh').fill(phone);
  await form.getByLabel('Quan hệ với trẻ').selectOption({ label: relationship.name });
  await form.getByRole('button', { name: 'Nộp hồ sơ' }).click();
  const submitted = parentPage.getByText(/Đã nộp hồ sơ TS-\d{6}/);
  await expect(submitted).toBeVisible();
  const code = /TS-\d{6}/.exec((await submitted.textContent()) ?? '')?.[0] ?? '';

  const staffPage = await (await browser.newContext()).newPage();
  await staffPage.goto('/');
  await staffPage.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(staff.username);
  await staffPage.getByLabel('Mật khẩu', { exact: true }).fill(staff.password);
  await staffPage.getByRole('button', { name: 'Đăng nhập' }).click();
  await staffPage.getByRole('link', { name: 'Tuyển sinh', exact: true }).click();
  await staffPage.getByLabel('Đợt đang xem').selectOption({ label: `${campaignName} (Đang mở)` });
  await staffPage.getByRole('button', { name: `Xem hồ sơ ${code}` }).click();
  const panel = staffPage.getByRole('region', { name: `Hồ sơ tuyển sinh ${code}` });
  await panel.getByRole('button', { name: 'Tiếp nhận hồ sơ' }).click();
  await expect(staffPage.getByText('Đã tiếp nhận hồ sơ')).toBeVisible();
  await panel.getByRole('button', { name: 'Xét đạt' }).click();
  await expect(staffPage.getByText('Đã xét hồ sơ đạt')).toBeVisible();
  const convert = panel.getByRole('form', { name: 'Chuyển thành hồ sơ trẻ' });
  await convert.getByRole('combobox', { name: 'Lớp', exact: true }).selectOption({ label: `${className} (0/30)` });
  await convert
    .getByLabel('Số định danh cá nhân của trẻ')
    .fill(`079${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`);
  await convert
    .getByLabel('Bản chụp giấy khai sinh')
    .setInputFiles({ name: 'giay-khai-sinh.png', mimeType: 'image/png', buffer: PNG });
  await convert.getByRole('button', { name: 'Chuyển thành hồ sơ trẻ' }).click();
  await expect(staffPage.getByText(`${childName} đang học lớp ${className}`)).toBeVisible({ timeout: 20_000 });

  const lookup = parentPage.getByRole('form', { name: 'Tra cứu hồ sơ tuyển sinh' });
  await lookup.getByLabel('Mã hồ sơ').fill(code);
  await lookup.getByLabel('Số điện thoại đã khai').fill(phone);
  await lookup.getByRole('button', { name: 'Tra cứu' }).click();
  await expect(lookup.getByRole('status')).toContainText('Đã nhập học');
});
