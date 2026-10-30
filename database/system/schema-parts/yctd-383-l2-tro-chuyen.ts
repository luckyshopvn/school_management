import type { ColumnType, Generated } from 'kysely';

// Gia sư AI trả phí, lát L2 trò chuyện bằng chữ (YCTD-383; migration hệ thống 0133_add_ai_tutor_chat). Cột mới của `ai_tutor_messages`
// khai ở `yctd-383-gia-su-ai.ts`
export type AiTutorSafetyFlagKind = 'self_harm' | 'bullying';

export interface AiTutorSafetyFlagsTable {
  id: Generated<string>;
  child_id: string;
  conversation_id: string;
  message_id: string;
  kind: AiTutorSafetyFlagKind;
  created_at: ColumnType<Date, Date | undefined, never>;
  notified_at: Date | null;
  // Lát L3 (migration hệ thống 0134_add_ai_tutor_safety_flag_resolution): giáo viên đánh dấu đã xử lý
  resolved_at: Date | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
}

declare module '../schema.js' {
  interface SystemDatabase {
    ai_tutor_safety_flags: AiTutorSafetyFlagsTable;
  }
}
