import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import type { Kysely } from 'kysely';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { invoiceAmounts } from '../fees/invoice-amounts.js';
import { assertDateOpen } from './fiscal-period-lock.js';

// Đối soát tự động dòng sao kê với giao dịch tài khoản do phiếu thu, phiếu chi, phiếu đảo ghi (G3-05; P06-06; BR-34;
// YCTD-89). Ghép dòng chưa khớp với giao dịch chưa khớp cùng tài khoản, cùng số tiền, ngày lệch không quá số ngày cấu hình
// `bank_match_days` (mặc định 3). Ưu tiên giao dịch có mã chứng từ (số phiếu, mã hóa đơn đã phân bổ, viết liền không gạch
// như nội dung chuyển khoản) nằm trong diễn giải hoặc số tham chiếu của dòng; sau đó ngày gần nhất. Dòng tiền vào chưa
// khớp có mã hóa đơn đã phát hành còn nợ mà số tiền đủ trả hết thì đề xuất lập phiếu thu; kế toán xác nhận mới lập
export const DEFAULT_MATCH_DAYS = 3;

const DAY = 86_400_000;
const dayDistance = (left: string, right: string) =>
  Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / DAY;
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// Viết hoa, bỏ mọi ký tự không phải chữ hoặc số: "PT-000012" và "pt 000012" cùng thành "PT000012"
export const compactCode = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

// Các mã hóa đơn trong diễn giải, dạng HD-000123, HD000123 hoặc HD 000123
export function invoiceCodesIn(text: string): string[] {
  const codes = new Set<string>();
  for (const match of text.toUpperCase().matchAll(/HD[\s-]*(\d{6})(?!\d)/g)) {
    codes.add(`HD-${match[1]}`);
  }
  return [...codes];
}

interface StatementLine {
  id: string;
  org_unit_id: string;
  transaction_date: string;
  amount: string | number;
  description: string;
  bank_reference: string | null;
}

// Mã chứng từ của từng giao dịch tài khoản: số phiếu thu, phiếu chi, phiếu đảo; phiếu thu thêm mã các hóa đơn đã phân bổ
async function documentCodes(
  database: Kysely<SchoolYearDatabase>,
  entries: Array<{ id: string; reference_type: string; reference_id: string }>,
): Promise<Map<string, string[]>> {
  const idsOf = (type: string) => entries.filter((entry) => entry.reference_type === type).map((e) => e.reference_id);
  const codes = new Map<string, string[]>();
  const add = (referenceId: string, code: string | null) => {
    if (code) {
      codes.set(referenceId, [...(codes.get(referenceId) ?? []), compactCode(code)]);
    }
  };
  const receiptIds = idsOf('receipts');
  if (receiptIds.length > 0) {
    for (const row of await database
      .selectFrom('receipts')
      .select(['id', 'code'])
      .where('id', 'in', receiptIds)
      .execute()) {
      add(row.id, row.code);
    }
    for (const row of await database
      .selectFrom('receipt_allocations')
      .innerJoin('invoices', 'invoices.id', 'receipt_allocations.invoice_id')
      .select(['receipt_allocations.receipt_id', 'invoices.code'])
      .where('receipt_allocations.receipt_id', 'in', receiptIds)
      .execute()) {
      add(row.receipt_id, row.code);
    }
  }
  for (const table of ['payments', 'receipt_reversals', 'payment_reversals'] as const) {
    const ids = idsOf(table);
    if (ids.length > 0) {
      for (const row of await database.selectFrom(table).select(['id', 'code']).where('id', 'in', ids).execute()) {
        add(row.id, row.code);
      }
    }
  }
  return new Map(entries.map((entry) => [entry.id, codes.get(entry.reference_id) ?? []]));
}

// Khớp tự động các dòng được chọn; trả số dòng đã khớp. Dòng thuộc kỳ tài chính đã chốt bỏ qua
export async function autoMatchLines(
  database: Kysely<SchoolYearDatabase>,
  accountId: string,
  lines: StatementLine[],
  days: number,
  origin: ChangeOrigin,
  now: Date,
): Promise<number> {
  if (lines.length === 0) {
    return 0;
  }
  const dates = lines.map((line) => line.transaction_date).sort();
  const entries = await database
    .selectFrom('account_transactions')
    .leftJoin('bank_statement_lines', 'bank_statement_lines.matched_transaction_id', 'account_transactions.id')
    .select([
      'account_transactions.id',
      'account_transactions.transaction_date',
      'account_transactions.amount',
      'account_transactions.reference_type',
      'account_transactions.reference_id',
      'account_transactions.created_at',
    ])
    .where('account_transactions.account_id', '=', accountId)
    .where('bank_statement_lines.id', 'is', null)
    .where('account_transactions.transaction_date', '>=', shift(dates[0] ?? '', -days))
    .where('account_transactions.transaction_date', '<=', shift(dates[dates.length - 1] ?? '', days))
    .execute();
  const codes = await documentCodes(database, entries);
  const pairs: Array<{ line: StatementLine; entryId: string; byCode: boolean; distance: number; order: number }> = [];
  for (const line of lines) {
    const text = compactCode(`${line.description} ${line.bank_reference ?? ''}`);
    entries.forEach((entry, order) => {
      const distance = dayDistance(entry.transaction_date, line.transaction_date);
      if (Number(entry.amount) !== Number(line.amount) || distance > days) {
        return;
      }
      const byCode = (codes.get(entry.id) ?? []).some((code) => code.length > 0 && text.includes(code));
      pairs.push({ line, entryId: entry.id, byCode, distance, order });
    });
  }
  // Có mã chứng từ trước, ngày gần trước, rồi theo ngày của dòng và thứ tự ghi của giao dịch
  pairs.sort(
    (left, right) =>
      Number(right.byCode) - Number(left.byCode) ||
      left.distance - right.distance ||
      left.line.transaction_date.localeCompare(right.line.transaction_date) ||
      left.order - right.order,
  );
  const usedLines = new Set<string>();
  const usedEntries = new Set<string>();
  let matched = 0;
  for (const pair of pairs) {
    if (usedLines.has(pair.line.id) || usedEntries.has(pair.entryId)) {
      continue;
    }
    try {
      await assertDateOpen(
        database,
        pair.line.org_unit_id,
        pair.line.transaction_date,
        'đối chiếu giao dịch ngân hàng',
      );
    } catch (error) {
      if (error instanceof ApplicationError) {
        usedLines.add(pair.line.id);
        continue;
      }
      throw error;
    }
    const updated = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('bank_statement_lines')
        .set({
          status: 'matched',
          matched_transaction_id: pair.entryId,
          matched_by: origin.actorUserId,
          matched_at: now,
          suggested_invoice_id: null,
        })
        .where('id', '=', pair.line.id)
        .where('status', '=', 'unmatched')
        .returning('id')
        .executeTakeFirst();
      if (row) {
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: pair.line.org_unit_id,
          entityName: 'bank_statement_lines',
          entityId: pair.line.id,
          action: 'update',
          before: { status: 'unmatched' },
          after: { status: 'matched', matched_transaction_id: pair.entryId, automatic: true, by_code: pair.byCode },
        });
      }
      return Boolean(row);
    });
    usedLines.add(pair.line.id);
    if (updated) {
      usedEntries.add(pair.entryId);
      matched += 1;
    }
  }
  return matched;
}

// Tính lại đề xuất lập phiếu thu cho các dòng tiền vào còn chưa khớp; trả số dòng có đề xuất
export async function refreshSuggestions(database: Kysely<SchoolYearDatabase>, lineIds: string[]): Promise<number> {
  if (lineIds.length === 0) {
    return 0;
  }
  const lines = await database
    .selectFrom('bank_statement_lines')
    .select(['id', 'amount', 'description', 'bank_reference', 'status', 'suggested_invoice_id'])
    .where('id', 'in', lineIds)
    .execute();
  let suggested = 0;
  for (const line of lines) {
    let invoiceId: string | null = null;
    if (line.status === 'unmatched' && Number(line.amount) > 0) {
      const codes = invoiceCodesIn(`${line.description} ${line.bank_reference ?? ''}`);
      const invoices =
        codes.length > 0
          ? await database
              .selectFrom('invoices')
              .select(['id', 'code', 'total_amount'])
              .where('code', 'in', codes)
              .where('status', '=', 'issued')
              .execute()
          : [];
      const amounts = await invoiceAmounts(database, invoices);
      // Đủ trả hết số còn nợ (không nhận thanh toán một phần, BR-31); phần dư thành số dư có của trẻ
      const chosen = invoices.find((invoice) => {
        const outstanding = amounts.get(invoice.id)?.outstanding_amount ?? 0;
        return outstanding > 0 && Number(line.amount) >= outstanding;
      });
      invoiceId = chosen?.id ?? null;
    }
    if (invoiceId !== line.suggested_invoice_id) {
      await database
        .updateTable('bank_statement_lines')
        .set({ suggested_invoice_id: invoiceId })
        .where('id', '=', line.id)
        .execute();
    }
    if (invoiceId) {
      suggested += 1;
    }
  }
  return suggested;
}
