import { expect, test, type Browser, type Locator, type Page } from './fixtures.js';
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

// Văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140): chuyên viên soạn dự thảo kèm tệp, lấy ý kiến; người được hỏi cho
// ý kiến; kết thúc lấy ý kiến, trình ký; hiệu trưởng ký nội bộ (mã QR); văn thư khai báo sổ văn bản đi, cấp số và phát hành
// (phân hiệu nhận văn bản đến chờ vào sổ), đánh dấu đã gửi đơn vị bên ngoài, public lên cổng, đóng băng; sổ đăng ký văn bản
// đi xuất Excel; trang tra cứu mã QR công khai. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(readConnectionString('system'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;

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

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

async function selectByText(select: Locator, text: string) {
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value ?? '');
}

// Con trỏ dừng trên thanh menu thì menu thả xuống che các thẻ: dời chuột, đóng menu rồi mới bấm thẻ
async function openTab(page: Page, name: string) {
  await page.mouse.move(5, 700);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name, exact: true }).click();
}

async function openDocument(page: Page, label: string) {
  const row = page.getByRole('row', { name: `Văn bản đi ${label}` });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Thao tác văn bản đi' })).toBeVisible();
}

test('Soạn dự thảo, lấy ý kiến, trình ký, ký nội bộ, cấp số và phát hành, liên thông nội bộ, đánh dấu gửi, tra cứu QR', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('parent_id', 'is', null)
    .orderBy('created_at')
    .executeTakeFirstOrThrow();
  const branchName = `Phân hiệu E2E ${suffix}`;
  await schoolYear
    .insertInto('org_units')
    .values({ code: `PH-${suffix}`, name: branchName, unit_type: 'phan_hieu', parent_id: root.id })
    .execute();
  const clerk = await createTestUser(identity, { roles: [{ roleCode: 'VT-06', orgUnitId: null }] });
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const drafter = await createTestUser(identity, { roles: [{ roleCode: 'VT-04', orgUnitId: root.id }] });
  const reviewer = await createTestUser(identity, { roles: [{ roleCode: 'VT-09', orgUnitId: root.id }] });
  const names = {
    clerk: `Văn thư đi E2E ${suffix}`,
    principal: `Hiệu trưởng đi E2E ${suffix}`,
    drafter: `Chuyên viên soạn E2E ${suffix}`,
    reviewer: `Tổ trưởng góp ý E2E ${suffix}`,
  };
  const people = [
    [clerk, names.clerk],
    [principal, names.principal],
    [drafter, names.drafter],
    [reviewer, names.reviewer],
  ] as const;
  for (const [index, [user, name]] of people.entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `VBDI-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
      })
      .execute();
  }
  // Lãnh đạo nhận văn bản (2.5) và đơn vị bên ngoài (2.2) đã có kịch bản giao diện ở spec 70: ghi thẳng dữ liệu
  await system
    .insertInto('document_leaders')
    .values({ user_id: principal.id, user_name: names.principal, title: 'Hiệu trưởng' })
    .execute();
  const externalName = `Phòng Giáo dục nhận E2E ${suffix}`;
  await system
    .insertInto('external_units')
    .values({ code: `PGD-DI-${suffix}`, name: externalName })
    .execute();
  // Chứng thư nhà trường đăng ký kí nội bộ (giao diện ở spec 66)
  await system
    .insertInto('signing_certificates')
    .values({ singleton: true })
    .onConflict((conflict) => conflict.column('singleton').doNothing())
    .execute();
  await system
    .updateTable('signing_certificates')
    .set({
      status: 'registered',
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-e2e',
      holder_name: 'Hiệu trưởng E2E',
      holder_title: 'Hiệu trưởng',
      valid_to: '2099-12-31',
    })
    .execute();
  const summary = `V/v tổ chức hội nghị E2E ${suffix}`;

  // Chuyên viên: 3.1 Văn bản đi, Thêm mới dự thảo
  const page = await signIn(browser, drafter);
  await openMenu(page, '/outgoing-documents');
  await expect(page.getByRole('heading', { name: '3.1. Văn bản đi' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'Thêm mới văn bản đi' });
  await form.getByLabel('Trích yếu').fill(summary);
  await form.getByLabel('Số trình ký').fill(`TT-${suffix}`);
  await form.getByLabel('Hình thức').selectOption({ label: 'Thông báo' });
  await selectByText(form.getByLabel('Người ký'), names.principal);
  await selectByText(form.getByLabel('Thêm đơn vị nhận'), branchName);
  await selectByText(form.getByLabel('Thêm đơn vị nhận'), externalName);
  await expect(form.getByRole('list', { name: 'Đơn vị dự kiến nhận' })).toContainText(branchName);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã tạo dự thảo số eOffice \d+/)).toBeVisible();
  const created = await system
    .selectFrom('outgoing_documents')
    .select('eoffice_number')
    .where('summary', '=', summary)
    .executeTakeFirstOrThrow();
  const draftLabel = `eOffice ${created.eoffice_number}`;
  const toolbar = page.getByRole('toolbar', { name: 'Thao tác văn bản đi' });
  await expect(toolbar).toBeVisible();
  await page.getByLabel('Thêm tệp (tối đa 50 MB)').setInputFiles({
    name: 'du-thao.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await expect(page.getByRole('list', { name: 'Danh sách tệp đính kèm' })).toContainText('du-thao.pdf');
  await toolbar.getByRole('button', { name: 'Lấy ý kiến' }).click();
  const consult = page.getByRole('dialog');
  await consult.getByLabel('Tìm người cho ý kiến').fill(names.reviewer);
  await consult.getByLabel(names.reviewer).check();
  await consult.getByRole('button', { name: 'Lấy ý kiến', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Người được hỏi: Chờ xử lý, Cho ý kiến
  const reviewerPage = await signIn(browser, reviewer);
  await openMenu(reviewerPage, '/outgoing-documents');
  await openTab(reviewerPage, 'Chờ xử lý');
  await openDocument(reviewerPage, draftLabel);
  await reviewerPage.getByRole('button', { name: 'Cho ý kiến', exact: true }).click();
  const opinion = reviewerPage.getByRole('dialog');
  await opinion.getByLabel('Ý kiến').fill('Thống nhất nội dung dự thảo');
  await opinion.getByRole('button', { name: 'Gửi ý kiến' }).click();
  await expect(reviewerPage.getByRole('dialog')).toHaveCount(0);

  // Chuyên viên: xem ý kiến, kết thúc lấy ý kiến, trình ký
  await openTab(page, 'Dự thảo');
  await openDocument(page, draftLabel);
  await openTab(page, 'Ý kiến góp ý');
  await expect(page.getByRole('table', { name: 'Ý kiến góp ý' })).toContainText('Thống nhất nội dung dự thảo');
  await toolbar.getByRole('button', { name: 'Kết thúc lấy ý kiến' }).click();
  await toolbar.getByRole('button', { name: 'Trình ký' }).click();
  const submit = page.getByRole('dialog');
  await submit.getByLabel('Ý kiến trình').fill('Kính trình Hiệu trưởng ký');
  await submit.getByRole('button', { name: 'Trình ký', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Hiệu trưởng: Chờ xử lý, Ký
  const leaderPage = await signIn(browser, principal);
  await openMenu(leaderPage, '/outgoing-documents');
  await openTab(leaderPage, 'Chờ xử lý');
  await openDocument(leaderPage, draftLabel);
  await leaderPage
    .getByRole('toolbar', { name: 'Thao tác văn bản đi' })
    .getByRole('button', { name: 'Ký', exact: true })
    .click();
  await leaderPage.getByRole('dialog').getByRole('button', { name: 'Ký', exact: true }).click();
  await expect(leaderPage.getByRole('dialog')).toHaveCount(0);
  await expect(leaderPage.getByText('Đã ký, chờ cấp số')).toBeVisible();

  // Văn thư: 2.1 khai báo sổ văn bản đi
  const clerkPage = await signIn(browser, clerk);
  await openMenu(clerkPage, '/document-books');
  await openTab(clerkPage, 'Khai báo sổ văn bản đi');
  const bookName = `Sổ văn bản đi E2E ${suffix}`;
  await clerkPage.getByRole('button', { name: 'Thêm mới' }).click();
  const bookForm = clerkPage.getByRole('form', { name: 'Thêm mới sổ văn bản' });
  await bookForm.getByLabel('Tên sổ văn bản').fill(bookName);
  await bookForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(clerkPage.getByRole('row').filter({ hasText: bookName })).toBeVisible();

  // 3.2 Quản lý văn bản đi: Chờ cấp số, Cấp số và phát hành
  await openMenu(clerkPage, '/outgoing-documents/manage');
  await expect(clerkPage.getByRole('heading', { name: '3.2. Quản lý văn bản đi' })).toBeVisible();
  await openDocument(clerkPage, draftLabel);
  const clerkToolbar = clerkPage.getByRole('toolbar', { name: 'Thao tác văn bản đi' });
  await clerkToolbar.getByRole('button', { name: 'Cấp số và phát hành' }).click();
  const issue = clerkPage.getByRole('dialog');
  await selectByText(issue.getByLabel('Sổ văn bản đi'), bookName);
  await issue.getByLabel('Ký hiệu sau số (ví dụ QĐ-THCS)').fill(`TB-E2E${suffix}`);
  await issue.getByLabel('Số bản').fill('2');
  await issue.getByRole('button', { name: 'Cấp số và phát hành', exact: true }).click();
  await expect(clerkPage.getByRole('dialog')).toHaveCount(0);
  const issued = await system
    .selectFrom('outgoing_documents')
    .select(['symbol', 'verification_code'])
    .where('summary', '=', summary)
    .executeTakeFirstOrThrow();
  expect(issued.symbol).toMatch(new RegExp(`^\\d+/TB-E2E${suffix}$`));
  await expect(clerkPage.getByText('Đã ban hành', { exact: false }).first()).toBeVisible();

  // Thông tin gửi: phân hiệu đã nhận qua liên thông nội bộ; đơn vị bên ngoài đánh dấu đã gửi
  await openTab(clerkPage, 'Thông tin gửi');
  const recipients = clerkPage.getByRole('table', { name: 'Đơn vị nhận' });
  await expect(recipients.getByRole('row').filter({ hasText: branchName })).toContainText('Đã chuyển vào văn bản đến');
  await expect(recipients.getByRole('row').filter({ hasText: externalName })).toContainText('Chờ gửi');
  await clerkPage.getByLabel('Ghi chú gửi (cách gửi, mã tham chiếu)').fill('Gửi thư điện tử');
  await clerkPage.getByRole('button', { name: 'Đánh dấu đã gửi' }).click();
  await expect(recipients.getByRole('row').filter({ hasText: externalName })).toContainText('Đã đánh dấu gửi');
  await clerkToolbar.getByRole('button', { name: 'Public lên cổng TTĐT' }).click();
  await expect(clerkToolbar.getByRole('button', { name: 'Ẩn VB trên cổng TTĐT' })).toBeVisible();
  await clerkToolbar.getByRole('button', { name: 'Đóng băng' }).click();
  await expect(clerkToolbar.getByRole('button', { name: 'Hủy đóng băng' })).toBeVisible();
  await expect(clerkToolbar.getByRole('button', { name: 'Ẩn VB trên cổng TTĐT' })).toHaveCount(0);

  // Phân hiệu: văn bản đến chờ vào sổ ở 1.7 Liên thông văn bản
  await openMenu(clerkPage, '/incoming-documents/interconnect');
  await expect(clerkPage.getByRole('row', { name: `Văn bản ${issued.symbol}` })).toBeVisible();

  // Sổ đăng ký văn bản đi, xuất Excel
  await openMenu(clerkPage, '/document-books');
  await openTab(clerkPage, 'Sổ đăng ký văn bản đi');
  await clerkPage.getByRole('combobox', { name: 'Sổ văn bản', exact: true }).selectOption({ label: bookName });
  await expect(clerkPage.getByRole('row').filter({ hasText: issued.symbol ?? '' })).toContainText(names.principal);
  const register = clerkPage.waitForEvent('download');
  await clerkPage.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await register).suggestedFilename()).toMatch(/^so-van-ban-di-\d{4}-.*\.xlsx$/);

  // Trang tra cứu mã QR, không đăng nhập
  const publicPage = await (await browser.newContext()).newPage();
  await publicPage.goto(`/tra-cuu-van-ban?ma=${issued.verification_code ?? ''}`);
  const result = publicPage.getByRole('region', { name: 'Kết quả tra cứu' });
  await expect(result).toContainText('Văn bản đã ban hành');
  await expect(result).toContainText(issued.symbol ?? '');
  await expect(result).toContainText(summary);
});
