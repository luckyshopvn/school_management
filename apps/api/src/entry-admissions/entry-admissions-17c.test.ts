import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
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
import { mapMissing } from './entry-admission-catalogs.js';
import { buildZip } from './final-year-pdf.js';
import {
  approvalProblem,
  assertBeforeDeadline,
  checkRecord,
  compareVietnameseNames,
  nextStatus,
} from './final-year-rules.js';

// DT-17 phần 17c (YCTD-134): phân hệ Tuyển sinh đầu cấp phần 1 (khảo sát mục 10.2). Kịch bản CT-17c-1 đến CT-17c-12
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
type Item = Record<string, unknown> & { id: string; full_name: string; child_id: string };

describe('Tuyển sinh đầu cấp phần 1 (DT-17 phần 17c)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let parent: LoggedInUser;
  let otherParent: LoggedInUser;
  let teacher: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const nationalIds: Record<string, string> = {};
  const records: Record<string, string> = {};
  let mother = '';
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const items = (body: Record<string, unknown>) => body.items as Item[];

  async function fetchFile(token: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      buffer,
      type: response.headers.get('content-type') ?? '',
      json: response.status === 200 ? null : (JSON.parse(buffer.toString()) as Record<string, unknown>),
    };
  }

  async function upload(token: string, path: string, fields: Record<string, string>, file: Buffer, name: string) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), name);
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    const json = response.headers.get('content-type')?.includes('json')
      ? (JSON.parse(buffer.toString()) as Record<string, unknown>)
      : null;
    return { status: response.status, body: json ?? {}, buffer };
  }

  async function sheetRows(buffer: Buffer): Promise<string[][]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const rows: string[][] = [];
    workbook.worksheets[0]?.eachRow((row) => {
      rows.push(Array.from((row.values as unknown[]).slice(1), (value) => String(value ?? '')));
    });
    return rows;
  }

  async function enrol(key: string, fullName: string, classCode: string, withBirthCertificate = true) {
    nationalIds[key] = nextNationalId();
    const form = new FormData();
    form.set('org_unit_id', units.A ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const fileId = (
      (await (
        await fetch(`${environment.baseUrl}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${principal.accessToken}` },
          body: form,
        })
      ).json()) as { id: string }
    ).id;
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.A,
      full_name: fullName,
      dob: '2020-03-10',
      gender: 'male',
      national_id: nationalIds[key],
      birth_certificate_file_id: fileId,
      photo_consent: 'pending',
      health: { has_allergies: false },
      confirm_possible_duplicate: true,
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: randomPhone(), relationship_item_id: mother, is_primary: true },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    children[key] = created.body.id as string;
    assert.equal((await api('POST', `/children/${children[key]}/submit`, principal.accessToken)).status, 200);
    const approved = await api('POST', `/children/${children[key]}/approve`, principal.accessToken, {
      class_id: classes[classCode],
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    if (!withBirthCertificate) {
      // Hồ sơ nhập từ tệp CSDL ngành có thể chưa có bản chụp giấy khai sinh
      await schoolYear
        .updateTable('children')
        .set({ birth_certificate_file_id: null })
        .where('id', '=', children[key] ?? '')
        .execute();
    }
  }

  // Gắn tài khoản phụ huynh kiểm thử vào phụ huynh của trẻ
  async function linkGuardian(childKey: string, user: LoggedInUser) {
    const link = await schoolYear
      .selectFrom('child_guardians')
      .select('guardian_id')
      .where('child_id', '=', children[childKey] ?? '')
      .executeTakeFirstOrThrow();
    await schoolYear
      .updateTable('guardians')
      .set({ user_id: user.userId })
      .where('id', '=', link.guardian_id)
      .execute();
  }

  async function listRecords(query = '') {
    const listed = await api('GET', `/final-year-records${query}`, principal.accessToken);
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    return items(listed.body);
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    // Duyệt hồ sơ trẻ tạo tài khoản phụ huynh nên cần mật khẩu mặc định; trả lại giá trị cũ sau kiểm thử
    savedDefaultPassword = await environment.identity.database
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: 'PhuHuynh2026',
    });
    const yearId = await openTestAcademicYear(environment, principal.accessToken, '2026–2027', {
      first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
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
    for (const [key, code, type] of [
      ['TC', 'TC', 'truong_chinh'],
      ['A', 'ĐT-A', 'diem_truong'],
      ['B', 'ĐT-B', 'diem_truong'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, {
        code,
        name: `Đơn vị ${code}`,
        unit_type: type,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      units[key] = created.body.id as string;
    }
    for (const [code, name, from, to] of [
      ['CHOI', 'Chồi', 48, 59],
      ['LA', 'Lá', 60, 71],
    ] as const) {
      await api('POST', '/grade-levels', principal.accessToken, {
        code,
        name,
        age_from_months: from,
        age_to_months: to,
      });
    }
    for (const [code, grade] of [
      ['LA1', 'LA'],
      ['LA2', 'LA'],
      ['CH1', 'CHOI'],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units.A,
        code,
        name: `Lớp ${code}`,
        grade_level: grade,
        max_size: 30,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      classes[code] = created.body.id as string;
    }
    const relationship = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    mother = relationship.body.id as string;
    await enrol('An', 'Nguyễn Văn An', 'LA1');
    await enrol('Binh', 'Trần Văn Bình', 'LA1', false);
    await enrol('Cuong', 'Lê Văn Cường', 'LA2');
    await enrol('Dung', 'Phạm Văn Dũng', 'CH1');
    parent = await environment.loginAs('VT-14', units.A ?? null);
    otherParent = await environment.loginAs('VT-14', units.A ?? null);
    teacher = await environment.loginAs('VT-07', units.A ?? null);
    await linkGuardian('An', parent);
    await linkGuardian('Cuong', otherParent);
  });

  after(async () => {
    const identityDatabase = environment.identity.database;
    await identityDatabase.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identityDatabase
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-17c-1: Luồng sáu trạng thái: xác nhận, đề xuất sửa, đã chỉnh sửa, xác nhận lại; hồ sơ đã duyệt không đổi', () => {
    assert.deepEqual(nextStatus('parent_confirm', 'parent_pending', 'pending'), {
      ok: true,
      status: 'parent_confirmed',
    });
    assert.deepEqual(nextStatus('parent_propose', 'parent_confirmed', 'pending'), {
      ok: true,
      status: 'awaiting_school_edit',
    });
    assert.equal(nextStatus('parent_propose', 'awaiting_school_edit', 'pending').ok, false);
    assert.equal(nextStatus('parent_confirm', 'awaiting_school_edit', 'pending').ok, false);
    assert.deepEqual(nextStatus('school_edited', 'awaiting_school_edit', 'pending'), {
      ok: true,
      status: 'awaiting_parent_reconfirm',
    });
    assert.deepEqual(nextStatus('school_edited', 'parent_pending', 'pending'), { ok: true, status: 'school_edited' });
    assert.deepEqual(nextStatus('school_edited', 'parent_confirmed_after_edit', 'pending'), {
      ok: true,
      status: 'school_edited',
    });
    assert.equal(nextStatus('school_edited', 'awaiting_parent_reconfirm', 'pending').ok, false);
    for (const status of ['awaiting_parent_reconfirm', 'school_edited'] as const) {
      assert.deepEqual(nextStatus('parent_confirm', status, 'pending'), {
        ok: true,
        status: 'parent_confirmed_after_edit',
      });
      assert.deepEqual(nextStatus('school_confirm', status, 'pending'), {
        ok: true,
        status: 'parent_confirmed_after_edit',
      });
    }
    assert.equal(nextStatus('parent_confirm', 'parent_confirmed', 'pending').ok, false);
    assert.equal(nextStatus('parent_propose', 'parent_pending', 'approved').ok, false);
  });

  it('CT-17c-2: Kiểm dò năm mục bắt buộc, điều kiện duyệt, hạn điều chỉnh, thứ tự A–Z, kiểm dò vị trí, tệp nén', () => {
    const complete = {
      identity_type: 'has_id' as const,
      current_residence: '12 Đường A',
      ward: 'Phường 1',
      province: 'TP. Hồ Chí Minh',
      contact_phone: '0901234567',
      has_birth_certificate: true,
      has_residence_proof: true,
    };
    assert.deepEqual(checkRecord(complete), []);
    assert.deepEqual(checkRecord({ ...complete, identity_type: 'temporary_id' }), []);
    assert.deepEqual(
      checkRecord({
        identity_type: 'no_id',
        current_residence: ' ',
        ward: 'P1',
        province: null,
        contact_phone: null,
        has_birth_certificate: false,
        has_residence_proof: false,
      }),
      ['identity', 'residence', 'contact', 'birth_certificate', 'residence_proof'],
    );
    assert.equal(approvalProblem('parent_confirmed', []), null);
    assert.match(approvalProblem('parent_pending', []) ?? '', /chưa xác nhận/);
    assert.match(approvalProblem('parent_confirmed_after_edit', ['contact']) ?? '', /điện thoại/);
    assertBeforeDeadline(null, '2027-03-01');
    assertBeforeDeadline('2027-03-01', '2027-03-01');
    assert.throws(() => assertBeforeDeadline('2027-03-01', '2027-03-02'), /01\/03\/2027/);
    const names = ['Trần Văn Bình', 'Nguyễn Văn An', 'Lê Thị An', 'Phạm Văn Dũng'];
    assert.deepEqual(names.sort(compareVietnameseNames), [
      'Lê Thị An',
      'Nguyễn Văn An',
      'Trần Văn Bình',
      'Phạm Văn Dũng',
    ]);
    assert.deepEqual(mapMissing({ latitude: 10.7, longitude: null, province: 'HCM', ward: null, quarter: 'KP1' }), [
      'vĩ độ, kinh độ',
      'phường/xã',
    ]);
    const zip = buildZip(
      [
        { name: 'a.pdf', body: Buffer.from('%PDF-1') },
        { name: 'hồ-sơ.pdf', body: Buffer.from('%PDF-2') },
      ],
      new Date('2027-03-01T08:00:00Z'),
    );
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    assert.equal(zip.readUInt16LE(zip.length - 12), 2);
  });

  it('CT-17c-3: Danh sách lấy trẻ đang học lớp năm cuối cấp, kiểm dò thiếu, lọc; giáo viên không có quyền xem', async () => {
    const rows = await listRecords();
    assert.deepEqual(
      rows.map((row) => row.full_name).sort(),
      ['Lê Văn Cường', 'Nguyễn Văn An', 'Trần Văn Bình'].sort(),
    );
    for (const row of rows) {
      records[Object.keys(children).find((key) => children[key] === row.child_id) ?? ''] = row.id;
      assert.equal(row.status, 'parent_pending');
      assert.match(row.national_id as string, /^\*{8}\d{4}$/);
    }
    const binh = rows.find((row) => row.id === records.Binh);
    assert.deepEqual(binh?.missing, ['residence', 'birth_certificate', 'residence_proof']);
    assert.ok((binh?.check_text as string).includes('Thiếu giấy khai sinh'));
    const an = rows.find((row) => row.id === records.An);
    assert.deepEqual(an?.missing, ['residence', 'residence_proof']);
    assert.ok(an?.contact_phone);
    assert.equal((await listRecords(`?national_id=${nationalIds.Cuong}`)).length, 1);
    assert.equal((await listRecords(`?class_id=${classes.LA1}&order=class`)).length, 2);
    assert.equal((await listRecords('?check=complete')).length, 0);
    assert.equal((await listRecords('?q=bình')).length, 1);
    const denied = await api('GET', '/final-year-records', teacher.accessToken);
    assert.equal(denied.status, 403);
    const invalid = await api('GET', '/final-year-records?national_id=123', principal.accessToken);
    assert.equal(invalid.status, 400);
  });

  it('CT-17c-4: Phụ huynh xác nhận, đề xuất sửa; trường chỉnh sửa và báo phụ huynh; phụ huynh xác nhận lại', async () => {
    const mine = await api('GET', '/parent/final-year-records', parent.accessToken);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.deepEqual(
      items(mine.body).map((row) => row.id),
      [records.An],
    );
    const confirmed = await api('POST', `/parent/final-year-records/${records.An}/confirm`, parent.accessToken);
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'parent_confirmed');
    const empty = await api('POST', `/parent/final-year-records/${records.An}/propose`, parent.accessToken, {
      content: '',
    });
    assert.equal(empty.status, 400);
    const proposed = await api('POST', `/parent/final-year-records/${records.An}/propose`, parent.accessToken, {
      content: 'Sửa nơi ở hiện tại',
    });
    assert.equal(proposed.status, 200, JSON.stringify(proposed.body));
    assert.equal(proposed.body.status, 'awaiting_school_edit');
    assert.equal(proposed.body.parent_proposal, 'Sửa nơi ở hiện tại');
    const foreign = await api('POST', `/parent/final-year-records/${records.An}/confirm`, otherParent.accessToken);
    assert.equal(foreign.status, 403);
    const updated = await api('PUT', `/final-year-records/${records.An}`, principal.accessToken, {
      current_residence: '12 Đường Số 3',
      ward: 'Phường An Khánh',
      province: 'TP. Hồ Chí Minh',
      residence_type: 'permanent',
      latitude: '10,7769',
      longitude: 106.7009,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.latitude, 10.7769);
    const badUpdate = await api('PUT', `/final-year-records/${records.An}`, principal.accessToken, {
      contact_phone: '12345',
      residence_type: 'khac',
      latitude: 91,
    });
    assert.equal(badUpdate.status, 400);
    assert.deepEqual(
      errorOf(badUpdate.body)
        .details?.map((detail) => detail.field)
        .sort(),
      ['contact_phone', 'latitude', 'residence_type'],
    );
    const edited = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'edited',
      ids: [records.An, records.Cuong],
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.done, 2);
    const notified = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notification_recipients.user_id'])
      .where('notifications.target_id', '=', records.An ?? '')
      .where('notifications.template_code', '=', 'final_year_record_edited')
      .execute();
    assert.deepEqual(
      notified.map((row) => row.user_id),
      [parent.userId],
    );
    const statuses = Object.fromEntries((await listRecords()).map((row) => [row.id, row.status]));
    assert.equal(statuses[records.An ?? ''], 'awaiting_parent_reconfirm');
    assert.equal(statuses[records.Cuong ?? ''], 'school_edited');
    const reconfirmed = await api('POST', `/parent/final-year-records/${records.An}/confirm`, parent.accessToken);
    assert.equal(reconfirmed.body.status, 'parent_confirmed_after_edit');
    const school = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'confirm',
      ids: [records.Cuong, records.Binh],
    });
    assert.equal(school.body.done, 2);
    const again = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'confirm',
      ids: [records.Binh],
    });
    assert.equal(again.body.done, 0);
    assert.equal((again.body.skipped as unknown[]).length, 1);
    const events = await api('GET', `/final-year-records/${records.An}/events`, principal.accessToken);
    assert.ok(
      (events.body as unknown as Array<{ action: string; by_parent: boolean }>).some((event) => event.by_parent),
    );
  });

  it('CT-17c-5: Giấy tờ: trường và phụ huynh tải lên, chỉ người có quyền hoặc phụ huynh của trẻ xem; đủ thì duyệt được', async () => {
    const notApproved = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'approve',
      ids: [records.An],
    });
    assert.equal(notApproved.body.done, 0);
    assert.match(JSON.stringify(notApproved.body.skipped), /cư trú/);
    const parentUpload = await upload(
      parent.accessToken,
      `/parent/final-year-records/${records.An}/files`,
      { kind: 'residence' },
      PNG,
      'cu-tru.png',
    );
    assert.equal(parentUpload.status, 201, JSON.stringify(parentUpload.body));
    const fileId = parentUpload.body.id as string;
    const notImage = await upload(
      principal.accessToken,
      `/final-year-records/${records.An}/files`,
      { kind: 'evidence' },
      Buffer.from('xin chao'),
      'a.txt',
    );
    assert.equal(notImage.status, 400);
    const evidence = await upload(
      principal.accessToken,
      `/final-year-records/${records.An}/files`,
      { kind: 'evidence' },
      PNG,
      'minh-chung.png',
    );
    assert.equal(evidence.status, 201, JSON.stringify(evidence.body));
    assert.equal((await fetchFile(parent.accessToken, 'GET', `/final-year-records/files/${fileId}`)).status, 200);
    assert.equal((await fetchFile(otherParent.accessToken, 'GET', `/final-year-records/files/${fileId}`)).status, 403);
    assert.equal((await fetchFile(principal.accessToken, 'GET', `/files/${fileId}`)).status, 403);
    const removed = await api('DELETE', `/final-year-records/files/${evidence.body.id as string}`, parent.accessToken);
    assert.equal(removed.status, 403);
    const approved = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'approve',
      ids: [records.An],
    });
    assert.equal(approved.body.done, 1, JSON.stringify(approved.body));
    const locked = await api('PUT', `/final-year-records/${records.An}`, principal.accessToken, { street: 'Lê Lợi' });
    assert.equal(locked.status, 422);
    assert.equal(errorOf(locked.body).rule_code, 'YCTD-134');
    const parentLocked = await api('POST', `/parent/final-year-records/${records.An}/propose`, parent.accessToken, {
      content: 'Sửa tên đường',
    });
    assert.equal(parentLocked.status, 422);
    const consent = await api('POST', `/parent/final-year-records/${records.An}/consent`, parent.accessToken, {
      consent: true,
    });
    assert.equal(consent.body.admission_consent, true);
    assert.equal((await listRecords('?review_status=approved&admission_consent=true&has_location=true')).length, 1);
    const unapproved = await api('POST', '/final-year-records/actions', principal.accessToken, {
      action: 'unapprove',
      ids: [records.An],
    });
    assert.equal(unapproved.body.done, 1);
  });

  it('CT-17c-6: Hạn điều chỉnh thông tin: quá hạn phụ huynh không xác nhận, đề xuất, tải giấy tờ', async () => {
    const invalid = await api('PUT', '/final-year-records/settings', principal.accessToken, {
      edit_deadline: '01/03/2020',
    });
    assert.equal(invalid.status, 400);
    const saved = await api('PUT', '/final-year-records/settings', principal.accessToken, {
      edit_deadline: '2020-03-01',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const late = await api('POST', `/parent/final-year-records/${records.Cuong}/propose`, otherParent.accessToken, {
      content: 'Sửa số điện thoại',
    });
    assert.equal(late.status, 422);
    assert.equal(errorOf(late.body).rule_code, 'YCTD-134');
    const lateUpload = await upload(
      otherParent.accessToken,
      `/parent/final-year-records/${records.Cuong}/files`,
      { kind: 'residence' },
      PNG,
      'cu-tru.png',
    );
    assert.equal(lateUpload.status, 422);
    const cleared = await api('PUT', '/final-year-records/settings', principal.accessToken, { edit_deadline: null });
    assert.equal(cleared.body.edit_deadline, null);
    const onTime = await api('POST', `/parent/final-year-records/${records.Cuong}/propose`, otherParent.accessToken, {
      content: 'Sửa số điện thoại',
    });
    assert.equal(onTime.status, 200, JSON.stringify(onTime.body));
  });

  it('CT-17c-7: Xuất Excel và cập nhật từ Excel: kiểm tra cả tệp, có lỗi không ghi dòng nào, tải danh sách lỗi', async () => {
    const exported = await fetchFile(principal.accessToken, 'POST', '/final-year-records/export', { filter: {} });
    assert.equal(exported.status, 200);
    const rows = await sheetRows(exported.buffer);
    const header = rows[0] ?? [];
    assert.equal(header[1], 'ID');
    const nationalColumn = header.indexOf('Số định danh cá nhân');
    const binhRow = rows.find((row) => row.includes(records.Binh ?? '')) ?? [];
    // Hiệu trưởng có quyền xem số định danh nên tệp in đủ số
    assert.equal(binhRow[nationalColumn], nationalIds.Binh);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0]!;
    const column = (label: string) => header.indexOf(label) + 1;
    const binhNumber = rows.indexOf(binhRow) + 1;
    sheet.getRow(binhNumber).getCell(column('Phường/Xã')).value = 'Phường Bến Thành';
    sheet.getRow(binhNumber).getCell(column('Diện cư trú')).value = 'Tạm trú';
    sheet.getRow(binhNumber).getCell(column('Điện thoại liên hệ')).value = '12';
    const invalidFile = Buffer.from(await workbook.xlsx.writeBuffer());
    const rejected = await upload(principal.accessToken, '/final-year-records/import', {}, invalidFile, 'tep.xlsx');
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.equal(rejected.body.updated, 0);
    assert.deepEqual(
      (rejected.body.errors as Array<{ column: string }>).map((error) => error.column),
      ['Điện thoại liên hệ'],
    );
    const errorFile = await upload(
      principal.accessToken,
      '/final-year-records/import?error_file=true',
      {},
      invalidFile,
      'tep.xlsx',
    );
    assert.equal(errorFile.status, 200);
    assert.ok((await sheetRows(errorFile.buffer)).some((row) => row.some((cell) => cell.includes('Số điện thoại'))));
    sheet.getRow(binhNumber).getCell(column('Điện thoại liên hệ')).value = '0912345678';
    const applied = await upload(
      principal.accessToken,
      '/final-year-records/import',
      {},
      Buffer.from(await workbook.xlsx.writeBuffer()),
      'tep.xlsx',
    );
    assert.equal(applied.body.updated, rows.length - 1, JSON.stringify(applied.body));
    const binh = (await listRecords()).find((row) => row.id === records.Binh);
    assert.equal(binh?.ward, 'Phường Bến Thành');
    assert.equal(binh?.residence_type, 'temporary');
    assert.equal(binh?.contact_phone, '0912345678');
  });

  it('CT-17c-8: Xuất PDF khổ A5, A4 gập đôi, hồ sơ chọn, tách tệp nén; mỗi lần ghi nhật ký xuất', async () => {
    const a5 = await fetchFile(principal.accessToken, 'POST', '/final-year-records/pdf', { format: 'a5' });
    assert.equal(a5.status, 200, JSON.stringify(a5.json));
    assert.equal(a5.type, 'application/pdf');
    assert.equal(a5.buffer.subarray(0, 4).toString(), '%PDF');
    assert.ok(a5.buffer.toString('latin1').includes('/MediaBox [0 0 419.53 595.28]'));
    const folded = await fetchFile(principal.accessToken, 'POST', '/final-year-records/pdf', {
      format: 'a4_folded',
      ids: [records.An],
      kind: 'declaration',
    });
    assert.equal(folded.status, 200);
    assert.ok(folded.buffer.toString('latin1').includes('/MediaBox [0 0 841.89 595.28]'));
    const split = await fetchFile(principal.accessToken, 'POST', '/final-year-records/pdf', {
      format: 'a5',
      split: true,
      ids: [records.An, records.Binh],
    });
    assert.equal(split.status, 200);
    assert.equal(split.type, 'application/zip');
    assert.equal(split.buffer.readUInt16LE(split.buffer.length - 12), 2);
    const invalid = await fetchFile(principal.accessToken, 'POST', '/final-year-records/pdf', { format: 'a3' });
    assert.equal(invalid.status, 400);
    const logs = await schoolYear
      .selectFrom('export_logs')
      .select(['report_code', 'contains_personal_data'])
      .where('report_code', '=', 'final_year_records_pdf')
      .execute();
    assert.equal(logs.length, 3);
    assert.ok(logs.every((log) => log.contains_personal_data));
  });

  it('CT-17c-9: 1.2 xác nhận hoàn thành theo lớp và 4.1 thống kê theo đơn vị', async () => {
    const completion = await api('GET', '/final-year-completion', principal.accessToken);
    assert.equal(completion.status, 200);
    const list = completion.body.items as Array<Record<string, unknown>>;
    assert.deepEqual(list.map((row) => row.class_name).sort(), ['Lớp LA1', 'Lớp LA2']);
    const la1 = list.find((row) => row.class_id === classes.LA1);
    assert.equal(la1?.total, 2);
    assert.equal((la1?.complete as number) + (la1?.missing as number), 2);
    const notFinal = await api('PUT', '/final-year-completion', principal.accessToken, {
      items: [{ class_id: classes.CH1, confirmed: true }],
    });
    assert.equal(notFinal.status, 400);
    const saved = await api('PUT', '/final-year-completion', principal.accessToken, {
      items: [{ class_id: classes.LA1, confirmed: true }],
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const confirmed = (saved.body.items as Array<Record<string, unknown>>).find((row) => row.class_id === classes.LA1);
    assert.equal(confirmed?.confirmed, true);
    assert.ok(confirmed?.confirmed_by_name);
    const exported = await fetchFile(principal.accessToken, 'POST', '/final-year-completion/export');
    assert.equal(exported.status, 200);
    const statistics = await api('GET', '/final-year-statistics', principal.accessToken);
    const unitA = (statistics.body.items as Array<Record<string, unknown>>).find((row) => row.org_unit_id === units.A);
    assert.equal(unitA?.total, 3);
    assert.equal(
      unitA?.complete_rate,
      Math.round((((unitA?.total as number) - (unitA?.missing as number)) / 3) * 10_000) / 100,
    );
    assert.ok(!(statistics.body.items as Array<Record<string, unknown>>).some((row) => row.org_unit_id === units.B));
  });

  it('CT-17c-10: 1.8 tọa độ trường, điểm trường; xác nhận khi Trường chính đủ thông tin', async () => {
    const early = await api('POST', '/entry-school-map/confirm', principal.accessToken);
    assert.equal(early.status, 422);
    const invalid = await api('PUT', `/entry-school-map/${units.TC}`, principal.accessToken, { longitude: 200 });
    assert.equal(invalid.status, 400);
    const saved = await api('PUT', `/entry-school-map/${units.TC}`, principal.accessToken, {
      latitude: 10.762622,
      longitude: '106,660172',
      province: 'TP. Hồ Chí Minh',
      ward: 'Phường Kiểm Thử',
      quarter: 'Khu phố 1',
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const school = saved.body.school as Record<string, unknown>;
    assert.equal(school.longitude, 106.660172);
    assert.deepEqual(school.missing, []);
    const sites = saved.body.sites as Array<Record<string, unknown>>;
    assert.ok(sites.some((site) => site.id === units.A && (site.missing as string[]).length === 4));
    const confirmed = await api('POST', '/entry-school-map/confirm', principal.accessToken);
    assert.equal(confirmed.status, 200);
    assert.ok((confirmed.body.school as Record<string, unknown>).map_confirmed_at);
  });

  it('CT-17c-11: 2.1 dịch vụ tại trường đối chiếu mã với dịch vụ tài chính; 3.3, 3.4 hiển thị nhân sự, lớp sẵn có', async () => {
    const created = await api('POST', '/school-services', principal.accessToken, {
      code: 'DV_17C',
      name: 'Bán trú',
      sort_order: 1,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const duplicate = await api('POST', '/school-services', principal.accessToken, { code: 'DV_17C', name: 'Trùng' });
    assert.equal(duplicate.status, 409);
    await schoolYear
      .insertInto('services')
      .values({ code: 'DV_17C', name: 'Tiền bán trú', unit: 'tháng', calculation_method: 'monthly', created_by: null })
      .execute();
    const listed = await api('GET', '/school-services?name=bán', principal.accessToken);
    assert.equal(items(listed.body)[0]?.finance_service_name, 'Tiền bán trú');
    const renamed = await api('PUT', `/school-services/${created.body.id as string}`, principal.accessToken, {
      code: 'DV_17C',
      name: 'Dịch vụ bán trú',
      sort_order: 2,
    });
    assert.equal(renamed.body.name, 'Dịch vụ bán trú');
    const removed = await api('POST', '/school-services/delete', principal.accessToken, { ids: [created.body.id] });
    assert.equal(removed.body.removed, 1);
    const classList = await api('GET', '/entry-admissions/classes?grade_level=LA', principal.accessToken);
    assert.equal(classList.status, 200);
    assert.deepEqual(
      items(classList.body).map((row) => row.name),
      ['Lớp LA1', 'Lớp LA2'],
    );
    const staff = await api('GET', '/entry-admissions/staff', principal.accessToken);
    assert.equal(staff.status, 200);
    assert.equal((await api('GET', '/entry-admissions/staff', teacher.accessToken)).status, 403);
  });

  it('CT-17c-12: 5.1 phụ huynh gửi hỗ trợ tuyển sinh, trường trả lời và gửi câu trả lời qua ứng dụng phụ huynh', async () => {
    const foreign = await api('POST', '/parent/admission-support', parent.accessToken, {
      child_id: children.Cuong,
      content: 'Hỏi lịch tuyển sinh',
    });
    assert.equal(foreign.status, 403);
    const invalid = await api('POST', '/parent/admission-support', parent.accessToken, {
      child_id: children.An,
      content: '',
      email: 'khong-hop-le',
    });
    assert.equal(invalid.status, 400);
    const sent = await api('POST', '/parent/admission-support', parent.accessToken, {
      child_id: children.An,
      content: 'Xin hỏi lịch nộp hồ sơ vào lớp 1',
      email: 'phuhuynh@example.com',
    });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const requestId = sent.body.id as string;
    const listed = await api('GET', `/admission-support?national_id=${nationalIds.An}`, principal.accessToken);
    assert.equal(items(listed.body).length, 1);
    assert.match(items(listed.body)[0]?.national_id as string, /^\*{8}\d{4}$/);
    const notYet = await api('POST', '/admission-support/notify', principal.accessToken, { ids: [requestId] });
    assert.equal(notYet.body.sent, 0);
    const replied = await api('PUT', `/admission-support/${requestId}`, principal.accessToken, {
      reply: 'Nhà trường nhận hồ sơ từ ngày 01/06',
    });
    assert.equal(replied.body.status, 'answered');
    const notified = await api('POST', '/admission-support/notify', principal.accessToken, { ids: [requestId] });
    assert.equal(notified.body.sent, 1);
    assert.equal(notified.body.email_available, false);
    const recipient = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select('notification_recipients.user_id')
      .where('notifications.target_id', '=', requestId)
      .executeTakeFirstOrThrow();
    assert.equal(recipient.user_id, parent.userId);
    const mine = await api('GET', '/parent/admission-support', parent.accessToken);
    assert.equal(items(mine.body)[0]?.reply, 'Nhà trường nhận hồ sơ từ ngày 01/06');
    const answered = await api('GET', '/admission-support?status=answered', principal.accessToken);
    assert.equal(items(answered.body).length, 1);
    assert.equal((await api('GET', '/admission-support', teacher.accessToken)).status, 403);
  });
});
