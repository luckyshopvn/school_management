import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import type { FieldError } from '@school-management/server';
import { cacheKey, storageKey } from '../common/resource-names.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseDocumentInput, parseTransfer } from './incoming-fields.js';
import { addDays, deadlineState } from './incoming-documents.js';

// Văn bản đến theo VNPT iOffice (DT-18 phần 18a, YCTD-138): danh mục, sổ, vào sổ, luồng xử lý (trình lãnh đạo, chuyển xử
// lý, phối hợp, xem để biết, trả lại, lấy lại, từ chối, xin gia hạn, kết thúc), hạn chế xem, liên thông bản chạy nội bộ,
// đánh dấu, theo dõi, in phiếu, sổ văn bản đến. Kịch bản CT-18a-1 đến CT-18a-10
type Body = Record<string, unknown> & { error?: Record<string, unknown> };
const errorOf = (body: Body) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const fieldsOf = (body: Body) => (errorOf(body).details ?? []).map((detail) => detail.field).sort();
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const VIETNAM_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const today = () => VIETNAM_DATE.format(new Date());

describe('Đọc dữ liệu văn bản đến, hàm tạo tên khóa', () => {
  it('CT-18a-1: biểu mẫu thiếu trường bắt buộc, chuyển hai người xử lý chính, luân chuyển hai người đều báo lỗi; tên khóa ghép qua hàm chung', () => {
    const errors: FieldError[] = [];
    parseDocumentInput({ summary: '', symbol: 'x', document_date: '2026-13-01' }, errors);
    assert.deepEqual(errors.map((error) => error.field).sort(), ['document_date', 'issuer_name', 'summary']);
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    assert.throws(
      () =>
        parseTransfer({
          mode: 'process',
          recipients: [
            { user_id: id(1), role: 'main' },
            { user_id: id(2), role: 'main' },
          ],
        }),
      (error: { details?: Array<{ field: string }> }) =>
        error.details?.some((detail) => detail.field === 'recipients') === true,
    );
    assert.throws(() => parseTransfer({ mode: 'rotate', recipients: [{ user_id: id(1) }, { user_id: id(2) }] }));
    const leader = parseTransfer({ mode: 'leader', recipients: [{ user_id: id(3), role: 'view' }] });
    assert.equal(leader.recipients[0]?.role, 'leader');
    assert.equal(storageKey('incoming-documents', 'a', 'b'), 'incoming-documents/a/b');
    assert.equal(cacheKey('incoming', 'counts'), 'incoming:counts');
    assert.throws(() => storageKey('a/b'));
    assert.throws(() => cacheKey());
    assert.deepEqual(deadlineState('2026-10-19', '2026-10-20', false), { overdue: true, due_soon: false });
    assert.deepEqual(deadlineState(addDays('2026-10-20', 2), '2026-10-20', false), { overdue: false, due_soon: true });
    assert.deepEqual(deadlineState('2026-10-19', '2026-10-20', true), { overdue: false, due_soon: false });
  });
});

describe('Văn bản đến theo VNPT iOffice', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let clerk: LoggedInUser;
  let deputy: LoggedInUser;
  let main: LoggedInUser;
  let partner: LoggedInUser;
  let viewer: LoggedInUser;
  let outsider: LoggedInUser;
  let bookId = '';
  let unitId = '';
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body) as Promise<{
      status: number;
      body: Body;
    }>;
  const upload = async (documentId: string, user: LoggedInUser) => {
    const form = new FormData();
    form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'van-ban-quet.pdf');
    form.append('scanned', 'true');
    const response = await fetch(`${environment.baseUrl}/incoming-documents/${documentId}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${user.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Body };
  };
  const document = (extra: Record<string, unknown> = {}) => ({
    summary: 'V/v triển khai nhiệm vụ năm học',
    symbol: '123/KH-PGD',
    issuer_unit_id: unitId,
    document_date: '2026-10-01',
    book_id: bookId,
    arrival_date: today(),
    has_paper: true,
    ...extra,
  });
  const register = async (extra: Record<string, unknown> = {}) => {
    const created = await api('POST', '/incoming-documents', clerk, document(extra));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body;
  };
  const list = async (user: LoggedInUser, query: string) =>
    (await api('GET', `/incoming-documents?${query}`, user)).body as { items: Array<Body>; total: number };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học văn bản đến', {
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
    const root = (
      await schoolYear
        .insertInto('org_units')
        .values({ code: 'VBD', name: 'Trường thử văn bản', unit_type: 'truong_chinh', parent_id: null })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    clerk = await environment.loginAs('VT-06', null);
    deputy = await environment.loginAs('VT-15', null);
    main = await environment.loginAs('VT-04', root);
    partner = await environment.loginAs('VT-09', root);
    viewer = await environment.loginAs('VT-03', root);
    outsider = await environment.loginAs('VT-11', root);
    const people: Array<[LoggedInUser, string]> = [
      [principal, 'Hiệu trưởng Thử'],
      [clerk, 'Văn thư Thử'],
      [deputy, 'Phó hiệu trưởng Thử'],
      [main, 'Chuyên viên Chính'],
      [partner, 'Chuyên viên Phối hợp'],
      [viewer, 'Tổ trưởng Xem'],
      [outsider, 'Nhân viên Ngoài'],
    ];
    for (const [index, [user, name]] of people.entries()) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: root,
          code: `VBD-${index}`,
          full_name: name,
          start_date: '2025-08-01',
          user_id: user.userId,
        })
        .execute();
    }
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-18a-2: danh mục mặc định theo iOffice; quản trị thêm đơn vị bên ngoài, nhóm, lãnh đạo, sổ; người không có quyền quản trị bị chặn; mục đang dùng không xóa được', async () => {
    const catalog = (await api('GET', '/document-catalogs', main)).body as unknown as Array<{
      kind: string;
      name: string;
    }>;
    assert.equal(catalog.filter((item) => item.kind === 'form').length, 36);
    assert.deepEqual(
      catalog.filter((item) => item.kind === 'urgency').map((item) => item.name),
      ['Thường', 'Khẩn', 'Hỏa tốc'],
    );
    assert.deepEqual(
      catalog.filter((item) => item.kind === 'secrecy').map((item) => item.name),
      ['Thường', 'Mật', 'Tối mật'],
    );
    const forbidden = await api('POST', '/external-units', main, { code: 'X', name: 'X' });
    assert.equal(forbidden.status, 403);
    const unit = await api('POST', '/external-units', clerk, {
      code: 'PGD',
      name: 'Phòng Giáo dục thử',
      email: 'pgd@example.test',
    });
    assert.equal(unit.status, 201, JSON.stringify(unit.body));
    unitId = unit.body.id as string;
    const duplicate = await api('POST', '/external-units', clerk, { code: 'PGD', name: 'Trùng' });
    assert.equal(duplicate.status, 409);
    const group = await api('POST', '/external-unit-groups', clerk, { name: 'Cấp trên', unit_ids: [unitId] });
    assert.equal(group.status, 201, JSON.stringify(group.body));
    assert.deepEqual(group.body.unit_names, ['Phòng Giáo dục thử']);
    const leaders = await api('PUT', '/document-leaders', clerk, {
      leaders: [{ user_id: principal.userId, title: 'Hiệu trưởng' }, { user_id: deputy.userId }],
    });
    assert.equal(leaders.status, 200, JSON.stringify(leaders.body));
    const notStaff = await api('PUT', '/document-leaders', clerk, {
      leaders: [{ user_id: '00000000-0000-4000-8000-000000000009' }],
    });
    assert.deepEqual(fieldsOf(notStaff.body), ['leaders']);
    const year = Number(today().slice(0, 4));
    const book = await api('POST', '/document-books', clerk, {
      name: 'Sổ văn bản đến',
      year,
      start_number: 5,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      follower_ids: [deputy.userId],
      admin_ids: [clerk.userId],
    });
    assert.equal(book.status, 201, JSON.stringify(book.body));
    bookId = book.body.id as string;
    assert.equal(book.body.next_number, 5);
    assert.deepEqual(
      (book.body.followers as Array<{ user_name: string }>).map((item) => item.user_name),
      ['Phó hiệu trưởng Thử'],
    );
    // Hình thức đang dùng ở văn bản thì không xóa được
    const form = catalog.find((item) => item.kind === 'form') as unknown as { id: string };
    await register({ form_id: form.id });
    const remove = await api('DELETE', `/document-catalogs/${form.id}`, clerk);
    assert.equal(remove.status, 422, JSON.stringify(remove.body));
    assert.equal(errorOf(remove.body).rule_code, 'YCTD-138');
    const removeBook = await api('DELETE', `/document-books/${bookId}`, clerk);
    assert.equal(removeBook.status, 422);
  });

  it('CT-18a-3: vào sổ cấp số đến kế tiếp từ số bắt đầu; số nhập tay trùng báo lỗi; ngày đến ngoài thời gian áp dụng của sổ bị chặn; người không phải văn thư không vào sổ được', async () => {
    const next = await api('GET', `/incoming-documents/next-number?book_id=${bookId}`, clerk);
    assert.equal(next.body.next_number, 6);
    const created = await register();
    assert.equal(created.arrival_number, 6);
    assert.equal(created.status, 'registered');
    assert.equal(created.issuer_name, 'Phòng Giáo dục thử');
    const duplicate = await api('POST', '/incoming-documents', clerk, document({ arrival_number: 6 }));
    assert.equal(duplicate.status, 409);
    assert.deepEqual(fieldsOf(duplicate.body), ['arrival_number']);
    const manual = await register({ arrival_number: 50 });
    assert.equal(manual.arrival_number, 50);
    assert.equal((await register()).arrival_number, 51);
    const outside = await api('POST', '/incoming-documents', clerk, document({ arrival_date: '2001-01-01' }));
    assert.equal(outside.status, 422);
    const forbidden = await api('POST', '/incoming-documents', main, document());
    assert.equal(forbidden.status, 403);
    const missing = await api('POST', '/incoming-documents', clerk, { book_id: bookId });
    assert.deepEqual(fieldsOf(missing.body), ['arrival_date', 'document_date', 'issuer_name', 'summary', 'symbol']);
  });

  it('CT-18a-4: luồng trình lãnh đạo, chuyển xử lý chính, phối hợp, xem để biết; từ chối phối hợp; xin gia hạn và đồng ý; xử lý xong; lãnh đạo kết thúc văn bản', async () => {
    const created = await register({ deadline: addDays(today(), 10) });
    const id = created.id as string;
    // Chưa có tệp đính kèm thì chưa chuyển được
    const noFile = await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'leader',
      recipients: [{ user_id: principal.userId }],
    });
    assert.equal(noFile.status, 422, JSON.stringify(noFile.body));
    const uploaded = await upload(id, clerk);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    assert.equal((uploaded.body.files as Array<{ scanned: boolean }>)[0]?.scanned, true);
    const notLeader = await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'leader',
      recipients: [{ user_id: main.userId }],
    });
    assert.deepEqual(fieldsOf(notLeader.body), ['recipients']);
    const submitted = await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'leader',
      recipients: [{ user_id: principal.userId }],
      note: 'Kính trình Hiệu trưởng',
    });
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    assert.equal(submitted.body.status, 'processing');
    const inbox = await list(principal, 'view=inbox');
    assert.ok(inbox.items.some((item) => item.id === id && item.my_role === 'leader' && item.unread === true));
    // Người ngoài luồng không xem được
    assert.equal((await api('GET', `/incoming-documents/${id}`, outsider)).status, 404);
    const forwarded = await api('POST', `/incoming-documents/${id}/transfer`, principal, {
      mode: 'process',
      note: 'Giao chuyên viên chủ trì',
      recipients: [
        { user_id: main.userId, role: 'main', deadline: addDays(today(), 5) },
        { user_id: partner.userId, role: 'coordinate' },
        { user_id: viewer.userId, role: 'view' },
      ],
    });
    assert.equal(forwarded.status, 200, JSON.stringify(forwarded.body));
    const leaderRow = (forwarded.body.assignments as Array<Body>).find((row) => row.role === 'leader');
    assert.equal(leaderRow?.status, 'forwarded');
    assert.equal(leaderRow?.result_note, 'Giao chuyên viên chủ trì');
    const mainList = await list(main, 'view=inbox&role=main');
    assert.equal(mainList.items.filter((item) => item.id === id).length, 1);
    assert.equal((await list(main, 'view=inbox&role=coordinate')).items.filter((item) => item.id === id).length, 0);
    // Người xem để biết mở văn bản là xong
    const seen = await api('GET', `/incoming-documents/${id}`, viewer);
    assert.equal(seen.status, 200);
    assert.equal((seen.body.assignments as Array<Body>).find((row) => row.role === 'view')?.status, 'done');
    assert.ok((await list(viewer, 'view=for_information')).items.some((item) => item.id === id));
    // Phối hợp từ chối phải ghi lý do
    const noReason = await api('POST', `/incoming-documents/${id}/refuse`, partner, {});
    assert.deepEqual(fieldsOf(noReason.body), ['note']);
    const refused = await api('POST', `/incoming-documents/${id}/refuse`, partner, { note: 'Không thuộc phần việc' });
    assert.equal(refused.status, 200, JSON.stringify(refused.body));
    // Xử lý chính xin gia hạn, lãnh đạo đồng ý
    const early = await api('POST', `/incoming-documents/${id}/extension`, main, {
      until: addDays(today(), 3),
      reason: 'x',
    });
    assert.deepEqual(fieldsOf(early.body), ['until']);
    const extension = await api('POST', `/incoming-documents/${id}/extension`, main, {
      until: addDays(today(), 20),
      reason: 'Chờ số liệu của tổ',
    });
    assert.equal(extension.status, 200, JSON.stringify(extension.body));
    const mainRow = (extension.body.assignments as Array<Body>).find((row) => row.role === 'main') as Body;
    const notAllowed = await api('POST', `/incoming-documents/${id}/extension/decide`, viewer, {
      assignment_id: mainRow.id,
      approve: true,
    });
    assert.equal(notAllowed.status, 403);
    const approved = await api('POST', `/incoming-documents/${id}/extension/decide`, principal, {
      assignment_id: mainRow.id,
      approve: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.deadline, addDays(today(), 20));
    assert.equal(
      (approved.body.assignments as Array<Body>).find((row) => row.role === 'main')?.deadline,
      addDays(today(), 20),
    );
    const finished = await api('POST', `/incoming-documents/${id}/finish`, main, { note: 'Đã triển khai' });
    assert.equal(finished.status, 200, JSON.stringify(finished.body));
    assert.ok((await list(main, 'view=processed')).items.some((item) => item.id === id));
    const completed = await api('POST', `/incoming-documents/${id}/complete`, principal, { note: 'Kết thúc' });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.status, 'completed');
    const again = await api('POST', `/incoming-documents/${id}/complete`, principal, {});
    assert.equal(again.status, 422);
    const actions = (completed.body.events as Array<{ action: string }>).map((event) => event.action);
    for (const action of [
      'register',
      'file_add',
      'submit_leader',
      'forward',
      'refuse',
      'request_extension',
      'approve_extension',
      'finish',
      'complete',
    ]) {
      assert.ok(actions.includes(action), action);
    }
  });

  it('CT-18a-5: chuyển trực tiếp, lấy lại khi người nhận chưa xử lý; trả lại về văn thư; đã chuyển tiếp thì không lấy lại được; luân chuyển giữ vai trò', async () => {
    const id = (await register()).id as string;
    await upload(id, clerk);
    const direct = await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: main.userId, role: 'main' }],
    });
    assert.equal(direct.status, 200, JSON.stringify(direct.body));
    assert.ok((direct.body.events as Array<{ action: string }>).some((event) => event.action === 'direct'));
    const revoked = await api('POST', `/incoming-documents/${id}/revoke`, clerk);
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    assert.equal(revoked.body.status, 'registered');
    assert.equal(
      (await list(main, 'view=inbox')).items.some((item) => item.id === id),
      false,
    );
    await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: main.userId, role: 'main' }],
    });
    const returned = await api('POST', `/incoming-documents/${id}/return`, main, { note: 'Không đúng người xử lý' });
    assert.equal(returned.status, 200, JSON.stringify(returned.body));
    assert.equal(returned.body.status, 'registered');
    await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: main.userId, role: 'main' }],
    });
    const rotated = await api('POST', `/incoming-documents/${id}/transfer`, main, {
      mode: 'rotate',
      recipients: [{ user_id: partner.userId, role: 'view' }],
      note: 'Chuyển đồng nghiệp xử lý thay',
    });
    assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
    const partnerRow = (rotated.body.assignments as Array<Body>).find((row) => row.user_id === partner.userId);
    assert.equal(partnerRow?.role, 'main');
    assert.equal(partnerRow?.parent_id, null);
    // Văn thư không lấy lại được khi người nhận đã chuyển tiếp
    const late = await api('POST', `/incoming-documents/${id}/revoke`, clerk);
    assert.equal(late.status, 422, JSON.stringify(late.body));
    // Người đang chờ không nhận thêm một lần chuyển nữa
    const busy = await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: partner.userId, role: 'coordinate' }],
    });
    assert.equal(busy.status, 422);
    const self = await api('POST', `/incoming-documents/${id}/transfer`, partner, {
      mode: 'process',
      recipients: [{ user_id: partner.userId, role: 'main' }],
    });
    assert.deepEqual(fieldsOf(self.body), ['recipients']);
  });

  it('CT-18a-6: hạn chế xem: người tra cứu, người theo dõi sổ không còn thấy; người trong luồng vẫn thấy; bỏ hạn chế thì thấy lại', async () => {
    const id = (await register()).id as string;
    await upload(id, clerk);
    await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: viewer.userId, role: 'view' }],
    });
    assert.equal((await api('GET', `/incoming-documents/${id}`, deputy)).status, 200);
    assert.ok((await list(deputy, 'view=search')).items.some((item) => item.id === id));
    const forbidden = await api('POST', `/incoming-documents/${id}/restrict`, main, { restricted: true });
    assert.equal(forbidden.status, 404);
    const restricted = await api('POST', `/incoming-documents/${id}/restrict`, principal, { restricted: true });
    assert.equal(restricted.status, 200, JSON.stringify(restricted.body));
    assert.equal(restricted.body.restricted, true);
    assert.equal((await api('GET', `/incoming-documents/${id}`, deputy)).status, 404);
    assert.equal(
      (await list(deputy, 'view=search')).items.some((item) => item.id === id),
      false,
    );
    assert.equal((await api('GET', `/incoming-documents/${id}`, viewer)).status, 200);
    // Sổ văn bản che trích yếu của văn bản hạn chế xem
    const book = await api('GET', `/document-books/${bookId}/register`, clerk);
    const row = (book.body.items as Array<Body>).find((item) => item.id === id);
    assert.equal(row?.summary, '(Văn bản hạn chế xem)');
    await api('POST', `/incoming-documents/${id}/restrict`, principal, { restricted: false });
    assert.equal((await api('GET', `/incoming-documents/${id}`, deputy)).status, 200);
  });

  it('CT-18a-7: liên thông bản chạy nội bộ: nhập văn bản nhận được, đánh dấu tiếp nhận, hủy đánh dấu, vào sổ thì có số đến', async () => {
    const received = await api('POST', '/incoming-documents/interconnect', clerk, {
      summary: 'Văn bản nhận qua trục',
      symbol: '9/TB-SGD',
      issuer_name: 'Sở thử',
      document_date: '2026-10-02',
    });
    assert.equal(received.status, 201, JSON.stringify(received.body));
    const id = received.body.id as string;
    assert.equal(received.body.status, 'pending_registration');
    assert.equal(received.body.arrival_number, null);
    assert.equal((received.body.exchange as { connected: boolean }).connected, false);
    assert.ok((await list(clerk, 'view=interconnect')).items.some((item) => item.id === id));
    assert.equal((await api('GET', '/incoming-documents?view=interconnect', main)).status, 403);
    const acknowledged = await api('POST', `/incoming-documents/${id}/acknowledge`, clerk, { reference: 'MA-THU-1' });
    assert.equal(acknowledged.body.interconnect_status, 'acknowledged');
    assert.equal(acknowledged.body.acknowledged_by_name !== null, true);
    const undone = await api('POST', `/incoming-documents/${id}/acknowledge`, clerk, { acknowledged: false });
    assert.equal(undone.body.interconnect_status, 'received');
    const registered = await api('POST', `/incoming-documents/${id}/register`, clerk, {
      book_id: bookId,
      arrival_date: today(),
    });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    assert.equal(registered.body.status, 'registered');
    assert.ok(Number(registered.body.arrival_number) > 51);
    const twice = await api('POST', `/incoming-documents/${id}/register`, clerk, {
      book_id: bookId,
      arrival_date: today(),
    });
    assert.equal(twice.status, 422);
  });

  it('CT-18a-8: đánh dấu, theo dõi, chưa đọc; kết thúc hàng loạt báo từng văn bản; lưu hồ sơ hàng loạt vào hồ sơ tài liệu; văn bản trả lời', async () => {
    const first = (await register()).id as string;
    const second = (await register()).id as string;
    await upload(first, clerk);
    await api('POST', `/incoming-documents/${first}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: main.userId, role: 'main' }],
    });
    const starred = await api('POST', '/incoming-documents/flags', main, {
      ids: [first],
      starred: true,
      followed: true,
    });
    assert.equal(starred.status, 200, JSON.stringify(starred.body));
    assert.ok((await list(main, 'view=starred')).items.some((item) => item.id === first));
    assert.ok((await list(main, 'view=followed')).items.some((item) => item.id === first));
    const hidden = await api('POST', '/incoming-documents/flags', main, { ids: [second], starred: true });
    assert.equal(hidden.status, 404);
    await api('GET', `/incoming-documents/${first}`, main);
    const unread = await api('POST', `/incoming-documents/${first}/unread`, main);
    assert.equal(unread.status, 200);
    assert.equal((await list(main, 'view=inbox')).items.find((item) => item.id === first)?.unread, true);
    const reply = await api('POST', `/incoming-documents/${first}/reply`, main, {
      reply_symbol: '45/TB-MN',
      reply_date: today(),
    });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    assert.equal(reply.body.reply_symbol, '45/TB-MN');
    const record = await api('POST', '/archive-records', principal, {
      code: 'HS-VBD-1',
      title: 'Hồ sơ văn bản đến',
      handler_name: 'Văn thư Thử',
      opened_on: today(),
      status: 'pending',
      retention: 'permanent',
    });
    assert.equal(record.status, 201, JSON.stringify(record.body));
    const archived = await api('POST', '/incoming-documents/archive', clerk, {
      ids: [first, second],
      archive_record_id: record.body.id,
    });
    assert.deepEqual(
      (archived.body as unknown as Array<{ ok: boolean }>).map((item) => item.ok),
      [true, true],
    );
    const detail = await api('GET', `/incoming-documents/${second}`, clerk);
    assert.equal(detail.body.archive_record_code, 'HS-VBD-1');
    // Người xử lý chính kết thúc được văn bản của mình, văn bản không trong luồng thì báo lý do
    const results = await api('POST', '/incoming-documents/complete', main, { ids: [first, second] });
    const byId = new Map(
      (results.body as unknown as Array<{ id: string; ok: boolean }>).map((item) => [item.id, item.ok]),
    );
    assert.equal(byId.get(first), true);
    assert.equal(byId.get(second), false);
  });

  it('CT-18a-9: quá hạn, đến hạn trên danh sách và bộ lọc; in phiếu trình, phiếu xử lý, phiếu giao nhận ra PDF; sổ văn bản đến xem và xuất Excel', async () => {
    const late = (await register({ deadline: addDays(today(), -1) })).id as string;
    const soon = (await register({ deadline: today() })).id as string;
    const overdue = await list(clerk, 'view=registered&overdue=true');
    assert.ok(overdue.items.some((item) => item.id === late && item.overdue === true));
    assert.equal(
      overdue.items.some((item) => item.id === soon),
      false,
    );
    const dueSoon = await list(clerk, 'view=registered&due_soon=true');
    assert.ok(dueSoon.items.some((item) => item.id === soon && item.due_soon === true));
    await upload(late, clerk);
    await api('POST', `/incoming-documents/${late}/transfer`, clerk, {
      mode: 'leader',
      recipients: [{ user_id: principal.userId }],
    });
    for (const type of ['submission', 'processing', 'handover']) {
      const response = await fetch(`${environment.baseUrl}/incoming-documents/${late}/slips/${type}`, {
        headers: { authorization: `Bearer ${principal.accessToken}` },
      });
      assert.equal(response.status, 200, type);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(
        Buffer.from(await response.arrayBuffer())
          .subarray(0, 4)
          .toString(),
        '%PDF',
      );
    }
    const blocked = await fetch(`${environment.baseUrl}/incoming-documents/${late}/slips/submission`, {
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    assert.equal(blocked.status, 404);
    const registerBook = await api('GET', `/document-books/${bookId}/register?from=${today()}&to=${today()}`, clerk);
    assert.equal(registerBook.status, 200, JSON.stringify(registerBook.body));
    const rows = registerBook.body.items as Array<Body>;
    assert.ok(rows.some((row) => row.id === late && row.recipients === 'Hiệu trưởng Thử'));
    assert.equal((await api('GET', `/document-books/${bookId}/register`, main)).status, 403);
    const exported = await fetch(`${environment.baseUrl}/document-books/${bookId}/register/export`, {
      headers: { authorization: `Bearer ${clerk.accessToken}` },
    });
    assert.equal(exported.status, 200);
    assert.ok(exported.headers.get('x-export-log-id'));
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'incoming_document_register')
      .execute();
    assert.equal(logs.length, 1);
  });

  it('CT-18a-10: xóa văn bản chưa chuyển xử lý (kèm tệp), văn bản đã chuyển không xóa được; tệp chỉ người tải lên hoặc văn thư xóa', async () => {
    const id = (await register()).id as string;
    const uploaded = await upload(id, clerk);
    const fileId = (uploaded.body.files as Array<{ id: string }>)[0]?.id as string;
    const download = await fetch(`${environment.baseUrl}/incoming-documents/${id}/files/${fileId}`, {
      headers: { authorization: `Bearer ${clerk.accessToken}` },
    });
    assert.equal(download.status, 200);
    await api('POST', `/incoming-documents/${id}/transfer`, clerk, {
      mode: 'process',
      recipients: [{ user_id: main.userId, role: 'main' }],
    });
    const mainFile = await upload(id, main);
    assert.equal(mainFile.status, 200, JSON.stringify(mainFile.body));
    const clerkFile = (mainFile.body.files as Array<{ id: string; created_by_name: string }>).find(
      (file) => file.id === fileId,
    );
    assert.ok(clerkFile);
    const notMine = await api('DELETE', `/incoming-documents/${id}/files/${fileId}`, main);
    assert.equal(notMine.status, 422);
    const blocked = await api('DELETE', `/incoming-documents/${id}`, clerk);
    assert.equal(blocked.status, 422);
    const fresh = (await register()).id as string;
    await upload(fresh, clerk);
    const removed = await api('DELETE', `/incoming-documents/${fresh}`, clerk);
    assert.equal(removed.status, 204);
    assert.equal((await api('GET', `/incoming-documents/${fresh}`, clerk)).status, 404);
  });
});
