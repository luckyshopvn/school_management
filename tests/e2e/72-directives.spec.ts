import { expect, test, type Browser, type Page } from './fixtures.js';
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

// Giao việc, lịch đơn vị, phòng họp, hồ sơ công việc, báo cáo theo VNPT iOffice (DT-18 phần 18c, YCTD-141): lãnh đạo giao
// việc cho chuyên viên xử lý chính; chuyên viên cập nhật xong, chờ phê duyệt; lãnh đạo duyệt xử lý xong ở việc đã giao; văn
// thư khai báo phòng họp; lãnh đạo đăng ký lịch tuần có phòng họp, công bố; chuyên viên xem lịch họp, xuất Excel; chuyên viên
// lập hồ sơ công việc; lãnh đạo xem báo cáo tổng hợp. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

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

test('Giao việc, xử lý, phê duyệt; lịch tuần có phòng họp, lịch họp; hồ sơ công việc; báo cáo tổng hợp', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const clerk = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const handler = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: root.id }] });
  const names = {
    clerk: `Văn thư GV ${suffix}`,
    principal: `Hiệu trưởng GV ${suffix}`,
    handler: `Chuyên viên GV ${suffix}`,
  };
  for (const [index, [user, name]] of (
    [
      [clerk, names.clerk],
      [principal, names.principal],
      [handler, names.handler],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `GV-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
      })
      .execute();
  }
  const content = `Rà soát hồ sơ E2E ${suffix}`;

  // Lãnh đạo: 3.1 Giao việc cho chuyên viên xử lý chính, 3 ngày
  const leader = await signIn(browser, principal);
  await openMenu(leader, '/directives/new');
  await expect(leader.getByRole('heading', { name: '3.1. Giao việc' })).toBeVisible();
  const form = leader.getByRole('form', { name: 'Giao việc' });
  await form.getByLabel('Nội dung nhiệm vụ (*)').fill(content);
  await form.getByLabel('Số ngày thực hiện').fill('3');
  await form.getByLabel(`Vai của ${names.handler}`).selectOption('main');
  await form.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(leader.getByText(`Đã tạo công việc “${content}”`)).toBeVisible();

  // Chuyên viên: 3.2 Công việc cần xử lý, cập nhật 100% thì chờ phê duyệt
  const staff = await signIn(browser, handler);
  await openMenu(staff, '/directives/inbox');
  await staff.getByRole('cell', { name: content }).click();
  const panel = staff.getByLabel(`Chi tiết công việc ${content}`);
  await panel.getByRole('button', { name: 'Cập nhật tiến độ' }).click();
  await panel.getByLabel('Phần trăm hoàn thành').fill('100');
  await panel.getByLabel('Kết quả, ý kiến').fill('Đã rà soát xong');
  await panel.getByRole('button', { name: 'Ghi' }).click();
  await expect(panel.getByText('Chờ phê duyệt 100%')).toBeVisible();

  // Lãnh đạo: 3.3 Công việc đã giao, duyệt xử lý xong
  await openMenu(leader, '/directives/outbox');
  await leader.getByRole('cell', { name: content }).click();
  const outboxPanel = leader.getByLabel(`Chi tiết công việc ${content}`);
  await outboxPanel.getByRole('button', { name: 'Phê duyệt' }).click();
  await outboxPanel.getByRole('button', { name: 'Duyệt xử lý xong' }).click();
  await expect(outboxPanel.getByText('Đã hoàn thành 100%')).toBeVisible();

  // Văn thư: 5.4 Phòng họp
  const office = await signIn(browser, clerk);
  const roomName = `Phòng họp E2E ${suffix}`;
  await openMenu(office, '/meeting-rooms');
  await office.getByRole('button', { name: 'Thêm mới' }).click();
  const roomForm = office.getByRole('form', { name: 'Thêm mới phòng họp' });
  await roomForm.getByLabel('Tên phòng họp').fill(roomName);
  await roomForm.getByLabel('Sức chứa').fill('30');
  await roomForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(office.getByRole('row').filter({ hasText: roomName })).toBeVisible();

  // Lãnh đạo: 5.1 Đăng ký lịch đơn vị toàn trường thứ Hai buổi chiều, phòng họp tự duyệt, công bố
  const meeting = `Họp giao ban E2E ${suffix}`;
  await openMenu(leader, '/unit-schedules');
  const today = VIETNAM_DATE.format(new Date());
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = new Date(Date.parse(`${today}T00:00:00Z`) - weekday * 86_400_000).toISOString().slice(0, 10);
  const mondayText = monday.split('-').reverse().join('/');
  await leader.getByRole('button', { name: `Thêm chiều ${mondayText}` }).click();
  const entryForm = leader.getByRole('form', { name: 'Thêm lịch' });
  await entryForm.getByLabel('Giờ bắt đầu').fill('14:00');
  await entryForm.getByLabel('Giờ kết thúc').fill('15:30');
  await entryForm.getByLabel('Nội dung').fill(meeting);
  await entryForm.getByLabel('Chủ trì').fill(names.principal);
  await entryForm.getByLabel('Phòng họp').selectOption({ label: roomName });
  await entryForm.getByLabel('Người tham dự').selectOption({ label: names.handler });
  await entryForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(leader.getByText(meeting)).toBeVisible();
  await leader.getByRole('button', { name: 'Công bố lịch tuần' }).click();
  await expect(leader.getByText(/Đã công bố \d+ nội dung/)).toBeVisible();

  // Chuyên viên: 5.2 Lịch họp, Lịch của tôi, xuất Excel
  await openMenu(staff, '/meeting-schedules');
  await staff.getByRole('tab', { name: 'Lịch của tôi' }).click();
  await expect(staff.getByRole('table', { name: 'Lịch công tác' }).getByText(meeting)).toBeVisible();
  const download = staff.waitForEvent('download');
  await staff.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

  // Chuyên viên: 4.1 Hồ sơ cá nhân
  const fileTitle = `Hồ sơ rà soát E2E ${suffix}`;
  await openMenu(staff, '/work-files');
  await staff.getByRole('button', { name: 'Thêm mới' }).click();
  const fileForm = staff.getByRole('form', { name: 'Thêm mới hồ sơ công việc' });
  await fileForm.getByLabel('Số ký hiệu hồ sơ').fill(`HS-${suffix}`);
  await fileForm.getByLabel('Tiêu đề hồ sơ').fill(fileTitle);
  await fileForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(staff.getByRole('cell', { name: fileTitle })).toBeVisible();

  // Lãnh đạo: 6.2 Báo cáo tổng hợp
  await openMenu(leader, '/document-reports/summary');
  await leader.getByRole('button', { name: 'Xem báo cáo' }).click();
  await expect(leader.getByRole('columnheader', { name: 'Công việc được giao' })).toBeVisible();
});
