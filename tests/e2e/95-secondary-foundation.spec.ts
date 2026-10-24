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

// Nền THCS, THPT (DT-21 phần 21a, YCTD-167), kịch bản CT-21a-6: trường bật cấp THPT; Hiệu trưởng nạp môn mẫu THPT ở 7.1 Môn
// học và hoạt động giáo dục (có nhóm môn lựa chọn), lập tổ hợp môn ở 7.6, lập tổ bộ môn ở 7.7. Cuối kịch bản tắt lại THPT để
// trường trở về chỉ có Mầm non. Dữ liệu giả
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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function setHighSchoolEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const high = card.getByLabel('Bật cấp THPT', { exact: true });
  if (enabled) {
    await high.check();
  } else {
    await high.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-21a-6: nạp môn mẫu THPT, lập tổ hợp môn và tổ bộ môn', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  // Khối mẫu THPT (19b) nạp sẵn để kịch bản tập trung vào môn học, tổ hợp
  await schoolYear
    .insertInto('grade_levels')
    .values(
      [10, 11, 12].map((grade) => ({
        code: `K${grade}`,
        name: `Khối ${grade}`,
        order_no: 100 + grade,
        age_from_months: null,
        age_to_months: null,
        school_level: 'THPT' as const,
      })),
    )
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setHighSchoolEnabled(page, true);
  try {
    // 7.1 Môn học và hoạt động giáo dục: bộ mẫu THPT có nhóm môn lựa chọn
    await openMenu(page, '/subjects');
    await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    const subjects = page.getByRole('table', { name: 'Môn học' });
    await expect(subjects).toContainText('Ngữ văn');
    await expect(subjects.getByRole('row', { name: /Vật lí/ })).toContainText('Khoa học tự nhiên');
    await expect(page.getByLabel('Số tiết Ngữ văn Khối 10', { exact: true })).toHaveValue('3');

    // 7.6 Tổ hợp môn: đúng 4 môn lựa chọn thuộc ít nhất 2 nhóm
    await openMenu(page, '/subject-combinations');
    const form = page.getByRole('form', { name: 'Thêm tổ hợp môn' });
    await form.getByLabel('Mã tổ hợp').fill(`KHTN-${suffix}`);
    await form.getByLabel('Tên tổ hợp').fill(`Tổ hợp Lí Hóa Sinh Tin ${suffix}`);
    for (const name of ['Vật lí', 'Hóa học', 'Sinh học']) {
      await form.getByLabel(name, { exact: true }).check();
    }
    await form.getByRole('button', { name: 'Thêm tổ hợp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /đúng 4 môn/ })).toBeVisible();
    await form.getByLabel('Tin học', { exact: true }).check();
    await form.getByRole('button', { name: 'Thêm tổ hợp' }).click();
    await expect(toast(page, /Đã thêm tổ hợp/)).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Tổ hợp môn' }).getByRole('row', { name: /Lí Hóa Sinh Tin/ }),
    ).toContainText('Vật lí, Hóa học, Sinh học, Tin học');

    // 7.7 Tổ bộ môn
    await openMenu(page, '/subject-teams');
    const teamForm = page.getByRole('form', { name: 'Thêm tổ bộ môn' });
    await teamForm.getByLabel('Mã tổ').fill(`TO-LY-${suffix}`);
    await teamForm.getByLabel('Tên tổ').fill(`Tổ Vật lí ${suffix}`);
    await teamForm.getByLabel('Vật lí', { exact: true }).check();
    await teamForm.getByRole('button', { name: 'Thêm tổ' }).click();
    await expect(toast(page, /Đã thêm tổ/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Tổ bộ môn' }).getByRole('row', { name: /Tổ Vật lí/ })).toContainText(
      'Vật lí',
    );
  } finally {
    await setHighSchoolEnabled(page, false);
  }
});
