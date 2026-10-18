import { ApiError, requestJson } from '../session/api-client.js';

// Gọi các điểm cuối kho, tài sản và mua hàng (P13; YCTD-77)
export interface Supplier {
  id: string;
  org_unit_id: string;
  name: string;
  tax_code: string | null;
  contact_name: string | null;
  phone: string | null;
  payment_terms: string | null;
  status: 'active' | 'inactive';
}

export interface StockItem {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  unit: string;
  min_qty: number;
  current_qty: number;
  below_minimum: boolean;
  status: 'active' | 'inactive';
}

export interface StockTransaction {
  id: string;
  code: string;
  item_code: string;
  item_name: string;
  unit: string;
  transaction_type: 'opening' | 'receipt' | 'issue' | 'count_adjustment' | 'carry_over';
  quantity: number;
  balance_after: number;
  transaction_date: string;
  note: string | null;
}

export interface StockCount {
  id: string;
  code: string;
  org_unit_id: string;
  count_date: string;
  status: 'matched' | 'pending' | 'approved' | 'rejected';
  created_by: string;
  reject_reason: string | null;
  lines?: Array<{
    stock_item_id: string;
    item_code: string;
    item_name: string;
    system_qty: number;
    actual_qty: number;
    difference: number;
  }>;
}

export interface Asset {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  original_cost: number;
  purchase_date: string;
  location_type: 'store' | 'room' | 'class' | 'staff' | 'unit';
  location_name: string | null;
  status: 'in_stock' | 'assigned' | 'on_loan' | 'damaged' | 'lost' | 'disposed';
  // Thiết bị dạy học gắn với tài sản (DT-16 phần 16i)
  equipment_item_id: string | null;
}

export interface AssetDetail extends Asset {
  assignments: Array<{
    id: string;
    code: string;
    assigned_to_name: string;
    assigned_on: string;
    returned_on: string | null;
  }>;
  loans: Array<{ id: string; code: string; borrower_name: string; due_date: string; status: string; overdue: boolean }>;
  damages: Array<{ id: string; code: string; incident_type: string; status: string; description: string }>;
}

export interface AssetDamage {
  id: string;
  code: string;
  asset_code: string;
  asset_name: string;
  incident_type: 'damaged' | 'lost';
  severity: 'minor' | 'major' | 'total';
  description: string;
  proposed_handling: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PurchaseRequestItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  estimated_price: number;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  org_unit_id: string;
  requester_name: string;
  needed_by: string;
  reason: string;
  total_amount: number;
  requires_principal: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'ordered';
  reject_reason: string | null;
  items?: PurchaseRequestItem[];
}

export interface PurchaseOrder {
  id: string;
  code: string;
  org_unit_id: string;
  request_code: string;
  supplier_name: string;
  order_date: string;
  total_amount: number;
  status: 'ordered' | 'received';
  payment_status: 'awaiting_payment' | 'paid';
  payment_code: string | null;
}

export const ASSET_STATUS_LABELS: Record<Asset['status'], string> = {
  in_stock: 'Trong kho',
  assigned: 'Đang cấp phát',
  on_loan: 'Đang cho mượn',
  damaged: 'Hỏng',
  lost: 'Mất',
  disposed: 'Đã thanh lý',
};
export const REQUEST_STATUS_LABELS: Record<PurchaseRequest['status'], string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
  ordered: 'Đã lập phiếu mua',
};
export const COUNT_STATUS_LABELS: Record<StockCount['status'], string> = {
  matched: 'Khớp',
  pending: 'Chênh lệch, chờ duyệt',
  approved: 'Đã duyệt điều chỉnh',
  rejected: 'Bị từ chối',
};
export const TRANSACTION_LABELS: Record<StockTransaction['transaction_type'], string> = {
  opening: 'Tồn ban đầu',
  receipt: 'Nhập',
  issue: 'Xuất',
  count_adjustment: 'Điều chỉnh kiểm kê',
  carry_over: 'Chuyển năm',
};

export const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đồng`;
export const vietnamToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? [error.message, ...error.details.map((detail) => detail.message)].join('. ')
    : 'Không kết nối được tới máy chủ, vui lòng thử lại';
}

export const getJson = <Result>(path: string) => requestJson<Result>(path);
export const postJson = <Result>(path: string, body: unknown, method = 'POST') =>
  requestJson<Result>(path, { method, body: JSON.stringify(body) });
