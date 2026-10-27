import type { ColumnType, Generated } from 'kysely';
import type { UpdatedTimestamp } from '../schema.js';

// Gói SCORM (DT-28 phần 28h, YCTD-278). Mẫu tệp kiểu bảng riêng của một phần (YCTD-294): khai báo kiểu bảng, rồi thêm bảng vào
// SchoolYearDatabase bằng declare module; không sửa schema.ts

// Lượt chạy gói SCORM của học sinh
export interface ScormAttemptsTable {
  id: Generated<string>;
  activity_id: string;
  child_id: string;
  package_id: string;
  sco_identifier: string;
  completion: Generated<'unknown' | 'not_attempted' | 'incomplete' | 'completed'>;
  success: Generated<'unknown' | 'passed' | 'failed'>;
  score: ColumnType<string | null, string | number | null | undefined, string | number | null>;
  total_seconds: Generated<number>;
  session_count: Generated<number>;
  location: string | null;
  suspend_data: string | null;
  updated_at: UpdatedTimestamp;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    scorm_attempts: ScormAttemptsTable;
  }
}
