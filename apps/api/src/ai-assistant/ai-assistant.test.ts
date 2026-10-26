import assert from 'node:assert/strict';
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
import { AI_PROVIDERS, AiAssistantService } from './ai-assistant.js';
import { MockAiProvider, type AiProviderRegistry } from './ai-provider.js';

// Trợ lý AI soạn câu hỏi nháp và kế hoạch bài dạy nháp (DT-23 phần 23d, YCTD-214), kịch bản CT-23d-1 đến CT-23d-6: bật tắt, khóa, quét
// dữ liệu cá nhân với chuỗi mồi, bản nháp đi qua luồng duyệt, hạn mức, nhật ký không lưu toàn văn lời nhắc. Chỉ dùng bộ giả lập `mock`,
// dữ liệu bịa; chế độ một trường
const SECRET = 'khoa-ai-thu-nghiem-1234';
const DECOYS = {
  name: 'Trần Thị Mồi Giả',
  phone: '0912 345 678',
  email: 'moi.gia@truong-gia.example',
  national: '079123456789',
};

describe('Trợ lý AI soạn nháp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let head: LoggedInUser;
  let teacher: LoggedInUser;
  let parent: LoggedInUser;
  let subjectId = '';
  let mock: MockAiProvider;
  const url = (path: string) => `${environment.baseUrl}${path}`;
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, url(path), user.accessToken, body);
  const list = (body: unknown) => body as unknown as Array<Record<string, unknown>>;
  const draftBody = (overrides: Record<string, unknown> = {}) => ({
    school_level: 'THCS',
    subject_id: subjectId,
    grade_level_code: 'K6',
    cognitive_level: 'recognition',
    question_type: 'multiple_choice',
    count: 2,
    requirement: 'Nhận biết số nguyên âm',
    ...overrides,
  });
  const lessonBody = (overrides: Record<string, unknown> = {}) => ({
    school_level: 'THCS',
    subject_code: 'THCS-TOAN',
    grade_level_code: 'K6',
    topic_text: 'Phép cộng số nguyên',
    duration_minutes: 45,
    ...overrides,
  });
  const enable = async (settings: Record<string, unknown> = {}) =>
    api('PUT', '/ai/settings', principal, {
      enabled: true,
      key_mode: 'school',
      provider: 'mock',
      per_user_daily_requests: null,
      ...settings,
    });

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
      await api('POST', '/org-units', principal, {
        code: 'THCS-23D',
        name: 'Trường THCS thử',
        unit_type: 'truong_chinh',
      })
    ).body.id as string;
    const current = await api('GET', '/school-levels', principal);
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
    assert.equal((await api('PUT', '/school-levels', principal, { levels })).status, 200);
    assert.equal((await api('POST', '/grade-levels/templates', principal, { school_level: 'THCS' })).status, 200);
    const subject = await api('POST', '/subjects', principal, {
      school_level: 'THCS',
      code: 'THCS-TOAN',
      name: 'Toán',
      kind: 'subject',
      assessment: 'comment_and_score',
    });
    assert.equal(subject.status, 201, JSON.stringify(subject.body));
    subjectId = subject.body.id as string;
    head = await environment.loginAs('VT-17', unitId);
    teacher = await environment.loginAs('VT-08', unitId);
    parent = await environment.loginAs('VT-14', unitId);
    // Chuỗi mồi: một cán bộ có tên đầy đủ trong danh sách của trường
    await schoolYear
      .insertInto('staff')
      .values({ org_unit_id: unitId, code: 'NV-MOI', full_name: DECOYS.name, start_date: '2026-09-01' })
      .execute();
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-23d-1: mặc định tắt; thiếu khóa thì lỗi rõ ràng; bật rồi nhập khóa thì sẵn sàng, khóa không bị lộ', async () => {
    const before = await api('GET', '/ai/status', teacher);
    assert.equal(before.status, 200);
    assert.equal(before.body.ready, false);
    assert.match(String(before.body.reason), /chưa bật/);
    const off = await api('POST', '/ai/question-drafts', teacher, draftBody());
    assert.equal(off.status, 422);
    assert.equal(off.body.error?.rule_code, 'YCTD-214');
    assert.equal(mock.received.length, 0, 'tắt thì không gọi nhà cung cấp');

    assert.equal((await api('PUT', '/ai/settings', teacher, {})).status, 403);
    assert.equal((await api('GET', '/ai/status', parent)).status, 403);
    assert.equal((await enable()).status, 200);
    const noKey = await api('POST', '/ai/question-drafts', teacher, draftBody());
    assert.equal(noKey.status, 422);
    assert.match(String(noKey.body.error?.message), /khóa AI/);

    const saved = await api('PUT', '/school-settings/integrations/ai', principal, {
      enabled: true,
      values: { api_key: SECRET },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.ok(!JSON.stringify(saved.body).includes(SECRET));
    const status = await api('GET', '/ai/status', principal);
    assert.equal(status.body.ready, true);
    assert.ok(JSON.stringify(status.body).includes('••••1234'));
    assert.ok(!JSON.stringify(status.body).includes(SECRET));
    const forTeacher = await api('GET', '/ai/status', teacher);
    assert.deepEqual(Object.keys(forTeacher.body).sort(), ['enabled', 'ready', 'reason']);

    const check = await api('POST', '/ai/check', principal);
    assert.equal(check.status, 200, JSON.stringify(check.body));
    assert.match(String(check.body.detail), /••••1234/);
    assert.equal(mock.keysSeen.at(-1), SECRET);

    assert.equal((await enable({ provider: 'khong-co' })).status, 400);
    assert.equal(
      (await enable({ key_mode: 'platform' })).status,
      422,
      'một trường không có cấu hình nền tảng cấp khóa',
    );
  });

  it('CT-23d-2: soạn câu hỏi nháp: vào ngân hàng ở trạng thái nháp với cờ do AI soạn; lời nhắc chỉ có nội dung chương trình', async () => {
    const before = mock.received.length;
    const created = await api('POST', '/ai/question-drafts', teacher, draftBody());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const questions = list(created.body.questions);
    assert.equal(questions.length, 2);
    for (const question of questions) {
      assert.equal(question.status, 'draft');
      assert.equal(question.ai_generated, true);
      assert.equal(question.author_user_id, teacher.userId);
    }
    assert.equal(mock.received.length, before + 1);
    const prompt = mock.received.at(-1);
    assert.ok(prompt);
    assert.match(prompt.user, /^CAP_HOC: THCS$/m);
    assert.match(prompt.user, /^MON: Toán$/m);
    assert.match(prompt.user, /^YEU_CAU_CAN_DAT: Nhận biết số nguyên âm$/m);
    assert.ok(!prompt.user.includes(teacher.userId), 'không đưa mã người dùng vào lời nhắc');
    // Câu AI soạn hiện ở danh sách của người soạn nhưng không dùng được trong đề (chưa duyệt)
    const own = list((await api('GET', '/questions?status=draft', teacher)).body);
    assert.ok(own.some((row) => row.id === questions[0]?.id && row.ai_generated === true));
    const approvedList = list((await api('GET', '/questions?status=approved', teacher)).body);
    assert.ok(!approvedList.some((row) => row.id === questions[0]?.id));
    // Dạng câu khác cũng đọc được
    for (const type of ['true_false', 'short_answer', 'essay']) {
      const result = await api('POST', '/ai/question-drafts', teacher, draftBody({ question_type: type, count: 1 }));
      assert.equal(result.status, 201, `${type}: ${JSON.stringify(result.body)}`);
    }
    assert.equal((await api('POST', '/ai/question-drafts', teacher, draftBody({ count: 11 }))).status, 400);
    assert.equal((await api('POST', '/ai/question-drafts', parent, draftBody())).status, 403);
  });

  it('CT-23d-3: chuỗi mồi (tên, số điện thoại, thư điện tử, số định danh) bị chặn, bộ giả lập không nhận được', async () => {
    const received = mock.received.length;
    const attempts: Array<[string, Record<string, unknown>]> = [
      ['tên cán bộ', { extra: `Ra đề cho cô ${DECOYS.name} dạy lớp 6A` }],
      ['tên không dấu, khác hoa thường', { requirement: 'tran thi MOI gia soạn' }],
      ['số điện thoại', { extra: `Liên hệ ${DECOYS.phone} nếu cần` }],
      ['thư điện tử', { topic_text: `Gửi ${DECOYS.email}` }],
      ['số định danh', { extra: `CCCD ${DECOYS.national}` }],
      ['mã học sinh', { extra: 'Học sinh HS20260123 làm bài' }],
    ];
    for (const [label, overrides] of attempts) {
      const result = await api('POST', '/ai/question-drafts', teacher, draftBody(overrides));
      assert.equal(result.status, 422, `${label}: ${JSON.stringify(result.body)}`);
      assert.equal(result.body.error?.rule_code, 'YCTD-214');
      assert.ok(!JSON.stringify(result.body).includes(DECOYS.name), 'thông báo không nhắc lại tên đã nhập');
    }
    const lesson = await api('POST', '/ai/lesson-plan-drafts', teacher, lessonBody({ extra: `Cô ${DECOYS.name}` }));
    assert.equal(lesson.status, 422);
    assert.equal(mock.received.length, received, 'không yêu cầu nào bị chặn lọt tới nhà cung cấp');
    // Mọi lời nhắc đã nhận trong cả bộ kiểm thử không chứa chuỗi mồi nào
    const everything = JSON.stringify(mock.received);
    for (const decoy of Object.values(DECOYS)) {
      assert.ok(!everything.includes(decoy), `lời nhắc không được chứa ${decoy}`);
    }
    // Yêu cầu sạch vẫn đi qua; số có ít chữ số (năm, số thứ tự) không bị coi là số định danh
    const clean = await api('POST', '/ai/question-drafts', teacher, draftBody({ extra: 'Bài 12 trang 2026, 3 câu' }));
    assert.equal(clean.status, 201, JSON.stringify(clean.body));
    const log = list((await api('GET', '/ai/requests?status=rejected', principal)).body);
    assert.ok(log.length >= attempts.length + 1);
    assert.ok(!JSON.stringify(log).includes(DECOYS.name));
  });

  it('CT-23d-4: câu do AI soạn chỉ được duyệt sau khi gửi thẩm định và do người khác duyệt', async () => {
    const created = await api('POST', '/ai/question-drafts', head, draftBody({ count: 1 }));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = list(created.body.questions)[0]?.id as string;
    const early = await api('POST', `/questions/${id}/review`, principal, { decision: 'approve' });
    assert.equal(early.status, 422, 'chưa gửi thẩm định thì chưa duyệt được');
    assert.equal((await api('POST', `/questions/${id}/submit`, head)).status, 200);
    const self = await api('POST', `/questions/${id}/review`, head, { decision: 'approve' });
    assert.equal(self.status, 422, 'người yêu cầu AI không tự duyệt');
    const approved = await api('POST', `/questions/${id}/review`, principal, { decision: 'approve' });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    assert.equal(approved.body.ai_generated, true, 'cờ do AI soạn giữ vĩnh viễn');
    assert.ok(list((await api('GET', '/questions?status=approved', teacher)).body).some((row) => row.id === id));
    // Trả lại thì không cần điều kiện trên
    const second = await api('POST', '/ai/question-drafts', head, draftBody({ count: 1 }));
    const secondId = list(second.body.questions)[0]?.id as string;
    const returned = await api('POST', `/questions/${secondId}/review`, principal, {
      decision: 'return',
      note: 'Sai đáp án',
    });
    assert.equal(returned.status, 200);
  });

  it('CT-23d-5: kế hoạch bài dạy nháp vào kho học liệu ở trạng thái nháp riêng tư, phải qua gửi duyệt mới chia sẻ', async () => {
    const created = await api('POST', '/ai/lesson-plan-drafts', teacher, lessonBody());
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const resource = created.body.resource as Record<string, unknown>;
    assert.equal(resource.ai_generated, true);
    assert.equal(resource.status, 'draft');
    assert.equal(resource.visibility, 'private');
    assert.equal(resource.owner_user_id, teacher.userId);
    const detail = await api('GET', `/learning-resources/${resource.id as string}`, teacher);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    const versions = list(detail.body.versions);
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?.content_type, 'text/markdown');
    // Người khác không thấy bản nháp riêng tư
    assert.equal((await api('GET', `/learning-resources/${resource.id as string}`, head)).status, 404);
    // Chưa điền giấy phép thì chưa gửi duyệt được
    const submit = await api('POST', `/learning-resources/${resource.id as string}/submit`, teacher);
    assert.equal(submit.status, 422, JSON.stringify(submit.body));
    const bad = await api('POST', '/ai/lesson-plan-drafts', teacher, lessonBody({ subject_code: 'KHONG-CO' }));
    assert.equal(bad.status, 400);
  });

  it('CT-23d-6: hạn mức mỗi người mỗi ngày chặn ở máy chủ; nhật ký có token, mã băm, không có toàn văn lời nhắc; lỗi nhà cung cấp', async () => {
    const used = await environment.system
      .selectFrom('ai_requests')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('user_id', '=', teacher.userId)
      .where('status', 'in', ['success', 'failed'])
      .executeTakeFirstOrThrow();
    assert.equal((await enable({ per_user_daily_requests: Number(used.count) + 1 })).status, 200);
    assert.equal((await api('POST', '/ai/question-drafts', teacher, draftBody({ count: 1 }))).status, 201);
    const blocked = await api('POST', '/ai/question-drafts', teacher, draftBody({ count: 1 }));
    assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
    assert.equal(blocked.body.error?.code, 'PLAN_LIMIT_EXCEEDED');
    // Người khác không bị ảnh hưởng
    assert.equal((await api('POST', '/ai/question-drafts', head, draftBody({ count: 1 }))).status, 201);
    assert.equal((await enable({ per_user_daily_requests: null })).status, 200);

    mock.failNext = 'Lỗi giả lập của nhà cung cấp';
    const failed = await api('POST', '/ai/question-drafts', teacher, draftBody({ count: 1 }));
    assert.equal(failed.status, 422);
    assert.match(String(failed.body.error?.message), /Lỗi giả lập/);

    const rows = list((await api('GET', '/ai/requests?limit=500', principal)).body);
    const statuses = new Set(rows.map((row) => row.status));
    for (const status of ['success', 'rejected', 'blocked', 'failed']) {
      assert.ok(statuses.has(status), `thiếu nhật ký trạng thái ${status}`);
    }
    const success = rows.find((row) => row.status === 'success' && row.kind === 'questions');
    assert.ok(success);
    assert.match(String(success.prompt_sha256), /^[0-9a-f]{64}$/);
    assert.ok(Number(success.input_tokens) > 0 && Number(success.output_tokens) > 0);
    assert.equal(success.provider, 'mock');
    assert.equal(success.key_mode, 'school');
    assert.ok(!JSON.stringify(rows).includes('CAP_HOC'), 'không lưu toàn văn lời nhắc');
    assert.ok(!JSON.stringify(rows).includes(SECRET));
    const failedRow = rows.find((row) => row.status === 'failed');
    assert.equal(Number(failedRow?.input_tokens), 0, 'yêu cầu lỗi không tốn token');
    const detail = await api('GET', `/ai/requests/${success.id as string}`, principal);
    assert.equal(detail.status, 200);
    assert.equal((await api('GET', '/ai/requests', teacher)).status, 403);
  });

  it('CT-23d-7: hạn mức token theo tháng và xóa nhật ký quá hạn giữ', async () => {
    const assistant = environment.api.get(AiAssistantService);
    const usage = await assistant.monthUsage();
    assert.ok(usage.requests > 0 && usage.tokens > 0);
    // Nhật ký quá hạn giữ (14 tháng trước) bị xóa, nhật ký mới giữ nguyên
    await environment.system
      .insertInto('ai_requests')
      .values({
        user_id: teacher.userId,
        user_name: 'Giáo viên thử',
        kind: 'questions',
        status: 'success',
        key_mode: 'school',
        provider: 'mock',
        model: 'm',
        prompt_sha256: 'a'.repeat(64),
      })
      .execute();
    await environment.system
      .updateTable('ai_requests')
      .set({ created_at: new Date(Date.now() - 430 * 86_400_000) } as never)
      .where('prompt_sha256', '=', 'a'.repeat(64))
      .execute();
    const purged = await assistant.purgeExpired();
    assert.ok(purged >= 1);
    const remaining = await assistant.monthUsage();
    assert.equal(remaining.requests, usage.requests);
  });

  it('tắt AI thì các điểm cuối soạn từ chối nhưng ngân hàng câu hỏi và kho học liệu chạy như cũ', async () => {
    assert.equal(
      (await api('PUT', '/ai/settings', principal, { enabled: false, key_mode: 'school', provider: 'mock' })).status,
      200,
    );
    assert.equal((await api('POST', '/ai/question-drafts', teacher, draftBody())).status, 422);
    assert.equal((await api('GET', '/ai/status', teacher)).body.ready, false);
    assert.equal((await api('GET', '/questions', teacher)).status, 200);
    assert.equal((await api('GET', '/learning-resources', teacher)).status, 200);
  });
});
