import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { openTransferPackage, readJsonPart } from './transfer-package-rules.js';

// Gói chuyển trường, lát L1 (YCTD-390; BR-480 đến BR-483). Trường đi và trường đến là một trường thử: trước khi tiếp nhận, kiểm
// thử đổi số định danh, mã Bộ của hồ sơ gốc để giả lập hồ sơ nằm ở cơ sở dữ liệu của trường khác
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const nextNationalId = () =>
  `0791${String(Date.now() % 100_000).padStart(5, '0')}${String(randomInt(0, 1000)).padStart(3, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };

describe('Gói chuyển trường (YCTD-390 lát L1)', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let unitId = '';
  const classes: Record<string, string> = {};
  let mother = '';
  let childId = '';
  let transferId = '';
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  let built: {
    package_code: string;
    package_sha256: string;
    password: string;
    package_file: { content_base64: string };
    print_file: { content_base64: string };
  };

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);

  async function upload(path: string, token: string, fields: Record<string, string>, file: Buffer) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.set(key, value);
    }
    form.set('file', new Blob([file]), 'goi.goichuyen');
    const response = await fetch(`${environment.baseUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
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
    await api('POST', '/org-units', principal.accessToken, {
      code: 'TC',
      name: 'Trường thử',
      unit_type: 'truong_chinh',
    });
    const unit = await api('POST', '/org-units', principal.accessToken, {
      code: 'ĐT-GCT',
      name: 'Điểm thử gói',
      unit_type: 'diem_truong',
    });
    unitId = unit.body.id as string;
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'CHOI',
      name: 'Chồi',
      age_from_months: 48,
      age_to_months: 59,
    });
    for (const [code, size] of [
      ['C1', 30],
      ['C2', 1],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: unitId,
        code,
        name: `Lớp ${code}`,
        grade_level: 'CHOI',
        max_size: size,
      });
      classes[code] = created.body.id as string;
    }
    const relation = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME-GCT',
      name: 'Mẹ',
    });
    mother = relation.body.id as string;
    const form = new FormData();
    form.set('org_unit_id', unitId);
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
      org_unit_id: unitId,
      full_name: 'Vũ Thị Gói',
      dob: '2021-05-10',
      gender: 'female',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.id,
      photo_consent: 'pending',
      health: { has_allergies: true, allergies: 'Tôm' },
      special_needs_note: 'Cần ngồi bàn đầu',
      confirm_possible_duplicate: true,
      guardians: [{ full_name: 'Mẹ của Gói', phone: randomPhone(), relationship_item_id: mother, is_primary: true }],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    childId = created.body.id as string;
    assert.equal((await api('POST', `/children/${childId}/submit`, principal.accessToken)).status, 200);
    const approved = await api('POST', `/children/${childId}/approve`, principal.accessToken, {
      class_id: classes.C1,
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    // Học bạ năm trước đã ký kèm PDF, học bạ năm đang học chưa ký
    const storage = environment.api.get(FileStorage);
    await storage.put('learning-records/thu-goi.pdf', Buffer.from('%PDF-hoc-ba-thu'), 'application/pdf');
    await schoolYear
      .insertInto('learning_records')
      .values([
        {
          child_id: childId,
          academic_year_name: '2025–2026',
          class_name: 'Mầm 1',
          grade_level: 'MAM',
          school_level: 'MN',
          content: JSON.stringify({ ket_qua: 'Hoàn thành' }),
          status: 'signed',
          signed_storage_key: 'learning-records/thu-goi.pdf',
          signed_at: new Date('2026-05-30T03:00:00Z'),
          signer_name: 'Hiệu trưởng thử',
          prepared_by_name: 'Giáo viên thử',
        },
        {
          child_id: childId,
          academic_year_name: '2026–2027',
          class_name: 'Lớp C1',
          grade_level: 'CHOI',
          school_level: 'MN',
          content: JSON.stringify({ hoc_ky_1: 'Đạt' }),
          prepared_by_name: 'Giáo viên thử',
        },
      ])
      .execute();
    const requested = await api('POST', '/student-transfers/out', principal.accessToken, {
      child_id: childId,
      school_name: 'Trường Mầm non Bình Minh',
      reason: 'Gia đình chuyển nơi ở',
    });
    assert.equal(requested.status, 201, JSON.stringify(requested.body));
    transferId = requested.body.id as string;
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

  it('CT-1863: Lập gói: phần thêm cần đồng ý; gói có hồ sơ, tệp 82 cột, học bạ đã ký kèm PDF, kết quả năm đang học, nhu cầu đặc biệt; mật khẩu không lưu', async () => {
    const noApplication = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {});
    assert.equal(noApplication.status, 400, JSON.stringify(noApplication.body));
    const noConsent = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {
      application_received: true,
      optional_parts: ['suc-khoe'],
    });
    assert.equal(noConsent.status, 400, JSON.stringify(noConsent.body));
    const unknownPart = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {
      application_received: true,
      optional_parts: ['anh'],
    });
    assert.equal(unknownPart.status, 400);
    const teacher = await environment.loginAs('VT-07', null);
    const forbidden = await api('POST', `/student-transfers/${transferId}/package`, teacher.accessToken, {
      application_received: true,
    });
    assert.equal(forbidden.status, 403);

    const response = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {
      application_received: true,
      optional_parts: ['suc-khoe'],
      consent_recorded: true,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    built = response.body as unknown as typeof built;
    assert.match(built.package_code, /^GCT-\d{8}-[0-9A-Z]{6}$/);
    assert.equal(Buffer.from(built.print_file.content_base64, 'base64').subarray(0, 4).toString(), '%PDF');
    const opened = openTransferPackage(Buffer.from(built.package_file.content_base64, 'base64'), built.password);
    const paths = [...opened.files.keys()].sort();
    assert.deepEqual(paths, [
      'ho-so-82-cot.xlsx',
      'hoc-ba/1.json',
      'hoc-ba/1.pdf',
      'hoc-sinh.json',
      'ket-qua-nam-hoc.json',
      'nhu-cau-dac-biet.json',
      'suc-khoe.json',
    ]);
    assert.equal(opened.files.get('hoc-ba/1.pdf')?.toString(), '%PDF-hoc-ba-thu');
    assert.deepEqual(opened.manifest.consent?.optional_parts, ['suc-khoe']);
    assert.equal(readJsonPart<{ allergies: string }>(opened, 'suc-khoe.json')?.allergies, 'Tôm');
    const row = await schoolYear
      .selectFrom('student_transfers')
      .select(['package_code', 'package_sha256', 'package_parts'])
      .where('id', '=', transferId)
      .executeTakeFirstOrThrow();
    assert.equal(row.package_code, built.package_code);
    assert.equal(row.package_sha256, built.package_sha256);
    assert.ok(!JSON.stringify(row.package_parts).includes(built.password));
    const log = await schoolYear
      .selectFrom('export_logs')
      .select('report_code')
      .where('report_code', '=', 'student-transfer-package')
      .executeTakeFirst();
    assert.ok(log, 'lập gói phải ghi nhật ký xuất');
  });

  it('CT-1864: Xem trước gói: sai mật khẩu bị từ chối; học sinh đã có hồ sơ ở trường thì không tiếp nhận', async () => {
    const body = Buffer.from(built.package_file.content_base64, 'base64');
    const wrong = await upload(
      '/student-transfers/package/preview',
      principal.accessToken,
      { password: 'AAAA-BBBB-CCCC-DDDD' },
      body,
    );
    assert.equal(wrong.status, 422, JSON.stringify(wrong.body));
    assert.equal(errorOf(wrong.body).rule_code, 'BR-480');
    // Chưa đổi hồ sơ gốc: trùng mã định danh Bộ hoặc số định danh với hồ sơ đang có
    await schoolYear
      .updateTable('children')
      .set({ moet_student_code: 'GCT-THU-001' })
      .where('id', '=', childId)
      .execute();
    const rebuilt = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {
      application_received: true,
    });
    assert.equal(rebuilt.status, 200, JSON.stringify(rebuilt.body));
    built = rebuilt.body as unknown as typeof built;
    const preview = await upload(
      '/student-transfers/package/preview',
      principal.accessToken,
      { password: built.password },
      Buffer.from(built.package_file.content_base64, 'base64'),
    );
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal((preview.body.existing_child as { id: string } | null)?.id, childId);
    assert.equal(preview.body.already_received, false);
    const refused = await upload(
      '/student-transfers/package/accept',
      principal.accessToken,
      { password: built.password, class_id: classes.C1 ?? '' },
      Buffer.from(built.package_file.content_base64, 'base64'),
    );
    assert.equal(refused.status, 422, JSON.stringify(refused.body));
  });

  it('CT-1865: Tiếp nhận gói: hồ sơ Đang học trong lớp, học bạ nhận được chỉ đọc tải được PDF, tiếp nhận lại cùng gói bị từ chối', async () => {
    // Giả lập trường đến là trường khác: hồ sơ gốc không còn trùng số định danh, mã Bộ
    await schoolYear
      .updateTable('children')
      .set({ national_id_hash: `truong-khac:${childId}`, moet_student_code: null })
      .where('id', '=', childId)
      .execute();
    const body = Buffer.from(built.package_file.content_base64, 'base64');
    const full = await upload(
      '/student-transfers/package/accept',
      principal.accessToken,
      { password: built.password, class_id: classes.C2 ?? '' },
      body,
    );
    assert.equal(full.status, 200, JSON.stringify(full.body));
    // Lớp C2 sĩ số 1 còn chỗ; lớp đủ chỗ được kiểm trước khi tạo hồ sơ
    const newChildId = full.body.child_id as string;
    assert.ok(newChildId);
    const child = await api('GET', `/children/${newChildId}`, principal.accessToken);
    assert.equal(child.body.status, 'active');
    assert.equal((child.body.current_class as { class_id: string } | null)?.class_id, classes.C2);
    const health = await schoolYear
      .selectFrom('health_profiles')
      .select(['has_allergies', 'allergies'])
      .where('child_id', '=', newChildId)
      .executeTakeFirst();
    assert.notEqual(health?.allergies, 'Tôm', 'gói lần hai không có phần sức khỏe');
    const records = await api(
      'GET',
      `/student-transfers/received-learning-records?child_id=${newChildId}`,
      principal.accessToken,
    );
    assert.equal(records.status, 200, JSON.stringify(records.body));
    const list = records.body as unknown as Array<{ id: string; kind: string; has_file: boolean }>;
    assert.deepEqual(
      list.map((record) => [record.kind, record.has_file]),
      [
        ['learning_record', true],
        ['term_results', false],
      ],
    );
    const pdf = await fetch(`${environment.baseUrl}/student-transfers/received-learning-records/${list[0]?.id}/file`, {
      headers: { authorization: `Bearer ${principal.accessToken}` },
    });
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).toString(), '%PDF-hoc-ba-thu');
    const again = await upload(
      '/student-transfers/package/accept',
      principal.accessToken,
      { password: built.password, class_id: classes.C1 ?? '' },
      body,
    );
    assert.equal(again.status, 422, JSON.stringify(again.body));
    const transfers = await api('GET', '/student-transfers?direction=in', principal.accessToken);
    const item = (transfers.body.items as Array<{ package_code: string | null; status: string }>)[0];
    assert.equal(item?.package_code, built.package_code);
    assert.equal(item?.status, 'received');
  });

  it('CT-1866: Lớp đã đủ sĩ số: không xác nhận thì từ chối và không để lại hồ sơ nháp', async () => {
    await schoolYear
      .updateTable('children')
      .set({ national_id_hash: sql<string>`'truong-khac-2:' || id::text` })
      .where('full_name', '=', 'Vũ Thị Gói')
      .execute();
    const rebuilt = await api('POST', `/student-transfers/${transferId}/package`, principal.accessToken, {
      application_received: true,
    });
    assert.equal(rebuilt.status, 200, JSON.stringify(rebuilt.body));
    const fresh = rebuilt.body as unknown as typeof built;
    const before = await schoolYear
      .selectFrom('children')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const full = await upload(
      '/student-transfers/package/accept',
      principal.accessToken,
      { password: fresh.password, class_id: classes.C2 ?? '' },
      Buffer.from(fresh.package_file.content_base64, 'base64'),
    );
    assert.equal(full.status, 422, JSON.stringify(full.body));
    assert.equal(errorOf(full.body).rule_code, 'BR-04');
    const afterCount = await schoolYear
      .selectFrom('children')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    assert.equal(afterCount.count, before.count);
  });
});
