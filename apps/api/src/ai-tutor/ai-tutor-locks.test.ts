import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, it } from 'node:test';
import {
  savePlanAiPricing,
  savePlatformAiKey,
  savePlatformAiSettings,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import { Clock, runAsSchool } from '@school-management/server';
import type { Kysely } from 'kysely';
import { AI_PROVIDERS } from '../ai-assistant/ai-assistant.js';
import type { AiProviderRegistry, MockAiProvider } from '../ai-assistant/ai-provider.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { activateAiTutorSubscription, createAiTutorSubscription } from './ai-tutor-turns.js';
import { AiTutorChatService } from './tutor-chat.js';

// Gia sư AI khóa và báo giáo viên chủ nhiệm (YCTD-383 lát L3), kịch bản CT-1780 đến CT-1786: khung giờ khóa mặc định và khung giờ trường
// đặt; đang thi (lượt đang làm, phòng thi đang mở, bài kiểm tra đang mở); bài tập không dùng AI (giáo viên bật, tắt; em nộp bài thì mở);
// câu bị khóa không giữ, không trừ lượt; cờ tự hại, bị bắt nạt báo giáo viên chủ nhiệm hoặc Ban Giám hiệu khi lớp chưa có giáo viên chủ
// nhiệm; giáo viên chủ nhiệm lớp khác, giáo viên bộ môn, cha mẹ không thấy cờ. Bộ giả lập nhà cung cấp, không gọi API thật. Dữ liệu bịa
describe('Gia sư AI: khóa theo phòng thi, bài tập, khung giờ; báo giáo viên chủ nhiệm', () => {
  let environment: MultiTenantApi;
  let mock: MockAiProvider;
  let system: Kysely<SystemDatabase>;
  let schoolYear: Kysely<SchoolYearDatabase>;
  // Đồng hồ riêng của dịch vụ gia sư: đồng hồ chung còn dùng để kiểm mã phiên đăng nhập nên không đổi
  let chat: { clock: Clock };
  let realClock: Clock;
  let unitId = '';
  let yearId = '';
  const tokens = { a: '', b: '', c: '', homeroomA: '', homeroomB: '', subjectTeacher: '', parent: '' };
  const children = { a: '', b: '', c: '' };
  const classes = { a: '', b: '', c: '' };
  const users = { homeroomA: '', subjectTeacher: '', parent: '' };
  let subscriptionA = '';
  let subjectId = '';
  // Giờ Việt Nam của ngày mai: sau lúc kích hoạt gói lượt (gói lượt có hiệu lực từ lúc kích hoạt)
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + 86_400_000),
  );
  const at = (time: string) => new Date(`${tomorrow}T${time}:00+07:00`);

  const student = (token: string, method: string, path: string, body?: unknown) =>
    environment.call('alpha', method, `/student/ai-tutor${path}`, body, token);
  const ask = (token: string, text = 'Giải giúp em phương trình 3x - 7 = 2x + 5') =>
    student(token, 'POST', '/messages', { subject_code: 'TOAN-THCS-L3', text });
  const flags = (token?: string) => environment.call('alpha', 'GET', '/ai-tutor/safety-flags', undefined, token);
  const setTime = (time: string) => {
    chat.clock = { now: () => at(time) };
  };

  async function login(username: string, channel: 'student' | 'parent' | 'teacher'): Promise<string> {
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/login',
      host: environment.hosts.alpha,
      body: { login: username, password: TEST_PASSWORD, channel },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.access_token as string;
  }

  const counters = () =>
    system
      .selectFrom('ai_tutor_subscriptions')
      .select(['used_turns', 'held_turns'])
      .where('id', '=', subscriptionA)
      .executeTakeFirstOrThrow();
  const ledgerCount = async (childId: string) =>
    (await system.selectFrom('ai_tutor_turn_ledger').select('id').where('child_id', '=', childId).execute()).length;

  // Câu bị khóa: 422 có mã khóa, không có dòng sổ lượt mới, số lượt không đổi, không gọi nhà cung cấp
  async function assertLocked(token: string, childId: string, code: string, pattern: RegExp) {
    const overview = await student(token, 'GET', '');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    const access = overview.body.access as { allowed: boolean; code: string; title: string; message: string };
    assert.equal(access.allowed, false, JSON.stringify(access));
    assert.equal(access.code, code);
    assert.match(`${access.title} ${access.message}`, pattern);
    const ledgerBefore = await ledgerCount(childId);
    const before = childId === children.a ? await counters() : null;
    const received = mock.received.length;
    const reply = await ask(token);
    assert.equal(reply.status, 422, JSON.stringify(reply.body));
    const error = reply.body.error as { message: string; details?: Array<{ field: string; message: string }> };
    assert.match(error.message, pattern);
    assert.deepEqual(error.details?.find((detail) => detail.field === 'lock')?.message, code);
    assert.equal(await ledgerCount(childId), ledgerBefore);
    if (before) {
      assert.deepEqual(await counters(), before);
    }
    assert.equal(mock.received.length, received);
  }

  async function assertOpen(token: string) {
    const overview = await student(token, 'GET', '');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.deepEqual(overview.body.access, { allowed: true });
  }

  async function prepareSchool() {
    const call = (method: string, path: string, body?: unknown) => environment.call('alpha', method, path, body);
    const created = await call('POST', '/academic-years', { name: '2026-2027' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    yearId = created.body.id as string;
    const calendar = {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    };
    assert.equal((await call('PUT', `/academic-years/${yearId}/calendar`, calendar)).status, 200);
    assert.equal((await call('POST', `/academic-years/${yearId}/open`)).status, 200);
    const unit = await call('POST', '/org-units', { code: 'TRUONG', name: 'Trường alpha', unit_type: 'truong_chinh' });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
    unitId = unit.body.id as string;
    const tenant = await environment.tenantOf('alpha');
    schoolYear = await runAsSchool(
      tenant,
      async () => (await environment.api.get(CurrentSchoolYearResolver).require()).database,
    );
    system = environment.apiRuntime.connections.database<SystemDatabase>(tenant, 'system', 'system');
    const identity = environment.identityRuntime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    const subject = await schoolYear
      .insertInto('subjects')
      .values({ code: 'TOAN-THCS-L3', name: 'Toán', school_level: 'THCS' })
      .returning('id')
      .executeTakeFirstOrThrow();
    subjectId = subject.id;
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const homeroomA = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
    const homeroomB = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
    const subjectTeacher = await createTestUser(identity, { roles: [{ roleCode: 'VT-08', orgUnitId: unitId }] });
    const parentUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unitId }] });
    users.homeroomA = homeroomA.id;
    users.subjectTeacher = subjectTeacher.id;
    users.parent = parentUser.id;
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Trần Thị Mẹ Thử', phone: '0900000386', user_id: parentUser.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, code, name] of [
      ['a', '8A', 'Nguyễn Văn An Thử'],
      ['b', '8B', 'Lê Thị Bích Thử'],
      ['c', '8C', 'Phạm Minh Cường Thử'],
    ] as const) {
      const schoolClass = await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: yearId,
          code,
          name: code,
          grade_level: 'K8',
          school_level: 'THCS',
          max_size: 30,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      classes[key] = schoolClass.id;
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: name,
          dob: '2013-03-01',
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
      children[key] = child.id;
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: schoolClass.id, from_date: '2026-09-05' })
        .execute();
      const account = await createTestUser(identity, { roles: [{ roleCode: 'VT-21', orgUnitId: unitId }] });
      await schoolYear
        .insertInto('student_learning_accounts')
        .values({
          child_id: child.id,
          username: account.username,
          password_hash: 'khong-dung',
          issued_at: new Date(),
          issued_by_name: 'Hiệu trưởng thử',
          identity_user_id: account.id,
        })
        .execute();
      tokens[key] = await login(account.username, 'student');
    }
    await schoolYear
      .insertInto('child_guardians')
      .values({
        child_id: children.a,
        guardian_id: guardian.id,
        relationship_item_id: relationship.id,
        is_primary: true,
      })
      .execute();
    // 8A, 8B có giáo viên chủ nhiệm; 8C chưa có (cờ báo Ban Giám hiệu); giáo viên bộ môn dạy 8A
    await schoolYear
      .insertInto('class_staff_assignments')
      .values([
        {
          class_id: classes.a,
          staff_user_id: homeroomA.id,
          staff_name: 'Cô chủ nhiệm 8A',
          assignment_role: 'homeroom',
          from_date: '2026-09-05',
        },
        {
          class_id: classes.b,
          staff_user_id: homeroomB.id,
          staff_name: 'Thầy chủ nhiệm 8B',
          assignment_role: 'homeroom',
          from_date: '2026-09-05',
        },
        {
          class_id: classes.a,
          staff_user_id: subjectTeacher.id,
          staff_name: 'Thầy bộ môn',
          assignment_role: 'subject',
          subject_name: 'Toán',
          from_date: '2026-09-05',
        },
      ])
      .execute();
    tokens.homeroomA = await login(homeroomA.username, 'teacher');
    tokens.homeroomB = await login(homeroomB.username, 'teacher');
    tokens.subjectTeacher = await login(subjectTeacher.username, 'teacher');
    tokens.parent = await login(parentUser.username, 'parent');
  }

  async function subscribe(childId: string) {
    const now = new Date();
    const created = await createAiTutorSubscription(
      system,
      {
        childId,
        childSchoolLevel: 'THCS',
        plan: {
          source: 'school',
          id: randomUUID(),
          kind: 'top_up',
          name: 'Gói lượt thử',
          price: 49000,
          turns: 50,
          allowImages: false,
          schoolLevels: ['THCS'],
          status: 'active',
        },
        periodMonth: null,
        buyerUserId: randomUUID(),
        buyerName: 'Phụ huynh thử',
        pendingExpiresAt: null,
      },
      now,
    );
    assert.equal(created.ok, true, JSON.stringify(created));
    const id = (created as { subscriptionId: string }).subscriptionId;
    assert.equal(await activateAiTutorSubscription(system, id, now, 'thu-nghiem'), true);
    return id;
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gsai_l3', configuration: { aiMock: true } });
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
    chat = environment.api.get(AiTutorChatService) as unknown as { clock: Clock };
    realClock = chat.clock;
    await savePlatformAiKey(
      environment.platform.platform,
      environment.platform.masterKey,
      { enabled: true, apiKey: 'khoa-gia-lap-gsai-l3' },
      { type: 'system' },
    );
    await savePlatformAiSettings(
      environment.platform.platform,
      { provider: 'mock', model: 'mo-hinh-thu', endpoint: null },
      { type: 'system' },
    );
    await prepareSchool();
    subscriptionA = await subscribe(children.a);
    await subscribe(children.b);
    await subscribe(children.c);
  });

  after(async () => {
    await environment?.close();
  });

  afterEach(() => {
    chat.clock = realClock;
    mock.received.length = 0;
    mock.scripted.length = 0;
  });

  it('CT-1780: khung giờ mặc định 22:00 đến 6:00 giờ Việt Nam; câu bị khóa không giữ, không trừ lượt', async () => {
    setTime('21:59');
    await assertOpen(tokens.a);
    setTime('22:00');
    await assertLocked(tokens.a, children.a, 'quiet_hours', /Ngoài giờ dùng\. Gia sư AI mở lại lúc 6:00/);
    setTime('05:59');
    await assertLocked(tokens.a, children.a, 'quiet_hours', /mở lại lúc 6:00/);
    setTime('06:00');
    await assertOpen(tokens.a);
    const reply = await ask(tokens.a);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.deepEqual(await counters(), { used_turns: 1, held_turns: 0 });
  });

  it('CT-1781: trường đổi khung giờ ở cổng quản trị thì khóa theo khung giờ mới', async () => {
    const saved = await environment.call('alpha', 'PUT', '/ai-tutor/school/settings', {
      enabled_levels: [],
      quiet_start: '21:00',
      quiet_end: '07:00',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    try {
      setTime('21:30');
      await assertLocked(tokens.a, children.a, 'quiet_hours', /mở lại lúc 7:00/);
      setTime('06:30');
      await assertLocked(tokens.a, children.a, 'quiet_hours', /mở lại lúc 7:00/);
      setTime('07:00');
      await assertOpen(tokens.a);
    } finally {
      await system.deleteFrom('ai_tutor_school_settings').execute();
    }
  });

  it('CT-1782: đang thi: bài kiểm tra trực tuyến đang mở, lượt đang làm, phòng thi đang mở đều khóa; nộp xong thì mở', async () => {
    setTime('10:00');
    const exam = await schoolYear
      .insertInto('exams')
      .values({
        school_level: 'THCS',
        subject_id: subjectId,
        grade_level_code: 'K8',
        title: 'Đề giữa kỳ Toán',
        status: 'locked',
        author_user_id: randomUUID(),
        author_name: 'Giáo viên thử',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const assignment = await schoolYear
      .insertInto('exam_assignments')
      .values({
        exam_id: exam.id,
        school_level: 'THCS',
        title: 'Kiểm tra giữa kỳ Toán',
        opens_at: at('09:00'),
        closes_at: at('11:00'),
        duration_minutes: 45,
        max_attempts: 1,
        created_by: randomUUID(),
        created_by_name: 'Giáo viên thử',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('exam_assignment_targets')
      .values({ assignment_id: assignment.id, kind: 'class', class_id: classes.a })
      .execute();
    // Bài đang mở, em chưa làm
    await assertLocked(tokens.a, children.a, 'exam', /Đang trong giờ kiểm tra\. .*Kiểm tra giữa kỳ Toán/);
    // Lớp khác không bị khóa
    await assertOpen(tokens.b);
    // Ngoài giờ mở của bài thì không khóa vì bài
    setTime('11:00');
    await assertOpen(tokens.a);
    // Lượt đang làm còn giờ: khóa dù bài đã hết giờ mở
    await schoolYear
      .insertInto('exam_attempts')
      .values({
        assignment_id: assignment.id,
        child_id: children.a,
        attempt_no: 1,
        variant_code: 'A',
        layout: JSON.stringify({}),
        started_at: at('10:50'),
        deadline_at: at('11:20'),
        session_id: 'phien-thu',
      })
      .execute();
    await assertLocked(tokens.a, children.a, 'exam', /Kiểm tra giữa kỳ Toán/);
    // Nộp bài: hết lượt làm, mở lại trong giờ mở của bài
    await schoolYear
      .updateTable('exam_attempts')
      .set({ status: 'submitted', submitted_at: at('10:55') })
      .where('child_id', '=', children.a)
      .execute();
    setTime('10:56');
    await assertOpen(tokens.a);
    // Em B có tên trong phòng thi đang mở (bài giao riêng cho em khác)
    const room = await schoolYear
      .insertInto('exam_rooms')
      .values({
        assignment_id: assignment.id,
        code: '384384',
        opened_by: randomUUID(),
        opened_by_name: 'Giám thị thử',
        opened_at: at('10:30'),
        expires_at: at('11:30'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear.insertInto('exam_room_students').values({ room_id: room.id, child_id: children.b }).execute();
    setTime('11:10');
    await assertLocked(tokens.b, children.b, 'exam', /Kiểm tra giữa kỳ Toán/);
    await schoolYear
      .updateTable('exam_rooms')
      .set({ closed_at: at('11:15') })
      .where('id', '=', room.id)
      .execute();
    setTime('11:16');
    await assertOpen(tokens.b);
  });

  it('CT-1783: bài tập không dùng AI khóa khi bài còn mở với em; giáo viên tắt cờ hoặc em nộp bài thì mở', async () => {
    setTime('14:00');
    const space = await schoolYear
      .insertInto('course_spaces')
      .values({
        kind: 'class_subject',
        class_id: classes.a,
        subject_id: subjectId,
        school_level: 'THCS',
        title: 'Toán 8A',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const section = await schoolYear
      .insertInto('course_sections')
      .values({ space_id: space.id, title: 'Chương 1', position: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const activity = await schoolYear
      .insertInto('course_activities')
      .values({
        space_id: space.id,
        section_id: section.id,
        kind: 'assignment',
        title: 'Viết đoạn văn nghị luận',
        position: 1,
        status: 'published',
        open_rules: null,
        due_at: at('23:00'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const assignment = await schoolYear
      .insertInto('assignments')
      .values({
        activity_id: activity.id,
        created_by: randomUUID(),
        released_at: at('08:00'),
        ai_blocked: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('assignment_recipients')
      .values({ assignment_id: assignment.id, child_id: children.a })
      .execute();
    await assertLocked(tokens.a, children.a, 'assignment', /Bài tập này không dùng AI\. .*"Viết đoạn văn nghị luận"/);
    // Em không được giao bài thì không bị khóa
    await assertOpen(tokens.b);
    // Giáo viên tắt cờ sau khi giao: mở; bật lại: khóa (giáo viên chỉ đổi qua điểm cuối cài đặt của bài, ở đây ghi trực tiếp)
    await schoolYear.updateTable('assignments').set({ ai_blocked: false }).where('id', '=', assignment.id).execute();
    await assertOpen(tokens.a);
    await schoolYear.updateTable('assignments').set({ ai_blocked: true }).where('id', '=', assignment.id).execute();
    await assertLocked(tokens.a, children.a, 'assignment', /Viết đoạn văn nghị luận/);
    // Em được miễn: mở
    await schoolYear
      .updateTable('assignment_recipients')
      .set({ excused: true })
      .where('assignment_id', '=', assignment.id)
      .execute();
    await assertOpen(tokens.a);
    await schoolYear
      .updateTable('assignment_recipients')
      .set({ excused: false })
      .where('assignment_id', '=', assignment.id)
      .execute();
    // Bản nháp chưa tính là nộp; nộp xong (bài cho nộp một lần) thì mở
    await schoolYear
      .insertInto('assignment_submissions')
      .values({ assignment_id: assignment.id, child_id: children.a, attempt_no: 1, status: 'draft' })
      .execute();
    await assertLocked(tokens.a, children.a, 'assignment', /Viết đoạn văn nghị luận/);
    await schoolYear
      .updateTable('assignment_submissions')
      .set({ status: 'submitted', submitted_at: at('13:00') })
      .where('assignment_id', '=', assignment.id)
      .execute();
    await assertOpen(tokens.a);
    // Bài cho nộp hai lần: em còn nộp được nên vẫn khóa; khóa bài tập ưu tiên hơn khung giờ; giáo viên đóng bài thì chỉ còn khung giờ
    await schoolYear.updateTable('assignments').set({ max_attempts: 2 }).where('id', '=', assignment.id).execute();
    setTime('22:30');
    await assertLocked(tokens.a, children.a, 'assignment', /Viết đoạn văn nghị luận/);
    await schoolYear
      .updateTable('assignments')
      .set({ closed_at: at('14:00') })
      .where('id', '=', assignment.id)
      .execute();
    await assertLocked(tokens.a, children.a, 'quiet_hours', /Ngoài giờ dùng/);
  });

  it('CT-1784: giáo viên bật "Không dùng AI" khi soạn bài và đổi được sau khi giao; giá trị sai bị từ chối', async () => {
    const space = await schoolYear
      .insertInto('course_spaces')
      .values({
        kind: 'class_subject',
        class_id: classes.b,
        subject_id: subjectId,
        school_level: 'THCS',
        title: 'Toán 8B',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const section = await schoolYear
      .insertInto('course_sections')
      .values({ space_id: space.id, title: 'Chương 1', position: 1 })
      .returning('id')
      .executeTakeFirstOrThrow();
    const activity = await schoolYear
      .insertInto('course_activities')
      .values({
        space_id: space.id,
        section_id: section.id,
        kind: 'assignment',
        title: 'Bài tự làm',
        position: 1,
        open_rules: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    // Giáo viên bộ môn là giáo viên của lớp học trực tuyến soạn bài
    await schoolYear
      .insertInto('course_space_teachers')
      .values({ space_id: space.id, user_id: users.subjectTeacher, user_name: 'Thầy bộ môn', source: 'manual' })
      .execute();
    const teacher = (method: string, body: unknown) =>
      environment.call('alpha', method, `/learning/activities/${activity.id}/assignment`, body, tokens.subjectTeacher);
    const withoutFlag = { grading: 'completion', items: [{ kind: 'essay', prompt: 'Viết đoạn văn', score: 0 }] };
    const draft = { ...withoutFlag, ai_blocked: true };
    const saved = await teacher('PUT', draft);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((saved.body.assignment as { ai_blocked: boolean }).ai_blocked, true);
    // Màn hình cũ không gửi cờ thì giữ cờ đã có
    const kept = await teacher('PUT', withoutFlag);
    assert.equal((kept.body.assignment as { ai_blocked: boolean }).ai_blocked, true);
    const wrong = await teacher('PUT', { ...draft, ai_blocked: 'co' });
    assert.equal(wrong.status, 400, JSON.stringify(wrong.body));
    const changed = await teacher('PATCH', { ai_blocked: false });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal((changed.body.assignment as { ai_blocked: boolean }).ai_blocked, false);
    const wrongPatch = await teacher('PATCH', { ai_blocked: 1 });
    assert.equal(wrongPatch.status, 422, JSON.stringify(wrongPatch.body));
  });

  it('CT-1785: cờ tự hại báo giáo viên chủ nhiệm và cha mẹ cùng lúc; lớp chưa có giáo viên chủ nhiệm thì báo Ban Giám hiệu; có nhật ký', async () => {
    setTime('15:00');
    const harm = await ask(tokens.a, 'Em buồn quá, em muốn chết');
    assert.equal(harm.status, 201, JSON.stringify(harm.body));
    const flagA = await system
      .selectFrom('ai_tutor_safety_flags')
      .selectAll()
      .where('child_id', '=', children.a)
      .executeTakeFirstOrThrow();
    assert.notEqual(flagA.notified_at, null);
    const notificationA = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select([
        'notifications.title',
        'notifications.body',
        'notification_recipients.user_id',
        'notification_recipients.role_code',
      ])
      .where('notifications.target_id', '=', flagA.id)
      .where('notifications.template_code', '=', 'ai_tutor_safety_flag')
      .execute();
    assert.deepEqual(
      notificationA.map((row) => [row.user_id, row.role_code]),
      [[users.homeroomA, null]],
    );
    // Thông báo cho giáo viên không có loại dấu hiệu và câu em gửi
    assert.match(notificationA[0]?.body ?? '', /Nguyễn Văn An Thử lớp 8A/);
    assert.doesNotMatch(notificationA[0]?.body ?? '', /chết|tự hại/);
    // Cha mẹ có tài khoản liên kết với em nhận cùng lúc: loại dấu hiệu, thời điểm, lời khuyên; không có câu em gửi
    const guardianA = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notifications.body', 'notification_recipients.user_id'])
      .where('notifications.target_id', '=', flagA.id)
      .where('notifications.template_code', '=', 'ai_tutor_safety_flag_guardian')
      .execute();
    assert.deepEqual(
      guardianA.map((row) => row.user_id),
      [users.parent],
    );
    assert.match(guardianA[0]?.body ?? '', /dấu hiệu tự hại/);
    assert.match(guardianA[0]?.body ?? '', /giáo viên chủ nhiệm/);
    assert.match(guardianA[0]?.body ?? '', /111/);
    assert.doesNotMatch(guardianA[0]?.body ?? '', /chết|buồn quá/);
    // Mỗi người chỉ thấy thông báo của mình trong trung tâm thông báo
    const parentInbox = await environment.call('alpha', 'GET', '/notifications', undefined, tokens.parent);
    assert.equal(parentInbox.status, 200, JSON.stringify(parentInbox.body));
    const parentTitles = (parentInbox.body.notifications as Array<{ title: string }>).map((item) => item.title);
    assert.ok(parentTitles.includes('Gia sư AI: con cần cha mẹ quan tâm'));
    assert.ok(!parentTitles.includes('Gia sư AI: học sinh cần thầy cô quan tâm'));
    const teacherInbox = await environment.call('alpha', 'GET', '/notifications', undefined, tokens.homeroomA);
    const teacherTitles = (teacherInbox.body.notifications as Array<{ title: string }>).map((item) => item.title);
    assert.ok(teacherTitles.includes('Gia sư AI: học sinh cần thầy cô quan tâm'));
    assert.ok(!teacherTitles.includes('Gia sư AI: con cần cha mẹ quan tâm'));
    const otherTeacherInbox = await environment.call('alpha', 'GET', '/notifications', undefined, tokens.homeroomB);
    assert.equal(
      (otherTeacherInbox.body.notifications as Array<{ title: string }>).filter((item) =>
        item.title.startsWith('Gia sư AI'),
      ).length,
      0,
    );
    const bullying = await ask(tokens.c, 'Em bị bắt nạt ở lớp, các bạn đánh em');
    assert.equal(bullying.status, 201, JSON.stringify(bullying.body));
    const flagC = await system
      .selectFrom('ai_tutor_safety_flags')
      .selectAll()
      .where('child_id', '=', children.c)
      .executeTakeFirstOrThrow();
    // Em 8C không có cha mẹ có tài khoản: chỉ có thông báo cho Ban Giám hiệu
    const notificationC = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notification_recipients.role_code', 'notification_recipients.org_unit_id'])
      .where('notifications.target_id', '=', flagC.id)
      .orderBy('notification_recipients.role_code')
      .execute();
    assert.deepEqual(
      notificationC.map((row) => [row.role_code, row.org_unit_id]),
      [
        ['VT-02', unitId],
        ['VT-15', unitId],
      ],
    );
    const audits = await schoolYear
      .selectFrom('audit_logs')
      .select(['entity_id', 'after_data'])
      .where('entity_name', '=', 'ai_tutor_safety_flags')
      .execute();
    assert.equal(audits.filter((row) => row.entity_id === flagA.id).length, 1);
    assert.equal(
      (audits.find((row) => row.entity_id === flagC.id)?.after_data as { notified_to: string }).notified_to,
      'leadership',
    );
    // Việc nền không báo lại cờ đã báo; cờ chưa báo (lỗi tạm thời) thì báo lại
    await system.updateTable('ai_tutor_safety_flags').set({ notified_at: null }).where('id', '=', flagC.id).execute();
    const tenant = await environment.tenantOf('alpha');
    const result = await runAsSchool(tenant, () => environment.api.get(AiTutorChatService).maintain(at('15:05')));
    assert.equal(result.notified, 1);
    const again = await runAsSchool(tenant, () => environment.api.get(AiTutorChatService).maintain(at('15:06')));
    assert.equal(again.notified, 0);
  });

  it('CT-1786: giáo viên chủ nhiệm thấy cờ lớp mình, đánh dấu đã xử lý; lớp khác, bộ môn, cha mẹ không thấy; Ban Giám hiệu thấy lớp chưa có chủ nhiệm', async () => {
    const own = await flags(tokens.homeroomA);
    assert.equal(own.status, 200, JSON.stringify(own.body));
    const list = own.body.flags as Array<Record<string, unknown>>;
    assert.equal(list.length, 1);
    assert.equal(own.body.pending_count, 1);
    const flag = list[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(flag).sort(), [
      'child_name',
      'class_name',
      'created_at',
      'excerpt',
      'id',
      'kind',
      'kind_label',
      'resolved',
      'resolved_at',
      'resolved_by_name',
    ]);
    assert.equal(flag.child_name, 'Nguyễn Văn An Thử');
    assert.equal(flag.kind_label, 'Dấu hiệu tự hại');
    assert.equal(flag.excerpt, 'Em buồn quá, em muốn chết');
    // Giáo viên chủ nhiệm lớp khác, giáo viên bộ môn của lớp, cha mẹ: danh sách trống, không đánh dấu được (404)
    for (const token of [tokens.homeroomB, tokens.subjectTeacher, tokens.parent]) {
      const other = await flags(token);
      assert.equal(other.status, 200, JSON.stringify(other.body));
      assert.deepEqual(other.body.flags, []);
      const denied = await environment.call(
        'alpha',
        'POST',
        `/ai-tutor/safety-flags/${String(flag.id)}/resolve`,
        {},
        token,
      );
      assert.equal(denied.status, 404, JSON.stringify(denied.body));
    }
    // Học sinh không gọi được điểm cuối của nhân viên
    assert.equal((await flags(tokens.a)).status, 403);
    // Hiệu trưởng thấy cờ của lớp 8C (chưa có chủ nhiệm), không thấy cờ lớp 8A
    const principal = await flags();
    assert.deepEqual(
      (principal.body.flags as Array<{ class_name: string }>).map((item) => item.class_name),
      ['8C'],
    );
    const resolved = await environment.call(
      'alpha',
      'POST',
      `/ai-tutor/safety-flags/${String(flag.id)}/resolve`,
      {},
      tokens.homeroomA,
    );
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
    const after = await flags(tokens.homeroomA);
    assert.equal(after.body.pending_count, 0);
    assert.equal((after.body.flags as Array<{ resolved: boolean }>)[0]?.resolved, true);
    const audit = await schoolYear
      .selectFrom('audit_logs')
      .select(['actor_user_id', 'after_data'])
      .where('entity_name', '=', 'ai_tutor_safety_flags')
      .where('entity_id', '=', String(flag.id))
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.equal(audit.actor_user_id, users.homeroomA);
    // Cha mẹ vẫn không thấy cờ ở trang chủ đề của con
    const topics = await environment.call(
      'alpha',
      'GET',
      `/children/${children.a}/ai-tutor/topics`,
      undefined,
      tokens.parent,
    );
    assert.equal(topics.status, 200, JSON.stringify(topics.body));
    assert.doesNotMatch(JSON.stringify(topics.body), /flag|muốn chết/);
  });

  it('CT-1890: trường chưa đặt đơn giá AI ở gói dịch vụ thì không bật bán, phụ huynh không mua được gói trường bán; em đã mua vẫn dùng', async () => {
    // Sau giờ đóng của bài tập ở CT-1783 và giờ mở của bài kiểm tra ở CT-1782
    setTime('15:30');
    const platform = environment.platform.platform;
    const tenant = await environment.tenantOf('alpha');
    const overview = async () => {
      const reply = await environment.call('alpha', 'GET', '/ai-tutor/school');
      assert.equal(reply.status, 200, JSON.stringify(reply.body));
      return reply.body.sales_block_reason as string | null;
    };
    const enable = (levels: string[]) =>
      environment.call('alpha', 'PUT', '/ai-tutor/school/settings', {
        enabled_levels: levels,
        quiet_start: '22:00',
        quiet_end: '06:00',
      });
    // Chưa gán gói dịch vụ
    assert.match(String(await overview()), /chưa được gán gói dịch vụ.*liên hệ nền tảng/);
    const refused = await enable(['THCS']);
    assert.equal(refused.status, 422, JSON.stringify(refused.body));
    assert.equal((refused.body.error as { rule_code: string }).rule_code, 'BR-475');
    // Tắt bán vẫn được
    assert.equal((await enable([])).status, 200);
    // Gán gói dịch vụ chưa có đơn giá AI
    const rule = await platform
      .insertInto('price_rules')
      .values({
        code: 'theo-truong-l3',
        name: 'Theo trường',
        components: JSON.stringify(['per_school']),
        school_fee: 1_000_000,
        period: 'monthly',
        vat_percent: 0,
        due_days: 10,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const plan = await platform
      .insertInto('plans')
      .values({ code: 'goi-l3', name: 'Gói thử L3', price_rule_id: rule.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    await platform
      .insertInto('school_plans')
      .values({ school_id: tenant.schoolId, plan_id: plan.id, effective_from: '2026-01-01' })
      .execute();
    environment.apiRuntime.registry.invalidate();
    assert.match(String(await overview()), /chưa đặt đơn giá AI/);
    assert.equal((await enable(['THCS'])).status, 422);
    // Cài đặt đã bật từ trước (dữ liệu cũ) và gói đang bán: phụ huynh không thấy gói, mua bị từ chối
    await system
      .insertInto('ai_tutor_school_settings')
      .values({ id: 1, enabled_levels: ['THCS'] })
      .onConflict((conflict) => conflict.column('id').doUpdateSet({ enabled_levels: ['THCS'] }))
      .execute();
    const created = await environment.call('alpha', 'POST', '/ai-tutor/school/plans', {
      kind: 'top_up',
      name: 'Gói 20 lượt L3',
      price: 29_000,
      turns: 20,
      allow_images: false,
      school_levels: ['THCS'],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const planId = created.body.id as string;
    const view = await environment.call('alpha', 'GET', `/children/${children.a}/ai-tutor`, undefined, tokens.parent);
    assert.equal(view.status, 200, JSON.stringify(view.body));
    assert.equal(view.body.enabled, false);
    assert.deepEqual(view.body.plans, []);
    const purchase = await environment.call(
      'alpha',
      'POST',
      `/children/${children.a}/ai-tutor/purchases`,
      { plan_id: planId, consent: true },
      tokens.parent,
    );
    assert.equal(purchase.status, 422, JSON.stringify(purchase.body));
    assert.equal((purchase.body.error as { rule_code: string }).rule_code, 'BR-475');
    // Em đã mua trước đó vẫn hỏi được
    const reply = await ask(tokens.a, 'Số nguyên tố là gì?');
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    // Nền tảng đặt đơn giá AI: trường bật bán, phụ huynh mua được
    await savePlanAiPricing(
      platform,
      plan.id,
      { freeTokens: 0, inputPricePer1k: 10, outputPricePer1k: 20, modelPrices: {}, minimumFee: 0, roundingStep: 1 },
      { type: 'operator', id: '00000000-0000-4000-8000-000000000003' },
    );
    assert.equal(await overview(), null);
    assert.equal((await enable(['THCS'])).status, 200);
    const allowed = await environment.call(
      'alpha',
      'POST',
      `/children/${children.a}/ai-tutor/purchases`,
      { plan_id: planId, consent: true },
      tokens.parent,
    );
    assert.equal(allowed.status, 201, JSON.stringify(allowed.body));
    await system.deleteFrom('ai_tutor_school_settings').execute();
  });
});
