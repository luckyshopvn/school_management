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
import { E2E_SCHOOL_YEAR_DATABASE_PREFIX, E2E_TEACHER_PORT } from '../e2e-environment.mjs';

// Công cụ lớp học trên ứng dụng giáo viên (DT-23 phần 23b, YCTD-212), kịch bản CT-23b-14: giáo viên chủ nhiệm gọi tên ngẫu nhiên
// (không lặp, loại học sinh vắng), chia nhóm, dùng đồng hồ, chấm điểm nhanh rồi xác nhận ghi vào nề nếp; mất mạng sau lần tải
// đầu vẫn mở được công cụ với danh sách lớp đã lưu, gọi tên khi ngoại tuyến rồi đồng bộ khi có mạng; đăng xuất xóa dữ liệu trên
// máy; trường tắt ngoại tuyến thì gỡ service worker và bản chụp danh sách lớp. Dữ liệu giả
const identity = createDatabase<IdentityDatabase>(readConnectionString('identity'));
let schoolYear: ReturnType<typeof createDatabase<SchoolYearDatabase>>;
const TEACHER_URL = `http://localhost:${E2E_TEACHER_PORT}`;
const STORAGE_PREFIX = 'cong-cu-lop-hoc:';

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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(TEACHER_URL);
  await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  return page;
}

// Mã chạy trong trang dùng kiểu của trình duyệt, gói kiểm thử không nạp thư viện kiểu DOM (hàm truyền vào evaluate chạy ở trang nên ép kiểu ngay trong hàm)
type BrowserGlobals = {
  navigator: { serviceWorker: { ready: Promise<unknown>; getRegistrations(): Promise<unknown[]> } };
  caches: { keys(): Promise<string[]> };
};

const storedKeys = (page: Page) =>
  page.evaluate((prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix)), STORAGE_PREFIX);

test('CT-23b-14: gọi tên, chia nhóm, đồng hồ, bảng điểm vào nề nếp, ngoại tuyến và đồng bộ, đăng xuất, tắt ngoại tuyến', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const suffix = Date.now() % 1_000_000;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id', 'grade_level'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const root = await schoolYear
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirstOrThrow();
  const className = `Lớp công cụ ${suffix}`;
  const classRow = await schoolYear
    .insertInto('classes')
    .values({
      org_unit_id: reference.org_unit_id,
      academic_year_id: reference.academic_year_id,
      code: `CC-${suffix}`,
      name: className,
      grade_level: reference.grade_level,
      school_level: 'MN',
      max_size: 30,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const names = ['Bé An', 'Bé Bình', 'Bé Chi', 'Bé Dũng'].map((name) => `${name} ${suffix}`);
  const childIds: string[] = [];
  for (const [index, name] of names.entries()) {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: reference.org_unit_id,
        full_name: name,
        dob: '2021-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: `cc-${suffix}-${index}`,
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    childIds.push(child.id);
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classRow.id, from_date: '2026-09-05', order_number: index + 1 })
      .execute();
  }
  // Bé Dũng vắng hôm nay: gọi tên loại em ra
  await schoolYear
    .insertInto('attendance_records')
    .values({
      child_id: childIds[3] ?? '',
      class_id: classRow.id,
      org_unit_id: reference.org_unit_id,
      attendance_date: today,
      status: 'absent_unnotified',
      source: 'teacher',
      recorded_by: root.id,
      recorded_at: new Date(),
    })
    .execute();
  const teacher = await createTestUser(identity, {
    roles: [{ roleCode: 'VT-07', orgUnitId: reference.org_unit_id }],
  });
  const teacherName = (
    await identity.selectFrom('users').select('full_name').where('id', '=', teacher.id).executeTakeFirstOrThrow()
  ).full_name;
  await schoolYear
    .insertInto('class_staff_assignments')
    .values({
      class_id: classRow.id,
      staff_user_id: teacher.id,
      staff_name: teacherName,
      assignment_role: 'homeroom',
      from_date: '2026-09-05',
    })
    .execute();
  // Nề nếp, thi đua bật với một tiêu chí cộng điểm Mầm non
  await schoolYear.updateTable('conduct_settings').set({ enabled: true }).execute();
  const criterion = await schoolYear
    .insertInto('conduct_criteria')
    .values({ code: `CC${suffix}`, name: `Hợp tác tốt ${suffix}`, kind: 'plus', points: 3, school_level: 'MN' })
    .returning('id')
    .executeTakeFirstOrThrow();

  const page = await signIn(browser, teacher);
  // Tệp dựng của trang nằm trong service worker ngay sau lần tải đầu (trường mặc định bật ngoại tuyến)
  await page.evaluate(() =>
    (globalThis as unknown as BrowserGlobals).navigator.serviceWorker.ready.then(() => undefined),
  );
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await (globalThis as unknown as BrowserGlobals).caches.keys()).some((name) =>
          name.startsWith('cong-cu-lop-hoc-v-'),
        ),
      ),
    )
    .toBe(true);
  const manifest = await page.request.get(`${TEACHER_URL}/manifest.webmanifest`);
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).display).toBe('standalone');

  await page.getByRole('button', { name: 'Công cụ lớp học' }).click();
  await expect(page.getByRole('heading', { name: 'Công cụ lớp học' })).toBeVisible();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });

  // Gọi tên ngẫu nhiên, không lặp, loại học sinh vắng: ba em có mặt được gọi đủ rồi báo hết
  const chosen = page.getByLabel('Học sinh được gọi');
  const called: string[] = [];
  for (let round = 0; round < 3; round += 1) {
    await page.getByRole('button', { name: 'Gọi tên', exact: true }).click();
    await expect(chosen).toContainText('Bé');
    const text = (await chosen.innerText()).replace(/Số thứ tự \d+\s*/, '').trim();
    called.push(text);
    await expect(page.getByText(`Đã gọi ${round + 1}/4 trong lượt này`)).toBeVisible();
  }
  expect(new Set(called).size).toBe(3);
  expect(called.join(' ')).not.toContain(names[3] ?? '');
  await page.getByRole('button', { name: 'Gọi tên', exact: true }).click();
  await expect(page.getByText('Đã gọi hết cả lớp trong lượt này')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await schoolYear.selectFrom('classroom_call_logs').select('id').where('class_id', '=', classRow.id).execute())
          .length,
    )
    .toBe(3);
  const history = page.getByRole('list', { name: 'Lịch sử gọi' });
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await history
    .getByRole('button', { name: /^Xóa lượt gọi/ })
    .first()
    .click();
  await expect(history.getByRole('listitem')).toHaveCount(2);

  // Chia nhóm: hai nhóm từ ba học sinh có mặt, lưu bản chia
  await page.getByRole('tab', { name: 'Chia nhóm' }).click();
  await page.getByLabel('Số nhóm', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Chia nhóm', exact: true }).click();
  await expect(page.getByText('Đã chia 2 nhóm')).toBeVisible();
  const groups = page.getByRole('list', { name: 'Các nhóm' }).getByRole('listitem');
  await expect(groups).toHaveCount(2);
  const sizes = (await groups.allInnerTexts()).map((text) => Number(/\((\d+) học sinh\)/.exec(text)?.[1]));
  expect(sizes.sort()).toEqual([1, 2]);
  const grouping = await schoolYear
    .selectFrom('classroom_groupings')
    .select('groups')
    .where('class_id', '=', classRow.id)
    .executeTakeFirstOrThrow();
  expect((grouping.groups as unknown as unknown[]).length).toBe(2);

  // Đồng hồ: đếm ngược chạy
  await page.getByRole('tab', { name: 'Đồng hồ' }).click();
  await page.getByRole('button', { name: 'Đếm ngược 1 phút' }).click();
  await page.getByRole('button', { name: 'Chạy Đếm ngược 1' }).click();
  await expect(page.getByRole('timer', { name: /Đếm ngược 1: 00:5\d/ })).toBeVisible();
  await page.getByRole('button', { name: 'Dừng Đếm ngược 1' }).click();

  // Bảng điểm nhanh: chấm theo nhóm, chưa ghi nề nếp thì chưa có dòng nào, xác nhận mới ghi
  await page.getByRole('tab', { name: 'Bảng điểm' }).click();
  await page.getByRole('button', { name: 'Cộng 2 điểm cho Nhóm 1' }).click();
  await page.getByRole('button', { name: 'Cộng 1 điểm cho Nhóm 1' }).click();
  await expect(page.getByLabel('Điểm Nhóm 1')).toHaveText('3 điểm');
  await expect
    .poll(
      async () =>
        (
          await schoolYear
            .selectFrom('classroom_score_events')
            .select('id')
            .where('class_id', '=', classRow.id)
            .execute()
        ).length,
    )
    .toBe(2);
  expect(
    (await schoolYear.selectFrom('conduct_entries').select('id').where('class_id', '=', classRow.id).execute()).length,
  ).toBe(0);
  await page.getByLabel('Tiêu chí', { exact: true }).selectOption(criterion.id);
  await page.getByRole('button', { name: 'Ghi vào nề nếp', exact: true }).click();
  await expect(page.getByText('Đã ghi vào nề nếp, thi đua: 3 lần')).toBeVisible();
  const entry = await schoolYear
    .selectFrom('conduct_entries')
    .select(['quantity', 'points', 'recorded_by'])
    .where('class_id', '=', classRow.id)
    .executeTakeFirstOrThrow();
  expect(entry).toMatchObject({ quantity: 3, points: 9, recorded_by: teacher.id });

  // Có dữ liệu trên máy: bản chụp danh sách lớp gọn (không điểm, nhận xét), có hạn
  const snapshot = await page.evaluate(
    (prefix) => JSON.parse(localStorage.getItem(`${prefix}danh-sach`) ?? '{}'),
    STORAGE_PREFIX,
  );
  const saved = snapshot[classRow.id];
  expect(saved.students).toHaveLength(4);
  expect(Object.keys(saved.students[0]).sort()).toEqual(['absent', 'code', 'full_name', 'id', 'order_no']);

  // Mất mạng sau lần tải đầu: nạp lại một lần có mạng để bộ nhớ đệm của service worker đủ, rồi ngắt mạng và tải lại
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  await page.context().setOffline(true);
  await page.reload();
  // Trang dựng từ bộ nhớ đệm của service worker, máy chậm có thể quá 5 giây mặc định
  await expect(page.getByRole('heading', { name: 'Công cụ lớp học' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Đang dùng ngoại tuyến')).toBeVisible();
  await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
  await expect(page.getByText(/Danh sách lớp lưu trên máy lúc/)).toBeVisible();
  await page.getByRole('button', { name: 'Gọi tên', exact: true }).click();
  await expect(page.getByLabel('Học sinh được gọi')).toContainText('Bé');
  await expect(page.getByText('1 mục chờ gửi lên máy chủ: sẽ gửi khi có mạng')).toBeVisible();
  const offlineCalls = (
    await schoolYear.selectFrom('classroom_call_logs').select('id').where('class_id', '=', classRow.id).execute()
  ).length;
  expect(offlineCalls).toBe(2);

  // Có mạng lại: phiên được xác nhận, hàng đợi gửi lên, máy chủ chống trùng
  await page.context().setOffline(false);
  await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await schoolYear.selectFrom('classroom_call_logs').select('id').where('class_id', '=', classRow.id).execute())
          .length,
    )
    .toBe(3);
  await expect
    .poll(
      async () =>
        await page.evaluate(
          (prefix) => JSON.parse(localStorage.getItem(`${prefix}hang-doi`) ?? '{}').calls?.length ?? 0,
          STORAGE_PREFIX,
        ),
    )
    .toBe(0);

  // Đăng xuất xóa mọi dữ liệu công cụ lớp học trên máy
  expect((await storedKeys(page)).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByLabel('Số điện thoại hoặc tên đăng nhập')).toBeVisible();
  expect(await storedKeys(page)).toEqual([]);

  // Trường tắt ngoại tuyến: đăng nhập lại thì service worker, bộ nhớ đệm và bản chụp danh sách lớp bị gỡ
  await schoolYear
    .insertInto('settings')
    .values({
      org_unit_id: root.id,
      key: 'classroom_offline_enabled',
      value_type: 'boolean',
      value: JSON.stringify(false),
    })
    .onConflict((conflict) => conflict.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(false) }))
    .execute();
  try {
    await page.getByLabel('Số điện thoại hoặc tên đăng nhập').fill(teacher.username);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(teacher.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Lớp của tôi' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await (globalThis as unknown as BrowserGlobals).navigator.serviceWorker.getRegistrations()).length,
        ),
      )
      .toBe(0);
    expect(
      await page.evaluate(async () =>
        (await (globalThis as unknown as BrowserGlobals).caches.keys()).filter((name) =>
          name.startsWith('cong-cu-lop-hoc-v-'),
        ),
      ),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Công cụ lớp học' }).click();
    await page.getByLabel('Lớp', { exact: true }).selectOption({ label: className });
    await expect(page.getByRole('button', { name: 'Gọi tên', exact: true })).toBeVisible();
    expect(await page.evaluate((prefix) => localStorage.getItem(`${prefix}danh-sach`), STORAGE_PREFIX)).toBeNull();
  } finally {
    await schoolYear.deleteFrom('settings').where('key', '=', 'classroom_offline_enabled').execute();
    await schoolYear.updateTable('conduct_settings').set({ enabled: false }).execute();
  }
});
