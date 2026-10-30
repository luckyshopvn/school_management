import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  savePlatformAiKey,
  savePlatformAiSettings,
  type IdentityDatabase,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { createTestUser, TEST_PASSWORD } from '@school-management/identity/testing';
import { runAsSchool } from '@school-management/server';
import type { Kysely } from 'kysely';
import { AI_PROVIDERS } from '../ai-assistant/ai-assistant.js';
import { MOCK_IMAGE_TOKENS, type AiProviderRegistry, type MockAiProvider } from '../ai-assistant/ai-provider.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { FileStorage, type MemoryFileStorage } from '../files/file-storage.js';
import type { TenantFileStorage } from '../school-settings/tenant-connectors.js';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import { activateAiTutorSubscription, createAiTutorSubscription } from './ai-tutor-turns.js';
import { AiTutorChatService } from './tutor-chat.js';
import { IMAGE_MAX_BYTES } from './tutor-images.js';

// Ảnh bài tập gửi gia sư AI (YCTD-383 lát L4), kịch bản CT-1941 đến CT-1946: gói Cơ bản bị từ chối không trừ lượt; gói Nâng cao gửi được,
// ảnh tới bộ giả lập, token tính theo nguồn gói; sai loại, quá cỡ, quá số ảnh; ảnh có thông tin cá nhân thì không lưu, hoàn lượt; việc nền
// xóa ảnh 29/30/31 ngày; phân quyền xem ảnh (em khác, cha mẹ, giáo viên). Chỉ bộ giả lập nhà cung cấp; ảnh là byte giả, họ tên bịa
const segment = (marker: number, payload: Buffer) => {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
};

function sampleJpeg(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    segment(0xe1, Buffer.from('Exif\0\0TOA-DO-GPS-THU', 'latin1')),
    segment(0xdb, Buffer.alloc(65, 1)),
    segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0x56, 0xff, 0xd9]),
  ]);
}

interface RawReply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

describe('Gia sư AI: ảnh bài tập', () => {
  let environment: MultiTenantApi;
  let mock: MockAiProvider;
  let system: Kysely<SystemDatabase>;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let memory: MemoryFileStorage;
  const tokens = { advanced: '', basic: '', other: '', parent: '', teacher: '' };
  const children = { advanced: '', basic: '', other: '' };

  function raw(token: string, method: string, path: string, body?: Buffer, contentType?: string): Promise<RawReply> {
    const url = new URL(`${environment.apiOrigin}/api/v1${path}`);
    return new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method,
          headers: {
            host: environment.hosts.alpha,
            authorization: `Bearer ${token}`,
            ...(contentType ? { 'content-type': contentType, 'content-length': String(body?.length ?? 0) } : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
          );
        },
      );
      request.on('error', reject);
      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  // Câu hỏi kèm ảnh gửi dạng nhiều phần như ứng dụng học sinh
  async function askWithImages(
    token: string,
    fields: Record<string, string>,
    images: Array<{ body: Buffer; name: string }>,
  ) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    for (const image of images) {
      form.append('images', new Blob([new Uint8Array(image.body)]), image.name);
    }
    const encoded = new Request('http://may-chu-thu', { method: 'POST', body: form });
    const reply = await raw(
      token,
      'POST',
      '/student/ai-tutor/messages',
      Buffer.from(await encoded.arrayBuffer()),
      encoded.headers.get('content-type') ?? '',
    );
    const text = reply.body.toString('utf8');
    return { status: reply.status, body: (text ? JSON.parse(text) : {}) as Record<string, unknown> };
  }

  async function login(username: string, channel: 'student' | 'parent' | 'teacher'): Promise<string> {
    const reply = await sendWithHost(environment.identityOrigin, {
      path: '/api/v1/auth/login',
      host: environment.hosts.alpha,
      body: { login: username, password: TEST_PASSWORD, channel },
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply.body.access_token as string;
  }

  async function subscribe(childId: string, source: 'school' | 'platform', allowImages: boolean) {
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
          kind: 'monthly',
          name: allowImages ? 'Nâng cao thử' : 'Cơ bản thử',
          price: allowImages ? 149000 : 79000,
          turns: 20,
          allowImages,
          schoolLevels: ['TH', 'THCS', 'THPT'],
          status: 'active',
        },
        periodMonth: month,
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
      .select(['used_turns', 'held_turns'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
  const ledgerCount = async (childId: string) =>
    (await system.selectFrom('ai_tutor_turn_ledger').select('id').where('child_id', '=', childId).execute()).length;
  // Số tệp đang có ở kho trong bộ nhớ của kiểm thử
  const storedFiles = () => (memory as unknown as { objects: Map<string, Buffer> }).objects.size;
  const imageRows = (childId: string) =>
    system.selectFrom('ai_tutor_message_images').selectAll().where('child_id', '=', childId).execute();

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
      .values({ code: 'TOAN-THCS-L4', name: 'Toán', school_level: 'THCS' })
      .execute();
    const relationship = await schoolYear
      .insertInto('catalog_items')
      .values({ catalog_type: 'parent_relationship', code: 'ME', name: 'Mẹ' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const parentUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-14', orgUnitId: unitId }] });
    const teacherUser = await createTestUser(identity, { roles: [{ roleCode: 'VT-07', orgUnitId: unitId }] });
    const guardian = await schoolYear
      .insertInto('guardians')
      .values({ full_name: 'Trần Thị Mẫu Ảnh', phone: '0900000483', user_id: parentUser.id })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [key, code, name] of [
      ['advanced', '8A', 'Nguyễn Văn Ảnh Thử'],
      ['basic', '8B', 'Phạm Thị Chữ Thử'],
      ['other', '8C', 'Đỗ Minh Khác Thử'],
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
      if (key === 'advanced') {
        await schoolYear
          .insertInto('child_guardians')
          .values({
            child_id: child.id,
            guardian_id: guardian.id,
            relationship_item_id: relationship.id,
            is_primary: true,
          })
          .execute();
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
    tokens.teacher = await login(teacherUser.username, 'teacher');
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gsai_l4', configuration: { aiMock: true } });
    mock = (environment.api.get(AI_PROVIDERS) as AiProviderRegistry).get('mock') as MockAiProvider;
    memory = (environment.api.get(FileStorage) as TenantFileStorage).deploymentStorage() as MemoryFileStorage;
    const platform = environment.platform.platform;
    await savePlatformAiKey(
      platform,
      environment.platform.masterKey,
      { enabled: true, apiKey: 'khoa-gia-lap-gsai-l4' },
      { type: 'system' },
    );
    await savePlatformAiSettings(
      platform,
      { provider: 'mock', model: 'mo-hinh-thu', endpoint: null },
      { type: 'system' },
    );
    await prepareSchool();
    // Khung giờ khóa của lát L3 đặt cách giờ chạy kiểm thử sáu tiếng để ca không phụ thuộc giờ chạy
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

  it('CT-1941: gói Cơ bản gửi ảnh bị từ chối trước khi giữ lượt, không trừ lượt, không gọi nhà cung cấp', async () => {
    const subscription = await subscribe(children.basic, 'school', false);
    const overview = await environment.call('alpha', 'GET', '/student/ai-tutor', undefined, tokens.basic);
    assert.equal(overview.status, 200, JSON.stringify(overview.body));
    assert.equal((overview.body.images as { allowed: boolean }).allowed, false);
    const reply = await askWithImages(tokens.basic, { subject_code: 'TOAN-THCS-L4', text: 'Gợi ý giúp em bài này' }, [
      { body: sampleJpeg(), name: 'bai.jpg' },
    ]);
    assert.equal(reply.status, 422, JSON.stringify(reply.body));
    const error = reply.body.error as { message: string; rule_code?: string };
    assert.match(error.message, /chỉ có ở gói Nâng cao/);
    assert.match(error.message, /không bị trừ/);
    assert.equal(await ledgerCount(children.basic), 0);
    assert.deepEqual(await counters(subscription), { used_turns: 0, held_turns: 0 });
    assert.equal(mock.received.length, 0);
    // Gõ chữ vẫn hỏi được bình thường
    const text = await environment.call(
      'alpha',
      'POST',
      '/student/ai-tutor/messages',
      { subject_code: 'TOAN-THCS-L4', text: 'Giải giúp em phương trình 3x - 7 = 2x + 5' },
      tokens.basic,
    );
    assert.equal(text.status, 201, JSON.stringify(text.body));
  });

  it('CT-1942: gói Nâng cao gửi ảnh được: ảnh đã bỏ siêu dữ liệu tới bộ giả lập, lưu ở kho tệp, trừ một lượt, token gồm ảnh', async () => {
    const subscription = await subscribe(children.advanced, 'platform', true);
    const overview = await environment.call('alpha', 'GET', '/student/ai-tutor', undefined, tokens.advanced);
    assert.deepEqual(overview.body.images, {
      allowed: true,
      max_count: 3,
      max_bytes: IMAGE_MAX_BYTES,
      retention_days: 30,
    });
    const reply = await askWithImages(tokens.advanced, { subject_code: 'TOAN-THCS-L4', text: '' }, [
      { body: sampleJpeg(), name: 'bai-1.jpg' },
      { body: sampleJpeg(), name: 'bai-2.jpg' },
    ]);
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.turn, 'captured');
    assert.deepEqual(await counters(subscription), { used_turns: 1, held_turns: 0 });
    const prompt = mock.received[0];
    assert.equal(prompt?.images?.length, 2);
    assert.equal(prompt?.images?.[0]?.mediaType, 'image/jpeg');
    assert.doesNotMatch(prompt?.images?.[0]?.data.toString('latin1') ?? '', /Exif|TOA-DO-GPS/);
    assert.match(prompt?.system ?? '', /^ANH: /m);
    assert.equal(mock.keysSeen.at(-1), 'khoa-gia-lap-gsai-l4');
    const messages = reply.body.messages as Array<{
      role: string;
      body: string;
      image_text: string | null;
      images: Array<{ id: string; deleted: boolean }>;
    }>;
    assert.equal(messages[0]?.body, 'Em gửi ảnh bài tập, nhờ gia sư gợi ý.');
    assert.equal(messages[0]?.image_text, 'Giải phương trình 3x - 7 = 2x + 5');
    assert.equal(messages[0]?.images.length, 2);
    assert.equal(messages[0]?.images[0]?.deleted, false);
    const rows = await imageRows(children.advanced);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.ok(row.storage_key && memory.has(row.storage_key));
      assert.match(row.storage_key ?? '', /ai-tutor-images/);
    }
    const stored = await system
      .selectFrom('ai_tutor_messages')
      .select(['input_tokens'])
      .where('role', '=', 'tutor')
      .where('ledger_entry_id', 'is not', null)
      .orderBy('created_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.ok((stored.input_tokens ?? 0) >= 2 * MOCK_IMAGE_TOKENS);
    // Em xem lại ảnh của mình
    const image = await raw(tokens.advanced, 'GET', `/student/ai-tutor/images/${messages[0]?.images[0]?.id}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers['content-type'], 'image/jpeg');
    assert.equal(image.headers['cache-control'], 'no-store');
    assert.equal(image.body[0], 0xff);
    // Lượt sau không gửi lại ảnh, chỉ gửi đề đã chép
    mock.received.length = 0;
    const conversationId = (reply.body.conversation as { id: string }).id;
    const next = await environment.call(
      'alpha',
      'POST',
      '/student/ai-tutor/messages',
      { conversation_id: conversationId, text: 'Em chuyển vế được x = 5 + 7' },
      tokens.advanced,
    );
    assert.equal(next.status, 201, JSON.stringify(next.body));
    assert.equal(mock.received[0]?.images, undefined);
    assert.match(mock.received[0]?.history?.[0]?.content ?? '', /Đề bài trong ảnh em đã gửi: Giải phương trình/);
    const thread = await environment.call(
      'alpha',
      'GET',
      `/student/ai-tutor/conversations/${conversationId}`,
      undefined,
      tokens.advanced,
    );
    assert.equal((thread.body.messages as Array<{ images: unknown[] }>)[0]?.images.length, 2);
  });

  it('CT-1943: sai loại, quá số ảnh, quá cỡ bị từ chối, không giữ lượt', async () => {
    const before = await ledgerCount(children.advanced);
    const gif = await askWithImages(tokens.advanced, { subject_code: 'TOAN-THCS-L4', text: 'Bài này' }, [
      { body: Buffer.from('GIF89a-anh-dong-thu', 'latin1'), name: 'bai.gif' },
    ]);
    assert.equal(gif.status, 400, JSON.stringify(gif.body));
    assert.match(JSON.stringify(gif.body), /JPEG, PNG hoặc WebP/);
    const many = await askWithImages(
      tokens.advanced,
      { subject_code: 'TOAN-THCS-L4', text: 'Bài này' },
      Array.from({ length: 4 }, (_, index) => ({ body: sampleJpeg(), name: `bai-${index}.jpg` })),
    );
    assert.equal(many.status, 400, JSON.stringify(many.body));
    assert.match(JSON.stringify(many.body), /tối đa 3 ảnh/);
    const big = await askWithImages(tokens.advanced, { subject_code: 'TOAN-THCS-L4', text: 'Bài này' }, [
      { body: Buffer.concat([sampleJpeg(), Buffer.alloc(IMAGE_MAX_BYTES)]), name: 'to.jpg' },
    ]);
    assert.equal(big.status, 400, JSON.stringify(big.body));
    assert.match(JSON.stringify(big.body), /vượt dung lượng/);
    const solution = await askWithImages(tokens.advanced, { mode: 'solution', conversation_id: randomUUID() }, [
      { body: sampleJpeg(), name: 'bai.jpg' },
    ]);
    assert.equal(solution.status, 400, JSON.stringify(solution.body));
    assert.equal(await ledgerCount(children.advanced), before);
    assert.equal(mock.received.length, 0);
  });

  it('CT-1944: ảnh có thông tin cá nhân thì không lưu ảnh, không hiện câu trả lời, hoàn lượt, nhắc em', async () => {
    const before = (await imageRows(children.advanced)).length;
    const storedBefore = storedFiles();
    for (const scripted of [
      {
        step: 'concept',
        topic: 'Bài',
        reply: 'Em thử nhé',
        final_answer: '',
        image_text: 'Đề bài',
        personal_data: true,
      },
      {
        step: 'concept',
        topic: 'Bài',
        reply: 'Em thử nhé',
        final_answer: '',
        image_text: 'Họ tên: Nguyễn Văn Ảnh Thử, điện thoại 0912345678. Giải phương trình',
        personal_data: false,
      },
    ]) {
      mock.scripted.push(JSON.stringify(scripted));
      const reply = await askWithImages(tokens.advanced, { subject_code: 'TOAN-THCS-L4', text: 'Gợi ý giúp em' }, [
        { body: sampleJpeg(), name: 'bai.jpg' },
      ]);
      assert.equal(reply.status, 201, JSON.stringify(reply.body));
      assert.equal(reply.body.turn, 'released');
      const messages = reply.body.messages as Array<{ body: string; images: unknown[]; image_text: string | null }>;
      assert.match(messages[1]?.body ?? '', /thông tin cá nhân/);
      assert.equal(messages[0]?.images.length, 0);
      assert.equal(messages[0]?.image_text, null);
      assert.doesNotMatch(JSON.stringify(reply.body), /0912345678|Nguyễn Văn Ảnh Thử/);
    }
    assert.equal((await imageRows(children.advanced)).length, before);
    assert.equal(storedFiles(), storedBefore);
  });

  it('CT-1945: việc nền xóa ảnh từ đủ 30 ngày: 29 ngày giữ, 30 và 31 ngày xóa tệp và khóa tệp, tin nhắn ghi đã xóa', async () => {
    const tenant = await environment.tenantOf('alpha');
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const message = await system
      .selectFrom('ai_tutor_messages')
      .innerJoin('ai_tutor_conversations', 'ai_tutor_conversations.id', 'ai_tutor_messages.conversation_id')
      .select(['ai_tutor_messages.id', 'ai_tutor_conversations.id as conversation_id'])
      .where('ai_tutor_conversations.child_id', '=', children.advanced)
      .where('ai_tutor_messages.role', '=', 'student')
      .executeTakeFirstOrThrow();
    const ids: Record<number, string> = {};
    for (const age of [29, 30, 31]) {
      const key = `kiem-thu/ai-tutor-images/${randomUUID()}`;
      await memory.put(key, sampleJpeg());
      const row = await system
        .insertInto('ai_tutor_message_images')
        .values({
          message_id: message.id,
          child_id: children.advanced,
          position: 10 + age,
          storage_key: key,
          content_type: 'image/jpeg',
          size_bytes: 10,
          created_at: new Date(now.getTime() - age * day),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ids[age] = row.id;
    }
    const keyOf = async (id: string) =>
      system
        .selectFrom('ai_tutor_message_images')
        .select(['storage_key', 'deleted_at'])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
    const oldKeys = {
      30: (await keyOf(ids[30] as string)).storage_key,
      31: (await keyOf(ids[31] as string)).storage_key,
    };
    const deleted = await runAsSchool(tenant, () => environment.api.get(AiTutorChatService).purgeImages(now));
    assert.equal(deleted, 2);
    const kept = await keyOf(ids[29] as string);
    assert.ok(kept.storage_key && memory.has(kept.storage_key));
    assert.equal(kept.deleted_at, null);
    for (const age of [30, 31] as const) {
      const row = await keyOf(ids[age] as string);
      assert.equal(row.storage_key, null);
      assert.ok(row.deleted_at);
      assert.equal(memory.has(oldKeys[age] as string), false);
    }
    const thread = await environment.call(
      'alpha',
      'GET',
      `/student/ai-tutor/conversations/${message.conversation_id}`,
      undefined,
      tokens.advanced,
    );
    const images = (
      thread.body.messages as Array<{ images: Array<{ id: string; deleted: boolean; deleted_label: string }> }>
    )
      .flatMap((item) => item.images)
      .filter((image) => image.id === ids[30]);
    assert.deepEqual(
      images.map((image) => [image.deleted, image.deleted_label]),
      [[true, 'Ảnh đã xóa sau 30 ngày']],
    );
    const gone = await raw(tokens.advanced, 'GET', `/student/ai-tutor/images/${ids[30]}`);
    assert.equal(gone.status, 404);
    assert.match(gone.body.toString('utf8'), /Ảnh đã xóa sau 30 ngày/);
    // Lần chạy sau không xóa lại
    assert.equal(await runAsSchool(tenant, () => environment.api.get(AiTutorChatService).purgeImages(now)), 0);
  });

  it('CT-1946: em khác, cha mẹ, giáo viên không lấy được ảnh; cha mẹ không thấy ảnh trong chủ đề', async () => {
    const row = (await imageRows(children.advanced)).find((image) => image.storage_key !== null);
    assert.ok(row);
    const path = `/student/ai-tutor/images/${row.id}`;
    const other = await raw(tokens.other, 'GET', path);
    assert.equal(other.status, 404);
    const parent = await raw(tokens.parent, 'GET', path);
    assert.ok([401, 403].includes(parent.status), String(parent.status));
    const teacher = await raw(tokens.teacher, 'GET', path);
    assert.ok([401, 403].includes(teacher.status), String(teacher.status));
    // Ảnh không nằm ở bảng tệp chung nên điểm cuối tệp chung không trả ảnh
    const files = await raw(tokens.teacher, 'GET', `/files/${row.id}`);
    assert.equal(files.status, 404);
    const topics = await environment.call(
      'alpha',
      'GET',
      `/children/${children.advanced}/ai-tutor/topics`,
      undefined,
      tokens.parent,
    );
    assert.equal(topics.status, 200, JSON.stringify(topics.body));
    assert.doesNotMatch(JSON.stringify(topics.body), /image|ảnh|Giải phương trình 3x/);
  });
});
