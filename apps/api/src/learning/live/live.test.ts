import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../../test-support.js';

// Điểm cuối giờ học trực tuyến, phòng nhóm, phòng chia nhỏ (DT-28 phần 28g, YCTD-277) với bộ giả lập lớp video của 27a: giáo viên
// mở phòng giờ học, học sinh vào khi phòng mở; nhật ký vào ra từ sự kiện gọi lại thành điểm danh gợi ý, giáo viên xác nhận ghi kết
// quả hoạt động; chia phòng ngẫu nhiên, gọi giáo viên, thông báo, gọi về; phòng nhóm học sinh tự mở chỉ khi giáo viên bật và trong giờ
// mở (GD-144), "giáo viên đang xem" (GD-149), báo cáo vào hàng chờ của 28e. Người, lớp là dữ liệu giả
const MOCK_SECRET = 'mock-video-secret';

describe('Điểm cuối giờ học trực tuyến, phòng nhóm', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let unitId = '';
  let academicYearId = '';
  let classId = '';
  let electiveId = '';
  let sectionId = '';
  let liveId = '';
  let roomId = '';
  let childId = '';
  let studentToken = '';
  let groupId = '';
  let groupSetId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const webhook = async (event: Record<string, unknown>) => {
    const body = JSON.stringify(event);
    const response = await fetch(url('/video/webhook'), {
      method: 'POST',
      headers: {
        'content-type': 'application/webhook+json',
        authorization: `Mock ${createHmac('sha256', MOCK_SECRET).update(body).digest('base64url')}`,
      },
      body,
    });
    return response.status;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
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
      await api('POST', '/org-units', principal.accessToken, {
        code: 'THCS-28G',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal.accessToken);
    const levels = (current.body.levels as Array<Record<string, unknown>>).map(
      ({ code, order_no, display_name, learner_term, context_label }) => ({
        code,
        is_enabled: code === 'MN' || code === 'THCS',
        order_no,
        display_name,
        learner_term,
        context_label,
      }),
    );
    assert.equal((await api('PUT', '/school-levels', principal.accessToken, { levels })).status, 200);
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '8B',
          name: 'Lớp 8B',
          grade_level: 'K8',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    childId = (
      await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: 'Trần Thị Bình',
          dob: '2013-05-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'granted',
          status: 'active',
          enroll_date: '2026-09-05',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: childId, class_id: classId, from_date: '2026-09-05', order_number: 1 })
      .execute();
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
    studentToken = login.body.access_token as string;
    const elective = await api('POST', '/learning/spaces', principal.accessToken, {
      title: 'Câu lạc bộ thuyết trình',
      school_level: 'THCS',
      teacher_user_ids: [teacher.userId],
    });
    assert.equal(elective.status, 201, JSON.stringify(elective.body));
    electiveId = elective.body.id as string;
    // Giáo viên thử chưa có hồ sơ nhân sự nên gắn thẳng vào khoá
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: electiveId, user_id: teacher.userId, user_name: 'Giáo viên thử', source: 'manual' })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
    const enrolled = await api('POST', `/learning/spaces/${electiveId}/enrollments`, teacher.accessToken, {
      child_ids: [childId],
    });
    assert.ok([200, 201].includes(enrolled.status), JSON.stringify(enrolled.body));
    assert.equal(
      (await api('PATCH', `/learning/spaces/${electiveId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    sectionId = (await api('POST', `/learning/spaces/${electiveId}/sections`, teacher.accessToken, { title: 'Tuần 1' }))
      .body.id as string;
    // Bộ nhóm của lớp do giáo viên lập (28a), một nhóm có học sinh
    groupSetId = (
      await schoolYear
        .insertInto('group_sets')
        .values({
          org_unit_id: unitId,
          class_id: classId,
          name: 'Nhóm dự án',
          purpose: 'activity',
          method: 'manual',
          params: '{}',
          owner_user_id: teacher.userId,
          owner_name: 'Giáo viên thử',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    groupId = (
      await schoolYear
        .insertInto('child_groups')
        .values({
          org_unit_id: unitId,
          name: 'Nhóm Mặt Trời',
          created_by: teacher.userId,
          group_set_id: groupSetId,
          class_id: classId,
          position: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('child_group_members')
      .values({ group_id: groupId, child_id: childId, added_by: teacher.userId })
      .execute();
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28g-6: giờ học trực tuyến: học sinh chỉ vào khi phòng mở; điểm danh từ nhật ký phòng, giáo viên xác nhận', async () => {
    const invalid = await api('POST', `/learning/spaces/${electiveId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'live_session',
      title: 'Luyện nói trước lớp',
      settings: { duration_minutes: 500 },
    });
    // Thiết lập sai của loại hoạt động là lỗi kiểm tra dữ liệu của lõi (400), như các loại khác
    assert.equal(invalid.status, 400, JSON.stringify(invalid.body));
    assert.equal(
      (invalid.body.error as { details: Array<{ field: string }> }).details[0]?.field,
      'settings.duration_minutes',
    );
    const created = await api('POST', `/learning/spaces/${electiveId}/activities`, teacher.accessToken, {
      section_id: sectionId,
      kind: 'live_session',
      title: 'Luyện nói trước lớp',
      opens_at: new Date(Date.now() - 60_000).toISOString(),
      settings: { duration_minutes: 5 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    liveId = created.body.id as string;
    assert.equal(
      (await api('POST', `/learning/activities/${liveId}/live/open`, teacher.accessToken)).status,
      422,
      'chưa giao',
    );
    assert.equal((await api('POST', `/learning/activities/${liveId}/publish`, teacher.accessToken, {})).status, 200);
    const overview = await api('GET', '/student/live', studentToken);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    const sessions = overview.body.sessions as Array<Record<string, unknown>>;
    assert.equal(sessions[0]?.id, liveId);
    assert.equal(sessions[0]?.room_id, null);
    assert.equal((await api('POST', `/student/live/activities/${liveId}/join`, studentToken)).status, 422);
    assert.equal(
      (await api('POST', `/learning/activities/${liveId}/live/open`, otherTeacher.accessToken)).status,
      403,
      'giáo viên không dạy lớp học trực tuyến',
    );
    const opened = await api('POST', `/learning/activities/${liveId}/live/open`, teacher.accessToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.role, 'host');
    assert.match(opened.body.token as string, /^mock\./);
    roomId = opened.body.room_id as string;
    const joined = await api('POST', `/student/live/activities/${liveId}/join`, studentToken);
    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    assert.equal(joined.body.role, 'student');
    assert.equal(joined.body.identity, `s:${childId}`);
    const room = `local--${roomId}`;
    const start = Date.now() - 300_000;
    assert.equal(
      await webhook({ kind: 'join', room, identity: `s:${childId}`, at: new Date(start).toISOString() }),
      200,
    );
    assert.equal(
      await webhook({ kind: 'leave', room, identity: `s:${childId}`, at: new Date(start + 240_000).toISOString() }),
      200,
    );
    const session = await api('GET', `/learning/activities/${liveId}/live`, teacher.accessToken);
    assert.equal(session.status, 200, JSON.stringify(session.body));
    const attendance = session.body.attendance as Array<Record<string, unknown>>;
    assert.equal(attendance[0]?.child_id, childId);
    assert.equal(attendance[0]?.minutes, 4);
    assert.equal(attendance[0]?.suggestion, 'present');
    const confirmed = await api('POST', `/learning/activities/${liveId}/live/attendance`, teacher.accessToken, {
      entries: [{ child_id: childId, status: 'present' }],
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    const result = await schoolYear
      .selectFrom('activity_results')
      .select(['status', 'source'])
      .where('activity_id', '=', liveId)
      .where('child_id', '=', childId)
      .executeTakeFirstOrThrow();
    assert.deepEqual(result, { status: 'completed', source: 'live_session' });
  });

  it('CT-28g-7: phòng chia nhỏ: chia ngẫu nhiên, học sinh vào phòng của em, gọi giáo viên, thông báo, gọi tất cả về', async () => {
    const created = await api('POST', `/learning/live/rooms/${roomId}/breakouts`, teacher.accessToken, {
      count: 2,
      minutes: 10,
      seed: 5,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.rooms, 2);
    const overview = await api('GET', '/student/live', studentToken);
    const breakout = (overview.body.sessions as Array<Record<string, unknown>>)[0]?.breakout as Record<string, unknown>;
    assert.ok(breakout, JSON.stringify(overview.body));
    const breakoutId = breakout.id as string;
    assert.equal((await api('POST', `/student/live/rooms/${breakoutId}/join`, studentToken)).status, 200);
    const mainState = await api('GET', `/student/live/rooms/${roomId}`, studentToken);
    assert.equal((mainState.body.breakout as Record<string, unknown>).id, breakoutId);
    assert.equal((await api('POST', `/student/live/rooms/${breakoutId}/help`, studentToken)).status, 200);
    assert.equal(
      (await api('POST', `/learning/live/rooms/${roomId}/notices`, teacher.accessToken, { body: 'Còn 2 phút' })).status,
      201,
    );
    const state = await api('GET', `/student/live/rooms/${breakoutId}`, studentToken);
    assert.equal(state.status, 200, JSON.stringify(state.body));
    assert.equal((state.body.notices as Array<Record<string, unknown>>)[0]?.body, 'Còn 2 phút');
    assert.equal(state.body.teacher_watching, false);
    const session = await api('GET', `/learning/activities/${liveId}/live`, teacher.accessToken);
    const rooms = session.body.breakouts as Array<Record<string, unknown>>;
    assert.equal(rooms.length, 2);
    const mine = rooms.find((row) => row.id === breakoutId) as Record<string, unknown>;
    assert.equal((mine.help as Array<Record<string, unknown>>)[0]?.child_id, childId);
    const other = rooms.find((row) => row.id !== breakoutId) as Record<string, unknown>;
    assert.equal(
      (
        await api('POST', `/learning/live/rooms/${roomId}/move`, teacher.accessToken, {
          child_id: childId,
          room_id: other.id,
        })
      ).status,
      200,
    );
    assert.equal((await api('GET', `/student/live/rooms/${breakoutId}`, studentToken)).body.moved_to, other.id);
    assert.equal(
      (await api('POST', `/learning/live/rooms/${roomId}/breakouts/close`, teacher.accessToken)).status,
      200,
    );
    const after = await api('GET', `/learning/activities/${liveId}/live`, teacher.accessToken);
    assert.deepEqual(after.body.breakouts, []);
    assert.equal((await api('POST', `/student/live/rooms/${other.id as string}/join`, studentToken)).status, 404);
  });

  it('CT-28g-8: phòng nhóm: học sinh tự mở khi giáo viên bật và trong giờ mở; thấy "giáo viên đang xem"; báo cáo vào hàng chờ', async () => {
    assert.equal((await api('POST', `/student/live/groups/${groupId}/open`, studentToken)).status, 422, 'chưa bật');
    assert.equal(
      (await api('PUT', `/learning/live/group-sets/${groupSetId}`, otherTeacher.accessToken, { student_open: true }))
        .status,
      403,
    );
    assert.equal(
      (await api('PUT', `/learning/live/group-sets/${groupSetId}`, teacher.accessToken, { student_open: true })).status,
      200,
    );
    const opened = await api('POST', `/student/live/groups/${groupId}/open`, studentToken);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const groupRoomId = opened.body.room_id as string;
    assert.equal(opened.body.can_share, true);
    assert.equal((await api('GET', `/student/live/rooms/${groupRoomId}`, studentToken)).body.teacher_watching, false);
    const groups = await api('GET', `/learning/spaces/${electiveId}/live-groups`, teacher.accessToken);
    assert.equal(groups.status, 200, JSON.stringify(groups.body));
    const set = (groups.body.sets as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    assert.equal(set.student_open, true);
    const watched = await api('POST', `/learning/live/rooms/${groupRoomId}/join`, teacher.accessToken);
    assert.equal(watched.status, 200, JSON.stringify(watched.body));
    assert.equal(watched.body.role, 'host');
    assert.equal((await api('GET', `/student/live/rooms/${groupRoomId}`, studentToken)).body.teacher_watching, true);
    assert.equal((await api('POST', `/learning/live/rooms/${groupRoomId}/leave`, teacher.accessToken)).status, 200);
    assert.equal((await api('GET', `/student/live/rooms/${groupRoomId}`, studentToken)).body.teacher_watching, false);
    const report = await api('POST', `/student/live/rooms/${groupRoomId}/report`, studentToken, {
      reason: 'Bạn nói lời không hay',
    });
    assert.equal(report.status, 201, JSON.stringify(report.body));
    const queued = await schoolYear
      .selectFrom('discussion_reports')
      .innerJoin('discussion_threads', 'discussion_threads.id', 'discussion_reports.thread_id')
      .select(['discussion_threads.group_id', 'discussion_reports.reason'])
      .where('discussion_reports.id', '=', report.body.id as string)
      .executeTakeFirstOrThrow();
    assert.equal(queued.group_id, groupId);
    assert.match(queued.reason, /Bạn nói lời không hay/);
    // Ngoài giờ mở của trường: học sinh không vào được phòng học sinh tự mở (khung giờ đặt cách giờ hiện tại 12 tiếng)
    const local = new Date(Date.now() + 7 * 3_600_000 + 12 * 3_600_000);
    const from = `${String(local.getUTCHours()).padStart(2, '0')}:00`;
    const to = `${String(local.getUTCHours()).padStart(2, '0')}:59`;
    const hours = await api('PUT', '/learning/discussion-config', principal.accessToken, {
      open_hours: { school_days: { from, to }, weekend: { from, to } },
      blocked_words: [],
    });
    assert.equal(hours.status, 200, JSON.stringify(hours.body));
    assert.equal((await api('POST', `/student/live/rooms/${groupRoomId}/join`, studentToken)).status, 422);
    const closed = await api('GET', '/student/live', studentToken);
    assert.equal(closed.body.open_now, false);
    assert.equal((await api('POST', `/learning/live/rooms/${groupRoomId}/end`, teacher.accessToken)).status, 200);
    assert.equal((await api('POST', `/student/live/groups/${groupId}/open`, studentToken)).status, 422, 'ngoài giờ mở');
    assert.equal(
      (await api('POST', `/learning/live/groups/${groupId}/open`, teacher.accessToken)).status,
      200,
      'giáo viên mở không theo giờ mở',
    );
  });
});
