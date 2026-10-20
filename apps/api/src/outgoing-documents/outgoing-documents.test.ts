import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { verificationCode, verificationText } from './outgoing-documents.js';
import { parseIssue, parseOutgoingInput, parseRecipients, symbolOf } from './outgoing-fields.js';

// Văn bản đi theo VNPT iOffice (DT-18 phần 18b, YCTD-140): dự thảo, lấy ý kiến, cho ý kiến, trình ký, lấy lại, ký nội bộ
// (mã QR tra cứu), không ký, trả lại, cấp số và phát hành theo sổ văn bản đi, liên thông nội bộ thành văn bản đến, liên
// thông ra ngoài (đánh dấu tay), công bố lên website, đóng băng, lưu hồ sơ, sổ văn bản đi, phiếu trình. Kịch bản CT-18b-1
// đến CT-18b-9
type Body = Record<string, unknown> & { error?: Record<string, unknown> };
const errorOf = (body: Body) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const fieldsOf = (body: Body) => (errorOf(body).details ?? []).map((detail) => detail.field).sort();
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const today = () => VIETNAM_DATE.format(new Date());

describe('Đọc dữ liệu văn bản đi, mã tra cứu', () => {
  it('CT-18b-1: biểu mẫu thiếu trích yếu, đơn vị nhận chọn cả hai loại, ký hiệu có dấu "/" đều báo lỗi; số ký hiệu ghép từ số đi; mã QR theo nguồn của cổng', () => {
    const errors: FieldError[] = [];
    parseOutgoingInput({ summary: '', meeting_at: 'hôm nay' }, errors);
    assert.deepEqual(errors.map((error) => error.field).sort(), ['meeting_at', 'summary']);
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    const recipientErrors: FieldError[] = [];
    parseRecipients(
      {
        recipients: [
          { external_unit_id: id(1), org_unit_id: id(2) },
          { external_unit_id: id(3) },
          { external_unit_id: id(3) },
        ],
      },
      recipientErrors,
    );
    assert.deepEqual(recipientErrors.map((error) => error.field).sort(), ['recipients', 'recipients.0']);
    assert.throws(
      () => parseIssue({ book_id: id(1), issue_date: '2026-10-20', symbol_suffix: 'QĐ/THCS' }),
      (error: { details?: Array<{ field: string }> }) =>
        error.details?.some((detail) => detail.field === 'symbol_suffix') === true,
    );
    assert.equal(parseIssue({ book_id: id(1), issue_date: '2026-10-20' }).copies, 1);
    assert.equal(symbolOf(12, 'QĐ-THCS'), '12/QĐ-THCS');
    assert.equal(symbolOf(12, null), '12');
    const code = verificationCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{12}$/);
    assert.equal(verificationText(code, 'https://truong.example.test'), `https://truong.example.test/tra-cuu-van-ban?ma=${code}`);
    assert.equal(verificationText(code, 'javascript:alert(1)'), code);
    assert.equal(verificationText(code, null), code);
  });
});

describe('Văn bản đi theo VNPT iOffice', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let deputy: LoggedInUser;
  let clerk: LoggedInUser;
  let drafter: LoggedInUser;
  let reviewer: LoggedInUser;
  let colleague: LoggedInUser;
  let outsider: LoggedInUser;
  let rootUnit = '';
  let branchUnit = '';
  let externalUnit = '';
  let outgoingBook = '';
  let incomingBook = '';
  let secretId = '';
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body) as Promise<{
      status: number;
      body: Body;
    }>;
  const upload = async (documentId: string, user: LoggedInUser, kind = 'draft') => {
    const form = new FormData();
    form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'du-thao.pdf');
    form.append('kind', kind);
    const response = await fetch(`${environment.baseUrl}/outgoing-documents/${documentId}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Body };
  };
  const draft = async (extra: Record<string, unknown> = {}) => {
    const created = await api('POST', '/outgoing-documents', drafter, {
      summary: 'V/v tổ chức hội nghị cán bộ, viên chức',
      signer_id: principal.userId,
      drafting_unit_id: rootUnit,
      ...extra,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body;
  };
  // Dự thảo có tệp, trình ký và đã ký: dùng cho các kịch bản cấp số
  const signed = async (extra: Record<string, unknown> = {}) => {
    const id = (await draft(extra)).id as string;
    assert.equal((await upload(id, drafter)).status, 200);
    assert.equal((await api('POST', `/outgoing-documents/${id}/submit`, drafter, {})).status, 200);
    const done = await api('POST', `/outgoing-documents/${id}/sign`, principal);
    assert.equal(done.status, 200, JSON.stringify(done.body));
    return id;
  };
  const list = async (user: LoggedInUser, query: string) =>
    (await api('GET', `/outgoing-documents?${query}`, user)).body as { items: Array<Body>; total: number };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học văn bản đi', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    rootUnit = (
      await schoolYear
        .insertInto('org_units')
        .values({ code: 'VBDI', name: 'Trường thử văn bản đi', unit_type: 'truong_chinh', parent_id: null })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    branchUnit = (
      await schoolYear
        .insertInto('org_units')
        .values({ code: 'VBDI-PH', name: 'Phân hiệu thử', unit_type: 'phan_hieu', parent_id: rootUnit })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    deputy = await environment.loginAs('VT-15', null);
    clerk = await environment.loginAs('VT-06', null);
    drafter = await environment.loginAs('VT-04', rootUnit);
    reviewer = await environment.loginAs('VT-09', rootUnit);
    colleague = await environment.loginAs('VT-03', rootUnit);
    outsider = await environment.loginAs('VT-11', rootUnit);
    const people: Array<[LoggedInUser, string]> = [
      [principal, 'Hiệu trưởng Thử'],
      [deputy, 'Phó hiệu trưởng Thử'],
      [clerk, 'Văn thư Thử'],
      [drafter, 'Chuyên viên Soạn thảo'],
      [reviewer, 'Tổ trưởng Góp ý'],
      [colleague, 'Giáo viên Góp ý'],
      [outsider, 'Nhân viên Ngoài'],
    ];
    for (const [index, [user, name]] of people.entries()) {
      await schoolYear
        .insertInto('staff')
        .values({ org_unit_id: rootUnit, code: `VBDI-${index}`, full_name: name, start_date: '2025-08-01', user_id: user.userId })
        .execute();
    }
    const leaders = await api('PUT', '/document-leaders', clerk, {
      leaders: [{ user_id: principal.userId, title: 'Hiệu trưởng' }, { user_id: deputy.userId, title: 'Phó hiệu trưởng' }],
    });
    assert.equal(leaders.status, 200, JSON.stringify(leaders.body));
    const unit = await api('POST', '/external-units', clerk, {
      code: 'PGD-DI',
      name: 'Phòng Giáo dục nhận thử',
      electronic_code: '000.00.00.H29',
    });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
    externalUnit = unit.body.id as string;
    const year = Number(today().slice(0, 4));
    const book = await api('POST', '/document-books', clerk, {
      direction: 'outgoing',
      name: 'Sổ văn bản đi',
      year,
      start_number: 10,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
    });
    assert.equal(book.status, 201, JSON.stringify(book.body));
    outgoingBook = book.body.id as string;
    assert.equal(book.body.next_number, 10);
    const inbound = await api('POST', '/document-books', clerk, {
      name: 'Sổ văn bản đến phân hiệu',
      org_unit_id: branchUnit,
      year,
      start_date: `${year}-01-01`,
    });
    assert.equal(inbound.status, 201, JSON.stringify(inbound.body));
    incomingBook = inbound.body.id as string;
    const catalog = (await api('GET', '/document-catalogs?kind=secrecy', clerk)).body as unknown as Array<{
      id: string;
      code: string;
    }>;
    secretId = catalog.find((item) => item.code === 'MAT')?.id as string;
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-18b-2: tạo dự thảo cấp số eOffice tăng dần; người ký ngoài danh sách lãnh đạo, đơn vị nhận không có bị báo lỗi; sửa, đính kèm, xóa dự thảo chưa trình', async () => {
    const first = await draft({
      submission_number: 'TT-01',
      recipients: [{ external_unit_id: externalUnit }, { org_unit_id: branchUnit }],
      meeting_at: '2026-11-02T08:00',
      meeting_place: 'Phòng họp số 1',
      insert_qr: true,
    });
    assert.equal(first.status, 'draft');
    assert.equal(first.drafter_name, 'Chuyên viên Soạn thảo');
    assert.equal(first.drafting_unit_name, 'Trường thử văn bản đi');
    assert.equal(first.signer_name, 'Hiệu trưởng Thử');
    assert.deepEqual(
      (first.recipients as Array<{ name: string; recipient_type: string }>).map((item) => item.recipient_type),
      ['external', 'internal'],
    );
    const second = await draft();
    assert.equal(second.eoffice_number, (first.eoffice_number as number) + 1);
    const badSigner = await api('POST', '/outgoing-documents', drafter, { summary: 'x', signer_id: reviewer.userId });
    assert.deepEqual(fieldsOf(badSigner.body), ['signer_id']);
    const badRecipient = await api('POST', '/outgoing-documents', drafter, {
      summary: 'x',
      recipients: [{ external_unit_id: '00000000-0000-4000-8000-000000000009' }],
    });
    assert.deepEqual(fieldsOf(badRecipient.body), ['recipients']);
    const id = first.id as string;
    const updated = await api('PUT', `/outgoing-documents/${id}`, drafter, {
      summary: 'V/v tổ chức hội nghị cán bộ, viên chức năm học',
      signer_id: deputy.userId,
      links: [{ link_type: 'related', outgoing_id: second.id }],
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.signer_name, 'Phó hiệu trưởng Thử');
    assert.equal((updated.body.links as Array<Body>).length, 1);
    // Không gửi recipients thì giữ nguyên đơn vị nhận
    assert.equal((updated.body.recipients as Array<Body>).length, 2);
    assert.equal((await api('PUT', `/outgoing-documents/${id}`, outsider, { summary: 'x' })).status, 404);
    const file = await upload(id, drafter, 'attachment');
    assert.equal(file.status, 200, JSON.stringify(file.body));
    const signedKind = await upload(id, drafter, 'signed');
    assert.equal(signedKind.status, 400);
    const removed = await api('DELETE', `/outgoing-documents/${second.id as string}`, drafter);
    assert.equal(removed.status, 204);
    assert.equal((await api('GET', `/outgoing-documents/${second.id as string}`, drafter)).status, 404);
    const drafts = await list(drafter, 'view=drafts');
    assert.ok(drafts.items.some((item) => item.id === id));
  });

  it('CT-18b-3: lấy ý kiến hai người; người được hỏi xem, cho ý kiến, kết thúc cho ý kiến; người ngoài không cho ý kiến được; kết thúc lấy ý kiến đóng người chưa trả lời, văn bản về dự thảo', async () => {
    const id = (await draft()).id as string;
    const consulted = await api('POST', `/outgoing-documents/${id}/consult`, drafter, {
      user_ids: [reviewer.userId, colleague.userId],
      deadline: today(),
      note: 'Đề nghị góp ý',
    });
    assert.equal(consulted.status, 200, JSON.stringify(consulted.body));
    assert.equal(consulted.body.status, 'consulting');
    assert.ok((await list(reviewer, 'view=pending')).items.some((item) => item.id === id));
    const view = await api('GET', `/outgoing-documents/${id}`, reviewer);
    assert.deepEqual(view.body.actions, ['opinion', 'finish_opinion']);
    const empty = await api('POST', `/outgoing-documents/${id}/opinion`, reviewer, {});
    assert.deepEqual(fieldsOf(empty.body), ['opinion']);
    const answered = await api('POST', `/outgoing-documents/${id}/opinion`, reviewer, { opinion: 'Thống nhất' });
    assert.equal(answered.status, 200, JSON.stringify(answered.body));
    const finished = await api('POST', `/outgoing-documents/${id}/opinion`, reviewer, { finish: true });
    assert.equal(finished.status, 200);
    const again = await api('POST', `/outgoing-documents/${id}/opinion`, reviewer, { opinion: 'Sửa lại' });
    assert.equal(again.status, 422);
    assert.equal(errorOf(again.body).rule_code, 'YCTD-140');
    assert.equal((await api('POST', `/outgoing-documents/${id}/opinion`, outsider, { opinion: 'x' })).status, 404);
    const submitEarly = await api('POST', `/outgoing-documents/${id}/submit`, drafter, {});
    assert.equal(submitEarly.status, 422);
    const ended = await api('POST', `/outgoing-documents/${id}/consult/end`, drafter);
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal(ended.body.status, 'draft');
    const opinions = ended.body.opinions as Array<{ user_name: string; status: string; opinion: string | null }>;
    assert.deepEqual(
      opinions.map((row) => [row.user_name, row.status, row.opinion]),
      [
        ['Giáo viên Góp ý', 'closed', null],
        ['Tổ trưởng Góp ý', 'finished', 'Thống nhất'],
      ],
    );
    assert.ok((await list(reviewer, 'view=processed')).items.some((item) => item.id === id));
    // Đợt sau đánh số 2
    const round = await api('POST', `/outgoing-documents/${id}/consult`, drafter, { user_ids: [colleague.userId] });
    assert.equal((round.body.opinions as Array<{ round: number }>).at(-1)?.round, 2);
  });

  it('CT-18b-4: trình ký cần tệp dự thảo; người soạn lấy lại; người ký không ký kèm lý do, văn bản về dự thảo; người khác không ký được', async () => {
    const id = (await draft()).id as string;
    const noFile = await api('POST', `/outgoing-documents/${id}/submit`, drafter, {});
    assert.equal(noFile.status, 422);
    await upload(id, drafter);
    const submitted = await api('POST', `/outgoing-documents/${id}/submit`, drafter, { note: 'Kính trình' });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'pending_signature');
    assert.ok((await list(principal, 'view=pending')).items.some((item) => item.id === id));
    // Phó hiệu trưởng tra cứu được văn bản chờ ký nhưng không phải người ký
    assert.equal((await api('POST', `/outgoing-documents/${id}/sign`, deputy)).status, 422);
    const revoked = await api('POST', `/outgoing-documents/${id}/revoke`, drafter);
    assert.equal(revoked.body.status, 'draft');
    await api('POST', `/outgoing-documents/${id}/submit`, drafter, {});
    const noReason = await api('POST', `/outgoing-documents/${id}/decline`, principal, {});
    assert.deepEqual(fieldsOf(noReason.body), ['note']);
    const declined = await api('POST', `/outgoing-documents/${id}/decline`, principal, { note: 'Chưa đủ căn cứ' });
    assert.equal(declined.status, 200, JSON.stringify(declined.body));
    assert.equal(declined.body.status, 'draft');
    assert.equal(declined.body.return_note, 'Chưa đủ căn cứ');
    assert.equal((await api('POST', `/outgoing-documents/${id}/revoke`, drafter)).status, 422);
  });

  it('CT-18b-5: ký cần chứng thư nhà trường đã đăng ký; ký lập bản đã ký có mã tra cứu; trang tra cứu công khai chưa hiện trích yếu khi chưa ban hành', async () => {
    const id = (await draft()).id as string;
    await upload(id, drafter);
    await api('POST', `/outgoing-documents/${id}/submit`, drafter, {});
    const blocked = await api('POST', `/outgoing-documents/${id}/sign`, principal);
    assert.equal(blocked.status, 422);
    assert.equal(errorOf(blocked.body).rule_code, 'YCTD-140');
    const saved = await api('PUT', '/signing/certificate', principal, {
      signature_type: 'remote',
      provider: 'VNPT-CA',
      login_name: 'truong-thu-van-ban',
      holder_name: 'Hiệu trưởng Thử',
      holder_title: 'Hiệu trưởng',
      serial_number: 'SERI-VBD',
      valid_from: '2026-01-01',
      valid_to: '2099-12-31',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal((await api('POST', '/signing/certificate/register', principal)).status, 200);
    const signedView = await api('POST', `/outgoing-documents/${id}/sign`, principal);
    assert.equal(signedView.status, 200, JSON.stringify(signedView.body));
    assert.equal(signedView.body.status, 'signed');
    assert.equal(signedView.body.signature_method, 'internal');
    const code = signedView.body.verification_code as string;
    assert.match(code, /^[A-Z0-9]{12}$/);
    const signedFile = (signedView.body.files as Array<{ id: string; kind: string }>).find((file) => file.kind === 'signed');
    assert.ok(signedFile);
    const download = await fetch(`${environment.baseUrl}/outgoing-documents/${id}/files/${signedFile.id}`, {
      headers: { authorization: `Bearer ${drafter.accessToken}` },
    });
    assert.equal(download.status, 200);
    assert.equal((await download.arrayBuffer()).byteLength > 1000, true);
    const verify = await fetch(`${environment.baseUrl}/public/outgoing-documents/verify?code=${code}`);
    assert.equal(verify.status, 200);
    const verified = (await verify.json()) as Body;
    assert.equal(verified.issued, false);
    assert.equal(verified.summary, null);
    assert.equal(verified.signer_name, 'Hiệu trưởng Thử');
    assert.equal(verified.internal_signature, true);
    assert.equal((await fetch(`${environment.baseUrl}/public/outgoing-documents/verify?code=AAAAAAAAAAAA`)).status, 404);
    assert.equal((await fetch(`${environment.baseUrl}/public/outgoing-documents/verify?code=x`)).status, 400);
  });

  it('CT-18b-6: văn thư cấp số theo sổ văn bản đi (số bắt đầu, số tay trùng báo lỗi); phát hành tạo văn bản đến chờ vào sổ cho phân hiệu (kèm bản đã ký) và ghi văn bản trả lời', async () => {
    const reply = await api('POST', '/incoming-documents', clerk, {
      summary: 'Công văn cần trả lời',
      symbol: '9/PGD',
      issuer_name: 'Phòng Giáo dục thử',
      document_date: today(),
      book_id: incomingBook,
      arrival_date: today(),
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const id = await signed({
      reply_to_id: reply.body.id,
      recipients: [{ external_unit_id: externalUnit }, { org_unit_id: branchUnit }],
    });
    assert.ok((await list(clerk, 'view=to_issue')).items.some((item) => item.id === id));
    assert.equal((await api('GET', '/outgoing-documents?view=to_issue', drafter)).status, 403);
    const next = await api('GET', `/outgoing-documents/next-number?book_id=${outgoingBook}`, clerk);
    assert.equal(next.body.next_number, 10);
    const outside = await api('POST', `/outgoing-documents/${id}/issue`, clerk, {
      book_id: outgoingBook,
      issue_date: '2001-01-01',
    });
    assert.equal(outside.status, 422);
    const issued = await api('POST', `/outgoing-documents/${id}/issue`, clerk, {
      book_id: outgoingBook,
      symbol_suffix: 'TB-THU',
      issue_date: today(),
      copies: 3,
    });
    assert.equal(issued.status, 200, JSON.stringify(issued.body));
    assert.equal(issued.body.status, 'issued');
    assert.equal(issued.body.issue_number, 10);
    assert.equal(issued.body.symbol, '10/TB-THU');
    assert.equal(issued.body.copies, 3);
    const recipients = issued.body.recipients as Array<{ recipient_type: string; send_status: string; incoming_document_id: string | null }>;
    assert.deepEqual(
      recipients.map((item) => [item.recipient_type, item.send_status]),
      [
        ['external', 'pending'],
        ['internal', 'delivered'],
      ],
    );
    const incomingId = recipients[1]?.incoming_document_id as string;
    const incoming = await api('GET', `/incoming-documents/${incomingId}`, clerk);
    assert.equal(incoming.status, 200, JSON.stringify(incoming.body));
    assert.equal(incoming.body.status, 'pending_registration');
    assert.equal(incoming.body.source, 'internal');
    assert.equal(incoming.body.symbol, '10/TB-THU');
    assert.equal(incoming.body.issuer_name, 'Trường thử văn bản đi');
    assert.equal(incoming.body.recipient_org_unit_name, 'Phân hiệu thử');
    assert.deepEqual((incoming.body.files as Array<{ kind: string }>).map((file) => file.kind), ['main']);
    const registered = await api('POST', `/incoming-documents/${incomingId}/register`, clerk, {
      book_id: incomingBook,
      arrival_date: today(),
    });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    const replied = await api('GET', `/incoming-documents/${reply.body.id as string}`, clerk);
    assert.equal(replied.body.reply_symbol, '10/TB-THU');
    const second = await signed();
    const duplicate = await api('POST', `/outgoing-documents/${second}/issue`, clerk, {
      book_id: outgoingBook,
      issue_number: 10,
      issue_date: today(),
    });
    assert.equal(duplicate.status, 409);
    const manual = await api('POST', `/outgoing-documents/${second}/issue`, clerk, {
      book_id: outgoingBook,
      issue_number: 40,
      issue_date: today(),
    });
    assert.equal(manual.body.symbol, '40');
    assert.equal((await api('GET', `/outgoing-documents/next-number?book_id=${outgoingBook}`, clerk)).body.next_number, 41);
    const verify = (await (
      await fetch(`${environment.baseUrl}/public/outgoing-documents/verify?code=${issued.body.verification_code as string}`)
    ).json()) as Body;
    assert.equal(verify.issued, true);
    assert.equal(verify.symbol, '10/TB-THU');
    assert.equal(verify.summary, 'V/v tổ chức hội nghị cán bộ, viên chức');
  });

  it('CT-18b-7: liên thông ra ngoài đánh dấu tay, hủy đánh dấu; văn bản mật không công bố; công bố, đóng băng chặn gửi, công bố, lưu hồ sơ; hủy đóng băng rồi lưu hồ sơ', async () => {
    const id = await signed({ recipients: [{ external_unit_id: externalUnit }] });
    const issued = await api('POST', `/outgoing-documents/${id}/issue`, clerk, { book_id: outgoingBook, issue_date: today() });
    const recipientId = (issued.body.recipients as Array<{ id: string }>)[0]?.id as string;
    assert.ok((await api('GET', '/outgoing-documents/recipients?status=pending', clerk)).body);
    const sent = await api('POST', `/outgoing-documents/${id}/send`, clerk, {
      recipient_ids: [recipientId],
      reference: 'Gửi thư điện tử ngày hôm nay',
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const row = (sent.body.recipients as Array<{ send_status: string; reference: string }>)[0];
    assert.equal(row?.send_status, 'sent');
    assert.equal(row?.reference, 'Gửi thư điện tử ngày hôm nay');
    assert.equal((sent.body.exchange as { connected: boolean }).connected, false);
    const unsent = await api('POST', `/outgoing-documents/${id}/send`, clerk, { recipient_ids: [recipientId], sent: false });
    assert.equal((unsent.body.recipients as Array<{ send_status: string }>)[0]?.send_status, 'pending');
    assert.equal((await api('POST', `/outgoing-documents/${id}/send`, drafter, { recipient_ids: [recipientId] })).status, 403);
    const published = await api('POST', `/outgoing-documents/${id}/publish`, clerk, { published: true });
    assert.equal(published.body.published, true);
    assert.ok((await list(clerk, 'view=issued&published=true')).items.some((item) => item.id === id));
    const frozen = await api('POST', `/outgoing-documents/${id}/freeze`, clerk, { frozen: true });
    assert.equal(frozen.body.frozen, true);
    assert.deepEqual(frozen.body.actions, ['freeze']);
    assert.equal((await api('POST', `/outgoing-documents/${id}/publish`, clerk, { published: false })).status, 422);
    const record = await api('POST', '/archive-records', principal, {
      code: 'HS-VBDI-1',
      title: 'Hồ sơ văn bản đi',
      handler_name: 'Văn thư Thử',
      opened_on: today(),
      status: 'pending',
      retention: 'permanent',
    });
    assert.equal(record.status, 201, JSON.stringify(record.body));
    const blockedArchive = await api('POST', '/outgoing-documents/archive', clerk, {
      ids: [id],
      archive_record_id: record.body.id,
    });
    assert.equal((blockedArchive.body as unknown as Array<{ ok: boolean }>)[0]?.ok, false);
    await api('POST', `/outgoing-documents/${id}/freeze`, clerk, { frozen: false });
    const archived = await api('POST', '/outgoing-documents/archive', clerk, { ids: [id], archive_record_id: record.body.id });
    assert.equal((archived.body as unknown as Array<{ ok: boolean }>)[0]?.ok, true);
    const secret = await signed({ secrecy_id: secretId });
    await api('POST', `/outgoing-documents/${secret}/issue`, clerk, { book_id: outgoingBook, issue_date: today() });
    const refused = await api('POST', `/outgoing-documents/${secret}/publish`, clerk, { published: true });
    assert.equal(refused.status, 422);
    assert.equal(errorOf(refused.body).rule_code, 'YCTD-140');
  });

  it('CT-18b-8: văn thư trả lại văn bản đã ký: bỏ bản đã ký, mã tra cứu, văn bản về dự thảo; người soạn sửa rồi trình lại', async () => {
    const id = await signed();
    const returned = await api('POST', `/outgoing-documents/${id}/return`, clerk, { note: 'Sai thể thức' });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.status, 'draft');
    const view = await api('GET', `/outgoing-documents/${id}`, drafter);
    assert.equal(view.body.status, 'draft');
    assert.equal(view.body.verification_code, null);
    assert.equal(view.body.return_note, 'Sai thể thức');
    assert.ok(!(view.body.files as Array<{ kind: string }>).some((file) => file.kind === 'signed'));
    assert.equal((await api('POST', `/outgoing-documents/${id}/submit`, drafter, {})).status, 200);
  });

  it('CT-18b-9: sổ văn bản đi theo cột iOffice, xuất Excel ghi nhật ký; phiếu trình ký PDF; tra cứu cho Ban Giám hiệu, chặn người không có quyền; sổ đã có văn bản không xóa được', async () => {
    const register = await api('GET', `/document-books/${outgoingBook}/outgoing-register?from=${today()}&to=${today()}`, clerk);
    assert.equal(register.status, 200, JSON.stringify(register.body));
    const rows = register.body.items as Array<Body>;
    const first = rows.find((row) => row.issue_number === 10);
    assert.equal(first?.symbol, '10/TB-THU');
    assert.equal(first?.signer_name, 'Hiệu trưởng Thử');
    assert.equal(first?.drafting_unit_name, 'Trường thử văn bản đi');
    assert.equal(first?.copies, 3);
    assert.equal(first?.recipients, 'Phòng Giáo dục nhận thử, Phân hiệu thử');
    assert.ok(rows.some((row) => row.summary === '(Văn bản mật)'));
    assert.equal((await api('GET', `/document-books/${outgoingBook}/outgoing-register`, drafter)).status, 403);
    assert.equal((await api('GET', `/document-books/${incomingBook}/outgoing-register`, clerk)).status, 404);
    const exported = await fetch(`${environment.baseUrl}/document-books/${outgoingBook}/outgoing-register/export`, {
      headers: { authorization: `Bearer ${clerk.accessToken}` },
    });
    assert.equal(exported.status, 200);
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'outgoing_document_register')
      .execute();
    assert.equal(logs.length, 1);
    const id = rows[0]?.id as string;
    const slip = await fetch(`${environment.baseUrl}/outgoing-documents/${id}/slip`, {
      headers: { authorization: `Bearer ${drafter.accessToken}` },
    });
    assert.equal(slip.status, 200);
    assert.equal(slip.headers.get('content-type'), 'application/pdf');
    const search = await list(deputy, 'view=search&symbol=TB-THU');
    assert.equal(search.items.length, 1);
    assert.equal((await api('GET', '/outgoing-documents?view=search', drafter)).status, 403);
    assert.equal((await api('GET', '/outgoing-documents', outsider)).status, 200);
    const books = (await api('GET', '/document-books?direction=outgoing', clerk)).body as unknown as Array<{
      id: string;
      document_count: number;
    }>;
    assert.ok((books.find((book) => book.id === outgoingBook)?.document_count ?? 0) >= 3);
    assert.equal((await api('DELETE', `/document-books/${outgoingBook}`, clerk)).status, 422);
  });
});
