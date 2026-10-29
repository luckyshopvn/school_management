import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251), kịch bản CT-27a-3 đến CT-27a-6 với bộ giả lập nhà cung cấp, phần còn lại sau khi gỡ
// gia sư trong trường (YCTD-384 lát L2): phòng tức thời của giáo viên, vai trò chủ phòng và Ban Giám hiệu, sự kiện gọi lại có chữ ký
// ghi nhật ký vào ra, kết thúc phòng, cấu hình của trường. Dữ liệu giả
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
    const unitId = (
      await api('POST', '/org-units', principal, {
        code: 'THCS-27A',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    teacher = await environment.loginAs('VT-08', unitId);
    otherTeacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-27a-3: giáo viên mở phòng tức thời là chủ phòng; Ban Giám hiệu vào xem; giáo viên khác, cha mẹ không vào được', async () => {
    assert.equal((await api('POST', '/video/rooms', teacher, { title: 'ab' })).status, 400, 'tên phòng từ 3 ký tự');
    assert.equal((await api('POST', '/video/rooms', parent, { title: 'Phòng của cha mẹ' })).status, 403);
    const opened = await api('POST', '/video/rooms', teacher, { title: 'Phòng hỏi đáp' });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.role, 'host');
    assert.equal(opened.body.status, 'ready');
    assert.match(String(opened.body.token), /^mock\./);
    roomId = opened.body.room_id as string;

    assert.equal((await api('POST', `/video/rooms/${roomId}/join`, otherTeacher)).status, 403, 'không phải chủ phòng');
    assert.equal((await api('GET', `/video/rooms/${roomId}`, otherTeacher)).status, 403);
    assert.equal((await api('POST', `/video/rooms/${roomId}/join`, parent)).status, 403);
    const observer = await api('POST', `/video/rooms/${roomId}/join`, principal);
    assert.equal(observer.status, 200, JSON.stringify(observer.body));
    assert.equal(observer.body.role, 'observer');
    assert.equal(observer.body.can_speak, false, 'Ban Giám hiệu xem, nói khi được cho');
    const grants = JSON.parse(
      Buffer.from(String(observer.body.token).split('.')[1] as string, 'base64url').toString(),
    ) as {
      grants: { canPublish: boolean };
    };
    assert.equal(grants.grants.canPublish, false);

    const identity = observer.body.identity as string;
    const allowed = await api('PATCH', `/video/rooms/${roomId}/participants/${encodeURIComponent(identity)}`, teacher, {
      can_speak: true,
    });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
    assert.equal((await api('POST', `/video/rooms/${roomId}/join`, principal)).body.can_speak, true);
    const detail = await api('GET', `/video/rooms/${roomId}`, teacher);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.deepEqual(
      (detail.body.admissions as Json[]).map((row) => row.role),
      ['host', 'observer'],
    );
  });

  it('CT-27a-4: sự kiện gọi lại có chữ ký ghi nhật ký vào ra, cộng phút người dự; chữ ký sai bị từ chối', async () => {
    const room = `local--${roomId}`;
    const start = new Date(Date.now() - 40 * 60_000);
    assert.equal(
      (await webhook({ kind: 'join', room, identity: `h:${teacher.userId}`, at: start.toISOString() }, 'Mock sai'))
        .status,
      401,
    );
    for (const event of [
      { kind: 'join', identity: `h:${teacher.userId}`, at: start },
      { kind: 'leave', identity: `h:${teacher.userId}`, at: new Date(start.getTime() + 30 * 60_000) },
    ]) {
      const response = await webhook({ ...event, room, at: event.at.toISOString() });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.handled, true);
    }
    const events = await schoolYear
      .selectFrom('video_room_events')
      .select(['kind', 'role'])
      .where('room_id', '=', roomId)
      .orderBy('at')
      .execute();
    assert.deepEqual(
      events.map((event) => [event.kind, event.role]),
      [
        ['join', 'host'],
        ['leave', 'host'],
      ],
    );
    const usage = await api('GET', '/video/usage', teacher);
    assert.ok((usage.body.minutes_used as number) >= 30);
    assert.equal(usage.body.minutes_limit, null, 'chế độ một trường không giới hạn');
  });

  it('CT-27a-5: điểm cuối của gia sư trong trường đã gỡ: phòng của buổi, ghi hình, bản ghi, phía cha mẹ và học sinh', async () => {
    assert.equal((await api('POST', `/video/sessions/${roomId}/room`, teacher)).status, 404);
    assert.equal((await api('POST', `/video/rooms/${roomId}/recording/start`, teacher)).status, 404);
    assert.equal((await api('GET', `/children/${roomId}/video/rooms`, parent)).status, 404);
    assert.equal((await api('GET', '/tutoring/programs', principal)).status, 404);
  });

  it('CT-27a-6: kết thúc phòng ghi ra cho người còn trong phòng; phòng đã kết thúc không cấp mã vào; cấu hình của trường', async () => {
    await webhook({ kind: 'join', room: `local--${roomId}`, identity: `o:${principal.userId}` });
    assert.equal((await api('POST', `/video/rooms/${roomId}/end`, otherTeacher)).status, 403);
    const ended = await api('POST', `/video/rooms/${roomId}/end`, teacher);
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    const last = await schoolYear
      .selectFrom('video_room_events')
      .select(['kind', 'source'])
      .where('room_id', '=', roomId)
      .where('identity', '=', `o:${principal.userId}`)
      .orderBy('at', 'desc')
      .executeTakeFirstOrThrow();
    assert.deepEqual([last.kind, last.source], ['leave', 'room_end']);
    assert.equal((await api('POST', `/video/rooms/${roomId}/join`, principal)).status, 409);

    assert.equal((await api('PUT', '/video/settings', teacher, { max_participants: 6 })).status, 403);
    assert.equal((await api('PUT', '/video/settings', principal, { max_participants: 1 })).status, 400);
    const saved = await api('PUT', '/video/settings', principal, { max_participants: 6 });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.max_participants, 6);
    assert.equal((await api('GET', '/video/settings', teacher)).body.max_participants, 6);
  });
});
