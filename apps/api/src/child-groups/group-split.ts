// Hàm thuần chia nhóm của bộ nhóm (DT-28 phần 28a, YCTD-271; tài liệu 47 mục 20.7). Không đọc cơ sở dữ liệu, không giữ
// trạng thái; cùng đầu vào và cùng hạt cho cùng kết quả để kiểm thử đơn vị và để giáo viên xem trước rồi lưu đúng bản đã xem.
// Mức năng lực chỉ là số tạm trong lúc chia, không lưu, không trả ra (GD-140)

export type SplitMethod = 'random' | 'ability_mixed' | 'ability_tiered' | 'gender_balanced';
export type SplitMode = { by: 'count'; value: number } | { by: 'size'; value: number };

export interface SplitStudent {
  id: string;
  gender: 'male' | 'female' | null;
  // Điểm trung bình môn hoặc thứ bậc mức đạt quy ra số, lớn là giỏi hơn; null khi chưa có
  ability: number | null;
}

export interface SplitOptions {
  method: SplitMethod;
  mode: SplitMode;
  seed: number;
  balanceGender: boolean;
  apart: ReadonlyArray<readonly [string, string]>;
  together: ReadonlyArray<readonly [string, string]>;
}

export interface SplitViolation {
  kind: 'apart' | 'together';
  child_ids: [string, string];
}

export interface SplitResult {
  groups: string[][];
  violations: SplitViolation[];
}

export const MAX_GROUPS_PER_SET = 50;

// Bộ sinh số ngẫu nhiên có hạt (mulberry32): đủ đều cho chia nhóm, lặp lại được theo hạt
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<Item>(items: readonly Item[], random: () => number): Item[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as Item, result[index] as Item];
  }
  return result;
}

// Số nhóm: theo số nhóm (không quá số học sinh) hoặc theo số người mỗi nhóm (làm tròn lên)
export function groupCount(studentCount: number, mode: SplitMode): number {
  if (studentCount === 0 || mode.value < 1) {
    return 0;
  }
  const count = mode.by === 'count' ? Math.min(mode.value, studentCount) : Math.ceil(studentCount / mode.value);
  return Math.min(count, MAX_GROUPS_PER_SET);
}

// Gom các cặp "cùng nhóm" thành cụm (hợp nhất tập rời rạc); học sinh không có trong danh sách bị bỏ qua
function clusters(students: readonly SplitStudent[], together: SplitOptions['together']): SplitStudent[][] {
  const parent = new Map(students.map((student) => [student.id, student.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    parent.set(id, root);
    return root;
  };
  for (const [first, second] of together) {
    if (parent.has(first) && parent.has(second)) {
      parent.set(find(first), find(second));
    }
  }
  const byRoot = new Map<string, SplitStudent[]>();
  for (const student of students) {
    const root = find(student.id);
    byRoot.set(root, [...(byRoot.get(root) ?? []), student]);
  }
  return [...byRoot.values()];
}

const averageAbility = (unit: readonly SplitStudent[]): number | null => {
  const known = unit.map((student) => student.ability).filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0) / known.length;
};

// Cụm có năng lực xếp trước theo năng lực giảm dần (cùng mức thì theo thứ tự ngẫu nhiên đã xáo), cụm chưa có năng lực xếp sau
function byAbility(units: SplitStudent[][]): SplitStudent[][] {
  const ranked = units.map((unit, order) => ({ unit, order, ability: averageAbility(unit) }));
  ranked.sort((first, second) => {
    if (first.ability === null || second.ability === null) {
      return first.ability === second.ability ? first.order - second.order : first.ability === null ? 1 : -1;
    }
    return second.ability - first.ability || first.order - second.order;
  });
  return ranked.map((entry) => entry.unit);
}

// So hai bộ điểm theo thứ tự từ điển: bộ nhỏ hơn là nhóm tốt hơn
function compareScores(first: readonly number[], second: readonly number[]): number {
  for (let index = 0; index < first.length; index += 1) {
    const difference = (first[index] as number) - (second[index] as number);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function findViolations(groups: readonly string[][], options: Pick<SplitOptions, 'apart' | 'together'>) {
  const groupOf = new Map<string, number>();
  groups.forEach((members, index) => members.forEach((id) => groupOf.set(id, index)));
  const violations: SplitViolation[] = [];
  for (const [first, second] of options.apart) {
    if (groupOf.has(first) && groupOf.get(first) === groupOf.get(second)) {
      violations.push({ kind: 'apart', child_ids: [first, second] });
    }
  }
  for (const [first, second] of options.together) {
    if (groupOf.has(first) && groupOf.has(second) && groupOf.get(first) !== groupOf.get(second)) {
      violations.push({ kind: 'together', child_ids: [first, second] });
    }
  }
  return violations;
}

// Chia học sinh thành nhóm theo cách chia. Ngẫu nhiên, trộn năng lực, cân bằng giới dùng cùng một vòng xếp tham lam: lần lượt
// từng cụm, chọn nhóm ít xung đột "không cùng nhóm" nhất, còn chỗ, ít người nhất, rồi (khi cân bằng giới) ít bạn cùng giới
// nhất, rồi (khi trộn năng lực) tổng năng lực thấp nhất. Gom tầng xếp theo năng lực giảm dần rồi cắt liên tiếp
export function splitStudents(students: readonly SplitStudent[], options: SplitOptions): SplitResult {
  const count = groupCount(students.length, options.mode);
  if (count === 0) {
    return { groups: [], violations: [] };
  }
  const random = seededRandom(options.seed);
  const units = shuffle(clusters(shuffle(students, random), options.together), random);
  const capacity = Math.ceil(students.length / count);
  const groups: SplitStudent[][] = Array.from({ length: count }, () => []);

  if (options.method === 'ability_tiered') {
    // Kích thước các nhóm chênh nhau tối đa một người; cụm "cùng nhóm" không bị cắt đôi
    const sizes = Array.from(
      { length: count },
      (_, index) => Math.floor(students.length / count) + (index < students.length % count ? 1 : 0),
    );
    let current = 0;
    for (const unit of byAbility(units)) {
      while (current < count - 1 && (groups[current] as SplitStudent[]).length >= (sizes[current] as number)) {
        current += 1;
      }
      (groups[current] as SplitStudent[]).push(...unit);
    }
  } else {
    const ordered =
      options.method === 'ability_mixed'
        ? byAbility(units)
        : options.method === 'gender_balanced'
          ? [...units].sort((first, second) => second.length - first.length)
          : units;
    const balanceGender = options.balanceGender || options.method === 'gender_balanced';
    const apartOf = new Map<string, Set<string>>();
    for (const [first, second] of options.apart) {
      apartOf.set(first, (apartOf.get(first) ?? new Set()).add(second));
      apartOf.set(second, (apartOf.get(second) ?? new Set()).add(first));
    }
    for (const unit of ordered) {
      const unitIds = unit.map((student) => student.id);
      const genderCount = (members: SplitStudent[]) =>
        unit.reduce(
          (total, student) =>
            total + (student.gender ? members.filter((member) => member.gender === student.gender).length : 0),
          0,
        );
      const scoreOf = (members: SplitStudent[]) => [
        members.filter((member) => unitIds.some((id) => apartOf.get(id)?.has(member.id))).length,
        members.length + unit.length > capacity ? 1 : 0,
        members.length,
        balanceGender ? genderCount(members) : 0,
        options.method === 'ability_mixed' ? members.reduce((total, member) => total + (member.ability ?? 0), 0) : 0,
      ];
      let best = 0;
      let bestScore: number[] | null = null;
      for (const index of shuffle(
        groups.map((_, position) => position),
        random,
      )) {
        const score = scoreOf(groups[index] as SplitStudent[]);
        if (bestScore === null || compareScores(score, bestScore) < 0) {
          best = index;
          bestScore = score;
        }
      }
      (groups[best] as SplitStudent[]).push(...unit);
    }
  }
  const ids = groups.map((members) => members.map((member) => member.id));
  return { groups: ids, violations: findViolations(ids, options) };
}

// Nhóm trưởng: ngẫu nhiên trong nhóm, hoặc người kế tiếp theo thứ tự thành viên khi luân phiên (hết vòng quay về đầu)
export function pickLeader(memberIds: readonly string[], random: () => number): string | null {
  return memberIds.length === 0 ? null : (memberIds[Math.floor(random() * memberIds.length)] as string);
}

export function nextLeader(memberIds: readonly string[], currentLeaderId: string | null): string | null {
  if (memberIds.length === 0) {
    return null;
  }
  const index = currentLeaderId === null ? -1 : memberIds.indexOf(currentLeaderId);
  return memberIds[(index + 1) % memberIds.length] as string;
}

// Bộ nhóm từ tiết nhóm của thời khoá biểu (21b): mỗi số nhóm tiết là một nhóm gồm các môn của nhóm đó; học sinh thuộc nhóm
// khi tổ hợp môn của em có ít nhất một môn của nhóm. Một học sinh có thể thuộc nhiều nhóm (học nhiều môn nhóm khác nhau)
export function timetableGroups(
  lessons: ReadonlyArray<{ group_no: number; subject_id: string; subject_name: string }>,
  students: ReadonlyArray<{ id: string; subject_ids: ReadonlySet<string> }>,
): Array<{ name: string; group_no: number; child_ids: string[] }> {
  const subjectsByGroup = new Map<number, Map<string, string>>();
  for (const lesson of lessons) {
    if (lesson.group_no > 0) {
      const subjects = subjectsByGroup.get(lesson.group_no) ?? new Map<string, string>();
      subjects.set(lesson.subject_id, lesson.subject_name);
      subjectsByGroup.set(lesson.group_no, subjects);
    }
  }
  return [...subjectsByGroup.entries()]
    .sort(([first], [second]) => first - second)
    .map(([groupNo, subjects]) => ({
      name: `Nhóm ${groupNo}: ${[...subjects.values()].sort((a, b) => a.localeCompare(b, 'vi')).join(', ')}`.slice(
        0,
        60,
      ),
      group_no: groupNo,
      child_ids: students
        .filter((student) => [...subjects.keys()].some((subjectId) => student.subject_ids.has(subjectId)))
        .map((student) => student.id),
    }));
}
