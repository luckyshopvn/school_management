import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import { hashForTesting, TEST_PASSWORD } from '@school-management/identity/testing';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Người được ủy quyền đón trẻ và đón trả; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/02_P02_VA_P04.md mục 3.4, 4.3
const PAST_DAY = '2026-10-05';
const OTHER_PAST_DAY = '2026-10-06';
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as {
    code?: string;
    rule_code?: string;
    message?: string;
    details?: Array<{ field: string; message: string }>;
  };
// Ảnh PNG nhỏ nhất đủ chữ ký tệp
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

type ClassPickups = {
  can_hand_over: boolean;
  children: Array<{
    child_id: string;
    full_name: string;
    is_present: boolean;
    guardians: Array<{ guardian_id: string; full_name: string }>;
    authorized_pickups: Array<{ id: string; full_name: string; is_valid_today: boolean }>;
    handover: { person_name: string; person_kind: string } | null;
    confirmation_requests: Array<{ id: string; status: string }>;
  }>;
};

describe('Người được ủy quyền đón trẻ và đón trả', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const parentPhones = { T1: randomPhone(), T2: randomPhone() };
  const parentTokens: Record<string, string> = {};
  const parentUserIds: Record<string, string> = {};
  let grandmotherId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const handOver = (accessToken: string, child: string, body: Record<string, unknown>) =>
    api('POST', `/children/${children[child]}/pickups`, accessToken, { pickup_type: 'handover', ...body });
  const classPickups = async (accessToken: string, classCode: string, date: string) =>
    (await api('GET', `/classes/${classes[classCode]}/pickups?date=${date}`, accessToken))
      .body as unknown as ClassPickups;
  const notificationsFor = async (userId: string, templateCode: string) =>
    schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select(['notifications.body'])
      .where('notification_recipients.user_id', '=', userId)
      .where('notifications.template_code', '=', templateCode)
      .execute();

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
      first_term: { start_date: '2026-09-01', end_date: '2027-01-15' },
      second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
      summer_term: { start_date: '2027-06-01', end_date: '2027-07-31' },
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
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 48,
      age_to_months: 59,
    });
    await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'parent_relationship',
      code: 'ME',
      name: 'Mẹ',
    });
    for (const [code, unit] of [
      ['L-A1', 'ĐT-A1'],
      ['L-B1', 'ĐT-B1'],
    ] as const) {
      classes[code] = (
        await api('POST', '/classes', principal.accessToken, {
          org_unit_id: units[unit],
          code,
          name: code,
          grade_level: 'MAM',
          max_size: 25,
        })
      ).body.id as string;
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.otherTeacher = await environment.loginAs('VT-07', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.guard = await environment.loginAs('VT-18', unitA);
    await api('POST', `/classes/${classes['L-A1']}/staff-assignments`, principal.accessToken, {
      staff_user_id: users.teacher?.userId,
      assignment_role: 'homeroom',
      from_date: '2026-09-01',
    });

    // T1, T2 học L-A1 ở ĐT-A1, T3 học L-B1 ở ĐT-B1; phụ huynh của T1, T2 đăng nhập ứng dụng phụ huynh
    const book = new ExcelJS.Workbook();
    const worksheet = book.addWorksheet('Trẻ');
    worksheet.addRow(IMPORT_COLUMNS.children.map((column) => column.header));
    for (const [index, [name, unit, classCode]] of [
      ['T1', 'ĐT-A1', 'L-A1'],
      ['T2', 'ĐT-A1', 'L-A1'],
      ['T3', 'ĐT-B1', 'L-B1'],
    ].entries()) {
      const row: Record<string, string> = {
        unit_code: unit ?? '',
        class_code: classCode ?? '',
        full_name: `Trẻ ${name}`,
        dob: '2022-04-18',
        gender: 'Nữ',
        national_id: `082${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: '2026-09-01',
        guardian1_name: `Mẹ ${name}`,
        guardian1_relationship: 'Mẹ',
        guardian1_phone: parentPhones[name as 'T1' | 'T2'] ?? randomPhone(),
      };
      worksheet.addRow(IMPORT_COLUMNS.children.map((column) => row[column.key] ?? ''));
    }
    const form = new FormData();
    form.set('type', 'children');
    form.set('file', new Blob([Buffer.from(await book.xlsx.writeBuffer())]), 'tre.xlsx');
    const uploaded = (await (
      await fetch(`${environment.baseUrl}/imports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${principal.accessToken}` },
        body: form,
      })
    ).json()) as { id: string; status: string };
    assert.equal(uploaded.status, 'validated', JSON.stringify(uploaded));
    const committed = await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken);
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    for (const row of await schoolYear.selectFrom('children').select(['id', 'full_name']).execute()) {
      children[row.full_name.replace('Trẻ ', '')] = row.id;
    }

    for (const [child, phone] of Object.entries(parentPhones)) {
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
      parentTokens[child] = login.body.access_token as string;
      parentUserIds[child] = (
        await environment.identity.database
          .selectFrom('users')
          .select('id')
          .where('phone', '=', phone)
          .executeTakeFirstOrThrow()
      ).id;
    }

    // Điểm danh có mặt lúc 07:40 cả hai ngày; ngày thứ hai T2 vắng
    for (const [date, t2Status] of [
      [PAST_DAY, 'present'],
      [OTHER_PAST_DAY, 'absent_unnotified'],
    ] as const) {
      const saved = await api('PUT', `/classes/${classes['L-A1']}/attendance`, token('teacher'), {
        date,
        entries: [
          { child_id: children.T1, status: 'present' },
          { child_id: children.T2, status: t2Status },
        ],
        offline_recorded_at: `${date}T07:40:00+07:00`,
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
    }
  });

  after(async () => {
    const identity = environment.identity.database;
    await identity.deleteFrom('identity_settings').where('key', '=', 'parent_default_password_hash').execute();
    for (const row of savedDefaultPassword) {
      await identity
        .insertInto('identity_settings')
        .values({ key: row.key, value: JSON.stringify(row.value), updated_by: row.updated_by })
        .execute();
    }
    await schoolYear.destroy();
    await environment.close();
  });

  describe('P02-04 Người được ủy quyền đón trẻ', () => {
    it('CTC-P02-034: phụ huynh khai báo bà ngoại kèm quan hệ, số điện thoại, thời hạn; có trong danh sách của T1', async () => {
      const created = await api('POST', `/children/${children.T1}/authorized-pickups`, parentTokens.T1 ?? '', {
        full_name: 'Trần Thị Lan',
        relationship: 'Bà ngoại',
        phone: randomPhone(),
        valid_from: '2026-10-01',
        valid_to: '2026-10-31',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.source, 'parent');
      grandmotherId = created.body.id as string;
      const listed = await api('GET', `/children/${children.T1}/authorized-pickups`, token('teacher'));
      assert.equal(listed.status, 200);
      assert.ok((listed.body as unknown as Array<{ id: string }>).some((row) => row.id === grandmotherId));
    });

    it('CTC-P02-035: khai báo thiếu số điện thoại trả ERR_VALIDATION', async () => {
      const response = await api('POST', `/children/${children.T1}/authorized-pickups`, parentTokens.T1 ?? '', {
        full_name: 'Người thiếu số',
        relationship: 'Cô',
      });
      assert.equal(response.status, 400);
      assert.equal(errorOf(response.body).code, 'ERR_VALIDATION');
    });

    it('CTC-P02-036: phụ huynh khai báo người đón cho trẻ không phải con mình bị từ chối; giáo viên không khai báo được', async () => {
      const body = { full_name: 'Người lạ', relationship: 'Cô', phone: randomPhone() };
      assert.equal(
        (await api('POST', `/children/${children.T2}/authorized-pickups`, parentTokens.T1 ?? '', body)).status,
        403,
      );
      assert.equal(
        (await api('POST', `/children/${children.T1}/authorized-pickups`, token('teacher'), body)).status,
        403,
      );
    });

    it('Quản lý đơn vị khai báo cho trẻ trong đơn vị; không khai báo được cho trẻ đơn vị khác', async () => {
      const body = { full_name: 'Nguyễn Văn Hùng', relationship: 'Ông nội', phone: randomPhone() };
      const created = await api('POST', `/children/${children.T1}/authorized-pickups`, token('manager'), body);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.source, 'staff');
      assert.equal(created.body.valid_to, null);
      assert.equal(
        (await api('POST', `/children/${children.T3}/authorized-pickups`, token('manager'), body)).status,
        403,
      );
    });

    it('CTC-P02-037: phụ huynh hủy ủy quyền thì người đó không còn trong danh sách', async () => {
      const temporary = await api('POST', `/children/${children.T1}/authorized-pickups`, parentTokens.T1 ?? '', {
        full_name: 'Lê Văn Tạm',
        relationship: 'Chú',
        phone: randomPhone(),
      });
      const revoked = await api('DELETE', `/authorized-pickups/${temporary.body.id}`, parentTokens.T1 ?? '');
      assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
      const listed = (await api('GET', `/children/${children.T1}/authorized-pickups`, parentTokens.T1 ?? ''))
        .body as unknown as Array<{ id: string }>;
      assert.ok(!listed.some((row) => row.id === temporary.body.id));
      assert.equal(
        (await api('DELETE', `/authorized-pickups/${temporary.body.id}`, parentTokens.T2 ?? '')).status,
        403,
      );
    });
  });

  describe('P04-03 Đón trả trẻ', () => {
    it('CTC-P04-031: thời điểm đón trước thời điểm điểm danh bị từ chối', async () => {
      const response = await handOver(token('teacher'), 'T1', {
        date: PAST_DAY,
        authorized_pickup_id: grandmotherId,
        picked_up_at: `${PAST_DAY}T07:00:00+07:00`,
      });
      assert.equal(response.status, 422, JSON.stringify(response.body));
      assert.equal(errorOf(response.body).rule_code, 'QT-02');
    });

    it('Giáo viên không chủ nhiệm lớp và bảo vệ không bàn giao được', async () => {
      const body = { date: PAST_DAY, authorized_pickup_id: grandmotherId, picked_up_at: `${PAST_DAY}T17:05:00+07:00` };
      assert.equal((await handOver(token('otherTeacher'), 'T1', body)).status, 403);
      assert.equal((await handOver(token('guard'), 'T1', body)).status, 403);
    });

    it('CTC-P04-024, CTC-P04-030: bàn giao cho bà ngoại kèm ảnh; nhật ký có người đón và thời điểm; phụ huynh nhận thông báo và xem được ảnh', async () => {
      const form = new FormData();
      form.set('org_unit_id', units['ĐT-A1'] ?? '');
      form.set('purpose', 'pickup_photo');
      form.set('file', new Blob([PNG_BYTES]), 'ban-giao.png');
      const photo = (await (
        await fetch(`${environment.baseUrl}/files`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token('teacher')}` },
          body: form,
        })
      ).json()) as { id: string };
      assert.ok(photo.id, JSON.stringify(photo));
      const response = await handOver(token('teacher'), 'T1', {
        date: PAST_DAY,
        authorized_pickup_id: grandmotherId,
        photo_file_id: photo.id,
        picked_up_at: `${PAST_DAY}T17:05:00+07:00`,
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.person_name, 'Trần Thị Lan');
      assert.equal(response.body.person_kind, 'authorized');
      assert.equal(new Date(response.body.recorded_at as string).toISOString(), '2026-10-05T10:05:00.000Z');
      assert.equal((await notificationsFor(parentUserIds.T1 ?? '', 'child_handed_over')).length, 1);
      const view = await classPickups(token('teacher'), 'L-A1', PAST_DAY);
      assert.equal(view.can_hand_over, true);
      assert.equal(
        view.children.find((child) => child.child_id === children.T1)?.handover?.person_name,
        'Trần Thị Lan',
      );
      const download = (accessToken: string) =>
        fetch(`${environment.baseUrl}/files/${photo.id}`, { headers: { authorization: `Bearer ${accessToken}` } });
      assert.equal((await download(parentTokens.T1 ?? '')).status, 200);
      assert.equal((await download(parentTokens.T2 ?? '')).status, 403);
      const again = await handOver(token('teacher'), 'T1', {
        date: PAST_DAY,
        authorized_pickup_id: grandmotherId,
        picked_up_at: `${PAST_DAY}T17:10:00+07:00`,
      });
      assert.equal(again.status, 422);
    });

    it('CTC-P04-025, CTC-P04-026: người đón ngoài danh sách bị chặn, phụ huynh nhận yêu cầu; xác nhận xong thì bàn giao được và nhật ký ghi xác nhận', async () => {
      const body = {
        date: OTHER_PAST_DAY,
        person: { full_name: 'Phạm Văn Tư', relationship: 'Chú hàng xóm', phone: randomPhone() },
        picked_up_at: `${OTHER_PAST_DAY}T17:00:00+07:00`,
      };
      const blocked = await handOver(token('teacher'), 'T1', body);
      assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
      assert.equal(errorOf(blocked.body).rule_code, 'BR-56');
      const requestId = errorOf(blocked.body).details?.find(
        (detail) => detail.field === 'confirmation_request_id',
      )?.message;
      assert.ok(requestId);
      assert.equal((await notificationsFor(parentUserIds.T1 ?? '', 'pickup_confirmation_requested')).length, 1);
      // Gửi lại khi chưa xác nhận vẫn chặn và không tạo yêu cầu thứ hai
      assert.equal(
        (await handOver(token('teacher'), 'T1', { ...body, person: { ...body.person, full_name: ' phạm  văn tư ' } }))
          .status,
        422,
      );
      const pending = (await api('GET', '/pickup-confirmations', parentTokens.T1 ?? '')).body as unknown as Array<{
        id: string;
      }>;
      assert.deepEqual(
        pending.map((request) => request.id),
        [requestId],
      );
      assert.equal((await api('GET', '/pickup-confirmations', parentTokens.T2 ?? '')).body.length, 0);
      assert.equal(
        (await api('POST', `/pickup-confirmations/${requestId}/confirm`, parentTokens.T2 ?? '')).status,
        403,
      );
      const confirmed = await api('POST', `/pickup-confirmations/${requestId}/confirm`, parentTokens.T1 ?? '');
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
      const handed = await handOver(token('teacher'), 'T1', body);
      assert.equal(handed.status, 201, JSON.stringify(handed.body));
      assert.equal(handed.body.person_kind, 'parent_confirmed');
      assert.equal(handed.body.confirmation_request_id, requestId);
    });

    it('CTC-P02-038, CTC-P04-027: ủy quyền hết hạn bị chặn như người ngoài danh sách; phụ huynh từ chối thì vẫn bị chặn', async () => {
      const expired = await api('POST', `/children/${children.T2}/authorized-pickups`, token('manager'), {
        full_name: 'Đỗ Văn Cũ',
        relationship: 'Bác',
        phone: randomPhone(),
        valid_from: '2026-09-01',
        valid_to: '2026-09-30',
      });
      const body = {
        date: PAST_DAY,
        authorized_pickup_id: expired.body.id,
        picked_up_at: `${PAST_DAY}T17:00:00+07:00`,
      };
      const blocked = await handOver(token('teacher'), 'T2', body);
      assert.equal(blocked.status, 422);
      assert.match(errorOf(blocked.body).message ?? '', /chờ phụ huynh xác nhận/);
      const requestId = errorOf(blocked.body).details?.[0]?.message;
      const refused = await api('POST', `/pickup-confirmations/${requestId}/refuse`, parentTokens.T2 ?? '');
      assert.equal(refused.status, 200, JSON.stringify(refused.body));
      const stillBlocked = await handOver(token('teacher'), 'T2', body);
      assert.equal(stillBlocked.status, 422);
      assert.match(errorOf(stillBlocked.body).message ?? '', /từ chối/);
    });

    it('Trẻ không có mặt trong ngày thì không bàn giao được', async () => {
      const view = await classPickups(token('teacher'), 'L-A1', OTHER_PAST_DAY);
      const t2 = view.children.find((child) => child.child_id === children.T2);
      assert.equal(t2?.is_present, false);
      const response = await handOver(token('teacher'), 'T2', {
        date: OTHER_PAST_DAY,
        guardian_id: t2?.guardians[0]?.guardian_id,
        picked_up_at: `${OTHER_PAST_DAY}T17:00:00+07:00`,
      });
      assert.equal(response.status, 422);
      assert.match(errorOf(response.body).message ?? '', /có mặt/);
    });

    it('CTC-P04-028: bảo vệ tra danh sách trong đơn vị và xác nhận người được ủy quyền tại cổng; người ngoài danh sách không xác nhận được', async () => {
      const directory = await api('GET', `/pickup-directory?org_unit_id=${units['ĐT-A1']}&search=T1`, token('guard'));
      assert.equal(directory.status, 200, JSON.stringify(directory.body));
      const entry = (
        directory.body as unknown as Array<{
          child_id: string;
          authorized_pickups: Array<{ id: string; full_name: string }>;
        }>
      )[0];
      assert.equal(entry?.child_id, children.T1);
      const grandfather = entry?.authorized_pickups.find((person) => person.full_name === 'Nguyễn Văn Hùng');
      assert.ok(grandfather);
      const checked = await api('POST', `/children/${children.T1}/pickups`, token('guard'), {
        pickup_type: 'gate_check',
        authorized_pickup_id: grandfather.id,
      });
      assert.equal(checked.status, 201, JSON.stringify(checked.body));
      assert.equal(checked.body.pickup_type, 'gate_check');
      const outsider = await api('POST', `/children/${children.T1}/pickups`, token('guard'), {
        pickup_type: 'gate_check',
        person: { full_name: 'Người lạ', relationship: 'Không rõ' },
      });
      assert.equal(outsider.status, 422);
      assert.equal(errorOf(outsider.body).rule_code, 'BR-56');
      assert.equal(
        await schoolYear
          .selectFrom('pickup_confirmation_requests')
          .select('id')
          .where('person_name', '=', 'Người lạ')
          .executeTakeFirst(),
        undefined,
      );
    });

    it('CTC-P04-029: bảo vệ không đọc được danh sách đón của trẻ đơn vị khác và hồ sơ trẻ', async () => {
      assert.equal((await api('GET', `/children/${children.T3}/authorized-pickups`, token('guard'))).status, 403);
      assert.equal(
        (await api('GET', `/pickup-directory?org_unit_id=${units['ĐT-B1']}&search=T3`, token('guard'))).status,
        403,
      );
      assert.equal((await api('GET', `/children/${children.T1}`, token('guard'))).status, 403);
      assert.equal((await api('GET', `/children/${children.T1}/authorized-pickups`, token('guard'))).status, 200);
    });
  });
});
