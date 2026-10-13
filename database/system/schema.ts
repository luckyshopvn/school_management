import type { ColumnType, Generated } from 'kysely';

// Kiểu dữ liệu các bảng của cơ sở dữ liệu hệ thống, khớp với tệp thay đổi cấu trúc
type CreatedTimestamp = ColumnType<Date, Date | undefined, never>;
type UpdatedTimestamp = ColumnType<Date, Date | undefined, Date>;
type DateText = ColumnType<string, string, string>;

export type AcademicYearStatus = 'draft' | 'open' | 'closed';
export type AcademicTermType = 'first_term' | 'second_term' | 'summer_term';
export type AcademicYearDatabaseStatus = 'active' | 'read_only';

export interface AcademicYearsTable {
  id: Generated<string>;
  name: string;
  start_date: ColumnType<string | null, string | null | undefined, string | null>;
  end_date: ColumnType<string | null, string | null | undefined, string | null>;
  school_days_of_week: ColumnType<number[], number[] | undefined, number[]>;
  status: Generated<AcademicYearStatus>;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface AcademicTermsTable {
  id: Generated<string>;
  academic_year_id: string;
  term_type: AcademicTermType;
  start_date: DateText;
  end_date: DateText;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface SchoolWeeksTable {
  id: Generated<string>;
  academic_year_id: string;
  week_no: number;
  start_date: DateText;
  end_date: DateText;
  is_off: Generated<boolean>;
  note: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export interface AcademicYearDatabasesTable {
  id: Generated<string>;
  academic_year_id: string;
  database_name: string;
  status: AcademicYearDatabaseStatus;
  opened_at: Date;
  closed_at: Date | null;
  carried_over_by: string | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  created_by: string | null;
}

export type IntegrationCredentialConnector = 'zalo';

// Khóa truy cập kết nối ngoài đã mã hóa, dùng chung toàn trường qua các năm học (YCTD-92)
export interface IntegrationCredentialsTable {
  connector: IntegrationCredentialConnector;
  id: Generated<string>;
  access_token_encrypted: string | null;
  access_token_expires_at: Date | null;
  refresh_token_encrypted: string | null;
  refreshed_at: Date | null;
  created_at: CreatedTimestamp;
  updated_at: UpdatedTimestamp;
  updated_by: string | null;
}

export interface SystemDatabase {
  academic_years: AcademicYearsTable;
  academic_terms: AcademicTermsTable;
  school_weeks: SchoolWeeksTable;
  academic_year_databases: AcademicYearDatabasesTable;
  integration_credentials: IntegrationCredentialsTable;
}
