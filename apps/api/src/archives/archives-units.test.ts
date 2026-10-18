import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { FileStorage } from '../files/file-storage.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';
import { parseRecordInput } from './archive-fields.js';
import { ArchivesService } from './archives.js';

// Văn thư lưu trữ, sửa các hạn chế của YCTD-118 (YCTD-122): phông, hồ sơ thuộc đơn vị và lọc theo phạm vi; người giải
// quyết chọn từ nhân sự; nhắc sắp đến hạn, quá hạn; thử xóa lại tệp ở kho tệp. Kịch bản CT-15h2-14 đến CT-15h2-18
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; details?: Array<{ field: string; message: string }> };
const fieldsOf = (body: Record<string, unknown>) => (errorOf(body).details ?? []).map((detail) => detail.field).sort();
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const DAY = 86_400_000;
const vietnamDate = (offsetDays: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offsetDays * DAY));

const record = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  title: `Hồ sơ ${code}`,
  handler_name: 'Người ngoài danh sách',
  opened_on: '2026-01-05',
  status: 'pending',
  retention: 'permanent',
  ...extra,
});

describe('Biểu mẫu hồ sơ có người giải quyết theo nhân sự', () => {
  it('CT-15h2-14: chọn nhân sự thì không cần nhập tên; không chọn thì bắt buộc tên; mã đơn vị, mã nhân sự sai báo lỗi', () => {
    const staffId = '22222222-2222-4222-8222-222222222222';
    const parsed = parseRecordInput({ ...record('A1'), handler_name: '', handler_staff_id: staffId });
    assert.equal(parsed.handler_staff_id, staffId);
    assert.equal(parsed.handler_name, '');
    assert.throws(
      () => parseRecordInput({ ...record('A1'), handler_name: '' }),
      (error: { details?: Array<{ field: string }> }) =>
        JSON.stringify(error.details?.map((detail) => detail.field)) === '["handler_name"]',
    );
    assert.throws(
      () => parseRecordInput({ ...record('A1'), handler_name: '', handler_staff_id: 'x', org_unit_id: 'y' }),
      (error: { details?: Array<{ field: string }> }) =>
        JSON.stringify(error.details?.map((detail) => detail.field).sort()) === '["handler_staff_id","org_unit_id"]',
    );
  });
});

describe('Văn thư lưu trữ theo đơn vị, nhắc hạn, xóa lại tệp', () => {
  let environment: ApiTestEnvironment;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let principal: LoggedInUser;
  let accountantA: LoggedInUser;
  let staffUser: LoggedInUser;
  const units = { root: '', a: '', b: '' };
  let staffId = '';
  const api = (method: string, path: string, user: LoggedInUser, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, user.accessToken, body);

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    await openTestAcademicYear(environment, principal.accessToken, 'Năm học văn thư theo đơn vị', {
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
    const insertUnit = async (code: string, unitType: 'truong_chinh' | 'diem_truong', parentId: string | null) =>
      (
        await schoolYear
          .insertInto('org_units')
          .values({ code, name: `Đơn vị ${code}`, unit_type: unitType, parent_id: parentId })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    units.root = await insertUnit('VTTC', 'truong_chinh', null);
    units.a = await insertUnit('VTA', 'diem_truong', units.root);
    units.b = await insertUnit('VTB', 'diem_truong', units.root);
    accountantA = await environment.loginAs('VT-04', units.a);
    staffUser = await environment.loginAs('VT-07', units.a);
    staffId = (
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: units.a,
          code: 'NS-VT-1',
          full_name: 'Phạm Thị Văn Thư',
          start_date: '2025-08-01',
          user_id: staffUser.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await schoolYear
      .insertInto('staff')
      .values({ org_unit_id: units.b, code: 'NS-VT-2', full_name: 'Lê Văn Bê', start_date: '2025-08-01' })
      .execute();
  });

  after(async () => {
    await schoolYear?.destroy();
    await environment.close();
  });

  it('CT-15h2-15: hồ sơ, phông theo đơn vị: kế toán điểm trường A chỉ thấy, ghi được dữ liệu của A', async () => {
    const fondA = await api('POST', '/archive-fonds', principal, { code: 'PA', name: 'Phông A', org_unit_id: units.a });
    assert.equal(fondA.status, 201, JSON.stringify(fondA.body));
    assert.equal(fondA.body.org_unit_name, 'Đơn vị VTA');
    const fondAll = await api('POST', '/archive-fonds', principal, { code: 'PT', name: 'Phông toàn trường' });
    assert.equal(fondAll.body.org_unit_id, null);
    for (const [code, unit] of [
      ['HS-A', units.a],
      ['HS-B', units.b],
      ['HS-T', null],
    ] as const) {
      const created = await api('POST', '/archive-records', principal, record(code, { org_unit_id: unit }));
      assert.equal(created.status, 201, JSON.stringify(created.body));
    }
    // Phông của A không nhận hồ sơ của B
    const mismatch = await api(
      'POST',
      '/archive-records',
      principal,
      record('HS-X', { org_unit_id: units.b, fond_id: fondA.body.id }),
    );
    assert.deepEqual(fieldsOf(mismatch.body), ['fond_id']);
    const missingUnit = await api(
      'POST',
      '/archive-records',
      principal,
      record('HS-Y', { org_unit_id: '33333333-3333-4333-8333-333333333333' }),
    );
    assert.deepEqual(fieldsOf(missingUnit.body), ['org_unit_id']);

    const codes = async (user: LoggedInUser, query = '') =>
      ((await api('GET', `/archive-records?page_size=50${query}`, user)).body.items as Array<{ code: string }>).map(
        (item) => item.code,
      );
    assert.deepEqual(await codes(principal), ['HS-A', 'HS-B', 'HS-T']);
    assert.deepEqual(await codes(principal, `&org_unit_id=${units.b}`), ['HS-B']);
    assert.deepEqual(await codes(accountantA), ['HS-A']);
    const fondCodes = (
      (await api('GET', '/archive-fonds', accountantA)).body as unknown as Array<{ code: string }>
    ).map((fond) => fond.code);
    assert.deepEqual(fondCodes, ['PA']);

    const recordB = (await api('GET', `/archive-records?org_unit_id=${units.b}`, principal)).body.items as Array<{
      id: string;
    }>;
    assert.equal((await api('GET', `/archive-records/${recordB[0]?.id}`, accountantA)).status, 404);
    assert.equal((await api('POST', '/archive-records', accountantA, record('HS-A2'))).status, 403);
    assert.equal(
      (await api('POST', '/archive-records', accountantA, record('HS-B2', { org_unit_id: units.b }))).status,
      403,
    );
    const own = await api('POST', '/archive-records', accountantA, record('HS-A2', { org_unit_id: units.a }));
    assert.equal(own.status, 201, JSON.stringify(own.body));
    assert.equal(own.body.org_unit_name, 'Đơn vị VTA');

    // Báo cáo lưu trữ chỉ cộng phông trong phạm vi
    await api('POST', '/archive-holdings', principal, {
      fond_id: fondAll.body.id,
      period_from_year: 2010,
      period_to_year: 2012,
      arranged: true,
      retention: 'permanent',
      shelf_meters: 4,
      storage_location: 'Kho chung',
    });
    await api('POST', '/archive-holdings', accountantA, {
      fond_id: fondA.body.id,
      period_from_year: 2015,
      period_to_year: 2016,
      arranged: false,
      retention: 'permanent',
      shelf_meters: 1.5,
      storage_location: 'Kho A',
    });
    const reportA = await api('GET', '/archive-report', accountantA);
    assert.equal((reportA.body.totals as Record<string, number>).total_meters, 1.5);
    const reportAll = await api('GET', '/archive-report', principal);
    assert.equal((reportAll.body.totals as Record<string, number>).total_meters, 5.5);
    assert.equal(
      ((await api('GET', `/archive-report?org_unit_id=${units.a}`, principal)).body.totals as Record<string, number>)
        .total_meters,
      1.5,
    );
  });

  it('CT-15h2-16: người giải quyết chọn từ nhân sự đang làm việc trong phạm vi; tên lấy theo hồ sơ nhân sự', async () => {
    const handlers = (await api('GET', '/archive-handlers', accountantA)).body as unknown as Array<{
      full_name: string;
    }>;
    assert.deepEqual(
      handlers.map((handler) => handler.full_name),
      ['Phạm Thị Văn Thư'],
    );
    const all = (await api('GET', '/archive-handlers', principal)).body as unknown as unknown[];
    assert.equal(all.length, 2);
    const created = await api(
      'POST',
      '/archive-records',
      accountantA,
      record('HS-NS', { org_unit_id: units.a, handler_name: '', handler_staff_id: staffId }),
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.handler_name, 'Phạm Thị Văn Thư');
    assert.equal(created.body.handler_staff_id, staffId);
    const unknownStaff = await api(
      'POST',
      '/archive-records',
      accountantA,
      record('HS-NS2', {
        org_unit_id: units.a,
        handler_name: '',
        handler_staff_id: '44444444-4444-4444-8444-444444444444',
      }),
    );
    assert.deepEqual(fieldsOf(unknownStaff.body), ['handler_staff_id']);
  });

  it('CT-15h2-17: nhắc sắp đến hạn, quá hạn một lần cho tài khoản của nhân sự giải quyết; đổi thời hạn thì nhắc lại', async () => {
    const service = environment.api.get(ArchivesService);
    const soon = await api(
      'POST',
      '/archive-records',
      principal,
      record('HS-SOON', {
        org_unit_id: units.a,
        handler_staff_id: staffId,
        opened_on: vietnamDate(-10),
        due_date: vietnamDate(1),
      }),
    );
    assert.equal(soon.body.due_soon, true);
    assert.equal(soon.body.overdue, false);
    const late = await api(
      'POST',
      '/archive-records',
      principal,
      record('HS-LATE', {
        org_unit_id: units.a,
        handler_staff_id: staffId,
        opened_on: vietnamDate(-10),
        due_date: vietnamDate(-2),
      }),
    );
    // Người giải quyết ngoài danh sách nhân sự không có tài khoản nên không nhắc
    await api(
      'POST',
      '/archive-records',
      principal,
      record('HS-FREE', { org_unit_id: units.a, opened_on: vietnamDate(-10), due_date: vietnamDate(1) }),
    );
    const dueSoonCodes = (
      (await api('GET', '/archive-records?due_soon=true', principal)).body.items as Array<{ code: string }>
    ).map((item) => item.code);
    assert.deepEqual(dueSoonCodes.sort(), ['HS-FREE', 'HS-SOON']);

    assert.deepEqual(await service.remindDueRecords(), { dueSoon: 1, overdue: 1 });
    assert.deepEqual(await service.remindDueRecords(), { dueSoon: 0, overdue: 0 });
    const notifications = await schoolYear
      .selectFrom('notifications')
      .innerJoin('notification_recipients', 'notification_recipients.notification_id', 'notifications.id')
      .select(['notifications.template_code', 'notifications.target_id', 'notification_recipients.user_id'])
      .where('notifications.target_type', '=', 'archive_record')
      .orderBy('notifications.template_code')
      .execute();
    assert.deepEqual(notifications, [
      { template_code: 'archive_record_due_soon', target_id: soon.body.id, user_id: staffUser.userId },
      { template_code: 'archive_record_overdue', target_id: late.body.id, user_id: staffUser.userId },
    ]);

    // Đổi thời hạn của hồ sơ quá hạn sang sắp đến hạn thì nhắc lại
    const moved = await api(
      'PUT',
      `/archive-records/${late.body.id}`,
      principal,
      record('HS-LATE', {
        org_unit_id: units.a,
        handler_staff_id: staffId,
        opened_on: vietnamDate(-10),
        due_date: vietnamDate(2),
      }),
    );
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.deepEqual(await service.remindDueRecords(), { dueSoon: 1, overdue: 0 });
  });

  it('CT-15h2-18: kho tệp lỗi khi xóa thì tệp vào hàng chờ, tiến trình chạy nền xóa lại được', async () => {
    const service = environment.api.get(ArchivesService);
    const storage = environment.api.get(FileStorage);
    const created = await api('POST', '/archive-records', principal, record('HS-FILE', { org_unit_id: units.a }));
    const form = new FormData();
    form.set('file', new Blob([PDF]), 'cong-van.pdf');
    const uploaded = await fetch(`${environment.baseUrl}/archive-records/${created.body.id}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${principal.accessToken}` },
      body: form,
    });
    assert.equal(uploaded.status, 201);
    const original = storage.delete.bind(storage);
    let failing = true;
    storage.delete = async (key: string) => {
      if (failing) {
        throw new Error('Kho tệp tạm thời không phản hồi');
      }
      return original(key);
    };
    try {
      assert.equal((await api('DELETE', `/archive-records/${created.body.id}`, principal)).status, 204);
      const queued = await environment.system.selectFrom('archive_file_deletions').selectAll().execute();
      assert.equal(queued.length, 1);
      assert.equal(queued[0]?.attempts, 1);
      assert.match(queued[0]?.storage_key ?? '', new RegExp(`^archive-records/${created.body.id}/`));
      assert.deepEqual(await service.retryFileDeletions(), { deleted: 0, failed: 1 });
      assert.equal(
        (await environment.system.selectFrom('archive_file_deletions').select('attempts').executeTakeFirstOrThrow())
          .attempts,
        2,
      );
      failing = false;
      assert.deepEqual(await service.retryFileDeletions(), { deleted: 1, failed: 0 });
      assert.equal((await environment.system.selectFrom('archive_file_deletions').selectAll().execute()).length, 0);
      await assert.rejects(storage.get(queued[0]?.storage_key ?? ''));
    } finally {
      storage.delete = original;
    }
  });
});
