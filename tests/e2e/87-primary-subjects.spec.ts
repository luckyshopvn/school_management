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

// Nền Tiểu học (DT-20 phần 20a, YCTD-158), kịch bản CT-20a-6: trường bật Tiểu học; Hiệu trưởng nạp môn mẫu ở 7.1 Môn học và
// hoạt động giáo dục, xem và sửa số tiết theo khối; phân công giáo viên bộ môn theo môn cho lớp 1 ở 7.2, xem tổng tiết của
// giáo viên. Cuối kịch bản tắt lại Tiểu học để trường trở về chỉ có Mầm non. Dữ liệu giả
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

async function setPrimaryEnabled(page: Page, enabled: boolean) {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Cấp học của trường' });
  const primary = card.getByLabel('Bật cấp TH', { exact: true });
  if (enabled) {
    await primary.check();
  } else {
    await primary.uncheck();
  }
  await card.getByRole('button', { name: 'Ghi cấp học' }).click();
  await expect(toast(page, 'Đã ghi cấp học của trường')).toBeVisible();
}

test('CT-20a-6: nạp môn mẫu Tiểu học, sửa số tiết theo khối, phân công giáo viên bộ môn theo môn', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const subjectTeacher = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }],
  });
  const teacherName = `Giáo viên Tiếng Việt ${suffix}`;
  await identity.updateTable('users').set({ full_name: teacherName }).where('id', '=', subjectTeacher.id).execute();
  // Khối mẫu Tiểu học (19b) nạp sẵn để kịch bản tập trung vào môn học
  await schoolYear
    .insertInto('grade_levels')
    .values(
      [1, 2, 3, 4, 5].map((grade) => ({
        code: `K${grade}`,
        name: `Khối ${grade}`,
        order_no: 100 + grade,
        age_from_months: null,
        age_to_months: null,
        school_level: 'TH' as const,
      })),
    )
    .onConflict((conflict) => conflict.column('code').doNothing())
    .execute();
  const className = `Lớp 1C ${suffix}`;
  await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `1C-${suffix}`,
      name: className,
      grade_level: 'K1',
      school_level: 'TH',
      max_size: 35,
    })
    .execute();

  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(principal.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(principal.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  await setPrimaryEnabled(page, true);
  try {
    // 7.1 Môn học và hoạt động giáo dục: nạp bộ mẫu, bảng số tiết theo khối
    await openMenu(page, '/subjects');
    await page.getByRole('button', { name: 'Nạp môn mẫu' }).click();
    await expect(toast(page, /Đã nạp \d+ môn mẫu/)).toBeVisible();
    const subjects = page.getByRole('table', { name: 'Môn học' });
    await expect(subjects).toContainText('Tiếng Việt');
    await expect(subjects).toContainText('Hoạt động trải nghiệm');
    await expect(page.getByLabel('Số tiết Tiếng Việt Khối 1', { exact: true })).toHaveValue('12');
    await expect(page.getByTestId('periods-total-K1')).toHaveText('25');
    await page.getByLabel('Số tiết Đạo đức Khối 1', { exact: true }).fill('2');
    await expect(page.getByTestId('periods-total-K1')).toHaveText('26');
    await page.getByRole('button', { name: 'Ghi số tiết' }).click();
    await expect(toast(page, 'Đã ghi số tiết theo khối')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Số tiết Đạo đức Khối 1', { exact: true })).toHaveValue('2');

    // 7.2 Phân công giảng dạy theo môn
    await openMenu(page, '/teaching-assignments');
    await page.getByLabel('Đơn vị', { exact: true }).selectOption(reference.org_unit_id);
    await page.getByLabel('Lớp Tiểu học', { exact: true }).selectOption({ label: className });
    const table = page.getByRole('table', { name: 'Môn của lớp' });
    const vietnamese = table.getByRole('row', { name: 'Tiếng Việt' });
    await expect(vietnamese).toContainText('12');
    await vietnamese.getByLabel('Giáo viên môn Tiếng Việt', { exact: true }).selectOption({ label: teacherName });
    await vietnamese.getByRole('button', { name: 'Phân công' }).click();
    await expect(toast(page, 'Đã phân công môn Tiếng Việt')).toBeVisible();
    await expect(vietnamese).toContainText(`${teacherName} · 12 tiết`);
    await expect(
      page.getByRole('table', { name: 'Tổng tiết giáo viên' }).getByRole('row', { name: new RegExp(teacherName) }),
    ).toContainText('12');
  } finally {
    await setPrimaryEnabled(page, false);
  }
});
