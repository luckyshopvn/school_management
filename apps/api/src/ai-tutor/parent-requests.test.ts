import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, it } from 'node:test';
import {
  savePlatformAiKey,
  savePlatformAiSettings,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import { AI_PROVIDERS } from '../ai-assistant/ai-assistant.js';
import type { AiProviderRegistry, MockAiProvider } from '../ai-assistant/ai-provider.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { activateAiTutorSubscription, createAiTutorSubscription } from './ai-tutor-turns.js';
import { PARENT_REQUEST_TEMPLATES } from './parent-requests.js';

// Gia sư AI hoàn thiện (YCTD-383 lát L5), kịch bản CT-2030 đến CT-2033: em chưa có gói hoặc hết lượt gửi lời nhờ cha mẹ, cha mẹ nhận
// thông báo, mỗi lý do một lần trong 24 giờ, hai lần bấm cùng lúc chỉ tạo một thông báo; em còn lượt, em chưa có cha mẹ có tài khoản thì
// không gửi được; cha mẹ thấy chủ đề nhiều nhất và số lượt, không thấy nội dung; báo cáo tháng cho trường: lượt hỏi, token theo nguồn gói,
// câu được hoàn lượt vẫn tính token. Bộ giả lập nhà cung cấp, không gọi API thật. Dữ liệu bịa
describe('Gia sư AI: lời nhờ cha mẹ, chủ đề cho cha mẹ, báo cáo cho trường', () => {
  let environment: MultiTenantApi;
  let mock: MockAiProvider;
  let system: Kysely<SystemDatabase>;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const tokens = {
    noPlan: '',
    twin: '',
    orphan: '',
    exhausted: '',
    platformKid: '',
    parent: '',
    otherParent: '',
    teacher: '',
  };
  const children = { noPlan: '', twin: '', orphan: '', exhausted: '', platformKid: '' };
  const names = {
    noPlan: 'Nguyễn Văn Nhờ Thử',
    twin: 'Nguyễn Văn Song Thử',
    orphan: 'Lê Thị Riêng Thử',
    exhausted: 'Trần Văn Hết Thử',
    platformKid: 'Phạm Thị Nền Thử',
  } as const;
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

  const student = (token: string, method: string, path: string, body?: unknown) =>
    environment.call('alpha', method, `/student/ai-tutor${path}`, body, token);
  const requestParents = (token: string) => student(token, 'POST', '/parent-requests');
  const ask = (token: string, text: string) =>
    student(token, 'POST', '/messages', { subject_code: 'TOAN-THCS-L5', text });

  async function login(username: string, channel: 'student' | 'parent' | 'teacher'): Promise<string> {
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/login',
      host: environment.hosts.alpha,
      body: { login: username, password: TEST_PASSWORD, channel },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.access_token as string;
  }

  const requestRows = (childId: string) =>
    schoolYear
      .selectFrom('notifications')
      .select(['id', 'template_code', 'body'])
      .where('target_type', '=', 'children')
      .where('target_id', '=', childId)
      .execute();

  async function inbox(token: string) {
    const reply = await environment.call('alpha', 'GET', '/notifications', undefined, token);
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.notifications as Array<{ title: string; body: string }>;
  }

  async function subscribe(childId: string, source: 'school' | 'platform', turns: number, kind: 'monthly' | 'top_up') {
    const now = new Date();
    const created = await createAiTutorSubscription(
      system,
      {
        childId,
        childSchoolLevel: 'THCS',
        plan: {
          source,
          id: randomUUID(),
          kind,
          name: 'Gói thử',
          price: 79000,
          turns,
          allowImages: false,
          schoolLevels: ['THCS'],
          status: 'active',
        },
        periodMonth: kind === 'monthly' ? `${month}-01` : null,
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

  async function prepareSchool() {
    const call = (method: string, path: string, body?: unknown) => environment.call('alpha', method, path, body);
    const created = await call('POST', '/academic-years', { name: '2026-2027' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const yearId = created.body.id as string;
    const calendar = {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    };
    assert.equal((await call('PUT', `/academic-years/${yearId}/calendar`, calendar)).status, 200);
    assert.equal((await call('POST', `/academic-years/${yearId}/open`)).status, 200);
    const unit = await call('POST', '/org-units', { code: 'TRUONG', name: 'Trường alpha', unit_type: 'truong_chinh' });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
    const unitId = unit.body.id as string;
    const tenant = await environment.tenantOf('alpha');
    schoolYear = await runAsSchool(
      tenant,
      async () => (await environment.api.get(CurrentSchoolYearResolver).require()).database,
    );
    system = environment.apiRuntime.connections.database<SystemDatabase>(tenant, 'system', 'system');
    const identity = environment.identityRuntime.connections.database<IdentityDatabase>(tenant, 'identity', 'identity');
    await schoolYear
      .insertInto('subjects')
      .values({ code: 'TOAN-THCS-L5', name: 'Toán', school_level: 'THCS' })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const parentUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unitId }] });
    const otherParentUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unitId }] });
    const teacherUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Trần Thị Mẹ Nhờ Thử', phone: '0900000531', user_id: parentUser.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    // Người giám hộ của em `orphan` chưa có tài khoản ứng dụng phụ huynh
    const offlineGuardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Lê Văn Bố Chưa Có Tài Khoản', phone: '0900000532' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const schoolClass = await schoolYear
      .insertInto('classes')
      .values({
        org_unit_id: unitId,
        academic_year_id: yearId,
        code: '8L5',
        name: '8L5',
        grade_level: 'K8',
        school_level: 'THCS',
        max_size: 30,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const key of Object.keys(children) as Array<keyof typeof children>) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: names[key],
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
      await schoolYear
        .insertInto('child_guardians')
        .values({
          child_id: child.id,
          guardian_id: key === 'orphan' ? offlineGuardian.id : guardian.id,
          relationship_item_id: relationship.id,
          is_primary: true,
        })
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
    tokens.parent = await login(parentUser.username, 'parent');
    tokens.otherParent = await login(otherParentUser.username, 'parent');
    tokens.teacher = await login(teacherUser.username, 'teacher');
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gsai_l5', configuration: { aiMock: true } });
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
    await savePlatformAiKey(
      environment.platform.platform,
      environment.platform.masterKey,
      { enabled: true, apiKey: 'khoa-gia-lap-gsai-l5' },
      { type: 'system' },
    );
    await savePlatformAiSettings(
      environment.platform.platform,
      { provider: 'mock', model: 'mo-hinh-thu', endpoint: null },
      { type: 'system' },
    );
    await prepareSchool();
    // Khung giờ khóa cách giờ chạy kiểm thử sáu tiếng để các ca không phụ thuộc giờ chạy (như lát L2)
    const hour = (Math.floor(Date.now() / 3_600_000) + 7 + 6) % 24;
    const pad = (value: number) => String(value).padStart(2, '0');
    await system
      .insertInto('ai_tutor_school_settings')
      .values({ id: 1, quiet_start: `${pad(hour)}:00`, quiet_end: `${pad((hour + 1) % 24)}:00` })
      .execute();
    await subscribe(children.exhausted, 'school', 1, 'top_up');
    await subscribe(children.platformKid, 'platform', 10, 'monthly');
  });

  after(async () => {
    await environment?.close();
  });

  afterEach(() => {
    mock.received.length = 0;
    mock.scripted.length = 0;
  });

  it('CT-2030: em chưa có gói gửi lời nhờ cha mẹ; mỗi lý do một lần trong 24 giờ; chưa có cha mẹ có tài khoản thì không gửi', async () => {
    const overview = await student(tokens.noPlan, 'GET', '');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.deepEqual(overview.body.parent_request, {
      reason: 'no_plan',
      guardian_account: true,
      last_sent_at: null,
      next_allowed_at: null,
    });

    const sent = await requestParents(tokens.noPlan);
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal(sent.body.notified, 1);
    assert.equal(sent.body.reason, 'no_plan');
    assert.ok(sent.body.next_allowed_at);
    const messages = await inbox(tokens.parent);
    const received = messages.find((item) => item.body.includes(names.noPlan));
    assert.ok(received, JSON.stringify(messages));
    assert.equal(received.title, 'Gia sư AI: con nhờ cha mẹ');
    assert.match(received.body, /nhờ cha mẹ đăng ký gói Gia sư AI/);
    assert.equal(mock.received.length, 0);

    const again = await requestParents(tokens.noPlan);
    assert.equal(again.status, 422, JSON.stringify(again.body));
    assert.match((again.body.error as { message: string }).message, /đã gửi lời nhờ cha mẹ lúc .* gửi lại được sau/);
    assert.equal((await requestRows(children.noPlan)).length, 1);
    const afterSend = await student(tokens.noPlan, 'GET', '');
    const state = afterSend.body.parent_request as { last_sent_at: string | null; next_allowed_at: string | null };
    assert.ok(state.last_sent_at && state.next_allowed_at);

    // Hai lần bấm cùng lúc chỉ tạo một thông báo
    const both = await Promise.all([requestParents(tokens.twin), requestParents(tokens.twin)]);
    assert.deepEqual(
      both.map((reply) => reply.status).sort(),
      [201, 422],
      JSON.stringify(both.map((reply) => reply.body)),
    );
    assert.equal((await requestRows(children.twin)).length, 1);

    // Cha mẹ chưa có tài khoản: không tạo thông báo, em được nhắc nói trực tiếp
    const lonely = await student(tokens.orphan, 'GET', '');
    assert.equal((lonely.body.parent_request as { guardian_account: boolean }).guardian_account, false);
    const refused = await requestParents(tokens.orphan);
    assert.equal(refused.status, 422, JSON.stringify(refused.body));
    assert.match((refused.body.error as { message: string }).message, /chưa có tài khoản ứng dụng phụ huynh/);
    assert.equal((await requestRows(children.orphan)).length, 0);

    // Chỉ kênh của học sinh gửi được
    const teacher = await requestParents(tokens.teacher);
    assert.ok([401, 403].includes(teacher.status), JSON.stringify(teacher.body));
    const parent = await requestParents(tokens.parent);
    assert.ok([401, 403].includes(parent.status), JSON.stringify(parent.body));
  });

  it('CT-2031: em còn lượt thì không gửi; hết lượt thì nhờ mua thêm hoặc gia hạn; sau 24 giờ gửi lại được', async () => {
    const early = await requestParents(tokens.exhausted);
    assert.equal(early.status, 422, JSON.stringify(early.body));
    assert.match((early.body.error as { message: string }).message, /còn lượt hỏi/);
    assert.equal((await requestRows(children.exhausted)).length, 0);

    const asked = await ask(tokens.exhausted, 'Giải giúp em phương trình 3x - 7 = 2x + 5');
    assert.equal(asked.status, 201, JSON.stringify(asked.body));
    assert.equal(asked.body.turn, 'captured');
    const overview = await student(tokens.exhausted, 'GET', '');
    assert.equal((overview.body.parent_request as { reason: string }).reason, 'no_turns');

    const sent = await requestParents(tokens.exhausted);
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const rows = await requestRows(children.exhausted);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.template_code, PARENT_REQUEST_TEMPLATES.no_turns);
    const received = (await inbox(tokens.parent)).find((item) => item.body.includes(names.exhausted));
    assert.ok(received);
    assert.match(received.body, /đã dùng hết lượt hỏi Gia sư AI và nhờ cha mẹ mua thêm lượt hoặc gia hạn gói/);
    // Thông báo không có câu em đã hỏi
    assert.doesNotMatch(received.body, /3x/);
    assert.equal(
      (await inbox(tokens.otherParent)).some((item) => item.body.includes(names.exhausted)),
      false,
    );

    assert.equal((await requestParents(tokens.exhausted)).status, 422);
    await schoolYear
      .updateTable('notifications')
      .set({ created_at: sql`created_at - interval '25 hours'` })
      .where('id', '=', rows[0]?.id as string)
      .execute();
    const later = await requestParents(tokens.exhausted);
    assert.equal(later.status, 201, JSON.stringify(later.body));
    assert.equal((await requestRows(children.exhausted)).length, 2);
  });

  it('CT-2032: cha mẹ thấy chủ đề nhiều nhất và số lượt tháng này, không thấy nội dung; phụ huynh khác bị từ chối', async () => {
    const reply = (topic: string) =>
      JSON.stringify({
        step: 'method',
        topic,
        reply: 'Em thử chuyển các hạng tử chứa x sang một vế xem.',
        final_answer: '',
      });
    mock.scripted.push(reply('Phương trình bậc nhất'));
    assert.equal((await ask(tokens.platformKid, 'Em chưa hiểu cách giải phương trình 2x + 1 = 7')).status, 201);
    mock.scripted.push(reply('Phương trình bậc nhất'));
    assert.equal((await ask(tokens.platformKid, 'Phương trình 5x - 2 = 8 làm sao ạ')).status, 201);
    mock.scripted.push(reply('Định lý Pytago'));
    assert.equal((await ask(tokens.platformKid, 'Tam giác vuông có hai cạnh 6 và 8')).status, 201);
    // Câu ngoài học tập: gọi nhà cung cấp, hoàn lượt, không vào chủ đề nhiều nhất
    mock.scripted.push(
      JSON.stringify({ step: 'refusal', topic: '', reply: 'Gia sư chỉ giúp em học bài thôi nhé.', final_answer: '' }),
    );
    const offTopic = await ask(tokens.platformKid, 'Kể chuyện cười đi');
    assert.equal(offTopic.body.turn, 'released');

    const topics = await environment.call(
      'alpha',
      'GET',
      `/children/${children.platformKid}/ai-tutor/topics`,
      undefined,
      tokens.parent,
    );
    assert.equal(topics.status, 200, JSON.stringify(topics.body));
    assert.equal(topics.body.turns_this_month, 3);
    assert.deepEqual(topics.body.top_topics, [
      { topic: 'Phương trình bậc nhất', turns: 2 },
      { topic: 'Định lý Pytago', turns: 1 },
    ]);
    const text = JSON.stringify(topics.body);
    for (const fragment of ['2x + 1', 'chuyển các hạng tử', 'chuyện cười', 'body']) {
      assert.equal(text.includes(fragment), false, fragment);
    }
    const other = await environment.call(
      'alpha',
      'GET',
      `/children/${children.platformKid}/ai-tutor/topics`,
      undefined,
      tokens.otherParent,
    );
    assert.equal(other.status, 403, JSON.stringify(other.body));
  });

  it('CT-2033: báo cáo tháng cho trường: lượt hỏi, token theo nguồn gói, câu được hoàn lượt vẫn tính token', async () => {
    const report = await environment.call('alpha', 'GET', `/ai-tutor/school/report?month=${month}`);
    assert.equal(report.status, 200, JSON.stringify(report.body));
    const tokensOf = async (source: 'school' | 'platform') => {
      const row = await system
        .selectFrom('ai_tutor_messages')
        .innerJoin('ai_tutor_turn_ledger', 'ai_tutor_turn_ledger.id', 'ai_tutor_messages.ledger_entry_id')
        .innerJoin('ai_tutor_subscriptions', 'ai_tutor_subscriptions.id', 'ai_tutor_turn_ledger.subscription_id')
        .select([
          sql<string>`count(*)`.as('requests'),
          sql<string>`coalesce(sum(ai_tutor_messages.input_tokens), 0)`.as('input'),
          sql<string>`coalesce(sum(ai_tutor_messages.output_tokens), 0)`.as('output'),
        ])
        .where('ai_tutor_messages.role', '=', 'tutor')
        .where('ai_tutor_messages.model', 'is not', null)
        .where('ai_tutor_subscriptions.plan_source', '=', source)
        .executeTakeFirstOrThrow();
      return { requests: Number(row.requests), input: Number(row.input), output: Number(row.output) };
    };
    const school = await tokensOf('school');
    const platform = await tokensOf('platform');
    assert.ok(school.input > 0 && platform.input > 0);
    assert.deepEqual(report.body, {
      month,
      questions: 4,
      students: 2,
      refunded_answers_with_tokens: 1,
      school: {
        questions: 1,
        requests: school.requests,
        input_tokens: school.input,
        output_tokens: school.output,
        total_tokens: school.input + school.output,
      },
      platform: {
        questions: 3,
        requests: 4,
        input_tokens: platform.input,
        output_tokens: platform.output,
        total_tokens: platform.input + platform.output,
      },
    });
    assert.equal(JSON.stringify(report.body).includes(names.platformKid), false);

    const [year, value] = month.split('-').map(Number) as [number, number];
    const next = value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
    const empty = await environment.call('alpha', 'GET', `/ai-tutor/school/report?month=${next}`);
    assert.equal(empty.status, 200, JSON.stringify(empty.body));
    assert.equal(empty.body.questions, 0);
    assert.equal((empty.body.school as { total_tokens: number }).total_tokens, 0);

    assert.equal((await environment.call('alpha', 'GET', '/ai-tutor/school/report?month=2026-13')).status, 400);
    const teacher = await environment.call('alpha', 'GET', '/ai-tutor/school/report', undefined, tokens.teacher);
    assert.equal(teacher.status, 403, JSON.stringify(teacher.body));
    const parent = await environment.call('alpha', 'GET', '/ai-tutor/school/report', undefined, tokens.parent);
    assert.ok([401, 403].includes(parent.status), JSON.stringify(parent.body));
  });
});
