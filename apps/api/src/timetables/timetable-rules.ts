// Kiểm tra xung đột thời khoá biểu (DT-20 phần 22c1, YCTD-160). Hàm thuần, dùng chung cho ban hành, nhập Excel và máy xếp
// (22c2). Xung đột cứng chặn ban hành; xung đột mềm chỉ cảnh báo. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - cứng: giáo viên dạy hai lớp cùng một tiết; phòng dùng cho hai lớp cùng một tiết; tiết ngoài khung giờ của cấp; ngày ngoài
//   ngày học trong tuần của cấp; môn không có trong chương trình của khối lớp;
// - mềm: số tiết của môn trong tuần khác số tiết của chương trình (thiếu hoặc thừa); tiết chưa có giáo viên; giáo viên của
//   tiết không phải giáo viên được phân công môn đó ở lớp; giáo viên dạy vào tiết đã báo bận (22c2: máy xếp coi là cứng,
//   chỉnh tay chỉ cảnh báo để trường tự quyết);
// - nhóm học (DT-21 phần 21b, YCTD-169): một lớp có thể có nhiều tiết của các nhóm khác nhau cùng ô; tiết cả lớp (nhóm 0)
//   cùng ô với tiết nhóm là xung đột cứng; giáo viên, phòng trùng tiết tính trên mọi nhóm; môn có quy tắc tiết đôi mà không có
//   hai tiết liền nhau trong ngày, và môn có phòng bộ môn mà ô không dùng phòng đó là cảnh báo.
export interface TimetableLessonInput {
  class_id: string;
  class_name: string;
  weekday: number;
  period_no: number;
  subject_id: string;
  subject_name: string;
  teacher_user_id: string | null;
  teacher_name: string | null;
  room_id: string | null;
  room_name: string | null;
  // 0 hoặc để trống là tiết cả lớp, 1 đến 9 là nhóm học (21b)
  group_no?: number;
}

export interface TimetableContext {
  // Tiết có trong khung giờ của cấp
  periods: number[];
  // Ngày học trong tuần của cấp (ISO, 1 là thứ Hai)
  school_days: number[];
  // Số tiết mỗi tuần theo chương trình: lớp → môn → số tiết
  // `elective`: môn học lựa chọn của THPT, học theo nhóm nên không so số tiết cả lớp với chương trình (21b)
  planned: Map<string, Map<string, { subject_name: string; periods: number; elective?: boolean }>>;
  // Giáo viên được phân công: "lớp:môn" → mã tài khoản giáo viên
  assigned: Map<string, string>;
  // Tiết giáo viên báo bận (22c2): "giáo viên:thứ:tiết"
  busy?: Set<string>;
  // Quy tắc xếp của môn (22c2): tiết đôi, phòng bộ môn
  subject_rules?: Map<string, { double_period: boolean; room_id: string | null; room_name: string | null }>;
}

export interface TimetableConflict {
  severity: 'hard' | 'soft';
  code:
    | 'teacher_clash'
    | 'room_clash'
    | 'period_outside_frame'
    | 'day_outside_week'
    | 'subject_outside_curriculum'
    | 'periods_mismatch'
    | 'missing_teacher'
    | 'teacher_not_assigned'
    | 'teacher_busy'
    | 'class_group_clash'
    | 'double_period_split'
    | 'room_not_subject_room';
  message: string;
  class_id?: string;
  weekday?: number;
  period_no?: number;
}

const DAY = (weekday: number) => (weekday === 7 ? 'Chủ nhật' : `Thứ ${weekday + 1}`);
const SLOT = (lesson: { weekday: number; period_no: number }) => `${DAY(lesson.weekday)} tiết ${lesson.period_no}`;

export function findTimetableConflicts(
  lessons: TimetableLessonInput[],
  context: TimetableContext,
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  const bySlot = new Map<string, TimetableLessonInput[]>();
  for (const lesson of lessons) {
    const key = `${lesson.weekday}:${lesson.period_no}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), lesson]);
    const at = { class_id: lesson.class_id, weekday: lesson.weekday, period_no: lesson.period_no };
    if (!context.periods.includes(lesson.period_no)) {
      conflicts.push({
        severity: 'hard',
        code: 'period_outside_frame',
        message: `${lesson.class_name}: ${SLOT(lesson)} không có trong khung giờ tiết học`,
        ...at,
      });
    }
    if (!context.school_days.includes(lesson.weekday)) {
      conflicts.push({
        severity: 'hard',
        code: 'day_outside_week',
        message: `${lesson.class_name}: ${DAY(lesson.weekday)} không phải ngày học trong tuần`,
        ...at,
      });
    }
    if (!context.planned.get(lesson.class_id)?.has(lesson.subject_id)) {
      conflicts.push({
        severity: 'hard',
        code: 'subject_outside_curriculum',
        message: `${lesson.class_name}: môn ${lesson.subject_name} không có trong chương trình của khối`,
        ...at,
      });
    }
    if (!lesson.teacher_user_id) {
      conflicts.push({
        severity: 'soft',
        code: 'missing_teacher',
        message: `${lesson.class_name}: ${SLOT(lesson)} môn ${lesson.subject_name} chưa có giáo viên`,
        ...at,
      });
    } else {
      if (context.busy?.has(`${lesson.teacher_user_id}:${lesson.weekday}:${lesson.period_no}`)) {
        conflicts.push({
          severity: 'soft',
          code: 'teacher_busy',
          message: `${lesson.class_name}: ${SLOT(lesson)} giáo viên ${lesson.teacher_name ?? ''} đã báo bận`,
          ...at,
        });
      }
      const assigned = context.assigned.get(`${lesson.class_id}:${lesson.subject_id}`);
      if (assigned && assigned !== lesson.teacher_user_id) {
        conflicts.push({
          severity: 'soft',
          code: 'teacher_not_assigned',
          message: `${lesson.class_name}: ${SLOT(lesson)} giáo viên ${lesson.teacher_name ?? ''} không phải giáo viên được phân công môn ${lesson.subject_name}`,
          ...at,
        });
      }
    }
  }
  for (const group of bySlot.values()) {
    const byClass = new Map<string, TimetableLessonInput[]>();
    for (const lesson of group) {
      byClass.set(lesson.class_id, [...(byClass.get(lesson.class_id) ?? []), lesson]);
    }
    for (const sameClass of byClass.values()) {
      const first = sameClass[0] as TimetableLessonInput;
      if (sameClass.length > 1 && sameClass.some((lesson) => (lesson.group_no ?? 0) === 0)) {
        conflicts.push({
          severity: 'hard',
          code: 'class_group_clash',
          message: `${first.class_name}: ${SLOT(first)} vừa có tiết cả lớp vừa có tiết nhóm (${sameClass.map((lesson) => lesson.subject_name).join(', ')})`,
          class_id: first.class_id,
          weekday: first.weekday,
          period_no: first.period_no,
        });
      }
    }
    const teachers = new Map<string, TimetableLessonInput[]>();
    const rooms = new Map<string, TimetableLessonInput[]>();
    for (const lesson of group) {
      if (lesson.teacher_user_id) {
        teachers.set(lesson.teacher_user_id, [...(teachers.get(lesson.teacher_user_id) ?? []), lesson]);
      }
      if (lesson.room_id) {
        rooms.set(lesson.room_id, [...(rooms.get(lesson.room_id) ?? []), lesson]);
      }
    }
    for (const clash of teachers.values()) {
      if (clash.length > 1) {
        const first = clash[0] as TimetableLessonInput;
        conflicts.push({
          severity: 'hard',
          code: 'teacher_clash',
          message: `${first.teacher_name ?? 'Giáo viên'} dạy ${clash.length} lớp cùng ${SLOT(first)}: ${clash.map((lesson) => lesson.class_name).join(', ')}`,
          weekday: first.weekday,
          period_no: first.period_no,
        });
      }
    }
    for (const clash of rooms.values()) {
      if (clash.length > 1) {
        const first = clash[0] as TimetableLessonInput;
        conflicts.push({
          severity: 'hard',
          code: 'room_clash',
          message: `Phòng ${first.room_name ?? ''} dùng cho ${clash.length} lớp cùng ${SLOT(first)}: ${clash.map((lesson) => lesson.class_name).join(', ')}`,
          weekday: first.weekday,
          period_no: first.period_no,
        });
      }
    }
  }
  // Số tiết của từng môn trong tuần so với chương trình, chỉ ở lớp đã có tiết trong bản
  const classesWithLessons = new Map<string, string>();
  for (const lesson of lessons) {
    classesWithLessons.set(lesson.class_id, lesson.class_name);
  }
  for (const [classId, className] of classesWithLessons) {
    // Các nhóm học cùng môn ở cùng ô chỉ tính một tiết
    const slotsOfSubject = new Map<string, Set<string>>();
    for (const lesson of lessons.filter((item) => item.class_id === classId)) {
      const slots = slotsOfSubject.get(lesson.subject_id) ?? new Set<string>();
      slots.add(`${lesson.weekday}:${lesson.period_no}`);
      slotsOfSubject.set(lesson.subject_id, slots);
    }
    const counts = new Map([...slotsOfSubject].map(([subjectId, slots]) => [subjectId, slots.size]));
    for (const [subjectId, plan] of context.planned.get(classId) ?? new Map()) {
      if (plan.elective) {
        continue;
      }
      const actual = counts.get(subjectId) ?? 0;
      // Số tiết lẻ (0,5) làm tròn lên: cách tuần một tiết vẫn cần một ô trong bản
      const expected = Math.ceil(plan.periods);
      if (actual !== expected) {
        conflicts.push({
          severity: 'soft',
          code: 'periods_mismatch',
          message: `${className}: môn ${plan.subject_name} có ${actual} tiết/tuần, chương trình ${plan.periods} tiết`,
          class_id: classId,
        });
      }
    }
  }
  conflicts.push(...subjectRuleConflicts(lessons, context));
  return conflicts;
}

// Tiết đôi và phòng bộ môn của môn (quy tắc 22c2) áp dụng cho từng lớp, nhóm
function subjectRuleConflicts(lessons: TimetableLessonInput[], context: TimetableContext): TimetableConflict[] {
  const rules = context.subject_rules;
  if (!rules || rules.size === 0) {
    return [];
  }
  const conflicts: TimetableConflict[] = [];
  const doubleChecked = new Set<string>();
  for (const lesson of lessons) {
    const rule = rules.get(lesson.subject_id);
    if (!rule) {
      continue;
    }
    if (rule.room_id && lesson.room_id !== rule.room_id) {
      conflicts.push({
        severity: 'soft',
        code: 'room_not_subject_room',
        message: `${lesson.class_name}: ${SLOT(lesson)} môn ${lesson.subject_name} cần học ở phòng ${rule.room_name ?? 'bộ môn'}`,
        class_id: lesson.class_id,
        weekday: lesson.weekday,
        period_no: lesson.period_no,
      });
    }
    if (rule.double_period) {
      const key = `${lesson.class_id}:${lesson.group_no ?? 0}:${lesson.subject_id}`;
      if (doubleChecked.has(key)) {
        continue;
      }
      doubleChecked.add(key);
      const own = lessons.filter(
        (item) =>
          item.class_id === lesson.class_id &&
          (item.group_no ?? 0) === (lesson.group_no ?? 0) &&
          item.subject_id === lesson.subject_id,
      );
      const hasPair = own.some((item) =>
        own.some((other) => other.weekday === item.weekday && other.period_no === item.period_no + 1),
      );
      if (own.length >= 2 && !hasPair) {
        conflicts.push({
          severity: 'soft',
          code: 'double_period_split',
          message: `${lesson.class_name}: môn ${lesson.subject_name} cần có tiết đôi (hai tiết liền nhau trong ngày) nhưng các tiết đang rời nhau`,
          class_id: lesson.class_id,
        });
      }
    }
  }
  return conflicts;
}
