import assert from 'node:assert/strict';
import { createHash, randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// DT-16 phần 16k: phân hệ Quản lý kí hồ sơ, bản chạy nội bộ. Kịch bản CT-16k-1 đến CT-16k-9
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const SEAL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const nextNationalId = () => `079${String(Date.now() % 1_000_000).padStart(6, '0')}${randomInt(100, 999)}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

interface ObjectRow {
  object_id: string;
  object_label: string;
  dossier: null | {
    id: string;
    code: string;
    status: string;
    file_sha256: string;
    signed_sha256: string | null;
    signature_method: string | null;
    changed_at: string | null;
    change_summary: string | null;
  };
}

describe('Quản lý kí hồ sơ, bản chạy nội bộ (DT-16 phần 16k)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let vicePrincipal: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let classId = '';
  let childId = '';
  let mother = '';
  const units: Record<string, string> = {};

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const objects = async (type: string, period?: string) => {
    const query = new URLSearchParams({ object_type: type, ...(period ? { period } : {}) });
    const response = await api('GET', `/signing/objects?${query.toString()}`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.items as ObjectRow[];
  };
  const dossierOf = async (type: string, objectId: string, period?: string) =>
    (await objects(type, period)).find((row) => row.object_id === objectId)?.dossier ?? null;
  async function download(path: string, token = principal.accessToken) {
    const response = await fetch(`${environment.baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  }
  async function uploadSeal(body: Buffer, name: string, token = principal.accessToken) {
    const form = new FormData();
    form.set('file', new Blob([body]), name);
    const response = await fetch(`${environment.baseUrl}/signing/certificate/seal`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  async function createChild(fullName: string) {
    const form = new FormData();
    form.set('org_unit_id', units.TC ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.TC,
      full_name: fullName,
      dob: '2021-03-04',
      gender: 'female',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body.id as string;
  }
  async function registerCertificate() {
    const saved = await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'remote',
      provider: 'Nhà cung cấp thử nghiệm',
      login_name: 'truong-thu-nghiem',
      holder_name: 'Hiệu trưởng Thử Nghiệm',
      holder_title: 'Hiệu trưởng',
      serial_number: 'SERI-0001',
      valid_from: '2026-01-01',
      valid_to: '2099-12-31',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const registered = await api('POST', '/signing/certificate/register', principal.accessToken);
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    vicePrincipal = await environment.loginAs('VT-15', null);
    teacher = await environment.loginAs('VT-07', null);
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-07', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', yearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    const root = await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường Mầm non Thử Nghiệm',
      unit_type: 'truong_chinh',
    });
    units.TC = root.body.id as string;
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'LA',
      name: 'Lá',
      age_from_months: 60,
      age_to_months: 71,
    });
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    mother = relationship.body.id as string;
    const created = await api('POST', '/classes', principal.accessToken, {
      org_unit_id: units.TC,
      code: 'LA1',
      name: 'Lớp Lá 1',
      grade_level: 'LA',
      max_size: 25,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    classId = created.body.id as string;
    childId = await createChild('Học Sinh Kí Hồ Sơ');
    // Hồ sơ học sinh chỉ lập cho học sinh đã duyệt; duyệt thẳng trong cơ sở dữ liệu cho gọn
    await schoolYear.updateTable('children').set({ status: 'active' }).where('id', '=', childId).execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-16k-1: quyền theo thao tác: Phó Hiệu trưởng lập hồ sơ nhưng không kí, không khai báo chứng thư; giáo viên không vào được', async () => {
    assert.equal((await api('GET', '/signing/certificate', teacher.accessToken)).status, 403);
    assert.equal((await api('GET', `/signing/objects?object_type=school`, teacher.accessToken)).status, 403);
    const view = await api('GET', '/signing/certificate', vicePrincipal.accessToken);
    assert.equal(view.status, 200);
    assert.equal(view.body.can_manage, false);
    assert.equal(view.body.digital_signer, false);
    const save = await api('PUT', '/signing/certificate', vicePrincipal.accessToken, { signature_type: 'remote' });
    assert.equal(save.status, 403);
    assert.equal((await uploadSeal(SEAL, 'con-dau.png', vicePrincipal.accessToken)).status, 403);
    const sign = await api('POST', '/signing/dossiers/sign', vicePrincipal.accessToken, {
      ids: ['00000000-0000-4000-8000-000000000000'],
    });
    assert.equal(sign.status, 403);
  });

  it('CT-16k-2: 1.1 Chứng thư số nhà trường: không lưu mật khẩu; đăng ký cần người đứng tên, nhà phát hành; ảnh con dấu PNG/JPEG; đã đăng ký thì khóa sửa', async () => {
    const withPassword = await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'remote',
      password: 'bi-mat',
    });
    assert.equal(withPassword.status, 400);
    assert.ok(errorOf(withPassword.body).details?.some((detail) => detail.field === 'password'));
    const badDates = await api('PUT', '/signing/certificate', principal.accessToken, {
      signature_type: 'remote',
      valid_from: '2027-01-01',
      valid_to: '2026-01-01',
    });
    assert.equal(badDates.status, 400);
    const empty = await api('PUT', '/signing/certificate', principal.accessToken, { signature_type: 'usb_token' });
    assert.equal(empty.status, 200);
    const missing = await api('POST', '/signing/certificate/register', principal.accessToken);
    assert.equal(missing.status, 422);
    assert.equal(errorOf(missing.body).rule_code, 'YCTD-130');
    assert.deepEqual(errorOf(missing.body).details?.map((detail) => detail.field).sort(), ['holder_name', 'provider']);

    const pdfSeal = await uploadSeal(Buffer.from('%PDF-1.4 tệp'), 'con-dau.pdf');
    assert.equal(pdfSeal.status, 400);
    const seal = await uploadSeal(SEAL, 'con-dấu.png');
    assert.equal(seal.status, 200, JSON.stringify(seal.body));
    assert.equal(seal.body.has_seal, true);
    assert.equal(seal.body.seal_file_name, 'con-dấu.png');
    const image = await download('/signing/certificate/seal');
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal(sha256(image.body), sha256(SEAL));

    await registerCertificate();
    const view = await api('GET', '/signing/certificate', principal.accessToken);
    assert.equal(view.body.status, 'registered');
    assert.equal(view.body.login_name, 'truong-thu-nghiem');
    const locked = await api('PUT', '/signing/certificate', principal.accessToken, { signature_type: 'remote' });
    assert.equal(locked.status, 422);
    assert.equal((await uploadSeal(SEAL, 'con-dau-moi.png')).status, 422);
    const events = view.body.events as Array<{ action: string }>;
    assert.ok(events.some((event) => event.action === 'certificate_register'));
    assert.ok(events.some((event) => event.action === 'seal_upload'));
  });

  it('CT-16k-3: 2.1 Đồng bộ chứng thư số: đánh dấu đã đồng bộ kèm ngày, không nhận ngày tương lai; đặt lại chưa đồng bộ', async () => {
    const future = await api('POST', '/signing/certificate/sync', principal.accessToken, { synced_on: '2999-01-01' });
    assert.equal(future.status, 400);
    const synced = await api('POST', '/signing/certificate/sync', principal.accessToken, {
      synced_on: '2026-09-15',
      note: 'Đăng ký đồng bộ trên hệ thống của Bộ',
    });
    assert.equal(synced.status, 200, JSON.stringify(synced.body));
    assert.equal(synced.body.sync_status, 'synced');
    assert.equal(synced.body.synced_on, '2026-09-15');
    const reset = await api('POST', '/signing/certificate/unsync', principal.accessToken);
    assert.equal(reset.body.sync_status, 'not_synced');
    assert.equal((await api('POST', '/signing/certificate/unsync', principal.accessToken)).status, 422);
  });

  it('CT-16k-4: 2.2 Tạo hồ sơ trường, lớp, học sinh, sổ đầu bài: cấp mã định danh, lưu tệp PDF kèm mã băm; không tạo trùng hồ sơ chưa hủy', async () => {
    const school = await objects('school');
    assert.equal(school.length, 1);
    assert.equal(school[0]?.object_label, 'Trường Mầm non Thử Nghiệm');
    assert.equal(school[0]?.dossier, null);
    for (const [type, id, period] of [
      ['school', units.TC, undefined],
      ['class', classId, undefined],
      ['child', childId, undefined],
      ['class_log', classId, '2026-10'],
    ] as const) {
      const created = await api('POST', '/signing/dossiers', vicePrincipal.accessToken, {
        object_type: type,
        object_ids: [id],
        ...(period ? { period } : {}),
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.match((created.body.codes as string[])[0] ?? '', /^KHS-\d{6}$/);
      const dossier = await dossierOf(type, id ?? '', period);
      assert.equal(dossier?.status, 'created');
      const file = await download(`/signing/dossiers/${dossier?.id}/file`);
      assert.equal(file.status, 200);
      assert.equal(file.body.subarray(0, 4).toString(), '%PDF');
      assert.equal(sha256(file.body), dossier?.file_sha256);
      assert.ok(file.headers.get('x-export-log-id'));
    }
    const duplicate = await api('POST', '/signing/dossiers', principal.accessToken, {
      object_type: 'class',
      object_ids: [classId],
    });
    assert.equal(duplicate.status, 422);
    assert.equal(errorOf(duplicate.body).rule_code, 'YCTD-130');
    const noMonth = await api('POST', '/signing/dossiers', principal.accessToken, {
      object_type: 'class_log',
      object_ids: [classId],
    });
    assert.equal(noMonth.status, 400);
    const unknown = await api('POST', '/signing/dossiers', principal.accessToken, {
      object_type: 'staff',
      object_ids: ['00000000-0000-4000-8000-000000000000'],
    });
    assert.equal(unknown.status, 404);
    // Sổ đầu bài tháng khác là hồ sơ khác
    assert.equal(await dossierOf('class_log', classId, '2026-11'), null);
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data'])
      .where('report_code', '=', 'signing-dossier')
      .execute();
    assert.equal(logs.length, 4);
    assert.equal(logs.filter((log) => log.contains_personal_data).length, 3);
  });

  it('CT-16k-5: Kí xác nhận nội bộ: chỉ khi chứng thư đã đăng ký; lập tệp đã kí khác tệp gốc, ghi người kí, cách kí "internal"', async () => {
    const dossier = await dossierOf('class', classId);
    await api('POST', '/signing/certificate/revoke', principal.accessToken);
    const notRegistered = await api('POST', '/signing/dossiers/sign', principal.accessToken, { ids: [dossier?.id] });
    assert.equal(notRegistered.status, 422);
    assert.equal(errorOf(notRegistered.body).rule_code, 'YCTD-130');
    await registerCertificate();
    const signed = await api('POST', '/signing/dossiers/sign', principal.accessToken, { ids: [dossier?.id] });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    const after = await dossierOf('class', classId);
    assert.equal(after?.status, 'signed');
    assert.equal(after?.signature_method, 'internal');
    const file = await download(`/signing/dossiers/${dossier?.id}/file?version=signed`);
    assert.equal(file.status, 200);
    assert.equal(file.body.subarray(0, 4).toString(), '%PDF');
    assert.equal(sha256(file.body), after?.signed_sha256);
    assert.notEqual(after?.signed_sha256, after?.file_sha256);
    const again = await api('POST', '/signing/dossiers/sign', principal.accessToken, { ids: [dossier?.id] });
    assert.equal(again.status, 422);
    const unsigned = await dossierOf('child', childId);
    assert.equal((await download(`/signing/dossiers/${unsigned?.id}/file?version=signed`)).status, 422);
    const detail = await api('GET', `/signing/dossiers/${dossier?.id}`, principal.accessToken);
    assert.equal(detail.body.signed_by_name !== null, true);
    assert.deepEqual(
      (detail.body.events as Array<{ action: string }>).map((event) => event.action),
      ['sign', 'create'],
    );
  });

  it('CT-16k-6: Tải thông tin thay đổi: dữ liệu không đổi thì không ghi ngày thay đổi; đổi tên lớp thì ghi ngày và nội dung khác biệt', async () => {
    const dossier = await dossierOf('class', classId);
    const unchanged = await api('POST', '/signing/dossiers/check-changes', principal.accessToken, {
      ids: [dossier?.id],
    });
    assert.equal(unchanged.status, 200, JSON.stringify(unchanged.body));
    assert.equal((unchanged.body.items as Array<{ changed: boolean }>)[0]?.changed, false);
    await schoolYear.updateTable('classes').set({ name: 'Lớp Lá 1 mới' }).where('id', '=', classId).execute();
    const changed = await api('POST', '/signing/dossiers/check-changes', principal.accessToken, {
      ids: [dossier?.id],
    });
    const result = (changed.body.items as Array<{ changed: boolean; change_summary: string }>)[0];
    assert.equal(result?.changed, true);
    assert.match(result?.change_summary ?? '', /Tên lớp: "Lớp Lá 1" → "Lớp Lá 1 mới"/);
    const after = await dossierOf('class', classId);
    assert.ok(after?.changed_at);
    // Hồ sơ đã kí giữ nguyên tệp và tên lúc tạo
    assert.equal(after?.status, 'signed');
  });

  it('CT-16k-7: 2.3 Xác nhận hoàn thành, hủy xác nhận, đánh dấu đã gửi; hồ sơ đã xác nhận không hủy được', async () => {
    const signed = await dossierOf('class', classId);
    const created = await dossierOf('child', childId);
    const notSigned = await api('POST', '/signing/dossiers/complete', principal.accessToken, { ids: [created?.id] });
    assert.equal(notSigned.status, 422);
    const notCompleted = await api('POST', '/signing/dossiers/mark-sent', principal.accessToken, {
      ids: [signed?.id],
      sent_on: '2026-10-01',
    });
    assert.equal(notCompleted.status, 422);
    assert.equal(
      (await api('POST', '/signing/dossiers/complete', vicePrincipal.accessToken, { ids: [signed?.id] })).status,
      200,
    );
    const cancelCompleted = await api('POST', `/signing/dossiers/${signed?.id}/cancel`, principal.accessToken, {
      reason: 'Thử hủy',
    });
    assert.equal(cancelCompleted.status, 422);
    const uncompleted = await api('POST', `/signing/dossiers/${signed?.id}/uncomplete`, principal.accessToken, {});
    assert.equal(uncompleted.body.status, 'signed');
    await api('POST', '/signing/dossiers/complete', principal.accessToken, { ids: [signed?.id] });
    const future = await api('POST', '/signing/dossiers/mark-sent', principal.accessToken, {
      ids: [signed?.id],
      sent_on: '2999-01-01',
    });
    assert.equal(future.status, 400);
    const sent = await api('POST', '/signing/dossiers/mark-sent', principal.accessToken, {
      ids: [signed?.id],
      sent_on: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
      note: 'Nộp tệp đã kí cho Phòng GD&ĐT',
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(
      (await api('POST', `/signing/dossiers/${signed?.id}/uncomplete`, principal.accessToken, {})).status,
      422,
    );
    const list = await api('GET', '/signing/submissions', vicePrincipal.accessToken);
    const rows = list.body.items as Array<{ id: string; status: string; sent_by_name: string | null }>;
    assert.deepEqual(
      rows.map((row) => row.status),
      ['sent'],
    );
    assert.ok(rows[0]?.sent_by_name);
    const filtered = await api('GET', '/signing/submissions?status=created&object_type=child', principal.accessToken);
    assert.equal((filtered.body.items as unknown[]).length, 1);
  });

  it('CT-16k-8: Hủy hồ sơ cần lý do; hồ sơ đã hủy thì tạo lại được hồ sơ mới cho cùng đối tượng', async () => {
    const dossier = await dossierOf('child', childId);
    const noReason = await api('POST', `/signing/dossiers/${dossier?.id}/cancel`, principal.accessToken, {});
    assert.equal(noReason.status, 400);
    const cancelled = await api('POST', `/signing/dossiers/${dossier?.id}/cancel`, principal.accessToken, {
      reason: 'Thông tin học sinh cần cập nhật',
    });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(await dossierOf('child', childId), null);
    const recreated = await api('POST', '/signing/dossiers', principal.accessToken, {
      object_type: 'child',
      object_ids: [childId],
    });
    assert.equal(recreated.status, 201);
    assert.notEqual((await dossierOf('child', childId))?.code, dossier?.code);
  });

  it('CT-16k-9: Xuất dữ liệu sổ đầu bài ra Excel theo lớp và tháng', async () => {
    const response = await fetch(`${environment.baseUrl}/signing/class-log/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${vicePrincipal.accessToken}` },
      body: JSON.stringify({ class_id: classId, month: '2026-10' }),
    });
    assert.equal(response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await response.arrayBuffer()) as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet?.name, 'Sổ đầu bài');
    assert.match(String(sheet?.getRow(1).getCell(1).value), /Sổ đầu bài: Lớp Lá 1 mới – tháng 10\/2026/);
    assert.deepEqual(
      (sheet?.getRow(3).values as unknown[]).slice(1),
      ['Ngày', 'Sĩ số điểm danh', 'Có mặt', 'Vắng có phép', 'Vắng không phép', 'Hoạt động trong ngày'],
    );
    const invalid = await api('POST', '/signing/class-log/export', principal.accessToken, { class_id: classId });
    assert.equal(invalid.status, 400);
  });
});
