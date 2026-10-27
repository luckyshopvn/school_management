import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { ChildScope } from '../children/child-scope.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readOptionalUuid,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Nhóm học sinh (YCTD-102, theo mục 4.1.6, 4.1.7 hệ thống của Sở GD&ĐT TP.HCM): nhóm có tên trong một đơn vị (năng khiếu vẽ,
// tiếng Anh, chăm sóc đặc biệt...), có thể có giáo viên phụ trách; thêm trẻ theo lớp, bớt trẻ; một trẻ thuộc nhiều nhóm.
// Ban Giám hiệu và quản lý đơn vị (P02.child-group.manage) quản lý nhóm trong phạm vi đơn vị. Giáo viên xem nhóm mình phụ
// trách (thấy mọi trẻ của nhóm) và nhóm có trẻ thuộc lớp mình được phân công (chỉ thấy trẻ trong phạm vi xem trẻ của mình)
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const MAXIMUM_NAME = 200;
const MAXIMUM_DESCRIPTION = 1000;
const MAXIMUM_MEMBERS_PER_REQUEST = 200;

@Injectable()
export class ChildGroupsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly childScope: ChildScope,
    private readonly clock: Clock,
  ) {}

  private manageScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.childGroupManage);
  }

  private async assertManage(currentUser: CurrentUser, orgUnitId: string) {
    const scope = await this.manageScope(currentUser);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý nhóm học sinh của đơn vị này');
    }
  }

  private groupQuery(database: Executor) {
    return (
      database
        .selectFrom('child_groups')
        .leftJoin('staff', 'staff.id', 'child_groups.teacher_staff_id')
        .selectAll('child_groups')
        .select([
          'staff.full_name as teacher_name',
          'staff.user_id as teacher_user_id',
          (expression) =>
            expression
              .selectFrom('child_group_members')
              .select(expression.fn.countAll<string>().as('count'))
              .whereRef('child_group_members.group_id', '=', 'child_groups.id')
              .as('member_count'),
        ])
        // Nhóm thuộc bộ nhóm của lớp (DT-28 phần 28a) quản lý ở màn hình bộ nhóm, không hiện ở 4.1.6
        .where('child_groups.group_set_id', 'is', null)
    );
  }

  // Nhóm giáo viên được xem: nhóm mình phụ trách hoặc có trẻ thuộc lớp mình được phân công
  private async teacherGroupIds(database: Executor, currentUser: CurrentUser): Promise<string[]> {
    const rows = await database
      .selectFrom('child_groups')
      .leftJoin('staff', 'staff.id', 'child_groups.teacher_staff_id')
      .select('child_groups.id')
      .where('child_groups.group_set_id', 'is', null)
      .where((expression) =>
        expression.or([
          expression('staff.user_id', '=', currentUser.id),
          expression(
            'child_groups.id',
            'in',
            expression
              .selectFrom('child_group_members')
              .innerJoin('class_enrollments', 'class_enrollments.child_id', 'child_group_members.child_id')
              .innerJoin('class_staff_assignments', 'class_staff_assignments.class_id', 'class_enrollments.class_id')
              .select('child_group_members.group_id')
              .where('class_enrollments.is_current', '=', true)
              .where('class_staff_assignments.staff_user_id', '=', currentUser.id)
              .where('class_staff_assignments.status', '=', 'active'),
          ),
        ]),
      )
      .execute();
    return rows.map((row) => row.id);
  }

  async list(currentUser: CurrentUser, orgUnitId: string | null) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.manageScope(currentUser);
    const teacherIds = await this.teacherGroupIds(database, currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0 && teacherIds.length === 0) {
      return [];
    }
    let query = this.groupQuery(database).orderBy('child_groups.name');
    if (!scope.wholeSchool) {
      const unitIds = scope.orgUnitIds;
      query = query.where((expression) =>
        expression.or([
          ...(unitIds.length ? [expression('child_groups.org_unit_id', 'in', unitIds)] : []),
          ...(teacherIds.length ? [expression('child_groups.id', 'in', teacherIds)] : []),
        ]),
      );
    }
    if (orgUnitId) {
      query = query.where('child_groups.org_unit_id', '=', orgUnitId);
    }
    const rows = await query.execute();
    return rows.map((row) => ({
      ...view(row),
      can_manage: scope.wholeSchool || scope.orgUnitIds.includes(row.org_unit_id),
    }));
  }

  private async load(database: Executor, groupId: string) {
    const group = await this.groupQuery(database).where('child_groups.id', '=', groupId).executeTakeFirst();
    if (!group) {
      throw notFoundError('Không tìm thấy nhóm học sinh', 'child_group');
    }
    return group;
  }

  private async assertTeacher(database: Executor, orgUnitId: string, staffId: string | null) {
    if (!staffId) {
      return;
    }
    const staff = await database
      .selectFrom('staff')
      .select(['org_unit_id', 'status'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff || staff.status !== 'active' || staff.org_unit_id !== orgUnitId) {
      throw validationError([
        { field: 'teacher_staff_id', message: 'Giáo viên phụ trách phải là nhân sự đang làm việc của đơn vị' },
      ]);
    }
  }

  async create(
    currentUser: CurrentUser,
    input: { orgUnitId: string; name: string; description: string | null; teacherStaffId: string | null },
    origin: ChangeOrigin,
  ) {
    await this.assertManage(currentUser, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    await this.assertTeacher(database, input.orgUnitId, input.teacherStaffId);
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('child_groups')
          .values({
            org_unit_id: input.orgUnitId,
            name: input.name,
            description: input.description,
            teacher_staff_id: input.teacherStaffId,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'child_groups',
          entityId: row.id,
          action: 'create',
          before: null,
          after: row,
        });
        return row;
      }),
      'Đơn vị đã có nhóm trùng tên',
      'name',
    );
    return this.read(currentUser, created.id);
  }

  async update(
    currentUser: CurrentUser,
    groupId: string,
    patch: { name?: string; description?: string | null; teacherStaffId?: string | null; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const group = await this.load(database, groupId);
    await this.assertManage(currentUser, group.org_unit_id);
    if (patch.teacherStaffId !== undefined) {
      await this.assertTeacher(database, group.org_unit_id, patch.teacherStaffId);
    }
    await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .updateTable('child_groups')
          .set({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.teacherStaffId !== undefined ? { teacher_staff_id: patch.teacherStaffId } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            updated_at: this.clock.now(),
          })
          .where('id', '=', groupId)
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: group.org_unit_id,
          entityName: 'child_groups',
          entityId: groupId,
          action: 'update',
          before: group,
          after: row,
        });
      }),
      'Đơn vị đã có nhóm trùng tên',
      'name',
    );
    return this.read(currentUser, groupId);
  }

  // Xem nhóm và trẻ của nhóm; giáo viên không phụ trách nhóm chỉ thấy trẻ trong phạm vi xem trẻ của mình
  async read(currentUser: CurrentUser, groupId: string) {
    const { database } = await this.currentSchoolYear.require();
    const group = await this.load(database, groupId);
    const scope = await this.manageScope(currentUser);
    const canManage = scope.wholeSchool || scope.orgUnitIds.includes(group.org_unit_id);
    const inCharge = group.teacher_user_id === currentUser.id;
    if (!canManage && !inCharge && !(await this.teacherGroupIds(database, currentUser)).includes(groupId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem nhóm học sinh này');
    }
    let members = database
      .selectFrom('child_group_members')
      .innerJoin('children', 'children.id', 'child_group_members.child_id')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id as child_id',
        'children.full_name',
        'children.dob',
        'children.status',
        'classes.id as class_id',
        'classes.name as class_name',
        'child_group_members.created_at as added_at',
      ])
      .where('child_group_members.group_id', '=', groupId)
      .orderBy('classes.name')
      .orderBy('children.full_name');
    if (!canManage && !inCharge) {
      members = members.where(this.childScope.filter(await this.childScope.resolve(currentUser, database)));
    }
    return { ...view(group), can_manage: canManage, members: await members.execute() };
  }

  async addMembers(currentUser: CurrentUser, groupId: string, childIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const group = await this.load(database, groupId);
    await this.assertManage(currentUser, group.org_unit_id);
    if (group.status !== 'active') {
      throw validationError([{ field: 'group', message: 'Nhóm đã ngừng dùng' }]);
    }
    const children = await database
      .selectFrom('children')
      .select(['id', 'org_unit_id', 'status'])
      .where('id', 'in', childIds)
      .execute();
    if (
      children.length !== childIds.length ||
      children.some((child) => child.org_unit_id !== group.org_unit_id || child.status !== 'active')
    ) {
      throw validationError([{ field: 'child_ids', message: 'Chỉ thêm trẻ đang học của đơn vị có nhóm' }]);
    }
    await database.transaction().execute(async (transaction) => {
      const added = await transaction
        .insertInto('child_group_members')
        .values(childIds.map((childId) => ({ group_id: groupId, child_id: childId, added_by: origin.actorUserId })))
        .onConflict((conflict) => conflict.columns(['group_id', 'child_id']).doNothing())
        .returning('child_id')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: group.org_unit_id,
        entityName: 'child_group_members',
        entityId: groupId,
        action: 'create',
        before: null,
        after: { added: added.map((row) => row.child_id) },
      });
    });
    return this.read(currentUser, groupId);
  }

  async removeMembers(currentUser: CurrentUser, groupId: string, childIds: string[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const group = await this.load(database, groupId);
    await this.assertManage(currentUser, group.org_unit_id);
    await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom('child_group_members')
        .where('group_id', '=', groupId)
        .where('child_id', 'in', childIds)
        .returning('child_id')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: group.org_unit_id,
        entityName: 'child_group_members',
        entityId: groupId,
        action: 'delete',
        before: { removed: removed.map((row) => row.child_id) },
        after: null,
      });
    });
    return this.read(currentUser, groupId);
  }
}

function view<Row extends { member_count: string | number | null; teacher_user_id?: string | null }>(row: Row) {
  // Mã tài khoản của giáo viên phụ trách chỉ dùng để phân quyền, không trả ra
  const rest: Partial<Row> = { ...row };
  delete rest.teacher_user_id;
  return { ...(rest as Omit<Row, 'teacher_user_id'>), member_count: Number(row.member_count ?? 0) };
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readText(body: RequestBody, field: string, errors: FieldError[], maximum: number, required: boolean) {
  const value = body?.[field];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập' });
    }
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > maximum) {
    errors.push({ field, message: `Chữ tối đa ${maximum} ký tự` });
    return null;
  }
  return value.trim();
}

function readChildIds(body: RequestBody, errors: FieldError[]): string[] {
  const value = body?.child_ids;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAXIMUM_MEMBERS_PER_REQUEST ||
    value.some((id) => !isUuid(id))
  ) {
    errors.push({ field: 'child_ids', message: `Chọn từ 1 đến ${MAXIMUM_MEMBERS_PER_REQUEST} trẻ` });
    return [];
  }
  return [...new Set(value as string[])];
}

@Controller()
export class ChildGroupsController {
  constructor(private readonly groups: ChildGroupsService) {}

  @Get('child-groups')
  list(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && orgUnitId !== '' && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.groups.list(currentUser, orgUnitId || null);
  }

  @Post('child-groups')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      orgUnitId: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      name: readText(body, 'name', errors, MAXIMUM_NAME, true) ?? '',
      description: readText(body, 'description', errors, MAXIMUM_DESCRIPTION, false),
      teacherStaffId: readOptionalUuid(body, 'teacher_staff_id', errors) ?? null,
    };
    check(errors);
    return this.groups.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('child-groups/:id')
  read(
    @Param('id', uuidParameter('Mã nhóm không hợp lệ')) groupId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.groups.read(currentUser, groupId);
  }

  @Patch('child-groups/:id')
  update(
    @Param('id', uuidParameter('Mã nhóm không hợp lệ')) groupId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const patch = {
      name: body?.name === undefined ? undefined : (readText(body, 'name', errors, MAXIMUM_NAME, true) ?? ''),
      description:
        body?.description === undefined ? undefined : readText(body, 'description', errors, MAXIMUM_DESCRIPTION, false),
      teacherStaffId: readOptionalUuid(body, 'teacher_staff_id', errors),
      status: readStatus(body, errors),
    };
    check(errors);
    return this.groups.update(currentUser, groupId, patch, originOf(request, currentUser));
  }

  @Post('child-groups/:id/members')
  @HttpCode(200)
  addMembers(
    @Param('id', uuidParameter('Mã nhóm không hợp lệ')) groupId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childIds = readChildIds(body, errors);
    check(errors);
    return this.groups.addMembers(currentUser, groupId, childIds, originOf(request, currentUser));
  }

  @Post('child-groups/:id/members/remove')
  @HttpCode(200)
  removeMembers(
    @Param('id', uuidParameter('Mã nhóm không hợp lệ')) groupId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const childIds = readChildIds(body, errors);
    check(errors);
    return this.groups.removeMembers(currentUser, groupId, childIds, originOf(request, currentUser));
  }
}
