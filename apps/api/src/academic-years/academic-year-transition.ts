import type { FieldError } from '@school-management/server';
import type { Kysely } from 'kysely';

// Mỗi phân hệ đăng ký bước kiểm tra trước khi mở năm học mới và bước chuyển dữ liệu dùng chung (BR-93).
// Ví dụ: cây đơn vị chuyển dữ liệu ở DT-01 phần 4; kiểm tra công nợ trẻ đã thôi học theo BR-89 ở DT-05.
export interface AcademicYearTransitionContext {
  // Trống khi mở năm học đầu tiên của hệ thống
  previousDatabase: Kysely<unknown> | null;
  newDatabase: Kysely<unknown>;
  actorUserId: string;
}

export interface TransitionViolation {
  ruleCode: string;
  message: string;
  details: FieldError[];
}

export interface AcademicYearTransitionStep {
  name: string;
  check?(previousDatabase: Kysely<unknown>): Promise<TransitionViolation | null>;
  carryOver?(context: AcademicYearTransitionContext): Promise<void>;
}

export const ACADEMIC_YEAR_TRANSITION_STEPS = Symbol('ACADEMIC_YEAR_TRANSITION_STEPS');
