import type { ColumnType, Generated } from 'kysely';
import type { AiTutorSchoolLevel } from './yctd-383-gia-su-ai.js';

// Cài đặt gia sư AI của trường, lát L1a trường bán (YCTD-383; migration hệ thống 0132_create_ai_tutor_school_settings)
export interface AiTutorSchoolSettingsTable {
  id: Generated<number>;
  enabled_levels: ColumnType<AiTutorSchoolLevel[], AiTutorSchoolLevel[] | undefined, AiTutorSchoolLevel[]>;
  // Giờ Việt Nam dạng `HH:MM`
  quiet_start: Generated<string>;
  quiet_end: Generated<string>;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    ai_tutor_school_settings: AiTutorSchoolSettingsTable;
  }
}
