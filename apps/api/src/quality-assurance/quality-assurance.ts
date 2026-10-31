import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  QUALITY_ASSESSMENT_STATUS_LABELS,
  QUALITY_COUNCIL_POSITION_LABELS,
  QUALITY_DEFAULT_FRAMEWORKS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  QUALITY_LIMITS,
  QUALITY_REPORT_STATUS_LABELS,
  QUALITY_RULE_CODE,
  qualityLevelLabel,
  PERMISSION_CODES,
  recognitionValidUntil,
  suggestCriterionLevel,
  summarizeQualityLevels,
  type KpiSchoolLevelCode,
  type QualityEvidenceStatusCode,
  type QualityImprovementAction,
} from '@school-management/shared';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import type { TableFileFormat } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { PlansService, type PlanItemInput } from '../work/plans.js';
import { EvidenceStoreService } from './evidence-store.js';
import type {
  AssessmentInput,
  CouncilMemberInput,
  CriterionInput,
  FrameworkInput,
  IndicatorInput,
  RecognitionInput,
  ReportInput,
  StandardInput,
  WorkGroupInput,
} from './quality-fields.js';

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149). Bộ tiêu chuẩn theo cấp học là cấu hình ở cơ sở dữ liệu năm học
// (nạp sẵn bộ Mầm non). Đợt tự đánh giá chọn một bộ, lập hội đồng và nhóm công tác, phân công mỗi tiêu chí cho một nhóm; mỗi
// tiêu chí một phiếu đánh giá (hiện trạng, điểm mạnh, điểm yếu, kế hoạch cải tiến, chỉ báo đạt, mức tự đánh giá) do thành
// viên nhóm soạn, nộp, Ban Giám hiệu duyệt hoặc trả lại. Minh chứng có mã theo hộp và tiêu chí, bốn trạng thái, nguồn là tệp
// tải lên, hồ sơ của kho hồ sơ chuyên môn (18e), văn bản đến (18a) hoặc văn bản đi (18b); kế thừa từ đợt cùng bộ của năm
// trước. Kế hoạch cải tiến của các phiếu đã duyệt thành kế hoạch công việc (Quản lý công việc, P09-03). Báo cáo tự đánh giá
// xuất Word, PDF, phần cơ sở dữ liệu lấy từ bản rà soát 1.7 (17e); kết quả công nhận ghi ngược vào 1.7. Các lựa chọn chi tiết
// do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type AssessmentRow = Selectable<SchoolYearDatabase['quality_assessments']>;
type ReportRow = Selectable<SchoolYearDatabase['quality_criterion_reports']>;

const USE = PERMISSION_CODES.qualityUse;
const MANAGE = PERMISSION_CODES.qualityManage;
export const QUALITY_PERMISSIONS = [USE, MANAGE];
const MAXIMUM_LIST = 1000;
const MAXIMUM_WORK_ITEMS = 200;
// Mã rỗng dùng trong điều kiện khi người dùng không có hồ sơ nhân sự
const NO_ID = '00000000-0000-0000-0000-000000000000';

export function qualityRule(message: string): ApplicationError {
  return ruleViolationError(QUALITY_RULE_CODE, message);
}

function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

const actionsOf = (value: unknown) => (Array.isArray(value) ? value : []) as QualityImprovementAction[];
const resultsOf = (value: unknown) =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, boolean>;

export interface QualityContext {
  database: Kysely<SchoolYearDatabase>;
  staff: { id: string; full_name: string } | null;
  // Người quản lý: quyền quản lý với phạm vi toàn trường (đợt tự đánh giá là của cả trường)
  manager: boolean;
}

interface Membership {
  council: boolean;
  groupIds: string[];
}

@Injectable()
export class QualityAssuranceService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly workPlans: PlansService,
    private readonly clock: Clock,
    private readonly evidenceStore: EvidenceStoreService,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async context(currentUser: CurrentUser): Promise<QualityContext> {
    const database = (await this.currentSchoolYear.require()).database;
    const staff =
      (await database
        .selectFrom('staff')
        .select(['id', 'full_name'])
        .where('user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst()) ?? null;
    const manager =
      currentUser.hasPermission(MANAGE) &&
      (await this.organizationScopes.resolveStaff(currentUser, MANAGE)).wholeSchool;
    return { database, staff, manager };
  }

  private assertManager(context: QualityContext): void {
    if (!context.manager) {
      throw forbidden('Chỉ người quản lý bảo đảm chất lượng (Ban Giám hiệu, phạm vi toàn trường) được thao tác');
    }
  }

  private async membership(context: QualityContext, assessmentId: string): Promise<Membership> {
    if (!context.staff) {
      return { council: false, groupIds: [] };
    }
    const staffId = context.staff.id;
    const council = await context.database
      .selectFrom('quality_council_members')
      .select('id')
      .where('assessment_id', '=', assessmentId)
      .where('staff_id', '=', staffId)
      .executeTakeFirst();
    const groups = await context.database
      .selectFrom('quality_work_groups as groups')
      .leftJoin('quality_work_group_members as members', 'members.group_id', 'groups.id')
      .select('groups.id')
      .where('groups.assessment_id', '=', assessmentId)
      .where((eb) => eb.or([eb('groups.leader_staff_id', '=', staffId), eb('members.staff_id', '=', staffId)]))
      .execute();
    return { council: council !== undefined, groupIds: [...new Set(groups.map((group) => group.id))] };
  }

  private async assessmentRow(database: Executor, id: string): Promise<AssessmentRow> {
    const row = await database.selectFrom('quality_assessments').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy đợt tự đánh giá', 'quality_assessment');
    }
    return row;
  }

  // Đợt mà người dùng xem được: người quản lý, thành viên hội đồng, thành viên hoặc trưởng nhóm công tác
  private async visibleAssessment(context: QualityContext, id: string) {
    const assessment = await this.assessmentRow(context.database, id);
    const member = await this.membership(context, id);
    if (!context.manager && !member.council && member.groupIds.length === 0) {
      throw forbidden('Bạn không thuộc hội đồng hoặc nhóm công tác của đợt tự đánh giá này');
    }
    return { assessment, member };
  }

  private async rootUnit(database: Executor) {
    const root = await database
      .selectFrom('org_units')
      .select(['id', 'name'])
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    if (!root) {
      throw qualityRule('Chưa có Trường chính ở cây đơn vị');
    }
    return root;
  }

  // ---- Tổng quan ----

  async overview(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const staff = await context.database
      .selectFrom('staff')
      .leftJoin('departments', 'departments.id', 'staff.department_id')
      .select(['staff.id', 'staff.full_name', 'departments.name as department_name'])
      .where('staff.status', '=', 'active')
      .orderBy('staff.full_name')
      .limit(MAXIMUM_LIST)
      .execute();
    return {
      has_staff: context.staff !== null,
      can_manage: context.manager,
      can_use: currentUser.hasPermission(USE) || context.manager,
      staff,
    };
  }

  // ---- Bộ tiêu chuẩn ----

  async frameworks(currentUser: CurrentUser, includeInactive: boolean) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('quality_frameworks')
      .selectAll()
      .select((eb) => [
        eb
          .selectFrom('quality_standards')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_standards.framework_id', '=', 'quality_frameworks.id')
          .as('standard_count'),
        eb
          .selectFrom('quality_criteria')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_criteria.framework_id', '=', 'quality_frameworks.id')
          .as('criterion_count'),
        eb
          .selectFrom('quality_indicators')
          .innerJoin('quality_criteria', 'quality_criteria.id', 'quality_indicators.criterion_id')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_criteria.framework_id', '=', 'quality_frameworks.id')
          .as('indicator_count'),
        eb
          .selectFrom('quality_assessments')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_assessments.framework_id', '=', 'quality_frameworks.id')
          .as('assessment_count'),
      ])
      .orderBy('sort_order')
      .orderBy('name');
    if (!includeInactive) {
      query = query.where('status', '=', 'active');
    }
    return (await query.execute()).map((row) => ({
      ...row,
      standard_count: Number(row.standard_count ?? 0),
      criterion_count: Number(row.criterion_count ?? 0),
      indicator_count: Number(row.indicator_count ?? 0),
      assessment_count: Number(row.assessment_count ?? 0),
    }));
  }

  private async frameworkTree(database: Executor, id: string) {
    const framework = await database
      .selectFrom('quality_frameworks')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!framework) {
      throw notFoundError('Không tìm thấy bộ tiêu chuẩn', 'quality_framework');
    }
    const standards = await database
      .selectFrom('quality_standards')
      .selectAll()
      .where('framework_id', '=', id)
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const criteria = await database
      .selectFrom('quality_criteria')
      .selectAll()
      .where('framework_id', '=', id)
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const indicators =
      criteria.length > 0
        ? await database
            .selectFrom('quality_indicators')
            .selectAll()
            .where(
              'criterion_id',
              'in',
              criteria.map((item) => item.id),
            )
            .orderBy('level')
            .orderBy('sort_order')
            .orderBy('code')
            .execute()
        : [];
    return {
      ...framework,
      standards: standards.map((standard) => ({
        ...standard,
        criteria: criteria
          .filter((item) => item.standard_id === standard.id)
          .map((item) => ({
            ...item,
            indicators: indicators.filter((indicator) => indicator.criterion_id === item.id),
          })),
      })),
    };
  }

  async framework(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    return this.frameworkTree(context.database, id);
  }

  private async checkFrameworkCode(database: Executor, code: string, id: string | null) {
    let query = database.selectFrom('quality_frameworks').select('id').where('code', '=', code);
    if (id) {
      query = query.where('id', '<>', id);
    }
    if (await query.executeTakeFirst()) {
      throw validationError([{ field: 'code', message: 'Mã bộ tiêu chuẩn đã có' }]);
    }
  }

  async createFramework(currentUser: CurrentUser, input: FrameworkInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.checkFrameworkCode(transaction, input.code, null);
      const created = await transaction
        .insertInto('quality_frameworks')
        .values({ ...input, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_frameworks', created.id, 'create', null, created);
      return created;
    });
  }

  async updateFramework(currentUser: CurrentUser, id: string, input: FrameworkInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.frameworkRow(transaction, id);
      await this.checkFrameworkCode(transaction, input.code, id);
      const updated = await transaction
        .updateTable('quality_frameworks')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_frameworks', id, 'update', before, updated);
      return updated;
    });
  }

  private async frameworkRow(database: Executor, id: string) {
    const row = await database.selectFrom('quality_frameworks').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy bộ tiêu chuẩn', 'quality_framework');
    }
    return row;
  }

  async deleteFramework(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.frameworkRow(transaction, id);
      const used = await transaction
        .selectFrom('quality_assessments')
        .select('id')
        .where('framework_id', '=', id)
        .executeTakeFirst();
      if (used) {
        throw qualityRule('Bộ tiêu chuẩn đã có đợt tự đánh giá; chuyển sang ngừng dùng thay vì xóa');
      }
      await transaction.deleteFrom('quality_frameworks').where('id', '=', id).execute();
      await this.audit(transaction, origin, 'quality_frameworks', id, 'delete', before, null);
    });
  }

  // Nạp bộ mặc định theo cấp học; mã bộ đã có thì bỏ qua
  async loadDefaults(currentUser: CurrentUser, level: KpiSchoolLevelCode, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    const seeds = QUALITY_DEFAULT_FRAMEWORKS[level];
    if (seeds.length === 0) {
      throw qualityRule('Chưa có bộ tiêu chuẩn mặc định cho cấp học này; trường tự thêm bộ tiêu chuẩn');
    }
    let created = 0;
    let skipped = 0;
    await context.database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (await transaction.selectFrom('quality_frameworks').select('code').execute()).map((row) => row.code),
      );
      for (const [index, seed] of seeds.entries()) {
        if (existing.has(seed.code)) {
          skipped += 1;
          continue;
        }
        const framework = await transaction
          .insertInto('quality_frameworks')
          .values({
            code: seed.code,
            name: seed.name,
            school_level: level,
            legal_basis: seed.legal_basis,
            max_level: seed.max_level,
            sort_order: (index + 1) * 10,
            created_by: currentUser.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        for (const [standardIndex, standard] of seed.standards.entries()) {
          const standardRow = await transaction
            .insertInto('quality_standards')
            .values({
              framework_id: framework.id,
              code: standard.code,
              title: standard.title,
              sort_order: (standardIndex + 1) * 10,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          await transaction
            .insertInto('quality_criteria')
            .values(
              standard.criteria.map((item, criterionIndex) => ({
                framework_id: framework.id,
                standard_id: standardRow.id,
                code: item.code,
                title: item.title,
                evidence_hint: item.evidence_hint ?? null,
                sort_order: (criterionIndex + 1) * 10,
              })),
            )
            .execute();
        }
        await this.audit(transaction, origin, 'quality_frameworks', framework.id, 'create', null, {
          code: seed.code,
          name: seed.name,
          school_level: level,
        });
        created += 1;
      }
    });
    return { created, skipped };
  }

  async createStandard(currentUser: CurrentUser, frameworkId: string, input: StandardInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.frameworkRow(transaction, frameworkId);
      await this.checkUnique(transaction, 'quality_standards', 'framework_id', frameworkId, input.code, null);
      const created = await transaction
        .insertInto('quality_standards')
        .values({ ...input, framework_id: frameworkId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_standards', created.id, 'create', null, created);
      return created;
    });
  }

  async updateStandard(currentUser: CurrentUser, id: string, input: StandardInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_standards', id, 'Không tìm thấy tiêu chuẩn');
      await this.checkUnique(transaction, 'quality_standards', 'framework_id', before.framework_id, input.code, id);
      const updated = await transaction
        .updateTable('quality_standards')
        .set(input)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_standards', id, 'update', before, updated);
      return updated;
    });
  }

  async deleteStandard(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_standards', id, 'Không tìm thấy tiêu chuẩn');
      const criteria = await transaction
        .selectFrom('quality_criteria')
        .select('id')
        .where('standard_id', '=', id)
        .execute();
      await this.assertCriteriaUnused(
        transaction,
        criteria.map((item) => item.id),
      );
      await transaction.deleteFrom('quality_standards').where('id', '=', id).execute();
      await this.audit(transaction, origin, 'quality_standards', id, 'delete', before, null);
    });
  }

  async createCriterion(currentUser: CurrentUser, standardId: string, input: CriterionInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const standard = await this.row(transaction, 'quality_standards', standardId, 'Không tìm thấy tiêu chuẩn');
      await this.checkUnique(transaction, 'quality_criteria', 'framework_id', standard.framework_id, input.code, null);
      const created = await transaction
        .insertInto('quality_criteria')
        .values({ ...input, framework_id: standard.framework_id, standard_id: standardId })
        .returningAll()
        .executeTakeFirstOrThrow();
      // Đợt đang làm theo bộ này có thêm phiếu cho tiêu chí mới
      const running = await transaction
        .selectFrom('quality_assessments')
        .select('id')
        .where('framework_id', '=', standard.framework_id)
        .where('status', '<>', 'completed')
        .execute();
      if (running.length > 0) {
        await transaction
          .insertInto('quality_criterion_reports')
          .values(running.map((assessment) => ({ assessment_id: assessment.id, criterion_id: created.id })))
          .execute();
      }
      await this.audit(transaction, origin, 'quality_criteria', created.id, 'create', null, created);
      return created;
    });
  }

  async updateCriterion(currentUser: CurrentUser, id: string, input: CriterionInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_criteria', id, 'Không tìm thấy tiêu chí');
      await this.checkUnique(transaction, 'quality_criteria', 'framework_id', before.framework_id, input.code, id);
      const updated = await transaction
        .updateTable('quality_criteria')
        .set(input)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_criteria', id, 'update', before, updated);
      return updated;
    });
  }

  async deleteCriterion(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_criteria', id, 'Không tìm thấy tiêu chí');
      await this.assertCriteriaUnused(transaction, [id]);
      await transaction.deleteFrom('quality_criteria').where('id', '=', id).execute();
      await this.audit(transaction, origin, 'quality_criteria', id, 'delete', before, null);
    });
  }

  // Tiêu chí đã có phiếu được soạn hoặc minh chứng thì không xóa; phiếu còn trống của đợt chưa xong thì xóa kèm
  private async assertCriteriaUnused(transaction: Transaction<SchoolYearDatabase>, ids: string[]) {
    if (ids.length === 0) {
      return;
    }
    const evidence = await this.evidenceStore.nodesInUse(ids);
    const written = await transaction
      .selectFrom('quality_criterion_reports')
      .select('id')
      .where('criterion_id', 'in', ids)
      .where((eb) =>
        eb.or([
          eb('status', '<>', 'draft'),
          eb('current_state', 'is not', null),
          eb('strengths', 'is not', null),
          eb('weaknesses', 'is not', null),
          eb('self_level', 'is not', null),
        ]),
      )
      .executeTakeFirst();
    if (evidence || written) {
      throw qualityRule('Tiêu chí đã có phiếu đánh giá hoặc minh chứng, không xóa được; sửa tên tiêu chí thay vì xóa');
    }
    await transaction.deleteFrom('quality_criterion_reports').where('criterion_id', 'in', ids).execute();
  }

  async createIndicator(currentUser: CurrentUser, criterionId: string, input: IndicatorInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.checkIndicator(transaction, criterionId, input, null);
      const created = await transaction
        .insertInto('quality_indicators')
        .values({ ...input, criterion_id: criterionId })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_indicators', created.id, 'create', null, created);
      return created;
    });
  }

  async updateIndicator(currentUser: CurrentUser, id: string, input: IndicatorInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_indicators', id, 'Không tìm thấy chỉ báo');
      await this.checkIndicator(transaction, before.criterion_id, input, id);
      const updated = await transaction
        .updateTable('quality_indicators')
        .set(input)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.audit(transaction, origin, 'quality_indicators', id, 'update', before, updated);
      return updated;
    });
  }

  async deleteIndicator(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.row(transaction, 'quality_indicators', id, 'Không tìm thấy chỉ báo');
      await transaction.deleteFrom('quality_indicators').where('id', '=', id).execute();
      await this.audit(transaction, origin, 'quality_indicators', id, 'delete', before, null);
    });
  }

  // Mức của chỉ báo không vượt số mức của bộ; mã chỉ báo không trùng trong cùng tiêu chí và mức
  private async checkIndicator(
    transaction: Transaction<SchoolYearDatabase>,
    criterionId: string,
    input: IndicatorInput,
    id: string | null,
  ) {
    const criterion = await transaction
      .selectFrom('quality_criteria')
      .innerJoin('quality_frameworks', 'quality_frameworks.id', 'quality_criteria.framework_id')
      .select(['quality_criteria.id', 'quality_frameworks.max_level'])
      .where('quality_criteria.id', '=', criterionId)
      .executeTakeFirst();
    if (!criterion) {
      throw notFoundError('Không tìm thấy tiêu chí', 'quality_criterion');
    }
    if (input.level > criterion.max_level) {
      throw validationError([{ field: 'level', message: `Bộ tiêu chuẩn có ${criterion.max_level} mức` }]);
    }
    let query = transaction
      .selectFrom('quality_indicators')
      .select('id')
      .where('criterion_id', '=', criterionId)
      .where('level', '=', input.level)
      .where('code', '=', input.code);
    if (id) {
      query = query.where('id', '<>', id);
    }
    if (await query.executeTakeFirst()) {
      throw validationError([{ field: 'code', message: 'Mã chỉ báo đã có ở mức này' }]);
    }
  }

  private async row<Table extends 'quality_standards' | 'quality_criteria' | 'quality_indicators'>(
    database: Executor,
    table: Table,
    id: string,
    message: string,
  ): Promise<Selectable<SchoolYearDatabase[Table]>> {
    const found = await (database as Kysely<SchoolYearDatabase>)
      .selectFrom(table as 'quality_standards')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!found) {
      throw notFoundError(message, table);
    }
    return found as unknown as Selectable<SchoolYearDatabase[Table]>;
  }

  private async checkUnique(
    database: Executor,
    table: 'quality_standards' | 'quality_criteria',
    parentColumn: 'framework_id',
    parentId: string,
    code: string,
    id: string | null,
  ) {
    let query = (database as Kysely<SchoolYearDatabase>)
      .selectFrom(table as 'quality_standards')
      .select('id')
      .where(parentColumn, '=', parentId)
      .where('code', '=', code);
    if (id) {
      query = query.where('id', '<>', id);
    }
    if (await query.executeTakeFirst()) {
      throw validationError([{ field: 'code', message: 'Mã đã có trong bộ tiêu chuẩn' }]);
    }
  }

  private async audit(
    transaction: Transaction<SchoolYearDatabase>,
    origin: ChangeOrigin,
    entityName: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    before: unknown,
    after: unknown,
  ) {
    await writeAuditLog(transaction, { origin, orgUnitId: null, entityName, entityId, action, before, after });
  }

  // ---- Đợt tự đánh giá ----

  async assessments(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const staffId = context.staff?.id ?? null;
    if (!context.manager && !staffId) {
      return [];
    }
    let query = context.database
      .selectFrom('quality_assessments as assessments')
      .innerJoin('quality_frameworks as frameworks', 'frameworks.id', 'assessments.framework_id')
      .select([
        'assessments.id',
        'assessments.title',
        'assessments.framework_id',
        'frameworks.name as framework_name',
        'assessments.decision_number',
        'assessments.decision_date',
        'assessments.start_date',
        'assessments.end_date',
        'assessments.status',
        'assessments.self_level',
        'assessments.external_level',
        'assessments.recognition_date',
        'assessments.created_at',
      ])
      .select((eb) => [
        eb
          .selectFrom('quality_criterion_reports')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_criterion_reports.assessment_id', '=', 'assessments.id')
          .as('report_count'),
        eb
          .selectFrom('quality_criterion_reports')
          .select((inner) => inner.fn.countAll<string>().as('count'))
          .whereRef('quality_criterion_reports.assessment_id', '=', 'assessments.id')
          .where('quality_criterion_reports.status', '=', 'approved')
          .as('approved_count'),
      ])
      .orderBy('assessments.created_at', 'desc')
      .limit(MAXIMUM_LIST);
    if (!context.manager && staffId) {
      query = query.where((eb) =>
        eb.or([
          eb.exists(
            eb
              .selectFrom('quality_council_members')
              .select('id')
              .whereRef('quality_council_members.assessment_id', '=', 'assessments.id')
              .where('quality_council_members.staff_id', '=', staffId),
          ),
          eb.exists(
            eb
              .selectFrom('quality_work_groups as groups')
              .leftJoin('quality_work_group_members as members', 'members.group_id', 'groups.id')
              .select('groups.id')
              .whereRef('groups.assessment_id', '=', 'assessments.id')
              .where((inner) =>
                inner.or([inner('groups.leader_staff_id', '=', staffId), inner('members.staff_id', '=', staffId)]),
              ),
          ),
        ]),
      );
    }
    const rows = await query.execute();
    const counts = new Map<string, number>();
    for (const frameworkId of new Set(rows.map((row) => row.framework_id))) {
      counts.set(frameworkId, new Set((await this.evidenceStore.byNodes(frameworkId, null)).map((row) => row.id)).size);
    }
    return rows.map((row) => ({
      ...row,
      status_label: QUALITY_ASSESSMENT_STATUS_LABELS[row.status],
      report_count: Number(row.report_count ?? 0),
      approved_count: Number(row.approved_count ?? 0),
      evidence_count: counts.get(row.framework_id) ?? 0,
    }));
  }

  private async activeFramework(database: Executor, id: string) {
    const framework = await this.frameworkRow(database, id);
    if (framework.status !== 'active') {
      throw qualityRule('Bộ tiêu chuẩn đã ngừng dùng');
    }
    return framework;
  }

  // Thêm phiếu còn thiếu cho mọi tiêu chí của bộ (tiêu chí thêm sau khi lập đợt)
  private async syncReports(transaction: Transaction<SchoolYearDatabase>, assessment: AssessmentRow) {
    await sql`insert into quality_criterion_reports (assessment_id, criterion_id)
      select ${assessment.id}, id from quality_criteria where framework_id = ${assessment.framework_id}
      on conflict (assessment_id, criterion_id) do nothing`.execute(transaction);
  }

  async createAssessment(currentUser: CurrentUser, input: AssessmentInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const framework = await this.activeFramework(transaction, input.framework_id);
      const criteria = await transaction
        .selectFrom('quality_criteria')
        .select('id')
        .where('framework_id', '=', framework.id)
        .executeTakeFirst();
      if (!criteria) {
        throw qualityRule('Bộ tiêu chuẩn chưa có tiêu chí');
      }
      const root = await this.rootUnit(transaction);
      const created = await transaction
        .insertInto('quality_assessments')
        .values({ ...input, org_unit_id: root.id, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.syncReports(transaction, created);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: root.id,
        entityName: 'quality_assessments',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateAssessment(currentUser: CurrentUser, id: string, input: AssessmentInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.assessmentRow(transaction, id);
      if (before.status === 'completed') {
        throw qualityRule('Đợt đã hoàn thành; mở lại trước khi sửa');
      }
      if (input.framework_id !== before.framework_id) {
        if (before.status !== 'draft') {
          throw qualityRule('Chỉ đổi bộ tiêu chuẩn khi đợt đang chuẩn bị');
        }
        await this.activeFramework(transaction, input.framework_id);
        await transaction.deleteFrom('quality_criterion_reports').where('assessment_id', '=', id).execute();
      }
      const updated = await transaction
        .updateTable('quality_assessments')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.syncReports(transaction, updated);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'quality_assessments',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async deleteAssessment(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.assessmentRow(transaction, id);
      if (before.status !== 'draft') {
        throw qualityRule('Chỉ xóa đợt đang chuẩn bị');
      }
      await transaction.deleteFrom('quality_assessments').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'quality_assessments',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  async assessment(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const { assessment, member } = await this.visibleAssessment(context, id);
    const database = context.database;
    const framework = await this.frameworkRow(database, assessment.framework_id);
    const council = await database
      .selectFrom('quality_council_members')
      .selectAll()
      .where('assessment_id', '=', id)
      .orderBy('sort_order')
      .execute();
    const groups = await database
      .selectFrom('quality_work_groups as groups')
      .leftJoin('staff', 'staff.id', 'groups.leader_staff_id')
      .select(['groups.id', 'groups.name', 'groups.leader_staff_id', 'staff.full_name as leader_name'])
      .where('groups.assessment_id', '=', id)
      .orderBy('groups.sort_order')
      .execute();
    const members =
      groups.length > 0
        ? await database
            .selectFrom('quality_work_group_members')
            .selectAll()
            .where(
              'group_id',
              'in',
              groups.map((group) => group.id),
            )
            .orderBy('staff_name')
            .execute()
        : [];
    const criteria = await this.criteriaRows(database, assessment);
    const summary = summarizeQualityLevels(criteria.map((row) => row.self_level));
    const evidenceStatus = new Map<string, string>(
      (await this.evidenceStore.byNodes(assessment.framework_id, null)).map((row) => [row.id, row.status]),
    );
    return {
      ...assessment,
      status_label: QUALITY_ASSESSMENT_STATUS_LABELS[assessment.status],
      framework: { id: framework.id, name: framework.name, max_level: framework.max_level },
      council: council.map((row) => ({ ...row, position_label: QUALITY_COUNCIL_POSITION_LABELS[row.position] })),
      groups: groups.map((group) => ({
        ...group,
        members: members.filter((row) => row.group_id === group.id),
        criterion_ids: criteria.filter((row) => row.work_group_id === group.id).map((row) => row.criterion_id),
      })),
      criteria,
      summary,
      evidence_status: Object.fromEntries(
        Object.keys(QUALITY_EVIDENCE_STATUS_LABELS).map((status) => [
          status,
          [...evidenceStatus.values()].filter((value) => value === status).length,
        ]),
      ),
      can_manage: context.manager,
      my_group_ids: member.groupIds,
      is_council_member: member.council,
    };
  }

  // Bảng tiến độ phiếu theo tiêu chí của đợt
  private async criteriaRows(database: Executor, assessment: { id: string; framework_id: string }) {
    const assessmentId = assessment.id;
    const evidences = await this.evidenceStore.byNodes(assessment.framework_id, null);
    const rows = await database
      .selectFrom('quality_criterion_reports as reports')
      .innerJoin('quality_criteria as criteria', 'criteria.id', 'reports.criterion_id')
      .innerJoin('quality_standards as standards', 'standards.id', 'criteria.standard_id')
      .leftJoin('quality_work_groups as groups', 'groups.id', 'reports.work_group_id')
      .select([
        'reports.id as report_id',
        'reports.criterion_id',
        'reports.work_group_id',
        'reports.status',
        'reports.self_level',
        'reports.updated_at',
        'criteria.code as criterion_code',
        'criteria.title as criterion_title',
        'standards.code as standard_code',
        'standards.title as standard_title',
        'groups.name as work_group_name',
      ])
      .where('reports.assessment_id', '=', assessmentId)
      .orderBy('standards.sort_order')
      .orderBy('standards.code')
      .orderBy('criteria.sort_order')
      .orderBy('criteria.code')
      .execute();
    return rows.map((row) => ({
      ...row,
      status_label: QUALITY_REPORT_STATUS_LABELS[row.status],
      level_label: qualityLevelLabel(row.self_level),
      evidence_count: evidences.filter((evidence) => evidence.node_id === row.criterion_id).length,
    }));
  }

  private async activeStaff(database: Executor, ids: string[]) {
    if (ids.length === 0) {
      return new Map<string, string>();
    }
    const rows = await database
      .selectFrom('staff')
      .select(['id', 'full_name'])
      .where('id', 'in', ids)
      .where('status', '=', 'active')
      .execute();
    const found = new Map(rows.map((row) => [row.id, row.full_name]));
    if (found.size !== new Set(ids).size) {
      throw validationError([{ field: 'staff_id', message: 'Có nhân sự không còn làm việc hoặc không tồn tại' }]);
    }
    return found;
  }

  async setCouncil(currentUser: CurrentUser, id: string, members: CouncilMemberInput[], origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status === 'completed') {
        throw qualityRule('Đợt đã hoàn thành, không sửa hội đồng');
      }
      const names = await this.activeStaff(
        transaction,
        members.map((member) => member.staff_id),
      );
      const before = await transaction
        .selectFrom('quality_council_members')
        .selectAll()
        .where('assessment_id', '=', id)
        .execute();
      await transaction.deleteFrom('quality_council_members').where('assessment_id', '=', id).execute();
      if (members.length > 0) {
        await transaction
          .insertInto('quality_council_members')
          .values(
            members.map((member, index) => ({
              assessment_id: id,
              staff_id: member.staff_id,
              staff_name: names.get(member.staff_id) ?? '',
              position: member.position,
              duty: member.duty,
              sort_order: index,
            })),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assessment.org_unit_id,
        entityName: 'quality_council_members',
        entityId: id,
        action: 'update',
        before,
        after: members,
      });
    });
    return this.assessment(currentUser, id);
  }

  // Thay toàn bộ nhóm công tác và phân công tiêu chí; tiêu chí không thuộc nhóm nào thì bỏ phân công
  async setGroups(currentUser: CurrentUser, id: string, groups: WorkGroupInput[], origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status === 'completed') {
        throw qualityRule('Đợt đã hoàn thành, không sửa nhóm công tác');
      }
      await this.syncReports(transaction, assessment);
      const names = await this.activeStaff(transaction, [
        ...new Set(
          groups.flatMap((group) => [
            ...group.member_staff_ids,
            ...(group.leader_staff_id ? [group.leader_staff_id] : []),
          ]),
        ),
      ]);
      const criteria = new Set(
        (
          await transaction
            .selectFrom('quality_criterion_reports')
            .select('criterion_id')
            .where('assessment_id', '=', id)
            .execute()
        ).map((row) => row.criterion_id),
      );
      const outside = groups
        .flatMap((group) => group.criterion_ids)
        .filter((criterionId) => !criteria.has(criterionId));
      if (outside.length > 0) {
        throw validationError([{ field: 'criterion_ids', message: 'Có tiêu chí không thuộc bộ tiêu chuẩn của đợt' }]);
      }
      const before = await transaction
        .selectFrom('quality_work_groups')
        .selectAll()
        .where('assessment_id', '=', id)
        .execute();
      await transaction.deleteFrom('quality_work_groups').where('assessment_id', '=', id).execute();
      for (const [index, group] of groups.entries()) {
        const created = await transaction
          .insertInto('quality_work_groups')
          .values({ assessment_id: id, name: group.name, leader_staff_id: group.leader_staff_id, sort_order: index })
          .returning('id')
          .executeTakeFirstOrThrow();
        const memberIds = [
          ...new Set([...(group.leader_staff_id ? [group.leader_staff_id] : []), ...group.member_staff_ids]),
        ];
        if (memberIds.length > 0) {
          await transaction
            .insertInto('quality_work_group_members')
            .values(
              memberIds.map((staffId) => ({
                group_id: created.id,
                staff_id: staffId,
                staff_name: names.get(staffId) ?? '',
              })),
            )
            .execute();
        }
        if (group.criterion_ids.length > 0) {
          await transaction
            .updateTable('quality_criterion_reports')
            .set({ work_group_id: created.id })
            .where('assessment_id', '=', id)
            .where('criterion_id', 'in', group.criterion_ids)
            .execute();
        }
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assessment.org_unit_id,
        entityName: 'quality_work_groups',
        entityId: id,
        action: 'update',
        before,
        after: groups,
      });
    });
    return this.assessment(currentUser, id);
  }

  async start(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status !== 'draft') {
        throw qualityRule('Chỉ bắt đầu đợt đang chuẩn bị');
      }
      const chair = await transaction
        .selectFrom('quality_council_members')
        .select('id')
        .where('assessment_id', '=', id)
        .where('position', '=', 'chair')
        .executeTakeFirst();
      if (!chair) {
        throw qualityRule('Lập hội đồng tự đánh giá có Chủ tịch trước khi bắt đầu');
      }
      const unassigned = await transaction
        .selectFrom('quality_criterion_reports')
        .select('id')
        .where('assessment_id', '=', id)
        .where('work_group_id', 'is', null)
        .executeTakeFirst();
      if (unassigned) {
        throw qualityRule('Còn tiêu chí chưa phân công cho nhóm công tác');
      }
      await this.setStatus(transaction, assessment, { status: 'in_progress' }, origin);
    });
    return this.assessment(currentUser, id);
  }

  // Hoàn thành: mọi phiếu đã duyệt; hội đồng chốt mức của trường (hệ thống gợi ý mức thấp nhất của các tiêu chí)
  async complete(currentUser: CurrentUser, id: string, selfLevel: number, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status !== 'in_progress') {
        throw qualityRule('Chỉ hoàn thành đợt đang đánh giá');
      }
      const pending = await transaction
        .selectFrom('quality_criterion_reports')
        .select('id')
        .where('assessment_id', '=', id)
        .where('status', '<>', 'approved')
        .executeTakeFirst();
      if (pending) {
        throw qualityRule('Còn phiếu đánh giá tiêu chí chưa duyệt');
      }
      const framework = await this.frameworkRow(transaction, assessment.framework_id);
      if (selfLevel > framework.max_level + 1) {
        throw validationError([{ field: 'self_level', message: 'Mức vượt số mức của bộ tiêu chuẩn' }]);
      }
      await this.setStatus(
        transaction,
        assessment,
        {
          status: 'completed',
          self_level: selfLevel,
          completed_at: this.clock.now(),
          completed_by_name: currentUser.description.full_name,
        },
        origin,
      );
    });
    return this.assessment(currentUser, id);
  }

  async reopen(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status !== 'completed') {
        throw qualityRule('Chỉ mở lại đợt đã hoàn thành');
      }
      await this.setStatus(
        transaction,
        assessment,
        { status: 'in_progress', completed_at: null, completed_by_name: null },
        origin,
      );
    });
    return this.assessment(currentUser, id);
  }

  private async setStatus(
    transaction: Transaction<SchoolYearDatabase>,
    assessment: AssessmentRow,
    values: Partial<{
      status: AssessmentRow['status'];
      self_level: number;
      completed_at: Date | null;
      completed_by_name: string | null;
    }>,
    origin: ChangeOrigin,
  ) {
    const updated = await transaction
      .updateTable('quality_assessments')
      .set({ ...values, updated_at: this.clock.now() })
      .where('id', '=', assessment.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: assessment.org_unit_id,
      entityName: 'quality_assessments',
      entityId: assessment.id,
      action: 'update',
      before: assessment,
      after: updated,
    });
  }

  // ---- Công nhận, hiệu lực, nối 1.7 ----

  async saveRecognition(currentUser: CurrentUser, id: string, input: RecognitionInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.status !== 'completed') {
        throw qualityRule('Ghi kết quả công nhận sau khi đợt tự đánh giá hoàn thành');
      }
      const updated = await transaction
        .updateTable('quality_assessments')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assessment.org_unit_id,
        entityName: 'quality_assessments',
        entityId: id,
        action: 'update',
        before: assessment,
        after: updated,
      });
    });
    return this.assessment(currentUser, id);
  }

  // Ghi cấp độ, ngày, năm công nhận vào bản rà soát 1.7 của năm học (17e); bản rà soát phải có trước
  async applyToReview(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.database.transaction().execute(async (transaction) => {
      const assessment = await this.assessmentRow(transaction, id);
      if (assessment.external_level === null || !assessment.recognition_date) {
        throw qualityRule('Ghi cấp độ và ngày công nhận của đợt trước khi cập nhật mục 1.7');
      }
      if (assessment.external_level < 1) {
        throw qualityRule('Kết quả chưa đạt, không ghi công nhận vào mục 1.7');
      }
      const root = await this.rootUnit(transaction);
      const before = await transaction
        .selectFrom('accreditation_reviews')
        .selectAll()
        .where('org_unit_id', '=', root.id)
        .executeTakeFirst();
      if (!before) {
        throw qualityRule(
          'Chưa có bản rà soát 1.7 của năm học; mở 1.7 Rà soát thông tin kiểm định CLGD, Lấy dữ liệu rồi Ghi trước',
        );
      }
      const after = await transaction
        .updateTable('accreditation_reviews')
        .set({
          accreditation_level: String(assessment.external_level),
          accreditation_date: assessment.recognition_date,
          accreditation_year: Number(assessment.recognition_date.slice(0, 4)),
          updated_by: currentUser.id,
          updated_at: this.clock.now(),
        })
        .where('id', '=', before.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: root.id,
        entityName: 'accreditation_reviews',
        entityId: before.id,
        action: 'update',
        before,
        after,
      });
      return {
        accreditation_level: after.accreditation_level,
        accreditation_date: after.accreditation_date,
        accreditation_year: after.accreditation_year,
      };
    });
  }

  // Theo dõi công nhận: bản ghi ở 1.7 của năm học và kết quả công nhận của các đợt; hiệu lực mặc định 5 năm
  async recognition(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const database = context.database;
    const root = await this.rootUnit(database);
    const review = await database
      .selectFrom('accreditation_reviews')
      .select([
        'accreditation_year',
        'accreditation_date',
        'accreditation_level',
        'national_standard_year',
        'national_standard_date',
        'national_standard_level',
        'updated_at',
      ])
      .where('org_unit_id', '=', root.id)
      .executeTakeFirst();
    const today = this.today();
    const warnBefore = (until: string | null) => {
      if (!until) {
        return 'unknown' as const;
      }
      if (until < today) {
        return 'expired' as const;
      }
      const days = (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
      return days <= QUALITY_LIMITS.recognitionWarningDays ? ('expiring' as const) : ('valid' as const);
    };
    const reviewUntil = recognitionValidUntil(review?.accreditation_date ?? null, null);
    const assessments = (await this.assessments(currentUser))
      .filter((row) => row.status === 'completed')
      .map((row) => row.id);
    const records =
      assessments.length > 0
        ? await database
            .selectFrom('quality_assessments as assessments')
            .innerJoin('quality_frameworks as frameworks', 'frameworks.id', 'assessments.framework_id')
            .select([
              'assessments.id',
              'assessments.title',
              'frameworks.name as framework_name',
              'assessments.self_level',
              'assessments.external_level',
              'assessments.recognition_decision',
              'assessments.recognition_date',
              'assessments.recognition_valid_until',
              'assessments.completed_at',
            ])
            .where('assessments.id', 'in', assessments)
            .orderBy('assessments.completed_at', 'desc')
            .execute()
        : [];
    return {
      today,
      review: review ? { ...review, valid_until: reviewUntil, state: warnBefore(reviewUntil) } : null,
      records: records.map((row) => {
        const until = recognitionValidUntil(row.recognition_date, row.recognition_valid_until);
        return {
          ...row,
          self_level_label: qualityLevelLabel(row.self_level),
          external_level_label: row.external_level === null ? '' : qualityLevelLabel(row.external_level),
          valid_until: until,
          state: row.recognition_date ? warnBefore(until) : ('unknown' as const),
        };
      }),
    };
  }

  // ---- Phiếu đánh giá tiêu chí ----

  private async reportRow(database: Executor, id: string): Promise<ReportRow> {
    const row = await database
      .selectFrom('quality_criterion_reports')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy phiếu đánh giá tiêu chí', 'quality_criterion_report');
    }
    return row;
  }

  async reports(currentUser: CurrentUser, assessmentId: string | null, mine: boolean) {
    const context = await this.context(currentUser);
    const staffId = context.staff?.id ?? null;
    if (!context.manager && !staffId) {
      return [];
    }
    let query = context.database
      .selectFrom('quality_criterion_reports as reports')
      .innerJoin('quality_assessments as assessments', 'assessments.id', 'reports.assessment_id')
      .innerJoin('quality_criteria as criteria', 'criteria.id', 'reports.criterion_id')
      .innerJoin('quality_standards as standards', 'standards.id', 'criteria.standard_id')
      .leftJoin('quality_work_groups as groups', 'groups.id', 'reports.work_group_id')
      .select([
        'reports.id',
        'reports.assessment_id',
        'assessments.title as assessment_title',
        'assessments.status as assessment_status',
        'reports.criterion_id',
        'criteria.code as criterion_code',
        'criteria.title as criterion_title',
        'standards.code as standard_code',
        'reports.work_group_id',
        'groups.name as work_group_name',
        'reports.status',
        'reports.self_level',
        'reports.submitted_at',
        'reports.updated_at',
      ])
      .where('assessments.status', '<>', 'draft')
      .orderBy('assessments.created_at', 'desc')
      .orderBy('standards.sort_order')
      .orderBy('criteria.sort_order')
      .orderBy('criteria.code')
      .limit(MAXIMUM_LIST);
    if (assessmentId) {
      query = query.where('reports.assessment_id', '=', assessmentId);
    }
    // Phiếu của tôi: phiếu của nhóm công tác mình; người quản lý không chọn "của tôi" thì xem mọi phiếu, thành viên hội
    // đồng xem mọi phiếu của đợt mình thuộc hội đồng
    if (mine || !context.manager) {
      const me = staffId ?? NO_ID;
      query = query.where((eb) => {
        const myGroups = eb.exists(
          eb
            .selectFrom('quality_work_group_members as members')
            .select('members.group_id')
            .whereRef('members.group_id', '=', 'reports.work_group_id')
            .where('members.staff_id', '=', me),
        );
        if (mine) {
          return myGroups;
        }
        return eb.or([
          myGroups,
          eb.exists(
            eb
              .selectFrom('quality_council_members as council')
              .select('council.id')
              .whereRef('council.assessment_id', '=', 'reports.assessment_id')
              .where('council.staff_id', '=', me),
          ),
        ]);
      });
    }
    return (await query.execute()).map((row) => ({
      ...row,
      status_label: QUALITY_REPORT_STATUS_LABELS[row.status],
      level_label: qualityLevelLabel(row.self_level),
    }));
  }

  private canEdit(context: QualityContext, member: Membership, report: ReportRow): boolean {
    return context.manager || (report.work_group_id !== null && member.groupIds.includes(report.work_group_id));
  }

  async report(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.reportRow(context.database, id);
    const { assessment, member } = await this.visibleAssessment(context, row.assessment_id);
    const database = context.database;
    const criterion = await database
      .selectFrom('quality_criteria as criteria')
      .innerJoin('quality_standards as standards', 'standards.id', 'criteria.standard_id')
      .select([
        'criteria.id',
        'criteria.code',
        'criteria.title',
        'criteria.evidence_hint',
        'standards.code as standard_code',
        'standards.title as standard_title',
      ])
      .where('criteria.id', '=', row.criterion_id)
      .executeTakeFirstOrThrow();
    const indicators = await database
      .selectFrom('quality_indicators')
      .selectAll()
      .where('criterion_id', '=', row.criterion_id)
      .orderBy('level')
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const results = resultsOf(row.indicator_results);
    const group = row.work_group_id
      ? await database
          .selectFrom('quality_work_groups')
          .select(['id', 'name'])
          .where('id', '=', row.work_group_id)
          .executeTakeFirst()
      : undefined;
    const editable = this.canEdit(context, member, row);
    return {
      ...row,
      improvement_actions: actionsOf(row.improvement_actions),
      indicator_results: results,
      status_label: QUALITY_REPORT_STATUS_LABELS[row.status],
      assessment: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        framework_id: assessment.framework_id,
      },
      criterion,
      indicators,
      suggested_level: suggestCriterionLevel(indicators, results),
      work_group_name: group?.name ?? null,
      evidences: await this.criterionEvidences(database, row.assessment_id, row.criterion_id),
      can_edit:
        editable && assessment.status === 'in_progress' && (row.status === 'draft' || row.status === 'returned'),
      can_review: context.manager && assessment.status === 'in_progress' && row.status === 'submitted',
      can_add_evidence: editable && assessment.status !== 'completed',
    };
  }

  // Minh chứng của tiêu chí: minh chứng mã theo tiêu chí và minh chứng dùng chung gắn thêm tiêu chí
  private async criterionEvidences(database: Executor, assessmentId: string, criterionId: string) {
    const assessment = await this.assessmentRow(database, assessmentId);
    return (await this.evidenceStore.byNodes(assessment.framework_id, [criterionId])).map((row) => ({
      id: row.id,
      code: row.code,
      display_code: row.display_code,
      title: row.title,
      document_number: row.document_number,
      issued_date: row.issued_date,
      issuer: row.issuer,
      status: row.status as QualityEvidenceStatusCode,
      status_label: row.status_label,
      validity: row.validity,
      validity_label: row.validity_label,
      shared: row.shared,
    }));
  }

  async updateReport(currentUser: CurrentUser, id: string, input: ReportInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.reportRow(transaction, id);
      const { assessment, member } = await this.visibleAssessment(context, before.assessment_id);
      if (!this.canEdit(context, member, before)) {
        throw forbidden('Chỉ thành viên nhóm công tác được phân công tiêu chí này soạn phiếu');
      }
      if (assessment.status !== 'in_progress') {
        throw qualityRule('Chỉ soạn phiếu khi đợt đang đánh giá');
      }
      if (before.status !== 'draft' && before.status !== 'returned') {
        throw qualityRule('Phiếu đã nộp hoặc đã duyệt, không sửa được');
      }
      const indicatorIds = new Set(
        (
          await transaction
            .selectFrom('quality_indicators')
            .select('id')
            .where('criterion_id', '=', before.criterion_id)
            .execute()
        ).map((row) => row.id),
      );
      if (Object.keys(input.indicator_results).some((key) => !indicatorIds.has(key))) {
        throw validationError([{ field: 'indicator_results', message: 'Có chỉ báo không thuộc tiêu chí này' }]);
      }
      const owners = input.improvement_actions
        .map((action) => action.owner_staff_id)
        .filter((value): value is string => value !== null);
      await this.activeStaff(transaction, [...new Set(owners)]);
      const framework = await this.frameworkRow(transaction, assessment.framework_id);
      if (input.self_level !== null && input.self_level > framework.max_level) {
        throw validationError([{ field: 'self_level', message: `Bộ tiêu chuẩn có ${framework.max_level} mức` }]);
      }
      const updated = await transaction
        .updateTable('quality_criterion_reports')
        .set({
          current_state: input.current_state,
          strengths: input.strengths,
          weaknesses: input.weaknesses,
          improvement_actions: JSON.stringify(input.improvement_actions),
          indicator_results: JSON.stringify(input.indicator_results),
          self_level: input.self_level,
          updated_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: assessment.org_unit_id,
        entityName: 'quality_criterion_reports',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
    });
    return this.report(currentUser, id);
  }

  // Nộp phiếu: đủ hiện trạng, điểm mạnh, điểm yếu và mức tự đánh giá
  async submitReport(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.reportRow(transaction, id);
      const { assessment, member } = await this.visibleAssessment(context, before.assessment_id);
      if (!this.canEdit(context, member, before)) {
        throw forbidden('Chỉ thành viên nhóm công tác được phân công tiêu chí này nộp phiếu');
      }
      if (assessment.status !== 'in_progress' || (before.status !== 'draft' && before.status !== 'returned')) {
        throw qualityRule('Phiếu không ở trạng thái nộp được');
      }
      const missing = [
        [before.current_state, 'mô tả hiện trạng'],
        [before.strengths, 'điểm mạnh'],
        [before.weaknesses, 'điểm yếu'],
      ]
        .filter(([value]) => !value)
        .map(([, label]) => label);
      if (before.self_level === null) {
        missing.push('mức tự đánh giá');
      }
      if (missing.length > 0) {
        throw qualityRule(`Phiếu còn thiếu ${missing.join(', ')}`);
      }
      await this.setReportStatus(
        transaction,
        assessment,
        before,
        {
          status: 'submitted',
          submitted_at: this.clock.now(),
          submitted_by_name: currentUser.description.full_name,
          return_note: null,
        },
        origin,
      );
    });
    return this.report(currentUser, id);
  }

  async reviewReport(
    currentUser: CurrentUser,
    id: string,
    decision: 'approve' | 'return',
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.reportRow(transaction, id);
      const assessment = await this.assessmentRow(transaction, before.assessment_id);
      if (assessment.status !== 'in_progress' || before.status !== 'submitted') {
        throw qualityRule('Chỉ duyệt hoặc trả lại phiếu đang chờ duyệt');
      }
      await this.setReportStatus(
        transaction,
        assessment,
        before,
        {
          status: decision === 'approve' ? 'approved' : 'returned',
          reviewed_at: this.clock.now(),
          reviewed_by_name: currentUser.description.full_name,
          return_note: decision === 'return' ? note : null,
        },
        origin,
      );
    });
    return this.report(currentUser, id);
  }

  // Người quản lý mở lại phiếu đã duyệt để sửa (đợt đang đánh giá)
  async reopenReport(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.reportRow(transaction, id);
      const assessment = await this.assessmentRow(transaction, before.assessment_id);
      if (assessment.status !== 'in_progress' || before.status !== 'approved') {
        throw qualityRule('Chỉ mở lại phiếu đã duyệt khi đợt đang đánh giá');
      }
      await this.setReportStatus(transaction, assessment, before, { status: 'returned', return_note: null }, origin);
    });
    return this.report(currentUser, id);
  }

  private async setReportStatus(
    transaction: Transaction<SchoolYearDatabase>,
    assessment: AssessmentRow,
    before: ReportRow,
    values: Partial<
      Pick<
        ReportRow,
        'status' | 'submitted_at' | 'submitted_by_name' | 'reviewed_at' | 'reviewed_by_name' | 'return_note'
      >
    >,
    origin: ChangeOrigin,
  ) {
    const updated = await transaction
      .updateTable('quality_criterion_reports')
      .set({ ...values, updated_at: this.clock.now() })
      .where('id', '=', before.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAuditLog(transaction, {
      origin,
      orgUnitId: assessment.org_unit_id,
      entityName: 'quality_criterion_reports',
      entityId: before.id,
      action: 'update',
      before,
      after: updated,
    });
  }

  // ---- Minh chứng ----

  // Thêm, sửa minh chứng của một tiêu chí: người quản lý hoặc thành viên nhóm được phân công tiêu chí; đợt chưa hoàn thành
  // Danh mục mã minh chứng của đợt, xuất Excel hoặc CSV
  async evidenceListFile(currentUser: CurrentUser, assessmentId: string, format: TableFileFormat) {
    const context = await this.context(currentUser);
    const { assessment } = await this.visibleAssessment(context, assessmentId);
    return this.evidenceStore.listFile(currentUser, assessment.framework_id, format);
  }

  async createWorkPlan(currentUser: CurrentUser, assessmentId: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    const assessment = await this.assessmentRow(context.database, assessmentId);
    if (assessment.status === 'draft') {
      throw qualityRule('Đợt chưa bắt đầu đánh giá');
    }
    if (assessment.work_plan_ids.length > 0) {
      throw qualityRule('Đợt đã có kế hoạch công việc của kế hoạch cải tiến');
    }
    const reports = await context.database
      .selectFrom('quality_criterion_reports as reports')
      .innerJoin('quality_criteria as criteria', 'criteria.id', 'reports.criterion_id')
      .select(['criteria.code', 'reports.improvement_actions'])
      .where('reports.assessment_id', '=', assessmentId)
      .where('reports.status', '=', 'approved')
      .orderBy('criteria.sort_order')
      .execute();
    const items: PlanItemInput[] = [];
    for (const report of reports) {
      for (const action of actionsOf(report.improvement_actions)) {
        if (action.owner_staff_id && action.due_date) {
          items.push({
            content: `Tiêu chí ${report.code}: ${action.content}`.slice(0, 500),
            ownerStaffId: action.owner_staff_id,
            dueDate: action.due_date,
          });
        }
      }
    }
    if (items.length === 0) {
      throw qualityRule('Chưa có việc cải tiến có người phụ trách và thời hạn ở các phiếu đã duyệt');
    }
    if (items.length > MAXIMUM_WORK_ITEMS) {
      throw qualityRule(`Kế hoạch công việc tối đa ${MAXIMUM_WORK_ITEMS} đầu việc`);
    }
    const owners = await context.database
      .selectFrom('staff')
      .select(['id', 'org_unit_id', 'status'])
      .where(
        'id',
        'in',
        items.map((item) => item.ownerStaffId),
      )
      .execute();
    const byUnit = new Map<string, PlanItemInput[]>();
    for (const item of items) {
      const owner = owners.find((row) => row.id === item.ownerStaffId);
      if (!owner || owner.status !== 'active') {
        throw qualityRule('Có người phụ trách việc cải tiến không còn làm việc; sửa phiếu trước khi tạo kế hoạch');
      }
      byUnit.set(owner.org_unit_id, [...(byUnit.get(owner.org_unit_id) ?? []), item]);
    }
    const current = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['start_date', 'end_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const planIds: string[] = [];
    for (const [orgUnitId, unitItems] of byUnit) {
      const created = await this.workPlans.createDraftFromModule(
        {
          orgUnitId,
          periodType: 'year',
          periodValue: `${String(year.start_date).slice(0, 4)}-${String(year.end_date).slice(0, 4)}`,
          title: `Kế hoạch cải tiến chất lượng: ${assessment.title}`.slice(0, 200),
          objectives: 'Thực hiện kế hoạch cải tiến chất lượng theo kết quả tự đánh giá',
          items: unitItems,
        },
        origin,
      );
      planIds.push(created.id);
    }
    await context.database
      .updateTable('quality_assessments')
      .set({ work_plan_ids: planIds, updated_at: this.clock.now() })
      .where('id', '=', assessmentId)
      .execute();
    return { work_plan_ids: planIds, plans: planIds.length, items: items.length };
  }

  // ---- Báo cáo tự đánh giá ----

  async exportReport(currentUser: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const context = await this.context(currentUser);
    const { assessment } = await this.visibleAssessment(context, id);
    const database = context.database;
    const tree = await this.frameworkTree(database, assessment.framework_id);
    const root = await this.rootUnit(database);
    const review = await database
      .selectFrom('accreditation_reviews')
      .selectAll()
      .where('org_unit_id', '=', root.id)
      .executeTakeFirst();
    const reports = await database
      .selectFrom('quality_criterion_reports')
      .selectAll()
      .where('assessment_id', '=', id)
      .execute();
    const linked = await this.evidenceStore.byNodes(assessment.framework_id, null);
    const evidences = linked.filter((row) => !row.shared);
    const council = await database
      .selectFrom('quality_council_members')
      .selectAll()
      .where('assessment_id', '=', id)
      .orderBy('sort_order')
      .execute();
    const staffNames = new Map(
      (
        await database
          .selectFrom('staff')
          .select(['id', 'full_name'])
          .where(
            'id',
            'in',
            reports
              .flatMap((report) => actionsOf(report.improvement_actions).map((action) => action.owner_staff_id))
              .filter((value): value is string => value !== null)
              .concat([NO_ID]),
          )
          .execute()
      ).map((row) => [row.id, row.full_name]),
    );
    const date = assessment.completed_at ?? this.clock.now();
    const day = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    const paragraphs = (text: string | null | undefined): DocumentBlock[] =>
      (text ?? '').split('\n').map((line) => ({ kind: 'paragraph' as const, text: line, align: 'justify' as const }));
    const value = (input: unknown) => (input === null || input === undefined ? '' : String(input));
    const blocks: DocumentBlock[] = [
      {
        kind: 'header',
        left: [root.name.toUpperCase(), 'HỘI ĐỒNG TỰ ĐÁNH GIÁ'],
        right: [
          'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
          'Độc lập - Tự do - Hạnh phúc',
          `..., ngày ${day.day} tháng ${day.month} năm ${day.year}`,
        ],
      },
      { kind: 'title', text: 'BÁO CÁO TỰ ĐÁNH GIÁ', subtitle: `${tree.name} – ${assessment.title}` },
      { kind: 'heading', text: 'Danh sách thành viên Hội đồng tự đánh giá' },
      {
        kind: 'table',
        header: ['TT', 'Họ và tên', 'Chức danh trong Hội đồng', 'Nhiệm vụ'],
        rows: council.map((member, index) => [
          String(index + 1),
          member.staff_name,
          QUALITY_COUNCIL_POSITION_LABELS[member.position],
          member.duty ?? '',
        ]),
        widths: [1, 5, 4, 6],
      },
      { kind: 'heading', text: 'Phần I. CƠ SỞ DỮ LIỆU' },
    ];
    if (review) {
      blocks.push({
        kind: 'table',
        header: ['Thông tin', 'Giá trị'],
        rows: [
          ['Tên trường', value(review.school_name)],
          ['Mã trường', value(review.school_code)],
          ['Loại hình', value(review.ownership_type)],
          ['Cấp học', value(review.education_level)],
          ['Số lớp', value(review.class_count)],
          ['Số phòng học', value(review.classroom_count)],
          ['Số phòng bộ môn', value(review.subject_room_count)],
          ['Diện tích đất (m²)', value(review.land_area_m2)],
          ['Diện tích sàn xây dựng (m²)', value(review.floor_area_m2)],
          ['Số học sinh', value(review.child_count)],
          ['Diện tích đất/học sinh (m²)', value(review.area_per_child_m2)],
          ['Diện tích sàn xây dựng/học sinh (m²)', value(review.floor_area_per_child_m2)],
          [
            'Công nhận chuẩn quốc gia',
            [
              review.national_standard_level ? `Mức độ ${review.national_standard_level}` : '',
              value(review.national_standard_date),
            ]
              .filter(Boolean)
              .join(', '),
          ],
          [
            'Công nhận kiểm định chất lượng giáo dục',
            [review.accreditation_level ? `Cấp độ ${review.accreditation_level}` : '', value(review.accreditation_date)]
              .filter(Boolean)
              .join(', '),
          ],
        ],
        widths: [6, 6],
      });
    } else {
      blocks.push({
        kind: 'paragraph',
        text: 'Chưa có bản rà soát 1.7 Rà soát thông tin kiểm định CLGD của năm học.',
        italic: true,
      });
    }
    blocks.push({ kind: 'heading', text: 'Phần II. TỰ ĐÁNH GIÁ' });
    blocks.push({ kind: 'heading', text: 'A. ĐẶT VẤN ĐỀ' }, ...paragraphs(assessment.introduction));
    blocks.push({ kind: 'heading', text: 'B. TỰ ĐÁNH GIÁ' });
    const summaryRows: string[][] = [];
    for (const standard of tree.standards) {
      blocks.push({ kind: 'heading', text: `Tiêu chuẩn ${standard.code}: ${standard.title}` });
      for (const criterion of standard.criteria) {
        const report = reports.find((row) => row.criterion_id === criterion.id);
        const codes = linked.filter((row) => row.node_id === criterion.id).map((row) => row.display_code);
        blocks.push({ kind: 'heading', text: `Tiêu chí ${criterion.code}: ${criterion.title}` });
        const results = resultsOf(report?.indicator_results);
        if (criterion.indicators.length > 0) {
          blocks.push({
            kind: 'table',
            header: ['Mức', 'Chỉ báo', 'Kết quả'],
            rows: criterion.indicators.map((indicator) => [
              `Mức ${indicator.level}`,
              `${indicator.code}) ${indicator.content}`,
              results[indicator.id] ? 'Đạt' : 'Chưa đạt',
            ]),
            widths: [2, 10, 2],
          });
        }
        blocks.push(
          { kind: 'paragraph', text: '1. Mô tả hiện trạng', bold: true },
          ...paragraphs(report?.current_state),
          { kind: 'paragraph', text: '2. Điểm mạnh', bold: true },
          ...paragraphs(report?.strengths),
          { kind: 'paragraph', text: '3. Điểm yếu', bold: true },
          ...paragraphs(report?.weaknesses),
          { kind: 'paragraph', text: '4. Kế hoạch cải tiến chất lượng', bold: true },
        );
        const actions = actionsOf(report?.improvement_actions);
        if (actions.length > 0) {
          blocks.push({
            kind: 'table',
            header: ['TT', 'Nội dung', 'Người phụ trách', 'Thời hạn', 'Nguồn lực'],
            rows: actions.map((action, index) => [
              String(index + 1),
              action.content,
              action.owner_staff_id ? (staffNames.get(action.owner_staff_id) ?? '') : '',
              action.due_date ?? '',
              action.resources ?? '',
            ]),
            widths: [1, 7, 4, 3, 4],
          });
        }
        blocks.push(
          { kind: 'paragraph', text: `5. Tự đánh giá: ${qualityLevelLabel(report?.self_level)}`, bold: true },
          { kind: 'paragraph', text: `Minh chứng: ${codes.length > 0 ? codes.join('; ') : 'chưa có'}`, italic: true },
        );
        summaryRows.push([
          `${criterion.code}`,
          criterion.title,
          ...Array.from({ length: tree.max_level }, (_unused, index) =>
            report?.self_level !== null && report?.self_level !== undefined && report.self_level >= index + 1
              ? 'x'
              : '',
          ),
        ]);
      }
    }
    const summary = summarizeQualityLevels(reports.map((report) => report.self_level));
    blocks.push({ kind: 'heading', text: 'C. KẾT LUẬN CHUNG' }, ...paragraphs(assessment.conclusion));
    blocks.push({
      kind: 'paragraph',
      text: `Số tiêu chí: ${summary.total}; ${Array.from({ length: tree.max_level }, (_unused, index) => `đạt Mức ${index + 1}: ${summary.by_level[index + 1] ?? 0}`).join('; ')}; chưa đạt: ${summary.by_level[0] ?? 0}.`,
    });
    blocks.push({
      kind: 'paragraph',
      text: `Mức đạt của nhà trường theo kết quả tự đánh giá: ${assessment.self_level === null ? 'chưa kết luận' : qualityLevelLabel(assessment.self_level)}.`,
      bold: true,
    });
    blocks.push({ kind: 'heading', text: 'Phần III. PHỤ LỤC' });
    blocks.push({ kind: 'paragraph', text: 'Bảng tổng hợp kết quả tự đánh giá', bold: true });
    blocks.push({
      kind: 'table',
      header: [
        'Tiêu chí',
        'Nội dung',
        ...Array.from({ length: tree.max_level }, (_unused, index) => `Mức ${index + 1}`),
      ],
      rows: summaryRows,
      widths: [2, 8, ...Array.from({ length: tree.max_level }, () => 2)],
    });
    blocks.push({ kind: 'paragraph', text: 'Danh mục mã minh chứng', bold: true });
    blocks.push({
      kind: 'table',
      header: ['TT', 'Mã minh chứng', 'Tên minh chứng', 'Số, ngày ban hành', 'Nơi ban hành', 'Ghi chú'],
      rows: evidences.map((row, index) => [
        String(index + 1),
        row.display_code,
        row.title,
        [row.document_number, row.issued_date].filter(Boolean).join(', '),
        row.issuer ?? '',
        QUALITY_EVIDENCE_STATUS_LABELS[row.status],
      ]),
      widths: [1, 3, 7, 3, 4, 2],
    });
    const chair = council.find((member) => member.position === 'chair');
    blocks.push({
      kind: 'signatures',
      right: { title: 'CHỦ TỊCH HỘI ĐỒNG', name: chair?.staff_name },
    });
    const title = `Báo cáo tự đánh giá – ${assessment.title}`;
    const buffer = format === 'docx' ? buildDocx(blocks, { title }) : await buildDocumentPdf(blocks, { title });
    return {
      buffer,
      contentType: format === 'docx' ? DOCX_TYPE : PDF_TYPE,
      fileName: `bao-cao-tu-danh-gia-${assessment.id.slice(0, 8)}.${format}`,
    };
  }
}
