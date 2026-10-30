import type { ColumnType, Generated } from 'kysely';

// Biểu thống kê Thông tư 25/2024, khung biểu nhiều phần (YCTD-385 lát L1; migration hệ thống 0134_add_report_form_sections).
// Thêm cột vào `report_forms`, `report_form_rows` khai ở `schema.ts`
export type ReportFormSource = 'custom' | 'tt25' | 'eqms';

export interface ReportFormSectionValue {
  code: string;
  name: string;
  columns: Array<{ key: string; label: string; public_only?: boolean }>;
  ownership_groups: boolean;
}

declare module '../schema.js' {
  interface ReportFormsTable {
    source: Generated<ReportFormSource>;
    form_number: string | null;
    sections: ColumnType<ReportFormSectionValue[] | null, string | null | undefined, string | null>;
    archived: Generated<boolean>;
  }
  interface ReportFormRowsTable {
    section: Generated<string>;
  }
}
