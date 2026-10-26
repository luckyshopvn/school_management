import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ExamAttemptEventType, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  currentTenant,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  isModuleInPlan,
  PROCTOR_EVENT_TYPES,
  type ExamCameraState,
  type ExamSubmitReason,
  type SchoolLevelCode,
} from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { OPTION_KEYS, createRandom, type VariantItem } from '../exams/exam-rules.js';
import { AttemptEngine, variantTypes, type ExamContent } from './attempt-engine.js';
import { ExamRateLimiter } from './exam-rate-limit.js';
import {
  attemptDeadline,
  buildAttemptLayout,
  canSaveAnswers,
  countViolations,
  countedAttempt,
  ipAllowed,
  keysToLabels,
  normalizeAnswers,
  pickVariantCode,
  remainingSeconds,
  resultsVisible,
  violationOutcome,
  windowState,
  type AttemptLayout,
  type AttemptScore,
  type ViolationOutcome,
} from './online-exam-rules.js';

// Phía học sinh của thi trực tuyến (DT-23 phần 23a, YCTD-211; GD-105, GD-106): danh sách bài được giao, vào làm, lưu nháp từng
// câu, báo sự kiện rời bài và camera, nộp bài, xem kết quả. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - tài khoản học sinh (kênh student) nối một-một với tài khoản học và thi; học sinh nghỉ học, chuyển trường (trạng thái khác "đang
//   học") hoặc cấp học bị trường tắt thì mọi điểm cuối /student/* từ chối, và chỉ thấy bài, lượt làm của chính mình;
// - máy chủ giữ đáp án và thời gian: nội dung gửi xuống không có đáp án đúng, hướng dẫn chấm; hạn nộp tính ở máy chủ lúc bắt đầu;
//   mất mạng thì lượt vẫn còn, vào lại làm tiếp trong thời gian còn lại; hết giờ thì máy chủ chốt lượt khi có yêu cầu kế tiếp;
// - mỗi lượt chỉ một phiên đăng nhập đang làm: phiên thứ hai bị từ chối hoặc đóng phiên cũ theo cấu hình của bài, đều ghi sự kiện;
// - camera: hình xử lý hoàn toàn trên máy học sinh, máy chủ chỉ nhận loại và thời điểm sự kiện (không nhận hình hay video);
//   sự kiện camera chỉ là căn cứ để giáo viên xét, không tính vào số lần rời bài, không tự nộp, không tự trừ điểm;
// - kết quả hiện theo chế độ của bài; đáp án đúng chỉ hiện sau giờ đóng và khi kết quả đã hiện.
export const ONLINE_EXAM_RULE_CODE = 'YCTD-211';

export function assertOnlineExamModule(): void {
  const plan = currentTenant()?.plan;
  if (plan && !isModuleInPlan('online-exam', plan.modules)) {
    throw new ApplicationError('MODULE_NOT_IN_PLAN', 'Phân hệ này không có trong gói dịch vụ của trường', [
      { field: 'plan', message: plan.code },
    ]);
  }
}

const CLIENT_EVENT_TYPES = PROCTOR_EVENT_TYPES.filter((type) => type !== 'second_session');
const MAXIMUM_EVENTS_PER_CALL = 20;
const MAXIMUM_ANSWER_ENTRIES = 300;
const CAMERA_STATES: ExamCameraState[] = ['off', 'granted', 'denied', 'unavailable'];

type Database = Kysely<SchoolYearDatabase>;

export interface StudentContext {
  database: Database;
  childId: string;
  fullName: string;
  classId: string;
  className: string;
  level: SchoolLevelCode;
}

export interface EventInput {
  type: ExamAttemptEventType;
  client_at: Date | null;
  detail: Record<string, number>;
}

function sessionReplaced(): ApplicationError {
  return ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài đang được làm ở một phiên đăng nhập khác', [
    { field: 'session', message: 'replaced' },
  ]);
}

@Injectable()
export class StudentExamsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly engine: AttemptEngine,
    private readonly clock: Clock,
    private readonly limiter: ExamRateLimiter,
  ) {}

  // Học sinh của người gọi: tài khoản nối đúng một học sinh đang học, đã xếp lớp, cấp học còn bật thi trực tuyến
  async resolve(currentUser: CurrentUser): Promise<StudentContext> {
    assertOnlineExamModule();
    const { database } = await this.currentSchoolYear.require();
    const account = await database
      .selectFrom('student_learning_accounts')
      .select('child_id')
      .where('identity_user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!account) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Tài khoản chưa nối với hồ sơ học sinh, nhờ nhà trường cấp lại mật khẩu',
      );
    }
    const child = await database
      .selectFrom('children')
      .select(['id', 'full_name', 'status', 'deleted_at'])
      .where('id', '=', account.child_id)
      .executeTakeFirst();
    if (!child || child.status !== 'active' || child.deleted_at !== null) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Tài khoản học sinh đã tắt vì học sinh không còn đang học ở trường');
    }
    const enrollment = await database
      .selectFrom('class_enrollments')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['classes.id as class_id', 'classes.name as class_name', 'classes.school_level'])
      .where('class_enrollments.child_id', '=', child.id)
      .where('class_enrollments.is_current', '=', true)
      .executeTakeFirst();
    if (!enrollment) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Học sinh chưa được xếp lớp');
    }
    const setting = await database
      .selectFrom('online_exam_settings')
      .select('student_login_enabled')
      .where('school_level', '=', enrollment.school_level)
      .executeTakeFirst();
    if (setting && !setting.student_login_enabled) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Nhà trường chưa mở thi trực tuyến cho học sinh cấp học này');
    }
    return {
      database,
      childId: child.id,
      fullName: child.full_name,
      classId: enrollment.class_id,
      className: enrollment.class_name,
      level: enrollment.school_level,
    };
  }

  async profile(currentUser: CurrentUser) {
    const student = await this.resolve(currentUser);
    return { full_name: student.fullName, class_name: student.className, school_level: student.level };
  }

  private targeted(student: StudentContext) {
    return student.database
      .selectFrom('exam_assignments')
      .innerJoin('exams', 'exams.id', 'exam_assignments.exam_id')
      .innerJoin('subjects', 'subjects.id', 'exams.subject_id')
      .where('exam_assignments.status', '=', 'published')
      .where((expression) =>
        expression.exists(
          expression
            .selectFrom('exam_assignment_targets')
            .select('exam_assignment_targets.id')
            .whereRef('exam_assignment_targets.assignment_id', '=', 'exam_assignments.id')
            .where((inner) =>
              inner.or([
                inner('exam_assignment_targets.class_id', '=', student.classId),
                inner('exam_assignment_targets.child_id', '=', student.childId),
              ]),
            ),
        ),
      );
  }

  async list(currentUser: CurrentUser) {
    const student = await this.resolve(currentUser);
    await this.engine.finalizeExpired(student.database, { childId: student.childId });
    const assignments = await this.targeted(student)
      .select([
        'exam_assignments.id',
        'exam_assignments.title',
        'exam_assignments.opens_at',
        'exam_assignments.closes_at',
        'exam_assignments.duration_minutes',
        'exam_assignments.max_attempts',
        'exam_assignments.attempt_policy',
        'exam_assignments.result_mode',
        'exam_assignments.results_released_at',
        'exam_assignments.fullscreen_required',
        'exam_assignments.camera_enabled',
        'exam_assignments.exam_mode',
        'subjects.name as subject_name',
      ])
      .orderBy('exam_assignments.opens_at', 'desc')
      .execute();
    const attempts = assignments.length
      ? await student.database
          .selectFrom('exam_attempts')
          .select([
            'id',
            'assignment_id',
            'status',
            'submitted_at',
            'total_score',
            'objective_score',
            'max_score',
            'needs_marking',
          ])
          .where('child_id', '=', student.childId)
          .where(
            'assignment_id',
            'in',
            assignments.map((row) => row.id),
          )
          .execute()
      : [];
    const now = this.clock.now();
    return {
      server_now: now,
      items: assignments.map((assignment) => {
        const mine = attempts.filter((attempt) => attempt.assignment_id === assignment.id);
        const inProgress = mine.find((attempt) => attempt.status === 'in_progress');
        const used = mine.filter((attempt) => attempt.status === 'submitted').length;
        const window = windowState(now, assignment.opens_at, assignment.closes_at);
        const state = inProgress
          ? 'in_progress'
          : window === 'upcoming'
            ? 'upcoming'
            : window === 'open' && used < assignment.max_attempts
              ? 'open'
              : 'closed';
        const counted = countedAttempt(
          mine.map((attempt): AttemptScore => ({
            id: attempt.id,
            status: attempt.status,
            submitted_at: attempt.submitted_at,
            total: attempt.total_score === null ? null : Number(attempt.total_score),
            objective: attempt.objective_score === null ? null : Number(attempt.objective_score),
          })),
          assignment.attempt_policy,
        );
        const visible =
          counted !== undefined &&
          resultsVisible(assignment.result_mode, now, assignment.closes_at, assignment.results_released_at, true);
        const countedRow = mine.find((attempt) => attempt.id === counted?.id);
        return {
          id: assignment.id,
          title: assignment.title,
          subject_name: assignment.subject_name,
          opens_at: assignment.opens_at,
          closes_at: assignment.closes_at,
          duration_minutes: assignment.duration_minutes,
          max_attempts: assignment.max_attempts,
          attempts_used: used,
          state,
          attempt_id: inProgress?.id ?? null,
          fullscreen_required: assignment.fullscreen_required,
          camera_enabled: assignment.camera_enabled,
          exam_mode: assignment.exam_mode,
          result_mode: assignment.result_mode,
          result:
            visible && countedRow
              ? {
                  attempt_id: countedRow.id,
                  total_score: countedRow.total_score === null ? null : Number(countedRow.total_score),
                  max_score: countedRow.max_score === null ? null : Number(countedRow.max_score),
                  pending_marking: countedRow.needs_marking,
                }
              : null,
        };
      }),
    };
  }

  private async findAssignment(student: StudentContext, assignmentId: string) {
    const assignment = await this.targeted(student)
      .selectAll('exam_assignments')
      .select('exams.school_level as exam_level')
      .where('exam_assignments.id', '=', assignmentId)
      .executeTakeFirst();
    if (!assignment) {
      throw notFoundError('Không tìm thấy bài thi được giao cho bạn', 'exam_assignment');
    }
    return assignment;
  }

  // Vào làm: tiếp tục lượt đang làm (kiểm tra phiên đăng nhập), hoặc mở lượt mới nếu còn lượt và còn trong giờ mở
  async start(
    currentUser: CurrentUser,
    assignmentId: string,
    body: { camera_state: ExamCameraState; room_code: string | null },
    origin: ChangeOrigin,
    ipAddress: string | undefined,
  ): Promise<Awaited<ReturnType<StudentExamsService['attemptView']>>> {
    const student = await this.resolve(currentUser);
    const { database } = student;
    await this.engine.finalizeExpired(database, { childId: student.childId });
    const assignment = await this.findAssignment(student, assignmentId);
    const now = this.clock.now();
    const sessionId = currentUser.session?.sessionId ?? '';
    // Chế độ thi tại trường (mặc định): vào bài từ dải mạng của trường (nếu trường cấu hình) và bằng mã phòng thi đang mở
    if (assignment.exam_mode === 'at-school') {
      await this.assertCanEnterRoom(student, assignmentId, body.room_code, ipAddress, now);
    }
    const open = await database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('assignment_id', '=', assignmentId)
      .where('child_id', '=', student.childId)
      .where('status', '=', 'in_progress')
      .executeTakeFirst();
    if (open) {
      if (open.session_id !== sessionId) {
        await this.recordSecondSession(database, open.id, assignment.single_session_mode === 'close_old', now);
        if (assignment.single_session_mode === 'reject_new') {
          throw sessionReplaced();
        }
        await database
          .updateTable('exam_attempts')
          .set({ session_id: sessionId, updated_at: now })
          .where('id', '=', open.id)
          .execute();
      }
      return this.attemptView(student, open.id);
    }
    if (windowState(now, assignment.opens_at, assignment.closes_at) !== 'open') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài thi chưa mở hoặc đã đóng');
    }
    const used = await database
      .selectFrom('exam_attempts')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('assignment_id', '=', assignmentId)
      .where('child_id', '=', student.childId)
      .executeTakeFirstOrThrow();
    if (Number(used.count) >= assignment.max_attempts) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bạn đã dùng hết số lần làm bài');
    }
    const cameraState: ExamCameraState = assignment.camera_enabled ? body.camera_state : 'off';
    const cameraMissing = assignment.camera_enabled && cameraState !== 'granted';
    if (cameraMissing && assignment.camera_fallback === 'block') {
      throw ruleViolationError(
        ONLINE_EXAM_RULE_CODE,
        'Bài thi này yêu cầu bật camera; hãy cho phép camera hoặc báo giáo viên',
        [{ field: 'camera', message: cameraState }],
      );
    }
    const content = await this.engine.loadContent(database, assignment.exam_id);
    const seed = randomInt(1, 2 ** 31);
    const variantCode = pickVariantCode(
      content.variants.map((variant) => variant.code),
      assignment.variant_mode,
      assignment.fixed_variant_code,
      createRandom(seed),
    );
    const variant = content.variants.find((row) => row.code === variantCode);
    if (!variant) {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Đề của bài thi chưa có mã đề, báo giáo viên');
    }
    const types = variantTypes(variant, content);
    const layout = buildAttemptLayout(variant.items, types.byId, seed, {
      shuffleQuestions: assignment.shuffle_questions,
      shuffleOptions: assignment.shuffle_options,
    });
    const flagReasons = cameraMissing ? ['camera_not_available'] : [];
    const inserted = await database.transaction().execute(async (transaction) => {
      const attemptNo = Number(used.count) + 1;
      const row = await transaction
        .insertInto('exam_attempts')
        .values({
          assignment_id: assignmentId,
          child_id: student.childId,
          attempt_no: attemptNo,
          variant_code: variant.code,
          layout: JSON.stringify(layout),
          started_at: now,
          deadline_at: attemptDeadline(now, assignment.duration_minutes, assignment.closes_at),
          session_id: sessionId,
          camera_state: cameraState,
          flagged: cameraMissing,
          flag_reasons: JSON.stringify(flagReasons),
        })
        .onConflict((conflict) => conflict.columns(['assignment_id', 'child_id', 'attempt_no']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      if (cameraMissing) {
        await transaction
          .insertInto('exam_attempt_events')
          .values({
            attempt_id: row.id,
            event_type: cameraState === 'unavailable' ? 'camera_unavailable' : 'camera_denied',
            occurred_at: now,
          })
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'exam_attempts',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { assignment_id: assignmentId, attempt_no: attemptNo, camera_state: cameraState },
      });
      return row;
    });
    if (!inserted) {
      // Hai yêu cầu vào bài cùng lúc: yêu cầu sau lấy lượt của yêu cầu trước
      return this.start(currentUser, assignmentId, body, origin, ipAddress);
    }
    return this.attemptView(student, inserted.id);
  }

  // Vào bài ở chế độ thi tại trường: địa chỉ mạng trong dải của trường (trống là không giới hạn), mã phòng thi của bài còn mở và học
  // sinh có tên trong danh sách của phòng; phòng đóng hoặc hết hạn thì không vào được (lượt đang làm vẫn nộp được)
  private async assertCanEnterRoom(
    student: StudentContext,
    assignmentId: string,
    roomCode: string | null,
    ipAddress: string | undefined,
    now: Date,
  ) {
    const { database } = student;
    const settings = await database
      .selectFrom('online_exam_school_settings')
      .select('allowed_networks')
      .executeTakeFirst();
    const ranges = (settings?.allowed_networks as string[] | undefined) ?? [];
    if (!ipAllowed(ipAddress, ranges)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bài thi này chỉ vào được từ mạng của nhà trường', [
        { field: 'network', message: 'outside' },
      ]);
    }
    const code = (roomCode ?? '').trim();
    const room = /^\d{6}$/.test(code)
      ? await database
          .selectFrom('exam_rooms')
          .innerJoin('exam_room_students', 'exam_room_students.room_id', 'exam_rooms.id')
          .select(['exam_rooms.id'])
          .where('exam_rooms.assignment_id', '=', assignmentId)
          .where('exam_rooms.code', '=', code)
          .where('exam_rooms.closed_at', 'is', null)
          .where('exam_rooms.expires_at', '>', now)
          .where('exam_room_students.child_id', '=', student.childId)
          .executeTakeFirst()
      : undefined;
    if (!room) {
      throw ruleViolationError(
        ONLINE_EXAM_RULE_CODE,
        'Mã phòng thi không đúng, phòng chưa mở, đã đóng hoặc em không có tên trong phòng; hỏi giám thị',
        [{ field: 'room_code', message: 'invalid' }],
      );
    }
    await database
      .updateTable('exam_room_students')
      .set({ entered_at: now })
      .where('room_id', '=', room.id)
      .where('child_id', '=', student.childId)
      .where('entered_at', 'is', null)
      .execute();
  }

  private async recordSecondSession(database: Database, attemptId: string, takeOver: boolean, now: Date) {
    await database
      .insertInto('exam_attempt_events')
      .values({
        attempt_id: attemptId,
        event_type: 'second_session',
        occurred_at: now,
        detail: JSON.stringify({ took_over: takeOver ? 1 : 0 }),
      })
      .execute();
  }

  private async findAttempt(student: StudentContext, attemptId: string) {
    const attempt = await student.database
      .selectFrom('exam_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .where('child_id', '=', student.childId)
      .executeTakeFirst();
    if (!attempt) {
      throw notFoundError('Không tìm thấy bài làm', 'exam_attempt');
    }
    return attempt;
  }

  // Lượt đang làm đúng phiên đăng nhập, còn trong hạn (quá hạn thì chốt rồi báo hết giờ)
  private async activeAttempt(currentUser: CurrentUser, student: StudentContext, attemptId: string) {
    let attempt = await this.findAttempt(student, attemptId);
    if (attempt.status === 'in_progress' && attempt.session_id !== (currentUser.session?.sessionId ?? '')) {
      throw sessionReplaced();
    }
    if (attempt.status === 'in_progress' && !canSaveAnswers(this.clock.now(), attempt.deadline_at)) {
      await this.engine.finalize(student.database, attempt.id, 'timeout', attempt.deadline_at);
      attempt = await this.findAttempt(student, attemptId);
    }
    return attempt;
  }

  async attemptView(student: StudentContext, attemptId: string) {
    const { database } = student;
    const attempt = await this.findAttempt(student, attemptId);
    const assignment = await database
      .selectFrom('exam_assignments')
      .innerJoin('exams', 'exams.id', 'exam_assignments.exam_id')
      .select([
        'exam_assignments.id',
        'exam_assignments.title',
        'exam_assignments.exam_id',
        'exam_assignments.fullscreen_required',
        'exam_assignments.max_violations',
        'exam_assignments.violation_action',
        'exam_assignments.camera_enabled',
        'exam_assignments.camera_fallback',
        'exam_assignments.closes_at',
        'exam_assignments.result_mode',
        'exam_assignments.results_released_at',
      ])
      .where('exam_assignments.id', '=', attempt.assignment_id)
      .executeTakeFirstOrThrow();
    const content = await this.engine.loadContent(database, assignment.exam_id);
    const variant = content.variants.find((row) => row.code === attempt.variant_code);
    const layout = attempt.layout as AttemptLayout;
    const answers = attempt.answers as Record<string, string[]>;
    const now = this.clock.now();
    const events = await database
      .selectFrom('exam_attempt_events')
      .select(['event_type', 'occurred_at'])
      .where('attempt_id', '=', attemptId)
      .execute();
    const items = new Map((variant?.items ?? []).map((item) => [item.number, item]));
    const submitted = attempt.status === 'submitted';
    return {
      id: attempt.id,
      assignment_id: attempt.assignment_id,
      title: assignment.title,
      status: attempt.status,
      server_now: now,
      started_at: attempt.started_at,
      deadline_at: attempt.deadline_at,
      remaining_seconds: submitted ? 0 : remainingSeconds(now, attempt.deadline_at),
      policy: {
        fullscreen_required: assignment.fullscreen_required,
        max_violations: assignment.max_violations,
        violation_action: assignment.violation_action,
        camera_enabled: assignment.camera_enabled,
      },
      camera_state: attempt.camera_state,
      violations: countViolations(events),
      // Đề đã nộp thì không gửi lại nội dung đề; học sinh xem kết quả ở điểm cuối kết quả
      questions: submitted
        ? []
        : layout.order.flatMap((number, index) => {
            const item = items.get(number);
            const snapshot = item ? content.snapshots.get(item.question_id) : undefined;
            const question = content.questions.find((row) => row.question_id === item?.question_id);
            if (!item || !snapshot || !question) {
              return [];
            }
            return [this.questionView(index + 1, item, snapshot, question.score, layout)];
          }),
      answers: Object.fromEntries(
        Object.entries(answers).map(([number, keys]) => [number, keysToLabels(layout, Number(number), keys)]),
      ),
    };
  }

  // Câu hỏi gửi xuống máy học sinh: nội dung, lựa chọn theo thứ tự hiển thị; không có đáp án đúng, không có hướng dẫn chấm
  private questionView(
    position: number,
    item: VariantItem,
    snapshot: { content: string; question_type: string; options: Array<{ key: string; content: string }> },
    score: number,
    layout: AttemptLayout,
  ) {
    const base = { position, number: item.number, type: snapshot.question_type, content: snapshot.content, score };
    if (snapshot.question_type === 'multiple_choice') {
      const order = layout.options[String(item.number)] ?? [];
      return {
        ...base,
        options: order.map((key, labelIndex) => {
          const original = item.option_order[OPTION_KEYS.indexOf(key)];
          return {
            label: OPTION_KEYS[labelIndex] as string,
            content: snapshot.options.find((option) => option.key === original)?.content ?? '',
          };
        }),
      };
    }
    if (snapshot.question_type === 'true_false') {
      return {
        ...base,
        statements: snapshot.options.map((option, index) => ({
          label: ['a', 'b', 'c', 'd', 'e', 'f'][index] as string,
          content: option.content,
        })),
      };
    }
    return base;
  }

  async getAttempt(currentUser: CurrentUser, attemptId: string) {
    const student = await this.resolve(currentUser);
    await this.activeAttempt(currentUser, student, attemptId);
    return this.attemptView(student, attemptId);
  }

  // Lưu nháp từng câu: chỉ các câu gửi lên được ghi đè, câu khác giữ nguyên
  async saveAnswers(currentUser: CurrentUser, attemptId: string, raw: unknown) {
    const student = await this.resolve(currentUser);
    this.limiter.hit(student.childId);
    const attempt = await this.activeAttempt(currentUser, student, attemptId);
    if (attempt.status !== 'in_progress') {
      throw ruleViolationError(ONLINE_EXAM_RULE_CODE, 'Bài đã nộp hoặc đã hết giờ, không lưu thêm được', [
        { field: 'attempt', message: 'closed' },
      ]);
    }
    if (typeof raw === 'object' && raw !== null && Object.keys(raw).length > MAXIMUM_ANSWER_ENTRIES) {
      throw validationError([{ field: 'answers', message: `Tối đa ${MAXIMUM_ANSWER_ENTRIES} câu mỗi lần lưu` }]);
    }
    const normalized = await this.normalize(student, attempt, raw);
    const now = this.clock.now();
    if (Object.keys(normalized).length > 0) {
      await student.database
        .updateTable('exam_attempts')
        .set({
          answers: sql<string>`answers || ${JSON.stringify(normalized)}::jsonb`,
          last_saved_at: now,
          updated_at: now,
        })
        .where('id', '=', attempt.id)
        .execute();
    }
    return { saved_at: now, remaining_seconds: remainingSeconds(now, attempt.deadline_at) };
  }

  private async normalize(
    student: StudentContext,
    attempt: { assignment_id: string; variant_code: string; layout: unknown },
    raw: unknown,
  ): Promise<Record<string, string[]>> {
    const assignment = await student.database
      .selectFrom('exam_assignments')
      .select('exam_id')
      .where('id', '=', attempt.assignment_id)
      .executeTakeFirstOrThrow();
    const content: ExamContent = await this.engine.loadContent(student.database, assignment.exam_id);
    const variant = content.variants.find((row) => row.code === attempt.variant_code);
    const types = variantTypes(variant ?? { items: [] }, content);
    const { answers, errors } = normalizeAnswers(
      raw,
      attempt.layout as AttemptLayout,
      types.byNumber,
      types.trueFalseCounts,
    );
    if (errors.length > 0) {
      const details: FieldError[] = errors.map((error) => ({
        field: `answers.${error.number}`,
        message: error.message,
      }));
      throw validationError(details);
    }
    return answers;
  }

  // Báo sự kiện rời bài và camera (chỉ loại, thời điểm và vài số đo; không có hình hay video)
  async recordEvents(currentUser: CurrentUser, attemptId: string, events: EventInput[]) {
    const student = await this.resolve(currentUser);
    this.limiter.hit(student.childId);
    const attempt = await this.activeAttempt(currentUser, student, attemptId);
    const { database } = student;
    const assignment = await database
      .selectFrom('exam_assignments')
      .select(['max_violations', 'violation_action'])
      .where('id', '=', attempt.assignment_id)
      .executeTakeFirstOrThrow();
    const now = this.clock.now();
    if (attempt.status === 'in_progress' && events.length > 0) {
      await database
        .insertInto('exam_attempt_events')
        .values(
          events.slice(0, MAXIMUM_EVENTS_PER_CALL).map((event) => ({
            attempt_id: attempt.id,
            event_type: event.type,
            occurred_at: now,
            client_at: event.client_at,
            detail: JSON.stringify(event.detail),
          })),
        )
        .execute();
    }
    const stored = await database
      .selectFrom('exam_attempt_events')
      .select(['event_type', 'occurred_at'])
      .where('attempt_id', '=', attempt.id)
      .execute();
    const violations = countViolations(stored);
    let outcome: ViolationOutcome = 'none';
    if (attempt.status === 'in_progress') {
      outcome = violationOutcome(violations, assignment.max_violations, assignment.violation_action);
      if (outcome === 'flag' || outcome === 'auto_submit') {
        await this.flag(database, attempt.id, 'violation_limit', now);
      }
      if (outcome === 'auto_submit') {
        await this.engine.finalize(database, attempt.id, 'violation', now);
      }
    }
    const fresh = await this.findAttempt(student, attemptId);
    return {
      violations,
      max_violations: assignment.max_violations,
      outcome,
      status: fresh.status,
      remaining_seconds: fresh.status === 'submitted' ? 0 : remainingSeconds(now, fresh.deadline_at),
    };
  }

  private async flag(database: Database, attemptId: string, reason: string, now: Date) {
    await database
      .updateTable('exam_attempts')
      .set({
        flagged: true,
        flag_reasons: sql<string>`case when flag_reasons @> ${JSON.stringify([reason])}::jsonb then flag_reasons
          else flag_reasons || ${JSON.stringify([reason])}::jsonb end`,
        updated_at: now,
      })
      .where('id', '=', attemptId)
      .execute();
  }

  async submit(currentUser: CurrentUser, attemptId: string, raw: unknown, origin: ChangeOrigin) {
    const student = await this.resolve(currentUser);
    const attempt = await this.activeAttempt(currentUser, student, attemptId);
    const now = this.clock.now();
    if (attempt.status === 'in_progress') {
      if (raw !== undefined && raw !== null && canSaveAnswers(now, attempt.deadline_at)) {
        const normalized = await this.normalize(student, attempt, raw);
        if (Object.keys(normalized).length > 0) {
          await student.database
            .updateTable('exam_attempts')
            .set({ answers: sql<string>`answers || ${JSON.stringify(normalized)}::jsonb`, last_saved_at: now })
            .where('id', '=', attempt.id)
            .execute();
        }
      }
      const reason: ExamSubmitReason = 'manual';
      await this.engine.finalize(student.database, attempt.id, reason, now);
      await writeAuditLog(student.database, {
        origin,
        orgUnitId: null,
        entityName: 'exam_attempts',
        entityId: attempt.id,
        action: 'update',
        before: { status: 'in_progress' },
        after: { status: 'submitted', reason },
      });
    }
    return this.result(currentUser, attemptId);
  }

  // Kết quả theo chế độ của bài; chưa được xem thì chỉ báo đã nộp
  async result(currentUser: CurrentUser, attemptId: string) {
    const student = await this.resolve(currentUser);
    const attempt = await this.findAttempt(student, attemptId);
    const assignment = await student.database
      .selectFrom('exam_assignments')
      .select(['title', 'exam_id', 'result_mode', 'closes_at', 'results_released_at'])
      .where('id', '=', attempt.assignment_id)
      .executeTakeFirstOrThrow();
    const now = this.clock.now();
    const submitted = attempt.status === 'submitted';
    const visible = resultsVisible(
      assignment.result_mode,
      now,
      assignment.closes_at,
      assignment.results_released_at,
      submitted,
    );
    const base = {
      attempt_id: attempt.id,
      title: assignment.title,
      status: attempt.status,
      submitted_at: attempt.submitted_at,
      result_mode: assignment.result_mode,
      visible,
    };
    if (!visible) {
      return { ...base, total_score: null, max_score: null, pending_marking: false, questions: [] };
    }
    const content = await this.engine.loadContent(student.database, assignment.exam_id);
    const variant = content.variants.find((row) => row.code === attempt.variant_code);
    const layout = attempt.layout as AttemptLayout;
    const answers = attempt.answers as Record<string, string[]>;
    const results = attempt.results as Array<{
      question_id: string;
      number: number;
      earned: number;
      correct: boolean | null;
    }>;
    const showKeys = now >= assignment.closes_at;
    const items = new Map((variant?.items ?? []).map((item) => [item.number, item]));
    return {
      ...base,
      total_score: attempt.total_score === null ? null : Number(attempt.total_score),
      max_score: attempt.max_score === null ? null : Number(attempt.max_score),
      pending_marking: attempt.needs_marking,
      questions: layout.order.flatMap((number, index) => {
        const item = items.get(number);
        const question = content.questions.find((row) => row.question_id === item?.question_id);
        const result = results.find((row) => row.number === number);
        if (!item || !question) {
          return [];
        }
        return [
          {
            position: index + 1,
            number,
            type: question.question_type,
            max: question.score,
            earned: result?.earned ?? 0,
            correct: result?.correct ?? null,
            answer: keysToLabels(layout, number, answers[String(number)] ?? []),
            correct_answer:
              showKeys && question.question_type !== 'essay' ? keysToLabels(layout, number, item.answer) : null,
          },
        ];
      }),
    };
  }
}

export function readEvents(raw: unknown): EventInput[] {
  const errors: FieldError[] = [];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAXIMUM_EVENTS_PER_CALL) {
    throw validationError([{ field: 'events', message: `Gồm từ 1 đến ${MAXIMUM_EVENTS_PER_CALL} sự kiện` }]);
  }
  const events: EventInput[] = [];
  raw.forEach((entry: unknown, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const type = row.type;
    if (typeof type !== 'string' || !(CLIENT_EVENT_TYPES as string[]).includes(type)) {
      errors.push({ field: `events[${index}].type`, message: 'Loại sự kiện không hợp lệ' });
      return;
    }
    let clientAt: Date | null = null;
    if (row.client_at !== undefined && row.client_at !== null) {
      const parsed = new Date(String(row.client_at));
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ field: `events[${index}].client_at`, message: 'Thời điểm không hợp lệ' });
        return;
      }
      clientAt = parsed;
    }
    // Chỉ nhận vài số đo nhỏ (thời gian, số khuôn mặt), không nhận chữ tự do, tránh gửi hình hay dữ liệu cá nhân qua đường này
    const detail: Record<string, number> = {};
    const rawDetail = row.detail;
    if (typeof rawDetail === 'object' && rawDetail !== null) {
      for (const key of ['duration_ms', 'faces']) {
        const value = (rawDetail as Record<string, unknown>)[key];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e9) {
          detail[key] = Math.round(value);
        }
      }
    }
    events.push({ type: type as ExamAttemptEventType, client_at: clientAt, detail });
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return events;
}

export function readCameraState(raw: unknown): ExamCameraState {
  if (raw === undefined || raw === null) {
    return 'off';
  }
  if (typeof raw !== 'string' || !(CAMERA_STATES as string[]).includes(raw)) {
    throw validationError([
      { field: 'camera_state', message: 'Tình trạng camera là off, granted, denied hoặc unavailable' },
    ]);
  }
  return raw as ExamCameraState;
}
