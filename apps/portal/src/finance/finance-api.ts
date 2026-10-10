import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối quỹ và tài khoản, phiếu thu, công nợ phải thu (P05-09, P06-01, P06-02, P06-05; YCTD-53)
export type CashAccountType = 'cash' | 'bank';
export type ReceiptMethod = 'cash' | 'transfer' | 'other';
export type PaymentStatus = 'unpaid' | 'paid' | 'overdue';

export const ACCOUNT_TYPE_LABELS: Record<CashAccountType, string> = { cash: 'Quỹ tiền mặt', bank: 'Ngân hàng' };
export const METHOD_LABELS: Record<ReceiptMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  other: 'Khác',
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Còn phải nộp',
  paid: 'Đã thu đủ',
  overdue: 'Quá hạn',
};

export interface CashAccount {
  id: string;
  org_unit_id: string;
  account_type: CashAccountType;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  opening_balance: number;
  current_balance: number;
  status: 'active' | 'inactive';
}

export interface DebtSummary {
  invoice_count: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  credit_amount: number;
  balance_amount: number;
  overdue_amount: number;
  overdue_days: number;
}

export interface DebtRow extends DebtSummary {
  id: string;
  full_name: string;
  class_id: string | null;
  class_name: string | null;
}

export interface DebtInvoice {
  id: string;
  code: string | null;
  invoice_kind: 'main' | 'supplementary';
  period_year: number;
  period_month: number;
  due_date: string | null;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: PaymentStatus;
  overdue_days: number;
}

export interface ChildDebt extends DebtSummary {
  child_id: string;
  child_name: string;
  org_unit_id: string;
  invoices: DebtInvoice[];
}

export interface Receipt {
  id: string;
  code: string;
  child_id: string;
  child_name: string;
  payer_name: string;
  amount: number;
  allocated_amount: number;
  method: ReceiptMethod;
  account_name: string;
  category_name: string;
  receipt_date: string;
  content: string | null;
  status: 'issued' | 'pending_reversal' | 'reversed';
}

export interface ReceiptInput {
  request_key: string;
  child_id: string;
  payer_name: string;
  amount: number;
  method: ReceiptMethod;
  account_id: string;
  category_id: string;
  receipt_date: string;
  content: string;
  allocations: Array<{ invoice_id: string; amount: number }>;
}

export const listCashAccounts = (orgUnitId: string): Promise<CashAccount[]> =>
  requestJson(`/api/v1/cash-accounts?org_unit_id=${orgUnitId}`);
export const createCashAccount = (input: {
  org_unit_id: string;
  account_type: CashAccountType;
  name: string;
  bank_name?: string;
  account_number?: string;
  opening_balance: number;
}) => requestJson<CashAccount>('/api/v1/cash-accounts', { method: 'POST', body: JSON.stringify(input) });
export const updateCashAccount = (
  id: string,
  changes: Partial<Pick<CashAccount, 'name' | 'bank_name' | 'account_number' | 'status'>>,
) => requestJson<CashAccount>(`/api/v1/cash-accounts/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });

export const listDebts = (orgUnitId: string, overdueOnly: boolean): Promise<DebtRow[]> =>
  requestJson(`/api/v1/debts?org_unit_id=${orgUnitId}${overdueOnly ? '&overdue_only=true' : ''}`);
export const readChildDebt = (childId: string): Promise<ChildDebt> => requestJson(`/api/v1/children/${childId}/debt`);
export const listChildReceipts = (childId: string): Promise<Receipt[]> =>
  requestJson(`/api/v1/children/${childId}/receipts`);
export const listReceipts = (orgUnitId: string, from: string, to: string): Promise<Receipt[]> =>
  requestJson(`/api/v1/receipts?org_unit_id=${orgUnitId}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`);
export const createReceipt = (input: ReceiptInput) =>
  requestJson<Receipt>('/api/v1/receipts', { method: 'POST', body: JSON.stringify(input) });
export const allocateCredit = (childId: string, allocations: Array<{ invoice_id: string; amount: number }>) =>
  requestJson(`/api/v1/children/${childId}/credit-allocations`, {
    method: 'POST',
    body: JSON.stringify({ allocations }),
  });

export interface ReceiptReversal {
  id: string;
  code: string;
  receipt_id: string;
  receipt_code: string;
  child_name: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requires_principal: boolean;
  reject_reason: string | null;
}

export const reverseReceipt = (receiptId: string, reason: string) =>
  requestJson<ReceiptReversal>(`/api/v1/receipts/${receiptId}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
export const decideReversal = (receiptId: string, approve: boolean, reason: string) =>
  requestJson<ReceiptReversal>(`/api/v1/receipts/${receiptId}/reverse/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    body: JSON.stringify(approve ? {} : { reason }),
  });
export const listPendingReversals = (orgUnitId: string): Promise<ReceiptReversal[]> =>
  requestJson(`/api/v1/receipt-reversals/pending?org_unit_id=${orgUnitId}`);

export type PaymentType = 'regular' | 'refund' | 'payroll';
export type PaymentVoucherStatus = 'draft' | 'pending' | 'issued' | 'pending_reversal' | 'reversed';

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  regular: 'Chi thường',
  refund: 'Hoàn tiền thôi học',
  payroll: 'Chi lương',
};
export const PAYMENT_STATUS_TEXT: Record<PaymentVoucherStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  issued: 'Đã phát hành',
  pending_reversal: 'Chờ duyệt đảo',
  reversed: 'Đã đảo',
};

export interface Payment {
  id: string;
  code: string | null;
  payment_type: PaymentType;
  child_name: string | null;
  payee_name: string;
  amount: number;
  content: string;
  account_name: string;
  category_name: string;
  payment_date: string | null;
  status: PaymentVoucherStatus;
  requires_principal: boolean | null;
  reject_reason: string | null;
}

export interface PaymentInput {
  request_key: string;
  org_unit_id: string;
  payment_type: PaymentType;
  child_id?: string;
  payee_name: string;
  amount: number;
  content: string;
  account_id: string;
  category_id: string;
  file_ids: string[];
}

export interface CashBook {
  opening_balance: number;
  total_in: number;
  total_out: number;
  closing_balance: number;
  transactions: Array<{
    id: string;
    transaction_date: string;
    document_code: string | null;
    description: string;
    amount: number;
    balance_after: number;
  }>;
}

export const listPayments = (orgUnitId: string): Promise<Payment[]> =>
  requestJson(`/api/v1/payments?org_unit_id=${orgUnitId}`);
export const listPendingPayments = (orgUnitId: string): Promise<Payment[]> =>
  requestJson(`/api/v1/payments/pending?org_unit_id=${orgUnitId}`);
export const createPayment = (input: PaymentInput) =>
  requestJson<Payment>('/api/v1/payments', { method: 'POST', body: JSON.stringify(input) });
export const submitPayment = (paymentId: string) =>
  requestJson<Payment>(`/api/v1/payments/${paymentId}/submit`, { method: 'POST' });
export const deletePayment = (paymentId: string) =>
  requestJson<void>(`/api/v1/payments/${paymentId}`, { method: 'DELETE' });
export const decidePayment = (paymentId: string, approve: boolean, reason: string) =>
  requestJson<Payment>(`/api/v1/payments/${paymentId}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    body: JSON.stringify(approve ? {} : { reason }),
  });
export const readCashBook = (accountId: string, from: string, to: string): Promise<CashBook> =>
  requestJson(`/api/v1/cash-books?account_id=${accountId}&from=${from}&to=${to}`);
