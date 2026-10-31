import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { bracketEvidenceCode, evidenceValidity } from '@school-management/shared';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Kho minh chứng dùng chung (YCTD-396 lát L1); kịch bản CT-2130 đến CT-2135 (trong mã kiểm thử là CT-396-1 đến CT-396-6).
// Dữ liệu mẫu là dữ liệu giả
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Kho minh chứng: hàm dùng chung', () => {
  it('CT-396-1: hiệu lực tính từ ngày hết hạn (không thời hạn, còn, sắp hết trong 30 ngày, hết); mã hiển thị trong ngoặc vuông', () => {
    assert.equal(evidenceValidity(null, '2026-10-31'), 'none');
    assert.equal(evidenceValidity('2026-10-30', '2026-10-31'), 'expired');
    assert.equal(evidenceValidity('2026-10-31', '2026-10-31'), 'expiring');
    assert.equal(evidenceValidity('2026-11-30', '2026-10-31'), 'expiring');
    assert.equal(evidenceValidity('2026-12-01', '2026-10-31'), 'valid');
    assert.equal(bracketEvidenceCode('H1-1.1-01'), '[H1-1.1-01]');
  });
});

describe('Kho minh chứng', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  const users: Record<string, LoggedInUser> = {};
  const criteria: Record<string, string> = {};
  const evidences: Record<string, string> = {};
  let frameworkId = '';
  let otherFrameworkId = '';
  let otherCriterionId = '';

  const token = (name: string) => (name === 'principal' ? principal.accessToken : (users[name]?.accessToken ?? ''));
  const api = (method: string, path: string, name: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token(name), body);
  const download = async (path: string, name: string) => {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token(name)}` },
    });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
  };
  const upload = async (path: string, name: string, fileName: string, body: Buffer) => {
    const form = new FormData();
    form.append('file', new Blob([body]), fileName);
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token(name)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
    });
    users.teacher = await environment.loginAs('VT-07', null);
    users.teacher2 = await environment.loginAs('VT-07', null);
    users.parent = await environment.loginAs('VT-14', null);
    await api('POST', '/quality/frameworks/defaults', 'principal', { school_level: 'MN' });
    const store = (await api('GET', '/quality/evidences/frameworks', 'teacher')).body as unknown as {
      frameworks: Array<{ id: string; standards: Array<{ criteria: Array<{ id: string; code: string }> }> }>;
    };
    const framework = store.frameworks[0];
    assert.ok(framework);
    frameworkId = framework.id;
    for (const node of framework.standards.flatMap((standard) => standard.criteria)) {
      criteria[node.code] = node.id;
    }
    // Bộ thứ hai do trường tự lập: một tiêu chuẩn, một tiêu chí
    otherFrameworkId = (
      await api('POST', '/quality/frameworks', 'principal', {
        code: 'TD-THU',
        name: 'Thi đua thử',
        school_level: 'MN',
        max_level: 1,
      })
    ).body.id as string;
    const standard = (
      await api('POST', `/quality/frameworks/${otherFrameworkId}/standards`, 'principal', {
        code: '2',
        title: 'Chuẩn thử',
      })
    ).body.id as string;
    otherCriterionId = (
      await api('POST', `/quality/standards/${standard}/criteria`, 'principal', { code: '2.1', title: 'Tiêu chí thử' })
    ).body.id as string;
  });

  after(async () => {
    await environment.close();
  });

  it('CT-396-2: một minh chứng có mã riêng ở từng bộ; gắn trùng bộ bị từ chối; phụ huynh không vào được kho', async () => {
    assert.equal((await api('GET', '/quality/evidences/frameworks', 'parent')).status, 403);
    const created = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: frameworkId,
      node_id: criteria['1.1'],
      title: 'Biên bản họp hội đồng trường thử',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.display_code, '[H1-1.1-01]');
    evidences.minutes = created.body.id as string;
    const attached = await api('POST', `/quality/evidences/${evidences.minutes}/codes`, 'teacher', {
      framework_id: otherFrameworkId,
      node_id: otherCriterionId,
    });
    assert.equal(attached.status, 201, JSON.stringify(attached.body));
    assert.equal(attached.body.code, 'H2-2.1-01');
    const again = await api('POST', `/quality/evidences/${evidences.minutes}/codes`, 'teacher', {
      framework_id: otherFrameworkId,
      node_id: otherCriterionId,
    });
    assert.equal(errorOf(again.body).rule_code, 'YCTD-396');
    const other = (await api('GET', `/quality/evidences?framework_id=${otherFrameworkId}`, 'teacher'))
      .body as unknown as Array<{ code: string }>;
    assert.deepEqual(
      other.map((row) => row.code),
      ['H2-2.1-01'],
    );
    const detail = await api('GET', `/quality/evidences/${evidences.minutes}`, 'teacher');
    assert.equal((detail.body.codes as unknown[]).length, 2);
  });

  it('CT-396-3: bản ghi trong phần mềm chụp tệp lúc gắn; nguồn sửa sau thì báo đã thay đổi, chụp lại thành phiên bản mới, phiên bản cũ vẫn tải được', async () => {
    const storage = environment.api.get(FileStorage);
    await storage.put('thu/van-ban-den.pdf', PDF, 'application/pdf');
    const book = await environment.system
      .insertInto('document_books')
      .values({
        direction: 'incoming',
        name: 'Sổ văn bản đến thử',
        year: Number(vietnamToday.slice(0, 4)),
        start_date: addDays(vietnamToday, -60),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const document = await environment.system
      .insertInto('incoming_documents')
      .values({
        status: 'registered',
        book_id: book.id,
        arrival_number: 1,
        arrival_date: addDays(vietnamToday, -19),
        summary: 'Hướng dẫn nhiệm vụ năm học thử',
        symbol: '01/HD-THU',
        issuer_name: 'Phòng giáo dục thử',
        document_date: addDays(vietnamToday, -20),
        created_by: principal.userId,
        created_by_name: 'Hiệu Trưởng Giả',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await environment.system
      .insertInto('incoming_document_files')
      .values({
        document_id: document.id,
        file_name: 'van-ban-den.pdf',
        content_type: 'application/pdf',
        size_bytes: PDF.length,
        sha256: 'thu',
        storage_key: 'thu/van-ban-den.pdf',
        created_by: principal.userId,
        created_by_name: 'Hiệu Trưởng Giả',
      })
      .execute();
    const sources = (await api('GET', '/quality/evidences/sources?record_type=incoming_document&q=01', 'teacher'))
      .body as unknown as Array<{ id: string }>;
    assert.ok(sources.some((row) => row.id === document.id));
    const created = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: frameworkId,
      node_id: criteria['1.2'],
      title: 'Hướng dẫn nhiệm vụ năm học thử',
      record_type: 'incoming_document',
      record_id: document.id,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    evidences.guide = created.body.id as string;
    let detail = await api('GET', `/quality/evidences/${evidences.guide}`, 'teacher');
    assert.equal(detail.body.status, 'sufficient');
    assert.equal(detail.body.source_changed, false);
    const versions = detail.body.versions as Array<{ version_no: number; source_kind: string; has_file: boolean }>;
    assert.deepEqual(
      versions.map((row) => [row.version_no, row.source_kind, row.has_file]),
      [[1, 'record', true]],
    );
    await environment.system
      .updateTable('incoming_documents')
      .set({ updated_at: new Date(Date.now() + 60_000) })
      .where('id', '=', document.id)
      .execute();
    detail = await api('GET', `/quality/evidences/${evidences.guide}`, 'teacher');
    assert.equal(detail.body.source_changed, true);
    const recaptured = await api('POST', `/quality/evidences/${evidences.guide}/versions`, 'teacher', {
      record_type: 'incoming_document',
      record_id: document.id,
    });
    assert.equal(recaptured.body.version_no, 2);
    const first = await download(`/quality/evidences/${evidences.guide}/file?version=1`, 'teacher');
    assert.equal(first.status, 200);
    assert.equal(first.body.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-396-4: tệp có dữ liệu cá nhân chỉ người có quyền xem nguồn tải được, kể cả người quản lý kho; mọi lần tải ghi nhật ký, chỉ người quản lý xem nhật ký truy cập', async () => {
    const uploaded = await upload(`/quality/evidences/${evidences.minutes}/versions`, 'teacher', 'bien-ban.pdf', PDF);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
    await environment.system
      .updateTable('evidence_items')
      .set({ has_personal_data: true, personal_data_permission: 'P09.evidence.contribute' })
      .where('id', '=', evidences.minutes ?? '')
      .execute();
    assert.equal((await download(`/quality/evidences/${evidences.minutes}/file?download=true`, 'teacher')).status, 200);
    await environment.system
      .updateTable('evidence_items')
      .set({ personal_data_permission: 'P99.khong-ai-co' })
      .where('id', '=', evidences.minutes ?? '')
      .execute();
    assert.equal((await download(`/quality/evidences/${evidences.minutes}/file`, 'principal')).status, 403);
    const managerView = await api('GET', `/quality/evidences/${evidences.minutes}`, 'principal');
    assert.equal(managerView.body.can_download, false);
    const actions = (managerView.body.events as Array<{ action: string; actor_name: string }>).map((row) => row.action);
    assert.ok(actions.includes('download_file'));
    const teacherView = await api('GET', `/quality/evidences/${evidences.minutes}`, 'teacher');
    assert.ok(!(teacherView.body.events as Array<{ action: string }>).some((row) => row.action === 'download_file'));
  });

  it('CT-396-5: hiệu lực: lọc hết hiệu lực, sắp hết hiệu lực; ngày hiệu lực trước ngày ban hành bị từ chối', async () => {
    const expired = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: frameworkId,
      node_id: criteria['3.1'],
      title: 'Biên bản kiểm tra phòng cháy thử',
      issued_date: addDays(vietnamToday, -400),
      valid_until: addDays(vietnamToday, -1),
    });
    assert.equal(expired.status, 201);
    const expiring = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: frameworkId,
      node_id: criteria['3.1'],
      title: 'Giấy chứng nhận an toàn thực phẩm thử',
      valid_until: addDays(vietnamToday, 10),
    });
    assert.equal(expiring.status, 201);
    const wrong = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: frameworkId,
      node_id: criteria['3.1'],
      title: 'Sai ngày',
      issued_date: vietnamToday,
      valid_until: addDays(vietnamToday, -1),
    });
    assert.equal(wrong.status, 400);
    const list = async (validity: string) =>
      (
        (await api('GET', `/quality/evidences?framework_id=${frameworkId}&validity=${validity}`, 'teacher'))
          .body as unknown as Array<{ id: string }>
      ).map((row) => row.id);
    assert.deepEqual(await list('expired'), [expired.body.id]);
    assert.deepEqual(await list('expiring'), [expiring.body.id]);
  });

  it('CT-396-6: người tạo, người quản lý sửa được; người đóng góp khác không sửa, không xóa; sửa tiêu chí dùng chung ghi lịch sử', async () => {
    const path = `/quality/evidences/${evidences.guide}`;
    const body = { framework_id: frameworkId, title: 'Hướng dẫn nhiệm vụ năm học thử (bản sửa)', status: 'sufficient' };
    assert.equal((await api('PUT', path, 'teacher2', body)).status, 403);
    assert.equal((await api('DELETE', path, 'teacher2')).status, 403);
    const updated = await api('PUT', path, 'teacher', { ...body, shared_node_ids: [criteria['1.3']] });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const code = (updated.body.codes as Array<{ framework_id: string; shared_nodes: Array<{ code: string }> }>).find(
      (row) => row.framework_id === frameworkId,
    );
    assert.deepEqual(
      code?.shared_nodes.map((node) => node.code),
      ['1.3'],
    );
    assert.ok((updated.body.events as Array<{ action: string }>).some((row) => row.action === 'link'));
    assert.equal((await api('PUT', path, 'principal', body)).status, 200);
  });
});
