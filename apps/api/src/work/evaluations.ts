import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { EvaluationStatus, SchoolYearDatabase, WorkPeriodType } from '@school-management/database';
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
import { queueNotification } from '../common/notification-queue.js';
import {
  conflictOnDuplicate,
  isUuid,
  notFoundError,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { readEnum } from '../fees/fee-catalog-fields.js';
import { hasAnyScope, inScope, PERIOD_TYPES, readPeriod, readWorkText, WorkAccess } from './work-access.js';

// Đánh giá nhân sự theo kỳ và chỉ số (P09-05; BR-01, BR-46, BR-47; YCTD-81). Mỗi đơn vị tự cấu hình chỉ số đánh giá (mã,
// tên, trọng số, điểm tối đa). Người đánh giá chấm đủ mọi chỉ số đang dùng của đơn vị chính của nhân sự; điểm tổng là
// trung bình có trọng số của tỷ lệ điểm trên điểm tối đa, quy về thang 100, làm tròn 2 chữ số. Phiếu nháp sửa được; đã
// công bố thì không sửa mà lập phiếu đánh giá lại có lý do, công bố phiếu mới thì phiếu cũ chuyển "đã thay thế".
// Nhân sự chỉ xem phiếu đã công bố của chính mình
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const MAXIMUM_CRITERIA_VALUE = 1000;

interface ScoreInput {
  criterionId: string;
  score: number;
  comment: string | null;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly access: WorkAccess,
    private readonly clock: Clock,
  ) {}

  // Chỉ số đánh giá của đơn vị
  async listCriteria(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.access.readScope(currentUser, PERMISSION_CODES.evaluationManage);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem chỉ số đánh giá');
    }
    if (orgUnitId && !inScope(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database.selectFrom('evaluation_criteria').selectAll().orderBy('code');
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    return (await query.execute()).map(criterionView);
  }

  async createCriterion(
    currentUser: CurrentUser,
    input: { orgUnitId: string; code: string; name: string; weight: number; maxScore: number },
    origin: ChangeOrigin,
  ) {
    await this.assertManager(currentUser, input.orgUnitId);
    const { database } = await this.currentSchoolYear.require();
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('evaluation_criteria')
          .values({
            org_unit_id: input.orgUnitId,
            code: input.code,
            name: input.name,
            weight: input.weight,
            max_score: input.maxScore,
            created_by: origin.actorUserId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: input.orgUnitId,
          entityName: 'evaluation_criteria',
          entityId: row.id,
          action: 'create',
          before: null,
          after: row,
        });
        return row;
      }),
      'Mã chỉ số đã có trong đơn vị',
      'code',
    );
    return criterionView(created);
  }

  // Sửa chỉ số chỉ ảnh hưởng phiếu lập sau; phiếu đã lập giữ trọng số và điểm tối đa lúc chấm
  async updateCriterion(
    currentUser: CurrentUser,
    criterionId: string,
    patch: { name?: string; weight?: number; maxScore?: number; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const criterion = await database
      .selectFrom('evaluation_criteria')
      .selectAll()
      .where('id', '=', criterionId)
      .executeTakeFirst();
    if (!criterion) {
      throw notFoundError('Không tìm thấy chỉ số đánh giá', 'evaluation_criterion');
    }
    await this.assertManager(currentUser, criterion.org_unit_id);
    const updated = await database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('evaluation_criteria')
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
          ...(patch.maxScore !== undefined ? { max_score: patch.maxScore } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', criterionId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: criterion.org_unit_id,
        entityName: 'evaluation_criteria',
        entityId: criterionId,
        action: 'update',
        before: criterion,
        after: row,
      });
      return row;
    });
    return criterionView(updated);
  }

  async list(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      staffId: string | null;
      periodType: WorkPeriodType | null;
      periodValue: string | null;
      status: EvaluationStatus | null;
    },
  ) {
    const scope = await this.access.readScope(currentUser, PERMISSION_CODES.evaluationManage);
    if (!hasAnyScope(scope)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu đánh giá');
    }
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.evaluationQuery(database).orderBy('evaluations.created_at', 'desc');
    if (filter.orgUnitId) {
      query = query.where('evaluations.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('evaluations.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.staffId) query = query.where('evaluations.staff_id', '=', filter.staffId);
    if (filter.periodType) query = query.where('evaluations.period_type', '=', filter.periodType);
    if (filter.periodValue) query = query.where('evaluations.period_value', '=', filter.periodValue);
    if (filter.status) query = query.where('evaluations.status', '=', filter.status);
    const rows = await query.execute();
    return this.withScores(database, rows);
  }

  async read(currentUser: CurrentUser, evaluationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const evaluation = await this.evaluationQuery(database)
      .where('evaluations.id', '=', evaluationId)
      .executeTakeFirst();
    if (!evaluation) {
      throw notFoundError('Không tìm thấy phiếu đánh giá', 'evaluation');
    }
    const own = await this.access.findOwnStaff(database, currentUser);
    const isSelf = own?.id === evaluation.staff_id && evaluation.status !== 'draft';
    const scope = await this.access.readScope(currentUser, PERMISSION_CODES.evaluationManage);
    if (!isSelf && !inScope(scope, evaluation.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem phiếu đánh giá này');
    }
    const [view] = await this.withScores(database, [evaluation]);
    return {
      ...view!,
      can_manage: await this.access.canManage(currentUser, PERMISSION_CODES.evaluationManage, evaluation.org_unit_id),
    };
  }

  // Phiếu đánh giá đã công bố của chính mình (BR-46)
  async mine(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const own = await this.access.findOwnStaff(database, currentUser);
    if (!own) {
      return [];
    }
    const rows = await this.evaluationQuery(database)
      .where('evaluations.staff_id', '=', own.id)
      .where('evaluations.status', '=', 'published')
      .orderBy('evaluations.published_at', 'desc')
      .execute();
    return this.withScores(database, rows);
  }

  async create(
    currentUser: CurrentUser,
    input: {
      staffId: string;
      periodType: WorkPeriodType;
      periodValue: string;
      comment: string | null;
      reevaluationReason: string | null;
      scores: ScoreInput[];
    },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await this.access.staff(database, input.staffId);
    await this.assertManager(currentUser, staff.org_unit_id);
    const own = await this.access.findOwnStaff(database, currentUser);
    if (own?.id === staff.id) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Không tự đánh giá chính mình');
    }
    const existing = await database
      .selectFrom('evaluations')
      .select(['id', 'status'])
      .where('staff_id', '=', staff.id)
      .where('period_type', '=', input.periodType)
      .where('period_value', '=', input.periodValue)
      .where('status', 'in', ['draft', 'published'])
      .execute();
    if (existing.some((row) => row.status === 'draft')) {
      throw new ApplicationError('ERR_CONFLICT', 'Nhân sự đã có phiếu đánh giá nháp của kỳ này, sửa phiếu đó', [
        { field: 'period_value', message: 'Đã có phiếu nháp' },
      ]);
    }
    const published = existing.find((row) => row.status === 'published');
    if (published && !input.reevaluationReason) {
      throw ruleViolationError('BR-47', 'Kỳ này đã có kết quả công bố; lập đánh giá lại phải ghi lý do', [
        { field: 'reevaluation_reason', message: 'Bắt buộc nhập lý do đánh giá lại' },
      ]);
    }
    const scored = await this.scoreOf(database, staff.org_unit_id, input.scores);
    const created = await conflictOnDuplicate(
      database.transaction().execute(async (transaction) => {
        const row = await transaction
          .insertInto('evaluations')
          .values({
            staff_id: staff.id,
            org_unit_id: staff.org_unit_id,
            period_type: input.periodType,
            period_value: input.periodValue,
            total_score: scored.total,
            comment: input.comment,
            replaces_id: published?.id ?? null,
            reevaluation_reason: published ? input.reevaluationReason : null,
            evaluated_by: currentUser.id,
            evaluated_by_name: origin.actorName,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('evaluation_scores')
          .values(scored.rows.map((score) => ({ ...score, evaluation_id: row.id })))
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: staff.org_unit_id,
          entityName: 'evaluations',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { ...row, scores: scored.rows },
        });
        return row;
      }),
      'Nhân sự đã có phiếu đánh giá nháp của kỳ này',
      'period_value',
    );
    return this.read(currentUser, created.id);
  }

  // Sửa phiếu nháp; phiếu đã công bố không sửa được (BR-47)
  async update(
    currentUser: CurrentUser,
    evaluationId: string,
    patch: { comment?: string | null; scores?: ScoreInput[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const evaluation = await this.load(database, evaluationId);
    await this.assertManager(currentUser, evaluation.org_unit_id);
    if (evaluation.status !== 'draft') {
      throw ruleViolationError('BR-47', 'Kết quả đánh giá đã công bố không sửa được; lập đánh giá lại có lý do');
    }
    const scored = patch.scores ? await this.scoreOf(database, evaluation.org_unit_id, patch.scores) : null;
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('evaluations')
        .set({
          ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
          ...(scored ? { total_score: scored.total } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      if (scored) {
        await transaction.deleteFrom('evaluation_scores').where('evaluation_id', '=', evaluationId).execute();
        await transaction
          .insertInto('evaluation_scores')
          .values(scored.rows.map((score) => ({ ...score, evaluation_id: evaluationId })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'evaluations',
        entityId: evaluationId,
        action: 'update',
        before: evaluation,
        after: { comment: patch.comment, total_score: scored?.total, scores: scored?.rows },
      });
    });
    return this.read(currentUser, evaluationId);
  }

  async publish(currentUser: CurrentUser, evaluationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const evaluation = await this.load(database, evaluationId);
    await this.assertManager(currentUser, evaluation.org_unit_id);
    if (evaluation.status !== 'draft') {
      throw ruleViolationError('BR-47', 'Phiếu đánh giá này đã công bố hoặc đã được thay thế');
    }
    const staff = await this.access.staff(database, evaluation.staff_id);
    await database.transaction().execute(async (transaction) => {
      // Phiếu đã công bố trước đó của kỳ chuyển "đã thay thế" trước để giữ một phiếu công bố mỗi kỳ
      const replaced = await transaction
        .updateTable('evaluations')
        .set({ status: 'superseded', updated_at: this.clock.now() })
        .where('staff_id', '=', evaluation.staff_id)
        .where('period_type', '=', evaluation.period_type)
        .where('period_value', '=', evaluation.period_value)
        .where('status', '=', 'published')
        .returning('id')
        .execute();
      await transaction
        .updateTable('evaluations')
        .set({
          status: 'published',
          published_by: currentUser.id,
          published_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: evaluation.org_unit_id,
        entityName: 'evaluations',
        entityId: evaluationId,
        action: 'update',
        before: { status: 'draft' },
        after: { status: 'published', superseded: replaced.map((row) => row.id) },
      });
      if (staff.user_id) {
        await queueNotification(transaction, {
          orgUnitId: evaluation.org_unit_id,
          templateCode: 'evaluation_published',
          title: replaced.length ? 'Kết quả đánh giá lại đã công bố' : 'Kết quả đánh giá đã công bố',
          body: `Kỳ ${evaluation.period_value}: ${Number(evaluation.total_score)} điểm`,
          targetType: 'evaluations',
          targetId: evaluationId,
          recipients: [{ userId: staff.user_id, channel: 'in_app' }],
        });
      }
    });
    return this.read(currentUser, evaluationId);
  }

  // Chấm đủ mọi chỉ số đang dùng của đơn vị, điểm từ 0 đến điểm tối đa của chỉ số
  private async scoreOf(database: Executor, orgUnitId: string, scores: ScoreInput[]) {
    const criteria = await database
      .selectFrom('evaluation_criteria')
      .selectAll()
      .where('org_unit_id', '=', orgUnitId)
      .where('status', '=', 'active')
      .orderBy('code')
      .execute();
    if (criteria.length === 0) {
      throw ruleViolationError('BR-47', 'Đơn vị chưa cấu hình chỉ số đánh giá');
    }
    const errors: FieldError[] = [];
    const rows = criteria.map((criterion) => {
      const given = scores.find((score) => score.criterionId === criterion.id);
      const maxScore = Number(criterion.max_score);
      if (!given) {
        errors.push({ field: `scores.${criterion.code}`, message: `Chưa chấm chỉ số ${criterion.name}` });
      } else if (given.score > maxScore) {
        errors.push({ field: `scores.${criterion.code}`, message: `Điểm tối đa của ${criterion.name} là ${maxScore}` });
      }
      return {
        criterion_id: criterion.id,
        criterion_code: criterion.code,
        criterion_name: criterion.name,
        weight: Number(criterion.weight),
        max_score: maxScore,
        score: given?.score ?? 0,
        comment: given?.comment ?? null,
      };
    });
    for (const score of scores) {
      if (!criteria.some((criterion) => criterion.id === score.criterionId)) {
        errors.push({ field: 'scores', message: 'Có chỉ số không thuộc đơn vị hoặc đã ngừng dùng' });
        break;
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    return { rows, total: weightedTotal(rows) };
  }

  private async withScores<Row extends { id: string; total_score: string }>(database: Executor, rows: Row[]) {
    const scores = rows.length
      ? await database
          .selectFrom('evaluation_scores')
          .selectAll()
          .where(
            'evaluation_id',
            'in',
            rows.map((row) => row.id),
          )
          .orderBy('criterion_code')
          .execute()
      : [];
    return rows.map((row) => ({
      ...row,
      total_score: Number(row.total_score),
      scores: scores
        .filter((score) => score.evaluation_id === row.id)
        .map((score) => ({
          ...score,
          weight: Number(score.weight),
          max_score: Number(score.max_score),
          score: Number(score.score),
        })),
    }));
  }

  private evaluationQuery(database: Executor) {
    return database
      .selectFrom('evaluations')
      .innerJoin('staff', 'staff.id', 'evaluations.staff_id')
      .selectAll('evaluations')
      .select(['staff.full_name', 'staff.code as staff_code']);
  }

  private async load(database: Executor, evaluationId: string) {
    const evaluation = await database
      .selectFrom('evaluations')
      .selectAll()
      .where('id', '=', evaluationId)
      .executeTakeFirst();
    if (!evaluation) {
      throw notFoundError('Không tìm thấy phiếu đánh giá', 'evaluation');
    }
    return evaluation;
  }

  private assertManager(currentUser: CurrentUser, orgUnitId: string) {
    return this.access.assertManage(
      currentUser,
      PERMISSION_CODES.evaluationManage,
      orgUnitId,
      'Bạn không có quyền đánh giá nhân sự của đơn vị này',
    );
  }
}

// Điểm tổng thang 100: tổng (điểm / điểm tối đa × trọng số) / tổng trọng số × 100, làm tròn 2 chữ số
export function weightedTotal(rows: Array<{ weight: number; max_score: number; score: number }>): number {
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }
  const value = rows.reduce((sum, row) => sum + (row.score / row.max_score) * row.weight, 0) / totalWeight;
  return Math.round(value * 10_000) / 100;
}

function criterionView<Row extends { weight: string; max_score: string }>(row: Row) {
  return { ...row, weight: Number(row.weight), max_score: Number(row.max_score) };
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readPositive(body: RequestBody, field: string, errors: FieldError[], required: boolean): number | undefined {
  const value = body?.[field];
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAXIMUM_CRITERIA_VALUE) {
    errors.push({ field, message: `Số lớn hơn 0, tối đa ${MAXIMUM_CRITERIA_VALUE}` });
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function readScores(body: RequestBody, errors: FieldError[], required: boolean): ScoreInput[] | undefined {
  const value = body?.scores;
  if (value === undefined && !required) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    errors.push({ field: 'scores', message: 'Bắt buộc chấm điểm các chỉ số' });
    return [];
  }
  return value.map((item, index) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as RequestBody;
    const criterionId = readRequiredUuid(entry, 'criterion_id', errors, 'Bắt buộc chọn chỉ số');
    const score = entry?.score;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      errors.push({ field: `scores.${index}.score`, message: 'Điểm là số không âm' });
    }
    return {
      criterionId,
      score: typeof score === 'number' ? Math.round(score * 100) / 100 : 0,
      comment: readWorkText(entry, 'comment', errors, { maximum: 500 }),
    };
  });
}

@Controller()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('evaluation-criteria')
  listCriteria(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.evaluations.listCriteria(currentUser, orgUnitId ?? null);
  }

  @Post('evaluation-criteria')
  @HttpCode(201)
  createCriterion(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const code = readWorkText(body, 'code', errors, { required: true, maximum: 30 }) ?? '';
    const input = {
      orgUnitId: readRequiredUuid(body, 'org_unit_id', errors, 'Bắt buộc chọn đơn vị'),
      code: code.toUpperCase(),
      name: readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? '',
      weight: readPositive(body, 'weight', errors, true) ?? 0,
      maxScore: readPositive(body, 'max_score', errors, true) ?? 0,
    };
    check(errors);
    return this.evaluations.createCriterion(currentUser, input, originOf(request, currentUser));
  }

  @Patch('evaluation-criteria/:id')
  updateCriterion(
    @Param('id', uuidParameter('Mã chỉ số không hợp lệ')) criterionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const patch = {
      name:
        body?.name === undefined
          ? undefined
          : (readWorkText(body, 'name', errors, { required: true, maximum: 200 }) ?? ''),
      weight: readPositive(body, 'weight', errors, false),
      maxScore: readPositive(body, 'max_score', errors, false),
      status: readStatus(body, errors),
    };
    check(errors);
    return this.evaluations.updateCriterion(currentUser, criterionId, patch, originOf(request, currentUser));
  }

  @Get('evaluations')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    for (const field of ['org_unit_id', 'staff_id']) {
      if (query[field] !== undefined && !isUuid(query[field])) {
        errors.push({ field, message: 'Mã không hợp lệ' });
      }
    }
    const periodType = readEnum(query, 'period_type', PERIOD_TYPES, errors, false) ?? null;
    const status = readEnum(query, 'status', ['draft', 'published', 'superseded'] as const, errors, false) ?? null;
    check(errors);
    return this.evaluations.list(currentUser, {
      orgUnitId: query.org_unit_id ?? null,
      staffId: query.staff_id ?? null,
      periodType,
      periodValue: query.period_value ?? null,
      status,
    });
  }

  @Get('me/evaluations')
  mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return this.evaluations.mine(currentUser);
  }

  @Get('evaluations/:id')
  read(
    @Param('id', uuidParameter('Mã phiếu đánh giá không hợp lệ')) evaluationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.evaluations.read(currentUser, evaluationId);
  }

  @Post('evaluations')
  @HttpCode(201)
  create(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const period = readPeriod(body, errors);
    const input = {
      staffId: readRequiredUuid(body, 'staff_id', errors, 'Bắt buộc chọn nhân sự'),
      periodType: period.type,
      periodValue: period.value,
      comment: readWorkText(body, 'comment', errors),
      reevaluationReason: readWorkText(body, 'reevaluation_reason', errors, { maximum: 500 }),
      scores: readScores(body, errors, true) ?? [],
    };
    check(errors);
    return this.evaluations.create(currentUser, input, originOf(request, currentUser));
  }

  @Patch('evaluations/:id')
  update(
    @Param('id', uuidParameter('Mã phiếu đánh giá không hợp lệ')) evaluationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const patch = {
      comment: body?.comment === undefined ? undefined : readWorkText(body, 'comment', errors),
      scores: readScores(body, errors, false),
    };
    check(errors);
    return this.evaluations.update(currentUser, evaluationId, patch, originOf(request, currentUser));
  }

  @Post('evaluations/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', uuidParameter('Mã phiếu đánh giá không hợp lệ')) evaluationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.evaluations.publish(currentUser, evaluationId, originOf(request, currentUser));
  }
}
