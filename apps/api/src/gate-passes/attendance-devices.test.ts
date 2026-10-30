import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { IMPORT_COLUMNS } from '../imports/imports.service.js';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Thiết bị điểm danh, lát L2 (YCTD-389): khai báo, khóa thiết bị, điểm nhận công khai, chấm công cán bộ, nhập tệp. Thời điểm sự kiện
// lấy lùi vài phút so với giờ thật để nằm trong khoảng nhận
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const vietnamText = (moment: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(moment);

type DeviceResult = { external_id: string; status: string; message?: string };

describe('Thiết bị điểm danh', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let savedDefaultPassword: Array<{ key: string; value: unknown; updated_by: string | null }> = [];
  const units: Record<string, string> = {};
  const classes: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const children: Record<string, string> = {};
  const codes: Record<string, string> = {};
  let deviceId = '';
  let deviceKey = '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const send = async (key: string | null, events: unknown[]) => {
    const response = await fetch(`${environment.baseUrl}/device-events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { 'x-device-key': key } : {}) },
      body: JSON.stringify({ events }),
    });
    return { status: response.status, body: (await response.json()) as { results?: DeviceResult[] } };
  };
  const event = (
    code: string,
    occurredAt: Date,
    direction: 'in' | 'out' | null,
    externalId: string = randomUUID(),
  ) => ({
    external_id: externalId,
    code,
    direction,
    occurred_at: occurredAt.toISOString(),
  });

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
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.managerB = await environment.loginAs('VT-03', units['ĐT-B1'] ?? null);
    users.guard = await environment.loginAs('VT-18', units['ĐT-A1'] ?? null);

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
        guardian1_phone: randomPhone(),
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
    for (const classCode of ['L-A1', 'L-B1']) {
      const issued = await api('POST', `/classes/${classes[classCode]}/gate-cards`, principal.accessToken, {});
      for (const child of issued.body.children as Array<{ full_name: string; code: string }>) {
        codes[child.full_name.replace('Trẻ ', '')] = child.code;
      }
    }
    for (const [code, name] of [
      ['NS-TB-1', 'Nguyễn Văn Một'],
      ['NS-TB-2', 'Trần Thị Hai'],
      ['NS-TB-3', 'Lê Văn Ba'],
    ]) {
      await schoolYear
        .insertInto('staff')
        .values({
          org_unit_id: units['ĐT-A1'] ?? '',
          code: code ?? '',
          full_name: name ?? '',
          start_date: '2025-08-01',
        })
        .execute();
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

  describe('Khai báo thiết bị', () => {
    it('bảo vệ không xem, không khai báo được; quản lý đơn vị khai báo, khóa chỉ trả một lần', async () => {
      assert.equal((await api('GET', '/attendance-devices', token('guard'))).status, 403);
      const forbidden = await api('POST', '/attendance-devices', token('guard'), {
        org_unit_id: units['ĐT-A1'],
        kind: 'face_terminal',
        name: 'Máy cổng A',
        direction: 'both',
      });
      assert.equal(forbidden.status, 403);
      const created = await api('POST', '/attendance-devices', token('manager'), {
        org_unit_id: units['ĐT-A1'],
        kind: 'face_terminal',
        name: 'Máy cổng A',
        location_name: 'Cổng chính',
        direction: 'both',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      deviceId = created.body.id as string;
      deviceKey = created.body.key as string;
      assert.match(deviceKey, /^tbd_/);
      const listed = await api('GET', '/attendance-devices', token('manager'));
      const row = (listed.body as unknown as Array<Record<string, unknown>>).find((device) => device.id === deviceId);
      assert.ok(row);
      assert.equal(row.key, undefined);
      assert.equal(row.key_hash, undefined);
      assert.equal(row.key_hint, deviceKey.slice(-4));
    });

    it('quản lý đơn vị khác không khai báo ở đơn vị này, không thấy thiết bị này', async () => {
      const response = await api('POST', '/attendance-devices', token('managerB'), {
        org_unit_id: units['ĐT-A1'],
        kind: 'qr_scanner',
        name: 'Máy lạ',
        direction: 'in',
      });
      assert.equal(response.status, 403);
      const listed = await api('GET', '/attendance-devices', token('managerB'));
      assert.ok(!(listed.body as unknown as Array<{ id: string }>).some((device) => device.id === deviceId));
    });

    it('thiếu loại, hướng sai bị từ chối', async () => {
      const response = await api('POST', '/attendance-devices', token('manager'), {
        org_unit_id: units['ĐT-A1'],
        kind: 'may_la',
        name: 'Máy',
        direction: 'len',
      });
      assert.equal(response.status, 400);
    });
  });

  describe('Điểm nhận của thiết bị', () => {
    it('thiếu khóa, sai khóa: 401; không có lượt: 400', async () => {
      assert.equal((await send(null, [event(codes.T1 ?? '', minutesAgo(1), 'in')])).status, 401);
      assert.equal((await send('tbd_sai', [event(codes.T1 ?? '', minutesAgo(1), 'in')])).status, 401);
      assert.equal((await send(deviceKey, [])).status, 400);
    });

    it('lượt vào của học sinh được ghi phương thức máy chấm công; gửi lại cùng mã sự kiện là trùng', async () => {
      const first = event(codes.T1 ?? '', minutesAgo(2), 'in', 'su-kien-1');
      const response = await send(deviceKey, [first]);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.results?.[0]?.status, 'recorded');
      const pass = await schoolYear
        .selectFrom('gate_passes')
        .select(['method', 'device_id', 'recorded_by'])
        .where('child_id', '=', children.T1 ?? '')
        .executeTakeFirstOrThrow();
      assert.equal(pass.method, 'device');
      assert.equal(pass.device_id, deviceId);
      assert.equal(pass.recorded_by, null);
      const again = await send(deviceKey, [first]);
      assert.equal(again.body.results?.[0]?.status, 'duplicate');
    });

    it('thiết bị hai chiều không gửi hướng, học sinh đơn vị khác, mã lạ, lượt quá 7 ngày bị từ chối từng lượt', async () => {
      const response = await send(deviceKey, [
        event(codes.T2 ?? '', minutesAgo(2), null),
        event(codes.T3 ?? '', minutesAgo(2), 'in'),
        event('KHONG-CO-AI', minutesAgo(2), 'in'),
        event(codes.T2 ?? '', minutesAgo(10 * 24 * 60), 'in'),
      ]);
      assert.equal(response.status, 200);
      assert.deepEqual(
        response.body.results?.map((result) => result.status),
        ['rejected', 'rejected', 'unknown_code', 'rejected'],
      );
    });

    it('cán bộ: lượt sớm nhất là giờ vào, muộn nhất là giờ ra, nguồn thiết bị', async () => {
      const fiveMinutesAgo = minutesAgo(5);
      const response = await send(deviceKey, [
        event('NS-TB-1', fiveMinutesAgo, null),
        event('NS-TB-1', minutesAgo(2), null),
      ]);
      assert.deepEqual(
        response.body.results?.map((result) => result.status),
        ['recorded', 'recorded'],
      );
      const log = await schoolYear
        .selectFrom('attendance_logs')
        .innerJoin('staff', 'staff.id', 'attendance_logs.staff_id')
        .select(['attendance_logs.check_in', 'attendance_logs.check_out', 'attendance_logs.source'])
        .where('staff.code', '=', 'NS-TB-1')
        .executeTakeFirstOrThrow();
      assert.equal(log.source, 'device');
      assert.equal(log.check_in, vietnamText(fiveMinutesAgo).slice(11, 16));
      assert.ok(log.check_out && log.check_out > log.check_in);
    });

    it('ngày phòng nhân sự đã nhập tay thì giữ nguyên', async () => {
      const staff = await schoolYear
        .selectFrom('staff')
        .select('id')
        .where('code', '=', 'NS-TB-2')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('attendance_logs')
        .values({
          staff_id: staff.id,
          work_date: vietnamText(minutesAgo(3)).slice(0, 10),
          check_in: '00:01',
          source: 'manual',
        })
        .execute();
      const response = await send(deviceKey, [event('NS-TB-2', minutesAgo(3), null)]);
      assert.equal(response.body.results?.[0]?.status, 'manual_kept');
    });
  });

  describe('Nhập tệp, đổi khóa, tắt thiết bị', () => {
    it('nhập CSV: dòng đúng được ghi, dòng sai có số dòng; nhập lại không ghi trùng', async () => {
      const csv = [
        'Mã;Thời điểm;Hướng',
        `NS-TB-3;${vietnamText(minutesAgo(4))};`,
        `${codes.T2};${vietnamText(minutesAgo(4))};Vào`,
        'NS-TB-3;hôm qua;',
      ].join('\n');
      const upload = async () => {
        const form = new FormData();
        form.set('file', new Blob([Buffer.from(csv, 'utf8')]), 'may-cham-cong.csv');
        const response = await fetch(`${environment.baseUrl}/attendance-devices/${deviceId}/import`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token('manager')}` },
          body: form,
        });
        return { status: response.status, body: (await response.json()) as Record<string, unknown> };
      };
      const first = await upload();
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.deepEqual(first.body.counts, {
        recorded: 2,
        duplicate: 0,
        unchanged: 0,
        manual_kept: 0,
        unknown_code: 0,
        rejected: 1,
      });
      assert.equal((first.body.errors as Array<{ line: number }>)[0]?.line, 4);
      const second = await upload();
      assert.equal((second.body.counts as Record<string, number>).duplicate, 1);
      assert.equal((second.body.counts as Record<string, number>).recorded, 0);
    });

    it('đổi khóa: khóa cũ hết hiệu lực; tắt thiết bị: 401', async () => {
      const rotated = await api('POST', `/attendance-devices/${deviceId}/rotate-key`, token('manager'));
      assert.equal(rotated.status, 200);
      const newKey = rotated.body.key as string;
      assert.notEqual(newKey, deviceKey);
      assert.equal((await send(deviceKey, [event('NS-TB-3', minutesAgo(1), null)])).status, 401);
      assert.equal((await send(newKey, [event('NS-TB-3', minutesAgo(1), null)])).status, 200);
      assert.equal((await api('POST', `/attendance-devices/${deviceId}/disable`, token('managerB'), {})).status, 403);
      assert.equal((await api('POST', `/attendance-devices/${deviceId}/disable`, token('manager'), {})).status, 200);
      assert.equal((await send(newKey, [event('NS-TB-3', minutesAgo(1), null)])).status, 401);
    });
  });
});
