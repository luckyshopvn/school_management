import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, type FieldError } from '@school-management/server';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { randomUUID } from 'node:crypto';
import { AiAssistantService } from '../../ai-assistant/ai-assistant.js';
import type { CurrentUser } from '../../authentication/current-user.js';
import { GroupSetsReader } from '../../child-groups/group-sets.js';
import { CurrentSchoolYearResolver } from '../../common/current-school-year.js';
import { Databases } from '../../common/databases.js';
import { isUuid, notFoundError, type RequestBody } from '../../common/request-fields.js';
import { storageKey } from '../../common/resource-names.js';
import type { QuestionSnapshot } from '../../exams/exams.js';
import type { QuestionOption } from '../../exams/exam-inputs.js';
import { FileStorage } from '../../files/file-storage.js';
import type { RubricCriterion, RubricLevel } from '../../learning-resources/resource-sharing-rules.js';
import { decodeFileName, type UploadedPart } from '../../activities/content-files.js';
import type { CompletionRule } from '../learning-rules.js';
import { LearningService } from '../learning.js';
import { HomeworkPolicyGate } from '../homework/homework-policy.js';
import { recordActivityQuestionUsages } from '../progress/progress.js';
import {
  assignmentRule,
  checkUpload,
  detectSubmissionFile,
  gradeObjectiveItems,
  itemsForVariant,
  MAX_FEEDBACK,
  memberScore,
  parseAnswers,
  parseAssignmentInput,
  resolveRecipients,
  resultOnReturn,
  resultOnSubmit,
  rubricScore,
  scoreOfItems,
  stripJpegMetadata,
  studentItem,
  submitCheck,
  taskTextForAi,
  uploadLimitsOf,
  type Answers,
  type AssignmentInput,
  type ItemRow,
  type RubricSnapshot,
} from './assignment-rules.js';

// Bài tập trực tuyến (DT-28 phần 28c, YCTD-273; tài liệu 47 mục 20.7). Quyền lớp học trực tuyến (ai dạy, ai là học sinh, ai là phụ
// huynh) lấy qua cửa của lõi 28b (`LearningService.teacherActivity`, `studentContext`, `openActivityForChild`, `guardianOrStaff`);
// kết quả ghi vào `activity_results` qua `writeResult` nên tiến độ, điều kiện mở, báo cáo của lõi thấy bài tập như mọi loại khác.
// Nhóm lấy qua `GroupSetsReader` của 28a. Gợi ý nhận xét AI qua `AiAssistantService.draftFeedback` của 23d, chỉ gửi đề, thang tiêu
// chí, kết quả đã chấm, ghi chú của giáo viên; không bao giờ gửi bài làm (GD-142)
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type AssignmentRow = Selectable<SchoolYearDatabase['assignments']>;
type SubmissionRow = Selectable<SchoolYearDatabase['assignment_submissions']>;
type ActivityRow = Selectable<SchoolYearDatabase['course_activities']>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const MAX_COMMENT = 2000;
type ChildWork = Awaited<ReturnType<AssignmentsService['workOf']>>;

const numberOrNull = (value: string | null) => (value === null ? null : Number(value));
const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function itemRowOf(row: Selectable<SchoolYearDatabase['assignment_items']>): ItemRow {
  return {
    id: row.id,
    variant_id: row.variant_id,
    position: row.position,
    kind: row.kind,
    snapshot: (row.snapshot as QuestionSnapshot | null) ?? null,
    prompt: row.prompt,
    score: Number(row.score),
    settings: asRecord(row.settings),
  };
}

function conflict(message: string) {
  return new ApplicationError('ERR_CONFLICT', message);
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly learning: LearningService,
    private readonly groupSets: GroupSetsReader,
    private readonly fileStorage: FileStorage,
    private readonly ai: AiAssistantService,
    private readonly clock: Clock,
    private readonly homeworkGate: HomeworkPolicyGate,
  ) {}

  // ---------- Đọc chung

  private async assignmentOf(database: YearExecutor, activityId: string) {
    return database.selectFrom('assignments').selectAll().where('activity_id', '=', activityId).executeTakeFirst();
  }

  private async requireAssignment(database: YearExecutor, activityId: string) {
    const assignment = await this.assignmentOf(database, activityId);
    if (!assignment) {
      throw notFoundError('Hoạt động chưa có bài tập', 'assignment');
    }
    return assignment;
  }

  private async items(database: YearExecutor, assignmentId: string): Promise<ItemRow[]> {
    const rows = await database
      .selectFrom('assignment_items')
      .selectAll()
      .where('assignment_id', '=', assignmentId)
      .orderBy('position')
      .execute();
    return rows.map(itemRowOf);
  }

  private async uploadLimits(database: YearExecutor) {
    const row = await database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', 'assignment_upload_limits')
      .executeTakeFirst();
    return uploadLimitsOf(row?.value);
  }

  // Giáo viên dạy được hoạt động và hoạt động là bài tập
  private async teacher(currentUser: CurrentUser, activityId: string) {
    const access = await this.learning.teacherActivity(currentUser, activityId);
    if (access.activity.kind !== 'assignment') {
      throw assignmentRule('Hoạt động không phải bài tập');
    }
    return access;
  }

  private async submissionForTeacher(currentUser: CurrentUser, submissionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const submission = await database
      .selectFrom('assignment_submissions')
      .innerJoin('assignments', 'assignments.id', 'assignment_submissions.assignment_id')
      .select('assignments.activity_id')
      .where('assignment_submissions.id', '=', submissionId)
      .executeTakeFirst();
    if (!submission) {
      throw notFoundError('Không tìm thấy bài nộp', 'assignment_submission');
    }
    const access = await this.teacher(currentUser, submission.activity_id);
    const assignment = await this.requireAssignment(access.database, submission.activity_id);
    const row = await access.database
      .selectFrom('assignment_submissions')
      .selectAll()
      .where('id', '=', submissionId)
      .executeTakeFirstOrThrow();
    return { ...access, assignment, submission: row };
  }

  // Học sinh nhận bài của bài nộp: bài cá nhân là chính em, bài nhóm là các em của nhóm theo danh sách đã chốt
  private async membersOf(database: YearExecutor, assignment: AssignmentRow, submission: SubmissionRow) {
    if (submission.child_id) {
      return [submission.child_id];
    }
    const rows = await database
      .selectFrom('assignment_recipients')
      .select('child_id')
      .where('assignment_id', '=', assignment.id)
      .where('group_id', '=', submission.group_id ?? NO_ID)
      .execute();
    return rows.map((row) => row.child_id);
  }

  private async childNames(database: YearExecutor, childIds: string[]) {
    if (childIds.length === 0) {
      return new Map<string, string>();
    }
    const rows = await database
      .selectFrom('children')
      .select(['id', 'full_name'])
      .where('id', 'in', childIds)
      .execute();
    return new Map(rows.map((row) => [row.id, row.full_name]));
  }

  private async groupNames(database: YearExecutor, groupIds: string[]) {
    if (groupIds.length === 0) {
      return new Map<string, { name: string; leader_child_id: string | null }>();
    }
    const rows = await database
      .selectFrom('child_groups')
      .select(['id', 'name', 'leader_child_id'])
      .where('id', 'in', groupIds)
      .execute();
    return new Map(rows.map((row) => [row.id, { name: row.name, leader_child_id: row.leader_child_id }]));
  }

  // ---------- Soạn bài

  // Màn hình soạn bài của giáo viên: cài đặt, phiên bản, câu (kèm đáp án), đích giao; bộ nhóm của lớp để chọn bài nhóm
  async editor(currentUser: CurrentUser, activityId: string) {
    const { database, space, activity } = await this.teacher(currentUser, activityId);
    const assignment = await this.assignmentOf(database, activityId);
    const [variants, items, targets, recipients, students, groupSets] = await Promise.all([
      assignment
        ? database.selectFrom('assignment_variants').selectAll().where('assignment_id', '=', assignment.id).execute()
        : Promise.resolve([]),
      assignment ? this.items(database, assignment.id) : Promise.resolve([]),
      assignment
        ? database.selectFrom('assignment_targets').selectAll().where('assignment_id', '=', assignment.id).execute()
        : Promise.resolve([]),
      assignment
        ? database
            .selectFrom('assignment_recipients')
            .select((builder) => builder.fn.countAll<string>().as('count'))
            .where('assignment_id', '=', assignment.id)
            .executeTakeFirstOrThrow()
        : Promise.resolve({ count: '0' }),
      this.learning.students(database, space),
      space.class_id ? this.groupSets.activeSets(database, { classId: space.class_id }) : Promise.resolve([]),
    ]);
    const codeOf = new Map(variants.map((variant) => [variant.id, variant.code]));
    return {
      activity: { id: activity.id, title: activity.title, status: activity.status, due_at: activity.due_at },
      assignment: assignment
        ? {
            ...assignment,
            rubric_snapshot: assignment.rubric_snapshot ?? null,
            released: assignment.released_at !== null,
          }
        : null,
      variants: variants.map((variant) => ({ code: variant.code, name: variant.name })),
      items: items.map((item) => ({
        ...item,
        variant_code: item.variant_id ? (codeOf.get(item.variant_id) ?? null) : null,
      })),
      targets: targets.map((target) => ({
        kind: target.target_kind,
        group_id: target.group_id,
        child_id: target.child_id,
        variant_code: target.variant_id ? (codeOf.get(target.variant_id) ?? null) : null,
      })),
      recipient_count: Number(recipients.count),
      students: students.map((student) => ({ id: student.id, full_name: student.full_name })),
      group_sets: groupSets,
    };
  }

  // Câu đã duyệt của ngân hàng 22g1 dùng được cho bài: cùng cấp, cùng môn của lớp học trực tuyến (khoá tự chọn không gắn môn thì
  // lấy theo cấp); lọc thêm theo chữ
  async questionBank(currentUser: CurrentUser, activityId: string, search: string | undefined) {
    const { database, space } = await this.teacher(currentUser, activityId);
    let query = database
      .selectFrom('questions')
      .select(['id', 'content', 'question_type', 'cognitive_level', 'grade_level_code', 'score'])
      .where('status', '=', 'approved')
      .where('school_level', '=', space.school_level);
    if (space.subject_id) {
      query = query.where('subject_id', '=', space.subject_id);
    }
    if (search && search.trim()) {
      query = query.where('content', 'ilike', `%${search.trim().replace(/[%_\\]/g, '')}%`);
    }
    const rows = await query.orderBy('created_at', 'desc').limit(100).execute();
    return rows.map((row) => ({ ...row, score: Number(row.score) }));
  }

  private async checkInput(database: YearExecutor, space: SpaceRow, input: AssignmentInput, userId: string) {
    const errors: FieldError[] = [];
    if (input.group_set_id) {
      const set = await database
        .selectFrom('group_sets')
        .select(['id', 'class_id', 'status'])
        .where('id', '=', input.group_set_id)
        .executeTakeFirst();
      if (!set || set.class_id !== space.class_id || set.status !== 'active') {
        errors.push({ field: 'group_set_id', message: 'Bộ nhóm phải là bộ đang dùng của lớp này' });
      }
    }
    const questionIds = [...new Set(input.items.flatMap((item) => (item.question_id ? [item.question_id] : [])))];
    const questions = questionIds.length
      ? await database
          .selectFrom('questions')
          .leftJoin('question_topics', 'question_topics.id', 'questions.topic_id')
          .select([
            'questions.id',
            'questions.status',
            'questions.school_level',
            'questions.subject_id',
            'questions.content',
            'questions.question_type',
            'questions.cognitive_level',
            'questions.options',
            'questions.answer',
            'questions.guidance',
            'question_topics.name as topic_name',
          ])
          .where('questions.id', 'in', questionIds)
          .execute()
      : [];
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    input.items.forEach((item, index) => {
      if (!item.question_id) return;
      const question = questionMap.get(item.question_id);
      if (
        !question ||
        question.status !== 'approved' ||
        question.school_level !== space.school_level ||
        (space.subject_id !== null && question.subject_id !== space.subject_id)
      ) {
        errors.push({
          field: `items.${index}.question_id`,
          message: 'Chỉ dùng câu đã duyệt của ngân hàng câu hỏi, cùng cấp và cùng môn của lớp',
        });
      }
    });
    const resourceIds = [...new Set(input.items.flatMap((item) => (item.resource_id ? [item.resource_id] : [])))];
    if (resourceIds.length > 0) {
      const resources = await this.databases.system
        .selectFrom('learning_resources')
        .select(['id', 'status', 'published_version'])
        .where('id', 'in', resourceIds)
        .execute();
      const usable = new Set(
        resources
          .filter((row) => row.published_version !== null && row.status !== 'retired' && row.status !== 'hidden')
          .map((row) => row.id),
      );
      input.items.forEach((item, index) => {
        if (item.resource_id && !usable.has(item.resource_id)) {
          errors.push({ field: `items.${index}.resource_id`, message: 'Học liệu chưa công bố ở kho học liệu' });
        }
      });
    }
    let rubric: RubricSnapshot | null = null;
    if (input.rubric_id) {
      const row = await database
        .selectFrom('rubrics')
        .select(['id', 'name', 'levels', 'criteria', 'visibility', 'owner_user_id', 'status'])
        .where('id', '=', input.rubric_id)
        .executeTakeFirst();
      if (!row || row.status !== 'active' || (row.visibility !== 'school' && row.owner_user_id !== userId)) {
        errors.push({ field: 'rubric_id', message: 'Thang tiêu chí không có hoặc đã lưu trữ' });
      } else {
        rubric = {
          name: row.name,
          levels: row.levels as RubricLevel[],
          criteria: row.criteria as RubricCriterion[],
        };
      }
    }
    const students = new Set((await this.learning.students(database, space)).map((student) => student.id));
    const groupIds = [...new Set(input.targets.flatMap((target) => (target.group_id ? [target.group_id] : [])))];
    const groups = groupIds.length
      ? await database.selectFrom('child_groups').select(['id', 'class_id']).where('id', 'in', groupIds).execute()
      : [];
    input.targets.forEach((target, index) => {
      if (target.child_id && !students.has(target.child_id)) {
        errors.push({ field: `targets.${index}.child_id`, message: 'Học sinh không thuộc lớp học trực tuyến này' });
      }
      if (
        target.group_id &&
        !groups.some((group) => group.id === target.group_id && group.class_id === space.class_id)
      ) {
        errors.push({ field: `targets.${index}.group_id`, message: 'Nhóm không thuộc lớp này' });
      }
    });
    if (errors.length > 0) {
      throw assignmentRule('Bài tập chưa hợp lệ', errors);
    }
    return { questionMap, rubric };
  }

  // Lưu bài (tạo hoặc thay toàn bộ câu, phiên bản, đích giao); bài đã phát hành chỉ đổi được cài đặt nộp bài
  async save(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { context, database, space } = await this.teacher(currentUser, activityId);
    const existing = await this.assignmentOf(database, activityId);
    if (existing?.released_at) {
      throw assignmentRule(
        'Bài đã phát hành: không đổi câu, phiên bản, đích giao nữa; chỉ đổi được nộp muộn, số lần nộp, cách hiện kết quả',
      );
    }
    const input = parseAssignmentInput(body);
    const { questionMap, rubric } = await this.checkInput(database, space, input, context.userId);
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      const values = {
        // Màn hình soạn không gửi ngữ cảnh thì giữ ngữ cảnh đã có (bài về nhà giao từ sổ đầu bài, 28f)
        context: body?.context === undefined && existing ? existing.context : input.context,
        work_mode: input.work_mode,
        group_set_id: input.group_set_id,
        late_policy: input.late_policy,
        max_attempts: input.max_attempts,
        grading: input.grading,
        rubric_id: input.rubric_id,
        rubric_snapshot: rubric ? JSON.stringify(rubric) : null,
        show_results: input.show_results,
        estimated_minutes: input.estimated_minutes,
        // Màn hình cũ không gửi cờ "không dùng AI" thì giữ cờ đã có
        ai_blocked: body?.ai_blocked === undefined && existing ? existing.ai_blocked : input.ai_blocked,
        updated_at: now,
      };
      const assignment = await transaction
        .insertInto('assignments')
        .values({ activity_id: activityId, created_by: context.userId, ...values })
        .onConflict((builder) => builder.column('activity_id').doUpdateSet(values))
        .returning('id')
        .executeTakeFirstOrThrow();
      await transaction.deleteFrom('assignment_targets').where('assignment_id', '=', assignment.id).execute();
      await transaction.deleteFrom('assignment_items').where('assignment_id', '=', assignment.id).execute();
      await transaction.deleteFrom('assignment_variants').where('assignment_id', '=', assignment.id).execute();
      const variantIds = new Map<string, string>();
      for (const variant of input.variants) {
        const row = await transaction
          .insertInto('assignment_variants')
          .values({ assignment_id: assignment.id, code: variant.code, name: variant.name })
          .returning('id')
          .executeTakeFirstOrThrow();
        variantIds.set(variant.code, row.id);
      }
      let position = 0;
      for (const item of input.items) {
        position += 1;
        const question = item.question_id ? questionMap.get(item.question_id) : undefined;
        const snapshot: QuestionSnapshot | null = question
          ? {
              content: question.content,
              question_type: question.question_type,
              cognitive_level: question.cognitive_level,
              topic_name: question.topic_name ?? null,
              options: question.options as QuestionOption[],
              answer: question.answer as string[],
              guidance: question.guidance,
            }
          : null;
        await transaction
          .insertInto('assignment_items')
          .values({
            assignment_id: assignment.id,
            variant_id: item.variant_code ? (variantIds.get(item.variant_code) ?? null) : null,
            position,
            kind: item.kind,
            question_id: item.question_id,
            snapshot: snapshot ? JSON.stringify(snapshot) : null,
            prompt: item.prompt,
            score: item.score,
            settings: JSON.stringify(item.resource_id ? { resource_id: item.resource_id } : {}),
          })
          .execute();
      }
      for (const target of input.targets) {
        await transaction
          .insertInto('assignment_targets')
          .values({
            assignment_id: assignment.id,
            target_kind: target.kind,
            group_id: target.group_id,
            child_id: target.child_id,
            variant_id: target.variant_code ? (variantIds.get(target.variant_code) ?? null) : null,
          })
          .execute();
      }
    });
    return this.editor(currentUser, activityId);
  }

  // Cài đặt nộp bài đổi được cả sau khi phát hành: nộp muộn, số lần nộp (chỉ tăng), cách hiện kết quả trắc nghiệm, không dùng AI
  // (YCTD-383 lát L3: giáo viên bật, tắt được bất cứ lúc nào)
  async updateSettings(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { database } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    const errors: FieldError[] = [];
    const changes: {
      late_policy?: 'allow' | 'block';
      max_attempts?: number;
      show_results?: 'after_submit' | 'after_return';
      ai_blocked?: boolean;
    } = {};
    if (body?.late_policy !== undefined) {
      if (body.late_policy !== 'allow' && body.late_policy !== 'block') {
        errors.push({ field: 'late_policy', message: 'Nộp muộn là allow hoặc block' });
      } else {
        changes.late_policy = body.late_policy;
      }
    }
    if (body?.max_attempts !== undefined) {
      const value = body.max_attempts;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < assignment.max_attempts || value > 5) {
        errors.push({ field: 'max_attempts', message: `Số lần nộp từ ${assignment.max_attempts} đến 5` });
      } else {
        changes.max_attempts = value;
      }
    }
    if (body?.show_results !== undefined) {
      if (body.show_results !== 'after_submit' && body.show_results !== 'after_return') {
        errors.push({ field: 'show_results', message: 'Hiện kết quả after_submit hoặc after_return' });
      } else {
        changes.show_results = body.show_results;
      }
    }
    if (body?.ai_blocked !== undefined) {
      if (typeof body.ai_blocked !== 'boolean') {
        errors.push({ field: 'ai_blocked', message: 'Không dùng AI là true hoặc false' });
      } else {
        changes.ai_blocked = body.ai_blocked;
      }
    }
    if (errors.length > 0) {
      throw assignmentRule('Cài đặt chưa hợp lệ', errors);
    }
    await database
      .updateTable('assignments')
      .set({ ...changes, updated_at: this.clock.now() })
      .where('id', '=', assignment.id)
      .execute();
    return this.editor(currentUser, activityId);
  }

  // Phát hành: chốt danh sách học sinh nhận bài (và nhóm khi bài nhóm), giao hoạt động cho học sinh. Bài về nhà (28f) qua quy tắc
  // khối lượng của trường: cảnh báo cần `confirm_warnings`, chặn chỉ Ban Giám hiệu vượt được với `override_reason`
  async release(currentUser: CurrentUser, activityId: string, body?: RequestBody) {
    const { context, database, space, activity } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    if (assignment.released_at) {
      throw assignmentRule('Bài đã phát hành');
    }
    const decision = await this.homeworkGate.beforeRelease(database, {
      space,
      activity,
      assignment,
      leadership: context.canDecide || (context.canView && context.canApprove),
      confirmWarnings: body?.confirm_warnings === true,
      overrideReason: typeof body?.override_reason === 'string' ? body.override_reason : null,
    });
    const [targets, variants, students] = await Promise.all([
      database.selectFrom('assignment_targets').selectAll().where('assignment_id', '=', assignment.id).execute(),
      database.selectFrom('assignment_variants').selectAll().where('assignment_id', '=', assignment.id).execute(),
      this.learning.students(database, space),
    ]);
    const codeOf = new Map(variants.map((variant) => [variant.id, variant.code]));
    const idOf = new Map(variants.map((variant) => [variant.code, variant.id]));
    const groupMembers = new Map<string, string[]>();
    for (const target of targets) {
      if (target.group_id && !groupMembers.has(target.group_id)) {
        groupMembers.set(target.group_id, await this.groupSets.childIdsOfGroup(database, target.group_id));
      }
    }
    let workGroups: Map<string, string> | null = null;
    if (assignment.work_mode === 'group' && assignment.group_set_id) {
      workGroups = new Map();
      for (const group of await this.groupSets.groupsOfSet(database, assignment.group_set_id)) {
        group.child_ids.forEach((childId) => workGroups?.set(childId, group.id));
      }
    }
    const resolved = resolveRecipients({
      targets: targets.map((target) => ({
        kind: target.target_kind,
        group_id: target.group_id,
        child_id: target.child_id,
        variant_code: target.variant_id ? (codeOf.get(target.variant_id) ?? null) : null,
      })),
      students: students.map((student) => student.id),
      groupMembers,
      workGroups,
    });
    if (resolved.withoutGroup.length > 0) {
      const names = students.filter((student) => resolved.withoutGroup.includes(student.id)).map((s) => s.full_name);
      throw assignmentRule(`Có học sinh chưa có nhóm trong bộ nhóm của bài: ${names.join(', ')}`);
    }
    if (resolved.recipients.length === 0) {
      throw assignmentRule('Không có học sinh nào nhận bài');
    }
    if (variants.length > 0 && resolved.recipients.some((recipient) => recipient.variant_code === null)) {
      throw assignmentRule('Bài có phiên bản: mỗi đích giao phải chọn một phiên bản');
    }
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto('assignment_recipients')
        .values(
          resolved.recipients.map((recipient) => ({
            assignment_id: assignment.id,
            child_id: recipient.child_id,
            group_id: recipient.group_id,
            variant_id: recipient.variant_code ? (idOf.get(recipient.variant_code) ?? null) : null,
          })),
        )
        .execute();
      await transaction
        .updateTable('assignments')
        .set({
          released_at: now,
          updated_at: now,
          ...(decision.override_reason
            ? { policy_override_reason: decision.override_reason, policy_override_by: context.userId }
            : {}),
        })
        .where('id', '=', assignment.id)
        .execute();
    });
    if (activity.status !== 'published') {
      await this.learning.publishActivity(currentUser, activityId, true);
    }
    return {
      released_at: now,
      recipient_count: resolved.recipients.length,
      policy_warnings: decision.result.violations,
    };
  }

  // Đóng bài: không nhận nộp thêm (kể cả nộp muộn); mở lại được
  async close(currentUser: CurrentUser, activityId: string, closed: boolean) {
    const { database } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    const now = this.clock.now();
    await database
      .updateTable('assignments')
      .set({ closed_at: closed ? now : null, updated_at: now })
      .where('id', '=', assignment.id)
      .execute();
    return { closed_at: closed ? now : null };
  }

  // Hạn riêng, miễn bài cho một học sinh; miễn thì kết quả hoạt động là "miễn"
  async updateRecipient(currentUser: CurrentUser, activityId: string, childId: string, body: RequestBody) {
    const { context, database, activity } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    const recipient = await database
      .selectFrom('assignment_recipients')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (!recipient) {
      throw notFoundError('Học sinh không nhận bài này', 'assignment_recipient');
    }
    const errors: FieldError[] = [];
    const changes: { due_at?: Date | null; excused?: boolean; excuse_reason?: string | null } = {};
    if (body?.due_at !== undefined) {
      const value = body.due_at === null ? null : new Date(String(body.due_at));
      if (value !== null && Number.isNaN(value.getTime())) {
        errors.push({ field: 'due_at', message: 'Hạn riêng không đúng định dạng ngày giờ' });
      } else {
        changes.due_at = value;
      }
    }
    if (body?.excused !== undefined) {
      if (typeof body.excused !== 'boolean') {
        errors.push({ field: 'excused', message: 'Miễn là true hoặc false' });
      } else {
        const reason = typeof body.excuse_reason === 'string' ? body.excuse_reason.trim() : '';
        if (body.excused && (reason === '' || reason.length > 500)) {
          errors.push({ field: 'excuse_reason', message: 'Ghi lý do miễn, tối đa 500 ký tự' });
        }
        changes.excused = body.excused;
        changes.excuse_reason = body.excused ? reason : null;
      }
    }
    if (errors.length > 0) {
      throw assignmentRule('Thông tin học sinh nhận bài chưa hợp lệ', errors);
    }
    await database
      .updateTable('assignment_recipients')
      .set(changes)
      .where('assignment_id', '=', assignment.id)
      .where('child_id', '=', childId)
      .execute();
    if (changes.excused !== undefined) {
      await this.learning.writeResult(
        database,
        activity,
        childId,
        { status: changes.excused ? 'excused' : 'not_started' },
        { userId: context.userId, kind: 'teacher', verb: 'completed' },
      );
    }
    return { ...recipient, ...changes };
  }

  // ---------- Theo dõi, chấm, trả bài

  // Danh sách bài nộp theo học sinh (bài cá nhân) hoặc theo nhóm (bài nhóm): lần nộp mới nhất, có bản nháp, miễn
  async submissions(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    const [recipients, submissions] = await Promise.all([
      database.selectFrom('assignment_recipients').selectAll().where('assignment_id', '=', assignment.id).execute(),
      database
        .selectFrom('assignment_submissions')
        .selectAll()
        .where('assignment_id', '=', assignment.id)
        .orderBy('attempt_no', 'desc')
        .execute(),
    ]);
    const names = await this.childNames(
      database,
      recipients.map((recipient) => recipient.child_id),
    );
    const present = (row: SubmissionRow | undefined) =>
      row
        ? {
            id: row.id,
            attempt_no: row.attempt_no,
            status: row.status,
            late: row.late,
            submitted_at: row.submitted_at,
            score: numberOrNull(row.score),
            level: row.level,
            returned_at: row.returned_at,
          }
        : null;
    if (assignment.work_mode === 'group') {
      const groupIds = [
        ...new Set(recipients.flatMap((recipient) => (recipient.group_id ? [recipient.group_id] : []))),
      ];
      const groups = await this.groupNames(database, groupIds);
      return {
        work_mode: 'group' as const,
        closed_at: assignment.closed_at,
        rows: groupIds.map((groupId) => {
          const own = submissions.filter((row) => row.group_id === groupId);
          return {
            group_id: groupId,
            name: groups.get(groupId)?.name ?? '',
            members: recipients
              .filter((recipient) => recipient.group_id === groupId)
              .map((recipient) => ({ child_id: recipient.child_id, full_name: names.get(recipient.child_id) ?? '' })),
            latest: present(own.find((row) => row.status !== 'draft')),
            has_draft: own.some((row) => row.status === 'draft'),
          };
        }),
      };
    }
    return {
      work_mode: 'individual' as const,
      closed_at: assignment.closed_at,
      rows: recipients
        .map((recipient) => {
          const own = submissions.filter((row) => row.child_id === recipient.child_id);
          return {
            child_id: recipient.child_id,
            full_name: names.get(recipient.child_id) ?? '',
            due_at: recipient.due_at,
            excused: recipient.excused,
            latest: present(own.find((row) => row.status !== 'draft')),
            has_draft: own.some((row) => row.status === 'draft'),
          };
        })
        .sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi')),
    };
  }

  private async files(database: YearExecutor, submissionId: string) {
    return database
      .selectFrom('submission_files')
      .select(['id', 'item_id', 'kind', 'file_name', 'content_type', 'size_bytes', 'created_at'])
      .where('submission_id', '=', submissionId)
      .orderBy('created_at')
      .execute();
  }

  private async comments(database: YearExecutor, submissionId: string) {
    return database
      .selectFrom('submission_comments')
      .select(['id', 'author_name', 'author_kind', 'body', 'created_at'])
      .where('submission_id', '=', submissionId)
      .orderBy('created_at')
      .execute();
  }

  private async variantOf(database: YearExecutor, assignment: AssignmentRow, submission: SubmissionRow) {
    const childIds = await this.membersOf(database, assignment, submission);
    const recipient = await database
      .selectFrom('assignment_recipients')
      .select('variant_id')
      .where('assignment_id', '=', assignment.id)
      .where('child_id', '=', childIds[0] ?? NO_ID)
      .executeTakeFirst();
    return recipient?.variant_id ?? null;
  }

  // Một bài nộp cho giáo viên: câu (kèm đáp án), câu trả lời, điểm máy chấm, tệp, trao đổi, đánh giá đóng góp (bài nhóm)
  async submission(currentUser: CurrentUser, submissionId: string) {
    const { database, assignment, submission } = await this.submissionForTeacher(currentUser, submissionId);
    const variantId = await this.variantOf(database, assignment, submission);
    const items = itemsForVariant(await this.items(database, assignment.id), variantId);
    const answers = asRecord(submission.answers) as Answers;
    const objective = gradeObjectiveItems(items, answers);
    const members = await this.membersOf(database, assignment, submission);
    const [files, comments, contributions, names] = await Promise.all([
      this.files(database, submission.id),
      this.comments(database, submission.id),
      database.selectFrom('submission_contributions').selectAll().where('submission_id', '=', submission.id).execute(),
      this.childNames(database, members),
    ]);
    return {
      submission: {
        ...submission,
        auto_score: numberOrNull(submission.auto_score),
        score: numberOrNull(submission.score),
      },
      grading: assignment.grading,
      rubric: assignment.rubric_snapshot ?? null,
      items,
      answers,
      objective,
      files,
      comments,
      members: members.map((childId) => ({ child_id: childId, full_name: names.get(childId) ?? '' })),
      contributions: contributions.map((row) => ({ ...row, adjusted_score: numberOrNull(row.adjusted_score) })),
    };
  }

  // Chấm: điểm từng câu giáo viên chấm, mức theo tiêu chí, mức (Tiểu học), nhận xét; chưa trả cho học sinh. Bài đã trả thì
  // chấm lại và ghi lại kết quả hoạt động
  async grade(currentUser: CurrentUser, submissionId: string, body: RequestBody) {
    const { context, database, activity, assignment, submission } = await this.submissionForTeacher(
      currentUser,
      submissionId,
    );
    if (submission.status === 'draft') {
      throw assignmentRule('Bài chưa nộp, chưa chấm được');
    }
    const variantId = await this.variantOf(database, assignment, submission);
    const items = itemsForVariant(await this.items(database, assignment.id), variantId);
    const objective = gradeObjectiveItems(items, asRecord(submission.answers) as Answers);
    const errors: FieldError[] = [];
    const marks = { ...(asRecord(submission.item_scores) as Record<string, number>) };
    const rawMarks = asRecord(body?.item_scores);
    for (const [itemId, value] of Object.entries(rawMarks)) {
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item) {
        errors.push({ field: `item_scores.${itemId}`, message: 'Câu không có trong bài của học sinh' });
      } else if (value === null) {
        delete marks[itemId];
      } else if (typeof value !== 'number' || value < 0 || value > item.score) {
        errors.push({ field: `item_scores.${itemId}`, message: `Điểm câu từ 0 đến ${item.score}` });
      } else {
        marks[itemId] = value;
      }
    }
    let score: number | null = null;
    let level: 'excellent' | 'completed' | 'not_completed' | null = null;
    let criteria: number[] | null = null;
    if (assignment.grading === 'score') {
      score = scoreOfItems(items, objective.earned, marks).score;
    } else if (assignment.grading === 'rubric' && body?.criteria_scores !== undefined) {
      const result = rubricScore(assignment.rubric_snapshot as RubricSnapshot, body.criteria_scores);
      score = result.score;
      criteria = result.levels;
    } else if (assignment.grading === 'rubric') {
      score = numberOrNull(submission.score);
      criteria = (submission.criteria_scores as number[] | null) ?? null;
    }
    if (assignment.grading === 'level') {
      const value = body?.level ?? submission.level;
      if (
        value !== null &&
        value !== undefined &&
        !['excellent', 'completed', 'not_completed'].includes(String(value))
      ) {
        errors.push({ field: 'level', message: 'Mức là excellent (hoàn thành tốt), completed hoặc not_completed' });
      } else {
        level = (value as typeof level) ?? null;
      }
    }
    let feedback = submission.feedback;
    if (body?.feedback !== undefined) {
      const value = typeof body.feedback === 'string' ? body.feedback.trim() : '';
      if (value.length > MAX_FEEDBACK) {
        errors.push({ field: 'feedback', message: `Nhận xét tối đa ${MAX_FEEDBACK} ký tự` });
      }
      feedback = value === '' ? null : value;
    }
    if (errors.length > 0) {
      throw assignmentRule('Điểm chấm chưa hợp lệ', errors);
    }
    const aiAssisted =
      body?.feedback_ai_assisted === undefined ? submission.feedback_ai_assisted : body.feedback_ai_assisted === true;
    const now = this.clock.now();
    const updated = await database
      .updateTable('assignment_submissions')
      .set({
        item_scores: JSON.stringify(marks),
        criteria_scores:
          (criteria ?? submission.criteria_scores) === null
            ? null
            : JSON.stringify(criteria ?? submission.criteria_scores),
        score,
        level,
        feedback,
        feedback_ai_assisted: feedback ? aiAssisted : false,
        graded_by: context.userId,
        graded_at: now,
        updated_at: now,
      })
      .where('id', '=', submission.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    if (updated.status === 'returned') {
      await this.writeReturned(database, activity, assignment, updated, context.userId);
    }
    return { ...updated, score: numberOrNull(updated.score), auto_score: numberOrNull(updated.auto_score) };
  }

  // Bài chấm đủ để trả: chấm điểm thì có điểm, chấm theo mức thì có mức; hoàn thành, không chấm thì trả ngay được
  private readyToReturn(assignment: AssignmentRow, submission: SubmissionRow): string | null {
    if (submission.status === 'draft') return 'Bài chưa nộp';
    if ((assignment.grading === 'score' || assignment.grading === 'rubric') && submission.score === null) {
      return 'Chưa chấm xong điểm';
    }
    if (assignment.grading === 'level' && submission.level === null) return 'Chưa chọn mức';
    return null;
  }

  private async writeReturned(
    database: YearExecutor,
    activity: ActivityRow,
    assignment: AssignmentRow,
    submission: SubmissionRow,
    userId: string,
  ) {
    const members = await this.membersOf(database, assignment, submission);
    const adjustments = await database
      .selectFrom('submission_contributions')
      .select(['child_id', 'adjusted_score'])
      .where('submission_id', '=', submission.id)
      .execute();
    for (const childId of members) {
      const adjusted = adjustments.find((row) => row.child_id === childId)?.adjusted_score ?? null;
      const score = memberScore(numberOrNull(submission.score), numberOrNull(adjusted));
      await this.learning.writeResult(
        database,
        activity,
        childId,
        {
          status: resultOnReturn(activity.completion_rule as CompletionRule, numberOrNull(activity.pass_score), {
            score,
            level: submission.level,
          }),
          score,
          level: submission.level,
        },
        { userId, kind: 'teacher', verb: score !== null ? 'scored' : 'completed' },
      );
    }
  }

  // Trả bài: từng bài (danh sách mã) hoặc mọi bài đã chấm xong; ghi kết quả hoạt động cho từng em
  async returnSubmissions(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { context, database, activity } = await this.teacher(currentUser, activityId);
    const assignment = await this.requireAssignment(database, activityId);
    const ids = Array.isArray(body?.submission_ids)
      ? body.submission_ids.filter((id): id is string => typeof id === 'string')
      : null;
    let query = database
      .selectFrom('assignment_submissions')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where('status', '=', 'submitted');
    if (ids) {
      query = query.where('id', 'in', ids.length > 0 ? ids : [NO_ID]);
    }
    const candidates = await query.execute();
    const now = this.clock.now();
    const returned: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const submission of candidates) {
      const reason = this.readyToReturn(assignment, submission);
      if (reason) {
        skipped.push({ id: submission.id, reason });
        continue;
      }
      const updated = await database
        .updateTable('assignment_submissions')
        .set({ status: 'returned', returned_by: context.userId, returned_at: now, updated_at: now })
        .where('id', '=', submission.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.writeReturned(database, activity, assignment, updated, context.userId);
      returned.push(submission.id);
    }
    if (returned.length > 0) {
      await this.recordQuestionUsages(database, activity.id, assignment);
    }
    return { returned: returned.length, skipped };
  }

  // Lượt dùng câu hỏi của bài (28d): tỷ lệ đúng của lớp mỗi câu trắc nghiệm trên lần nộp mới nhất của từng em hoặc nhóm
  private async recordQuestionUsages(database: YearExecutor, activityId: string, assignment: AssignmentRow) {
    const [items, questionRows, submissions] = await Promise.all([
      this.items(database, assignment.id),
      database
        .selectFrom('assignment_items')
        .select(['id', 'question_id'])
        .where('assignment_id', '=', assignment.id)
        .where('question_id', 'is not', null)
        .execute(),
      database
        .selectFrom('assignment_submissions')
        .selectAll()
        .where('assignment_id', '=', assignment.id)
        .where('status', '<>', 'draft')
        .orderBy('attempt_no', 'desc')
        .execute(),
    ]);
    if (questionRows.length === 0) return;
    const latest = new Map<string, SubmissionRow>();
    for (const row of submissions) {
      const key = row.child_id ?? row.group_id ?? row.id;
      if (!latest.has(key)) latest.set(key, row);
    }
    const correctness: Array<Record<string, boolean>> = [];
    for (const row of latest.values()) {
      const variantId = await this.variantOf(database, assignment, row);
      correctness.push(
        gradeObjectiveItems(itemsForVariant(items, variantId), asRecord(row.answers) as Answers).correct,
      );
    }
    await recordActivityQuestionUsages(database, activityId, {
      questionItems: questionRows.map((row) => ({ id: row.id, question_id: row.question_id ?? '' })),
      correctness,
      today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(this.clock.now()),
    });
  }

  // Bài nhóm: giáo viên điều chỉnh điểm cá nhân của một em, bắt buộc ghi lý do; bỏ điều chỉnh bằng điểm rỗng
  async adjustContribution(currentUser: CurrentUser, submissionId: string, childId: string, body: RequestBody) {
    const { context, database, activity, assignment, submission } = await this.submissionForTeacher(
      currentUser,
      submissionId,
    );
    if (!submission.group_id) {
      throw assignmentRule('Chỉ bài nhóm mới điều chỉnh điểm cá nhân');
    }
    const members = await this.membersOf(database, assignment, submission);
    if (!members.includes(childId)) {
      throw assignmentRule('Học sinh không thuộc nhóm của bài nộp');
    }
    const score = body?.score ?? null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (score !== null && (typeof score !== 'number' || score < 0 || score > 10)) {
      throw assignmentRule('Điểm điều chỉnh từ 0 đến 10', [{ field: 'score', message: 'Điểm từ 0 đến 10' }]);
    }
    if (score !== null && (reason === '' || reason.length > 500)) {
      throw assignmentRule('Điều chỉnh điểm cá nhân phải ghi lý do', [
        { field: 'reason', message: 'Ghi lý do, tối đa 500 ký tự' },
      ]);
    }
    const values = {
      adjusted_score: score as number | null,
      adjust_reason: score === null ? null : reason,
      adjusted_by: score === null ? null : context.userId,
      updated_at: this.clock.now(),
    };
    await database
      .insertInto('submission_contributions')
      .values({ submission_id: submission.id, child_id: childId, ...values })
      .onConflict((builder) => builder.columns(['submission_id', 'child_id']).doUpdateSet(values))
      .execute();
    if (submission.status === 'returned') {
      await this.writeReturned(database, activity, assignment, submission, context.userId);
    }
    return { child_id: childId, ...values };
  }

  // Gợi ý nhận xét bằng AI cho một bài đã chấm (GD-142): chỉ đề, thang tiêu chí, kết quả giáo viên đã cho, ghi chú của giáo viên
  async suggestFeedback(currentUser: CurrentUser, submissionId: string, body: RequestBody) {
    const { database, space, assignment, submission } = await this.submissionForTeacher(currentUser, submissionId);
    const variantId = await this.variantOf(database, assignment, submission);
    const items = itemsForVariant(await this.items(database, assignment.id), variantId);
    const rubric = (assignment.rubric_snapshot as RubricSnapshot | null) ?? null;
    const criteria = (submission.criteria_scores as number[] | null) ?? [];
    const rubricLines = rubric
      ? rubric.criteria.map((criterion, index) => {
          const chosen = criteria[index];
          const label = chosen !== undefined ? rubric.levels[chosen]?.label : undefined;
          return `${criterion.name}: ${label ?? 'chưa chọn mức'}`;
        })
      : [];
    const score = numberOrNull(submission.score);
    const levelLabels = { excellent: 'Hoàn thành tốt', completed: 'Hoàn thành', not_completed: 'Chưa hoàn thành' };
    const given =
      score !== null
        ? `Điểm ${score}/10`
        : submission.level
          ? `Mức ${levelLabels[submission.level]}`
          : 'Chưa chấm điểm';
    const subject = space.subject_id
      ? await database.selectFrom('subjects').select('name').where('id', '=', space.subject_id).executeTakeFirst()
      : undefined;
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null;
    return this.ai.draftFeedback(currentUser, {
      school_level: space.school_level,
      grade_level_code: space.grade_level,
      subject_name: subject?.name ?? space.title,
      task: taskTextForAi(items),
      rubric: rubricLines,
      given,
      note: note === '' ? null : note,
    });
  }

  // Ngân hàng nhận xét: câu nhận xét của trường (thư viện 20c, theo cấp của lớp) và câu riêng của giáo viên
  async commentBank(currentUser: CurrentUser, activityId: string) {
    const { database, space } = await this.teacher(currentUser, activityId);
    const [school, own] = await Promise.all([
      database
        .selectFrom('comment_templates')
        .select(['id', 'content'])
        .where('school_level', '=', space.school_level)
        .where('status', '=', 'active')
        .where('target', 'in', ['subject', 'general'])
        .orderBy('order_no')
        .execute(),
      database
        .selectFrom('assignment_comment_bank')
        .select(['id', 'content'])
        .where('owner_user_id', '=', currentUser.id)
        .orderBy('created_at')
        .execute(),
    ]);
    return { school, own };
  }

  async addBankComment(currentUser: CurrentUser, body: RequestBody) {
    const { database } = await this.currentSchoolYear.require();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (content === '' || content.length > 500) {
      throw assignmentRule('Câu nhận xét từ 1 đến 500 ký tự', [{ field: 'content', message: 'Từ 1 đến 500 ký tự' }]);
    }
    return database
      .insertInto('assignment_comment_bank')
      .values({ owner_user_id: currentUser.id, content })
      .returning(['id', 'content'])
      .executeTakeFirstOrThrow();
  }

  async removeBankComment(currentUser: CurrentUser, commentId: string) {
    const { database } = await this.currentSchoolYear.require();
    const removed = await database
      .deleteFrom('assignment_comment_bank')
      .where('id', '=', commentId)
      .where('owner_user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (Number(removed.numDeletedRows) === 0) {
      throw notFoundError('Không tìm thấy câu nhận xét của bạn', 'assignment_comment');
    }
    return { id: commentId };
  }

  private async addComment(
    database: YearExecutor,
    submissionId: string,
    author: { userId: string; name: string; kind: 'teacher' | 'student' | 'guardian' },
    body: RequestBody,
  ) {
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (text === '' || text.length > MAX_COMMENT) {
      throw assignmentRule(`Lời trao đổi từ 1 đến ${MAX_COMMENT} ký tự`, [
        { field: 'body', message: `Từ 1 đến ${MAX_COMMENT} ký tự` },
      ]);
    }
    return database
      .insertInto('submission_comments')
      .values({
        submission_id: submissionId,
        author_user_id: author.userId,
        author_name: author.name,
        author_kind: author.kind,
        body: text,
      })
      .returning(['id', 'author_name', 'author_kind', 'body', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  async teacherComment(currentUser: CurrentUser, submissionId: string, body: RequestBody) {
    const { database, submission } = await this.submissionForTeacher(currentUser, submissionId);
    return this.addComment(
      database,
      submission.id,
      { userId: currentUser.id, name: currentUser.description.full_name, kind: 'teacher' },
      body,
    );
  }

  async teacherFile(currentUser: CurrentUser, fileId: string) {
    const { database } = await this.currentSchoolYear.require();
    const file = await database.selectFrom('submission_files').selectAll().where('id', '=', fileId).executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp', 'submission_file');
    }
    await this.submissionForTeacher(currentUser, file.submission_id);
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // ---------- Học sinh

  // Bài của học sinh: người nhận đã chốt, phần làm là của em (bài cá nhân) hoặc của nhóm em (bài nhóm)
  private async studentWork(currentUser: CurrentUser, activityId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    return this.workOf(database, childId, activityId);
  }

  // Phần làm bài của một em (học sinh tự làm, hoặc phụ huynh nộp thay ở 28f)
  private async workOf(database: YearExecutor, childId: string, activityId: string) {
    const activity = await this.learning.openActivityForChild(database, childId, activityId);
    if (activity.kind !== 'assignment') {
      throw assignmentRule('Hoạt động không phải bài tập');
    }
    const assignment = await this.requireAssignment(database, activityId);
    const recipient = await database
      .selectFrom('assignment_recipients')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (!assignment.released_at || !recipient) {
      throw notFoundError('Bài chưa giao cho em', 'assignment');
    }
    const owner = recipient.group_id ? { group_id: recipient.group_id } : { child_id: childId };
    const submissions = await database
      .selectFrom('assignment_submissions')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where((builder) =>
        recipient.group_id ? builder('group_id', '=', recipient.group_id) : builder('child_id', '=', childId),
      )
      .orderBy('attempt_no')
      .execute();
    const items = itemsForVariant(await this.items(database, assignment.id), recipient.variant_id);
    return { database, childId, activity, assignment, recipient, owner, submissions, items };
  }

  private window(work: ChildWork): ReturnType<typeof submitCheck> {
    const used = work.submissions.filter((row) => row.status !== 'draft').length;
    return submitCheck({
      now: this.clock.now(),
      dueAt: work.recipient.due_at ?? work.activity.due_at,
      closedAt: work.assignment.closed_at ?? work.activity.closes_at,
      latePolicy: work.assignment.late_policy,
      attemptsUsed: used,
      maxAttempts: work.assignment.max_attempts,
      excused: work.recipient.excused,
    });
  }

  // Bài cho học sinh xem, làm: câu (không đáp án), bản nháp, các lần nộp; điểm, nhận xét chỉ khi giáo viên đã trả; đúng sai của
  // câu trắc nghiệm khi đã trả hoặc khi giáo viên chọn hiện sau khi nộp
  async studentAssignment(currentUser: CurrentUser, activityId: string) {
    return this.presentWork(await this.studentWork(currentUser, activityId));
  }

  private async presentWork(work: ChildWork) {
    const { database, assignment, submissions, items } = work;
    const draft = submissions.find((row) => row.status === 'draft') ?? null;
    const group = work.recipient.group_id
      ? (await this.groupNames(database, [work.recipient.group_id])).get(work.recipient.group_id)
      : null;
    const members = work.recipient.group_id
      ? await database
          .selectFrom('assignment_recipients')
          .innerJoin('children', 'children.id', 'assignment_recipients.child_id')
          .select(['children.id as child_id', 'children.full_name'])
          .where('assignment_recipients.assignment_id', '=', assignment.id)
          .where('assignment_recipients.group_id', '=', work.recipient.group_id)
          .orderBy('children.full_name')
          .execute()
      : [];
    const attempts = [];
    for (const row of submissions.filter((candidate) => candidate.status !== 'draft')) {
      const returned = row.status === 'returned';
      const showObjective = returned || assignment.show_results === 'after_submit';
      const objective = showObjective ? gradeObjectiveItems(items, asRecord(row.answers) as Answers) : null;
      attempts.push({
        id: row.id,
        attempt_no: row.attempt_no,
        status: row.status,
        late: row.late,
        submitted_at: row.submitted_at,
        answers: asRecord(row.answers),
        correct: objective?.correct ?? null,
        score: returned ? numberOrNull(row.score) : null,
        level: returned ? row.level : null,
        feedback: returned ? row.feedback : null,
        feedback_ai_assisted: returned ? row.feedback_ai_assisted : false,
        returned_at: row.returned_at,
        files: await this.files(database, row.id),
        comments: await this.comments(database, row.id),
      });
    }
    const contribution =
      work.recipient.group_id && attempts.length > 0
        ? await database
            .selectFrom('submission_contributions')
            .select(['self_rating', 'self_note', 'peer_ratings'])
            .where('submission_id', '=', attempts[attempts.length - 1]?.id ?? NO_ID)
            .where('child_id', '=', work.childId)
            .executeTakeFirst()
        : undefined;
    const check = this.window(work);
    return {
      activity: {
        id: work.activity.id,
        title: work.activity.title,
        instructions: work.activity.instructions,
        due_at: work.recipient.due_at ?? work.activity.due_at,
      },
      work_mode: assignment.work_mode,
      grading: assignment.grading,
      max_attempts: assignment.max_attempts,
      can_submit: check.allowed,
      submit_blocked_reason: check.reason,
      will_be_late: check.late,
      upload_limits: await this.uploadLimits(database),
      items: items.map(studentItem),
      group: group
        ? {
            id: work.recipient.group_id,
            name: group.name,
            leader_child_id: group.leader_child_id,
            is_leader: group.leader_child_id === null || group.leader_child_id === work.childId,
            members,
          }
        : null,
      draft: draft
        ? {
            id: draft.id,
            version: draft.version,
            answers: asRecord(draft.answers),
            files: await this.files(database, draft.id),
          }
        : null,
      attempts,
      my_contribution: contribution ?? null,
    };
  }

  // Bản nháp của lần nộp kế tiếp: tạo khi chưa có; còn lượt nộp và bài chưa đóng mới làm tiếp được
  private async ensureDraft(work: ChildWork) {
    const existing = work.submissions.find((row) => row.status === 'draft');
    if (existing) {
      return existing;
    }
    const check = this.window(work);
    if (!check.allowed) {
      throw assignmentRule(check.reason ?? 'Không làm tiếp được bài này');
    }
    const previous = [...work.submissions].reverse().find((row) => row.status !== 'draft');
    const attempt = work.submissions.filter((row) => row.status !== 'draft').length + 1;
    const created = await work.database
      .insertInto('assignment_submissions')
      .values({
        assignment_id: work.assignment.id,
        ...work.owner,
        attempt_no: attempt,
        answers: JSON.stringify(previous ? asRecord(previous.answers) : {}),
        submitted_by: null,
      })
      .onConflict((builder) => builder.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (!created) {
      throw conflict('Bạn cùng nhóm vừa bắt đầu bài, tải lại để làm tiếp');
    }
    return created;
  }

  // Lưu nháp: khóa lạc quan theo `version` (bài nhóm nhiều em cùng sửa): gửi số phiên bản đã tải, khác thì báo tải lại
  async studentSaveDraft(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const work = await this.studentWork(currentUser, activityId);
    const draft = await this.ensureDraft(work);
    const answers = parseAnswers(body?.answers, work.items);
    const version = body?.version;
    if (typeof version === 'number' && version !== draft.version) {
      throw conflict('Bản nháp vừa được bạn cùng nhóm sửa, tải lại để xem bản mới nhất');
    }
    const updated = await work.database
      .updateTable('assignment_submissions')
      .set({ answers: JSON.stringify(answers), version: sql`version + 1`, updated_at: this.clock.now() })
      .where('id', '=', draft.id)
      .where('version', '=', draft.version)
      .where('status', '=', 'draft')
      .returning(['id', 'version'])
      .executeTakeFirst();
    if (!updated) {
      throw conflict('Bản nháp vừa được bạn cùng nhóm sửa, tải lại để xem bản mới nhất');
    }
    return { id: updated.id, version: updated.version, answers };
  }

  // Tải tệp lên bản nháp: ảnh (đã bỏ siêu dữ liệu), tài liệu PDF cho câu "tải tệp", ghi âm cho câu "ghi âm"
  // Học khi mạng yếu (DT-28 phần 28j): máy gửi lại tệp kèm mã chống trùng; tệp đã nhận với mã đó thì trả lại, không lưu lần hai
  async studentUpload(
    currentUser: CurrentUser,
    activityId: string,
    itemId: string,
    part: UploadedPart | undefined,
    clientKey?: string,
  ) {
    return this.uploadTo(
      await this.studentWork(currentUser, activityId),
      currentUser,
      itemId,
      part,
      isUuid(clientKey) ? clientKey : null,
    );
  }

  private async uploadTo(
    work: ChildWork,
    currentUser: CurrentUser,
    itemId: string,
    part: UploadedPart | undefined,
    clientKey: string | null = null,
  ) {
    const item = work.items.find((candidate) => candidate.id === itemId);
    if (!item || (item.kind !== 'upload' && item.kind !== 'audio' && item.kind !== 'essay')) {
      throw assignmentRule('Câu này không nhận tệp');
    }
    if (!part) {
      throw assignmentRule('Chưa chọn tệp', [{ field: 'file', message: 'Chọn tệp' }]);
    }
    const detected = detectSubmissionFile(part.buffer);
    if (!detected || (item.kind === 'audio') !== (detected.kind === 'audio')) {
      throw assignmentRule(
        item.kind === 'audio' ? 'Câu ghi âm chỉ nhận tệp ghi âm' : 'Chỉ nhận ảnh JPEG, PNG hoặc tài liệu PDF',
        [{ field: 'file', message: 'Định dạng tệp không nhận' }],
      );
    }
    const draft = await this.ensureDraft(work);
    if (clientKey) {
      const received = await work.database
        .selectFrom('submission_files')
        .select(['id', 'item_id', 'kind', 'file_name', 'content_type', 'size_bytes', 'created_at'])
        .where('submission_id', '=', draft.id)
        .where('client_key', '=', clientKey)
        .executeTakeFirst();
      if (received) return received;
    }
    const body = detected.contentType === 'image/jpeg' ? stripJpegMetadata(part.buffer) : part.buffer;
    const existing = await work.database
      .selectFrom('submission_files')
      .select(['kind', 'size_bytes'])
      .where('submission_id', '=', draft.id)
      .execute();
    const problem = checkUpload(await this.uploadLimits(work.database), existing, {
      kind: detected.kind,
      size: body.length,
    });
    if (problem) {
      throw assignmentRule(problem, [{ field: 'file', message: problem }]);
    }
    const key = storageKey('assignment-submissions', draft.id, randomUUID());
    await this.fileStorage.put(key, body, detected.contentType);
    return work.database
      .insertInto('submission_files')
      .values({
        submission_id: draft.id,
        item_id: item.id,
        kind: detected.kind,
        file_name: decodeFileName(part).slice(0, 200),
        content_type: detected.contentType,
        size_bytes: body.length,
        storage_key: key,
        uploaded_by: currentUser.id,
        client_key: clientKey,
      })
      .returning(['id', 'item_id', 'kind', 'file_name', 'content_type', 'size_bytes', 'created_at'])
      .executeTakeFirstOrThrow();
  }

  // Học sinh của bài (hoặc nhóm) xem tệp, xóa tệp của bản nháp
  private async studentFileRow(currentUser: CurrentUser, fileId: string) {
    const { database, childId } = await this.learning.studentContext(currentUser);
    const file = await database
      .selectFrom('submission_files')
      .innerJoin('assignment_submissions', 'assignment_submissions.id', 'submission_files.submission_id')
      .select([
        'submission_files.id',
        'submission_files.storage_key',
        'submission_files.file_name',
        'submission_files.content_type',
        'assignment_submissions.id as submission_id',
        'assignment_submissions.status',
        'assignment_submissions.assignment_id',
        'assignment_submissions.child_id',
        'assignment_submissions.group_id',
      ])
      .where('submission_files.id', '=', fileId)
      .executeTakeFirst();
    const recipient = file
      ? await database
          .selectFrom('assignment_recipients')
          .select(['child_id', 'group_id'])
          .where('assignment_id', '=', file.assignment_id)
          .where('child_id', '=', childId)
          .executeTakeFirst()
      : undefined;
    const own =
      file &&
      recipient &&
      (file.child_id === childId || (file.group_id !== null && file.group_id === recipient.group_id));
    if (!file || !own) {
      throw notFoundError('Không tìm thấy tệp', 'submission_file');
    }
    return { database, file };
  }

  async studentFile(currentUser: CurrentUser, fileId: string) {
    const { file } = await this.studentFileRow(currentUser, fileId);
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  async studentRemoveFile(currentUser: CurrentUser, fileId: string) {
    const { database, file } = await this.studentFileRow(currentUser, fileId);
    if (file.status !== 'draft') {
      throw assignmentRule('Bài đã nộp, không xóa tệp được');
    }
    await database.deleteFrom('submission_files').where('id', '=', file.id).execute();
    await this.fileStorage.delete(file.storage_key);
    return { id: file.id };
  }

  // Mã chống trùng và thời điểm bấm nộp trên máy (DT-28 phần 28j): thời điểm chỉ nhận trong 7 ngày gần đây, không sau lúc nhận
  // quá 5 phút (đồng hồ máy lệch); sai thì bỏ, máy chủ vẫn tính muộn theo lúc nhận
  private clientSubmission(body: RequestBody) {
    const key = isUuid(body?.client_submit_key) ? body.client_submit_key : null;
    const raw = typeof body?.client_submitted_at === 'string' ? new Date(body.client_submitted_at) : null;
    const now = this.clock.now().getTime();
    const at =
      raw && !Number.isNaN(raw.getTime()) && raw.getTime() <= now + 5 * 60_000 && raw.getTime() >= now - 7 * 86_400_000
        ? raw
        : null;
    return { client_submit_key: key, client_submitted_at: key ? at : null };
  }

  // Nộp: bài nhóm do nhóm trưởng nộp (nhóm chưa có nhóm trưởng thì em nào cũng nộp được); máy chấm phần trắc nghiệm ngay;
  // nộp muộn đánh dấu, không trừ điểm (GD-147); kết quả hoạt động của các em là đã nộp
  async studentSubmit(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const work = await this.studentWork(currentUser, activityId);
    // Học khi mạng yếu (DT-28 phần 28j): máy gửi lại lần nộp kèm mã chống trùng; đã nhận thì trả lần nộp đó, không nộp lần hai
    const clientKey = isUuid(body?.client_submit_key) ? body.client_submit_key : null;
    if (clientKey) {
      const received = await work.database
        .selectFrom('assignment_submissions')
        .select(['id', 'attempt_no', 'late', 'submitted_at', 'child_id', 'group_id'])
        .where('assignment_id', '=', work.assignment.id)
        .where('client_submit_key', '=', clientKey)
        .executeTakeFirst();
      const own =
        received &&
        (work.recipient.group_id ? received.group_id === work.recipient.group_id : received.child_id === work.childId);
      if (own) {
        return {
          id: received.id,
          attempt_no: received.attempt_no,
          late: received.late,
          submitted_at: received.submitted_at,
          replayed: true,
        };
      }
    }
    if (work.recipient.group_id) {
      const group = (await this.groupNames(work.database, [work.recipient.group_id])).get(work.recipient.group_id);
      if (group?.leader_child_id && group.leader_child_id !== work.childId) {
        throw assignmentRule('Bài nhóm do nhóm trưởng nộp');
      }
    }
    return this.submitWork(work, currentUser, 'student', body);
  }

  private async submitWork(work: ChildWork, currentUser: CurrentUser, kind: 'student' | 'guardian', body: RequestBody) {
    const check = this.window(work);
    if (!check.allowed) {
      throw assignmentRule(check.reason ?? 'Không nộp được bài này');
    }
    const draft = await this.ensureDraft(work);
    if (body?.answers !== undefined) {
      if (typeof body.version === 'number' && body.version !== draft.version) {
        throw conflict('Bản nháp vừa được bạn cùng nhóm sửa, tải lại trước khi nộp');
      }
    }
    const answers =
      body?.answers !== undefined ? parseAnswers(body.answers, work.items) : (asRecord(draft.answers) as Answers);
    const objective = gradeObjectiveItems(work.items, answers);
    const automatic = scoreOfItems(work.items, objective.earned, {});
    const now = this.clock.now();
    const submitted = await work.database
      .updateTable('assignment_submissions')
      .set({
        status: 'submitted',
        answers: JSON.stringify(answers),
        late: check.late,
        submitted_by: currentUser.id,
        submitted_by_kind: kind,
        ...this.clientSubmission(body),
        submitted_at: now,
        auto_score: objective.objective,
        // Bài chỉ có câu máy chấm thì có điểm ngay (vẫn chờ giáo viên trả mới hiện cho học sinh)
        score: work.assignment.grading === 'score' ? automatic.score : null,
        version: sql`version + 1`,
        updated_at: now,
      })
      .where('id', '=', draft.id)
      .where('status', '=', 'draft')
      .returningAll()
      .executeTakeFirst();
    if (!submitted) {
      throw conflict('Bài vừa được nộp, tải lại để xem');
    }
    const members = await this.membersOf(work.database, work.assignment, submitted);
    for (const childId of members) {
      await this.learning.writeResult(
        work.database,
        work.activity,
        childId,
        { status: resultOnSubmit(work.activity.completion_rule as CompletionRule) },
        { userId: currentUser.id, kind, verb: 'submitted' },
      );
    }
    return { id: submitted.id, attempt_no: submitted.attempt_no, late: submitted.late, submitted_at: now };
  }

  // Bài nhóm: em tự đánh giá đóng góp và đánh giá ngắn các bạn (1 đến 5); chỉ giáo viên xem
  async studentContribution(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const work = await this.studentWork(currentUser, activityId);
    if (!work.recipient.group_id) {
      throw assignmentRule('Chỉ bài nhóm mới đánh giá đóng góp');
    }
    const latest = [...work.submissions].reverse().find((row) => row.status !== 'draft');
    if (!latest) {
      throw assignmentRule('Nhóm nộp bài rồi mới đánh giá đóng góp');
    }
    const members = await this.membersOf(work.database, work.assignment, latest);
    const errors: FieldError[] = [];
    const rating = (value: unknown, field: string) => {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
        errors.push({ field, message: 'Đánh giá từ 1 đến 5' });
        return null;
      }
      return value;
    };
    const selfRating = rating(body?.self_rating, 'self_rating');
    const note = typeof body?.self_note === 'string' ? body.self_note.trim() : '';
    if (note.length > 500) errors.push({ field: 'self_note', message: 'Tối đa 500 ký tự' });
    const peers: Record<string, number> = {};
    for (const [childId, value] of Object.entries(asRecord(body?.peers))) {
      if (childId === work.childId || !members.includes(childId)) {
        errors.push({ field: `peers.${childId}`, message: 'Chỉ đánh giá bạn cùng nhóm' });
        continue;
      }
      const parsed = rating(value, `peers.${childId}`);
      if (parsed !== null) peers[childId] = parsed;
    }
    if (errors.length > 0) {
      throw assignmentRule('Đánh giá đóng góp chưa hợp lệ', errors);
    }
    const values = {
      self_rating: selfRating,
      self_note: note === '' ? null : note,
      peer_ratings: JSON.stringify(peers),
      updated_at: this.clock.now(),
    };
    await work.database
      .insertInto('submission_contributions')
      .values({ submission_id: latest.id, child_id: work.childId, ...values })
      .onConflict((builder) => builder.columns(['submission_id', 'child_id']).doUpdateSet(values))
      .execute();
    return { submission_id: latest.id, self_rating: selfRating, self_note: values.self_note, peer_ratings: peers };
  }

  async studentComment(currentUser: CurrentUser, activityId: string, submissionId: string, body: RequestBody) {
    const work = await this.studentWork(currentUser, activityId);
    const submission = work.submissions.find((row) => row.id === submissionId && row.status !== 'draft');
    if (!submission) {
      throw notFoundError('Không tìm thấy bài nộp của em', 'assignment_submission');
    }
    return this.addComment(
      work.database,
      submission.id,
      { userId: currentUser.id, name: currentUser.description.full_name, kind: 'student' },
      body,
    );
  }

  // ---------- Phụ huynh

  // Phụ huynh xem bài của con: trạng thái các lần nộp, điểm, mức, nhận xét khi giáo viên đã trả; không xem câu trả lời của nhóm
  async childAssignment(currentUser: CurrentUser, childId: string, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.learning.guardianOrStaff(currentUser, database, childId);
    const assignment = await this.requireAssignment(database, activityId);
    const recipient = await database
      .selectFrom('assignment_recipients')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    if (!recipient) {
      throw notFoundError('Bài chưa giao cho con', 'assignment');
    }
    const activity = await database
      .selectFrom('course_activities')
      .select(['id', 'title', 'due_at', 'status'])
      .where('id', '=', activityId)
      .executeTakeFirstOrThrow();
    const rows = await database
      .selectFrom('assignment_submissions')
      .selectAll()
      .where('assignment_id', '=', assignment.id)
      .where('status', '<>', 'draft')
      .where((builder) =>
        recipient.group_id ? builder('group_id', '=', recipient.group_id) : builder('child_id', '=', childId),
      )
      .orderBy('attempt_no')
      .execute();
    return {
      activity: { id: activity.id, title: activity.title, due_at: recipient.due_at ?? activity.due_at },
      work_mode: assignment.work_mode,
      excused: recipient.excused,
      attempts: rows.map((row) => {
        const returned = row.status === 'returned';
        return {
          attempt_no: row.attempt_no,
          status: row.status,
          late: row.late,
          submitted_at: row.submitted_at,
          score: returned ? numberOrNull(row.score) : null,
          level: returned ? row.level : null,
          feedback: returned ? row.feedback : null,
          feedback_ai_assisted: returned ? row.feedback_ai_assisted : false,
        };
      }),
    };
  }
  // ---------- Phụ huynh nộp thay bài về nhà (DT-28 phần 28f, YCTD-276)

  // Nộp thay chỉ cho bài về nhà làm cá nhân của con chưa có tài khoản học (con có tài khoản thì con tự nộp); người gọi phải là phụ
  // huynh của con, cán bộ xem được lớp không nộp thay
  private async guardianWork(currentUser: CurrentUser, childId: string, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    if (!(await this.learning.guardianOrStaff(currentUser, database, childId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của học sinh nộp thay bài về nhà');
    }
    const work = await this.workOf(database, childId, activityId);
    const account = await database
      .selectFrom('student_learning_accounts')
      .select('identity_user_id')
      .where('child_id', '=', childId)
      .where('identity_user_id', 'is not', null)
      .executeTakeFirst();
    const problem =
      work.assignment.context !== 'homework'
        ? 'Phụ huynh chỉ nộp thay bài về nhà'
        : work.assignment.work_mode !== 'individual'
          ? 'Bài nhóm do các em trong nhóm nộp'
          : account
            ? 'Con đã có tài khoản học, con tự nộp bài'
            : null;
    return { work, problem };
  }

  private async proxyWork(currentUser: CurrentUser, childId: string, activityId: string) {
    const { work, problem } = await this.guardianWork(currentUser, childId, activityId);
    if (problem) {
      throw assignmentRule(problem);
    }
    return work;
  }

  // Bài về nhà của con cho phụ huynh xem để nộp thay: câu (không đáp án), bản nháp, các lần nộp; `can_proxy` và lý do khi không
  async guardianAssignment(currentUser: CurrentUser, childId: string, activityId: string) {
    const { work, problem } = await this.guardianWork(currentUser, childId, activityId);
    return { ...(await this.presentWork(work)), can_proxy: problem === null, proxy_blocked_reason: problem };
  }

  async guardianUpload(
    currentUser: CurrentUser,
    childId: string,
    activityId: string,
    itemId: string,
    part: UploadedPart | undefined,
  ) {
    return this.uploadTo(await this.proxyWork(currentUser, childId, activityId), currentUser, itemId, part);
  }

  async guardianRemoveFile(currentUser: CurrentUser, childId: string, activityId: string, fileId: string) {
    const work = await this.proxyWork(currentUser, childId, activityId);
    const draft = work.submissions.find((row) => row.status === 'draft');
    const file = draft
      ? await work.database
          .selectFrom('submission_files')
          .select(['id', 'storage_key'])
          .where('id', '=', fileId)
          .where('submission_id', '=', draft.id)
          .executeTakeFirst()
      : undefined;
    if (!file) {
      throw notFoundError('Không tìm thấy tệp trong bản nháp của con', 'submission_file');
    }
    await work.database.deleteFrom('submission_files').where('id', '=', file.id).execute();
    await this.fileStorage.delete(file.storage_key);
    return { id: file.id };
  }

  async guardianSubmit(currentUser: CurrentUser, childId: string, activityId: string, body: RequestBody) {
    return this.submitWork(await this.proxyWork(currentUser, childId, activityId), currentUser, 'guardian', body);
  }

  // Phụ huynh trao đổi với giáo viên trên bài đã nộp của con (con có hay chưa có tài khoản đều được)
  async guardianComment(
    currentUser: CurrentUser,
    childId: string,
    activityId: string,
    submissionId: string,
    body: RequestBody,
  ) {
    const { work } = await this.guardianWork(currentUser, childId, activityId);
    const submission = work.submissions.find((row) => row.id === submissionId && row.status !== 'draft');
    if (!submission) {
      throw notFoundError('Không tìm thấy bài nộp của con', 'assignment_submission');
    }
    return this.addComment(
      work.database,
      submission.id,
      { userId: currentUser.id, name: currentUser.description.full_name, kind: 'guardian' },
      body,
    );
  }
}
