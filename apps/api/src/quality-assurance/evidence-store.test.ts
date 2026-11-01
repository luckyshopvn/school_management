import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { bracketEvidenceCode, evidenceValidity } from '@school-management/shared';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Kho minh chứng dùng chung (YCTD-396 lát L1); kịch bản CT-2130 đến CT-2135 (trong mã kiểm thử là CT-396-1 đến CT-396-6), lát L2 thêm CT-396-8, CT-396-9, lát L2b thêm CT-396-11, CT-396-12, lát L3 thêm CT-396-14, CT-396-15, lát L4 thêm CT-396-17.
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
  let schoolYear: Kysely<SchoolYearDatabase>;
  const users: Record<string, LoggedInUser> = {};
  const criteria: Record<string, string> = {};
  const evidences: Record<string, string> = {};
  let frameworkId = '';
  let otherFrameworkId = '';
  let otherCriterionId = '';
  let unit = '';

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
    const registry = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, registry.database_name),
    );
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
    await schoolYear.destroy();
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

  it('CT-396-8: nguồn thống kê đội ngũ (lát L2): ô chọn có toàn trường, gắn chụp PDF không có dữ liệu cá nhân, tra minh chứng theo bản ghi; người không có quyền xem thống kê không gắn được; mã bản ghi sai bị từ chối', async () => {
    unit = (await api('POST', '/org-units', 'principal', { code: 'TC', name: 'TC', unit_type: 'truong_chinh' })).body
      .id as string;
    const options = (await api('GET', '/quality/evidences/sources?record_type=staff_qualification', 'principal'))
      .body as unknown as Array<{ id: string }>;
    assert.equal(options[0]?.id, 'toan-truong');
    const base = {
      framework_id: frameworkId,
      node_id: criteria['2.2'],
      title: 'Thống kê đội ngũ theo trình độ thử',
      record_type: 'staff_qualification',
      record_id: 'toan-truong',
    };
    assert.equal((await api('POST', '/quality/evidences', 'teacher', base)).status, 403);
    assert.equal(
      (await api('POST', '/quality/evidences', 'principal', { ...base, record_id: 'khong-co' })).status,
      400,
    );
    const created = await api('POST', '/quality/evidences', 'principal', base);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const detail = await api('GET', `/quality/evidences/${created.body.id}`, 'principal');
    assert.equal(detail.body.has_personal_data, false);
    assert.equal(detail.body.status, 'sufficient');
    const file = await download(`/quality/evidences/${created.body.id}/file`, 'principal');
    assert.equal(file.body.subarray(0, 4).toString(), '%PDF');
    const used = (
      await api(
        'GET',
        '/quality/evidences/by-record?record_type=staff_qualification&record_id=toan-truong',
        'principal',
      )
    ).body as unknown as Array<{ display_code: string }>;
    assert.deepEqual(
      used.map((row) => row.display_code),
      [created.body.display_code],
    );
  });

  it('CT-396-9: nguồn phiếu đánh giá chuẩn nghề nghiệp (lát L2): bản chụp có dữ liệu cá nhân, chỉ người có quyền quản lý hoặc đánh giá chuẩn tải được', async () => {
    const staff = await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: unit,
        code: 'NS-CN-1',
        full_name: 'Giáo Viên Chuẩn Thử',
        start_date: addDays(vietnamToday, -300),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const evaluation = await schoolYear
      .insertInto('professional_evaluations')
      .values({ staff_id: staff.id, org_unit_id: unit, standard_type: 'teacher', opened_by: principal.userId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const options = (
      await api('GET', '/quality/evidences/sources?record_type=professional_evaluation&q=Chuẩn', 'principal')
    ).body as unknown as Array<{ id: string }>;
    assert.ok(options.some((row) => row.id === evaluation.id));
    const created = await api('POST', '/quality/evidences', 'principal', {
      framework_id: frameworkId,
      node_id: criteria['2.2'],
      title: 'Phiếu đánh giá chuẩn của giáo viên thử',
      record_type: 'professional_evaluation',
      record_id: evaluation.id,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id as string;
    const detail = await api('GET', `/quality/evidences/${id}`, 'teacher');
    assert.equal(detail.body.has_personal_data, true);
    assert.equal(detail.body.can_download, false);
    assert.equal((await download(`/quality/evidences/${id}/file`, 'teacher')).status, 403);
    assert.equal((await download(`/quality/evidences/${id}/file`, 'principal')).status, 200);
  });

  it('CT-396-11: nguồn hồ sơ công việc (lát L2b): người lập tìm và gắn, bản chụp PDF có thành phần hồ sơ; người khác không thuộc hồ sơ không gắn được', async () => {
    const file = await environment.system
      .insertInto('work_files')
      .values({
        code: 'HS-THU-01',
        title: 'Hồ sơ kiểm tra nội bộ thử',
        year: Number(vietnamToday.slice(0, 4)),
        owner_user_id: principal.userId,
        owner_name: 'Hiệu Trưởng Giả',
        opened_on: addDays(vietnamToday, -30),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await environment.system
      .insertInto('work_file_items')
      .values({
        file_id: file.id,
        item_type: 'note',
        title: 'Biên bản kiểm tra thử',
        added_by: principal.userId,
        added_by_name: 'Hiệu Trưởng Giả',
      })
      .execute();
    const options = (await api('GET', '/quality/evidences/sources?record_type=work_file&q=kiểm tra', 'principal'))
      .body as unknown as Array<{ id: string }>;
    assert.ok(options.some((row) => row.id === file.id));
    const base = {
      framework_id: frameworkId,
      node_id: criteria['1.6'],
      title: 'Hồ sơ kiểm tra nội bộ thử',
      record_type: 'work_file',
      record_id: file.id,
    };
    assert.notEqual((await api('POST', '/quality/evidences', 'teacher', base)).status, 201);
    const created = await api('POST', '/quality/evidences', 'principal', base);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const pdf = await download(`/quality/evidences/${created.body.id}/file`, 'principal');
    assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  });

  it('CT-396-12: khóa ghép sai của sổ điểm, điểm danh, biểu đã gửi bị từ chối', async () => {
    for (const [type, id] of [
      ['score_book', 'khong-hop-le'],
      ['score_book', `${unit}:${unit}:ca_nam`],
      ['class_attendance', `${unit}:2026-13`],
    ] as const) {
      const response = await api('POST', '/quality/evidences', 'principal', {
        framework_id: frameworkId,
        node_id: criteria['1.6'],
        title: 'Khóa sai',
        record_type: type,
        record_id: id,
      });
      assert.equal(response.status, 400, `${type} ${id}`);
    }
  });

  it('CT-396-14: bộ tiêu chí có loại, đối tượng, mẫu mã riêng; mẫu mã sai bị từ chối; mã minh chứng cấp theo mẫu của bộ (lát L3)', async () => {
    const bad = await api('POST', '/quality/frameworks', 'principal', {
      code: 'TD-SAI',
      name: 'Mẫu mã sai',
      code_pattern: 'TD-{tieu_chi}',
    });
    assert.equal(bad.status, 400);
    const created = await api('POST', '/quality/frameworks', 'principal', {
      code: 'TD-2026',
      name: 'Thi đua năm học thử',
      kind: 'emulation',
      subject: 'school',
      code_pattern: 'TĐ{tieu_chuan}.{tieu_chi}.{stt}',
      cycle_years: 1,
      max_level: 1,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.kind, 'emulation');
    const id = created.body.id as string;
    const standard = (
      await api('POST', `/quality/frameworks/${id}/standards`, 'principal', { code: '3', title: 'Chuẩn' })
    ).body.id as string;
    const node = (
      await api('POST', `/quality/standards/${standard}/criteria`, 'principal', { code: '3.2', title: 'Tiêu chí thử' })
    ).body.id as string;
    const evidence = await api('POST', '/quality/evidences', 'teacher', {
      framework_id: id,
      node_id: node,
      title: 'Minh chứng thi đua thử',
    });
    assert.equal(evidence.status, 201, JSON.stringify(evidence.body));
    assert.equal(evidence.body.code, 'TĐ3.3.2.01');
  });

  it('CT-396-15: nạp bộ mẫu Tiểu học đủ chỉ báo; nhập chỉ báo từ Excel: dòng lỗi thì không ghi dòng nào, đúng thì thêm và sửa nội dung (lát L3)', async () => {
    const loaded = await api('POST', '/quality/frameworks/defaults', 'principal', { school_level: 'TH' });
    assert.equal(loaded.body.created, 1, JSON.stringify(loaded.body));
    assert.ok((loaded.body.indicators_added as number) > 100);
    const frameworks = (await api('GET', '/quality/frameworks', 'principal')).body as unknown as Array<{
      id: string;
      code: string;
      criterion_count: number;
    }>;
    const th = frameworks.find((row) => row.code === 'TH-KDCL-2024');
    assert.equal(th?.criterion_count, 24);
    const template = await download(`/quality/frameworks/${th?.id}/indicators/template`, 'principal');
    assert.equal(template.status, 200);
    assert.equal(template.body.subarray(0, 2).toString(), 'PK');
    const workbook = async (rows: Array<[string, number | string, string, string]>) => {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet('Chỉ báo');
      sheet.addRow(['Mã tiêu chí', 'Mức', 'Mã chỉ báo', 'Nội dung']);
      for (const row of rows) {
        sheet.addRow(row);
      }
      return Buffer.from(await book.xlsx.writeBuffer());
    };
    const wrong = await upload(
      `/quality/frameworks/${th?.id}/indicators/import`,
      'principal',
      'chi-bao.xlsx',
      await workbook([
        ['1.1', 1, 'a', 'Nội dung sửa thử'],
        ['9.9', 1, 'a', 'Tiêu chí không có'],
      ]),
    );
    assert.equal(wrong.status, 200, JSON.stringify(wrong.body));
    assert.equal((wrong.body.errors as unknown[]).length, 1);
    assert.equal(wrong.body.created, 0);
    const right = await upload(
      `/quality/frameworks/${th?.id}/indicators/import`,
      'principal',
      'chi-bao.xlsx',
      await workbook([
        ['1.1', 1, 'a', 'Nội dung sửa thử'],
        ['1.1', 2, 'z', 'Chỉ báo thêm thử'],
      ]),
    );
    assert.deepEqual(right.body, { created: 1, updated: 1, errors: [] });
    assert.equal(
      (await upload(`/quality/frameworks/${th?.id}/indicators/import`, 'teacher', 'a.xlsx', PDF)).status,
      403,
    );
  });

  it('CT-396-17: phân công phụ trách, độ phủ, tổng quan, Việc của tôi (lát L4): tiêu chí chỉ đủ khi có minh chứng Đã đủ còn hiệu lực trong chu kỳ; người được phân công sửa được minh chứng của tiêu chí', async () => {
    const id = (
      await api('POST', '/quality/frameworks', 'principal', {
        code: 'PC-THU',
        name: 'Phân công thử',
        school_level: 'MN',
        max_level: 1,
        cycle_years: 2,
      })
    ).body.id as string;
    const standard = (
      await api('POST', `/quality/frameworks/${id}/standards`, 'principal', { code: '5', title: 'Chuẩn' })
    ).body.id as string;
    const nodes: Record<string, string> = {};
    for (const code of ['5.1', '5.2']) {
      nodes[code] = (
        await api('POST', `/quality/standards/${standard}/criteria`, 'principal', { code, title: `Tiêu chí ${code}` })
      ).body.id as string;
    }
    await schoolYear
      .insertInto('staff')
      .values({
        org_unit_id: unit,
        code: 'GV-PC',
        full_name: 'Giáo viên phụ trách thử',
        start_date: '2025-08-01',
        user_id: users.teacher2?.userId ?? null,
      })
      .execute();
    const create = (nodeId: string, values: Record<string, unknown>) =>
      api('POST', '/quality/evidences', 'teacher', { framework_id: id, node_id: nodeId, ...values });
    const first = await create(nodes['5.1'] ?? '', { title: 'Biên bản phân công thử', status: 'collecting' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    // Đã đủ nhưng chỉ dùng cho năm học ngoài chu kỳ, và Đã đủ nhưng hết hiệu lực: tiêu chí 5.2 vẫn thiếu
    await create(nodes['5.2'] ?? '', {
      title: 'Minh chứng năm cũ',
      status: 'sufficient',
      school_year_names: ['2000-2001'],
    });
    await create(nodes['5.2'] ?? '', {
      title: 'Minh chứng hết hạn',
      status: 'sufficient',
      valid_until: addDays(vietnamToday, -1),
    });

    const path = `/quality/evidences/${first.body.id as string}`;
    const edit = { framework_id: id, title: 'Biên bản phân công thử', status: 'sufficient' };
    assert.equal((await api('PUT', path, 'teacher2', edit)).status, 403);
    const assignments = { framework_id: id, node_ids: [nodes['5.1'], nodes['5.2']], user_id: users.teacher2?.userId };
    assert.equal((await api('PUT', '/quality/evidences/assignments', 'teacher', assignments)).status, 403);
    const notStaff = await api('PUT', '/quality/evidences/assignments', 'principal', {
      ...assignments,
      user_id: users.parent?.userId,
    });
    assert.equal(notStaff.status, 422, JSON.stringify(notStaff.body));
    const due = addDays(vietnamToday, 1);
    const assigned = await api('PUT', '/quality/evidences/assignments', 'principal', { ...assignments, due_date: due });
    assert.deepEqual(assigned.body, { assigned: 2, removed: 0 });
    // Người được phân công sửa được minh chứng của tiêu chí mình phụ trách
    assert.equal((await api('PUT', path, 'teacher2', edit)).status, 200);

    const coverage = await api('GET', `/quality/evidences/coverage?framework_id=${id}`, 'teacher');
    assert.equal(coverage.status, 200, JSON.stringify(coverage.body));
    const rows = coverage.body.criteria as Array<{
      code: string;
      covered: boolean;
      sufficient: number;
      expired: number;
      out_of_cycle: number;
      assignee: { user_name: string; due_date: string } | null;
    }>;
    assert.deepEqual(
      rows.map((row) => [row.code, row.covered, row.sufficient, row.expired, row.out_of_cycle]),
      [
        ['5.1', true, 1, 0, 0],
        ['5.2', false, 0, 1, 1],
      ],
    );
    assert.equal(rows[1]?.assignee?.user_name, 'Giáo viên phụ trách thử');
    assert.equal(rows[1]?.assignee?.due_date, due);
    assert.equal(coverage.body.covered_percent, 50);
    assert.equal((coverage.body.cycle_year_names as string[]).length >= 1, true);

    const overview = await api('GET', '/quality/evidences/overview', 'principal');
    const summary = (
      overview.body.frameworks as Array<{ code: string; covered_count: number; missing: Array<{ code: string }> }>
    ).find((row) => row.code === 'PC-THU');
    assert.equal(summary?.covered_count, 1);
    assert.deepEqual(
      summary?.missing.map((row) => row.code),
      ['5.2'],
    );
    const mine = (await api('GET', '/quality/evidences/overview', 'teacher2')).body.mine as Array<{ code: string }>;
    assert.deepEqual(
      mine.map((row) => row.code),
      ['5.1', '5.2'],
    );

    const work = await api('GET', '/my-work?source=evidence', 'teacher2');
    assert.equal(work.status, 200, JSON.stringify(work.body));
    const items = work.body.items as Array<{ kind: string; title: string; due_soon: boolean }>;
    const missing = items.filter((row) => row.kind === 'Tiêu chí thiếu minh chứng');
    assert.deepEqual(
      missing.map((row) => row.title),
      ['Tiêu chí 5.2: Tiêu chí 5.2'],
    );
    assert.equal(missing[0]?.due_soon, true);

    const removed = await api('PUT', '/quality/evidences/assignments', 'principal', { ...assignments, user_id: null });
    assert.deepEqual(removed.body, { assigned: 0, removed: 2 });
    assert.equal((await api('PUT', path, 'teacher2', edit)).status, 403);
  });
});
