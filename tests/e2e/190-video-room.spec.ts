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
import { E2E_PARENT_PORT, E2E_SCHOOL_YEAR_DATABASE_PREFIX } from '../e2e-environment.mjs';
import { openMenu } from './menu.js';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251), kịch bản CT-27a-8 với bộ giả lập nhà cung cấp (VIDEO_PROVIDER=mock): giáo viên mở
// lớp video của buổi gia sư ở cổng quản trị; cha mẹ đồng ý ghi hình và vào xem, đợi ở phòng chờ; giáo viên cho vào; cha mẹ thấy phòng;
// giáo viên ghi hình, dừng, xem lại bản ghi, kết thúc phòng. Cuối kịch bản tắt lại THCS. Dữ liệu giả
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

test('CT-27a-8: giáo viên mở lớp video của buổi, cha mẹ vào xem qua phòng chờ, ghi hình và xem lại bản ghi', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const suffix = Date.now() % 1_000_000;
  const reference = await schoolYear
    .selectFrom('classes')
    .select(['org_unit_id', 'academic_year_id'])
    .where('school_level', '=', 'MN')
    .executeTakeFirstOrThrow();
  const principal = await createTestUser(identity, { roles: [{ roleCode: 'VT-02', orgUnitId: null }] });
  const teacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: reference.org_unit_id }] });
  const parent = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: reference.org_unit_id }] });
  const parentPhone = `08${String(suffix).padStart(8, '0')}`;
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
  const programName = `Câu lạc bộ thuyết trình ${suffix}`;
  const childName = `Học Sinh Lớp Video ${suffix}`;
  const sessionDate = addDays(today, 1);
  let childId = '';
  let guardianId = '';
  let programId = '';
  try {
    const classRow = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: reference.org_unit_id,
        academic_year_id: reference.academic_year_id,
        code: `8V-${suffix}`,
        name: `Lớp 8V ${suffix}`,
        grade_level: 'K8',
        school_level: 'THCS',
        max_size: 45,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: `LV-${suffix}`, name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    guardianId = (
      await schoolYear
        .insertInto('guardians')
        .values({ full_name: 'Phụ huynh lớp video', phone: parentPhone, user_id: parent.id })
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
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '2727',
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
    // Chương trình bổ trợ đã duyệt, bật ghi hình; một buổi ngày mai; đơn của cha mẹ đã duyệt
    programId = (
      await schoolYear
        .insertInto('tutoring_programs')
        .values({
          name: programName,
          school_level: 'THCS',
          content_type: 'enrichment',
          registration_form: 'Tôi tự nguyện đăng ký cho con tham gia câu lạc bộ thuyết trình trực tuyến.',
          starts_on: today,
          ends_on: addDays(today, 30),
          status: 'approved',
          recording_enabled: true,
          created_by: teacher.id,
          created_by_name: 'Cô Lớp Video',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('tutoring_program_teachers')
      .values({ program_id: programId, teacher_user_id: teacher.id, teacher_name: 'Cô Lớp Video' })
      .execute();
    await schoolYear
      .insertInto('tutoring_program_classes')
      .values({ program_id: programId, class_id: classRow.id })
      .execute();
    await schoolYear
      .insertInto('tutoring_sessions')
      .values({
        program_id: programId,
        session_date: sessionDate,
        start_time: '18:00',
        end_time: '18:45',
        periods: 1,
        created_by: teacher.id,
      })
      .execute();
    await schoolYear
      .insertInto('tutoring_registrations')
      .values({
        program_id: programId,
        child_id: childId,
        guardian_user_id: parent.id,
        guardian_name: 'Phụ huynh lớp video',
        form_text: 'Đơn đăng ký',
        form_hash: 'bam',
        status: 'approved',
        decided_by_name: 'Cô Lớp Video',
        decided_at: new Date(),
      })
      .execute();

    // Giáo viên mở lớp video của buổi ở cổng quản trị (máy chủ dùng bộ giả lập nên không có hình và tiếng)
    const teacherPage = await (await browser.newContext()).newPage();
    await signIn(teacherPage, teacher);
    await openMenu(teacherPage, '/tutoring/sessions');
    await teacherPage.getByRole('button', { name: `Lớp video ${sessionDate}` }).click();
    await teacherPage.getByRole('button', { name: 'Mở lớp video' }).click();
    await expect(toast(teacherPage, 'Đã mở lớp video')).toBeVisible();
    const title = `${programName} ${sessionDate}`;
    await expect(teacherPage.getByRole('region', { name: `Lớp video ${title}` })).toContainText('Phòng giả lập');

    // Cha mẹ đồng ý ghi hình rồi vào xem: phòng có phòng chờ
    const parentPage = await (await browser.newContext()).newPage();
    await parentPage.goto(`http://localhost:${E2E_PARENT_PORT}`);
    await parentPage.getByLabel('Số điện thoại').fill(parentPhone);
    await parentPage.getByLabel('Mật khẩu', { exact: true }).fill(parent.password);
    await parentPage.getByRole('button', { name: 'Đăng nhập' }).click();
    const card = parentPage.getByRole('listitem', { name: childName });
    await card.getByRole('button', { name: 'Gia sư', exact: true }).click();
    const videoPanel = parentPage.getByRole('region', { name: `Lớp video của ${childName}` });
    await videoPanel.getByLabel(`Đồng ý ghi hình ${programName}`).check();
    await expect(videoPanel.getByLabel(`Đồng ý ghi hình ${programName}`)).toBeChecked();
    await videoPanel.getByRole('button', { name: `Vào xem lớp ${title}` }).click();
    await expect(videoPanel.getByText('Đang ở phòng chờ, gia sư sẽ cho vào.')).toBeVisible();

    // Giáo viên cho cha mẹ vào; ứng dụng phụ huynh hỏi lại mỗi 5 giây rồi vào phòng
    const controls = teacherPage.getByRole('region', { name: 'Điều khiển phòng' });
    await controls.getByRole('button', { name: /^Cho .+ vào$/ }).click({ timeout: 15_000 });
    await expect(toast(teacherPage, 'Đã cho vào phòng')).toBeVisible();
    await expect(parentPage.getByRole('region', { name: `Lớp video ${title}` })).toContainText('Cha mẹ (xem)', {
      timeout: 15_000,
    });

    // Ghi hình (chương trình bật, cha mẹ đã đồng ý), dừng, xem lại bản ghi; kết thúc phòng
    await controls.getByRole('button', { name: 'Bắt đầu ghi hình' }).click();
    await expect(toast(teacherPage, 'Đã bắt đầu ghi hình')).toBeVisible();
    await expect(teacherPage.getByRole('region', { name: `Lớp video ${title}` })).toContainText('Đang ghi', {
      timeout: 10_000,
    });
    await controls.getByRole('button', { name: 'Dừng ghi hình' }).click();
    await expect(toast(teacherPage, 'Đã dừng ghi hình')).toBeVisible();
    const recordings = teacherPage.getByRole('region', { name: 'Bản ghi của buổi' });
    await recordings.getByRole('button', { name: 'Xem bản ghi' }).click();
    await expect(recordings.getByLabel('Xem lại bản ghi')).toBeVisible();
    await controls.getByRole('button', { name: 'Kết thúc phòng' }).click();
    await expect(toast(teacherPage, 'Đã kết thúc lớp video')).toBeVisible();
  } finally {
    if (programId) {
      const roomIds = (
        await schoolYear
          .selectFrom('video_rooms')
          .innerJoin('tutoring_sessions', 'tutoring_sessions.id', 'video_rooms.tutoring_session_id')
          .select('video_rooms.id')
          .where('tutoring_sessions.program_id', '=', programId)
          .execute()
      ).map((row) => row.id);
      if (roomIds.length > 0) {
        await schoolYear.deleteFrom('video_recordings').where('room_id', 'in', roomIds).execute();
        await schoolYear
          .updateTable('tutoring_sessions')
          .set({ video_room_ref: null })
          .where('program_id', '=', programId)
          .execute();
        await schoolYear.deleteFrom('video_rooms').where('id', 'in', roomIds).execute();
      }
    }
    if (childId) {
      await schoolYear.deleteFrom('tutoring_attendance').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('tutoring_registrations').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('child_guardians').where('child_id', '=', childId).execute();
      await schoolYear.deleteFrom('class_enrollments').where('child_id', '=', childId).execute();
    }
    if (programId) {
      await schoolYear.deleteFrom('tutoring_programs').where('id', '=', programId).execute();
    }
    if (guardianId) {
      await schoolYear.deleteFrom('guardians').where('id', '=', guardianId).execute();
    }
    await setSecondaryEnabled(page, false);
  }
});
