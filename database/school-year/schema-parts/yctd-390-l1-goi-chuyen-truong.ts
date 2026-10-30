import type { ColumnType, Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Học bạ, kết quả học kỳ nhận trong gói chuyển trường, lưu chỉ đọc (YCTD-390 lát L1; migration năm học
// 0233_add_student_transfer_packages). Cột thêm vào `student_transfers` khai báo ở StudentTransfersTable của schema.ts
export type ReceivedLearningRecordKind = 'learning_record' | 'term_results';

export interface ReceivedLearningRecordsTable {
  id: Generated<string>;
  transfer_id: string;
  child_id: string;
  package_code: string;
  source_school_name: string;
  kind: ReceivedLearningRecordKind;
  academic_year_name: string;
  class_name: string | null;
  grade_level: string | null;
  school_level: string | null;
  content: ColumnType<Record<string, unknown>, string, string>;
  storage_key: string | null;
  file_sha256: string | null;
  signer_name: string | null;
  signed_at: Date | null;
  created_at: CreatedTimestamp;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    received_learning_records: ReceivedLearningRecordsTable;
  }
}
