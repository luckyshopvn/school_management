import { expect, test, type Browser, type Locator, type Page } from './fixtures.js';
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

// Văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138): văn thư khai báo đơn vị bên ngoài, sổ văn bản đến, lãnh đạo nhận
// văn bản; vào sổ văn bản kèm tệp quét, trình lãnh đạo; lãnh đạo chuyển xử lý chính; chuyên viên lọc theo vai trò, xử lý
// xong; lãnh đạo kết thúc văn bản; in phiếu xử lý; sổ đăng ký văn bản đến xuất Excel; văn bản nhận qua liên thông (bản chạy
// nội bộ) đánh dấu tiếp nhận rồi vào sổ. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
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

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

// Chọn mục của ô chọn theo một phần chữ hiện (tên sổ kèm năm, số kế tiếp)
async function selectByText(select: Locator, text: string) {
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value ?? '');
}

// Con trỏ dừng trên thanh menu sau khi đóng hộp thoại thì menu thả xuống che các thẻ: dời chuột, đóng menu rồi mới bấm thẻ
async function openTab(page: Page, name: string) {
  await page.mouse.move(5, 700);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name }).click();
}

async function openDocument(page: Page, symbol: string) {
  const row = page.getByRole('row', { name: `Văn bản ${symbol}` });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Thao tác văn bản' })).toBeVisible();
}

test('Văn thư vào sổ, trình lãnh đạo; lãnh đạo chuyển xử lý; chuyên viên xử lý xong; kết thúc văn bản; sổ văn bản đến, liên thông', async ({
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
    clerk: `Văn thư E2E ${suffix}`,
    principal: `Hiệu trưởng E2E ${suffix}`,
    handler: `Chuyên viên E2E ${suffix}`,
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
        code: `VBD-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
      })
      .execute();
  }
  const unitName = `Phòng Giáo dục E2E ${suffix}`;
  const symbol = `${suffix}/KH-E2E`;

  // Văn thư: 2.2 Đơn vị bên ngoài
  const page = await signIn(browser, clerk);
  await openMenu(page, '/external-units');
  await expect(page.getByRole('heading', { name: '2.2. Đơn vị bên ngoài' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const unitForm = page.getByRole('form', { name: 'Thêm mới đơn vị bên ngoài' });
  await unitForm.getByLabel('Mã đơn vị').fill(`PGD-${suffix}`);
  await unitForm.getByLabel('Tên đơn vị').fill(unitName);
  await unitForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('row').filter({ hasText: unitName })).toBeVisible();

  // 2.1 Sổ văn bản: thêm sổ của năm nếu chưa có
  await openMenu(page, '/document-books');
  await expect(page.getByRole('heading', { name: '2.1. Sổ văn bản' })).toBeVisible();
  const bookName = `Sổ văn bản đến E2E ${suffix}`;
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const bookForm = page.getByRole('form', { name: 'Thêm mới sổ văn bản' });
  await bookForm.getByLabel('Tên sổ văn bản').fill(bookName);
  await bookForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByRole('row').filter({ hasText: bookName })).toBeVisible();

  // 2.5 Lãnh đạo nhận văn bản
  await openMenu(page, '/document-leaders');
  await page.getByLabel(`Chọn ${names.principal}`).check();
  await page.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã ghi \d+ lãnh đạo nhận văn bản/)).toBeVisible();

  // 1.2 Quản lý văn bản đến: Thêm mới (vào sổ) kèm tệp quét
  await openMenu(page, '/incoming-documents/manage');
  await expect(page.getByRole('heading', { name: '1.2. Quản lý văn bản đến' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mới' }).click();
  const form = page.getByRole('form', { name: 'THÔNG TIN VĂN BẢN ĐẾN' });
  await form.getByLabel('Trích yếu (*)').fill(`V/v kế hoạch năm học E2E ${suffix}`);
  await form.getByLabel('Số ký hiệu (*)').fill(symbol);
  await form.getByLabel('Đơn vị ban hành (*)').selectOption({ label: unitName });
  await form.getByLabel('Ngày văn bản (*)').fill('2026-10-01');
  await form.getByLabel('Độ khẩn').selectOption({ label: 'Khẩn' });
  await selectByText(form.getByLabel('Sổ văn bản (*)'), bookName);
  await expect(form.getByLabel('Hình thức chuyển').locator('option')).toHaveText([
    'Trao tay',
    'Bưu điện',
    'E-mail',
    'Liên thông',
  ]);
  await form.getByText('Tệp quét từ máy quét (Quét tài liệu)').click();
  await form.getByLabel('Tải tệp tin (PDF, ảnh, Word, Excel; tối đa 50 MB mỗi tệp)').setInputFiles({
    name: 'van-ban-quet.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  await form.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText(/Đã vào sổ văn bản số đến \d+/)).toBeVisible();
  const toolbar = page.getByRole('toolbar', { name: 'Thao tác văn bản' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Trình lãnh đạo' }).click();
  const submit = page.getByRole('dialog');
  await submit.getByLabel(`Trình ${names.principal}`).check();
  await submit.getByLabel('Ý kiến đề xuất').fill('Kính trình Hiệu trưởng');
  await submit.getByRole('button', { name: 'Trình lãnh đạo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Văn bản đã chuyển nằm ở thẻ Chờ xử lý
  await openTab(page, 'Chờ xử lý');
  await openDocument(page, symbol);
  await openTab(page, 'Sơ đồ luồng văn bản');
  await expect(page.getByRole('region', { name: 'Sơ đồ luồng văn bản' })).toContainText(names.principal);

  // Lãnh đạo: 1.1 Văn bản đến, chuyển xử lý chính
  const leaderPage = await signIn(browser, principal);
  await openMenu(leaderPage, '/incoming-documents');
  await expect(leaderPage.getByRole('heading', { name: '1.1. Văn bản đến' })).toBeVisible();
  await openDocument(leaderPage, symbol);
  await leaderPage
    .getByRole('toolbar', { name: 'Thao tác văn bản' })
    .getByRole('button', { name: 'Chuyển xử lý' })
    .click();
  const forward = leaderPage.getByRole('dialog');
  await forward.getByLabel('Tìm người nhận').fill(names.handler);
  await forward.getByLabel(`XLC ${names.handler}`).check();
  await forward.getByLabel('Ý kiến chỉ đạo, ghi chú').fill('Giao chủ trì thực hiện');
  await forward.getByRole('button', { name: 'Chuyển xử lý', exact: true }).click();
  await expect(leaderPage.getByRole('dialog')).toHaveCount(0);

  // Chuyên viên: lọc Xử lý chính, xử lý xong
  const handlerPage = await signIn(browser, handler);
  await openMenu(handlerPage, '/incoming-documents');
  await handlerPage.getByRole('radio', { name: 'Xử lý chính' }).check();
  const handlerRow = handlerPage.getByRole('row', { name: `Văn bản ${symbol}` });
  await expect(handlerRow).toContainText('[XLC]');
  await openDocument(handlerPage, symbol);
  await handlerPage.getByRole('button', { name: 'Xử lý xong' }).click();
  const finish = handlerPage.getByRole('dialog');
  await finish.getByLabel('Ý kiến xử lý').fill('Đã triển khai đến các tổ');
  await finish.getByRole('button', { name: 'Xử lý xong', exact: true }).click();
  await expect(handlerPage.getByRole('dialog')).toHaveCount(0);
  await openTab(handlerPage, 'Đã xử lý');
  await expect(handlerPage.getByRole('row', { name: `Văn bản ${symbol}` })).toBeVisible();

  // Lãnh đạo kết thúc văn bản, in phiếu xử lý
  // Trang của lãnh đạo vẫn ở 1.1; thẻ Đã xử lý đọc lại danh sách
  await openTab(leaderPage, 'Đã xử lý');
  await openDocument(leaderPage, symbol);
  const leaderToolbar = leaderPage.getByRole('toolbar', { name: 'Thao tác văn bản' });
  await leaderToolbar.getByRole('button', { name: 'Kết thúc văn bản' }).click();
  await leaderPage.getByRole('dialog').getByRole('button', { name: 'Kết thúc', exact: true }).click();
  await expect(leaderPage.getByRole('dialog')).toHaveCount(0);
  const slip = leaderPage.waitForEvent('download');
  await leaderToolbar.getByRole('button', { name: 'In phiếu xử lý' }).click();
  expect((await slip).suggestedFilename()).toMatch(/^phieu-xu-ly-\d+-.*\.pdf$/);
  await openTab(leaderPage, 'Thông tin nhận');
  await expect(leaderPage.getByRole('table', { name: 'Thông tin nhận' })).toContainText('Đã triển khai đến các tổ');

  // Văn thư: tab Đã xử lý, sổ đăng ký văn bản đến xuất Excel
  await openMenu(page, '/incoming-documents/manage');
  await openTab(page, 'Đã xử lý');
  await expect(page.getByRole('row', { name: `Văn bản ${symbol}` })).toBeVisible();
  await openMenu(page, '/document-books');
  await openTab(page, 'Sổ đăng ký văn bản đến');
  await page.getByRole('combobox', { name: 'Sổ văn bản', exact: true }).selectOption({ label: bookName });
  await expect(page.getByRole('row').filter({ hasText: symbol })).toContainText(names.handler);
  const register = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel' }).click();
  expect((await register).suggestedFilename()).toMatch(/^so-van-ban-den-\d{4}-.*\.xlsx$/);

  // 1.7 Liên thông văn bản (bản chạy nội bộ): nhập, đánh dấu tiếp nhận, vào sổ
  await openMenu(page, '/incoming-documents/interconnect');
  await expect(page.getByText('Chưa kết nối trục liên thông văn bản')).toBeVisible();
  await page.getByRole('button', { name: 'Nhập văn bản liên thông' }).click();
  const linked = page.getByRole('form', { name: 'THÔNG TIN VĂN BẢN ĐẾN' });
  const linkedSymbol = `${suffix}/TB-LT`;
  await linked.getByLabel('Trích yếu (*)').fill(`Thông báo nhận qua trục E2E ${suffix}`);
  await linked.getByLabel('Số ký hiệu (*)').fill(linkedSymbol);
  await linked.getByLabel('Tên đơn vị ban hành').fill('Sở thử nghiệm');
  await linked.getByLabel('Ngày văn bản (*)').fill('2026-10-02');
  await linked
    .getByLabel('Tải tệp tin (PDF, ảnh, Word, Excel; tối đa 50 MB mỗi tệp)')
    .setInputFiles({ name: 'lien-thong.pdf', mimeType: 'application/pdf', buffer: PDF });
  await linked.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Đã nhập văn bản liên thông')).toBeVisible();
  const linkedToolbar = page.getByRole('toolbar', { name: 'Thao tác văn bản' });
  await linkedToolbar.getByRole('button', { name: 'Đánh dấu tiếp nhận văn bản' }).click();
  await expect(linkedToolbar.getByRole('button', { name: 'Hủy đánh dấu tiếp nhận' })).toBeVisible();
  await linkedToolbar.getByRole('button', { name: 'Vào sổ' }).click();
  const registerDialog = page.getByRole('dialog');
  await selectByText(registerDialog.getByLabel('Sổ văn bản'), bookName);
  await registerDialog.getByRole('button', { name: 'Vào sổ', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openMenu(page, '/incoming-documents/manage');
  await expect(page.getByRole('row', { name: `Văn bản ${linkedSymbol}` })).toBeVisible();
});
