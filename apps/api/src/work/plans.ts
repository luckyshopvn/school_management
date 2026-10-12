import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { PlanStatus, SchoolYearDatabase, WorkPeriodType } from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import type { Kysely, Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { isUuid, notFoundError, readRequiredUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { assertAssignable, insertAssignedTask } from './tasks.js';
import { hasAnyScope, inScope, readPeriod, readWorkDate, readWorkText, WorkAccess } from './work-access.js';

// Kế hoạch theo kỳ và theo dõi tiến độ kế hoạch (P09-03, P09-04; BR-01; YCTD-81). Quản lý đơn vị lập kế hoạch nháp của
// đơn vị được gán gồm mục tiêu và các đầu việc có người phụ trách, hạn; kích hoạt thì mỗi đầu việc thành một việc được
// giao cho người phụ trách (nhận thông báo) và tiến độ kế hoạch tính theo tiến độ các việc đó; đóng kế hoạch thì không
// thêm đầu việc được nữa
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const MAXIMUM_ITEMS = 100;

export interface PlanItemInput {
  content: string;
  ownerStaffId: string;
  dueDate: string;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: WorkAccess,
    private readonly clock: Clock,
  ) {}

  async list(currentUser: CurrentUser, filter: { orgUnitId: string | null; status: PlanStatus | null }) {
    const scope = await this.access.readScope(currentUser, PERMISSION_CODES.planManage);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem kế hoạch');
    }
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('plans')
      .innerJoin('org_units', 'org_units.id', 'plans.org_unit_id')
      .selectAll('plans')
      .select('org_units.name as unit_name')
      .orderBy('plans.created_at', 'desc');
    if (filter.orgUnitId) {
      query = query.where('plans.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('plans.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.status) {
      query = query.where('plans.status', '=', filter.status);
    }
    const plans = await query.execute();
    const items = plans.length
      ? await this.itemsOf(
          database,
          plans.map((plan) => plan.id),
        )
      : [];
    return plans.map((plan) => ({ ...plan, ...summarize(items.filter((item) => item.plan_id === plan.id)) }));
  }

  async read(currentUser: CurrentUser, planId: string) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.load(database, planId);
    const scope = await this.access.readScope(currentUser, PERMISSION_CODES.planManage);
    if (!inScope(scope, plan.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem kế hoạch này');
    }
    const items = await this.itemsOf(database, [planId]);
    return {
      ...plan,
      ...summarize(items),
      can_manage: await this.access.canManage(currentUser, PERMISSION_CODES.planManage, plan.org_unit_id),
      items,
    };
  }

  async create(
    currentUser: CurrentUser,
    input: {
      orgUnitId: string;
      periodType: WorkPeriodType;
      periodValue: string;
      title: string;
      objectives: string | null;
      items: PlanItemInput[];
    },
    origin: ChangeOrigin,
  ) {
    await this.assertManager(currentUser, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    await this.assertOwners(database, input.orgUnitId, input.items);
    const created = await database.transaction().execute(async (transaction) => {
      const plan = await transaction
        .insertInto('plans')
        .values({
          org_unit_id: input.orgUnitId,
          period_type: input.periodType,
          period_value: input.periodValue,
          title: input.title,
          objectives: input.objectives,
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.insertItems(transaction, plan.id, input.items, 0);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.orgUnitId,
        entityName: 'plans',
        entityId: plan.id,
        action: 'create',
        before: null,
        after: { ...plan, items: input.items },
      });
      return plan;
    });
    return this.read(currentUser, created.id);
  }

  // Sửa kế hoạch nháp: tiêu đề, mục tiêu, thay toàn bộ đầu việc
  async update(
    currentUser: CurrentUser,
    planId: string,
    patch: { title?: string; objectives?: string | null; items?: PlanItemInput[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.load(database, planId);
    await this.assertManager(currentUser, plan.org_unit_id);
    if (plan.status !== 'draft') {
      throw ruleViolationError('P09-03', 'Chỉ sửa được kế hoạch nháp; kế hoạch đang thực hiện chỉ thêm đầu việc');
    }
    if (patch.items) {
      await this.assertOwners(database, plan.org_unit_id, patch.items);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('plans')
        .set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.objectives !== undefined ? { objectives: patch.objectives } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', planId)
        .execute();
      if (patch.items) {
        await transaction.deleteFrom('plan_items').where('plan_id', '=', planId).execute();
        await this.insertItems(transaction, planId, patch.items, 0);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'plans',
        entityId: planId,
        action: 'update',
        before: plan,
        after: patch,
      });
    });
    return this.read(currentUser, planId);
  }

  // Kích hoạt: mỗi đầu việc thành một việc được giao cho người phụ trách
  async activate(currentUser: CurrentUser, planId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.load(database, planId);
    await this.assertManager(currentUser, plan.org_unit_id);
    if (plan.status !== 'draft') {
      throw ruleViolationError('P09-03', 'Kế hoạch này đã được kích hoạt hoặc đã đóng');
    }
    const items = await database
      .selectFrom('plan_items')
      .selectAll()
      .where('plan_id', '=', planId)
      .orderBy('order_no')
      .execute();
    if (items.length === 0) {
      throw ruleViolationError('P09-03', 'Kế hoạch chưa có đầu việc nào');
    }
    const owners = new Map<string, Awaited<ReturnType<WorkAccess['staff']>>>();
    for (const item of items) {
      const owner = owners.get(item.owner_staff_id) ?? (await this.access.staff(database, item.owner_staff_id));
      assertAssignable(owner, 'items');
      owners.set(owner.id, owner);
    }
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        await this.createItemTask(transaction, plan, item, owners.get(item.owner_staff_id)!, origin);
      }
      await transaction
        .updateTable('plans')
        .set({ status: 'active', activated_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', planId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'plans',
        entityId: planId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'active', tasks: items.length },
      });
    });
    return this.read(currentUser, planId);
  }

  // Thêm đầu việc vào kế hoạch: nháp thì chỉ ghi đầu việc, đang thực hiện thì giao việc ngay
  async addItem(currentUser: CurrentUser, planId: string, input: PlanItemInput, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.load(database, planId);
    await this.assertManager(currentUser, plan.org_unit_id);
    if (plan.status === 'closed') {
      throw ruleViolationError('P09-03', 'Kế hoạch đã đóng, không thêm đầu việc được');
    }
    await this.assertOwners(database, plan.org_unit_id, [input]);
    const owner = await this.access.staff(database, input.ownerStaffId);
    const count = await database
      .selectFrom('plan_items')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .where('plan_id', '=', planId)
      .executeTakeFirstOrThrow();
    if (Number(count.count) >= MAXIMUM_ITEMS) {
      throw validationError([{ field: 'items', message: `Tối đa ${MAXIMUM_ITEMS} đầu việc` }]);
    }
    await database.transaction().execute(async (transaction) => {
      const [item] = await this.insertItems(transaction, planId, [input], Number(count.count));
      if (plan.status === 'active' && item) {
        await this.createItemTask(transaction, plan, item, owner, origin);
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'plan_items',
        entityId: item?.id ?? planId,
        action: 'create',
        before: null,
        after: item,
      });
    });
    return this.read(currentUser, planId);
  }

  async close(currentUser: CurrentUser, planId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const plan = await this.load(database, planId);
    await this.assertManager(currentUser, plan.org_unit_id);
    if (plan.status !== 'active') {
      throw ruleViolationError('P09-03', 'Chỉ đóng được kế hoạch đang thực hiện');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('plans')
        .set({ status: 'closed', closed_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', planId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'plans',
        entityId: planId,
        action: 'update',
        before: { status: 'active' },
        after: { status: 'closed' },
      });
    });
    return this.read(currentUser, planId);
  }

  private async createItemTask(
    transaction: Transaction<SchoolYearDatabase>,
    plan: { id: string; org_unit_id: string; title: string },
    item: { id: string; content: string; due_date: string },
    owner: Awaited<ReturnType<WorkAccess['staff']>>,
    origin: ChangeOrigin,
  ) {
    const task = await insertAssignedTask(
      transaction,
      {
        orgUnitId: plan.org_unit_id,
        title: item.content,
        description: `Đầu việc của kế hoạch: ${plan.title}`,
        assignee: owner,
        dueDate: item.due_date,
        priority: 'normal',
        planItemId: item.id,
      },
      origin,
    );
    await transaction.updateTable('plan_items').set({ task_id: task.id }).where('id', '=', item.id).execute();
  }

  private insertItems(
    transaction: Transaction<SchoolYearDatabase>,
    planId: string,
    items: PlanItemInput[],
    startOrder: number,
  ) {
    if (items.length === 0) {
      return Promise.resolve([]);
    }
    return transaction
      .insertInto('plan_items')
      .values(
        items.map((item, index) => ({
          plan_id: planId,
          content: item.content,
          owner_staff_id: item.ownerStaffId,
          due_date: item.dueDate,
          order_no: startOrder + index,
        })),
      )
      .returningAll()
      .execute();
  }

  // Người phụ trách phải là nhân sự đang làm của đơn vị lập kế hoạch
  private async assertOwners(database: Executor, orgUnitId: string, items: PlanItemInput[]) {
    const ids = [...new Set(items.map((item) => item.ownerStaffId))];
    if (ids.length === 0) {
      return;
    }
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'status', 'full_name'])
      .where('id', 'in', ids)
      .execute();
    for (const id of ids) {
      const person = staff.find((row) => row.id === id);
      if (!person || person.org_unit_id !== orgUnitId || person.status !== 'active') {
        throw validationError([
          { field: 'items', message: 'Người phụ trách phải là nhân sự đang làm của đơn vị lập kế hoạch' },
        ]);
      }
    }
  }

  private async itemsOf(database: Executor, planIds: string[]) {
    return database
      .selectFrom('plan_items')
      .innerJoin('staff', 'staff.id', 'plan_items.owner_staff_id')
      .leftJoin('tasks', 'tasks.id', 'plan_items.task_id')
      .selectAll('plan_items')
      .select(['staff.full_name as owner_name', 'tasks.status as task_status', 'tasks.progress_percent'])
      .where('plan_items.plan_id', 'in', planIds)
      .orderBy('plan_items.order_no')
      .execute();
  }

  private async load(database: Executor, planId: string) {
    const plan = await database.selectFrom('plans').selectAll().where('id', '=', planId).executeTakeFirst();
    if (!plan) {
      throw notFoundError('Không tìm thấy kế hoạch', 'plan');
    }
    return plan;
  }

  private assertManager(currentUser: CurrentUser, orgUnitId: string) {
    return this.access.assertManage(
      currentUser,
      PERMISSION_CODES.planManage,
      orgUnitId,
      'Bạn không có quyền lập kế hoạch cho đơn vị này',
    );
  }
}

// Tiến độ kế hoạch: trung bình phần trăm hoàn thành của các đầu việc, việc đã hủy không tính
function summarize(items: Array<{ task_status: string | null; progress_percent: number | null }>) {
  const counted = items.filter((item) => item.task_status !== 'cancelled');
  return {
    item_count: items.length,
    done_count: counted.filter((item) => item.task_status === 'done').length,
    progress_percent: counted.length
      ? Math.round(counted.reduce((sum, item) => sum + (item.progress_percent ?? 0), 0) / counted.length)
      : 0,
  };
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readItem(value: unknown, errors: FieldError[], prefix: string): PlanItemInput {
  const body = (typeof value === 'object' && value !== null ? value : {}) as RequestBody;
  const itemErrors: FieldError[] = [];
  const item = {
    content: readWorkText(body, 'content', itemErrors, { required: true, maximum: 500 }) ?? '',
    ownerStaffId: readRequiredUuid(body, 'owner_staff_id', itemErrors, 'Bắt buộc chọn người phụ trách'),
    dueDate: readWorkDate(body, 'due_date', itemErrors, true) ?? '',
  };
  errors.push(...itemErrors.map((error) => ({ ...error, field: `${prefix}.${error.field}` })));
  return item;
}

function readItems(body: RequestBody, errors: FieldError[], required: boolean): PlanItemInput[] | undefined {
  const value = body?.items;
  if (value === undefined && !required) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS) {
    errors.push({ field: 'items', message: `Danh sách đầu việc, tối đa ${MAXIMUM_ITEMS}` });
    return [];
  }
  return value.map((item, index) => readItem(item, errors, `items.${index}`));
}

@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('plans')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    const status = readEnum(query, 'status', ['draft', 'active', 'closed'] as const, errors, false) ?? null;
    check(errors);
    return this.plans.list(currentUser, { orgUnitId: query.org_unit_id ?? null, status });
  }

  @Post('plans')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const period = readPeriod(body, errors);
    const input = {
      orgUnitId: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      periodType: period.type,
      periodValue: period.value,
      title: readWorkText(body, 'title', errors, { required: true, maximum: 200 }) ?? '',
      objectives: readWorkText(body, 'objectives', errors),
      items: readItems(body, errors, false) ?? [],
    };
    check(errors);
    return this.plans.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('plans/:id')
  read(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.read(currentUser, planId);
  }

  @Patch('plans/:id')
  update(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const patch = {
      title:
        body?.title === undefined
          ? undefined
          : (readWorkText(body, 'title', errors, { required: true, maximum: 200 }) ?? ''),
      objectives: body?.objectives === undefined ? undefined : readWorkText(body, 'objectives', errors),
      items: readItems(body, errors, false),
    };
    check(errors);
    return this.plans.update(currentUser, planId, patch, originOf(request, currentUser));
  }

  @Post('plans/:id/items')
  @HttpCode(201)
  addItem(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const item = readItem(body, errors, 'item');
    check(errors);
    return this.plans.addItem(currentUser, planId, item, originOf(request, currentUser));
  }

  @Post('plans/:id/activate')
  @HttpCode(200)
  activate(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.activate(currentUser, planId, originOf(request, currentUser));
  }

  @Post('plans/:id/close')
  @HttpCode(200)
  close(
    @Param('id', uuidParameter('Mã kế hoạch không hợp lệ')) planId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.plans.close(currentUser, planId, originOf(request, currentUser));
  }
}
