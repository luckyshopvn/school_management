import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import {
  createDatabase,
  MEAL_SERVICE_ID,
  replaceDatabaseName,
  type SchoolYearDatabase,
} from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Các tình huống tính học phí theo lịch năm học (DT-09 phần 9a): phiên bản biểu phí, học phí chính khóa bằng 0, tuần
// nghỉ, ngày học bù thứ bảy, tháng hè, lỗi giữa chừng. Năm học kiểm thử nằm trọn trong sáu tháng trước tháng hiện tại để
// mọi ngày học đều đã qua: học kỳ 1 gồm tháng A, B, C; học kỳ 2 gồm tháng D, E; kỳ hè là tháng F
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const errorOf = (body: Record<string, unknown>) =>
  (body.error ?? {}) as { code?: string; rule_code?: string; details?: Array<{ field: string; message: string }> };

function shiftMonth(offset: number) {
  const base = new Date(Date.UTC(Number(vietnamToday.slice(0, 4)), Number(vietnamToday.slice(5, 7)) - 1 + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { period, first: `${period}-01`, last: `${period}-${String(lastDay).padStart(2, '0')}` };
}

function weekdays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      days.push(day);
    }
  }
  return days;
}

type InvoiceDetail = {
  id: string;
  child_id: string;
  total_amount: number;
  basis: { school_days: number; enrolled_days: number };
  items: Array<{ item_type: string; service_id: string | null; amount: number }>;
};

describe('Tình huống tính học phí theo lịch năm học', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let accountant: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  let unitId = '';
  const classes: Record<string, string> = {};
  const children: Record<string, { id: string; classCode: string; enrollDate: string }> = {};
  const services: Record<string, string> = {};
  const [monthA, monthB, monthC, monthD, monthE, monthF] = [-6, -5, -4, -3, -2, -1].map(shiftMonth) as [
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
    ReturnType<typeof shiftMonth>,
  ];
  const makeupSaturday = (() => {
    let day = addDays(monthD.first, 7);
    while (new Date(`${day}T00:00:00Z`).getUTCDay() !== 6) {
      day = addDays(day, 1);
    }
    return day;
  })();

  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const calculate = (period: string) =>
    api('POST', '/fee-calculations', accessToken(), { org_unit_id: unitId, period });
  const accessToken = () => accountant.accessToken;

  const priceItems = (tuition: number) => [
    { grade_level: 'MAM', fee_type: 'tuition', amount: tuition },
    { grade_level: 'MAM', fee_type: 'service', service_id: MEAL_SERVICE_ID, amount: 35_000 },
    { grade_level: 'MAM', fee_type: 'service', service_id: services.STEM, amount: 440_000 },
    { grade_level: 'MAM', fee_type: 'service', service_id: services.ANH_VAN, amount: 550_000 },
  ];

  async function invoiceOf(child: string, period: string): Promise<InvoiceDetail | undefined> {
    const list = (await api('GET', `/invoices?org_unit_id=${unitId}&period=${period}`, accessToken()))
      .body as unknown as Array<{ id: string; child_id: string }> | undefined;
    const row = list?.find((invoice) => invoice.child_id === children[child]?.id);
    return row
      ? ((await api('GET', `/invoices/${row.id}`, accessToken())).body as unknown as InvoiceDetail)
      : undefined;
  }

  // Chốt danh sách đăng ký của kỳ, rồi chốt điểm danh đúng những ngày máy chủ báo còn thiếu (Q-151): mọi trẻ đang học
  // có mặt
  async function prepare(period: string) {
    const locked = await api('POST', '/service-registrations/lock', accessToken(), { org_unit_id: unitId, period });
    assert.equal(locked.status, 200, JSON.stringify(locked.body));
    const blocked = await calculate(period);
    if (blocked.status !== 422 || errorOf(blocked.body).rule_code !== 'Q-151') {
      return blocked;
    }
    const classIdByName = new Map(Object.entries(classes).map(([code, id]) => [code, id]));
    for (const detail of errorOf(blocked.body).details ?? []) {
      const classId = classIdByName.get(detail.field) ?? '';
      const day = detail.message;
      await schoolYear
        .insertInto('attendance_days')
        .values({
          class_id: classId,
          attendance_date: day,
          status: 'locked',
          locked_by: principal.userId,
          locked_at: new Date(),
        })
        .execute();
      const present = Object.values(children).filter(
        (child) => classes[child.classCode] === classId && child.enrollDate <= day,
      );
      if (present.length > 0) {
        await schoolYear
          .insertInto('attendance_records')
          .values(
            present.map((child) => ({
              child_id: child.id,
              class_id: classId,
              org_unit_id: unitId,
              attendance_date: day,
              status: 'present' as const,
              note: null,
              source: 'manager' as const,
              recorded_by: principal.userId,
              recorded_at: new Date(),
            })),
          )
          .execute();
      }
    }
    return calculate(period);
  }

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, 'Năm học tình huống', {
      first_term: { start_date: monthA.first, end_date: monthC.last },
      second_term: { start_date: monthD.first, end_date: monthE.last },
      summer_term: { start_date: monthF.first, end_date: monthF.last },
    });
    const databaseRow = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .where('academic_year_id', '=', academicYearId)
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, databaseRow.database_name),
    );
    await api('POST', '/org-units', principal.accessToken, { code: 'TC', name: 'TC', unit_type: 'truong_chinh' });
    unitId = (
      await api('POST', '/org-units', principal.accessToken, { code: 'ĐT-A1', name: 'ĐT-A1', unit_type: 'diem_truong' })
    ).body.id as string;
    accountant = await environment.loginAs('VT-04', unitId);
    await api('POST', '/grade-levels', principal.accessToken, {
      code: 'MAM',
      name: 'Mầm',
      age_from_months: 36,
      age_to_months: 71,
    });
    for (const code of ['L-A1', 'L-A2']) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: unitId,
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: 'MAM',
            max_size: 25,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    for (const [code, name] of [
      ['STEM', 'STEM'],
      ['ANH_VAN', 'Anh văn'],
    ] as const) {
      services[code] = (
        await api('POST', '/services', accessToken(), { code, name, unit: 'tháng', calculation_method: 'monthly' })
      ).body.id as string;
    }
    const schedule = await api('POST', '/fee-schedules', accessToken(), {
      name: 'Biểu phí phiên bản 1',
      effective_from: monthA.first,
      items: priceItems(2_200_000),
    });
    assert.equal(schedule.status, 201, JSON.stringify(schedule.body));
    const monthCDays = weekdays(monthC.first, monthC.last);
    for (const [key, classCode, enrollDate] of [
      ['T1', 'L-A1', monthA.first],
      ['T2', 'L-A2', monthA.first],
      // T3 nhập học ở tháng C, còn 6 ngày học cuối tháng (CTC-P05-063)
      ['T3', 'L-A1', monthCDays[monthCDays.length - 6] ?? ''],
    ] as const) {
      const child = await schoolYear
        .insertInto('children')
        .values({
          org_unit_id: unitId,
          full_name: `Trẻ ${key}`,
          dob: '2022-03-01',
          gender: 'female',
          national_id_encrypted: 'ma-hoa',
          national_id_hash: randomUUID(),
          national_id_last4: '0000',
          photo_consent: 'pending',
          status: 'active',
          enroll_date: enrollDate,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await schoolYear
        .insertInto('class_enrollments')
        .values({ child_id: child.id, class_id: classes[classCode] ?? '', from_date: enrollDate })
        .execute();
      children[key] = { id: child.id, classCode, enrollDate };
    }
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CT-023: trẻ đăng ký bán trú, STEM, Anh văn thì hóa đơn có học phí chính khóa và ba khoản dịch vụ', async () => {
    const [year, month] = monthA.period.split('-').map(Number) as [number, number];
    await schoolYear
      .insertInto('service_registrations')
      .values(
        ['STEM', 'ANH_VAN'].map((code) => ({
          child_id: children.T1?.id ?? '',
          org_unit_id: unitId,
          period_year: year,
          period_month: month,
          service_id: services[code] ?? '',
          status: 'active' as const,
          source: 'parent' as const,
        })),
      )
      .execute();
    const run = await prepare(monthA.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    const invoice = await invoiceOf('T1', monthA.period);
    const days = weekdays(monthA.first, monthA.last).length;
    assert.deepEqual(
      invoice?.items.map((item) => [item.service_id, item.amount]).sort(),
      [
        [null, 2_200_000],
        [MEAL_SERVICE_ID, 35_000 * days],
        [services.STEM, 440_000],
        [services.ANH_VAN, 550_000],
      ].sort(),
    );
    assert.equal(invoice?.total_amount, 2_200_000 + 35_000 * days + 440_000 + 550_000);
  });

  it('CTC-P05-002: phiên bản biểu phí mới từ tháng B thì hóa đơn tháng A giữ giá cũ, tháng B tính theo giá mới', async () => {
    const version = await api('POST', '/fee-schedules', accessToken(), {
      name: 'Biểu phí phiên bản 2',
      effective_from: monthB.first,
      items: priceItems(2_400_000),
    });
    assert.equal(version.status, 201, JSON.stringify(version.body));
    const again = await calculate(monthA.period);
    assert.equal(again.status, 201, JSON.stringify(again.body));
    const tuitionOf = (invoice: InvoiceDetail | undefined) =>
      invoice?.items.find((item) => item.item_type === 'tuition')?.amount;
    assert.equal(tuitionOf(await invoiceOf('T1', monthA.period)), 2_200_000);
    const run = await prepare(monthB.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    assert.equal(tuitionOf(await invoiceOf('T1', monthB.period)), 2_400_000);
  });

  it('CTC-P05-063: tháng có tuần nghỉ thì số ngày học trừ tuần nghỉ; trẻ học 6 ngày cuối tháng tính học phí theo tỷ lệ', async () => {
    const weeks = (await api('GET', `/academic-years/${academicYearId}/weeks`, principal.accessToken))
      .body as unknown as Array<{
      week_no: number;
      start_date: string;
      end_date: string;
    }>;
    const offWeek = weeks.find((week) => week.start_date >= monthC.first && week.end_date <= addDays(monthC.last, -7));
    assert.ok(offWeek);
    const changed = await api('PATCH', `/academic-years/${academicYearId}/weeks`, principal.accessToken, {
      weeks: [{ week_no: offWeek.week_no, is_off: true, note: 'Nghỉ giữa kỳ' }],
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const run = await prepare(monthC.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    const schoolDays = weekdays(monthC.first, monthC.last).length - 5;
    const t1 = await invoiceOf('T1', monthC.period);
    assert.equal(t1?.basis.school_days, schoolDays);
    const t3 = await invoiceOf('T3', monthC.period);
    assert.equal(t3?.basis.enrolled_days, 6);
    assert.equal(
      t3?.items.find((item) => item.item_type === 'tuition')?.amount,
      Math.round((2_400_000 * 6) / schoolDays),
    );
  });

  it('CTC-P05-028, CT-160, CTC-P04-007: ngày học bù thứ bảy có bảng điểm danh ở mọi lớp và được tính vào ngày học, ngày ăn', async () => {
    await schoolYear
      .insertInto('school_day_changes')
      .values({
        change_date: makeupSaturday,
        change_type: 'makeup_school_day',
        note: 'Học bù',
        created_by: principal.userId,
      })
      .execute();
    for (const [code, child] of [
      ['L-A1', 'T1'],
      ['L-A2', 'T2'],
    ] as const) {
      const sheet = await api(
        'GET',
        `/classes/${classes[code]}/attendance?date=${makeupSaturday}`,
        principal.accessToken,
      );
      assert.equal(sheet.status, 200, JSON.stringify(sheet.body));
      assert.ok(JSON.stringify(sheet.body).includes(children[child]?.id ?? ''));
    }
    const run = await prepare(monthD.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    const days = weekdays(monthD.first, monthD.last).length + 1;
    const t2 = await invoiceOf('T2', monthD.period);
    assert.equal(t2?.basis.school_days, days);
    assert.equal(t2?.items.find((item) => item.service_id === MEAL_SERVICE_ID)?.amount, 35_000 * days);
  });

  it('CTC-P05-003, CT-132: học phí chính khóa bằng 0 thì hóa đơn chỉ có các khoản dịch vụ', async () => {
    const version = await api('POST', '/fee-schedules', accessToken(), {
      name: 'Biểu phí phiên bản 3',
      effective_from: monthE.first,
      items: priceItems(0),
    });
    assert.equal(version.status, 201, JSON.stringify(version.body));
    const run = await prepare(monthE.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    const t2 = await invoiceOf('T2', monthE.period);
    assert.ok(t2 && t2.items.length > 0);
    assert.ok(t2.items.every((item) => item.item_type === 'service'));
  });

  it('CTC-P05-032: lỗi giữa chừng thì lần chạy ghi thất bại, hóa đơn cũ giữ nguyên, chạy lại được', async () => {
    const before = await invoiceOf('T2', monthE.period);
    await sql`create function test_fail_invoice_items() returns trigger language plpgsql as $$ begin raise exception 'lỗi giả lập'; end $$`.execute(
      schoolYear,
    );
    await sql`create trigger test_fail_invoice_items before insert on invoice_items for each row execute function test_fail_invoice_items()`.execute(
      schoolYear,
    );
    try {
      const failed = await calculate(monthE.period);
      assert.ok(failed.status >= 500, JSON.stringify(failed.body));
    } finally {
      await sql`drop trigger test_fail_invoice_items on invoice_items`.execute(schoolYear);
      await sql`drop function test_fail_invoice_items()`.execute(schoolYear);
    }
    const [year, month] = monthE.period.split('-').map(Number) as [number, number];
    const latest = await schoolYear
      .selectFrom('fee_calculation_runs')
      .select(['status', 'error_detail'])
      .where('period_year', '=', year)
      .where('period_month', '=', month)
      .orderBy('started_at', 'desc')
      .executeTakeFirstOrThrow();
    assert.equal(latest.status, 'failed');
    const kept = await invoiceOf('T2', monthE.period);
    assert.deepEqual(kept?.items, before?.items);
    const rerun = await calculate(monthE.period);
    assert.equal(rerun.status, 201, JSON.stringify(rerun.body));
    assert.equal(rerun.body.status, 'succeeded');
  });

  it('CTC-P05-065, CT-187: tháng hè chỉ trẻ đăng ký học hè có hóa đơn', async () => {
    const [year, month] = monthF.period.split('-').map(Number) as [number, number];
    await schoolYear
      .insertInto('summer_registrations')
      .values({
        child_id: children.T1?.id ?? '',
        org_unit_id: unitId,
        period_year: year,
        period_month: month,
        status: 'active',
        source: 'staff',
        registered_by: principal.userId,
      })
      .execute();
    const run = await prepare(monthF.period);
    assert.equal(run.status, 201, JSON.stringify(run.body));
    assert.ok(await invoiceOf('T1', monthF.period));
    assert.equal(await invoiceOf('T2', monthF.period), undefined);
  });
});
