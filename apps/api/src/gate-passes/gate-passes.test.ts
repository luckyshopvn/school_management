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

// Thẻ QR và lượt qua cổng, lát L1 (YCTD-389). Quy tắc theo giờ (tự ghi đi muộn) kiểm ở gate-pass-rules.test.ts vì máy chủ dùng
// giờ thật
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; message?: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

type ClassCards = { children: Array<{ child_id: string; full_name: string; code: string | null }> };
type ScanResult = { id: string; child_id: string; duplicate: boolean; direction: string };

describe('Thẻ QR và lượt qua cổng', () => {
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
  const codes: Record<string, string> = {};
  let firstPassId = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const scan = (accessToken: string, code: string, direction: 'in' | 'out') =>
    api('POST', '/gate-passes', accessToken, { code, direction });
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
    users.manager = await environment.loginAs('VT-03', unitA);
    users.guard = await environment.loginAs('VT-18', unitA);
    users.guardB = await environment.loginAs('VT-18', units['ĐT-B1'] ?? null);
    await api('POST', `/classes/${classes['L-A1']}/staff-assignments`, principal.accessToken, {
      staff_user_id: users.teacher?.userId,
      assignment_role: 'homeroom',
      from_date: '2026-09-01',
    });

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

  describe('Cấp thẻ QR', () => {
    it('bảo vệ không xem, không cấp được thẻ', async () => {
      assert.equal((await api('GET', `/classes/${classes['L-A1']}/gate-cards`, token('guard'))).status, 403);
      assert.equal((await api('POST', `/classes/${classes['L-A1']}/gate-cards`, token('guard'), {})).status, 403);
    });

    it('quản lý đơn vị cấp thẻ cho học sinh chưa có thẻ; cấp lần nữa không cấp trùng', async () => {
      const issued = await api('POST', `/classes/${classes['L-A1']}/gate-cards`, token('manager'), {});
      assert.equal(issued.status, 200, JSON.stringify(issued.body));
      assert.equal(issued.body.issued_count, 2);
      for (const child of (issued.body as unknown as ClassCards).children) {
        assert.match(child.code ?? '', /^[A-Z2-7]{16}$/);
        codes[child.full_name.replace('Trẻ ', '')] = child.code ?? '';
      }
      const again = await api('POST', `/classes/${classes['L-A1']}/gate-cards`, token('manager'), {});
      assert.equal(again.body.issued_count, 0);
    });

    it('quản lý đơn vị khác không cấp được thẻ của lớp này', async () => {
      const otherManager = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
      assert.equal(
        (await api('POST', `/classes/${classes['L-A1']}/gate-cards`, otherManager.accessToken, {})).status,
        403,
      );
    });

    it('cấp lại thẻ: thẻ cũ bị thu hồi, không quét được', async () => {
      const oldCode = codes.T2 ?? '';
      const reissued = await api('POST', `/classes/${classes['L-A1']}/gate-cards`, token('manager'), {
        reissue_child_ids: [children.T2],
      });
      assert.equal(reissued.body.issued_count, 1);
      const newCode = (reissued.body as unknown as ClassCards).children.find(
        (child) => child.child_id === children.T2,
      )?.code;
      assert.ok(newCode && newCode !== oldCode);
      codes.T2 = newCode;
      const rejected = await scan(token('guard'), oldCode, 'in');
      assert.equal(rejected.status, 422, JSON.stringify(rejected.body));
    });

    it('cấp lại cho học sinh ngoài lớp bị từ chối', async () => {
      const response = await api('POST', `/classes/${classes['L-A1']}/gate-cards`, token('manager'), {
        reissue_child_ids: [children.T3],
      });
      assert.equal(response.status, 422, JSON.stringify(response.body));
    });
  });

  describe('Quét thẻ ở cổng', () => {
    it('bảo vệ quét thẻ vào: ghi lượt, phụ huynh nhận thông báo đã vào trường', async () => {
      const response = await scan(token('guard'), codes.T1 ?? '', 'in');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      const result = response.body as unknown as ScanResult;
      assert.equal(result.child_id, children.T1);
      assert.equal(result.duplicate, false);
      firstPassId = result.id;
      const sent = await notificationsFor(parentUserIds.T1 ?? '', 'gate_arrived');
      assert.equal(sent.length, 1);
      assert.match(sent[0]?.body ?? '', /Trẻ T1 đã vào trường lúc \d{2}:\d{2}/);
    });

    it('quét lại trong 5 phút là cùng một lượt, không báo lần hai', async () => {
      const response = await scan(token('guard'), ` ${(codes.T1 ?? '').toLowerCase()} `, 'in');
      assert.equal(response.status, 200);
      assert.equal((response.body as unknown as ScanResult).duplicate, true);
      assert.equal((response.body as unknown as ScanResult).id, firstPassId);
      assert.equal((await notificationsFor(parentUserIds.T1 ?? '', 'gate_arrived')).length, 1);
    });

    it('lượt ra là lượt mới; phụ huynh nhận thông báo đã ra khỏi cổng', async () => {
      const response = await scan(token('guard'), codes.T1 ?? '', 'out');
      assert.equal((response.body as unknown as ScanResult).duplicate, false);
      assert.equal((await notificationsFor(parentUserIds.T1 ?? '', 'gate_left')).length, 1);
    });

    it('mã sai dạng, mã không có, thiếu hướng bị từ chối', async () => {
      assert.equal((await scan(token('guard'), 'ABC', 'in')).status, 422);
      assert.equal((await scan(token('guard'), 'AAAAAAAAAAAAAAAA', 'in')).status, 404);
      const missing = await api('POST', '/gate-passes', token('guard'), { code: codes.T1 });
      assert.equal(missing.status, 400);
      assert.equal(errorOf(missing.body).code, 'ERR_VALIDATION');
    });

    it('bảo vệ đơn vị khác, giáo viên, phụ huynh không quét được thẻ của học sinh đơn vị này', async () => {
      assert.equal((await scan(token('guardB'), codes.T1 ?? '', 'in')).status, 403);
      assert.equal((await scan(token('teacher'), codes.T1 ?? '', 'in')).status, 403);
      assert.equal((await scan(parentTokens.T1 ?? '', codes.T1 ?? '', 'in')).status, 403);
    });

    it('danh sách lượt hôm nay của bảo vệ chỉ trong đơn vị của mình', async () => {
      const own = await api('GET', '/gate-passes/recent', token('guard'));
      assert.equal(own.status, 200);
      assert.ok((own.body as unknown as Array<{ child_id: string }>).some((row) => row.child_id === children.T1));
      const other = await api('GET', '/gate-passes/recent', token('guardB'));
      assert.ok(!(other.body as unknown as Array<{ child_id: string }>).some((row) => row.child_id === children.T1));
      assert.equal((await api('GET', '/gate-passes/recent', parentTokens.T1 ?? '')).status, 403);
    });
  });

  describe('Xem lượt qua cổng và báo nhận nhầm', () => {
    it('bảng điểm danh hôm nay có lượt vào của T1 làm gợi ý (khi hôm nay là ngày học)', async () => {
      const sheet = await api('GET', `/classes/${classes['L-A1']}/attendance?date=${today()}`, token('teacher'));
      if (sheet.status !== 200) {
        assert.equal(sheet.status, 422, JSON.stringify(sheet.body));
        return;
      }
      const rows = sheet.body.children as Array<{ child_id: string; gate: { first_in: string | null } | null }>;
      assert.ok(rows.find((row) => row.child_id === children.T1)?.gate?.first_in);
      assert.equal(rows.find((row) => row.child_id === children.T2)?.gate, null);
    });

    it('phụ huynh xem lượt của con mình, không xem được của con người khác', async () => {
      const own = await api(
        'GET',
        `/children/${children.T1}/gate-passes?from=${today()}&to=${today()}`,
        parentTokens.T1 ?? '',
      );
      assert.equal(own.status, 200, JSON.stringify(own.body));
      assert.equal((own.body as unknown as unknown[]).length, 2);
      const other = await api(
        'GET',
        `/children/${children.T1}/gate-passes?from=${today()}&to=${today()}`,
        parentTokens.T2 ?? '',
      );
      assert.equal(other.status, 403);
    });

    it('khoảng ngày quá 31 ngày bị từ chối', async () => {
      const response = await api(
        'GET',
        `/children/${children.T1}/gate-passes?from=2026-09-01&to=2026-12-01`,
        token('teacher'),
      );
      assert.equal(response.status, 422);
    });

    it('bảo vệ không báo nhận nhầm được; giáo viên chủ nhiệm báo được, phụ huynh nhận đính chính', async () => {
      assert.equal((await api('POST', `/gate-passes/${firstPassId}/reject`, token('guard'), {})).status, 403);
      const rejected = await api('POST', `/gate-passes/${firstPassId}/reject`, token('teacher'), {
        note: 'Không phải em',
      });
      assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
      assert.equal((await notificationsFor(parentUserIds.T1 ?? '', 'gate_pass_corrected')).length, 1);
      assert.equal((await api('POST', `/gate-passes/${firstPassId}/reject`, token('teacher'), {})).status, 422);
      const timeline = await api(
        'GET',
        `/children/${children.T1}/gate-passes?from=${today()}&to=${today()}`,
        parentTokens.T1 ?? '',
      );
      const rows = timeline.body as unknown as Array<{ id: string; review_status: string }>;
      assert.equal(rows.find((row) => row.id === firstPassId)?.review_status, 'rejected');
    });
  });
});
