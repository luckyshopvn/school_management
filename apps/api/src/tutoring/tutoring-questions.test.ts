import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { createTestUser, postJson } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { AI_PROVIDERS } from '../ai-assistant/ai-assistant.js';
import { MockAiProvider, type AiProviderRegistry } from '../ai-assistant/ai-provider.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Hỏi đáp bài tập của chương trình gia sư (DT-27 phần 27e, YCTD-255), kịch bản CT-27e-1 đến CT-27e-3: học sinh hỏi qua bộ máy hỏi đáp
// 28e ở khoá học ghi sẵn của chương trình; hàng chờ, thời hạn theo chương trình; gợi ý AI nháp (bộ giả lập  của 23d); dấu có AI
// hỗ trợ; đã hiểu, chưa hiểu; phụ huynh tắt AI cho con. Dữ liệu giả, cấp THCS
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Json = Record<string, unknown>;

describe('Hỏi đáp bài tập của chương trình gia sư', () => {
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
  let spaceId = '';
  let questionId = '';
  let studentToken = '';
  let mock: MockAiProvider;
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
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
        code: 'THCS-27E',
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
        staff_name: 'Cô Hỏi Đáp',
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
          full_name: 'Học sinh Hỏi Đáp',
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
      name: 'Hỏi đáp Toán qua mạng',
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

  it('CT-27e-1: học sinh hỏi ở khoá gia sư; câu vào hàng chờ của giáo viên dạy theo thời hạn của chương trình, giáo viên khác không thấy', async () => {
    assert.equal((await api('POST', `/tutoring/programs/${programId}/submit`, teacher)).status, 200);
    assert.equal((await api('POST', `/tutoring/programs/${programId}/approve`, principal)).status, 200);
    const registration = await api('POST', `/children/${childId}/tutoring/registrations`, parent, {
      program_id: programId,
      agree: true,
    });
    assert.equal(
      (await api('POST', `/tutoring/registrations/${registration.body.id as string}/approve`, teacher)).status,
      200,
    );
    const attached = await api('POST', `/tutoring/programs/${programId}/course`, teacher);
    assert.equal(attached.status, 200, JSON.stringify(attached.body));
    spaceId = (attached.body.course as Json).id as string;

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

    // Học sinh hỏi bằng bộ máy hỏi đáp của 28e ở khoá học ghi sẵn của chương trình
    const asked = await sendJson('POST', url(`/student/discussions/spaces/${spaceId}/threads`), studentToken, {
      kind: 'question',
      title: 'Vì sao 7 là số nguyên tố?',
      body: 'Em chưa hiểu cách kiểm tra một số có phải số nguyên tố không.',
    });
    assert.equal(asked.status, 201, JSON.stringify(asked.body));
    questionId = asked.body.id as string;

    assert.equal(
      (await api('PUT', `/tutoring/programs/${programId}/answer-hours`, otherTeacher, { answer_hours: 24 })).status,
      403,
    );
    assert.equal(
      (await api('PUT', `/tutoring/programs/${programId}/answer-hours`, teacher, { answer_hours: 0 })).status,
      400,
    );
    assert.equal(
      (await api('PUT', `/tutoring/programs/${programId}/answer-hours`, teacher, { answer_hours: 24 })).status,
      200,
    );
    const queue = await api('GET', '/tutoring/questions', teacher);
    assert.equal(queue.status, 200, JSON.stringify(queue.body));
    const pending = (queue.body.questions as Json[]).find((row) => row.id === questionId);
    assert.ok(pending, 'câu hỏi vào hàng chờ của giáo viên dạy');
    assert.equal(pending.reason, 'unanswered');
    assert.equal(pending.overdue, false);
    assert.equal(
      Date.parse(String(pending.due_at)) - Date.parse(String(pending.created_at)),
      24 * 3_600_000,
      'thời hạn trả lời theo chương trình',
    );
    assert.equal(pending.ai_available, false, 'trường chưa bật AI');
    assert.deepEqual((await api('GET', '/tutoring/questions', otherTeacher)).body.questions, []);
    assert.equal((await api('GET', `/tutoring/questions/${questionId}`, otherTeacher)).status, 404);
  });

  it('CT-27e-2: gợi ý AI là bản nháp chỉ giáo viên thấy, chỉ gửi chữ đã quét; câu trả lời gửi từ bản nháp mang dấu có AI hỗ trợ; phụ huynh tắt AI cho con', async () => {
    assert.equal(
      (
        await api('PUT', '/ai/settings', principal, {
          enabled: true,
          key_mode: 'school',
          provider: 'mock',
          per_user_daily_requests: null,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await api('PUT', '/school-settings/integrations/ai', principal, {
          enabled: true,
          values: { api_key: 'khoa-gia-lap-27e-0000' },
        })
      ).status,
      200,
    );
    const before = mock.received.length;
    const draft = await api('POST', `/tutoring/questions/${questionId}/ai-draft`, teacher, { note: 'Gợi ý từng bước' });
    assert.equal(draft.status, 200, JSON.stringify(draft.body));
    assert.ok(String(draft.body.answer).length > 0);
    assert.equal(mock.received.length, before + 1);
    const prompt = JSON.stringify(mock.received.at(-1));
    assert.ok(prompt.includes('Vì sao 7 là số nguyên tố?'), prompt);
    assert.ok(!prompt.includes('Học sinh Hỏi Đáp'), 'không gửi tên học sinh');
    const named = await api('POST', `/tutoring/questions/${questionId}/ai-draft`, teacher, {
      note: 'Học sinh Hỏi Đáp hay quên',
    });
    assert.equal(named.status, 422, 'ghi chú có tên học sinh bị từ chối, không gửi đi');

    // Bản nháp chưa gửi thì học sinh, cha mẹ không thấy
    const beforeSend = await sendJson('GET', url('/student/tutoring/questions'), studentToken);
    assert.deepEqual(((beforeSend.body.questions as Json[])[0]?.posts as Json[]).length, 0);
    const forged = await api('POST', `/tutoring/questions/${questionId}/answer`, otherTeacher, {
      body: 'x',
      ai_request_id: draft.body.request_id,
    });
    assert.equal(forged.status, 404, 'giáo viên khác không trả lời câu của chương trình mình không dạy');
    const sent = await api('POST', `/tutoring/questions/${questionId}/answer`, teacher, {
      body: `${String(draft.body.answer)} Cô thêm: em thử với số 9 nhé.`,
      ai_request_id: draft.body.request_id,
    });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal(sent.body.ai_assisted, true);
    const view = await api('GET', `/tutoring/questions/${questionId}`, teacher);
    assert.deepEqual(
      (view.body.posts as Json[]).map((post) => [post.author_kind, post.ai_assisted]),
      [['teacher', true]],
    );
    assert.equal(
      ((await api('GET', '/tutoring/questions', teacher)).body.questions as Json[]).length,
      0,
      'đã trả lời thì ra khỏi hàng chờ',
    );

    assert.equal(
      (await api('PUT', `/children/${childId}/tutoring/ai-consent`, otherParent, { allowed: false })).status,
      403,
    );
    const off = await api('PUT', `/children/${childId}/tutoring/ai-consent`, parent, { allowed: false });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal((await api('POST', `/tutoring/questions/${questionId}/ai-draft`, teacher, {})).status, 409);
    assert.equal((await api('GET', `/tutoring/questions/${questionId}`, teacher)).body.ai_available, false);
  });

  it('CT-27e-3: học sinh đánh dấu chưa hiểu thì câu trở lại hàng chờ, giáo viên trả lời thêm thì ra; cha mẹ xem câu hỏi của con', async () => {
    const mark = (understood: unknown) =>
      sendJson('POST', url(`/student/tutoring/questions/${questionId}/understood`), studentToken, { understood });
    assert.equal((await mark('co')).status, 400);
    assert.equal((await mark(false)).status, 200);
    const queue = await api('GET', '/tutoring/questions', teacher);
    assert.deepEqual(
      (queue.body.questions as Json[]).map((row) => [row.id, row.reason]),
      [[questionId, 'not_understood']],
    );
    const more = await api('POST', `/tutoring/questions/${questionId}/answer`, teacher, {
      body: 'Em chia 7 cho các số từ 2 đến 6, không số nào chia hết nên 7 là số nguyên tố.',
    });
    assert.equal(more.status, 201, JSON.stringify(more.body));
    assert.equal(more.body.ai_assisted, false);
    assert.equal(((await api('GET', '/tutoring/questions', teacher)).body.questions as Json[]).length, 0);
    assert.equal((await mark(true)).status, 200);

    assert.equal((await api('GET', `/children/${childId}/tutoring/questions`, otherParent)).status, 403);
    const child = await api('GET', `/children/${childId}/tutoring/questions`, parent);
    assert.equal(child.status, 200, JSON.stringify(child.body));
    assert.equal(child.body.ai_allowed, false);
    const question = (child.body.questions as Json[])[0] as Json;
    assert.equal(question.understood, true);
    assert.deepEqual(
      (question.posts as Json[]).map((post) => post.ai_assisted),
      [true, false],
    );
  });
});
