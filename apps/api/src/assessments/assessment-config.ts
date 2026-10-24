import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type {
  AssessmentScale,
  CommentTemplateTarget,
  CompetencyGroup,
  SchoolYearDatabase,
} from '@school-management/database';
import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { ASSESSMENT_DEFAULTS, PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
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
import { readCurriculumSubjects } from '../subjects/subjects.js';

// Cấu hình đánh giá học sinh theo Thông tư 27/2020 (DT-20 phần 20c, YCTD-161): mức đạt của hai thang (môn học, hoạt động;
// phẩm chất, năng lực), danh mục phẩm chất, năng lực, kỳ đánh giá định kỳ và hạn nhập, môn, khối có bài kiểm tra định kỳ của
// kỳ, thư viện câu nhận xét. Nạp bộ mặc định của Thông tư theo cấp (mục đã có thì giữ). Mức đạt thay cả thang một lần; mức đã
// dùng ở kết quả không bỏ được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const ASSESSMENT_RULE_CODE = 'YCTD-161';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
const SCALES: AssessmentScale[] = ['subject', 'competency'];
const GROUPS: CompetencyGroup[] = ['quality', 'general', 'specific'];
const TARGETS: CommentTemplateTarget[] = ['subject', 'competency', 'general'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readChoice<Value extends string>(
  value: unknown,
  field: string,
  choices: readonly Value[],
  errors: FieldError[],
) {
  if (!choices.includes(value as Value)) {
    errors.push({ field, message: `Giá trị là ${choices.join(', ')}` });
    return undefined;
  }
  return value as Value;
}

async function audit(
  transaction: Transaction<SchoolYearDatabase>,
  origin: ChangeOrigin,
  entityName: string,
  entityId: string,
  action: 'create' | 'update' | 'delete',
  before: unknown,
  after: unknown,
) {
  await writeAuditLog(transaction, { origin, orgUnitId: null, entityName, entityId, action, before, after });
}

// Cấu hình đọc chung cho nhập, tổng hợp và ứng dụng
export async function readAssessmentConfig(database: Executor, level: SchoolLevelCode) {
  const [levels, items, periods, templates] = await Promise.all([
    database
      .selectFrom('assessment_levels')
      .select(['id', 'scale', 'code', 'name', 'rank'])
      .where('school_level', '=', level)
      .orderBy('scale')
      .orderBy('rank')
      .execute(),
    database
      .selectFrom('competency_items')
      .select(['id', 'group_code', 'code', 'name', 'order_no', 'status'])
      .where('school_level', '=', level)
      .orderBy('order_no')
      .orderBy('code')
      .execute(),
    database
      .selectFrom('assessment_periods')
      .select(['id', 'code', 'name', 'term_type', 'kind', 'is_year_end', 'order_no', 'entry_deadline'])
      .where('school_level', '=', level)
      .orderBy('order_no')
      .execute(),
    database
      .selectFrom('comment_templates')
      .select(['id', 'target', 'content', 'order_no', 'status'])
      .where('school_level', '=', level)
      .orderBy('target')
      .orderBy('order_no')
      .execute(),
  ]);
  const tests =
    periods.length === 0
      ? []
      : await database
          .selectFrom('assessment_tests')
          .innerJoin('subjects', 'subjects.id', 'assessment_tests.subject_id')
          .select([
            'assessment_tests.period_id',
            'assessment_tests.subject_id',
            'assessment_tests.grade_level_code',
            'subjects.code as subject_code',
            'subjects.name as subject_name',
          ])
          .where(
            'assessment_tests.period_id',
            'in',
            periods.map((period) => period.id),
          )
          .orderBy('subjects.order_no')
          .orderBy('assessment_tests.grade_level_code')
          .execute();
  return { school_level: level, levels, items, periods, tests, templates };
}

@Injectable()
export class AssessmentConfigService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  async read(level: SchoolLevelCode) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { school_level: level, levels: [], items: [], periods: [], tests: [], templates: [] };
    }
    return readAssessmentConfig(current.database, level);
  }

  // Bộ mặc định của Thông tư: mức đạt (thang trống), phẩm chất, năng lực, kỳ, câu nhận xét (mã đã có giữ nguyên); bài kiểm
  // tra định kỳ theo môn có điểm của chương trình mặc định của cấp (kỳ cuối học kỳ mọi khối, kỳ giữa học kỳ theo bộ mặc định)
  async loadDefaults(level: SchoolLevelCode, origin: ChangeOrigin) {
    await assertLevelEnabled(this.schoolLevels, level);
    const defaults = ASSESSMENT_DEFAULTS[level];
    if (!defaults) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, `Chưa có bộ mặc định cho cấp ${level}`);
    }
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = { levels: 0, items: 0, periods: 0, tests: 0, templates: 0 };
      for (const scale of SCALES) {
        const existing = await transaction
          .selectFrom('assessment_levels')
          .select('id')
          .where('school_level', '=', level)
          .where('scale', '=', scale)
          .execute();
        const rows = defaults.levels.filter((item) => item.scale === scale);
        if (existing.length === 0 && rows.length > 0) {
          await transaction
            .insertInto('assessment_levels')
            .values(rows.map((row) => ({ ...row, school_level: level })))
            .execute();
          created.levels += rows.length;
        }
      }
      const itemCodes = new Set(
        (
          await transaction.selectFrom('competency_items').select('code').where('school_level', '=', level).execute()
        ).map((row) => row.code),
      );
      const newItems = defaults.items
        .map((item, index) => ({ ...item, school_level: level, order_no: index + 1 }))
        .filter((item) => !itemCodes.has(item.code));
      if (newItems.length > 0) {
        await transaction.insertInto('competency_items').values(newItems).execute();
        created.items = newItems.length;
      }
      const periodCodes = new Set(
        (
          await transaction.selectFrom('assessment_periods').select('code').where('school_level', '=', level).execute()
        ).map((row) => row.code),
      );
      const newPeriods = defaults.periods
        .map((period, index) => ({ ...period, school_level: level, order_no: index + 1 }))
        .filter((period) => !periodCodes.has(period.code));
      if (newPeriods.length > 0) {
        await transaction.insertInto('assessment_periods').values(newPeriods).execute();
        created.periods = newPeriods.length;
      }
      created.tests = await this.defaultTests(transaction, level, defaults.mid_term_tests);
      const templateCount = await transaction
        .selectFrom('comment_templates')
        .select((expression) => expression.fn.countAll<string>().as('count'))
        .where('school_level', '=', level)
        .executeTakeFirstOrThrow();
      if (Number(templateCount.count) === 0) {
        await transaction
          .insertInto('comment_templates')
          .values(defaults.comments.map((item, index) => ({ ...item, school_level: level, order_no: index + 1 })))
          .execute();
        created.templates = defaults.comments.length;
      }
      await audit(transaction, origin, 'assessment_config', '00000000-0000-0000-0000-000000000161', 'create', null, {
        school_level: level,
        created,
      });
      return created;
    });
  }

  // Kỳ chưa có bài kiểm tra nào thì điền theo chương trình mặc định của cấp
  private async defaultTests(
    transaction: Transaction<SchoolYearDatabase>,
    level: SchoolLevelCode,
    midTermTests: Array<{ subject_code: string; grade_level_codes: string[] }>,
  ) {
    const curriculum = await transaction
      .selectFrom('curricula')
      .select('id')
      .where('school_level', '=', level)
      .where('is_default', '=', true)
      .executeTakeFirst();
    if (!curriculum) {
      return 0;
    }
    const planned = await readCurriculumSubjects(transaction, curriculum.id);
    const scored = await transaction
      .selectFrom('subjects')
      .select(['id', 'code'])
      .where('school_level', '=', level)
      .where('assessment', '=', 'comment_and_score')
      .where('status', '=', 'active')
      .execute();
    const periods = await transaction
      .selectFrom('assessment_periods')
      .select(['id', 'kind'])
      .where('school_level', '=', level)
      .execute();
    let count = 0;
    for (const period of periods) {
      const has = await transaction
        .selectFrom('assessment_tests')
        .select('period_id')
        .where('period_id', '=', period.id)
        .executeTakeFirst();
      if (has) {
        continue;
      }
      const rows = planned
        .filter((row) => scored.some((subject) => subject.id === row.subject_id))
        .filter(
          (row) =>
            period.kind === 'end' ||
            midTermTests.some(
              (test) => test.subject_code === row.subject_code && test.grade_level_codes.includes(row.grade_level_code),
            ),
        )
        .map((row) => ({ period_id: period.id, subject_id: row.subject_id, grade_level_code: row.grade_level_code }));
      if (rows.length > 0) {
        await transaction.insertInto('assessment_tests').values(rows).execute();
        count += rows.length;
      }
    }
    return count;
  }

  // Thay cả thang mức đạt; mức đã dùng ở kết quả phải còn
  async saveLevels(
    level: SchoolLevelCode,
    scale: AssessmentScale,
    rows: Array<{ code: string; name: string }>,
    origin: ChangeOrigin,
  ) {
    await assertLevelEnabled(this.schoolLevels, level);
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('assessment_levels')
      .select(['code', 'name', 'rank'])
      .where('school_level', '=', level)
      .where('scale', '=', scale)
      .orderBy('rank')
      .execute();
    const table = scale === 'subject' ? 'subject_results' : 'competency_results';
    const used = (
      await database
        .selectFrom(table)
        .innerJoin('classes', 'classes.id', `${table}.class_id`)
        .select(`${table}.level_code`)
        .distinct()
        .where('classes.school_level', '=', level)
        .where(`${table}.level_code`, 'is not', null)
        .execute()
    ).map((row) => row.level_code);
    const missing = used.filter((code) => !rows.some((row) => row.code === code));
    if (missing.length > 0) {
      throw ruleViolationError(ASSESSMENT_RULE_CODE, `Mức ${missing.join(', ')} đã dùng ở kết quả, không bỏ được`);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('assessment_levels')
        .where('school_level', '=', level)
        .where('scale', '=', scale)
        .execute();
      await transaction
        .insertInto('assessment_levels')
        .values(rows.map((row, index) => ({ ...row, school_level: level, scale, rank: index + 1 })))
        .execute();
      await audit(transaction, origin, 'assessment_levels', '00000000-0000-0000-0000-000000000161', 'update', before, {
        school_level: level,
        scale,
        rows,
      });
    });
    return this.read(level);
  }

  async createItem(
    input: { school_level: SchoolLevelCode; group_code: CompetencyGroup; code: string; name: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    await assertLevelEnabled(this.schoolLevels, input.school_level);
    const { database } = await this.currentSchoolYear.require();
    return conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('competency_items')
          .values(input)
          .returning(['id', 'school_level', 'group_code', 'code', 'name', 'order_no', 'status'])
          .executeTakeFirstOrThrow();
        await audit(transaction, origin, 'competency_items', created.id, 'create', null, created);
        return created;
      }),
      'Mã phẩm chất, năng lực đã có',
      'code',
    );
  }

  async updateItem(
    itemId: string,
    changes: { name?: string; order_no?: number; status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('competency_items')
      .selectAll()
      .where('id', '=', itemId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy phẩm chất, năng lực', 'competency_item');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('competency_items')
        .set(changes)
        .where('id', '=', itemId)
        .returning(['id', 'school_level', 'group_code', 'code', 'name', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'competency_items', itemId, 'update', before, updated);
      return updated;
    });
  }

  async updatePeriod(
    periodId: string,
    changes: { name?: string; entry_deadline?: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('assessment_periods')
      .selectAll()
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'assessment_period');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('assessment_periods')
        .set(changes)
        .where('id', '=', periodId)
        .returning(['id', 'code', 'name', 'term_type', 'kind', 'is_year_end', 'order_no', 'entry_deadline'])
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'assessment_periods', periodId, 'update', before, updated);
      return updated;
    });
  }

  // Thay danh sách môn, khối có bài kiểm tra định kỳ của kỳ; môn phải có điểm (nhận xét và điểm) và cùng cấp với kỳ
  async saveTests(
    periodId: string,
    rows: Array<{ subject_id: string; grade_level_code: string }>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const period = await database
      .selectFrom('assessment_periods')
      .select(['id', 'school_level'])
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!period) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'assessment_period');
    }
    const subjectIds = [...new Set(rows.map((row) => row.subject_id))];
    const subjects =
      subjectIds.length === 0
        ? []
        : await database
            .selectFrom('subjects')
            .select(['id', 'school_level', 'assessment'])
            .where('id', 'in', subjectIds)
            .execute();
    const errors: FieldError[] = [];
    rows.forEach((row, index) => {
      const subject = subjects.find((item) => item.id === row.subject_id);
      if (!subject || subject.school_level !== period.school_level || subject.assessment !== 'comment_and_score') {
        errors.push({ field: `tests[${index}].subject_id`, message: 'Môn phải cùng cấp và có điểm kiểm tra định kỳ' });
      }
    });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('assessment_tests').where('period_id', '=', periodId).execute();
      if (rows.length > 0) {
        await transaction
          .insertInto('assessment_tests')
          .values(rows.map((row) => ({ ...row, period_id: periodId })))
          .onConflict((conflict) => conflict.doNothing())
          .execute();
      }
      await audit(transaction, origin, 'assessment_tests', periodId, 'update', null, rows);
    });
    return this.read(period.school_level);
  }

  async createTemplate(
    input: { school_level: SchoolLevelCode; target: CommentTemplateTarget; content: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('comment_templates')
        .values(input)
        .returning(['id', 'school_level', 'target', 'content', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'comment_templates', created.id, 'create', null, created);
      return created;
    });
  }

  async updateTemplate(
    templateId: string,
    changes: { content?: string; status?: 'active' | 'inactive' },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('comment_templates')
      .selectAll()
      .where('id', '=', templateId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy câu nhận xét', 'comment_template');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('comment_templates')
        .set(changes)
        .where('id', '=', templateId)
        .returning(['id', 'school_level', 'target', 'content', 'order_no', 'status'])
        .executeTakeFirstOrThrow();
      await audit(transaction, origin, 'comment_templates', templateId, 'update', before, updated);
      return updated;
    });
  }
}

function levelOf(source: Record<string, unknown> | undefined, errors: FieldError[]): SchoolLevelCode {
  return readSchoolLevel(source, 'school_level', errors) ?? 'TH';
}

function throwIf(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller('assessment/config')
export class AssessmentConfigController {
  constructor(private readonly config: AssessmentConfigService) {}

  // Cấu hình là danh mục dùng chung: người đã đăng nhập đọc được (giáo viên nhập, phụ huynh xem nhãn mức)
  @Get()
  read(@Query() query: Record<string, string | undefined>) {
    const errors: FieldError[] = [];
    const level = levelOf(query, errors);
    throwIf(errors);
    return this.config.read(level);
  }

  @Post('defaults')
  @HttpCode(200)
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  loadDefaults(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = levelOf(body, errors);
    throwIf(errors);
    return this.config.loadDefaults(level, originOf(request, currentUser));
  }

  @Put('levels')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  saveLevels(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const level = levelOf(body, errors);
    const scale = readChoice(body?.scale, 'scale', SCALES, errors) ?? 'subject';
    const raw = Array.isArray(body?.levels) ? (body.levels as unknown[]) : null;
    if (!raw || raw.length < 2 || raw.length > 9) {
      errors.push({ field: 'levels', message: 'Thang có từ 2 đến 9 mức, mức cao nhất đứng đầu' });
    }
    const codes = new Set<string>();
    const rows = (raw ?? []).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as RequestBody;
      const code = readRequiredText(item, 'code', errors);
      const name = readRequiredText(item, 'name', errors);
      if (code.length > 10 || codes.has(code)) {
        errors.push({ field: `levels[${index}].code`, message: 'Mã mức tối đa 10 ký tự, không trùng' });
      }
      codes.add(code);
      return { code, name };
    });
    throwIf(errors);
    return this.config.saveLevels(level, scale, rows, originOf(request, currentUser));
  }

  @Post('items')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  createItem(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      school_level: levelOf(body, errors),
      group_code: readChoice(body?.group_code, 'group_code', GROUPS, errors) ?? 'quality',
      code: readRequiredText(body, 'code', errors),
      name: readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }) ?? 0,
    };
    throwIf(errors);
    return this.config.createItem(input, originOf(request, currentUser));
  }

  @Patch('items/:id')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  updateItem(
    @Param('id', uuidParameter('Mã không hợp lệ')) itemId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }),
      status: readStatus(body, errors),
    };
    throwIf(errors);
    return this.config.updateItem(itemId, changes, originOf(request, currentUser));
  }

  @Patch('periods/:id')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  updatePeriod(
    @Param('id', uuidParameter('Mã không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    let deadline: string | null | undefined;
    if (body?.entry_deadline === null || body?.entry_deadline === '') {
      deadline = null;
    } else if (body?.entry_deadline !== undefined) {
      if (typeof body.entry_deadline !== 'string' || !DATE_PATTERN.test(body.entry_deadline)) {
        errors.push({ field: 'entry_deadline', message: 'Ngày theo dạng YYYY-MM-DD' });
      } else {
        deadline = body.entry_deadline;
      }
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      entry_deadline: deadline,
    };
    throwIf(errors);
    return this.config.updatePeriod(periodId, changes, originOf(request, currentUser));
  }

  @Put('periods/:id/tests')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  saveTests(
    @Param('id', uuidParameter('Mã không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const raw = Array.isArray(body?.tests) ? (body.tests as unknown[]) : null;
    if (!raw) {
      errors.push({ field: 'tests', message: 'Cần danh sách môn, khối' });
    }
    const rows = (raw ?? []).map((value, index) => {
      const item = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
      if (!isUuid(item.subject_id)) {
        errors.push({ field: `tests[${index}].subject_id`, message: 'Mã môn không hợp lệ' });
      }
      if (typeof item.grade_level_code !== 'string' || item.grade_level_code.trim() === '') {
        errors.push({ field: `tests[${index}].grade_level_code`, message: 'Bắt buộc chọn khối' });
      }
      return { subject_id: String(item.subject_id), grade_level_code: String(item.grade_level_code ?? '').trim() };
    });
    throwIf(errors);
    return this.config.saveTests(periodId, rows, originOf(request, currentUser));
  }

  @Post('templates')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  createTemplate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      school_level: levelOf(body, errors),
      target: readChoice(body?.target, 'target', TARGETS, errors) ?? 'general',
      content: readRequiredText(body, 'content', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }) ?? 0,
    };
    throwIf(errors);
    return this.config.createTemplate(input, originOf(request, currentUser));
  }

  @Patch('templates/:id')
  @RequirePermission(PERMISSION_CODES.assessmentManage)
  updateTemplate(
    @Param('id', uuidParameter('Mã không hợp lệ')) templateId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const changes = {
      content: body?.content === undefined ? undefined : readRequiredText(body, 'content', errors),
      status: readStatus(body, errors),
    };
    throwIf(errors);
    return this.config.updateTemplate(templateId, changes, originOf(request, currentUser));
  }
}
