import type { SchoolYearDatabase } from '@school-management/database';
import type { FieldError } from '@school-management/server';
import { sql, type Kysely } from 'kysely';
import type { AcademicYearTransitionStep, TransitionViolation } from '../academic-years/academic-year-transition.js';
import { CARRIED_CHILD_STATUSES } from '../children/children-transition.js';
import { nextDocumentCode } from '../fees/document-codes.js';
import { invoiceAmounts } from '../fees/invoice-amounts.js';
import { unallocatedReceipts } from './receivables.js';

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

// Số còn phải nộp trên các hóa đơn đã phát hành và số dư có của từng trẻ trong năm học, tính như công nợ của trẻ
async function childBalances(database: Kysely<SchoolYearDatabase>, childIds: string[]) {
  const balances = new Map<string, { outstanding: number; credit: number; receiptIds: string[] }>();
  if (childIds.length === 0) {
    return balances;
  }
  for (const childId of childIds) {
    balances.set(childId, { outstanding: 0, credit: 0, receiptIds: [] });
  }
  const invoices = await database
    .selectFrom('invoices')
    .select(['id', 'child_id', 'total_amount'])
    .where('child_id', 'in', childIds)
    .where('status', '=', 'issued')
    .execute();
  const amounts = await invoiceAmounts(database, invoices);
  for (const invoice of invoices) {
    const balance = balances.get(invoice.child_id);
    if (balance) {
      balance.outstanding += Math.max(amounts.get(invoice.id)?.outstanding_amount ?? 0, 0);
    }
  }
  for (const source of await unallocatedReceipts(database, childIds)) {
    const balance = balances.get(source.child_id);
    if (balance && source.remaining > 0) {
      balance.credit += source.remaining;
      balance.receiptIds.push(source.id);
    }
  }
  return balances;
}

async function countRows(query: { executeTakeFirstOrThrow(): Promise<{ count: string | number | bigint }> }) {
  return Number((await query.executeTakeFirstOrThrow()).count);
}

// Mở năm học mới (BR-89, BR-94, YCTD-69):
// - chặn khi trẻ đã thôi học hoặc ra trường còn nợ, vì công nợ của trẻ này không chuyển sang năm mới;
// - chặn khi còn chứng từ chờ duyệt, vì năm cũ chuyển sang chỉ đọc nên không duyệt tiếp được;
// - chuyển tài khoản quỹ với số dư đầu kỳ bằng số dư hiện tại của năm cũ;
// - mỗi trẻ được chuyển còn nợ thì có một hóa đơn công nợ đầu kỳ ở kỳ đầu tiên của năm mới; còn số dư có thì có một phiếu
//   thu ghi số dư có chuyển sang, không phát sinh tiền vào quỹ. Nợ và số dư có của cùng một trẻ được bù trừ trước.
export const financeTransitionStep: AcademicYearTransitionStep = {
  name: 'finance',
  async check(previousDatabase) {
    const previous = previousDatabase as Kysely<SchoolYearDatabase>;
    const leftChildren = await previous
      .selectFrom('children')
      .select(['id', 'full_name'])
      .where('status', 'in', ['withdrawn', 'graduated'])
      .execute();
    const balances = await childBalances(
      previous,
      leftChildren.map((child) => child.id),
    );
    const debtors: FieldError[] = leftChildren
      .filter((child) => (balances.get(child.id)?.outstanding ?? 0) > 0)
      .map((child) => ({
        field: 'children',
        message: `${child.full_name}: ${formatMoney(balances.get(child.id)?.outstanding ?? 0)}`,
      }));
    if (debtors.length > 0) {
      return {
        ruleCode: 'BR-89',
        message: 'Còn trẻ đã thôi học hoặc đã ra trường có công nợ chưa tất toán',
        details: debtors,
      } satisfies TransitionViolation;
    }

    const count = sql<string>`count(*)`.as('count');
    const pending: Array<[string, number]> = [
      [
        'Miễn giảm chờ duyệt',
        await countRows(previous.selectFrom('discounts').select(count).where('status', '=', 'pending')),
      ],
      [
        'Điều chỉnh hóa đơn chờ duyệt',
        await countRows(previous.selectFrom('invoice_adjustments').select(count).where('status', '=', 'pending')),
      ],
      [
        'Phiếu điều chỉnh phiếu thu chờ duyệt',
        await countRows(previous.selectFrom('receipt_reversals').select(count).where('status', '=', 'pending')),
      ],
      [
        'Phiếu chi chờ duyệt',
        await countRows(previous.selectFrom('payments').select(count).where('status', '=', 'pending')),
      ],
      [
        'Phiếu điều chỉnh phiếu chi chờ duyệt',
        await countRows(previous.selectFrom('payment_reversals').select(count).where('status', '=', 'pending')),
      ],
    ];
    const details = pending
      .filter(([, total]) => total > 0)
      .map(([label, total]) => ({ field: 'pending_documents', message: `${label}: ${total}` }));
    if (details.length > 0) {
      return {
        ruleCode: 'BR-94',
        message: 'Còn chứng từ tài chính chờ duyệt, hãy duyệt hoặc từ chối trước khi mở năm học mới',
        details,
      } satisfies TransitionViolation;
    }
    return null;
  },

  async carryOver(context) {
    if (!context.previousDatabase) {
      return;
    }
    const previous = context.previousDatabase as Kysely<SchoolYearDatabase>;
    const next = context.newDatabase as Kysely<SchoolYearDatabase>;

    for (const account of await previous.selectFrom('cash_accounts').selectAll().execute()) {
      await next
        .insertInto('cash_accounts')
        .values({ ...account, opening_balance: account.current_balance })
        .execute();
    }
    // Cấu hình cột của tệp sao kê theo tài khoản dùng tiếp ở năm học mới (YCTD-89)
    for (const profile of await previous.selectFrom('bank_statement_profiles').selectAll().execute()) {
      await next.insertInto('bank_statement_profiles').values(profile).execute();
    }

    const children = await previous
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'full_name'])
      .where('status', 'in', [...CARRIED_CHILD_STATUSES])
      .execute();
    const balances = await childBalances(
      previous,
      children.map((child) => child.id),
    );
    const startDate = context.academicYear.startDate;
    const [periodYear, periodMonth] = startDate.split('-').map(Number);
    await next.transaction().execute(async (transaction) => {
      for (const child of children) {
        const balance = balances.get(child.id);
        const net = balance ? balance.outstanding - balance.credit : 0;
        if (!balance || net === 0) {
          continue;
        }
        if (net > 0) {
          const invoice = await transaction
            .insertInto('invoices')
            .values({
              code: await nextDocumentCode(transaction, 'invoice', 'HD'),
              child_id: child.id,
              org_unit_id: child.org_unit_id,
              period_year: periodYear ?? 0,
              period_month: periodMonth ?? 0,
              invoice_kind: 'opening',
              status: 'issued',
              total_amount: net,
              basis: JSON.stringify({
                carried_over: true,
                outstanding_amount: balance.outstanding,
                credit_amount: balance.credit,
              }),
              review_flags: JSON.stringify([]),
              due_date: startDate,
              issued_at: new Date(),
              issued_by: context.actorUserId,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction
            .insertInto('invoice_items')
            .values({
              invoice_id: invoice.id,
              item_type: 'opening',
              service_id: null,
              description: 'Công nợ chuyển từ năm học trước',
              quantity: 1,
              unit_price: net,
              amount: net,
              basis_note:
                balance.credit > 0
                  ? `Còn nợ ${formatMoney(balance.outstanding)}, trừ số dư có ${formatMoney(balance.credit)}`
                  : null,
            })
            .execute();
          continue;
        }
        // Số dư có lấy tài khoản quỹ và khoản mục thu của phiếu thu gần nhất còn số dư để tra lại được nguồn tiền
        const source = await previous
          .selectFrom('receipts')
          .select(['account_id', 'category_id'])
          .where('id', 'in', balance.receiptIds)
          .orderBy('receipt_date', 'desc')
          .orderBy('created_at', 'desc')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('receipts')
          .values({
            code: await nextDocumentCode(transaction, 'receipt', 'PT'),
            org_unit_id: child.org_unit_id,
            child_id: child.id,
            payer_name: child.full_name,
            amount: -net,
            method: 'other',
            account_id: source.account_id,
            category_id: source.category_id,
            receipt_date: startDate,
            content:
              balance.outstanding > 0
                ? `Số dư có chuyển từ năm học trước (${formatMoney(balance.credit)}, đã trừ nợ ${formatMoney(balance.outstanding)})`
                : 'Số dư có chuyển từ năm học trước',
            request_key: sql<string>`gen_random_uuid()`,
            created_by: context.actorUserId,
            carried_over: true,
          })
          .execute();
      }
    });
  },
};
