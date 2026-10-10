import type { DiscountCalculationMethod, SchoolYearDatabase } from '@school-management/database';
import type { Kysely, Transaction } from 'kysely';
import { TUITION_TARGET } from './discount-types.js';

// Số tiền của hóa đơn dùng chung cho học phí, miễn giảm, điều chỉnh, công nợ (BR-21, BR-22, BR-32; YCTD-52):
// số phải nộp = tổng hóa đơn − miễn giảm đã duyệt + điều chỉnh đã duyệt; còn phải nộp = số phải nộp − số đã phân bổ từ phiếu thu
// chưa bị đảo (YCTD-53)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface InvoiceAmounts {
  discount_amount: number;
  adjustment_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
}

// Phiếu thu đang chờ duyệt đảo vẫn giữ nguyên công nợ cho tới khi Ban Giám hiệu duyệt (AC-212)
export const ACTIVE_RECEIPT_STATUSES = ['issued', 'pending_reversal'] as const;

// Cơ sở tính miễn giảm là tổng các dòng thuộc khoản áp dụng của loại miễn giảm
export function discountBase(
  items: Array<{ item_type: string; service_id: string | null; amount: string | number }>,
  appliesTo: string[],
): number {
  return items
    .filter((item) =>
      item.item_type === 'tuition' ? appliesTo.includes(TUITION_TARGET) : appliesTo.includes(item.service_id ?? ''),
    )
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

// Phần trăm làm tròn đến đồng; số tiền cố định giữ nguyên (YCTD-51)
export function discountApplied(method: DiscountCalculationMethod, value: number, base: number): number {
  return method === 'percent' ? Math.round((base * value) / 100) : value;
}

export async function invoiceAmounts(
  executor: Executor,
  invoices: Array<{ id: string; total_amount: string | number }>,
): Promise<Map<string, InvoiceAmounts>> {
  const ids = invoices.map((invoice) => invoice.id);
  const discounts = ids.length
    ? await executor
        .selectFrom('discounts')
        .select(['invoice_id', 'applied_amount'])
        .where('invoice_id', 'in', ids)
        .where('status', '=', 'approved')
        .execute()
    : [];
  const adjustments = ids.length
    ? await executor
        .selectFrom('invoice_adjustments')
        .select(['invoice_id', 'amount'])
        .where('invoice_id', 'in', ids)
        .where('status', '=', 'approved')
        .execute()
    : [];
  const allocations = ids.length
    ? await executor
        .selectFrom('receipt_allocations')
        .innerJoin('receipts', 'receipts.id', 'receipt_allocations.receipt_id')
        .select(['receipt_allocations.invoice_id', 'receipt_allocations.amount'])
        .where('receipt_allocations.invoice_id', 'in', ids)
        .where('receipts.status', 'in', ACTIVE_RECEIPT_STATUSES)
        .execute()
    : [];
  return new Map(
    invoices.map((invoice) => {
      const discount = discounts
        .filter((row) => row.invoice_id === invoice.id)
        .reduce((sum, row) => sum + Number(row.applied_amount), 0);
      const adjustment = adjustments
        .filter((row) => row.invoice_id === invoice.id)
        .reduce((sum, row) => sum + Number(row.amount), 0);
      const paid = allocations
        .filter((row) => row.invoice_id === invoice.id)
        .reduce((sum, row) => sum + Number(row.amount), 0);
      const payable = Number(invoice.total_amount) - discount + adjustment;
      return [
        invoice.id,
        {
          discount_amount: discount,
          adjustment_amount: adjustment,
          payable_amount: payable,
          paid_amount: paid,
          outstanding_amount: payable - paid,
        },
      ];
    }),
  );
}

// Chạy lại tính học phí: miễn giảm chờ duyệt tính lại theo dòng mới; miễn giảm đã duyệt giữ nguyên số tiền (YCTD-52)
export async function recalculatePendingDiscounts(transaction: Transaction<SchoolYearDatabase>, invoiceId: string) {
  const pending = await transaction
    .selectFrom('discounts')
    .innerJoin('discount_types', 'discount_types.id', 'discounts.discount_type_id')
    .select(['discounts.id', 'discounts.calculation_method', 'discounts.rate_value', 'discount_types.applies_to'])
    .where('discounts.invoice_id', '=', invoiceId)
    .where('discounts.status', '=', 'pending')
    .execute();
  if (pending.length === 0) {
    return;
  }
  const items = await transaction
    .selectFrom('invoice_items')
    .select(['item_type', 'service_id', 'amount'])
    .where('invoice_id', '=', invoiceId)
    .execute();
  for (const discount of pending) {
    const base = discountBase(items, discount.applies_to);
    const applied = discountApplied(discount.calculation_method, Number(discount.rate_value), base);
    // Không còn khoản áp dụng thì giữ số cũ để kế toán thấy và xử lý, tránh vi phạm ràng buộc số dương
    if (applied > 0) {
      await transaction
        .updateTable('discounts')
        .set({ base_amount: base, applied_amount: applied })
        .where('id', '=', discount.id)
        .execute();
    }
  }
}
