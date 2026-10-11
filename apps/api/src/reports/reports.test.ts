import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase, replaceDatabaseName, type SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import {
  openTestAcademicYear,
  sendJson,
  startApiTestEnvironment,
  type ApiTestEnvironment,
  type LoggedInUser,
} from '../test-support.js';

// Bảng điều khiển và báo cáo cơ bản (DT-07 phần 7a, YCTD-62); kịch bản CT-125, CT-126, CT-128 và các chức năng P17-01 đến
// P17-07, P17-13, P17-14
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const currentMonth = vietnamToday.slice(0, 7);
const [year, month] = currentMonth.split('-').map(Number) as [number, number];
const otherMonth = month === 12 ? 1 : month + 1;
const pastSaturday = (() => {
  let date = addDays(`${currentMonth}-01`, -1);
  while (new Date(`${date}T00:00:00Z`).getUTCDay() !== 6) {
    date = addDays(date, -1);
  }
  return date;
})();

describe('Bảng điều khiển và báo cáo cơ bản', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  let academicYearId = '';
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const classes: Record<string, string> = {};
  const children: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const get = (path: string, accessToken: string) => sendJson('GET', `${environment.baseUrl}${path}`, accessToken);

  const addChild = async (name: string, orgUnitId: string, classId: string, dob: string) => {
    const child = await schoolYear
      .insertInto('children')
      .values({
        org_unit_id: orgUnitId,
        full_name: name,
        dob,
        gender: 'female',
        national_id_encrypted: 'ma-hoa',
        national_id_hash: randomUUID(),
        national_id_last4: '1234',
        photo_consent: 'pending',
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('class_enrollments')
      .values({ child_id: child.id, class_id: classId, from_date: addDays(vietnamToday, -60) })
      .execute();
    return child.id;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    academicYearId = await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
      first_term: { start_date: firstStart, end_date: firstEnd },
      second_term: { start_date: addDays(firstEnd, 3), end_date: addDays(firstEnd, 120) },
    });
    const yearDatabase = await environment.system
      .selectFrom('academic_year_databases')
      .select('database_name')
      .executeTakeFirstOrThrow();
    schoolYear = createDatabase<SchoolYearDatabase>(
      replaceDatabaseName(environment.systemDatabaseUrl, yearDatabase.database_name),
    );
    for (const [code, type] of [
      ['TC', 'truong_chinh'],
      ['ĐT-A1', 'diem_truong'],
      ['ĐT-B1', 'diem_truong'],
    ] as const) {
      units[code] = (
        await sendJson('POST', `${environment.baseUrl}/org-units`, principal.accessToken, {
          code,
          name: code,
          unit_type: type,
        })
      ).body.id as string;
    }
    users.manager = await environment.loginAs('VT-03', units['ĐT-A1'] ?? null);
    users.accountant = await environment.loginAs('VT-04', units['ĐT-A1'] ?? null);
    users.personnel = await environment.loginAs('VT-06', units['ĐT-A1'] ?? null);
    users.teacher = await environment.loginAs('VT-07', units['ĐT-A1'] ?? null);
    for (const [code, unit] of [
      ['MAM1', 'ĐT-A1'],
      ['MAM2', 'ĐT-A1'],
      ['CHOI1', 'ĐT-B1'],
    ] as const) {
      classes[code] = (
        await schoolYear
          .insertInto('classes')
          .values({
            org_unit_id: units[unit] ?? '',
            academic_year_id: academicYearId,
            code,
            name: code,
            grade_level: code.startsWith('MAM') ? 'MAM' : 'CHOI',
            max_size: 30,
          })
          .returning('id')
          .executeTakeFirstOrThrow()
      ).id;
    }
    await schoolYear
      .insertInto('class_staff_assignments')
      .values({
        class_id: classes.MAM1 ?? '',
        staff_user_id: users.teacher?.userId ?? '',
        staff_name: 'Giáo viên Mầm 1',
        assignment_role: 'homeroom',
        from_date: addDays(vietnamToday, -60),
      })
      .execute();
    const birthday = `2022-${String(month).padStart(2, '0')}-15`;
    children.an = await addChild('Nguyễn An', units['ĐT-A1'] ?? '', classes.MAM1 ?? '', birthday);
    children.binh = await addChild('Trần Bình', units['ĐT-A1'] ?? '', classes.MAM2 ?? '', birthday);
    children.chi = await addChild(
      'Lê Chi',
      units['ĐT-A1'] ?? '',
      classes.MAM1 ?? '',
      `2022-${String(otherMonth).padStart(2, '0')}-03`,
    );
    children.dung = await addChild('Phạm Dũng', units['ĐT-B1'] ?? '', classes.CHOI1 ?? '', birthday);
    // Điểm danh: Mầm 1 có 3 lượt đi học, 1 lượt vắng có báo trong tháng; ngày thứ bảy học bù có một trẻ đi học
    const recordedAt = new Date();
    const record = (childId: string, classId: string, date: string, status: 'present' | 'absent_notified') => ({
      child_id: childId,
      class_id: classId,
      org_unit_id: units['ĐT-A1'] ?? '',
      attendance_date: date,
      status,
      source: 'teacher' as const,
      recorded_by: users.teacher?.userId ?? '',
      recorded_at: recordedAt,
    });
    await schoolYear
      .insertInto('attendance_records')
      .values([
        record(children.an, classes.MAM1 ?? '', `${currentMonth}-01`, 'present'),
        record(children.an, classes.MAM1 ?? '', `${currentMonth}-02`, 'present'),
        record(children.chi, classes.MAM1 ?? '', `${currentMonth}-01`, 'present'),
        record(children.chi, classes.MAM1 ?? '', `${currentMonth}-02`, 'absent_notified'),
        record(children.binh, classes.MAM2 ?? '', `${currentMonth}-01`, 'absent_notified'),
        record(children.an, classes.MAM1 ?? '', pastSaturday, 'present'),
        record(children.chi, classes.MAM1 ?? '', pastSaturday, 'absent_notified'),
      ])
      .execute();
    await schoolYear
      .insertInto('school_day_changes')
      .values({ change_date: pastSaturday, change_type: 'makeup_school_day', note: 'Học bù' })
      .execute();
    // Học phí tháng này: hai hóa đơn ở ĐT-A1, một hóa đơn quá hạn; một hóa đơn ở ĐT-B1
    for (const [childId, unit, amount, due] of [
      [children.an, 'ĐT-A1', 3_000_000, addDays(vietnamToday, -20)],
      [children.binh, 'ĐT-A1', 2_000_000, addDays(vietnamToday, 20)],
      [children.dung, 'ĐT-B1', 4_000_000, addDays(vietnamToday, 20)],
    ] as const) {
      await schoolYear
        .insertInto('invoices')
        .values({
          code: `HD-${randomInt(100_000, 999_999)}`,
          child_id: childId,
          org_unit_id: units[unit] ?? '',
          period_year: year,
          period_month: month,
          invoice_kind: 'main',
          status: 'issued',
          total_amount: amount,
          basis: '{}',
          due_date: due,
        })
        .execute();
    }
    const category = await schoolYear
      .insertInto('cashflow_categories')
      .values({ code: 'HOC_PHI', name: 'Học phí', group_name: 'Thu', flow_type: 'income' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const expenseCategory = await schoolYear
      .insertInto('cashflow_categories')
      .values({ code: 'VAN_PHONG', name: 'Văn phòng phẩm', group_name: 'Chi', flow_type: 'expense' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const account = await schoolYear
      .insertInto('cash_accounts')
      .values({
        org_unit_id: units['ĐT-A1'] ?? '',
        account_type: 'cash',
        name: 'Quỹ A1',
        opening_balance: 0,
        current_balance: 0,
        created_by: users.accountant?.userId ?? '',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await schoolYear
      .insertInto('receipts')
      .values({
        code: 'PT-900001',
        org_unit_id: units['ĐT-A1'] ?? '',
        child_id: children.binh,
        payer_name: 'Phụ huynh Bình',
        amount: 500_000,
        method: 'cash',
        account_id: account.id,
        category_id: category.id,
        receipt_date: vietnamToday,
        request_key: randomUUID(),
        created_by: users.accountant?.userId ?? '',
      })
      .execute();
    await schoolYear
      .insertInto('payments')
      .values({
        code: 'PC-900001',
        org_unit_id: units['ĐT-A1'] ?? '',
        payment_type: 'regular',
        payee_name: 'Cửa hàng',
        amount: 200_000,
        content: 'Mua giấy',
        account_id: account.id,
        category_id: expenseCategory.id,
        payment_date: vietnamToday,
        status: 'issued',
        request_key: randomUUID(),
        created_by: users.accountant?.userId ?? '',
      })
      .execute();
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P17-01: Hiệu trưởng xem bảng điều khiển toàn trường', async () => {
    const response = await get(`/dashboard/leadership?month=${currentMonth}`, principal.accessToken);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.children_count, 4);
    assert.equal(response.body.classes_count, 3);
    const tuition = response.body.tuition as { payable_amount: number; invoice_count: number };
    assert.equal(tuition.invoice_count, 3);
    assert.equal(tuition.payable_amount, 9_000_000);
    assert.equal((response.body.debt as { overdue_amount: number }).overdue_amount, 3_000_000);
  });

  it('P17-02: quản lý đơn vị chỉ thấy đơn vị được gán; đơn vị khác và giáo viên bị từ chối', async () => {
    const response = await get(`/dashboard/unit?month=${currentMonth}`, token('manager'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.children_count, 3);
    assert.equal((response.body.tuition as { payable_amount: number }).payable_amount, 5_000_000);
    // Mầm 1: 3 lượt đi học trên 4 lượt; Mầm 2: 0 trên 1; ngày thứ bảy học bù thuộc tháng khác thì không tính
    const attendance = response.body.attendance as { present_count: number };
    assert.ok(attendance.present_count >= 3);
    assert.equal(
      (await get(`/dashboard/unit?month=${currentMonth}&org_unit_id=${units['ĐT-B1']}`, token('manager'))).status,
      403,
    );
    assert.equal((await get(`/dashboard/leadership?month=${currentMonth}`, token('teacher'))).status, 403);
  });

  it('CT-125, P17-13: giáo viên chỉ thấy sinh nhật trẻ lớp mình; Hiệu trưởng thấy toàn trường', async () => {
    const teacher = await get(`/dashboard/birthdays?month=${currentMonth}`, token('teacher'));
    assert.equal(teacher.status, 200, JSON.stringify(teacher.body));
    assert.deepEqual(
      (teacher.body as unknown as Array<{ full_name: string }>).map((row) => row.full_name),
      ['Nguyễn An'],
    );
    const school = await get(`/dashboard/birthdays?month=${currentMonth}`, principal.accessToken);
    assert.equal((school.body as unknown as unknown[]).length, 3);
  });

  it('P17-03: báo cáo học phí theo lớp, lọc theo khối', async () => {
    const response = await get(
      `/reports/tuition?month=${currentMonth}&org_unit_id=${units['ĐT-A1']}`,
      token('accountant'),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const totals = response.body.totals as { payable_amount: number; paid_amount: number; invoice_count: number };
    assert.equal(totals.invoice_count, 2);
    assert.equal(totals.payable_amount, 5_000_000);
    const filtered = await get(`/reports/tuition?month=${currentMonth}&grade_level=CHOI`, principal.accessToken);
    assert.equal((filtered.body.totals as { payable_amount: number }).payable_amount, 4_000_000);
    assert.equal((await get(`/reports/tuition?month=${currentMonth}`, token('teacher'))).status, 403);
  });

  it('P17-04: báo cáo công nợ theo trẻ và theo lớp; lọc theo số ngày quá hạn', async () => {
    const all = await get(`/reports/debts?org_unit_id=${units['ĐT-A1']}`, token('accountant'));
    assert.equal(all.status, 200, JSON.stringify(all.body));
    assert.equal((all.body.totals as { outstanding_amount: number }).outstanding_amount, 5_000_000);
    assert.equal((all.body.classes as unknown[]).length, 2);
    const overdue = await get(
      `/reports/debts?org_unit_id=${units['ĐT-A1']}&minimum_overdue_days=10`,
      token('accountant'),
    );
    assert.deepEqual(
      (overdue.body.children as Array<{ full_name: string }>).map((row) => row.full_name),
      ['Nguyễn An'],
    );
  });

  it('P17-05, BR-36: báo cáo thu chi theo khoản mục, lọc loại thu chi và người lập', async () => {
    const range = `from=${addDays(vietnamToday, -1)}&to=${vietnamToday}`;
    const response = await get(`/reports/cash-flow?${range}&org_unit_id=${units['ĐT-A1']}`, token('accountant'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.totals, {
      income_amount: 500_000,
      expense_amount: 200_000,
      difference_amount: 300_000,
    });
    const incomeOnly = await get(`/reports/cash-flow?${range}&flow_type=income`, principal.accessToken);
    assert.equal((incomeOnly.body.totals as { expense_amount: number }).expense_amount, 0);
    const byOther = await get(`/reports/cash-flow?${range}&created_by=${users.manager?.userId}`, principal.accessToken);
    assert.equal((byOther.body.documents as unknown[]).length, 0);
    assert.equal((await get(`/reports/cash-flow?${range}`, token('manager'))).status, 403);
  });

  it('P17-06: báo cáo điểm danh; giáo viên chỉ thấy lớp được phân công', async () => {
    const range = `from=${currentMonth}-01&to=${currentMonth}-02`;
    const teacher = await get(`/reports/attendance?${range}`, token('teacher'));
    assert.equal(teacher.status, 200, JSON.stringify(teacher.body));
    const rows = teacher.body.classes as Array<{
      class_name: string;
      present: number;
      total: number;
      rate_percent: number;
    }>;
    assert.deepEqual(
      rows.map((row) => row.class_name),
      ['MAM1'],
    );
    assert.equal(rows[0]?.present, 3);
    assert.equal(rows[0]?.rate_percent, 75);
    assert.equal((teacher.body.absences as unknown[]).length, 1);
    const manager = await get(`/reports/attendance?${range}`, token('manager'));
    assert.equal((manager.body.classes as unknown[]).length, 2);
  });

  it('P17-07: nhân sự xem báo cáo chấm công theo tháng; kế toán bị từ chối', async () => {
    const response = await get(`/reports/staff-attendance?month=${currentMonth}`, token('personnel'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(Array.isArray(response.body.staff));
    assert.equal((await get(`/reports/staff-attendance?month=${currentMonth}`, token('accountant'))).status, 403);
  });

  it('CT-126, CT-128: kế toán xem báo cáo học thứ 7; giáo viên bị từ chối', async () => {
    const range = `from=${addDays(pastSaturday, -1)}&to=${addDays(pastSaturday, 1)}`;
    const response = await get(`/reports/saturday-classes?${range}`, token('accountant'));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const days = response.body.days as Array<{ date: string; present_count: number; absent_count: number }>;
    assert.deepEqual(
      days.map((day) => [day.date, day.present_count, day.absent_count]),
      [[pastSaturday, 1, 1]],
    );
    assert.equal((await get(`/reports/saturday-classes?${range}`, token('teacher'))).status, 403);
  });
});
