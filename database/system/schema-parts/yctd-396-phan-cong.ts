import type { ColumnType, Generated } from 'kysely';

// Phân công phụ trách tiêu chí, lát L4 (YCTD-396; migration hệ thống 0145_create_evidence_assignments)
export interface EvidenceAssignmentsTable {
  id: Generated<string>;
  framework_id: string;
  node_id: string;
  school_year_name: string;
  user_id: string;
  user_name: string;
  due_date: string | null;
  note: string | null;
  assigned_by: string | null;
  assigned_by_name: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    evidence_assignments: EvidenceAssignmentsTable;
  }
}
