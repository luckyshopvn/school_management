import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp, UpdatedTimestamp } from '../schema.js';

// Nền tảng bán thẳng gói gia sư AI cho phụ huynh (YCTD-383 lát L1b; migration nền tảng 0251_create_ai_tutor_sales)
export type PlatformAiTutorOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded' | 'needs_refund';
export type PlatformAiTutorPaymentOutcome = 'activated' | 'already_settled' | 'amount_mismatch' | 'late' | 'unmatched';

// Đồng, số nguyên (bigint trả về dạng chuỗi)
type Money = ColumnType<string, string | number, string | number>;

export interface PlatformAiTutorOrdersTable {
  id: Generated<string>;
  code: string;
  transfer_content: string;
  school_id: string;
  school_name: string;
  child_id: string;
  subscription_id: string;
  buyer_user_id: string;
  buyer_name: string;
  plan_id: string;
  plan_name: string;
  plan_kind: 'monthly' | 'top_up';
  // Chuỗi ngày `YYYY-MM-01` của tháng dùng (gói tháng); trống ở gói lượt
  period_month: ColumnType<string | null, string | null | undefined, string | null>;
  turns: number;
  kind: Generated<'purchase' | 'upgrade'>;
  // Lần nâng ở `ai_tutor_upgrades` của trường (giao dịch nâng gói)
  upgrade_id: string | null;
  amount: Money;
  status: Generated<PlatformAiTutorOrderStatus>;
  pending_expires_at: Date;
  provider: string | null;
  provider_reference: string | null;
  qr_content: string | null;
  paid_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

export interface PlatformAiTutorPaymentsTable {
  id: Generated<string>;
  order_id: string | null;
  provider: string;
  provider_reference: string;
  amount: Money;
  transfer_content: string;
  received_at: Date;
  outcome: PlatformAiTutorPaymentOutcome;
  created_at: CreatedTimestamp;
}

export interface PlatformAiTutorReceiptsTable {
  id: Generated<string>;
  order_id: string;
  number: string;
  payer_name: string;
  school_name: string;
  description: string;
  amount: Money;
  provider: string;
  provider_reference: string;
  issued_at: Date;
}

export interface PlatformAiTutorRefundsTable {
  id: Generated<string>;
  order_id: string;
  amount: Money;
  reason: string;
  operator_id: string;
  operator_name: string;
  created_at: CreatedTimestamp;
}

declare module '../schema.js' {
  interface PlatformDatabase {
    platform_ai_tutor_orders: PlatformAiTutorOrdersTable;
    platform_ai_tutor_payments: PlatformAiTutorPaymentsTable;
    platform_ai_tutor_receipts: PlatformAiTutorReceiptsTable;
    platform_ai_tutor_refunds: PlatformAiTutorRefundsTable;
  }
}
