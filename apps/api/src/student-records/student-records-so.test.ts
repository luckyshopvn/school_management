import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely } from 'kysely';
import { readWorkbookTable } from '../imports/excel.js';
import { MOET_CHILD_COLUMNS, mapMoetRows } from '../imports/moet-columns.js';
import { MOET_CHILD_HEADERS } from '../imports/moet-imports.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { verifyLearningPassword } from './learning-accounts.js';
import { studentRecordErrors } from './student-records.js';

// Hồ sơ học sinh đủ theo hệ thống của Sở (DT-16 phần 16g): xóa hồ sơ nháp, cấp mã định danh Bộ chạy nội bộ, xuất file lỗi,
// sắp xếp học sinh, điện thoại nhận tin hàng loạt và nhập từ Excel, thu thập và xác thực số định danh, tài khoản học và thi,
// chuyển lớp hàng loạt, chuyển trường chạy nội bộ, nhập học sinh 82 cột có xác nhận cập nhật, địa chỉ mới
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
type Item = Record<string, unknown> & { id: string; full_name: string };

describe('Hồ sơ học sinh đủ theo hệ thống của Sở (DT-16 phần 16g)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};
  const nationalIds: Record<string, string> = {};
  const motherPhones: Record<string, string> = {};
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  let mother = '';
  let father = '';

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);
  const items = (body: Record<string, unknown>) => body.items as Item[];

  async function fetchFile(method: string, path: string, body?: unknown) {
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${principal.accessToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      buffer,
      type: response.headers.get('content-type') ?? '',
      logId: response.headers.get('x-export-log-id'),
      json: response.status === 200 ? null : (JSON.parse(buffer.toString()) as Record<string, unknown>),
    };
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

  async function upload(path: string, fields: Record<string, string>, file: Buffer) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), 'tep.xlsx');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${principal.accessToken}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function workbook(headers: string[], rows: string[][]): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Dữ liệu');
    sheet.addRow(headers);
    for (const row of rows) {
      sheet.addRow(row);
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  // Lập, gửi trình duyệt và duyệt vào lớp; mẹ có số điện thoại (liên hệ chính), bố không có số
  async function enrol(key: string, fullName: string, classCode: string, approve = true, dob = '2022-04-18') {
    const form = new FormData();
    form.set('org_unit_id', units.A ?? '');
    form.set('purpose', 'birth_certificate');
    form.set('file', new Blob([PNG]), 'giay-khai-sinh.png');
    const file = (await (
      await fetch(`${environment.baseUrl}/files`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string };
    nationalIds[key] = nextNationalId();
    motherPhones[key] = randomPhone();
    const created = await api('POST', '/children', principal.accessToken, {
      org_unit_id: units.A,
      full_name: fullName,
      dob,
      gender: 'female',
      national_id: nationalIds[key],
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      confirm_possible_duplicate: true,
      guardians: [
        { full_name: `Mẹ của ${fullName}`, phone: motherPhones[key], relationship_item_id: mother, is_primary: true },
        { full_name: `Bố của ${fullName}`, phone: null, relationship_item_id: father },
      ],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    children[key] = created.body.id as string;
    if (!approve) {
      return;
    }
    assert.equal((await api('POST', `/children/${children[key]}/submit`, principal.accessToken)).status, 200);
    const approved = await api('POST', `/children/${children[key]}/approve`, principal.accessToken, {
      class_id: classes[classCode],
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
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
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[key] = created.body.id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 47,
    });
    for (const code of ['M1', 'M2']) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: units.A,
        code,
        name: `Lớp ${code}`,
        grade_level: 'MAM',
        max_size: 30,
      });
      classes[code] = created.body.id as string;
    }
    for (const [code, name] of [
      ['ME', 'Mẹ'],
      ['BO', 'Bố'],
    ] as const) {
      const created = await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code,
        name,
      });
      if (code === 'ME') {
        mother = created.body.id as string;
      } else {
        father = created.body.id as string;
      }
    }
    await enrol('Yen', 'Trần Thị Yến', 'M1');
    await enrol('An', 'Lê Thị An', 'M1');
    await enrol('Binh', 'Phạm Thị Bình', 'M1');
    await enrol('Draft', 'Ngô Thị Dung', 'M1', false);
    await enrol('Twin', 'Lê Thị An', 'M2', true);
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

  it('CT-16g-1: Xóa hồ sơ nháp không xóa cứng, giải phóng số định danh; hồ sơ đã duyệt không xóa được', async () => {
    const active = await api('DELETE', `/children/${children.Yen}`, principal.accessToken);
    assert.equal(active.status, 422, JSON.stringify(active.body));
    assert.equal(errorOf(active.body).rule_code, 'YCTD-124');
    const deleted = await api('DELETE', `/children/${children.Draft}`, principal.accessToken);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    const row = await schoolYear
      .selectFrom('children')
      .select(['deleted_at', 'national_id_hash'])
      .where('id', '=', children.Draft ?? '')
      .executeTakeFirstOrThrow();
    assert.ok(row.deleted_at);
    assert.match(row.national_id_hash, /^deleted:/);
    const list = await api('GET', `/children?org_unit_id=${units.A}&page_size=50`, principal.accessToken);
    assert.ok(!items(list.body).some((item) => item.id === children.Draft));
    assert.equal((await api('GET', `/children/${children.Draft}`, principal.accessToken)).status, 404);
    assert.equal((await api('DELETE', `/children/${children.Draft}`, principal.accessToken)).status, 404);
  });

  it('CT-16g-2: Cấp mã định danh Bộ nhập tay, mã trùng bị từ chối; tệp theo mẫu 82 cột của Bộ cho học sinh chưa có mã', async () => {
    const assigned = await api('POST', '/children/moet-codes', principal.accessToken, {
      items: [{ child_id: children.Yen, moet_student_code: 'HS-16G-01' }],
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    const duplicate = await api('POST', '/children/moet-codes', principal.accessToken, {
      items: [{ child_id: children.An, moet_student_code: 'HS-16G-01' }],
    });
    assert.equal(duplicate.status, 422);
    const file = await fetchFile('POST', '/children/moet-file', { org_unit_id: units.A, missing_moet_code: true });
    assert.equal(file.status, 200, JSON.stringify(file.json));
    assert.ok(file.logId);
    // Đọc lại được bằng bộ nhập tệp CSDL ngành, không có học sinh đã có mã
    const records = mapMoetRows(readWorkbookTable(file.buffer, MOET_CHILD_HEADERS), MOET_CHILD_COLUMNS);
    const names = records.map((record) => record.values.full_name).sort();
    assert.deepEqual(names, ['Lê Thị An', 'Lê Thị An', 'Phạm Thị Bình']);
    const binh = records.find((record) => record.values.full_name === 'Phạm Thị Bình');
    assert.equal(binh?.values.national_id, nationalIds.Binh);
    assert.equal(binh?.values.class_label, 'M1');
    assert.equal(binh?.values.mother_phone, motherPhones.Binh);
  });

  it('CT-16g-3: Xuất file lỗi liệt kê hồ sơ thiếu ô bắt buộc của CSDL ngành', async () => {
    assert.deepEqual(
      studentRecordErrors({
        status: 'active',
        class_name: 'Lớp M1',
        profile: {
          ethnicity: 'Kinh',
          nationality: 'Việt Nam',
          permanent_province: 'TP HCM',
          permanent_ward: 'Bến Thành',
        },
        guardians: [{ full_name: 'Mẹ', phone: '0901234567' }],
      }),
      [],
    );
    const file = await fetchFile('POST', '/children/error-file', { org_unit_id: units.A });
    assert.equal(file.status, 200, JSON.stringify(file.json));
    const rows = await sheetRows(file.buffer);
    assert.equal(rows[0]?.at(-1), 'Nội dung lỗi');
    assert.equal(rows.length, 5);
    assert.match(rows[1]?.at(-1) ?? '', /Thiếu dân tộc/);
  });

  it('CT-16g-4: Sửa dân tộc, diện chính sách, khuyết tật, biết bơi trên hồ sơ', async () => {
    const updated = await api('PATCH', `/children/${children.Yen}`, principal.accessToken, {
      ethnicity: 'Tày',
      policy_target: 'Con hộ nghèo',
      can_swim: true,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.deepEqual(updated.body.moet_fields, {
      ethnicity: 'Tày',
      policy_target: 'Con hộ nghèo',
      disability_type: null,
      can_swim: true,
    });
    const list = await api('GET', `/children?org_unit_id=${units.A}&can_swim=true`, principal.accessToken);
    assert.deepEqual(
      items(list.body).map((item) => item.full_name),
      ['Trần Thị Yến'],
    );
  });

  it('CT-16g-5: Sắp xếp A–Z ghi số thứ tự trong lớp, đổi thứ tự bằng tay, danh sách lớp theo thứ tự đã ghi', async () => {
    const sorted = await api('POST', '/student-order/sort', principal.accessToken, { class_id: classes.M1 });
    assert.equal(sorted.status, 200, JSON.stringify(sorted.body));
    assert.equal(sorted.body.students, 3);
    const order = await api('GET', `/student-order?class_id=${classes.M1}`, principal.accessToken);
    assert.deepEqual(
      items(order.body).map((item) => [item.full_name, item.order_number]),
      [
        ['Lê Thị An', 1],
        ['Phạm Thị Bình', 2],
        ['Trần Thị Yến', 3],
      ],
    );
    const reversed = items(order.body)
      .map((item) => item.id)
      .reverse();
    const saved = await api('PUT', `/student-order/${classes.M1}`, principal.accessToken, { child_ids: reversed });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const list = await api('GET', `/children?class_id=${classes.M1}&org_unit_id=${units.A}`, principal.accessToken);
    assert.deepEqual(
      items(list.body).map((item) => item.full_name),
      ['Trần Thị Yến', 'Phạm Thị Bình', 'Lê Thị An'],
    );
    const wrong = await api('PUT', `/student-order/${classes.M1}`, principal.accessToken, {
      child_ids: reversed.slice(1),
    });
    assert.equal(wrong.status, 422);
    const all = await api('POST', '/student-order/sort', principal.accessToken, {});
    assert.equal(all.status, 200);
    assert.equal(all.body.classes, 2);
  });

  it('CT-16g-6: Điện thoại nhận tin hàng loạt theo quan hệ; người không có số được báo lại', async () => {
    const byMother = await api('POST', '/children/sms-guardians', principal.accessToken, {
      child_ids: [children.Yen, children.An],
      relation: 'mother',
    });
    assert.equal(byMother.status, 200, JSON.stringify(byMother.body));
    assert.equal(byMother.body.updated, 2);
    const detail = await api('GET', `/children/${children.Yen}`, principal.accessToken);
    assert.equal(detail.body.sms_phone, motherPhones.Yen);
    const byFather = await api('POST', '/children/sms-guardians', principal.accessToken, {
      child_ids: [children.Yen],
      relation: 'father',
    });
    assert.deepEqual(byFather.body.skipped, ['Trần Thị Yến']);
    const none = await api('POST', '/children/sms-guardians', principal.accessToken, {
      child_ids: [children.An],
      relation: 'none',
    });
    assert.equal(none.status, 200);
    assert.equal((await api('GET', `/children/${children.An}`, principal.accessToken)).body.sms_phone, null);
  });

  it('CT-16g-7: Nhập điện thoại nhận tin từ Excel dùng bộ nhập chung: tệp mẫu kèm dữ liệu, dòng lỗi, ghi dữ liệu', async () => {
    const template = await fetchFile('GET', '/imports/templates/sms_phones?with_data=true');
    assert.equal(template.status, 200, JSON.stringify(template.json));
    const rows = await sheetRows(template.buffer);
    assert.deepEqual(rows[0], [
      'Mã định danh Bộ GD&ĐT',
      'Họ tên học sinh',
      'Ngày sinh',
      'Lớp',
      'Số điện thoại nhận tin',
    ]);
    const file = await workbook(rows[0] ?? [], [
      ['', 'Phạm Thị Bình', '18/04/2022', 'Lớp M1', motherPhones.Binh ?? ''],
      ['', 'Phạm Thị Bình', '18/04/2022', 'Lớp M1', '0900000000'],
    ]);
    const failed = await upload('/imports', { type: 'sms_phones' }, file);
    assert.equal(failed.status, 201, JSON.stringify(failed.body));
    assert.equal(failed.body.status, 'failed');
    const good = await upload(
      '/imports',
      { type: 'sms_phones' },
      await workbook(rows[0] ?? [], [['', 'Phạm Thị Bình', '18/04/2022', 'Lớp M1', motherPhones.Binh ?? '']]),
    );
    assert.equal(good.body.status, 'validated', JSON.stringify(good.body));
    const committed = await api('POST', `/imports/${good.body.id}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.equal(
      (await api('GET', `/children/${children.Binh}`, principal.accessToken)).body.sms_phone,
      motherPhones.Binh,
    );
  });

  it('CT-16g-8: Thu thập số định danh từ Excel, đánh dấu đã xác thực, đổi số thì phải xác thực lại; tiến độ theo lớp', async () => {
    const verified = await api('POST', '/national-ids/verify', principal.accessToken, {
      child_ids: [children.Yen, children.An],
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.verified, 2);
    const list = await api('GET', `/children?org_unit_id=${units.A}&national_id_verified=true`, principal.accessToken);
    assert.equal(items(list.body).length, 2);
    assert.ok(items(list.body)[0]?.national_id_verified_by_name);
    const progress = await api('GET', '/national-ids/progress', principal.accessToken);
    const m1 = (progress.body.items as Array<Record<string, unknown>>).find((item) => item.class_name === 'Lớp M1');
    assert.deepEqual([m1?.total, m1?.verified, m1?.ratio], [3, 2, 66.7]);
    // Nhập số định danh mới cho học sinh đã xác thực: học sinh về chưa xác thực
    const newId = nextNationalId();
    const job = await upload(
      '/imports',
      { type: 'national_ids' },
      await workbook(
        ['Mã định danh Bộ GD&ĐT', 'Họ tên học sinh', 'Ngày sinh', 'Lớp', 'Số định danh cá nhân'],
        [['HS-16G-01', 'Trần Thị Yến', '', '', newId]],
      ),
    );
    assert.equal(job.body.status, 'validated', JSON.stringify(job.body));
    assert.equal((await api('POST', `/imports/${job.body.id}/commit`, principal.accessToken)).status, 200);
    const yen = await schoolYear
      .selectFrom('children')
      .select(['national_id_last4', 'national_id_verified_at'])
      .where('id', '=', children.Yen ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(yen.national_id_last4, newId.slice(-4));
    assert.equal(yen.national_id_verified_at, null);
    const residence = await api('PUT', `/children/${children.An}/residence-change`, principal.accessToken, {
      note: 'Chuyển hộ khẩu sang phường mới',
    });
    assert.equal(residence.status, 200, JSON.stringify(residence.body));
    const bad = await upload(
      '/imports',
      { type: 'national_ids' },
      await workbook(
        ['Mã định danh Bộ GD&ĐT', 'Họ tên học sinh', 'Ngày sinh', 'Lớp', 'Số định danh cá nhân'],
        [['', 'Lê Thị An', '18/04/2022', '', '123']],
      ),
    );
    assert.equal(bad.body.status, 'failed');
    // Hai học sinh cùng họ tên, ngày sinh ở hai lớp: báo nhiều học sinh khi không ghi lớp, có ở danh sách nghi trùng
    const messages = (bad.body.errors as Array<{ message: string }>).map((error) => error.message);
    assert.ok(messages.some((message) => message.includes('nhiều học sinh')));
    const duplicates = await api('GET', '/national-ids/duplicates', principal.accessToken);
    assert.deepEqual(
      items(duplicates.body).map((item) => item.full_name),
      ['Lê Thị An', 'Lê Thị An'],
    );
  });

  it('CT-16g-9: Tài khoản học và thi: khởi tạo, cấp lại mật khẩu; mật khẩu chỉ trả một lần, lưu băm', async () => {
    const created = await api('POST', '/learning-accounts/issue', principal.accessToken, {
      child_ids: [children.Yen, children.An],
      mode: 'create',
    });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const issued = created.body.items as Array<{ child_id: string; username: string; password: string }>;
    const yen = issued.find((item) => item.child_id === children.Yen);
    assert.equal(yen?.username, 'hshs16g01');
    assert.match(yen?.password ?? '', /^[A-Za-z2-9]{8}$/);
    assert.ok((created.body.file as { content_base64: string }).content_base64.length > 0);
    const stored = await schoolYear
      .selectFrom('student_learning_accounts')
      .select('password_hash')
      .innerJoin('children', 'children.id', 'student_learning_accounts.child_id')
      .where('children.id', '=', children.Yen ?? '')
      .executeTakeFirstOrThrow();
    assert.ok(!stored.password_hash.includes(yen?.password ?? '-'));
    assert.ok(await verifyLearningPassword(yen?.password ?? '', stored.password_hash));
    const again = await api('POST', '/learning-accounts/issue', principal.accessToken, {
      child_ids: [children.Yen],
      mode: 'create',
    });
    assert.equal(again.status, 422);
    const reset = await api('POST', '/learning-accounts/issue', principal.accessToken, {
      child_ids: [children.Yen],
      mode: 'reset',
    });
    assert.equal(reset.status, 200);
    const list = await api('GET', `/learning-accounts?org_unit_id=${units.A}`, principal.accessToken);
    const row = items(list.body).find((item) => item.id === children.Yen);
    assert.equal(row?.reset_count, 1);
    assert.equal(row?.username, 'hshs16g01');
  });

  it('CT-16g-10: Chuyển lớp hàng loạt; học sinh không đang học làm hỏng cả lần chuyển', async () => {
    const wrong = await api('POST', '/children/bulk-transfer-class', principal.accessToken, {
      items: [
        { child_id: children.Binh, class_id: classes.M2 },
        { child_id: children.Draft, class_id: classes.M2 },
      ],
      reason: 'Cân đối sĩ số',
    });
    assert.equal(wrong.status, 422);
    const moved = await api('POST', '/children/bulk-transfer-class', principal.accessToken, {
      items: [{ child_id: children.Binh, class_id: classes.M2 }],
      reason: 'Cân đối sĩ số',
    });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    const detail = await api('GET', `/children/${children.Binh}`, principal.accessToken);
    assert.equal((detail.body.current_class as { class_name: string }).class_name, 'Lớp M2');
  });

  it('CT-16g-11: Chuyển đi chờ duyệt, duyệt thì thôi học; hồ sơ chuyển PDF, tệp mẫu Bộ; tiếp nhận chuyển đến tạo hồ sơ nháp', async () => {
    const requested = await api('POST', '/student-transfers/out', principal.accessToken, {
      child_id: children.Binh,
      school_name: 'Trường Mầm non Hoa Sen',
      province_name: 'Thành phố Hồ Chí Minh',
      ward_name: 'Phường Sài Gòn',
      reason: 'Gia đình chuyển nơi ở',
    });
    assert.equal(requested.status, 201, JSON.stringify(requested.body));
    const second = await api('POST', '/student-transfers/out', principal.accessToken, {
      child_id: children.Binh,
      school_name: 'Trường khác',
    });
    assert.equal(second.status, 422);
    const transferId = requested.body.id as string;
    const pdf = await fetchFile('GET', `/student-transfers/${transferId}/dossier?format=pdf`);
    assert.equal(pdf.status, 200, JSON.stringify(pdf.json));
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    const xlsx = await fetchFile('GET', `/student-transfers/${transferId}/dossier?format=xlsx`);
    assert.equal(xlsx.status, 200);
    const approved = await api('POST', `/student-transfers/${transferId}/approve`, principal.accessToken, {});
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    const child = await api('GET', `/children/${children.Binh}`, principal.accessToken);
    assert.equal(child.body.status, 'withdrawn');
    // Tệp của trường cũ: học sinh đã có hồ sơ thì không tiếp nhận lại
    const fields = {
      org_unit_id: units.A ?? '',
      school_name: 'Trường Mầm non Hoa Sen',
      province_name: 'Thành phố Hồ Chí Minh',
    };
    const refused = await upload('/student-transfers/in', fields, xlsx.buffer);
    assert.equal(refused.status, 200, JSON.stringify(refused.body));
    assert.equal(refused.body.created, 0);
    // Đổi số định danh, họ tên trong tệp thành học sinh mới
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(xlsx.buffer as unknown as ArrayBuffer);
    const sheet = book.worksheets[0] as ExcelJS.Worksheet;
    const headers = (sheet.getRow(1).values as unknown[]).map((value) => String(value ?? ''));
    sheet.getRow(2).getCell(headers.indexOf('Số định danh cá nhân')).value = nextNationalId();
    sheet.getRow(2).getCell(headers.indexOf('Họ tên')).value = 'Đỗ Thị Mai';
    sheet.getRow(2).getCell(headers.indexOf('Mã học sinh')).value = '';
    const received = await upload('/student-transfers/in', fields, Buffer.from(await book.xlsx.writeBuffer()));
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.created, 1, JSON.stringify(received.body));
    const childId = (received.body.transfers as Array<{ child_id: string }>)[0]?.child_id ?? '';
    const draft = await api('GET', `/children/${childId}`, principal.accessToken);
    assert.equal(draft.body.status, 'draft');
    assert.equal(draft.body.full_name, 'Đỗ Thị Mai');
    const list = await api('GET', '/student-transfers?direction=in', principal.accessToken);
    assert.equal(items(list.body)[0]?.status, 'received');
  });

  it('CT-16g-12: Nhập học sinh 82 cột cập nhật hồ sơ đã có cần đánh dấu "Đồng ý cập nhật dữ liệu học sinh"', async () => {
    const catalogs = await api('GET', '/student-imports/moet-catalogs', principal.accessToken);
    assert.equal(catalogs.status, 200, JSON.stringify(catalogs.body));
    const keys = (catalogs.body.items as Array<{ key: string; items: unknown[] }>).map((catalog) => catalog.key);
    assert.deepEqual(keys, [
      'classes',
      'genders',
      'student_statuses',
      'ethnic_groups',
      'nationalities',
      'new_wards',
      'hamlets',
    ]);
    const template = await fetchFile('GET', '/student-imports/moet-template?with_data=true');
    assert.equal(template.status, 200, JSON.stringify(template.json));
    assert.ok(template.logId);
    const job = await upload('/imports', { type: 'moet_children', org_unit_id: units.A ?? '' }, template.buffer);
    assert.equal(job.body.status, 'validated', JSON.stringify(job.body));
    assert.ok(((job.body.preview as { updated: number }).updated ?? 0) > 0);
    const refused = await api('POST', `/imports/${job.body.id}/commit`, principal.accessToken, {});
    assert.equal(refused.status, 422);
    assert.equal(errorOf(refused.body).rule_code, 'YCTD-124');
    const committed = await api('POST', `/imports/${job.body.id}/commit`, principal.accessToken, {
      confirm_update: true,
    });
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
  });

  it('CT-16g-13: Nhập danh sách học sinh kèm địa chỉ mới; sửa, xóa dòng bảng đối chiếu', async () => {
    const job = await upload(
      '/imports',
      { type: 'student_addresses' },
      await workbook(
        [
          'Mã định danh Bộ GD&ĐT',
          'Họ tên học sinh',
          'Ngày sinh',
          'Lớp',
          'Loại địa chỉ',
          'Tỉnh/Thành phố mới',
          'Xã/Phường mới',
          'Tổ/Thôn/Xóm',
        ],
        [
          ['HS-16G-01', 'Trần Thị Yến', '', '', 'Thường trú', 'TP HCM', 'Phường Sài Gòn', 'Tổ 5'],
          ['HS-16G-01', 'Trần Thị Yến', '', '', 'Chỗ ở hiện nay', 'Hồ Chí Minh', 'Phường Không Có', ''],
        ],
      ),
    );
    assert.equal(job.body.status, 'failed', JSON.stringify(job.body));
    const good = await upload(
      '/imports',
      { type: 'student_addresses' },
      await workbook(
        [
          'Mã định danh Bộ GD&ĐT',
          'Họ tên học sinh',
          'Ngày sinh',
          'Lớp',
          'Loại địa chỉ',
          'Tỉnh/Thành phố mới',
          'Xã/Phường mới',
          'Tổ/Thôn/Xóm',
        ],
        [['HS-16G-01', 'Trần Thị Yến', '', '', 'Thường trú', 'TP HCM', 'Phường Sài Gòn', 'Tổ 5']],
      ),
    );
    assert.equal(good.body.status, 'validated', JSON.stringify(good.body));
    assert.equal((await api('POST', `/imports/${good.body.id}/commit`, principal.accessToken)).status, 200);
    const yen = await schoolYear
      .selectFrom('children')
      .select('moet_profile')
      .where('id', '=', children.Yen ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(yen.moet_profile?.permanent_ward, 'Phường Sài Gòn');
    assert.equal(yen.moet_profile?.permanent_hamlet, 'Tổ 5');

    const mappings = await api(
      'GET',
      `/administrative-units/mappings?q=${encodeURIComponent('Sài Gòn')}&page_size=10`,
      principal.accessToken,
    );
    const mapping = items(mappings.body)[0];
    assert.ok(mapping, JSON.stringify(mappings.body));
    const wards = await api('GET', '/administrative-units/new-wards', principal.accessToken);
    const other = (wards.body.items as Array<{ id: string; ward_name: string }>).find(
      (ward) => ward.ward_name === 'Phường Bến Thành',
    );
    const updated = await api('PUT', `/administrative-units/mappings/${mapping.id}`, principal.accessToken, {
      new_unit_id: other?.id,
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.new_ward, 'Phường Bến Thành');
    const original = await environment.system
      .selectFrom('administrative_units')
      .select('id')
      .where('name', '=', 'Phường Sài Gòn')
      .where('period', '=', 'new')
      .executeTakeFirstOrThrow();
    await api('PUT', `/administrative-units/mappings/${mapping.id}`, principal.accessToken, {
      new_unit_id: original.id,
    });
    // Xóa rồi thêm lại đúng dòng cũ để không ảnh hưởng kiểm thử khác dùng chung cơ sở dữ liệu hệ thống
    const row = await environment.system
      .selectFrom('administrative_unit_mappings')
      .selectAll()
      .where('id', '=', mapping.id)
      .executeTakeFirstOrThrow();
    assert.equal(
      (await api('DELETE', `/administrative-units/mappings/${mapping.id}`, principal.accessToken)).status,
      200,
    );
    await environment.system.insertInto('administrative_unit_mappings').values(row).execute();
  });
});
