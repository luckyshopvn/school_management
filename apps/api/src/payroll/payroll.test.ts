import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
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
import { calculatePayslip, progressiveTax } from './payroll-calculation.js';

// Danh mục lương, biểu thuế, bảng lương toàn trường, duyệt theo hạn mức, phiếu lương (DT-06 phần 6c-1, YCTD-60); ca kiểm
// thử CTC-P08-027 đến 038, CTC-P08-044 đến 048, CTC-P08-055, CTC-P08-057, CTC-P08-058
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
const currentMonth = vietnamToday.slice(0, 7);
const previousMonthStart = (() => {
  const date = new Date(Date.parse(`${currentMonth}-01T00:00:00Z`) - 86_400_000);
  return `${date.toISOString().slice(0, 7)}-01`;
})();
const previousMonth = previousMonthStart.slice(0, 7);
const previousWeekdays = (() => {
  const days = [];
  for (let date = previousMonthStart; date.slice(0, 7) === previousMonth; date = addDays(date, 1)) {
    if (weekdayOf(date) <= 5) {
      days.push(date);
    }
  }
  return days;
})();
const standardDays = previousWeekdays.length;
const TAX_TABLE = {
  personal_deduction: 15_500_000,
  dependent_deduction: 6_200_000,
  brackets: [
    { up_to: 10_000_000, rate_percent: 5 },
    { up_to: 30_000_000, rate_percent: 10 },
    { up_to: 60_000_000, rate_percent: 20 },
    { up_to: 100_000_000, rate_percent: 30 },
    { up_to: null, rate_percent: 35 },
  ],
};

describe('Phép tính bảng lương', () => {
  it('CTC-P08-055: khấu trừ 10,5% lương hợp đồng 12 000 000 bằng 1 260 000, có căn cứ', () => {
    const result = calculatePayslip({
      prepaid: { contractNo: 'HD-1', baseSalary: 12_000_000, contractAllowances: [] },
      adjustment: null,
      items: [
        {
          kind: 'deduction',
          code: 'BHXH',
          name: 'Bảo hiểm bắt buộc',
          calculation_method: 'percent_of_base',
          amount: null,
          rate_percent: 10.5,
          is_tax_exempt: false,
          is_mandatory_insurance: true,
        },
      ],
      dependents: 0,
      taxTable: TAX_TABLE,
    });
    const line = result.lines.find((item) => item.code === 'BHXH');
    assert.equal(line?.amount, -1_260_000);
    assert.match(line?.basis ?? '', /10,5%/);
    assert.equal(result.net_amount, 10_740_000);
  });

  it('CTC-P08-029, CTC-P08-032: trừ 3 ngày không hưởng lương trên 24 ngày công chuẩn; tháng đầu trả theo ngày công', () => {
    const totals = { workdayRows: 24, unpaidDays: 3, workedDays: 21, overtimeMinutes: 0 };
    const adjustment = {
      contractNo: 'HD-1',
      baseSalary: 12_000_000,
      standardDays: 24,
      standardMinutes: 480,
      overtimeRatePercent: 150,
      totals,
      month: '2026-09',
    };
    const deducted = calculatePayslip({
      prepaid: null,
      adjustment: { ...adjustment, prepaidLastMonth: true },
      items: [],
      dependents: 0,
      taxTable: TAX_TABLE,
    });
    assert.equal(deducted.adjustment_amount, -1_500_000);
    const firstMonth = calculatePayslip({
      prepaid: null,
      adjustment: { ...adjustment, prepaidLastMonth: false, totals: { ...totals, workdayRows: 12, unpaidDays: 0 } },
      items: [],
      dependents: 0,
      taxTable: TAX_TABLE,
    });
    assert.equal(firstMonth.adjustment_amount, 6_000_000);
  });

  it('BR-82: làm thêm theo lương giờ nhân hệ số; thuế lũy tiến từng phần sau giảm trừ gia cảnh', () => {
    const result = calculatePayslip({
      prepaid: { contractNo: 'HD-2', baseSalary: 50_000_000, contractAllowances: [] },
      adjustment: {
        contractNo: 'HD-2',
        baseSalary: 24_000_000,
        prepaidLastMonth: true,
        standardDays: 24,
        standardMinutes: 480,
        overtimeRatePercent: 150,
        totals: { workdayRows: 24, unpaidDays: 0, workedDays: 24, overtimeMinutes: 240 },
        month: '2026-09',
      },
      items: [],
      dependents: 1,
      taxTable: TAX_TABLE,
    });
    // 24 000 000 / 24 ngày / 8 giờ × 150% × 4 giờ = 750 000
    assert.equal(result.lines.find((line) => line.code === 'LAM_THEM')?.amount, 750_000);
    // Thu nhập tính thuế 50 750 000 − 15 500 000 − 6 200 000 = 29 050 000: 500 000 + 1 905 000
    assert.equal(result.taxable_income, 29_050_000);
    assert.equal(result.tax_amount, 2_405_000);
    assert.equal(progressiveTax(34_500_000, TAX_TABLE.brackets), 3_400_000);
    assert.equal(progressiveTax(0, TAX_TABLE.brackets), 0);
  });
});

describe('Bảng lương toàn trường', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  const staffIds: Record<string, string> = {};
  let payrollId = '';
  const unpaidDay = previousWeekdays[3] ?? '';
  const overtimeDay = previousWeekdays[1] ?? '';
  const newStaffStart = previousWeekdays[previousWeekdays.length - 5] ?? '';

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);
  const createStaff = async (name: string, startDate: string, salary: number | null) => {
    const created = await api('POST', '/staff', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      code: `NS-${randomInt(100_000, 999_999)}`,
      full_name: name,
      start_date: startDate,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    if (salary !== null) {
      const contract = await api('POST', `/staff/${created.body.id}/contracts`, token('personnel'), {
        contract_no: `HDLD-${randomInt(100_000, 999_999)}`,
        contract_type: 'indefinite',
        start_date: startDate,
        base_salary: salary,
        allowances: name === 'Nguyễn Thị Lan' ? [{ name: 'Phụ cấp trách nhiệm', amount: 500_000 }] : [],
      });
      assert.equal(contract.status, 201, JSON.stringify(contract.body));
    }
    return created.body.id as string;
  };

  before(async () => {
    environment = await startApiTestEnvironment();
    principal = await environment.loginAs('VT-02', null);
    const firstStart = addDays(vietnamToday, -100);
    const firstEnd = addDays(vietnamToday, 120);
    const startYear = Number(firstStart.slice(0, 4));
    await openTestAcademicYear(environment, principal.accessToken, `${startYear}–${startYear + 1}`, {
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
    ] as const) {
      units[code] = (await api('POST', '/org-units', principal.accessToken, { code, name: code, unit_type: type })).body
        .id as string;
    }
    const unitA = units['ĐT-A1'] ?? null;
    users.accountant = await environment.loginAs('VT-04', unitA);
    users.chiefAccountant = await environment.loginAs('VT-05', unitA);
    users.personnel = await environment.loginAs('VT-06', unitA);
    users.vicePrincipal = await environment.loginAs('VT-15', units.TC ?? null);
    users.unitVicePrincipal = await environment.loginAs('VT-15', unitA);
    users.manager = await environment.loginAs('VT-03', unitA);
    users.cashier = await environment.loginAs('VT-16', unitA);
    users.teacher = await environment.loginAs('VT-07', unitA);
    users.auditor = await environment.loginAs('VT-20', null);

    staffIds.teacher = await createStaff('Nguyễn Thị Lan', addDays(previousMonthStart, -400), 12_000_000);
    staffIds.newcomer = await createStaff('Trần Văn Mới', newStaffStart, 12_000_000);
    staffIds.noContract = await createStaff('Lê Thị Chưa Ký', addDays(previousMonthStart, -30), null);
    await schoolYear
      .updateTable('staff')
      .set({ user_id: users.teacher?.userId ?? null })
      .where('id', '=', staffIds.teacher)
      .execute();
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: unitA,
      values: { work_start_time: '07:30', work_end_time: '17:00', lunch_break_minutes: 60, overtime_rate_percent: 150 },
    });
    // Chấm công đủ các ngày làm việc tháng trước; một ngày làm thêm, một ngày nghỉ không lương có đơn được duyệt
    for (const [staffId, start] of [
      [staffIds.teacher, previousMonthStart],
      [staffIds.newcomer, newStaffStart],
      [staffIds.noContract, previousMonthStart],
    ] as const) {
      const rows = previousWeekdays
        .filter((date) => date >= start && !(staffId === staffIds.teacher && date === unpaidDay))
        .map((date) => ({
          staff_id: staffId,
          work_date: date,
          check_in: '07:30',
          check_out: staffId === staffIds.teacher && date === overtimeDay ? '18:30' : '17:00',
          source: 'manual' as const,
        }));
      await schoolYear.insertInto('attendance_logs').values(rows).execute();
    }
    const leaveType = await api('POST', '/catalog-items', principal.accessToken, {
      catalog_type: 'leave_type',
      code: 'KL',
      name: 'Nghỉ không lương',
      attributes: { is_paid: false, deducts_annual_leave: false, insurance_paid: false },
    });
    const leave = await api('POST', '/leave-requests', token('personnel'), {
      staff_id: staffIds.teacher,
      leave_type_id: leaveType.body.id,
      from_date: unpaidDay,
      to_date: unpaidDay,
      reason: 'Việc riêng',
    });
    assert.equal(leave.status, 201, JSON.stringify(leave.body));
    await api('POST', `/leave-requests/${leave.body.id}/approve`, principal.accessToken);
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('P08-11: kế toán khai danh mục phụ cấp, khấu trừ; nhân sự gán cho từng người; giáo viên không khai được', async () => {
    const types = [
      {
        kind: 'deduction',
        code: 'BHXH',
        name: 'Bảo hiểm bắt buộc',
        calculation_method: 'percent_of_base',
        rate_percent: 10.5,
        is_mandatory_insurance: true,
      },
      {
        kind: 'allowance',
        code: 'AN_TRUA',
        name: 'Phụ cấp ăn trưa',
        calculation_method: 'per_workday',
        default_amount: 30_000,
        is_tax_exempt: true,
      },
      {
        kind: 'allowance',
        code: 'THUONG',
        name: 'Thưởng tháng',
        calculation_method: 'fixed_monthly',
        default_amount: 300_000,
      },
    ];
    assert.equal((await api('POST', '/pay-item-types', token('teacher'), types[0])).status, 403);
    for (const type of types) {
      const created = await api('POST', '/pay-item-types', token('accountant'), type);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const assigned = await api('POST', `/staff/${staffIds.teacher}/pay-items`, token('personnel'), {
        pay_item_type_id: created.body.id,
      });
      assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
      if (type.code === 'AN_TRUA') {
        await api('POST', `/staff/${staffIds.newcomer}/pay-items`, token('personnel'), {
          pay_item_type_id: created.body.id,
        });
      }
    }
    assert.equal(
      (await api('POST', '/pay-item-types', token('accountant'), { ...types[1], is_mandatory_insurance: true })).status,
      400,
    );
    const items = await api('GET', `/staff/${staffIds.teacher}/pay-items`, token('personnel'));
    assert.equal((items.body.items as unknown[]).length, 3);
    assert.equal(
      (await api('PUT', `/staff/${staffIds.teacher}/dependents`, token('accountant'), { dependents_count: 1 })).status,
      403,
    );
    const taxTables = await api('GET', '/tax-tables', token('chiefAccountant'));
    assert.equal(
      (taxTables.body as unknown as Array<{ personal_deduction: number }>)[0]?.personal_deduction,
      15_500_000,
    );
    assert.equal(
      (
        await api('POST', '/tax-tables', token('accountant'), {
          effective_from: '2027-01-01',
          personal_deduction: 1,
          dependent_deduction: 1,
          brackets: [{ rate_percent: 5 }],
        })
      ).status,
      403,
    );
  });

  it('CTC-P08-027: tháng trước chưa chốt công thì chặn và liệt kê đơn vị', async () => {
    const blocked = await api('POST', '/payrolls', token('accountant'), { month: currentMonth });
    assert.equal(blocked.status, 422);
    const details = (blocked.body.error as { details: Array<{ message: string }> }).details;
    assert.match(details[0]?.message ?? '', /ĐT-A1 chưa chốt công/);
  });

  it('CTC-P08-028 đến 033, CTC-P08-057: tính bảng lương; trả trước, điều chỉnh tháng trước, nhân sự mới, thiếu hợp đồng', async () => {
    const closed = await api('POST', '/attendance-logs/lock', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      month: previousMonth,
    });
    assert.equal(closed.status, 201, JSON.stringify(closed.body));
    assert.equal((await api('POST', '/payrolls', token('chiefAccountant'), { month: currentMonth })).status, 403);
    const calculated = await api('POST', '/payrolls', token('accountant'), { month: currentMonth });
    assert.equal(calculated.status, 201, JSON.stringify(calculated.body));
    assert.equal(calculated.body.status, 'draft');
    payrollId = calculated.body.id as string;
    const payslips = calculated.body.payslips as Array<{
      staff_id: string;
      prepaid_amount: number;
      adjustment_amount: number;
      net_amount: number;
      lines: Array<{ code: string; amount: number; basis: string }>;
    }>;
    const teacher = payslips.find((row) => row.staff_id === staffIds.teacher);
    assert.equal(teacher?.prepaid_amount, 12_000_000 + 500_000 + 300_000 - 1_260_000);
    const unpaid = Math.round(12_000_000 / standardDays);
    const overtime = Math.round((12_000_000 * 60 * 150) / (standardDays * 510 * 100));
    const lunch = 30_000 * (standardDays - 1);
    assert.equal(teacher?.lines.find((line) => line.code === 'NGAY_KHONG_LUONG')?.amount, -unpaid);
    assert.equal(teacher?.lines.find((line) => line.code === 'LAM_THEM')?.amount, overtime);
    assert.equal(teacher?.lines.find((line) => line.code === 'AN_TRUA')?.amount, lunch);
    assert.equal(teacher?.adjustment_amount, -unpaid + overtime + lunch);
    assert.ok(teacher?.lines.every((line) => line.basis.length > 0));
    const newcomer = payslips.find((row) => row.staff_id === staffIds.newcomer);
    assert.equal(newcomer?.prepaid_amount, 12_000_000);
    const newcomerDays = previousWeekdays.filter((date) => date >= newStaffStart).length;
    assert.equal(
      newcomer?.lines.find((line) => line.code === 'LUONG_THANG_DAU')?.amount,
      Math.round((12_000_000 * newcomerDays) / standardDays),
    );
    assert.equal(
      payslips.some((row) => row.staff_id === staffIds.noContract),
      false,
    );
    const skipped = calculated.body.skipped as Array<{ staff_id: string; reason: string }>;
    assert.match(skipped.find((row) => row.staff_id === staffIds.noContract)?.reason ?? '', /hợp đồng/);
    assert.equal(
      calculated.body.total_net,
      payslips.reduce((sum, row) => sum + row.net_amount, 0),
    );
  });

  it('CTC-P08-045 đến 048: giáo viên, quản lý đơn vị, thủ quỹ không xem được; nhân sự, kế toán trưởng, kiểm toán viên xem được', async () => {
    for (const name of ['teacher', 'manager', 'cashier']) {
      assert.equal((await api('GET', `/payrolls/${payrollId}`, token(name))).status, 403, name);
    }
    for (const name of ['personnel', 'chiefAccountant', 'auditor']) {
      const viewed = await api('GET', `/payrolls/${payrollId}`, token(name));
      assert.equal(viewed.status, 200, name);
      assert.equal(viewed.body.can_manage, false);
    }
    assert.equal((await api('POST', '/payrolls', token('auditor'), { month: currentMonth })).status, 403);
    const mine = await api('GET', '/me/payslips', token('teacher'));
    assert.deepEqual(mine.body, []);
  });

  it('CTC-P08-035 đến 037: chưa có hạn mức thì chỉ Hiệu trưởng duyệt; kế toán trưởng, quản lý đơn vị bị từ chối; trả lại về nháp', async () => {
    const submitted = await api('POST', `/payrolls/${payrollId}/submit`, token('accountant'));
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal(submitted.body.requires_principal, true);
    for (const name of ['chiefAccountant', 'manager', 'vicePrincipal']) {
      assert.equal((await api('POST', `/payrolls/${payrollId}/approve`, token(name))).status, 403, name);
    }
    const returned = await api('POST', `/payrolls/${payrollId}/return`, principal.accessToken, {
      reason: 'Kiểm tra lại phụ cấp',
    });
    assert.equal(returned.body.status, 'draft');
    assert.equal(returned.body.return_reason, 'Kiểm tra lại phụ cấp');
  });

  it('CTC-P08-034, CTC-P08-038, CTC-P08-044: dưới hạn mức Phó Hiệu trưởng Trường chính duyệt; đã duyệt không tính lại; phiếu lương hiện', async () => {
    const saved = await api('PUT', '/approval-thresholds', principal.accessToken, {
      org_unit_id: units.TC,
      document_type: 'payroll',
      threshold_amount: 500_000_000,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const submitted = await api('POST', `/payrolls/${payrollId}/submit`, token('accountant'));
    assert.equal(submitted.body.requires_principal, false);
    assert.equal((await api('POST', `/payrolls/${payrollId}/approve`, token('unitVicePrincipal'))).status, 403);
    const approved = await api('POST', `/payrolls/${payrollId}/approve`, token('vicePrincipal'));
    assert.equal(approved.status, 201, JSON.stringify(approved.body));
    assert.equal(approved.body.status, 'approved');
    const recalculated = await api('POST', '/payrolls', token('accountant'), { month: currentMonth });
    assert.equal(recalculated.status, 422);
    assert.match((recalculated.body.error as { message: string }).message, /kỳ sau/);
    const mine = await api('GET', '/me/payslips', token('teacher'));
    const slips = mine.body as unknown as Array<{ staff_id: string; lines: Array<{ section: string }> }>;
    assert.equal(slips.length, 1);
    assert.equal(slips[0]?.staff_id, staffIds.teacher);
    assert.ok(slips[0]?.lines.some((line) => line.section === 'prepaid'));
    assert.ok(slips[0]?.lines.some((line) => line.section === 'adjustment'));
    const notified = await schoolYear
      .selectFrom('notification_recipients')
      .innerJoin('notifications', 'notifications.id', 'notification_recipients.notification_id')
      .select('notification_recipients.user_id')
      .where('notifications.template_code', '=', 'payslip_published')
      .execute();
    assert.ok(notified.some((row) => row.user_id === users.teacher?.userId));
  });
});
