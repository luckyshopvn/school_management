import { Body, Controller, Get, HttpCode, Injectable, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type {
  ProfessionalEvaluationStatus,
  ProfessionalLevel,
  ProfessionalStandardType,
  SchoolYearDatabase,
} from '@school-management/database';
import {
  ApplicationError,
  Clock,
  ruleViolationError,
  validationError,
  type FieldError,
} from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Request } from 'express';
import { sql, type Kysely, type Transaction } from 'kysely';
import { AuthenticatedUser } from '../authentication/authentication.guard.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { originOf, writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { queueNotification } from '../common/notification-queue.js';
import {
  isUuid,
  notFoundError,
  readRequiredUuid,
  readStatus,
  type RecordStatus,
  type RequestBody,
} from '../common/request-fields.js';
import { uuidParameter } from '../common/uuid-parameter.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { LEVEL_LABELS, overallLevel, PROFESSIONAL_LEVELS } from './standard-rating.js';

// Đánh giá chuẩn nghề nghiệp (YCTD-102, theo mục 3.2 hệ thống của Sở GD&ĐT TP.HCM): mỗi năm học, người đánh giá mở phiếu
// cho nhân sự theo chuẩn giáo viên mầm non (Thông tư 26/2018) hoặc chuẩn hiệu trưởng (Thông tư 25/2018); nhân sự tự đánh
// giá từng tiêu chí kèm minh chứng rồi gửi; người đánh giá ghi mức từng tiêu chí và nhận xét, chốt phiếu thì hệ thống xếp
// loại chung theo quy tắc ở standard-rating.ts. Quản lý đơn vị (VT-03, P07.professional-standard.assess) đánh giá giáo viên
// trong đơn vị; Hiệu trưởng (VT-02, P07.professional-standard.manage) đánh giá mọi phiếu kể cả chuẩn hiệu trưởng (phó hiệu
// trưởng, quản lý đơn vị) và sửa danh mục tiêu chuẩn, tiêu chí dùng chung toàn trường. Không tự đánh giá phiếu của mình
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const STANDARD_RULE = 'YCTD-102';
const STANDARD_TYPES: ProfessionalStandardType[] = ['teacher', 'principal'];
const STANDARD_TYPE_LABELS: Record<ProfessionalStandardType, string> = {
  teacher: 'chuẩn nghề nghiệp giáo viên mầm non',
  principal: 'chuẩn hiệu trưởng',
};
const MAXIMUM_NAME = 300;
const MAXIMUM_TEXT = 2000;
const MAXIMUM_STAFF_PER_REQUEST = 200;

interface RatingInput {
  criterionId: string;
  rating: ProfessionalLevel | null;
  text: string | null;
}

@Injectable()
export class ProfessionalStandardsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly clock: Clock,
  ) {}

  private manageScope(currentUser: CurrentUser) {
    return this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.professionalStandardManage);
  }

  private assessScope(currentUser: CurrentUser) {
    return this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.professionalStandardAssess);
  }

  // Phạm vi xem phiếu của người đánh giá: hợp phạm vi quyền đánh giá và quyền quản lý chuẩn
  private async readerScope(currentUser: CurrentUser): Promise<OrganizationScope> {
    const [manage, assess] = await Promise.all([this.manageScope(currentUser), this.assessScope(currentUser)]);
    if (manage.wholeSchool || assess.wholeSchool) {
      return { wholeSchool: true, orgUnitIds: [] };
    }
    return { wholeSchool: false, orgUnitIds: [...new Set([...manage.orgUnitIds, ...assess.orgUnitIds])] };
  }

  // Người đánh giá: chuẩn giáo viên do người có quyền đánh giá ở đơn vị của nhân sự; chuẩn hiệu trưởng chỉ người có quyền
  // quản lý chuẩn; không ai đánh giá phiếu của chính mình
  async canAssess(
    currentUser: CurrentUser,
    database: Executor,
    subject: { staffId: string; orgUnitId: string; standardType: ProfessionalStandardType },
  ): Promise<boolean> {
    const own = await this.ownStaffId(database, currentUser);
    if (own === subject.staffId) {
      return false;
    }
    const manage = await this.manageScope(currentUser);
    if (inScope(manage, subject.orgUnitId)) {
      return true;
    }
    return subject.standardType === 'teacher' && inScope(await this.assessScope(currentUser), subject.orgUnitId);
  }

  private async ownStaffId(database: Executor, currentUser: CurrentUser): Promise<string | null> {
    const row = await database
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', currentUser.id)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  // Danh mục tiêu chuẩn, tiêu chí: mọi nhân sự xem được để tự đánh giá
  async catalog(standardType: ProfessionalStandardType | null) {
    const { database } = await this.currentSchoolYear.require();
    let standards = database
      .selectFrom('professional_standards')
      .selectAll()
      .orderBy('standard_type')
      .orderBy('order_no');
    let criteria = database.selectFrom('professional_criteria').selectAll().orderBy('order_no');
    if (standardType) {
      standards = standards.where('standard_type', '=', standardType);
      criteria = criteria.where('standard_type', '=', standardType);
    }
    const criterionRows = await criteria.execute();
    return (await standards.execute()).map((standard) => ({
      ...standard,
      criteria: criterionRows.filter((criterion) => criterion.standard_id === standard.id),
    }));
  }

  private async assertCatalogManager(currentUser: CurrentUser) {
    if (!(await this.manageScope(currentUser)).wholeSchool) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ Hiệu trưởng sửa danh mục chuẩn nghề nghiệp');
    }
  }

  async updateStandard(currentUser: CurrentUser, standardId: string, name: string, origin: ChangeOrigin) {
    await this.assertCatalogManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('professional_standards')
      .selectAll()
      .where('id', '=', standardId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy tiêu chuẩn', 'professional_standard');
    }
    return database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('professional_standards')
        .set({ name, updated_at: this.clock.now() })
        .where('id', '=', standardId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_standards',
        entityId: standardId,
        action: 'update',
        before,
        after: row,
      });
      return row;
    });
  }

  // Thêm tiêu chí vào cuối chuẩn, mã tiếp theo số lớn nhất của chuẩn
  async createCriterion(
    currentUser: CurrentUser,
    input: { standardId: string; name: string; isKey: boolean },
    origin: ChangeOrigin,
  ) {
    await this.assertCatalogManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const standard = await database
      .selectFrom('professional_standards')
      .selectAll()
      .where('id', '=', input.standardId)
      .executeTakeFirst();
    if (!standard) {
      throw notFoundError('Không tìm thấy tiêu chuẩn', 'professional_standard');
    }
    return database.transaction().execute(async (transaction) => {
      await sql`select id from professional_standards where standard_type = ${standard.standard_type} for update`.execute(
        transaction,
      );
      const last = await transaction
        .selectFrom('professional_criteria')
        .select((expression) => expression.fn.max('order_no').as('order_no'))
        .where('standard_type', '=', standard.standard_type)
        .executeTakeFirst();
      const next = Number(last?.order_no ?? 0) + 1;
      const row = await transaction
        .insertInto('professional_criteria')
        .values({
          standard_id: standard.id,
          standard_type: standard.standard_type,
          code: String(next),
          name: input.name,
          is_key: input.isKey,
          order_no: next,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_criteria',
        entityId: row.id,
        action: 'create',
        before: null,
        after: row,
      });
      return row;
    });
  }

  // Sửa tiêu chí chỉ ảnh hưởng phiếu mở sau; phiếu đã mở giữ tiêu chí lúc mở
  async updateCriterion(
    currentUser: CurrentUser,
    criterionId: string,
    patch: { name?: string; isKey?: boolean; status?: RecordStatus },
    origin: ChangeOrigin,
  ) {
    await this.assertCatalogManager(currentUser);
    const { database } = await this.currentSchoolYear.require();
    const before = await database
      .selectFrom('professional_criteria')
      .selectAll()
      .where('id', '=', criterionId)
      .executeTakeFirst();
    if (!before) {
      throw notFoundError('Không tìm thấy tiêu chí', 'professional_criterion');
    }
    return database.transaction().execute(async (transaction) => {
      const row = await transaction
        .updateTable('professional_criteria')
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.isKey !== undefined ? { is_key: patch.isKey } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', criterionId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_criteria',
        entityId: criterionId,
        action: 'update',
        before,
        after: row,
      });
      return row;
    });
  }

  // Mở phiếu cho nhiều nhân sự; nhân sự đã có phiếu năm học này thì bỏ qua
  async open(
    currentUser: CurrentUser,
    input: { standardType: ProfessionalStandardType; staffIds: string[] },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'full_name', 'status', 'user_id'])
      .where('id', 'in', input.staffIds)
      .execute();
    if (staff.length !== input.staffIds.length) {
      throw notFoundError('Không tìm thấy hồ sơ nhân sự', 'staff');
    }
    for (const person of staff) {
      if (person.status !== 'active') {
        throw validationError([{ field: 'staff_ids', message: `${person.full_name} đã nghỉ việc` }]);
      }
      if (
        !(await this.canAssess(currentUser, database, {
          staffId: person.id,
          orgUnitId: person.org_unit_id,
          standardType: input.standardType,
        }))
      ) {
        throw new ApplicationError('ERR_FORBIDDEN', `Bạn không được mở phiếu đánh giá cho ${person.full_name}`);
      }
    }
    const criteria = await database
      .selectFrom('professional_criteria')
      .innerJoin('professional_standards', 'professional_standards.id', 'professional_criteria.standard_id')
      .select([
        'professional_criteria.id',
        'professional_criteria.code',
        'professional_criteria.name',
        'professional_criteria.is_key',
        'professional_criteria.order_no',
        'professional_standards.code as standard_code',
        'professional_standards.name as standard_name',
      ])
      .where('professional_criteria.standard_type', '=', input.standardType)
      .where('professional_criteria.status', '=', 'active')
      .orderBy('professional_criteria.order_no')
      .execute();
    if (criteria.length === 0) {
      throw ruleViolationError(STANDARD_RULE, 'Danh mục chuẩn chưa có tiêu chí đang dùng');
    }
    const created: string[] = [];
    const skipped: string[] = [];
    await database.transaction().execute(async (transaction) => {
      for (const person of staff) {
        const row = await transaction
          .insertInto('professional_evaluations')
          .values({
            staff_id: person.id,
            org_unit_id: person.org_unit_id,
            standard_type: input.standardType,
            opened_by: origin.actorUserId,
          })
          .onConflict((conflict) => conflict.column('staff_id').doNothing())
          .returning('id')
          .executeTakeFirst();
        if (!row) {
          skipped.push(person.id);
          continue;
        }
        created.push(row.id);
        await transaction
          .insertInto('professional_evaluation_items')
          .values(
            criteria.map((criterion) => ({
              evaluation_id: row.id,
              criterion_id: criterion.id,
              standard_code: criterion.standard_code,
              standard_name: criterion.standard_name,
              criterion_code: criterion.code,
              criterion_name: criterion.name,
              is_key: criterion.is_key,
              order_no: criterion.order_no,
            })),
          )
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: person.org_unit_id,
          entityName: 'professional_evaluations',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { staff_id: person.id, standard_type: input.standardType },
        });
        if (person.user_id) {
          await queueNotification(transaction, {
            orgUnitId: person.org_unit_id,
            templateCode: 'professional_evaluation_opened',
            title: 'Tự đánh giá chuẩn nghề nghiệp',
            body: `Đã mở phiếu đánh giá theo ${STANDARD_TYPE_LABELS[input.standardType]}, mời tự đánh giá`,
            targetType: 'professional_evaluations',
            targetId: row.id,
            recipients: [{ userId: person.user_id, channel: 'in_app' }],
          });
        }
      }
    });
    return { created_count: created.length, skipped_staff_ids: skipped };
  }

  private evaluationQuery(database: Executor) {
    return database
      .selectFrom('professional_evaluations')
      .innerJoin('staff', 'staff.id', 'professional_evaluations.staff_id')
      .innerJoin('org_units', 'org_units.id', 'professional_evaluations.org_unit_id')
      .selectAll('professional_evaluations')
      .select(['staff.full_name', 'staff.code as staff_code', 'org_units.name as org_unit_name']);
  }

  async list(
    currentUser: CurrentUser,
    filter: {
      orgUnitId: string | null;
      standardType: ProfessionalStandardType | null;
      status: ProfessionalEvaluationStatus | null;
    },
  ) {
    const scope = await this.readerScope(currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem phiếu đánh giá chuẩn nghề nghiệp');
    }
    if (filter.orgUnitId && !inScope(scope, filter.orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = this.evaluationQuery(database).orderBy('org_units.code').orderBy('staff.full_name');
    if (filter.orgUnitId) {
      query = query.where('professional_evaluations.org_unit_id', '=', filter.orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('professional_evaluations.org_unit_id', 'in', scope.orgUnitIds);
    }
    if (filter.standardType) query = query.where('professional_evaluations.standard_type', '=', filter.standardType);
    if (filter.status) query = query.where('professional_evaluations.status', '=', filter.status);
    const rows = await query.execute();
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        can_assess: await this.canAssess(currentUser, database, {
          staffId: row.staff_id,
          orgUnitId: row.org_unit_id,
          standardType: row.standard_type,
        }),
      })),
    );
  }

  private async detail(currentUser: CurrentUser, database: Executor, evaluationId: string) {
    const evaluation = await this.evaluationQuery(database)
      .where('professional_evaluations.id', '=', evaluationId)
      .executeTakeFirst();
    if (!evaluation) {
      throw notFoundError('Không tìm thấy phiếu đánh giá chuẩn nghề nghiệp', 'professional_evaluation');
    }
    const items = await database
      .selectFrom('professional_evaluation_items')
      .selectAll()
      .where('evaluation_id', '=', evaluationId)
      .orderBy('order_no')
      .execute();
    const own = await this.ownStaffId(database, currentUser);
    const canAssess = await this.canAssess(currentUser, database, {
      staffId: evaluation.staff_id,
      orgUnitId: evaluation.org_unit_id,
      standardType: evaluation.standard_type,
    });
    return { evaluation, items, isSelf: own === evaluation.staff_id, canAssess };
  }

  async read(currentUser: CurrentUser, evaluationId: string) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.detail(currentUser, database, evaluationId);
    if (!found.isSelf && !inScope(await this.readerScope(currentUser), found.evaluation.org_unit_id)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được xem phiếu đánh giá này');
    }
    return { ...found.evaluation, is_self: found.isSelf, can_assess: found.canAssess, items: found.items };
  }

  // Phiếu của chính mình trong năm học; chưa được mở phiếu thì trả null
  async mine(currentUser: CurrentUser) {
    const { database } = await this.currentSchoolYear.require();
    const own = await this.ownStaffId(database, currentUser);
    if (!own) {
      return null;
    }
    const row = await database
      .selectFrom('professional_evaluations')
      .select('id')
      .where('staff_id', '=', own)
      .executeTakeFirst();
    return row ? this.read(currentUser, row.id) : null;
  }

  // Tự đánh giá: chỉ nhân sự của phiếu, khi phiếu đang chờ tự đánh giá
  async saveSelf(currentUser: CurrentUser, evaluationId: string, ratings: RatingInput[], origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.detail(currentUser, database, evaluationId);
    if (!found.isSelf) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ nhân sự của phiếu được tự đánh giá');
    }
    if (found.evaluation.status !== 'self_assessing') {
      throw ruleViolationError(STANDARD_RULE, 'Phiếu đã gửi tự đánh giá, không sửa được');
    }
    assertKnownCriteria(found.items, ratings);
    await database.transaction().execute(async (transaction) => {
      for (const rating of ratings) {
        await transaction
          .updateTable('professional_evaluation_items')
          .set({ self_rating: rating.rating, self_evidence: rating.text })
          .where('evaluation_id', '=', evaluationId)
          .where('criterion_id', '=', rating.criterionId)
          .execute();
      }
      await transaction
        .updateTable('professional_evaluations')
        .set({ updated_at: this.clock.now() })
        .where('id', '=', evaluationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.evaluation.org_unit_id,
        entityName: 'professional_evaluation_items',
        entityId: evaluationId,
        action: 'update',
        before: null,
        after: { self: ratings },
      });
    });
    return this.read(currentUser, evaluationId);
  }

  async submitSelf(currentUser: CurrentUser, evaluationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.detail(currentUser, database, evaluationId);
    if (!found.isSelf) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Chỉ nhân sự của phiếu được gửi tự đánh giá');
    }
    if (found.evaluation.status !== 'self_assessing') {
      throw ruleViolationError(STANDARD_RULE, 'Phiếu đã gửi tự đánh giá');
    }
    const missing = found.items.filter((item) => item.self_rating === null);
    if (missing.length > 0) {
      throw ruleViolationError(STANDARD_RULE, `Còn ${missing.length} tiêu chí chưa tự đánh giá`);
    }
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_evaluations')
        .set({ status: 'self_submitted', self_submitted_at: this.clock.now(), updated_at: this.clock.now() })
        .where('id', '=', evaluationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.evaluation.org_unit_id,
        entityName: 'professional_evaluations',
        entityId: evaluationId,
        action: 'update',
        before: { status: 'self_assessing' },
        after: { status: 'self_submitted' },
      });
    });
    return this.read(currentUser, evaluationId);
  }

  // Người đánh giá ghi mức từng tiêu chí sau khi nhân sự đã gửi tự đánh giá; lưu nhiều lần trước khi chốt
  async saveAssessment(
    currentUser: CurrentUser,
    evaluationId: string,
    input: { ratings: RatingInput[]; comment: string | null | undefined },
    origin: ChangeOrigin,
  ) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.detail(currentUser, database, evaluationId);
    if (!found.canAssess) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được đánh giá phiếu này');
    }
    if (found.evaluation.status !== 'self_submitted') {
      throw ruleViolationError(
        STANDARD_RULE,
        found.evaluation.status === 'finalized'
          ? 'Phiếu đã chốt, không sửa được'
          : 'Nhân sự chưa gửi tự đánh giá, chưa đánh giá được',
      );
    }
    assertKnownCriteria(found.items, input.ratings);
    await database.transaction().execute(async (transaction) => {
      for (const rating of input.ratings) {
        await transaction
          .updateTable('professional_evaluation_items')
          .set({ assessor_rating: rating.rating, assessor_note: rating.text })
          .where('evaluation_id', '=', evaluationId)
          .where('criterion_id', '=', rating.criterionId)
          .execute();
      }
      await transaction
        .updateTable('professional_evaluations')
        .set({
          ...(input.comment !== undefined ? { assessor_comment: input.comment } : {}),
          updated_at: this.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.evaluation.org_unit_id,
        entityName: 'professional_evaluation_items',
        entityId: evaluationId,
        action: 'update',
        before: null,
        after: { assessor: input.ratings, comment: input.comment },
      });
    });
    return this.read(currentUser, evaluationId);
  }

  // Chốt phiếu: mọi tiêu chí đã có mức của người đánh giá; xếp loại chung theo quy tắc, báo cho nhân sự
  async finalize(currentUser: CurrentUser, evaluationId: string, origin: ChangeOrigin) {
    const { database } = await this.currentSchoolYear.require();
    const found = await this.detail(currentUser, database, evaluationId);
    if (!found.canAssess) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không được chốt phiếu này');
    }
    if (found.evaluation.status !== 'self_submitted') {
      throw ruleViolationError(STANDARD_RULE, 'Chỉ chốt phiếu đã gửi tự đánh giá và chưa chốt');
    }
    const missing = found.items.filter((item) => item.assessor_rating === null);
    if (missing.length > 0) {
      throw ruleViolationError(STANDARD_RULE, `Còn ${missing.length} tiêu chí chưa đánh giá`);
    }
    const level = overallLevel(
      found.items.map((item) => ({ rating: item.assessor_rating as ProfessionalLevel, isKey: item.is_key })),
    );
    const staff = await database
      .selectFrom('staff')
      .select('user_id')
      .where('id', '=', found.evaluation.staff_id)
      .executeTakeFirstOrThrow();
    await database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_evaluations')
        .set({
          status: 'finalized',
          overall_level: level,
          finalized_by: origin.actorUserId,
          finalized_by_name: origin.actorName,
          finalized_at: this.clock.now(),
          updated_at: this.clock.now(),
        })
        .where('id', '=', evaluationId)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: found.evaluation.org_unit_id,
        entityName: 'professional_evaluations',
        entityId: evaluationId,
        action: 'update',
        before: { status: 'self_submitted' },
        after: { status: 'finalized', overall_level: level },
      });
      if (staff.user_id) {
        await queueNotification(transaction, {
          orgUnitId: found.evaluation.org_unit_id,
          templateCode: 'professional_evaluation_finalized',
          title: 'Kết quả đánh giá chuẩn nghề nghiệp',
          body: `Xếp loại: ${LEVEL_LABELS[level]}`,
          targetType: 'professional_evaluations',
          targetId: evaluationId,
          recipients: [{ userId: staff.user_id, channel: 'in_app' }],
        });
      }
    });
    return this.read(currentUser, evaluationId);
  }

  // Thống kê theo loại chuẩn và mức xếp loại của phiếu đã chốt; số phiếu chưa chốt
  async statistics(currentUser: CurrentUser, orgUnitId: string | null) {
    const scope = await this.readerScope(currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem thống kê chuẩn nghề nghiệp');
    }
    if (orgUnitId && !inScope(scope, orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('professional_evaluations')
      .select([
        'standard_type',
        'status',
        'overall_level',
        (expression) => expression.fn.countAll<string>().as('count'),
      ])
      .groupBy(['standard_type', 'status', 'overall_level']);
    if (orgUnitId) {
      query = query.where('org_unit_id', '=', orgUnitId);
    } else if (!scope.wholeSchool) {
      query = query.where('org_unit_id', 'in', scope.orgUnitIds);
    }
    const rows = await query.execute();
    return STANDARD_TYPES.map((standardType) => {
      const own = rows.filter((row) => row.standard_type === standardType);
      const finalized = own.filter((row) => row.status === 'finalized');
      const levels = Object.fromEntries(
        PROFESSIONAL_LEVELS.map((level) => [
          level,
          finalized.filter((row) => row.overall_level === level).reduce((sum, row) => sum + Number(row.count), 0),
        ]),
      ) as Record<ProfessionalLevel, number>;
      const finalizedCount = finalized.reduce((sum, row) => sum + Number(row.count), 0);
      return {
        standard_type: standardType,
        total: own.reduce((sum, row) => sum + Number(row.count), 0),
        finalized: finalizedCount,
        pending: own.filter((row) => row.status !== 'finalized').reduce((sum, row) => sum + Number(row.count), 0),
        levels,
        level_rates: Object.fromEntries(
          PROFESSIONAL_LEVELS.map((level) => [
            level,
            finalizedCount === 0 ? 0 : Math.round((levels[level] / finalizedCount) * 10_000) / 100,
          ]),
        ) as Record<ProfessionalLevel, number>,
      };
    });
  }
}

function inScope(scope: OrganizationScope, orgUnitId: string): boolean {
  return scope.wholeSchool || scope.orgUnitIds.includes(orgUnitId);
}

function assertKnownCriteria(items: Array<{ criterion_id: string }>, ratings: RatingInput[]) {
  const known = new Set(items.map((item) => item.criterion_id));
  if (ratings.some((rating) => !known.has(rating.criterionId))) {
    throw validationError([{ field: 'items', message: 'Có tiêu chí không thuộc phiếu' }]);
  }
}

function check(errors: FieldError[]) {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

function readText(body: RequestBody, field: string, errors: FieldError[], maximum: number, required = false) {
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

function readStandardType(value: unknown, errors: FieldError[], required: boolean): ProfessionalStandardType | null {
  if ((value === undefined || value === '') && !required) {
    return null;
  }
  if (!STANDARD_TYPES.includes(value as ProfessionalStandardType)) {
    errors.push({ field: 'standard_type', message: 'Loại chuẩn là teacher hoặc principal' });
    return null;
  }
  return value as ProfessionalStandardType;
}

// Danh sách mức theo tiêu chí; textField là minh chứng (tự đánh giá) hoặc nhận xét (người đánh giá)
function readRatings(body: RequestBody, textField: string, errors: FieldError[]): RatingInput[] {
  const raw = body?.items;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    errors.push({ field: 'items', message: 'Bắt buộc đánh giá các tiêu chí' });
    return [];
  }
  const seen = new Set<string>();
  return raw.map((entry: unknown, index) => {
    const item = (typeof entry === 'object' && entry !== null ? entry : {}) as RequestBody;
    const criterionId = readRequiredUuid(item, 'criterion_id', errors, 'Bắt buộc chọn tiêu chí');
    if (criterionId && seen.has(criterionId)) {
      errors.push({ field: `items[${index}].criterion_id`, message: 'Tiêu chí bị lặp' });
    }
    seen.add(criterionId);
    const rating = item?.rating;
    if (rating !== null && rating !== undefined && !PROFESSIONAL_LEVELS.includes(rating as ProfessionalLevel)) {
      errors.push({ field: `items[${index}].rating`, message: 'Mức là not_met, met, good hoặc excellent' });
    }
    const textErrors: FieldError[] = [];
    const text = readText(item, textField, textErrors, MAXIMUM_TEXT);
    errors.push(...textErrors.map((error) => ({ ...error, field: `items[${index}].${error.field}` })));
    return {
      criterionId,
      rating: PROFESSIONAL_LEVELS.includes(rating as ProfessionalLevel) ? (rating as ProfessionalLevel) : null,
      text,
    };
  });
}

@Controller()
export class ProfessionalStandardsController {
  constructor(private readonly standards: ProfessionalStandardsService) {}

  @Get('professional-standards')
  catalog(@Query('standard_type') standardType: string | undefined) {
    const errors: FieldError[] = [];
    const type = readStandardType(standardType, errors, false);
    check(errors);
    return this.standards.catalog(type);
  }

  @Patch('professional-standards/:id')
  updateStandard(
    @Param('id', uuidParameter('Mã tiêu chuẩn không hợp lệ')) standardId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const name = readText(body, 'name', errors, MAXIMUM_NAME, true) ?? '';
    check(errors);
    return this.standards.updateStandard(currentUser, standardId, name, originOf(request, currentUser));
  }

  @Post('professional-criteria')
  @HttpCode(201)
  createCriterion(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const input = {
      standardId: readRequiredUuid(body, 'standard_id', errors, 'Bắt buộc chọn tiêu chuẩn'),
      name: readText(body, 'name', errors, MAXIMUM_NAME, true) ?? '',
      isKey: body?.is_key === true,
    };
    check(errors);
    return this.standards.createCriterion(currentUser, input, originOf(request, currentUser));
  }

  @Patch('professional-criteria/:id')
  updateCriterion(
    @Param('id', uuidParameter('Mã tiêu chí không hợp lệ')) criterionId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    if (body?.is_key !== undefined && typeof body.is_key !== 'boolean') {
      errors.push({ field: 'is_key', message: 'Giá trị đúng hoặc sai' });
    }
    const patch = {
      name: body?.name === undefined ? undefined : (readText(body, 'name', errors, MAXIMUM_NAME, true) ?? ''),
      isKey: typeof body?.is_key === 'boolean' ? body.is_key : undefined,
      status: readStatus(body, errors),
    };
    check(errors);
    return this.standards.updateCriterion(currentUser, criterionId, patch, originOf(request, currentUser));
  }

  @Get('professional-evaluations')
  list(@Query() query: Record<string, string | undefined>, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    if (query.org_unit_id !== undefined && query.org_unit_id !== '' && !isUuid(query.org_unit_id)) {
      errors.push({ field: 'org_unit_id', message: 'Mã không hợp lệ' });
    }
    const standardType = readStandardType(query.standard_type, errors, false);
    const status = query.status || null;
    if (status && !['self_assessing', 'self_submitted', 'finalized'].includes(status)) {
      errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });
    }
    check(errors);
    return this.standards.list(currentUser, {
      orgUnitId: query.org_unit_id || null,
      standardType,
      status: status as ProfessionalEvaluationStatus | null,
    });
  }

  @Get('professional-evaluations/statistics')
  statistics(@Query('org_unit_id') orgUnitId: string | undefined, @AuthenticatedUser() currentUser: CurrentUser) {
    if (orgUnitId !== undefined && orgUnitId !== '' && !isUuid(orgUnitId)) {
      throw validationError([{ field: 'org_unit_id', message: 'Mã không hợp lệ' }]);
    }
    return this.standards.statistics(currentUser, orgUnitId || null);
  }

  @Get('me/professional-evaluation')
  async mine(@AuthenticatedUser() currentUser: CurrentUser) {
    return { evaluation: await this.standards.mine(currentUser) };
  }

  @Post('professional-evaluations')
  @HttpCode(201)
  open(@Body() body: RequestBody, @Req() request: Request, @AuthenticatedUser() currentUser: CurrentUser) {
    const errors: FieldError[] = [];
    const standardType = readStandardType(body?.standard_type, errors, true);
    const staffIds = body?.staff_ids;
    if (
      !Array.isArray(staffIds) ||
      staffIds.length === 0 ||
      staffIds.length > MAXIMUM_STAFF_PER_REQUEST ||
      staffIds.some((id) => !isUuid(id))
    ) {
      errors.push({ field: 'staff_ids', message: `Chọn từ 1 đến ${MAXIMUM_STAFF_PER_REQUEST} nhân sự` });
    }
    check(errors);
    return this.standards.open(
      currentUser,
      { standardType: standardType!, staffIds: [...new Set(staffIds as string[])] },
      originOf(request, currentUser),
    );
  }

  @Get('professional-evaluations/:id')
  read(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.standards.read(currentUser, evaluationId);
  }

  @Put('professional-evaluations/:id/self')
  saveSelf(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ratings = readRatings(body, 'evidence', errors);
    check(errors);
    return this.standards.saveSelf(currentUser, evaluationId, ratings, originOf(request, currentUser));
  }

  @Post('professional-evaluations/:id/submit-self')
  @HttpCode(200)
  submitSelf(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.standards.submitSelf(currentUser, evaluationId, originOf(request, currentUser));
  }

  @Put('professional-evaluations/:id/assessment')
  saveAssessment(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Body() body: RequestBody,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    const errors: FieldError[] = [];
    const ratings = readRatings(body, 'note', errors);
    const comment = body?.comment === undefined ? undefined : readText(body, 'comment', errors, MAXIMUM_TEXT);
    check(errors);
    return this.standards.saveAssessment(
      currentUser,
      evaluationId,
      { ratings, comment },
      originOf(request, currentUser),
    );
  }

  @Post('professional-evaluations/:id/finalize')
  @HttpCode(200)
  finalize(
    @Param('id', uuidParameter('Mã phiếu không hợp lệ')) evaluationId: string,
    @Req() request: Request,
    @AuthenticatedUser() currentUser: CurrentUser,
  ) {
    return this.standards.finalize(currentUser, evaluationId, originOf(request, currentUser));
  }
}
