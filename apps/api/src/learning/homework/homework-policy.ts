import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { Clock } from '@school-management/server';
import type { Kysely, Selectable, Transaction } from 'kysely';
import {
  addDays,
  checkWorkload,
  gradeNumber,
  homeworkRule,
  policyFor,
  vietnamDate,
  workloadDays,
  type WorkloadItem,
  type WorkloadResult,
} from './homework-rules.js';

// Quy tắc khối lượng bài về nhà của trường (DT-28 phần 28f, YCTD-276; GD-143): đọc quy tắc theo cấp, khối của lớp, lịch khối lượng
// 7 ngày của lớp (bài về nhà đã phát hành của mọi môn theo ngày đến hạn) và kiểm khi giáo viên phát hành bài về nhà. Dịch vụ bài tập
// của 28c gọi `beforeRelease`; trường chưa đặt quy tắc thì không chặn, không cảnh báo
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type ActivityRow = Selectable<SchoolYearDatabase['course_activities']>;
type AssignmentRow = Selectable<SchoolYearDatabase['assignments']>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;

export interface ReleaseDecision {
  override_reason: string | null;
  result: WorkloadResult;
}

@Injectable()
export class HomeworkPolicyGate {
  constructor(private readonly clock: Clock) {}

  async policies(database: YearExecutor) {
    return database.selectFrom('homework_policies').selectAll().orderBy('school_level').orderBy('grade').execute();
  }

  async classOf(database: YearExecutor, classId: string) {
    return database
      .selectFrom('classes')
      .select(['id', 'name', 'school_level', 'grade_level'])
      .where('id', '=', classId)
      .executeTakeFirst();
  }

  async policyOfClass(database: YearExecutor, classId: string) {
    const row = await this.classOf(database, classId);
    if (!row) return null;
    return policyFor(await this.policies(database), row.school_level, gradeNumber(row.grade_level));
  }

  // Bài về nhà của lớp (mọi môn) có hạn trong khoảng; bài đang soạn chỉ tính khi được truyền vào
  async classItems(database: YearExecutor, classId: string, from: string, to: string): Promise<WorkloadItem[]> {
    const rows = await database
      .selectFrom('assignments')
      .innerJoin('course_activities', 'course_activities.id', 'assignments.activity_id')
      .innerJoin('course_spaces', 'course_spaces.id', 'course_activities.space_id')
      .leftJoin('subjects', 'subjects.id', 'course_spaces.subject_id')
      .select([
        'course_activities.id as activity_id',
        'course_activities.title',
        'course_activities.due_at',
        'course_activities.estimated_minutes as activity_minutes',
        'assignments.estimated_minutes',
        'assignments.released_at',
        'subjects.name as subject_name',
      ])
      .where('assignments.context', '=', 'homework')
      .where('assignments.released_at', 'is not', null)
      .where('course_spaces.class_id', '=', classId)
      .where('course_activities.due_at', '>=', new Date(`${from}T00:00:00+07:00`))
      .where('course_activities.due_at', '<', new Date(`${addDays(to, 1)}T00:00:00+07:00`))
      .execute();
    return rows.map((row) => ({
      activity_id: row.activity_id,
      title: row.title,
      subject_name: row.subject_name,
      due_at: row.due_at,
      minutes: row.estimated_minutes ?? row.activity_minutes,
      released: true,
    }));
  }

  async isHoliday(database: YearExecutor, date: string) {
    const row = await database.selectFrom('holidays').select('id').where('holiday_date', '=', date).executeTakeFirst();
    return Boolean(row);
  }

  // Lịch khối lượng 7 ngày của lớp, kèm bài đang soạn (nếu có) để giáo viên thấy trước khi phát hành
  async classWorkload(database: YearExecutor, classId: string, from: string, draft?: WorkloadItem) {
    const to = addDays(from, 6);
    const items = (await this.classItems(database, classId, from, to)).filter(
      (item) => item.activity_id !== draft?.activity_id,
    );
    return {
      from,
      policy: await this.policyOfClass(database, classId),
      days: workloadDays(from, draft ? [...items, draft] : items),
    };
  }

  draftItem(activity: ActivityRow, assignment: AssignmentRow | undefined, subjectName: string | null): WorkloadItem {
    return {
      activity_id: activity.id,
      title: activity.title,
      subject_name: subjectName,
      due_at: activity.due_at,
      minutes: assignment?.estimated_minutes ?? activity.estimated_minutes,
      released: false,
    };
  }

  // Bài về nhà sắp phát hành có vi phạm quy tắc không (tính cả bài khác của lớp có cùng ngày đến hạn)
  async evaluate(database: YearExecutor, space: SpaceRow, activity: ActivityRow, assignment: AssignmentRow) {
    if (assignment.context !== 'homework' || !space.class_id) {
      return { violations: [], action: null } satisfies WorkloadResult;
    }
    const policy = await this.policyOfClass(database, space.class_id);
    if (!policy) {
      return { violations: [], action: null } satisfies WorkloadResult;
    }
    const dueDate = activity.due_at ? vietnamDate(activity.due_at) : null;
    const others = dueDate
      ? (await this.classItems(database, space.class_id, dueDate, dueDate)).filter(
          (item) => item.activity_id !== activity.id,
        )
      : [];
    return checkWorkload({
      policy,
      dueDate,
      holiday: dueDate ? await this.isHoliday(database, dueDate) : false,
      existing: {
        count: others.length,
        minutes: others.reduce((total, item) => total + (item.minutes ?? 0), 0),
      },
      minutes: assignment.estimated_minutes ?? activity.estimated_minutes,
    });
  }

  // Trước khi phát hành: cảnh báo thì giáo viên phải xác nhận (`confirm_warnings`); chặn thì chỉ Ban Giám hiệu vượt được, có lý do
  async beforeRelease(
    database: YearExecutor,
    input: {
      space: SpaceRow;
      activity: ActivityRow;
      assignment: AssignmentRow;
      leadership: boolean;
      confirmWarnings: boolean;
      overrideReason: string | null;
    },
  ): Promise<ReleaseDecision> {
    const result = await this.evaluate(database, input.space, input.activity, input.assignment);
    if (result.action === null) {
      return { override_reason: null, result };
    }
    const summary = result.violations.join('. ');
    if (result.action === 'warn') {
      if (!input.confirmWarnings) {
        throw homeworkRule(`Bài về nhà vượt quy tắc của trường: ${summary}. Xác nhận để vẫn giao`, [
          { field: 'confirm_warnings', message: summary },
        ]);
      }
      return { override_reason: null, result };
    }
    // Ban Giám hiệu đã cho vượt quy tắc chặn trên bài này (lý do đã lưu), giáo viên phát hành được
    if (input.assignment.policy_override_reason) {
      return { override_reason: null, result };
    }
    if (!input.leadership) {
      throw homeworkRule(`Trường chặn bài về nhà này: ${summary}. Đổi hạn, số phút hoặc nhờ Ban Giám hiệu cho vượt`, [
        { field: 'override_reason', message: summary },
      ]);
    }
    const reason = input.overrideReason?.trim() ?? '';
    if (reason === '' || reason.length > 500) {
      throw homeworkRule(`Trường chặn bài về nhà này: ${summary}. Ban Giám hiệu ghi lý do để vẫn giao`, [
        { field: 'override_reason', message: 'Ghi lý do vượt quy tắc, tối đa 500 ký tự' },
      ]);
    }
    return { override_reason: reason, result };
  }

  today(): string {
    return vietnamDate(this.clock.now());
  }
}
