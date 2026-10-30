import assert from 'node:assert/strict';
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { sendWithHost, startMultiTenantApi, type MultiTenantApi } from '../tenant-test-support.js';
import {
  generateMailboxSecret,
  generateSchoolTransferKeys,
  unwrapSecret,
  wrapSecret,
} from './transfer-mailbox-rules.js';

// Hộp thư chuyển trường giữa hai trường trên nền tảng, lát L2 (YCTD-390; BR-510 đến BR-514). Trường alpha gửi, beta nhận
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const nextNationalId = () =>
  `0792${String(Date.now() % 100_000).padStart(5, '0')}${String(randomInt(0, 1000)).padStart(3, '0')}`;
const ruleOf = (body: Record<string, unknown>) => (body.error as { rule_code?: string } | undefined)?.rule_code;

describe('Mật mã hộp thư chuyển trường (YCTD-390 lát L2)', () => {
  it('CT-1950: mật khẩu bọc bằng khóa của trường đến chỉ trường đến mở được', () => {
    const masterKey = Buffer.alloc(32, 7);
    const receiver = generateSchoolTransferKeys(masterKey);
    const other = generateSchoolTransferKeys(masterKey);
    const secret = generateMailboxSecret();
    assert.equal(secret.length, 32);
    const wrapped = wrapSecret(receiver.encryption_public_key, secret);
    assert.equal(unwrapSecret(masterKey, receiver, wrapped), secret);
    assert.throws(() => unwrapSecret(masterKey, other, wrapped), /không gửi cho trường này/);
    assert.ok(!receiver.encryption_private_key_encrypted.includes('PRIVATE KEY'), 'khóa riêng phải được bọc');
  });
});

describe('Hộp thư chuyển trường giữa hai trường (YCTD-390 lát L2)', () => {
  let environment: MultiTenantApi;
  const ids: Record<string, Record<string, string>> = { alpha: {}, beta: {} };

  const call = (school: string, method: string, path: string, body?: unknown) =>
    environment.call(school, method, path, body);

  // Gửi đa phần có tiêu đề Host của trường (fetch không cho đặt Host)
  async function uploadFile(school: string, fields: Record<string, string>, file: Buffer, name: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), name);
    const request = new Request('http://localhost/', { method: 'POST', body: form });
    const payload = Buffer.from(await request.arrayBuffer());
    const url = new URL(`${environment.apiOrigin}/api/v1/files`);
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const outgoing = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            host: environment.hosts[school],
            authorization: `Bearer ${environment.tokens[school]}`,
            'content-type': request.headers.get('content-type') ?? '',
            'content-length': String(payload.length),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>),
          );
        },
      );
      outgoing.on('error', reject);
      outgoing.end(payload);
    });
  }

  async function prepareSchool(school: string) {
    const created = await call(school, 'POST', '/academic-years', { name: '2026–2027' });
    const yearId = created.body.id as string;
    await call(school, 'PUT', `/academic-years/${yearId}/calendar`, {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const opened = await call(school, 'POST', `/academic-years/${yearId}/open`);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    await sendWithHost(environment.identityOrigin, {
      method: 'PUT',
      path: '/api/v1/auth/settings',
      host: environment.hosts[school],
      token: environment.tokens[school],
      body: { parent_default_password: 'PhuHuynh2026' },
    });
    await call(school, 'POST', '/org-units', { code: 'TC', name: `Trường ${school}`, unit_type: 'truong_chinh' });
    const unit = await call(school, 'POST', '/org-units', {
      code: 'DT',
      name: `Điểm ${school}`,
      unit_type: 'diem_truong',
    });
    ids[school]!.unit = unit.body.id as string;
    await call(school, 'POST', '/grade-levels', { code: 'CHOI', name: 'Chồi', age_from_months: 48, age_to_months: 59 });
    const klass = await call(school, 'POST', '/classes', {
      org_unit_id: ids[school]!.unit,
      code: 'C1',
      name: 'Lớp C1',
      grade_level: 'CHOI',
      max_size: 30,
    });
    ids[school]!.class = klass.body.id as string;
    const relation = await call(school, 'POST', '/catalog-items', {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    ids[school]!.mother = relation.body.id as string;
  }

  async function enrolAndRequestOut(fullName: string) {
    const file = await uploadFile(
      'alpha',
      { org_unit_id: ids.alpha!.unit!, purpose: 'birth_certificate' },
      PNG,
      'gks.png',
    );
    const created = await call('alpha', 'POST', '/children', {
      org_unit_id: ids.alpha!.unit,
      full_name: fullName,
      dob: '2021-05-10',
      gender: 'female',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      confirm_possible_duplicate: true,
      guardians: [
        {
          full_name: `Mẹ của ${fullName}`,
          phone: randomPhone(),
          relationship_item_id: ids.alpha!.mother,
          is_primary: true,
        },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const childId = created.body.id as string;
    assert.equal((await call('alpha', 'POST', `/children/${childId}/submit`)).status, 200);
    const approved = await call('alpha', 'POST', `/children/${childId}/approve`, {
      class_id: ids.alpha!.class,
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const requested = await call('alpha', 'POST', '/student-transfers/out', {
      child_id: childId,
      school_name: 'Trường beta',
      reason: 'Gia đình chuyển nơi ở',
    });
    assert.equal(requested.status, 201, JSON.stringify(requested.body));
    return requested.body.id as string;
  }

  before(async () => {
    environment = await startMultiTenantApi({ label: 'gct', layout: 'database' });
    await prepareSchool('alpha');
    await prepareSchool('beta');
    ids.alpha!.first = await enrolAndRequestOut('Đặng Thị Hộp');
    ids.alpha!.second = await enrolAndRequestOut('Đặng Thị Thư');
  });

  after(async () => {
    await environment.close();
  });

  it('CT-1951: mặc định tắt; chưa bật thì không gửi, không thấy danh bạ; danh bạ chỉ có trường khác đã bật', async () => {
    const settings = await call('alpha', 'GET', '/student-transfers/mailbox/settings');
    assert.deepEqual([settings.body.available, settings.body.enabled], [true, false]);
    const notEnabled = await call('alpha', 'GET', '/student-transfers/mailbox/directory');
    assert.equal(ruleOf(notEnabled.body), 'BR-510');
    assert.equal((await call('alpha', 'PUT', '/student-transfers/mailbox/settings', { enabled: true })).status, 200);
    const empty = await call('alpha', 'GET', '/student-transfers/mailbox/directory');
    assert.deepEqual(empty.body, []);
    const beta = await environment.tenantOf('beta');
    const refused = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.first}/send`, {
      to_school_id: beta.schoolId,
      application_received: true,
    });
    assert.equal(ruleOf(refused.body), 'BR-510', JSON.stringify(refused.body));
    assert.equal((await call('beta', 'PUT', '/student-transfers/mailbox/settings', { enabled: true })).status, 200);
    const listed = await call('alpha', 'GET', '/student-transfers/mailbox/directory');
    const entries = Object.values(listed.body) as Array<{ school_id: string }>;
    assert.deepEqual(
      entries.map((entry) => entry.school_id),
      [beta.schoolId],
    );
  });

  it('CT-1952: gửi gói cho beta: hộp thư không có dữ liệu cá nhân dạng rõ; gửi lại khi đang chờ bị từ chối; alpha không mở được thư của beta', async () => {
    const beta = await environment.tenantOf('beta');
    const noApplication = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.first}/send`, {
      to_school_id: beta.schoolId,
    });
    assert.equal(noApplication.status, 400, JSON.stringify(noApplication.body));
    const sent = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.first}/send`, {
      to_school_id: beta.schoolId,
      application_received: true,
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    ids.alpha!.mailbox = sent.body.mailbox_id as string;
    const row = await environment.platform.platform
      .selectFrom('transfer_mailbox')
      .selectAll()
      .where('id', '=', ids.alpha!.mailbox)
      .executeTakeFirstOrThrow();
    assert.ok(row.envelope && !Buffer.from(row.envelope).includes(Buffer.from('Đặng Thị Hộp')), 'gói phải được mã hóa');
    assert.ok(!JSON.stringify(row).includes('Đặng Thị Hộp'));
    const again = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.first}/send`, {
      to_school_id: beta.schoolId,
      application_received: true,
    });
    assert.equal(ruleOf(again.body), 'BR-511');
    const foreign = await call('alpha', 'POST', `/student-transfers/mailbox/${ids.alpha!.mailbox}/preview`);
    assert.equal(foreign.status, 404, JSON.stringify(foreign.body));
    const alphaInbox = await call('alpha', 'GET', '/student-transfers/mailbox/inbox');
    assert.deepEqual(alphaInbox.body, []);
  });

  it('CT-1953: beta xem gói (kiểm chữ ký), tiếp nhận vào lớp; alpha thấy "đã tiếp nhận", không thu hồi được', async () => {
    const inbox = await call('beta', 'GET', '/student-transfers/mailbox/inbox');
    const items = Object.values(inbox.body) as Array<{ id: string; state: string; from_school_name: string }>;
    assert.deepEqual(
      items.map((item) => [item.id, item.state]),
      [[ids.alpha!.mailbox, 'sent']],
    );
    const preview = await call('beta', 'POST', `/student-transfers/mailbox/${ids.alpha!.mailbox}/preview`);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal((preview.body.student as { full_name: string }).full_name, 'Đặng Thị Hộp');
    const accepted = await call('beta', 'POST', `/student-transfers/mailbox/${ids.alpha!.mailbox}/accept`, {
      class_id: ids.beta!.class,
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    const child = await call('beta', 'GET', `/children/${accepted.body.child_id as string}`);
    assert.equal(child.body.status, 'active');
    const outbox = await call('alpha', 'GET', '/student-transfers/mailbox/outbox');
    const sentItems = Object.values(outbox.body) as Array<{ id: string; state: string }>;
    assert.equal(sentItems.find((item) => item.id === ids.alpha!.mailbox)?.state, 'accepted');
    const revoke = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.first}/revoke`);
    assert.equal(ruleOf(revoke.body), 'BR-511');
    const twice = await call('beta', 'POST', `/student-transfers/mailbox/${ids.alpha!.mailbox}/accept`, {
      class_id: ids.beta!.class,
    });
    assert.equal(ruleOf(twice.body), 'BR-511');
  });

  it('CT-1954: từ chối có lý do; gửi lại sau khi bị từ chối; chữ ký sai thì không mở; thu hồi xóa gói', async () => {
    const beta = await environment.tenantOf('beta');
    const sent = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.second}/send`, {
      to_school_id: beta.schoolId,
      application_received: true,
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const mailboxId = sent.body.mailbox_id as string;
    assert.equal(
      (await call('beta', 'POST', `/student-transfers/mailbox/${mailboxId}/reject`, { note: '' })).status,
      400,
    );
    const rejected = await call('beta', 'POST', `/student-transfers/mailbox/${mailboxId}/reject`, {
      note: 'Lớp đã đủ sĩ số',
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    const outbox = await call('alpha', 'GET', '/student-transfers/mailbox/outbox');
    const item = (
      Object.values(outbox.body) as Array<{ id: string; state: string; decision_note: string | null }>
    ).find((entry) => entry.id === mailboxId);
    assert.deepEqual([item?.state, item?.decision_note], ['rejected', 'Lớp đã đủ sĩ số']);

    const resent = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.second}/send`, {
      to_school_id: beta.schoolId,
      application_received: true,
    });
    assert.equal(resent.status, 200, JSON.stringify(resent.body));
    const resentId = resent.body.mailbox_id as string;
    await environment.platform.platform
      .updateTable('transfer_mailbox')
      .set({ signature: Buffer.alloc(64, 1).toString('base64') })
      .where('id', '=', resentId)
      .execute();
    const forged = await call('beta', 'POST', `/student-transfers/mailbox/${resentId}/preview`);
    assert.equal(ruleOf(forged.body), 'BR-512', JSON.stringify(forged.body));
    const revoked = await call('alpha', 'POST', `/student-transfers/${ids.alpha!.second}/revoke`);
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    const purged = await environment.platform.platform
      .selectFrom('transfer_mailbox')
      .select(['state', 'envelope', 'wrapped_secret'])
      .where('id', '=', resentId)
      .executeTakeFirstOrThrow();
    assert.deepEqual([purged.state, purged.envelope, purged.wrapped_secret], ['revoked', null, null]);
  });
});
