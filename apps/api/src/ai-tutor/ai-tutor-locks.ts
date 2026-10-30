import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { sql, type Kysely } from 'kysely';
import { submitCheck } from '../learning/assignments/assignment-rules.js';
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START } from './school-sales-rules.js';

// Nguồn dữ liệu của các khóa gia sư AI lát L3 (YCTD-383, Q7). Chỉ đọc bảng có sẵn, không tạo hệ thống thi mới:
// - thi trực tuyến DT-23 (`exam_attempts`, `exam_rooms`, `exam_room_students`, `exam_assignments`, `exam_assignment_targets`);
// - bài tập trực tuyến DT-28 (`assignments.ai_blocked`, `assignment_recipients`, `assignment_submissions`, `course_activities`);
// - cài đặt Gia sư AI của trường (`ai_tutor_school_settings`, migration hệ thống 0132).
// Gia sư AI chưa có ngữ cảnh bài tập (em hỏi theo môn), nên khóa theo cách chặt chẽ hơn: khóa toàn bộ gia sư trong thời gian bài tập
// không dùng AI còn mở với em (em còn nộp được theo đúng quy tắc nộp bài của bài tập)
type YearDatabase = Kysely<SchoolYearDatabase>;

// Bài kiểm tra trực tuyến làm em bị khóa: lượt đang làm chưa hết giờ, em có tên trong phòng thi đang mở, hoặc bài giao cho lớp hay cho
// em đang trong giờ mở mà em còn lượt làm (lượt đã nộp hoặc đã hết giờ tính là đã dùng)
export async function activeExamFor(
  database: YearDatabase,
  student: { childId: string; classId: string | null },
  now: Date,
): Promise<{ title: string } | null> {
  const attempt = await database
    .selectFrom('exam_attempts')
    .innerJoin('exam_assignments', 'exam_assignments.id', 'exam_attempts.assignment_id')
    .select('exam_assignments.title')
    .where('exam_attempts.child_id', '=', student.childId)
    .where('exam_attempts.status', '=', 'in_progress')
    .where('exam_attempts.deadline_at', '>', now)
    .executeTakeFirst();
  if (attempt) {
    return attempt;
  }
  const room = await database
    .selectFrom('exam_room_students')
    .innerJoin('exam_rooms', 'exam_rooms.id', 'exam_room_students.room_id')
    .innerJoin('exam_assignments', 'exam_assignments.id', 'exam_rooms.assignment_id')
    .select('exam_assignments.title')
    .where('exam_room_students.child_id', '=', student.childId)
    .where('exam_rooms.closed_at', 'is', null)
    .where('exam_rooms.expires_at', '>', now)
    .where('exam_assignments.status', '=', 'published')
    .executeTakeFirst();
  if (room) {
    return room;
  }
  const open = await database
    .selectFrom('exam_assignments')
    .select(['exam_assignments.title'])
    .where('exam_assignments.status', '=', 'published')
    .where('exam_assignments.opens_at', '<=', now)
    .where('exam_assignments.closes_at', '>', now)
    .where((expression) =>
      expression.exists(
        expression
          .selectFrom('exam_assignment_targets')
          .select('exam_assignment_targets.id')
          .whereRef('exam_assignment_targets.assignment_id', '=', 'exam_assignments.id')
          .where((inner) =>
            inner.or([
              inner('exam_assignment_targets.child_id', '=', student.childId),
              ...(student.classId ? [inner('exam_assignment_targets.class_id', '=', student.classId)] : []),
            ]),
          ),
      ),
    )
    .where(
      (expression) =>
        expression
          .selectFrom('exam_attempts')
          .select(sql<number>`count(*)::int`.as('used'))
          .whereRef('exam_attempts.assignment_id', '=', 'exam_assignments.id')
          .where('exam_attempts.child_id', '=', student.childId)
          .where((inner) => inner.or([inner('status', '=', 'submitted'), inner('deadline_at', '<=', now)])),
      '<',
      sql<number>`exam_assignments.max_attempts`,
    )
    .orderBy('exam_assignments.opens_at')
    .executeTakeFirst();
  return open ?? null;
}

// Bài tập không dùng AI đang mở với em: đã phát hành, hoạt động đã công bố và đã đến giờ mở, em không được miễn, và em còn nộp được
// (chưa đóng, chưa dùng hết số lần nộp, chưa quá hạn khi bài chặn nộp muộn)
export async function openBlockedAssignmentFor(
  database: YearDatabase,
  childId: string,
  now: Date,
): Promise<{ title: string } | null> {
  const candidates = await database
    .selectFrom('assignment_recipients')
    .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
    .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
    .select([
      'assignments.id',
      'assignments.late_policy',
      'assignments.max_attempts',
      'assignments.closed_at',
      'assignment_recipients.group_id',
      'assignment_recipients.due_at as recipient_due_at',
      'assignment_recipients.excused',
      'course_activities.title',
      'course_activities.due_at',
      'course_activities.closes_at',
    ])
    .where('assignment_recipients.child_id', '=', childId)
    .where('assignments.ai_blocked', '=', true)
    .where('assignments.released_at', 'is not', null)
    .where('course_activities.status', '=', 'published')
    .where((expression) =>
      expression.or([
        expression('course_activities.opens_at', 'is', null),
        expression('course_activities.opens_at', '<=', now),
      ]),
    )
    .orderBy('course_activities.due_at')
    .execute();
  for (const candidate of candidates) {
    const used = await database
      .selectFrom('assignment_submissions')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('assignment_id', '=', candidate.id)
      .where('status', '<>', 'draft')
      .where((builder) =>
        candidate.group_id ? builder('group_id', '=', candidate.group_id) : builder('child_id', '=', childId),
      )
      .executeTakeFirstOrThrow();
    const check = submitCheck({
      now,
      dueAt: candidate.recipient_due_at ?? candidate.due_at,
      closedAt: candidate.closed_at ?? candidate.closes_at,
      latePolicy: candidate.late_policy,
      attemptsUsed: used.count,
      maxAttempts: candidate.max_attempts,
      excused: candidate.excused,
    });
    if (check.allowed) {
      return { title: candidate.title };
    }
  }
  return null;
}

// Khung giờ khóa của trường; chưa có dòng cài đặt thì dùng mặc định 22:00 đến 6:00
export async function quietWindowOf(system: Kysely<SystemDatabase>): Promise<{ start: string; end: string }> {
  const row = await system
    .selectFrom('ai_tutor_school_settings')
    .select(['quiet_start', 'quiet_end'])
    .where('id', '=', 1)
    .executeTakeFirst();
  return { start: row?.quiet_start ?? DEFAULT_QUIET_START, end: row?.quiet_end ?? DEFAULT_QUIET_END };
}
