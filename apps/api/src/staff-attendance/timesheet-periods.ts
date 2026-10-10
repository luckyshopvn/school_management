import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import type { StaffDay } from '../attendance/school-calendar.js';

// Kỳ công đã chốt của đơn vị chặn sửa chấm công và đơn nghỉ của tháng đó cho tới khi được mở lại (AC-41, Q-135, YCTD-59)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export function monthsBetween(from: string, to: string): Array<{ year: number; month: number }> {
  const result = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const lastYear = Number(to.slice(0, 4));
  const lastMonth = Number(to.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    result.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

export async function closedMonths(executor: Executor, orgUnitId: string, from: string, to: string) {
  const months = monthsBetween(from, to);
  const rows = await executor
    .selectFrom('timesheet_periods')
    .select(['period_year', 'period_month'])
    .where('org_unit_id', '=', orgUnitId)
    .where('status', '=', 'closed')
    .execute();
  return months.filter((item) => rows.some((row) => row.period_year === item.year && row.period_month === item.month));
}

export async function assertMonthsOpen(executor: Executor, orgUnitId: string, from: string, to: string) {
  const closed = await closedMonths(executor, orgUnitId, from, to);
  if (closed.length > 0) {
    throw ruleViolationError(
      'Q-135',
      `Kỳ công tháng ${closed.map((item) => `${item.month}/${item.year}`).join(', ')} đã chốt, cần đề nghị mở lại kỳ để sửa`,
    );
  }
}

// Phần ngày nghỉ của đơn trên từng ngày làm việc: ngày đầu hoặc ngày cuối nghỉ nửa ngày thì tính 0,5
export function leavePortions(
  days: Map<string, StaffDay>,
  request: { from_date: string; to_date: string; first_day_half: string | null; last_day_half: string | null },
): Map<string, number> {
  const portions = new Map<string, number>();
  for (const [date, day] of days) {
    if (day.kind !== 'work' || date < request.from_date || date > request.to_date) {
      continue;
    }
    let portion = 1;
    if (date === request.from_date && request.first_day_half) {
      portion = 0.5;
    }
    if (date === request.to_date && request.last_day_half) {
      portion = 0.5;
    }
    portions.set(date, portion);
  }
  return portions;
}
