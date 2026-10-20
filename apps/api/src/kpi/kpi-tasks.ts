import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { KpiTaskStatus } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import type { KpiRuleConfig } from '@school-management/shared';
import type { Request, Response } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { detectArchiveFileType } from '../archives/archives.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { FileStorage } from '../files/file-storage.js';
import { MAXIMUM_FILE_BYTES } from '../files/files.js';
import { readWorkDate, readWorkText } from '../work/work-access.js';
import { round2 } from './kpi-engine.js';
import {
  check,
  inScope,
  KPI_PERMISSIONS,
  kpiRule,
  KpiSupport,
  num,
  type Executor,
  type KpiPeriodRow,
  type KpiTaskRow,
  type StaffRow,
} from './kpi-support.js';

// Việc của từng người trong kỳ (DT-18 phần 18d, YCTD-139): giao việc hoặc tự đăng ký kèm duyệt; người được giao xác nhận hoặc
// chuyển trả có lý do (tối đa số lần của bộ quy tắc); quá hạn duyệt, xác nhận thì việc tự vào danh mục. Người thực hiện nhập
// ngày hoàn thành, minh chứng, số ký hiệu văn bản (chữ tự do; nối văn bản đi khi 18b gộp), tệp, tự đánh giá; tiến độ tự tính
// theo ngày làm việc chậm so với hạn (gia hạn được duyệt thì tính theo hạn mới). Người chấm là người được ủy quyền, cấp trên
// trực tiếp hoặc người quản lý đơn vị; không ai chấm việc của chính mình. Quá hạn chấm thì lấy kết quả tự đánh giá
const MAXIMUM_SELECTED = 500;
const MAXIMUM_FILES_PER_TASK = 20;
const READ_PERMISSIONS = [KPI_PERMISSIONS.participate, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.advise];
const EDITABLE_BY_MANAGER: KpiTaskStatus[] = ['pending_approval', 'assigned', 'returned_to_assigner', 'in_progress'];

export interface TaskContentInput {
  catalogItemId: string | null;
  name: string | null;
  outputResult: string | null;
  axisCode: string | null;
  taskType: string | null;
  difficultyCode: string | null;
  deadline: string;
  isConfidential: boolean;
}

export interface GradeInput {
  qualityCode: string | null;
  resultCode: string | null;
  progressOverride: number | null;
  progressAdjustReason: string | null;
  exceeded: boolean;
  bonusApproved: boolean;
  difficultyCode: string | null;
  comment: string | null;
}

export interface TaskFilter {
  periodId: string;
  orgUnitId: string | null;
  staffId: string | null;
  status: KpiTaskStatus | null;
  keyword: string | null;
}

interface UploadedPart {
  originalname: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class KpiTasksService {
  constructor(
    private readonly support: KpiSupport,
    private readonly fileStorage: FileStorage,
  ) {}

  private taskQuery(database: Executor) {
    return database
      .selectFrom('kpi_tasks')
      .innerJoin('staff', 'staff.id', 'kpi_tasks.staff_id')
      .innerJoin('org_units', 'org_units.id', 'kpi_tasks.org_unit_id')
      .leftJoin('staff as evaluator', 'evaluator.id', 'kpi_tasks.evaluator_staff_id')
      .selectAll('kpi_tasks')
      .select([
        'staff.full_name',
        'staff.code as staff_code',
        'org_units.name as org_unit_name',
        'evaluator.full_name as evaluator_name',
        (eb) =>
          eb
            .selectFrom('kpi_task_files')
            .select((inner) => inner.fn.countAll<string>().as('total'))
            .whereRef('kpi_task_files.task_id', '=', 'kpi_tasks.id')
            .as('file_count'),
      ])
      .orderBy('kpi_tasks.deadline')
      .orderBy('kpi_tasks.created_at');
  }

  private view<Row extends KpiTaskRow & { file_count: string | null }>(row: Row) {
    return {
      ...row,
      standard_score: num(row.standard_score),
      difficulty_weight: num(row.difficulty_weight),
      max_converted: round2(num(row.standard_score) * num(row.difficulty_weight)),
      progress_percent: row.progress_percent === null ? null : num(row.progress_percent),
      task_percent: row.task_percent === null ? null : num(row.task_percent),
      execution_score: row.execution_score === null ? null : num(row.execution_score),
      converted_score: row.converted_score === null ? null : num(row.converted_score),
      bonus_score: row.bonus_score === null ? null : num(row.bonus_score),
      file_count: Number(row.file_count ?? 0),
    };
  }

  async mine(currentUser: CurrentUser, periodId: string) {
    const database = await this.support.database();
    await this.support.applyDue(database, periodId);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (!own) {
      return [];
    }
    const rows = await this.taskQuery(database)
      .where('kpi_tasks.period_id', '=', periodId)
      .where('kpi_tasks.staff_id', '=', own.id)
      .execute();
    return rows.map((row) => this.view(row));
  }

  // Việc người quản lý xem: nhân sự trong phạm vi quản lý, nhân sự nhận mình là cấp trên trực tiếp, việc được ủy quyền chấm.
  // Việc của chính mình không hiện ở đây
  async list(currentUser: CurrentUser, filter: TaskFilter) {
    const database = await this.support.database();
    await this.support.applyDue(database, filter.periodId);
    const own = await this.support.findOwnStaff(database, currentUser);
    const manage = await this.support.scope(currentUser, KPI_PERMISSIONS.manage);
    const advise = await this.support.scope(currentUser, KPI_PERMISSIONS.advise);
    const wholeSchool = manage.wholeSchool || advise.wholeSchool;
    const units = [...new Set([...manage.orgUnitIds, ...advise.orgUnitIds])];
    if (filter.orgUnitId && !wholeSchool && !units.includes(filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let query = this.taskQuery(database).where('kpi_tasks.period_id', '=', filter.periodId);
    if (!wholeSchool) {
      query = query.where((eb) =>
        eb.or([
          ...(units.length ? [eb('kpi_tasks.org_unit_id', 'in', units)] : []),
          ...(own
            ? [
                eb('kpi_tasks.evaluator_staff_id', '=', own.id),
                eb(
                  'kpi_tasks.staff_id',
                  'in',
                  eb.selectFrom('kpi_profiles').select('staff_id').where('superior_staff_id', '=', own.id),
                ),
              ]
            : []),
          eb.val(false),
        ]),
      );
    }
    if (own) {
      query = query.where('kpi_tasks.staff_id', '!=', own.id);
    }
    if (filter.orgUnitId) {
      query = query.where('kpi_tasks.org_unit_id', '=', filter.orgUnitId);
    }
    if (filter.staffId) {
      query = query.where('kpi_tasks.staff_id', '=', filter.staffId);
    }
    if (filter.status) {
      query = query.where('kpi_tasks.status', '=', filter.status);
    }
    if (filter.keyword) {
      const pattern = `%${filter.keyword}%`;
      query = query.where((eb) =>
        eb.or([eb('kpi_tasks.name', 'ilike', pattern), eb('staff.full_name', 'ilike', pattern)]),
      );
    }
    return (await query.limit(5000).execute()).map((row) => this.view(row));
  }

  async read(currentUser: CurrentUser, taskId: string) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own?.id !== task.staff_id && !(await this.canManage(database, currentUser, own, task, true))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được việc này');
    }
    const row = await this.taskQuery(database).where('kpi_tasks.id', '=', taskId).executeTakeFirstOrThrow();
    const files = await database
      .selectFrom('kpi_task_files')
      .innerJoin('files', 'files.id', 'kpi_task_files.file_id')
      .select([
        'files.id',
        'files.file_name',
        'files.content_type',
        'files.size_bytes',
        'kpi_task_files.uploaded_by_name',
        'kpi_task_files.created_at',
      ])
      .where('kpi_task_files.task_id', '=', taskId)
      .orderBy('kpi_task_files.created_at')
      .execute();
    return { ...this.view(row), files };
  }

  // Nhân sự được giao việc, chấm được: trong phạm vi quản lý hoặc nhận mình là cấp trên trực tiếp
  async staffOptions(currentUser: CurrentUser, periodId: string) {
    const database = await this.support.database();
    const own = await this.support.findOwnStaff(database, currentUser);
    const manage = await this.support.scope(currentUser, KPI_PERMISSIONS.manage);
    let query = database
      .selectFrom('kpi_profiles')
      .innerJoin('staff', 'staff.id', 'kpi_profiles.staff_id')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .leftJoin('kpi_period_rule_versions', (join) =>
        join
          .onRef('kpi_period_rule_versions.rule_set_id', '=', 'kpi_profiles.rule_set_id')
          .on('kpi_period_rule_versions.period_id', '=', periodId),
      )
      .select([
        'staff.id',
        'staff.code',
        'staff.full_name',
        'staff.org_unit_id',
        'org_units.name as org_unit_name',
        'kpi_profiles.rule_set_id',
        'kpi_profiles.subject_group',
        'kpi_profiles.school_level',
        'kpi_profiles.job_position',
        'kpi_period_rule_versions.rule_set_version_id',
      ])
      .where('staff.status', '=', 'active')
      .where('kpi_profiles.excluded', '=', false)
      .orderBy('staff.full_name');
    if (own) {
      query = query.where('staff.id', '!=', own.id);
    }
    if (!manage.wholeSchool) {
      query = query.where((eb) =>
        eb.or([
          ...(manage.orgUnitIds.length ? [eb('staff.org_unit_id', 'in', manage.orgUnitIds)] : []),
          ...(own ? [eb('kpi_profiles.superior_staff_id', '=', own.id)] : []),
          eb.val(false),
        ]),
      );
    }
    return query.execute();
  }

  private async find(database: Executor, taskId: string): Promise<KpiTaskRow> {
    const task = await database.selectFrom('kpi_tasks').selectAll().where('id', '=', taskId).executeTakeFirst();
    if (!task) {
      throw notFoundError('Không tìm thấy việc', 'kpi_task');
    }
    return task;
  }

  // Quyền với việc của người khác: người chấm được ủy quyền, cấp trên trực tiếp, người quản lý trong phạm vi; xem thêm cho
  // người tham mưu trong phạm vi
  private async canManage(
    database: Executor,
    currentUser: CurrentUser,
    own: StaffRow | undefined,
    task: KpiTaskRow,
    readOnly = false,
  ): Promise<boolean> {
    if (own?.id === task.staff_id) {
      return false;
    }
    if (own && task.evaluator_staff_id === own.id) {
      return true;
    }
    if (own) {
      const profile = await database
        .selectFrom('kpi_profiles')
        .select('superior_staff_id')
        .where('staff_id', '=', task.staff_id)
        .executeTakeFirst();
      if (profile?.superior_staff_id === own.id) {
        return true;
      }
    }
    if (inScope(await this.support.scope(currentUser, KPI_PERMISSIONS.manage), task.org_unit_id)) {
      return true;
    }
    return readOnly && inScope(await this.support.scope(currentUser, KPI_PERMISSIONS.advise), task.org_unit_id);
  }

  private async assertManager(database: Executor, currentUser: CurrentUser, task: KpiTaskRow) {
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own?.id === task.staff_id) {
      throw kpiRule('Không tự duyệt, tự chấm việc của chính mình');
    }
    if (!(await this.canManage(database, currentUser, own, task))) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có thẩm quyền với việc này');
    }
    return own;
  }

  private async assertOwner(database: Executor, currentUser: CurrentUser, task: KpiTaskRow) {
    const own = await this.support.ownStaff(database, currentUser);
    if (own.id !== task.staff_id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người thực hiện thao tác được việc này');
    }
    return own;
  }

  private async openPeriodOf(database: Executor, task: Pick<KpiTaskRow, 'period_id'>): Promise<KpiPeriodRow> {
    const period = await this.support.period(database, task.period_id);
    this.support.assertOpen(period);
    return period;
  }

  // Nội dung việc từ danh mục hoặc nhập mới, điểm chuẩn và hệ số theo bộ quy tắc của người thực hiện
  private async content(database: Executor, config: KpiRuleConfig, input: TaskContentInput) {
    const errors: FieldError[] = [];
    let base = {
      name: input.name,
      output_result: input.outputResult,
      axis_code: input.axisCode,
      task_type: input.taskType,
      difficulty_code: input.difficultyCode,
      is_confidential: input.isConfidential,
    };
    if (input.catalogItemId) {
      const item = await database
        .selectFrom('kpi_catalog_items')
        .selectAll()
        .where('id', '=', input.catalogItemId)
        .executeTakeFirst();
      if (!item || item.status !== 'active') {
        throw validationError([{ field: 'catalog_item_id', message: 'Chọn công việc đang dùng trong danh mục' }]);
      }
      base = {
        name: input.name ?? item.name,
        output_result: input.outputResult ?? item.output_result,
        axis_code: input.axisCode ?? item.axis_code,
        task_type: input.taskType ?? item.task_type,
        difficulty_code: input.difficultyCode ?? item.difficulty_code,
        is_confidential: input.isConfidential || item.is_confidential,
      };
    }
    if (!base.name) {
      errors.push({ field: 'name', message: 'Bắt buộc nhập tên công việc' });
    }
    if (!config.axes.some((axis) => axis.code === base.axis_code)) {
      errors.push({ field: 'axis_code', message: 'Chọn trục của bộ quy tắc' });
    }
    const taskType = config.task_types.find((item) => item.code === (base.task_type ?? config.task_types[0]?.code));
    if (!taskType) {
      errors.push({ field: 'task_type', message: 'Loại công việc không có trong bộ quy tắc' });
    }
    const difficulty = config.difficulty_levels.find(
      (item) => item.code === (base.difficulty_code ?? config.difficulty_levels[0]?.code),
    );
    if (!difficulty) {
      errors.push({ field: 'difficulty_code', message: 'Hệ số độ khó không có trong bộ quy tắc' });
    }
    check(errors);
    return {
      catalog_item_id: input.catalogItemId,
      name: base.name!,
      output_result: base.output_result,
      axis_code: base.axis_code!,
      task_type: taskType!.code,
      standard_score: taskType!.standard_score,
      difficulty_code: difficulty!.code,
      difficulty_weight: difficulty!.weight,
      is_confidential: base.is_confidential,
      deadline: input.deadline,
      original_deadline: input.deadline,
    };
  }

  // Việc lập trong thời gian đăng ký của lịch kỳ thuộc danh mục đầu kỳ (tính vào A); sau đó là việc phát sinh
  private inPlan(period: KpiPeriodRow): boolean {
    return !period.register_to || this.support.today() <= period.register_to;
  }

  async assign(
    currentUser: CurrentUser,
    periodId: string,
    staffIds: string[],
    input: TaskContentInput,
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own && staffIds.includes(own.id)) {
      throw kpiRule('Không tự giao việc cho chính mình; hãy dùng Đăng ký việc');
    }
    const created: string[] = [];
    await database.transaction().execute(async (transaction) => {
      for (const staffId of staffIds) {
        const staff = await this.support.staff(transaction, staffId);
        const fake = { staff_id: staffId, org_unit_id: staff.org_unit_id, evaluator_staff_id: null } as KpiTaskRow;
        if (!(await this.canManage(transaction, currentUser, own, fake))) {
          throw new ApplicationError('ERR_FORBIDDEN', `${staff.full_name} nằm ngoài phạm vi giao việc của bạn`);
        }
        const rule = await this.support.ruleFor(transaction, periodId, staffId);
        const values = await this.content(transaction, rule.config, input);
        const inPlan = this.inPlan(period);
        const task = await transaction
          .insertInto('kpi_tasks')
          .values({
            ...values,
            period_id: periodId,
            staff_id: staffId,
            org_unit_id: staff.org_unit_id,
            origin: inPlan ? 'assigned' : 'arising',
            in_plan: inPlan,
            status: 'assigned',
            assigned_by_staff_id: own?.id ?? null,
            assigned_by_name: origin.actorName,
            approval_due_at: this.support.dueAt(rule.config.deadlines.approval_days),
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: staff.org_unit_id,
          entityName: 'kpi_tasks',
          entityId: task.id,
          action: 'create',
          before: null,
          after: task,
        });
        await this.support.notifyStaff(transaction, staffId, {
          title: 'Được giao việc KPI',
          body: `${task.is_confidential ? '(Mật) ' : ''}${task.name} — hạn ${task.deadline}. Xác nhận hoặc chuyển trả trong ${rule.config.deadlines.approval_days} ngày`,
          targetId: task.id,
          orgUnitId: staff.org_unit_id,
        });
        created.push(task.id);
      }
    });
    return { created: created.length, ids: created };
  }

  async register(currentUser: CurrentUser, periodId: string, input: TaskContentInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    const own = await this.support.ownStaff(database, currentUser);
    const rule = await this.support.ruleFor(database, periodId, own.id);
    const values = await this.content(database, rule.config, input);
    const inPlan = this.inPlan(period);
    return database.transaction().execute(async (transaction) => {
      const task = await transaction
        .insertInto('kpi_tasks')
        .values({
          ...values,
          period_id: periodId,
          staff_id: own.id,
          org_unit_id: own.org_unit_id,
          origin: inPlan ? 'registered' : 'arising',
          in_plan: inPlan,
          status: 'pending_approval',
          approval_due_at: this.support.dueAt(rule.config.deadlines.approval_days),
          created_by: origin.actorUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: own.org_unit_id,
        entityName: 'kpi_tasks',
        entityId: task.id,
        action: 'create',
        before: null,
        after: task,
      });
      await this.support.notifyStaff(transaction, rule.superiorStaffId, {
        title: 'Có việc KPI chờ duyệt đăng ký',
        body: `${own.full_name}: ${task.is_confidential ? '(Mật) ' : ''}${task.name}. Quá ${rule.config.deadlines.approval_days} ngày không duyệt thì việc tự vào danh mục`,
        targetId: task.id,
        orgUnitId: own.org_unit_id,
      });
      return task;
    });
  }

  private async change(
    database: Executor,
    task: KpiTaskRow,
    patch: Record<string, unknown>,
    origin: ChangeOrigin,
    expected: KpiTaskStatus[],
  ): Promise<KpiTaskRow> {
    const updated = await database
      .updateTable('kpi_tasks')
      .set({ ...patch, updated_at: this.support.clock.now() })
      .where('id', '=', task.id)
      .where('status', 'in', expected)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw kpiRule('Việc đã đổi trạng thái, hãy tải lại');
    }
    await writeAuditLog(database, {
      origin,
      orgUnitId: task.org_unit_id,
      entityName: 'kpi_tasks',
      entityId: task.id,
      action: 'update',
      before: task,
      after: updated,
    });
    return updated;
  }

  async decideRegistration(
    currentUser: CurrentUser,
    taskId: string,
    input: { approve: boolean; note: string | null; difficultyCode: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    const own = await this.assertManager(database, currentUser, task);
    if (task.status !== 'pending_approval') {
      throw kpiRule('Việc không ở trạng thái chờ duyệt đăng ký');
    }
    if (!input.approve && !input.note) {
      throw validationError([{ field: 'note', message: 'Bắt buộc ghi lý do không duyệt' }]);
    }
    const rule = await this.support.ruleFor(database, task.period_id, task.staff_id);
    const difficulty = input.difficultyCode
      ? rule.config.difficulty_levels.find((item) => item.code === input.difficultyCode)
      : undefined;
    if (input.difficultyCode && !difficulty) {
      throw validationError([{ field: 'difficulty_code', message: 'Hệ số độ khó không có trong bộ quy tắc' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        {
          status: input.approve ? 'in_progress' : 'rejected',
          approved_at: this.support.clock.now(),
          approved_by_name: origin.actorName,
          decision_note: input.note,
          ...(difficulty ? { difficulty_code: difficulty.code, difficulty_weight: difficulty.weight } : {}),
        },
        origin,
        ['pending_approval'],
      );
      await this.support.logManagerAction(
        transaction,
        task,
        'approve',
        task.approval_due_at ?? this.support.clock.now(),
        false,
        rule.superiorStaffId,
        own,
      );
      await this.support.notifyStaff(transaction, task.staff_id, {
        title: input.approve ? 'Việc KPI đã được duyệt' : 'Việc KPI không được duyệt',
        body: `${task.name}${input.note ? `: ${input.note}` : ''}`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      await this.support.recompute(transaction, task.period_id, task.staff_id);
      return updated;
    });
  }

  async accept(currentUser: CurrentUser, taskId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (task.status !== 'assigned') {
      throw kpiRule('Việc không ở trạng thái chờ xác nhận');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        { status: 'in_progress', approved_at: this.support.clock.now(), approved_by_name: origin.actorName },
        origin,
        ['assigned'],
      );
      await this.support.recompute(transaction, task.period_id, task.staff_id);
      return updated;
    });
  }

  // Chuyển trả việc được giao cho người giao, có lý do; tối đa số lần của bộ quy tắc
  async returnToAssigner(currentUser: CurrentUser, taskId: string, reason: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (task.status !== 'assigned') {
      throw kpiRule('Chỉ chuyển trả được việc đang chờ xác nhận');
    }
    const rule = await this.support.ruleFor(database, task.period_id, task.staff_id);
    if (task.return_count >= rule.config.deadlines.max_returns) {
      throw kpiRule(`Mỗi việc chỉ được chuyển trả tối đa ${rule.config.deadlines.max_returns} lần`);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        { status: 'returned_to_assigner', return_count: task.return_count + 1, return_reason: reason },
        origin,
        ['assigned'],
      );
      await this.support.notifyStaff(transaction, task.assigned_by_staff_id, {
        title: 'Việc KPI bị chuyển trả',
        body: `${task.name}: ${reason}`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      return updated;
    });
  }

  // Người quản lý sửa nội dung, hạn, hệ số; việc đã bị chuyển trả thì giao lại (chờ xác nhận lần nữa)
  async update(currentUser: CurrentUser, taskId: string, patch: Partial<TaskContentInput>, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertManager(database, currentUser, task);
    if (!EDITABLE_BY_MANAGER.includes(task.status)) {
      throw kpiRule('Việc đã nộp kết quả hoặc đã chấm, không sửa nội dung được');
    }
    const rule = await this.support.ruleFor(database, task.period_id, task.staff_id);
    const values = await this.content(database, rule.config, {
      catalogItemId: null,
      name: patch.name ?? task.name,
      outputResult: patch.outputResult !== undefined ? patch.outputResult : task.output_result,
      axisCode: patch.axisCode ?? task.axis_code,
      taskType: patch.taskType ?? task.task_type,
      difficultyCode: patch.difficultyCode ?? task.difficulty_code,
      deadline: patch.deadline ?? task.deadline,
      isConfidential: patch.isConfidential ?? task.is_confidential,
    });
    const rest: Partial<typeof values> = { ...values };
    delete rest.catalog_item_id;
    delete rest.original_deadline;
    const reassign = task.status === 'returned_to_assigner';
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        {
          ...rest,
          ...(reassign
            ? { status: 'assigned', approval_due_at: this.support.dueAt(rule.config.deadlines.approval_days) }
            : {}),
        },
        origin,
        EDITABLE_BY_MANAGER,
      );
      if (reassign) {
        await this.support.notifyStaff(transaction, task.staff_id, {
          title: 'Việc KPI được giao lại',
          body: `${updated.name} — hạn ${updated.deadline}`,
          targetId: task.id,
          orgUnitId: task.org_unit_id,
        });
      }
      await this.support.recompute(transaction, task.period_id, task.staff_id);
      return updated;
    });
  }

  async cancel(currentUser: CurrentUser, taskId: string, reason: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertManager(database, currentUser, task);
    if (!EDITABLE_BY_MANAGER.includes(task.status)) {
      throw kpiRule('Việc đã nộp kết quả hoặc đã chấm, không hủy được');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        { status: 'cancelled', decision_note: reason },
        origin,
        EDITABLE_BY_MANAGER,
      );
      await this.support.notifyStaff(transaction, task.staff_id, {
        title: 'Việc KPI đã hủy',
        body: `${task.name}: ${reason}`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      await this.support.recompute(transaction, task.period_id, task.staff_id);
      return updated;
    });
  }

  // Xin gia hạn trước hạn; được duyệt thì tiến độ tính theo hạn mới
  async requestExtension(
    currentUser: CurrentUser,
    taskId: string,
    input: { requestedDeadline: string; reason: string },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (!['in_progress', 'rework'].includes(task.status)) {
      throw kpiRule('Chỉ xin gia hạn được việc đang thực hiện');
    }
    if (this.support.today() > task.deadline) {
      throw kpiRule('Đã quá hạn, không xin gia hạn được');
    }
    if (input.requestedDeadline <= task.deadline) {
      throw validationError([{ field: 'requested_deadline', message: 'Hạn mới phải sau hạn hiện tại' }]);
    }
    if (task.extension_status === 'pending') {
      throw kpiRule('Việc đang có đề nghị gia hạn chờ duyệt');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        { requested_deadline: input.requestedDeadline, extension_reason: input.reason, extension_status: 'pending' },
        origin,
        ['in_progress', 'rework'],
      );
      const rule = await this.support.ruleFor(transaction, task.period_id, task.staff_id);
      await this.support.notifyStaff(
        transaction,
        task.evaluator_staff_id ?? task.assigned_by_staff_id ?? rule.superiorStaffId,
        {
          title: 'Có đề nghị gia hạn việc KPI',
          body: `${task.name}: đến ${input.requestedDeadline}. ${input.reason}`,
          targetId: task.id,
          orgUnitId: task.org_unit_id,
        },
      );
      return updated;
    });
  }

  async decideExtension(
    currentUser: CurrentUser,
    taskId: string,
    approve: boolean,
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertManager(database, currentUser, task);
    if (task.extension_status !== 'pending' || !task.requested_deadline) {
      throw kpiRule('Việc không có đề nghị gia hạn chờ duyệt');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        {
          extension_status: approve ? 'approved' : 'rejected',
          ...(approve ? { deadline: task.requested_deadline } : {}),
          decision_note: note,
        },
        origin,
        ['in_progress', 'rework'],
      );
      await this.support.notifyStaff(transaction, task.staff_id, {
        title: approve ? 'Đề nghị gia hạn được duyệt' : 'Đề nghị gia hạn không được duyệt',
        body: `${task.name}${approve ? `: hạn mới ${task.requested_deadline}` : ''}${note ? `. ${note}` : ''}`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      return updated;
    });
  }

  async saveEvidence(
    currentUser: CurrentUser,
    taskId: string,
    input: { actualFinishDate: string | null; evidenceText: string | null; documentNumber: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (!['in_progress', 'rework'].includes(task.status)) {
      throw kpiRule('Chỉ nộp minh chứng được việc đang thực hiện hoặc bị trả lại');
    }
    if (input.actualFinishDate && input.actualFinishDate > this.support.today()) {
      throw validationError([{ field: 'actual_finish_date', message: 'Ngày hoàn thành không sau hôm nay' }]);
    }
    return this.change(
      database,
      task,
      {
        actual_finish_date: input.actualFinishDate,
        evidence_text: input.evidenceText,
        document_number: input.documentNumber,
      },
      origin,
      ['in_progress', 'rework'],
    );
  }

  async attach(
    currentUser: CurrentUser,
    taskId: string,
    file: { fileName: string; body: Buffer },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (!['in_progress', 'rework'].includes(task.status)) {
      throw kpiRule('Chỉ đính kèm minh chứng được việc đang thực hiện hoặc bị trả lại');
    }
    if (file.body.length === 0 || file.body.length > MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 10 MB' }]);
    }
    const contentType = detectArchiveFileType(file.fileName, file.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Tệp minh chứng là PDF, ảnh JPEG, PNG, Word hoặc Excel' }]);
    }
    const count = await database
      .selectFrom('kpi_task_files')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('task_id', '=', taskId)
      .executeTakeFirstOrThrow();
    if (Number(count.total) >= MAXIMUM_FILES_PER_TASK) {
      throw kpiRule(`Mỗi việc tối đa ${MAXIMUM_FILES_PER_TASK} tệp minh chứng`);
    }
    const key = storageKey('kpi-evidence', taskId, randomUUID());
    await this.fileStorage.put(key, file.body, contentType);
    return database.transaction().execute(async (transaction) => {
      const stored = await transaction
        .insertInto('files')
        .values({
          org_unit_id: task.org_unit_id,
          purpose: 'kpi_evidence',
          file_name: file.fileName.slice(0, 200),
          content_type: contentType,
          size_bytes: file.body.length,
          storage_key: key,
          created_by: origin.actorUserId,
        })
        .returning(['id', 'file_name', 'content_type', 'size_bytes'])
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto('kpi_task_files')
        .values({ task_id: taskId, file_id: stored.id, uploaded_by_name: origin.actorName })
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'kpi_task_files',
        entityId: stored.id,
        action: 'create',
        before: null,
        after: { task_id: taskId, file_name: stored.file_name },
      });
      return stored;
    });
  }

  async download(currentUser: CurrentUser, taskId: string, fileId: string) {
    const database = await this.support.database();
    await this.read(currentUser, taskId);
    const file = await database
      .selectFrom('kpi_task_files')
      .innerJoin('files', 'files.id', 'kpi_task_files.file_id')
      .select(['files.file_name', 'files.content_type', 'files.storage_key'])
      .where('kpi_task_files.task_id', '=', taskId)
      .where('kpi_task_files.file_id', '=', fileId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp minh chứng', 'file');
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  async removeFile(currentUser: CurrentUser, taskId: string, fileId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (!['in_progress', 'rework'].includes(task.status)) {
      throw kpiRule('Việc đã nộp kết quả, không xóa minh chứng được');
    }
    const file = await database
      .selectFrom('files')
      .select(['id', 'storage_key', 'file_name'])
      .where('id', '=', fileId)
      .where('id', 'in', (eb) => eb.selectFrom('kpi_task_files').select('file_id').where('task_id', '=', taskId))
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy tệp minh chứng', 'file');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom('kpi_task_files')
        .where('task_id', '=', taskId)
        .where('file_id', '=', fileId)
        .execute();
      await transaction.deleteFrom('files').where('id', '=', fileId).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: task.org_unit_id,
        entityName: 'kpi_task_files',
        entityId: fileId,
        action: 'delete',
        before: { task_id: taskId, file_name: file.file_name },
        after: null,
      });
    });
    await this.fileStorage.delete(file.storage_key);
  }

  // Nộp kết quả và tự đánh giá; cấp trên chấm trong số ngày của bộ quy tắc, quá hạn thì lấy kết quả tự đánh giá
  async selfAssess(
    currentUser: CurrentUser,
    taskId: string,
    input: {
      qualityCode: string | null;
      resultCode: string | null;
      bonusProposed: boolean;
      bonusReason: string | null;
    },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertOwner(database, currentUser, task);
    if (!['in_progress', 'rework'].includes(task.status)) {
      throw kpiRule('Chỉ tự đánh giá được việc đang thực hiện hoặc bị trả lại');
    }
    const rule = await this.support.ruleFor(database, task.period_id, task.staff_id);
    this.assertLevels(rule.config, input.qualityCode, input.resultCode);
    if (input.bonusProposed && !input.bonusReason) {
      throw validationError([{ field: 'bonus_reason', message: 'Bắt buộc ghi lý do đề xuất thưởng' }]);
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        {
          status: 'self_assessed',
          self_quality_code: input.qualityCode,
          self_result_code: input.resultCode,
          bonus_proposed: input.bonusProposed,
          bonus_reason: input.bonusReason,
          self_assessed_at: this.support.clock.now(),
          grading_due_at: this.support.dueAt(rule.config.deadlines.grading_days),
          rework_reason: null,
        },
        origin,
        ['in_progress', 'rework'],
      );
      await this.support.notifyStaff(
        transaction,
        task.evaluator_staff_id ?? task.assigned_by_staff_id ?? rule.superiorStaffId,
        {
          title: 'Có việc KPI chờ chấm',
          body: `${task.name}. Quá ${rule.config.deadlines.grading_days} ngày không chấm thì lấy kết quả tự đánh giá`,
          targetId: task.id,
          orgUnitId: task.org_unit_id,
        },
      );
      return updated;
    });
  }

  private assertLevels(config: KpiRuleConfig, qualityCode: string | null, resultCode: string | null) {
    if (config.scoring_mode === 'progress_quality') {
      if (!config.quality_levels.some((item) => item.code === qualityCode)) {
        throw validationError([{ field: 'quality_code', message: 'Chọn mức kết quả của bộ quy tắc' }]);
      }
    } else if (!config.result_levels.some((item) => item.code === resultCode)) {
      throw validationError([{ field: 'result_code', message: 'Chọn mức của thang đánh giá' }]);
    }
  }

  // Chấm việc; chấm lại được khi kỳ còn mở. Việc vượt yêu cầu và thưởng do người chấm xác nhận
  async grade(currentUser: CurrentUser, taskId: string, input: GradeInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    const own = await this.assertManager(database, currentUser, task);
    if (!['self_assessed', 'graded'].includes(task.status)) {
      throw kpiRule('Việc chưa nộp kết quả tự đánh giá');
    }
    const rule = await this.support.ruleFor(database, task.period_id, task.staff_id);
    this.assertLevels(rule.config, input.qualityCode, input.resultCode);
    if (input.progressOverride !== null && !input.progressAdjustReason) {
      throw validationError([{ field: 'progress_adjust_reason', message: 'Bắt buộc ghi lý do điều chỉnh tiến độ' }]);
    }
    let difficultyPatch = {};
    let measured = task;
    if (input.difficultyCode && input.difficultyCode !== task.difficulty_code) {
      const difficulty = rule.config.difficulty_levels.find((item) => item.code === input.difficultyCode);
      if (!difficulty) {
        throw validationError([{ field: 'difficulty_code', message: 'Hệ số độ khó không có trong bộ quy tắc' }]);
      }
      difficultyPatch = { difficulty_code: difficulty.code, difficulty_weight: difficulty.weight };
      measured = { ...task, difficulty_weight: String(difficulty.weight) };
    }
    const values = await this.support.gradeValues(rule.config, measured, input);
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        {
          ...values,
          ...difficultyPatch,
          status: 'graded',
          progress_adjust_reason: input.progressOverride !== null ? input.progressAdjustReason : null,
          grader_comment: input.comment,
          graded_at: this.support.clock.now(),
          graded_by: origin.actorUserId,
          graded_by_name: origin.actorName,
          auto_graded: false,
        },
        origin,
        ['self_assessed', 'graded'],
      );
      if (task.status === 'self_assessed') {
        await this.support.logManagerAction(
          transaction,
          task,
          'grade',
          task.grading_due_at ?? this.support.clock.now(),
          false,
          rule.superiorStaffId,
          own,
        );
      }
      await this.support.notifyStaff(transaction, task.staff_id, {
        title: 'Việc KPI đã được chấm',
        body: `${task.name}: ${values.converted_score} điểm quy đổi`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      await this.support.recompute(transaction, task.period_id, task.staff_id);
      return updated;
    });
  }

  async rework(currentUser: CurrentUser, taskId: string, reason: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const task = await this.find(database, taskId);
    await this.openPeriodOf(database, task);
    await this.assertManager(database, currentUser, task);
    if (task.status !== 'self_assessed') {
      throw kpiRule('Chỉ trả lại được việc đang chờ chấm');
    }
    return database.transaction().execute(async (transaction) => {
      const updated = await this.change(
        transaction,
        task,
        { status: 'rework', rework_reason: reason, grading_due_at: null },
        origin,
        ['self_assessed'],
      );
      await this.support.notifyStaff(transaction, task.staff_id, {
        title: 'Việc KPI bị trả lại',
        body: `${task.name}: ${reason}`,
        targetId: task.id,
        orgUnitId: task.org_unit_id,
      });
      return updated;
    });
  }

  // Ủy quyền chấm vượt cấp: người quản lý giao quyền chấm các việc cho một người khác (không phải người thực hiện)
  async delegate(
    currentUser: CurrentUser,
    taskIds: string[],
    evaluatorStaffId: string | null,
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const evaluator = evaluatorStaffId ? await this.support.staff(database, evaluatorStaffId) : null;
    if (evaluator && (!evaluator.user_id || evaluator.status !== 'active')) {
      throw validationError([
        { field: 'evaluator_staff_id', message: 'Người được ủy quyền phải có tài khoản đang làm việc' },
      ]);
    }
    const tasks = await database.selectFrom('kpi_tasks').selectAll().where('id', 'in', taskIds).execute();
    if (tasks.length !== taskIds.length) {
      throw notFoundError('Không tìm thấy việc', 'kpi_task');
    }
    const own = await this.support.findOwnStaff(database, currentUser);
    const manage = await this.support.scope(currentUser, KPI_PERMISSIONS.manage);
    for (const task of tasks) {
      await this.openPeriodOf(database, task);
      if (own?.id === task.staff_id || !inScope(manage, task.org_unit_id)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ người quản lý đơn vị của người thực hiện ủy quyền chấm');
      }
      if (evaluator?.id === task.staff_id) {
        throw validationError([{ field: 'evaluator_staff_id', message: 'Không ủy quyền cho chính người thực hiện' }]);
      }
      if (task.status === 'graded' || task.status === 'cancelled' || task.status === 'rejected') {
        throw kpiRule(`Việc "${task.name}" đã chấm hoặc đã hủy, không ủy quyền được`);
      }
    }
    await database.transaction().execute(async (transaction) => {
      for (const task of tasks) {
        await this.change(
          transaction,
          task,
          {
            evaluator_staff_id: evaluator?.id ?? null,
            delegated_by: evaluator ? origin.actorUserId : null,
            delegated_by_name: evaluator ? origin.actorName : null,
            delegated_at: evaluator ? this.support.clock.now() : null,
            delegation_note: evaluator ? note : null,
          },
          origin,
          [task.status],
        );
      }
      if (evaluator) {
        await this.support.notifyStaff(transaction, evaluator.id, {
          title: 'Được ủy quyền chấm việc KPI',
          body: `${tasks.length} việc${note ? `: ${note}` : ''}`,
          targetId: tasks[0]!.id,
          orgUnitId: tasks[0]!.org_unit_id,
        });
      }
    });
    return { updated: tasks.length };
  }
}

function readContent(body: RequestBody, errors: FieldError[]): TaskContentInput {
  const catalogItemId = body?.catalog_item_id ?? null;
  if (catalogItemId !== null && !isUuid(catalogItemId)) {
    errors.push({ field: 'catalog_item_id', message: 'Mã công việc không hợp lệ' });
  }
  return {
    catalogItemId: catalogItemId as string | null,
    name: readWorkText(body, 'name', errors, { maximum: 1000 }),
    outputResult: readWorkText(body, 'output_result', errors, { maximum: 500 }),
    axisCode: readWorkText(body, 'axis_code', errors, { maximum: 30 }),
    taskType: readWorkText(body, 'task_type', errors, { maximum: 30 }),
    difficultyCode: readWorkText(body, 'difficulty_code', errors, { maximum: 30 }),
    deadline: readWorkDate(body, 'deadline', errors, true) ?? '',
    isConfidential: body?.is_confidential === true,
  };
}

function readPeriodId(value: unknown, errors: FieldError[]): string {
  if (!isUuid(value)) {
    errors.push({ field: 'period_id', message: 'Chọn kỳ đánh giá' });
    return '';
  }
  return value;
}

function readReason(body: RequestBody, errors: FieldError[], field = 'reason'): string {
  return readWorkText(body, field, errors, { required: true, maximum: 500 }) ?? '';
}

function readCode(body: RequestBody, field: string, errors: FieldError[]): string | null {
  return readWorkText(body, field, errors, { maximum: 30 });
}

@Controller('kpi/tasks')
export class KpiTasksController {
  constructor(private readonly tasks: KpiTasksService) {}

  @Get('mine')
  @RequirePermission(KPI_PERMISSIONS.participate)
  mine(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readPeriodId(periodId, errors);
    check(errors);
    return this.tasks.mine(currentUser, id);
  }

  @Get('staff-options')
  @RequirePermission(KPI_PERMISSIONS.manage)
  staffOptions(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readPeriodId(periodId, errors);
    check(errors);
    return this.tasks.staffOptions(currentUser, id);
  }

  @Get()
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.advise, KPI_PERMISSIONS.participate)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(query.period_id, errors);
    for (const field of ['org_unit_id', 'staff_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    check(errors);
    return this.tasks.list(currentUser, {
      periodId,
      orgUnitId: query.org_unit_id ?? null,
      staffId: query.staff_id ?? null,
      status: (query.status as KpiTaskStatus | undefined) ?? null,
      keyword: query.q?.trim() || null,
    });
  }

  @Get(':id')
  @RequirePermission(...READ_PERMISSIONS)
  read(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.tasks.read(currentUser, taskId);
  }

  @Post('assign')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.manage)
  assign(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    const ids = body?.staff_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMUM_SELECTED || ids.some((id) => !isUuid(id))) {
      errors.push({ field: 'staff_ids', message: `Chọn từ 1 đến ${MAXIMUM_SELECTED} người` });
    }
    const content = readContent(body, errors);
    check(errors);
    return this.tasks.assign(
      currentUser,
      periodId,
      [...new Set(ids as string[])],
      content,
      originOf(request, currentUser),
    );
  }

  @Post('register')
  @HttpCode(201)
  @RequirePermission(KPI_PERMISSIONS.participate)
  register(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    const content = readContent(body, errors);
    check(errors);
    return this.tasks.register(currentUser, periodId, content, originOf(request, currentUser));
  }

  @Post('delegate')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage)
  delegate(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const ids = body?.task_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMUM_SELECTED || ids.some((id) => !isUuid(id))) {
      errors.push({ field: 'task_ids', message: `Chọn từ 1 đến ${MAXIMUM_SELECTED} việc` });
    }
    const evaluator = body?.evaluator_staff_id ?? null;
    if (evaluator !== null && !isUuid(evaluator)) {
      errors.push({ field: 'evaluator_staff_id', message: 'Mã người được ủy quyền không hợp lệ' });
    }
    const note = readWorkText(body, 'note', errors, { maximum: 500 });
    check(errors);
    return this.tasks.delegate(
      currentUser,
      [...new Set(ids as string[])],
      evaluator as string | null,
      note,
      originOf(request, currentUser),
    );
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  decide(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Chọn duyệt hoặc không duyệt' });
    }
    const input = {
      approve: body?.approve === true,
      note: readWorkText(body, 'note', errors, { maximum: 500 }),
      difficultyCode: readCode(body, 'difficulty_code', errors),
    };
    check(errors);
    return this.tasks.decideRegistration(currentUser, taskId, input, originOf(request, currentUser));
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.participate)
  accept(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.tasks.accept(currentUser, taskId, originOf(request, currentUser));
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.participate)
  returnToAssigner(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readReason(body, errors);
    check(errors);
    return this.tasks.returnToAssigner(currentUser, taskId, reason, originOf(request, currentUser));
  }

  @Patch(':id')
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  update(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const patch: Partial<TaskContentInput> = {};
    if (body?.name !== undefined) {
      patch.name = readWorkText(body, 'name', errors, { required: true, maximum: 1000 });
    }
    if (body?.output_result !== undefined) {
      patch.outputResult = readWorkText(body, 'output_result', errors, { maximum: 500 });
    }
    for (const [field, key] of [
      ['axis_code', 'axisCode'],
      ['task_type', 'taskType'],
      ['difficulty_code', 'difficultyCode'],
    ] as const) {
      if (body?.[field] !== undefined) {
        patch[key] = readCode(body, field, errors);
      }
    }
    if (body?.deadline !== undefined) {
      patch.deadline = readWorkDate(body, 'deadline', errors, true) ?? '';
    }
    if (body?.is_confidential !== undefined) {
      patch.isConfidential = body.is_confidential === true;
    }
    check(errors);
    return this.tasks.update(currentUser, taskId, patch, originOf(request, currentUser));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  cancel(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readReason(body, errors);
    check(errors);
    return this.tasks.cancel(currentUser, taskId, reason, originOf(request, currentUser));
  }

  @Post(':id/extension')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.participate)
  requestExtension(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      requestedDeadline: readWorkDate(body, 'requested_deadline', errors, true) ?? '',
      reason: readReason(body, errors),
    };
    check(errors);
    return this.tasks.requestExtension(currentUser, taskId, input, originOf(request, currentUser));
  }

  @Post(':id/extension/decision')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  decideExtension(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (typeof body?.approve !== 'boolean') {
      errors.push({ field: 'approve', message: 'Chọn duyệt hoặc không duyệt' });
    }
    const note = readWorkText(body, 'note', errors, { maximum: 500 });
    check(errors);
    return this.tasks.decideExtension(
      currentUser,
      taskId,
      body?.approve === true,
      note,
      originOf(request, currentUser),
    );
  }

  @Put(':id/evidence')
  @RequirePermission(KPI_PERMISSIONS.participate)
  saveEvidence(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      actualFinishDate: readWorkDate(body, 'actual_finish_date', errors),
      evidenceText: readWorkText(body, 'evidence_text', errors, { maximum: 2000 }),
      // Số ký hiệu văn bản ghi chữ tự do; khi 18b gộp thì chọn văn bản đi trong sổ
      documentNumber: readWorkText(body, 'document_number', errors, { maximum: 200 }),
    };
    check(errors);
    return this.tasks.saveEvidence(currentUser, taskId, input, originOf(request, currentUser));
  }

  @Post(':id/files')
  @RequirePermission(KPI_PERMISSIONS.participate)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAXIMUM_FILE_BYTES, files: 1 } }))
  attach(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @UploadedFile() file: UploadedPart | undefined,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    if (!file || file.size === 0) {
      throw validationError([{ field: 'file', message: 'Bắt buộc chọn tệp' }]);
    }
    return this.tasks.attach(
      currentUser,
      taskId,
      { fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'), body: file.buffer },
      originOf(request, currentUser),
    );
  }

  @Get(':id/files/:fileId')
  @RequirePermission(...READ_PERMISSIONS)
  async download(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Res() response: Response,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const { file, body } = await this.tasks.download(currentUser, taskId, fileId);
    response.setHeader('content-type', file.content_type);
    response.setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
    response.setHeader('cache-control', 'no-store');
    response.send(body);
  }

  @Delete(':id/files/:fileId')
  @HttpCode(204)
  @RequirePermission(KPI_PERMISSIONS.participate)
  async removeFile(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Param('fileId', uuidParameter('Mã tệp không hợp lệ')) fileId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    await this.tasks.removeFile(currentUser, taskId, fileId, originOf(request, currentUser));
  }

  @Post(':id/self-assess')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.participate)
  selfAssess(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const input = {
      qualityCode: readCode(body, 'quality_code', errors),
      resultCode: readCode(body, 'result_code', errors),
      bonusProposed: body?.bonus_proposed === true,
      bonusReason: readWorkText(body, 'bonus_reason', errors, { maximum: 500 }),
    };
    check(errors);
    return this.tasks.selfAssess(currentUser, taskId, input, originOf(request, currentUser));
  }

  @Post(':id/grade')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  grade(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const override = body?.progress_percent ?? null;
    if (override !== null && (typeof override !== 'number' || override < 0 || override > 100)) {
      errors.push({ field: 'progress_percent', message: 'Tiến độ từ 0 đến 100' });
    }
    const input: GradeInput = {
      qualityCode: readCode(body, 'quality_code', errors),
      resultCode: readCode(body, 'result_code', errors),
      progressOverride: override as number | null,
      progressAdjustReason: readWorkText(body, 'progress_adjust_reason', errors, { maximum: 500 }),
      exceeded: body?.exceeded === true,
      bonusApproved: body?.bonus_approved === true,
      difficultyCode: readCode(body, 'difficulty_code', errors),
      comment: readWorkText(body, 'comment', errors, { maximum: 1000 }),
    };
    check(errors);
    return this.tasks.grade(currentUser, taskId, input, originOf(request, currentUser));
  }

  @Post(':id/rework')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  rework(
    @Param('id', uuidParameter('Mã việc không hợp lệ')) taskId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readReason(body, errors);
    check(errors);
    return this.tasks.rework(currentUser, taskId, reason, originOf(request, currentUser));
  }
}
