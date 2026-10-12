import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';

// Khóa số liệu của kỳ tài chính đã chốt (P06-09; BR-25, BR-29, BR-77; YCTD-82): kỳ là tháng dương lịch của một đơn vị;
// khi Hiệu trưởng đã duyệt chốt thì không lập phiếu thu, phiếu chi có ngày thuộc kỳ, không đảo phiếu của kỳ, không tính lại,
// phát hành, miễn giảm, điều chỉnh hóa đơn của kỳ. Kỳ đang chờ duyệt chốt chưa bị khóa
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const PERIOD_LOCK_RULE = 'P06-09';

export async function isPeriodClosed(
  executor: Executor,
  orgUnitId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const row = await executor
    .selectFrom('fiscal_periods')
    .select('status')
    .where('org_unit_id', '=', orgUnitId)
    .where('period_year', '=', year)
    .where('period_month', '=', month)
    .executeTakeFirst();
  return row?.status === 'closed';
}

// Chặn thao tác ghi vào kỳ đã chốt; action mô tả việc bị chặn, ví dụ "lập phiếu thu"
export async function assertPeriodOpen(
  executor: Executor,
  orgUnitId: string,
  period: { year: number; month: number },
  action: string,
): Promise<void> {
  if (await isPeriodClosed(executor, orgUnitId, period.year, period.month)) {
    const label = `${String(period.month).padStart(2, '0')}/${period.year}`;
    throw ruleViolationError(PERIOD_LOCK_RULE, `Kỳ tài chính ${label} đã chốt, không ${action}`);
  }
}

// Ngày dạng YYYY-MM-DD thuộc kỳ nào thì kiểm tra kỳ đó
export async function assertDateOpen(
  executor: Executor,
  orgUnitId: string,
  date: string,
  action: string,
): Promise<void> {
  await assertPeriodOpen(
    executor,
    orgUnitId,
    { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) },
    action,
  );
}
