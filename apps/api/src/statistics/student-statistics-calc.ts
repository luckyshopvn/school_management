import { EYE_CONDITIONS } from '@school-management/shared';
import { hasDisability, isEthnicMinority } from '../facilities/emis-calc.js';
import { foldText } from '../imports/moet-columns.js';
import { summarizeTermHealth } from '../health/student-health-calc.js';
import { AGE_GROUPS, breakdown, percentOf, type AgeGroupKey } from './statistics-calc.js';

// Thống kê học sinh đủ các phần của mục 5.3 hệ thống Sở (DT-16 phần 16h): trẻ trong độ tuổi theo nhóm, lớp; biểu đồ hoàn
// thành chương trình (số lớp, số trẻ 5–6 tuổi, nữ, khuyết tật, dân tộc, con thương binh liệt sĩ); diện chính sách theo độ
// tuổi; biết bơi, bệnh về mắt theo học kỳ; học sinh dân tộc. Hàm thuần, không đọc cơ sở dữ liệu
export interface StudentFacts {
  id: string;
  full_name: string;
  dob: string;
  gender: 'male' | 'female';
  org_unit_name: string;
  class_id: string | null;
  class_name: string | null;
  // Tháng tuổi bắt đầu của bậc học của lớp; lớp mẫu giáo 5–6 tuổi từ 60 tháng (như mục 4.4)
  class_age_from_months: number | null;
  age_group: AgeGroupKey;
  ethnicity: string | null;
  disability: string | null;
  policy: string | null;
  profile_can_swim: boolean;
  completion: 'completed' | 'not_completed' | null;
  // Thông tin sức khỏe của học kỳ đang xem (mục 4.6); chưa nhập thì null
  term_record: { can_swim: boolean | null; eye_conditions: string[]; physical_education: string | null } | null;
}

export const COMPLETION_MINIMUM_MONTHS = 60;

// Con thương binh, liệt sĩ: đối tượng chính sách có chữ "thương binh" hoặc "liệt sĩ" (Claude tự chọn cách nhận biết theo ủy
// quyền của Eric ngày 2026-10-11, vì tệp CSDL ngành ghi đối tượng chính sách dạng chữ)
export function isMartyrFamily(policy: string | null): boolean {
  const value = foldText(policy ?? '');
  return value.includes('thuong binh') || value.includes('liet si');
}

const female = <T extends { gender: string }>(rows: T[]) => rows.filter((row) => row.gender === 'female').length;
const visibleGroups = AGE_GROUPS.filter((group) => group.key !== 'under_3_months' && group.key !== 'over_6');

function ageCounts(rows: StudentFacts[]) {
  return Object.fromEntries(
    AGE_GROUPS.map((group) => [group.key, rows.filter((row) => row.age_group === group.key).length]),
  ) as Record<AgeGroupKey, number>;
}

// Biết bơi trong học kỳ: theo thông tin sức khỏe của học kỳ, chưa ghi thì theo hồ sơ (tệp CSDL ngành)
export const canSwimInTerm = (row: StudentFacts) => row.term_record?.can_swim ?? row.profile_can_swim;

export function buildStudentStatistics(rows: StudentFacts[]) {
  // Trẻ trong độ tuổi theo nhóm tuổi và lớp
  const classMap = new Map<string, StudentFacts[]>();
  for (const row of rows) {
    const key = row.class_id ?? '';
    classMap.set(key, [...(classMap.get(key) ?? []), row]);
  }
  const byClass = [...classMap.entries()]
    .map(([classId, members]) => ({
      class_id: classId || null,
      class_name: members[0]?.class_name ?? 'Chưa xếp lớp',
      org_unit_name: members[0]?.org_unit_name ?? '',
      total: members.length,
      female: female(members),
      ages: ageCounts(members),
    }))
    .sort(
      (a, b) => a.org_unit_name.localeCompare(b.org_unit_name, 'vi') || a.class_name.localeCompare(b.class_name, 'vi'),
    );

  // Hoàn thành chương trình: lớp mẫu giáo 5–6 tuổi và trẻ đang học trong các lớp đó
  const eligible = rows.filter(
    (row) => row.class_id !== null && (row.class_age_from_months ?? 0) >= COMPLETION_MINIMUM_MONTHS,
  );
  const completionOf = (members: StudentFacts[]) => ({
    count: members.length,
    completed: members.filter((row) => row.completion === 'completed').length,
    not_completed: members.filter((row) => row.completion === 'not_completed').length,
    percent: percentOf(members.filter((row) => row.completion === 'completed').length, members.length),
  });
  const completion = {
    class_count: new Set(eligible.map((row) => row.class_id)).size,
    categories: [
      { key: 'children', label: 'Số trẻ 5–6 tuổi', ...completionOf(eligible) },
      { key: 'female', label: 'Nữ', ...completionOf(eligible.filter((row) => row.gender === 'female')) },
      {
        key: 'disabled',
        label: 'Khuyết tật',
        ...completionOf(eligible.filter((row) => hasDisability(row.disability))),
      },
      {
        key: 'ethnic',
        label: 'Dân tộc thiểu số',
        ...completionOf(eligible.filter((row) => isEthnicMinority(row.ethnicity))),
      },
      {
        key: 'martyr_family',
        label: 'Con thương binh, liệt sĩ',
        ...completionOf(eligible.filter((row) => isMartyrFamily(row.policy))),
      },
    ],
  };

  // Diện chính sách theo độ tuổi
  const policyRows = rows.filter((row) => row.policy !== null && row.policy.trim() !== '');
  const policyValues = [...new Set(policyRows.map((row) => (row.policy ?? '').trim()))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
  const policyByAge = policyValues.map((value) => {
    const members = policyRows.filter((row) => (row.policy ?? '').trim() === value);
    return { value, total: members.length, female: female(members), ages: ageCounts(members) };
  });

  // Biết bơi, bệnh về mắt theo học kỳ, chia theo nhóm tuổi
  const termFacts = (members: StudentFacts[]) =>
    summarizeTermHealth(
      members.map((row) => ({
        gender: row.gender,
        can_swim: canSwimInTerm(row),
        eye_conditions: row.term_record?.eye_conditions ?? [],
        physical_education: row.term_record?.physical_education ?? null,
      })),
    );
  const termHealth = {
    recorded: rows.filter((row) => row.term_record !== null).length,
    totals: termFacts(rows),
    by_age: visibleGroups
      .map((group) => {
        const members = rows.filter((row) => row.age_group === group.key);
        return { key: group.key, label: group.label, total: members.length, ...termFacts(members) };
      })
      .filter((group) => group.total > 0),
  };

  // Học sinh dân tộc thiểu số: theo dân tộc và nhóm tuổi, kèm danh sách
  const ethnicRows = rows.filter((row) => isEthnicMinority(row.ethnicity));
  const ethnicValues = [...new Set(ethnicRows.map((row) => (row.ethnicity ?? '').trim()))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
  const ethnic = {
    count: ethnicRows.length,
    female: female(ethnicRows),
    by_ethnicity: ethnicValues.map((value) => {
      const members = ethnicRows.filter((row) => (row.ethnicity ?? '').trim() === value);
      return { value, total: members.length, female: female(members), ages: ageCounts(members) };
    }),
    students: ethnicRows.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      dob: row.dob,
      gender: row.gender,
      org_unit_name: row.org_unit_name,
      class_name: row.class_name,
      ethnicity: row.ethnicity,
    })),
  };

  return {
    totals: { children_count: rows.length, female_count: female(rows) },
    age_groups: visibleGroups.map((group) => ({ key: group.key, label: group.label })),
    by_age: AGE_GROUPS.map((group) => {
      const members = rows.filter((row) => row.age_group === group.key);
      return {
        key: group.key,
        label: group.label,
        count: members.length,
        female: female(members),
        percent: percentOf(members.length, rows.length),
      };
    }).filter((group) => group.count > 0 || (group.key !== 'under_3_months' && group.key !== 'over_6')),
    by_class: byClass,
    by_ethnicity: breakdown(rows, (row) => row.ethnicity),
    completion,
    policy_by_age: policyByAge,
    term_health: termHealth,
    ethnic,
    eye_condition_labels: EYE_CONDITIONS.map((item) => ({ value: item.value, label: item.label })),
  };
}

export type StudentStatistics = ReturnType<typeof buildStudentStatistics>;
