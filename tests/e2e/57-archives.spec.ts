import { expect, test, type Page } from './fixtures.js';
import {
  createDatabase,
  listDatabasesWithPrefix,
  readConnectionString,
  replaceDatabaseName,
  type IdentityDatabase,
  type SchoolYearDatabase,
} from '@school-management/database';
import { createTestUser } from '@school-management/identity/testing';
import ExcelJS from 'exceljs';
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { expectNoMenuLink, menuLink, openMenu } from './menu.js';

// Văn thư lưu trữ, mục 5.10 của Sở (DT-15 phần 15h2, YCTD-118, YCTD-119; CT-15h2-11 đến CT-15h2-13, CT-15h2-19): phông, thông tin lưu trữ,
// hồ sơ tài liệu hoàn thành và chưa hoàn thành có tệp đính kèm, báo cáo lưu trữ, quyền theo thao tác. Dữ liệu là dữ liệu
// giả của riêng kịch bản này, mã có hậu tố theo lần chạy
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const suffix = Date.now() % 1_000_000;
const fondCode = `PL${suffix}`;
const fondName = `Phông thử ${suffix}`;
const recordCode = `${suffix}/HS-VT`;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');

test.afterAll(async () => {
  await identity.destroy();
});

async function signIn(page: Page, roleCode: string, orgUnitId: string | null = null) {
  const user = await createTestUser(identity, { roles: [{ roleCode, orgUnitId }] });
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

async function readDownload(page: Page, click: () => Promise<void>): Promise<string[][]> {
  const downloading = page.waitForEvent('download');
  await click();
  const download = await downloading;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path()) ?? '');
  const rows: string[][] = [];
  workbook.worksheets[0]?.eachRow((row) => {
    rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
  });
  return rows;
}

test.describe.serial('Văn thư lưu trữ', () => {
  test('CT-15h2-11: thêm phông, thông tin lưu trữ; hồ sơ chưa hoàn thành quá hạn, đính kèm tệp, chuyển sang hoàn thành, xuất Excel, xóa', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, 'VT-02');

    // 5.10.2 Phông lưu trữ
    await openMenu(page, '/archive-fonds');
    await expect(page.getByRole('heading', { name: '5.10.2. Phông lưu trữ', exact: true })).toBeVisible();
    const fondGrid = page.getByRole('region', { name: 'Danh sách phông lưu trữ' });
    await fondGrid.getByRole('button', { name: 'Thêm mới' }).click();
    const fondForm = page.getByRole('form', { name: 'Thêm mới phông lưu trữ' });
    await fondForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(fondForm.getByText('Bắt buộc nhập', { exact: true })).toHaveCount(2);
    await fondForm.getByLabel('Mã phông').fill(fondCode);
    await fondForm.getByLabel('Tên phông').fill(fondName);
    await fondForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Đã tạo phông ${fondName}` })).toBeVisible();
    await expect(fondGrid.getByRole('row').filter({ hasText: fondCode })).toBeVisible();

    // 5.10.3 Thông tin lưu trữ: tài liệu vĩnh viễn không chọn được hết giá trị; có thời hạn thì chọn được
    await openMenu(page, '/archive-holdings');
    await expect(page.getByRole('heading', { name: '5.10.3. Thông tin lưu trữ', exact: true })).toBeVisible();
    const holdingGrid = page.getByRole('region', { name: 'Danh sách thông tin lưu trữ' });
    await holdingGrid.getByRole('button', { name: 'Thêm mới' }).click();
    const holdingForm = page.getByRole('form', { name: 'Thêm mới thông tin lưu trữ' });
    await holdingForm.getByLabel('Phông lưu trữ').selectOption({ label: `${fondCode} - ${fondName}` });
    await holdingForm.getByLabel('Từ năm').fill('2010');
    await holdingForm.getByLabel('Đến năm').fill('2015');
    await holdingForm.getByLabel('Chỉnh lý').selectOption({ label: 'Đã chỉnh lý' });
    await expect(holdingForm.getByLabel('Hết giá trị')).toHaveCount(0);
    await holdingForm.getByLabel('Thời hạn bảo quản').selectOption({ label: 'Có thời hạn' });
    await holdingForm.getByLabel('Số năm bảo quản').fill('10');
    await holdingForm.getByLabel('Hết giá trị').check();
    await holdingForm.getByLabel('Số bó').fill('3');
    await holdingForm.getByLabel('Số hộp').fill('8');
    await holdingForm.getByLabel('Số mét giá').fill('1,5');
    await holdingForm.getByLabel('Nơi bảo quản').fill(`Kho ${suffix}`);
    await holdingForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã thêm thông tin lưu trữ' })).toBeVisible();
    const holdingRow = holdingGrid.getByRole('row').filter({ hasText: `Kho ${suffix}` });
    await expect(holdingRow).toContainText('2010–2015');
    await expect(holdingRow).toContainText('Hết giá trị');
    await expect(holdingRow).toContainText('10 năm');
    await expect(holdingRow).toContainText('1,5');

    // 5.10.1 Hồ sơ tài liệu: thêm hồ sơ chưa hoàn thành đã quá thời hạn
    await openMenu(page, '/archive-records');
    await expect(page.getByRole('heading', { name: '5.10.1. Hồ sơ tài liệu', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chưa hoàn thành' })).toHaveAttribute('aria-selected', 'true');
    let grid = page.getByRole('region', { name: 'Danh sách hồ sơ chưa hoàn thành' });
    await grid.getByRole('button', { name: 'Thêm mới' }).click();
    const createForm = page.getByRole('form', { name: 'Thêm mới hồ sơ tài liệu' });
    await createForm.getByLabel('Số, ký hiệu hồ sơ').fill(recordCode);
    await createForm.getByLabel('Tiêu đề hồ sơ').fill(`Hồ sơ tuyển sinh ${suffix}`);
    await createForm.getByLabel('Phông lưu trữ').selectOption({ label: `${fondCode} - ${fondName}` });
    await expect(createForm.getByLabel('Đơn vị', { exact: true })).toHaveValue('');
    await createForm.getByLabel('Người giải quyết', { exact: true }).selectOption({ label: 'Người khác (nhập tên)' });
    await createForm.getByLabel('Tên người giải quyết', { exact: true }).fill('Nguyễn Văn Thư');
    await createForm.getByLabel('Ngày mở hồ sơ').fill('2026-01-05');
    await createForm.getByLabel('Thời hạn giải quyết').fill('2026-01-01');
    await createForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(createForm.getByText('Thời hạn không được trước ngày mở hồ sơ', { exact: true })).toBeVisible();
    await createForm.getByLabel('Thời hạn giải quyết').fill('2026-02-10');
    await createForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Đã tạo hồ sơ ${recordCode}` })).toBeVisible();

    // Hồ sơ vừa tạo mở sẵn ở danh sách của nó để đính kèm tệp
    const row = grid.getByRole('row', { name: `Hồ sơ ${recordCode}`, exact: true });
    await expect(row).toContainText('Quá hạn');
    await expect(row).toContainText('Nguyễn Văn Thư');
    await page
      .getByLabel(/^Chọn tệp/)
      .setInputFiles({ name: 'cong-van.pdf', mimeType: 'application/pdf', buffer: PDF });
    const files = page.getByRole('list', { name: 'Danh sách tệp đính kèm' });
    await expect(files.getByRole('listitem').filter({ hasText: 'cong-van.pdf' })).toBeVisible();

    // Ghi hoàn thành thì hồ sơ chuyển sang danh sách Hoàn thành
    const editForm = page.getByRole('form', { name: `Sửa hồ sơ ${recordCode}` });
    await editForm.getByLabel('Trạng thái').selectOption({ label: 'Hoàn thành' });
    await editForm.getByLabel('Ngày hoàn thành').fill('2026-02-09');
    await editForm.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Đã ghi hồ sơ ${recordCode}` })).toBeVisible();
    await expect(grid.getByRole('row', { name: `Hồ sơ ${recordCode}`, exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Hoàn thành', exact: true }).click();
    grid = page.getByRole('region', { name: 'Danh sách hồ sơ hoàn thành' });
    await grid.getByLabel('Tìm theo số, ký hiệu hoặc tiêu đề').fill(recordCode);
    const completedRow = grid.getByRole('row', { name: `Hồ sơ ${recordCode}`, exact: true });
    await expect(completedRow).toContainText('09/02/2026');
    await expect(completedRow).not.toContainText('Quá hạn');

    // Xuất Excel các cột đang hiện theo bộ lọc
    const rows = await readDownload(page, () => grid.getByRole('button', { name: 'Xuất Excel' }).click());
    expect(rows[0]).toEqual([
      'STT',
      'Số, ký hiệu hồ sơ',
      'Tiêu đề hồ sơ',
      'Phông lưu trữ',
      'Đơn vị',
      'Người giải quyết',
      'Ngày mở hồ sơ',
      'Thời hạn giải quyết',
      'Ngày hoàn thành',
      'Thời hạn bảo quản',
      'Số tệp đính kèm',
    ]);
    expect(rows.slice(1)).toEqual([
      [
        '1',
        recordCode,
        `Hồ sơ tuyển sinh ${suffix}`,
        fondName,
        'Toàn trường',
        'Nguyễn Văn Thư',
        '05/01/2026',
        '10/02/2026',
        '09/02/2026',
        'Vĩnh viễn',
        '1',
      ],
    ]);

    // Phông còn hồ sơ thì không xóa được
    await openMenu(page, '/archive-fonds');
    await fondGrid.getByRole('row').filter({ hasText: fondCode }).getByRole('button', { name: 'Xóa' }).click();
    let confirm = page.getByRole('dialog', { name: 'Xác nhận xóa' });
    await confirm.getByLabel(`Tôi đã đọc và đồng ý xóa phông ${fondName}`).check();
    await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'không xóa được' })).toBeVisible();

    // Xóa hồ sơ qua hộp xác nhận
    await openMenu(page, '/archive-records');
    await page.getByRole('tab', { name: 'Hoàn thành', exact: true }).click();
    grid = page.getByRole('region', { name: 'Danh sách hồ sơ hoàn thành' });
    await grid.getByLabel('Tìm theo số, ký hiệu hoặc tiêu đề').fill(recordCode);
    await grid
      .getByRole('row', { name: `Hồ sơ ${recordCode}`, exact: true })
      .getByRole('button', { name: 'Xóa' })
      .click();
    confirm = page.getByRole('dialog', { name: 'Xác nhận xóa' });
    const remove = confirm.getByRole('button', { name: 'Xóa', exact: true });
    await expect(remove).toBeDisabled();
    await confirm.getByLabel(`Tôi đã đọc và đồng ý xóa hồ sơ ${recordCode}`).check();
    await remove.click();
    await expect(page.getByRole('status').filter({ hasText: `Đã xóa hồ sơ ${recordCode}` })).toBeVisible();
    await expect(grid.getByRole('row', { name: `Hồ sơ ${recordCode}`, exact: true })).toHaveCount(0);
  });

  test('CT-15h2-12: báo cáo lưu trữ cộng theo phông, giai đoạn và xuất Excel; Phó Hiệu trưởng chỉ xem, giáo viên không có mục', async ({
    page,
  }) => {
    await signIn(page, 'VT-15');
    await openMenu(page, '/archive-report');
    await expect(page.getByRole('heading', { name: '5.10.4. Báo cáo lưu trữ', exact: true })).toBeVisible();
    const grid = page.getByRole('region', { name: 'Báo cáo lưu trữ theo phông, giai đoạn' });
    await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
    await grid.getByLabel('Phông lưu trữ').selectOption({ label: fondName });
    const row = grid.getByRole('row').filter({ hasText: fondCode });
    await expect(row).toContainText('2010–2015');
    await expect(row).toContainText(`Kho ${suffix}`);
    await expect(grid.getByRole('row').filter({ hasText: 'Tổng cộng' })).toBeVisible();
    const rows = await readDownload(page, () => grid.getByRole('button', { name: 'Xuất Excel' }).click());
    expect(rows.find((cells) => cells[0] === `${fondCode} - ${fondName}`)).toEqual([
      `${fondCode} - ${fondName}`,
      '2010–2015',
      '1.5',
      '1.5',
      '0',
      '1.5',
      '0',
      '1.5',
      '3',
      '8',
      `Kho ${suffix}`,
    ]);

    // Phó Hiệu trưởng xem hồ sơ nhưng không thêm, sửa, xóa
    await openMenu(page, '/archive-records');
    const records = page.getByRole('region', { name: 'Danh sách hồ sơ chưa hoàn thành' });
    await expect(records.getByRole('button', { name: 'Xuất Excel' })).toBeVisible();
    await expect(records.getByRole('button', { name: 'Thêm mới' })).toHaveCount(0);

    await page.context().clearCookies();
    await signIn(page, 'VT-07');
    await expectNoMenuLink(page, '/archive-records');
    await expect(menuLink(page, '/archive-report')).toHaveCount(0);
  });

  test('CT-15h2-13: màn hình Phân quyền nhóm theo menu hiện quyền của mục 5.10 theo thao tác', async ({ page }) => {
    await signIn(page, 'VT-02');
    await openMenu(page, '/role-permissions');
    await page.getByLabel('Nhóm người dùng', { exact: true }).selectOption({ label: 'VT-04 Kế toán' });
    await page.getByLabel('Phân hệ', { exact: true }).selectOption({ label: 'Quản lý giáo dục Mầm non' });
    const item = page.getByRole('listitem', { name: 'Mục 5.10.1. Hồ sơ tài liệu' });
    await expect(item.getByRole('checkbox', { name: 'Chọn mục 5.10.1. Hồ sơ tài liệu' })).toBeChecked();
    for (const code of ['P09.archive.view', 'P09.archive.manage', 'P09.archive.export']) {
      await expect(
        item.getByRole('checkbox', { name: new RegExp(`\\(${code.replaceAll('.', '\\.')}\\)`) }),
      ).toBeChecked();
    }
    await expect(page.getByRole('listitem', { name: 'Mục 5.10.4. Báo cáo lưu trữ' })).toBeVisible();
  });

  test('CT-15h2-19: hồ sơ của một đơn vị, người giải quyết chọn từ nhân sự, nhãn Sắp đến hạn; kế toán đơn vị khác không thấy', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const systemUrl = readConnectionString('system');
    const [databaseName] = await listDatabasesWithPrefix(systemUrl, E2E_SCHOOL_YEAR_DATABASE_PREFIX);
    const schoolYear = createDatabase<SchoolYearDatabase>(replaceDatabaseName(systemUrl, databaseName ?? ''));
    const [unit, otherUnit] = await schoolYear
      .selectFrom('org_units')
      .select(['id', 'name'])
      .where('unit_type', '!=', 'truong_chinh')
      .where('status', '=', 'active')
      .orderBy('code')
      .limit(2)
      .execute();
    const staffName = `Đỗ Thị Văn Thư ${suffix}`;
    await schoolYear
      .insertInto('staff')
      .values({ org_unit_id: unit?.id ?? '', code: `VT${suffix}`, full_name: staffName, start_date: '2025-08-01' })
      .execute();
    await schoolYear.destroy();
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(Date.now() + 86_400_000),
    );
    const code = `${suffix}/HS-DV`;

    await signIn(page, 'VT-02');
    await openMenu(page, '/archive-records');
    const grid = page.getByRole('region', { name: 'Danh sách hồ sơ chưa hoàn thành' });
    await grid.getByRole('button', { name: 'Thêm mới' }).click();
    const form = page.getByRole('form', { name: 'Thêm mới hồ sơ tài liệu' });
    await form.getByLabel('Số, ký hiệu hồ sơ').fill(code);
    await form.getByLabel('Tiêu đề hồ sơ').fill(`Hồ sơ đơn vị ${suffix}`);
    await form.getByLabel('Đơn vị', { exact: true }).selectOption({ label: unit?.name ?? '' });
    await form.getByLabel('Người giải quyết', { exact: true }).selectOption({ label: `${staffName} (VT${suffix})` });
    await expect(form.getByLabel('Tên người giải quyết', { exact: true })).toHaveCount(0);
    await form.getByLabel('Ngày mở hồ sơ').fill('2026-01-05');
    await form.getByLabel('Thời hạn giải quyết').fill(tomorrow);
    await form.getByRole('button', { name: 'Ghi' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Đã tạo hồ sơ ${code}` })).toBeVisible();
    const row = grid.getByRole('row', { name: `Hồ sơ ${code}`, exact: true });
    await expect(row).toContainText(staffName);
    await expect(row).toContainText(unit?.name ?? '');
    await expect(row).toContainText('Sắp đến hạn');

    // Mở rộng tìm kiếm: chỉ hồ sơ sắp đến hạn của đơn vị
    await grid.getByLabel('Tìm theo số, ký hiệu hoặc tiêu đề').fill('');
    await grid.getByRole('button', { name: 'Mở rộng tìm kiếm' }).click();
    await grid.getByLabel('Đơn vị', { exact: true }).selectOption({ label: unit?.name ?? '' });
    await grid.getByLabel('Chỉ hồ sơ sắp đến hạn').check();
    await expect(grid.getByRole('row', { name: `Hồ sơ ${code}`, exact: true })).toBeVisible();

    // Kế toán của đơn vị khác không thấy hồ sơ này
    await page.context().clearCookies();
    await signIn(page, 'VT-04', otherUnit?.id ?? null);
    await openMenu(page, '/archive-records');
    const otherGrid = page.getByRole('region', { name: 'Danh sách hồ sơ chưa hoàn thành' });
    await otherGrid.getByLabel('Tìm theo số, ký hiệu hoặc tiêu đề').fill(code);
    await expect(otherGrid.getByText('Chưa có hồ sơ nào.')).toBeVisible();
  });
});
