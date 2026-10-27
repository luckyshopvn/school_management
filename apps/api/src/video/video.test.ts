import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251), kịch bản CT-27a-3 đến CT-27a-6 với bộ giả lập nhà cung cấp: mở phòng của buổi gia sư,
// vai trò và phòng chờ, sự kiện gọi lại có chữ ký ghi nhật ký vào ra và điểm danh gợi ý của 27b, ghi hình cần chương trình bật và đồng
// ý của cha mẹ, xem bản ghi bằng đường dẫn ký ngắn hạn có nhật ký xem, kết thúc phòng. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const MOCK_SECRET = 'mock-video-secret';

type Json = Record<string, unknown>;

describe('Lớp video trực tiếp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let otherTeacher: LoggedInUser;
  let parent: LoggedInUser;
  let unitId = '';
  let classId = '';
  let childId = '';
  let programId = '';
  let sessionId = '';
  let roomId = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const webhook = async (event: Json, signature?: string) => {
    const body = JSON.stringify(event);
    const response = await fetch(url('/video/webhook'), {
      method: 'POST',
      headers: {
        'content-type': 'application/webhook+json',
        authorization: signature ?? `Mock ${createHmac('sha256', MOCK_SECRET).update(body).digest('base64url')}`,
      },
      body,
    });
    return { status: response.status, body: (await response.json()) as Json };
  };

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
        code: 'THCS-27A',
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
    classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '8A',
          name: '8A',
          grade_level: 'K8',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('class_staff_assignments')
      .values(
        [teacher, otherTeacher].map((user, index) => ({
          class_id: classId,
          staff_user_id: user.userId,
          staff_name: index === 0 ? 'Cô Video' : 'Thầy Khác',
          assignment_role: 'subject' as const,
          subject_name: 'Tiếng Anh',
          subject_id: null,
          from_date: addDays(vietnamToday, -60),
        })),
      )
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
          full_name: 'Học sinh Video',
          dob: '2012-03-01',
          gender: 'female',
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

    // Chương trình bổ trợ không thu tiền, một buổi ngày mai; cha mẹ gửi đơn, giáo viên duyệt
    const created = await api('POST', '/tutoring/programs', teacher, {
      name: 'Câu lạc bộ thuyết trình',
      school_level: 'THCS',
      subject_id: null,
      content_type: 'enrichment',
      audience: null,
      charges_fee: false,
      delivery: 'live_video',
      registration_form: 'Tôi tự nguyện đăng ký cho con tham gia câu lạc bộ thuyết trình trực tuyến của nhà trường.',
      starts_on: vietnamToday,
      ends_on: addDays(vietnamToday, 30),
      class_ids: [classId],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    programId = created.body.id as string;
    assert.equal((await api('POST', `/tutoring/programs/${programId}/submit`, teacher)).status, 200);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, principal)).status, 200);
    const session = await api('POST', `/tutoring/programs/${programId}/sessions`, teacher, {
      session_date: addDays(vietnamToday, 1),
      start_time: '18:00',
      end_time: '18:45',
    });
    assert.equal(session.status, 201, JSON.stringify(session.body));
    sessionId = (
      await schoolYear
        .selectFrom('tutoring_sessions')
        .select('id')
        .where('program_id', '=', programId)
        .executeTakeFirstOrThrow()
    ).id;
    const registration = await api('POST', `/children/${childId}/tutoring/registrations`, parent, {
      program_id: programId,
      agree: true,
    });
    assert.equal(registration.status, 201, JSON.stringify(registration.body));
    assert.equal(
      (await api('POST', `/tutoring/registrations/${registration.body.id as string}/approve`, teacher)).status,
      200,
    );
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-27a-3: giáo viên dạy mở phòng của buổi; cha mẹ vào phòng chờ, được cho vào thì có mã xem; giáo viên khác không vào được', async () => {
    assert.equal((await api('POST', `/video/sessions/${sessionId}/room`, otherTeacher)).status, 403);
    const opened = await api('POST', `/video/sessions/${sessionId}/room`, teacher);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.role, 'host');
    assert.equal(opened.body.status, 'ready');
    assert.match(String(opened.body.token), /^mock\./);
    roomId = opened.body.room_id as string;
    const session = await schoolYear
      .selectFrom('tutoring_sessions')
      .select('video_room_ref')
      .where('id', '=', sessionId)
      .executeTakeFirstOrThrow();
    assert.equal(session.video_room_ref, roomId);

    assert.equal(
      (await api('POST', `/video/rooms/${roomId}/join`, otherTeacher)).status,
      403,
      'không dạy chương trình',
    );
    const observer = await api('POST', `/video/rooms/${roomId}/join`, principal);
    assert.equal(observer.body.role, 'observer');

    const waiting = await api('POST', `/children/${childId}/video/rooms/${roomId}/join`, parent);
    assert.equal(waiting.status, 200, JSON.stringify(waiting.body));
    assert.equal(waiting.body.status, 'waiting');
    assert.equal(waiting.body.token, undefined);
    const rooms = await api('GET', `/children/${childId}/video/rooms`, parent);
    assert.deepEqual(
      (rooms.body as unknown as Json[]).map((row) => row.room_id),
      [roomId],
    );

    const identity = waiting.body.identity as string;
    const admitted = await api(
      'PATCH',
      `/video/rooms/${roomId}/participants/${encodeURIComponent(identity)}`,
      teacher,
      {
        admit: true,
      },
    );
    assert.equal(admitted.status, 200, JSON.stringify(admitted.body));
    const ready = await api('POST', `/children/${childId}/video/rooms/${roomId}/join`, parent);
    assert.equal(ready.body.status, 'ready');
    assert.equal(ready.body.role, 'guardian');
    assert.equal(ready.body.can_speak, false, 'cha mẹ xem, nói khi được cho');
    const grants = JSON.parse(
      Buffer.from(String(ready.body.token).split('.')[1] as string, 'base64url').toString(),
    ) as {
      grants: { canPublish: boolean };
    };
    assert.equal(grants.grants.canPublish, false);
    await api('PATCH', `/video/rooms/${roomId}/participants/${encodeURIComponent(identity)}`, teacher, {
      can_speak: true,
    });
    assert.equal((await api('POST', `/children/${childId}/video/rooms/${roomId}/join`, parent)).body.can_speak, true);
  });

  it('CT-27a-4: sự kiện gọi lại có chữ ký ghi nhật ký vào ra, học sinh vào ra phòng của buổi thành điểm danh gợi ý; chữ ký sai bị từ chối', async () => {
    const room = `local--${roomId}`;
    const start = new Date(`${addDays(vietnamToday, 1)}T11:00:00Z`);
    assert.equal(
      (await webhook({ kind: 'join', room, identity: `s:${childId}`, at: start.toISOString() }, 'Mock sai')).status,
      401,
    );
    for (const event of [
      { kind: 'join', identity: `s:${childId}`, at: new Date(start.getTime() + 15 * 60_000) },
      { kind: 'leave', identity: `s:${childId}`, at: new Date(start.getTime() + 45 * 60_000) },
    ]) {
      const response = await webhook({ ...event, room, at: event.at.toISOString() });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.handled, true);
    }
    const events = await schoolYear
      .selectFrom('video_room_events')
      .select(['kind', 'role'])
      .where('room_id', '=', roomId)
      .execute();
    assert.deepEqual(
      events.map((event) => [event.kind, event.role]),
      [
        ['join', 'student'],
        ['leave', 'student'],
      ],
    );
    const attendance = await schoolYear
      .selectFrom('tutoring_attendance')
      .select(['status', 'source'])
      .where('session_id', '=', sessionId)
      .where('child_id', '=', childId)
      .executeTakeFirstOrThrow();
    assert.equal(attendance.source, 'room_log');
    assert.equal(attendance.status, 'late', 'vào muộn 15 phút');
    const usage = await api('GET', '/video/usage', teacher);
    assert.ok((usage.body.minutes_used as number) >= 30);
  });

  it('CT-27a-5: ghi hình cần chương trình bật và đồng ý của cha mẹ; xem bằng đường dẫn ký ngắn hạn, mỗi lần xem có nhật ký', async () => {
    const off = await api('POST', `/video/rooms/${roomId}/recording/start`, teacher);
    assert.equal(off.status, 422, JSON.stringify(off.body));
    assert.match(String(off.body.error?.message), /chưa bật ghi hình/);
    await schoolYear
      .updateTable('tutoring_programs')
      .set({ recording_enabled: true })
      .where('id', '=', programId)
      .execute();
    const noConsent = await api('POST', `/video/rooms/${roomId}/recording/start`, teacher);
    assert.equal(noConsent.status, 422);
    assert.match(String(noConsent.body.error?.message), /Học sinh Video/);

    assert.equal(
      (await api('PUT', `/children/${childId}/video/consents/${programId}`, otherTeacher, { agree: true })).status,
      403,
    );
    assert.equal(
      (await api('PUT', `/children/${childId}/video/consents/${programId}`, parent, { agree: true })).status,
      200,
    );
    const started = await api('POST', `/video/rooms/${roomId}/recording/start`, teacher);
    assert.equal(started.status, 200, JSON.stringify(started.body));
    const joined = await api('POST', `/children/${childId}/video/rooms/${roomId}/join`, parent);
    assert.equal(joined.body.recording, true, 'đang ghi luôn hiện');
    const stopped = await api('POST', `/video/rooms/${roomId}/recording/stop`, teacher);
    assert.equal(stopped.body.status, 'ready');
    const recording = await schoolYear
      .selectFrom('video_recordings')
      .select(['id', 'storage_key', 'expires_at', 'started_at'])
      .where('room_id', '=', roomId)
      .executeTakeFirstOrThrow();
    assert.match(recording.storage_key, /^video-recordings\//);
    assert.equal(
      Math.round((recording.expires_at.getTime() - recording.started_at.getTime()) / 86_400_000),
      30,
      'giữ 30 ngày theo cấu hình mặc định',
    );

    const list = await api('GET', `/children/${childId}/video/sessions/${sessionId}/recordings`, parent);
    assert.equal((list.body as unknown as Json[]).length, 1);
    const link = await api('POST', `/children/${childId}/video/recordings/${recording.id}/view-link`, parent);
    assert.equal(link.status, 200, JSON.stringify(link.body));
    const stream = await fetch(`${environment.baseUrl}${String(link.body.url).replace('/api/v1', '')}`);
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get('cache-control'), 'no-store');
    assert.equal(stream.headers.get('content-disposition'), 'inline');
    const tampered = await fetch(
      `${environment.baseUrl}${String(link.body.url).replace('/api/v1', '').slice(0, -3)}abc`,
    );
    assert.equal(tampered.status, 403);
    const views = await schoolYear
      .selectFrom('video_recording_views')
      .select('viewer_user_id')
      .where('recording_id', '=', recording.id)
      .execute();
    assert.deepEqual(
      views.map((view) => view.viewer_user_id),
      [parent.userId],
    );
    assert.equal((await api('POST', `/video/recordings/${recording.id}/view-link`, otherTeacher)).status, 403);

    assert.equal(
      (await api('PUT', `/children/${childId}/video/consents/${programId}`, parent, { agree: false })).status,
      200,
    );
    assert.equal(
      (await api('POST', `/video/rooms/${roomId}/recording/start`, teacher)).status,
      422,
      'rút đồng ý thì không ghi được nữa',
    );
  });

  it('CT-27a-6: kết thúc phòng ghi ra cho người còn trong phòng; phòng đã kết thúc không cấp mã vào; cấu hình của trường', async () => {
    await webhook({ kind: 'join', room: `local--${roomId}`, identity: `g:${parent.userId}` });
    const ended = await api('POST', `/video/rooms/${roomId}/end`, teacher);
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    const last = await schoolYear
      .selectFrom('video_room_events')
      .select(['kind', 'source'])
      .where('room_id', '=', roomId)
      .where('identity', '=', `g:${parent.userId}`)
      .orderBy('at', 'desc')
      .executeTakeFirstOrThrow();
    assert.deepEqual([last.kind, last.source], ['leave', 'room_end']);
    assert.equal((await api('POST', `/children/${childId}/video/rooms/${roomId}/join`, parent)).status, 409);

    assert.equal(
      (await api('PUT', '/video/settings', teacher, { max_participants: 6, recording_retention_days: 14 })).status,
      403,
    );
    assert.equal(
      (await api('PUT', '/video/settings', principal, { max_participants: 1, recording_retention_days: 14 })).status,
      400,
    );
    const saved = await api('PUT', '/video/settings', principal, {
      max_participants: 6,
      recording_retention_days: 14,
      lobby_enabled: false,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.max_participants, 6);
  });
});
