import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Patch, Post, Put, Req } from '@nestjs/common';
import type { CatalogStatus, SchoolYearDatabase, SubjectOptionGroup } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  readBearerToken,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { COMBINATION_RULE, PERMISSION_CODES, type SchoolLevelCode } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { IdentityClient } from '../authentication/identity-client.js';
import { assertLevelEnabled } from '../catalogs/school-level-fields.js';
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

// Nền THCS, THPT (DT-21 phần 21a, YCTD-167): tổ hợp môn của THPT, tổ hợp học sinh đăng ký (đổi tổ hợp đã duyệt thì chờ
// duyệt), tổ bộ môn. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: tổ hợp chỉ có ở THPT, gồm đúng
// `COMBINATION_RULE.subject_count` môn lựa chọn đang dùng của cấp, thuộc ít nhất `min_groups` nhóm môn; tổ hợp đã có
// học sinh đăng ký không đổi được danh sách môn (tạo tổ hợp mới thay thế, ngừng tổ hợp cũ); mỗi tổ bộ môn một tổ trưởng,
// một môn thuộc nhiều tổ được nhưng mỗi người chỉ một vai trò trong một tổ
export const SECONDARY_RULE_CODE = 'YCTD-167';
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const CODE_MAX = 30;

export interface SubjectRef {
  id: string;
  code: string;
  name: string;
  option_group: SubjectOptionGroup | null;
}

export interface Combination {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  order_no: number;
  status: CatalogStatus;
  subjects: SubjectRef[];
  student_count: number;
}

export interface CombinationInput {
  code: string;
  name: string;
  order_no: number;
  subject_ids: string[];
}

function readSubjectIds(body: RequestBody, errors: FieldError[]): string[] | undefined {
  const raw = body?.subject_ids;
  if (raw === undefined) {
    return undefined;
  }
  if (!Array.isArray(raw) || raw.some((id) => !isUuid(id))) {
    errors.push({ field: 'subject_ids', message: 'Danh sách mã môn không hợp lệ' });
    return undefined;
  }
  return [...new Set(raw as string[])];
}

export function parseCombinationInput(body: RequestBody): CombinationInput {
  const errors: FieldError[] = [];
  const input = {
    code: readRequiredText(body, 'code', errors),
    name: readRequiredText(body, 'name', errors),
    order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }) ?? 0,
    subject_ids: readSubjectIds(body, errors) ?? [],
  };
  if (input.code.length > CODE_MAX) {
    errors.push({ field: 'code', message: `Mã tối đa ${CODE_MAX} ký tự` });
  }
  if (body?.subject_ids === undefined) {
    errors.push({ field: 'subject_ids', message: 'Bắt buộc chọn môn của tổ hợp' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}

// Môn của tổ hợp: môn lựa chọn đang dùng của THPT, đúng số môn, đủ số nhóm môn tối thiểu
export function checkCombinationSubjects(subjects: SubjectRef[], expected: number): FieldError[] {
  const errors: FieldError[] = [];
  if (subjects.length !== expected) {
    errors.push({ field: 'subject_ids', message: `Tổ hợp gồm đúng ${COMBINATION_RULE.subject_count} môn lựa chọn` });
    return errors;
  }
  if (new Set(subjects.map((subject) => subject.option_group)).size < COMBINATION_RULE.min_groups) {
    errors.push({
      field: 'subject_ids',
      message: `Môn của tổ hợp thuộc ít nhất ${COMBINATION_RULE.min_groups} nhóm môn (xã hội, tự nhiên, công nghệ và nghệ thuật)`,
    });
  }
  return errors;
}

@Injectable()
export class CombinationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  async list(): Promise<Combination[]> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return readCombinations(current.database);
  }

  private async subjectsOf(database: Executor, subjectIds: string[]): Promise<SubjectRef[]> {
    if (subjectIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('subjects')
      .select(['id', 'code', 'name', 'option_group', 'school_level', 'status'])
      .where('id', 'in', subjectIds)
      .execute();
    const wrong = subjectIds.filter(
      (id) =>
        !rows.some(
          (row) => row.id === id && row.school_level === 'THPT' && row.status === 'active' && row.option_group !== null,
        ),
    );
    if (wrong.length > 0) {
      throw ruleViolationError(SECONDARY_RULE_CODE, 'Môn của tổ hợp phải là môn lựa chọn đang dùng của THPT', [
        { field: 'subject_ids', message: 'Chọn môn lựa chọn của THPT' },
      ]);
    }
    return rows.map(({ id, code, name, option_group }) => ({ id, code, name, option_group }));
  }

  async create(input: CombinationInput, origin: ChangeOrigin): Promise<Combination> {
    await assertLevelEnabled(this.schoolLevels, 'THPT');
    const { database } = await this.currentSchoolYear.require();
    const subjects = await this.subjectsOf(database, input.subject_ids);
    const errors = checkCombinationSubjects(subjects, COMBINATION_RULE.subject_count);
    if (errors.length > 0) {
      throw ruleViolationError(SECONDARY_RULE_CODE, 'Môn của tổ hợp chưa đúng quy tắc', errors);
    }
    const id = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('subject_combinations')
          .values({
            code: input.code,
            name: input.name,
            school_level: 'THPT',
            order_no: input.order_no,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('subject_combination_subjects')
          .values(subjects.map((subject) => ({ combination_id: created.id, subject_id: subject.id })))
          .execute();
        const after = await readCombination(transaction, created.id);
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'subject_combinations',
          entityId: created.id,
          action: 'create',
          before: null,
          after,
        });
        return created.id;
      }),
      'Mã tổ hợp đã tồn tại',
      'code',
    );
    return readCombination(database, id);
  }

  async update(
    combinationId: string,
    changes: { name?: string; order_no?: number; status?: CatalogStatus; subject_ids?: string[] },
    origin: ChangeOrigin,
  ): Promise<Combination> {
    const { database } = await this.currentSchoolYear.require();
    const before = await readCombination(database, combinationId);
    let subjects: SubjectRef[] | undefined;
    if (changes.subject_ids) {
      if (before.student_count > 0) {
        throw ruleViolationError(SECONDARY_RULE_CODE, 'Tổ hợp đã có học sinh đăng ký, không đổi được danh sách môn', [
          { field: 'subject_ids', message: 'Tạo tổ hợp mới thay thế, ngừng tổ hợp này' },
        ]);
      }
      subjects = await this.subjectsOf(database, changes.subject_ids);
      const errors = checkCombinationSubjects(subjects, COMBINATION_RULE.subject_count);
      if (errors.length > 0) {
        throw ruleViolationError(SECONDARY_RULE_CODE, 'Môn của tổ hợp chưa đúng quy tắc', errors);
      }
    }
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('subject_combinations')
        .set({
          name: changes.name,
          order_no: changes.order_no,
          status: changes.status,
          updated_at: this.clock.now(),
        })
        .where('id', '=', combinationId)
        .execute();
      if (subjects) {
        await transaction
          .deleteFrom('subject_combination_subjects')
          .where('combination_id', '=', combinationId)
          .execute();
        await transaction
          .insertInto('subject_combination_subjects')
          .values(subjects.map((subject) => ({ combination_id: combinationId, subject_id: subject.id })))
          .execute();
      }
      const after = await readCombination(transaction, combinationId);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'subject_combinations',
        entityId: combinationId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // Học sinh đã đăng ký tổ hợp (kể cả đang chờ duyệt) kèm lớp đang học
  async students(combinationId: string) {
    const { database } = await this.currentSchoolYear.require();
    await readCombination(database, combinationId);
    return database
      .selectFrom('child_subject_combinations')
      .innerJoin('children', 'children.id', 'child_subject_combinations.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'classes.name as class_name',
        'child_subject_combinations.status',
      ])
      .where('child_subject_combinations.combination_id', '=', combinationId)
      .orderBy('classes.name')
      .orderBy('children.full_name')
      .execute();
  }
}

async function readCombinations(database: Executor): Promise<Combination[]> {
  const rows = await database
    .selectFrom('subject_combinations')
    .select(['id', 'code', 'name', 'school_level', 'order_no', 'status'])
    .orderBy('order_no')
    .orderBy('code')
    .execute();
  return attachCombinationDetails(database, rows);
}

async function readCombination(database: Executor, combinationId: string): Promise<Combination> {
  const rows = await database
    .selectFrom('subject_combinations')
    .select(['id', 'code', 'name', 'school_level', 'order_no', 'status'])
    .where('id', '=', combinationId)
    .execute();
  if (rows.length === 0) {
    throw notFoundError('Không tìm thấy tổ hợp môn', 'subject_combination');
  }
  return (await attachCombinationDetails(database, rows))[0] as Combination;
}

async function attachCombinationDetails(
  database: Executor,
  rows: Array<Omit<Combination, 'subjects' | 'student_count'>>,
): Promise<Combination[]> {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const members = await database
    .selectFrom('subject_combination_subjects')
    .innerJoin('subjects', 'subjects.id', 'subject_combination_subjects.subject_id')
    .select([
      'subject_combination_subjects.combination_id',
      'subjects.id',
      'subjects.code',
      'subjects.name',
      'subjects.option_group',
    ])
    .where('subject_combination_subjects.combination_id', 'in', ids)
    .orderBy('subjects.order_no')
    .orderBy('subjects.code')
    .execute();
  const counts = await database
    .selectFrom('child_subject_combinations')
    .select(['combination_id', (builder) => builder.fn.countAll<string>().as('total')])
    .where('combination_id', 'in', ids)
    .groupBy('combination_id')
    .execute();
  return rows.map((row) => ({
    ...row,
    subjects: members
      .filter((member) => member.combination_id === row.id)
      .map(({ id, code, name, option_group }) => ({ id, code, name, option_group })),
    student_count: Number(counts.find((count) => count.combination_id === row.id)?.total ?? 0),
  }));
}

@Controller('subject-combinations')
export class CombinationsController {
  constructor(private readonly combinations: CombinationsService) {}

  @Get()
  list() {
    return this.combinations.list();
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.combinations.create(parseCombinationInput(body), originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã tổ hợp không hợp lệ')) combinationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.code !== undefined) {
      errors.push({ field: 'code', message: 'Mã tổ hợp không đổi được' });
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 999 }),
      status: readStatus(body, errors),
      subject_ids: readSubjectIds(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.combinations.update(combinationId, changes, originOf(request, currentUser));
  }

  @Get(':id/students')
  @RequirePermission('P02.view')
  students(@Param('id', uuidParameter('Mã tổ hợp không hợp lệ')) combinationId: string) {
    return this.combinations.students(combinationId);
  }
}

// Tổ hợp môn học sinh đăng ký (hồ sơ học sinh THPT): đăng ký lần đầu có hiệu lực ngay; đổi tổ hợp đã duyệt thì chờ Ban Giám
// hiệu duyệt; duyệt xong môn tự chọn của học sinh theo đúng môn của tổ hợp
@Injectable()
export class ChildCombinationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
  ) {}

  private async childContext(database: Executor, childId: string) {
    const child = await database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.org_unit_id', 'classes.school_level'])
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

  private async registration(database: Executor, childId: string) {
    return (
      (await database
        .selectFrom('child_subject_combinations')
        .innerJoin('subject_combinations', 'subject_combinations.id', 'child_subject_combinations.combination_id')
        .select([
          'child_subject_combinations.combination_id',
          'subject_combinations.code as combination_code',
          'subject_combinations.name as combination_name',
          'child_subject_combinations.status',
          'child_subject_combinations.previous_combination_id',
        ])
        .where('child_subject_combinations.child_id', '=', childId)
        .executeTakeFirst()) ?? null
    );
  }

  async read(currentUser: CurrentUser, childId: string) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childContext(database, childId);
    this.assertScope(currentUser, ['P02.view', PERMISSION_CODES.childManage], child.org_unit_id);
    const options =
      child.school_level === 'THPT'
        ? (await readCombinations(database)).filter((combination) => combination.status === 'active')
        : [];
    return { registration: await this.registration(database, childId), options };
  }

  async register(currentUser: CurrentUser, childId: string, combinationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childContext(database, childId);
    this.assertScope(currentUser, [PERMISSION_CODES.childManage], child.org_unit_id);
    if (child.school_level !== 'THPT') {
      throw ruleViolationError(SECONDARY_RULE_CODE, 'Chỉ học sinh lớp THPT đăng ký tổ hợp môn', [
        { field: 'combination_id', message: 'Học sinh chưa học lớp THPT' },
      ]);
    }
    const combination = await database
      .selectFrom('subject_combinations')
      .select(['id', 'status'])
      .where('id', '=', combinationId)
      .executeTakeFirst();
    if (!combination || combination.status !== 'active') {
      throw ruleViolationError(SECONDARY_RULE_CODE, 'Tổ hợp không có hoặc đã ngừng', [
        { field: 'combination_id', message: 'Chọn tổ hợp đang dùng' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      const before = await this.registration(transaction, childId);
      const existing = await transaction
        .selectFrom('child_subject_combinations')
        .select(['combination_id', 'status', 'previous_combination_id'])
        .where('child_id', '=', childId)
        .executeTakeFirst();
      const now = this.clock.now();
      if (!existing) {
        await transaction
          .insertInto('child_subject_combinations')
          .values({
            child_id: childId,
            combination_id: combinationId,
            status: 'approved',
            requested_by: origin.actorUserId,
          })
          .execute();
        await syncElectives(transaction, childId, combinationId, origin);
      } else if (existing.status === 'approved' && existing.combination_id === combinationId) {
        return { registration: before };
      } else {
        const approved = existing.status === 'approved' ? existing.combination_id : existing.previous_combination_id;
        await transaction
          .updateTable('child_subject_combinations')
          .set(
            approved === combinationId
              ? {
                  combination_id: combinationId,
                  status: 'approved',
                  previous_combination_id: null,
                  requested_by: origin.actorUserId,
                  updated_at: now,
                }
              : {
                  combination_id: combinationId,
                  status: 'pending',
                  previous_combination_id: approved,
                  requested_by: origin.actorUserId,
                  updated_at: now,
                },
          )
          .where('child_id', '=', childId)
          .execute();
      }
      const after = await this.registration(transaction, childId);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_subject_combinations',
        entityId: childId,
        action: before ? 'update' : 'create',
        before,
        after,
      });
      return { registration: after };
    });
  }

  // Ban Giám hiệu duyệt hoặc từ chối đổi tổ hợp: từ chối trả về tổ hợp đã duyệt trước đó
  async decide(currentUser: CurrentUser, childId: string, approve: boolean, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const child = await this.childContext(database, childId);
    this.assertScope(currentUser, [PERMISSION_CODES.classManage], child.org_unit_id);
    return database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('child_subject_combinations')
        .select(['combination_id', 'status', 'previous_combination_id'])
        .where('child_id', '=', childId)
        .executeTakeFirst();
      if (!existing || existing.status !== 'pending') {
        throw ruleViolationError(SECONDARY_RULE_CODE, 'Học sinh không có đề nghị đổi tổ hợp đang chờ duyệt', [
          { field: 'child_id', message: 'Không có đề nghị chờ duyệt' },
        ]);
      }
      const before = await this.registration(transaction, childId);
      const finalCombination = approve ? existing.combination_id : (existing.previous_combination_id as string);
      await transaction
        .updateTable('child_subject_combinations')
        .set({
          combination_id: finalCombination,
          status: 'approved',
          previous_combination_id: null,
          approved_by: origin.actorUserId,
          updated_at: this.clock.now(),
        })
        .where('child_id', '=', childId)
        .execute();
      if (approve) {
        await syncElectives(transaction, childId, finalCombination, origin);
      }
      const after = await this.registration(transaction, childId);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: child.org_unit_id,
        entityName: 'child_subject_combinations',
        entityId: childId,
        action: 'update',
        before,
        after,
      });
      return { registration: after };
    });
  }
}

// Môn tự chọn của học sinh theo đúng môn của tổ hợp đã duyệt
async function syncElectives(
  transaction: Transaction<SchoolYearDatabase>,
  childId: string,
  combinationId: string,
  origin: ChangeOrigin,
) {
  const subjects = await transaction
    .selectFrom('subject_combination_subjects')
    .select('subject_id')
    .where('combination_id', '=', combinationId)
    .execute();
  await transaction.deleteFrom('child_elective_subjects').where('child_id', '=', childId).execute();
  if (subjects.length > 0) {
    await transaction
      .insertInto('child_elective_subjects')
      .values(
        subjects.map((row) => ({ child_id: childId, subject_id: row.subject_id, created_by: origin.actorUserId })),
      )
      .execute();
  }
}

@Controller('children/:id/subject-combination')
export class ChildCombinationsController {
  constructor(private readonly combinations: ChildCombinationsService) {}

  @Get()
  read(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.combinations.read(currentUser, childId);
  }

  @Put()
  register(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!isUuid(body?.combination_id)) {
      throw validationError([{ field: 'combination_id', message: 'Bắt buộc chọn tổ hợp' }]);
    }
    return this.combinations.register(currentUser, childId, body.combination_id, originOf(request, currentUser));
  }

  @Post('approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.combinations.decide(currentUser, childId, true, originOf(request, currentUser));
  }

  @Post('reject')
  @HttpCode(200)
  reject(
    @Param('id', uuidParameter('Mã học sinh không hợp lệ')) childId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.combinations.decide(currentUser, childId, false, originOf(request, currentUser));
  }
}

// Tổ bộ môn (DT-21 phần 21a): tổ chuyên môn theo môn, tổ trưởng, thành viên là giáo viên bộ môn của đơn vị
export interface SubjectTeam {
  id: string;
  code: string;
  name: string;
  school_level: SchoolLevelCode;
  status: CatalogStatus;
  subjects: Array<{ id: string; code: string; name: string }>;
  members: Array<{ staff_user_id: string; staff_name: string; role: 'head' | 'member' }>;
}

async function readTeams(database: Executor, teamId?: string): Promise<SubjectTeam[]> {
  let query = database
    .selectFrom('subject_teams')
    .select(['id', 'code', 'name', 'school_level', 'status'])
    .orderBy('school_level')
    .orderBy('code');
  if (teamId) {
    query = query.where('id', '=', teamId);
  }
  const rows = await query.execute();
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const subjects = await database
    .selectFrom('subject_team_subjects')
    .innerJoin('subjects', 'subjects.id', 'subject_team_subjects.subject_id')
    .select(['subject_team_subjects.team_id', 'subjects.id', 'subjects.code', 'subjects.name'])
    .where('subject_team_subjects.team_id', 'in', ids)
    .orderBy('subjects.order_no')
    .orderBy('subjects.code')
    .execute();
  const members = await database
    .selectFrom('subject_team_members')
    .select(['team_id', 'staff_user_id', 'staff_name', 'role'])
    .where('team_id', 'in', ids)
    .orderBy('role')
    .orderBy('staff_name')
    .execute();
  return rows.map((row) => ({
    ...row,
    subjects: subjects
      .filter((subject) => subject.team_id === row.id)
      .map(({ id, code, name }) => ({ id, code, name })),
    members: members
      .filter((member) => member.team_id === row.id)
      .map(({ staff_user_id, staff_name, role }) => ({ staff_user_id, staff_name, role })),
  }));
}

@Injectable()
export class SubjectTeamsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
    private readonly identityClient: IdentityClient,
  ) {}

  async list(): Promise<SubjectTeam[]> {
    const current = await this.currentSchoolYear.find();
    return current ? readTeams(current.database) : [];
  }

  private async assertSubjects(database: Executor, level: SchoolLevelCode, subjectIds: string[]) {
    if (subjectIds.length === 0) {
      return;
    }
    const rows = await database
      .selectFrom('subjects')
      .select(['id', 'school_level'])
      .where('id', 'in', subjectIds)
      .execute();
    if (subjectIds.some((id) => rows.find((row) => row.id === id)?.school_level !== level)) {
      throw ruleViolationError(SECONDARY_RULE_CODE, 'Môn của tổ không có hoặc không cùng cấp với tổ', [
        { field: 'subject_ids', message: 'Chọn môn cùng cấp với tổ' },
      ]);
    }
  }

  async create(
    input: { code: string; name: string; school_level: 'THCS' | 'THPT'; subject_ids: string[] },
    origin: ChangeOrigin,
  ): Promise<SubjectTeam> {
    await assertLevelEnabled(this.schoolLevels, input.school_level);
    const { database } = await this.currentSchoolYear.require();
    await this.assertSubjects(database, input.school_level, input.subject_ids);
    const id = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('subject_teams')
          .values({
            code: input.code,
            name: input.name,
            school_level: input.school_level,
            created_by: origin.actorUserId,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        if (input.subject_ids.length > 0) {
          await transaction
            .insertInto('subject_team_subjects')
            .values(input.subject_ids.map((subjectId) => ({ team_id: created.id, subject_id: subjectId })))
            .execute();
        }
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'subject_teams',
          entityId: created.id,
          action: 'create',
          before: null,
          after: (await readTeams(transaction, created.id))[0],
        });
        return created.id;
      }),
      'Mã tổ bộ môn đã tồn tại',
      'code',
    );
    return (await readTeams(database, id))[0] as SubjectTeam;
  }

  async update(
    teamId: string,
    changes: { name?: string; status?: CatalogStatus; subject_ids?: string[] },
    origin: ChangeOrigin,
  ): Promise<SubjectTeam> {
    const { database } = await this.currentSchoolYear.require();
    const before = (await readTeams(database, teamId))[0];
    if (!before) {
      throw notFoundError('Không tìm thấy tổ bộ môn', 'subject_team');
    }
    if (changes.subject_ids) {
      await this.assertSubjects(database, before.school_level, changes.subject_ids);
    }
    return database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('subject_teams')
        .set({ name: changes.name, status: changes.status, updated_at: this.clock.now() })
        .where('id', '=', teamId)
        .execute();
      if (changes.subject_ids) {
        await transaction.deleteFrom('subject_team_subjects').where('team_id', '=', teamId).execute();
        if (changes.subject_ids.length > 0) {
          await transaction
            .insertInto('subject_team_subjects')
            .values(changes.subject_ids.map((subjectId) => ({ team_id: teamId, subject_id: subjectId })))
            .execute();
        }
      }
      const after = (await readTeams(transaction, teamId))[0];
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'subject_teams',
        entityId: teamId,
        action: 'update',
        before,
        after,
      });
      return after as SubjectTeam;
    });
  }

  // Thêm hoặc đổi vai trò thành viên: người phải có vai trò giáo viên bộ môn ở đơn vị chọn (kiểm qua dịch vụ định danh);
  // tổ trưởng mới thay tổ trưởng cũ (tổ trưởng cũ thành thành viên)
  async setMember(
    accessToken: string,
    teamId: string,
    input: { org_unit_id: string; staff_user_id: string; role: 'head' | 'member' },
    origin: ChangeOrigin,
  ): Promise<SubjectTeam> {
    const { database } = await this.currentSchoolYear.require();
    const before = (await readTeams(database, teamId))[0];
    if (!before) {
      throw notFoundError('Không tìm thấy tổ bộ môn', 'subject_team');
    }
    const staff = (await this.identityClient.listStaff(accessToken, 'VT-08', input.org_unit_id)).find(
      (entry) => entry.user_id === input.staff_user_id,
    );
    if (!staff) {
      throw validationError([
        { field: 'staff_user_id', message: 'Người được chọn không có vai trò giáo viên bộ môn ở đơn vị đã chọn' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      if (input.role === 'head') {
        await transaction
          .updateTable('subject_team_members')
          .set({ role: 'member' })
          .where('team_id', '=', teamId)
          .where('role', '=', 'head')
          .execute();
      }
      await transaction
        .insertInto('subject_team_members')
        .values({ team_id: teamId, staff_user_id: staff.user_id, staff_name: staff.full_name, role: input.role })
        .onConflict((conflict) =>
          conflict.columns(['team_id', 'staff_user_id']).doUpdateSet({ role: input.role, staff_name: staff.full_name }),
        )
        .execute();
      const after = (await readTeams(transaction, teamId))[0];
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'subject_team_members',
        entityId: teamId,
        action: 'update',
        before,
        after,
      });
      return after as SubjectTeam;
    });
  }

  async removeMember(teamId: string, staffUserId: string, origin: ChangeOrigin): Promise<SubjectTeam> {
    const { database } = await this.currentSchoolYear.require();
    const before = (await readTeams(database, teamId))[0];
    if (!before) {
      throw notFoundError('Không tìm thấy tổ bộ môn', 'subject_team');
    }
    return database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('subject_team_members')
        .where('team_id', '=', teamId)
        .where('staff_user_id', '=', staffUserId)
        .execute();
      const after = (await readTeams(transaction, teamId))[0];
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'subject_team_members',
        entityId: teamId,
        action: 'update',
        before,
        after,
      });
      return after as SubjectTeam;
    });
  }

  // Số tiết mỗi tuần giáo viên được phân (theo phân công giảng dạy của các môn trong tổ) so với số tiết định mức của tổ
  // (không có thì chỉ trả số tiết được phân)
  async loads(teamId: string) {
    const { database } = await this.currentSchoolYear.require();
    const team = (await readTeams(database, teamId))[0];
    if (!team) {
      throw notFoundError('Không tìm thấy tổ bộ môn', 'subject_team');
    }
    const subjectIds = team.subjects.map((subject) => subject.id);
    if (subjectIds.length === 0) {
      return [];
    }
    const rows = await database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
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
        'classes.curriculum_id as class_curriculum_id',
        'classes.school_level',
      ])
      .where('class_staff_assignments.status', '=', 'active')
      .where('class_staff_assignments.subject_id', 'in', subjectIds)
      .execute();
    const defaults = await database
      .selectFrom('curricula')
      .select(['id', 'school_level'])
      .where('is_default', '=', true)
      .execute();
    const totals = new Map<string, { staff_user_id: string; staff_name: string; total_periods: number }>();
    for (const row of rows) {
      const expected =
        row.class_curriculum_id ?? defaults.find((entry) => entry.school_level === row.school_level)?.id ?? null;
      if (row.curriculum_id !== null && row.curriculum_id !== expected) {
        continue;
      }
      const entry = totals.get(row.staff_user_id) ?? {
        staff_user_id: row.staff_user_id,
        staff_name: row.staff_name,
        total_periods: 0,
      };
      entry.total_periods += Number(row.periods_per_week ?? row.planned_periods ?? 0);
      totals.set(row.staff_user_id, entry);
    }
    return [...totals.values()].sort((left, right) => left.staff_name.localeCompare(right.staff_name, 'vi'));
  }
}

@Controller('subject-teams')
export class SubjectTeamsController {
  constructor(private readonly teams: SubjectTeamsService) {}

  @Get()
  list() {
    return this.teams.list();
  }

  @Post()
  @RequirePermission(PERMISSION_CODES.catalogManage)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const code = readRequiredText(body, 'code', errors);
    const name = readRequiredText(body, 'name', errors);
    const level = body?.school_level;
    if (level !== 'THCS' && level !== 'THPT') {
      errors.push({ field: 'school_level', message: 'Tổ bộ môn thuộc THCS hoặc THPT' });
    }
    if (code.length > CODE_MAX) {
      errors.push({ field: 'code', message: `Mã tối đa ${CODE_MAX} ký tự` });
    }
    const subjectIds = readSubjectIds(body, errors) ?? [];
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.teams.create(
      { code, name, school_level: level as 'THCS' | 'THPT', subject_ids: subjectIds },
      originOf(request, currentUser),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  update(
    @Param('id', uuidParameter('Mã tổ bộ môn không hợp lệ')) teamId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    for (const field of ['code', 'school_level']) {
      if (body?.[field] !== undefined) {
        errors.push({ field, message: 'Mã và cấp của tổ không đổi được' });
      }
    }
    const changes = {
      name: body?.name === undefined ? undefined : readRequiredText(body, 'name', errors),
      status: readStatus(body, errors),
      subject_ids: readSubjectIds(body, errors),
    };
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.teams.update(teamId, changes, originOf(request, currentUser));
  }

  @Put(':id/members')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  setMember(
    @Param('id', uuidParameter('Mã tổ bộ môn không hợp lệ')) teamId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (!isUuid(body?.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    if (!isUuid(body?.staff_user_id)) {
      errors.push({ field: 'staff_user_id', message: 'Bắt buộc chọn giáo viên' });
    }
    const role = body?.role ?? 'member';
    if (role !== 'head' && role !== 'member') {
      errors.push({ field: 'role', message: 'Vai trò là head hoặc member' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.teams.setMember(
      readBearerToken(request.header('authorization')),
      teamId,
      {
        org_unit_id: body?.org_unit_id as string,
        staff_user_id: body?.staff_user_id as string,
        role: role as 'head' | 'member',
      },
      originOf(request, currentUser),
    );
  }

  @Delete(':id/members/:staffUserId')
  @RequirePermission(PERMISSION_CODES.catalogManage)
  removeMember(
    @Param('id', uuidParameter('Mã tổ bộ môn không hợp lệ')) teamId: string,
    @Param('staffUserId', uuidParameter('Mã giáo viên không hợp lệ')) staffUserId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.teams.removeMember(teamId, staffUserId, originOf(request, currentUser));
  }

  @Get(':id/loads')
  loads(@Param('id', uuidParameter('Mã tổ bộ môn không hợp lệ')) teamId: string) {
    return this.teams.loads(teamId);
  }
}
