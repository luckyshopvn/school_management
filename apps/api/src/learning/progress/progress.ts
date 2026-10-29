import { Inject, Injectable, Optional, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { vietnamDate, type SchoolLevelCode, type SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, isMultiTenantMode } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { AssessmentsService } from '../../assessments/assessments.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { Databases } from '../../common/databases.js';
import { JobScheduler } from '../../common/job-scheduler.js';
import { queueNotification } from '../../common/notification-queue.js';
import type { RequestBody } from '../../common/request-fields.js';
import { buildTableFile, CONTENT_TYPES, type TableFileFormat, type TableFileSheet } from '../../exports/table-file.js';
import { ScoresService } from '../../scores/scores.js';
import { isDone } from '../learning-rules.js';
import { LearningService } from '../learning.js';
import {
  attentionReasons,
  combineScore,
  correctRates,
  levelCounts,
  medianResponseHours,
  parseScoreBookInput,
  parseTermReport,
  progressRule,
  sectionProgress,
  suggestComment,
  suggestSubjectLevel,
  weekStart,
  weightedAverage,
  type ActivityInfo,
  type ResultCell,
  type SubjectLevelCode,
} from './progress-rules.js';

// Tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274; tài liệu 47 mục 20.7). Quyền lớp học trực tuyến lấy qua
// cửa của lõi 28b (`spaceAccess`, `guardianOrStaff`); điểm thường xuyên ghi qua `ScoresService.recordActivityScores` (cùng quyền
// nhập, khoá sổ, hạn của 21c); mức đạt môn và nhận xét thường xuyên của Tiểu học ghi qua `AssessmentsService` (cùng quyền, khoá,
// hạn của 20c). Không có gì tự ghi vào sổ (GD-141): giáo viên chọn hoạt động, xem trước, xác nhận
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type ActivityRow = Selectable<SchoolYearDatabase['course_activities']>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;
type TermType = 'first_term' | 'second_term';
const NO_ID = '00000000-0000-0000-0000-000000000000';
const WEEKLY_TEMPLATE = 'learning_weekly_summary';
const TERM_LABELS: Record<TermType, string> = { first_term: 'Học kỳ I', second_term: 'Học kỳ II' };
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  excused: 'Miễn',
};
const LEVEL_PHRASES: Record<SubjectLevelCode, string> = {
  T: 'Em học tập tích cực, hoàn thành tốt các hoạt động học trực tuyến.',
  H: 'Em hoàn thành các hoạt động học trực tuyến được giao.',
  C: 'Em cần cố gắng hoàn thành đầy đủ các hoạt động học trực tuyến.',
};

const numberOrNull = (value: string | null) => (value === null ? null : Number(value));
const dateText = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

function activityInfo(activity: ActivityRow): ActivityInfo {
  return {
    id: activity.id,
    section_id: activity.section_id,
    required: activity.required,
    due_at: activity.due_at,
    graded: activity.graded || activity.kind === 'assignment',
    weight: Number(activity.weight),
  };
}

@Injectable()
export class LearningProgressService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly scores: ScoresService,
    private readonly assessments: AssessmentsService,
    private readonly clock: Clock,
    @Optional() @Inject(JobScheduler) private readonly scheduler: JobScheduler | null = null,
  ) {}

  onApplicationBootstrap() {
    const run = async () => {
      try {
        await this.sendWeeklySummaries();
      } catch {
        // Lần sau chạy lại; tóm tắt hằng tuần không chặn việc khác
      }
    };
    if (isMultiTenantMode()) {
      this.scheduler?.register({ name: 'learning-weekly-summary', intervalSeconds: 3600, run });
      return;
    }
    this.timer = setInterval(() => void run(), 3_600_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- Đọc chung

  private async setting(database: YearExecutor, key: string, fallback: boolean): Promise<boolean> {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', key)
      .executeTakeFirst();
    return typeof row?.value === 'boolean' ? row.value : fallback;
  }

  private async publishedActivities(database: YearExecutor, spaceIds: string[]) {
    if (spaceIds.length === 0) return [];
    return database
      .selectFrom('course_activities')
      .selectAll()
      .where('space_id', 'in', spaceIds)
      .where('status', '=', 'published')
      .orderBy('position')
      .execute();
  }

  private async resultCells(database: YearExecutor, activityIds: string[], childIds: string[]) {
    const cells = new Map<string, Map<string, ResultCell>>();
    if (activityIds.length === 0 || childIds.length === 0) return cells;
    const rows = await database
      .selectFrom('activity_results')
      .select(['activity_id', 'child_id', 'status', 'score', 'level'])
      .where('activity_id', 'in', activityIds)
      .where('child_id', 'in', childIds)
      .execute();
    for (const row of rows) {
      const own = cells.get(row.child_id) ?? new Map<string, ResultCell>();
      own.set(row.activity_id, { status: row.status, score: numberOrNull(row.score), level: row.level });
      cells.set(row.child_id, own);
    }
    return cells;
  }

  // Bài tập đã nộp, đang chờ giáo viên chấm (lần nộp mới nhất của em hoặc nhóm em còn ở trạng thái đã nộp)
  private async pendingGrading(database: YearExecutor, activityIds: string[]) {
    const pending = new Map<string, Set<string>>();
    if (activityIds.length === 0) return pending;
    const recipients = await database
      .selectFrom('assignment_recipients')
      .innerJoin('assignments', 'assignments.id', 'assignment_recipients.assignment_id')
      .select(['assignments.activity_id', 'assignment_recipients.child_id', 'assignment_recipients.group_id'])
      .where('assignments.activity_id', 'in', activityIds)
      .execute();
    const submissions = await database
      .selectFrom('assignment_submissions')
      .innerJoin('assignments', 'assignments.id', 'assignment_submissions.assignment_id')
      .select([
        'assignments.activity_id',
        'assignment_submissions.child_id',
        'assignment_submissions.group_id',
        'assignment_submissions.status',
        'assignment_submissions.attempt_no',
      ])
      .where('assignments.activity_id', 'in', activityIds)
      .where('assignment_submissions.status', '<>', 'draft')
      .execute();
    const latest = new Map<string, { status: string; attempt: number }>();
    for (const row of submissions) {
      const key = `${row.activity_id}:${row.child_id ?? row.group_id}`;
      const current = latest.get(key);
      if (!current || row.attempt_no > current.attempt)
        latest.set(key, { status: row.status, attempt: row.attempt_no });
    }
    for (const recipient of recipients) {
      const key = `${recipient.activity_id}:${recipient.group_id ?? recipient.child_id}`;
      if (latest.get(key)?.status === 'submitted') {
        const own = pending.get(recipient.child_id) ?? new Set<string>();
        own.add(recipient.activity_id);
        pending.set(recipient.child_id, own);
      }
    }
    return pending;
  }

  private async lastOpened(database: YearExecutor, spaceIds: string[], childIds: string[]) {
    const map = new Map<string, Date>();
    if (spaceIds.length === 0 || childIds.length === 0) return map;
    const rows = await database
      .selectFrom('learning_events')
      .select(['child_id', sql<Date>`max(occurred_at)`.as('last')])
      .where('space_id', 'in', spaceIds)
      .where('child_id', 'in', childIds)
      .where('actor_kind', '=', 'student')
      .groupBy('child_id')
      .execute();
    for (const row of rows) if (row.child_id) map.set(row.child_id, new Date(row.last));
    return map;
  }

  // Tiến độ của một lớp học trực tuyến: từng em (phần trăm, quá hạn, chờ chấm, theo chương, cần chú ý) và lưới em × hoạt động
  private async spaceProgress(database: YearExecutor, space: SpaceRow) {
    const [activities, sections, students] = await Promise.all([
      this.publishedActivities(database, [space.id]),
      database
        .selectFrom('course_sections')
        .select(['id', 'title'])
        .where('space_id', '=', space.id)
        .orderBy('position')
        .execute(),
      this.learning.students(database, space),
    ]);
    const ids = activities.map((activity) => activity.id);
    const childIds = students.map((student) => student.id);
    const [cells, pending, opened] = await Promise.all([
      this.resultCells(database, ids, childIds),
      this.pendingGrading(database, ids),
      this.lastOpened(database, [space.id], childIds),
    ]);
    const now = this.clock.now();
    const infos = activities.map(activityInfo);
    const rows = students.map((student) => {
      const own = cells.get(student.id) ?? new Map<string, ResultCell>();
      const required = infos.filter((activity) => activity.required);
      const done = required.filter((activity) => isDone(own.get(activity.id)?.status)).length;
      const overdue = required.filter(
        (activity) => activity.due_at !== null && activity.due_at < now && !isDone(own.get(activity.id)?.status),
      ).length;
      return {
        child_id: student.id,
        full_name: student.full_name,
        order_number: student.order_number,
        summary: {
          required: required.length,
          done,
          overdue,
          pending_grading: pending.get(student.id)?.size ?? 0,
          percent: required.length === 0 ? 0 : Math.round((done / required.length) * 100),
        },
        sections: sectionProgress(sections, infos, own),
        attention: attentionReasons({
          activities: infos,
          results: own,
          lastOpenedAt: opened.get(student.id) ?? null,
          now,
        }),
        results: Object.fromEntries(
          activities.map((activity) => [
            activity.id,
            {
              ...(own.get(activity.id) ?? { status: 'not_started', score: null, level: null }),
              pending: pending.get(student.id)?.has(activity.id) ?? false,
            },
          ]),
        ),
      };
    });
    return { activities, sections, infos, students: rows, cells };
  }

  async grid(currentUser: CurrentUser, spaceId: string) {
    const { database, space } = await this.learning.spaceAccess(currentUser, spaceId);
    const progress = await this.spaceProgress(database, space);
    return {
      space: { id: space.id, title: space.title, school_level: space.school_level },
      activities: progress.activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        kind: activity.kind,
        section_id: activity.section_id,
        required: activity.required,
        due_at: activity.due_at,
      })),
      sections: progress.sections,
      students: progress.students,
      attention: progress.students
        .filter((student) => student.attention.length > 0)
        .map((student) => ({ child_id: student.child_id, full_name: student.full_name, reasons: student.attention })),
    };
  }

  // ---------- Bảng điểm hoạt động

  private async gradebookData(currentUser: CurrentUser, spaceId: string) {
    const { database, space, canTeach } = await this.learning.spaceAccess(currentUser, spaceId);
    const progress = await this.spaceProgress(database, space);
    const graded = progress.activities.filter((activity) => activity.graded || activity.kind === 'assignment');
    const gradedInfos = graded.map(activityInfo);
    const primary = space.school_level === 'TH';
    return {
      database,
      space,
      canTeach,
      graded,
      body: {
        space: { id: space.id, title: space.title, school_level: space.school_level },
        notice: 'Điểm trung bình hoạt động chỉ để tham khảo, không phải điểm trung bình môn theo Thông tư 22.',
        gradebook_enabled: await this.setting(database, 'learning_gradebook_enabled', true),
        can_transfer:
          canTeach && space.kind === 'class_subject' && space.class_id !== null && space.subject_id !== null,
        activities: graded.map((activity) => ({
          id: activity.id,
          title: activity.title,
          kind: activity.kind,
          weight: Number(activity.weight),
          pass_score: numberOrNull(activity.pass_score),
        })),
        rows: progress.students.map((student) => {
          const own = progress.cells.get(student.child_id) ?? new Map<string, ResultCell>();
          return {
            child_id: student.child_id,
            full_name: student.full_name,
            cells: Object.fromEntries(graded.map((activity) => [activity.id, own.get(activity.id) ?? null])),
            average: primary ? null : weightedAverage(gradedInfos, own),
            levels: primary ? levelCounts(gradedInfos, own) : null,
          };
        }),
      },
    };
  }

  async gradebook(currentUser: CurrentUser, spaceId: string) {
    return (await this.gradebookData(currentUser, spaceId)).body;
  }

  async gradebookFile(currentUser: CurrentUser, spaceId: string, format: TableFileFormat) {
    const { body } = await this.gradebookData(currentUser, spaceId);
    const levelText = { excellent: 'Hoàn thành tốt', completed: 'Hoàn thành', not_completed: 'Chưa hoàn thành' };
    const sheet: TableFileSheet = {
      title: 'Bảng điểm hoạt động',
      heading: [body.space.title, body.notice],
      numbered: true,
      columns: [
        { key: 'name', label: 'Họ và tên', width: 28 },
        ...body.activities.map((activity) => ({ key: activity.id, label: activity.title, width: 14 })),
        {
          key: 'average',
          label: body.space.school_level === 'TH' ? 'Mức (tốt/hoàn thành/chưa)' : 'Trung bình tham khảo',
        },
      ],
      rows: body.rows.map((row) => ({
        name: row.full_name,
        ...Object.fromEntries(
          body.activities.map((activity) => {
            const cell = row.cells[activity.id];
            const text = !cell
              ? ''
              : cell.status === 'excused'
                ? 'Miễn'
                : cell.score !== null
                  ? cell.score
                  : cell.level
                    ? levelText[cell.level]
                    : STATUS_LABELS[cell.status];
            return [activity.id, text];
          }),
        ),
        average: row.levels
          ? `${row.levels.excellent}/${row.levels.completed}/${row.levels.not_completed}`
          : (row.average ?? ''),
      })),
    };
    return {
      buffer: await buildTableFile(format, [sheet], this.clock.now()),
      contentType: CONTENT_TYPES[format],
      fileName: `bang-diem-hoat-dong.${format}`,
    };
  }

  // ---------- Vào sổ điểm (THCS, THPT)

  private async transferContext(currentUser: CurrentUser, spaceId: string) {
    const data = await this.gradebookData(currentUser, spaceId);
    if (!data.body.gradebook_enabled) {
      throw progressRule('Trường chưa bật đưa kết quả học trực tuyến vào sổ (cấu hình learning_gradebook_enabled)');
    }
    if (!data.body.can_transfer) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ giáo viên của lớp học trực tuyến theo lớp, môn mới đưa kết quả vào sổ',
      );
    }
    return data;
  }

  private chosen(graded: ActivityRow[], ids: string[]) {
    const chosen = ids.map((id) => graded.find((activity) => activity.id === id));
    if (chosen.some((activity) => !activity)) {
      throw progressRule('Chỉ chọn hoạt động đã giao, có tính điểm của lớp học trực tuyến này');
    }
    return chosen as ActivityRow[];
  }

  async scoreBookPreview(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database, space, graded, body: book } = await this.transferContext(currentUser, spaceId);
    if (space.school_level === 'TH') {
      throw progressRule('Tiểu học không ghi điểm số vào sổ: dùng gợi ý nhận xét và mức đạt môn (GD-141)');
    }
    const input = parseScoreBookInput(body);
    const activities = this.chosen(graded, input.activity_ids);
    const childIds = book.rows.map((row) => row.child_id);
    const cells = await this.resultCells(database, input.activity_ids, childIds);
    const existing = await database
      .selectFrom('score_entries')
      .select(['child_id', 'score', 'source'])
      .where('subject_id', '=', space.subject_id ?? NO_ID)
      .where('term_type', '=', input.term_type)
      .where('kind', '=', 'regular')
      .where('seq', '=', input.seq)
      .where('child_id', 'in', childIds.length > 0 ? childIds : [NO_ID])
      .execute();
    return {
      input,
      rows: book.rows.map((row) => {
        const combined = combineScore(
          activities.map((activity) => ({ id: activity.id, weight: Number(activity.weight) })),
          cells.get(row.child_id) ?? new Map(),
        );
        const current = existing.find((entry) => entry.child_id === row.child_id);
        return {
          child_id: row.child_id,
          full_name: row.full_name,
          score: combined.score,
          reason: combined.reason,
          current: current ? { score: Number(current.score), source: current.source } : null,
        };
      }),
    };
  }

  async scoreBookCommit(currentUser: CurrentUser, spaceId: string, body: RequestBody, origin: ChangeOrigin) {
    const preview = await this.scoreBookPreview(currentUser, spaceId, body);
    const { database, space } = await this.learning.spaceAccess(currentUser, spaceId);
    const scores = preview.rows
      .filter((row) => row.score !== null)
      .map((row) => ({ child_id: row.child_id, score: row.score as number }));
    if (scores.length === 0) {
      throw progressRule('Chưa em nào có điểm hoạt động để đưa vào sổ');
    }
    const result = await database.transaction().execute(async (transaction) => {
      const written = await this.scores.recordActivityScores(
        currentUser,
        {
          class_id: space.class_id ?? NO_ID,
          subject_id: space.subject_id ?? NO_ID,
          term_type: preview.input.term_type,
          seq: preview.input.seq,
          scores,
        },
        transaction,
      );
      const transfer = await transaction
        .insertInto('activity_score_transfers')
        .values({
          space_id: space.id,
          target: 'score_book',
          activity_ids: JSON.stringify(preview.input.activity_ids),
          method: preview.input.method,
          term_type: preview.input.term_type,
          seq: preview.input.seq,
          written: written.written,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'activity_score_transfers',
        entityId: transfer.id,
        action: 'create',
        before: null,
        after: { ...preview.input, space_id: space.id, scores },
      });
      return written;
    });
    return { written: result.written, skipped: preview.rows.length - scores.length };
  }

  // ---------- Sổ nhận xét (Tiểu học)

  private async primaryPeriods(database: YearExecutor) {
    return database
      .selectFrom('assessment_periods')
      .select(['id', 'code', 'name', 'term_type', 'kind', 'is_year_end'])
      .where('school_level', '=', 'TH')
      .orderBy('order_no')
      .execute();
  }

  async commentBookPreview(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database, space, graded, body: book } = await this.transferContext(currentUser, spaceId);
    if (space.school_level !== 'TH') {
      throw progressRule('Gợi ý nhận xét, mức đạt môn chỉ cho Tiểu học; THCS, THPT đưa điểm thường xuyên vào sổ điểm');
    }
    const ids = Array.isArray(body?.activity_ids)
      ? body.activity_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const activities = this.chosen(graded, ids.length > 0 ? ids : graded.map((activity) => activity.id));
    const childIds = book.rows.map((row) => row.child_id);
    const [cells, periods, templates, feedback] = await Promise.all([
      this.resultCells(
        database,
        activities.map((activity) => activity.id),
        childIds,
      ),
      this.primaryPeriods(database),
      database
        .selectFrom('comment_templates')
        .select(['id', 'content'])
        .where('school_level', '=', 'TH')
        .where('status', '=', 'active')
        .where('target', 'in', ['subject', 'general'])
        .orderBy('order_no')
        .execute(),
      this.returnedFeedback(
        database,
        activities.map((activity) => activity.id),
      ),
    ]);
    const infos = activities.map(activityInfo);
    return {
      activity_ids: activities.map((activity) => activity.id),
      periods,
      library: templates,
      rows: book.rows.map((row) => {
        const own = cells.get(row.child_id) ?? new Map<string, ResultCell>();
        const level = suggestSubjectLevel(
          infos.map((activity) => own.get(activity.id)).filter((cell): cell is ResultCell => !!cell),
        );
        const required = infos.filter((activity) => activity.required);
        return {
          child_id: row.child_id,
          full_name: row.full_name,
          level_code: level,
          comment: suggestComment({
            level,
            done: required.filter((activity) => isDone(own.get(activity.id)?.status)).length,
            required: required.length,
            templates: LEVEL_PHRASES,
          }),
          feedback: feedback.get(row.child_id) ?? [],
        };
      }),
    };
  }

  // Nhận xét giáo viên đã trả ở bài tập của từng em (bài cá nhân và bài nhóm của em), mới nhất trước
  private async returnedFeedback(database: YearExecutor, activityIds: string[]) {
    const map = new Map<string, string[]>();
    if (activityIds.length === 0) return map;
    const rows = await database
      .selectFrom('assignment_submissions')
      .innerJoin('assignments', 'assignments.id', 'assignment_submissions.assignment_id')
      .innerJoin('assignment_recipients', (join) =>
        join
          .onRef('assignment_recipients.assignment_id', '=', 'assignments.id')
          .on((builder) =>
            builder.or([
              builder('assignment_recipients.child_id', '=', builder.ref('assignment_submissions.child_id')),
              builder('assignment_recipients.group_id', '=', builder.ref('assignment_submissions.group_id')),
            ]),
          ),
      )
      .select([
        'assignment_recipients.child_id',
        'assignment_submissions.feedback',
        'assignment_submissions.returned_at',
      ])
      .where('assignments.activity_id', 'in', activityIds)
      .where('assignment_submissions.status', '=', 'returned')
      .where('assignment_submissions.feedback', 'is not', null)
      .orderBy('assignment_submissions.returned_at', 'desc')
      .execute();
    for (const row of rows) {
      const own = map.get(row.child_id) ?? [];
      if (row.feedback && own.length < 3) own.push(row.feedback);
      map.set(row.child_id, own);
    }
    return map;
  }

  async commentBookCommit(currentUser: CurrentUser, spaceId: string, body: RequestBody, origin: ChangeOrigin) {
    const { database, space } = await this.transferContext(currentUser, spaceId);
    if (space.school_level !== 'TH' || !space.class_id || !space.subject_id) {
      throw progressRule('Gợi ý nhận xét, mức đạt môn chỉ cho lớp Tiểu học theo lớp, môn');
    }
    const periodId = typeof body?.period_id === 'string' ? body.period_id : '';
    const period = (await this.primaryPeriods(database)).find((row) => row.id === periodId);
    if (!period) {
      throw progressRule('Chọn kỳ đánh giá của Tiểu học', [{ field: 'period_id', message: 'Kỳ đánh giá không có' }]);
    }
    const items = (Array.isArray(body?.items) ? body.items : []) as Array<Record<string, unknown>>;
    const entries = items
      .filter((item) => typeof item.child_id === 'string')
      .map((item) => ({
        child_id: item.child_id as string,
        level_code: typeof item.level_code === 'string' && item.level_code !== '' ? item.level_code : null,
        comment:
          typeof item.comment === 'string' && item.comment.trim() !== '' ? item.comment.trim().slice(0, 1000) : null,
      }));
    if (entries.length === 0 || entries.length > 200) {
      throw progressRule('Chọn từ 1 đến 200 học sinh', [{ field: 'items', message: 'Từ 1 đến 200 học sinh' }]);
    }
    // Mức đạt môn ghi qua sổ nhận xét của 20c; giữ điểm bài kiểm tra, nhận xét môn đang có của từng em
    const levels = entries.filter((entry) => entry.level_code !== null);
    if (levels.length > 0) {
      const current = await database
        .selectFrom('subject_results')
        .select(['child_id', 'score', 'comment'])
        .where('period_id', '=', period.id)
        .where('subject_id', '=', space.subject_id)
        .where(
          'child_id',
          'in',
          levels.map((entry) => entry.child_id),
        )
        .execute();
      await this.assessments.saveSubject(
        currentUser,
        space.class_id,
        {
          periodId: period.id,
          subjectId: space.subject_id,
          entries: levels.map((entry) => {
            const existing = current.find((row) => row.child_id === entry.child_id);
            return {
              child_id: entry.child_id,
              level_code: entry.level_code,
              score: existing?.score ?? null,
              comment: existing?.comment ?? null,
            };
          }),
        },
        origin,
      );
    }
    let comments = 0;
    const today = vietnamDate(this.clock.now());
    for (const entry of entries) {
      if (!entry.comment) continue;
      await this.assessments.addComment(
        currentUser,
        space.class_id,
        { childId: entry.child_id, subjectId: space.subject_id, itemId: null, date: today, content: entry.comment },
        origin,
      );
      comments += 1;
    }
    const ids = Array.isArray(body?.activity_ids) ? body.activity_ids.filter((id) => typeof id === 'string') : [];
    await database
      .insertInto('activity_score_transfers')
      .values({
        space_id: space.id,
        target: 'comment_book',
        activity_ids: JSON.stringify(ids),
        method: 'weighted',
        term_type: period.term_type,
        seq: null,
        written: levels.length + comments,
        created_by: currentUser.id,
        created_by_name: currentUser.description.full_name,
      })
      .execute();
    return { levels: levels.length, comments };
  }

  // ---------- Báo cáo theo vai trò

  private async isLeadership(currentUser: CurrentUser) {
    const context = await this.learning.context(currentUser);
    return context.canDecide || (context.canView && context.canApprove);
  }

  private async summarize(database: YearExecutor, spaces: SpaceRow[]) {
    const activities = await this.publishedActivities(
      database,
      spaces.map((space) => space.id),
    );
    const summaries = [];
    for (const space of spaces) {
      const students = await this.learning.students(database, space);
      const own = activities.filter((activity) => activity.space_id === space.id);
      const cells = await this.resultCells(
        database,
        own.map((activity) => activity.id),
        students.map((s) => s.id),
      );
      const infos = own.map(activityInfo);
      const required = infos.filter((activity) => activity.required);
      const now = this.clock.now();
      let done = 0;
      let overdue = 0;
      for (const student of students) {
        const mine = cells.get(student.id) ?? new Map<string, ResultCell>();
        done += required.filter((activity) => isDone(mine.get(activity.id)?.status)).length;
        overdue += required.filter(
          (activity) => activity.due_at !== null && activity.due_at < now && !isDone(mine.get(activity.id)?.status),
        ).length;
      }
      const slots = required.length * students.length;
      summaries.push({
        space_id: space.id,
        title: space.title,
        visible_to_students: space.visible_to_students,
        student_count: students.length,
        activity_count: own.length,
        completion_percent: slots === 0 ? 0 : Math.round((done / slots) * 100),
        overdue,
        uses_template: space.source_template_id !== null,
      });
    }
    return summaries;
  }

  // Chủ nhiệm: mọi môn của lớp (tiến độ, quá hạn, học sinh cần chú ý)
  async homeroomReport(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const homeroom = await database
      .selectFrom('class_staff_assignments')
      .select('id')
      .where('class_id', '=', classId)
      .where('staff_user_id', '=', currentUser.id)
      .where('assignment_role', '=', 'homeroom')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!homeroom && !(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm của lớp hoặc Ban Giám hiệu xem báo cáo này');
    }
    const spaces = await database
      .selectFrom('course_spaces')
      .selectAll()
      .where('class_id', '=', classId)
      .where('status', '=', 'active')
      .orderBy('title')
      .execute();
    const attention = new Map<string, { full_name: string; reasons: string[] }>();
    for (const space of spaces) {
      const progress = await this.spaceProgress(database, space);
      for (const student of progress.students) {
        if (student.attention.length === 0) continue;
        const entry = attention.get(student.child_id) ?? { full_name: student.full_name, reasons: [] };
        entry.reasons.push(...student.attention.map((reason) => `${space.title}: ${reason}`));
        attention.set(student.child_id, entry);
      }
    }
    return {
      spaces: await this.summarize(database, spaces),
      attention: [...attention.entries()].map(([childId, entry]) => ({ child_id: childId, ...entry })),
    };
  }

  // Tổ chuyên môn: các lớp của môn trong tổ (tỷ lệ hoàn thành, số lớp có hoạt động, dùng khoá mẫu); tổ trưởng xem tổ mình
  async departmentReport(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const leadership = await this.isLeadership(currentUser);
    let teams = database
      .selectFrom('subject_teams')
      .select(['subject_teams.id', 'subject_teams.name'])
      .where('subject_teams.status', '=', 'active');
    if (!leadership) {
      teams = teams.where((builder) =>
        builder.exists(
          builder
            .selectFrom('subject_team_members')
            .select('subject_team_members.team_id')
            .whereRef('subject_team_members.team_id', '=', 'subject_teams.id')
            .where('subject_team_members.staff_user_id', '=', currentUser.id)
            .where('subject_team_members.role', '=', 'head'),
        ),
      );
    }
    const rows = await teams.orderBy('subject_teams.name').execute();
    if (rows.length === 0 && !leadership) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ tổ trưởng chuyên môn hoặc Ban Giám hiệu xem báo cáo của tổ');
    }
    const result = [];
    for (const team of rows) {
      const subjects = await database
        .selectFrom('subject_team_subjects')
        .select('subject_id')
        .where('team_id', '=', team.id)
        .execute();
      const spaces = subjects.length
        ? await database
            .selectFrom('course_spaces')
            .selectAll()
            .where(
              'subject_id',
              'in',
              subjects.map((row) => row.subject_id),
            )
            .where('status', '=', 'active')
            .orderBy('title')
            .execute()
        : [];
      const summaries = await this.summarize(database, spaces);
      result.push({
        team_id: team.id,
        name: team.name,
        space_count: spaces.length,
        active_spaces: summaries.filter((space) => space.activity_count > 0).length,
        template_spaces: summaries.filter((space) => space.uses_template).length,
        completion_percent:
          summaries.length === 0
            ? 0
            : Math.round(summaries.reduce((sum, space) => sum + space.completion_percent, 0) / summaries.length),
        spaces: summaries,
      });
    }
    return { teams: result };
  }

  private async schoolStats(database: YearExecutor, range: { from: string; to: string } | null) {
    const spaces = await database.selectFrom('course_spaces').selectAll().where('status', '=', 'active').execute();
    let activityQuery = database
      .selectFrom('course_activities')
      .select(['id', 'space_id', 'teaching_mode', 'created_at', 'opens_at', 'created_by'])
      .where('status', '=', 'published');
    if (range) {
      activityQuery = activityQuery
        .where(sql<Date>`coalesce(opens_at, created_at)`, '>=', new Date(`${range.from}T00:00:00+07:00`))
        .where(sql<Date>`coalesce(opens_at, created_at)`, '<=', new Date(`${range.to}T23:59:59+07:00`));
    }
    const activities = await activityQuery.execute();
    const usedSpaces = spaces.filter(
      (space) => space.visible_to_students && activities.some((activity) => activity.space_id === space.id),
    );
    const weeks = new Map<string, number>();
    for (const activity of activities) {
      const key = weekStart(activity.opens_at ?? activity.created_at);
      weeks.set(key, (weeks.get(key) ?? 0) + 1);
    }
    const studentIds = new Set<string>();
    for (const space of usedSpaces) {
      for (const student of await this.learning.students(database, space)) studentIds.add(student.id);
    }
    const participants = activities.length
      ? await database
          .selectFrom('activity_results')
          .select('child_id')
          .distinct()
          .where(
            'activity_id',
            'in',
            activities.map((activity) => activity.id),
          )
          .where('status', 'in', ['completed', 'passed', 'failed'])
          .execute()
      : [];
    const returned = await database
      .selectFrom('assignment_submissions')
      .select(['submitted_at', 'returned_at', 'returned_by'])
      .where('status', '=', 'returned')
      .execute();
    return {
      space_count: spaces.length,
      spaces_in_use: usedSpaces.length,
      activities: activities.length,
      by_mode: {
        support: activities.filter((activity) => activity.teaching_mode === 'support').length,
        replace: activities.filter((activity) => activity.teaching_mode === 'replace').length,
      },
      by_week: [...weeks.entries()].sort().map(([week, count]) => ({ week, count })),
      students: studentIds.size,
      participating: participants.filter((row) => studentIds.has(row.child_id)).length,
      participation_percent:
        studentIds.size === 0
          ? 0
          : Math.round((participants.filter((row) => studentIds.has(row.child_id)).length / studentIds.size) * 100),
      median_response_hours: medianResponseHours(returned),
    };
  }

  // Hiệu trưởng: toàn trường (lớp đang dùng, hoạt động giao theo tuần, tỷ lệ tham gia, thời gian phản hồi, theo hình thức)
  async schoolReport(currentUser: CurrentUser) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem báo cáo toàn trường');
    }
    const { database } = await this.currentSchoolYear.require();
    return this.schoolStats(database, null);
  }

  // Hoạt động dạy của giáo viên: số lớp, hoạt động đã giao, bài đã trả, trung vị thời gian phản hồi
  async teachersReport(currentUser: CurrentUser) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem hoạt động dạy của giáo viên');
    }
    const { database } = await this.currentSchoolYear.require();
    const [teachers, activities, returned] = await Promise.all([
      database.selectFrom('course_space_teachers').select(['space_id', 'user_id', 'user_name']).execute(),
      database
        .selectFrom('course_activities')
        .select(['space_id', 'created_by'])
        .where('status', '=', 'published')
        .execute(),
      database
        .selectFrom('assignment_submissions')
        .select(['submitted_at', 'returned_at', 'returned_by'])
        .where('status', '=', 'returned')
        .execute(),
    ]);
    const people = new Map<string, { name: string; spaces: Set<string> }>();
    for (const row of teachers) {
      const entry = people.get(row.user_id) ?? { name: row.user_name, spaces: new Set<string>() };
      entry.spaces.add(row.space_id);
      people.set(row.user_id, entry);
    }
    return {
      teachers: [...people.entries()]
        .map(([userId, entry]) => {
          const own = returned.filter((row) => row.returned_by === userId);
          return {
            user_id: userId,
            full_name: entry.name,
            space_count: entry.spaces.size,
            activities: activities.filter((row) => row.created_by === userId).length,
            returned: own.length,
            median_response_hours: medianResponseHours(own),
          };
        })
        .sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi')),
    };
  }

  // Phụ huynh: tiến độ, hạn trong 7 ngày tới, nhận xét bài tập đã trả của con
  async childSummary(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    return this.summaryOfChild(database, childId);
  }

  private async summaryOfChild(database: YearExecutor, childId: string) {
    const learning = await this.learning.learningOfChild(database, childId);
    const now = this.clock.now();
    const soon = now.getTime() + 7 * 86_400_000;
    const activities = learning.spaces.flatMap((space) =>
      space.sections.flatMap((section) => section.activities.map((activity) => ({ ...activity, space: space.title }))),
    );
    const feedback = await this.returnedFeedback(
      database,
      activities.filter((activity) => activity.kind === 'assignment').map((activity) => activity.id),
    );
    return {
      spaces: learning.spaces.map((space) => ({ id: space.id, title: space.title, summary: space.summary })),
      due_soon: activities
        .filter((activity) => {
          const due = activity.due_at ? new Date(activity.due_at).getTime() : null;
          return due !== null && due >= now.getTime() && due <= soon && !isDone(activity.status as never);
        })
        .map((activity) => ({
          id: activity.id,
          title: activity.title,
          space: activity.space,
          due_at: activity.due_at,
        })),
      feedback: feedback.get(childId) ?? [],
    };
  }

  // Tóm tắt hằng tuần cho phụ huynh (bật theo trường): sáng thứ Hai từ 7 giờ, mỗi em một thông báo mỗi tuần, gửi trong ứng dụng
  async sendWeeklySummaries(): Promise<number> {
    const current = await this.currentSchoolYear.find();
    if (!current) return 0;
    const database = current.database;
    if (!(await this.setting(database, 'learning_weekly_summary_enabled', false))) return 0;
    const now = this.clock.now();
    const local = new Date(now.getTime() + 7 * 3_600_000);
    if (local.getUTCDay() !== 1 || local.getUTCHours() < 7) return 0;
    const week = weekStart(now);
    const since = new Date(`${week}T00:00:00+07:00`);
    const children = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('children', 'children.id', 'child_guardians.child_id')
      .select(['children.id as child_id', 'children.full_name', 'children.org_unit_id', 'guardians.user_id'])
      .where('guardians.user_id', 'is not', null)
      .where('children.status', '=', 'active')
      .where('children.deleted_at', 'is', null)
      .execute();
    const byChild = new Map<string, { name: string; unit: string; users: string[] }>();
    for (const row of children) {
      const entry = byChild.get(row.child_id) ?? { name: row.full_name, unit: row.org_unit_id, users: [] };
      if (row.user_id) entry.users.push(row.user_id);
      byChild.set(row.child_id, entry);
    }
    let sent = 0;
    for (const [childId, entry] of byChild) {
      const already = await database
        .selectFrom('notifications')
        .select('id')
        .where('template_code', '=', WEEKLY_TEMPLATE)
        .where('target_id', '=', childId)
        .where('created_at', '>=', since)
        .executeTakeFirst();
      if (already) continue;
      const summary = await this.summaryOfChild(database, childId);
      if (summary.spaces.length === 0) continue;
      const lines = summary.spaces.map(
        (space) =>
          `${space.title}: xong ${space.summary.done}/${space.summary.required}${space.summary.overdue > 0 ? `, quá hạn ${space.summary.overdue}` : ''}`,
      );
      if (summary.due_soon.length > 0)
        lines.push(`Sắp đến hạn: ${summary.due_soon.map((item) => item.title).join(', ')}`);
      await queueNotification(database, {
        orgUnitId: entry.unit,
        templateCode: WEEKLY_TEMPLATE,
        title: `Học trực tuyến tuần này của ${entry.name}`,
        body: lines.join('\n').slice(0, 1500),
        targetType: 'child',
        targetId: childId,
        recipients: entry.users.map((userId) => ({ userId, channel: 'in_app' as const })),
      });
      sent += 1;
    }
    return sent;
  }

  // ---------- Hồ sơ theo Thông tư 09

  private async termRange(level: SchoolLevelCode | null, term: TermType) {
    const { academicYearId } = await this.currentSchoolYear.require();
    const rows = await this.databases.system
      .selectFrom('academic_terms')
      .select(['school_level', 'start_date', 'end_date'])
      .where('academic_year_id', '=', academicYearId)
      .where('term_type', '=', term)
      .execute();
    const row =
      rows.find((item) => level !== null && item.school_level === level) ??
      rows.find((item) => item.school_level === null);
    return row ? { from: dateText(row.start_date), to: dateText(row.end_date) } : null;
  }

  private readTerm(value: unknown): TermType {
    if (value !== 'first_term' && value !== 'second_term') {
      throw progressRule('Học kỳ là first_term hoặc second_term', [
        { field: 'term_type', message: 'Học kỳ không hợp lệ' },
      ]);
    }
    return value;
  }

  // Báo cáo tổng kết dạy học trực tuyến theo học kỳ (Điều 15 khoản 6): số liệu máy tổng hợp và phần Ban Giám hiệu nhập
  async termReport(currentUser: CurrentUser, termValue: unknown) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu xem, lập báo cáo tổng kết dạy học trực tuyến');
    }
    const term = this.readTerm(termValue);
    const { database } = await this.currentSchoolYear.require();
    const range = await this.termRange(null, term);
    const saved = await database
      .selectFrom('online_teaching_term_reports')
      .selectAll()
      .where('term_type', '=', term)
      .executeTakeFirst();
    return {
      term_type: term,
      range,
      stats: await this.schoolStats(database, range),
      report: saved ?? null,
    };
  }

  async saveTermReport(currentUser: CurrentUser, termValue: unknown, body: RequestBody, origin: ChangeOrigin) {
    if (!(await this.isLeadership(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu lập báo cáo tổng kết dạy học trực tuyến');
    }
    const term = this.readTerm(termValue);
    const input = parseTermReport(body);
    const { database } = await this.currentSchoolYear.require();
    const values = {
      ...input,
      updated_by: currentUser.id,
      updated_by_name: currentUser.description.full_name,
      updated_at: this.clock.now(),
    };
    const row = await database
      .insertInto('online_teaching_term_reports')
      .values({ term_type: term, ...values })
      .onConflict((builder) => builder.column('term_type').doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(database, {
      origin,
      orgUnitId: null,
      entityName: 'online_teaching_term_reports',
      entityId: row.id,
      action: 'update',
      before: null,
      after: input,
    });
    return row;
  }

  async termReportFile(currentUser: CurrentUser, termValue: unknown, format: TableFileFormat) {
    const data = await this.termReport(currentUser, termValue);
    const stats = data.stats;
    const sheets: TableFileSheet[] = [
      {
        title: `Tổng kết dạy học trực tuyến ${TERM_LABELS[data.term_type]}`,
        heading: [
          `Báo cáo tổng kết dạy học trực tuyến ${TERM_LABELS[data.term_type]}`,
          data.range ? `Từ ${data.range.from} đến ${data.range.to}` : 'Năm học chưa khai báo học kỳ',
        ],
        columns: [
          { key: 'item', label: 'Nội dung', width: 40 },
          { key: 'value', label: 'Số liệu, đánh giá', width: 60 },
        ],
        rows: [
          { item: 'Số lớp học trực tuyến', value: stats.space_count },
          { item: 'Số lớp đang dùng (đã mở, có hoạt động)', value: stats.spaces_in_use },
          { item: 'Số hoạt động đã giao', value: stats.activities },
          { item: 'Hoạt động hỗ trợ dạy học trực tiếp', value: stats.by_mode.support },
          { item: 'Hoạt động thay thế dạy học trực tiếp', value: stats.by_mode.replace },
          {
            item: 'Số học sinh tham gia',
            value: `${stats.participating}/${stats.students} (${stats.participation_percent}%)`,
          },
          { item: 'Trung vị thời gian giáo viên trả bài (giờ)', value: stats.median_response_hours ?? '' },
          { item: 'Đánh giá', value: data.report?.evaluation ?? '' },
          { item: 'Khó khăn', value: data.report?.difficulties ?? '' },
          { item: 'Nguyên nhân', value: data.report?.causes ?? '' },
          { item: 'Kiến nghị', value: data.report?.recommendations ?? '' },
        ],
      },
    ];
    return {
      buffer: await buildTableFile(format, sheets, this.clock.now()),
      contentType: CONTENT_TYPES[format],
      fileName: `tong-ket-day-hoc-truc-tuyen-${data.term_type}.${format}`,
    };
  }

  // Hồ sơ dạy học trực tuyến của một lớp, môn theo học kỳ (Điều 8 khoản 1): kế hoạch theo tuần, hoạt động, tổng hợp nhật ký, kết quả
  async teachingRecordFile(currentUser: CurrentUser, spaceId: string, termValue: unknown, format: TableFileFormat) {
    const term = this.readTerm(termValue);
    const { database, space } = await this.learning.spaceAccess(currentUser, spaceId);
    const range = await this.termRange(space.school_level, term);
    const inTerm = (date: Date | null) => {
      if (!range || !date) return true;
      const day = vietnamDate(date);
      return day >= range.from && day <= range.to;
    };
    const progress = await this.spaceProgress(database, space);
    const activities = progress.activities.filter((activity) => inTerm(activity.opens_at ?? activity.created_at));
    const plan = await this.learning.plan(currentUser, spaceId);
    const events = activities.length
      ? await database
          .selectFrom('learning_events')
          .select(['activity_id', 'verb', sql<number>`count(*)::int`.as('count')])
          .where(
            'activity_id',
            'in',
            activities.map((activity) => activity.id),
          )
          .groupBy(['activity_id', 'verb'])
          .execute()
      : [];
    const sheets: TableFileSheet[] = [
      {
        title: 'Kế hoạch theo tuần',
        heading: [space.title, TERM_LABELS[term]],
        columns: [
          { key: 'week', label: 'Tuần', width: 8 },
          { key: 'items', label: 'Chương, hoạt động', width: 80 },
        ],
        rows: (plan.weeks as Array<Record<string, unknown>>).map((week) => ({
          week: week.week ?? 'Chưa xếp tuần',
          items: ((week.items as Array<Record<string, unknown>> | undefined) ?? [])
            .map((item) => String(item.title ?? ''))
            .join('; '),
        })),
      },
      {
        title: 'Hoạt động',
        numbered: true,
        columns: [
          { key: 'title', label: 'Hoạt động', width: 40 },
          { key: 'kind', label: 'Loại', width: 14 },
          { key: 'mode', label: 'Hình thức', width: 14 },
          { key: 'due', label: 'Hạn', width: 14 },
          { key: 'viewed', label: 'Lượt xem', width: 10 },
          { key: 'submitted', label: 'Lượt nộp', width: 10 },
        ],
        rows: activities.map((activity) => {
          const own = events.filter((event) => event.activity_id === activity.id);
          const count = (verb: string) =>
            own.filter((event) => event.verb === verb).reduce((sum, e) => sum + Number(e.count), 0);
          return {
            title: activity.title,
            kind: activity.kind,
            mode: activity.teaching_mode === 'replace' ? 'Thay thế' : 'Hỗ trợ',
            due: activity.due_at ? vietnamDate(activity.due_at) : '',
            viewed: count('viewed'),
            submitted: count('submitted'),
          };
        }),
      },
      {
        title: 'Kết quả',
        numbered: true,
        columns: [
          { key: 'name', label: 'Họ và tên', width: 28 },
          { key: 'done', label: 'Hoàn thành', width: 12 },
          ...activities.map((activity) => ({ key: activity.id, label: activity.title, width: 14 })),
        ],
        rows: progress.students.map((student) => ({
          name: student.full_name,
          done: `${student.summary.done}/${student.summary.required}`,
          ...Object.fromEntries(
            activities.map((activity) => {
              const cell = student.results[activity.id];
              return [activity.id, cell ? (cell.score ?? STATUS_LABELS[cell.status] ?? '') : ''];
            }),
          ),
        })),
      },
    ];
    return {
      buffer: await buildTableFile(format, sheets, this.clock.now()),
      contentType: CONTENT_TYPES[format],
      fileName: `ho-so-day-hoc-truc-tuyen-${term}.${format}`,
    };
  }
}

// Lượt dùng câu hỏi trong bài tập (22g2, `question_usages` nguồn `activity`): mỗi câu đã duyệt của bài một dòng, số bài đã nộp có
// trả lời câu đó và tỷ lệ đúng của lớp; ghi lại mỗi lần giáo viên trả bài (bài tập 28c gọi)
export async function recordActivityQuestionUsages(
  database: YearExecutor,
  activityId: string,
  input: {
    questionItems: Array<{ id: string; question_id: string }>;
    correctness: Array<Record<string, boolean>>;
    today: string;
  },
) {
  for (const row of correctRates(input.questionItems, input.correctness)) {
    await database
      .insertInto('question_usages')
      .values({
        question_id: row.question_id,
        exam_id: null,
        activity_id: activityId,
        source: 'activity',
        used_on: input.today,
        attempts: row.attempts,
        correct_rate: row.correct_rate,
      })
      .onConflict((builder) =>
        builder
          .columns(['question_id', 'activity_id'])
          .where('activity_id', 'is not', null)
          .doUpdateSet({ attempts: row.attempts, correct_rate: row.correct_rate, used_on: input.today }),
      )
      .execute();
  }
}

export const PROGRESS_PERMISSIONS = [
  PERMISSION_CODES.learningTeach,
  PERMISSION_CODES.learningView,
  PERMISSION_CODES.learningDecide,
  PERMISSION_CODES.assignmentManage,
];
