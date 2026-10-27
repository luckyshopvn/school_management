import { Injectable } from '@nestjs/common';
import {
  vietnamDate,
  type ActivityResultLevel,
  type SchoolYearDatabase,
  type SystemDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { GroupSetsReader } from '../child-groups/group-sets.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { TimetablesService } from '../timetables/timetables.js';
import { activityKind, ACTIVITY_KINDS, hostAllowed } from './learning-activity-kinds.js';
import {
  diffTeachers,
  evaluateOpenRules,
  isDone,
  learningRule,
  openRuleReferences,
  parseOpenRules,
  planClassSpaces,
  readBoundedText,
  readOptionalTime,
  readOptionalWeek,
  replaceAllowed,
  sectionDone,
  summarizeProgress,
  throwIfErrors,
  weeklyPlan,
  type CompletionRule,
  type DecisionSource,
  type OpenRules,
  type ResultSnapshot,
  type ResultStatus,
} from './learning-rules.js';
import {
  emptyTemplateContent,
  parseTemplateContent,
  planTemplateApply,
  type TemplateContent,
  type TemplateItem,
} from './learning-template-rules.js';

// Lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272; tài liệu 32 mục 20.7). Lớp học trực tuyến, chương, hoạt động, kết
// quả hoạt động, nhật ký học tập ở năm học; khoá học mẫu của tổ ở hệ thống. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Lớp học trực tuyến theo lớp, môn sinh từ phân công giảng dạy (`class_staff_assignments` có môn); cặp lớp, môn chỉ có trong
//   thời khoá biểu đang áp dụng thì lấy giáo viên của tiết. Đồng bộ khi giáo viên mở danh sách lớp của mình và khi Ban Giám
//   hiệu bấm đồng bộ; không xóa lớp, chỉ đổi giáo viên lấy từ phân công.
// - Ai dạy: giáo viên của lớp học trực tuyến có quyền dạy. Ai xem mọi lớp: Ban Giám hiệu (quyền phê duyệt học liệu); tổ trưởng
//   xem lớp của các môn trong tổ mình (tổ bộ môn 21a). Phụ huynh xem lớp của con khi lớp đã mở cho học sinh.
// - Duyệt khoá mẫu theo luồng của 22h1 với cùng quyền: tổ trưởng cùng tổ duyệt bước tổ (Ban Giám hiệu duyệt thay khi người
//   soạn không thuộc tổ), Ban Giám hiệu phê duyệt; người duyệt không duyệt khoá của mình.
// - Liên kết ngoài: trường đặt danh sách tên miền ở cấu hình `learning_link_domains`; chưa đặt thì cho mọi liên kết https.
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type SpaceRow = Selectable<SchoolYearDatabase['course_spaces']>;
type ActivityRow = Selectable<SchoolYearDatabase['course_activities']>;
type TemplateRow = Selectable<SystemDatabase['course_templates']>;
const NO_ID = '00000000-0000-0000-0000-000000000000';
const MAX_EXCEPTION_REASON = 500;

export interface LearningContext {
  userId: string;
  name: string;
  canTeach: boolean;
  canTemplate: boolean;
  canDecide: boolean;
  canView: boolean;
  canReviewUnit: boolean;
  canApprove: boolean;
  departmentId: string | null;
  departmentName: string | null;
}

export interface ActivityInput {
  section_id?: string;
  kind?: string;
  title?: string;
  lesson_label?: string | null;
  instructions?: string | null;
  required?: boolean;
  teaching_mode?: 'support' | 'replace';
  estimated_minutes?: number | null;
  opens_at?: Date | null;
  due_at?: Date | null;
  closes_at?: Date | null;
  open_rules?: OpenRules | null;
  completion_rule?: CompletionRule;
  graded?: boolean;
  weight?: number;
  pass_score?: number | null;
  planned_week?: number | null;
  settings?: Record<string, unknown>;
}

// Đọc dữ liệu hoạt động; `partial` là khi sửa (trường không gửi thì giữ nguyên)
export function parseActivityInput(body: RequestBody, partial: boolean): ActivityInput {
  const errors: FieldError[] = [];
  const input: ActivityInput = {};
  if (!partial) {
    const sectionId = readOptionalUuid(body, 'section_id', errors);
    if (!sectionId) {
      errors.push({ field: 'section_id', message: 'Chọn chương' });
    } else {
      input.section_id = sectionId;
    }
    const kind = activityKind(body?.kind);
    if (!kind) {
      errors.push({
        field: 'kind',
        message: `Loại hoạt động là một trong: ${ACTIVITY_KINDS.map((item) => item.code).join(', ')}`,
      });
    } else {
      input.kind = kind.code;
    }
  } else if (body?.section_id !== undefined) {
    const sectionId = readOptionalUuid(body, 'section_id', errors);
    if (sectionId) {
      input.section_id = sectionId;
    }
  }
  const title = readBoundedText(body, 'title', errors, { required: !partial, max: 300 });
  if (title) {
    input.title = title;
  }
  const lessonLabel = readBoundedText(body, 'lesson_label', errors, { required: false, max: 200 });
  if (lessonLabel !== undefined) {
    input.lesson_label = lessonLabel;
  }
  const instructions = readBoundedText(body, 'instructions', errors, { required: false, max: 5000 });
  if (instructions !== undefined) {
    input.instructions = instructions;
  }
  for (const field of ['required', 'graded'] as const) {
    const value = body?.[field];
    if (value !== undefined) {
      if (typeof value !== 'boolean') {
        errors.push({ field, message: 'Có hoặc không' });
      } else {
        input[field] = value;
      }
    }
  }
  if (body?.teaching_mode !== undefined) {
    if (body.teaching_mode !== 'support' && body.teaching_mode !== 'replace') {
      errors.push({ field: 'teaching_mode', message: 'Hình thức là support (hỗ trợ) hoặc replace (thay thế)' });
    } else {
      input.teaching_mode = body.teaching_mode;
    }
  }
  const minutes = body?.estimated_minutes;
  if (minutes !== undefined) {
    if (minutes !== null && !(Number.isInteger(minutes) && (minutes as number) >= 1 && (minutes as number) <= 600)) {
      errors.push({ field: 'estimated_minutes', message: 'Thời lượng dự kiến từ 1 đến 600 phút' });
    } else {
      input.estimated_minutes = minutes as number | null;
    }
  }
  for (const field of ['opens_at', 'due_at', 'closes_at'] as const) {
    const value = readOptionalTime(body, field, errors);
    if (value !== undefined) {
      input[field] = value;
    }
  }
  if (body?.open_rules !== undefined) {
    input.open_rules = parseOpenRules(body.open_rules, 'open_rules', errors);
  }
  if (body?.completion_rule !== undefined) {
    if (!['view', 'submit', 'pass', 'teacher'].includes(String(body.completion_rule))) {
      errors.push({ field: 'completion_rule', message: 'Cách tính hoàn thành là view, submit, pass hoặc teacher' });
    } else {
      input.completion_rule = body.completion_rule as CompletionRule;
    }
  }
  if (body?.weight !== undefined) {
    if (typeof body.weight !== 'number' || body.weight < 0 || body.weight > 100) {
      errors.push({ field: 'weight', message: 'Trọng số từ 0 đến 100' });
    } else {
      input.weight = body.weight;
    }
  }
  if (body?.pass_score !== undefined) {
    if (
      body.pass_score !== null &&
      (typeof body.pass_score !== 'number' || body.pass_score < 0 || body.pass_score > 10)
    ) {
      errors.push({ field: 'pass_score', message: 'Điểm đạt từ 0 đến 10' });
    } else {
      input.pass_score = body.pass_score as number | null;
    }
  }
  const plannedWeek = readOptionalWeek(body, 'planned_week', errors);
  if (plannedWeek !== undefined) {
    input.planned_week = plannedWeek;
  }
  if (body?.settings !== undefined) {
    input.settings = body.settings as Record<string, unknown>;
  }
  throwIfErrors(errors);
  return input;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class LearningService {
  constructor(
    private readonly databases: Databases,
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly timetables: TimetablesService,
    private readonly groupSets: GroupSetsReader,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today() {
    return vietnamDate(this.clock.now());
  }

  async context(currentUser: CurrentUser): Promise<LearningContext> {
    const current = await this.currentSchoolYear.find();
    const staff = current
      ? await current.database
          .selectFrom('staff')
          .leftJoin('departments', 'departments.id', 'staff.department_id')
          .select(['staff.department_id', 'departments.name'])
          .where('staff.user_id', '=', currentUser.id)
          .where('staff.status', '=', 'active')
          .executeTakeFirst()
      : undefined;
    return {
      userId: currentUser.id,
      name: currentUser.description.full_name,
      canTeach: currentUser.hasPermission(PERMISSION_CODES.learningTeach),
      canTemplate: currentUser.hasPermission(PERMISSION_CODES.learningTemplate),
      canDecide: currentUser.hasPermission(PERMISSION_CODES.learningDecide),
      canView: currentUser.hasPermission(PERMISSION_CODES.learningView),
      canReviewUnit: currentUser.hasPermission(PERMISSION_CODES.learningResourceReview),
      canApprove: currentUser.hasPermission(PERMISSION_CODES.learningResourceApprove),
      departmentId: staff?.department_id ?? null,
      departmentName: staff?.name ?? null,
    };
  }

  async config(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    return {
      can_teach: context.canTeach,
      can_template: context.canTemplate,
      can_decide: context.canDecide,
      can_view: context.canView,
      can_review: context.canReviewUnit || context.canApprove,
      link_domains: await this.linkDomains(),
      activity_kinds: ACTIVITY_KINDS.map((kind) => ({
        code: kind.code,
        label: kind.label,
        completion_rules: kind.completionRules,
        default_completion: kind.defaultCompletion,
        allowed_in_template: kind.allowedInTemplate,
      })),
    };
  }

  private async linkDomains(): Promise<string[] | null> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return null;
    }
    const row = await current.database
      .selectFrom('settings')
      .innerJoin('org_units', 'org_units.id', 'settings.org_unit_id')
      .select('settings.value')
      .where('org_units.unit_type', '=', 'truong_chinh')
      .where('settings.key', '=', 'learning_link_domains')
      .executeTakeFirst();
    return row && Array.isArray(row.value) ? asStringArray(row.value) : null;
  }

  // ---------- Lớp học trực tuyến ----------

  // Sinh và đồng bộ lớp học trực tuyến theo lớp, môn từ phân công giảng dạy và thời khoá biểu đang áp dụng. Lớp đã có thì chỉ
  // đồng bộ giáo viên; không xóa lớp nào
  async sync(database: YearExecutor, filter: { teacherUserId?: string } = {}) {
    const classes = await database
      .selectFrom('classes')
      .select(['id', 'name', 'school_level', 'grade_level'])
      .where('status', '=', 'active')
      .where('school_level', 'in', ['TH', 'THCS', 'THPT'])
      .execute();
    if (classes.length === 0) {
      return { created: 0, teachers_added: 0, teachers_removed: 0 };
    }
    const classIds = classes.map((row) => row.id);
    const assignments = await database
      .selectFrom('class_staff_assignments')
      .select(['class_id', 'subject_id', 'staff_user_id', 'staff_name'])
      .where('status', '=', 'active')
      .where('subject_id', 'is not', null)
      .where('class_id', 'in', classIds)
      .execute();
    const versions = await this.timetables.applyingVersions(database as Kysely<SchoolYearDatabase>, this.today());
    const lessons =
      versions.length === 0
        ? []
        : await database
            .selectFrom('timetable_lessons')
            .select(['class_id', 'subject_id', 'teacher_user_id', 'teacher_name'])
            .where(
              'version_id',
              'in',
              versions.map((version) => version.id),
            )
            .where('class_id', 'in', classIds)
            .execute();
    const subjectIds = [
      ...new Set([...assignments.map((row) => row.subject_id ?? NO_ID), ...lessons.map((row) => row.subject_id)]),
    ];
    // Trường chưa có phân công môn, tiết nào (chỉ có khoá tự chọn): không truy vấn với danh sách rỗng (DT-28 phần 28i)
    const subjects =
      subjectIds.length === 0
        ? []
        : await database.selectFrom('subjects').select(['id', 'name']).where('id', 'in', subjectIds).execute();
    let planned = planClassSpaces(
      classes,
      subjects,
      assignments.flatMap((row) => (row.subject_id ? [{ ...row, subject_id: row.subject_id }] : [])),
      lessons,
    );
    if (filter.teacherUserId) {
      planned = planned.filter((space) => space.teachers.some((teacher) => teacher.user_id === filter.teacherUserId));
    }
    const existing = await database
      .selectFrom('course_spaces')
      .select(['id', 'class_id', 'subject_id'])
      .where('kind', '=', 'class_subject')
      .execute();
    const spaceByPair = new Map(existing.map((row) => [`${row.class_id}|${row.subject_id}`, row.id]));
    let created = 0;
    let added = 0;
    let removed = 0;
    for (const space of planned) {
      let spaceId = spaceByPair.get(`${space.class_id}|${space.subject_id}`);
      if (!spaceId) {
        const inserted = await database
          .insertInto('course_spaces')
          .values({
            kind: 'class_subject',
            class_id: space.class_id,
            subject_id: space.subject_id,
            school_level: space.school_level,
            grade_level: space.grade_level,
            title: space.title,
          })
          .onConflict((conflict) =>
            conflict.columns(['class_id', 'subject_id']).where('kind', '=', 'class_subject').doNothing(),
          )
          .returning('id')
          .executeTakeFirst();
        if (!inserted) {
          continue;
        }
        spaceId = inserted.id;
        created += 1;
      }
      const teachers = await database
        .selectFrom('course_space_teachers')
        .select(['user_id', 'source'])
        .where('space_id', '=', spaceId)
        .execute();
      const diff = diffTeachers(teachers, space.teachers);
      if (diff.add.length > 0) {
        await database
          .insertInto('course_space_teachers')
          .values(diff.add.map((teacher) => ({ space_id: spaceId as string, ...teacher })))
          .onConflict((conflict) => conflict.columns(['space_id', 'user_id']).doNothing())
          .execute();
        added += diff.add.length;
      }
      if (diff.remove.length > 0 && !filter.teacherUserId) {
        await database
          .deleteFrom('course_space_teachers')
          .where('space_id', '=', spaceId)
          .where('user_id', 'in', diff.remove)
          .execute();
        removed += diff.remove.length;
      }
    }
    return { created, teachers_added: added, teachers_removed: removed };
  }

  async syncAll(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    if (!context.canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu, tổ trưởng đồng bộ được lớp học trực tuyến');
    }
    const { database } = await this.currentSchoolYear.require();
    return this.sync(database);
  }

  // Lớp học trực tuyến người dùng thấy: giáo viên thấy lớp mình dạy (đồng bộ phần của mình trước); Ban Giám hiệu thấy mọi lớp;
  // tổ trưởng thấy thêm lớp của các môn trong tổ
  async listSpaces(currentUser: CurrentUser, scope: 'mine' | 'all') {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    if (context.canTeach) {
      await this.sync(database, { teacherUserId: context.userId });
    }
    let query = database
      .selectFrom('course_spaces')
      .leftJoin('classes', 'classes.id', 'course_spaces.class_id')
      .leftJoin('subjects', 'subjects.id', 'course_spaces.subject_id')
      .select([
        'course_spaces.id',
        'course_spaces.kind',
        'course_spaces.title',
        'course_spaces.class_id',
        'classes.name as class_name',
        'course_spaces.subject_id',
        'subjects.name as subject_name',
        'course_spaces.school_level',
        'course_spaces.grade_level',
        'course_spaces.visible_to_students',
        'course_spaces.status',
        'course_spaces.source_template_id',
        'course_spaces.source_template_version',
        sql<number>`(select count(*)::int from course_activities where course_activities.space_id = course_spaces.id)`.as(
          'activity_count',
        ),
        sql<string>`coalesce((select string_agg(user_name, ', ' order by user_name) from course_space_teachers
          where course_space_teachers.space_id = course_spaces.id), '')`.as('teacher_names'),
      ]);
    if (scope === 'mine' || !context.canView) {
      query = query.where((expression) =>
        expression.exists(
          expression
            .selectFrom('course_space_teachers')
            .select('course_space_teachers.user_id')
            .whereRef('course_space_teachers.space_id', '=', 'course_spaces.id')
            .where('course_space_teachers.user_id', '=', context.userId),
        ),
      );
    } else if (!context.canApprove) {
      const subjectIds = await this.teamSubjectIds(database, context.userId);
      query = query.where((expression) =>
        expression.or([
          expression('course_spaces.subject_id', 'in', subjectIds.length > 0 ? subjectIds : [NO_ID]),
          expression('course_spaces.kind', '=', 'elective'),
        ]),
      );
    }
    return query.orderBy('course_spaces.status').orderBy('course_spaces.title').execute();
  }

  private async teamSubjectIds(database: YearExecutor, userId: string): Promise<string[]> {
    const rows = await database
      .selectFrom('subject_team_members')
      .innerJoin('subject_team_subjects', 'subject_team_subjects.team_id', 'subject_team_members.team_id')
      .select('subject_team_subjects.subject_id')
      .where('subject_team_members.staff_user_id', '=', userId)
      .execute();
    return [...new Set(rows.map((row) => row.subject_id))];
  }

  // Quyền với một lớp học trực tuyến: `teach` là giáo viên của lớp (có quyền dạy) hoặc người xem mọi lớp; `view` gồm thêm tổ
  // trưởng của môn
  private async access(context: LearningContext, database: YearExecutor, spaceId: string) {
    const space = await database.selectFrom('course_spaces').selectAll().where('id', '=', spaceId).executeTakeFirst();
    if (!space) {
      throw notFoundError('Không tìm thấy lớp học trực tuyến', 'course_space');
    }
    const teacher = await database
      .selectFrom('course_space_teachers')
      .select('user_id')
      .where('space_id', '=', spaceId)
      .where('user_id', '=', context.userId)
      .executeTakeFirst();
    const isTeacher = Boolean(teacher) && context.canTeach;
    let canView = isTeacher || (context.canView && context.canApprove);
    if (!canView && context.canView) {
      canView =
        space.kind === 'elective' ||
        (await this.teamSubjectIds(database, context.userId)).includes(space.subject_id ?? '');
    }
    if (!canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không dạy hoặc quản lý lớp học trực tuyến này');
    }
    return {
      space,
      canTeach: isTeacher || (context.canView && context.canApprove) || (context.canView && space.kind === 'elective'),
    };
  }

  private async requireTeach(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const access = await this.access(context, database, spaceId);
    if (!access.canTeach) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ giáo viên của lớp học trực tuyến sửa được nội dung');
    }
    return { context, database, space: access.space };
  }

  async createElective(currentUser: CurrentUser, body: RequestBody) {
    const context = await this.context(currentUser);
    if (!context.canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu, tổ trưởng tạo được khoá tự chọn');
    }
    const errors: FieldError[] = [];
    const title = readBoundedText(body, 'title', errors, { required: true, max: 300 });
    const description = readBoundedText(body, 'description', errors, { required: false, max: 2000 });
    const level = body?.school_level;
    if (level !== 'TH' && level !== 'THCS' && level !== 'THPT') {
      errors.push({ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' });
    }
    const mode = body?.enrollment_mode ?? 'teacher';
    if (mode !== 'teacher' && mode !== 'request') {
      errors.push({ field: 'enrollment_mode', message: 'Cách ghi danh là teacher hoặc request' });
    }
    const capacity = body?.capacity;
    if (
      capacity !== undefined &&
      capacity !== null &&
      !(Number.isInteger(capacity) && (capacity as number) >= 1 && (capacity as number) <= 2000)
    ) {
      errors.push({ field: 'capacity', message: 'Số chỗ từ 1 đến 2000' });
    }
    const teacherIds = Array.isArray(body?.teacher_user_ids) ? body.teacher_user_ids : [];
    throwIfErrors(errors);
    const { database } = await this.currentSchoolYear.require();
    const teachers =
      teacherIds.length === 0
        ? []
        : await database
            .selectFrom('staff')
            .select(['user_id', 'full_name'])
            .where('user_id', 'in', teacherIds as string[])
            .where('status', '=', 'active')
            .execute();
    return database.transaction().execute(async (transaction) => {
      const space = await transaction
        .insertInto('course_spaces')
        .values({
          kind: 'elective',
          school_level: level as 'TH' | 'THCS' | 'THPT',
          grade_level: typeof body?.grade_level === 'string' ? body.grade_level : null,
          title: title ?? '',
          description: description ?? null,
          enrollment_mode: mode as 'teacher' | 'request',
          capacity: (capacity as number | null | undefined) ?? null,
          created_by: context.userId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const rows = teachers.flatMap((teacher) =>
        teacher.user_id
          ? [{ space_id: space.id, user_id: teacher.user_id, user_name: teacher.full_name, source: 'manual' as const }]
          : [],
      );
      if (rows.length > 0) {
        await transaction.insertInto('course_space_teachers').values(rows).execute();
      }
      return { id: space.id };
    });
  }

  async updateSpace(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database } = await this.requireTeach(currentUser, spaceId);
    const errors: FieldError[] = [];
    const changes: Record<string, unknown> = {};
    const title = readBoundedText(body, 'title', errors, { required: false, max: 300 });
    if (title) {
      changes.title = title;
    }
    const description = readBoundedText(body, 'description', errors, { required: false, max: 2000 });
    if (description !== undefined) {
      changes.description = description;
    }
    if (body?.visible_to_students !== undefined) {
      if (typeof body.visible_to_students !== 'boolean') {
        errors.push({ field: 'visible_to_students', message: 'Có hoặc không' });
      } else {
        changes.visible_to_students = body.visible_to_students;
      }
    }
    if (body?.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'archived') {
        errors.push({ field: 'status', message: 'Trạng thái là active hoặc archived' });
      } else {
        changes.status = body.status;
      }
    }
    throwIfErrors(errors);
    if (Object.keys(changes).length > 0) {
      await database
        .updateTable('course_spaces')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', spaceId)
        .execute();
    }
    return this.space(currentUser, spaceId);
  }

  async addTeacher(currentUser: CurrentUser, spaceId: string, userId: string) {
    const context = await this.context(currentUser);
    if (!context.canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu, tổ trưởng thêm được giáo viên');
    }
    const { database } = await this.currentSchoolYear.require();
    await this.access(context, database, spaceId);
    const staff = await database
      .selectFrom('staff')
      .select(['user_id', 'full_name'])
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!staff?.user_id) {
      throw notFoundError('Không tìm thấy giáo viên đang làm việc', 'staff');
    }
    await database
      .insertInto('course_space_teachers')
      .values({ space_id: spaceId, user_id: staff.user_id, user_name: staff.full_name, source: 'manual' })
      .onConflict((conflict) => conflict.columns(['space_id', 'user_id']).doNothing())
      .execute();
    return this.space(currentUser, spaceId);
  }

  async removeTeacher(currentUser: CurrentUser, spaceId: string, userId: string) {
    const context = await this.context(currentUser);
    if (!context.canView) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Ban Giám hiệu, tổ trưởng bỏ được giáo viên');
    }
    const { database } = await this.currentSchoolYear.require();
    await this.access(context, database, spaceId);
    await database
      .deleteFrom('course_space_teachers')
      .where('space_id', '=', spaceId)
      .where('user_id', '=', userId)
      .where('source', '=', 'manual')
      .execute();
    return this.space(currentUser, spaceId);
  }

  // Học sinh của lớp học trực tuyến: lớp theo môn lấy danh sách lớp hiện tại; khoá tự chọn lấy ghi danh đang hiệu lực
  async students(database: YearExecutor, space: SpaceRow) {
    if (space.kind === 'class_subject') {
      return database
        .selectFrom('class_enrollments')
        .innerJoin('children', 'children.id', 'class_enrollments.child_id')
        .select(['children.id', 'children.full_name', 'class_enrollments.order_number'])
        .where('class_enrollments.class_id', '=', space.class_id ?? NO_ID)
        .where('class_enrollments.is_current', '=', true)
        .where('children.status', '=', 'active')
        .where('children.deleted_at', 'is', null)
        .orderBy(sql`class_enrollments.order_number nulls last`)
        .orderBy('children.full_name')
        .execute();
    }
    return database
      .selectFrom('course_enrollments')
      .innerJoin('children', 'children.id', 'course_enrollments.child_id')
      .select(['children.id', 'children.full_name', sql<number | null>`null`.as('order_number')])
      .where('course_enrollments.space_id', '=', space.id)
      .where('course_enrollments.status', '=', 'active')
      .orderBy('children.full_name')
      .execute();
  }

  async enroll(currentUser: CurrentUser, spaceId: string, childIds: string[]) {
    const { context, database, space } = await this.requireTeach(currentUser, spaceId);
    if (space.kind !== 'elective') {
      throw learningRule('Lớp học trực tuyến theo lớp lấy học sinh từ danh sách lớp, không ghi danh tay');
    }
    const unique = [...new Set(childIds)];
    const found = await database
      .selectFrom('children')
      .select('id')
      .where('id', 'in', unique.length > 0 ? unique : [NO_ID])
      .where('status', '=', 'active')
      .execute();
    if (found.length !== unique.length || unique.length === 0) {
      throw learningRule('Có học sinh không tồn tại hoặc đã nghỉ học');
    }
    if (space.capacity !== null) {
      const count = await database
        .selectFrom('course_enrollments')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('space_id', '=', spaceId)
        .where('status', '=', 'active')
        .where('child_id', 'not in', unique)
        .executeTakeFirstOrThrow();
      if (count.count + unique.length > space.capacity) {
        throw learningRule(`Khoá chỉ có ${space.capacity} chỗ`);
      }
    }
    const now = this.clock.now();
    await database
      .insertInto('course_enrollments')
      .values(
        unique.map((childId) => ({
          space_id: spaceId,
          child_id: childId,
          status: 'active' as const,
          decided_by: context.userId,
          decided_at: now,
        })),
      )
      .onConflict((conflict) =>
        conflict
          .columns(['space_id', 'child_id'])
          .doUpdateSet({ status: 'active', decided_by: context.userId, decided_at: now }),
      )
      .execute();
    return { enrolled: unique.length };
  }

  async unenroll(currentUser: CurrentUser, spaceId: string, childId: string) {
    const { context, database } = await this.requireTeach(currentUser, spaceId);
    await database
      .updateTable('course_enrollments')
      .set({ status: 'removed', decided_by: context.userId, decided_at: this.clock.now() })
      .where('space_id', '=', spaceId)
      .where('child_id', '=', childId)
      .execute();
    return { removed: true };
  }

  // Chi tiết lớp học trực tuyến: chương, hoạt động, giáo viên, có được dạy thay thế hôm nay không
  async space(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const { space, canTeach } = await this.access(context, database, spaceId);
    const [teachers, sections, activities, decisions, students, className, subjectName] = await Promise.all([
      database
        .selectFrom('course_space_teachers')
        .select(['user_id', 'user_name', 'source'])
        .where('space_id', '=', spaceId)
        .orderBy('user_name')
        .execute(),
      database.selectFrom('course_sections').selectAll().where('space_id', '=', spaceId).orderBy('position').execute(),
      database
        .selectFrom('course_activities')
        .selectAll()
        .where('space_id', '=', spaceId)
        .orderBy('position')
        .execute(),
      this.decisionSources(database),
      this.students(database, space),
      space.class_id
        ? database.selectFrom('classes').select('name').where('id', '=', space.class_id).executeTakeFirst()
        : Promise.resolve(undefined),
      space.subject_id
        ? database.selectFrom('subjects').select('name').where('id', '=', space.subject_id).executeTakeFirst()
        : Promise.resolve(undefined),
    ]);
    return {
      space: { ...space, class_name: className?.name ?? null, subject_name: subjectName?.name ?? null },
      can_teach: canTeach,
      replace_allowed_today: replaceAllowed(decisions, space.class_id, this.today()),
      teachers,
      student_count: students.length,
      sections,
      activities: activities.map((activity) => this.presentActivity(activity)),
    };
  }

  private presentActivity(activity: ActivityRow) {
    return {
      ...activity,
      weight: Number(activity.weight),
      pass_score: numberOrNull(activity.pass_score),
      kind_label: activityKind(activity.kind)?.label ?? activity.kind,
    };
  }

  // ---------- Chương ----------

  async createSection(currentUser: CurrentUser, spaceId: string, body: RequestBody) {
    const { database } = await this.requireTeach(currentUser, spaceId);
    const errors: FieldError[] = [];
    const title = readBoundedText(body, 'title', errors, { required: true, max: 300 });
    const plannedWeek = readOptionalWeek(body, 'planned_week', errors);
    throwIfErrors(errors);
    const last = await database
      .selectFrom('course_sections')
      .select(sql<number>`coalesce(max(position), 0)`.as('position'))
      .where('space_id', '=', spaceId)
      .executeTakeFirstOrThrow();
    return database
      .insertInto('course_sections')
      .values({
        space_id: spaceId,
        title: title ?? '',
        position: Number(last.position) + 1,
        planned_week: plannedWeek ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private async sectionOf(currentUser: CurrentUser, sectionId: string) {
    const { database } = await this.currentSchoolYear.require();
    const section = await database
      .selectFrom('course_sections')
      .selectAll()
      .where('id', '=', sectionId)
      .executeTakeFirst();
    if (!section) {
      throw notFoundError('Không tìm thấy chương', 'course_section');
    }
    const access = await this.requireTeach(currentUser, section.space_id);
    return { ...access, section };
  }

  async updateSection(currentUser: CurrentUser, sectionId: string, body: RequestBody) {
    const { database } = await this.sectionOf(currentUser, sectionId);
    const errors: FieldError[] = [];
    const title = readBoundedText(body, 'title', errors, { required: false, max: 300 });
    const plannedWeek = readOptionalWeek(body, 'planned_week', errors);
    const position = body?.position;
    if (position !== undefined && !(Number.isInteger(position) && (position as number) >= 1)) {
      errors.push({ field: 'position', message: 'Thứ tự là số nguyên từ 1' });
    }
    throwIfErrors(errors);
    return database
      .updateTable('course_sections')
      .set({
        ...(title ? { title } : {}),
        ...(plannedWeek !== undefined ? { planned_week: plannedWeek } : {}),
        ...(position !== undefined ? { position: position as number } : {}),
        updated_at: this.clock.now(),
      })
      .where('id', '=', sectionId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  // Xóa chương chỉ khi chưa có hoạt động nào đã có kết quả của học sinh
  async removeSection(currentUser: CurrentUser, sectionId: string) {
    const { database } = await this.sectionOf(currentUser, sectionId);
    const used = await database
      .selectFrom('activity_results')
      .innerJoin('course_activities', 'course_activities.id', 'activity_results.activity_id')
      .select('activity_results.id')
      .where('course_activities.section_id', '=', sectionId)
      .executeTakeFirst();
    if (used) {
      throw learningRule('Chương đã có kết quả của học sinh, không xóa được');
    }
    await database.deleteFrom('course_sections').where('id', '=', sectionId).execute();
    return { deleted: true };
  }

  // ---------- Hoạt động ----------

  // Kiểm phần cài đặt theo loại, học liệu đã công bố, tên miền liên kết, điều kiện mở trỏ vào hoạt động cùng lớp, dạy thay thế
  // có quyết định của Hiệu trưởng
  private async checkActivity(
    database: YearExecutor,
    space: SpaceRow,
    kindCode: string,
    input: ActivityInput,
    activityId: string | null,
  ): Promise<Record<string, unknown> | undefined> {
    const kind = activityKind(kindCode);
    if (!kind) {
      throw learningRule('Loại hoạt động chưa có trong danh mục');
    }
    const errors: FieldError[] = [];
    let settings: Record<string, unknown> | undefined;
    if (input.settings !== undefined || activityId === null) {
      settings = kind.parseSettings(input.settings, 'settings', errors);
    }
    if (input.completion_rule && !kind.completionRules.includes(input.completion_rule)) {
      errors.push({
        field: 'completion_rule',
        message: `Loại ${kind.label} chỉ tính hoàn thành theo: ${kind.completionRules.join(', ')}`,
      });
    }
    throwIfErrors(errors);
    if (settings && typeof settings.resource_id === 'string') {
      const resource = await this.system
        .selectFrom('learning_resources')
        .select(['id', 'status', 'published_version'])
        .where('id', '=', settings.resource_id)
        .executeTakeFirst();
      if (
        !resource ||
        resource.published_version === null ||
        resource.status === 'retired' ||
        resource.status === 'hidden'
      ) {
        throw learningRule(
          'Chỉ dùng học liệu đã qua tổ chuyên môn và Ban Giám hiệu duyệt, đang công bố ở kho học liệu',
          [{ field: 'settings.resource_id', message: 'Học liệu chưa công bố' }],
        );
      }
    }
    if (settings && typeof settings.host === 'string') {
      const allowed = await this.linkDomains();
      if (allowed !== null && !hostAllowed(settings.host, allowed)) {
        throw learningRule('Tên miền của liên kết không nằm trong danh sách trường cho phép', [
          { field: 'settings.url', message: 'Tên miền chưa được trường cho phép' },
        ]);
      }
    }
    if (input.open_rules) {
      const references = openRuleReferences(input.open_rules);
      if (activityId !== null && references.activityIds.includes(activityId)) {
        throw learningRule('Điều kiện mở không trỏ vào chính hoạt động này');
      }
      if (references.activityIds.length > 0) {
        const found = await database
          .selectFrom('course_activities')
          .select('id')
          .where('space_id', '=', space.id)
          .where('id', 'in', references.activityIds)
          .execute();
        if (found.length !== new Set(references.activityIds).size) {
          throw learningRule('Điều kiện mở chỉ trỏ vào hoạt động của cùng lớp học trực tuyến');
        }
      }
      if (references.sectionIds.length > 0) {
        const found = await database
          .selectFrom('course_sections')
          .select('id')
          .where('space_id', '=', space.id)
          .where('id', 'in', references.sectionIds)
          .execute();
        if (found.length !== new Set(references.sectionIds).size) {
          throw learningRule('Điều kiện mở chỉ trỏ vào chương của cùng lớp học trực tuyến');
        }
      }
    }
    if (input.teaching_mode === 'replace') {
      const decisions = await this.decisionSources(database);
      const date = input.opens_at ? vietnamDate(input.opens_at) : this.today();
      if (!replaceAllowed(decisions, space.class_id, date)) {
        throw learningRule(
          'Dạy học trực tuyến thay thế chỉ khi Hiệu trưởng đã quyết định cho lớp này vì lý do bất khả kháng (Thông tư 09/2021/TT-BGDĐT Điều 5 khoản 4)',
          [{ field: 'teaching_mode', message: 'Chưa có quyết định dạy học trực tuyến thay thế còn hiệu lực' }],
        );
      }
    }
    return settings;
  }

  async createActivity(currentUser: CurrentUser, spaceId: string, input: ActivityInput) {
    const { context, database, space } = await this.requireTeach(currentUser, spaceId);
    const section = await database
      .selectFrom('course_sections')
      .select('id')
      .where('id', '=', input.section_id ?? NO_ID)
      .where('space_id', '=', spaceId)
      .executeTakeFirst();
    if (!section) {
      throw learningRule('Chương không thuộc lớp học trực tuyến này');
    }
    const kind = activityKind(input.kind);
    const settings = await this.checkActivity(database, space, input.kind ?? '', input, null);
    const last = await database
      .selectFrom('course_activities')
      .select(sql<number>`coalesce(max(position), 0)`.as('position'))
      .where('section_id', '=', section.id)
      .executeTakeFirstOrThrow();
    const row = await database
      .insertInto('course_activities')
      .values({
        space_id: spaceId,
        section_id: section.id,
        kind: (input.kind ?? 'page') as ActivityRow['kind'],
        title: input.title ?? '',
        lesson_label: input.lesson_label ?? null,
        instructions: input.instructions ?? null,
        position: Number(last.position) + 1,
        required: input.required ?? true,
        teaching_mode: input.teaching_mode ?? 'support',
        estimated_minutes: input.estimated_minutes ?? null,
        opens_at: input.opens_at ?? null,
        due_at: input.due_at ?? null,
        closes_at: input.closes_at ?? null,
        open_rules: input.open_rules ? JSON.stringify(input.open_rules) : null,
        completion_rule: input.completion_rule ?? kind?.defaultCompletion ?? 'view',
        graded: input.graded ?? false,
        weight: input.weight ?? 1,
        pass_score: input.pass_score ?? null,
        planned_week: input.planned_week ?? null,
        settings: JSON.stringify(settings ?? {}),
        created_by: context.userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.presentActivity(row);
  }

  private async activityOf(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.currentSchoolYear.require();
    const activity = await database
      .selectFrom('course_activities')
      .selectAll()
      .where('id', '=', activityId)
      .executeTakeFirst();
    if (!activity) {
      throw notFoundError('Không tìm thấy hoạt động', 'course_activity');
    }
    const access = await this.requireTeach(currentUser, activity.space_id);
    return { ...access, activity };
  }

  async updateActivity(currentUser: CurrentUser, activityId: string, input: ActivityInput) {
    const { database, space, activity } = await this.activityOf(currentUser, activityId);
    if (input.section_id) {
      const section = await database
        .selectFrom('course_sections')
        .select('id')
        .where('id', '=', input.section_id)
        .where('space_id', '=', space.id)
        .executeTakeFirst();
      if (!section) {
        throw learningRule('Chương không thuộc lớp học trực tuyến này');
      }
    }
    const merged: ActivityInput = {
      ...input,
      teaching_mode: input.teaching_mode,
      opens_at: input.opens_at === undefined ? activity.opens_at : input.opens_at,
    };
    const settings = await this.checkActivity(database, space, activity.kind, merged, activityId);
    const changes: Record<string, unknown> = {
      edited_locally: activity.template_item_key !== null,
      updated_at: this.clock.now(),
    };
    for (const field of [
      'section_id',
      'title',
      'lesson_label',
      'instructions',
      'required',
      'teaching_mode',
      'estimated_minutes',
      'opens_at',
      'due_at',
      'closes_at',
      'completion_rule',
      'graded',
      'weight',
      'pass_score',
      'planned_week',
    ] as const) {
      if (input[field] !== undefined) {
        changes[field] = input[field];
      }
    }
    if (input.open_rules !== undefined) {
      changes.open_rules = input.open_rules ? JSON.stringify(input.open_rules) : null;
    }
    if (settings !== undefined) {
      changes.settings = JSON.stringify(settings);
    }
    const row = await database
      .updateTable('course_activities')
      .set(changes)
      .where('id', '=', activityId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.presentActivity(row);
  }

  async publishActivity(currentUser: CurrentUser, activityId: string, published: boolean) {
    const { context, database, activity } = await this.activityOf(currentUser, activityId);
    const row = await database
      .updateTable('course_activities')
      .set({ status: published ? 'published' : 'draft', updated_at: this.clock.now() })
      .where('id', '=', activityId)
      .returningAll()
      .executeTakeFirstOrThrow();
    if (published && activity.status !== 'published') {
      await this.recordEvent(database, {
        space_id: activity.space_id,
        activity_id: activityId,
        child_id: null,
        actor_user_id: context.userId,
        actor_kind: 'teacher',
        verb: 'published',
        result: null,
      });
    }
    return this.presentActivity(row);
  }

  async removeActivity(currentUser: CurrentUser, activityId: string) {
    const { database } = await this.activityOf(currentUser, activityId);
    const used = await database
      .selectFrom('activity_results')
      .select('id')
      .where('activity_id', '=', activityId)
      .executeTakeFirst();
    if (used) {
      throw learningRule('Hoạt động đã có kết quả của học sinh: chuyển về nháp thay vì xóa');
    }
    await database.deleteFrom('course_activities').where('id', '=', activityId).execute();
    return { deleted: true };
  }

  // Giáo viên mở riêng (học sinh hòa nhập, học bù) hoặc gia hạn cho một học sinh, có lý do
  async grantException(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { context, database, space, activity } = await this.activityOf(currentUser, activityId);
    const errors: FieldError[] = [];
    const childId = readOptionalUuid(body, 'child_id', errors);
    const reason = readBoundedText(body, 'reason', errors, { required: true, max: MAX_EXCEPTION_REASON });
    const dueAt = readOptionalTime(body, 'due_at', errors);
    if (!childId) {
      errors.push({ field: 'child_id', message: 'Chọn học sinh' });
    }
    throwIfErrors(errors);
    await this.assertStudent(database, space, childId ?? NO_ID);
    await database
      .insertInto('activity_exceptions')
      .values({
        activity_id: activityId,
        child_id: childId ?? NO_ID,
        unlocked: body?.unlocked !== false,
        due_at: dueAt ?? null,
        reason: reason ?? '',
        granted_by: context.userId,
        granted_by_name: context.name,
      })
      .onConflict((conflict) =>
        conflict.columns(['activity_id', 'child_id']).doUpdateSet({
          unlocked: body?.unlocked !== false,
          due_at: dueAt ?? null,
          reason: reason ?? '',
          granted_by: context.userId,
          granted_by_name: context.name,
        }),
      )
      .execute();
    await this.recordEvent(database, {
      space_id: activity.space_id,
      activity_id: activityId,
      child_id: childId ?? null,
      actor_user_id: context.userId,
      actor_kind: 'teacher',
      verb: 'unlocked',
      result: JSON.stringify({ reason }),
    });
    return { granted: true };
  }

  private async assertStudent(database: YearExecutor, space: SpaceRow, childId: string) {
    const students = await this.students(database, space);
    if (!students.some((student) => student.id === childId)) {
      throw learningRule('Học sinh không thuộc lớp học trực tuyến này');
    }
  }

  // Giáo viên ghi kết quả: đánh dấu hoàn thành (cách tính "giáo viên đánh dấu"), miễn, hoặc nhập điểm, mức của hoạt động
  async recordResult(currentUser: CurrentUser, activityId: string, body: RequestBody) {
    const { context, database, space, activity } = await this.activityOf(currentUser, activityId);
    const errors: FieldError[] = [];
    const childId = readOptionalUuid(body, 'child_id', errors);
    const status = body?.status as ResultStatus | undefined;
    if (!childId) {
      errors.push({ field: 'child_id', message: 'Chọn học sinh' });
    }
    if (!status || !['completed', 'passed', 'failed', 'excused', 'in_progress', 'not_started'].includes(status)) {
      errors.push({
        field: 'status',
        message: 'Trạng thái là completed, passed, failed, excused, in_progress hoặc not_started',
      });
    }
    const score = body?.score;
    if (score !== undefined && score !== null && (typeof score !== 'number' || score < 0 || score > 10)) {
      errors.push({ field: 'score', message: 'Điểm từ 0 đến 10' });
    }
    const level = body?.level;
    if (level !== undefined && level !== null && !['excellent', 'completed', 'not_completed'].includes(String(level))) {
      errors.push({ field: 'level', message: 'Mức là excellent, completed hoặc not_completed' });
    }
    throwIfErrors(errors);
    if (activity.status !== 'published') {
      throw learningRule('Hoạt động chưa giao cho học sinh');
    }
    await this.assertStudent(database, space, childId ?? NO_ID);
    const now = this.clock.now();
    const values = {
      status: status as ResultStatus,
      score: (score as number | null | undefined) ?? null,
      level: (level as 'excellent' | 'completed' | 'not_completed' | null | undefined) ?? null,
      source: 'teacher',
      completed_at: isDone(status) ? now : null,
      recorded_by: context.userId,
      updated_at: now,
    };
    const row = await database
      .insertInto('activity_results')
      .values({ activity_id: activityId, child_id: childId ?? NO_ID, ...values })
      .onConflict((conflict) => conflict.columns(['activity_id', 'child_id']).doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.recordEvent(database, {
      space_id: activity.space_id,
      activity_id: activityId,
      child_id: childId ?? null,
      actor_user_id: context.userId,
      actor_kind: 'teacher',
      verb: values.score !== null ? 'scored' : 'completed',
      result: JSON.stringify({ status, score: values.score, level: values.level }),
    });
    return { ...row, score: numberOrNull(row.score) };
  }

  // Học sinh (sau khi 23a gộp) hoặc giáo viên mở xem hoạt động xem được: ghi nhật ký, cách tính "xem xong" thì hoàn thành
  async recordView(
    database: YearExecutor,
    activity: ActivityRow,
    childId: string,
    actor: { userId: string; kind: 'student' | 'guardian' },
  ) {
    await this.recordEvent(database, {
      space_id: activity.space_id,
      activity_id: activity.id,
      child_id: childId,
      actor_user_id: actor.userId,
      actor_kind: actor.kind,
      verb: 'viewed',
      result: null,
    });
    if (actor.kind !== 'student' || activity.completion_rule !== 'view') {
      return;
    }
    const now = this.clock.now();
    await database
      .insertInto('activity_results')
      .values({
        activity_id: activity.id,
        child_id: childId,
        status: 'completed',
        progress: 100,
        source: activity.kind,
        completed_at: now,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['activity_id', 'child_id'])
          .doUpdateSet({ status: 'completed', progress: 100, completed_at: now, updated_at: now })
          .where('activity_results.status', 'not in', ['completed', 'passed', 'excused']),
      )
      .execute();
  }

  private async recordEvent(
    database: YearExecutor,
    event: {
      space_id: string;
      activity_id: string | null;
      child_id: string | null;
      actor_user_id: string;
      actor_kind: 'teacher' | 'student' | 'guardian' | 'staff';
      verb: SchoolYearDatabase['learning_events']['verb'];
      result: string | null;
    },
  ) {
    await database.insertInto('learning_events').values(event).execute();
  }

  // ---------- Tiến độ, kế hoạch, nhật ký ----------

  private async resultsFor(database: YearExecutor, activityIds: string[], childIds: string[]) {
    if (activityIds.length === 0 || childIds.length === 0) {
      return [];
    }
    return database
      .selectFrom('activity_results')
      .select(['activity_id', 'child_id', 'status', 'score', 'level', 'completed_at'])
      .where('activity_id', 'in', activityIds)
      .where('child_id', 'in', childIds)
      .execute();
  }

  async progress(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const { space } = await this.access(context, database, spaceId);
    const activities = await database
      .selectFrom('course_activities')
      .selectAll()
      .where('space_id', '=', spaceId)
      .where('status', '=', 'published')
      .orderBy('position')
      .execute();
    const students = await this.students(database, space);
    const results = await this.resultsFor(
      database,
      activities.map((activity) => activity.id),
      students.map((student) => student.id),
    );
    const now = this.clock.now();
    return {
      activities: activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        kind: activity.kind,
        required: activity.required,
        due_at: activity.due_at,
        graded: activity.graded,
      })),
      students: students.map((student) => {
        const own = new Map<string, ResultSnapshot>(
          results
            .filter((result) => result.child_id === student.id)
            .map((result) => [result.activity_id, { status: result.status, score: numberOrNull(result.score) }]),
        );
        return {
          child_id: student.id,
          full_name: student.full_name,
          summary: summarizeProgress(activities, own, now),
          results: Object.fromEntries([...own.entries()].map(([id, value]) => [id, value])),
        };
      }),
    };
  }

  async plan(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await this.access(context, database, spaceId);
    const [sections, activities] = await Promise.all([
      database.selectFrom('course_sections').selectAll().where('space_id', '=', spaceId).execute(),
      database.selectFrom('course_activities').selectAll().where('space_id', '=', spaceId).execute(),
    ]);
    return { weeks: weeklyPlan(sections, activities) };
  }

  async events(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    await this.access(context, database, spaceId);
    return database
      .selectFrom('learning_events')
      .leftJoin('children', 'children.id', 'learning_events.child_id')
      .leftJoin('course_activities', 'course_activities.id', 'learning_events.activity_id')
      .select([
        'learning_events.id',
        'learning_events.verb',
        'learning_events.actor_kind',
        'learning_events.occurred_at',
        'learning_events.result',
        'children.full_name as child_name',
        'course_activities.title as activity_title',
      ])
      .where('learning_events.space_id', '=', spaceId)
      .orderBy('learning_events.occurred_at', 'desc')
      .limit(200)
      .execute();
  }

  // ---------- Phía học sinh, phụ huynh ----------

  // Lớp học trực tuyến của một học sinh mà người gọi được xem: phụ huynh của học sinh (học sinh tự xem khi 23a gộp). Chỉ lớp
  // đã mở cho học sinh và hoạt động đã giao; mỗi hoạt động kèm trạng thái mở, khóa và kết quả của học sinh
  async childLearning(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertGuardianOrStaff(currentUser, database, childId);
    return this.learningOfChild(database, childId);
  }

  // Học sinh tự học (kênh student của 23a): tài khoản học nối đúng một học sinh đang học. Không đòi cấp học bật thi trực tuyến
  // như phía thi của 23a: công tắc đó chỉ cho thi
  private async studentOf(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const account = await database
      .selectFrom('student_learning_accounts')
      .innerJoin('children', 'children.id', 'student_learning_accounts.child_id')
      .select(['children.id', 'children.status', 'children.deleted_at'])
      .where('student_learning_accounts.identity_user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!account || account.status !== 'active' || account.deleted_at !== null) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Tài khoản chưa nối với học sinh đang học, nhờ nhà trường kiểm tra lại',
      );
    }
    return { database, childId: account.id };
  }

  async studentLearning(currentUser: CurrentUser) {
    const { database, childId } = await this.studentOf(currentUser);
    return this.learningOfChild(database, childId);
  }

  // Học sinh mở một hoạt động: chỉ hoạt động đã giao, đang mở với em; ghi nhật ký xem, "xem xong" thì hoàn thành; trả nội dung
  // để xem (trang, liên kết, tên học liệu)
  async studentOpenActivity(currentUser: CurrentUser, activityId: string) {
    const { database, childId } = await this.studentOf(currentUser);
    const learning = await this.learningOfChild(database, childId);
    const entry = learning.spaces
      .flatMap((space) => space.sections.flatMap((section) => section.activities))
      .find((activity) => activity.id === activityId);
    if (!entry) {
      throw notFoundError('Không tìm thấy hoạt động trong lớp học trực tuyến của em', 'course_activity');
    }
    if (!entry.open) {
      throw learningRule(['Hoạt động chưa mở với em', ...entry.locked_reasons].join('. '));
    }
    const activity = await database
      .selectFrom('course_activities')
      .selectAll()
      .where('id', '=', activityId)
      .executeTakeFirstOrThrow();
    await this.recordView(database, activity, childId, { userId: currentUser.id, kind: 'student' });
    const settings = (activity.settings ?? {}) as Record<string, unknown>;
    const resource =
      activity.kind === 'resource' && typeof settings.resource_id === 'string'
        ? await this.system
            .selectFrom('learning_resources')
            .select(['id', 'title', 'description'])
            .where('id', '=', settings.resource_id)
            .executeTakeFirst()
        : undefined;
    return {
      id: activity.id,
      kind: activity.kind,
      title: activity.title,
      instructions: activity.instructions,
      body: activity.kind === 'page' && typeof settings.body === 'string' ? settings.body : null,
      url: activity.kind === 'link' && typeof settings.url === 'string' ? settings.url : null,
      resource: resource ?? null,
    };
  }

  async studentAcknowledgeRule(currentUser: CurrentUser) {
    const { childId } = await this.studentOf(currentUser);
    return this.acknowledgeRule(currentUser, childId, 'student');
  }

  async learningOfChild(database: YearExecutor, childId: string) {
    const enrollment = await database
      .selectFrom('class_enrollments')
      .select('class_id')
      .where('child_id', '=', childId)
      .where('is_current', '=', true)
      .executeTakeFirst();
    const spaces = await database
      .selectFrom('course_spaces')
      .leftJoin('subjects', 'subjects.id', 'course_spaces.subject_id')
      .select([
        'course_spaces.id',
        'course_spaces.kind',
        'course_spaces.title',
        'course_spaces.description',
        'subjects.name as subject_name',
      ])
      .where('course_spaces.status', '=', 'active')
      .where('course_spaces.visible_to_students', '=', true)
      .where((expression) =>
        expression.or([
          expression('course_spaces.class_id', '=', enrollment?.class_id ?? NO_ID),
          expression.exists(
            expression
              .selectFrom('course_enrollments')
              .select('course_enrollments.child_id')
              .whereRef('course_enrollments.space_id', '=', 'course_spaces.id')
              .where('course_enrollments.child_id', '=', childId)
              .where('course_enrollments.status', '=', 'active'),
          ),
        ]),
      )
      .orderBy('course_spaces.title')
      .execute();
    if (spaces.length === 0) {
      return { spaces: [], rules: await this.currentRuleFor(database, childId) };
    }
    const spaceIds = spaces.map((space) => space.id);
    const [sections, activities, exceptions, groups] = await Promise.all([
      database
        .selectFrom('course_sections')
        .selectAll()
        .where('space_id', 'in', spaceIds)
        .orderBy('position')
        .execute(),
      database
        .selectFrom('course_activities')
        .selectAll()
        .where('space_id', 'in', spaceIds)
        .where('status', '=', 'published')
        .orderBy('position')
        .execute(),
      database.selectFrom('activity_exceptions').selectAll().where('child_id', '=', childId).execute(),
      this.groupSets.groupsOfChild(database, childId),
    ]);
    const results = await this.resultsFor(
      database,
      activities.map((activity) => activity.id),
      [childId],
    );
    const resultMap = new Map<string, ResultSnapshot>(
      results.map((result) => [result.activity_id, { status: result.status, score: numberOrNull(result.score) }]),
    );
    const exceptionMap = new Map(exceptions.map((exception) => [exception.activity_id, exception]));
    const now = this.clock.now();
    const groupIds = new Set(groups.map((row) => row.group_id));
    return {
      rules: await this.currentRuleFor(database, childId),
      spaces: spaces.map((space) => {
        const ownSections = sections.filter((section) => section.space_id === space.id);
        const ownActivities = activities.filter((activity) => activity.space_id === space.id);
        const context = {
          now,
          results: resultMap,
          activityTitles: new Map(ownActivities.map((activity) => [activity.id, activity.title])),
          sectionDone: (sectionId: string) => sectionDone(sectionId, ownActivities, resultMap),
          sectionTitles: new Map(ownSections.map((section) => [section.id, section.title])),
          groupIds,
        };
        return {
          ...space,
          summary: summarizeProgress(ownActivities, resultMap, now),
          sections: ownSections.map((section) => ({
            id: section.id,
            title: section.title,
            activities: ownActivities
              .filter((activity) => activity.section_id === section.id)
              .map((activity) => {
                const exception = exceptionMap.get(activity.id);
                const evaluation = exception?.unlocked
                  ? { open: true, reasons: [] }
                  : evaluateOpenRules(activity.open_rules as OpenRules | null, context);
                const opensLater = activity.opens_at !== null && activity.opens_at > now && !exception?.unlocked;
                const result = resultMap.get(activity.id);
                return {
                  id: activity.id,
                  kind: activity.kind,
                  kind_label: activityKind(activity.kind)?.label ?? activity.kind,
                  title: activity.title,
                  lesson_label: activity.lesson_label,
                  instructions: evaluation.open && !opensLater ? activity.instructions : null,
                  required: activity.required,
                  opens_at: activity.opens_at,
                  due_at: exception?.due_at ?? activity.due_at,
                  open: evaluation.open && !opensLater,
                  locked_reasons: opensLater ? [`Mở từ ${activity.opens_at?.toISOString()}`] : evaluation.reasons,
                  status: result?.status ?? 'not_started',
                  score: result?.score ?? null,
                };
              }),
          })),
        };
      }),
    };
  }

  private async assertGuardianOrStaff(currentUser: CurrentUser, database: YearExecutor, childId: string) {
    const guardian = await database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .select('guardians.id')
      .where('child_guardians.child_id', '=', childId)
      .where('guardians.user_id', '=', currentUser.id)
      .executeTakeFirst();
    if (!guardian && !currentUser.hasPermission(PERMISSION_CODES.learningView)) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ phụ huynh của học sinh xem được việc học trực tuyến của học sinh',
      );
    }
    return Boolean(guardian);
  }

  // ---------- Nội quy dạy học trực tuyến (Thông tư 09/2021 Điều 15 khoản 3) ----------

  async currentRule(database: YearExecutor) {
    return database
      .selectFrom('online_learning_rules')
      .selectAll()
      .orderBy('version', 'desc')
      .limit(1)
      .executeTakeFirst();
  }

  private async currentRuleFor(database: YearExecutor, childId: string) {
    const rule = await this.currentRule(database);
    if (!rule) {
      return null;
    }
    const ack = await database
      .selectFrom('online_learning_rule_acks')
      .select(['acknowledged_at', 'acknowledged_as'])
      .where('rule_id', '=', rule.id)
      .where('child_id', '=', childId)
      .executeTakeFirst();
    return { id: rule.id, version: rule.version, content: rule.content, acknowledged_at: ack?.acknowledged_at ?? null };
  }

  async rules() {
    const { database } = await this.currentSchoolYear.require();
    const current = await this.currentRule(database);
    const count = current
      ? await database
          .selectFrom('online_learning_rule_acks')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('rule_id', '=', current.id)
          .executeTakeFirstOrThrow()
      : { count: 0 };
    return { current: current ?? null, acknowledged: count.count };
  }

  async publishRule(currentUser: CurrentUser, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    if (!context.canDecide) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Hiệu trưởng ban hành nội quy dạy học trực tuyến');
    }
    const errors: FieldError[] = [];
    const content = readBoundedText(body, 'content', errors, { required: true, max: 20000 });
    throwIfErrors(errors);
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const current = await this.currentRule(transaction);
      const row = await transaction
        .insertInto('online_learning_rules')
        .values({
          version: (current?.version ?? 0) + 1,
          content: content ?? '',
          published_by: context.userId,
          published_by_name: context.name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'online_learning_rules',
        entityId: row.id,
        action: 'create',
        before: current ? { version: current.version } : null,
        after: { version: row.version },
      });
      return row;
    });
  }

  // Phụ huynh xác nhận đã đọc nội quy thay cho học sinh chưa có tài khoản (học sinh tự xác nhận khi 23a gộp)
  async acknowledgeRule(currentUser: CurrentUser, childId: string, as: 'student' | 'guardian') {
    const { database } = await this.currentSchoolYear.require();
    if (as === 'guardian') {
      const isGuardian = await this.assertGuardianOrStaff(currentUser, database, childId);
      if (!isGuardian) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ phụ huynh của học sinh xác nhận thay được');
      }
    }
    const rule = await this.currentRule(database);
    if (!rule) {
      throw learningRule('Trường chưa ban hành nội quy dạy học trực tuyến');
    }
    await database
      .insertInto('online_learning_rule_acks')
      .values({ rule_id: rule.id, child_id: childId, acknowledged_by: currentUser.id, acknowledged_as: as })
      .onConflict((conflict) => conflict.columns(['rule_id', 'child_id']).doNothing())
      .execute();
    return { acknowledged: true, version: rule.version };
  }

  // ---------- Quyết định hình thức dạy học trực tuyến (Thông tư 09/2021 Điều 5 khoản 4) ----------

  private async decisionSources(database: YearExecutor): Promise<DecisionSource[]> {
    const rows = await database
      .selectFrom('online_teaching_decisions')
      .select(['status', 'class_ids', 'starts_on', 'ends_on'])
      .where('status', '=', 'active')
      .execute();
    return rows.map((row) => ({ ...row, class_ids: asStringArray(row.class_ids) }));
  }

  async decisions() {
    const { database } = await this.currentSchoolYear.require();
    const rows = await database
      .selectFrom('online_teaching_decisions')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row) => ({ ...row, class_ids: asStringArray(row.class_ids) }));
  }

  async createDecision(currentUser: CurrentUser, body: RequestBody, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    if (!context.canDecide) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Hiệu trưởng quyết định hình thức dạy học trực tuyến thay thế');
    }
    const errors: FieldError[] = [];
    const decisionNo = readBoundedText(body, 'decision_no', errors, { required: true, max: 100 });
    const reason = readBoundedText(body, 'reason', errors, { required: true, max: 1000 });
    const dates: Record<string, string> = {};
    for (const field of ['decision_date', 'starts_on', 'ends_on']) {
      const value = body?.[field];
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      ) {
        errors.push({ field, message: 'Ngày theo dạng YYYY-MM-DD' });
      } else {
        dates[field] = value;
      }
    }
    const classIds = Array.isArray(body?.class_ids) ? body.class_ids : [];
    if (!classIds.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) {
      errors.push({ field: 'class_ids', message: 'Danh sách lớp không hợp lệ' });
    }
    if (dates.starts_on && dates.ends_on && dates.starts_on > dates.ends_on) {
      errors.push({ field: 'ends_on', message: 'Ngày kết thúc không trước ngày bắt đầu' });
    }
    throwIfErrors(errors);
    const { database } = await this.currentSchoolYear.require();
    if (classIds.length > 0) {
      const found = await database
        .selectFrom('classes')
        .select('id')
        .where('id', 'in', classIds as string[])
        .execute();
      if (found.length !== new Set(classIds).size) {
        throw learningRule('Có lớp không tồn tại trong năm học');
      }
    }
    return database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('online_teaching_decisions')
        .values({
          decision_no: decisionNo ?? '',
          decision_date: dates.decision_date ?? '',
          reason: reason ?? '',
          class_ids: JSON.stringify([...new Set(classIds as string[])]),
          starts_on: dates.starts_on ?? '',
          ends_on: dates.ends_on ?? '',
          created_by: context.userId,
          created_by_name: context.name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'online_teaching_decisions',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { decision_no: row.decision_no, starts_on: row.starts_on, ends_on: row.ends_on, class_ids: classIds },
      });
      return { ...row, class_ids: asStringArray(row.class_ids) };
    });
  }

  async revokeDecision(currentUser: CurrentUser, decisionId: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    if (!context.canDecide) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Hiệu trưởng thu hồi quyết định');
    }
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('online_teaching_decisions')
        .set({ status: 'revoked', revoked_by: context.userId, revoked_at: this.clock.now() })
        .where('id', '=', decisionId)
        .where('status', '=', 'active')
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy quyết định đang hiệu lực', 'online_teaching_decision');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'online_teaching_decisions',
        entityId: row.id,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'revoked' },
      });
      return { ...row, class_ids: asStringArray(row.class_ids) };
    });
  }

  // ---------- Khoá học mẫu của tổ chuyên môn ----------

  // Người duyệt của bước đang chờ, giống 22h1: bước tổ là tổ trưởng cùng tổ (hoặc Ban Giám hiệu khi người soạn không thuộc
  // tổ), bước trường là Ban Giám hiệu; không ai duyệt khoá của chính mình
  private reviewsStep(context: LearningContext, row: TemplateRow): boolean {
    if (row.owner_user_id === context.userId) {
      return false;
    }
    if (row.status === 'pending_unit') {
      return (
        (context.canReviewUnit && row.department_id !== null && row.department_id === context.departmentId) ||
        context.canApprove
      );
    }
    return row.status === 'pending_school' && context.canApprove;
  }

  private canSeeTemplate(context: LearningContext, row: TemplateRow): boolean {
    return (
      row.owner_user_id === context.userId ||
      context.canApprove ||
      this.reviewsStep(context, row) ||
      (row.published_version !== null && row.status !== 'retired' && (context.canTeach || context.canView))
    );
  }

  private presentTemplate(context: LearningContext, row: TemplateRow) {
    const isOwner = row.owner_user_id === context.userId;
    return {
      ...row,
      content: isOwner || context.canApprove || this.reviewsStep(context, row) ? row.content : row.published_content,
      can_edit: isOwner && ['draft', 'returned', 'published'].includes(row.status),
      can_review: this.reviewsStep(context, row),
    };
  }

  async templates(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const rows = await this.system.selectFrom('course_templates').selectAll().orderBy('updated_at', 'desc').execute();
    return rows.filter((row) => this.canSeeTemplate(context, row)).map((row) => this.presentTemplate(context, row));
  }

  private async templateFor(context: LearningContext, templateId: string): Promise<TemplateRow> {
    const row = await this.system
      .selectFrom('course_templates')
      .selectAll()
      .where('id', '=', templateId)
      .executeTakeFirst();
    if (!row || !this.canSeeTemplate(context, row)) {
      throw notFoundError('Không tìm thấy khoá học mẫu', 'course_template');
    }
    return row;
  }

  async template(currentUser: CurrentUser, templateId: string) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    const reviews = await this.system
      .selectFrom('course_template_reviews')
      .selectAll()
      .where('template_id', '=', templateId)
      .orderBy('created_at')
      .execute();
    return { ...this.presentTemplate(context, row), reviews };
  }

  async createTemplate(currentUser: CurrentUser, body: RequestBody) {
    const context = await this.context(currentUser);
    if (!context.canTemplate) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền soạn khoá học mẫu');
    }
    const errors: FieldError[] = [];
    const title = readBoundedText(body, 'title', errors, { required: true, max: 300 });
    const description = readBoundedText(body, 'description', errors, { required: false, max: 2000 });
    const level = body?.school_level;
    if (level !== 'TH' && level !== 'THCS' && level !== 'THPT') {
      errors.push({ field: 'school_level', message: 'Cấp học là TH, THCS hoặc THPT' });
    }
    const subjectId = readOptionalUuid(body, 'subject_id', errors);
    const content = body?.content === undefined ? emptyTemplateContent() : parseTemplateContent(body.content, errors);
    throwIfErrors(errors);
    const { database } = await this.currentSchoolYear.require();
    const subject = subjectId
      ? await database.selectFrom('subjects').select(['code', 'name']).where('id', '=', subjectId).executeTakeFirst()
      : undefined;
    if (subjectId && !subject) {
      throw learningRule('Không tìm thấy môn học');
    }
    const row = await this.system
      .insertInto('course_templates')
      .values({
        title: title ?? '',
        description: description ?? null,
        school_level: level as 'TH' | 'THCS' | 'THPT',
        grade_level_code: typeof body?.grade_level_code === 'string' ? body.grade_level_code : null,
        subject_code: subject?.code ?? null,
        subject_name: subject?.name ?? null,
        department_id: context.departmentId,
        department_name: context.departmentName,
        owner_user_id: context.userId,
        owner_name: context.name,
        content: JSON.stringify(content),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.presentTemplate(context, row);
  }

  async saveTemplate(currentUser: CurrentUser, templateId: string, body: RequestBody) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    if (row.owner_user_id !== context.userId || !['draft', 'returned', 'published'].includes(row.status)) {
      throw learningRule('Chỉ người soạn sửa được khoá mẫu khi đang nháp, bị trả lại hoặc đã duyệt');
    }
    const errors: FieldError[] = [];
    const title = readBoundedText(body, 'title', errors, { required: false, max: 300 });
    const description = readBoundedText(body, 'description', errors, { required: false, max: 2000 });
    const content = body?.content === undefined ? undefined : parseTemplateContent(body.content, errors);
    throwIfErrors(errors);
    const next = await this.system
      .updateTable('course_templates')
      .set({
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(content ? { content: JSON.stringify(content) } : {}),
        // Sửa khoá đã duyệt là soạn phiên bản mới; bản đã duyệt vẫn dùng đến khi bản mới được duyệt
        ...(row.status === 'published' ? { status: 'draft' as const, version: row.version + 1 } : {}),
        updated_at: this.clock.now(),
      })
      .where('id', '=', templateId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.presentTemplate(context, next);
  }

  async submitTemplate(currentUser: CurrentUser, templateId: string) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    if (row.owner_user_id !== context.userId || !['draft', 'returned'].includes(row.status)) {
      throw learningRule('Chỉ gửi duyệt khoá mẫu đang nháp hoặc bị trả lại của mình');
    }
    const content = row.content as TemplateContent;
    if (!content?.sections?.some((section) => section.items.length > 0)) {
      throw learningRule('Khoá mẫu cần ít nhất một chương có hoạt động trước khi gửi duyệt');
    }
    return this.moveTemplate(context, row, 'pending_unit', 'submit', null, {
      department_id: context.departmentId,
      department_name: context.departmentName,
    });
  }

  async reviewTemplate(currentUser: CurrentUser, templateId: string, body: RequestBody) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    if (!this.reviewsStep(context, row)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không phải người duyệt của bước này');
    }
    const errors: FieldError[] = [];
    const decision = body?.decision;
    const note = readBoundedText(body, 'note', errors, { required: decision === 'return', max: 1000 });
    if (decision !== 'approve' && decision !== 'return') {
      errors.push({ field: 'decision', message: 'Quyết định là approve hoặc return' });
    }
    throwIfErrors(errors);
    if (decision === 'return') {
      return this.moveTemplate(context, row, 'returned', 'return', note ?? null, { return_reason: note ?? null });
    }
    if (row.status === 'pending_unit') {
      return this.moveTemplate(context, row, 'pending_school', 'approve_unit', note ?? null, {});
    }
    return this.moveTemplate(context, row, 'published', 'approve_school', note ?? null, {
      published_content: JSON.stringify(row.content),
      published_version: row.version,
      published_at: this.clock.now(),
      return_reason: null,
    });
  }

  async retireTemplate(currentUser: CurrentUser, templateId: string) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    if (row.owner_user_id !== context.userId && !context.canApprove) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người soạn hoặc Ban Giám hiệu ngừng dùng khoá mẫu');
    }
    return this.moveTemplate(context, row, 'retired', 'retire', null, {});
  }

  private async moveTemplate(
    context: LearningContext,
    row: TemplateRow,
    status: TemplateRow['status'],
    action: SystemDatabase['course_template_reviews']['action'],
    note: string | null,
    extra: Record<string, unknown>,
  ) {
    const next = await this.system.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('course_templates')
        .set({ ...extra, status, updated_at: this.clock.now() })
        .where('id', '=', row.id)
        .where('status', '=', row.status)
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw learningRule('Khoá mẫu vừa đổi trạng thái, hãy tải lại');
      }
      await transaction
        .insertInto('course_template_reviews')
        .values({
          template_id: row.id,
          version: row.version,
          action,
          actor_user_id: context.userId,
          actor_name: context.name,
          note,
        })
        .execute();
      return updated;
    });
    return this.presentTemplate(context, next);
  }

  // Đẩy bản đã duyệt của khoá mẫu xuống các lớp học trực tuyến người gọi được dạy; lớp đã có nội dung của mẫu thì nhận cập nhật
  // (hoạt động giáo viên đã sửa giữ nguyên). Chỉ thêm và cập nhật, không xóa
  async applyTemplate(currentUser: CurrentUser, templateId: string, spaceIds: string[]) {
    const context = await this.context(currentUser);
    const row = await this.templateFor(context, templateId);
    if (row.published_version === null || row.status === 'retired') {
      throw learningRule('Chỉ đẩy khoá mẫu đã được Ban Giám hiệu phê duyệt');
    }
    const content = row.published_content as TemplateContent;
    const { database } = await this.currentSchoolYear.require();
    const results: Array<{ space_id: string; created: number; updated: number; kept_local: number }> = [];
    for (const spaceId of [...new Set(spaceIds)]) {
      const { space, canTeach } = await this.access(context, database, spaceId);
      if (!canTeach) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ đẩy khoá mẫu vào lớp mình dạy hoặc quản lý');
      }
      if (space.school_level !== row.school_level) {
        throw learningRule('Khoá mẫu và lớp học trực tuyến khác cấp học');
      }
      results.push(await this.applyToSpace(database, space, row, content));
    }
    return { template_version: row.published_version, spaces: results };
  }

  private async applyToSpace(
    database: Kysely<SchoolYearDatabase>,
    space: SpaceRow,
    template: TemplateRow,
    content: TemplateContent,
  ) {
    return database.transaction().execute(async (transaction) => {
      const sections = await transaction
        .selectFrom('course_sections')
        .select(['id', 'template_section_key', 'position'])
        .where('space_id', '=', space.id)
        .execute();
      const activities = await transaction
        .selectFrom('course_activities')
        .select(['id', 'template_item_key', 'edited_locally'])
        .where('space_id', '=', space.id)
        .execute();
      const plan = planTemplateApply(content, sections, activities);
      const sectionIdByKey = new Map(
        sections
          .filter((section) => section.template_section_key)
          .map((section) => [section.template_section_key as string, section.id]),
      );
      let position = sections.reduce((max, section) => Math.max(max, section.position), 0);
      for (const section of plan.createSections) {
        position += 1;
        const inserted = await transaction
          .insertInto('course_sections')
          .values({
            space_id: space.id,
            title: section.title,
            position,
            planned_week: section.planned_week,
            template_section_key: section.key,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        sectionIdByKey.set(section.key, inserted.id);
      }
      const values = (item: TemplateItem) => ({
        title: item.title,
        lesson_label: item.lesson_label,
        instructions: item.instructions,
        required: item.required,
        estimated_minutes: item.estimated_minutes,
        completion_rule: item.completion_rule,
        graded: item.graded,
        weight: item.weight,
        planned_week: item.planned_week,
        settings: JSON.stringify(item.settings),
      });
      for (const { sectionKey, item, position: itemPosition } of plan.createItems) {
        await transaction
          .insertInto('course_activities')
          .values({
            space_id: space.id,
            section_id: sectionIdByKey.get(sectionKey) ?? NO_ID,
            kind: item.kind as ActivityRow['kind'],
            position: itemPosition + 1,
            template_item_key: item.key,
            // Hình thức thay thế của mẫu chỉ áp khi lớp có quyết định; mặc định đẩy xuống là hỗ trợ
            teaching_mode: 'support',
            ...values(item),
          })
          .execute();
      }
      for (const { activityId, item } of plan.updateItems) {
        await transaction
          .updateTable('course_activities')
          .set({ ...values(item), updated_at: this.clock.now() })
          .where('id', '=', activityId)
          .execute();
      }
      await transaction
        .updateTable('course_spaces')
        .set({
          source_template_id: template.id,
          source_template_version: template.published_version,
          updated_at: this.clock.now(),
        })
        .where('id', '=', space.id)
        .execute();
      return {
        space_id: space.id,
        created: plan.createItems.length,
        updated: plan.updateItems.length,
        kept_local: plan.keptLocal,
      };
    });
  }
  // ---------- Cửa cho các phần sau của DT-28 (28c bài tập; 28d, 28e dùng cùng cửa) ----------
  // Phần sau không tự quyết ai dạy, ai học, ai xem lớp học trực tuyến mà gọi các hàm dưới đây, nên quy tắc quyền chỉ ở một chỗ.
  // Đổi chữ ký các hàm này phải qua YCTD vì phần khác đang dựa vào

  // Giáo viên dạy được hoạt động (soạn, chấm): như khi sửa hoạt động của lõi
  async teacherActivity(currentUser: CurrentUser, activityId: string) {
    return this.activityOf(currentUser, activityId);
  }

  // Người xem được lớp học trực tuyến (giáo viên của lớp, Ban Giám hiệu, tổ trưởng của môn) và có dạy được không (28d)
  async spaceAccess(currentUser: CurrentUser, spaceId: string) {
    const context = await this.context(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const { space, canTeach } = await this.access(context, database, spaceId);
    return { context, database, space, canTeach };
  }

  // Học sinh của kênh student: tài khoản học nối đúng một học sinh đang học
  async studentContext(currentUser: CurrentUser) {
    return this.studentOf(currentUser);
  }

  // Hoạt động đã giao, đang mở với học sinh (cùng cách tính với danh sách học của em); không có hoặc chưa mở thì báo lỗi
  async openActivityForChild(database: YearExecutor, childId: string, activityId: string) {
    const learning = await this.learningOfChild(database, childId);
    const entry = learning.spaces
      .flatMap((space) => space.sections.flatMap((section) => section.activities))
      .find((activity) => activity.id === activityId);
    if (!entry) {
      throw notFoundError('Không tìm thấy hoạt động trong lớp học trực tuyến của em', 'course_activity');
    }
    if (!entry.open) {
      throw learningRule(['Hoạt động chưa mở với em', ...entry.locked_reasons].join('. '));
    }
    return database.selectFrom('course_activities').selectAll().where('id', '=', activityId).executeTakeFirstOrThrow();
  }

  // Phụ huynh của học sinh (trả true) hoặc cán bộ có quyền xem lớp học trực tuyến (trả false); người khác bị chặn
  async guardianOrStaff(currentUser: CurrentUser, database: YearExecutor, childId: string) {
    return this.assertGuardianOrStaff(currentUser, database, childId);
  }

  // Ghi kết quả hoạt động của một học sinh và nhật ký học tập; nguồn là loại hoạt động
  async writeResult(
    database: YearExecutor,
    activity: ActivityRow,
    childId: string,
    result: {
      status: ResultStatus;
      score?: number | null;
      level?: ActivityResultLevel | null;
      progress?: number | null;
    },
    actor: {
      userId: string;
      kind: 'teacher' | 'student' | 'guardian';
      verb: SchoolYearDatabase['learning_events']['verb'];
    },
  ) {
    const now = this.clock.now();
    const values = {
      status: result.status,
      score: result.score ?? null,
      level: result.level ?? null,
      progress: result.progress ?? null,
      source: activity.kind,
      completed_at: isDone(result.status) ? now : null,
      recorded_by: actor.kind === 'teacher' ? actor.userId : null,
      updated_at: now,
    };
    await database
      .insertInto('activity_results')
      .values({ activity_id: activity.id, child_id: childId, ...values })
      .onConflict((conflict) => conflict.columns(['activity_id', 'child_id']).doUpdateSet(values))
      .execute();
    await this.recordEvent(database, {
      space_id: activity.space_id,
      activity_id: activity.id,
      child_id: childId,
      actor_user_id: actor.userId,
      actor_kind: actor.kind,
      verb: actor.verb,
      result: JSON.stringify({ status: values.status, score: values.score, level: values.level }),
    });
  }
}
