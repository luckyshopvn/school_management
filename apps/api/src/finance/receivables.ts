import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';
import { ACTIVE_RECEIPT_STATUSES } from '../fees/invoice-amounts.js';

// Hàm dùng chung cho phiếu thu và công nợ phải thu (P05-09, P06-01, P06-02; BR-32; GD-27; YCTD-53)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export async function guardianUserIds(executor: Executor, childId: string): Promise<string[]> {
  const rows = await executor
    .selectFrom('child_guardians')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .select('guardians.user_id')
    .where('child_guardians.child_id', '=', childId)
    .where('guardians.user_id', 'is not', null)
    .execute();
  return [...new Set(rows.map((row) => row.user_id).filter((id): id is string => id !== null))];
}

export async function isGuardianOf(executor: Executor, childId: string, userId: string): Promise<boolean> {
  return (await guardianUserIds(executor, childId)).includes(userId);
}

// Số chưa phân bổ của từng phiếu thu còn hiệu lực; tổng là số dư có của trẻ chuyển sang kỳ sau (QT-04 E4, GD-27)
export async function unallocatedReceipts(
  executor: Executor,
  childIds: string[],
): Promise<Array<{ id: string; child_id: string; remaining: number }>> {
  if (childIds.length === 0) {
    return [];
  }
  const receipts = await executor
    .selectFrom('receipts')
    .select(['id', 'child_id', 'amount'])
    .where('child_id', 'in', childIds)
    .where('status', 'in', ACTIVE_RECEIPT_STATUSES)
    .orderBy('receipt_date')
    .orderBy('created_at')
    .execute();
  const ids = receipts.map((receipt) => receipt.id);
  const allocations = ids.length
    ? await executor
        .selectFrom('receipt_allocations')
        .select(['receipt_id', 'amount'])
        .where('receipt_id', 'in', ids)
        .execute()
    : [];
  // Tiền đã hoàn bằng phiếu chi hoàn tiền thôi học đã phát hành không còn là số dư có (YCTD-55)
  const refunds = ids.length
    ? await executor
        .selectFrom('payment_refund_sources')
        .innerJoin('payments', 'payments.id', 'payment_refund_sources.payment_id')
        .select(['payment_refund_sources.receipt_id', 'payment_refund_sources.amount'])
        .where('payment_refund_sources.receipt_id', 'in', ids)
        .where('payments.status', 'in', ['issued', 'pending_reversal'])
        .execute()
    : [];
  return receipts
    .map((receipt) => ({
      id: receipt.id,
      child_id: receipt.child_id,
      remaining:
        Number(receipt.amount) -
        allocations
          .filter((allocation) => allocation.receipt_id === receipt.id)
          .reduce((sum, allocation) => sum + Number(allocation.amount), 0) -
        refunds
          .filter((refund) => refund.receipt_id === receipt.id)
          .reduce((sum, refund) => sum + Number(refund.amount), 0),
    }))
    .filter((receipt) => receipt.remaining > 0);
}

// Số ngày quá hạn tính từ ngày sau ngày đến hạn (BR-33)
export function overdueDays(dueDate: string | null, today: string): number {
  if (!dueDate || dueDate >= today) {
    return 0;
  }
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000);
}
