import { Injectable } from '@nestjs/common';
import type { KpiTaskStatus, KpiTasksTable, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { KPI_RULE_CODE, PERMISSION_CODES, type KpiRuleConfig, type KpiSubjectGroupCode } from '@school-management/shared';
import type { Kysely, Selectable, Transaction } from 'kysely';
import { SchoolCalendar, VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { queueNotification } from '../common/notification-queue.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { notFoundError } from '../common/request-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import {
  criteriaFor,
  evaluationTotals,
  lateWorkingDays,
  progressPercentFor,
  suggestRank,
  taskMeasure,
  taskScores,
  type KpiTaskForTotal,
} from './kpi-engine.js';

// Phần dùng chung của phân hệ KPI (DT-18 phần 18d, YCTD-139): phạm vi theo quyền, kỳ, cấu hình của phiên bản quy tắc, hạn tự
// động (quá hạn duyệt thì việc tự vào danh mục, quá hạn chấm thì lấy kết quả tự đánh giá) và tính lại điểm phiếu đánh giá.
// Hạn tự động được áp khi có người mở hoặc thao tác ở phân hệ, không cần tiến trình chạy nền
export type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
export type KpiTaskRow = Selectable<KpiTasksTable>;

export const KPI_PERMISSIONS = {
  participate: PERMISSION_CODES.kpiParticipate,
  manage: PERMISSION_CODES.kpiManage,
  advise: PERMISSION_CODES.kpiAdvise,
  vote: PERMISSION_CODES.kpiVote,
  configure: PERMISSION_CODES.kpiConfigure,
} as const;

// Việc đã được xác nhận vào danh mục của người thực hiện; việc chờ duyệt, chờ xác nhận, đã chuyển trả, không duyệt, đã hủy
// không tính điểm
export const COUNTED_STATUSES: KpiTaskStatus[] = ['in_progress', 'self_assessed', 'rework', 'graded'];
const DAY_MILLISECONDS = 86_400_000;

export interface StaffRow {
  id: string;
  org_unit_id: string;
  full_name: string;
  status: 'active' | 'terminated';
  user_id: string | null;
}

export interface KpiPeriodRow {
  id: string;
  code: string;
  name: string;
  status: 'open' | 'locked';
  start_date: string;
  end_date: string;
  register_to: string | null;
}

export function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function kpiRule(message: string): ApplicationError {
  return ruleViolationError(KPI_RULE_CODE, message);
}

export function inScope(scope: OrganizationScope, orgUnitId: string): boolean {
  return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
}

export function num(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

@Injectable()
export class KpiSupport {
  // Phiên bản đã ban hành không sửa nên giữ cấu hình trong bộ nhớ theo mã phiên bản và tên cơ sở dữ liệu năm học
  private readonly publishedConfigs = new Map<string, KpiRuleConfig>();

  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly calendar: SchoolCalendar,
    readonly clock: Clock,
  ) {}

  async database(): Promise<Kysely<SchoolYearDatabase>> {
    return (await this.currentSchoolYear.require()).database;
  }

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  scope(currentUser: CurrentUser, permission: string): Promise<OrganizationScope> {
    return this.organizationScopes.resolveStaff(currentUser, permission);
  }

  async assertScope(currentUser: CurrentUser, permission: string, orgUnitId: string, message: string): Promise<void> {
    if (!inScope(await this.scope(currentUser, permission), orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  async findOwnStaff(database: Executor, currentUser: CurrentUser): Promise<StaffRow | undefined> {
    return database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
  }

  async ownStaff(database: Executor, currentUser: CurrentUser): Promise<StaffRow> {
    const staff = await this.findOwnStaff(database, currentUser);
    if (!staff) {
      throw notFoundError('Tài khoản chưa gắn với hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  async staff(database: Executor, staffId: string): Promise<StaffRow> {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('id', '=', staffId)
      .executeTakeFirst();
    if (!staff) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    return staff;
  }

  async period(database: Executor, periodId: string): Promise<KpiPeriodRow> {
    const period = await database
      .selectFrom('kpi_periods')
      .select(['id', 'code', 'name', 'status', 'start_date', 'end_date', 'register_to'])
      .where('id', '=', periodId)
      .executeTakeFirst();
    if (!period) {
      throw notFoundError('Không tìm thấy kỳ đánh giá', 'kpi_period');
    }
    return period;
  }

  assertOpen(period: KpiPeriodRow): void {
    if (period.status === 'locked') {
      throw kpiRule(`Kỳ "${period.name}" đã khóa, không sửa được dữ liệu đánh giá`);
    }
  }

  async config(database: Executor, versionId: string): Promise<KpiRuleConfig> {
    const cached = this.publishedConfigs.get(versionId);
    if (cached) {
      return cached;
    }
    const version = await database
      .selectFrom('kpi_rule_set_versions')
      .select(['config', 'status'])
      .where('id', '=', versionId)
      .executeTakeFirst();
    if (!version) {
      throw notFoundError('Không tìm thấy phiên bản bộ quy tắc', 'kpi_rule_set_version');
    }
    const config = version.config as KpiRuleConfig;
    if (version.status === 'published') {
      this.publishedConfigs.set(versionId, config);
    }
    return config;
  }

  // Phiên bản quy tắc áp cho một nhân sự trong kỳ: theo bộ quy tắc ở hồ sơ đối tượng đánh giá của nhân sự
  async ruleFor(
    database: Executor,
    periodId: string,
    staffId: string,
  ): Promise<{
    versionId: string;
    config: KpiRuleConfig;
    subjectGroup: KpiSubjectGroupCode;
    isHead: boolean;
    superiorStaffId: string | null;
  }> {
    const profile = await database
      .selectFrom('kpi_profiles')
      .leftJoin('kpi_period_rule_versions', (join) =>
        join
          .onRef('kpi_period_rule_versions.rule_set_id', '=', 'kpi_profiles.rule_set_id')
          .on('kpi_period_rule_versions.period_id', '=', periodId),
      )
      .select([
        'kpi_profiles.subject_group',
        'kpi_profiles.is_head',
        'kpi_profiles.excluded',
        'kpi_profiles.superior_staff_id',
        'kpi_period_rule_versions.rule_set_version_id',
      ])
      .where('kpi_profiles.staff_id', '=', staffId)
      .executeTakeFirst();
    if (!profile || profile.excluded) {
      throw kpiRule('Nhân sự chưa thuộc đối tượng đánh giá KPI (mục 1.3 Đối tượng đánh giá)');
    }
    if (!profile.rule_set_version_id) {
      throw kpiRule('Kỳ đánh giá chưa áp dụng bộ quy tắc của đối tượng này');
    }
    return {
      versionId: profile.rule_set_version_id,
      config: await this.config(database, profile.rule_set_version_id),
      subjectGroup: profile.subject_group,
      isHead: profile.is_head,
      superiorStaffId: profile.superior_staff_id,
    };
  }

  // Ngày làm việc theo lịch năm học (ngày làm việc trong tuần, ngày làm bù; trừ ngày lễ, ngày nghỉ bù)
  async workDayCheck(from: string, to: string): Promise<(date: string) => boolean> {
    if (to <= from) {
      return () => true;
    }
    const days = await this.calendar.staffDays(from, to);
    return (date) => days.get(date)?.kind === 'work';
  }

  async lateDays(deadline: string, finishedOn: string | null): Promise<number | null> {
    if (!finishedOn) {
      return null;
    }
    return lateWorkingDays(deadline, finishedOn, await this.workDayCheck(deadline, finishedOn));
  }

  // Kết quả chấm của một việc từ mức đã chọn; tiến độ tự tính theo ngày làm việc chậm so với hạn, người chấm được điều
  // chỉnh khi chậm vì lý do khách quan
  async gradeValues(
    config: KpiRuleConfig,
    task: Pick<KpiTaskRow, 'deadline' | 'actual_finish_date' | 'standard_score' | 'difficulty_weight'>,
    input: {
      qualityCode: string | null;
      resultCode: string | null;
      progressOverride: number | null;
      exceeded: boolean;
      bonusApproved: boolean;
    },
  ) {
    const lateDays = await this.lateDays(task.deadline, task.actual_finish_date);
    const progressPercent =
      config.scoring_mode === 'progress_quality'
        ? (input.progressOverride ?? progressPercentFor(config, lateDays))
        : null;
    const measure = taskMeasure(config, {
      progressPercent,
      qualityCode: input.qualityCode,
      resultCode: input.resultCode,
    });
    const scores = taskScores(config, {
      standardScore: num(task.standard_score),
      difficultyWeight: num(task.difficulty_weight),
      percent: measure.percent,
      bonusApproved: input.bonusApproved,
    });
    return {
      late_days: lateDays,
      progress_percent: progressPercent,
      quality_code: config.scoring_mode === 'progress_quality' ? input.qualityCode : null,
      result_code: config.scoring_mode === 'level_scale' ? input.resultCode : null,
      task_percent: measure.percent,
      exceeded: input.exceeded && measure.canExceed,
      bonus_approved: input.bonusApproved,
      execution_score: scores.execution,
      converted_score: scores.converted,
      bonus_score: scores.bonus,
    };
  }

  dueAt(days: number): Date {
    return new Date(this.clock.now().getTime() + days * DAY_MILLISECONDS);
  }

  // Áp hạn tự động: quá hạn duyệt đăng ký hoặc xác nhận việc được giao thì việc tự vào danh mục; quá hạn chấm thì lấy kết
  // quả tự đánh giá. Người quản lý để quá hạn được ghi vào sổ trách nhiệm chấm, duyệt
  async applyDue(database: Kysely<SchoolYearDatabase>, periodId?: string): Promise<void> {
    const now = this.clock.now();
    let overdue = database
      .selectFrom('kpi_tasks')
      .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_tasks.period_id')
      .selectAll('kpi_tasks')
      .where('kpi_periods.status', '=', 'open')
      .where((eb) =>
        eb.or([
          eb.and([eb('kpi_tasks.status', 'in', ['pending_approval', 'assigned']), eb('approval_due_at', '<', now)]),
          eb.and([eb('kpi_tasks.status', '=', 'self_assessed'), eb('grading_due_at', '<', now)]),
        ]),
      );
    if (periodId) {
      overdue = overdue.where('kpi_tasks.period_id', '=', periodId);
    }
    const tasks = await overdue.limit(500).execute();
    if (tasks.length === 0) {
      return;
    }
    const touched = new Set<string>();
    for (const task of tasks) {
      await database.transaction().execute(async (transaction) => {
        if (task.status === 'self_assessed') {
          const rule = await this.ruleFor(transaction, task.period_id, task.staff_id).catch(() => undefined);
          if (!rule) {
            return;
          }
          const values = await this.gradeValues(rule.config, task, {
            qualityCode: task.self_quality_code,
            resultCode: task.self_result_code,
            progressOverride: null,
            exceeded: false,
            bonusApproved: false,
          });
          const updated = await transaction
            .updateTable('kpi_tasks')
            .set({
              ...values,
              status: 'graded',
              auto_graded: true,
              graded_at: now,
              graded_by_name: 'Hệ thống (quá hạn chấm, lấy kết quả tự đánh giá)',
              updated_at: now,
            })
            .where('id', '=', task.id)
            .where('status', '=', 'self_assessed')
            .executeTakeFirst();
          if (Number(updated.numUpdatedRows) > 0) {
            await this.logManagerAction(transaction, task, 'grade', task.grading_due_at ?? now, true, rule.superiorStaffId);
          }
        } else {
          const updated = await transaction
            .updateTable('kpi_tasks')
            .set({
              status: 'in_progress',
              auto_approved: true,
              approved_at: now,
              approved_by_name: 'Hệ thống (quá hạn xác nhận)',
              updated_at: now,
            })
            .where('id', '=', task.id)
            .where('status', '=', task.status)
            .executeTakeFirst();
          if (Number(updated.numUpdatedRows) > 0 && task.status === 'pending_approval') {
            const rule = await this.ruleFor(transaction, task.period_id, task.staff_id).catch(() => undefined);
            await this.logManagerAction(
              transaction,
              task,
              'approve',
              task.approval_due_at ?? now,
              true,
              rule?.superiorStaffId ?? null,
            );
          }
        }
      });
      touched.add(`${task.period_id}:${task.staff_id}`);
    }
    for (const key of touched) {
      const [period, staff] = key.split(':') as [string, string];
      await this.recompute(database, period, staff);
    }
  }

  // Người quản lý chịu trách nhiệm một việc: người chấm được ủy quyền, người giao, cấp trên trực tiếp ở hồ sơ đối tượng
  async logManagerAction(
    database: Executor,
    task: Pick<KpiTaskRow, 'id' | 'period_id' | 'evaluator_staff_id' | 'assigned_by_staff_id'>,
    action: 'approve' | 'grade',
    dueAt: Date,
    automatic: boolean,
    superiorStaffId: string | null,
    actor?: StaffRow,
  ): Promise<void> {
    const managerId = actor?.id ?? task.evaluator_staff_id ?? task.assigned_by_staff_id ?? superiorStaffId;
    const manager = managerId
      ? await database.selectFrom('staff').select(['id', 'full_name']).where('id', '=', managerId).executeTakeFirst()
      : undefined;
    const now = this.clock.now();
    await database
      .insertInto('kpi_manager_actions')
      .values({
        period_id: task.period_id,
        task_id: task.id,
        action,
        manager_staff_id: manager?.id ?? null,
        manager_name: manager?.full_name ?? null,
        due_at: dueAt,
        done_at: now,
        on_time: !automatic && now.getTime() <= dueAt.getTime(),
        automatic,
      })
      .execute();
  }

  // Tính lại điểm của phiếu đánh giá (nếu đã lập): tiêu chí chung, A, B, phần công việc, thưởng, tổng, mức đề xuất
  async recompute(database: Executor, periodId: string, staffId: string): Promise<void> {
    const evaluation = await database
      .selectFrom('kpi_evaluations')
      .select(['id', 'rule_set_version_id', 'exclusions'])
      .where('period_id', '=', periodId)
      .where('staff_id', '=', staffId)
      .executeTakeFirst();
    if (!evaluation) {
      return;
    }
    const config = await this.config(database, evaluation.rule_set_version_id);
    const criteria = await database
      .selectFrom('kpi_evaluation_criteria')
      .select(['max_score', 'self_satisfied', 'superior_satisfied'])
      .where('evaluation_id', '=', evaluation.id)
      .execute();
    const generalSelf = criteria.reduce((sum, row) => sum + (row.self_satisfied ? num(row.max_score) : 0), 0);
    const general = criteria.reduce(
      (sum, row) => sum + ((row.superior_satisfied ?? row.self_satisfied) ? num(row.max_score) : 0),
      0,
    );
    const tasks = await database
      .selectFrom('kpi_tasks')
      .selectAll()
      .where('period_id', '=', periodId)
      .where('staff_id', '=', staffId)
      .execute();
    const totals = evaluationTotals(config, general, tasks.map((task) => totalInput(config, task)));
    await database
      .updateTable('kpi_evaluations')
      .set({
        general_self: generalSelf,
        general_score: general,
        plan_max: totals.planMax,
        actual_total: totals.actualTotal,
        task_score: totals.taskScore,
        bonus_score: totals.bonus,
        total_score: totals.total,
        suggested_rank: suggestRank(config, totals, evaluation.exclusions),
        updated_at: this.clock.now(),
      })
      .where('id', '=', evaluation.id)
      .execute();
  }

  // Lập phiếu đánh giá của nhân sự trong kỳ nếu chưa có, kèm tiêu chí chung theo nhóm đối tượng
  async ensureEvaluation(database: Executor, periodId: string, staffId: string): Promise<string> {
    const existing = await database
      .selectFrom('kpi_evaluations')
      .select('id')
      .where('period_id', '=', periodId)
      .where('staff_id', '=', staffId)
      .executeTakeFirst();
    if (existing) {
      return existing.id;
    }
    const rule = await this.ruleFor(database, periodId, staffId);
    const staff = await this.staff(database, staffId);
    const created = await database
      .insertInto('kpi_evaluations')
      .values({
        period_id: periodId,
        staff_id: staffId,
        org_unit_id: staff.org_unit_id,
        rule_set_version_id: rule.versionId,
        subject_group: rule.subjectGroup,
        is_head: rule.isHead,
      })
      .onConflict((conflict) => conflict.columns(['period_id', 'staff_id']).doNothing())
      .returning('id')
      .executeTakeFirst();
    if (!created) {
      return this.ensureEvaluation(database, periodId, staffId);
    }
    const items = criteriaFor(rule.config, rule.subjectGroup);
    if (items.length > 0) {
      await database
        .insertInto('kpi_evaluation_criteria')
        .values(
          items.map((item) => ({
            evaluation_id: created.id,
            criterion_code: item.code,
            max_score: item.max_score,
            self_satisfied: true,
          })),
        )
        .execute();
    }
    await this.recompute(database, periodId, staffId);
    return created.id;
  }

  async notifyStaff(
    database: Executor,
    staffId: string | null,
    notification: { title: string; body: string; targetId: string; orgUnitId: string | null },
  ): Promise<void> {
    if (!staffId) {
      return;
    }
    const staff = await database.selectFrom('staff').select('user_id').where('id', '=', staffId).executeTakeFirst();
    if (!staff?.user_id) {
      return;
    }
    await queueNotification(database, {
      orgUnitId: notification.orgUnitId,
      templateCode: 'kpi',
      title: notification.title,
      body: notification.body,
      targetType: 'kpi_task',
      targetId: notification.targetId,
      recipients: [{ userId: staff.user_id, channel: 'in_app' }],
    });
  }
}

// Một việc quy về dữ liệu của phép tính tổng
export function totalInput(config: KpiRuleConfig, task: KpiTaskRow): KpiTaskForTotal {
  const measure = taskMeasure(config, {
    progressPercent: task.progress_percent === null ? null : num(task.progress_percent),
    qualityCode: task.quality_code,
    resultCode: task.result_code,
  });
  return {
    inPlan: task.in_plan,
    counted: COUNTED_STATUSES.includes(task.status),
    graded: task.status === 'graded',
    maxConverted: Math.round(num(task.standard_score) * num(task.difficulty_weight) * 100) / 100,
    converted: num(task.converted_score),
    bonus: num(task.bonus_score),
    onTime: measure.onTime,
    exceeded: task.exceeded,
    zeroProgress: measure.zeroProgress,
  };
}
