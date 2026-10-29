import { Inject, Injectable, Optional, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, isMultiTenantMode } from '@school-management/server';
import type { Kysely, Transaction } from 'kysely';
import type { CurrentUser } from '../../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { JobScheduler } from '../../common/job-scheduler.js';
import { queueNotification } from '../../common/notification-queue.js';
import { notFoundError, type RequestBody } from '../../common/request-fields.js';
import type { SchoolLevelCode } from '@school-management/shared';
import { TimetableChangesService } from '../../timetables/timetable-changes.js';
import { TimetablesService } from '../../timetables/timetables.js';
import { LearningService, parseActivityInput } from '../learning.js';
import { HomeworkPolicyGate } from './homework-policy.js';
import {
  addDays,
  homeworkRule,
  homeworkStatus,
  NEXT_LESSON_DAYS,
  nextLessonDue,
  parsePolicyInput,
  planReminders,
  REMINDER_TEMPLATES,
  reminderText,
  reminderTimeOf,
  vietnamDate,
  type LessonCandidate,
} from './homework-rules.js';

// Bài về nhà và phụ huynh (DT-28 phần 28f, YCTD-276; tài liệu 47 mục 20.7). Bài về nhà là bài tập 28c ngữ cảnh `homework`: soạn,
// chấm, trả bài, nộp thay của phụ huynh đi qua `AssignmentsService`; phần này lo phần riêng của bài về nhà:
// - Giao từ sổ đầu bài: tạo hoạt động bài tập trong lớp học trực tuyến của lớp và môn của tiết, gắn `class_log_id`, hạn mặc định là
//   đầu tiết kế tiếp của môn theo thời khoá biểu; sổ đầu bài hiện bài về nhà của tiết.
// - Quy tắc khối lượng do trường tự đặt (GD-143), lịch khối lượng 7 ngày của lớp cho giáo viên, chủ nhiệm, Ban Giám hiệu.
// - Phụ huynh: "Bài tập của con" theo ngày, trạng thái, kết quả, nhận xét; "Đã xem cùng con".
// - Gợi ý gia hạn, miễn cho học sinh vắng có phép ngày giao bài.
// - Việc nền nhắc bài về nhà (đã giao, sắp đến hạn, chưa nộp, đã trả) có giờ yên lặng, gộp nhiều bài một thông báo.
// Quyền lớp học trực tuyến lấy qua cửa của lõi 28b (`spaceAccess`, `teacherActivity`, `guardianOrStaff`, `createActivity`)
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const numberOrNull = (value: string | null) => (value === null ? null : Number(value));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class HomeworkService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly gate: HomeworkPolicyGate,
    private readonly timetables: TimetablesService,
    private readonly changes: TimetableChangesService,
    private readonly clock: Clock,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    const run = async () => {
      try {
        await this.sendReminders();
      } catch {
        // Lượt sau chạy lại; nhắc bài về nhà không chặn việc khác
      }
    };
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'homework-reminders', intervalSeconds: 900, run });
      return;
    }
    this.timer = setInterval(() => void run(), 900_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- Đọc chung

  private async isLeadership(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    return context.canDecide || (context.canView && context.canApprove);
  }

  private async setting(database: YearExecutor, key: string) {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', key)
      .executeTakeFirst();
    return row?.value;
  }

  private readFrom(value: unknown) {
    return typeof value === 'string' && DATE_PATTERN.test(value) ? value : this.gate.today();
  }

  // Người xem khối lượng của lớp: giáo viên đang dạy, chủ nhiệm lớp, Ban Giám hiệu
  private async assertClassViewer(currentUser: CurrentUser, database: YearExecutor, classId: string) {
    const assigned = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!assigned && !(await this.isLeadership(currentUser))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên của lớp, chủ nhiệm hoặc Ban Giám hiệu xem khối lượng này',
      );
    }
  }

  // ---------- Quy tắc của trường (Ban Giám hiệu)

  async policies(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem, đặt quy tắc bài về nhà');
    }
    return {
      policies: await this.gate.policies(database),
      reminder_time: reminderTimeOf(await this.setting(database, 'homework_reminder_time')),
    };
  }

  async savePolicy(currentUser: CurrentUser, body: RequestBody) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem, đặt quy tắc bài về nhà');
    }
    const input = parsePolicyInput(body);
    const { database } = await this.currentSchoolYear.require();
    const values = {
      no_homework: input.no_homework,
      max_items_per_day: input.max_items_per_day,
      max_minutes_per_day: input.max_minutes_per_day,
      blocked_weekdays: JSON.stringify(input.blocked_weekdays),
      skip_holidays: input.skip_holidays,
      action: input.action,
      basis: input.basis,
      updated_by: currentUser.id,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    return database
      .insertInto('homework_policies')
      .values({ school_level: input.school_level, grade: input.grade, ...values })
      .onConflict((conflict) => conflict.columns(['school_level', 'grade']).doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async removePolicy(currentUser: CurrentUser, policyId: string) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem, đặt quy tắc bài về nhà');
    }
    const { database } = await this.currentSchoolYear.require();
    const removed = await database.deleteFrom('homework_policies').where('id', '=', policyId).executeTakeFirst();
    if (Number(removed.numDeletedRows) === 0) {
      throw notFoundError('Không tìm thấy quy tắc bài về nhà', 'homework_policy');
    }
    return { id: policyId };
  }

  // Giờ nhắc "sắp đến hạn" của hôm trước (mặc định 19:00); vẫn không gửi trong giờ yên lặng 21:00 đến 6:00
  async saveReminderTime(currentUser: CurrentUser, body: RequestBody) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem, đặt quy tắc bài về nhà');
    }
    const value = body?.reminder_time;
    if (typeof value !== 'string' || reminderTimeOf(value) !== value || value >= '21:00' || value < '06:00') {
      throw homeworkRule('Giờ nhắc dạng HH:MM, từ 06:00 đến trước 21:00', [
        { field: 'reminder_time', message: 'Giờ nhắc từ 06:00 đến 20:59' },
      ]);
    }
    const { database } = await this.currentSchoolYear.require();
    const unit = await database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'truong_chinh')
      .executeTakeFirst();
    if (!unit) {
      throw homeworkRule('Chưa có Trường chính để lưu cấu hình');
    }
    await database
      .insertInto('settings')
      .values({ org_unit_id: unit.id, key: 'homework_reminder_time', value_type: 'text', value: JSON.stringify(value) })
      .onConflict((conflict) => conflict.columns(['org_unit_id', 'key']).doUpdateSet({ value: JSON.stringify(value) }))
      .execute();
    return { reminder_time: value };
  }

  // ---------- Khối lượng của lớp

  async classWorkload(currentUser: CurrentUser, classId: string, fromValue: unknown) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await this.gate.classOf(database, classId);
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    await this.assertClassViewer(currentUser, database, classId);
    return { class: classRow, ...(await this.gate.classWorkload(database, classId, this.readFrom(fromValue))) };
  }

  // Lịch 7 ngày của lớp (từ hôm nay) kèm bài đang soạn và vi phạm quy tắc nếu phát hành bây giờ
  async activityWorkload(currentUser: CurrentUser, activityId: string) {
    const { database, space, activity } = await this.learning.teacherActivity(currentUser, activityId);
    const assignment = await database
      .selectFrom('assignments')
      .selectAll()
      .where('activity_id', '=', activityId)
      .executeTakeFirst();
    if (!space.class_id) {
      return { from: this.gate.today(), policy: null, days: [], check: { violations: [], action: null } };
    }
    const subject = space.subject_id
      ? await database.selectFrom('subjects').select('name').where('id', '=', space.subject_id).executeTakeFirst()
      : undefined;
    // 7 ngày quanh ngày đến hạn (từ 3 ngày trước hạn, không sớm hơn hôm nay); bài chưa có hạn thì từ hôm nay
    const today = this.gate.today();
    const around = activity.due_at ? addDays(vietnamDate(activity.due_at), -3) : today;
    const workload = await this.gate.classWorkload(
      database,
      space.class_id,
      around > today ? around : today,
      this.gate.draftItem(activity, assignment, subject?.name ?? null),
    );
    const check = assignment
      ? await this.gate.evaluate(database, space, activity, assignment)
      : { violations: [], action: null };
    return { ...workload, check, override_reason: assignment?.policy_override_reason ?? null };
  }

  // Ban Giám hiệu cho vượt quy tắc chặn trên một bài về nhà chưa phát hành, có lý do; giáo viên phát hành sau đó
  async approveOverride(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu cho vượt quy tắc bài về nhà');
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (reason === '' || reason.length > 500) {
      throw homeworkRule('Ghi lý do vượt quy tắc, tối đa 500 ký tự', [
        { field: 'reason', message: 'Từ 1 đến 500 ký tự' },
      ]);
    }
    const { database } = await this.currentSchoolYear.require();
    const assignment = await database
      .selectFrom('assignments')
      .select(['id', 'context', 'released_at'])
      .where('activity_id', '=', activityId)
      .executeTakeFirst();
    if (!assignment || assignment.context !== 'homework') {
      throw notFoundError('Không tìm thấy bài về nhà', 'assignment');
    }
    if (assignment.released_at) {
      throw homeworkRule('Bài đã phát hành');
    }
    await database
      .updateTable('assignments')
      .set({ policy_override_reason: reason, policy_override_by: currentUser.id, updated_at: this.clock.now() })
      .where('id', '=', assignment.id)
      .execute();
    return { activity_id: activityId, override_reason: reason };
  }

  // ---------- Giao từ sổ đầu bài

  private async classLog(database: YearExecutor, classLogId: string) {
    const log = await database
      .selectFrom('class_logs')
      .innerJoin('classes', 'classes.id', 'class_logs.class_id')
      .select([
        'class_logs.id',
        'class_logs.class_id',
        'class_logs.subject_id',
        'class_logs.lesson_date',
        'class_logs.period_no',
        'class_logs.group_no',
        'class_logs.lesson_title',
        'class_logs.teacher_user_id',
        'classes.school_level',
      ])
      .where('class_logs.id', '=', classLogId)
      .executeTakeFirst();
    if (!log) {
      throw notFoundError('Không tìm thấy tiết trong sổ đầu bài', 'class_log');
    }
    const space = await database
      .selectFrom('course_spaces')
      .selectAll()
      .where('class_id', '=', log.class_id)
      .where('subject_id', '=', log.subject_id)
      .where('status', '=', 'active')
      .orderBy('created_at')
      .executeTakeFirst();
    return { log: { ...log, lesson_date: String(log.lesson_date).slice(0, 10) }, space: space ?? null };
  }

  // Bài về nhà của tiết (đọc từ bảng bài tập): giáo viên của tiết hoặc người xem được lớp học trực tuyến của môn
  async lessonHomework(currentUser: CurrentUser, classLogId: string) {
    const { database } = await this.currentSchoolYear.require();
    const { log, space } = await this.classLog(database, classLogId);
    let canTeach = log.teacher_user_id === currentUser.id;
    if (space) {
      canTeach = (await this.learning.spaceAccess(currentUser, space.id)).canTeach;
    } else if (!canTeach) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được bài về nhà của tiết này');
    }
    const items = await database
      .selectFrom('assignments')
      .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
      .select([
        'course_activities.id as activity_id',
        'course_activities.title',
        'course_activities.due_at',
        'assignments.released_at',
        'assignments.estimated_minutes',
      ])
      .where('assignments.class_log_id', '=', log.id)
      .orderBy('assignments.created_at')
      .execute();
    return {
      space: space ? { id: space.id, title: space.title } : null,
      can_assign: Boolean(space) && canTeach,
      items: items.map((item) => ({ ...item, released: item.released_at !== null })),
    };
  }

  // Đầu tiết kế tiếp của môn với lớp (cùng nhóm của tiết) trong 14 ngày sau ngày của tiết, bỏ ngày nghỉ lễ
  private async nextLesson(database: YearExecutor, log: Awaited<ReturnType<HomeworkService['classLog']>>['log']) {
    const slots = await this.timetables.periodSlots(log.school_level as SchoolLevelCode);
    const candidates: LessonCandidate[] = [];
    for (let offset = 1; offset <= NEXT_LESSON_DAYS && candidates.length === 0; offset += 1) {
      const date = addDays(log.lesson_date, offset);
      if (await this.gate.isHoliday(database, date)) continue;
      for (const lesson of await this.changes.effectiveDay(database, date)) {
        if (
          lesson.class_id === log.class_id &&
          lesson.subject_id === log.subject_id &&
          lesson.group_no === log.group_no
        ) {
          const slot = slots.find((item) => item.period_no === lesson.period_no);
          candidates.push({ date, period_no: lesson.period_no, start_time: slot?.start_time ?? null });
        }
      }
    }
    return nextLessonDue(log.lesson_date, candidates);
  }

  // Tạo bài về nhà (bản nháp) từ tiết: hoạt động bài tập ở chương đầu của lớp học trực tuyến (chưa có chương thì tạo chương
  // "Bài về nhà"), ngữ cảnh `homework`, gắn tiết và nhóm của tiết, hạn trước tiết kế tiếp; giáo viên soạn tiếp ở màn hình bài tập
  async createFromClassLog(currentUser: CurrentUser, classLogId: string, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const { log, space } = await this.classLog(database, classLogId);
    if (!space) {
      throw homeworkRule('Lớp chưa có lớp học trực tuyến của môn này để giao bài về nhà');
    }
    const access = await this.learning.spaceAccess(currentUser, space.id);
    if (!access.canTeach) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp học trực tuyến giao bài về nhà');
    }
    const title =
      typeof body?.title === 'string' && body.title.trim() !== ''
        ? body.title.trim()
        : `Bài về nhà: ${log.lesson_title}`.slice(0, 200);
    let section = await database
      .selectFrom('course_sections')
      .select('id')
      .where('space_id', '=', space.id)
      .orderBy('position')
      .executeTakeFirst();
    if (!section) {
      section = await this.learning.createSection(currentUser, space.id, { title: 'Bài về nhà' });
    }
    const due = await this.nextLesson(database, log);
    const minutes = typeof body?.estimated_minutes === 'number' ? body.estimated_minutes : undefined;
    const activity = await this.learning.createActivity(
      currentUser,
      space.id,
      parseActivityInput(
        {
          kind: 'assignment',
          section_id: section.id,
          title,
          instructions: typeof body?.instructions === 'string' ? body.instructions : null,
          due_at: due.due_at.toISOString(),
          ...(minutes !== undefined ? { estimated_minutes: minutes } : {}),
        },
        false,
      ),
    );
    await database
      .insertInto('assignments')
      .values({
        activity_id: activity.id,
        context: 'homework',
        class_log_id: log.id,
        group_no: log.group_no,
        estimated_minutes: minutes ?? null,
        created_by: currentUser.id,
      })
      .execute();
    return { activity_id: activity.id, space_id: space.id, due_at: due.due_at, due_basis: due.basis };
  }

  // ---------- Vắng có phép ngày giao

  // Học sinh nhận bài vắng có phép (phụ huynh báo trước) ngày giao bài: gợi ý giáo viên gia hạn hoặc miễn
  async absences(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.learning.teacherActivity(currentUser, activityId);
    const assignment = await database
      .selectFrom('assignments')
      .select(['id', 'released_at'])
      .where('activity_id', '=', activityId)
      .executeTakeFirst();
    if (!assignment?.released_at) {
      return { date: null, students: [] };
    }
    const date = vietnamDate(assignment.released_at);
    const rows = await database
      .selectFrom('assignment_recipients')
      .innerJoin('children', 'children.id', 'assignment_recipients.child_id')
      .innerJoin('absence_records', 'absence_records.child_id', 'assignment_recipients.child_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'absence_records.reason',
        'assignment_recipients.due_at',
        'assignment_recipients.excused',
      ])
      .where('assignment_recipients.assignment_id', '=', assignment.id)
      .where('absence_records.absence_date', '=', date)
      .where('absence_records.is_advised', '=', true)
      .orderBy('children.full_name')
      .execute();
    return {
      date,
      students: rows.map((row) => ({
        ...row,
        suggestion: row.excused ? null : row.due_at ? 'excuse' : 'extend',
      })),
    };
  }

  // ---------- Phụ huynh

  // "Bài tập của con": bài về nhà đã giao (mới nhất trước) với hạn, trạng thái, kết quả và nhận xét khi giáo viên đã trả, đã xem
  // cùng con chưa; có thể nộp thay khi con chưa có tài khoản học và bài làm cá nhân
  async childHomework(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const guardian = await this.learning.guardianOrStaff(currentUser, database, childId);
    const rows = await database
      .selectFrom('assignment_recipients')
      .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
      .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
      .innerJoin('course_spaces', 'course_spaces.id', 'course_activities.space_id')
      .leftJoin('subjects', 'subjects.id', 'course_spaces.subject_id')
      .select([
        'assignments.id as assignment_id',
        'assignments.work_mode',
        'assignments.estimated_minutes',
        'course_activities.id as activity_id',
        'course_activities.title',
        'course_activities.instructions',
        'course_activities.due_at as activity_due_at',
        'course_spaces.title as space_title',
        'subjects.name as subject_name',
        'assignment_recipients.due_at',
        'assignment_recipients.excused',
        'assignment_recipients.group_id',
      ])
      .where('assignment_recipients.child_id', '=', childId)
      .where('assignments.context', '=', 'homework')
      .where('assignments.released_at', 'is not', null)
      .where('course_activities.status', '=', 'published')
      .orderBy('course_activities.due_at', 'desc')
      .limit(60)
      .execute();
    const assignmentIds = rows.map((row) => row.assignment_id);
    const [submissions, acknowledgements, account] = await Promise.all([
      assignmentIds.length > 0
        ? database
            .selectFrom('assignment_submissions')
            .select([
              'id',
              'assignment_id',
              'child_id',
              'group_id',
              'attempt_no',
              'status',
              'late',
              'submitted_at',
              'submitted_by_kind',
              'score',
              'level',
              'feedback',
              'feedback_ai_assisted',
            ])
            .where('assignment_id', 'in', assignmentIds)
            .where('status', '<>', 'draft')
            .where((builder) =>
              builder.or([
                builder('child_id', '=', childId),
                builder(
                  'group_id',
                  'in',
                  rows.map((row) => row.group_id ?? NO_ID),
                ),
              ]),
            )
            .orderBy('attempt_no')
            .execute()
        : Promise.resolve([]),
      assignmentIds.length > 0
        ? database
            .selectFrom('homework_acknowledgements')
            .select(['assignment_id', 'guardian_name', 'acknowledged_at', 'guardian_user_id'])
            .where('assignment_id', 'in', assignmentIds)
            .where('child_id', '=', childId)
            .execute()
        : Promise.resolve([]),
      database
        .selectFrom('student_learning_accounts')
        .select('identity_user_id')
        .where('child_id', '=', childId)
        .where('identity_user_id', 'is not', null)
        .executeTakeFirst(),
    ]);
    const now = this.clock.now();
    return {
      has_student_account: Boolean(account),
      items: rows.map((row) => {
        const own = submissions.filter((submission) =>
          row.group_id ? submission.group_id === row.group_id : submission.child_id === childId,
        );
        const mine = own.filter((submission) => submission.assignment_id === row.assignment_id);
        const latest = mine[mine.length - 1] ?? null;
        const dueAt = row.due_at ?? row.activity_due_at;
        const returned = latest?.status === 'returned';
        const acknowledged = acknowledgements.filter((item) => item.assignment_id === row.assignment_id);
        return {
          activity_id: row.activity_id,
          title: row.title,
          instructions: row.instructions,
          subject_name: row.subject_name,
          space_title: row.space_title,
          due_at: dueAt,
          due_date: dueAt ? vietnamDate(dueAt) : null,
          estimated_minutes: row.estimated_minutes,
          work_mode: row.work_mode,
          status: homeworkStatus({ excused: row.excused, latest: latest?.status ?? null, dueAt, now }),
          late: latest?.late ?? false,
          submitted_by_kind: latest?.submitted_by_kind ?? null,
          submission_id: latest?.id ?? null,
          score: returned ? numberOrNull(latest.score) : null,
          level: returned ? latest.level : null,
          feedback: returned ? latest.feedback : null,
          feedback_ai_assisted: returned ? latest.feedback_ai_assisted : false,
          acknowledged_by: acknowledged.map((item) => ({ name: item.guardian_name, at: item.acknowledged_at })),
          acknowledged_by_me: acknowledged.some((item) => item.guardian_user_id === currentUser.id),
          can_proxy: guardian && !account && row.work_mode === 'individual' && !row.excused && latest === null,
        };
      }),
    };
  }

  // "Đã xem cùng con": phụ huynh xác nhận đã xem bài về nhà cùng con (bấm lại không đổi gì)
  async acknowledge(currentUser: CurrentUser, childId: string, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await this.learning.guardianOrStaff(currentUser, database, childId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của học sinh xác nhận đã xem cùng con');
    }
    const recipient = await database
      .selectFrom('assignment_recipients')
      .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
      .select('assignments.id')
      .where('assignments.activity_id', '=', activityId)
      .where('assignments.context', '=', 'homework')
      .where('assignments.released_at', 'is not', null)
      .where('assignment_recipients.child_id', '=', childId)
      .executeTakeFirst();
    if (!recipient) {
      throw notFoundError('Bài về nhà chưa giao cho con', 'assignment');
    }
    await database
      .insertInto('homework_acknowledgements')
      .values({
        assignment_id: recipient.id,
        child_id: childId,
        guardian_user_id: currentUser.id,
        guardian_name: currentUser.description.full_name,
      })
      .onConflict((conflict) => conflict.columns(['assignment_id', 'child_id', 'guardian_user_id']).doNothing())
      .execute();
    return { activity_id: activityId, acknowledged: true };
  }

  // ---------- Nhắc bài về nhà (việc nền)

  // Một lượt: bài về nhà đã phát hành trong 10 ngày gần đây của mọi em nhận bài; nhắc đến lượt gộp theo em và loại, gửi tới phụ
  // huynh (trong ứng dụng và tin đẩy) và tài khoản học của em; ghi nhật ký trước khi gửi để lượt khác không gửi trùng
  async sendReminders(): Promise<number> {
    const current = await this.currentSchoolYear.find();
    if (!current) return 0;
    const database = current.database;
    const now = this.clock.now();
    const since = new Date(now.getTime() - 10 * 86_400_000);
    const rows = await database
      .selectFrom('assignment_recipients')
      .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
      .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
      .select([
        'assignments.id as assignment_id',
        'assignment_recipients.child_id',
        'assignment_recipients.group_id',
        'assignment_recipients.due_at',
        'assignment_recipients.excused',
        'course_activities.title',
        'course_activities.due_at as activity_due_at',
        'assignments.released_at',
      ])
      .where('assignments.context', '=', 'homework')
      .where('assignments.released_at', '>=', since)
      .where('course_activities.status', '=', 'published')
      .execute();
    if (rows.length === 0) return 0;
    const assignmentIds = [...new Set(rows.map((row) => row.assignment_id))];
    const [submissions, sent] = await Promise.all([
      database
        .selectFrom('assignment_submissions')
        .select(['assignment_id', 'child_id', 'group_id', 'status', 'returned_at'])
        .where('assignment_id', 'in', assignmentIds)
        .where('status', '<>', 'draft')
        .execute(),
      database
        .selectFrom('homework_reminders')
        .select(['assignment_id', 'child_id', 'kind'])
        .where('assignment_id', 'in', assignmentIds)
        .execute(),
    ]);
    const planned = planReminders(
      now,
      reminderTimeOf(await this.setting(database, 'homework_reminder_time')),
      rows.map((row) => {
        const own = submissions.filter(
          (submission) =>
            submission.assignment_id === row.assignment_id &&
            (row.group_id ? submission.group_id === row.group_id : submission.child_id === row.child_id),
        );
        const returned = own.filter((submission) => submission.status === 'returned').at(-1);
        return {
          assignment_id: row.assignment_id,
          child_id: row.child_id,
          title: row.title,
          due_at: row.due_at ?? row.activity_due_at,
          released_at: row.released_at,
          excused: row.excused,
          submitted: own.length > 0,
          returned_at: returned?.returned_at ?? null,
          sent: sent
            .filter((item) => item.assignment_id === row.assignment_id && item.child_id === row.child_id)
            .map((item) => item.kind),
        };
      }),
    );
    let count = 0;
    for (const reminder of planned) {
      const claimed = await database
        .insertInto('homework_reminders')
        .values(
          reminder.items.map((item) => ({
            kind: reminder.kind,
            assignment_id: item.assignment_id,
            child_id: reminder.child_id,
          })),
        )
        .onConflict((conflict) => conflict.columns(['kind', 'assignment_id', 'child_id']).doNothing())
        .returning('assignment_id')
        .execute();
      if (claimed.length === 0) continue;
      const claimedIds = new Set(claimed.map((row) => row.assignment_id));
      const items = reminder.items.filter((item) => claimedIds.has(item.assignment_id));
      const [child, guardians, account] = await Promise.all([
        database
          .selectFrom('children')
          .select(['full_name', 'org_unit_id'])
          .where('id', '=', reminder.child_id)
          .executeTakeFirst(),
        database
          .selectFrom('child_guardians')
          .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
          .select('guardians.user_id')
          .where('child_guardians.child_id', '=', reminder.child_id)
          .where('guardians.user_id', 'is not', null)
          .execute(),
        database
          .selectFrom('student_learning_accounts')
          .select('identity_user_id')
          .where('child_id', '=', reminder.child_id)
          .where('identity_user_id', 'is not', null)
          .executeTakeFirst(),
      ]);
      if (!child) continue;
      const text = reminderText({ ...reminder, items }, child.full_name);
      const guardianUsers = guardians.flatMap((row) => (row.user_id ? [row.user_id] : []));
      await queueNotification(database, {
        orgUnitId: child.org_unit_id,
        templateCode: REMINDER_TEMPLATES[reminder.kind],
        title: text.title,
        body: text.body,
        targetType: 'child',
        targetId: reminder.child_id,
        recipients: [
          ...guardianUsers.flatMap((userId) => [
            { userId, channel: 'in_app' as const },
            { userId, channel: 'push' as const },
          ]),
          ...(account?.identity_user_id ? [{ userId: account.identity_user_id, channel: 'in_app' as const }] : []),
        ],
      });
      count += 1;
    }
    return count;
  }
}
