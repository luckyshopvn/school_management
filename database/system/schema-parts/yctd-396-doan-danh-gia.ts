import type { ColumnType, Generated } from 'kysely';

// Giao bộ tiêu chí cho đoàn đánh giá ngoài, lát L8 (YCTD-396; migration hệ thống 0147_create_evidence_review_grants)
export interface EvidenceReviewGrantsTable {
  id: Generated<string>;
  user_id: string;
  user_name: string;
  framework_id: string;
  school_year_name: string;
  valid_until: string;
  note: string | null;
  granted_by: string | null;
  granted_by_name: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    evidence_review_grants: EvidenceReviewGrantsTable;
  }
}
