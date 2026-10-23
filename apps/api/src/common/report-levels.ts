import type { SchoolYearDatabase } from '@school-management/database';
import { validationError, type FieldError } from '@school-management/server';
import {
  ALL_SCHOOL_LEVELS,
  SCHOOL_LEVEL_PARAMETER,
  isSchoolLevelCode,
  type SchoolLevelCode,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import type { SchoolLevelResolver } from './school-levels.js';

// Tham số cấp dùng chung của thống kê, báo cáo (DT-19 phần 19d, YCTD-154), cùng tham số `school_level` với cấp đang làm việc
// ở thanh đầu trang (19c). Trả danh sách cấp cần lọc, hoặc null là không lọc:
// - có mã cấp: chỉ cấp đó (phải đang bật và trong phạm vi cấp của người dùng, kiểm như SchoolLevelResolver.requested);
// - không có tham số, trống hoặc `all`: các cấp người dùng được xem; chỉ lọc khi danh sách này hẹp hơn mọi cấp đang bật (người dùng có phạm vi
//   cấp), còn lại không lọc để trường một cấp, người xem mọi cấp nhận đúng kết quả như trước (kể cả trẻ chưa xếp lớp)
export type LevelFilter = SchoolLevelCode[] | null;

export function readLevelParameter(
  query: Record<string, unknown> | undefined,
  errors: FieldError[],
): SchoolLevelCode | undefined {
  const value = query?.[SCHOOL_LEVEL_PARAMETER];
  if (value === undefined || value === null || value === '' || value === ALL_SCHOOL_LEVELS) {
    return undefined;
  }
  if (!isSchoolLevelCode(value)) {
    errors.push({ field: SCHOOL_LEVEL_PARAMETER, message: 'Mã cấp là MN, TH, THCS, THPT hoặc all' });
    return undefined;
  }
  return value;
}

export async function resolveLevelFilter(
  resolver: SchoolLevelResolver,
  currentUser: CurrentUser,
  requested: SchoolLevelCode | undefined,
): Promise<LevelFilter> {
  if (requested) {
    return resolver.requested(currentUser, requested);
  }
  const [enabled, visible] = await Promise.all([resolver.enabled(), resolver.forUser(currentUser)]);
  return visible.length < enabled.length ? visible : null;
}

// Đọc tham số cấp và trả bộ lọc; tham số sai trả ERR_VALIDATION
export async function readLevelFilter(
  resolver: SchoolLevelResolver,
  currentUser: CurrentUser,
  query: Record<string, unknown> | undefined,
): Promise<LevelFilter> {
  const errors: FieldError[] = [];
  const requested = readLevelParameter(query, errors);
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return resolveLevelFilter(resolver, currentUser, requested);
}

// Mã các lớp thuộc bộ lọc (null là mọi lớp), để lọc trẻ theo lớp đang học
export async function classIdsOfLevels(
  database: Kysely<SchoolYearDatabase>,
  levels: LevelFilter,
): Promise<Set<string> | null> {
  if (levels === null) {
    return null;
  }
  const rows = await database.selectFrom('classes').select('id').where('school_level', 'in', levels).execute();
  return new Set(rows.map((row) => row.id));
}

// Biểu mẫu, báo cáo riêng của Mầm non (EMIS, tăng trưởng theo tháng tuổi, hồ sơ cuối cấp) chỉ tính lớp và trẻ của cấp Mầm
// non: lớp ngoài cấp và trẻ đang học lớp ngoài cấp bị bỏ qua; trẻ chưa xếp lớp vẫn tính như trước (YCTD-154)
export async function classIdsOutsideLevel(
  database: Kysely<SchoolYearDatabase>,
  level: SchoolLevelCode,
): Promise<Set<string>> {
  const rows = await database.selectFrom('classes').select('id').where('school_level', '!=', level).execute();
  return new Set(rows.map((row) => row.id));
}

export async function childIdsOutsideLevel(
  database: Kysely<SchoolYearDatabase>,
  level: SchoolLevelCode,
): Promise<Set<string>> {
  const rows = await database
    .selectFrom('class_enrollments')
    .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .select('class_enrollments.child_id')
    .where('class_enrollments.is_current', '=', true)
    .where('classes.school_level', '!=', level)
    .execute();
  return new Set(rows.map((row) => row.child_id));
}
