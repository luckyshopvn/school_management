import { randomUUID } from 'node:crypto';
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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Thiết bị: nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu (DT-18 phần 18g, YCTD-143). Hiệu trưởng
// khai báo kho, gán nơi để cho một thiết bị và một lô, in tem QR, lập đợt kiểm kê của kho; giáo viên quét tem của lô trên
// ứng dụng giáo viên (nhập mã tem thay máy ảnh); Hiệu trưởng quét tem của thiết bị trên trang kiểm kê, nộp, duyệt, chốt
// chênh lệch, tải biên bản; nạp danh mục mẫu Mầm non và xem đối sánh. Chạy sau 02-academic-years và 03-org-units. Dữ liệu
// giả
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

async function downloadOf(page: Page, action: () => Promise<void>) {
  const downloading = page.waitForEvent('download');
  await action();
  return downloading;
}

async function login(page: Page, user: { username: string; password: string }) {
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('CT-18g-7: nơi để, tem QR, kiểm kê thiết bị bằng điện thoại, chốt chênh lệch và đối sánh danh mục tối thiểu', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const root = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const assetCode = `TS73-${suffix}`;
  await schoolYear
    .insertInto('assets')
    .values({
      org_unit_id: root.id,
      code: assetCode,
      name: `Đàn organ thử 73 ${suffix}`,
      category: 'Thiết bị dạy học',
      unit: 'cái',
      original_cost: 3_000_000,
      purchase_date: '2026-09-10',
      created_by: principal.id,
    })
    .execute();
  const item = await schoolYear
    .selectFrom('equipment_items')
    .select(['id', 'code', 'name'])
    .where('status', '=', 'active')
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('equipment_holdings')
            .select('equipment_holdings.id')
            .whereRef('equipment_holdings.equipment_item_id', '=', 'equipment_items.id')
            .where('equipment_holdings.org_unit_id', '=', root.id),
        ),
      ),
    )
    .orderBy('order_no')
    .executeTakeFirstOrThrow();
  const holding = await schoolYear
    .insertInto('equipment_holdings')
    .values({ equipment_item_id: item.id, org_unit_id: root.id, class_id: null, quantity: 5, updated_by: principal.id })
    .returning('id')
    .executeTakeFirstOrThrow();

  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await login(page, principal);

  // 2.4 Nơi để: thêm kho, gán nơi để cho thiết bị và lô, in tem QR
  await openMenu(page, '/equipment-locations');
  await expect(page.getByRole('heading', { name: '2.4. Nơi để và tem QR thiết bị' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm nơi để' }).click();
  const form = page.getByRole('form', { name: 'Thêm nơi để' });
  await form.getByLabel('Mã nơi để').fill(`KHO73-${suffix}`);
  await form.getByLabel('Tên nơi để').fill(`Kho thử 73 ${suffix}`);
  await form.getByLabel('Loại nơi để').selectOption('store');
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText('Đã thêm nơi để')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nơi để thiết bị' })).toContainText(`Kho thử 73 ${suffix}`);

  await page.getByRole('tab', { name: 'Thiết bị và tem QR' }).click();
  const targets = page.getByRole('region', { name: 'Thiết bị và tem QR' });
  await page.getByLabel('Gán vào nơi để').selectOption({ label: `Kho thử 73 ${suffix}` });
  await targets.getByRole('searchbox', { name: 'Tìm theo mã, tên, mã tem' }).fill(assetCode);
  await targets.getByRole('checkbox', { name: new RegExp(`^Chọn ${assetCode}`) }).check();
  await targets.getByRole('button', { name: 'Gán nơi để' }).click();
  await expect(page.getByText('Đã gán nơi để cho 1 thiết bị, lô')).toBeVisible();
  await targets.getByRole('searchbox', { name: 'Tìm theo mã, tên, mã tem' }).fill(item.code);
  await targets
    .getByRole('checkbox', { name: new RegExp(`^Chọn ${item.code}`) })
    .first()
    .check();
  await targets.getByRole('button', { name: 'Gán nơi để' }).click();
  await expect(page.getByText('Đã gán nơi để cho 1 thiết bị, lô')).toBeVisible();

  await page.getByLabel('Nơi để', { exact: true }).selectOption({ label: `Kho thử 73 ${suffix}` });
  await targets.getByRole('searchbox', { name: 'Tìm theo mã, tên, mã tem' }).fill('');
  await expect(targets.getByRole('checkbox', { name: new RegExp(`^Chọn (${assetCode}|${item.code}) `) })).toHaveCount(
    2,
  );
  await targets.getByRole('checkbox', { name: 'Chọn tất cả dòng trên trang' }).check();
  const labels = await downloadOf(page, () => targets.getByRole('button', { name: 'In tem QR' }).click());
  expect(labels.suggestedFilename()).toMatch(/^tem-qr-thiet-bi-\d{8}-\d{4}\.pdf$/);
  await expect(targets).toContainText(/TB-[0-9A-Z]{10}/);
  const assetQr = (
    await schoolYear.selectFrom('assets').select('qr_code').where('code', '=', assetCode).executeTakeFirstOrThrow()
  ).qr_code;
  const holdingQr = (
    await schoolYear
      .selectFrom('equipment_holdings')
      .select('qr_code')
      .where('id', '=', holding.id)
      .executeTakeFirstOrThrow()
  ).qr_code;
  expect(assetQr).toMatch(/^TB-[0-9A-Z]{10}$/);
  expect(holdingQr).toMatch(/^TB-[0-9A-Z]{10}$/);

  // 2.5 Kiểm kê: lập đợt của kho
  await openMenu(page, '/equipment-stocktakes');
  await expect(page.getByRole('heading', { name: '2.5. Kiểm kê thiết bị' })).toBeVisible();
  await page.getByRole('button', { name: 'Lập đợt kiểm kê' }).click();
  const createForm = page.getByRole('form', { name: 'Lập đợt kiểm kê' });
  await createForm.getByLabel('Tên đợt kiểm kê').fill(`Kiểm kê kho thử 73 ${suffix}`);
  await createForm.getByLabel('Nơi kiểm kê').selectOption({ label: `Kho thử 73 ${suffix}` });
  await createForm.getByLabel('Tổ kiểm kê').fill('Tổ kiểm kê thử');
  await createForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(page.getByText(/Đã lập đợt KKTB-\d{6} với 2 dòng theo sổ/)).toBeVisible();
  await expect(page.getByLabel('Tổng hợp kiểm kê')).toContainText('0/2');

  // Giáo viên quét tem của lô trên ứng dụng giáo viên (nhập mã tem thay máy ảnh)
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await phone.goto(`http://localhost:${E2E_TEACHER_PORT}`);
  await login(phone, teacher);
  await phone.getByRole('button', { name: 'Kiểm kê thiết bị' }).click();
  await expect(phone.getByLabel('Tiến độ kiểm kê')).toContainText('đã kiểm 0/2');
  await phone.getByLabel('Mã tem').fill(holdingQr ?? '');
  await phone.getByRole('button', { name: 'Tra mã' }).click();
  await expect(phone.getByText(`${item.code} – ${item.name}`)).toBeVisible();
  await phone.getByLabel('Số đếm được').fill('4');
  await phone.getByLabel('Số dùng được').fill('3');
  await phone.getByRole('button', { name: 'Ghi kết quả' }).click();
  await expect(phone.getByText(`Đã ghi ${item.code}`)).toBeVisible();
  await expect(phone.getByLabel('Tiến độ kiểm kê')).toContainText('đã kiểm 1/2');

  // Hiệu trưởng quét tem của thiết bị trên trang kiểm kê (web di động dùng cùng trang)
  const scan = page.getByRole('region', { name: 'Quét kiểm kê' });
  await scan.getByLabel('Mã tem').fill(assetQr ?? '');
  await scan.getByRole('button', { name: 'Tra mã' }).click();
  const record = page.getByRole('form', { name: 'Ghi kết quả kiểm kê' });
  await record.getByLabel('Hỏng, cần sửa').check();
  await record.getByLabel('Ghi chú').fill('Hỏng phím thử');
  await record.getByRole('button', { name: 'Ghi kết quả' }).click();
  await expect(page.getByText(`Đã ghi ${assetCode}`)).toBeVisible();
  const summary = page.getByLabel('Tổng hợp kiểm kê');
  await expect(summary).toContainText('2/2');
  await expect(summary).toContainText('Thiếu1 dòng (1)');
  await expect(summary).toContainText('60%');
  const lines = page.getByRole('region', { name: 'Đối chiếu kiểm kê' });
  await expect(lines).toContainText('Hỏng, cần sửa');

  // Nộp, duyệt, chốt chênh lệch, biên bản
  await page.getByRole('button', { name: 'Nộp kết quả' }).click();
  await expect(page.getByText('Đợt kiểm kê: Chờ duyệt')).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(page.getByText('Đợt kiểm kê: Đã duyệt')).toBeVisible();
  await page.getByRole('button', { name: 'Chốt chênh lệch' }).click();
  await expect(page.getByText('Đợt kiểm kê: Đã chốt chênh lệch')).toBeVisible();
  const minutes = await downloadOf(page, () => page.getByRole('button', { name: 'Biên bản PDF' }).click());
  expect(minutes.suggestedFilename()).toMatch(/^bien-ban-kiem-ke-kktb-\d{6}-\d{8}-\d{4}\.pdf$/);
  const after = await schoolYear
    .selectFrom('equipment_holdings')
    .select('quantity')
    .where('id', '=', holding.id)
    .executeTakeFirstOrThrow();
  expect(Number(after.quantity)).toBe(3);
  const damage = await schoolYear
    .selectFrom('asset_damages')
    .innerJoin('assets', 'assets.id', 'asset_damages.asset_id')
    .select(['asset_damages.status', 'asset_damages.incident_type'])
    .where('assets.code', '=', assetCode)
    .executeTakeFirstOrThrow();
  expect([damage.status, damage.incident_type]).toEqual(['pending', 'damaged']);

  // 2.6 Đối sánh danh mục tối thiểu: nạp mẫu Mầm non (không ngừng dòng gieo sẵn để không ảnh hưởng kịch bản khác)
  await openMenu(page, '/equipment-minimum');
  await expect(page.getByRole('heading', { name: '2.6. Đối sánh danh mục tối thiểu' })).toBeVisible();
  const templates = page.getByRole('region', { name: 'Danh mục mẫu' });
  await expect(templates).toContainText('Thông tư 02/2010/TT-BGDĐT');
  await templates.getByLabel(/Ngừng dùng thiết bị gieo sẵn tạm thời/).uncheck();
  await templates.getByRole('button', { name: 'Nạp danh mục mẫu' }).click();
  await expect(page.getByText(/Đã nạp \d+ thiết bị/)).toBeVisible();
  await expect(templates).toContainText('515 thiết bị, đã có 515');
  await expect(page.getByLabel('Kết quả đối sánh')).toContainText('Danh mục có');
  await expect(page.getByRole('region', { name: 'Đối sánh danh mục tối thiểu' })).toBeVisible();
});
