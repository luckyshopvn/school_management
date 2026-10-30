import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures.js';
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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Gia sư AI do trường bán (YCTD-383 lát L1a), kịch bản CT-1765, CT-1766: quản trị trường bật Gia sư AI cho THCS, tạo gói tháng và gói
// lượt ở trang Gia sư AI; phụ huynh mua gói tháng qua trường cho con (đồng ý), thấy số lượt, mua thêm gói lượt rồi hủy; nâng gói tháng
// giữa tháng trả phần chênh lệch theo số ngày còn lại; quản trị thấy các lần mua. Cuối kịch bản xóa dữ liệu thử, tắt lại THCS. Dữ liệu
// giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
const system = createDatabase<SystemDatabase>(readConnectionString('system'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
const remainingDays = daysInMonth - Number(today.slice(8, 10)) + 1;
const money = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setSecondaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const secondary = card.getByLabel('Bật cấp THCS', { exact: true });
  if (enabled) {
    await secondary.check();
  } else {
    await secondary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

async function signIn(page: Page, user: { username: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
}

test('CT-1765, CT-1766: trường bán gói Gia sư AI, phụ huynh mua qua trường, hủy gói lượt, nâng gói tháng giữa tháng', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const basic = `Cơ bản ${suffix}`;
  const advanced = `Nâng cao ${suffix}`;
  const topUp = `Gói 50 lượt ${suffix}`;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `06${String(suffix).padStart(8, '0')}`;
  await identity.updateTable('users').set({ phone: parentPhone }).where('id', '=', parent.id).execute();
  await schoolYear
    .insertInto('grade_levels')
    .values({
      code: 'K8',
      name: 'Khối 8',
      order_no: 108,
      age_from_months: null,
      age_to_months: null,
      school_level: 'THCS',
    })
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();

  const page = await (await browser.newContext()).newPage();
  await signIn(page, principal);
  await setSecondaryEnabled(page, true);
  const childName = `Học Sinh Gia Sư AI ${suffix}`;
  let childId = '';
  let guardianId = '';
  try {
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `8A-${suffix}`,
        name: `Lớp 8A ${suffix}`,
        grade_level: 'K8',
        school_level: 'THCS',
        max_size: 45,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `AI-${suffix}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    guardianId = (
      await schoolYear
        .insertInto('guardians')
        .values({ full_name: 'Phụ huynh gia sư AI', phone: parentPhone, user_id: parent.id })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: reference.org_unit_id,
          full_name: childName,
          dob: '2012-06-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '3830',
          photo_consent: 'granted',
          status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classRow.id, from_date: addDays(today, -30) })
      .execute();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childId, guardian_id: guardianId, relationship_item_id: relationship.id })
      .execute();

    // Quản trị trường: bật cho THCS, giữ khung giờ mặc định, tạo ba gói
    await openMenu(page, '/ai-tutor');
    const settings = page.getByRole('form', { name: 'Cài đặt Gia sư AI' });
    await expect(settings.getByLabel('Khóa từ')).toHaveValue('22:00');
    await expect(settings.getByLabel('Mở lại lúc')).toHaveValue('06:00');
    await settings.getByLabel('Trung học cơ sở').check();
    await settings.getByRole('button', { name: 'Lưu cài đặt' }).click();
    await expect(toast(page, 'Đã lưu cài đặt Gia sư AI')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Cài đặt Gia sư AI' })).toContainText('Đang bật cho Trung học cơ sở');
    for (const plan of [
      { kind: 'monthly', name: basic, price: '79000', turns: '100', images: false },
      { kind: 'monthly', name: advanced, price: '149000', turns: '300', images: true },
      { kind: 'top_up', name: topUp, price: '39000', turns: '50', images: false },
    ]) {
      const form = page.getByRole('form', { name: 'Tạo gói' });
      await form.getByLabel('Loại gói').selectOption(plan.kind);
      await form.getByLabel('Tên gói').fill(plan.name);
      await form.getByLabel(/^Giá/).fill(plan.price);
      await form.getByLabel(/^Số lượt/).fill(plan.turns);
      if (plan.images) {
        await form.getByLabel('Cho gửi ảnh bài tập').check();
      }
      await form.getByRole('button', { name: 'Tạo gói' }).click();
      await expect(toast(page, `Đã tạo gói ${plan.name}`)).toBeVisible();
    }
    await expect(page.getByRole('row', { name: advanced, exact: true })).toContainText('149.000 đ/tháng');
    await expect(page.getByRole('row', { name: topUp, exact: true })).toContainText('Theo gói tháng');

    // Phụ huynh: tab Mua qua trường, mua gói tháng Cơ bản cho tháng này
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Gia sư AI' }).click();
    const panel = parentPage.getByRole('region', { name: `Gia sư AI của ${childName}` });
    await expect(panel.getByRole('tab', { name: 'Mua qua trường' })).toHaveAttribute('aria-selected', 'true');
    await panel.getByRole('tab', { name: 'Mua trực tiếp' }).click();
    await expect(panel.getByRole('tab', { name: 'Mua trực tiếp' })).toHaveAttribute('aria-selected', 'true');
    await panel.getByRole('tab', { name: 'Mua qua trường' }).click();
    const schoolTab = panel.getByRole('tabpanel', { name: 'Mua qua trường' });
    // Lát L5 (MH-598): khối "Tháng N của con" hiện chung dưới cả hai tab, nằm ngoài tab "Mua qua trường"
    const usage = panel.getByLabel('Lượt hỏi của con');
    await expect(usage).toContainText('Con chưa có gói tháng trong tháng này');
    await schoolTab
      .getByRole('listitem', { name: basic, exact: true })
      .getByRole('button', { name: 'Chọn gói này' })
      .click();
    const dialog = parentPage.getByRole('dialog').filter({ hasText: `Mua ${basic}` });
    await expect(dialog).toContainText('đồng ý cho');
    await dialog.getByRole('button', { name: 'Đồng ý' }).click();
    await expect(schoolTab).toContainText(`Đã mua ${basic}; phí vào hóa đơn học phí kỳ tới`);
    await expect(usage).toContainText(`Đã dùng 0 / 100 lượt (${basic})`);
    await expect(schoolTab.getByRole('listitem', { name: basic, exact: true })).toContainText('Con đang dùng gói này');

    // Mua thêm gói lượt rồi hủy khi chưa lên hóa đơn
    await schoolTab
      .getByRole('listitem', { name: topUp, exact: true })
      .getByRole('button', { name: 'Mua thêm' })
      .click();
    await parentPage
      .getByRole('dialog')
      .filter({ hasText: `Mua ${topUp}` })
      .getByRole('button', { name: 'Đồng ý' })
      .click();
    await expect(usage).toContainText('Lượt mua thêm còn 50');
    const topUpRow = schoolTab.getByRole('listitem', { name: `Lần mua ${topUp}` });
    await topUpRow.getByRole('button', { name: 'Hủy lần mua' }).click();
    await parentPage
      .getByRole('dialog')
      .filter({ hasText: 'Hủy lần mua' })
      .getByRole('button', { name: 'Hủy lần mua' })
      .click();
    await expect(topUpRow).toContainText('Đã hủy');
    await expect(usage).toContainText('Lượt mua thêm còn 0');

    // CT-1766: nâng lên Nâng cao giữa tháng, trả chênh lệch theo số ngày còn lại
    const difference = Math.round((70_000 * remainingDays) / daysInMonth);
    const extra = Math.round((200 * remainingDays) / daysInMonth);
    await schoolTab
      .getByRole('listitem', { name: advanced, exact: true })
      .getByRole('button', { name: 'Nâng lên gói này' })
      .click();
    const upgrade = parentPage.getByRole('dialog').filter({ hasText: `Nâng lên ${advanced}` });
    await expect(upgrade).toContainText(
      `Trả thêm ${money(difference)} theo ${remainingDays}/${daysInMonth} ngày còn lại`,
    );
    await expect(upgrade).toContainText(`cộng ${extra} lượt`);
    await upgrade.getByRole('button', { name: 'Đồng ý' }).click();
    await expect(schoolTab).toContainText(`Đã nâng lên ${advanced}, cộng ${extra} lượt`);
    await expect(usage).toContainText(`Đã dùng 0 / ${100 + extra} lượt (${advanced})`);
    await expect(schoolTab.getByRole('listitem', { name: `Lần mua ${advanced}` })).toContainText(
      `Nâng ${basic} lên ${advanced}: ${money(difference)}`,
    );

    // Quản trị thấy các lần mua và lần nâng
    await page.reload();
    const purchases = page.getByRole('region', { name: 'Các lần mua' });
    await expect(purchases.getByRole('row', { name: `Lần mua ${advanced}` })).toContainText(childName);
    await expect(purchases.getByRole('row', { name: `Nâng gói ${advanced}` })).toContainText(money(difference));
    await expect(purchases.getByRole('row', { name: `Nâng gói ${advanced}` })).toContainText('Chờ lên hóa đơn');
  } finally {
    if (childId) {
      const subscriptionIds = (
        await system.selectFrom('ai_tutor_subscriptions').select('id').where('child_id', '=', childId).execute()
      ).map((row) => row.id);
      if (subscriptionIds.length > 0) {
        await system.deleteFrom('ai_tutor_upgrades').where('subscription_id', 'in', subscriptionIds).execute();
        await system.deleteFrom('ai_tutor_subscriptions').where('id', 'in', subscriptionIds).execute();
      }
      await schoolYear.deleteFrom('child_guardians').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('class_enrollments').where('child_id', '=', childId).execute();
    }
    await system.deleteFrom('ai_tutor_plans').where('name', 'in', [basic, advanced, topUp]).execute();
    await system.deleteFrom('ai_tutor_school_settings').execute();
    if (guardianId) {
      await schoolYear.deleteFrom('guardians').where('id', '=', guardianId).execute();
    }
    await setSecondaryEnabled(page, false);
  }
});
