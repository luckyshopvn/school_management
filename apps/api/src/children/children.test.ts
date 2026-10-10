import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Hồ sơ trẻ theo QT-01; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md mục 3.1 đến 3.3, 3.6
const rows = <Row = Record<string, unknown>>(body: unknown) => body as Row[];
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const DEFAULT_PASSWORD = 'PhuHuynh2026';
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
let nationalIdCounter = randomInt(0, 1_000_000);
const nextNationalId = () =>
  `079${String(Date.now() % 1_000_000).padStart(6, '0')}${String(++nationalIdCounter % 1000).padStart(3, '0')}`;

describe('Hồ sơ trẻ, phụ huynh, duyệt và phân lớp', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  let mother = '';
  let father = '';
  const unit = (code: string) => units[code] ?? '';
  const users: Record<string, LoggedInUser> = {};

  const api = (method: string, path: string, token: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, token, body);

  async function upload(token: string, orgUnitId: string, purpose = 'birth_certificate', content = PNG) {
    const form = new FormData();
    form.set('org_unit_id', orgUnitId);
    form.set('purpose', purpose);
    form.set('file', new Blob([content]), 'giay-khai-sinh.png');
    const response = await fetch(`${environment.baseUrl}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  async function childBody(token: string, orgUnit: string, overrides: Record<string, unknown> = {}) {
    const file = await upload(token, unit(orgUnit));
    return {
      org_unit_id: unit(orgUnit),
      full_name: `Trẻ ${randomInt(0, 1_000_000)}`,
      dob: '2022-04-18',
      gender: 'male',
      national_id: nextNationalId(),
      birth_certificate_file_id: file.body.id,
      photo_consent: 'pending',
      health: { has_allergies: false },
      guardians: [{ full_name: 'Mẹ của trẻ', phone: randomPhone(), relationship_item_id: mother, is_primary: true }],
      ...overrides,
    };
  }

  async function createChild(token: string, orgUnit: string, overrides: Record<string, unknown> = {}) {
    const response = await api('POST', '/children', token, await childBody(token, orgUnit, overrides));
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body;
  }

  // Tạo, gửi trình duyệt và duyệt vào lớp
  async function enrolChild(orgUnit: string, classCode: string, overrides: Record<string, unknown> = {}) {
    const child = await createChild(users.admissions?.accessToken ?? '', orgUnit, overrides);
    const submitted = await api('POST', `/children/${child.id}/submit`, users.admissions?.accessToken ?? '');
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
    const approved = await api('POST', `/children/${child.id}/approve`, principal.accessToken, {
      class_id: classes[classCode],
      confirm_over_capacity: true,
    });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    return approved.body;
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const identityDatabase = environment.identity.database;
    savedDefaultPassword = await identityDatabase
      .selectFrom('identity_settings')
      .select(['key', 'value', 'updated_by'])
      .where('key', '=', 'parent_default_password_hash')
      .execute();
    const saved = await sendJson('PUT', `${environment.identity.baseUrl}/auth/settings`, principal.accessToken, {
      parent_default_password: DEFAULT_PASSWORD,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));

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
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-A2', 'diem_truong'],
      ['PH-B', 'phan_hieu'],
    ] as const) {
      const created = await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type });
      units[code] = created.body.id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    for (const [code, orgUnit, size] of [
      ['L-A1', 'ĐT-A1', 25],
      ['L-A2', 'ĐT-A1', 1],
      ['L-A3', 'ĐT-A2', 25],
      ['L-B1', 'PH-B', 25],
    ] as const) {
      const created = await api('POST', '/classes', principal.accessToken, {
        org_unit_id: unit(orgUnit),
        code,
        name: code,
        grade_level: 'MAM',
        max_size: size,
      });
      classes[code] = created.body.id as string;
    }
    mother = (
      await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code: 'ME',
        name: 'Mẹ',
      })
    ).body.id as string;
    father = (
      await api('POST', '/catalog-items', principal.accessToken, {
        catalog_type: 'parent_relationship',
        code: 'BO',
        name: 'Bố',
      })
    ).body.id as string;

    const groupA = (roleCode: string) => [
      { roleCode, orgUnitId: unit('ĐT-A1') },
      { roleCode, orgUnitId: unit('ĐT-A2') },
    ];
    users.admissions = await environment.loginWithRoles(groupA('VT-12'));
    users.manager = await environment.loginWithRoles(groupA('VT-03'));
    users.managerA1 = await environment.loginAs('VT-03', unit('ĐT-A1'));
    users.deputy = await environment.loginWithRoles(groupA('VT-15'));
    users.accountant = await environment.loginWithRoles(groupA('VT-04'));
    users.kitchen = await environment.loginWithRoles(groupA('VT-10'));
    users.homeroom = await environment.loginAs('VT-07', unit('ĐT-A1'));
    users.subject = await environment.loginAs('VT-08', unit('ĐT-A1'));
    for (const [teacher, role, classCode] of [
      ['homeroom', 'homeroom', 'L-A1'],
      ['subject', 'subject', 'L-A1'],
    ] as const) {
      const assigned = await api('POST', `/classes/${classes[classCode]}/staff-assignments`, principal.accessToken, {
        staff_user_id: users[teacher]?.userId,
        assignment_role: role,
        subject_name: role === 'subject' ? 'Tiếng Anh' : undefined,
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    }
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

  describe('Tệp đính kèm', () => {
    it('YCTD-45: chỉ nhận ảnh hoặc PDF; giấy khai sinh chỉ vai trò được xem đầy đủ mới tải được và có ghi nhật ký', async () => {
      const text = await upload(
        users.admissions?.accessToken ?? '',
        unit('ĐT-A1'),
        'birth_certificate',
        Buffer.from('xin chào'),
      );
      assert.equal(text.status, 400);
      const outside = await upload(users.admissions?.accessToken ?? '', unit('PH-B'));
      assert.equal(outside.status, 403);
      const child = await createChild(users.admissions?.accessToken ?? '', 'ĐT-A1');
      const fileId = child.birth_certificate_file_id as string;
      const download = await fetch(`${environment.baseUrl}/files/${fileId}`, {
        headers: { authorization: `Bearer ${principal.accessToken}` },
      });
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), PNG);
      const denied = await fetch(`${environment.baseUrl}/files/${fileId}`, {
        headers: { authorization: `Bearer ${users.accountant?.accessToken}` },
      });
      assert.equal(denied.status, 403);
      const logs = await schoolYear
        .selectFrom('data_access_logs')
        .select('scope')
        .where('entity_id', '=', child.id as string)
        .execute();
      assert.deepEqual(
        logs.map((log) => log.scope),
        ['birth_certificate'],
      );
    });
  });

  describe('P02-02 Hồ sơ trẻ', () => {
    it('CTC-P02-008: tuyển sinh tạo hồ sơ đủ thông tin thì ở trạng thái nháp', async () => {
      const child = await createChild(users.admissions?.accessToken ?? '', 'ĐT-A1');
      assert.equal(child.status, 'draft');
      assert.match(child.national_id_masked as string, /^\*{8}\d{4}$/);
      assert.equal((child.guardians as unknown[]).length, 1);
      assert.equal(child.photo_consent, 'pending');
    });

    it('CTC-P02-009, CTC-P02-010, CTC-P02-011: thiếu ngày sinh, số định danh, giấy khai sinh, số định danh sai dạng bị từ chối', async () => {
      const token = users.admissions?.accessToken ?? '';
      for (const [field, overrides] of [
        ['dob', { dob: undefined }],
        ['national_id', { national_id: undefined }],
        ['birth_certificate_file_id', { birth_certificate_file_id: undefined }],
        ['national_id', { national_id: '12345678901' }],
        ['national_id', { national_id: '12345678901A' }],
      ] as const) {
        const response = await api('POST', '/children', token, await childBody(token, 'ĐT-A1', overrides));
        assert.equal(response.status, 400, field);
        assert.ok(
          errorOf(response.body).details?.some((detail) => detail.field === field),
          field,
        );
      }
    });

    it('CTC-P02-012: số định danh trùng hồ sơ ở đơn vị khác trả ERR_CONFLICT chỉ ra hồ sơ trùng', async () => {
      const token = users.admissions?.accessToken ?? '';
      const body = await childBody(principal.accessToken, 'PH-B');
      const first = await api('POST', '/children', principal.accessToken, body);
      assert.equal(first.status, 201);
      const duplicate = await api('POST', '/children', token, {
        ...(await childBody(token, 'ĐT-A1')),
        national_id: body.national_id,
      });
      assert.equal(duplicate.status, 409);
      assert.equal(errorOf(duplicate.body).details?.[0]?.message, first.body.id);
    });

    it('CTC-P02-014: trùng họ tên và ngày sinh trong đơn vị chỉ cảnh báo; xác nhận thì vẫn lưu', async () => {
      const token = users.admissions?.accessToken ?? '';
      await createChild(token, 'ĐT-A1', { full_name: 'Nguyễn Gia Bảo', dob: '2022-04-18' });
      const check = await api(
        'GET',
        `/children/check-duplicate?org_unit_id=${unit('ĐT-A1')}&full_name=${encodeURIComponent('nguyễn  gia bảo')}&dob=2022-04-18`,
        token,
      );
      assert.equal(rows(check.body).length, 1);
      const warned = await api(
        'POST',
        '/children',
        token,
        await childBody(token, 'ĐT-A1', { full_name: 'Nguyễn Gia Bảo', dob: '2022-04-18' }),
      );
      assert.equal(warned.status, 422);
      assert.equal(errorOf(warned.body).details?.[0]?.field, 'possible_duplicates');
      const confirmed = await api(
        'POST',
        '/children',
        token,
        await childBody(token, 'ĐT-A1', {
          full_name: 'Nguyễn Gia Bảo',
          dob: '2022-04-18',
          confirm_possible_duplicate: true,
        }),
      );
      assert.equal(confirmed.status, 201);
    });

    it('CTC-P02-015: hồ sơ chưa khai báo dị ứng không gửi trình duyệt được', async () => {
      const token = users.admissions?.accessToken ?? '';
      const child = await createChild(token, 'ĐT-A1', { health: {} });
      const submitted = await api('POST', `/children/${child.id}/submit`, token);
      assert.equal(submitted.status, 422);
      assert.equal(errorOf(submitted.body).rule_code, 'BR-06');
      const fixed = await api('PATCH', `/children/${child.id}`, token, {
        health: { has_allergies: true, allergies: 'Đậu phộng' },
      });
      assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
      assert.equal((await api('POST', `/children/${child.id}/submit`, token)).status, 200);
    });

    it('CTC-P02-016, CTC-P02-028: duyệt vào L-A1 thì trẻ đang học ở ĐT-A1, có lịch sử lớp; hai phụ huynh có tài khoản mật khẩu mặc định', async () => {
      const before = rows<{ id: string; enrolled_count: number }>(
        (await api('GET', `/classes?org_unit_id=${unit('ĐT-A1')}`, principal.accessToken)).body,
      ).find((row) => row.id === classes['L-A1'])?.enrolled_count;
      const phones = [randomPhone(), randomPhone()];
      const token = users.admissions?.accessToken ?? '';
      const child = await createChild(token, 'ĐT-A1', {
        guardians: [
          { full_name: 'Mẹ', phone: phones[0], relationship_item_id: mother, is_primary: true },
          { full_name: 'Bố', phone: phones[1], relationship_item_id: father },
        ],
      });
      await api('POST', `/children/${child.id}/submit`, token);
      const approved = await api('POST', `/children/${child.id}/approve`, users.manager?.accessToken ?? '', {
        class_id: classes['L-A1'],
      });
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'active');
      assert.equal(approved.body.org_unit_id, unit('ĐT-A1'));
      assert.equal((approved.body.enrollments as unknown[]).length, 1);
      assert.ok((approved.body.guardians as Array<{ has_account: boolean }>).every((guardian) => guardian.has_account));
      const after = rows<{ id: string; enrolled_count: number }>(
        (await api('GET', `/classes?org_unit_id=${unit('ĐT-A1')}`, principal.accessToken)).body,
      ).find((row) => row.id === classes['L-A1'])?.enrolled_count;
      assert.equal(after, (before ?? 0) + 1);
      const accounts = await environment.identity.database
        .selectFrom('users')
        .select(['password_hash', 'must_change_password'])
        .where('phone', 'in', phones)
        .execute();
      assert.equal(accounts.length, 2);
      assert.ok(accounts.every((account) => account.password_hash === null && account.must_change_password));
      const queued = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select(['notifications.template_code', 'notification_recipients.channel'])
        .where('notifications.target_id', '=', child.id as string)
        .execute();
      assert.ok(queued.some((row) => row.template_code === 'guardian_account_created' && row.channel === 'sms'));
      assert.ok(queued.some((row) => row.template_code === 'child_approved' && row.channel === 'in_app'));
    });

    it('CTC-P02-017: từ chối kèm lý do thì hồ sơ về nháp, người lập nhận thông báo', async () => {
      const token = users.admissions?.accessToken ?? '';
      const child = await createChild(token, 'ĐT-A1');
      await api('POST', `/children/${child.id}/submit`, token);
      const rejected = await api('POST', `/children/${child.id}/reject`, users.manager?.accessToken ?? '', {
        reason: 'Thiếu ảnh giấy khai sinh rõ nét',
      });
      assert.equal(rejected.body.status, 'draft');
      assert.equal(rejected.body.reject_reason, 'Thiếu ảnh giấy khai sinh rõ nét');
      const notified = await schoolYear
        .selectFrom('notifications')
        .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
        .select('notification_recipients.user_id')
        .where('notifications.target_id', '=', child.id as string)
        .where('notifications.template_code', '=', 'child_rejected')
        .execute();
      assert.deepEqual(
        notified.map((row) => row.user_id),
        [users.admissions?.userId],
      );
    });

    it('CTC-P02-018, CTC-P02-019, CTC-P02-020: ngoài phạm vi hoặc không có quyền duyệt bị từ chối', async () => {
      const outside = await createChild(principal.accessToken, 'PH-B');
      assert.equal(
        (await api('POST', `/children/${outside.id}/submit`, users.admissions?.accessToken ?? '')).status,
        403,
      );
      const token = users.admissions?.accessToken ?? '';
      const child = await createChild(token, 'ĐT-A2');
      await api('POST', `/children/${child.id}/submit`, token);
      assert.equal(
        (
          await api('POST', `/children/${child.id}/approve`, users.subject?.accessToken ?? '', {
            class_id: classes['L-A3'],
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api('POST', `/children/${child.id}/approve`, users.managerA1?.accessToken ?? '', {
            class_id: classes['L-A1'],
          })
        ).status,
        403,
      );
    });

    it('CTC-P02-021, CTC-P02-022, CTC-P02-023: bốn vai trò xem đầy đủ số định danh và mỗi lần đều ghi nhật ký; vai trò khác bị từ chối; cơ sở dữ liệu chỉ lưu bản mã', async () => {
      const token = users.admissions?.accessToken ?? '';
      const body = await childBody(token, 'ĐT-A1');
      const created = await api('POST', '/children', token, body);
      const childId = created.body.id as string;
      for (const viewer of [users.manager, users.admissions, users.deputy, principal]) {
        const response = await api('GET', `/children/${childId}/national-id`, viewer?.accessToken ?? '');
        assert.equal(response.status, 200);
        assert.equal(response.body.national_id, body.national_id);
      }
      for (const viewer of [users.accountant, users.homeroom, users.kitchen]) {
        assert.equal((await api('GET', `/children/${childId}/national-id`, viewer?.accessToken ?? '')).status, 403);
      }
      const logs = await schoolYear
        .selectFrom('data_access_logs')
        .select('actor_user_id')
        .where('entity_id', '=', childId)
        .where('scope', '=', 'national_id')
        .execute();
      assert.equal(logs.length, 4);
      const stored = await schoolYear
        .selectFrom('children')
        .select('national_id_encrypted')
        .where('id', '=', childId)
        .executeTakeFirstOrThrow();
      assert.ok(!stored.national_id_encrypted.includes(body.national_id as string));
      assert.ok(
        !Buffer.from(stored.national_id_encrypted, 'base64')
          .toString('utf8')
          .includes(body.national_id as string),
      );
    });

    it('CTC-P02-024, CTC-P02-025, CTC-P02-026: trẻ đang học chỉ quản lý đơn vị sửa thông tin định danh kèm lý do', async () => {
      const child = await enrolChild('ĐT-A1', 'L-A1');
      const childId = child.id as string;
      assert.equal(
        (await api('PATCH', `/children/${childId}`, users.admissions?.accessToken ?? '', { dob: '2022-05-01' })).status,
        403,
      );
      assert.equal(
        (await api('PATCH', `/children/${childId}`, users.manager?.accessToken ?? '', { dob: '2022-05-01' })).status,
        400,
      );
      const fixed = await api('PATCH', `/children/${childId}`, users.manager?.accessToken ?? '', {
        dob: '2022-05-01',
        reason: 'Sai ngày sinh so với giấy khai sinh',
      });
      assert.equal(fixed.status, 200, JSON.stringify(fixed.body));
      assert.equal(fixed.body.dob, '2022-05-01');
      const log = await api('GET', `/audit-logs?entity_name=children&entity_id=${childId}`, principal.accessToken);
      const latest = rows<{ after_data: { reason?: string } }>((log.body as { items: unknown }).items)[0];
      assert.equal(latest?.after_data.reason, 'Sai ngày sinh so với giấy khai sinh');
      assert.equal(
        (await api('PATCH', `/children/${childId}`, users.accountant?.accessToken ?? '', { address: 'Khác' })).status,
        403,
      );
      assert.equal(
        (await api('PATCH', `/children/${childId}`, users.homeroom?.accessToken ?? '', { dob: '2022-06-01' })).status,
        403,
      );
    });
  });

  describe('P02-01, P02-10 Danh sách trẻ và P02-03 Phụ huynh', () => {
    it('CTC-P02-001, CTC-P02-002, CTC-P02-005: lọc theo lớp và trạng thái có phân trang; quản lý ĐT-A1 chỉ thấy trẻ ĐT-A1; kế toán thấy số định danh đã che', async () => {
      await enrolChild('ĐT-A2', 'L-A3');
      const filtered = await api(
        'GET',
        `/children?class_id=${classes['L-A1']}&status=active&page=1&page_size=20`,
        users.manager?.accessToken ?? '',
      );
      const items = rows<{ class_id: string; status: string }>((filtered.body as { items: unknown }).items);
      assert.ok(items.length > 0);
      assert.ok(items.every((item) => item.class_id === classes['L-A1'] && item.status === 'active'));
      assert.equal(typeof filtered.body.total, 'number');

      const scoped = rows<{ org_unit_id: string }>(
        ((await api('GET', '/children?page_size=100', users.managerA1?.accessToken ?? '')).body as { items: unknown })
          .items,
      );
      assert.ok(scoped.length > 0);
      assert.ok(scoped.every((item) => item.org_unit_id === unit('ĐT-A1')));

      const accountantView = rows<{ national_id_masked: string }>(
        ((await api('GET', '/children', users.accountant?.accessToken ?? '')).body as { items: unknown }).items,
      );
      assert.ok(accountantView.every((item) => /^\*{8}\d{4}$/.test(item.national_id_masked)));
    });

    it('CTC-P02-006, CTC-P02-007: giáo viên chỉ xem danh sách trẻ của lớp được phân công', async () => {
      assert.equal(
        (await api('GET', `/classes/${classes['L-A1']}/children`, users.homeroom?.accessToken ?? '')).status,
        200,
      );
      assert.equal(
        (await api('GET', `/classes/${classes['L-A2']}/children`, users.homeroom?.accessToken ?? '')).status,
        403,
      );
      assert.equal(
        (await api('GET', `/classes/${classes['L-A1']}/children`, users.subject?.accessToken ?? '')).status,
        200,
      );
      const visible = rows<{ class_id: string }>(
        ((await api('GET', '/children', users.homeroom?.accessToken ?? '')).body as { items: unknown }).items,
      );
      assert.ok(visible.every((item) => item.class_id === classes['L-A1']));
    });

    it('CTC-P02-029, CTC-P02-003, CTC-P02-027: số điện thoại có sẵn thì gắn phụ huynh cũ; phụ huynh chỉ thấy con mình', async () => {
      const phone = randomPhone();
      const first = await enrolChild('ĐT-A1', 'L-A1', {
        guardians: [{ full_name: 'Chị Lan', phone, relationship_item_id: mother, is_primary: true }],
      });
      const second = await enrolChild('ĐT-A1', 'L-A1', {
        guardians: [{ full_name: 'Chị Lan', phone, relationship_item_id: mother, is_primary: true }],
      });
      const guardianIds = new Set([
        (first.guardians as Array<{ id: string }>)[0]?.id,
        (second.guardians as Array<{ id: string }>)[0]?.id,
      ]);
      assert.equal(guardianIds.size, 1);
      const accounts = await environment.identity.database
        .selectFrom('users')
        .select('id')
        .where('phone', '=', phone)
        .execute();
      assert.equal(accounts.length, 1);

      // Đặt mật khẩu cho tài khoản phụ huynh để đăng nhập kiểm thử
      await environment.identity.database
        .updateTable('users')
        .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
        .where('phone', '=', phone)
        .execute();
      const login = await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
        login: phone,
        password: TEST_PASSWORD,
        channel: 'parent',
      });
      const parentToken = login.body.access_token as string;
      const own = rows<{ id: string }>(((await api('GET', '/children', parentToken)).body as { items: unknown }).items);
      assert.deepEqual(own.map((item) => item.id).sort(), [first.id, second.id].sort());
      const other = await enrolChild('ĐT-A1', 'L-A1');
      assert.equal((await api('GET', `/children/${other.id}`, parentToken)).status, 403);
      assert.equal((await api('GET', `/children/${first.id}`, parentToken)).status, 200);
    });

    it('CTC-P02-030, CTC-P02-031, CTC-P02-032: số điện thoại sai bị từ chối; chỉ một liên hệ chính; phụ huynh không số điện thoại không có tài khoản', async () => {
      const token = users.admissions?.accessToken ?? '';
      const invalid = await api(
        'POST',
        '/children',
        token,
        await childBody(token, 'ĐT-A1', {
          guardians: [{ full_name: 'Mẹ', phone: '091234567', relationship_item_id: mother, is_primary: true }],
        }),
      );
      assert.equal(invalid.status, 400);

      const child = await createChild(token, 'ĐT-A1', {
        guardians: [
          { full_name: 'Mẹ', phone: randomPhone(), relationship_item_id: mother, is_primary: true },
          { full_name: 'Bố', phone: null, relationship_item_id: father },
        ],
      });
      const fatherGuardian = (child.guardians as Array<{ id: string; relationship: string }>).find(
        (guardian) => guardian.relationship === 'Bố',
      );
      const switched = await api('PATCH', `/children/${child.id}/guardians/${fatherGuardian?.id}`, token, {
        is_primary: true,
      });
      assert.equal(switched.status, 200);
      const primaries = (switched.body.guardians as Array<{ is_primary: boolean; relationship: string }>).filter(
        (guardian) => guardian.is_primary,
      );
      assert.deepEqual(
        primaries.map((guardian) => guardian.relationship),
        ['Bố'],
      );
      await api('POST', `/children/${child.id}/submit`, token);
      const approved = await api('POST', `/children/${child.id}/approve`, principal.accessToken, {
        class_id: classes['L-A1'],
      });
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      const accounts = (approved.body.guardians as Array<{ relationship: string; has_account: boolean }>).map(
        (guardian) => [guardian.relationship, guardian.has_account],
      );
      assert.deepEqual(
        new Map(accounts as Array<[string, boolean]>),
        new Map([
          ['Bố', false],
          ['Mẹ', true],
        ]),
      );
    });
  });

  describe('P02-06 Phân lớp và chuyển lớp', () => {
    it('CTC-P02-044, CTC-P02-046: chuyển lớp thì sĩ số hai lớp đổi, lịch sử thêm một dòng, trẻ chỉ thuộc một lớp', async () => {
      const child = await enrolChild('ĐT-A1', 'L-A1');
      const moved = await api('POST', `/children/${child.id}/transfer-class`, users.manager?.accessToken ?? '', {
        class_id: classes['L-A2'],
        reason: 'Phụ huynh xin chuyển lớp',
        confirm_over_capacity: true,
      });
      assert.equal(moved.status, 200, JSON.stringify(moved.body));
      const enrollments = moved.body.enrollments as Array<{
        class_id: string;
        is_current: boolean;
        to_date: string | null;
      }>;
      assert.equal(enrollments.length, 2);
      assert.deepEqual(
        enrollments.filter((enrollment) => enrollment.is_current).map((enrollment) => enrollment.class_id),
        [classes['L-A2']],
      );
      assert.ok(enrollments.find((enrollment) => !enrollment.is_current)?.to_date);
    });

    it('CTC-P02-045: lớp đủ sĩ số thì cảnh báo, xác nhận thì chuyển được', async () => {
      const child = await enrolChild('ĐT-A1', 'L-A1');
      const warned = await api('POST', `/children/${child.id}/transfer-class`, users.manager?.accessToken ?? '', {
        class_id: classes['L-A2'],
        reason: 'Chuyển lớp',
      });
      assert.equal(warned.status, 422);
      assert.equal(errorOf(warned.body).rule_code, 'BR-04');
      const confirmed = await api('POST', `/children/${child.id}/transfer-class`, users.manager?.accessToken ?? '', {
        class_id: classes['L-A2'],
        reason: 'Chuyển lớp',
        confirm_over_capacity: true,
      });
      assert.equal(confirmed.status, 200);
    });

    it('CTC-P02-047: Hiệu trưởng duyệt hồ sơ vào lớp của đơn vị khác thì đơn vị của trẻ là đơn vị của lớp', async () => {
      const token = users.admissions?.accessToken ?? '';
      const child = await createChild(token, 'ĐT-A1');
      await api('POST', `/children/${child.id}/submit`, token);
      const approved = await api('POST', `/children/${child.id}/approve`, principal.accessToken, {
        class_id: classes['L-B1'],
      });
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.org_unit_id, unit('PH-B'));
    });

    it('CTC-P02-048, BR-02: giáo viên không chuyển lớp được; lớp còn trẻ không đóng được', async () => {
      const child = await enrolChild('ĐT-A1', 'L-A1');
      assert.equal(
        (
          await api('POST', `/children/${child.id}/transfer-class`, users.homeroom?.accessToken ?? '', {
            class_id: classes['L-A2'],
            reason: 'Thử',
          })
        ).status,
        403,
      );
      const closed = await api('PATCH', `/classes/${classes['L-A1']}`, principal.accessToken, { status: 'closed' });
      assert.equal(closed.status, 422);
    });
  });

  describe('Cờ trẻ con nhân viên và đồng ý hình ảnh khi lập hồ sơ', () => {
    it('YCTD-45: cờ trẻ con nhân viên lưu nhân sự liên quan; đồng ý bằng giấy ký tay cần bản chụp', async () => {
      const token = users.admissions?.accessToken ?? '';
      const flagged = await createChild(token, 'ĐT-A1', {
        is_staff_child: true,
        related_staff_user_id: users.homeroom?.userId,
        related_staff_role_code: 'VT-07',
      });
      assert.equal(flagged.is_staff_child, true);
      assert.equal(typeof flagged.related_staff_name, 'string');
      const missingScan = await api(
        'POST',
        '/children',
        token,
        await childBody(token, 'ĐT-A1', { photo_consent: 'granted' }),
      );
      assert.equal(missingScan.status, 400);
      const scan = await upload(token, unit('ĐT-A1'), 'photo_consent');
      const granted = await createChild(token, 'ĐT-A1', {
        photo_consent: 'granted',
        photo_consent_file_id: scan.body.id,
      });
      assert.equal(granted.photo_consent, 'granted');
      assert.equal(granted.photo_consent_method, 'paper');
    });
  });
});
