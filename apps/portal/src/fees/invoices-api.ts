import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối tính học phí, hóa đơn, miễn giảm, phiếu điều chỉnh của máy chủ API (P05-05 đến P05-08; YCTD-51, YCTD-52)
export const REVIEW_FLAG_LABELS: Record<string, string> = {
  absent_many: 'Vắng từ 5 ngày',
  large_change: 'Chênh hơn 30% so với kỳ trước',
  no_registration: 'Không có dịch vụ và ngày ăn',
  discount_exceeds: 'Miễn giảm vượt tổng hóa đơn',
};

export interface Invoice {
  id: string;
  code: string | null;
  child_id: string;
  child_name: string;
  invoice_kind: 'main' | 'supplementary';
  status: 'draft' | 'issued';
  total_amount: number;
  due_date: string | null;
  review_flags: string[];
  discount_amount: number;
  adjustment_amount: number;
  payable_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  basis: { school_days?: number; enrolled_days?: number; present_days?: number; fee_schedule_name?: string };
}

export interface InvoiceDetail extends Invoice {
  items: Array<{
    id: string;
    item_type: 'tuition' | 'service';
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    basis_note: string | null;
  }>;
  discounts: Array<{
    id: string;
    discount_type_name: string;
    basis: string;
    applied_amount: number;
    status: FeeDocumentStatus;
    requires_principal: boolean;
    reject_reason: string | null;
  }>;
  adjustments: Array<{
    id: string;
    code: string;
    reason: string;
    amount: number;
    status: FeeDocumentStatus;
    requires_principal: boolean;
    reject_reason: string | null;
  }>;
}

export type FeeDocumentStatus = 'pending' | 'approved' | 'rejected';

export const FEE_DOCUMENT_STATUS_LABELS: Record<FeeDocumentStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

export interface PendingApprovals {
  discounts: Array<{
    id: string;
    child_name: string;
    discount_type_name: string;
    basis: string;
    applied_amount: number;
    requires_principal: boolean;
    period_year: number;
    period_month: number;
  }>;
  adjustments: Array<{
    id: string;
    code: string;
    invoice_code: string | null;
    child_name: string;
    reason: string;
    amount: number;
    requires_principal: boolean;
  }>;
}

const post = <Result>(path: string, body: unknown): Promise<Result> =>
  requestJson(path, { method: 'POST', body: JSON.stringify(body) });

export const listInvoices = (orgUnitId: string, period: string): Promise<Invoice[]> =>
  requestJson(`/api/v1/invoices?org_unit_id=${orgUnitId}&period=${period}`);
export const readInvoice = (id: string): Promise<InvoiceDetail> => requestJson(`/api/v1/invoices/${id}`);
export const calculateFees = (orgUnitId: string, period: string) =>
  post('/api/v1/fee-calculations', { org_unit_id: orgUnitId, period });
export const issueInvoices = (orgUnitId: string, period: string, dueDate: string) =>
  post<Invoice[]>('/api/v1/invoices/issue', { org_unit_id: orgUnitId, period, due_date: dueDate });
export const issueSupplementary = (childId: string, period: string, dueDate: string) =>
  post<InvoiceDetail>('/api/v1/invoices/supplementary', { child_id: childId, period, due_date: dueDate });
export const createDiscount = (invoiceId: string, discountTypeId: string, basis: string) =>
  post(`/api/v1/invoices/${invoiceId}/discounts`, { discount_type_id: discountTypeId, basis });
export const copyPreviousDiscounts = (invoiceId: string) =>
  post(`/api/v1/invoices/${invoiceId}/discounts/copy-previous`, {});
export const createAdjustment = (invoiceId: string, amount: number, reason: string) =>
  post('/api/v1/invoice-adjustments', { invoice_id: invoiceId, amount, reason });
export const listPendingApprovals = (orgUnitId: string): Promise<PendingApprovals> =>
  requestJson(`/api/v1/fee-approvals/pending?org_unit_id=${orgUnitId}`);
export const decideDocument = (
  kind: 'discounts' | 'invoice-adjustments',
  id: string,
  approve: boolean,
  reason: string,
) => post(`/api/v1/${kind}/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason });
