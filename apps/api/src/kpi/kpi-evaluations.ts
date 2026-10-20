import { Body, Controller, Get, HttpCode, Injectable, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import type { KpiRuleConfig } from '@school-management/shared';
import type { Request } from 'express';
import { AuthenticatedUser, RequirePermission } from '../authentication/authentication.guard.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { isUuid, notFoundError, type RequestBody } from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readWorkText } from '../work/work-access.js';
import { criteriaFor, excellentQuota, round2, type KpiQuotaResult } from './kpi-engine.js';
import { check, inScope, KPI_PERMISSIONS, kpiRule, KpiSupport, num, type Executor } from './kpi-support.js';

// Phiếu tự đánh giá, xếp loại của từng người trong kỳ (DT-18 phần 18d, YCTD-139): cá nhân chấm tiêu chí chung (đảm bảo được
// điểm tối đa, không đảm bảo được 0), phần công việc tự tính từ việc đã chấm (A, B), nộp kèm mức tự đề xuất. Cấp trên trả lại
// hoặc kết luận: điều chỉnh tiêu chí chung, đánh dấu trường hợp loại trừ, chọn mức xếp loại. Người tham mưu đề xuất mức toàn
// trường, kiểm tra tỷ lệ xuất sắc; tập thể lãnh đạo biểu quyết. Khóa kỳ chốt mức cuối cùng (theo biểu quyết đa số, nếu không
// có thì theo tham mưu, cấp trên, mức đề xuất) và giữ phiên bản quy tắc đã dùng; mở lại kỳ phải ghi lý do
const BLOCKING_STATUSES = ['pending_approval', 'assigned', 'returned_to_assigner', 'self_assessed'] as const;

export interface CriterionMark {
  code: string;
  satisfied: boolean;
  note: string | null;
}

export interface ConclusionInput {
  criteria: CriterionMark[];
  exclusions: string[];
  exclusionNote: string | null;
  rank: string;
  comment: string | null;
}

@Injectable()
export class KpiEvaluationsService {
  constructor(private readonly support: KpiSupport) {}

  private async evaluationRow(database: Executor, evaluationId: string) {
    const row = await database
      .selectFrom('kpi_evaluations')
      .innerJoin('staff', 'staff.id', 'kpi_evaluations.staff_id')
      .innerJoin('org_units', 'org_units.id', 'kpi_evaluations.org_unit_id')
      .innerJoin('kpi_periods', 'kpi_periods.id', 'kpi_evaluations.period_id')
      .innerJoin('kpi_rule_set_versions', 'kpi_rule_set_versions.id', 'kpi_evaluations.rule_set_version_id')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_rule_set_versions.rule_set_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .selectAll('kpi_evaluations')
      .select([
        'staff.full_name',
        'staff.code as staff_code',
        'staff.dob',
        'job_titles.name as job_title_name',
        'org_units.name as org_unit_name',
        'kpi_periods.name as period_name',
        'kpi_periods.status as period_status',
        'kpi_rule_sets.name as rule_set_name',
        'kpi_rule_set_versions.version_no',
      ])
      .where('kpi_evaluations.id', '=', evaluationId)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy phiếu đánh giá', 'kpi_evaluation');
    }
    return row;
  }

  // Phiếu đầy đủ: điểm, tiêu chí chung kèm nội dung, việc theo trục, biểu quyết
  async detail(database: Executor, evaluationId: string) {
    const row = await this.evaluationRow(database, evaluationId);
    const config = await this.support.config(database, row.rule_set_version_id);
    const marks = await database
      .selectFrom('kpi_evaluation_criteria')
      .selectAll()
      .where('evaluation_id', '=', evaluationId)
      .execute();
    const items = criteriaFor(config, row.subject_group);
    const groups = config.general.groups
      .map((group) => ({
        code: group.code,
        title: group.title,
        items: group.items
          .filter((item) => items.includes(item))
          .map((item) => {
            const mark = marks.find((entry) => entry.criterion_code === item.code);
            const satisfied = mark ? (mark.superior_satisfied ?? mark.self_satisfied) : false;
            return {
              ...item,
              self_satisfied: mark?.self_satisfied ?? false,
              superior_satisfied: mark?.superior_satisfied ?? null,
              note: mark?.note ?? null,
              score: satisfied ? item.max_score : 0,
            };
          }),
      }))
      .filter((group) => group.items.length > 0);
    const tasks = await database
      .selectFrom('kpi_tasks')
      .selectAll()
      .where('period_id', '=', row.period_id)
      .where('staff_id', '=', row.staff_id)
      .where('status', 'not in', ['rejected', 'cancelled'])
      .orderBy('axis_code')
      .orderBy('deadline')
      .execute();
    const votes = await database
      .selectFrom('kpi_votes')
      .select(['voter_name', 'vote_rank', 'comment', 'updated_at'])
      .where('evaluation_id', '=', evaluationId)
      .execute();
    return {
      ...this.numbers(row),
      criteria: groups,
      tasks: tasks.map((task) => ({
        id: task.id,
        name: task.name,
        is_confidential: task.is_confidential,
        output_result: task.output_result,
        axis_code: task.axis_code,
        status: task.status,
        in_plan: task.in_plan,
        origin: task.origin,
        deadline: task.deadline,
        actual_finish_date: task.actual_finish_date,
        document_number: task.document_number,
        standard_score: num(task.standard_score),
        difficulty_weight: num(task.difficulty_weight),
        max_converted: round2(num(task.standard_score) * num(task.difficulty_weight)),
        progress_percent: task.progress_percent === null ? null : num(task.progress_percent),
        quality_code: task.quality_code,
        result_code: task.result_code,
        task_percent: task.task_percent === null ? null : num(task.task_percent),
        execution_score: task.execution_score === null ? null : num(task.execution_score),
        converted_score: task.converted_score === null ? null : num(task.converted_score),
        bonus_score: task.bonus_score === null ? null : num(task.bonus_score),
        exceeded: task.exceeded,
        auto_graded: task.auto_graded,
      })),
      votes,
      config: {
        scoring_mode: config.scoring_mode,
        total_max: config.total_max,
        general_max: config.general.max,
        task_part_max: config.task_part.max,
        axes: config.axes,
        ranks: config.ranks,
        exclusions: config.exclusions,
        quality_levels: config.quality_levels,
        result_levels: config.result_levels,
        bonus: config.bonus,
        forms: config.forms,
      },
    };
  }

  private numbers<Row extends Record<string, unknown>>(row: Row) {
    const result: Record<string, unknown> = { ...row };
    for (const field of [
      'general_self',
      'general_score',
      'plan_max',
      'actual_total',
      'task_score',
      'bonus_score',
      'total_score',
    ]) {
      result[field] = num(row[field] as string);
    }
    return result as Row &
      Record<
        'general_self' | 'general_score' | 'plan_max' | 'actual_total' | 'task_score' | 'bonus_score' | 'total_score',
        number
      >;
  }

  async mine(currentUser: CurrentUser, periodId: string) {
    const database = await this.support.database();
    await this.support.applyDue(database, periodId);
    const own = await this.support.ownStaff(database, currentUser);
    const period = await this.support.period(database, periodId);
    const existing = await database
      .selectFrom('kpi_evaluations')
      .select('id')
      .where('period_id', '=', periodId)
      .where('staff_id', '=', own.id)
      .executeTakeFirst();
    if (!existing) {
      this.support.assertOpen(period);
    }
    const evaluationId = existing?.id ?? (await this.support.ensureEvaluation(database, periodId, own.id));
    await this.support.recompute(database, periodId, own.id);
    return this.detail(database, evaluationId);
  }

  private async ownEvaluation(database: Executor, currentUser: CurrentUser, periodId: string) {
    const own = await this.support.ownStaff(database, currentUser);
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    const evaluationId = await this.support.ensureEvaluation(database, periodId, own.id);
    const evaluation = await this.evaluationRow(database, evaluationId);
    if (evaluation.status !== 'draft' && evaluation.status !== 'returned') {
      throw kpiRule('Phiếu đã nộp, chờ cấp trên; không sửa được');
    }
    return { own, evaluation };
  }

  private validMarks(config: KpiRuleConfig, group: 'leader' | 'staff', marks: CriterionMark[]) {
    const codes = new Set(criteriaFor(config, group).map((item) => item.code));
    const unknown = marks.filter((mark) => !codes.has(mark.code));
    if (unknown.length > 0) {
      throw validationError(
        unknown.map((mark) => ({ field: 'criteria', message: `Tiêu chí ${mark.code} không áp dụng` })),
      );
    }
  }

  async saveSelf(
    currentUser: CurrentUser,
    periodId: string,
    input: { criteria: CriterionMark[]; selfRank: string | null; selfComment: string | null },
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    const { own, evaluation } = await this.ownEvaluation(database, currentUser, periodId);
    const config = await this.support.config(database, evaluation.rule_set_version_id);
    this.validMarks(config, evaluation.subject_group, input.criteria);
    if (input.selfRank && !config.ranks.some((rank) => rank.code === input.selfRank)) {
      throw validationError([{ field: 'self_rank', message: 'Mức xếp loại không có trong bộ quy tắc' }]);
    }
    await database.transaction().execute(async (transaction) => {
      for (const mark of input.criteria) {
        await transaction
          .updateTable('kpi_evaluation_criteria')
          .set({ self_satisfied: mark.satisfied, note: mark.note })
          .where('evaluation_id', '=', evaluation.id)
          .where('criterion_code', '=', mark.code)
          .execute();
      }
      await transaction
        .updateTable('kpi_evaluations')
        .set({ self_rank: input.selfRank, self_comment: input.selfComment, updated_at: this.support.clock.now() })
        .where('id', '=', evaluation.id)
        .execute();
      await this.support.recompute(transaction, periodId, own.id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'kpi_evaluations',
        entityId: evaluation.id,
        action: 'update',
        before: null,
        after: input,
      });
    });
    return this.detail(database, evaluation.id);
  }

  async submit(currentUser: CurrentUser, periodId: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    await this.support.applyDue(database, periodId);
    const { own, evaluation } = await this.ownEvaluation(database, currentUser, periodId);
    if (!evaluation.self_rank) {
      throw validationError([{ field: 'self_rank', message: 'Chọn mức tự đề xuất xếp loại trước khi nộp' }]);
    }
    const profile = await database
      .selectFrom('kpi_profiles')
      .select('superior_staff_id')
      .where('staff_id', '=', own.id)
      .executeTakeFirst();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('kpi_evaluations')
        .set({
          status: 'submitted',
          submitted_at: this.support.clock.now(),
          return_reason: null,
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', evaluation.id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'kpi_evaluations',
        entityId: evaluation.id,
        action: 'update',
        before: { status: evaluation.status },
        after: { status: 'submitted' },
      });
      await this.support.notifyStaff(transaction, profile?.superior_staff_id ?? null, {
        title: 'Có bản tự đánh giá KPI chờ kết luận',
        body: `${own.full_name} — ${evaluation.period_name}`,
        targetId: evaluation.id,
        orgUnitId: evaluation.org_unit_id,
      });
    });
    return this.detail(database, evaluation.id);
  }

  private async readScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    const [manage, advise, vote] = await Promise.all([
      this.support.scope(currentUser, KPI_PERMISSIONS.manage),
      this.support.scope(currentUser, KPI_PERMISSIONS.advise),
      this.support.scope(currentUser, KPI_PERMISSIONS.vote),
    ]);
    if (manage.wholeSchool || advise.wholeSchool || vote.wholeSchool) {
      return { wholeSchool: true, orgUnitIds: [] };
    }
    return {
      wholeSchool: false,
      orgUnitIds: [...new Set([...manage.orgUnitIds, ...advise.orgUnitIds, ...vote.orgUnitIds])],
    };
  }

  private async canConclude(
    database: Executor,
    currentUser: CurrentUser,
    evaluation: { staff_id: string; org_unit_id: string },
  ) {
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own?.id === evaluation.staff_id) {
      throw kpiRule('Không tự kết luận mức xếp loại của chính mình');
    }
    if (own) {
      const profile = await database
        .selectFrom('kpi_profiles')
        .select('superior_staff_id')
        .where('staff_id', '=', evaluation.staff_id)
        .executeTakeFirst();
      if (profile?.superior_staff_id === own.id) {
        return;
      }
    }
    if (!inScope(await this.support.scope(currentUser, KPI_PERMISSIONS.manage), evaluation.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có thẩm quyền đánh giá người này');
    }
  }

  // Danh sách đối tượng trong phạm vi kèm phiếu (chưa lập phiếu thì trạng thái "chưa nộp")
  async list(currentUser: CurrentUser, filter: { periodId: string; orgUnitId: string | null; status: string | null }) {
    const database = await this.support.database();
    await this.support.applyDue(database, filter.periodId);
    const scope = await this.readScope(currentUser);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    let query = database
      .selectFrom('kpi_profiles')
      .innerJoin('staff', 'staff.id', 'kpi_profiles.staff_id')
      .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
      .innerJoin('kpi_rule_sets', 'kpi_rule_sets.id', 'kpi_profiles.rule_set_id')
      .leftJoin('kpi_evaluations', (join) =>
        join.onRef('kpi_evaluations.staff_id', '=', 'staff.id').on('kpi_evaluations.period_id', '=', filter.periodId),
      )
      .select([
        'staff.id as staff_id',
        'staff.code as staff_code',
        'staff.full_name',
        'staff.org_unit_id',
        'org_units.name as org_unit_name',
        'kpi_rule_sets.name as rule_set_name',
        'kpi_profiles.subject_group',
        'kpi_profiles.is_head',
        'kpi_evaluations.id',
        'kpi_evaluations.status',
        'kpi_evaluations.rule_set_version_id',
        'kpi_evaluations.general_score',
        'kpi_evaluations.task_score',
        'kpi_evaluations.bonus_score',
        'kpi_evaluations.total_score',
        'kpi_evaluations.suggested_rank',
        'kpi_evaluations.self_rank',
        'kpi_evaluations.superior_rank',
        'kpi_evaluations.superior_by_name',
        'kpi_evaluations.advisory_rank',
        'kpi_evaluations.advisory_comment',
        'kpi_evaluations.final_rank',
        'kpi_evaluations.exclusions',
        'kpi_evaluations.submitted_at',
      ])
      .where('staff.status', '=', 'active')
      .where('kpi_profiles.excluded', '=', false)
      .orderBy('org_units.name')
      .orderBy('staff.full_name');
    if (!scope.wholeSchool) {
      query = query.where((eb) =>
        eb.or([
          ...(scope.orgUnitIds.length ? [eb('staff.org_unit_id', 'in', scope.orgUnitIds)] : []),
          ...(own ? [eb('kpi_profiles.superior_staff_id', '=', own.id)] : []),
          eb.val(false),
        ]),
      );
    }
    if (filter.orgUnitId) {
      query = query.where('staff.org_unit_id', '=', filter.orgUnitId);
    }
    const rows = await query.execute();
    return rows
      .map((row) => ({
        ...row,
        status: row.status ?? 'draft',
        general_score: num(row.general_score),
        task_score: num(row.task_score),
        bonus_score: num(row.bonus_score),
        total_score: num(row.total_score),
        exclusions: row.exclusions ?? [],
      }))
      .filter((row) => !filter.status || row.status === filter.status);
  }

  async read(currentUser: CurrentUser, evaluationId: string) {
    const database = await this.support.database();
    const row = await this.evaluationRow(database, evaluationId);
    const own = await this.support.findOwnStaff(database, currentUser);
    if (own?.id !== row.staff_id) {
      const profile = await database
        .selectFrom('kpi_profiles')
        .select('superior_staff_id')
        .where('staff_id', '=', row.staff_id)
        .executeTakeFirst();
      if (
        !(own && profile?.superior_staff_id === own.id) &&
        !inScope(await this.readScope(currentUser), row.org_unit_id)
      ) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không xem được phiếu này');
      }
    }
    await this.support.recompute(database, row.period_id, row.staff_id);
    return this.detail(database, evaluationId);
  }

  async returnSelf(currentUser: CurrentUser, evaluationId: string, reason: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const evaluation = await this.evaluationRow(database, evaluationId);
    this.support.assertOpen(await this.support.period(database, evaluation.period_id));
    await this.canConclude(database, currentUser, evaluation);
    if (evaluation.status !== 'submitted' && evaluation.status !== 'concluded') {
      throw kpiRule('Chỉ trả lại được phiếu đã nộp');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('kpi_evaluations')
        .set({
          status: 'returned',
          return_reason: reason,
          superior_rank: null,
          superior_at: null,
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      await transaction
        .updateTable('kpi_evaluation_criteria')
        .set({ superior_satisfied: null })
        .where('evaluation_id', '=', evaluationId)
        .execute();
      await this.support.recompute(transaction, evaluation.period_id, evaluation.staff_id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'kpi_evaluations',
        entityId: evaluationId,
        action: 'update',
        before: { status: evaluation.status },
        after: { status: 'returned', return_reason: reason },
      });
      await this.support.notifyStaff(transaction, evaluation.staff_id, {
        title: 'Bản tự đánh giá KPI bị trả lại',
        body: `${evaluation.period_name}: ${reason}`,
        targetId: evaluationId,
        orgUnitId: evaluation.org_unit_id,
      });
    });
    return this.detail(database, evaluationId);
  }

  // Cấp trên kết luận: mọi việc phải đã duyệt, đã xác nhận và đã chấm (việc còn đang làm tính là chưa hoàn thành)
  async conclude(currentUser: CurrentUser, evaluationId: string, input: ConclusionInput, origin: ChangeOrigin) {
    const database = await this.support.database();
    const evaluation = await this.evaluationRow(database, evaluationId);
    this.support.assertOpen(await this.support.period(database, evaluation.period_id));
    await this.support.applyDue(database, evaluation.period_id);
    await this.canConclude(database, currentUser, evaluation);
    if (evaluation.status !== 'submitted' && evaluation.status !== 'concluded') {
      throw kpiRule('Cá nhân chưa nộp bản tự đánh giá');
    }
    const blocking = await database
      .selectFrom('kpi_tasks')
      .select((eb) => eb.fn.countAll<string>().as('total'))
      .where('period_id', '=', evaluation.period_id)
      .where('staff_id', '=', evaluation.staff_id)
      .where('status', 'in', [...BLOCKING_STATUSES])
      .executeTakeFirstOrThrow();
    if (Number(blocking.total) > 0) {
      throw kpiRule(`Còn ${blocking.total} việc chờ duyệt, chờ xác nhận hoặc chờ chấm; xử lý xong trước khi kết luận`);
    }
    const config = await this.support.config(database, evaluation.rule_set_version_id);
    this.validMarks(config, evaluation.subject_group, input.criteria);
    if (!config.ranks.some((rank) => rank.code === input.rank)) {
      throw validationError([{ field: 'rank', message: 'Mức xếp loại không có trong bộ quy tắc' }]);
    }
    const unknown = input.exclusions.filter((code) => !config.exclusions.some((item) => item.code === code));
    if (unknown.length > 0) {
      throw validationError([{ field: 'exclusions', message: `Trường hợp loại trừ không có: ${unknown.join(', ')}` }]);
    }
    const lowest = [...config.ranks].sort((left, right) => left.min_score - right.min_score)[0]?.code;
    if (input.exclusions.length > 0 && input.rank !== lowest) {
      throw kpiRule('Thuộc trường hợp loại trừ thì xếp mức thấp nhất');
    }
    await database.transaction().execute(async (transaction) => {
      for (const mark of input.criteria) {
        await transaction
          .updateTable('kpi_evaluation_criteria')
          .set({ superior_satisfied: mark.satisfied, ...(mark.note !== null ? { note: mark.note } : {}) })
          .where('evaluation_id', '=', evaluationId)
          .where('criterion_code', '=', mark.code)
          .execute();
      }
      await transaction
        .updateTable('kpi_evaluations')
        .set({
          status: 'concluded',
          exclusions: JSON.stringify(input.exclusions),
          exclusion_note: input.exclusionNote,
          superior_rank: input.rank,
          superior_comment: input.comment,
          superior_by: origin.actorUserId,
          superior_by_name: origin.actorName,
          superior_at: this.support.clock.now(),
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      await this.support.recompute(transaction, evaluation.period_id, evaluation.staff_id);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'kpi_evaluations',
        entityId: evaluationId,
        action: 'update',
        before: { status: evaluation.status, superior_rank: evaluation.superior_rank },
        after: { status: 'concluded', superior_rank: input.rank, exclusions: input.exclusions },
      });
      await this.support.notifyStaff(transaction, evaluation.staff_id, {
        title: 'Cấp trên đã kết luận đánh giá KPI',
        body: `${evaluation.period_name}: ${config.ranks.find((rank) => rank.code === input.rank)?.label ?? input.rank}`,
        targetId: evaluationId,
        orgUnitId: evaluation.org_unit_id,
      });
    });
    return this.detail(database, evaluationId);
  }

  // Tỷ lệ xuất sắc theo từng phiên bản quy tắc trong kỳ, tính trên mức đang đề xuất (biểu quyết, tham mưu, cấp trên)
  private async quotas(
    database: Executor,
    rows: Awaited<ReturnType<KpiEvaluationsService['list']>>,
    pick: (row: (typeof rows)[number]) => string | null,
  ) {
    const byVersion = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.rule_set_version_id) {
        continue;
      }
      byVersion.set(row.rule_set_version_id, [...(byVersion.get(row.rule_set_version_id) ?? []), row]);
    }
    const result: Array<KpiQuotaResult & { rule_set_name: string; version_id: string }> = [];
    for (const [versionId, members] of byVersion) {
      const config = await this.support.config(database, versionId);
      for (const quota of excellentQuota(
        config,
        members.map((row) => ({ rank: pick(row), isHead: row.is_head, group: row.subject_group })),
      )) {
        result.push({ ...quota, rule_set_name: members[0]!.rule_set_name, version_id: versionId });
      }
    }
    return result;
  }

  async advisory(currentUser: CurrentUser, periodId: string) {
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.advise);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền tham mưu');
    }
    const database = await this.support.database();
    const rows = (await this.list(currentUser, { periodId, orgUnitId: null, status: null })).filter((row) =>
      inScope(scope, row.org_unit_id),
    );
    const votes = await this.voteTallies(database, periodId);
    return {
      rows: rows.map((row) => ({ ...row, votes: votes.get(row.id ?? '') ?? {} })),
      quotas: await this.quotas(database, rows, (row) => row.advisory_rank ?? row.superior_rank ?? row.suggested_rank),
    };
  }

  async saveAdvisory(
    currentUser: CurrentUser,
    periodId: string,
    items: Array<{ evaluationId: string; rank: string | null; comment: string | null }>,
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    this.support.assertOpen(await this.support.period(database, periodId));
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.advise);
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const evaluation = await this.evaluationRow(transaction, item.evaluationId);
        if (evaluation.period_id !== periodId) {
          throw validationError([{ field: 'items', message: 'Phiếu không thuộc kỳ này' }]);
        }
        if (!inScope(scope, evaluation.org_unit_id)) {
          throw new ApplicationError('ERR_FORBIDDEN', 'Có phiếu nằm ngoài phạm vi tham mưu của bạn');
        }
        if (evaluation.status !== 'concluded') {
          throw kpiRule(`Phiếu của ${evaluation.full_name} chưa được cấp trên kết luận`);
        }
        const config = await this.support.config(transaction, evaluation.rule_set_version_id);
        if (item.rank && !config.ranks.some((rank) => rank.code === item.rank)) {
          throw validationError([{ field: 'items', message: 'Mức xếp loại không có trong bộ quy tắc' }]);
        }
        await transaction
          .updateTable('kpi_evaluations')
          .set({
            advisory_rank: item.rank,
            advisory_comment: item.comment,
            advisory_by_name: origin.actorName,
            advisory_at: this.support.clock.now(),
            updated_at: this.support.clock.now(),
          })
          .where('id', '=', item.evaluationId)
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: evaluation.org_unit_id,
          entityName: 'kpi_evaluations',
          entityId: item.evaluationId,
          action: 'update',
          before: { advisory_rank: evaluation.advisory_rank },
          after: { advisory_rank: item.rank, advisory_comment: item.comment },
        });
      }
    });
    return this.advisory(currentUser, periodId);
  }

  private async voteTallies(database: Executor, periodId: string): Promise<Map<string, Record<string, number>>> {
    const rows = await database
      .selectFrom('kpi_votes')
      .innerJoin('kpi_evaluations', 'kpi_evaluations.id', 'kpi_votes.evaluation_id')
      .select(['kpi_votes.evaluation_id', 'kpi_votes.vote_rank', (eb) => eb.fn.countAll<string>().as('total')])
      .where('kpi_evaluations.period_id', '=', periodId)
      .groupBy(['kpi_votes.evaluation_id', 'kpi_votes.vote_rank'])
      .execute();
    const result = new Map<string, Record<string, number>>();
    for (const row of rows) {
      result.set(row.evaluation_id, { ...(result.get(row.evaluation_id) ?? {}), [row.vote_rank]: Number(row.total) });
    }
    return result;
  }

  async voting(currentUser: CurrentUser, periodId: string) {
    const database = await this.support.database();
    const rows = (await this.list(currentUser, { periodId, orgUnitId: null, status: 'concluded' })).filter(
      (row) => row.id,
    );
    const mine = await database
      .selectFrom('kpi_votes')
      .select(['evaluation_id', 'vote_rank', 'comment'])
      .where('voter_user_id', '=', currentUser.id)
      .where('evaluation_id', 'in', rows.length ? rows.map((row) => row.id!) : ['00000000-0000-0000-0000-000000000000'])
      .execute();
    const tallies = await this.voteTallies(database, periodId);
    return rows.map((row) => ({
      ...row,
      my_vote: mine.find((vote) => vote.evaluation_id === row.id)?.vote_rank ?? null,
      my_comment: mine.find((vote) => vote.evaluation_id === row.id)?.comment ?? null,
      votes: tallies.get(row.id!) ?? {},
    }));
  }

  async vote(
    currentUser: CurrentUser,
    periodId: string,
    items: Array<{ evaluationId: string; rank: string; comment: string | null }>,
    origin: ChangeOrigin,
  ) {
    const database = await this.support.database();
    this.support.assertOpen(await this.support.period(database, periodId));
    const scope = await this.support.scope(currentUser, KPI_PERMISSIONS.vote);
    const own = await this.support.findOwnStaff(database, currentUser);
    await database.transaction().execute(async (transaction) => {
      for (const item of items) {
        const evaluation = await this.evaluationRow(transaction, item.evaluationId);
        if (evaluation.period_id !== periodId || evaluation.status !== 'concluded') {
          throw kpiRule('Chỉ biểu quyết phiếu đã được cấp trên kết luận trong kỳ này');
        }
        if (!inScope(scope, evaluation.org_unit_id)) {
          throw new ApplicationError('ERR_FORBIDDEN', 'Có phiếu nằm ngoài phạm vi biểu quyết của bạn');
        }
        if (own?.id === evaluation.staff_id) {
          throw kpiRule('Không biểu quyết mức xếp loại của chính mình');
        }
        const config = await this.support.config(transaction, evaluation.rule_set_version_id);
        if (!config.ranks.some((rank) => rank.code === item.rank)) {
          throw validationError([{ field: 'votes', message: 'Mức xếp loại không có trong bộ quy tắc' }]);
        }
        await transaction
          .insertInto('kpi_votes')
          .values({
            evaluation_id: item.evaluationId,
            voter_user_id: currentUser.id,
            voter_name: origin.actorName,
            vote_rank: item.rank,
            comment: item.comment,
          })
          .onConflict((conflict) =>
            conflict
              .columns(['evaluation_id', 'voter_user_id'])
              .doUpdateSet({ vote_rank: item.rank, comment: item.comment, updated_at: this.support.clock.now() }),
          )
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: evaluation.org_unit_id,
          entityName: 'kpi_votes',
          entityId: item.evaluationId,
          action: 'update',
          before: null,
          after: { vote_rank: item.rank },
        });
      }
    });
    return this.voting(currentUser, periodId);
  }

  // Mức cuối cùng: biểu quyết đa số (hòa thì không lấy), rồi tham mưu, cấp trên, mức đề xuất
  private finalRank(
    row: { advisory_rank: string | null; superior_rank: string | null; suggested_rank: string | null },
    votes: Record<string, number>,
  ) {
    const entries = Object.entries(votes).sort((left, right) => right[1] - left[1]);
    if (entries.length > 0 && (entries.length === 1 || entries[0]![1] > entries[1]![1])) {
      return entries[0]![0];
    }
    return row.advisory_rank ?? row.superior_rank ?? row.suggested_rank;
  }

  async lock(periodId: string, note: string | null, origin: ChangeOrigin) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    this.support.assertOpen(period);
    await this.support.applyDue(database, periodId);
    const evaluations = await database
      .selectFrom('kpi_evaluations')
      .selectAll()
      .where('period_id', '=', periodId)
      .execute();
    const tallies = await this.voteTallies(database, periodId);
    const finals = evaluations.map((row) => ({ row, rank: this.finalRank(row, tallies.get(row.id) ?? {}) }));
    const byVersion = new Map<string, typeof finals>();
    for (const item of finals) {
      byVersion.set(item.row.rule_set_version_id, [...(byVersion.get(item.row.rule_set_version_id) ?? []), item]);
    }
    for (const [versionId, members] of byVersion) {
      const config = await this.support.config(database, versionId);
      const exceeded = excellentQuota(
        config,
        members.map((item) => ({ rank: item.rank, isHead: item.row.is_head, group: item.row.subject_group })),
      ).filter((quota) => quota.exceeded);
      if (exceeded.length > 0) {
        throw kpiRule(
          `Số người xếp loại xuất sắc vượt tỷ lệ ${config.excellent_quota.percent}% (${exceeded
            .map((quota) => `${quota.excellent}/${quota.limit}`)
            .join(', ')}); điều chỉnh mức tham mưu hoặc biểu quyết trước khi khóa kỳ`,
        );
      }
    }
    await database.transaction().execute(async (transaction) => {
      for (const item of finals) {
        await transaction
          .updateTable('kpi_evaluations')
          .set({ final_rank: item.rank, updated_at: this.support.clock.now() })
          .where('id', '=', item.row.id)
          .execute();
      }
      await transaction
        .updateTable('kpi_periods')
        .set({
          status: 'locked',
          locked_at: this.support.clock.now(),
          locked_by: origin.actorUserId,
          locked_by_name: origin.actorName,
          lock_note: note,
          updated_at: this.support.clock.now(),
        })
        .where('id', '=', periodId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_periods',
        entityId: periodId,
        action: 'update',
        before: { status: 'open' },
        after: { status: 'locked', note, evaluations: finals.length },
      });
    });
    return { locked: true, evaluations: finals.length };
  }

  async reopen(periodId: string, note: string, origin: ChangeOrigin) {
    const database = await this.support.database();
    const period = await this.support.period(database, periodId);
    if (period.status !== 'locked') {
      throw kpiRule('Kỳ đang mở');
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('kpi_periods')
        .set({ status: 'open', lock_note: note, updated_at: this.support.clock.now() })
        .where('id', '=', periodId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'kpi_periods',
        entityId: periodId,
        action: 'update',
        before: { status: 'locked' },
        after: { status: 'open', note },
      });
    });
    return { reopened: true };
  }
}

function readPeriodId(value: unknown, errors: FieldError[]): string {
  if (!isUuid(value)) {
    errors.push({ field: 'period_id', message: 'Chọn kỳ đánh giá' });
    return '';
  }
  return value;
}

function readMarks(body: RequestBody, errors: FieldError[]): CriterionMark[] {
  const value = body?.criteria ?? [];
  if (!Array.isArray(value) || value.length > 100) {
    errors.push({ field: 'criteria', message: 'Danh sách tiêu chí không hợp lệ' });
    return [];
  }
  return value.map((item, index) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as RequestBody;
    if (typeof entry?.code !== 'string' || typeof entry?.satisfied !== 'boolean') {
      errors.push({ field: `criteria.${index}`, message: 'Mỗi tiêu chí có mã và đảm bảo hay không' });
    }
    return {
      code: String(entry?.code ?? ''),
      satisfied: entry?.satisfied === true,
      note: readWorkText(entry, 'note', errors, { maximum: 500 }),
    };
  });
}

@Controller('kpi')
export class KpiEvaluationsController {
  constructor(private readonly evaluations: KpiEvaluationsService) {}

  @Get('evaluations/mine')
  @RequirePermission(KPI_PERMISSIONS.participate)
  mine(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readPeriodId(periodId, errors);
    check(errors);
    return this.evaluations.mine(currentUser, id);
  }

  @Put('evaluations/mine')
  @RequirePermission(KPI_PERMISSIONS.participate)
  saveSelf(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    const input = {
      criteria: readMarks(body, errors),
      selfRank: readWorkText(body, 'self_rank', errors, { maximum: 30 }),
      selfComment: readWorkText(body, 'self_comment', errors, { maximum: 2000 }),
    };
    check(errors);
    return this.evaluations.saveSelf(currentUser, periodId, input, originOf(request, currentUser));
  }

  @Post('evaluations/mine/submit')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.participate)
  submit(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    check(errors);
    return this.evaluations.submit(currentUser, periodId, originOf(request, currentUser));
  }

  @Get('evaluations')
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.advise, KPI_PERMISSIONS.vote)
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(query.period_id, errors);
    if (query.org_unit_id !== undefined && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    check(errors);
    return this.evaluations.list(currentUser, {
      periodId,
      orgUnitId: query.org_unit_id ?? null,
      status: query.status ?? null,
    });
  }

  @Get('evaluations/:id')
  @RequirePermission(KPI_PERMISSIONS.participate, KPI_PERMISSIONS.manage, KPI_PERMISSIONS.advise, KPI_PERMISSIONS.vote)
  read(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.evaluations.read(currentUser, evaluationId);
  }

  @Post('evaluations/:id/return')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  returnSelf(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const reason = readWorkText(body, 'reason', errors, { required: true, maximum: 1000 }) ?? '';
    check(errors);
    return this.evaluations.returnSelf(currentUser, evaluationId, reason, originOf(request, currentUser));
  }

  @Post('evaluations/:id/conclude')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.manage, KPI_PERMISSIONS.participate)
  conclude(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const exclusions = body?.exclusions ?? [];
    if (!Array.isArray(exclusions) || exclusions.some((code) => typeof code !== 'string')) {
      errors.push({ field: 'exclusions', message: 'Danh sách mã trường hợp loại trừ' });
    }
    const input: ConclusionInput = {
      criteria: readMarks(body, errors),
      exclusions: [...new Set(exclusions as string[])],
      exclusionNote: readWorkText(body, 'exclusion_note', errors, { maximum: 1000 }),
      rank: readWorkText(body, 'rank', errors, { required: true, maximum: 30 }) ?? '',
      comment: readWorkText(body, 'comment', errors, { maximum: 2000 }),
    };
    check(errors);
    return this.evaluations.conclude(currentUser, evaluationId, input, originOf(request, currentUser));
  }

  @Get('advisory')
  @RequirePermission(KPI_PERMISSIONS.advise)
  advisory(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readPeriodId(periodId, errors);
    check(errors);
    return this.evaluations.advisory(currentUser, id);
  }

  @Put('advisory')
  @RequirePermission(KPI_PERMISSIONS.advise)
  saveAdvisory(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    const items = Array.isArray(body?.items) ? (body.items as RequestBody[]) : [];
    if (items.length === 0 || items.length > 1000) {
      errors.push({ field: 'items', message: 'Chọn từ 1 đến 1000 phiếu' });
    }
    const parsed = items.map((item) => {
      if (!isUuid(item?.evaluation_id)) {
        errors.push({ field: 'items', message: 'Mã phiếu không hợp lệ' });
      }
      return {
        evaluationId: item?.evaluation_id as string,
        rank: readWorkText(item, 'rank', errors, { maximum: 30 }),
        comment: readWorkText(item, 'comment', errors, { maximum: 2000 }),
      };
    });
    check(errors);
    return this.evaluations.saveAdvisory(currentUser, periodId, parsed, originOf(request, currentUser));
  }

  @Get('voting')
  @RequirePermission(KPI_PERMISSIONS.vote)
  voting(@Query('period_id') periodId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const id = readPeriodId(periodId, errors);
    check(errors);
    return this.evaluations.voting(currentUser, id);
  }

  @Put('voting')
  @RequirePermission(KPI_PERMISSIONS.vote)
  vote(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const periodId = readPeriodId(body?.period_id, errors);
    const items = Array.isArray(body?.votes) ? (body.votes as RequestBody[]) : [];
    if (items.length === 0 || items.length > 1000) {
      errors.push({ field: 'votes', message: 'Chọn từ 1 đến 1000 phiếu' });
    }
    const parsed = items.map((item) => {
      if (!isUuid(item?.evaluation_id)) {
        errors.push({ field: 'votes', message: 'Mã phiếu không hợp lệ' });
      }
      return {
        evaluationId: item?.evaluation_id as string,
        rank: readWorkText(item, 'rank', errors, { required: true, maximum: 30 }) ?? '',
        comment: readWorkText(item, 'comment', errors, { maximum: 500 }),
      };
    });
    check(errors);
    return this.evaluations.vote(currentUser, periodId, parsed, originOf(request, currentUser));
  }

  @Post('periods/:id/lock')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.configure)
  lock(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { maximum: 1000 });
    check(errors);
    return this.evaluations.lock(periodId, note, originOf(request, currentUser));
  }

  @Post('periods/:id/reopen')
  @HttpCode(200)
  @RequirePermission(KPI_PERMISSIONS.configure)
  reopen(
    @Param('id', uuidParameter('Mã kỳ không hợp lệ')) periodId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const note = readWorkText(body, 'note', errors, { required: true, maximum: 1000 }) ?? '';
    check(errors);
    return this.evaluations.reopen(periodId, note, originOf(request, currentUser));
  }
}
