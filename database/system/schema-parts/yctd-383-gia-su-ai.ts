import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp, UpdatedTimestamp } from '../schema.js';

// Gia sư AI trả phí trong ứng dụng học sinh, lát L0 (YCTD-383; migration hệ thống 0130_create_ai_tutor)
export type AiTutorPlanKind = 'monthly' | 'top_up';
export type AiTutorPlanSource = 'school' | 'platform';
export type AiTutorSchoolLevel = 'TH' | 'THCS' | 'THPT';
export type AiTutorSubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'refunded';
export type AiTutorTurnStatus = 'held' | 'captured' | 'released';

type Money = ColumnType<string, string | number, string | number>;
type Levels = ColumnType<AiTutorSchoolLevel[], AiTutorSchoolLevel[], AiTutorSchoolLevel[]>;

// Gói do trường bán (nguồn `school`)
export interface AiTutorPlansTable {
  id: Generated<string>;
  kind: AiTutorPlanKind;
  name: string;
  price: Money;
  turns: number;
  allow_images: Generated<boolean>;
  school_levels: Levels;
  status: Generated<'active' | 'archived'>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Mỗi lần mua cho một con, cả hai nguồn; số lượt đã dùng, đang tạm giữ nằm trên dòng
export interface AiTutorSubscriptionsTable {
  id: Generated<string>;
  child_id: string;
  plan_source: AiTutorPlanSource;
  plan_id: string;
  plan_kind: AiTutorPlanKind;
  plan_name: string;
  price: Money;
  allow_images: boolean;
  // Chuỗi ngày `YYYY-MM-01` của tháng dùng (gói tháng); trống ở gói lượt
  period_month: ColumnType<string | null, string | null | undefined, string | null>;
  status: Generated<AiTutorSubscriptionStatus>;
  pending_expires_at: Date | null;
  buyer_user_id: string;
  buyer_name: string;
  external_reference: string | null;
  turns: number;
  used_turns: Generated<number>;
  held_turns: Generated<number>;
  valid_from: Date | null;
  valid_until: Date | null;
  activated_at: Date | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

// Sổ lượt: tạm giữ trước khi gọi AI, trừ thật sau khi gọi, hoàn khi lỗi
export interface AiTutorTurnLedgerTable {
  id: Generated<string>;
  child_id: string;
  subscription_id: string;
  status: Generated<AiTutorTurnStatus>;
  held_at: ColumnType<Date, Date | undefined, never>;
  settled_at: Date | null;
  release_reason: string | null;
}

export interface AiTutorConversationsTable {
  id: Generated<string>;
  child_id: string;
  school_level: AiTutorSchoolLevel;
  grade_level_code: string;
  subject_code: string;
  subject_name: string;
  topic: string | null;
  created_at: CreatedTimestamp;
  last_message_at: UpdatedTimestamp;
}

export interface AiTutorMessagesTable {
  id: Generated<string>;
  conversation_id: string;
  role: 'student' | 'tutor';
  body: string;
  ledger_entry_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: CreatedTimestamp;
}

declare module '../schema.js' {
  interface SystemDatabase {
    ai_tutor_plans: AiTutorPlansTable;
    ai_tutor_subscriptions: AiTutorSubscriptionsTable;
    ai_tutor_turn_ledger: AiTutorTurnLedgerTable;
    ai_tutor_conversations: AiTutorConversationsTable;
    ai_tutor_messages: AiTutorMessagesTable;
  }
}
