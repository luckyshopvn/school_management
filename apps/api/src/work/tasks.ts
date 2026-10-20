import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { SchoolYearDatabase, TaskPriority, TaskStatus } from '@school-management/database';
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
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import { isUuid, notFoundError, readOptionalUuid, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { hasAnyScope, inScope, readWorkDate, readWorkText, WorkAccess, type StaffOfUnit } from './work-access.js';

// Giao việc, công việc cá nhân, theo dõi tiến độ (P09-01, P09-02, P09-04; BR-01, BR-46, BR-70; YCTD-81). Quản lý đơn vị
// và phòng nhân sự giao việc cho nhân sự có tài khoản trong đơn vị được gán, người nhận nhận thông báo trong ứng dụng
// (trung tâm thông báo ghi ai đã đọc, BR-70). Mọi nhân sự có hồ sơ liên kết tài khoản tự tạo việc cá nhân, chỉ mình xem.
// Người nhận cập nhật tiến độ theo phần trăm; đủ 100% là hoàn thành và người giao nhận thông báo
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high'];
const OPEN_STATUSES: TaskStatus[] = ['todo', 'in_progress'];
const TASK_VIEWS = ['mine', 'assigned', 'unit'] as const;
type TaskView = (typeof TASK_VIEWS)[number];
const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'thấp', normal: 'bình thường', high: 'cao' };

export interface AssignedTaskInput {
  orgUnitId: string;
  title: string;
  description: string | null;
  assignee: StaffOfUnit;
  dueDate: string;
  priority: TaskPriority;
  planItemId: string | null;
}

// Tạo việc được giao kèm thông báo cho người nhận; dùng chung cho giao việc và kích hoạt kế hoạch
export async function insertAssignedTask(
  transaction: Transaction<SchoolYearDatabase>,
  input: AssignedTaskInput,
  origin: ChangeOrigin,
) {
  const created = await transaction
    .insertInto('tasks')
    .values({
      org_unit_id: input.orgUnitId,
      task_type: 'assigned',
      title: input.title,
      description: input.description,
      assigner_user_id: origin.actorUserId,
      assigner_name: origin.actorName,
      assignee_staff_id: input.assignee.id,
      due_date: input.dueDate,
      priority: input.priority,
      plan_item_id: input.planItemId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await writeAuditLog(transaction, {
    origin,
    orgUnitId: input.orgUnitId,
    entityName: 'tasks',
    entityId: created.id,
    action: 'create',
    before: null,
    after: created,
  });
  if (input.assignee.user_id) {
    await queueNotification(transaction, {
      orgUnitId: input.orgUnitId,
      templateCode: 'task_assigned',
      title: 'Bạn được giao việc mới',
      body: `${input.title}. Hạn ${input.dueDate}, ưu tiên ${PRIORITY_LABELS[input.priority]}. Người giao: ${origin.actorName}`,
      targetType: 'tasks',
      targetId: created.id,
      recipients: [{ userId: input.assignee.user_id, channel: 'in_app' }],
    });
  }
  return created;
}

// Người nhận việc phải là nhân sự đang làm, có tài khoản để nhận thông báo và cập nhật tiến độ
export function assertAssignable(staff: StaffOfUnit, field: string) {
  if (staff.status !== 'active') {
    throw ruleViolationError('P09-01', `${staff.full_name} đã nghỉ việc, không giao việc được`, [
      { field, message: 'Nhân sự đã nghỉ việc' },
    ]);
  }
  if (!staff.user_id) {
    throw ruleViolationError('P09-01', `${staff.full_name} chưa có tài khoản nên không nhận được việc`, [
      { field, message: 'Nhân sự chưa liên kết tài khoản' },
    ]);
  }
}

@Injectable()
export class TasksService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: WorkAccess,
    private readonly clock: Clock,
  ) {}

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async create(
    currentUser: CurrentUser,
    input: {
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: TaskPriority;
      assigneeStaffId: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const own = await this.access.findOwnStaff(database, currentUser);
    const personal = !input.assigneeStaffId || input.assigneeStaffId === own?.id;
    if (personal) {
      // P09-02: việc cá nhân của chính mình, không cần quyền riêng
      if (!own) {
        throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
      }
      const created = await database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('tasks')
          .values({
            org_unit_id: own.org_unit_id,
            task_type: 'personal',
            title: input.title,
            description: input.description,
            assigner_user_id: currentUser.id,
            assigner_name: origin.actorName,
            assignee_staff_id: own.id,
            due_date: input.dueDate,
            priority: input.priority,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: own.org_unit_id,
          entityName: 'tasks',
          entityId: row.id,
          action: 'create',
          before: null,
          after: row,
        });
        return row;
      });
      return this.read(currentUser, created.id);
    }
    const assignee = await this.access.staff(database, input.assigneeStaffId as string);
    await this.access.assertManage(
      currentUser,
      PERMISSION_CODES.taskAssign,
      assignee.org_unit_id,
      'Bạn không có quyền giao việc cho nhân sự của đơn vị này',
    );
    assertAssignable(assignee, 'assignee_staff_id');
    if (!input.dueDate) {
      throw validationError([{ field: 'due_date', message: 'Việc được giao bắt buộc có hạn' }]);
    }
    if (input.dueDate < this.today()) {
      throw validationError([{ field: 'due_date', message: 'Hạn không trước hôm nay' }]);
    }
    const created = await database.transaction().execute((transaction) =>
      insertAssignedTask(
        transaction,
        {
          orgUnitId: assignee.org_unit_id,
          title: input.title,
          description: input.description,
          assignee,
          dueDate: input.dueDate as string,
          priority: input.priority,
          planItemId: null,
        },
        origin,
      ),
    );
    return this.read(currentUser, created.id);
  }

  async list(
    currentUser: CurrentUser,
    filter: { view: TaskView; status: TaskStatus | null; orgUnitId: string | null; assigneeStaffId: string | null },
  ) {
    const { database } = await this.currentSchoolYear.require();
    let query = this.taskQuery(database);
    if (filter.view === 'mine') {
      const own = await this.access.findOwnStaff(database, currentUser);
      if (!own) {
        return [];
      }
      query = query.where('tasks.assignee_staff_id', '=', own.id);
    } else if (filter.view === 'assigned') {
      query = query.where('tasks.assigner_user_id', '=', currentUser.id).where('tasks.task_type', '=', 'assigned');
    } else {
      // Việc được giao trong đơn vị: người giao việc, người lập kế hoạch, Ban Giám hiệu trong phạm vi
      const scope = await this.unitScope(currentUser);
      if (!hasAnyScope(scope)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem công việc của đơn vị');
      }
      if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
      }
      query = query.where('tasks.task_type', '=', 'assigned');
      if (!scope.wholeSchool) {
        query = query.where('tasks.org_unit_id', 'in', scope.orgUnitIds);
      }
    }
    if (filter.orgUnitId) {
      query = query.where('tasks.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.assigneeStaffId) {
      query = query.where('tasks.assignee_staff_id', '=', filter.assigneeStaffId);
    }
    if (filter.status) {
      query = query.where('tasks.status', '=', filter.status);
    }
    const rows = await query.orderBy('tasks.due_date', 'asc').orderBy('tasks.created_at', 'desc').execute();
    return rows.map((row) => this.view(row));
  }

  async read(currentUser: CurrentUser, taskId: string) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.taskQuery(database).where('tasks.id', '=', taskId).executeTakeFirst();
    if (!task) {
      throw notFoundError('Không tìm thấy công việc', 'task');
    }
    const role = await this.roleOf(database, currentUser, task);
    if (!role.canRead) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem công việc này');
    }
    const updates = await database
      .selectFrom('task_updates')
      .selectAll()
      .where('task_id', '=', taskId)
      .orderBy('created_at', 'desc')
      .execute();
    return { ...this.view(task), can_edit: role.canEdit, can_update_progress: role.isAssignee, updates };
  }

  async update(
    currentUser: CurrentUser,
    taskId: string,
    patch: {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      priority?: TaskPriority;
      status?: TaskStatus;
      cancelReason: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.load(database, taskId);
    const role = await this.roleOf(database, currentUser, task);
    if (!role.canEdit) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        task.task_type === 'personal'
          ? 'Chỉ người tạo việc cá nhân được sửa'
          : 'Chỉ người giao việc hoặc người có quyền giao việc trong đơn vị được sửa',
      );
    }
    if (!OPEN_STATUSES.includes(task.status) && !(task.task_type === 'personal' && patch.status)) {
      throw ruleViolationError('P09-01', 'Việc đã hoàn thành hoặc đã hủy, không sửa được');
    }
    const values: Partial<{
      title: string;
      description: string | null;
      due_date: string | null;
      priority: TaskPriority;
      status: TaskStatus;
      progress_percent: number;
      completed_at: Date | null;
      cancel_reason: string | null;
    }> = {};
    if (patch.title !== undefined) values.title = patch.title;
    if (patch.description !== undefined) values.description = patch.description;
    if (patch.priority !== undefined) values.priority = patch.priority;
    if (patch.dueDate !== undefined) {
      if (task.task_type === 'assigned' && !patch.dueDate) {
        throw validationError([{ field: 'due_date', message: 'Việc được giao bắt buộc có hạn' }]);
      }
      values.due_date = patch.dueDate;
    }
    if (patch.status !== undefined) {
      if (task.task_type === 'assigned' && patch.status !== 'cancelled') {
        throw validationError([
          { field: 'status', message: 'Người giao chỉ hủy được việc; tiến độ do người nhận cập nhật' },
        ]);
      }
      if (patch.status === 'cancelled' && task.task_type === 'assigned' && !patch.cancelReason) {
        throw validationError([{ field: 'cancel_reason', message: 'Bắt buộc nhập lý do hủy việc được giao' }]);
      }
      values.status = patch.status;
      values.cancel_reason = patch.status === 'cancelled' ? patch.cancelReason : null;
      values.completed_at = patch.status === 'done' ? this.clock.now() : null;
      if (patch.status === 'done') values.progress_percent = 100;
      if (patch.status === 'todo') values.progress_percent = 0;
    }
    if (Object.keys(values).length === 0) {
      return this.read(currentUser, taskId);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tasks')
        .set({ ...values, updated_at: this.clock.now() })
        .where('id', '=', taskId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'tasks',
        entityId: taskId,
        action: 'update',
        before: task,
        after: values,
      });
      if (task.task_type === 'assigned') {
        const assignee = await this.access.staff(transaction, task.assignee_staff_id);
        if (assignee.user_id) {
          await queueNotification(transaction, {
            orgUnitId: task.org_unit_id,
            templateCode: values.status === 'cancelled' ? 'task_cancelled' : 'task_changed',
            title: values.status === 'cancelled' ? 'Việc được giao đã bị hủy' : 'Việc được giao có thay đổi',
            body:
              values.status === 'cancelled'
                ? `${task.title}: ${patch.cancelReason ?? ''}`
                : `${values.title ?? task.title}. Hạn ${values.due_date ?? task.due_date ?? ''}`,
            targetType: 'tasks',
            targetId: taskId,
            recipients: [{ userId: assignee.user_id, channel: 'in_app' }],
          });
        }
      }
    });
    return this.read(currentUser, taskId);
  }

  // P09-04: người nhận việc cập nhật tiến độ; 100% là hoàn thành
  async addUpdate(
    currentUser: CurrentUser,
    taskId: string,
    input: { content: string | null; progressPercent: number },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.load(database, taskId);
    const role = await this.roleOf(database, currentUser, task);
    if (!role.isAssignee) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người nhận việc cập nhật được tiến độ');
    }
    if (!OPEN_STATUSES.includes(task.status)) {
      throw ruleViolationError('P09-04', 'Việc đã hoàn thành hoặc đã hủy, không cập nhật tiến độ được');
    }
    const status: TaskStatus =
      input.progressPercent >= 100 ? 'done' : input.progressPercent > 0 ? 'in_progress' : 'todo';
    await database.transaction().execute(async (transaction) => {
      const update = await transaction
        .insertInto('task_updates')
        .values({
          task_id: taskId,
          content: input.content,
          progress_percent: input.progressPercent,
          status,
          created_by: currentUser.id,
          created_by_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .updateTable('tasks')
        .set({
          progress_percent: input.progressPercent,
          status,
          completed_at: status === 'done' ? this.clock.now() : null,
          updated_at: this.clock.now(),
        })
        .where('id', '=', taskId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'task_updates',
        entityId: update.id,
        action: 'create',
        before: { status: task.status, progress_percent: task.progress_percent },
        after: update,
      });
      if (task.task_type === 'assigned' && status === 'done') {
        await queueNotification(transaction, {
          orgUnitId: task.org_unit_id,
          templateCode: 'task_done',
          title: 'Việc đã giao đã hoàn thành',
          body: `${origin.actorName} đã hoàn thành: ${task.title}${input.content ? `. ${input.content}` : ''}`,
          targetType: 'tasks',
          targetId: taskId,
          recipients: [{ userId: task.assigner_user_id, channel: 'in_app' }],
        });
      }
    });
    return this.read(currentUser, taskId);
  }

  // P09-04: bảng tiến độ việc được giao theo người nhận trong phạm vi đơn vị
  async progress(
    currentUser: CurrentUser,
    filter: { orgUnitId: string | null; from: string | null; to: string | null },
  ) {
    const scope = await this.unitScope(currentUser);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem tiến độ công việc của đơn vị');
    }
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.taskQuery(database)
      .where('tasks.task_type', '=', 'assigned')
      .where('tasks.status', '!=', 'cancelled');
    if (filter.orgUnitId) {
      query = query.where('tasks.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('tasks.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.from) {
      query = query.where('tasks.due_date', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('tasks.due_date', '<=', filter.to);
    }
    const tasks = (await query.execute()).map((row) => this.view(row));
    const byStaff = new Map<
      string,
      {
        staff_id: string;
        full_name: string;
        total: number;
        todo: number;
        in_progress: number;
        done: number;
        overdue: number;
        progress_sum: number;
      }
    >();
    for (const task of tasks) {
      const row = byStaff.get(task.assignee_staff_id) ?? {
        staff_id: task.assignee_staff_id,
        full_name: task.assignee_name,
        total: 0,
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
        progress_sum: 0,
      };
      row.total += 1;
      if (task.status === 'todo') row.todo += 1;
      if (task.status === 'in_progress') row.in_progress += 1;
      if (task.status === 'done') row.done += 1;
      if (task.overdue) row.overdue += 1;
      row.progress_sum += task.progress_percent;
      byStaff.set(task.assignee_staff_id, row);
    }
    const rows = [...byStaff.values()]
      .map(({ progress_sum: sum, ...row }) => ({ ...row, average_progress: Math.round(sum / row.total) }))
      .sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi'));
    const total = tasks.length;
    return {
      rows,
      total,
      done: tasks.filter((task) => task.status === 'done').length,
      overdue: tasks.filter((task) => task.overdue).length,
      average_progress: total ? Math.round(tasks.reduce((sum, task) => sum + task.progress_percent, 0) / total) : 0,
    };
  }

  private unitScope(currentUser: CurrentUser) {
    return Promise.all([
      this.access.readScope(currentUser, PERMISSION_CODES.taskAssign),
      this.access.scope(currentUser, PERMISSION_CODES.planManage),
    ]).then(([assigned, planned]) =>
      assigned.wholeSchool || planned.wholeSchool
        ? { wholeSchool: true, orgUnitIds: [] }
        : { wholeSchool: false, orgUnitIds: [...new Set([...assigned.orgUnitIds, ...planned.orgUnitIds])] },
    );
  }

  private async roleOf(
    database: Executor,
    currentUser: CurrentUser,
    task: { task_type: string; assignee_staff_id: string; assigner_user_id: string; org_unit_id: string },
  ) {
    const own = await this.access.findOwnStaff(database, currentUser);
    const isAssignee = own?.id === task.assignee_staff_id;
    if (task.task_type === 'personal') {
      return { canRead: isAssignee, canEdit: isAssignee, isAssignee };
    }
    const isAssigner = task.assigner_user_id === currentUser.id;
    const canManage = await this.access.canManage(currentUser, PERMISSION_CODES.taskAssign, task.org_unit_id);
    const canView = inScope(await this.unitScope(currentUser), task.org_unit_id);
    return {
      canRead: isAssignee || isAssigner || canManage || canView,
      canEdit: isAssigner || canManage,
      isAssignee,
    };
  }

  // Việc giao theo cây đơn vị (18c) xử lý ở màn hình Quản lý công việc của phân hệ Quản lý văn bản và điều hành
  private async load(database: Executor, taskId: string) {
    const task = await database.selectFrom('tasks').selectAll().where('id', '=', taskId).executeTakeFirst();
    if (!task || task.task_type === 'directive') {
      throw notFoundError('Không tìm thấy công việc', 'task');
    }
    return { ...task, assignee_staff_id: task.assignee_staff_id as string };
  }

  private taskQuery(database: Executor) {
    return database
      .selectFrom('tasks')
      .innerJoin('staff', 'staff.id', 'tasks.assignee_staff_id')
      .selectAll('tasks')
      .select(['staff.full_name as assignee_name'])
      .$narrowType<{ assignee_staff_id: string }>();
  }

  private view<Row extends { status: TaskStatus; due_date: string | null }>(row: Row) {
    return {
      ...row,
      overdue: OPEN_STATUSES.includes(row.status) && row.due_date !== null && row.due_date < this.today(),
    };
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('tasks')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      title: readWorkText(body, 'title', errors, { required: true, maximum: 200 }) ?? '',
      description: readWorkText(body, 'description', errors),
      dueDate: readWorkDate(body, 'due_date', errors),
      priority: readEnum(body, 'priority', PRIORITIES, errors, false) ?? 'normal',
      assigneeStaffId: readOptionalUuid(body, 'assignee_staff_id', errors) ?? null,
    };
    check(errors);
    return this.tasks.create(currentUser, input, originOf(request, currentUser));
  }

  @Get('tasks')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const view = readEnum(query, 'view', TASK_VIEWS, errors, false) ?? 'mine';
    const status =
      readEnum(query, 'status', ['todo', 'in_progress', 'done', 'cancelled'] as const, errors, false) ?? null;
    for (const field of ['org_unit_id', 'assignee_staff_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    check(errors);
    return this.tasks.list(currentUser, {
      view,
      status,
      orgUnitId: query.org_unit_id ?? null,
      assigneeStaffId: query.assignee_staff_id ?? null,
    });
  }

  @Get('task-progress')
  progress(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    const from = readWorkDate(query, 'from', errors);
    const to = readWorkDate(query, 'to', errors);
    check(errors);
    return this.tasks.progress(currentUser, { orgUnitId: query.org_unit_id ?? null, from, to });
  }

  @Get('tasks/:id')
  read(
    @Param('id', uuidParameter('Mã công việc không hợp lệ')) taskId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.tasks.read(currentUser, taskId);
  }

  @Patch('tasks/:id')
  update(
    @Param('id', uuidParameter('Mã công việc không hợp lệ')) taskId: string,
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
      description: body?.description === undefined ? undefined : readWorkText(body, 'description', errors),
      dueDate: body?.due_date === undefined ? undefined : readWorkDate(body, 'due_date', errors),
      priority: readEnum(body, 'priority', PRIORITIES, errors, false),
      status: readEnum(body, 'status', ['todo', 'in_progress', 'done', 'cancelled'] as const, errors, false),
      cancelReason: readWorkText(body, 'cancel_reason', errors, { maximum: 500 }),
    };
    check(errors);
    return this.tasks.update(currentUser, taskId, patch, originOf(request, currentUser));
  }

  @Post('tasks/:id/updates')
  @HttpCode(201)
  addUpdate(
    @Param('id', uuidParameter('Mã công việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const progress = body?.progress_percent;
    if (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      errors.push({ field: 'progress_percent', message: 'Phần trăm hoàn thành là số nguyên từ 0 đến 100' });
    }
    const content = readWorkText(body, 'content', errors, { maximum: 1000 });
    check(errors);
    return this.tasks.addUpdate(
      currentUser,
      taskId,
      { content, progressPercent: progress as number },
      originOf(request, currentUser),
    );
  }
}
