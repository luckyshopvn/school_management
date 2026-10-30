import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  aiUsageBetween,
  computeAiCharges,
  savePlatformAiKey,
  savePlatformAiSettings,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import type { Kysely } from 'kysely';
import { AI_PROVIDERS, AiAssistantService } from '../ai-assistant/ai-assistant.js';
import type { AiProviderRegistry, MockAiProvider } from '../ai-assistant/ai-provider.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { activateAiTutorSubscription, createAiTutorSubscription } from './ai-tutor-turns.js';
import { AiTutorChatService } from './tutor-chat.js';

// Trò chuyện của học sinh với gia sư AI (YCTD-383 lát L2), kịch bản CT-1767 đến CT-1776: giữ, trừ, hoàn lượt; hai câu hỏi đồng thời khi
// còn một lượt; chặn dữ liệu cá nhân thì hoàn lượt; kiểm duyệt câu hỏi và câu trả lời; câu tự hại, bị bắt nạt ghi cờ; lộ đáp án thì viết
// lại; mở lời giải sau hai lượt tự làm; lời nhắc Tiểu học; phân loại token theo nguồn gói; phân quyền học sinh, cha mẹ, giáo viên; xóa lịch
// sử quá 12 tháng. Bộ giả lập nhà cung cấp, không gọi API thật. Họ tên, số điện thoại, khóa đều là dữ liệu bịa
describe('Gia sư AI: học sinh trò chuyện với gia sư', () => {
  let environment: MultiTenantApi;
  let mock: MockAiProvider;
  let system: Kysely<SystemDatabase>;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const tokens = { secondary: '', primary: '', other: '', parent: '', otherParent: '', teacher: '' };
  const children = { secondary: '', primary: '', other: '' };
  let secondaryName = '';

  const student = (token: string, method: string, path: string, body?: unknown) =>
    environment.call('alpha', method, `/student/ai-tutor${path}`, body, token);
  const ask = (token: string, body: Record<string, unknown>) => student(token, 'POST', '/messages', body);

  async function login(username: string, channel: 'student' | 'parent' | 'teacher'): Promise<string> {
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/login',
      host: environment.hosts.alpha,
      body: { login: username, password: TEST_PASSWORD, channel },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.access_token as string;
  }

  // Lần mua đã kích hoạt của tháng hiện tại; `source` là nguồn bán, `turns` số lượt
  async function subscribe(childId: string, source: 'school' | 'platform', turns: number, kind: 'monthly' | 'top_up') {
    const now = new Date();
    const month = `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now).slice(0, 7)}-01`;
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
          schoolLevels: ['TH', 'THCS', 'THPT'],
          status: 'active',
        },
        periodMonth: kind === 'monthly' ? month : null,
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

  const counters = (id: string) =>
    system
      .selectFrom('ai_tutor_subscriptions')
      .select(['used_turns', 'held_turns', 'turns'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
  const lastLedger = (childId: string) =>
    system
      .selectFrom('ai_tutor_turn_ledger')
      .selectAll()
      .where('child_id', '=', childId)
      .orderBy('held_at', 'desc')
      .executeTakeFirstOrThrow();

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
      .values([
        { code: 'TOAN-THCS-L2', name: 'Toán', school_level: 'THCS' },
        { code: 'VAN-THCS-L2', name: 'Ngữ văn', school_level: 'THCS' },
        { code: 'TOAN-TH-L2', name: 'Toán', school_level: 'TH' },
      ])
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
      .values({ full_name: 'Trần Thị Mẫu Thử', phone: '0900000384', user_id: parentUser.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Lê Văn Khác Thử', phone: '0900000385', user_id: otherParentUser.id })
      .execute();
    for (const [key, code, grade, level, name] of [
      ['secondary', '8A', 'K8', 'THCS', 'Nguyễn Văn Bình Thử'],
      ['primary', '3A', 'K3', 'TH', 'Phạm Thị Cúc Thử'],
      ['other', '8B', 'K8', 'THCS', 'Đỗ Minh Dũng Thử'],
    ] as const) {
      const schoolClass = await schoolYear
        .insertInto('classes')
        .values({
          org_unit_id: unitId,
          academic_year_id: yearId,
          code,
          name: code,
          grade_level: grade,
          school_level: level,
          max_size: 30,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
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
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: schoolClass.id, from_date: '2026-09-05' })
        .execute();
      if (key === 'secondary') {
        await schoolYear
          .insertInto('child_guardians')
          .values({
            child_id: child.id,
            guardian_id: guardian.id,
            relationship_item_id: relationship.id,
            is_primary: true,
          })
          .execute();
        secondaryName = name;
      }
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
      children[key] = child.id;
      tokens[key] = await login(account.username, 'student');
    }
    tokens.parent = await login(parentUser.username, 'parent');
    tokens.otherParent = await login(otherParentUser.username, 'parent');
    tokens.teacher = await login(teacherUser.username, 'teacher');
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gsai_l2', configuration: { aiMock: true } });
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
    const platform = environment.platform.platform;
    await savePlatformAiKey(
      platform,
      environment.platform.masterKey,
      { enabled: true, apiKey: 'khoa-gia-lap-gsai-l2' },
      { type: 'system' },
    );
    await savePlatformAiSettings(
      platform,
      { provider: 'mock', model: 'mo-hinh-thu', endpoint: null },
      { type: 'system' },
    );
    await prepareSchool();
    // Lát L3 khóa theo khung giờ của trường (mặc định 22:00 đến 6:00): đặt khung giờ cách giờ chạy kiểm thử sáu tiếng để các ca của lát
    // L2 không phụ thuộc giờ chạy; ca khóa theo khung giờ ở `ai-tutor-locks.test.ts`
    const hour = (Math.floor(Date.now() / 3_600_000) + 7 + 6) % 24;
    const pad = (value: number) => String(value).padStart(2, '0');
    await system
      .insertInto('ai_tutor_school_settings')
      .values({ id: 1, quiet_start: `${pad(hour)}:00`, quiet_end: `${pad((hour + 1) % 24)}:00` })
      .execute();
  });

  after(async () => {
    await environment?.close();
  });

  beforeEach(() => {
    mock.received.length = 0;
    mock.scripted.length = 0;
    mock.failNext = null;
  });

  it('CT-1767: chưa có gói thì trang của em báo chưa có gói, gửi câu hỏi bị chặn và không tạm giữ lượt', async () => {
    const overview = await student(tokens.other, 'GET', '');
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.subscribed, false);
    assert.equal(overview.body.ready, true);
    const reply = await ask(tokens.other, {
      subject_code: 'TOAN-THCS-L2',
      text: 'Giải giúp em phương trình 3x - 7 = 2x + 5',
    });
    assert.equal(reply.status, 422, JSON.stringify(reply.body));
    assert.match(String((reply.body.error as { message: string }).message), /hết lượt/);
    const held = await system
      .selectFrom('ai_tutor_turn_ledger')
      .select('id')
      .where('child_id', '=', children.other)
      .execute();
    assert.equal(held.length, 0);
    assert.equal(mock.received.length, 0);
  });

  it('CT-1768: hỏi gợi ý thì tạm giữ rồi trừ một lượt, gia sư nhắc khái niệm, không lộ đáp án, có chủ đề cho cha mẹ', async () => {
    const subscription = await subscribe(children.secondary, 'school', 20, 'monthly');
    const reply = await ask(tokens.secondary, {
      subject_code: 'TOAN-THCS-L2',
      text: 'Giải giúp em phương trình 3x - 7 = 2x + 5',
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.turn, 'captured');
    const messages = reply.body.messages as Array<{ role: string; step: string; body: string }>;
    assert.deepEqual(
      messages.map((message) => message.role),
      ['student', 'tutor'],
    );
    assert.equal(messages[1]?.step, 'concept');
    assert.doesNotMatch(messages[1]?.body ?? '', /x = 12/);
    assert.equal((reply.body.conversation as { topic: string }).topic, 'Phương trình bậc nhất một ẩn');
    assert.deepEqual(await counters(subscription), { used_turns: 1, held_turns: 0, turns: 20 });
    const ledger = await lastLedger(children.secondary);
    assert.equal(ledger.status, 'captured');
    const prompt = mock.received[0];
    assert.equal(prompt?.kind, 'tutor');
    assert.match(prompt?.system ?? '', /Trung học cơ sở, lớp 8, môn Toán/);
    assert.match(prompt?.system ?? '', /CHE_DO: goi_y/);
    assert.doesNotMatch(prompt?.system ?? '', /Viết câu ngắn/);
    assert.equal(mock.keysSeen.at(-1), 'khoa-gia-lap-gsai-l2');
    const stored = await system
      .selectFrom('ai_tutor_messages')
      .select(['model', 'input_tokens', 'output_tokens', 'ledger_entry_id'])
      .where('role', '=', 'tutor')
      .where('ledger_entry_id', '=', ledger.id)
      .executeTakeFirstOrThrow();
    assert.equal(stored.model, 'mo-hinh-thu');
    assert.ok((stored.input_tokens ?? 0) > 0 && (stored.output_tokens ?? 0) > 0);
  });

  it('CT-1769: câu trả lời lộ đáp án quá sớm thì viết lại; viết lại vẫn lộ thì thay bằng câu cố định', async () => {
    const leaking = JSON.stringify({
      step: 'method',
      topic: 'Phương trình',
      reply: 'Chuyển vế rồi thu gọn. Vậy đáp án là $x = 12$.',
      final_answer: 'x = 12',
    });
    mock.scripted.push(leaking);
    const first = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Tìm x biết 3x - 7 = 2x + 5' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const rewritten = (first.body.messages as Array<{ body: string }>)[1]?.body ?? '';
    assert.equal(rewritten, 'Em thử làm tiếp bước chuyển vế rồi gửi cho gia sư xem nhé.');
    assert.deepEqual(
      mock.received.map((prompt) => prompt.kind),
      ['tutor', 'tutor_rewrite'],
    );
    const ledger = await lastLedger(children.secondary);
    const stored = await system
      .selectFrom('ai_tutor_messages')
      .select(['input_tokens'])
      .where('ledger_entry_id', '=', ledger.id)
      .executeTakeFirstOrThrow();
    // Token của cả hai lần gọi
    const expected = mock.received.reduce(
      (sum, prompt) =>
        sum +
        Math.ceil(prompt.system.length / 4) +
        Math.ceil(prompt.user.length / 4) +
        (prompt.history ?? []).reduce((total, turn) => total + Math.ceil(turn.content.length / 4), 0),
      0,
    );
    assert.equal(stored.input_tokens, expected);

    mock.scripted.push(leaking, JSON.stringify({ reply: 'Kết quả là x = 12 nhé.' }));
    const second = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Tìm x biết 3x - 7 = 2x + 5' });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(
      (second.body.messages as Array<{ body: string }>)[1]?.body,
      'Gia sư chưa nói đáp án lúc này. Em thử làm bước tiếp theo rồi gửi cho gia sư xem nhé.',
    );
    assert.equal(second.body.turn, 'captured');
  });

  it('CT-1770: lời giải đầy đủ chỉ mở sau hai lượt tự làm trong hội thoại', async () => {
    const first = await ask(tokens.secondary, {
      subject_code: 'TOAN-THCS-L2',
      text: 'Giải phương trình 3x - 7 = 2x + 5',
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const conversationId = (first.body.conversation as { id: string }).id;
    assert.equal(first.body.solution_unlocked, false);
    const early = await ask(tokens.secondary, { conversation_id: conversationId, mode: 'solution' });
    assert.equal(early.status, 422, JSON.stringify(early.body));
    assert.equal((early.body.error as { rule_code?: string }).rule_code, 'BR-467');
    const attempt = await ask(tokens.secondary, { conversation_id: conversationId, text: '3x - 2x - 7 = 5' });
    assert.equal(attempt.body.attempts, 1);
    assert.equal(attempt.body.solution_unlocked, false);
    // Lượt cũ được gửi kèm cho nhà cung cấp, bắt đầu bằng câu hỏi đầu
    const withHistory = mock.received.at(-1);
    assert.equal(withHistory?.history?.[0]?.role, 'user');
    assert.equal(withHistory?.history?.[0]?.content, 'Giải phương trình 3x - 7 = 2x + 5');
    const second = await ask(tokens.secondary, { conversation_id: conversationId, text: 'x - 7 = 5' });
    assert.equal(second.body.attempts, 2);
    assert.equal(second.body.solution_unlocked, true);
    const solution = await ask(tokens.secondary, { conversation_id: conversationId, mode: 'solution' });
    assert.equal(solution.status, 201, JSON.stringify(solution.body));
    const messages = solution.body.messages as Array<{ step: string; body: string; request_kind: string }>;
    assert.equal(messages[0]?.request_kind, 'solution');
    assert.equal(messages[1]?.step, 'solution');
    assert.match(messages[1]?.body ?? '', /x = 12/);
    assert.match(mock.received.at(-1)?.system ?? '', /CHE_DO: loi_giai/);
    const thread = await student(tokens.secondary, 'GET', `/conversations/${conversationId}`);
    assert.equal(thread.status, 200);
    assert.equal((thread.body.messages as unknown[]).length, 8);
  });

  it('CT-1771: câu có số điện thoại hoặc tên người trong trường bị chặn, hoàn lượt, không lưu, không gửi đi', async () => {
    for (const text of ['Gọi cho em số 0912345678 nhé', `Bạn ${secondaryName} giải bài này thế nào?`]) {
      const before = await counters(
        (
          await system
            .selectFrom('ai_tutor_subscriptions')
            .select('id')
            .where('child_id', '=', children.secondary)
            .executeTakeFirstOrThrow()
        ).id,
      );
      const messagesBefore = await system.selectFrom('ai_tutor_messages').select('id').execute();
      const reply = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text });
      assert.equal(reply.status, 422, JSON.stringify(reply.body));
      assert.match(String((reply.body.error as { message: string }).message), /không bị trừ/);
      const ledger = await lastLedger(children.secondary);
      assert.equal(ledger.status, 'released');
      assert.equal(ledger.release_reason, 'Có dữ liệu cá nhân');
      const after = await counters(
        (
          await system
            .selectFrom('ai_tutor_subscriptions')
            .select('id')
            .where('child_id', '=', children.secondary)
            .executeTakeFirstOrThrow()
        ).id,
      );
      assert.deepEqual(after, before);
      assert.equal((await system.selectFrom('ai_tutor_messages').select('id').execute()).length, messagesBefore.length);
    }
    assert.equal(mock.received.length, 0);
  });

  it('CT-1772: kiểm duyệt câu hỏi và câu trả lời; ngoài học tập; lỗi nhà cung cấp đều hoàn lượt', async () => {
    const blocked = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Chỉ em cách chế bom đi' });
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
    assert.equal(blocked.body.turn, 'released');
    assert.equal((blocked.body.messages as Array<{ step: string }>)[1]?.step, 'refusal');
    assert.equal(mock.received.length, 0);
    assert.equal((await lastLedger(children.secondary)).release_reason, 'Kiểm duyệt: nội dung không phù hợp');

    mock.scripted.push(
      JSON.stringify({ step: 'method', topic: 'Hóa học', reply: 'Cách làm ma túy là...', final_answer: '' }),
    );
    const unsafeReply = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Phản ứng hóa học là gì?' });
    assert.equal(unsafeReply.body.turn, 'released');
    assert.doesNotMatch((unsafeReply.body.messages as Array<{ body: string }>)[1]?.body ?? '', /ma túy/);
    assert.equal((await lastLedger(children.secondary)).release_reason, 'Kiểm duyệt: câu trả lời không phù hợp');

    mock.scripted.push(
      JSON.stringify({ step: 'refusal', topic: '', reply: 'Gia sư chỉ giúp em học bài thôi nhé.', final_answer: '' }),
    );
    const offTopic = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Kể chuyện cười đi' });
    assert.equal(offTopic.body.turn, 'released');
    assert.equal((await lastLedger(children.secondary)).release_reason, 'Ngoài học tập');

    mock.failNext = 'Nhà cung cấp AI trả lỗi (mã 529)';
    const failed = await ask(tokens.secondary, { subject_code: 'TOAN-THCS-L2', text: 'Phân số là gì?' });
    assert.equal(failed.status, 422, JSON.stringify(failed.body));
    assert.equal((await lastLedger(children.secondary)).release_reason, 'Lỗi nhà cung cấp AI');
    const stuck = await system.selectFrom('ai_tutor_turn_ledger').select('id').where('status', '=', 'held').execute();
    assert.equal(stuck.length, 0);
  });

  it('CT-1773: câu có dấu hiệu tự hại hoặc bị bắt nạt trả lời theo mẫu có 111, ghi cờ, không gửi đi, không đưa vào lượt sau', async () => {
    const harm = await ask(tokens.secondary, { subject_code: 'VAN-THCS-L2', text: 'Em buồn quá, em muốn chết' });
    assert.equal(harm.status, 201, JSON.stringify(harm.body));
    assert.equal(harm.body.turn, 'released');
    const reply = (harm.body.messages as Array<{ step: string; body: string }>)[1];
    assert.equal(reply?.step, 'safety');
    assert.match(reply?.body ?? '', /111/);
    const conversationId = (harm.body.conversation as { id: string }).id;
    const bullying = await ask(tokens.secondary, { conversation_id: conversationId, text: 'Em bị bắt nạt ở lớp' });
    assert.equal(bullying.body.turn, 'released');
    assert.equal(mock.received.length, 0);
    const flags = await system
      .selectFrom('ai_tutor_safety_flags')
      .select(['kind', 'notified_at'])
      .where('conversation_id', '=', conversationId)
      .orderBy('created_at')
      .execute();
    // Từ lát L3 cờ được báo ngay (lớp chưa có giáo viên chủ nhiệm thì báo Ban Giám hiệu), xem CT-1785
    assert.deepEqual(
      flags.map((flag) => [flag.kind, flag.notified_at !== null]),
      [
        ['self_harm', true],
        ['bullying', true],
      ],
    );
    const next = await ask(tokens.secondary, {
      conversation_id: conversationId,
      text: 'Bài văn nghị luận gồm mấy phần?',
    });
    assert.equal(next.status, 201, JSON.stringify(next.body));
    assert.deepEqual(mock.received.at(-1)?.history ?? [], []);
  });

  it('CT-1774: hai câu hỏi đồng thời khi còn một lượt thì chỉ một câu được trả lời', async () => {
    const subscription = await subscribe(children.other, 'school', 1, 'top_up');
    const replies = await Promise.all([
      ask(tokens.other, { subject_code: 'TOAN-THCS-L2', text: 'Phân số là gì?' }),
      ask(tokens.other, { subject_code: 'TOAN-THCS-L2', text: 'Số nguyên tố là gì?' }),
    ]);
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [201, 422]);
    assert.deepEqual(await counters(subscription), { used_turns: 1, held_turns: 0, turns: 1 });
  });

  it('CT-1775: Tiểu học có lời nhắc riêng; token tách theo nguồn gói, chỉ gói trường bán vào hóa đơn dịch vụ', async () => {
    await subscribe(children.primary, 'platform', 10, 'monthly');
    const reply = await ask(tokens.primary, { subject_code: 'TOAN-TH-L2', text: 'Phép cộng có nhớ là gì?' });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const system_ = mock.received.at(-1)?.system ?? '';
    assert.match(system_, /Tiểu học, lớp 3, môn Toán/);
    assert.match(system_, /Viết câu ngắn/);
    assert.match(system_, /chia kẹo/);

    const tenant = await environment.tenantOf('alpha');
    await runAsSchool(tenant, () => environment.api.get(AiAssistantService).syncUsage());
    const platform = environment.platform.platform;
    const usage = await platform
      .selectFrom('ai_token_usage')
      .select(['config', 'requests', 'input_tokens', 'output_tokens'])
      .where('school_id', '=', tenant.schoolId)
      .execute();
    const byConfig = (config: string) => usage.filter((row) => row.config === config);
    assert.ok(byConfig('tutor_school').length > 0);
    assert.equal(
      byConfig('tutor_platform').reduce((sum, row) => sum + row.requests, 0),
      1,
    );
    assert.equal(byConfig('platform').length, 0);
    const [platformMessage] = await system
      .selectFrom('ai_tutor_messages')
      .innerJoin('ai_tutor_turn_ledger', 'ai_tutor_turn_ledger.id', 'ai_tutor_messages.ledger_entry_id')
      .innerJoin('ai_tutor_subscriptions', 'ai_tutor_subscriptions.id', 'ai_tutor_turn_ledger.subscription_id')
      .select(['ai_tutor_messages.input_tokens', 'ai_tutor_messages.output_tokens'])
      .where('ai_tutor_subscriptions.plan_source', '=', 'platform')
      .execute();
    assert.equal(Number(byConfig('tutor_platform')[0]?.input_tokens), platformMessage?.input_tokens);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const billed = await aiUsageBetween(platform, tenant.schoolId, today, today, 'tutor_school');
    const charges = computeAiCharges(
      { freeTokens: 0, inputPricePer1k: 10, outputPricePer1k: 20, modelPrices: {}, minimumFee: 0, roundingStep: 1 },
      billed.map((item) => ({ ...item, label: 'Gia sư AI học sinh' })),
    );
    assert.ok(charges.lines.length > 0);
    assert.match(charges.lines[0]?.description ?? '', /^Gia sư AI học sinh, mô hình mo-hinh-thu/);
    const notBilled = await aiUsageBetween(platform, tenant.schoolId, today, today, 'platform');
    assert.equal(notBilled.length, 0);
  });

  it('CT-1776: em chỉ thấy hội thoại của mình; cha mẹ chỉ thấy chủ đề và số lượt; giáo viên, phụ huynh khác không thấy', async () => {
    const mine = await student(tokens.secondary, 'GET', '');
    const conversations = mine.body.conversations as Array<{ id: string }>;
    assert.ok(conversations.length > 0);
    const target = conversations[0]?.id as string;
    assert.equal((await student(tokens.other, 'GET', `/conversations/${target}`)).status, 404);
    const otherList = (await student(tokens.other, 'GET', '')).body.conversations as Array<{ id: string }>;
    assert.ok(!otherList.some((item) => item.id === target));
    const thread = await student(tokens.secondary, 'GET', `/conversations/${target}`);
    const tutorMessage = (thread.body.messages as Array<{ id: string; role: string; step: string }>).find(
      (message) => message.role === 'tutor' && message.step !== 'safety',
    );
    assert.ok(tutorMessage);
    assert.equal((await student(tokens.other, 'POST', `/messages/${tutorMessage.id}/report`, {})).status, 404);
    const reported = await student(tokens.secondary, 'POST', `/messages/${tutorMessage.id}/report`, {
      note: 'Sai dấu',
    });
    assert.equal(reported.status, 200, JSON.stringify(reported.body));
    const studentMessage = (thread.body.messages as Array<{ id: string; role: string }>).find(
      (message) => message.role === 'student',
    );
    assert.equal((await student(tokens.secondary, 'POST', `/messages/${studentMessage?.id}/report`, {})).status, 404);

    const topics = await environment.call(
      'alpha',
      'GET',
      `/children/${children.secondary}/ai-tutor/topics`,
      undefined,
      tokens.parent,
    );
    assert.equal(topics.status, 200, JSON.stringify(topics.body));
    const rows = topics.body.topics as Array<Record<string, unknown>>;
    assert.ok(rows.some((row) => row.topic === 'Phương trình bậc nhất một ẩn' && Number(row.turns) > 0));
    assert.ok(rows.every((row) => !('body' in row) && !('messages' in row)));
    assert.ok(Number(topics.body.turns_this_month) > 0);
    for (const token of [tokens.otherParent, tokens.teacher]) {
      const denied = await environment.call(
        'alpha',
        'GET',
        `/children/${children.secondary}/ai-tutor/topics`,
        undefined,
        token,
      );
      assert.equal(denied.status, 403, JSON.stringify(denied.body));
    }
    // Mã phiên học sinh không gọi được điểm cuối của cha mẹ; mã phiên cha mẹ, giáo viên không gọi được điểm cuối của em
    assert.equal(
      (
        await environment.call(
          'alpha',
          'GET',
          `/children/${children.secondary}/ai-tutor/topics`,
          undefined,
          tokens.secondary,
        )
      ).status,
      403,
    );
    assert.equal((await student(tokens.parent, 'GET', '')).status, 403);
    assert.equal((await student(tokens.teacher, 'GET', `/conversations/${target}`)).status, 403);
  });

  it('CT-1776: việc nền xóa lịch sử quá 12 tháng và hoàn lượt tạm giữ quá hạn', async () => {
    const tenant = await environment.tenantOf('alpha');
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const conversation = await system
      .insertInto('ai_tutor_conversations')
      .values({
        child_id: children.secondary,
        school_level: 'THCS',
        grade_level_code: 'K8',
        subject_code: 'TOAN-THCS-L2',
        subject_name: 'Toán',
        topic: 'Chủ đề cũ',
        created_at: old,
        last_message_at: old,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await system
      .insertInto('ai_tutor_messages')
      .values({
        conversation_id: conversation.id,
        role: 'student',
        body: 'Câu cũ',
        request_kind: 'ask',
        created_at: old,
      })
      .execute();
    const subscriptionId = (
      await system
        .selectFrom('ai_tutor_subscriptions')
        .select('id')
        .where('child_id', '=', children.secondary)
        .executeTakeFirstOrThrow()
    ).id;
    await system
      .updateTable('ai_tutor_subscriptions')
      .set((expression) => ({ held_turns: expression('held_turns', '+', 1) }))
      .where('id', '=', subscriptionId)
      .execute();
    await system
      .insertInto('ai_tutor_turn_ledger')
      .values({
        child_id: children.secondary,
        subscription_id: subscriptionId,
        status: 'held',
        held_at: new Date(Date.now() - 60 * 60 * 1000),
      })
      .execute();
    const result = await runAsSchool(tenant, () => environment.api.get(AiTutorChatService).maintain());
    assert.equal(result.released, 1);
    assert.equal(result.purged, 1);
    const gone = await system
      .selectFrom('ai_tutor_conversations')
      .select('id')
      .where('id', '=', conversation.id)
      .executeTakeFirst();
    assert.equal(gone, undefined);
    const recent = await system
      .selectFrom('ai_tutor_conversations')
      .select('id')
      .where('child_id', '=', children.secondary)
      .execute();
    assert.ok(recent.length > 0);
  });
});
