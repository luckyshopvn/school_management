import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp, UpdatedTimestamp } from '../schema.js';

// Gói gia sư AI do nền tảng bán thẳng cho phụ huynh (YCTD-383 lát L0; migration nền tảng 0250_create_ai_tutor_plans)
export interface PlatformAiTutorPlansTable {
  id: Generated<string>;
  kind: 'monthly' | 'top_up';
  name: string;
  // Đồng, số nguyên (bigint trả về dạng chuỗi)
  price: ColumnType<string, string | number, string | number>;
  turns: number;
  allow_images: Generated<boolean>;
  school_levels: ColumnType<Array<'TH' | 'THCS' | 'THPT'>>;
  status: Generated<'active' | 'archived'>;
  created_by: string;
  created_by_name: string;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
}

declare module '../schema.js' {
  interface PlatformDatabase {
    platform_ai_tutor_plans: PlatformAiTutorPlansTable;
  }
}
