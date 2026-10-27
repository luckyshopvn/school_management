import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Khoá học ghi sẵn của chương trình gia sư (DT-27 phần 27d1, YCTD-254), kịch bản CT-27d1-1 đến CT-27d1-3: gắn chương trình với khoá tự
// chọn của lõi LMS 28b, ghi danh theo đơn được duyệt, phát video bài học (học liệu 22h1) theo đoạn bằng đường dẫn ký có nhật ký xem.
// CT-27d2-1, CT-27d2-2 (YCTD-261): tiến độ xem video, tiến độ cho cha mẹ, giáo viên. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Json = Record<string, unknown>;

describe('Khoá học ghi sẵn của chương trình gia sư', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let unitId = '';
  let childId = '';
  let programId = '';
  let registrationId = '';
  let spaceId = '';
  let videoActivityId = '';
  let secondVideoId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const enrollment = async () =>
    (
      await schoolYear
        .selectFrom('course_enrollments')
        .select('status')
        .where('space_id', '=', spaceId)
        .where('child_id', '=', childId)
        .executeTakeFirst()
    )?.status;

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: addDays(vietnamToday, -60), end_date: addDays(vietnamToday, 90) },
      second_term: { start_date: addDays(vietnamToday, 95), end_date: addDays(vietnamToday, 200) },
    });
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
    unitId = (
      await api('POST', '/org-units', principal, {
        code: 'THCS-27D',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal);
    const levels = (current.body.levels as Json[]).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'TH' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal, { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', principal, { school_level: 'THCS' })).status, 200);
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    otherParent = await environment.loginAs('VT-14', unitId);
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '9K',
          name: '9K',
          grade_level: 'K9',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classId,
        staff_user_id: teacher.userId,
        staff_name: 'Cô Khoá Học',
        assignment_role: 'subject',
        subject_name: 'Tiếng Anh',
        subject_id: null,
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: 'Học sinh Khoá Học',
          dob: '2011-03-01',
          gender: 'male',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: addDays(vietnamToday, -60),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classId, from_date: addDays(vietnamToday, -60) })
      .execute();
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Mẹ của học sinh', phone: null, user_id: parent.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('child_guardians')
      .values({ child_id: childId, guardian_id: guardian.id, relationship_item_id: relationship.id, is_primary: true })
      .execute();

    const created = await api('POST', '/tutoring/programs', teacher, {
      name: 'Luyện nghe tiếng Anh qua video',
      school_level: 'THCS',
      subject_id: null,
      content_type: 'enrichment',
      audience: null,
      charges_fee: false,
      delivery: 'course',
      registration_form: 'Tôi tự nguyện đăng ký cho con học khoá luyện nghe trực tuyến của nhà trường.',
      starts_on: vietnamToday,
      ends_on: addDays(vietnamToday, 30),
      class_ids: [classId],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    programId = created.body.id as string;
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-27d1-1: giáo viên dạy tạo khoá học ghi sẵn cho chương trình đã duyệt; khoá là khoá tự chọn của lõi LMS, không tạo trùng', async () => {
    assert.equal((await api('POST', `/tutoring/programs/${programId}/course`, teacher)).status, 409, 'chưa duyệt');
    assert.equal((await api('POST', `/tutoring/programs/${programId}/submit`, teacher)).status, 200);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, principal)).status, 200);
    const registration = await api('POST', `/children/${childId}/tutoring/registrations`, parent, {
      program_id: programId,
      agree: true,
    });
    registrationId = registration.body.id as string;
    assert.equal((await api('POST', `/tutoring/registrations/${registrationId}/approve`, teacher)).status, 200);

    assert.equal((await api('POST', `/tutoring/programs/${programId}/course`, otherTeacher)).status, 403);
    const attached = await api('POST', `/tutoring/programs/${programId}/course`, teacher);
    assert.equal(attached.status, 200, JSON.stringify(attached.body));
    const course = attached.body.course as Json;
    spaceId = course.id as string;
    assert.equal(course.enrolled, 1, 'học sinh có đơn được duyệt được ghi danh');
    const space = await schoolYear
      .selectFrom('course_spaces')
      .select(['kind', 'title', 'visible_to_students'])
      .where('id', '=', spaceId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(space, { kind: 'elective', title: 'Luyện nghe tiếng Anh qua video', visible_to_students: true });
    const teachers = await schoolYear
      .selectFrom('course_space_teachers')
      .select('user_id')
      .where('space_id', '=', spaceId)
      .execute();
    assert.deepEqual(
      teachers.map((row) => row.user_id),
      [teacher.userId],
    );
    const again = await api('POST', `/tutoring/programs/${programId}/course`, teacher);
    assert.equal((again.body.course as Json).id, spaceId);
  });

  it('CT-27d1-2: rút đơn thì gỡ khỏi khoá, đơn mới được duyệt thì ghi danh lại', async () => {
    assert.equal(await enrollment(), 'active');
    const withdrawn = await api(
      'POST',
      `/children/${childId}/tutoring/registrations/${registrationId}/withdraw`,
      parent,
    );
    assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
    assert.equal(await enrollment(), 'removed');
    const again = await api('POST', `/children/${childId}/tutoring/registrations`, parent, {
      program_id: programId,
      agree: true,
    });
    assert.equal(again.status, 201, JSON.stringify(again.body));
    assert.equal(await enrollment(), 'removed', 'đơn chờ duyệt chưa ghi danh');
    assert.equal(
      (await api('POST', `/tutoring/registrations/${again.body.id as string}/approve`, teacher)).status,
      200,
    );
    assert.equal(await enrollment(), 'active');
  });

  it('CT-27d1-3: video bài học phát theo đoạn bằng đường dẫn ký, chỉ cho người được xem, mỗi lần xem có nhật ký', async () => {
    const type = await environment.system.selectFrom('resource_types').select('id').executeTakeFirstOrThrow();
    const resource = await environment.system
      .insertInto('learning_resources')
      .values({
        title: 'Bài nghe số 1',
        type_id: type.id,
        owner_user_id: teacher.userId,
        owner_name: 'Cô Khoá Học',
        status: 'published',
        current_version: 1,
        published_version: 1,
        published_at: new Date(),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const storageKey = `learning-resources/${resource.id}/1.mp4`;
    await environment.system
      .insertInto('learning_resource_versions')
      .values({
        resource_id: resource.id,
        version_no: 1,
        kind: 'file',
        storage_key: storageKey,
        file_name: 'bai-nghe-1.mp4',
        content_type: 'video/mp4',
        size_bytes: 1000,
        created_by: teacher.userId,
      })
      .execute();
    const bytes = Buffer.from(Array.from({ length: 1000 }, (_, index) => index % 256));
    await environment.api.get(FileStorage).put(storageKey, bytes, 'video/mp4');
    const section = await schoolYear
      .insertInto('course_sections')
      .values({ space_id: spaceId, title: 'Chương 1', position: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    videoActivityId = (
      await schoolYear
        .insertInto('course_activities')
        .values({
          space_id: spaceId,
          section_id: section.id,
          kind: 'resource',
          title: 'Nghe bài 1',
          position: 1,
          status: 'published',
          settings: JSON.stringify({ resource_id: resource.id }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('course_activities')
      .values({
        space_id: spaceId,
        section_id: section.id,
        kind: 'page',
        title: 'Đọc trước',
        position: 2,
        status: 'published',
      })
      .execute();

    const course = await api('GET', `/children/${childId}/tutoring/programs/${programId}/course`, parent);
    assert.equal(course.status, 200, JSON.stringify(course.body));
    assert.deepEqual(
      (course.body.videos as Json[]).map((video) => video.title),
      ['Nghe bài 1'],
      'chỉ bài học là video đã công bố',
    );
    assert.equal(
      (await api('GET', `/children/${childId}/tutoring/programs/${programId}/course`, otherParent)).status,
      403,
    );
    assert.equal(
      (await api('POST', `/children/${childId}/tutoring/course-media/${videoActivityId}/link`, otherParent)).status,
      403,
    );

    const link = await api('POST', `/children/${childId}/tutoring/course-media/${videoActivityId}/link`, parent);
    assert.equal(link.status, 200, JSON.stringify(link.body));
    const streamUrl = `${environment.baseUrl}${String(link.body.url).replace('/api/v1', '')}`;
    const part = await fetch(streamUrl, { headers: { range: 'bytes=0-99' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 0-99/1000');
    assert.equal(part.headers.get('content-disposition'), 'inline');
    assert.equal(part.headers.get('cache-control'), 'no-store');
    assert.equal((await part.arrayBuffer()).byteLength, 100);
    const tail = await fetch(streamUrl, { headers: { range: 'bytes=-10' } });
    assert.equal(tail.headers.get('content-range'), 'bytes 990-999/1000');
    const whole = await fetch(streamUrl);
    assert.equal(whole.status, 200);
    assert.equal((await whole.arrayBuffer()).byteLength, 1000);
    assert.equal((await fetch(streamUrl, { headers: { range: 'bytes=5000-' } })).status, 416);
    assert.equal((await fetch(`${streamUrl.slice(0, -3)}abc`)).status, 403);

    assert.equal((await api('POST', `/tutoring/course-media/${videoActivityId}/link`, otherTeacher)).status, 403);
    assert.equal((await api('POST', `/tutoring/course-media/${videoActivityId}/link`, teacher)).status, 200);
    const views = await schoolYear
      .selectFrom('tutoring_media_views')
      .select(['viewer_user_id', 'child_id'])
      .where('activity_id', '=', videoActivityId)
      .orderBy('viewed_at')
      .execute();
    assert.deepEqual(views, [
      { viewer_user_id: parent.userId, child_id: childId },
      { viewer_user_id: teacher.userId, child_id: null },
    ]);
  });

  it('CT-27d2-1: học sinh xem video ở kênh student: theo điều kiện mở của 28b, phần trăm đã xem chỉ tăng, xem từ 90% thì hoàn thành', async () => {
    const student = await createTestUser(environment.identity.database, {
      roles: [{ roleCode: 'VT-21', orgUnitId: unitId }],
    });
    await schoolYear
      .insertInto('student_learning_accounts')
      .values({
        child_id: childId,
        username: student.username,
        password_hash: 'khong-dung',
        issued_at: new Date(),
        issued_by_name: 'Hiệu trưởng thử',
        identity_user_id: student.id,
      })
      .execute();
    const login = await postJson(`${environment.identity.baseUrl}/auth/login`, {
      login: student.username,
      password: student.password,
      channel: 'student',
    });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.access_token as string;
    const studentApi = (method: string, path: string, body?: unknown) =>
      sendJson(method, url(`/student/tutoring${path}`), token, body);

    // Bài 2 mở sau khi xem xong bài 1 (điều kiện mở của 28b)
    const video = await schoolYear
      .selectFrom('course_activities')
      .select(['section_id', 'settings'])
      .where('id', '=', videoActivityId)
      .executeTakeFirstOrThrow();
    secondVideoId = (
      await schoolYear
        .insertInto('course_activities')
        .values({
          space_id: spaceId,
          section_id: video.section_id,
          kind: 'resource',
          title: 'Nghe bài 2',
          position: 3,
          status: 'published',
          settings: JSON.stringify(video.settings),
          open_rules: JSON.stringify({
            mode: 'all',
            rules: [{ type: 'after_activity', activity_id: videoActivityId }],
          }),
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    const courses = await studentApi('GET', '/courses');
    assert.equal(courses.status, 200, JSON.stringify(courses.body));
    const progress = (courses.body as unknown as Json[])[0]?.progress as Json;
    assert.deepEqual(progress.summary, { required: 3, done: 0, overdue: 0, percent: 0 });
    assert.equal((await studentApi('POST', `/course-media/${secondVideoId}/link`)).status, 422, 'bài còn khoá');
    assert.equal((await studentApi('POST', `/course-media/${videoActivityId}/link`)).status, 200);

    const report = async (percent: unknown) =>
      studentApi('POST', `/course-media/${videoActivityId}/progress`, { percent });
    assert.equal((await report(150)).status, 400);
    assert.deepEqual((await report(30)).body, { status: 'in_progress', progress: 30 });
    assert.deepEqual((await report(20)).body, { status: 'in_progress', progress: 30 }, 'phần trăm đã xem chỉ tăng');
    assert.deepEqual((await report(95)).body, { status: 'completed', progress: 95 });
    assert.deepEqual((await report(100)).body, { status: 'completed', progress: 95 }, 'xem xong rồi thì giữ nguyên');
    assert.equal(
      (await studentApi('POST', `/course-media/${secondVideoId}/link`)).status,
      200,
      'xem xong bài 1 thì bài 2 mở',
    );

    const events = await schoolYear
      .selectFrom('learning_events')
      .select('verb')
      .where('activity_id', '=', videoActivityId)
      .where('actor_kind', '=', 'student')
      .orderBy('occurred_at')
      .execute();
    assert.deepEqual(
      events.map((event) => event.verb),
      ['opened', 'progressed', 'completed'],
    );
  });

  it('CT-27d2-2: cha mẹ thấy tiến độ của con trong khoá; giáo viên dạy thấy tiến độ từng học sinh, giáo viên khác bị chặn', async () => {
    const course = await api('GET', `/children/${childId}/tutoring/programs/${programId}/course`, parent);
    assert.equal(course.status, 200, JSON.stringify(course.body));
    const progress = course.body.progress as Json;
    assert.deepEqual(progress.summary, { required: 3, done: 1, overdue: 0, percent: 33 });
    assert.deepEqual((progress.videos as Json)[videoActivityId], { status: 'completed', progress: 95 });
    assert.deepEqual((progress.videos as Json)[secondVideoId], { status: 'not_started', progress: 0 });
    assert.deepEqual(
      (progress.activities as Json[]).map((activity) => [activity.title, activity.status]),
      [
        ['Nghe bài 1', 'completed'],
        ['Đọc trước', 'not_started'],
        ['Nghe bài 2', 'not_started'],
      ],
    );

    assert.equal((await api('GET', `/tutoring/programs/${programId}/course/progress`, otherTeacher)).status, 403);
    const board = await api('GET', `/tutoring/programs/${programId}/course/progress`, teacher);
    assert.equal(board.status, 200, JSON.stringify(board.body));
    assert.deepEqual(
      (board.body.videos as Json[]).map((video) => video.title),
      ['Nghe bài 1', 'Nghe bài 2'],
    );
    const row = (board.body.students as Json[])[0] as Json;
    assert.equal(row.full_name, 'Học sinh Khoá Học');
    assert.deepEqual(row.summary, { required: 3, done: 1, overdue: 0, percent: 33 });
    assert.deepEqual((row.videos as Json)[videoActivityId], { status: 'completed', progress: 95 });
  });
});
