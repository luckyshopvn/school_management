import type { ColumnType, Generated } from 'kysely';

// Kho minh chứng dùng chung, lát L1 (YCTD-396; migration hệ thống 0143_create_evidence_store)
export type EvidenceStatus = 'missing' | 'collecting' | 'sufficient' | 'needs_update';
export type EvidenceSourceKind = 'upload' | 'record';
export type EvidenceEventAction =
  'create' | 'update' | 'add_version' | 'link' | 'unlink' | 'delete' | 'import' | 'view_file' | 'download_file';

export interface EvidenceItemsTable {
  id: Generated<string>;
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  description: string | null;
  school_year_names: ColumnType<string[], string[] | undefined, string[]>;
  valid_until: string | null;
  status: Generated<EvidenceStatus>;
  has_personal_data: Generated<boolean>;
  personal_data_permission: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  import_key: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
  updated_at: ColumnType<Date, Date | undefined, Date>;
}

export interface EvidenceVersionsTable {
  id: Generated<string>;
  evidence_id: string;
  version_no: number;
  source_kind: EvidenceSourceKind;
  record_type: string | null;
  record_id: string | null;
  record_school_year: string | null;
  record_label: string | null;
  record_updated_at: Date | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  storage_key: string | null;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EvidenceCodesTable {
  evidence_id: string;
  framework_id: string;
  primary_node_id: string;
  box: number;
  sequence: number;
  code: string;
}

export interface EvidenceNodeLinksTable {
  evidence_id: string;
  framework_id: string;
  node_id: string;
  is_primary: Generated<boolean>;
}

export interface EvidenceEventsTable {
  id: Generated<string>;
  evidence_id: string;
  action: EvidenceEventAction;
  version_no: number | null;
  detail: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface EvidenceImportsTable {
  school_year_database: string;
  evidence_count: number;
  imported_at: ColumnType<Date, Date | undefined, never>;
}

declare module '../schema.js' {
  interface SystemDatabase {
    evidence_items: EvidenceItemsTable;
    evidence_versions: EvidenceVersionsTable;
    evidence_codes: EvidenceCodesTable;
    evidence_node_links: EvidenceNodeLinksTable;
    evidence_events: EvidenceEventsTable;
    evidence_imports: EvidenceImportsTable;
  }
}
