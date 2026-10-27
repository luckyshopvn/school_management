import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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

// Điểm cuối học khi mạng yếu (DT-28 phần 28j, YCTD-280; GD-148 đã chốt 2026-10-27): tắt mặc định, chỉ Ban Giám hiệu bật; học sinh đọc
// cấu hình; gửi lại tệp và lần nộp kèm mã chống trùng chỉ ghi một lần; thời điểm bấm nộp trên máy được ghi để giáo viên xét
describe('Điểm cuối học khi mạng yếu', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let teacher: LoggedInUser;
  let studentToken = '';
  let activityId = '';
  let uploadItem = '';
  let essayItem = '';
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, token: string, body?: unknown) => sendJson(method, url(path), token, body);
  const rows = (body: unknown) => body as unknown as Array<Record<string, unknown>>;

  async function upload(path: string, body: Buffer) {
    const form = new FormData();
    form.append('file', new Blob([body]), 'anh.png');
    const response = await fetch(url(path), {
      method: 'POST',
      headers: { authorization: `Bearer ${studentToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const academicYearId = await openTestAcademicYear(environment, principal.accessToken, '2026-2027', {
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
    const unitId = (
      await api('POST', '/org-units', principal.accessToken, {
        code: 'THCS-28J',
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
    for (const path of ['/grade-levels/templates', '/subjects/templates']) {
      assert.equal((await api('POST', path, principal.accessToken, { school_level: 'THCS' })).status, 200);
    }
    const subjects = rows((await api('GET', '/subjects?school_level=THCS', principal.accessToken)).body);
    const math = subjects.find((row) => row.code === 'THCS-TOAN')?.id as string;
    teacher = await environment.loginAs('VT-08', unitId);
    const classId = (
      await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: academicYearId,
          code: '7A',
          name: 'Lớp 7A',
          grade_level: 'K7',
          school_level: 'THCS',
          max_size: 45,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    assert.equal(
      (
        await api('POST', `/classes/${classId}/staff-assignments`, principal.accessToken, {
          staff_user_id: teacher.userId,
          assignment_role: 'subject',
          subject_id: math,
        })
      ).status,
      201,
    );
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: unitId,
        full_name: 'Học sinh An',
        dob: '2014-03-01',
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '0000',
        photo_consent: 'granted',
        status: 'active',
        enroll_date: '2026-09-05',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: '2026-09-05', order_number: 1 })
      .execute();
    const student = await createTestUser(environment.identity.database, {
      roles: [{ roleCode: 'VT-21', orgUnitId: unitId }],
    });
    await schoolYear
      .insertInto('student_learning_accounts')
      .values({
        child_id: child.id,
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
    studentToken = login.body.access_token as string;
    const spaceId = rows((await api('GET', '/learning/spaces', teacher.accessToken)).body)[0]?.id as string;
    assert.equal(
      (await api('PATCH', `/learning/spaces/${spaceId}`, teacher.accessToken, { visible_to_students: true })).status,
      200,
    );
    const sectionId = (
      await api('POST', `/learning/spaces/${spaceId}/sections`, teacher.accessToken, { title: 'Chương 1' })
    ).body.id as string;
    activityId = (
      await api('POST', `/learning/spaces/${spaceId}/activities`, teacher.accessToken, {
        section_id: sectionId,
        kind: 'assignment',
        title: 'Bài làm khi mạng yếu',
      })
    ).body.id as string;
    const saved = await api('PUT', `/learning/activities/${activityId}/assignment`, teacher.accessToken, {
      grading: 'score',
      items: [
        { kind: 'essay', prompt: 'Trình bày', score: 5 },
        { kind: 'upload', prompt: 'Chụp vở', score: 5 },
      ],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const items = rows(saved.body.items);
    essayItem = items.find((item) => item.kind === 'essay')?.id as string;
    uploadItem = items.find((item) => item.kind === 'upload')?.id as string;
    assert.equal(
      (await api('POST', `/learning/activities/${activityId}/assignment/release`, teacher.accessToken, {})).status,
      200,
    );
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment?.close();
  });

  it('CT-28j-3: tắt mặc định; chỉ Ban Giám hiệu bật, giữ tối đa 7 ngày; học sinh đọc cấu hình', async () => {
    assert.deepEqual((await api('GET', '/student/offline', studentToken)).body, { enabled: false, retention_days: 7 });
    assert.equal((await api('PUT', '/learning/offline/config', teacher.accessToken, { enabled: true })).status, 403);
    assert.equal(
      (await api('PUT', '/learning/offline/config', principal.accessToken, { enabled: true, retention_days: 30 }))
        .status,
      422,
    );
    const saved = await api('PUT', '/learning/offline/config', principal.accessToken, {
      enabled: true,
      retention_days: 5,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual((await api('GET', '/student/offline', studentToken)).body, { enabled: true, retention_days: 5 });
  });

  it('CT-28j-4: gửi lại tệp, lần nộp kèm mã chống trùng chỉ ghi một lần; thời điểm bấm nộp trên máy được ghi', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const fileKey = randomUUID();
    const path = `/student/assignments/${activityId}/items/${uploadItem}/files?client_key=${fileKey}`;
    const first = await upload(path, png);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const again = await upload(path, png);
    assert.equal(again.body.id, first.body.id, 'gửi lại tệp cùng mã thì trả tệp đã nhận');
    const files = await schoolYear
      .selectFrom('submission_files')
      .select('id')
      .where('client_key', '=', fileKey)
      .execute();
    assert.equal(files.length, 1);

    const submitKey = randomUUID();
    const pressedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const body = {
      answers: { [essayItem]: { text: 'Em làm lúc mất mạng' } },
      client_submit_key: submitKey,
      client_submitted_at: pressedAt,
    };
    const submitted = await api('POST', `/student/assignments/${activityId}/submit`, studentToken, body);
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const replayed = await api('POST', `/student/assignments/${activityId}/submit`, studentToken, body);
    assert.equal(replayed.status, 200, JSON.stringify(replayed.body));
    assert.equal(replayed.body.id, submitted.body.id);
    assert.equal(replayed.body.replayed, true);
    const stored = await schoolYear
      .selectFrom('assignment_submissions')
      .select(['client_submitted_at', 'status'])
      .where('client_submit_key', '=', submitKey)
      .execute();
    assert.equal(stored.length, 1, 'chỉ một lần nộp');
    assert.equal(stored[0]?.client_submitted_at?.toISOString(), pressedAt);
    const count = await schoolYear
      .selectFrom('assignment_submissions')
      .select((builder) => builder.fn.countAll<string>().as('count'))
      .where('status', '<>', 'draft')
      .executeTakeFirstOrThrow();
    assert.equal(Number(count.count), 1);
  });
});
