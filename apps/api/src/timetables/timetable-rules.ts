// Kiểm tra xung đột thời khoá biểu (DT-20 phần 22c1, YCTD-160). Hàm thuần, dùng chung cho ban hành, nhập Excel và máy xếp
// (22c2). Xung đột cứng chặn ban hành; xung đột mềm chỉ cảnh báo. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - cứng: giáo viên dạy hai lớp cùng một tiết; phòng dùng cho hai lớp cùng một tiết; tiết ngoài khung giờ của cấp; ngày ngoài
//   ngày học trong tuần của cấp; môn không có trong chương trình của khối lớp;
// - mềm: số tiết của môn trong tuần khác số tiết của chương trình (thiếu hoặc thừa); tiết chưa có giáo viên; giáo viên của
//   tiết không phải giáo viên được phân công môn đó ở lớp.
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
}

export interface TimetableContext {
  // Tiết có trong khung giờ của cấp
  periods: number[];
  // Ngày học trong tuần của cấp (ISO, 1 là thứ Hai)
  school_days: number[];
  // Số tiết mỗi tuần theo chương trình: lớp → môn → số tiết
  planned: Map<string, Map<string, { subject_name: string; periods: number }>>;
  // Giáo viên được phân công: "lớp:môn" → mã tài khoản giáo viên
  assigned: Map<string, string>;
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
    | 'teacher_not_assigned';
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
    const counts = new Map<string, number>();
    for (const lesson of lessons.filter((item) => item.class_id === classId)) {
      counts.set(lesson.subject_id, (counts.get(lesson.subject_id) ?? 0) + 1);
    }
    for (const [subjectId, plan] of context.planned.get(classId) ?? new Map()) {
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
  return conflicts;
}
