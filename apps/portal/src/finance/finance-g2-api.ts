import { requestJson } from '../session/api-client.js';

// Gọi điểm cuối tài chính giai đoạn 2: nhắc nợ, xử lý công nợ quá hạn, giao dịch ngân hàng và đối chiếu, công nợ phải trả,
// chốt kỳ tài chính (P05-10, P05-12, P06-06, P06-07, P06-09; YCTD-82)
const post = <T>(path: string, body: unknown = {}) =>
  requestJson<T>(path, { method: 'POST', body: JSON.stringify(body) });

export interface ReminderRow {
  invoice_id: string;
  invoice_code: string | null;
  period: string;
  child_id: string;
  child_name: string;
  class_name: string | null;
  due_date: string | null;
  outstanding_amount: number;
  overdue_days: number;
  milestone_days: number;
  last_reminder_milestone: number | null;
  last_reminded_at: string | null;
  needs_reminder: boolean;
}

export interface ReminderList {
  milestones: number[];
  rows: ReminderRow[];
  totals: { invoice_count: number; child_count: number; outstanding_amount: number; needs_reminder_count: number };
}

export interface DebtResolution {
  id: string;
  org_unit_id: string;
  child_id: string;
  child_name: string;
  invoice_code: string | null;
  overdue_amount: number;
  overdue_days: number;
  proposal: string;
  proposed_at: string;
  decision: string | null;
  decided_at: string | null;
  status: 'pending' | 'decided';
}

export const listReminders = (orgUnitId: string, dueOnly: boolean): Promise<ReminderList> =>
  requestJson(`/api/v1/debts/reminders?org_unit_id=${orgUnitId}${dueOnly ? '&due_only=true' : ''}`);
export const sendReminders = (orgUnitId: string, invoiceIds: string[]) =>
  post<{ sent_count: number; skipped: Array<{ invoice_id: string; reason: string }> }>('/api/v1/debts/reminders/send', {
    org_unit_id: orgUnitId,
    invoice_ids: invoiceIds,
  });
export const listResolutions = (orgUnitId: string): Promise<DebtResolution[]> =>
  requestJson(`/api/v1/debt-resolutions?org_unit_id=${orgUnitId}`);
export const proposeResolution = (input: { child_id: string; proposal: string }) =>
  post<DebtResolution>('/api/v1/debt-resolutions', input);
export const decideResolution = (id: string, decision: string) =>
  post<DebtResolution>(`/api/v1/debt-resolutions/${id}/decide`, { decision });

export interface StatementLine {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  bank_reference: string | null;
  status: 'unmatched' | 'matched';
  matched_transaction_id: string | null;
  matched_description: string | null;
}

export interface BookEntry {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  matched: boolean;
}

export interface Reconciliation {
  book_opening_balance: number;
  book_movement: number;
  book_closing_balance: number;
  statement_movement: number;
  difference: number;
  matched_count: number;
  unmatched_book: BookEntry[];
  unmatched_statement: StatementLine[];
  statement: StatementLine[];
}

export const readReconciliation = (accountId: string, from: string, to: string): Promise<Reconciliation> =>
  requestJson(`/api/v1/bank-reconciliation?account_id=${accountId}&from=${from}&to=${to}`);
export const createStatementLine = (input: {
  account_id: string;
  transaction_date: string;
  amount: number;
  description: string;
  bank_reference?: string;
}) => post<StatementLine>('/api/v1/bank-transactions', input);
export const matchStatementLine = (id: string, accountTransactionId: string) =>
  post(`/api/v1/bank-transactions/${id}/match`, { account_transaction_id: accountTransactionId });
export const unmatchStatementLine = (id: string) => post(`/api/v1/bank-transactions/${id}/unmatch`);
export const deleteStatementLine = (id: string) => requestJson(`/api/v1/bank-transactions/${id}`, { method: 'DELETE' });
export const autoMatch = (accountId: string, from: string, to: string) =>
  post<Reconciliation & { auto_matched_count: number }>('/api/v1/bank-transactions/auto-match', {
    account_id: accountId,
    from,
    to,
  });

export type PayableStatus = 'open' | 'paid' | 'cancelled';
export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  open: 'Chưa trả',
  paid: 'Đã trả',
  cancelled: 'Đã hủy',
};

export interface Payable {
  id: string;
  code: string;
  payee_name: string;
  supplier_id: string | null;
  source_type: 'manual' | 'purchase_order' | 'medicine_purchase_order';
  document_ref: string | null;
  description: string;
  amount: number;
  document_date: string;
  due_date: string;
  status: PayableStatus;
  payment_code: string | null;
  overdue_days: number;
}

export interface PayableList {
  rows: Payable[];
  payees: Array<{ payee_name: string; open_amount: number; overdue_amount: number; count: number }>;
  totals: { open_amount: number; overdue_amount: number; paid_amount: number };
}

export interface PayableSources {
  purchase_orders: Array<{ id: string; code: string; order_date: string; total_amount: number; supplier_name: string }>;
  medicine_orders: Array<{ id: string; code: string; order_date: string; total_amount: number; pharmacy_name: string }>;
  suppliers: Array<{ id: string; name: string }>;
}

export interface IssuedPayment {
  id: string;
  code: string | null;
  payee_name: string;
  amount: number;
  status: string;
}

export const listPayables = (orgUnitId: string): Promise<PayableList> =>
  requestJson(`/api/v1/payables?org_unit_id=${orgUnitId}`);
export const readPayableSources = (orgUnitId: string): Promise<PayableSources> =>
  requestJson(`/api/v1/payables/sources?org_unit_id=${orgUnitId}`);
export const createPayable = (input: Record<string, unknown>) => post<Payable>('/api/v1/payables', input);
export const payPayable = (id: string, paymentId: string) =>
  post<Payable>(`/api/v1/payables/${id}/pay`, { payment_id: paymentId });
export const cancelPayable = (id: string, reason: string) => post<Payable>(`/api/v1/payables/${id}/cancel`, { reason });
export const listIssuedPayments = (orgUnitId: string): Promise<IssuedPayment[]> =>
  requestJson(`/api/v1/payments?org_unit_id=${orgUnitId}&status=issued`);

export type FiscalPeriodStatus = 'open' | 'pending' | 'closed' | 'rejected';
export const FISCAL_STATUS_LABELS: Record<FiscalPeriodStatus, string> = {
  open: 'Đang mở',
  pending: 'Chờ duyệt chốt',
  closed: 'Đã chốt',
  rejected: 'Bị từ chối',
};

export interface FiscalSummary {
  receipt_count: number;
  receipt_amount: number;
  payment_count: number;
  payment_amount: number;
  invoice_count: number;
  invoice_amount: number;
  pending: Array<{ document: string; count: number }>;
}

export interface FiscalPeriodRow {
  period: string;
  id: string | null;
  status: FiscalPeriodStatus;
  ended: boolean;
  can_request: boolean;
  summary: FiscalSummary | null;
  request_note: string | null;
  reject_reason: string | null;
  closed_at: string | null;
}

export const listFiscalPeriods = (orgUnitId: string): Promise<FiscalPeriodRow[]> =>
  requestJson(`/api/v1/fiscal-periods?org_unit_id=${orgUnitId}`);
export const requestPeriodClose = (orgUnitId: string, period: string, note: string) =>
  post('/api/v1/fiscal-periods', { org_unit_id: orgUnitId, period, note: note || undefined });
export const approvePeriodClose = (id: string) => post(`/api/v1/fiscal-periods/${id}/close`);
export const rejectPeriodClose = (id: string, reason: string) =>
  post(`/api/v1/fiscal-periods/${id}/reject`, { reason });
