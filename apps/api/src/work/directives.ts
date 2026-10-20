import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  SchoolYearDatabase,
  SystemDatabase,
  TaskAssignmentRole,
  TaskAssignmentStatus,
  TaskPriority,
  TaskRecurrence,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import {
  DIRECTIVE_MAXIMUM_FILE_BYTES,
  DIRECTIVE_ROLE_LABELS,
  PERMISSION_CODES,
  type DirectiveStatusFilter,
} from '@school-management/shared';
import type { Request, Response } from 'express';
import { sql, type Kysely, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { detectArchiveFileType } from '../archives/archives.js';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { API_CONFIGURATION, type ApiConfiguration } from '../common/configuration.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { FileStorage } from '../files/file-storage.js';
import { IncomingDocumentsService } from '../incoming-documents/incoming-documents.js';
import {
  DIRECTIVE_PRIORITIES,
  DIRECTIVE_RECURRENCES,
  DIRECTIVE_ROLES,
  DIRECTIVE_RULE_CODE,
  DIRECTIVE_STATUS_FILTERS,
  DIRECTIVE_TARGETS,
  nextReminder,
  OPEN_ASSIGNMENT_STATUSES,
  parseAssignments,
  parseDirectiveInput,
  resolveDueDate,
  taskStatusOf,
  titleOf,
  type AssignmentInput,
} from './directive-fields.js';
import { assertAssignable } from './tasks.js';
import { hasAnyScope, inScope, readWorkText, WorkAccess, type StaffOfUnit } from './work-access.js';

// Giao việc theo VNPT iOffice (DT-18 phần 18c, YCTD-141; quyết định của Eric ngày 2026-10-19), mở rộng bảng việc của Quản lý
// công việc đã có (loại việc 'directive'). Người có quyền giao việc theo cây đơn vị lập việc (lãnh đạo giao việc, nội dung,
// mức độ, số ngày, nhắc việc) và phân công thực hiện: mỗi dòng một vai xử lý chính, phối hợp hoặc theo dõi cho một đơn vị,
// phòng ban hoặc một cá nhân trong phạm vi đơn vị được gán. Cá nhân nhận việc tự cập nhật tiến độ; dòng của đơn vị, phòng
// ban do người quản lý đơn vị đó (quản lý đơn vị ghi ở cây đơn vị hoặc có quyền giao việc của đơn vị) xử lý hoặc phân công
// tiếp cho cá nhân. Xử lý chính báo xong thì chờ người giao việc, lãnh đạo phê duyệt: duyệt xử lý xong hoặc chưa xử lý xong;
// phối hợp báo xong là xong. Việc tạo được từ văn bản đến của 18a (ghi vào lịch sử của văn bản). Nhắc việc định kì và nhắc
// người giao việc khi đến hạn chạy nền cùng nhịp với tiến trình gửi thông báo.
// Chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-141
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const DIRECT = PERMISSION_CODES.taskDirect;
const ASSIGN = PERMISSION_CODES.taskAssign;
const MAXIMUM_FILES = 30;
const BOXES = ['inbox', 'outbox'] as const;
type Box = (typeof BOXES)[number];
const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

interface TaskRow {
  id: string;
  task_type: 'assigned' | 'personal' | 'directive';
  org_unit_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  assigner_user_id: string;
  assigner_name: string;
  leader_user_id: string | null;
  leader_name: string | null;
  due_date: string | null;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
}

interface AssignmentRow {
  id: string;
  task_id: string;
  parent_id: string | null;
  role: TaskAssignmentRole;
  target_type: 'unit' | 'staff';
  org_unit_id: string;
  department_id: string | null;
  staff_id: string | null;
  start_date: string;
  due_date: string;
  status: TaskAssignmentStatus;
  progress_percent: number;
  approval_result: 'done' | 'not_done' | null;
  completed_at: Date | null;
}

interface ListFilter {
  box: Box;
  status: DirectiveStatusFilter | null;
  role: TaskAssignmentRole | null;
  target: 'unit' | 'staff' | null;
  search: string | null;
  sourceDocumentId: string | null;
  page: number;
  pageSize: number;
}

interface Viewer {
  staff: StaffOfUnit | undefined;
  // Đơn vị người dùng xử lý thay đơn vị: quản lý ghi ở cây đơn vị hoặc có quyền giao việc của đơn vị
  handledUnits: { wholeSchool: boolean; orgUnitIds: string[] };
}

@Injectable()
export class DirectivesService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly databases: Databases,
    private readonly access: WorkAccess,
    private readonly incoming: IncomingDocumentsService,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
  ) {}

  private get system(): Kysely<SystemDatabase> {
    return this.databases.system;
  }

  private today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  private async viewer(database: Executor, currentUser: CurrentUser): Promise<Viewer> {
    const [staff, assigned, managed] = await Promise.all([
      this.access.findOwnStaff(database, currentUser),
      this.access.scope(currentUser, ASSIGN),
      database.selectFrom('org_units').select('id').where('manager_user_id', '=', currentUser.id).execute(),
    ]);
    return {
      staff,
      handledUnits: assigned.wholeSchool
        ? { wholeSchool: true, orgUnitIds: [] }
        : {
            wholeSchool: false,
            orgUnitIds: [...new Set([...assigned.orgUnitIds, ...managed.map((unit) => unit.id)])],
          },
    };
  }

  // Người xử lý một dòng phân công: cá nhân được giao, hoặc người quản lý đơn vị của dòng giao cho đơn vị, phòng ban
  private handles(viewer: Viewer, assignment: AssignmentRow): boolean {
    if (assignment.target_type === 'staff') {
      return viewer.staff !== undefined && viewer.staff.id === assignment.staff_id;
    }
    return inScope(viewer.handledUnits, assignment.org_unit_id);
  }

  // Người sửa, phê duyệt, thu hồi: người giao việc, lãnh đạo giao việc, người có quyền giao việc ở đơn vị của việc
  private async canEdit(currentUser: CurrentUser, task: TaskRow): Promise<boolean> {
    return (
      task.assigner_user_id === currentUser.id ||
      task.leader_user_id === currentUser.id ||
      (await this.access.canManage(currentUser, DIRECT, task.org_unit_id))
    );
  }

  // ---- Danh sách chọn: cây đơn vị, phòng ban, cá nhân trong phạm vi; lãnh đạo giao việc ----

  async options(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.scope(currentUser, DIRECT);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền giao việc');
    }
    let units = database
      .selectFrom('org_units')
      .select(['id', 'code', 'name', 'unit_type', 'parent_id'])
      .where('status', '=', 'active');
    if (!scope.wholeSchool) {
      units = units.where('id', 'in', scope.orgUnitIds);
    }
    const unitRows = await units.orderBy('code').execute();
    const unitIds = unitRows.map((unit) => unit.id);
    const departments = unitIds.length
      ? await database
          .selectFrom('departments')
          .select(['id', 'org_unit_id', 'parent_id', 'name'])
          .where('org_unit_id', 'in', unitIds)
          .where('status', '=', 'active')
          .orderBy('name')
          .execute()
      : [];
    const staff = unitIds.length
      ? await database
          .selectFrom('staff')
          .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
          .select([
            'staff.id',
            'staff.org_unit_id',
            'staff.department_id',
            'staff.full_name',
            'staff.user_id',
            'job_titles.name as job_title_name',
          ])
          .where('staff.org_unit_id', 'in', unitIds)
          .where('staff.status', '=', 'active')
          .where('staff.user_id', 'is not', null)
          .orderBy('staff.full_name')
          .execute()
      : [];
    const leaders = await this.system
      .selectFrom('document_leaders')
      .select(['user_id', 'user_name', 'title'])
      .orderBy('sort_order')
      .orderBy('user_name')
      .execute();
    return {
      units: unitRows.map((unit) => ({
        ...unit,
        departments: departments.filter((department) => department.org_unit_id === unit.id),
        staff: staff.filter((person) => person.org_unit_id === unit.id),
      })),
      leaders,
    };
  }

  // ---- Giao việc ----

  async create(currentUser: CurrentUser, body: RequestBody, origin: ChangeOrigin) {
    const input = parseDirectiveInput(body);
    const { database } = await this.currentSchoolYear.require();
    const scope = await this.access.scope(currentUser, DIRECT);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền giao việc');
    }
    const today = this.today();
    const startDate = input.start_date ?? today;
    const leader = await this.resolveLeader(currentUser, input.leader_user_id);
    let source: { id: string; label: string } | null = null;
    if (input.source_document_id) {
      // Tạo việc từ văn bản đến: người giao việc phải xem được văn bản
      const document = await this.incoming.assertVisible(currentUser, input.source_document_id);
      source = { id: document.id, label: `${document.symbol} – ${document.summary}`.slice(0, 500) };
    }
    const rows = await this.resolveAssignments(database, input.assignments, {
      startDate,
      durationDays: input.duration_days,
      today,
      scope,
      parent: null,
    });
    const mains = rows.filter((row) => row.role === 'main');
    const dueDate = mains.map((row) => row.due_date).sort().at(-1) as string;
    const created = await database.transaction().execute(async (transaction) => {
      const task = await transaction
        .insertInto('tasks')
        .values({
          org_unit_id: mains[0]?.org_unit_id as string,
          task_type: 'directive',
          title: titleOf(input.content),
          description: input.content,
          assigner_user_id: currentUser.id,
          assigner_name: origin.actorName,
          assignee_staff_id: null,
          due_date: dueDate,
          priority: input.priority,
          leader_user_id: leader?.user_id ?? null,
          leader_name: leader?.user_name ?? null,
          start_date: startDate,
          duration_days: input.duration_days,
          remind_assigner: input.remind_assigner,
          recurrence: input.recurrence,
          next_reminder_on: nextReminder(startDate, input.recurrence),
          source_document_id: source?.id ?? null,
          source_document_label: source?.label ?? null,
          related_documents: input.related_documents,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'tasks',
        entityId: task.id,
        action: 'create',
        before: null,
        after: task,
      });
      await this.insertAssignments(transaction, task, rows, null, currentUser, origin);
      return task;
    });
    if (source) {
      await this.incoming.recordEvent(currentUser, source.id, 'create_task', created.title);
    }
    return this.detail(currentUser, created.id);
  }

  private async resolveLeader(currentUser: CurrentUser, leaderUserId: string | null) {
    if (!leaderUserId) {
      return null;
    }
    const leader = await this.system
      .selectFrom('document_leaders')
      .select(['user_id', 'user_name'])
      .where('user_id', '=', leaderUserId)
      .executeTakeFirst();
    if (leader) {
      return leader;
    }
    if (leaderUserId === currentUser.id) {
      return { user_id: currentUser.id, user_name: currentUser.description.full_name };
    }
    throw validationError([{ field: 'leader_user_id', message: 'Chọn lãnh đạo trong danh sách lãnh đạo nhận văn bản' }]);
  }

  // Kiểm tra từng dòng phân công: cá nhân đang làm có tài khoản, đơn vị và phòng ban có thật, trong phạm vi; ngày hết hạn
  private async resolveAssignments(
    database: Executor,
    inputs: AssignmentInput[],
    context: {
      startDate: string;
      durationDays: number | null;
      today: string;
      scope: { wholeSchool: boolean; orgUnitIds: string[] };
      parent: AssignmentRow | null;
    },
  ) {
    const errors: FieldError[] = [];
    const resolved: Array<AssignmentInput & { org_unit_id: string; start_date: string; due_date: string }> = [];
    for (const [index, input] of inputs.entries()) {
      const field = `assignments[${index}]`;
      let orgUnitId = input.org_unit_id;
      let departmentId = input.department_id;
      if (input.target_type === 'staff') {
        const staff = await database
          .selectFrom('staff')
          .select(['id', 'org_unit_id', 'department_id', 'full_name', 'status', 'user_id'])
          .where('id', '=', input.staff_id as string)
          .executeTakeFirst();
        if (!staff) {
          errors.push({ field: `${field}.staff_id`, message: 'Không tìm thấy nhân sự' });
          continue;
        }
        assertAssignable(staff, `${field}.staff_id`);
        orgUnitId = staff.org_unit_id;
        departmentId = staff.department_id;
      } else {
        const unit = await database
          .selectFrom('org_units')
          .select('id')
          .where('id', '=', orgUnitId as string)
          .where('status', '=', 'active')
          .executeTakeFirst();
        if (!unit) {
          errors.push({ field: `${field}.org_unit_id`, message: 'Không tìm thấy đơn vị' });
          continue;
        }
        if (departmentId) {
          const department = await database
            .selectFrom('departments')
            .select('id')
            .where('id', '=', departmentId)
            .where('org_unit_id', '=', orgUnitId as string)
            .executeTakeFirst();
          if (!department) {
            errors.push({ field: `${field}.department_id`, message: 'Phòng ban không thuộc đơn vị đã chọn' });
            continue;
          }
        }
      }
      if (context.parent) {
        // Phân công tiếp chỉ trong đơn vị (và phòng ban) của dòng được giao
        if (
          orgUnitId !== context.parent.org_unit_id ||
          (context.parent.department_id && departmentId !== context.parent.department_id)
        ) {
          errors.push({ field, message: 'Chỉ phân công tiếp trong đơn vị, phòng ban được giao' });
          continue;
        }
      } else if (!inScope(context.scope, orgUnitId as string)) {
        errors.push({ field, message: 'Đơn vị, cá nhân này nằm ngoài phạm vi giao việc của bạn' });
        continue;
      }
      const startDate = input.start_date ?? context.startDate;
      const dueDate = resolveDueDate(startDate, input.due_date, context.durationDays) ?? context.parent?.due_date;
      if (!dueDate) {
        errors.push({ field: `${field}.due_date`, message: 'Nhập ngày hết hạn hoặc số ngày thực hiện' });
        continue;
      }
      if (dueDate < context.today) {
        errors.push({ field: `${field}.due_date`, message: 'Ngày hết hạn không trước hôm nay' });
        continue;
      }
      if (dueDate < startDate) {
        errors.push({ field: `${field}.due_date`, message: 'Ngày hết hạn không trước ngày bắt đầu' });
        continue;
      }
      resolved.push({
        ...input,
        org_unit_id: orgUnitId as string,
        department_id: departmentId,
        start_date: startDate,
        due_date: dueDate,
      });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return resolved;
  }

  private async insertAssignments(
    transaction: Transaction<SchoolYearDatabase>,
    task: { id: string; title: string; org_unit_id: string },
    rows: Array<AssignmentInput & { org_unit_id: string; start_date: string; due_date: string }>,
    parentId: string | null,
    currentUser: CurrentUser,
    origin: ChangeOrigin,
  ) {
    for (const row of rows) {
      const created = await transaction
        .insertInto('task_assignments')
        .values({
          task_id: task.id,
          parent_id: parentId,
          role: row.role,
          target_type: row.target_type,
          org_unit_id: row.org_unit_id,
          department_id: row.department_id,
          staff_id: row.target_type === 'staff' ? row.staff_id : null,
          start_date: row.start_date,
          due_date: row.due_date,
          assigned_by: currentUser.id,
          assigned_by_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'task_assignments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      await queueNotification(transaction, {
        orgUnitId: row.org_unit_id,
        templateCode: 'task_directive_assigned',
        title: 'Bạn được giao việc mới',
        body: `${DIRECTIVE_ROLE_LABELS[row.role]}: ${task.title}. Hạn ${row.due_date}. Người giao: ${origin.actorName}`,
        targetType: 'tasks',
        targetId: task.id,
        recipients: await this.handlersOf(transaction, created),
      });
    }
  }

  // Người nhận thông báo của một dòng: cá nhân được giao; dòng của đơn vị thì quản lý đơn vị ghi ở cây đơn vị, chưa ghi thì
  // mọi tài khoản vai trò Quản lý đơn vị của đơn vị đó
  private async handlersOf(
    executor: Executor,
    assignment: { target_type: 'unit' | 'staff'; staff_id: string | null; org_unit_id: string },
  ): Promise<NotificationRecipient[]> {
    if (assignment.target_type === 'staff') {
      const staff = await executor
        .selectFrom('staff')
        .select('user_id')
        .where('id', '=', assignment.staff_id as string)
        .executeTakeFirst();
      return staff?.user_id ? [{ userId: staff.user_id, channel: 'in_app' }] : [];
    }
    const unit = await executor
      .selectFrom('org_units')
      .select('manager_user_id')
      .where('id', '=', assignment.org_unit_id)
      .executeTakeFirst();
    return unit?.manager_user_id
      ? [{ userId: unit.manager_user_id, channel: 'in_app' }]
      : [{ roleCode: 'VT-03', orgUnitId: assignment.org_unit_id, channel: 'in_app' }];
  }

  // ---- Danh sách: công việc cần xử lý, công việc đã giao ----

  async list(currentUser: CurrentUser, filter: ListFilter) {
    const { database } = await this.currentSchoolYear.require();
    return filter.box === 'inbox'
      ? this.inbox(database, currentUser, filter)
      : this.outbox(database, currentUser, filter);
  }

  private async inbox(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, filter: ListFilter) {
    const viewer = await this.viewer(database, currentUser);
    const today = this.today();
    let query = database
      .selectFrom('task_assignments')
      .innerJoin('tasks', 'tasks.id', 'task_assignments.task_id')
      .innerJoin('org_units', 'org_units.id', 'task_assignments.org_unit_id')
      .leftJoin('departments', 'departments.id', 'task_assignments.department_id')
      .leftJoin('staff', 'staff.id', 'task_assignments.staff_id')
      .where('tasks.task_type', '=', 'directive')
      .where('tasks.status', '!=', 'cancelled')
      .where('task_assignments.status', '!=', 'cancelled')
      .where((expression) => {
        const mine = [];
        if (viewer.staff) {
          mine.push(expression('task_assignments.staff_id', '=', viewer.staff.id));
        }
        if (viewer.handledUnits.wholeSchool) {
          mine.push(expression('task_assignments.target_type', '=', 'unit'));
        } else if (viewer.handledUnits.orgUnitIds.length > 0) {
          mine.push(
            expression.and([
              expression('task_assignments.target_type', '=', 'unit'),
              expression('task_assignments.org_unit_id', 'in', viewer.handledUnits.orgUnitIds),
            ]),
          );
        }
        return mine.length > 0 ? expression.or(mine) : sql<boolean>`false`;
      });
    if (filter.role) {
      query = query.where('task_assignments.role', '=', filter.role);
    }
    if (filter.target) {
      query = query.where('task_assignments.target_type', '=', filter.target);
    }
    if (filter.search) {
      query = query.where('tasks.title', 'ilike', `%${escapeLike(filter.search)}%`);
    }
    query = applyStatusFilter(query, filter.status, today);
    const total = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const rows = await query
      .select([
        'task_assignments.id as assignment_id',
        'task_assignments.role',
        'task_assignments.target_type',
        'task_assignments.status',
        'task_assignments.progress_percent',
        'task_assignments.start_date',
        'task_assignments.due_date',
        'task_assignments.approval_result',
        'task_assignments.completed_at',
        'tasks.id',
        'tasks.title',
        'tasks.priority',
        'tasks.assigner_name',
        'tasks.leader_name',
        'tasks.source_document_label',
        'org_units.name as org_unit_name',
        'departments.name as department_name',
        'staff.full_name as staff_name',
      ])
      .orderBy('task_assignments.due_date')
      .orderBy('task_assignments.created_at', 'desc')
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    return {
      items: rows.map((row) => ({ ...row, ...deadlineOf(row, today) })),
      total: Number(total.count),
      page: filter.page,
      page_size: filter.pageSize,
    };
  }

  // Việc đã giao: việc do mình giao hoặc mình là lãnh đạo giao việc, gồm cả việc giao theo quyền cũ của 3.1 Công việc và
  // kế hoạch (một người nhận)
  private async outbox(database: Kysely<SchoolYearDatabase>, currentUser: CurrentUser, filter: ListFilter) {
    const today = this.today();
    let query = database
      .selectFrom('tasks')
      .leftJoin('staff', 'staff.id', 'tasks.assignee_staff_id')
      .where('tasks.task_type', 'in', ['directive', 'assigned'])
      .where((expression) =>
        expression.or([
          expression('tasks.assigner_user_id', '=', currentUser.id),
          expression('tasks.leader_user_id', '=', currentUser.id),
        ]),
      );
    if (filter.sourceDocumentId) {
      query = query.where('tasks.source_document_id', '=', filter.sourceDocumentId);
    }
    if (filter.search) {
      query = query.where('tasks.title', 'ilike', `%${escapeLike(filter.search)}%`);
    }
    if (filter.status === 'open' || filter.status === 'open_on_time' || filter.status === 'open_overdue') {
      query = query.where('tasks.status', 'in', ['todo', 'in_progress']);
      if (filter.status === 'open_on_time') query = query.where('tasks.due_date', '>=', today);
      if (filter.status === 'open_overdue') query = query.where('tasks.due_date', '<', today);
    } else if (filter.status === 'done' || filter.status === 'done_on_time' || filter.status === 'done_late') {
      query = query.where('tasks.status', '=', 'done');
      if (filter.status === 'done_on_time') query = query.where(onTime('tasks'));
      if (filter.status === 'done_late') query = query.where((expression) => expression.not(onTime('tasks')));
    } else if (filter.status === 'pending_approval') {
      query = query.where((expression) =>
        expression.exists(
          expression
            .selectFrom('task_assignments')
            .select('task_assignments.id')
            .whereRef('task_assignments.task_id', '=', 'tasks.id')
            .where('task_assignments.status', '=', 'pending_approval'),
        ),
      );
    }
    const total = await query
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const rows = await query
      .select([
        'tasks.id',
        'tasks.task_type',
        'tasks.title',
        'tasks.priority',
        'tasks.status',
        'tasks.progress_percent',
        'tasks.start_date',
        'tasks.due_date',
        'tasks.completed_at',
        'tasks.leader_name',
        'tasks.assigner_name',
        'tasks.source_document_label',
        'tasks.created_at',
        'staff.full_name as assignee_name',
      ])
      .orderBy('tasks.created_at', 'desc')
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();
    const ids = rows.map((row) => row.id);
    const assignments = ids.length
      ? await database
          .selectFrom('task_assignments')
          .leftJoin('staff', 'staff.id', 'task_assignments.staff_id')
          .leftJoin('departments', 'departments.id', 'task_assignments.department_id')
          .innerJoin('org_units', 'org_units.id', 'task_assignments.org_unit_id')
          .select([
            'task_assignments.task_id',
            'task_assignments.role',
            'task_assignments.status',
            'staff.full_name as staff_name',
            'departments.name as department_name',
            'org_units.name as org_unit_name',
          ])
          .where('task_assignments.task_id', 'in', ids)
          .where('task_assignments.status', '!=', 'cancelled')
          .where('task_assignments.parent_id', 'is', null)
          .execute()
      : [];
    return {
      items: rows.map((row) => {
        const mine = assignments.filter((assignment) => assignment.task_id === row.id);
        const handlers = (role: TaskAssignmentRole) =>
          mine
            .filter((assignment) => assignment.role === role)
            .map((assignment) => assignment.staff_name ?? assignment.department_name ?? assignment.org_unit_name)
            .join(', ');
        const open = row.status === 'todo' || row.status === 'in_progress';
        return {
          ...row,
          main_handlers: row.task_type === 'assigned' ? (row.assignee_name ?? '') : handlers('main'),
          coordinate_handlers: handlers('coordinate'),
          follow_handlers: handlers('follow'),
          pending_approval: mine.filter((assignment) => assignment.status === 'pending_approval').length,
          overdue: open && row.due_date !== null && row.due_date < today,
        };
      }),
      total: Number(total.count),
      page: filter.page,
      page_size: filter.pageSize,
    };
  }

  // ---- Chi tiết ----

  private async loadTask(database: Executor, id: string): Promise<TaskRow> {
    const task = await database
      .selectFrom('tasks')
      .select([
        'id',
        'task_type',
        'org_unit_id',
        'title',
        'description',
        'status',
        'assigner_user_id',
        'assigner_name',
        'leader_user_id',
        'leader_name',
        'due_date',
        'priority',
        'recurrence',
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!task || task.task_type !== 'directive') {
      throw notFoundError('Không tìm thấy công việc', 'task');
    }
    return task as TaskRow;
  }

  private loadAssignments(database: Executor, taskId: string): Promise<AssignmentRow[]> {
    return database
      .selectFrom('task_assignments')
      .select([
        'id',
        'task_id',
        'parent_id',
        'role',
        'target_type',
        'org_unit_id',
        'department_id',
        'staff_id',
        'start_date',
        'due_date',
        'status',
        'progress_percent',
        'approval_result',
        'completed_at',
      ])
      .where('task_id', '=', taskId)
      .orderBy('created_at')
      .execute();
  }

  // Xem được: người giao, lãnh đạo giao việc, người xử lý một dòng, người có quyền giao việc hoặc Ban Giám hiệu trong
  // phạm vi đơn vị của việc hoặc của một dòng
  private async visibility(database: Executor, currentUser: CurrentUser, task: TaskRow, assignments: AssignmentRow[]) {
    const viewer = await this.viewer(database, currentUser);
    const editable = await this.canEdit(currentUser, task);
    const handled = assignments.filter((assignment) => this.handles(viewer, assignment));
    let visible = editable || handled.length > 0;
    if (!visible) {
      const scope = await this.access.readScope(currentUser, DIRECT);
      visible = [task.org_unit_id, ...assignments.map((assignment) => assignment.org_unit_id)].some((unitId) =>
        inScope(scope, unitId),
      );
    }
    if (!visible) {
      throw notFoundError('Không tìm thấy công việc', 'task');
    }
    return { viewer, editable, handled };
  }

  async detail(currentUser: CurrentUser, id: string) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    const assignments = await this.loadAssignments(database, id);
    const { editable, handled } = await this.visibility(database, currentUser, task, assignments);
    const full = await database
      .selectFrom('tasks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    const named = await database
      .selectFrom('task_assignments')
      .innerJoin('org_units', 'org_units.id', 'task_assignments.org_unit_id')
      .leftJoin('departments', 'departments.id', 'task_assignments.department_id')
      .leftJoin('staff', 'staff.id', 'task_assignments.staff_id')
      .selectAll('task_assignments')
      .select(['org_units.name as org_unit_name', 'departments.name as department_name', 'staff.full_name as staff_name'])
      .where('task_assignments.task_id', '=', id)
      .orderBy('task_assignments.created_at')
      .execute();
    const updates = await database
      .selectFrom('task_updates')
      .select(['id', 'assignment_id', 'content', 'progress_percent', 'status', 'created_by_name', 'created_at'])
      .where('task_id', '=', id)
      .orderBy('created_at', 'desc')
      .execute();
    const files = await database
      .selectFrom('task_files')
      .select(['id', 'file_name', 'content_type', 'size_bytes', 'sha256', 'created_by', 'created_by_name', 'created_at'])
      .where('task_id', '=', id)
      .orderBy('created_at')
      .execute();
    const today = this.today();
    const open = task.status === 'todo' || task.status === 'in_progress';
    const handledIds = new Set(handled.map((assignment) => assignment.id));
    return {
      ...full,
      overdue: open && full.due_date !== null && full.due_date < today,
      can_edit: editable && open,
      can_approve: editable,
      assignments: named.map((assignment) => {
        const mine = handledIds.has(assignment.id);
        const active = open && OPEN_ASSIGNMENT_STATUSES.includes(assignment.status);
        return {
          ...assignment,
          ...deadlineOf(assignment, today),
          can_update: mine && active && assignment.role !== 'follow',
          // Đơn vị, phòng ban được giao thì người xử lý phân công tiếp cho cá nhân trong đơn vị
          can_delegate: mine && active && assignment.target_type === 'unit',
          can_approve: editable && assignment.status === 'pending_approval',
          can_revoke: editable && open && assignment.status !== 'cancelled' && assignment.status !== 'done',
        };
      }),
      updates,
      files,
    };
  }

  // Việc tạo từ một văn bản đến, hiện ở chi tiết văn bản; ai xem được văn bản thì xem được danh sách này
  async byDocument(currentUser: CurrentUser, documentId: string) {
    await this.incoming.assertVisible(currentUser, documentId);
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return [];
    }
    return current.database
      .selectFrom('tasks')
      .select(['id', 'title', 'status', 'due_date', 'assigner_name', 'leader_name', 'created_at'])
      .where('source_document_id', '=', documentId)
      .orderBy('created_at')
      .execute();
  }

  // ---- Sửa, hủy ----

  async update(currentUser: CurrentUser, id: string, body: RequestBody, origin: ChangeOrigin) {
    const errors: FieldError[] = [];
    const patch: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      recurrence: TaskRecurrence;
      next_reminder_on: string | null;
      remind_assigner: boolean;
      related_documents: string | null;
    }> = {};
    if (body?.content !== undefined) {
      const content = readWorkText(body, 'content', errors, { required: true });
      if (content) {
        patch.title = titleOf(content);
        patch.description = content;
      }
    }
    const priority = readEnum(body, 'priority', DIRECTIVE_PRIORITIES, errors, false);
    if (priority) patch.priority = priority;
    const recurrence = readEnum(body, 'recurrence', DIRECTIVE_RECURRENCES, errors, false);
    if (recurrence) {
      patch.recurrence = recurrence;
      patch.next_reminder_on = nextReminder(this.today(), recurrence);
    }
    if (body?.remind_assigner !== undefined) {
      if (typeof body.remind_assigner !== 'boolean') {
        errors.push({ field: 'remind_assigner', message: 'Giá trị là true hoặc false' });
      } else {
        patch.remind_assigner = body.remind_assigner;
      }
    }
    if (body?.related_documents !== undefined) {
      patch.related_documents = readWorkText(body, 'related_documents', errors, { maximum: 1000 });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    await this.assertEditable(currentUser, task);
    if (Object.keys(patch).length > 0) {
      await database.transaction().execute(async (transaction) => {
        await transaction
          .updateTable('tasks')
          .set({ ...patch, updated_at: this.clock.now() })
          .where('id', '=', id)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: task.org_unit_id,
          entityName: 'tasks',
          entityId: id,
          action: 'update',
          before: task,
          after: patch,
        });
      });
    }
    return this.detail(currentUser, id);
  }

  private async assertEditable(currentUser: CurrentUser, task: TaskRow) {
    if (!(await this.canEdit(currentUser, task))) {
      throw new ApplicationError(
        'ERR_FORBIDDEN',
        'Chỉ người giao việc, lãnh đạo giao việc hoặc người có quyền giao việc của đơn vị thao tác được',
      );
    }
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Việc đã hoàn thành hoặc đã hủy, không thao tác được');
    }
  }

  async cancel(currentUser: CurrentUser, id: string, reason: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    await this.assertEditable(currentUser, task);
    const assignments = await this.loadAssignments(database, id);
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('tasks')
        .set({ status: 'cancelled', cancel_reason: reason, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await transaction
        .updateTable('task_assignments')
        .set({ status: 'cancelled', updated_at: this.clock.now() })
        .where('task_id', '=', id)
        .where('status', '!=', 'done')
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'tasks',
        entityId: id,
        action: 'update',
        before: { status: task.status },
        after: { status: 'cancelled', cancel_reason: reason },
      });
      const recipients = (
        await Promise.all(
          assignments
            .filter((assignment) => assignment.status !== 'done' && assignment.status !== 'cancelled')
            .map((assignment) => this.handlersOf(transaction, assignment)),
        )
      ).flat();
      await queueNotification(transaction, {
        orgUnitId: task.org_unit_id,
        templateCode: 'task_cancelled',
        title: 'Việc được giao đã bị hủy',
        body: `${task.title}: ${reason}`,
        targetType: 'tasks',
        targetId: id,
        recipients,
      });
    });
    return this.detail(currentUser, id);
  }

  // ---- Phân công thêm, phân công tiếp, thu hồi ----

  async addAssignments(currentUser: CurrentUser, id: string, body: RequestBody, origin: ChangeOrigin) {
    const errors: FieldError[] = [];
    const inputs = parseAssignments(body?.assignments, errors);
    const parentId = body?.parent_id;
    if (parentId !== undefined && parentId !== null && !isUuid(parentId)) {
      errors.push({ field: 'parent_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Việc đã hoàn thành hoặc đã hủy, không phân công được');
    }
    const assignments = await this.loadAssignments(database, id);
    let parent: AssignmentRow | null = null;
    if (typeof parentId === 'string') {
      parent = assignments.find((assignment) => assignment.id === parentId) ?? null;
      if (!parent || parent.target_type !== 'unit' || !OPEN_ASSIGNMENT_STATUSES.includes(parent.status)) {
        throw validationError([{ field: 'parent_id', message: 'Chỉ phân công tiếp dòng giao cho đơn vị đang xử lý' }]);
      }
      const viewer = await this.viewer(database, currentUser);
      if (!this.handles(viewer, parent)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người xử lý của đơn vị được giao phân công tiếp');
      }
      if (inputs.some((input) => input.target_type !== 'staff')) {
        throw validationError([{ field: 'assignments', message: 'Phân công tiếp cho cá nhân trong đơn vị' }]);
      }
    } else {
      await this.assertEditable(currentUser, task);
    }
    const existing = new Set(
      assignments
        .filter((assignment) => assignment.status !== 'cancelled')
        .map((assignment) =>
          assignment.target_type === 'staff'
            ? `staff:${assignment.staff_id}`
            : `unit:${assignment.org_unit_id}:${assignment.department_id ?? ''}`,
        ),
    );
    const duplicate = inputs.some((input) =>
      existing.has(
        input.target_type === 'staff'
          ? `staff:${input.staff_id}`
          : `unit:${input.org_unit_id}:${input.department_id ?? ''}`,
      ),
    );
    if (duplicate) {
      throw validationError([{ field: 'assignments', message: 'Phòng ban hoặc cá nhân này đã được phân công' }]);
    }
    const rows = await this.resolveAssignments(database, inputs, {
      startDate: parent?.start_date ?? this.today(),
      durationDays: null,
      today: this.today(),
      scope: await this.access.scope(currentUser, DIRECT),
      parent,
    });
    await database.transaction().execute(async (transaction) => {
      await this.insertAssignments(transaction, task, rows, parent?.id ?? null, currentUser, origin);
      await this.refreshTask(transaction, task.id);
    });
    return this.detail(currentUser, id);
  }

  async revoke(currentUser: CurrentUser, id: string, assignmentId: string, reason: string | null, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    await this.assertEditable(currentUser, task);
    const assignments = await this.loadAssignments(database, id);
    const assignment = this.findAssignment(assignments, assignmentId);
    if (assignment.status === 'done' || assignment.status === 'cancelled') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Dòng phân công đã hoàn thành hoặc đã thu hồi');
    }
    const remainingMains = assignments.filter(
      (row) => row.role === 'main' && row.status !== 'cancelled' && row.id !== assignment.id,
    );
    if (assignment.role === 'main' && assignment.parent_id === null && remainingMains.length === 0) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Việc phải còn ít nhất một xử lý chính; hủy việc nếu không làm nữa');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('task_assignments')
        .set({ status: 'cancelled', result_note: reason, updated_at: this.clock.now() })
        .where('id', '=', assignment.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assignment.org_unit_id,
        entityName: 'task_assignments',
        entityId: assignment.id,
        action: 'update',
        before: { status: assignment.status },
        after: { status: 'cancelled', result_note: reason },
      });
      await queueNotification(transaction, {
        orgUnitId: assignment.org_unit_id,
        templateCode: 'task_cancelled',
        title: 'Phân công đã bị thu hồi',
        body: `${task.title}${reason ? `: ${reason}` : ''}`,
        targetType: 'tasks',
        targetId: id,
        recipients: await this.handlersOf(transaction, assignment),
      });
      await this.refreshTask(transaction, id);
    });
    return this.detail(currentUser, id);
  }

  private findAssignment(assignments: AssignmentRow[], assignmentId: string): AssignmentRow {
    const assignment = assignments.find((row) => row.id === assignmentId);
    if (!assignment) {
      throw notFoundError('Không tìm thấy dòng phân công', 'task_assignment');
    }
    return assignment;
  }

  // ---- Cập nhật tiến độ, phê duyệt ----

  async progress(
    currentUser: CurrentUser,
    id: string,
    assignmentId: string,
    input: { progressPercent: number; content: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    const assignments = await this.loadAssignments(database, id);
    const assignment = this.findAssignment(assignments, assignmentId);
    const viewer = await this.viewer(database, currentUser);
    if (!this.handles(viewer, assignment)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người được phân công cập nhật được tiến độ');
    }
    if (assignment.role === 'follow') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Vai theo dõi chỉ xem, không cập nhật tiến độ');
    }
    if (
      (task.status !== 'todo' && task.status !== 'in_progress') ||
      !OPEN_ASSIGNMENT_STATUSES.includes(assignment.status)
    ) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Dòng phân công không còn ở trạng thái đang xử lý');
    }
    const finished = input.progressPercent >= 100;
    const status: TaskAssignmentStatus = finished
      ? assignment.role === 'main'
        ? 'pending_approval'
        : 'done'
      : input.progressPercent > 0
        ? 'in_progress'
        : 'todo';
    const now = this.clock.now();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('task_assignments')
        .set({
          status,
          progress_percent: input.progressPercent,
          result_note: input.content ?? undefined,
          completed_at: finished ? now : null,
          updated_at: now,
        })
        .where('id', '=', assignment.id)
        .execute();
      const update = await transaction
        .insertInto('task_updates')
        .values({
          task_id: id,
          assignment_id: assignment.id,
          content: input.content,
          progress_percent: input.progressPercent,
          status: finished ? 'done' : input.progressPercent > 0 ? 'in_progress' : 'todo',
          created_by: currentUser.id,
          created_by_name: origin.actorName,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assignment.org_unit_id,
        entityName: 'task_updates',
        entityId: update.id,
        action: 'create',
        before: { status: assignment.status, progress_percent: assignment.progress_percent },
        after: update,
      });
      if (status === 'pending_approval') {
        await queueNotification(transaction, {
          orgUnitId: task.org_unit_id,
          templateCode: 'task_directive_pending',
          title: 'Việc chờ phê duyệt',
          body: `${origin.actorName} báo đã xử lý xong: ${task.title}`,
          targetType: 'tasks',
          targetId: id,
          recipients: [task.assigner_user_id, task.leader_user_id]
            .filter((userId): userId is string => userId !== null)
            .map((userId) => ({ userId, channel: 'in_app' as const })),
        });
      }
      await this.refreshTask(transaction, id);
    });
    return this.detail(currentUser, id);
  }

  async approve(
    currentUser: CurrentUser,
    id: string,
    assignmentId: string,
    input: { result: 'done' | 'not_done'; note: string | null },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    if (!(await this.canEdit(currentUser, task))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người giao việc hoặc lãnh đạo giao việc phê duyệt được');
    }
    const assignment = this.findAssignment(await this.loadAssignments(database, id), assignmentId);
    if (assignment.status !== 'pending_approval') {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Dòng phân công không ở trạng thái chờ phê duyệt');
    }
    const now = this.clock.now();
    const values =
      input.result === 'done'
        ? { status: 'done' as const, progress_percent: 100 }
        : { status: 'in_progress' as const, completed_at: null };
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('task_assignments')
        .set({
          ...values,
          approval_result: input.result,
          approval_note: input.note,
          approved_by_name: origin.actorName,
          approved_at: now,
          updated_at: now,
        })
        .where('id', '=', assignment.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assignment.org_unit_id,
        entityName: 'task_assignments',
        entityId: assignment.id,
        action: 'update',
        before: { status: assignment.status },
        after: { ...values, approval_result: input.result, approval_note: input.note },
      });
      await queueNotification(transaction, {
        orgUnitId: assignment.org_unit_id,
        templateCode: 'task_directive_approved',
        title: input.result === 'done' ? 'Việc đã được duyệt xử lý xong' : 'Việc được duyệt chưa xử lý xong',
        body: `${task.title}${input.note ? `. ${input.note}` : ''}`,
        targetType: 'tasks',
        targetId: id,
        recipients: await this.handlersOf(transaction, assignment),
      });
      await this.refreshTask(transaction, id);
    });
    return this.detail(currentUser, id);
  }

  // Trạng thái, tiến độ, hạn của việc theo các dòng xử lý chính của người giao (không tính dòng phân công tiếp)
  private async refreshTask(transaction: Transaction<SchoolYearDatabase>, taskId: string) {
    const mains = await transaction
      .selectFrom('task_assignments')
      .select(['status', 'progress_percent', 'due_date', 'completed_at'])
      .where('task_id', '=', taskId)
      .where('role', '=', 'main')
      .where('parent_id', 'is', null)
      .execute();
    const { status, progress } = taskStatusOf(mains);
    const active = mains.filter((row) => row.status !== 'cancelled');
    const completedAt =
      status === 'done'
        ? (active
            .map((row) => row.completed_at)
            .filter((value): value is Date => value !== null)
            .sort((left, right) => left.getTime() - right.getTime())
            .at(-1) ?? this.clock.now())
        : null;
    await transaction
      .updateTable('tasks')
      .set({
        status,
        progress_percent: progress,
        completed_at: completedAt,
        due_date: active.map((row) => row.due_date).sort().at(-1) ?? undefined,
        updated_at: this.clock.now(),
      })
      .where('id', '=', taskId)
      .where('status', '!=', 'cancelled')
      .execute();
  }

  // ---- Tệp đính kèm ----

  async addFile(currentUser: CurrentUser, id: string, upload: { fileName: string; body: Buffer }) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    const assignments = await this.loadAssignments(database, id);
    const { editable, handled } = await this.visibility(database, currentUser, task, assignments);
    if (!editable && handled.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người giao việc hoặc người xử lý đính kèm tệp được');
    }
    if (upload.body.length > DIRECTIVE_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp đính kèm tối đa 50 MB' }]);
    }
    const contentType = detectArchiveFileType(upload.fileName, upload.body);
    if (!contentType) {
      throw validationError([
        { field: 'file', message: 'Tệp đính kèm là PDF, ảnh JPEG, PNG, Word (.doc, .docx) hoặc Excel (.xls, .xlsx)' },
      ]);
    }
    const key = storageKey('tasks', id, randomUUID());
    await this.fileStorage.put(key, upload.body, contentType);
    try {
      await database.transaction().execute(async (transaction) => {
        await sql`select pg_advisory_xact_lock(hashtext(${`task-files:${id}`}))`.execute(transaction);
        const count = await transaction
          .selectFrom('task_files')
          .select((expression) => expression.fn.countAll<string>().as('count'))
          .where('task_id', '=', id)
          .executeTakeFirstOrThrow();
        if (Number(count.count) >= MAXIMUM_FILES) {
          throw ruleViolationError(DIRECTIVE_RULE_CODE, `Mỗi việc đính kèm tối đa ${MAXIMUM_FILES} tệp`);
        }
        await transaction
          .insertInto('task_files')
          .values({
            task_id: id,
            file_name: upload.fileName.slice(0, 200),
            content_type: contentType,
            size_bytes: upload.body.length,
            sha256: sha256(upload.body),
            storage_key: key,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
      });
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
    return this.detail(currentUser, id);
  }

  async readFile(currentUser: CurrentUser, id: string, fileId: string) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    await this.visibility(database, currentUser, task, await this.loadAssignments(database, id));
    const file = await database
      .selectFrom('task_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .where('task_id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'task_file');
    }
    return { fileName: file.file_name, contentType: file.content_type, body: await this.fileStorage.get(file.storage_key) };
  }

  async deleteFile(currentUser: CurrentUser, id: string, fileId: string) {
    const { database } = await this.currentSchoolYear.require();
    const task = await this.loadTask(database, id);
    const { editable } = await this.visibility(database, currentUser, task, await this.loadAssignments(database, id));
    const file = await database
      .selectFrom('task_files')
      .select(['storage_key', 'created_by'])
      .where('id', '=', fileId)
      .where('task_id', '=', id)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp đính kèm', 'task_file');
    }
    if (file.created_by !== currentUser.id && !editable) {
      throw ruleViolationError(DIRECTIVE_RULE_CODE, 'Chỉ người tải lên hoặc người giao việc xóa được tệp');
    }
    await database.deleteFrom('task_files').where('id', '=', fileId).execute();
    await this.fileStorage.delete(file.storage_key).catch(() => undefined);
    return this.detail(currentUser, id);
  }

  // ---- Nhắc việc định kì, nhắc người giao việc khi đến hạn ----

  async remind(): Promise<{ periodic: number; assigner: number }> {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { periodic: 0, assigner: 0 };
    }
    const database = current.database as Kysely<SchoolYearDatabase>;
    const today = this.today();
    const counts = { periodic: 0, assigner: 0 };
    const periodic = await database
      .selectFrom('tasks')
      .select(['id', 'org_unit_id', 'title', 'due_date', 'recurrence', 'next_reminder_on'])
      .where('task_type', '=', 'directive')
      .where('status', 'in', ['todo', 'in_progress'])
      .where('recurrence', '!=', 'none')
      .where('next_reminder_on', '<=', today)
      .limit(500)
      .execute();
    for (const task of periodic) {
      const assignments = await database
        .selectFrom('task_assignments')
        .select(['target_type', 'staff_id', 'org_unit_id'])
        .where('task_id', '=', task.id)
        .where('status', 'in', OPEN_ASSIGNMENT_STATUSES)
        .where('role', '!=', 'follow')
        .execute();
      const recipients = (await Promise.all(assignments.map((row) => this.handlersOf(database, row)))).flat();
      let next = task.next_reminder_on as string;
      while (next <= today) {
        next = nextReminder(next, task.recurrence) as string;
      }
      await database.transaction().execute(async (transaction) => {
        await queueNotification(transaction, {
          orgUnitId: task.org_unit_id,
          templateCode: 'task_directive_reminder',
          title: 'Nhắc việc định kì',
          body: `${task.title}. Hạn ${task.due_date ?? ''}`,
          targetType: 'tasks',
          targetId: task.id,
          recipients,
        });
        await transaction.updateTable('tasks').set({ next_reminder_on: next }).where('id', '=', task.id).execute();
      });
      counts.periodic += 1;
    }
    // Nhắc người giao việc (và lãnh đạo giao việc) một lần khi còn một ngày đến hạn hoặc đã quá hạn mà chưa xong
    const dueSoon = await database
      .selectFrom('tasks')
      .select(['id', 'org_unit_id', 'title', 'due_date', 'assigner_user_id', 'leader_user_id'])
      .where('task_type', '=', 'directive')
      .where('status', 'in', ['todo', 'in_progress'])
      .where('remind_assigner', '=', true)
      .where('assigner_reminded_at', 'is', null)
      .where('due_date', '<=', nextDay(today))
      .limit(500)
      .execute();
    for (const task of dueSoon) {
      await database.transaction().execute(async (transaction) => {
        await queueNotification(transaction, {
          orgUnitId: task.org_unit_id,
          templateCode: 'task_directive_due',
          title: (task.due_date as string) < today ? 'Việc đã giao đã quá hạn' : 'Việc đã giao sắp đến hạn',
          body: `${task.title}. Hạn ${task.due_date ?? ''}`,
          targetType: 'tasks',
          targetId: task.id,
          recipients: [task.assigner_user_id, task.leader_user_id]
            .filter((userId): userId is string => userId !== null)
            .map((userId) => ({ userId, channel: 'in_app' as const })),
        });
        await transaction
          .updateTable('tasks')
          .set({ assigner_reminded_at: this.clock.now() })
          .where('id', '=', task.id)
          .execute();
      });
      counts.assigner += 1;
    }
    return counts;
  }
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

// Ký tự đại diện của LIKE trong chữ người dùng nhập được hiểu đúng là ký tự
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// Hoàn thành đúng hạn: ngày hoàn thành (giờ Việt Nam) không sau ngày hết hạn
function onTime(table: 'tasks' | 'task_assignments') {
  return sql<boolean>`(${sql.ref(`${table}.completed_at`)} at time zone 'Asia/Ho_Chi_Minh')::date <= ${sql.ref(
    `${table}.due_date`,
  )}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyStatusFilter<Query extends { where: (...args: any[]) => Query }>(
  query: Query,
  status: DirectiveStatusFilter | null,
  today: string,
): Query {
  switch (status) {
    case 'open':
      return query.where('task_assignments.status', 'in', OPEN_ASSIGNMENT_STATUSES);
    case 'open_on_time':
      return query
        .where('task_assignments.status', 'in', OPEN_ASSIGNMENT_STATUSES)
        .where('task_assignments.due_date', '>=', today);
    case 'open_overdue':
      return query
        .where('task_assignments.status', 'in', OPEN_ASSIGNMENT_STATUSES)
        .where('task_assignments.due_date', '<', today);
    case 'done':
      return query.where('task_assignments.status', '=', 'done');
    case 'done_on_time':
      return query.where('task_assignments.status', '=', 'done').where(onTime('task_assignments'));
    case 'done_late':
      return query
        .where('task_assignments.status', '=', 'done')
        .where(sql<boolean>`not ${onTime('task_assignments')}`);
    case 'pending_approval':
      return query.where('task_assignments.status', '=', 'pending_approval');
    case 'approved':
      return query.where('task_assignments.approval_result', 'is not', null);
    case 'approved_not_done':
      return query.where('task_assignments.approval_result', '=', 'not_done');
    case 'approved_done':
      return query.where('task_assignments.approval_result', '=', 'done');
    default:
      return query;
  }
}

// Hạn của một dòng: quá hạn khi chưa xong mà ngày hết hạn trước hôm nay; xong thì đúng hạn hay trễ hạn
export function deadlineOf(
  row: { status: TaskAssignmentStatus; due_date: string; completed_at: Date | null },
  today: string,
) {
  const open = OPEN_ASSIGNMENT_STATUSES.includes(row.status) || row.status === 'pending_approval';
  const completedOn = row.completed_at ? VIETNAM_DATE.format(row.completed_at) : null;
  return {
    overdue: open && row.status !== 'pending_approval' && row.due_date < today,
    on_time: completedOn !== null ? completedOn <= row.due_date : null,
  };
}

function readPage(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1 || !PAGE_SIZES.has(pageSize)) {
    throw validationError([{ field: 'page', message: 'Trang hoặc số dòng mỗi trang không hợp lệ' }]);
  }
  return { page, pageSize };
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

const TASK_MESSAGE = 'Mã công việc không hợp lệ';

// Điểm cuối giao việc (DT-18 phần 18c, YCTD-141). Người nhận việc không cần quyền riêng; quyền giao việc, quyền xử lý của
// từng dòng kiểm tra ở dịch vụ
@Controller()
export class DirectivesController {
  constructor(private readonly directives: DirectivesService) {}

  @Get('task-directives/options')
  options(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.directives.options(currentUser);
  }

  @Get('task-directives')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const box = readEnum(query, 'box', BOXES, errors, false) ?? 'inbox';
    const status = readEnum(query, 'status', DIRECTIVE_STATUS_FILTERS, errors, false) ?? null;
    const role = readEnum(query, 'role', DIRECTIVE_ROLES, errors, false) ?? null;
    const target = readEnum(query, 'target', DIRECTIVE_TARGETS, errors, false) ?? null;
    if (query.source_document_id !== undefined && !isUuid(query.source_document_id)) {
      errors.push({ field: 'source_document_id', message: 'Mã không hợp lệ' });
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.directives.list(currentUser, {
      box,
      status,
      role,
      target,
      search: query.q?.trim().slice(0, 200) || null,
      sourceDocumentId: query.source_document_id ?? null,
      ...readPage(query),
    });
  }

  @Get('incoming-documents/:id/tasks')
  byDocument(
    @Param('id', uuidParameter('Mã văn bản không hợp lệ')) documentId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.directives.byDocument(currentUser, documentId);
  }

  @Post('task-directives')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.directives.create(currentUser, body, originOf(request, currentUser));
  }

  @Get('task-directives/:id')
  detail(@Param('id', uuidParameter(TASK_MESSAGE)) id: string, @AuthenticatedUser() currentUser: CurrentUser) {
    return this.directives.detail(currentUser, id);
  }

  @Patch('task-directives/:id')
  update(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.directives.update(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('task-directives/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readWorkText(body, 'reason', errors, { required: true, maximum: 500 });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.directives.cancel(currentUser, id, reason as string, originOf(request, currentUser));
  }

  @Post('task-directives/:id/assignments')
  @HttpCode(201)
  addAssignments(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.directives.addAssignments(currentUser, id, body, originOf(request, currentUser));
  }

  @Post('task-directives/:id/assignments/:assignmentId/revoke')
  @HttpCode(200)
  revoke(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Param('assignmentId', uuidParameter('Mã dòng phân công không hợp lệ')) assignmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readWorkText(body, 'reason', errors, { maximum: 500 });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.directives.revoke(currentUser, id, assignmentId, reason, originOf(request, currentUser));
  }

  @Post('task-directives/:id/assignments/:assignmentId/progress')
  @HttpCode(200)
  progress(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Param('assignmentId', uuidParameter('Mã dòng phân công không hợp lệ')) assignmentId: string,
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
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.directives.progress(
      currentUser,
      id,
      assignmentId,
      { progressPercent: progress as number, content },
      originOf(request, currentUser),
    );
  }

  @Post('task-directives/:id/assignments/:assignmentId/approve')
  @HttpCode(200)
  approve(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Param('assignmentId', uuidParameter('Mã dòng phân công không hợp lệ')) assignmentId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const result = readEnum(body, 'result', ['done', 'not_done'] as const, errors, true);
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return this.directives.approve(
      currentUser,
      id,
      assignmentId,
      { result: result as 'done' | 'not_done', note },
      originOf(request, currentUser),
    );
  }

  @Post('task-directives/:id/files')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: DIRECTIVE_MAXIMUM_FILE_BYTES + 1, files: 1 } }))
  addFile(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @UploadedFile() file: UploadedPart | undefined,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file) {
      throw validationError([{ field: 'file', message: 'Chọn tệp đính kèm' }]);
    }
    return this.directives.addFile(currentUser, id, {
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      body: file.buffer,
    });
  }

  @Get('task-directives/:id/files/:fileId')
  async readFile(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
    @Res() response: Response,
  ) {
    const file = await this.directives.readFile(currentUser, id, fileId);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(file.body);
  }

  @Delete('task-directives/:id/files/:fileId')
  deleteFile(
    @Param('id', uuidParameter(TASK_MESSAGE)) id: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.directives.deleteFile(currentUser, id, fileId);
  }
}

// Tiến trình nhắc việc định kì và nhắc người giao việc (YCTD-141), cùng nhịp với tiến trình gửi thông báo; nhịp bằng 0 (kiểm
// thử) thì không chạy, kiểm thử gọi thẳng DirectivesService.remind
@Injectable()
export class DirectiveJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('DirectiveJobs');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(API_CONFIGURATION) private readonly configuration: ApiConfiguration,
    private readonly directives: DirectivesService,
  ) {}

  onApplicationBootstrap() {
    const seconds = this.configuration.notificationDispatchIntervalSeconds ?? 60;
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.directives.remind();
    } catch (error) {
      this.logger.error('Tiến trình nhắc việc lỗi', error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}

