import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ruleViolationError } from '@school-management/server';
import { sql, type Kysely, type Transaction } from 'kysely';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { nextDocumentCode } from '../fees/document-codes.js';

// Ghi sổ tự động từ chứng từ (G3-06, N5; RR-05; YCTD-88). Cách làm: lệnh ghi sổ chạy lại được nhiều lần (idempotent), mỗi
// chứng từ ghi đúng một bút toán cho mỗi đơn vị nhờ ràng buộc duy nhất (source_type, source_id, org_unit_id); không móc
// vào giao dịch của phiếu thu, phiếu chi, bảng lương để không làm hỏng luồng cũ khi quy tắc ghi sổ khai báo chưa đúng.
// Lệnh chạy khi kế toán bấm "Ghi sổ chứng từ", trước mỗi lần xem sổ hoặc báo cáo và trước khi chuyển năm học, nên sổ luôn
// khớp chứng từ. Chứng từ thuộc kỳ đã chốt (BR-95) vẫn được ghi vì chứng từ đã phát hành, duyệt trước khi chốt.
// Nguồn ghi sổ:
// - phiếu thu đã phát hành (trừ phiếu số dư có chuyển năm): Nợ tiền / Có 131 hoặc 334 (thu hồi lương), theo khoản mục;
// - phiếu chi đã phát hành: Nợ 642, 131 (hoàn tiền) hoặc 334 (trả lương, quyết toán) / Có tiền, theo khoản mục;
// - phiếu đảo phiếu thu, phiếu chi đã duyệt: bút toán ngược của bút toán phiếu gốc với số tiền đảo, ngày duyệt;
// - hóa đơn đã phát hành (ghi nhận doanh thu, ngày phát hành): Nợ 131 / Có 531; hóa đơn công nợ đầu kỳ nhập tay Nợ 131 /
//   Có 421; hóa đơn công nợ chuyển năm không ghi (đã nằm trong bút toán số dư đầu năm);
// - miễn giảm đã duyệt: Nợ 531 / Có 131; phiếu điều chỉnh hóa đơn đã duyệt: Nợ 131 / Có 531 (số âm thì đảo hai phía);
// - bảng lương đã duyệt, tách theo đơn vị của phiếu lương: thu nhập Nợ 642 / Có 334, khấu trừ Nợ 334 / Có 332, thuế thu
//   nhập cá nhân Nợ 334 / Có 3335;
// - quyết toán thôi việc đã duyệt: Nợ 642 / Có 334 số còn phải trả (âm thì đảo hai phía).
type Executor = Transaction<SchoolYearDatabase>;
type Database = Kysely<SchoolYearDatabase>;

export interface PostingLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface PostingResult {
  posted: Record<string, number>;
  total: number;
}

// Khóa tư vấn để hai lần ghi sổ đồng thời chạy lần lượt, không cấp hai số bút toán cho một chứng từ
const POSTING_LOCK_KEY = 880_042;

const vietnamDate = (column: string) =>
  sql<string>`to_char((${sql.ref(column)} at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD')`;

const notPosted = (sourceType: string, column: string) =>
  sql<boolean>`not exists (select 1 from journal_entries where journal_entries.source_type = ${sourceType}
    and journal_entries.source_id = ${sql.ref(column)})`;

// Hai dòng Nợ / Có cùng số tiền; số âm thì đảo hai phía
export function pairLines(debitAccountId: string, creditAccountId: string, amount: number, description?: string) {
  if (amount === 0) {
    return [];
  }
  const [debit, credit] = amount > 0 ? [debitAccountId, creditAccountId] : [creditAccountId, debitAccountId];
  const value = Math.abs(amount);
  return [
    { accountId: debit, debit: value, credit: 0, description: description ?? null },
    { accountId: credit, debit: 0, credit: value, description: description ?? null },
  ];
}

export async function insertJournalEntry(
  transaction: Executor,
  input: {
    orgUnitId: string;
    entryDate: string;
    description: string;
    entryType: 'auto' | 'manual' | 'opening';
    sourceType: string | null;
    sourceId: string | null;
    sourceCode: string | null;
    lines: PostingLine[];
    createdBy: string | null;
    requestKey?: string | null;
  },
): Promise<string | null> {
  const lines = input.lines.filter((line) => line.debit > 0 || line.credit > 0);
  const debit = lines.reduce((total, line) => total + line.debit, 0);
  const credit = lines.reduce((total, line) => total + line.credit, 0);
  if (lines.length === 0) {
    return null;
  }
  if (debit !== credit) {
    // Không xảy ra với bút toán tự động vì luôn ghi theo cặp; chặn để sổ không bao giờ lệch
    throw ruleViolationError('P06-12', `Bút toán lệch: tổng Nợ ${debit}, tổng Có ${credit}`);
  }
  const entry = await transaction
    .insertInto('journal_entries')
    .values({
      code: await nextDocumentCode(transaction, 'journal_entry', 'BT'),
      org_unit_id: input.orgUnitId,
      entry_date: input.entryDate,
      description: input.description,
      entry_type: input.entryType,
      source_type: input.sourceType,
      source_id: input.sourceId,
      source_code: input.sourceCode,
      total_amount: debit,
      request_key: input.requestKey ?? null,
      created_by: input.createdBy,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await transaction
    .insertInto('journal_lines')
    .values(
      lines.map((line, index) => ({
        entry_id: entry.id,
        line_no: index + 1,
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? null,
      })),
    )
    .execute();
  return entry.id;
}

// Quy tắc ghi sổ đang dùng: quy tắc theo khoản mục trước, quy tắc chung của loại chứng từ sau
export class RuleBook {
  private constructor(
    private readonly rules: Array<{
      document_type: string;
      category_id: string | null;
      debit_account_id: string | null;
      credit_account_id: string | null;
    }>,
  ) {}

  static async load(executor: Executor | Database): Promise<RuleBook> {
    return new RuleBook(
      await executor
        .selectFrom('ledger_posting_rules')
        .select(['document_type', 'category_id', 'debit_account_id', 'credit_account_id'])
        .execute(),
    );
  }

  private find(documentType: string, categoryId: string | null) {
    return (
      (categoryId
        ? this.rules.find((rule) => rule.document_type === documentType && rule.category_id === categoryId)
        : undefined) ?? this.rules.find((rule) => rule.document_type === documentType && rule.category_id === null)
    );
  }

  private require(documentType: string, categoryId: string | null) {
    const rule = this.find(documentType, categoryId);
    if (!rule) {
      throw ruleViolationError('P06-12', `Chưa khai báo quy tắc ghi sổ cho loại chứng từ ${documentType}`);
    }
    return rule;
  }

  moneyAccount(accountType: 'cash' | 'bank'): string {
    const rule = this.require(accountType === 'cash' ? 'money_cash' : 'money_bank', null);
    if (!rule.debit_account_id) {
      throw ruleViolationError('P06-12', 'Chưa khai báo tài khoản tiền của quỹ');
    }
    return rule.debit_account_id;
  }

  // Cặp tài khoản Nợ / Có của một chứng từ; phía để trống của quy tắc là tài khoản tiền của quỹ trên chứng từ
  accounts(
    documentType: string,
    categoryId: string | null,
    moneyType: 'cash' | 'bank' | null,
  ): { debit: string; credit: string } {
    const rule = this.require(documentType, categoryId);
    const money = () => {
      if (!moneyType) {
        throw ruleViolationError('P06-12', `Quy tắc ghi sổ ${documentType} thiếu tài khoản`);
      }
      return this.moneyAccount(moneyType);
    };
    return { debit: rule.debit_account_id ?? money(), credit: rule.credit_account_id ?? money() };
  }
}

// Bút toán ngược của phiếu gốc: lấy tài khoản từ bút toán đã ghi của phiếu gốc để khớp đúng; phiếu gốc chưa có bút toán
// (phiếu số dư có chuyển năm) thì tính theo quy tắc hiện hành
async function originalAccounts(
  transaction: Executor,
  sourceType: string,
  sourceId: string,
  fallback: () => { debit: string; credit: string },
): Promise<{ debit: string; credit: string }> {
  const lines = await transaction
    .selectFrom('journal_lines')
    .innerJoin('journal_entries', 'journal_entries.id', 'journal_lines.entry_id')
    .select(['journal_lines.account_id', 'journal_lines.debit', 'journal_lines.credit'])
    .where('journal_entries.source_type', '=', sourceType)
    .where('journal_entries.source_id', '=', sourceId)
    .orderBy('journal_lines.line_no')
    .execute();
  const debit = lines.find((line) => Number(line.debit) > 0);
  const credit = lines.find((line) => Number(line.credit) > 0);
  return debit && credit ? { debit: debit.account_id, credit: credit.account_id } : fallback();
}

export async function postPendingDocuments(transaction: Executor): Promise<PostingResult> {
  await sql`select pg_advisory_xact_lock(${POSTING_LOCK_KEY})`.execute(transaction);
  const rules = await RuleBook.load(transaction);
  const posted: Record<string, number> = {};
  const record = async (
    sourceType: string,
    input: {
      orgUnitId: string;
      date: string;
      description: string;
      sourceId: string;
      sourceCode: string | null;
      lines: PostingLine[];
    },
  ) => {
    const id = await insertJournalEntry(transaction, {
      orgUnitId: input.orgUnitId,
      entryDate: input.date,
      description: input.description,
      entryType: 'auto',
      sourceType,
      sourceId: input.sourceId,
      sourceCode: input.sourceCode,
      lines: input.lines,
      createdBy: null,
    });
    if (id) {
      posted[sourceType] = (posted[sourceType] ?? 0) + 1;
    }
  };

  // Phiếu thu
  const receipts = await transaction
    .selectFrom('receipts')
    .innerJoin('cash_accounts', 'cash_accounts.id', 'receipts.account_id')
    .select([
      'receipts.id',
      'receipts.code',
      'receipts.org_unit_id',
      'receipts.amount',
      'receipts.receipt_date',
      'receipts.category_id',
      'receipts.staff_id',
      'receipts.payer_name',
      'cash_accounts.account_type',
    ])
    .where('receipts.carried_over', '=', false)
    .where(notPosted('receipt', 'receipts.id'))
    .orderBy('receipts.receipt_date')
    .orderBy('receipts.code')
    .execute();
  for (const receipt of receipts) {
    const accounts = rules.accounts(
      receipt.staff_id ? 'receipt_staff' : 'receipt',
      receipt.category_id,
      receipt.account_type,
    );
    await record('receipt', {
      orgUnitId: receipt.org_unit_id,
      date: receipt.receipt_date,
      description: `Phiếu thu ${receipt.code} - ${receipt.payer_name}`,
      sourceId: receipt.id,
      sourceCode: receipt.code,
      lines: pairLines(accounts.debit, accounts.credit, Number(receipt.amount)),
    });
  }

  // Phiếu chi
  const payments = await transaction
    .selectFrom('payments')
    .innerJoin('cash_accounts', 'cash_accounts.id', 'payments.account_id')
    .select([
      'payments.id',
      'payments.code',
      'payments.org_unit_id',
      'payments.amount',
      'payments.payment_date',
      'payments.category_id',
      'payments.payment_type',
      'payments.payee_name',
      'cash_accounts.account_type',
    ])
    .where('payments.status', 'in', ['issued', 'pending_reversal', 'reversed'])
    .where('payments.payment_date', 'is not', null)
    .where(notPosted('payment', 'payments.id'))
    .orderBy('payments.payment_date')
    .orderBy('payments.code')
    .execute();
  const paymentDocumentType = (type: string) =>
    type === 'refund' ? 'payment_refund' : type === 'payroll' ? 'payment_payroll' : 'payment';
  for (const payment of payments) {
    const accounts = rules.accounts(
      paymentDocumentType(payment.payment_type),
      payment.category_id,
      payment.account_type,
    );
    await record('payment', {
      orgUnitId: payment.org_unit_id,
      date: payment.payment_date ?? '',
      description: `Phiếu chi ${payment.code ?? ''} - ${payment.payee_name}`,
      sourceId: payment.id,
      sourceCode: payment.code,
      lines: pairLines(accounts.debit, accounts.credit, Number(payment.amount)),
    });
  }

  // Phiếu đảo phiếu thu
  const receiptReversals = await transaction
    .selectFrom('receipt_reversals')
    .innerJoin('receipts', 'receipts.id', 'receipt_reversals.receipt_id')
    .innerJoin('cash_accounts', 'cash_accounts.id', 'receipts.account_id')
    .select([
      'receipt_reversals.id',
      'receipt_reversals.code',
      'receipt_reversals.org_unit_id',
      'receipt_reversals.amount',
      'receipt_reversals.receipt_id',
      'receipts.code as receipt_code',
      'receipts.category_id',
      'receipts.staff_id',
      'cash_accounts.account_type',
      vietnamDate('receipt_reversals.decided_at').as('decided_date'),
    ])
    .where('receipt_reversals.status', '=', 'approved')
    .where(notPosted('receipt_reversal', 'receipt_reversals.id'))
    .orderBy('receipt_reversals.decided_at')
    .execute();
  for (const reversal of receiptReversals) {
    const original = await originalAccounts(transaction, 'receipt', reversal.receipt_id, () =>
      rules.accounts(reversal.staff_id ? 'receipt_staff' : 'receipt', reversal.category_id, reversal.account_type),
    );
    await record('receipt_reversal', {
      orgUnitId: reversal.org_unit_id,
      date: reversal.decided_date,
      description: `Đảo phiếu thu ${reversal.receipt_code} bằng phiếu ${reversal.code}`,
      sourceId: reversal.id,
      sourceCode: reversal.code,
      lines: pairLines(original.credit, original.debit, Number(reversal.amount)),
    });
  }

  // Phiếu đảo phiếu chi
  const paymentReversals = await transaction
    .selectFrom('payment_reversals')
    .innerJoin('payments', 'payments.id', 'payment_reversals.payment_id')
    .innerJoin('cash_accounts', 'cash_accounts.id', 'payments.account_id')
    .select([
      'payment_reversals.id',
      'payment_reversals.code',
      'payment_reversals.org_unit_id',
      'payment_reversals.amount',
      'payment_reversals.payment_id',
      'payments.code as payment_code',
      'payments.category_id',
      'payments.payment_type',
      'cash_accounts.account_type',
      vietnamDate('payment_reversals.decided_at').as('decided_date'),
    ])
    .where('payment_reversals.status', '=', 'approved')
    .where(notPosted('payment_reversal', 'payment_reversals.id'))
    .orderBy('payment_reversals.decided_at')
    .execute();
  for (const reversal of paymentReversals) {
    const original = await originalAccounts(transaction, 'payment', reversal.payment_id, () =>
      rules.accounts(paymentDocumentType(reversal.payment_type), reversal.category_id, reversal.account_type),
    );
    await record('payment_reversal', {
      orgUnitId: reversal.org_unit_id,
      date: reversal.decided_date,
      description: `Đảo phiếu chi ${reversal.payment_code ?? ''} bằng phiếu ${reversal.code}`,
      sourceId: reversal.id,
      sourceCode: reversal.code,
      lines: pairLines(original.credit, original.debit, Number(reversal.amount)),
    });
  }

  // Hóa đơn đã phát hành: ghi nhận doanh thu; hóa đơn công nợ chuyển năm không ghi
  const invoices = await transaction
    .selectFrom('invoices')
    .select([
      'id',
      'code',
      'org_unit_id',
      'total_amount',
      'invoice_kind',
      'period_year',
      'period_month',
      vietnamDate('issued_at').as('issued_date'),
    ])
    .where('status', '=', 'issued')
    .where('issued_at', 'is not', null)
    .where('total_amount', '<>', '0')
    .where(sql<boolean>`not (invoice_kind = 'opening' and coalesce(basis ->> 'carried_over', '') = 'true')`)
    .where(notPosted('invoice', 'invoices.id'))
    .orderBy('issued_at')
    .orderBy('code')
    .execute();
  for (const invoice of invoices) {
    const accounts = rules.accounts(invoice.invoice_kind === 'opening' ? 'invoice_opening' : 'invoice', null, null);
    await record('invoice', {
      orgUnitId: invoice.org_unit_id,
      date: invoice.issued_date,
      description: `Hóa đơn ${invoice.code ?? ''} kỳ ${String(invoice.period_month).padStart(2, '0')}/${invoice.period_year}`,
      sourceId: invoice.id,
      sourceCode: invoice.code,
      lines: pairLines(accounts.debit, accounts.credit, Number(invoice.total_amount)),
    });
  }

  // Miễn giảm đã duyệt
  const discounts = await transaction
    .selectFrom('discounts')
    .innerJoin('invoices', 'invoices.id', 'discounts.invoice_id')
    .select([
      'discounts.id',
      'discounts.org_unit_id',
      'discounts.applied_amount',
      'invoices.code as invoice_code',
      vietnamDate('discounts.decided_at').as('decided_date'),
    ])
    .where('discounts.status', '=', 'approved')
    .where('discounts.decided_at', 'is not', null)
    .where('discounts.applied_amount', '<>', '0')
    .where(notPosted('discount', 'discounts.id'))
    .orderBy('discounts.decided_at')
    .execute();
  for (const discount of discounts) {
    const accounts = rules.accounts('discount', null, null);
    await record('discount', {
      orgUnitId: discount.org_unit_id,
      date: discount.decided_date,
      description: `Miễn giảm hóa đơn ${discount.invoice_code ?? ''}`,
      sourceId: discount.id,
      sourceCode: discount.invoice_code,
      lines: pairLines(accounts.debit, accounts.credit, Number(discount.applied_amount)),
    });
  }

  // Phiếu điều chỉnh hóa đơn đã duyệt
  const adjustments = await transaction
    .selectFrom('invoice_adjustments')
    .innerJoin('invoices', 'invoices.id', 'invoice_adjustments.invoice_id')
    .select([
      'invoice_adjustments.id',
      'invoice_adjustments.code',
      'invoice_adjustments.org_unit_id',
      'invoice_adjustments.amount',
      'invoices.code as invoice_code',
      vietnamDate('invoice_adjustments.decided_at').as('decided_date'),
    ])
    .where('invoice_adjustments.status', '=', 'approved')
    .where('invoice_adjustments.decided_at', 'is not', null)
    .where('invoice_adjustments.amount', '<>', '0')
    .where(notPosted('invoice_adjustment', 'invoice_adjustments.id'))
    .orderBy('invoice_adjustments.decided_at')
    .execute();
  for (const adjustment of adjustments) {
    const accounts = rules.accounts('invoice_adjustment', null, null);
    await record('invoice_adjustment', {
      orgUnitId: adjustment.org_unit_id,
      date: adjustment.decided_date,
      description: `Điều chỉnh ${adjustment.code} hóa đơn ${adjustment.invoice_code ?? ''}`,
      sourceId: adjustment.id,
      sourceCode: adjustment.code,
      lines: pairLines(accounts.debit, accounts.credit, Number(adjustment.amount)),
    });
  }

  // Bảng lương đã duyệt, tách theo đơn vị của phiếu lương
  const payrolls = await transaction
    .selectFrom('payrolls')
    .select(['id', 'period_year', 'period_month', vietnamDate('approved_at').as('approved_date')])
    .where('status', '=', 'approved')
    .where('approved_at', 'is not', null)
    .where(notPosted('payroll', 'payrolls.id'))
    .orderBy('approved_at')
    .execute();
  for (const payroll of payrolls) {
    const units = await transaction
      .selectFrom('payslip_lines')
      .innerJoin('payslips', 'payslips.id', 'payslip_lines.payslip_id')
      .select([
        'payslips.org_unit_id',
        sql<string>`coalesce(sum(case when payslip_lines.line_type not in ('deduction', 'tax') then payslip_lines.amount else 0 end), 0)`.as(
          'income',
        ),
        sql<string>`coalesce(sum(case when payslip_lines.line_type = 'deduction' then payslip_lines.amount else 0 end), 0)`.as(
          'deduction',
        ),
        sql<string>`coalesce(sum(case when payslip_lines.line_type = 'tax' then payslip_lines.amount else 0 end), 0)`.as(
          'tax',
        ),
      ])
      .where('payslips.payroll_id', '=', payroll.id)
      .groupBy('payslips.org_unit_id')
      .orderBy('payslips.org_unit_id')
      .execute();
    const month = `${String(payroll.period_month).padStart(2, '0')}/${payroll.period_year}`;
    for (const unit of units) {
      const income = rules.accounts('payroll_income', null, null);
      const deduction = rules.accounts('payroll_deduction', null, null);
      const tax = rules.accounts('payroll_tax', null, null);
      await record('payroll', {
        orgUnitId: unit.org_unit_id,
        date: payroll.approved_date,
        description: `Bảng lương tháng ${month}`,
        sourceId: payroll.id,
        sourceCode: `BL-${month}`,
        lines: [
          ...pairLines(income.debit, income.credit, Number(unit.income), 'Tổng thu nhập'),
          ...pairLines(deduction.debit, deduction.credit, -Number(unit.deduction), 'Các khoản khấu trừ'),
          ...pairLines(tax.debit, tax.credit, -Number(unit.tax), 'Thuế thu nhập cá nhân'),
        ],
      });
    }
  }

  // Quyết toán thôi việc đã duyệt
  const settlements = await transaction
    .selectFrom('payroll_settlements')
    .innerJoin('staff', 'staff.id', 'payroll_settlements.staff_id')
    .select([
      'payroll_settlements.id',
      'payroll_settlements.payable_amount',
      'staff.org_unit_id',
      'staff.full_name',
      vietnamDate('payroll_settlements.approved_at').as('approved_date'),
    ])
    .where('payroll_settlements.status', '=', 'approved')
    .where('payroll_settlements.approved_at', 'is not', null)
    .where('payroll_settlements.payable_amount', '<>', '0')
    .where(notPosted('settlement', 'payroll_settlements.id'))
    .orderBy('payroll_settlements.approved_at')
    .execute();
  for (const settlement of settlements) {
    const accounts = rules.accounts('settlement', null, null);
    await record('settlement', {
      orgUnitId: settlement.org_unit_id,
      date: settlement.approved_date,
      description: `Quyết toán thôi việc ${settlement.full_name}`,
      sourceId: settlement.id,
      sourceCode: null,
      lines: pairLines(accounts.debit, accounts.credit, Number(settlement.payable_amount)),
    });
  }

  return { posted, total: Object.values(posted).reduce((total, count) => total + count, 0) };
}

@Injectable()
export class LedgerPostingService {
  constructor(private readonly currentSchoolYear: CurrentSchoolYearResolver) {}

  async postPending(): Promise<PostingResult> {
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute((transaction) => postPendingDocuments(transaction));
  }
}
