import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
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

// Đăng ký dịch vụ, chốt kỳ, đăng ký và hủy trễ, học hè; ca kiểm thử theo 27_BO_CA_KIEM_THU_CHI_TIET/03_P05.md mục 5, 10a
// và CTC-P04-046. Ngày chốt tính theo ngày thật nên năm học kiểm thử dựng quanh tháng hiện tại:
// tháng hiện tại đã qua ngày chốt (ngày 25 tháng trước), tháng hiện tại cộng hai còn trong thời gian đăng ký
const randomPhone = () => `09${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
const errorOf = (body: Record<string, unknown>) => (body.error ?? {}) as { code?: string; rule_code?: string };
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function shiftMonth(offset: number): { year: number; month: number; period: string; first: string; last: string } {
  const base = new Date(Date.UTC(Number(vietnamToday.slice(0, 4)), Number(vietnamToday.slice(5, 7)) - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, period, first: `${period}-01`, last: `${period}-${String(lastDay).padStart(2, '0')}` };
}

function firstWeekday(monthStart: string): string {
  let cursor = new Date(`${monthStart}T00:00:00Z`);
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return cursor.toISOString().slice(0, 10);
}

type Registration = {
  id: string;
  service_id: string;
  status: string;
  source: string;
  late_charge_method: string | null;
};
type ChildView = { is_late: boolean; is_locked: boolean; is_summer: boolean; registrations: Registration[] };

describe('Đăng ký dịch vụ, chốt kỳ, đăng ký trễ và học hè', () => {
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
  const serviceIds: Record<string, string> = {};
  const lateMonth = shiftMonth(0);
  const openMonth = shiftMonth(2);
  const nextOpenMonth = shiftMonth(3);
  const summerMonth = shiftMonth(6);

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const childView = async (accessToken: string, child: string, period: string) =>
    (await api('GET', `/children/${children[child]}/service-registrations?period=${period}`, accessToken))
      .body as unknown as ChildView;
  const register = (accessToken: string, child: string, period: string, service: string, extra = {}) =>
    api('POST', '/service-registrations', accessToken, {
      child_id: children[child],
      period,
      service_id: serviceIds[service],
      ...extra,
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
    const yearId = await openTestAcademicYear(environment, principal.accessToken, 'Năm học kiểm thử', {
      first_term: { start_date: shiftMonth(-1).first, end_date: shiftMonth(3).last },
      second_term: { start_date: shiftMonth(4).first, end_date: shiftMonth(5).last },
      summer_term: { start_date: shiftMonth(6).first, end_date: shiftMonth(7).last },
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
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.accountantB = await environment.loginAs('VT-04', units['ĐT-B1'] ?? null);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    await api('POST', `/classes/${classes['L-A1']}/staff-assignments`, principal.accessToken, {
      staff_user_id: users.teacher?.userId,
      assignment_role: 'homeroom',
      from_date: shiftMonth(-1).first,
    });
    for (const [code, name] of [
      ['STEM', 'STEM'],
      ['ANH_VAN', 'Anh văn'],
    ] as const) {
      serviceIds[code] = (
        await api('POST', '/services', token('accountant'), {
          code,
          name,
          unit: 'tháng',
          calculation_method: 'monthly',
        })
      ).body.id as string;
    }

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
        gender: 'Nam',
        national_id: `083${String(Date.now() % 1_000_000).padStart(6, '0')}${String(randomInt(0, 100) * 10 + index).padStart(3, '0')}`,
        allergies: 'Không',
        enroll_date: shiftMonth(-1).first,
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
    assert.equal((await api('POST', `/imports/${uploaded.id}/commit`, principal.accessToken)).status, 200);
    for (const row of await schoolYear.selectFrom('children').select(['id', 'full_name']).execute()) {
      children[row.full_name.replace('Trẻ ', '')] = row.id;
    }
    for (const [child, phone] of Object.entries(parentPhones)) {
      await environment.identity.database
        .updateTable('users')
        .set({ password_hash: await hashForTesting(TEST_PASSWORD), must_change_password: false })
        .where('phone', '=', phone)
        .execute();
      parentTokens[child] = (
        await sendJson('POST', `${environment.identity.baseUrl}/auth/login`, undefined, {
          login: phone,
          password: TEST_PASSWORD,
          channel: 'parent',
        })
      ).body.access_token as string;
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

  describe('P05-03 Đăng ký dịch vụ', () => {
    it('CTC-P05-010: trẻ đang học có sẵn bán trú; ngày chốt mặc định ngày 25 tháng trước', async () => {
      const view = await childView(parentTokens.T1 ?? '', 'T1', openMonth.period);
      assert.equal(view.is_late, false);
      const meal = view.registrations.find((row) => row.service_id === MEAL_SERVICE_ID);
      assert.equal(meal?.status, 'active');
      assert.equal(meal?.source, 'system');
      const response = await api(
        'GET',
        `/children/${children.T1}/service-registrations?period=${openMonth.period}`,
        parentTokens.T1 ?? '',
      );
      assert.equal(response.body.closing_date, `${shiftMonth(1).period}-25`);
    });

    it('CTC-P05-009: phụ huynh đăng ký STEM trước ngày chốt thì có hiệu lực, không trễ; tháng sau tự giữ STEM', async () => {
      const response = await register(parentTokens.T1 ?? '', 'T1', openMonth.period, 'STEM');
      assert.equal(response.status, 201, JSON.stringify(response.body));
      assert.equal(response.body.status, 'active');
      assert.equal(response.body.is_late, false);
      const next = await childView(parentTokens.T1 ?? '', 'T1', nextOpenMonth.period);
      const carried = next.registrations.find((row) => row.service_id === serviceIds.STEM);
      assert.equal(carried?.status, 'active');
      assert.equal(carried?.source, 'carried');
      assert.equal((await register(parentTokens.T1 ?? '', 'T1', openMonth.period, 'STEM')).status, 409);
    });

    it('Hủy trước ngày chốt có hiệu lực ngay; tháng sau không còn tự giữ', async () => {
      const second = await register(token('accountant'), 'T2', openMonth.period, 'ANH_VAN');
      assert.equal(second.status, 201, JSON.stringify(second.body));
      assert.equal(second.body.status, 'active');
      const cancelled = await api('POST', `/service-registrations/${second.body.id}/cancel`, parentTokens.T2 ?? '');
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
      assert.equal(cancelled.body.status, 'cancelled');
      const next = await childView(token('accountant'), 'T2', nextOpenMonth.period);
      assert.ok(!next.registrations.some((row) => row.service_id === serviceIds.ANH_VAN && row.status === 'active'));
    });

    it('CTC-P05-011: phụ huynh và kế toán không bỏ được bán trú', async () => {
      const view = await childView(parentTokens.T1 ?? '', 'T1', openMonth.period);
      const meal = view.registrations.find((row) => row.service_id === MEAL_SERVICE_ID);
      for (const accessToken of [parentTokens.T1 ?? '', token('accountant')]) {
        const response = await api('POST', `/service-registrations/${meal?.id}/cancel`, accessToken);
        assert.equal(response.status, 422);
        assert.equal(errorOf(response.body).rule_code, 'BR-83');
      }
    });

    it('CTC-P05-012, CTC-P05-013: sau ngày chốt đăng ký thiếu ngày bắt đầu bị từ chối; có ngày bắt đầu thì chờ duyệt', async () => {
      const missing = await register(parentTokens.T1 ?? '', 'T1', lateMonth.period, 'STEM');
      assert.equal(missing.status, 400);
      const outside = await register(parentTokens.T1 ?? '', 'T1', lateMonth.period, 'STEM', {
        service_start_date: openMonth.first,
      });
      assert.equal(outside.status, 400);
      const late = await register(parentTokens.T1 ?? '', 'T1', lateMonth.period, 'STEM', {
        service_start_date: lateMonth.last,
      });
      assert.equal(late.status, 201, JSON.stringify(late.body));
      assert.equal(late.body.status, 'pending_late');
      assert.equal(late.body.is_late, true);
      const recipients = await schoolYear
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select(['notification_recipients.role_code'])
        .where('notifications.template_code', '=', 'late_registration_pending')
        .execute();
      assert.deepEqual(recipients.map((row) => row.role_code).sort(), ['VT-02', 'VT-15']);
    });

    it('CTC-P05-016: quản lý đơn vị và kế toán không duyệt được đăng ký trễ', async () => {
      const pending = (await api('GET', `/service-registrations/pending`, token('vicePrincipal')))
        .body as unknown as Array<{
        id: string;
      }>;
      assert.equal(pending.length, 1);
      for (const name of ['manager', 'accountant']) {
        const response = await api('POST', `/service-registrations/${pending[0]?.id}/approve-late`, token(name), {
          charge_method: 'full_month',
        });
        assert.equal(response.status, 403, name);
      }
    });

    it('CTC-P05-014: Phó Hiệu trưởng duyệt, chọn thu cả tháng thì đăng ký có hiệu lực', async () => {
      const pending = (
        await api('GET', `/service-registrations/pending?org_unit_id=${units['ĐT-A1']}`, token('vicePrincipal'))
      ).body as unknown as Array<{ id: string }>;
      const missingMethod = await api(
        'POST',
        `/service-registrations/${pending[0]?.id}/approve-late`,
        token('vicePrincipal'),
        {},
      );
      assert.equal(missingMethod.status, 400);
      const approved = await api(
        'POST',
        `/service-registrations/${pending[0]?.id}/approve-late`,
        token('vicePrincipal'),
        {
          charge_method: 'full_month',
        },
      );
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
      assert.equal(approved.body.status, 'active');
      assert.equal(approved.body.late_charge_method, 'full_month');
    });

    it('YCTD-50: hủy sau ngày chốt chờ Ban Giám hiệu duyệt; từ chối thì giữ đăng ký, duyệt thì hủy', async () => {
      const view = await childView(parentTokens.T1 ?? '', 'T1', lateMonth.period);
      const stem = view.registrations.find((row) => row.service_id === serviceIds.STEM);
      const requested = await api('POST', `/service-registrations/${stem?.id}/cancel`, parentTokens.T1 ?? '');
      assert.equal(requested.body.status, 'pending_cancel');
      const noReason = await api('POST', `/service-registrations/${stem?.id}/reject-late`, principal.accessToken, {});
      assert.equal(noReason.status, 400);
      const kept = await api('POST', `/service-registrations/${stem?.id}/reject-late`, principal.accessToken, {
        reason: 'Đã qua ngày chốt',
      });
      assert.equal(kept.body.status, 'active');
      await api('POST', `/service-registrations/${stem?.id}/cancel`, parentTokens.T1 ?? '');
      const cancelled = await api('POST', `/service-registrations/${stem?.id}/approve-late`, principal.accessToken, {});
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
      assert.equal(cancelled.body.status, 'cancelled');
    });

    it('CTC-P05-019: phụ huynh không đăng ký được cho trẻ không phải con mình; kế toán đơn vị khác không đăng ký được', async () => {
      assert.equal((await register(parentTokens.T1 ?? '', 'T2', openMonth.period, 'ANH_VAN')).status, 403);
      assert.equal((await register(token('accountantB'), 'T1', openMonth.period, 'ANH_VAN')).status, 403);
      assert.equal((await childView(parentTokens.T1 ?? '', 'T2', openMonth.period)).registrations, undefined);
    });
  });

  describe('DT-09 phần 9a: ngừng dịch vụ', () => {
    it('CTC-P05-007: ngừng dịch vụ đang có đăng ký thì đăng ký cũ giữ nguyên, không đăng ký mới được', async () => {
      serviceIds.BOI = (
        await api('POST', '/services', token('accountant'), {
          code: 'BOI',
          name: 'Bơi',
          unit: 'tháng',
          calculation_method: 'monthly',
        })
      ).body.id as string;
      const registered = await register(parentTokens.T1 ?? '', 'T1', openMonth.period, 'BOI');
      assert.equal(registered.status, 201, JSON.stringify(registered.body));
      const stopped = await api('PATCH', `/services/${serviceIds.BOI}`, token('accountant'), { status: 'inactive' });
      assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
      const view = await childView(parentTokens.T1 ?? '', 'T1', openMonth.period);
      assert.equal(view.registrations.find((row) => row.service_id === serviceIds.BOI)?.status, 'active');
      const fresh = await register(parentTokens.T2 ?? '', 'T2', openMonth.period, 'BOI');
      assert.ok(fresh.status === 400 || fresh.status === 422, JSON.stringify(fresh.body));
    });
  });

  describe('P05-04 Chốt danh sách đăng ký', () => {
    it('CTC-P05-022: quản lý đơn vị không chốt được', async () => {
      const response = await api('POST', '/service-registrations/lock', token('manager'), {
        org_unit_id: units['ĐT-A1'],
        period: openMonth.period,
      });
      assert.equal(response.status, 403);
    });

    it('CTC-P05-020, CTC-P05-021: kế toán chốt kỳ; quản lý đơn vị nhận thông báo; đăng ký thêm sau đó là đăng ký trễ', async () => {
      const locked = await api('POST', '/service-registrations/lock', token('accountant'), {
        org_unit_id: units['ĐT-A1'],
        period: openMonth.period,
      });
      assert.equal(locked.status, 200, JSON.stringify(locked.body));
      assert.equal(locked.body.is_locked, true);
      assert.equal(locked.body.is_late, true);
      const rows = locked.body.children as Array<{ registrations: Registration[] }>;
      assert.ok(
        rows.every((row) => row.registrations.some((registration) => registration.service_id === MEAL_SERVICE_ID)),
      );
      const notified = await schoolYear
        .selectFrom('notification_recipients')
        .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
        .select('notification_recipients.role_code')
        .where('notifications.template_code', '=', 'registrations_locked')
        .executeTakeFirst();
      assert.equal(notified?.role_code, 'VT-03');
      const late = await register(parentTokens.T2 ?? '', 'T2', openMonth.period, 'STEM', {
        service_start_date: openMonth.first,
      });
      assert.equal(late.body.status, 'pending_late');
      assert.equal(
        (
          await api('POST', '/service-registrations/lock', token('accountant'), {
            org_unit_id: units['ĐT-A1'],
            period: openMonth.period,
          })
        ).status,
        422,
      );
    });

    it('Quản lý đơn vị xem được bảng đăng ký của đơn vị mình; giáo viên không xem được bảng của đơn vị khác', async () => {
      const sheet = await api(
        'GET',
        `/service-registrations?org_unit_id=${units['ĐT-A1']}&period=${openMonth.period}`,
        token('manager'),
      );
      assert.equal(sheet.status, 200, JSON.stringify(sheet.body));
      assert.equal((sheet.body.children as unknown[]).length, 2);
      assert.equal(
        (
          await api(
            'GET',
            `/service-registrations?org_unit_id=${units['ĐT-B1']}&period=${openMonth.period}`,
            token('teacher'),
          )
        ).status,
        403,
      );
      // Phụ huynh được gán VT-14 theo đơn vị của con nhưng không xem được bảng của cả đơn vị (PQ-23)
      assert.equal(
        (
          await api(
            'GET',
            `/service-registrations?org_unit_id=${units['ĐT-A1']}&period=${openMonth.period}`,
            parentTokens.T1 ?? '',
          )
        ).status,
        403,
      );
    });
  });

  describe('P05-13 Đăng ký học hè', () => {
    it('CTC-P05-064, CTC-P05-066: phụ huynh đăng ký tháng hè cho con; tháng không thuộc kỳ hè bị từ chối', async () => {
      const periods = (await api('GET', '/service-registrations/periods', token('accountant')))
        .body as unknown as Array<{
        period: string;
        is_summer: boolean;
      }>;
      assert.deepEqual(
        periods.filter((period) => period.is_summer).map((period) => period.period),
        [summerMonth.period, shiftMonth(7).period],
      );
      const registered = await api('POST', '/summer-registrations', parentTokens.T1 ?? '', {
        child_id: children.T1,
        period: summerMonth.period,
      });
      assert.equal(registered.status, 201, JSON.stringify(registered.body));
      const staff = await api('POST', '/summer-registrations', token('accountant'), {
        child_id: children.T2,
        period: shiftMonth(7).period,
      });
      assert.equal(staff.status, 201, JSON.stringify(staff.body));
      const notSummer = await api('POST', '/summer-registrations', parentTokens.T1 ?? '', {
        child_id: children.T1,
        period: openMonth.period,
      });
      assert.equal(notSummer.status, 400);
    });

    it('YCTD-50: tháng hè chỉ trẻ đăng ký học hè có bán trú; dịch vụ không bắt buộc không tự giữ sang tháng hè', async () => {
      const t1 = await childView(parentTokens.T1 ?? '', 'T1', summerMonth.period);
      assert.equal(t1.is_summer, true);
      assert.deepEqual(
        t1.registrations.map((row) => row.service_id),
        [MEAL_SERVICE_ID],
      );
      const t2 = await childView(parentTokens.T2 ?? '', 'T2', summerMonth.period);
      assert.equal(t2.registrations.length, 0);
      assert.equal((await register(parentTokens.T2 ?? '', 'T2', summerMonth.period, 'STEM')).status, 422);
    });

    it('CTC-P05-067: giáo viên không đăng ký học hè được; phụ huynh không đăng ký cho trẻ khác', async () => {
      const body = { child_id: children.T1, period: shiftMonth(7).period };
      assert.equal((await api('POST', '/summer-registrations', token('teacher'), body)).status, 403);
      assert.equal((await api('POST', '/summer-registrations', parentTokens.T2 ?? '', body)).status, 403);
    });

    it('CTC-P04-046: ngày học hè bảng điểm danh chỉ có trẻ đã đăng ký học hè tháng đó', async () => {
      const day = firstWeekday(summerMonth.first);
      const sheet = await api('GET', `/classes/${classes['L-A1']}/attendance?date=${day}`, token('teacher'));
      assert.equal(sheet.status, 200, JSON.stringify(sheet.body));
      assert.deepEqual(
        (sheet.body.children as Array<{ child_id: string }>).map((child) => child.child_id),
        [children.T1],
      );
    });
  });
});
