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

// Thi đua, khen thưởng (DT-18 phần 22d, YCTD-148), kịch bản CT-22d-10: Hiệu trưởng nạp danh mục, lập và phát động đợt;
// giáo viên đăng ký, lập hồ sơ đề nghị Lao động tiên tiến, tự chấm, nộp; Hiệu trưởng tiếp nhận, lập hội đồng, mở phiên, bỏ
// phiếu kín, đóng phiên, công bố; lập và ban hành quyết định; trang tra cứu công khai đối chiếu mã trên giấy khen. Chạy sau
// 02-academic-years và 03-org-units. Dữ liệu giả
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

test('CT-22d-10: phát động, đăng ký, hồ sơ đề nghị, hội đồng bỏ phiếu kín, quyết định khen thưởng, tra cứu giấy khen', async ({
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
  const principalName = `Hiệu trưởng TĐ ${suffix}`;
  const teacherName = `Giáo viên TĐ ${suffix}`;
  for (const [index, [user, name]] of (
    [
      [principal, principalName],
      [teacher, teacherName],
    ] as const
  ).entries()) {
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: root.id,
        code: `TD-${suffix}-${index}`,
        full_name: name,
        start_date: '2025-08-01',
        user_id: user.id,
      })
      .execute();
  }
  const campaignName = `Thi đua E2E ${suffix}`;

  // Hiệu trưởng: 6.1 nạp danh mục mặc định; 1.1 lập và phát động đợt
  const head = await signIn(browser, principal);
  await openMenu(head, '/emulation/titles');
  await expect(head.getByRole('heading', { name: '6.1. Danh hiệu và hình thức khen thưởng' })).toBeVisible();
  await head.getByRole('button', { name: 'Nạp danh mục mặc định' }).click();
  await expect(head.getByText(/Đã nạp \d+ danh hiệu/)).toBeVisible();
  await expect(head.getByRole('cell', { name: 'Lao động tiên tiến', exact: true })).toBeVisible();
  await openMenu(head, '/emulation/campaigns');
  await head.getByRole('button', { name: 'Thêm đợt thi đua' }).click();
  const campaignForm = head.getByRole('form', { name: 'Đợt thi đua' });
  await campaignForm.getByLabel('Mã đợt').fill(`E2E-${suffix}`);
  await campaignForm.getByLabel('Tên đợt thi đua').fill(campaignName);
  await campaignForm.getByLabel('Nội dung phát động').fill('Thi đua dạy tốt, học tốt.');
  await campaignForm.getByLabel(/^Lao động tiên tiến \(/).check();
  await campaignForm.getByRole('button', { name: 'Ghi' }).click();
  await expect(head.getByText(`Đã ghi đợt thi đua ${campaignName}`)).toBeVisible();
  await head.getByRole('cell', { name: campaignName }).click();
  await head.getByRole('button', { name: 'Phát động' }).click();
  await expect(head.getByText(`${campaignName}: Đã phát động`)).toBeVisible();
  const campaign = await schoolYear
    .selectFrom('emulation_campaigns')
    .select('id')
    .where('name', '=', campaignName)
    .executeTakeFirstOrThrow();

  // Giáo viên: 1.2 đăng ký thi đua; 2.1 lập hồ sơ, tự chấm, nộp
  const staff = await signIn(browser, teacher);
  await openMenu(staff, '/emulation/registrations');
  await staff.getByLabel('Đợt thi đua').selectOption(campaign.id);
  const registration = staff.getByRole('form', { name: 'Đăng ký thi đua mới' });
  await registration
    .getByLabel('Danh hiệu, hình thức khen thưởng')
    .selectOption({ label: 'Lao động tiên tiến (Cá nhân)' });
  await registration.getByLabel('Nội dung cam kết, chỉ tiêu phấn đấu').fill('Hoàn thành tốt nhiệm vụ');
  await registration.getByRole('button', { name: 'Đăng ký' }).click();
  await expect(staff.getByText(`Đã đăng ký Lao động tiên tiến cho ${teacherName}`)).toBeVisible();
  await openMenu(staff, '/emulation/nominations');
  await staff.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await staff.getByRole('button', { name: 'Lập hồ sơ đề nghị' }).click();
  const nominationForm = staff.getByRole('form', { name: 'Lập hồ sơ đề nghị' });
  await nominationForm
    .getByLabel('Danh hiệu, hình thức khen thưởng')
    .selectOption({ label: 'Lao động tiên tiến (Cá nhân)' });
  await nominationForm.getByRole('button', { name: 'Lập hồ sơ' }).click();
  await expect(staff.getByText(/Đã lập hồ sơ Lao động tiên tiến/)).toBeVisible();
  const editor = staff.getByRole('form', { name: 'Nội dung hồ sơ đề nghị' });
  await editor.getByLabel('Tóm tắt thành tích').fill('Chủ nhiệm lớp đạt chuyên đề cấp trường.');
  await editor.getByLabel(/^Kết quả thực hiện nhiệm vụ được giao/).fill('9');
  await editor.getByLabel(/^Phẩm chất chính trị/).fill('10');
  await editor.getByLabel(/^Tham gia phong trào thi đua/).fill('8');
  await editor.getByLabel(/^Học tập, bồi dưỡng/).fill('7');
  await expect(editor.getByText('Điểm quy về thang 100: 86')).toBeVisible();
  await editor.getByRole('button', { name: 'Ghi hồ sơ' }).click();
  await expect(staff.getByText('Đã ghi hồ sơ đề nghị')).toBeVisible();
  await staff.getByRole('button', { name: 'Nộp hồ sơ' }).click();
  await expect(staff.getByText(`${teacherName}: Đã nộp, chờ tiếp nhận`)).toBeVisible();

  // Hiệu trưởng: duyệt đăng ký; 2.2 tiếp nhận hồ sơ từ Việc của tôi
  await openMenu(head, '/emulation/registrations');
  await head.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await head.getByRole('tab', { name: 'Mọi đăng ký' }).click();
  await head.getByRole('checkbox', { name: `Chọn ${teacherName} – Lao động tiên tiến` }).check();
  await head.getByRole('button', { name: 'Duyệt đăng ký' }).click();
  await expect(head.getByText('Đã duyệt 1 đăng ký')).toBeVisible();
  await head.getByRole('link', { name: /^Việc của tôi/ }).click();
  await expect(head.getByRole('cell', { name: `Lao động tiên tiến – ${teacherName}` })).toBeVisible();
  await openMenu(head, '/emulation/nominations/review');
  await head.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await head.getByRole('cell', { name: teacherName }).first().click();
  await expect(head.getByText('Chủ nhiệm lớp đạt chuyên đề cấp trường.')).toBeVisible();
  await head.getByRole('button', { name: 'Tiếp nhận' }).click();
  await expect(head.getByText(`${teacherName}: Đã tiếp nhận, chờ bình xét`)).toBeVisible();

  // 3.1 hội đồng (Hiệu trưởng là Chủ tịch), mở phiên; 3.2 bỏ phiếu kín; đóng phiên, công bố
  await openMenu(head, '/emulation/council');
  await head.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await head.getByRole('button', { name: 'Thêm thành viên' }).click();
  await head.getByLabel('Thành viên 1').selectOption({ label: principalName });
  await head.getByRole('button', { name: 'Ghi hội đồng' }).click();
  await expect(head.getByText('Đã ghi hội đồng 1 thành viên')).toBeVisible();
  await head.getByRole('button', { name: 'Mở phiên bỏ phiếu' }).click();
  await expect(head.getByText('Đã mở phiên bỏ phiếu 1 hồ sơ')).toBeVisible();
  await openMenu(head, '/emulation/voting');
  await head
    .getByRole('radiogroup', { name: `Phiếu cho ${teacherName}` })
    .getByLabel('Đồng ý')
    .check();
  await head.getByRole('button', { name: 'Ghi phiếu' }).click();
  await expect(head.getByText('Đã ghi phiếu bình xét')).toBeVisible();
  await openMenu(head, '/emulation/council');
  await head.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await head.getByLabel('Số thành viên có mặt').fill('1');
  await head.getByRole('button', { name: 'Đóng phiên, tính kết quả' }).click();
  await expect(head.getByText('Đã đóng phiên, tính kết quả và lập biên bản')).toBeVisible();
  await head.getByRole('button', { name: 'Công bố kết quả bình xét' }).click();
  await expect(head.getByText(/Đã công bố kết quả; phúc khảo, khiếu nại đến hết ngày/)).toBeVisible();

  // 4.1 lập quyết định, ban hành; giấy khen có mã tra cứu
  await openMenu(head, '/emulation/decisions');
  await head.getByRole('button', { name: 'Lập quyết định, tờ trình' }).click();
  const decisionForm = head.getByRole('form', { name: 'Lập quyết định khen thưởng' });
  await decisionForm.getByLabel('Đợt thi đua').selectOption(campaign.id);
  await decisionForm.getByLabel(`${teacherName} – Lao động tiên tiến`).check();
  await decisionForm.getByRole('button', { name: 'Lập', exact: true }).click();
  await expect(head.getByText('Đã lập quyết định khen thưởng của trường')).toBeVisible();
  await head.getByLabel('Số, ký hiệu').fill(`${suffix}/QĐ-TĐ`);
  await head.getByRole('button', { name: 'Ban hành' }).click();
  await expect(head.getByText(`Đã ban hành số ${suffix}/QĐ-TĐ`)).toBeVisible();
  await expect(head.getByRole('button', { name: 'Tải giấy khen' })).toBeVisible();
  const award = await schoolYear
    .selectFrom('emulation_awards')
    .select('lookup_code')
    .where('decision_number', '=', `${suffix}/QĐ-TĐ`)
    .executeTakeFirstOrThrow();

  // Trang tra cứu công khai không cần đăng nhập
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/tra-cuu-khen-thuong?ma=${award.lookup_code}`);
  const result = visitor.getByRole('region', { name: 'Kết quả tra cứu' });
  await expect(result.getByText(teacherName)).toBeVisible();
  await expect(result.getByText('Lao động tiên tiến')).toBeVisible();
  await expect(result.getByText(`${suffix}/QĐ-TĐ`)).toBeVisible();
});
