import type { SchoolYearDatabase } from '@school-management/database';
import type { SecondaryClassFact, SecondaryStudentFact } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { hasDisability, isEthnicMinority } from '../facilities/emis-calc.js';
import { profileText } from '../statistics/statistics-calc.js';

// Số liệu nền của báo cáo THCS, THPT (DT-21 phần 21g, YCTD-175): lớp đang học của cấp trong các đơn vị (trống là toàn
// trường), học sinh đang học các lớp đó kèm giới tính, dân tộc, khuyết tật (hồ sơ CSDL ngành như Mầm non, Tiểu học), nội trú,
// bán trú (hồ sơ học sinh hoặc lớp), xếp loại học tập, rèn luyện cả năm (21c, giáo viên chủ nhiệm đã xác nhận), danh hiệu đã
// duyệt (21e), kết quả lên lớp (21e), mã tổ hợp đang hiệu lực (21a: đã duyệt, hoặc tổ hợp cũ khi đổi còn chờ duyệt), kết quả
// tốt nghiệp đã xác nhận (21f)
export interface SecondaryClassRow extends SecondaryClassFact {
  id: string;
  name: string;
  org_unit_id: string;
}

export interface SecondaryStudentRow extends SecondaryStudentFact {
  id: string;
  class_id: string;
}

export async function loadSecondaryFacts(
  database: Kysely<SchoolYearDatabase>,
  level: 'THCS' | 'THPT',
  orgUnitIds: string[] | null,
): Promise<{ classes: SecondaryClassRow[]; students: SecondaryStudentRow[] }> {
  const classes = await database
    .selectFrom('classes')
    .select(['id', 'name', 'org_unit_id', 'grade_level', 'boarding'])
    .where('school_level', '=', level)
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
  const [children, ratings, completion, awards, combinations, graduation] = await Promise.all([
    database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select([
        'children.id',
        'class_enrollments.class_id',
        'children.gender',
        'children.moet_profile',
        'children.special_needs_note',
        'children.boarding',
      ])
      .where('class_enrollments.class_id', 'in', classIds)
      .where('class_enrollments.is_current', '=', true)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .execute(),
    database
      .selectFrom('term_ratings')
      .select(['class_id', 'child_id', 'learning', 'conduct'])
      .where('class_id', 'in', classIds)
      .where('term_type', '=', 'year')
      .execute(),
    database
      .selectFrom('completion_results')
      .select(['class_id', 'child_id', 'outcome'])
      .where('class_id', 'in', classIds)
      .execute(),
    database
      .selectFrom('student_awards')
      .innerJoin('student_award_titles', 'student_award_titles.id', 'student_awards.title_id')
      .select(['student_awards.class_id', 'student_awards.child_id', 'student_award_titles.basis'])
      .where('student_awards.class_id', 'in', classIds)
      .where('student_awards.status', '=', 'approved')
      .execute(),
    database
      .selectFrom('child_subject_combinations')
      .innerJoin('subject_combinations', (join) =>
        join.on((expression) =>
          expression.or([
            expression.and([
              expression('child_subject_combinations.status', '=', 'approved'),
              expression('subject_combinations.id', '=', expression.ref('child_subject_combinations.combination_id')),
            ]),
            expression.and([
              expression('child_subject_combinations.status', '!=', 'approved'),
              expression(
                'subject_combinations.id',
                '=',
                expression.ref('child_subject_combinations.previous_combination_id'),
              ),
            ]),
          ]),
        ),
      )
      .innerJoin('class_enrollments', 'class_enrollments.child_id', 'child_subject_combinations.child_id')
      .select(['child_subject_combinations.child_id', 'subject_combinations.code'])
      .where('class_enrollments.class_id', 'in', classIds)
      .where('class_enrollments.is_current', '=', true)
      .execute(),
    database
      .selectFrom('graduation_decisions')
      .innerJoin('graduation_candidates', 'graduation_candidates.id', 'graduation_decisions.candidate_id')
      .select(['graduation_candidates.class_id', 'graduation_candidates.child_id', 'graduation_decisions.outcome'])
      .where('graduation_candidates.class_id', 'in', classIds)
      .where('graduation_decisions.status', '=', 'confirmed')
      .execute(),
  ]);
  const classById = new Map(classes.map((row) => [row.id, row]));
  const key = (classId: string, childId: string) => `${classId}:${childId}`;
  const ratingOf = new Map(ratings.map((row) => [key(row.class_id, row.child_id), row]));
  const outcomes = new Map(completion.map((row) => [key(row.class_id, row.child_id), row.outcome]));
  const titles = new Map<string, 'excellent' | 'good'>();
  const awarded = new Set<string>();
  for (const award of awards) {
    const awardKey = key(award.class_id, award.child_id);
    awarded.add(awardKey);
    if (award.basis === 'secondary_excellent') {
      titles.set(awardKey, 'excellent');
    } else if (award.basis === 'secondary_good' && !titles.has(awardKey)) {
      titles.set(awardKey, 'good');
    }
  }
  const combinationOf = new Map(combinations.map((row) => [row.child_id, row.code]));
  const graduationOf = new Map(graduation.map((row) => [key(row.class_id, row.child_id), row.outcome]));
  return {
    classes: classes.map((row) => ({
      id: row.id,
      name: row.name,
      org_unit_id: row.org_unit_id,
      grade: row.grade_level,
      boarding: row.boarding,
    })),
    students: children.map((child) => {
      const classRow = classById.get(child.class_id);
      const profile = child.moet_profile;
      const studentKey = key(child.class_id, child.id);
      const rating = ratingOf.get(studentKey);
      return {
        id: child.id,
        class_id: child.class_id,
        grade: classRow?.grade_level ?? '',
        female: child.gender === 'female',
        ethnic: isEthnicMinority(profileText(profile, 'ethnicity')),
        disabled: hasDisability(profileText(profile, 'disability_type') ?? child.special_needs_note),
        boarding: child.boarding || (classRow?.boarding ?? false),
        learning: rating?.learning ?? null,
        conduct: rating?.conduct ?? null,
        title: titles.get(studentKey) ?? null,
        completion: outcomes.get(studentKey) ?? null,
        combination: combinationOf.get(child.id) ?? null,
        graduation: (graduationOf.get(studentKey) as 'graduated' | 'not_graduated' | undefined) ?? null,
        awarded: awarded.has(studentKey),
      };
    }),
  };
}
