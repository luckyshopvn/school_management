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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b, YCTD-146). Người dùng vừa là Hiệu trưởng vừa là bếp
// của trường chính ghi giấy chứng nhận an toàn thực phẩm của nhà cung cấp (thấy cảnh báo sắp hết hạn), mở lô hàng từ liên
// kết và ghi số lô, hạn dùng; lập phiếu bước 1 (lô đạt), bước 2 (món kèm lô đã dùng), bước 3; lưu mẫu thức ăn; truy xuất món
// ra lô và nhà cung cấp; in sổ kiểm thực và sổ lưu mẫu. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
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

test('CT-22b-7: hồ sơ nhà cung cấp, lô hàng, kiểm thực ba bước, lưu mẫu, truy xuất và sổ in', async ({ browser }) => {
  test.setTimeout(240_000);
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  const root = await schoolYear
    .selectFrom('org_units')
    .select(['id', 'name'])
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const user = await createTestUser(identity, {
    roles: [
      { roleCode: 'VT-02', orgUnitId: null },
      { roleCode: 'VT-10', orgUnitId: root.id },
    ],
  });
  const supplierName = `Hợp tác xã thử 77 ${suffix}`;
  const ingredientName = `Thịt thử 77 ${suffix}`;
  const supplier = await schoolYear
    .insertInto('food_suppliers')
    .values({
      org_unit_id: root.id,
      name: supplierName,
      address: 'Địa chỉ thử',
      phone: '0900000077',
      created_by: user.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const ingredient = await schoolYear
    .insertInto('ingredients')
    .values({ org_unit_id: root.id, code: `T77-${suffix}`, name: ingredientName, unit: 'kg', created_by: user.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const lot = await schoolYear
    .insertInto('food_lots')
    .values({
      code: `LH77-${suffix}`,
      org_unit_id: root.id,
      ingredient_id: ingredient.id,
      supplier_id: supplier.id,
      received_date: today,
      received_time: '06:10',
      quantity: 4,
      created_by: user.id,
    })
    .returning(['id', 'code'])
    .executeTakeFirstOrThrow();

  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  await page.goto('/');
  await login(page, user);

  // 3.4 Hồ sơ an toàn thực phẩm của nhà cung cấp: giấy còn 10 ngày thì có cảnh báo sắp hết hạn
  await openMenu(page, '/food-safety/supplier-records');
  await expect(page.getByRole('heading', { name: '3.4. Hồ sơ an toàn thực phẩm của nhà cung cấp' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm giấy tờ' }).click();
  const certificate = page.getByRole('form', { name: 'Thêm giấy tờ nhà cung cấp' });
  await certificate.getByLabel('Nhà cung cấp').selectOption({ label: supplierName });
  await certificate.getByLabel('Loại giấy').selectOption('food_safety');
  await certificate.getByLabel('Số giấy').fill(`ATTP77-${suffix}`);
  await certificate.getByLabel('Ngày cấp').fill(addDays(today, -300));
  await certificate.getByLabel('Ngày hết hạn').fill(addDays(today, 10));
  await certificate.getByRole('button', { name: 'Ghi giấy tờ' }).click();
  await expect(page.getByText(`Đã ghi giấy tờ số ATTP77-${suffix} của ${supplierName}`)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Giấy tờ sắp hết hạn' })).toContainText(`ATTP77-${suffix}`);
  await expect(page.getByRole('row', { name: new RegExp(supplierName) }).first()).toContainText(
    'Có giấy ATTP còn hiệu lực',
  );

  // 3.3 Lô hàng nhập: mở lô từ liên kết, ghi số lô và hạn dùng
  await page.goto(`/food-safety/lots?lot_id=${lot.id}`);
  const lotForm = page.getByRole('form', { name: `Thông tin lô ${lot.code}` });
  await lotForm.getByLabel('Số lô').fill(`SL-${suffix}`);
  await lotForm.getByLabel('Hạn dùng').fill(addDays(today, 3));
  await lotForm.getByLabel('Số chứng từ').fill(`HD77-${suffix}`);
  await lotForm.getByRole('button', { name: 'Ghi lô' }).click();
  await expect(page.getByText(`Đã ghi lô ${lot.code}`)).toBeVisible();

  // 3.1 Kiểm thực ba bước
  await openMenu(page, '/food-safety/inspections');
  await expect(page.getByRole('heading', { name: '3.1. Kiểm thực ba bước' })).toBeVisible();
  await page.getByLabel('Ngày kiểm thực').fill(today);
  await page.getByRole('tab', { name: /^Bước 1/ }).click();
  await page.getByRole('button', { name: 'Lập phiếu bước 1' }).click();
  const step1 = page.getByRole('form', { name: 'Phiếu kiểm thực bước 1' });
  const step1Row = step1.getByRole('row', { name: new RegExp(lot.code) });
  await expect(step1Row).toBeVisible();
  const lotLine = (await step1.getByRole('row').allTextContents()).findIndex((text) => text.includes(lot.code));
  await step1.getByLabel(`Cảm quan dòng ${lotLine}`).selectOption('pass');
  await step1.getByRole('button', { name: 'Xác nhận phiếu' }).click();
  await expect(page.getByText('Đã xác nhận phiếu bước 1')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await schoolYear.selectFrom('food_lots').select('status').where('id', '=', lot.id).executeTakeFirstOrThrow())
          .status,
    )
    .toBe('accepted');

  await page.getByRole('tab', { name: /^Bước 2/ }).click();
  await page.getByRole('button', { name: 'Lập phiếu bước 2' }).click();
  const step2 = page.getByRole('form', { name: 'Phiếu kiểm thực bước 2' });
  const dishName = `Thịt kho thử 77 ${suffix}`;
  const step2Lines = await step2.getByLabel(/^Tên món dòng \d+$/).count();
  await step2.getByRole('button', { name: 'Thêm dòng' }).click();
  const row = step2Lines + 1;
  await step2.getByLabel(`Bữa dòng ${row}`).selectOption('lunch');
  await step2.getByLabel(`Tên món dòng ${row}`).fill(dishName);
  await step2.getByLabel(`Số suất dòng ${row}`).fill('35');
  await step2.getByLabel(`Sơ chế xong dòng ${row}`).fill('08:00');
  await step2.getByLabel(`Chế biến xong dòng ${row}`).fill('10:00');
  for (const label of ['Vệ sinh người', 'Vệ sinh dụng cụ', 'Vệ sinh khu vực', 'Cảm quan']) {
    await step2.getByLabel(`${label} dòng ${row}`).selectOption('pass');
  }
  await step2.getByLabel(`Thêm lô dòng ${row}`).selectOption(lot.id);
  await expect(step2.getByLabel(`Lô đã dùng dòng ${row}`)).toContainText(lot.code);
  for (let line = 1; line <= step2Lines; line += 1) {
    await step2.getByRole('button', { name: 'Bỏ dòng 1', exact: true }).click();
  }
  await step2.getByRole('button', { name: 'Xác nhận phiếu' }).click();
  await expect(page.getByText('Đã xác nhận phiếu bước 2')).toBeVisible();

  // 3.2 Lưu mẫu thức ăn
  await openMenu(page, '/food-safety/samples');
  await expect(page.getByRole('heading', { name: '3.2. Lưu và hủy mẫu thức ăn' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu mẫu', exact: true }).click();
  const sample = page.getByRole('form', { name: 'Lưu mẫu thức ăn' });
  await sample.getByLabel('Ngày lưu mẫu').fill(today);
  await sample.getByLabel('Bữa').selectOption('lunch');
  await sample.getByLabel('Tên món').fill(dishName);
  await sample.getByLabel('Số suất').fill('35');
  await sample.getByLabel('Dạng thức ăn').selectOption('solid');
  await sample.getByLabel('Khối lượng (g)').fill('80');
  await sample.getByRole('button', { name: 'Lưu mẫu', exact: true }).click();
  await expect(sample.getByText('Mẫu thức ăn đặc tối thiểu 100 gam', { exact: true })).toBeVisible();
  await sample.getByLabel('Khối lượng (g)').fill('120');
  await sample.getByRole('button', { name: 'Lưu mẫu', exact: true }).click();
  await expect(page.getByText(`Đã lưu mẫu ${dishName}`)).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(dishName) })).toContainText('Đang lưu');
  await page.getByLabel('Từ ngày').fill(today);
  await page.getByLabel('Đến ngày').fill(today);
  const book = await downloadOf(page, () => page.getByRole('button', { name: 'In sổ lưu mẫu', exact: true }).click());
  expect(book.suggestedFilename()).toMatch(/^so-luu-huy-mau-.+\.pdf$/);

  // 3.5 Truy xuất nguồn gốc: món ra lô đã ghi ở bước 2, nhà cung cấp và giấy tờ còn hiệu lực
  await openMenu(page, '/food-safety/trace');
  await expect(page.getByRole('heading', { name: '3.5. Truy xuất nguồn gốc' })).toBeVisible();
  const trace = page.getByRole('form', { name: 'Truy xuất nguồn gốc' });
  await trace.getByLabel('Ngày ăn').fill(today);
  await trace.getByRole('button', { name: 'Truy xuất' }).click();
  const card = page.getByRole('article', { name: new RegExp(dishName) });
  await expect(card).toContainText('Đã ghi ở bước 2');
  await expect(card).toContainText(lot.code);
  await expect(card).toContainText(supplierName);
  await expect(card).toContainText(`ATTP77-${suffix}`);

  // Sổ kiểm thực ba bước
  await openMenu(page, '/food-safety/inspections');
  await page.getByLabel('Sổ từ ngày').fill(today);
  await page.getByLabel('Sổ đến ngày').fill(today);
  const inspections = await downloadOf(page, () => page.getByRole('button', { name: 'In sổ kiểm thực' }).click());
  expect(inspections.suggestedFilename()).toMatch(/^so-kiem-thuc-ba-buoc-.+\.pdf$/);
});
