import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readInteger,
  readOptionalUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { TeachingAccess } from './teaching-access.js';
import { check, readDate, readName, readText } from './teaching-fields.js';

// Lĩnh vực và nhóm bài học, chủ đề, bài học (P03-01, P03-03, P03-08; BR-01, BR-75; YCTD-80). Danh mục thuộc đơn vị, danh
// mục của Trường chính dùng chung cho mọi đơn vị. Bài học do giáo viên soạn, chỉ người soạn sửa; bài học chia sẻ thì giáo
// viên khác trong đơn vị dùng được, bài học riêng chỉ người soạn và người quản lý, tổ trưởng của đơn vị thấy. Lọc bài học
// theo lĩnh vực chỉ trả bài học thuộc lĩnh vực đó (CT-110)
type CatalogTable = 'lesson_domains' | 'lesson_groups' | 'themes';

const CATALOG_LABELS: Record<CatalogTable, string> = {
  lesson_domains: 'lĩnh vực',
  lesson_groups: 'nhóm bài học',
  themes: 'chủ đề',
};

interface LessonInput {
  org_unit_id?: string | null;
  theme_id?: string | null;
  domain_id?: string | null;
  lesson_group_id?: string | null;
  name?: string;
  age_group?: string | null;
  objectives?: string;
  materials?: string | null;
  is_shared?: boolean;
  status?: RecordStatus;
}

@Injectable()
export class TeachingCatalogsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: TeachingAccess,
    private readonly clock: Clock,
  ) {}

  private async viewUnits(currentUser: CurrentUser, database: Kysely<SchoolYearDatabase>) {
    const scope = await this.access.staffViewScope(currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được dữ liệu giảng dạy');
    }
    return this.access.visibleUnitIds(database, scope);
  }

  private async assertCanManageUnit(currentUser: CurrentUser, permission: string, orgUnitId: string) {
    const scope = await this.access.scopeOfRoles(
      currentUser,
      currentUser.description.assignments.map((assignment) => assignment.role_code),
      permission,
    );
    if (!this.access.inScope(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn', [
        { field: 'org_unit_id', message: permission },
      ]);
    }
  }

  async listCatalog(
    currentUser: CurrentUser,
    table: CatalogTable,
    filter: { orgUnitId: string | null; domainId: string | null; status: RecordStatus | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const units = await this.viewUnits(currentUser, database);
    let query = database.selectFrom(table).selectAll();
    if (units) {
      query = query.where('org_unit_id', 'in', units);
    }
    if (filter.orgUnitId) {
      query = query.where('org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.status) {
      query = query.where('status', '=', filter.status);
    }
    if (table === 'lesson_groups' && filter.domainId) {
      return database
        .selectFrom('lesson_groups')
        .selectAll()
        .where('domain_id', '=', filter.domainId)
        .where((expression) => (units ? expression('org_unit_id', 'in', units) : expression.lit(true)))
        .where((expression) => (filter.status ? expression('status', '=', filter.status) : expression.lit(true)))
        .orderBy('order_no')
        .orderBy('name')
        .execute();
    }
    if (table === 'themes') {
      return query.orderBy('start_date').orderBy('name').execute();
    }
    return query.orderBy('order_no').orderBy('name').execute();
  }

  async createDomain(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanManageUnit(currentUser, PERMISSION_CODES.curriculumManage, input.org_unit_id);
    return this.insertCatalog(database, 'lesson_domains', { ...input, created_by: origin.actorUserId }, origin);
  }

  async createGroup(
    currentUser: CurrentUser,
    input: { domain_id: string; name: string; order_no: number },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const domain = await database
      .selectFrom('lesson_domains')
      .select(['id', 'org_unit_id', 'status'])
      .where('id', '=', input.domain_id)
      .executeTakeFirst();
    if (!domain) {
      throw notFoundError('Không tìm thấy lĩnh vực', 'lesson_domain');
    }
    await this.assertCanManageUnit(currentUser, PERMISSION_CODES.curriculumManage, domain.org_unit_id);
    if (domain.status !== 'active') {
      throw ruleViolationError('BR-75', 'Lĩnh vực đã ngừng sử dụng');
    }
    return this.insertCatalog(
      database,
      'lesson_groups',
      { ...input, org_unit_id: domain.org_unit_id, created_by: origin.actorUserId },
      origin,
    );
  }

  async createTheme(
    currentUser: CurrentUser,
    input: { org_unit_id: string; name: string; age_group: string | null; start_date: string; end_date: string },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    await this.assertCanManageUnit(currentUser, PERMISSION_CODES.curriculumManage, input.org_unit_id);
    return this.insertCatalog(database, 'themes', { ...input, created_by: origin.actorUserId }, origin);
  }

  private async insertCatalog(
    database: Kysely<SchoolYearDatabase>,
    table: CatalogTable,
    values: Record<string, unknown> & { org_unit_id: string },
    origin: ChangeOrigin,
  ) {
    return database.transaction().execute(async (transaction) => {
      const created = (await conflictOnDuplicate(
        transaction
          .insertInto(table)
          .values(values as never)
          .returningAll()
          .executeTakeFirstOrThrow(),
        `Tên ${CATALOG_LABELS[table]} đã có`,
        'name',
      )) as { id: string };
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: values.org_unit_id,
        entityName: table,
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Sửa tên, thứ tự, trạng thái; không xóa cứng, ngừng sử dụng bằng trạng thái (BR-75)
  async updateCatalog(
    currentUser: CurrentUser,
    table: CatalogTable,
    id: string,
    changes: Record<string, unknown>,
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const before = (await database.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()) as
      | ({ id: string; org_unit_id: string } & Record<string, unknown>)
      | undefined;
    if (!before) {
      throw notFoundError(`Không tìm thấy ${CATALOG_LABELS[table]}`, table);
    }
    await this.assertCanManageUnit(currentUser, PERMISSION_CODES.curriculumManage, before.org_unit_id);
    if (Object.keys(changes).length === 0) {
      return before;
    }
    if (
      table === 'themes' &&
      String(changes.end_date ?? before.end_date) < String(changes.start_date ?? before.start_date)
    ) {
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' },
      ]);
    }
    return database.transaction().execute(async (transaction) => {
      const after = await conflictOnDuplicate(
        transaction
          .updateTable(table)
          .set({ ...changes, updated_at: this.clock.now() } as never)
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
        `Tên ${CATALOG_LABELS[table]} đã có`,
        'name',
      );
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: table,
        entityId: id,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // CT-110: lọc theo chủ đề, lĩnh vực, nhóm, độ tuổi; giáo viên chỉ thấy bài học của mình và bài học được chia sẻ
  async listLessons(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      themeId: string | null;
      domainId: string | null;
      lessonGroupId: string | null;
      ageGroup: string | null;
      mine: boolean;
      status: RecordStatus | null;
    },
  ) {
    const { database } = await this.currentSchoolYear.require();
    const units = await this.viewUnits(currentUser, database);
    let query = database
      .selectFrom('lessons')
      .leftJoin('themes', 'themes.id', 'lessons.theme_id')
      .leftJoin('lesson_domains', 'lesson_domains.id', 'lessons.domain_id')
      .leftJoin('lesson_groups', 'lesson_groups.id', 'lessons.lesson_group_id')
      .selectAll('lessons')
      .select([
        'themes.name as theme_name',
        'lesson_domains.name as domain_name',
        'lesson_groups.name as lesson_group_name',
      ])
      .where('lessons.status', '=', filter.status ?? 'active')
      .orderBy('lessons.name');
    if (units) {
      query = query.where('lessons.org_unit_id', 'in', units);
    }
    if (!this.access.hasOfficeRole(currentUser) || filter.mine) {
      query = filter.mine
        ? query.where('lessons.created_by', '=', currentUser.id)
        : query.where((expression) =>
            expression.or([
              expression('lessons.created_by', '=', currentUser.id),
              expression('lessons.is_shared', '=', true),
            ]),
          );
    }
    if (filter.orgUnitId) {
      query = query.where('lessons.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.themeId) {
      query = query.where('lessons.theme_id', '=', filter.themeId);
    }
    if (filter.domainId) {
      query = query.where('lessons.domain_id', '=', filter.domainId);
    }
    if (filter.lessonGroupId) {
      query = query.where('lessons.lesson_group_id', '=', filter.lessonGroupId);
    }
    if (filter.ageGroup) {
      query = query.where('lessons.age_group', '=', filter.ageGroup);
    }
    return query.execute();
  }

  async createLesson(currentUser: CurrentUser, input: LessonInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    let orgUnitId = input.org_unit_id ?? null;
    const scope = await this.access.scopeOfRoles(
      currentUser,
      currentUser.description.assignments.map((assignment) => assignment.role_code),
      PERMISSION_CODES.lessonManage,
    );
    if (!orgUnitId && !scope.wholeSchool && scope.orgUnitIds.length > 0) {
      orgUnitId = scope.orgUnitIds[0] ?? null;
    }
    if (!orgUnitId) {
      if (!currentUser.hasPermission(PERMISSION_CODES.lessonManage)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền soạn bài học');
      }
      throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [
        { field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' },
      ]);
    }
    if (!this.access.inScope(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền soạn bài học ở đơn vị này');
    }
    const references = await this.resolveReferences(database, orgUnitId, input);
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('lessons')
        .values({
          org_unit_id: orgUnitId,
          ...references,
          name: input.name ?? '',
          age_group: input.age_group ?? null,
          objectives: input.objectives ?? '',
          materials: input.materials ?? null,
          is_shared: input.is_shared ?? false,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'lessons',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateLesson(currentUser: CurrentUser, lessonId: string, input: LessonInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const before = await database.selectFrom('lessons').selectAll().where('id', '=', lessonId).executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy bài học', 'lesson');
    }
    if (before.created_by !== currentUser.id || !currentUser.hasPermission(PERMISSION_CODES.lessonManage)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người soạn sửa được bài học');
    }
    const referenceInput = {
      theme_id: input.theme_id === undefined ? before.theme_id : input.theme_id,
      domain_id: input.domain_id === undefined ? before.domain_id : input.domain_id,
      lesson_group_id: input.lesson_group_id === undefined ? before.lesson_group_id : input.lesson_group_id,
    };
    if (input.lesson_group_id && input.domain_id === undefined) {
      referenceInput.domain_id = null;
    }
    const references = await this.resolveReferences(database, before.org_unit_id, referenceInput);
    const changes = {
      ...references,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.age_group !== undefined ? { age_group: input.age_group } : {}),
      ...(input.objectives !== undefined ? { objectives: input.objectives } : {}),
      ...(input.materials !== undefined ? { materials: input.materials } : {}),
      ...(input.is_shared !== undefined ? { is_shared: input.is_shared } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    return database.transaction().execute(async (transaction) => {
      const after = await transaction
        .updateTable('lessons')
        .set({ ...changes, updated_at: this.clock.now() })
        .where('id', '=', lessonId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'lessons',
        entityId: lessonId,
        action: 'update',
        before,
        after,
      });
      return after;
    });
  }

  // Chủ đề, lĩnh vực, nhóm gán cho bài học phải đang dùng, thuộc đơn vị của bài học hoặc Trường chính; nhóm phải thuộc
  // lĩnh vực đã chọn, chọn nhóm mà chưa chọn lĩnh vực thì lấy lĩnh vực của nhóm
  private async resolveReferences(
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string,
    input: Pick<LessonInput, 'theme_id' | 'domain_id' | 'lesson_group_id'>,
  ) {
    const root = await this.access.rootUnitId(database);
    const allowed = [orgUnitId, ...(root ? [root] : [])];
    const errors: FieldError[] = [];
    const find = async (table: CatalogTable, id: string | null | undefined, field: string) => {
      if (!id) {
        return null;
      }
      const row = (await database
        .selectFrom(table)
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()) as { id: string; org_unit_id: string; status: string; domain_id?: string } | undefined;
      if (!row || !allowed.includes(row.org_unit_id) || row.status !== 'active') {
        errors.push({ field, message: `Không tìm thấy ${CATALOG_LABELS[table]} đang dùng của đơn vị` });
        return null;
      }
      return row;
    };
    const theme = await find('themes', input.theme_id, 'theme_id');
    const domain = await find('lesson_domains', input.domain_id, 'domain_id');
    const group = await find('lesson_groups', input.lesson_group_id, 'lesson_group_id');
    if (group && domain && group.domain_id !== domain.id) {
      errors.push({ field: 'lesson_group_id', message: 'Nhóm bài học không thuộc lĩnh vực đã chọn' });
    }
    check(errors);
    return {
      theme_id: theme?.id ?? null,
      domain_id: domain?.id ?? group?.domain_id ?? null,
      lesson_group_id: group?.id ?? null,
    };
  }
}

function readCatalogChanges(body: RequestBody, table: CatalogTable): Record<string, unknown> {
  const errors: FieldError[] = [];
  const changes: Record<string, unknown> = {};
  if (body?.name !== undefined) {
    changes.name = readName(body, 'name', errors);
  }
  const status = readStatus(body, errors);
  if (status) {
    changes.status = status;
  }
  if (table === 'themes') {
    for (const field of ['start_date', 'end_date']) {
      if (body?.[field] !== undefined) {
        changes[field] = readDate(body, field, errors, true);
      }
    }
    if (body?.age_group !== undefined) {
      changes.age_group = readText(body, 'age_group', errors, { maximum: 50 });
    }
  } else {
    const order = readInteger(body, 'order_no', errors, { min: 0, max: 1000 });
    if (order !== undefined) {
      changes.order_no = order;
    }
  }
  check(errors);
  return changes;
}

function readLessonInput(body: RequestBody, creating: boolean): LessonInput {
  const errors: FieldError[] = [];
  const input: LessonInput = {};
  for (const field of ['org_unit_id', 'theme_id', 'domain_id', 'lesson_group_id'] as const) {
    const value = readOptionalUuid(body, field, errors);
    if (value !== undefined) {
      input[field] = value;
    }
  }
  if (creating || body?.name !== undefined) {
    input.name = readName(body, 'name', errors);
  }
  if (creating || body?.objectives !== undefined) {
    input.objectives = readText(body, 'objectives', errors, { required: true }) ?? '';
  }
  if (body?.age_group !== undefined) {
    input.age_group = readText(body, 'age_group', errors, { maximum: 50 });
  }
  if (body?.materials !== undefined) {
    input.materials = readText(body, 'materials', errors);
  }
  if (body?.is_shared !== undefined) {
    if (typeof body.is_shared !== 'boolean') {
      errors.push({ field: 'is_shared', message: 'Chia sẻ là true hoặc false' });
    } else {
      input.is_shared = body.is_shared;
    }
  }
  const status = readStatus(body, errors);
  if (status && !creating) {
    input.status = status;
  }
  check(errors);
  return input;
}

function queryUuid(query: Record<string, string | undefined>, field: string): string | null {
  const value = query[field];
  if (value === undefined || value === '') {
    return null;
  }
  if (!isUuid(value)) {
    throw new ApplicationError('ERR_VALIDATION', 'Dữ liệu không hợp lệ', [{ field, message: 'Mã không hợp lệ' }]);
  }
  return value;
}

function queryStatus(query: Record<string, string | undefined>): RecordStatus | null {
  const errors: FieldError[] = [];
  const status = readStatus({ status: query.status }, errors);
  check(errors);
  return status ?? null;
}

@Controller()
export class TeachingCatalogsController {
  constructor(private readonly catalogs: TeachingCatalogsService) {}

  @Get('lesson-domains')
  listDomains(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.listCatalog(currentUser, 'lesson_domains', {
      orgUnitId: queryUuid(query, 'org_unit_id'),
      domainId: null,
      status: queryStatus(query),
    });
  }

  @Post('lesson-domains')
  @HttpCode(201)
  createDomain(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readOptionalUuid(body, 'org_unit_id', errors);
    if (!orgUnitId) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    const input = {
      org_unit_id: orgUnitId ?? '',
      name: readName(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 1000 }) ?? 0,
    };
    check(errors);
    return this.catalogs.createDomain(currentUser, input, originOf(request, currentUser));
  }

  @Patch('lesson-domains/:id')
  updateDomain(
    @Param('id', uuidParameter('Mã lĩnh vực không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.catalogs.updateCatalog(
      currentUser,
      'lesson_domains',
      id,
      readCatalogChanges(body, 'lesson_domains'),
      originOf(request, currentUser),
    );
  }

  @Get('lesson-groups')
  listGroups(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.listCatalog(currentUser, 'lesson_groups', {
      orgUnitId: queryUuid(query, 'org_unit_id'),
      domainId: queryUuid(query, 'domain_id'),
      status: queryStatus(query),
    });
  }

  @Post('lesson-groups')
  @HttpCode(201)
  createGroup(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const domainId = readOptionalUuid(body, 'domain_id', errors);
    if (!domainId) {
      errors.push({ field: 'domain_id', message: 'Bắt buộc chọn lĩnh vực' });
    }
    const input = {
      domain_id: domainId ?? '',
      name: readName(body, 'name', errors),
      order_no: readInteger(body, 'order_no', errors, { min: 0, max: 1000 }) ?? 0,
    };
    check(errors);
    return this.catalogs.createGroup(currentUser, input, originOf(request, currentUser));
  }

  @Patch('lesson-groups/:id')
  updateGroup(
    @Param('id', uuidParameter('Mã nhóm bài học không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.catalogs.updateCatalog(
      currentUser,
      'lesson_groups',
      id,
      readCatalogChanges(body, 'lesson_groups'),
      originOf(request, currentUser),
    );
  }

  @Get('themes')
  listThemes(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.listCatalog(currentUser, 'themes', {
      orgUnitId: queryUuid(query, 'org_unit_id'),
      domainId: null,
      status: queryStatus(query),
    });
  }

  @Post('themes')
  @HttpCode(201)
  createTheme(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const orgUnitId = readOptionalUuid(body, 'org_unit_id', errors);
    if (!orgUnitId) {
      errors.push({ field: 'org_unit_id', message: 'Bắt buộc chọn đơn vị' });
    }
    const input = {
      org_unit_id: orgUnitId ?? '',
      name: readName(body, 'name', errors),
      age_group: readText(body, 'age_group', errors, { maximum: 50 }),
      start_date: readDate(body, 'start_date', errors, true) ?? '',
      end_date: readDate(body, 'end_date', errors, true) ?? '',
    };
    if (input.start_date && input.end_date && input.end_date < input.start_date) {
      errors.push({ field: 'end_date', message: 'Ngày kết thúc không trước ngày bắt đầu' });
    }
    check(errors);
    return this.catalogs.createTheme(currentUser, input, originOf(request, currentUser));
  }

  @Patch('themes/:id')
  updateTheme(
    @Param('id', uuidParameter('Mã chủ đề không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.catalogs.updateCatalog(
      currentUser,
      'themes',
      id,
      readCatalogChanges(body, 'themes'),
      originOf(request, currentUser),
    );
  }

  @Get('lessons')
  listLessons(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.listLessons(currentUser, {
      orgUnitId: queryUuid(query, 'org_unit_id'),
      themeId: queryUuid(query, 'theme_id'),
      domainId: queryUuid(query, 'domain_id'),
      lessonGroupId: queryUuid(query, 'lesson_group_id'),
      ageGroup: query.age_group || null,
      mine: query.mine === 'true',
      status: queryStatus(query),
    });
  }

  @Post('lessons')
  @HttpCode(201)
  createLesson(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.catalogs.createLesson(currentUser, readLessonInput(body, true), originOf(request, currentUser));
  }

  @Patch('lessons/:id')
  updateLesson(
    @Param('id', uuidParameter('Mã bài học không hợp lệ')) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.catalogs.updateLesson(currentUser, id, readLessonInput(body, false), originOf(request, currentUser));
  }
}
