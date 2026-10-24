import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { expect, test, type Browser, type Page } from './fixtures.js';
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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_SYSTEM_DATABASE_NAME } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Kho học liệu số, phần câu hỏi và chia sẻ (DT-22 phần 22h2, YCTD-184), kịch bản CT-22h2-6: câu hỏi của ngân hàng (22g1,
// chèn thẳng) hiện trong kho, giáo viên thêm vào bộ sưu tập; giáo viên lập rubric, in; Hiệu trưởng nhập gói chia sẻ của trường
// khác, học liệu vào kho ở trạng thái chờ duyệt. Chạy sau 02-academic-years và 03-org-units. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
// Học liệu, bộ sưu tập (22h1) ở cơ sở dữ liệu hệ thống của e2e
const system = createDatabase<SystemDatabase>(
  replaceDatabaseName(readConnectionString('system'), E2E_SYSTEM_DATABASE_NAME),
);
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

const toast = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

async function signIn(browser: Browser, user: { username: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: /^Xin chào,/ })).toBeVisible();
  return page;
}

test('CT-22h2-6: câu hỏi của ngân hàng trong kho, bộ sưu tập, rubric, nhập gói chia sẻ chờ duyệt', async ({
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
  const subject = await schoolYear
    .insertInto('subjects')
    .values({
      code: `KHO-TOAN-${suffix}`,
      name: `Toán kho ${suffix}`,
      school_level: 'THCS',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const questionText = `Câu hỏi kho ${suffix}: 1/2 + 1/4 bằng bao nhiêu?`;
  await schoolYear
    .insertInto('questions')
    .values({
      school_level: 'THCS',
      subject_id: subject.id,
      grade_level_code: 'K6',
      cognitive_level: 'comprehension',
      question_type: 'short_answer',
      content: questionText,
      options: JSON.stringify([]),
      answer: JSON.stringify(['3/4']),
      score: 1,
      status: 'approved',
      author_user_id: teacher.id,
      author_name: `Giáo viên kho ${suffix}`,
    })
    .execute();
  const collectionName = `Ôn tập kho ${suffix}`;
  await system
    .insertInto('resource_collections')
    .values({
      name: collectionName,
      owner_user_id: teacher.id,
      owner_name: `Giáo viên kho ${suffix}`,
      visibility: 'school',
    })
    .execute();

  // Giáo viên: 8. Câu hỏi, đề trong kho: tìm câu của ngân hàng, thêm vào bộ sưu tập
  const page = await signIn(browser, teacher);
  await openMenu(page, '/learning-resources/questions');
  await page.getByLabel('Tìm', { exact: true }).fill(`Câu hỏi kho ${suffix}`);
  const bank = page.getByRole('table', { name: 'Câu hỏi, đề trong kho' });
  const row = bank.getByRole('row', { name: new RegExp(`Câu hỏi kho ${suffix}`) });
  await expect(row).toContainText('Dùng được');
  await expect(row.getByRole('link', { name: 'Mở ở ngân hàng' })).toHaveAttribute('href', '/question-bank');
  await page.getByLabel('Thêm vào bộ sưu tập').selectOption({ label: collectionName });
  await row.getByRole('button', { name: 'Thêm' }).click();
  await expect(toast(page, 'Đã thêm vào bộ sưu tập')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Mục ngân hàng trong bộ sưu tập' })).toContainText(questionText);

  // 9. Rubric: lập rubric 3 mức, 2 tiêu chí; in
  await openMenu(page, '/learning-resources/rubrics');
  const rubricName = `Rubric thuyết trình ${suffix}`;
  await page.getByLabel('Tên rubric').fill(rubricName);
  await page.getByLabel('Tiêu chí 1', { exact: true }).fill('Nội dung');
  for (const [index, text] of ['Sai', 'Đúng một phần', 'Đúng đủ'].entries()) {
    await page.getByLabel(`Mô tả tiêu chí 1 mức ${index + 1}`).fill(text);
  }
  await page.getByRole('button', { name: 'Thêm tiêu chí' }).click();
  await page.getByLabel('Tiêu chí 2', { exact: true }).fill('Trình bày');
  await page.getByLabel('Trọng số tiêu chí 2').fill('2');
  for (const [index, text] of ['Lộn xộn', 'Rõ', 'Rõ, cuốn hút'].entries()) {
    await page.getByLabel(`Mô tả tiêu chí 2 mức ${index + 1}`).fill(text);
  }
  await page.getByRole('button', { name: 'Lưu rubric' }).click();
  await expect(toast(page, `Đã lưu rubric ${rubricName} (điểm tối đa 6)`)).toBeVisible();
  const rubricRow = page
    .getByRole('table', { name: 'Danh sách rubric' })
    .getByRole('row', { name: new RegExp(rubricName) });
  await expect(rubricRow).toContainText('2 × 3');
  const printed = page.waitForEvent('download');
  await rubricRow.getByRole('button', { name: 'In' }).click();
  expect((await printed).suggestedFilename()).toBe('rubric.pdf');

  // Hiệu trưởng: 10. Gói chia sẻ: nhập gói của trường khác; học liệu vào kho chờ duyệt
  const file = Buffer.from(`%PDF-1.4\n% goi chia se ${suffix}\n%%EOF\n`);
  const packageCode = `GOI-E2E-${suffix}`;
  const resourceTitle = `Phiếu từ trường bạn ${suffix}`;
  const packageFile = gzipSync(
    Buffer.from(
      JSON.stringify({
        format: 'school-management.resource-package/1',
        package_code: packageCode,
        source_school: 'Trường THCS Bạn',
        created_at: new Date().toISOString(),
        items: [
          {
            title: resourceTitle,
            description: null,
            type_code: 'worksheet',
            school_level: 'THCS',
            grade_level_code: 'K6',
            subject_code: null,
            subject_name: null,
            keywords: [],
            author_name: 'Tác giả giả',
            language: 'vi',
            duration_minutes: null,
            license_code: 'CC-BY',
            license_source: null,
            origin: null,
            kind: 'file',
            file_name: 'phieu.pdf',
            content_type: 'application/pdf',
            sha256: createHash('sha256').update(file).digest('hex'),
            data: file.toString('base64'),
            url: null,
            link_title: null,
          },
        ],
      }),
    ),
  );
  const admin = await signIn(browser, principal);
  await openMenu(admin, '/learning-resources/packages');
  await admin
    .getByLabel('Tệp gói')
    .setInputFiles({ name: 'goi.hoclieu.gz', mimeType: 'application/gzip', buffer: packageFile });
  await admin.getByRole('button', { name: 'Nhập gói' }).click();
  await expect(toast(admin, 'Đã nhập 1 học liệu, bỏ qua 0; học liệu nhập đang chờ duyệt')).toBeVisible();
  await expect(admin.getByRole('table', { name: 'Lịch sử nhập gói' })).toContainText(packageCode);
  const imported = await system
    .selectFrom('learning_resources')
    .select(['status', 'origin'])
    .where('title', '=', resourceTitle)
    .executeTakeFirstOrThrow();
  expect(imported.status).toBe('pending_school');
  expect(imported.origin).toContain(`Gói ${packageCode} của Trường THCS Bạn`);
});
