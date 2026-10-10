import { requestJson } from '../session/api-client.js';

// Gọi nhóm điểm cuối tính học phí và hóa đơn của máy chủ API (P05-05, P05-06; YCTD-51)
export const REVIEW_FLAG_LABELS: Record<string, string> = {
  absent_many: 'Vắng từ 5 ngày',
  large_change: 'Chênh hơn 30% so với kỳ trước',
  no_registration: 'Không có dịch vụ và ngày ăn',
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
