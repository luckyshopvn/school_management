import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { CatalogStatus, SchoolYearDatabase } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import {
  DEFAULT_CURRICULUM_CODES,
  PERMISSION_CODES,
  SUBJECT_TEMPLATES,
  type SchoolLevelCode,
  type SubjectAssessment,
  type SubjectKind,
} from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { assertLevelEnabled, readSchoolLevel } from '../catalogs/school-level-fields.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readRequiredText,
  readStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { uuidParameter } from '../common/uuid-parameter.js';

// Nền Tiểu học (DT-20 phần 20a, YCTD-158): môn học và hoạt động giáo dục theo cấp, số tiết theo khối trong chương trình
// (`curricula` của 19b), phân công giảng dạy theo môn, môn tự chọn của học sinh. Danh mục trống, trường nạp bộ mẫu theo
// Chương trình giáo dục phổ thông 2018 rồi sửa. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mã, cấp của môn
// không đổi sau khi tạo; số tiết là bội của 0,5 từ 0,5 đến 40; khối phải cùng cấp với chương trình (và thuộc khối áp dụng
// của chương trình nếu chương trình giới hạn khối); môn đang dùng trong chương trình hoặc phân công vẫn ngừng được (ẩn khỏi
// lựa chọn mới, dữ liệu cũ giữ)
export const SUBJECT_RULE_CODE = 'YCTD-158';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export interface Subject {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  kind: SubjectKind;
  assessment: SubjectAssessment;
  order_no: number;
  status: CatalogStatus;
}

export interface SubjectInput {
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  kind: SubjectKind;
  assessment: SubjectAssessment;
  order_no: number;
}

export interface CurriculumSubjectInput {
  subject_id: string;
  grade_level_code: string;
  periods_per_week: number;
  is_elective: boolean;
}

export interface CurriculumSubjectRow extends CurriculumSubjectInput {
  subject_code: string;
  subject_name: string;
  kind: SubjectKind;
}

const COLUMNS = ['id', 'code', 'name', 'school_level', 'kind', 'assessment', 'order_no', 'status'] as const;
const KINDS: SubjectKind[] = ['subject', 'activity'];
const ASSESSMENTS: SubjectAssessment[] = ['comment', 'comment_and_score'];

export function readPeriods(value: unknown, field: string, errors: FieldError[]): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 40 || (value * 2) % 1 !== 0) {
    errors.push({ field, message: 'Số tiết mỗi tuần là bội của 0,5 từ 0,5 đến 40' });
    return undefined;
  }
  return value;
}

function readChoice<Value extends string>(
  body: RequestBody,
  field: string,
  choices: readonly Value[],
  errors: FieldError[],
): Value | undefined {
  const value = body?.[field];
  if (value === undefined) {
    return undefined;
  }
  if (!choices.includes(value as Value)) {
    errors.push({ field, message: `Giá trị là ${choices.join(' hoặc ')}` });
    return undefined;
  }
  return value as Value;
}

export function parseSubjectInput(body: RequestBody): SubjectInput {
  const errors: FieldError[] = [];
  const level = readSchoolLevel(body, 'school_level', errors);
  if (!level && body?.school_level === undefined) {
    errors.push({ field: 'school_level', message: 'Bắt buộc chọn cấp học' });
  }
  const input: SubjectInput = {
    code: readRequiredText(body, 'code', errors),
    name: readRequiredText(body, 'name', errors),
    school_level: level ?? 'TH',
    kind: readChoice(body, 'kind', KINDS, errors) ?? 'subject',
    assessment: readChoice(body, 'assessment', ASSESSMENTS, errors) ?? 'comment',
    order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }) ?? 0,
  };
  if (input.code.length > 30) {
    errors.push({ field: 'code', message: 'Mã môn tối đa 30 ký tự' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

export function parseCurriculumSubjects(body: RequestBody): CurriculumSubjectInput[] {
  const raw = body?.subjects;
  if (!Array.isArray(raw)) {
    throw validationError([{ field: 'subjects', message: 'Cần danh sách môn theo khối' }]);
  }
  const errors: FieldError[] = [];
  const seen = new Set<string>();
  const items = raw.map((value, index) => {
    const prefix = `subjects[${index}]`;
    const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
    const subjectId = isUuid(item.subject_id) ? item.subject_id : '';
    if (!subjectId) {
      errors.push({ field: `${prefix}.subject_id`, message: 'Mã môn không hợp lệ' });
    }
    const grade = typeof item.grade_level_code === 'string' ? item.grade_level_code.trim() : '';
    if (!grade) {
      errors.push({ field: `${prefix}.grade_level_code`, message: 'Bắt buộc chọn khối' });
    }
    const key = `${subjectId}:${grade}`;
    if (seen.has(key)) {
      errors.push({ field: `${prefix}.grade_level_code`, message: 'Môn đã có ở khối này' });
    }
    seen.add(key);
    return {
      subject_id: subjectId,
      grade_level_code: grade,
      periods_per_week: readPeriods(item.periods_per_week, `${prefix}.periods_per_week`, errors) ?? 0,
      is_elective: item.is_elective === true,
    };
  });
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return items;
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  async list(level?: SchoolLevelCode): Promise<Subject[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    let query = current.database.selectFrom('subjects').select(COLUMNS);
    if (level) {
      query = query.where('school_level', '=', level);
    }
    return query.orderBy('school_level').orderBy('order_no').orderBy('code').execute();
  }

  async create(input: SubjectInput, origin: ChangeOrigin): Promise<Subject> {
    await assertLevelEnabled(this.schoolLevels, input.school_level);
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('subjects')
          .values({ ...input, created_by: origin.actorUserId })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        await audit(transaction, origin, 'subjects', created.id, 'create', null, created);
        return created;
      }),
      'Mã môn đã tồn tại',
      'code',
    );
  }

  async update(
    subjectId: string,
    changes: Partial<Pick<Subject, 'name' | 'kind' | 'assessment' | 'order_no' | 'status'>>,
    origin: ChangeOrigin,
  ): Promise<Subject> {
    const { database } = await this.currentSchoolYear.require();
    const existing = await database
      .selectFrom('subjects')
      .select(COLUMNS)
      .where('id', '=', subjectId)
      .executeTakeFirst();
    if (!existing) {
      throw notFoundError('Không tìm thấy môn học', 'subject');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('subjects')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', subjectId)
        .returning(COLUMNS)
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'subjects', subjectId, 'update', existing, updated);
      return updated;
    });
  }

  // Nạp bộ môn mẫu của cấp: thêm môn chưa có mã; cấp chưa có chương trình mặc định thì tạo; điền số tiết của chương trình
  // mặc định cho các khối mẫu đang có trong danh mục khối (dòng đã có giữ nguyên)
  async loadTemplate(level: SchoolLevelCode, origin: ChangeOrigin) {
    const templates = SUBJECT_TEMPLATES[level];
    if (templates.length === 0) {
      throw ruleViolationError(SUBJECT_RULE_CODE, 'Cấp này chưa có bộ môn mẫu', [
        { field: 'school_level', message: 'Bộ môn mẫu hiện chỉ có cho Tiểu học' },
      ]);
    }
    await assertLevelEnabled(this.schoolLevels, level);
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('subjects')
        .select(['id', 'code'])
        .where(
          'code',
          'in',
          templates.map((template) => template.code),
        )
        .execute();
      const idByCode = new Map(existing.map((row) => [row.code, row.id]));
      const createdSubjects: string[] = [];
      for (const template of templates) {
        if (idByCode.has(template.code)) {
          continue;
        }
        const created = await transaction
          .insertInto('subjects')
          .values({
            code: template.code,
            name: template.name,
            school_level: level,
            kind: template.kind,
            assessment: template.assessment,
            order_no: template.order_no,
            created_by: origin.actorUserId,
          })
          .returning(COLUMNS)
          .executeTakeFirstOrThrow();
        idByCode.set(template.code, created.id);
        createdSubjects.push(template.code);
        await audit(transaction, origin, 'subjects', created.id, 'create', null, created);
      }
      const curriculum = await this.defaultCurriculum(transaction, level, origin);
      const grades = new Set(
        (
          await transaction
            .selectFrom('grade_levels')
            .select('code')
            .where('school_level', '=', level)
            .where('status', '=', 'active')
            .execute()
        ).map((row) => row.code),
      );
      const present = new Set(
        (
          await transaction
            .selectFrom('curriculum_subjects')
            .select(['subject_id', 'grade_level_code'])
            .where('curriculum_id', '=', curriculum.id)
            .execute()
        ).map((row) => `${row.subject_id}:${row.grade_level_code}`),
      );
      const rows = templates.flatMap((template) =>
        Object.entries(template.periods)
          .filter(([grade]) => grades.has(grade))
          .filter(
            ([grade]) => curriculum.grade_level_codes.length === 0 || curriculum.grade_level_codes.includes(grade),
          )
          .filter(([grade]) => !present.has(`${idByCode.get(template.code)}:${grade}`))
          .map(([grade, periods]) => ({
            curriculum_id: curriculum.id,
            subject_id: idByCode.get(template.code) ?? '',
            grade_level_code: grade,
            periods_per_week: periods ?? 1,
            is_elective: template.elective_grades?.includes(grade) ?? false,
          })),
      );
      if (rows.length > 0) {
        await transaction.insertInto('curriculum_subjects').values(rows).execute();
      }
      return { created_subjects: createdSubjects, curriculum_id: curriculum.id, created_periods: rows.length };
    });
  }

  private async defaultCurriculum(
    transaction: Transaction<SchoolYearDatabase>,
    level: SchoolLevelCode,
    origin: ChangeOrigin,
  ) {
    const found = await transaction
      .selectFrom('curricula')
      .select(['id', 'grade_level_codes'])
      .where('school_level', '=', level)
      .where('is_default', '=', true)
      .executeTakeFirst();
    if (found) {
      return found;
    }
    const template = DEFAULT_CURRICULUM_CODES[level] ?? { code: `CT-${level}`, name: `Chương trình cấp ${level}` };
    const created = await transaction
      .insertInto('curricula')
      .values({ ...template, school_level: level, is_default: true, created_by: origin.actorUserId })
      .returning(['id', 'grade_level_codes'])
      .executeTakeFirstOrThrow();
    await audit(transaction, origin, 'curricula', created.id, 'create', null, created);
    return created;
  }

  async listCurriculumSubjects(curriculumId: string): Promise<CurriculumSubjectRow[]> {
    const { database } = await this.currentSchoolYear.require();
    await findCurriculum(database, curriculumId);
    return readCurriculumSubjects(database, curriculumId);
  }

  // Thay cả bảng số tiết của chương trình trong một giao dịch
  async replaceCurriculumSubjects(curriculumId: string, items: CurriculumSubjectInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const curriculum = await findCurriculum(database, curriculumId);
    const subjectIds = [...new Set(items.map((item) => item.subject_id))];
    const subjects = subjectIds.length
      ? await database.selectFrom('subjects').select(['id', 'school_level']).where('id', 'in', subjectIds).execute()
      : [];
    const gradeCodes = [...new Set(items.map((item) => item.grade_level_code))];
    const grades = gradeCodes.length
      ? await database
          .selectFrom('grade_levels')
          .select(['code', 'school_level'])
          .where('code', 'in', gradeCodes)
          .execute()
      : [];
    const errors: FieldError[] = [];
    items.forEach((item, index) => {
      if (subjects.find((subject) => subject.id === item.subject_id)?.school_level !== curriculum.school_level) {
        errors.push({
          field: `subjects[${index}].subject_id`,
          message: 'Môn không có hoặc không cùng cấp với chương trình',
        });
      }
      const grade = grades.find((row) => row.code === item.grade_level_code);
      if (
        grade?.school_level !== curriculum.school_level ||
        (curriculum.grade_level_codes.length > 0 && !curriculum.grade_level_codes.includes(item.grade_level_code))
      ) {
        errors.push({
          field: `subjects[${index}].grade_level_code`,
          message: 'Khối không có, không cùng cấp hoặc không thuộc khối áp dụng của chương trình',
        });
      }
    });
    if (errors.length > 0) {
      throw ruleViolationError(SUBJECT_RULE_CODE, 'Môn, khối không khớp chương trình', errors);
    }
    return database.transaction().execute(async (transaction) => {
      const before = await readCurriculumSubjects(transaction, curriculumId);
      await transaction.deleteFrom('curriculum_subjects').where('curriculum_id', '=', curriculumId).execute();
      if (items.length > 0) {
        await transaction
          .insertInto('curriculum_subjects')
          .values(items.map((item) => ({ ...item, curriculum_id: curriculumId })))
          .execute();
      }
      const after = await readCurriculumSubjects(transaction, curriculumId);
      await audit(transaction, origin, 'curriculum_subjects', curriculumId, 'update', before, after);
      return after;
    });
  }
}

async function findCurriculum(database: Executor, curriculumId: string) {
  const curriculum = await database
    .selectFrom('curricula')
    .select(['id', 'school_level', 'grade_level_codes'])
    .where('id', '=', curriculumId)
    .executeTakeFirst();
  if (!curriculum) {
    throw notFoundError('Không tìm thấy chương trình', 'curriculum');
  }
  return curriculum;
}

export async function readCurriculumSubjects(
  database: Executor,
  curriculumId: string,
): Promise<CurriculumSubjectRow[]> {
  const rows = await database
    .selectFrom('curriculum_subjects')
    .innerJoin('subjects', 'subjects.id', 'curriculum_subjects.subject_id')
    .select([
      'curriculum_subjects.subject_id',
      'curriculum_subjects.grade_level_code',
      'curriculum_subjects.periods_per_week',
      'curriculum_subjects.is_elective',
      'subjects.code as subject_code',
      'subjects.name as subject_name',
      'subjects.kind',
    ])
    .where('curriculum_subjects.curriculum_id', '=', curriculumId)
    .orderBy('subjects.order_no')
    .orderBy('subjects.code')
    .orderBy('curriculum_subjects.grade_level_code')
    .execute();
  return rows.map((row) => ({ ...row, periods_per_week: Number(row.periods_per_week) }));
}

async function audit(
  transaction: Transaction<SchoolYearDatabase>,
  origin: ChangeOrigin,
  entityName: string,
  entityId: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown,
) {
  await writeAuditLog(transaction, { origin, orgUnitId: null, entityName, entityId, action, before, after });
}

// Mọi người đã đăng nhập xem được để chọn môn khi phân công, nhập đánh giá; người quản lý danh mục tạo, sửa, nạp bộ mẫu
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  list(@Query('school_level') level?: string) {
    const errors: FieldError[] = [];
    const parsed = readSchoolLevel({ school_level: level }, 'school_level', errors);
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.subjects.list(parsed);
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.subjects.create(parseSubjectInput(body), originOf(request, currentUser));
  }

  @Post('templates')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.catalogManage)
  loadTemplate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = readSchoolLevel(body, 'school_level', errors);
    if (!level) {
      throw validationError(errors.length > 0 ? errors : [{ field: 'school_level', message: 'Bắt buộc chọn cấp học' }]);
    }
    return this.subjects.loadTemplate(level, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã môn không hợp lệ')) subjectId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['code', 'school_level']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Mã và cấp của môn không đổi được' });
      }
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      kind: readChoice(body, 'kind', KINDS, errors),
      assessment: readChoice(body, 'assessment', ASSESSMENTS, errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }),
      status: readStatus(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.subjects.update(subjectId, changes, originOf(request, currentUser));
  }
}

// Số tiết theo khối của một chương trình: ai đăng nhập cũng xem; người quản lý danh mục sửa
@Controller('curricula/:id/subjects')
export class CurriculumSubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  list(@Param('id', uuidParameter('Mã chương trình không hợp lệ')) curriculumId: string) {
    return this.subjects.listCurriculumSubjects(curriculumId);
  }

  @Put()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  replace(
    @Param('id', uuidParameter('Mã chương trình không hợp lệ')) curriculumId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.subjects.replaceCurriculumSubjects(
      curriculumId,
      parseCurriculumSubjects(body),
      originOf(request, currentUser),
    );
  }
}

// Môn tự chọn học sinh đăng ký (hồ sơ học sinh Tiểu học): môn phải là môn tự chọn ở khối của lớp đang học theo chương trình
// của lớp; người quản lý hồ sơ học sinh của đơn vị sửa
@Injectable()
export class ElectiveSubjectsService {
  constructor(private readonly currentSchoolYear: CurrentSchoolYearResolver) {}

  private async childContext(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.org_unit_id',
        'classes.grade_level',
        'classes.school_level',
        'classes.curriculum_id',
      ])
      .where('children.id', '=', childId)
      .executeTakeFirst();
    if (!child) {
      throw notFoundError('Không tìm thấy học sinh', 'child');
    }
    return child;
  }

  private assertScope(currentUser: CurrentUser, permissions: string[], orgUnitId: string) {
    const scopes = permissions.map((permission) =>
      currentUser.organizationScope(permission, { excludeParentRole: true }),
    );
    if (!scopes.some((scope) => scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không quản lý hồ sơ học sinh của đơn vị này');
    }
  }

  async list(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childContext(database, childId);
    this.assertScope(currentUser, ['P02.view', PERMISSION_CODES.childManage], child.org_unit_id);
    return { subjects: await this.chosen(database, childId), options: await this.options(database, child) };
  }

  private async chosen(database: Executor, childId: string) {
    return database
      .selectFrom('child_elective_subjects')
      .innerJoin('subjects', 'subjects.id', 'child_elective_subjects.subject_id')
      .select(['subjects.id', 'subjects.code', 'subjects.name'])
      .where('child_elective_subjects.child_id', '=', childId)
      .orderBy('subjects.order_no')
      .execute();
  }

  // Môn tự chọn của khối lớp đang học theo chương trình của lớp (trống là chương trình mặc định của cấp)
  private async options(
    database: Executor,
    child: { grade_level: string | null; school_level: SchoolLevelCode | null; curriculum_id: string | null },
  ) {
    if (!child.grade_level || !child.school_level) {
      return [];
    }
    const curriculumId =
      child.curriculum_id ??
      (
        await database
          .selectFrom('curricula')
          .select('id')
          .where('school_level', '=', child.school_level)
          .where('is_default', '=', true)
          .executeTakeFirst()
      )?.id;
    if (!curriculumId) {
      return [];
    }
    return database
      .selectFrom('curriculum_subjects')
      .innerJoin('subjects', 'subjects.id', 'curriculum_subjects.subject_id')
      .select(['subjects.id', 'subjects.code', 'subjects.name'])
      .where('curriculum_subjects.curriculum_id', '=', curriculumId)
      .where('curriculum_subjects.grade_level_code', '=', child.grade_level)
      .where('curriculum_subjects.is_elective', '=', true)
      .where('subjects.status', '=', 'active')
      .orderBy('subjects.order_no')
      .execute();
  }

  async replace(currentUser: CurrentUser, childId: string, subjectIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childContext(database, childId);
    this.assertScope(currentUser, [PERMISSION_CODES.childManage], child.org_unit_id);
    const allowed = new Set((await this.options(database, child)).map((subject) => subject.id));
    const wrong = subjectIds.filter((id) => !allowed.has(id));
    if (wrong.length > 0) {
      throw ruleViolationError(SUBJECT_RULE_CODE, 'Môn không phải môn tự chọn của khối lớp đang học', [
        { field: 'subject_ids', message: 'Chọn môn tự chọn của khối' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      const before = await this.chosen(transaction, childId);
      await transaction.deleteFrom('child_elective_subjects').where('child_id', '=', childId).execute();
      if (subjectIds.length > 0) {
        await transaction
          .insertInto('child_elective_subjects')
          .values(
            subjectIds.map((subjectId) => ({
              child_id: childId,
              subject_id: subjectId,
              created_by: origin.actorUserId,
            })),
          )
          .execute();
      }
      const after = await this.chosen(transaction, childId);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_elective_subjects',
        entityId: childId,
        action: 'update',
        before,
        after,
      });
      return { subjects: after };
    });
  }
}

@Controller('children/:id/elective-subjects')
export class ElectiveSubjectsController {
  constructor(private readonly electives: ElectiveSubjectsService) {}

  @Get()
  list(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.electives.list(currentUser, childId);
  }

  @Put()
  replace(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const raw = body?.subject_ids;
    if (!Array.isArray(raw) || raw.some((id) => !isUuid(id))) {
      throw validationError([{ field: 'subject_ids', message: 'Danh sách mã môn không hợp lệ' }]);
    }
    return this.electives.replace(currentUser, childId, [...new Set(raw as string[])], originOf(request, currentUser));
  }
}

// Phân công giảng dạy theo môn (DT-20 phần 20a): bảng môn của lớp theo chương trình của lớp (trống là chương trình mặc định
// của cấp) và khối, kèm giáo viên đang dạy từng môn; tổng tiết được phân của từng giáo viên. Phân công, kết thúc phân công
// dùng điểm cuối phân công phụ trách lớp (/classes/{id}/staff-assignments)
@Injectable()
export class TeachingAssignmentsService {
  constructor(private readonly currentSchoolYear: CurrentSchoolYearResolver) {}

  private assertView(currentUser: CurrentUser, orgUnitId: string | null) {
    const scopes = ['P02.view', 'P02.edit', PERMISSION_CODES.classManage].map((permission) =>
      currentUser.organizationScope(permission, { excludeParentRole: true }),
    );
    const allowed = scopes.some(
      (scope) =>
        scope.wholeSchool || (orgUnitId === null ? scope.orgUnitIds.length > 0 : scope.orgUnitIds.includes(orgUnitId)),
    );
    if (!allowed) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được phân công của đơn vị này');
    }
    return scopes;
  }

  async forClass(currentUser: CurrentUser, classId: string) {
    const { database } = await this.currentSchoolYear.require();
    const classRow = await database
      .selectFrom('classes')
      .select(['id', 'code', 'name', 'org_unit_id', 'grade_level', 'school_level', 'curriculum_id'])
      .where('id', '=', classId)
      .executeTakeFirst();
    if (!classRow) {
      throw notFoundError('Không tìm thấy lớp', 'class');
    }
    this.assertView(currentUser, classRow.org_unit_id);
    const curriculum = classRow.curriculum_id
      ? await database
          .selectFrom('curricula')
          .select(['id', 'code', 'name'])
          .where('id', '=', classRow.curriculum_id)
          .executeTakeFirst()
      : await database
          .selectFrom('curricula')
          .select(['id', 'code', 'name'])
          .where('school_level', '=', classRow.school_level)
          .where('is_default', '=', true)
          .executeTakeFirst();
    const planned = curriculum
      ? (await readCurriculumSubjects(database, curriculum.id)).filter(
          (row) => row.grade_level_code === classRow.grade_level,
        )
      : [];
    const assignments = await database
      .selectFrom('class_staff_assignments')
      .select(['id', 'subject_id', 'staff_user_id', 'staff_name', 'periods_per_week', 'from_date'])
      .where('class_id', '=', classId)
      .where('status', '=', 'active')
      .where('subject_id', 'is not', null)
      .execute();
    return {
      class: classRow,
      curriculum: curriculum ?? null,
      subjects: planned.map((row) => {
        const assignment = assignments.find((item) => item.subject_id === row.subject_id);
        return {
          ...row,
          assignment: assignment
            ? {
                ...assignment,
                periods_per_week:
                  assignment.periods_per_week === null ? row.periods_per_week : Number(assignment.periods_per_week),
              }
            : null,
        };
      }),
      planned_periods: planned.reduce((sum, row) => sum + row.periods_per_week, 0),
    };
  }

  // Tổng tiết mỗi tuần giáo viên được phân theo môn trong các lớp thuộc cấp (số tiết trống là số tiết của chương trình)
  async teachers(currentUser: CurrentUser, level: SchoolLevelCode) {
    const { database } = await this.currentSchoolYear.require();
    // Không chọn đơn vị: xem phân công trong các đơn vị người dùng được xem
    const scopes = this.assertView(currentUser, null);
    const wholeSchool = scopes.some((scope) => scope.wholeSchool);
    const unitIds = [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))];
    let query = database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
      .innerJoin('subjects', 'subjects.id', 'class_staff_assignments.subject_id')
      .leftJoin('curriculum_subjects', (join) =>
        join
          .onRef('curriculum_subjects.subject_id', '=', 'class_staff_assignments.subject_id')
          .onRef('curriculum_subjects.grade_level_code', '=', 'classes.grade_level'),
      )
      .select([
        'class_staff_assignments.staff_user_id',
        'class_staff_assignments.staff_name',
        'class_staff_assignments.periods_per_week',
        'curriculum_subjects.periods_per_week as planned_periods',
        'curriculum_subjects.curriculum_id',
        'classes.id as class_id',
        'classes.curriculum_id as class_curriculum_id',
        'classes.school_level',
      ])
      .where('class_staff_assignments.status', '=', 'active')
      .where('classes.school_level', '=', level);
    if (!wholeSchool) {
      query = query.where(
        'classes.org_unit_id',
        'in',
        unitIds.length > 0 ? unitIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    const defaultCurriculum = await database
      .selectFrom('curricula')
      .select('id')
      .where('school_level', '=', level)
      .where('is_default', '=', true)
      .executeTakeFirst();
    const rows = (await query.execute()).filter(
      (row) =>
        row.curriculum_id === null || row.curriculum_id === (row.class_curriculum_id ?? defaultCurriculum?.id ?? null),
    );
    const byTeacher = new Map<
      string,
      { staff_user_id: string; staff_name: string; total_periods: number; classes: Set<string> }
    >();
    for (const row of rows) {
      const entry = byTeacher.get(row.staff_user_id) ?? {
        staff_user_id: row.staff_user_id,
        staff_name: row.staff_name,
        total_periods: 0,
        classes: new Set<string>(),
      };
      entry.total_periods += Number(row.periods_per_week ?? row.planned_periods ?? 0);
      entry.classes.add(row.class_id);
      byTeacher.set(row.staff_user_id, entry);
    }
    return [...byTeacher.values()]
      .map((entry) => ({ ...entry, classes: entry.classes.size }))
      .sort((left, right) => left.staff_name.localeCompare(right.staff_name, 'vi'));
  }
}

@Controller('teaching-assignments')
export class TeachingAssignmentsController {
  constructor(private readonly teaching: TeachingAssignmentsService) {}

  @Get()
  forClass(@Query('class_id') classId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (!isUuid(classId)) {
      throw validationError([{ field: 'class_id', message: 'Mã lớp không hợp lệ' }]);
    }
    return this.teaching.forClass(currentUser, classId);
  }

  @Get('teachers')
  teachers(@Query('school_level') level: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const parsed = readSchoolLevel({ school_level: level }, 'school_level', errors) ?? 'TH';
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.teaching.teachers(currentUser, parsed);
  }
}
