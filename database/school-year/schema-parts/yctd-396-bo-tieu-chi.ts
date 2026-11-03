import type { Generated } from 'kysely';

// Bộ tiêu chí nhiều loại (YCTD-396 lát L3; migration năm học 0247_add_quality_framework_kind): cột thêm vào bảng có sẵn
export type QualityFrameworkKind =
  | 'accreditation'
  | 'teacher_standard'
  | 'principal_standard'
  | 'emulation'
  | 'safe_school'
  | 'school_year_plan'
  | 'other';
export type QualityFrameworkSubject = 'school' | 'person';

declare module '../schema.js' {
  interface QualityFrameworksTable {
    kind: Generated<QualityFrameworkKind>;
    subject: Generated<QualityFrameworkSubject>;
    code_pattern: Generated<string>;
    cycle_years: Generated<number>;
    template_version: string | null;
  }
}
