import type { Generated } from 'kysely';
import type { CreatedTimestamp } from '../schema.js';

// Huy hiệu, chứng nhận hoàn thành (DT-28 phần 28i, YCTD-279)
export type LearningBadgeKind = 'section_complete' | 'course_complete' | 'on_time_streak' | 'teacher_award';

export interface LearningBadgesTable {
  id: Generated<string>;
  child_id: string;
  space_id: string;
  kind: LearningBadgeKind;
  section_id: string | null;
  criterion_key: string | null;
  title: string;
  reason: string | null;
  awarded_by: string | null;
  awarded_by_name: string | null;
  awarded_at: CreatedTimestamp;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface CourseCertificatesTable {
  id: Generated<string>;
  code: string;
  child_id: string;
  space_id: string;
  course_title: string;
  school_name: string;
  holder_name: string;
  holder_short_name: string;
  issued_at: CreatedTimestamp;
  issued_by: string;
  issued_by_name: string;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

declare module '../schema.js' {
  interface SchoolYearDatabase {
    learning_badges: LearningBadgesTable;
    course_certificates: CourseCertificatesTable;
  }
}
