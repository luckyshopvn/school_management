import type { SchoolYearDatabase } from '@school-management/database';
import type { PrimaryClassFact, PrimaryStudentFact } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { hasDisability, isEthnicMinority } from '../facilities/emis-calc.js';
import { profileText } from '../statistics/statistics-calc.js';

// Số liệu nền của báo cáo Tiểu học (DT-20 phần 20f, YCTD-165): lớp đang học cấp Tiểu học trong các đơn vị (trống là toàn
// trường), học sinh đang học các lớp đó kèm giới tính, dân tộc, khuyết tật (hồ sơ CSDL ngành), học 2 buổi/ngày, bán trú (hồ
// sơ học sinh hoặc lớp), kết quả cuối năm đã xác nhận, kết quả hoàn thành chương trình (20c, 20e), khen thưởng đã duyệt
export interface PrimaryClassRow extends PrimaryClassFact {
  id: string;
  name: string;
  org_unit_id: string;
}

export interface PrimaryStudentRow extends PrimaryStudentFact {
  id: string;
  class_id: string;
}

export async function loadPrimaryFacts(
  database: Kysely<SchoolYearDatabase>,
  orgUnitIds: string[] | null,
): Promise<{ classes: PrimaryClassRow[]; students: PrimaryStudentRow[] }> {
  const classes = await database
    .selectFrom('classes')
    .select(['id', 'name', 'org_unit_id', 'grade_level', 'two_sessions_per_day', 'boarding'])
    .where('school_level', '=', 'TH')
    .where('status', '=', 'active')
    .$if(orgUnitIds !== null, (query) =>
      query.where('org_unit_id', 'in', [...(orgUnitIds ?? []), '00000000-0000-0000-0000-000000000000']),
    )
    .orderBy('grade_level')
    .orderBy('name')
    .execute();
  const classIds = classes.map((row) => row.id);
  if (classIds.length === 0) {
    return { classes: [], students: [] };
  }
  const [children, yearResults, completion, awards] = await Promise.all([
    database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select([
        'children.id',
        'class_enrollments.class_id',
        'children.gender',
        'children.moet_profile',
        'children.special_needs_note',
        'children.two_sessions_per_day',
        'children.boarding',
      ])
      .where('class_enrollments.class_id', 'in', classIds)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .execute(),
    database
      .selectFrom('year_results')
      .select(['class_id', 'child_id', 'result'])
      .where('class_id', 'in', classIds)
      .execute(),
    database
      .selectFrom('completion_results')
      .select(['class_id', 'child_id', 'outcome'])
      .where('class_id', 'in', classIds)
      .execute(),
    database
      .selectFrom('student_awards')
      .select(['class_id', 'child_id'])
      .where('class_id', 'in', classIds)
      .where('status', '=', 'approved')
      .execute(),
  ]);
  const classById = new Map(classes.map((row) => [row.id, row]));
  const key = (classId: string, childId: string) => `${classId}:${childId}`;
  const results = new Map(yearResults.map((row) => [key(row.class_id, row.child_id), row.result]));
  const outcomes = new Map(completion.map((row) => [key(row.class_id, row.child_id), row.outcome]));
  const awarded = new Set(awards.map((row) => key(row.class_id, row.child_id)));
  return {
    classes: classes.map((row) => ({
      id: row.id,
      name: row.name,
      org_unit_id: row.org_unit_id,
      grade: row.grade_level,
      two_sessions: row.two_sessions_per_day,
      boarding: row.boarding,
    })),
    students: children.map((child) => {
      const classRow = classById.get(child.class_id);
      const profile = child.moet_profile;
      return {
        id: child.id,
        class_id: child.class_id,
        grade: classRow?.grade_level ?? '',
        female: child.gender === 'female',
        ethnic: isEthnicMinority(profileText(profile, 'ethnicity')),
        disabled: hasDisability(profileText(profile, 'disability_type') ?? child.special_needs_note),
        two_sessions: child.two_sessions_per_day || (classRow?.two_sessions_per_day ?? false),
        boarding: child.boarding || (classRow?.boarding ?? false),
        year_result: results.get(key(child.class_id, child.id)) ?? null,
        completion: outcomes.get(key(child.class_id, child.id)) ?? null,
        awarded: awarded.has(key(child.class_id, child.id)),
      };
    }),
  };
}
