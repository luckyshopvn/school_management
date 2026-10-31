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

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149), kịch bản CT-22f-9: Hiệu trưởng nạp bộ tiêu chuẩn Mầm non, lập
// đợt tự đánh giá, lập hội đồng, nhóm công tác và phân công tiêu chí, bắt đầu; giáo viên của nhóm soạn, nộp phiếu tiêu chí
// 1.1 và thêm minh chứng có mã; Hiệu trưởng duyệt phiếu. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
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
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}

test('CT-22f-9: nạp bộ tiêu chuẩn; lập đợt, hội đồng, nhóm công tác, bắt đầu; giáo viên soạn, nộp phiếu, thêm minh chứng; Hiệu trưởng duyệt phiếu', async ({
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
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: root.id }] });
  const headName = `Hiệu trưởng BĐCL ${suffix}`;
  const teacherName = `Giáo viên BĐCL ${suffix}`;
  for (const [index, [user, name]] of (
    [
      [principal, headName],
      [teacher, teacherName],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `BDCL-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
      })
      .execute();
  }
  const title = `Tự đánh giá E2E ${suffix}`;

  // Hiệu trưởng: 3.1 nạp bộ tiêu chuẩn mẫu Mầm non (spec 243 có thể đã nạp trước)
  const head = await signIn(browser, principal);
  await openMenu(head, '/quality/frameworks');
  await expect(head.getByRole('heading', { name: '3.1. Bộ tiêu chuẩn đánh giá' })).toBeVisible();
  await head.getByLabel('Cấp học').selectOption('MN');
  await head.getByRole('button', { name: 'Nạp bộ tiêu chuẩn mẫu' }).click();
  await expect(head.getByText(/Đã nạp \d+ bộ tiêu chuẩn/)).toBeVisible();
  await expect(head.getByRole('cell', { name: 'Kiểm định chất lượng giáo dục trường mầm non' })).toBeVisible();

  // 2.1 lập đợt, hội đồng, nhóm công tác phụ trách mọi tiêu chí, bắt đầu
  await openMenu(head, '/quality/assessments');
  await head.getByRole('button', { name: 'Lập đợt tự đánh giá' }).click();
  const form = head.getByRole('form', { name: 'Lập đợt tự đánh giá' });
  await form.getByLabel('Bộ tiêu chuẩn').selectOption({ label: 'Kiểm định chất lượng giáo dục trường mầm non' });
  await form.getByLabel('Tên đợt').fill(title);
  await form.getByRole('button', { name: 'Ghi' }).click();
  await expect(head.getByText('Đã lập đợt tự đánh giá; lập hội đồng, nhóm công tác rồi bắt đầu')).toBeVisible();
  const panel = head.getByLabel(`Chi tiết đợt ${title}`);
  await panel.getByRole('tab', { name: 'Hội đồng' }).click();
  await panel.getByRole('button', { name: 'Thêm thành viên' }).click();
  await panel.getByLabel('Thành viên 1').selectOption({ label: headName });
  await panel.getByRole('button', { name: 'Ghi hội đồng' }).click();
  await expect(head.getByText('Đã ghi hội đồng tự đánh giá')).toBeVisible();
  await panel.getByRole('tab', { name: 'Nhóm công tác' }).click();
  await panel.getByRole('button', { name: 'Thêm nhóm' }).click();
  await panel.getByLabel('Trưởng nhóm').selectOption({ label: teacherName });
  const criteria = await schoolYear
    .selectFrom('quality_criteria')
    .innerJoin('quality_frameworks', 'quality_frameworks.id', 'quality_criteria.framework_id')
    .select('quality_criteria.code')
    .where('quality_frameworks.code', '=', 'MN-KDCL')
    .execute();
  for (const criterion of criteria) {
    await panel.getByLabel(`Tiêu chí ${criterion.code} cho Nhóm 1`, { exact: true }).check();
  }
  await panel.getByRole('button', { name: 'Ghi nhóm công tác' }).click();
  await expect(head.getByText('Đã ghi nhóm công tác và phân công tiêu chí')).toBeVisible();
  await panel.getByRole('tab', { name: 'Thông tin chung' }).click();
  await panel.getByRole('button', { name: 'Bắt đầu đánh giá' }).click();
  await expect(head.getByText('Đã bắt đầu đánh giá; các nhóm soạn phiếu tiêu chí')).toBeVisible();

  // Giáo viên: 2.2 soạn, nộp phiếu tiêu chí 1.1; 1.1 thêm minh chứng vào kho (YCTD-396)
  const staff = await signIn(browser, teacher);
  await openMenu(staff, '/quality/reports');
  await staff.getByLabel('Đợt tự đánh giá').selectOption({ label: title });
  await staff.getByRole('cell', { name: '1.1', exact: true }).click();
  const sheet = staff.getByLabel('Phiếu tiêu chí 1.1');
  await sheet.getByLabel('Mô tả hiện trạng').fill('Nhà trường có kế hoạch chiến lược giai đoạn thử');
  await sheet.getByLabel('Điểm mạnh').fill('Kế hoạch được công khai');
  await sheet.getByLabel('Điểm yếu').fill('Chưa rà soát hằng năm');
  await sheet.getByLabel('Tự đánh giá', { exact: true }).selectOption({ label: 'Mức 1' });
  await sheet.getByRole('button', { name: 'Ghi phiếu' }).click();
  await expect(staff.getByText('Đã ghi phiếu')).toBeVisible();
  await sheet.getByRole('button', { name: 'Nộp phiếu' }).click();
  await expect(staff.getByText('Đã nộp phiếu')).toBeVisible();
  await openMenu(staff, '/quality/evidences');
  await staff.getByRole('button', { name: 'Thêm minh chứng' }).click();
  const evidence = staff.getByRole('form', { name: 'Thêm minh chứng' });
  await evidence.getByLabel('Tiêu chí', { exact: true }).selectOption({ index: 1 });
  await evidence.getByLabel('Tên minh chứng').fill('Kế hoạch chiến lược thử');
  await evidence.getByRole('button', { name: 'Ghi' }).click();
  await expect(staff.getByText('Đã ghi minh chứng [H1-1.1-01]')).toBeVisible();
  await expect(staff.getByRole('cell', { name: '[H1-1.1-01]', exact: true })).toBeVisible();

  // Hiệu trưởng: 2.2 duyệt phiếu
  await openMenu(head, '/quality/reports');
  await head.getByRole('tab', { name: 'Tất cả phiếu' }).click();
  await head.getByLabel('Đợt tự đánh giá').selectOption({ label: title });
  await head.getByRole('cell', { name: '1.1', exact: true }).click();
  await head.getByLabel('Phiếu tiêu chí 1.1').getByRole('button', { name: 'Duyệt phiếu' }).click();
  await expect(head.getByText('Đã duyệt phiếu')).toBeVisible();
  const saved = await schoolYear
    .selectFrom('quality_criterion_reports as reports')
    .innerJoin('quality_assessments as assessments', 'assessments.id', 'reports.assessment_id')
    .innerJoin('quality_criteria as criteria', 'criteria.id', 'reports.criterion_id')
    .select(['reports.status', 'reports.self_level'])
    .where('assessments.title', '=', title)
    .where('criteria.code', '=', '1.1')
    .executeTakeFirstOrThrow();
  expect(saved).toEqual({ status: 'approved', self_level: 1 });
});
