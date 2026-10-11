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
import { calculatePayslip } from './payroll-calculation.js';

// Phiếu chi lương, bảng quyết toán khi nghỉ việc, phiếu thu thu hồi lương, khoản điều chỉnh kỳ sau (DT-06 phần 6c-2,
// YCTD-61); ca kiểm thử CTC-P08-039, CTC-P08-040, CTC-P08-042, CTC-P06-034 và quy tắc BR-45, BR-90
const vietnamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
};
const weekdaysOf = (month: string) => {
  const days = [];
  for (let date = `${month}-01`; date.slice(0, 7) === month; date = addDays(date, 1)) {
    if (weekdayOf(date) <= 5) {
      days.push(date);
    }
  }
  return days;
};
const currentMonth = vietnamToday.slice(0, 7);
const previousMonth = new Date(Date.parse(`${currentMonth}-01T00:00:00Z`) - 86_400_000).toISOString().slice(0, 7);
const nextMonth = new Date(Date.parse(`${currentMonth}-01T00:00:00Z`) + 32 * 86_400_000).toISOString().slice(0, 7);
const currentWeekdays = weekdaysOf(currentMonth);
const terminatedOn = currentWeekdays[2] ?? '';
const TAX_TABLE = {
  personal_deduction: 15_500_000,
  dependent_deduction: 6_200_000,
  brackets: [{ up_to: null, rate_percent: 5 }],
};

describe('BR-45: khoản điều chỉnh đã duyệt cộng vào bảng lương và được tính thuế', () => {
  it('khoản điều chỉnh âm, dương nằm ở phần điều chỉnh kèm lý do', () => {
    const result = calculatePayslip({
      prepaid: { contractNo: 'HD', baseSalary: 20_000_000, contractAllowances: [] },
      adjustment: null,
      items: [],
      manualAdjustments: [
        { amount: 1_000_000, reason: 'Bổ sung phụ cấp tháng trước' },
        { amount: -200_000, reason: 'Thu lại tiền thưởng tính trùng' },
      ],
      dependents: 0,
      taxTable: TAX_TABLE,
    });
    assert.equal(result.adjustment_amount, 800_000);
    // Thu nhập tính thuế 20 800 000 − 15 500 000 = 5 300 000, thuế 5% = 265 000
    assert.equal(result.tax_amount, 265_000);
    assert.match(result.lines.find((line) => line.amount === -200_000)?.name ?? '', /tính trùng/);
  });
});

describe('Phiếu chi lương, quyết toán, thu hồi lương, điều chỉnh kỳ sau', () => {
  let environment: ApiTestEnvironment;
  let principal: LoggedInUser;
  let schoolYear: Kysely<SchoolYearDatabase>;
  const units: Record<string, string> = {};
  const users: Record<string, LoggedInUser> = {};
  let staffId = '';
  let contractId = '';
  let payrollId = '';
  let settlementId = '';
  let fullMonthContractId = '';
  const ids: Record<string, string> = {};

  const token = (name: string) => users[name]?.accessToken ?? '';
  const api = (method: string, path: string, accessToken: string, body?: unknown) =>
    sendJson(method, `${environment.baseUrl}${path}`, accessToken, body);

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
    users.accountant = await environment.loginAs('VT-04', units.TC ?? null);
    users.personnel = await environment.loginAs('VT-06', units['ĐT-A1'] ?? null);
    users.vicePrincipal = await environment.loginAs('VT-15', units.TC ?? null);
    const staff = await api('POST', '/staff', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      code: `NV-${randomInt(100_000, 999_999)}`,
      full_name: 'Phan Thị Nghỉ',
      start_date: addDays(`${previousMonth}-01`, -400),
    });
    staffId = staff.body.id as string;
    const contract = await api('POST', `/staff/${staffId}/contracts`, token('personnel'), {
      contract_no: `HDLD-${randomInt(100_000, 999_999)}`,
      contract_type: 'indefinite',
      start_date: addDays(`${previousMonth}-01`, -400),
      base_salary: 12_000_000,
    });
    contractId = contract.body.id as string;
    await api('PUT', '/settings', principal.accessToken, {
      org_unit_id: units['ĐT-A1'],
      values: { work_start_time: '07:30', work_end_time: '17:00', lunch_break_minutes: 60, overtime_rate_percent: 150 },
    });
    const logs = [...weekdaysOf(previousMonth), ...currentWeekdays.filter((date) => date <= terminatedOn)].map(
      (date) => ({
        staff_id: staffId,
        work_date: date,
        check_in: '07:30',
        check_out: '17:00',
        source: 'manual' as const,
      }),
    );
    await schoolYear.insertInto('attendance_logs').values(logs).execute();
    // Nhân sự nghỉ việc ngày cuối tháng, làm thêm 4 ngày mỗi ngày 1 giờ trong tháng (CTC-P08-041)
    const fullMonthStaff = await api('POST', '/staff', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      code: `NV-${randomInt(100_000, 999_999)}`,
      full_name: 'Lê Văn Đủ',
      start_date: addDays(`${previousMonth}-01`, -400),
    });
    fullMonthContractId = (
      await api('POST', `/staff/${fullMonthStaff.body.id}/contracts`, token('personnel'), {
        contract_no: `HDLD-${randomInt(100_000, 999_999)}`,
        contract_type: 'indefinite',
        start_date: addDays(`${previousMonth}-01`, -400),
        base_salary: 12_000_000,
      })
    ).body.id as string;
    await schoolYear
      .insertInto('attendance_logs')
      .values(
        [...weekdaysOf(previousMonth), ...currentWeekdays].map((date) => ({
          staff_id: fullMonthStaff.body.id as string,
          work_date: date,
          check_in: '07:30',
          check_out: currentWeekdays.slice(0, 4).includes(date) ? '18:00' : '17:00',
          source: 'manual' as const,
        })),
      )
      .execute();
    for (const [code, flowType] of [
      ['CHI_LUONG', 'expense'],
      ['THU_HOI_LUONG', 'income'],
    ] as const) {
      ids[code] = (
        await api('POST', '/cashflow-categories', token('accountant'), {
          code,
          name: code,
          group_name: 'Tiền lương',
          flow_type: flowType,
        })
      ).body.id as string;
    }
    const account = await api('POST', '/cash-accounts', token('accountant'), {
      org_unit_id: units.TC,
      account_type: 'cash',
      name: 'Quỹ Trường chính',
      opening_balance: 0,
    });
    assert.equal(account.status, 201, JSON.stringify(account.body));
    ids.account = account.body.id as string;
    const closed = await api('POST', '/attendance-logs/lock', token('personnel'), {
      org_unit_id: units['ĐT-A1'],
      month: previousMonth,
    });
    assert.equal(closed.status, 201, JSON.stringify(closed.body));
  });

  after(async () => {
    await schoolYear.destroy();
    await environment.close();
  });

  it('CTC-P08-039, CTC-P06-034: bảng lương đã duyệt lập phiếu chi lương nháp đúng tổng thực nhận; không lập hai lần', async () => {
    const calculated = await api('POST', '/payrolls', token('accountant'), { month: currentMonth });
    assert.equal(calculated.status, 201, JSON.stringify(calculated.body));
    payrollId = calculated.body.id as string;
    const source = { account_id: ids.account, category_id: ids.CHI_LUONG };
    assert.equal(
      (
        await api('POST', `/payrolls/${payrollId}/payment`, token('accountant'), {
          ...source,
          request_key: randomUUID(),
        })
      ).status,
      422,
    );
    await api('POST', `/payrolls/${payrollId}/submit`, token('accountant'));
    await api('POST', `/payrolls/${payrollId}/approve`, principal.accessToken);
    const payment = await api('POST', `/payrolls/${payrollId}/payment`, token('accountant'), {
      ...source,
      request_key: randomUUID(),
    });
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    assert.equal(payment.body.payment_type, 'payroll');
    assert.equal(payment.body.status, 'draft');
    assert.equal(payment.body.amount, calculated.body.total_net);
    const again = await api('POST', `/payrolls/${payrollId}/payment`, token('accountant'), {
      ...source,
      request_key: randomUUID(),
    });
    assert.equal(again.status, 422);
    const payroll = await api('GET', `/payrolls/${payrollId}`, token('accountant'));
    assert.equal((payroll.body.payments as unknown[]).length, 1);
  });

  it('BR-45: khoản điều chỉnh cho tháng đã duyệt bị chặn; tháng sau thì lập được, Hiệu trưởng duyệt', async () => {
    const blocked = await api('POST', '/payroll-adjustments', token('accountant'), {
      staff_id: staffId,
      month: currentMonth,
      amount: 300_000,
      reason: 'Bổ sung',
    });
    assert.equal(blocked.status, 422);
    const created = await api('POST', '/payroll-adjustments', token('accountant'), {
      staff_id: staffId,
      month: nextMonth,
      amount: 300_000,
      reason: 'Bổ sung phụ cấp tháng này',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.requires_principal, true);
    assert.equal(
      (await api('POST', `/payroll-adjustments/${created.body.id}/approve`, token('vicePrincipal'))).status,
      403,
    );
    const approved = await api('POST', `/payroll-adjustments/${created.body.id}/approve`, principal.accessToken);
    assert.equal(approved.body.status, 'approved');
    assert.equal(
      (
        await api('POST', '/payroll-adjustments', token('personnel'), {
          staff_id: staffId,
          month: nextMonth,
          amount: 1,
          reason: 'x',
        })
      ).status,
      403,
    );
  });

  it('CTC-P08-040: nghỉ việc giữa tháng thì lương được hưởng theo công, trừ phần đã trả trước thành khoản phải thu hồi', async () => {
    const terminated = await api('POST', `/employment-contracts/${contractId}/terminate`, token('personnel'), {
      terminated_on: terminatedOn,
      reason: 'Xin nghỉ việc',
    });
    assert.equal(terminated.status, 200, JSON.stringify(terminated.body));
    const settlement = await api('POST', '/payroll-settlements', token('accountant'), { contract_id: contractId });
    assert.equal(settlement.status, 201, JSON.stringify(settlement.body));
    settlementId = settlement.body.id as string;
    const workedDays = currentWeekdays.filter((date) => date <= terminatedOn).length;
    const earned = Math.round((12_000_000 * workedDays) / currentWeekdays.length);
    assert.equal(settlement.body.earned_amount, earned);
    assert.equal(settlement.body.prepaid_amount, 12_000_000);
    assert.equal(settlement.body.payable_amount, earned - 12_000_000);
    assert.equal(settlement.body.recovery_outstanding, 0);
    assert.match(
      (settlement.body.lines as Array<{ basis: string }>)[0]?.basis ?? '',
      new RegExp(`${workedDays} / ${currentWeekdays.length}`),
    );
    const list = await api('GET', '/payroll-settlements', token('accountant'));
    assert.ok(
      (list.body as unknown as Array<{ settlement_id: string }>).some((row) => row.settlement_id === settlementId),
    );
  });

  it('CTC-P08-041: nghỉ việc ngày cuối tháng đã nhận trả trước thì không có khoản thu hồi, quyết toán trả thêm tiền làm thêm giờ', async () => {
    const lastDay = currentWeekdays[currentWeekdays.length - 1] ?? '';
    const terminated = await api('POST', `/employment-contracts/${fullMonthContractId}/terminate`, token('personnel'), {
      terminated_on: lastDay,
      reason: 'Hết thời gian công tác',
    });
    assert.equal(terminated.status, 200, JSON.stringify(terminated.body));
    const settlement = await api('POST', '/payroll-settlements', token('accountant'), {
      contract_id: fullMonthContractId,
    });
    assert.equal(settlement.status, 201, JSON.stringify(settlement.body));
    const lines = settlement.body.lines as Array<{ code: string; amount: number }>;
    const overtime = Math.round((12_000_000 * 240 * 150) / (currentWeekdays.length * 510 * 100));
    assert.equal(lines.find((line) => line.code === 'LUONG_THANG_NGHI')?.amount, 12_000_000);
    assert.equal(lines.find((line) => line.code === 'LAM_THEM')?.amount, overtime);
    assert.equal(settlement.body.prepaid_amount, 12_000_000);
    assert.ok(Number(settlement.body.payable_amount) > 0, JSON.stringify(settlement.body));
    assert.equal(settlement.body.recovery_outstanding, 0);
  });

  it('BR-90: trình duyệt; chưa có hạn mức thì Phó Hiệu trưởng không duyệt được, Hiệu trưởng duyệt; không lập phiếu chi khi phải thu hồi', async () => {
    await api('POST', `/payroll-settlements/${settlementId}/submit`, token('accountant'));
    assert.equal(
      (await api('POST', `/payroll-settlements/${settlementId}/approve`, token('vicePrincipal'))).status,
      403,
    );
    const approved = await api('POST', `/payroll-settlements/${settlementId}/approve`, principal.accessToken);
    assert.equal(approved.body.status, 'approved');
    assert.ok((approved.body.recovery_outstanding as number) > 0);
    const payment = await api('POST', `/payroll-settlements/${settlementId}/payment`, token('accountant'), {
      account_id: ids.account,
      category_id: ids.CHI_LUONG,
      request_key: randomUUID(),
    });
    assert.equal(payment.status, 422);
    assert.equal(
      (await api('POST', '/payroll-settlements', token('accountant'), { contract_id: contractId })).status,
      422,
    );
  });

  it('CTC-P08-042: phiếu thu thu hồi lương không gắn trẻ, không vượt khoản còn phải thu hồi; quỹ tăng tiền', async () => {
    const detail = await api('GET', `/payroll-settlements/${settlementId}`, token('accountant'));
    const outstanding = detail.body.recovery_outstanding as number;
    const receipt = (amount: number) =>
      api('POST', `/payroll-settlements/${settlementId}/recovery-receipts`, token('accountant'), {
        amount,
        method: 'cash',
        account_id: ids.account,
        category_id: ids.THU_HOI_LUONG,
        receipt_date: vietnamToday,
        request_key: randomUUID(),
      });
    assert.equal((await receipt(outstanding + 1)).status, 422);
    const partial = await receipt(1_000_000);
    assert.equal(partial.status, 201, JSON.stringify(partial.body));
    assert.equal(partial.body.recovery_outstanding, outstanding - 1_000_000);
    const rest = await receipt(outstanding - 1_000_000);
    assert.equal(rest.body.recovery_outstanding, 0);
    const rows = await schoolYear
      .selectFrom('receipts')
      .select(['child_id', 'staff_id', 'code'])
      .where('settlement_id', '=', settlementId)
      .execute();
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.child_id === null && row.staff_id === staffId && row.code.startsWith('PT-')));
    const account = await schoolYear
      .selectFrom('cash_accounts')
      .select('current_balance')
      .where('id', '=', ids.account ?? '')
      .executeTakeFirstOrThrow();
    assert.equal(Number(account.current_balance), outstanding);
  });
});
