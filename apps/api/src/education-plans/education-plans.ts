import { Injectable } from '@nestjs/common';
import type {
  EducationPlanAction,
  EducationPlanStatus,
  EducationPlanStep,
  SchoolYearDatabase,
  WorkPeriodType,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  diffEducationPlans,
  EDUCATION_PLAN_DEFAULT_KIND,
  EDUCATION_PLAN_DEFAULT_TEMPLATES,
  EDUCATION_PLAN_PERIOD_LABELS,
  EDUCATION_PLAN_RULE_CODE,
  EDUCATION_PLAN_SCOPE_LABELS,
  EDUCATION_PLAN_STATUS_LABELS,
  EDUCATION_PLAN_STEP_LABELS,
  EDUCATION_PLAN_STEPS,
  isSigningProvider,
  PERMISSION_CODES,
  SIGNING_SIGNATURE_TYPE_LABELS,
  type EducationPlanContent,
  type EducationPlanSection,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import { sql, type ExpressionBuilder, type Kysely, type Selectable, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { SchoolLevelResolver } from '../common/school-levels.js';
import { assertLevelEnabled } from '../catalogs/school-level-fields.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { buildTableFile, CONTENT_TYPES, type TableFileFormat } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { DossierSigner } from '../signing/dossier-signer.js';
import { PlansService, type PlanItemInput } from '../work/plans.js';
import {
  mapContent,
  type CopyInput,
  type PlanInput,
  type PlanUpdate,
  type TemplateInput,
} from './education-plan-fields.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147). Thư viện mẫu theo cấp học là cấu hình ở cơ sở dữ liệu năm học (nạp sẵn bản
// Mầm non). Kế hoạch lập từ mẫu (chụp lại các mục, bước duyệt lúc tạo), nội dung theo từng mục văn bản hoặc bảng. Duyệt nhiều
// cấp theo các bước mẫu chọn, thứ tự cố định:
// - tổ trưởng: Tổ trưởng chuyên môn cùng tổ (quyền duyệt bước tổ) hoặc trưởng nhóm công tác của hồ sơ chuyên môn (18e);
// - Phó Hiệu trưởng: quyền duyệt bước Phó Hiệu trưởng trong phạm vi đơn vị;
// - Hiệu trưởng: quyền phê duyệt cuối.
// Bỏ bước khi kế hoạch không thuộc tổ, nhóm (bước tổ trưởng) và bỏ bước mà chính người lập giữ quyền; người duyệt một bước mà
// cũng giữ quyền bước kế tiếp thì bỏ luôn bước đó. Bốn trạng thái: đang soạn, chờ duyệt (ở một bước), đã duyệt, bị trả lại.
// Bước cuối kí nội bộ khi mẫu cần kí (quy trình kí của Quản lý kí hồ sơ 16k, 17b qua DossierSigner, như hồ sơ chuyên môn 18e);
// đã duyệt thì bản PDF (bản đã kí nếu có) lưu vào thư mục của kho hồ sơ chuyên môn mà mẫu chỉ định. Mỗi lần trình là một
// phiên bản; sao chép từ năm trước giữ bản gốc để so sánh khác biệt. Kế hoạch đã duyệt tạo được kế hoạch công việc (Quản lý
// công việc, P09-03) với các dòng có ngày thành đầu việc. Các lựa chọn chi tiết do Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type PlanRow = Selectable<SchoolYearDatabase['education_plans']>;
type TemplateRow = Selectable<SchoolYearDatabase['education_plan_templates']>;

const USE = PERMISSION_CODES.educationPlanUse;
const REVIEW = PERMISSION_CODES.educationPlanReview;
const APPROVE = PERMISSION_CODES.educationPlanApprove;
const FINALIZE = PERMISSION_CODES.educationPlanFinalize;
const MANAGE = PERMISSION_CODES.educationPlanManage;
export const EDUCATION_PLAN_PERMISSIONS = [USE, REVIEW, APPROVE, FINALIZE, MANAGE];
const MAXIMUM_LIST = 500;
const MAXIMUM_VERSIONS = 100;
const MAXIMUM_WORK_ITEMS = 100;

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export function educationPlanRule(message: string): ApplicationError {
  return ruleViolationError(EDUCATION_PLAN_RULE_CODE, message);
}

function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

function inScope(scope: OrganizationScope, orgUnitId: string | null): boolean {
  return scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId));
}

function hasScope(scope: OrganizationScope): boolean {
  return scope.wholeSchool || scope.orgUnitIds.length > 0;
}

const sectionsOf = (value: unknown) => (Array.isArray(value) ? value : []) as EducationPlanSection[];
const contentOf = (value: unknown) =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as EducationPlanContent;

export interface PlanContext {
  database: Kysely<SchoolYearDatabase>;
  staff: { id: string; org_unit_id: string; department_id: string | null; full_name: string } | null;
  groupIds: string[];
  leaderGroupIds: string[];
  approveScope: OrganizationScope;
  finalizeScope: OrganizationScope;
  manageScope: OrganizationScope;
}

export interface PlanFilter {
  view: 'mine' | 'groups' | 'school' | 'review' | 'all';
  status: EducationPlanStatus | null;
  template_id: string | null;
  q: string | null;
  processed: boolean;
}

@Injectable()
export class EducationPlansService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly signer: DossierSigner,
    private readonly workPlans: PlansService,
    private readonly clock: Clock,
    private readonly schoolLevels: SchoolLevelResolver,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async context(currentUser: CurrentUser, database?: Kysely<SchoolYearDatabase>): Promise<PlanContext> {
    const db = database ?? (await this.currentSchoolYear.require()).database;
    const staff =
      (await db
        .selectFrom('staff')
        .select(['id', 'org_unit_id', 'department_id', 'full_name'])
        .where('user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst()) ?? null;
    // Nhóm công tác dùng chung với hồ sơ chuyên môn (18e)
    const memberships = staff
      ? await db
          .selectFrom('professional_work_group_members as members')
          .innerJoin('professional_work_groups as groups', 'groups.id', 'members.group_id')
          .select(['members.group_id', 'members.is_leader'])
          .where('members.staff_id', '=', staff.id)
          .where('groups.status', '=', 'active')
          .execute()
      : [];
    const empty: OrganizationScope = { wholeSchool: false, orgUnitIds: [] };
    const scopeOf = async (code: string) =>
      currentUser.hasPermission(code) ? this.organizationScopes.resolveStaff(currentUser, code) : empty;
    return {
      database: db,
      staff,
      groupIds: memberships.map((member) => member.group_id),
      leaderGroupIds: memberships.filter((member) => member.is_leader).map((member) => member.group_id),
      approveScope: await scopeOf(APPROVE),
      finalizeScope: await scopeOf(FINALIZE),
      manageScope: await scopeOf(MANAGE),
    };
  }

  private assertManage(context: PlanContext, orgUnitId: string | null = null): void {
    const scope = context.manageScope;
    if (!(scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId)))) {
      throw forbidden('Chỉ người quản lý kế hoạch giáo dục (Ban Giám hiệu) được thao tác');
    }
  }

  // ---- Tổng quan, danh sách chọn ----

  async overview(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const database = context.database;
    const department = context.staff?.department_id
      ? await database
          .selectFrom('departments')
          .select(['id', 'name'])
          .where('id', '=', context.staff.department_id)
          .executeTakeFirst()
      : undefined;
    const groups =
      context.groupIds.length > 0
        ? await database
            .selectFrom('professional_work_groups')
            .select(['id', 'name'])
            .where('id', 'in', context.groupIds)
            .orderBy('name')
            .execute()
        : [];
    // Nhóm lớp: lớp mình đang được phân công; người quản lý chọn mọi lớp trong phạm vi
    let classes = database
      .selectFrom('classes')
      .select(['classes.id', 'classes.name', 'classes.org_unit_id'])
      .where('classes.status', '=', 'active')
      .orderBy('classes.name');
    if (!context.manageScope.wholeSchool) {
      classes = classes.where((eb) =>
        eb.or([
          eb.exists(
            eb
              .selectFrom('class_staff_assignments as assignments')
              .select('assignments.id')
              .whereRef('assignments.class_id', '=', 'classes.id')
              .where('assignments.staff_user_id', '=', currentUser.id)
              .where('assignments.status', '=', 'active'),
          ),
          ...(context.manageScope.orgUnitIds.length > 0
            ? [eb('classes.org_unit_id', 'in', context.manageScope.orgUnitIds)]
            : []),
        ]),
      );
    }
    const isLeader = currentUser.hasPermission(REVIEW) && department !== undefined;
    return {
      has_staff: context.staff !== null,
      can_use: currentUser.hasPermission(USE),
      can_review: currentUser.hasPermission(REVIEW) || context.leaderGroupIds.length > 0,
      can_approve: currentUser.hasPermission(APPROVE),
      can_finalize: currentUser.hasPermission(FINALIZE),
      can_manage: currentUser.hasPermission(MANAGE),
      signer_description: this.signer.description,
      previous_year: (await this.previousYear())?.name ?? null,
      my_department: department ?? null,
      my_groups: [
        ...(isLeader && department ? [{ kind: 'department' as const, id: department.id, name: department.name }] : []),
        ...groups
          .filter((group) => context.leaderGroupIds.includes(group.id))
          .map((group) => ({ kind: 'work_group' as const, id: group.id, name: group.name })),
      ],
      classes: await classes.limit(MAXIMUM_LIST).execute(),
      org_units: await database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .where('status', '=', 'active')
        .orderBy('name')
        .execute(),
    };
  }

  // ---- Thư viện mẫu ----

  async templates(currentUser: CurrentUser, level: KpiSchoolLevelCode | null, includeInactive: boolean) {
    if (!EDUCATION_PLAN_PERMISSIONS.some((code) => currentUser.hasPermission(code))) {
      throw forbidden('Bạn không có quyền của kế hoạch giáo dục');
    }
    const { database } = await this.currentSchoolYear.require();
    let query = database
      .selectFrom('education_plan_templates as templates')
      .leftJoin('professional_folders as folders', 'folders.id', 'templates.archive_folder_id')
      .selectAll('templates')
      .select('folders.name as archive_folder_name')
      .select((eb) =>
        eb
          .selectFrom('education_plans')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('education_plans.template_id', '=', 'templates.id')
          .as('plan_count'),
      )
      .orderBy('templates.sort_order')
      .orderBy('templates.name');
    if (level) {
      query = query.where((eb) =>
        eb.or([eb('templates.school_level', '=', level), eb('templates.school_level', 'is', null)]),
      );
    }
    if (!includeInactive) {
      query = query.where('templates.status', '=', 'active');
    }
    return (await query.execute()).map((row) => ({ ...row, plan_count: Number(row.plan_count ?? 0) }));
  }

  private async template(database: Executor, id: string): Promise<TemplateRow> {
    const template = await database
      .selectFrom('education_plan_templates')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!template) {
      throw notFoundError('Không tìm thấy mẫu kế hoạch', 'education_plan_template');
    }
    return template;
  }

  private async checkTemplate(
    database: Executor,
    input: TemplateInput,
    id: string | null,
    previousLevel: string | null = null,
  ): Promise<void> {
    // Cấp học của mẫu phải là cấp đang bật của trường (YCTD-345); mẫu dùng chung mọi cấp để trống. Sửa mẫu cũ mà không đổi
    // cấp thì không kiểm, để cấp đã tắt vẫn sửa được mẫu cũ
    if (input.school_level && input.school_level !== previousLevel) {
      await assertLevelEnabled(this.schoolLevels, input.school_level);
    }
    const duplicate = await database
      .selectFrom('education_plan_templates')
      .select('id')
      .where('code', '=', input.code)
      .executeTakeFirst();
    if (duplicate && duplicate.id !== id) {
      throw validationError([{ field: 'code', message: 'Mã mẫu đã có' }]);
    }
    if (input.archive_folder_id) {
      const folder = await database
        .selectFrom('professional_folders')
        .select(['id', 'branch'])
        .where('id', '=', input.archive_folder_id)
        .executeTakeFirst();
      if (!folder) {
        throw validationError([{ field: 'archive_folder_id', message: 'Không có thư mục này trong kho hồ sơ' }]);
      }
    }
  }

  private templateValues(input: TemplateInput) {
    return {
      code: input.code,
      name: input.name,
      description: input.description,
      school_level: input.school_level,
      scope: input.scope,
      period: input.period,
      sections: JSON.stringify(input.sections),
      approval_steps: input.approval_steps,
      requires_signing: input.requires_signing,
      archive_folder_id: input.archive_folder_id,
      sort_order: input.sort_order,
      status: input.status,
    };
  }

  async createTemplate(currentUser: CurrentUser, input: TemplateInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.checkTemplate(transaction, input, null);
      const created = await transaction
        .insertInto('education_plan_templates')
        .values({ ...this.templateValues(input), created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'education_plan_templates',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Sửa mục thì tăng số hiệu mẫu; kế hoạch đã lập giữ mục đã chụp lúc tạo
  async updateTemplate(currentUser: CurrentUser, id: string, input: TemplateInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.template(transaction, id);
      await this.checkTemplate(transaction, input, id, before.school_level);
      const changed = JSON.stringify(before.sections) !== JSON.stringify(input.sections);
      const updated = await transaction
        .updateTable('education_plan_templates')
        .set({
          ...this.templateValues(input),
          revision: changed ? before.revision + 1 : before.revision,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'education_plan_templates',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async deleteTemplate(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.template(transaction, id);
      const used = await transaction
        .selectFrom('education_plans')
        .select('id')
        .where('template_id', '=', id)
        .executeTakeFirst();
      if (used) {
        throw educationPlanRule('Mẫu đã có kế hoạch lập theo; chuyển sang ngừng dùng thay vì xóa');
      }
      await transaction.deleteFrom('education_plan_templates').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'education_plan_templates',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  // Nạp mẫu mặc định theo cấp học; mã mẫu đã có thì bỏ qua. Thư mục lưu kho tìm theo tên trong kho hồ sơ chuyên môn cùng cấp
  async loadDefaults(currentUser: CurrentUser, level: KpiSchoolLevelCode, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    await assertLevelEnabled(this.schoolLevels, level);
    const seeds = EDUCATION_PLAN_DEFAULT_TEMPLATES[level];
    if (seeds.length === 0) {
      throw educationPlanRule('Chưa có mẫu mặc định cho cấp học này; trường tự thêm mẫu');
    }
    let created = 0;
    let skipped = 0;
    await context.database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (await transaction.selectFrom('education_plan_templates').select('code').execute()).map((row) => row.code),
      );
      const folders = await transaction
        .selectFrom('professional_folders')
        .select(['id', 'name', 'school_level'])
        .where('status', '=', 'active')
        .execute();
      for (const [index, seed] of seeds.entries()) {
        if (existing.has(seed.code)) {
          skipped += 1;
          continue;
        }
        const folder =
          folders.find((item) => item.name === seed.archive_folder_name && item.school_level === level) ??
          folders.find((item) => item.name === seed.archive_folder_name);
        const row = await transaction
          .insertInto('education_plan_templates')
          .values({
            code: seed.code,
            name: seed.name,
            description: seed.description,
            school_level: level,
            scope: seed.scope,
            period: seed.period,
            sections: JSON.stringify(seed.sections),
            approval_steps: seed.approval_steps,
            requires_signing: seed.requires_signing,
            archive_folder_id: folder?.id ?? null,
            sort_order: (index + 1) * 10,
            created_by: currentUser.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'education_plan_templates',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { code: seed.code, name: seed.name, school_level: level },
        });
        created += 1;
      }
    });
    return { created, skipped, kind: EDUCATION_PLAN_DEFAULT_KIND[level] };
  }

  // ---- Quyền trên một kế hoạch ----

  private canLead(
    context: PlanContext,
    currentUser: CurrentUser,
    plan: Pick<PlanRow, 'department_id' | 'work_group_id'>,
  ) {
    if (plan.work_group_id) {
      return context.leaderGroupIds.includes(plan.work_group_id);
    }
    return (
      plan.department_id !== null &&
      currentUser.hasPermission(REVIEW) &&
      context.staff?.department_id === plan.department_id
    );
  }

  private holdsStep(
    context: PlanContext,
    currentUser: CurrentUser,
    plan: Pick<PlanRow, 'department_id' | 'work_group_id' | 'org_unit_id'>,
    step: EducationPlanStep,
  ): boolean {
    if (step === 'leader') {
      return this.canLead(context, currentUser, plan);
    }
    if (step === 'vice_principal') {
      return currentUser.hasPermission(APPROVE) && inScope(context.approveScope, plan.org_unit_id);
    }
    return currentUser.hasPermission(FINALIZE) && inScope(context.finalizeScope, plan.org_unit_id);
  }

  // Các bước của lần trình: theo thứ tự cố định, bỏ bước tổ trưởng khi kế hoạch không thuộc tổ, nhóm, bỏ bước người lập giữ
  private stepsFor(context: PlanContext, currentUser: CurrentUser, plan: PlanRow): EducationPlanStep[] {
    return EDUCATION_PLAN_STEPS.filter((step) => plan.approval_steps.includes(step))
      .filter((step) => step !== 'leader' || (plan.scope !== 'school' && (plan.department_id || plan.work_group_id)))
      .filter((step) => !this.holdsStep(context, currentUser, plan, step));
  }

  private isOwner(context: PlanContext, currentUser: CurrentUser, plan: PlanRow): boolean {
    if (plan.owner_user_id === currentUser.id) {
      return true;
    }
    // Kế hoạch của tổ, nhóm: tổ trưởng, trưởng nhóm cũng sửa, trình được; kế hoạch của trường: người quản lý trong phạm vi
    if (plan.scope === 'group') {
      return this.canLead(context, currentUser, plan);
    }
    if (plan.scope === 'school') {
      return inScope(context.manageScope, plan.org_unit_id);
    }
    return false;
  }

  private visibleCondition(context: PlanContext, currentUser: CurrentUser) {
    return (eb: ExpressionBuilder<SchoolYearDatabase, 'education_plans'>) => {
      const conditions = [eb('education_plans.owner_user_id', '=', currentUser.id)];
      const staff = context.staff;
      if (staff?.department_id) {
        conditions.push(
          eb.and([
            eb('education_plans.scope', '=', 'group'),
            eb('education_plans.department_id', '=', staff.department_id),
          ]),
        );
        if (currentUser.hasPermission(REVIEW)) {
          conditions.push(eb('education_plans.department_id', '=', staff.department_id));
        }
      }
      if (context.groupIds.length > 0) {
        conditions.push(
          eb.and([
            eb('education_plans.scope', '=', 'group'),
            eb('education_plans.work_group_id', 'in', context.groupIds),
          ]),
        );
      }
      if (context.leaderGroupIds.length > 0) {
        conditions.push(eb('education_plans.work_group_id', 'in', context.leaderGroupIds));
      }
      // Kế hoạch của trường đã duyệt dùng chung cho mọi cán bộ có quyền
      conditions.push(
        eb.and([eb('education_plans.scope', '=', 'school'), eb('education_plans.status', '=', 'approved')]),
      );
      for (const scope of [context.approveScope, context.finalizeScope, context.manageScope]) {
        if (scope.wholeSchool) {
          conditions.push(eb.val(true));
        } else if (scope.orgUnitIds.length > 0) {
          conditions.push(eb('education_plans.org_unit_id', 'in', scope.orgUnitIds));
        }
      }
      return eb.or(conditions);
    };
  }

  // Kế hoạch đang chờ chính người dùng duyệt ở bước hiện tại, không gồm kế hoạch của mình
  pendingCondition(context: PlanContext, currentUser: CurrentUser) {
    return (eb: ExpressionBuilder<SchoolYearDatabase, 'education_plans'>) => {
      const conditions = [];
      const pendingAt = (step: EducationPlanStep) =>
        eb.and([eb('education_plans.status', '=', 'pending'), eb('education_plans.current_step', '=', step)]);
      const staff = context.staff;
      if (staff?.department_id && currentUser.hasPermission(REVIEW)) {
        conditions.push(
          eb.and([
            pendingAt('leader'),
            eb('education_plans.work_group_id', 'is', null),
            eb('education_plans.department_id', '=', staff.department_id),
          ]),
        );
      }
      if (context.leaderGroupIds.length > 0) {
        conditions.push(
          eb.and([pendingAt('leader'), eb('education_plans.work_group_id', 'in', context.leaderGroupIds)]),
        );
      }
      for (const [step, permission, scope] of [
        ['vice_principal', APPROVE, context.approveScope],
        ['principal', FINALIZE, context.finalizeScope],
      ] as const) {
        if (!currentUser.hasPermission(permission)) {
          continue;
        }
        if (scope.wholeSchool) {
          conditions.push(pendingAt(step));
        } else if (scope.orgUnitIds.length > 0) {
          conditions.push(eb.and([pendingAt(step), eb('education_plans.org_unit_id', 'in', scope.orgUnitIds)]));
        }
      }
      if (conditions.length === 0) {
        return eb.val(false);
      }
      return eb.and([eb('education_plans.owner_user_id', '!=', currentUser.id), eb.or(conditions)]);
    };
  }

  private async plan(database: Executor, id: string): Promise<PlanRow> {
    const plan = await database.selectFrom('education_plans').selectAll().where('id', '=', id).executeTakeFirst();
    if (!plan) {
      throw notFoundError('Không tìm thấy kế hoạch', 'education_plan');
    }
    return plan;
  }

  private async visiblePlan(context: PlanContext, currentUser: CurrentUser, id: string): Promise<PlanRow> {
    const plan = await this.plan(context.database, id);
    const visible = await context.database
      .selectFrom('education_plans')
      .select('id')
      .where('id', '=', id)
      .where((eb) =>
        eb.or([this.visibleCondition(context, currentUser)(eb), this.pendingCondition(context, currentUser)(eb)]),
      )
      .executeTakeFirst();
    if (!visible) {
      throw forbidden('Kế hoạch này nằm ngoài phạm vi của bạn');
    }
    return plan;
  }

  // ---- Danh sách, chi tiết ----

  async list(currentUser: CurrentUser, filter: PlanFilter) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('education_plans')
      .leftJoin('departments', 'departments.id', 'education_plans.department_id')
      .leftJoin('professional_work_groups as groups', 'groups.id', 'education_plans.work_group_id')
      .leftJoin('classes', 'classes.id', 'education_plans.class_id')
      .innerJoin('org_units', 'org_units.id', 'education_plans.org_unit_id')
      .select([
        'education_plans.id',
        'education_plans.template_id',
        'education_plans.template_name',
        'education_plans.scope',
        'education_plans.period',
        'education_plans.title',
        'education_plans.period_label',
        'education_plans.period_start',
        'education_plans.period_end',
        'education_plans.owner_name',
        'education_plans.owner_user_id',
        'departments.name as department_name',
        'groups.name as work_group_name',
        'classes.name as class_name',
        'org_units.name as org_unit_name',
        'education_plans.status',
        'education_plans.current_step',
        'education_plans.approval_steps',
        'education_plans.requires_signing',
        'education_plans.version_no',
        'education_plans.submitted_at',
        'education_plans.approved_by_name',
        'education_plans.approved_at',
        'education_plans.signed_at',
        'education_plans.source_year_name',
        'education_plans.updated_at',
      ])
      .where(this.visibleCondition(context, currentUser))
      .orderBy('education_plans.updated_at', 'desc');
    if (filter.view === 'mine') {
      query = query
        .where('education_plans.scope', 'in', ['personal', 'class'])
        .where('education_plans.owner_user_id', '=', currentUser.id);
    } else if (filter.view === 'groups') {
      query = query.where('education_plans.scope', '=', 'group');
    } else if (filter.view === 'school') {
      query = query.where('education_plans.scope', '=', 'school');
    } else if (filter.view === 'review') {
      query = filter.processed
        ? query.where((eb) =>
            eb.exists(
              eb
                .selectFrom('education_plan_events as events')
                .select('events.id')
                .whereRef('events.plan_id', '=', 'education_plans.id')
                .where('events.actor_id', '=', currentUser.id)
                .where('events.action', 'in', ['approve', 'return']),
            ),
          )
        : query.where(this.pendingCondition(context, currentUser));
    }
    if (filter.status) {
      query = query.where('education_plans.status', '=', filter.status);
    }
    if (filter.template_id) {
      query = query.where('education_plans.template_id', '=', filter.template_id);
    }
    if (filter.q) {
      const like = `%${filter.q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
      query = query.where((eb) =>
        eb.or([eb('education_plans.title', 'ilike', like), eb('education_plans.owner_name', 'ilike', like)]),
      );
    }
    const rows = await query.limit(MAXIMUM_LIST).execute();
    return rows.map((row) => ({ ...row, status_label: this.statusLabel(row) }));
  }

  private statusLabel(plan: Pick<PlanRow, 'status' | 'current_step'>): string {
    return plan.status === 'pending' && plan.current_step
      ? `Chờ ${EDUCATION_PLAN_STEP_LABELS[plan.current_step]} duyệt`
      : EDUCATION_PLAN_STATUS_LABELS[plan.status];
  }

  async view(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const database = context.database;
    const [department, group, schoolClass, unit, versions, events, archived] = await Promise.all([
      plan.department_id
        ? database.selectFrom('departments').select('name').where('id', '=', plan.department_id).executeTakeFirst()
        : undefined,
      plan.work_group_id
        ? database
            .selectFrom('professional_work_groups')
            .select('name')
            .where('id', '=', plan.work_group_id)
            .executeTakeFirst()
        : undefined,
      plan.class_id
        ? database.selectFrom('classes').select('name').where('id', '=', plan.class_id).executeTakeFirst()
        : undefined,
      database.selectFrom('org_units').select('name').where('id', '=', plan.org_unit_id).executeTakeFirst(),
      database
        .selectFrom('education_plan_versions')
        .select(['version_no', 'title', 'note', 'created_by_name', 'created_at'])
        .where('plan_id', '=', id)
        .orderBy('version_no', 'desc')
        .execute(),
      database
        .selectFrom('education_plan_events')
        .select(['id', 'action', 'step', 'note', 'actor_name', 'created_at'])
        .where('plan_id', '=', id)
        .orderBy('created_at')
        .orderBy('id')
        .execute(),
      plan.archived_document_id
        ? database
            .selectFrom('professional_documents as documents')
            .innerJoin('professional_folders as folders', 'folders.id', 'documents.folder_id')
            .select(['documents.id', 'folders.name as folder_name', 'documents.branch'])
            .where('documents.id', '=', plan.archived_document_id)
            .executeTakeFirst()
        : undefined,
    ]);
    const owner = this.isOwner(context, currentUser, plan);
    const editable = owner && (plan.status === 'draft' || plan.status === 'returned');
    const canAct =
      plan.status === 'pending' &&
      plan.current_step !== null &&
      plan.owner_user_id !== currentUser.id &&
      this.holdsStep(context, currentUser, plan, plan.current_step);
    return {
      ...plan,
      sections: sectionsOf(plan.sections),
      content: contentOf(plan.content),
      source_sections: plan.source_sections ? sectionsOf(plan.source_sections) : null,
      source_content: undefined,
      has_source: plan.source_content !== null,
      status_label: this.statusLabel(plan),
      scope_label: EDUCATION_PLAN_SCOPE_LABELS[plan.scope],
      period_type_label: EDUCATION_PLAN_PERIOD_LABELS[plan.period],
      department_name: department?.name ?? null,
      work_group_name: group?.name ?? null,
      class_name: schoolClass?.name ?? null,
      org_unit_name: unit?.name ?? '',
      signer_description: this.signer.description,
      archived_document: archived ?? null,
      versions,
      events,
      actions: {
        edit: editable,
        submit: editable,
        delete: owner && plan.status === 'draft' && plan.submitted_at === null,
        withdraw: owner && plan.status === 'pending' && !events.some((event) => this.approvedInRound(event, plan)),
        approve: canAct,
        return: canAct,
        work_plan:
          plan.status === 'approved' &&
          plan.work_plan_id === null &&
          currentUser.hasPermission(PERMISSION_CODES.planManage),
      },
    };
  }

  // Đã có bước duyệt trong lần trình hiện tại thì không rút lại được nữa
  private approvedInRound(event: { action: string; created_at: Date }, plan: PlanRow): boolean {
    return event.action === 'approve' && plan.submitted_at !== null && event.created_at >= plan.submitted_at;
  }

  // ---- Lập, sửa, xóa ----

  private async resolveOwnership(
    context: PlanContext,
    currentUser: CurrentUser,
    scope: TemplateRow['scope'],
    input: Pick<PlanInput, 'org_unit_id' | 'department_id' | 'work_group_id' | 'class_id'>,
  ) {
    const database = context.database;
    if (scope === 'school') {
      const unit =
        input.org_unit_id ??
        (
          await database
            .selectFrom('org_units')
            .select('id')
            .where('parent_id', 'is', null)
            .orderBy('created_at')
            .executeTakeFirstOrThrow()
        ).id;
      this.assertManage(context, unit);
      return { org_unit_id: unit, department_id: null, work_group_id: null, class_id: null };
    }
    const staff = context.staff;
    if (!staff || !currentUser.hasPermission(USE)) {
      throw forbidden('Chỉ cán bộ, giáo viên có hồ sơ nhân sự đang làm việc lập được kế hoạch');
    }
    if (scope === 'group') {
      if (input.work_group_id) {
        if (!context.leaderGroupIds.includes(input.work_group_id)) {
          throw educationPlanRule('Chỉ trưởng nhóm công tác lập kế hoạch của nhóm');
        }
        return {
          org_unit_id: staff.org_unit_id,
          department_id: null,
          work_group_id: input.work_group_id,
          class_id: null,
        };
      }
      const department = input.department_id ?? staff.department_id;
      if (!department || department !== staff.department_id || !currentUser.hasPermission(REVIEW)) {
        throw educationPlanRule('Chỉ tổ trưởng chuyên môn lập kế hoạch của tổ mình');
      }
      return { org_unit_id: staff.org_unit_id, department_id: department, work_group_id: null, class_id: null };
    }
    if (scope === 'class') {
      if (!input.class_id) {
        throw validationError([{ field: 'class_id', message: 'Chọn nhóm, lớp' }]);
      }
      const schoolClass = await database
        .selectFrom('classes')
        .select(['id', 'org_unit_id'])
        .where('id', '=', input.class_id)
        .executeTakeFirst();
      if (!schoolClass) {
        throw validationError([{ field: 'class_id', message: 'Không có nhóm, lớp này' }]);
      }
      const assigned = await database
        .selectFrom('class_staff_assignments')
        .select('id')
        .where('class_id', '=', input.class_id)
        .where('staff_user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!assigned && !inScope(context.manageScope, schoolClass.org_unit_id)) {
        throw educationPlanRule('Chỉ giáo viên được phân công ở nhóm, lớp lập kế hoạch của nhóm, lớp đó');
      }
      return {
        org_unit_id: schoolClass.org_unit_id,
        department_id: staff.department_id,
        work_group_id: null,
        class_id: schoolClass.id,
      };
    }
    return { org_unit_id: staff.org_unit_id, department_id: staff.department_id, work_group_id: null, class_id: null };
  }

  async create(currentUser: CurrentUser, input: PlanInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const template = await this.template(context.database, input.template_id);
    if (template.status !== 'active') {
      throw educationPlanRule('Mẫu đã ngừng dùng');
    }
    const owner = await this.resolveOwnership(context, currentUser, template.scope, input);
    const created = await context.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('education_plans')
        .values({
          template_id: template.id,
          template_name: template.name,
          template_revision: template.revision,
          scope: template.scope,
          period: template.period,
          school_level: template.school_level,
          title: input.title,
          period_label: input.period_label,
          period_start: input.period_start,
          period_end: input.period_end,
          ...owner,
          owner_user_id: currentUser.id,
          owner_staff_id: context.staff?.id ?? null,
          owner_name: currentUser.description.full_name,
          sections: JSON.stringify(template.sections),
          approval_steps: template.approval_steps,
          requires_signing: template.requires_signing,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.event(transaction, row.id, 'create', null, null, currentUser);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'education_plans',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { ...row, sections: undefined },
      });
      return row;
    });
    return this.view(currentUser, created.id);
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    readInput: (sections: EducationPlanSection[]) => PlanUpdate,
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    if (!this.isOwner(context, currentUser, plan) || !['draft', 'returned'].includes(plan.status)) {
      throw educationPlanRule('Chỉ sửa được kế hoạch của mình khi đang soạn hoặc bị trả lại');
    }
    const input = readInput(sectionsOf(plan.sections));
    await context.database.transaction().execute(async (transaction) => {
      const changed = await transaction
        .updateTable('education_plans')
        .set({
          title: input.title,
          period_label: input.period_label,
          period_start: input.period_start,
          period_end: input.period_end,
          content: JSON.stringify(input.content),
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .where('status', 'in', ['draft', 'returned'])
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw educationPlanRule('Kế hoạch vừa được trình duyệt; tải lại trang');
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'education_plans',
        entityId: id,
        action: 'update',
        before: { title: plan.title, content: plan.content },
        after: { title: input.title, content: input.content },
      });
    });
    return this.view(currentUser, id);
  }

  async remove(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    if (!this.isOwner(context, currentUser, plan) || plan.status !== 'draft' || plan.submitted_at !== null) {
      throw educationPlanRule('Chỉ xóa được kế hoạch của mình chưa trình lần nào');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('education_plans').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: plan.org_unit_id,
        entityName: 'education_plans',
        entityId: id,
        action: 'delete',
        before: { ...plan, sections: undefined, content: undefined },
        after: null,
      });
    });
  }

  // ---- Trình, duyệt, trả lại ----

  async submit(currentUser: CurrentUser, id: string, note: string | null) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    if (!this.isOwner(context, currentUser, plan) || !['draft', 'returned'].includes(plan.status)) {
      throw educationPlanRule('Chỉ trình được kế hoạch của mình khi đang soạn hoặc bị trả lại');
    }
    const sections = sectionsOf(plan.sections);
    const content = contentOf(plan.content);
    const empty = sections.every((section) => {
      const value = content[section.key];
      return Array.isArray(value) ? value.length === 0 : !value;
    });
    if (empty) {
      throw educationPlanRule('Kế hoạch chưa có nội dung; nhập nội dung trước khi trình');
    }
    if (plan.version_no >= MAXIMUM_VERSIONS) {
      throw educationPlanRule(`Mỗi kế hoạch tối đa ${MAXIMUM_VERSIONS} lần trình`);
    }
    const steps = this.stepsFor(context, currentUser, plan);
    const now = this.clock.now();
    if (steps.length === 0) {
      // Người lập giữ quyền mọi bước: trình là duyệt xong; kiểm tra chứng thư trước để không để kế hoạch kẹt ở chờ duyệt
      if (plan.requires_signing) {
        await this.certificate(currentUser);
      }
      await this.recordSubmission(context.database, plan, currentUser, note, [], now);
      return this.finish(context, currentUser, await this.plan(context.database, id), note, null);
    }
    await this.recordSubmission(context.database, plan, currentUser, note, steps, now);
    await this.notifyStep(context.database, await this.plan(context.database, id));
    return this.view(currentUser, id);
  }

  private async recordSubmission(
    database: Kysely<SchoolYearDatabase>,
    plan: PlanRow,
    currentUser: CurrentUser,
    note: string | null,
    steps: EducationPlanStep[],
    now: Date,
  ) {
    await database.transaction().execute(async (transaction) => {
      const versionNo = plan.version_no + 1;
      const changed = await transaction
        .updateTable('education_plans')
        .set({
          status: 'pending',
          current_step: steps[0] ?? 'principal',
          remaining_steps: steps,
          version_no: versionNo,
          submitted_at: now,
          return_note: null,
          approved_at: null,
          approved_by: null,
          approved_by_name: null,
          updated_at: now,
        })
        .where('id', '=', plan.id)
        .where('version_no', '=', plan.version_no)
        .where('status', 'in', ['draft', 'returned'])
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw educationPlanRule('Kế hoạch vừa được trình; tải lại trang');
      }
      await transaction
        .insertInto('education_plan_versions')
        .values({
          plan_id: plan.id,
          version_no: versionNo,
          title: plan.title,
          sections: JSON.stringify(plan.sections),
          content: JSON.stringify(plan.content),
          note,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .execute();
      await this.event(
        transaction,
        plan.id,
        'submit',
        null,
        [plan.version_no > 0 ? `Trình lại, phiên bản ${versionNo}` : `Phiên bản ${versionNo}`, note]
          .filter(Boolean)
          .join('; '),
        currentUser,
      );
    });
  }

  async withdraw(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const detail = await this.view(currentUser, id);
    if (!detail.actions.withdraw) {
      throw educationPlanRule('Chỉ rút lại được kế hoạch của mình đang chờ duyệt và chưa có bước nào duyệt');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('education_plans')
        .set({ status: 'draft', current_step: null, remaining_steps: [], updated_at: this.clock.now() })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .execute();
      await this.event(transaction, id, 'withdraw', plan.current_step, null, currentUser);
    });
    return this.view(currentUser, id);
  }

  async approve(currentUser: CurrentUser, id: string, note: string | null) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const step = plan.current_step;
    if (
      plan.status !== 'pending' ||
      !step ||
      plan.owner_user_id === currentUser.id ||
      !this.holdsStep(context, currentUser, plan, step)
    ) {
      throw educationPlanRule('Kế hoạch không chờ bạn duyệt ở bước hiện tại');
    }
    // Người duyệt giữ cả quyền các bước kế tiếp (Hiệu trưởng duyệt thay Phó Hiệu trưởng) thì bỏ luôn các bước đó
    const remaining = plan.remaining_steps.slice(1);
    while (remaining.length > 0 && this.holdsStep(context, currentUser, plan, remaining[0]!)) {
      remaining.shift();
    }
    if (remaining.length === 0) {
      return this.finish(context, currentUser, plan, note, step);
    }
    await context.database.transaction().execute(async (transaction) => {
      const changed = await transaction
        .updateTable('education_plans')
        .set({ current_step: remaining[0]!, remaining_steps: remaining, updated_at: this.clock.now() })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .where('current_step', '=', step)
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw educationPlanRule('Kế hoạch vừa được người khác xử lý');
      }
      await this.event(transaction, id, 'approve', step, note, currentUser);
    });
    await this.notifyStep(context.database, await this.plan(context.database, id));
    return this.view(currentUser, id);
  }

  // Bước cuối: kí nội bộ khi mẫu cần kí, đặt đã duyệt, lưu bản PDF vào kho hồ sơ chuyên môn khi mẫu chỉ định thư mục
  private async finish(
    context: PlanContext,
    currentUser: CurrentUser,
    plan: PlanRow,
    note: string | null,
    step: EducationPlanStep | null,
  ) {
    const database = context.database;
    const now = this.clock.now();
    const stored: string[] = [];
    let signed: { key: string; pdf: Buffer; method: string } | null = null;
    let archive: {
      folder: { id: string; branch: 'personal' | 'group' | 'school'; approval_flow: 'none' | 'leader' | 'two_level' };
      pdf: Buffer;
      key: string;
    } | null = null;
    try {
      const rendered = await this.render(database, plan, 'pdf', { name: currentUser.description.full_name, step });
      if (plan.requires_signing) {
        signed = await this.sign(database, currentUser, plan, rendered.buffer, now);
        stored.push(signed.key);
      }
      const folder = await this.archiveFolder(database, plan);
      if (folder) {
        const pdf = signed?.pdf ?? rendered.buffer;
        const key = storageKey('professional-records', plan.id, randomUUID());
        await this.fileStorage.put(key, pdf, CONTENT_TYPES.pdf);
        stored.push(key);
        archive = { folder, pdf, key };
      }
      await database.transaction().execute(async (transaction) => {
        let signedFileId: string | null = null;
        if (signed) {
          signedFileId = (
            await transaction
              .insertInto('files')
              .values({
                org_unit_id: plan.org_unit_id,
                purpose: 'professional_record',
                file_name: `ke-hoach-${plan.id.slice(0, 8)}-da-ki.pdf`,
                content_type: CONTENT_TYPES.pdf,
                size_bytes: signed.pdf.length,
                storage_key: signed.key,
                created_by: currentUser.id,
              })
              .returning('id')
              .executeTakeFirstOrThrow()
          ).id;
        }
        const changed = await transaction
          .updateTable('education_plans')
          .set({
            status: 'approved',
            current_step: null,
            remaining_steps: [],
            approved_at: now,
            approved_by: currentUser.id,
            approved_by_name: currentUser.description.full_name,
            ...(signed ? { signed_at: now, signature_method: signed.method, signed_file_id: signedFileId } : {}),
            updated_at: now,
          })
          .where('id', '=', plan.id)
          .where('status', '=', 'pending')
          .executeTakeFirst();
        if (Number(changed.numUpdatedRows) !== 1) {
          throw educationPlanRule('Kế hoạch không còn chờ bạn duyệt');
        }
        if (step) {
          await this.event(transaction, plan.id, 'approve', step, note, currentUser);
        }
        if (signed) {
          await this.event(
            transaction,
            plan.id,
            'sign',
            step,
            this.signer.digital ? 'Kí số' : 'Kí xác nhận nội bộ',
            currentUser,
          );
        }
        if (archive) {
          const documentId = await this.archiveInto(transaction, plan, currentUser, archive, now);
          await transaction
            .updateTable('education_plans')
            .set({ archived_document_id: documentId })
            .where('id', '=', plan.id)
            .execute();
          await this.event(transaction, plan.id, 'archive', null, null, currentUser);
        }
      });
    } catch (error) {
      await Promise.all(stored.map((key) => this.fileStorage.delete(key).catch(() => undefined)));
      throw error;
    }
    await this.notifyOwner(database, plan, 'Kế hoạch giáo dục đã được duyệt', note);
    return this.view(currentUser, plan.id);
  }

  private async archiveFolder(database: Executor, plan: PlanRow) {
    if (!plan.template_id) {
      return null;
    }
    const folder = await database
      .selectFrom('education_plan_templates as templates')
      .innerJoin('professional_folders as folders', 'folders.id', 'templates.archive_folder_id')
      .select(['folders.id', 'folders.branch', 'folders.approval_flow', 'folders.status'])
      .where('templates.id', '=', plan.template_id)
      .executeTakeFirst();
    // Thư mục nhánh tổ cần kế hoạch có tổ hoặc nhóm; ngừng dùng thì không lưu
    if (!folder || folder.status !== 'active') {
      return null;
    }
    if (folder.branch === 'group' && !plan.department_id && !plan.work_group_id) {
      return null;
    }
    return { id: folder.id, branch: folder.branch, approval_flow: folder.approval_flow };
  }

  // Bản lưu kho là hồ sơ đã duyệt của kho hồ sơ chuyên môn (18e), một phiên bản là bản PDF của kế hoạch
  private async archiveInto(
    transaction: Transaction<SchoolYearDatabase>,
    plan: PlanRow,
    currentUser: CurrentUser,
    archive: {
      folder: { id: string; branch: 'personal' | 'group' | 'school'; approval_flow: 'none' | 'leader' | 'two_level' };
      pdf: Buffer;
      key: string;
    },
    now: Date,
  ): Promise<string> {
    const file = await transaction
      .insertInto('files')
      .values({
        org_unit_id: plan.org_unit_id,
        purpose: 'professional_record',
        file_name: `ke-hoach-${plan.id.slice(0, 8)}.pdf`,
        content_type: CONTENT_TYPES.pdf,
        size_bytes: archive.pdf.length,
        storage_key: archive.key,
        created_by: currentUser.id,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const document = await transaction
      .insertInto('professional_documents')
      .values({
        folder_id: archive.folder.id,
        branch: archive.folder.branch,
        org_unit_id: plan.org_unit_id,
        owner_user_id: plan.owner_user_id,
        owner_staff_id: plan.owner_staff_id,
        owner_name: plan.owner_name,
        department_id: archive.folder.branch === 'school' ? null : plan.department_id,
        work_group_id: archive.folder.branch === 'group' ? plan.work_group_id : null,
        title: plan.title,
        description: `Kế hoạch giáo dục đã duyệt (${plan.template_name})`,
        status: 'approved',
        approval_flow: archive.folder.approval_flow,
        requires_signing: plan.requires_signing,
        current_version: 1,
        submitted_at: plan.submitted_at,
        approved_by: currentUser.id,
        approved_by_name: currentUser.description.full_name,
        approved_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await transaction
      .insertInto('professional_document_versions')
      .values({
        document_id: document.id,
        version_no: 1,
        file_id: file.id,
        sha256: sha256(archive.pdf),
        note: 'Bản kế hoạch đã duyệt',
        created_by: currentUser.id,
        created_by_name: currentUser.description.full_name,
      })
      .execute();
    await transaction
      .insertInto('professional_document_events')
      .values({
        document_id: document.id,
        action: 'approve',
        note: 'Lưu từ kế hoạch giáo dục đã duyệt',
        actor_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
    return document.id;
  }

  // Chứng thư số nhà trường đã đăng ký kí nội bộ, còn hiệu lực; đang đăng nhập thay thì không kí (YCTD-145)
  private async certificate(currentUser: CurrentUser) {
    if (currentUser.description.impersonation) {
      throw educationPlanRule('Đang đăng nhập thay, không kí được kế hoạch');
    }
    const certificate = await this.databases.system.selectFrom('signing_certificates').selectAll().executeTakeFirst();
    if (certificate?.status !== 'registered') {
      throw educationPlanRule(
        'Mẫu cần kí nhưng chứng thư số nhà trường chưa đăng ký kí nội bộ (Quản lý kí hồ sơ, mục 1.1); đăng ký trước khi duyệt',
      );
    }
    if (certificate.valid_to && certificate.valid_to < this.today()) {
      throw educationPlanRule('Chứng thư số nhà trường đã hết hiệu lực');
    }
    if (!isSigningProvider(certificate.provider)) {
      throw educationPlanRule(
        'Nhà phát hành chứng thư không có trong danh sách của Sở; đăng ký lại chứng thư (Quản lý kí hồ sơ, mục 1.1)',
      );
    }
    return certificate;
  }

  private async sign(
    database: Executor,
    currentUser: CurrentUser,
    plan: PlanRow,
    pdf: Buffer,
    signedAt: Date,
  ): Promise<{ key: string; pdf: Buffer; method: string }> {
    const certificate = await this.certificate(currentUser);
    const sealImage =
      certificate.seal_storage_key && certificate.seal_content_type
        ? `data:${certificate.seal_content_type};base64,${(await this.fileStorage.get(certificate.seal_storage_key)).toString('base64')}`
        : null;
    const unit = await database
      .selectFrom('org_units')
      .select('name')
      .where('id', '=', plan.org_unit_id)
      .executeTakeFirst();
    const title = 'KẾ HOẠCH GIÁO DỤC ĐÃ DUYỆT';
    const result = await this.signer.sign({
      code: `KHGD-${plan.id.slice(0, 8).toUpperCase()}`,
      title,
      heading: [title, plan.template_name],
      sheets: [
        {
          title,
          columns: [
            { key: 'label', label: 'Thông tin', width: 22 },
            { key: 'value', label: 'Nội dung', width: 70 },
          ],
          rows: [
            { label: 'Tên kế hoạch', value: plan.title },
            { label: 'Mẫu', value: plan.template_name },
            { label: 'Kì', value: plan.period_label ?? EDUCATION_PLAN_PERIOD_LABELS[plan.period] },
            { label: 'Đơn vị', value: unit?.name ?? '' },
            { label: 'Người lập', value: plan.owner_name },
            { label: 'Phiên bản', value: String(plan.version_no) },
            { label: 'Mã băm SHA-256 của bản kế hoạch', value: sha256(pdf) },
          ],
        },
      ],
      originalPdf: pdf,
      originalSha256: sha256(pdf),
      signedAt,
      signerName: currentUser.description.full_name,
      certificate: {
        signatureTypeLabel: SIGNING_SIGNATURE_TYPE_LABELS[certificate.signature_type],
        provider: certificate.provider,
        holderName: certificate.holder_name,
        holderTitle: certificate.holder_title,
        serialNumber: certificate.serial_number,
      },
      sealImage,
      verification: null,
    });
    const key = storageKey('education-plans', plan.id, randomUUID());
    await this.fileStorage.put(key, result.pdf, CONTENT_TYPES.pdf);
    return { key, pdf: result.pdf, method: result.method };
  }

  async giveBack(currentUser: CurrentUser, id: string, note: string) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const step = plan.current_step;
    if (
      plan.status !== 'pending' ||
      !step ||
      plan.owner_user_id === currentUser.id ||
      !this.holdsStep(context, currentUser, plan, step)
    ) {
      throw educationPlanRule('Chỉ người đang được chờ duyệt trả lại được kế hoạch');
    }
    await context.database.transaction().execute(async (transaction) => {
      const changed = await transaction
        .updateTable('education_plans')
        .set({
          status: 'returned',
          current_step: null,
          remaining_steps: [],
          return_note: note,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .where('current_step', '=', step)
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw educationPlanRule('Kế hoạch vừa được người khác xử lý');
      }
      await this.event(transaction, id, 'return', step, note, currentUser);
    });
    await this.notifyOwner(context.database, plan, 'Kế hoạch giáo dục bị trả lại', note);
    return this.view(currentUser, id);
  }

  private async event(
    executor: Executor,
    planId: string,
    action: EducationPlanAction,
    step: EducationPlanStep | null,
    note: string | null,
    currentUser: CurrentUser,
  ): Promise<void> {
    await executor
      .insertInto('education_plan_events')
      .values({
        plan_id: planId,
        action,
        step,
        note,
        actor_id: currentUser.id,
        actor_name: currentUser.description.full_name,
        // Giờ thực lúc ghi (không phải giờ bắt đầu giao dịch) để lịch sử trong cùng giao dịch giữ đúng thứ tự
        created_at: sql<Date>`clock_timestamp()`,
      })
      .execute();
  }

  private async notifyOwner(database: Executor, plan: PlanRow, title: string, note: string | null) {
    await queueNotification(database, {
      orgUnitId: plan.org_unit_id,
      templateCode: 'education_plan',
      title,
      body: [plan.title, note].filter(Boolean).join(': '),
      targetType: 'education_plan',
      targetId: plan.id,
      recipients: [{ userId: plan.owner_user_id, channel: 'in_app' }],
    });
  }

  // Báo người duyệt của bước đang chờ: trưởng nhóm công tác, vai trò tổ trưởng, Phó Hiệu trưởng hoặc Hiệu trưởng của đơn vị
  private async notifyStep(database: Executor, plan: PlanRow) {
    const step = plan.current_step;
    if (plan.status !== 'pending' || !step) {
      return;
    }
    let recipients: NotificationRecipient[];
    if (step === 'leader' && plan.work_group_id) {
      const leaders = await database
        .selectFrom('professional_work_group_members as members')
        .innerJoin('staff', 'staff.id', 'members.staff_id')
        .select('staff.user_id')
        .where('members.group_id', '=', plan.work_group_id)
        .where('members.is_leader', '=', true)
        .execute();
      recipients = leaders
        .filter((leader): leader is { user_id: string } => leader.user_id !== null)
        .map((leader) => ({ userId: leader.user_id, channel: 'in_app' }));
    } else {
      const role = { leader: 'VT-17', vice_principal: 'VT-15', principal: 'VT-02' }[step];
      recipients = [{ roleCode: role, orgUnitId: plan.org_unit_id, channel: 'in_app' }];
    }
    await queueNotification(database, {
      orgUnitId: plan.org_unit_id,
      templateCode: 'education_plan',
      title: `Kế hoạch giáo dục chờ ${EDUCATION_PLAN_STEP_LABELS[step]} duyệt`,
      body: `${plan.owner_name}: ${plan.title}`,
      targetType: 'education_plan',
      targetId: plan.id,
      recipients,
    });
  }

  // ---- So sánh khác biệt ----

  // So bản năm trước (from = source) hoặc một phiên bản đã trình (from = số phiên bản) với bản hiện tại hoặc phiên bản to
  async diff(currentUser: CurrentUser, id: string, from: string, to: string | null) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const version = async (value: string) => {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1) {
        throw validationError([{ field: 'from', message: 'Chọn bản năm trước hoặc số phiên bản' }]);
      }
      const row = await context.database
        .selectFrom('education_plan_versions')
        .select(['sections', 'content', 'version_no'])
        .where('plan_id', '=', id)
        .where('version_no', '=', number)
        .executeTakeFirst();
      if (!row) {
        throw notFoundError('Không tìm thấy phiên bản', 'education_plan_version');
      }
      return { sections: sectionsOf(row.sections), content: contentOf(row.content), label: `Phiên bản ${number}` };
    };
    let before: { sections: EducationPlanSection[]; content: EducationPlanContent; label: string };
    if (from === 'source') {
      if (plan.source_content === null) {
        throw educationPlanRule('Kế hoạch không sao chép từ năm trước');
      }
      before = {
        sections: sectionsOf(plan.source_sections),
        content: contentOf(plan.source_content),
        label: `Bản năm học ${plan.source_year_name ?? 'trước'}`,
      };
    } else {
      before = await version(from);
    }
    const after = to
      ? await version(to)
      : { sections: sectionsOf(plan.sections), content: contentOf(plan.content), label: 'Bản hiện tại' };
    const sections = diffEducationPlans(before, after);
    return {
      from_label: before.label,
      to_label: after.label,
      changed: sections.filter((section) => section.state !== 'same').length,
      sections,
    };
  }

  // ---- Xuất Word, PDF ----

  private async schoolName(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    return root?.name ?? '';
  }

  private async render(
    database: Executor,
    plan: PlanRow,
    format: 'pdf' | 'docx',
    approver: { name: string; step: EducationPlanStep | null } | null,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const sections = sectionsOf(plan.sections);
    const content = contentOf(plan.content);
    const date = plan.approved_at ?? this.clock.now();
    const day = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    const unit = await database
      .selectFrom('org_units')
      .select('name')
      .where('id', '=', plan.org_unit_id)
      .executeTakeFirst();
    const school = await this.schoolName(database);
    const blocks: DocumentBlock[] = [
      {
        kind: 'header',
        left: [school.toUpperCase(), unit && unit.name !== school ? unit.name : ''],
        right: [
          'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
          'Độc lập - Tự do - Hạnh phúc',
          `..., ngày ${day.day} tháng ${day.month} năm ${day.year}`,
        ],
      },
      {
        kind: 'title',
        text: plan.title.toUpperCase(),
        subtitle: plan.period_label ?? undefined,
      },
    ];
    for (const section of sections) {
      blocks.push({ kind: 'heading', text: section.title });
      const value = content[section.key];
      if (section.kind === 'table') {
        const columns = section.columns ?? [];
        const rows = Array.isArray(value) ? value : [];
        blocks.push({
          kind: 'table',
          header: ['TT', ...columns.map((column) => column.label)],
          rows: rows.map((row, index) => [String(index + 1), ...columns.map((_column, cell) => row[cell] ?? '')]),
          widths: [1, ...columns.map(() => 4)],
        });
      } else {
        for (const paragraph of (typeof value === 'string' ? value : '').split('\n')) {
          blocks.push({ kind: 'paragraph', text: paragraph, align: 'justify' });
        }
      }
    }
    const lastStep =
      approver?.step ?? (plan.approval_steps.length > 0 ? plan.approval_steps[plan.approval_steps.length - 1] : null);
    const approvedName = approver?.name ?? plan.approved_by_name ?? undefined;
    blocks.push({
      kind: 'signatures',
      left: { title: 'NGƯỜI LẬP', name: plan.owner_name },
      right: {
        title: lastStep ? `${EDUCATION_PLAN_STEP_LABELS[lastStep].toUpperCase()} DUYỆT` : 'DUYỆT',
        name: plan.status === 'approved' || approver ? approvedName : undefined,
      },
    });
    const title = plan.title;
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title }), contentType: DOCX_TYPE }
      : { buffer: await buildDocumentPdf(blocks, { title }), contentType: PDF_TYPE };
  }

  async exportDocument(currentUser: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    const file = await this.render(context.database, plan, format, null);
    const stem = plan.title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 60);
    return { ...file, fileName: `ke-hoach-${stem || plan.id.slice(0, 8)}.${format}` };
  }

  async signedFile(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    if (!plan.signed_file_id) {
      throw notFoundError('Kế hoạch chưa có bản đã kí', 'file');
    }
    const file = await context.database
      .selectFrom('files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', plan.signed_file_id)
      .executeTakeFirstOrThrow();
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // ---- Nối Quản lý công việc ----

  // Kế hoạch đã duyệt thành kế hoạch công việc nháp của đơn vị: dòng bảng có ô ngày thành đầu việc, người phụ trách là người
  // lập; người có quyền quản lý kế hoạch công việc kích hoạt để giao việc (P09-03)
  async createWorkPlan(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const plan = await this.visiblePlan(context, currentUser, id);
    if (plan.status !== 'approved') {
      throw educationPlanRule('Chỉ tạo kế hoạch công việc từ kế hoạch đã duyệt');
    }
    if (plan.work_plan_id) {
      throw educationPlanRule('Kế hoạch này đã có kế hoạch công việc');
    }
    if (!plan.owner_staff_id) {
      throw educationPlanRule('Người lập không có hồ sơ nhân sự để phụ trách đầu việc');
    }
    const items: PlanItemInput[] = [];
    const content = contentOf(plan.content);
    for (const section of sectionsOf(plan.sections)) {
      const columns = section.columns ?? [];
      const dateIndex = columns.findIndex((column) => column.type === 'date');
      const rows = content[section.key];
      if (section.kind !== 'table' || dateIndex < 0 || !Array.isArray(rows)) {
        continue;
      }
      for (const row of rows) {
        const due = row[dateIndex];
        const text = row.filter((cell, index) => index !== dateIndex && cell).join(' – ');
        if (due && text) {
          items.push({ content: text.slice(0, 500), ownerStaffId: plan.owner_staff_id, dueDate: due });
        }
      }
    }
    if (items.length > MAXIMUM_WORK_ITEMS) {
      throw educationPlanRule(`Kế hoạch công việc tối đa ${MAXIMUM_WORK_ITEMS} đầu việc`);
    }
    const period = await this.workPeriod(plan);
    const objectives = sectionsOf(plan.sections)
      .filter((section) => section.kind === 'text')
      .map((section) => content[section.key])
      .find((value): value is string => typeof value === 'string' && value !== '');
    const created = await this.workPlans.create(
      currentUser,
      {
        orgUnitId: plan.org_unit_id,
        periodType: period.type,
        periodValue: period.value,
        title: plan.title.slice(0, 200),
        objectives: objectives ? objectives.slice(0, 2000) : null,
        items,
      },
      origin,
    );
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('education_plans')
        .set({ work_plan_id: created.id, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'work_plan', null, `${items.length} đầu việc`, currentUser);
    });
    return { work_plan_id: created.id, items: items.length };
  }

  private async workPeriod(plan: PlanRow): Promise<{ type: WorkPeriodType; value: string }> {
    const current = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['start_date', 'end_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const yearValue = `${String(year.start_date).slice(0, 4)}-${String(year.end_date).slice(0, 4)}`;
    const reference = plan.period_start ?? this.today();
    if (plan.period === 'month' || plan.period === 'week') {
      return { type: 'month', value: reference.slice(0, 7) };
    }
    if (plan.period === 'semester') {
      const term = reference.slice(0, 4) === yearValue.slice(0, 4) ? 'HK1' : 'HK2';
      return { type: 'term', value: `${term} ${yearValue}` };
    }
    return { type: 'year', value: yearValue };
  }

  // ---- Sao chép từ năm trước ----

  private async previousYear() {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return undefined;
    }
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('start_date')
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    return this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.name', 'academic_year_databases.database_name'])
      .where('academic_years.start_date', '<', year.start_date)
      .orderBy('academic_years.start_date', 'desc')
      .executeTakeFirst();
  }

  // Kế hoạch năm trước được sao chép: của mình, của tổ mình (tổ trưởng), kế hoạch của trường (người quản lý)
  private previousCondition(context: PlanContext, currentUser: CurrentUser) {
    return (eb: ExpressionBuilder<SchoolYearDatabase, 'education_plans'>) => {
      const conditions = [eb('education_plans.owner_user_id', '=', currentUser.id)];
      if (context.staff?.department_id && currentUser.hasPermission(REVIEW)) {
        conditions.push(
          eb.and([
            eb('education_plans.scope', '=', 'group'),
            eb('education_plans.department_id', '=', context.staff.department_id),
          ]),
        );
      }
      if (hasScope(context.manageScope)) {
        conditions.push(eb('education_plans.scope', '=', 'school'));
      }
      return eb.or(conditions);
    };
  }

  async previousPlans(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const previous = await this.previousYear();
    if (!previous) {
      return { year_name: null, plans: [] };
    }
    const database = this.databases.schoolYear<SchoolYearDatabase>(previous.database_name);
    const plans = await database
      .selectFrom('education_plans')
      .select([
        'id',
        'template_id',
        'template_name',
        'scope',
        'period',
        'title',
        'period_label',
        'owner_name',
        'status',
        'approved_at',
      ])
      .where(this.previousCondition(context, currentUser))
      .orderBy('template_name')
      .orderBy('title')
      .limit(MAXIMUM_LIST)
      .execute();
    return {
      year_name: previous.name,
      plans: plans.map((plan) => ({ ...plan, status_label: EDUCATION_PLAN_STATUS_LABELS[plan.status] })),
    };
  }

  // Sao chép: mẫu năm nay cùng mã định danh (thư viện mẫu chuyển sang năm mới giữ mã) thì dùng mục và bước duyệt của mẫu năm
  // nay, nội dung giữ các mục trùng mã; không còn mẫu thì giữ mục của bản năm trước. Bản năm trước lưu kèm để so sánh
  async copyFromPrevious(currentUser: CurrentUser, input: CopyInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const previous = await this.previousYear();
    if (!previous) {
      throw educationPlanRule('Chưa có năm học trước để sao chép');
    }
    const source = await this.databases
      .schoolYear<SchoolYearDatabase>(previous.database_name)
      .selectFrom('education_plans')
      .selectAll()
      .where('id', '=', input.source_id)
      .where(this.previousCondition(context, currentUser))
      .executeTakeFirst();
    if (!source) {
      throw notFoundError('Không tìm thấy kế hoạch năm trước trong phạm vi của bạn', 'education_plan');
    }
    const template = source.template_id
      ? await context.database
          .selectFrom('education_plan_templates')
          .selectAll()
          .where('id', '=', source.template_id)
          .where('status', '=', 'active')
          .executeTakeFirst()
      : undefined;
    const sections = template ? sectionsOf(template.sections) : sectionsOf(source.sections);
    const owner = await this.resolveOwnership(context, currentUser, source.scope, {
      org_unit_id: null,
      department_id: source.scope === 'group' ? source.department_id : null,
      work_group_id: source.scope === 'group' ? source.work_group_id : null,
      class_id: input.class_id,
    });
    const created = await context.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('education_plans')
        .values({
          template_id: template?.id ?? null,
          template_name: template?.name ?? source.template_name,
          template_revision: template?.revision ?? source.template_revision,
          scope: source.scope,
          period: source.period,
          school_level: template?.school_level ?? source.school_level,
          title: input.title ?? source.title,
          period_label: input.period_label,
          period_start: input.period_start,
          period_end: input.period_end,
          ...owner,
          owner_user_id: currentUser.id,
          owner_staff_id: context.staff?.id ?? null,
          owner_name: currentUser.description.full_name,
          sections: JSON.stringify(sections),
          content: JSON.stringify(mapContent(sections, contentOf(source.content))),
          approval_steps: template?.approval_steps ?? source.approval_steps,
          requires_signing: template?.requires_signing ?? source.requires_signing,
          source_plan_id: source.id,
          source_year_name: previous.name,
          source_sections: JSON.stringify(sectionsOf(source.sections)),
          source_content: JSON.stringify(contentOf(source.content)),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.event(transaction, row.id, 'copy', null, `Từ năm học ${previous.name}: ${source.title}`, currentUser);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'education_plans',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { title: row.title, source_plan_id: source.id, source_year_name: previous.name },
      });
      return row;
    });
    return this.view(currentUser, created.id);
  }

  // ---- Bảng tiến độ duyệt ----

  async progress(currentUser: CurrentUser, templateId: string | null) {
    const context = await this.context(currentUser);
    const scopes = [context.manageScope, context.approveScope, context.finalizeScope];
    if (!scopes.some(hasScope)) {
      throw forbidden('Chỉ Ban Giám hiệu xem tiến độ duyệt kế hoạch');
    }
    let query = context.database
      .selectFrom('education_plans')
      .leftJoin('departments', 'departments.id', 'education_plans.department_id')
      .select([
        'education_plans.id',
        'education_plans.template_id',
        'education_plans.template_name',
        'education_plans.title',
        'education_plans.owner_name',
        'education_plans.status',
        'education_plans.current_step',
        'education_plans.submitted_at',
        'education_plans.updated_at',
        'education_plans.org_unit_id',
        'departments.name as department_name',
      ]);
    if (!scopes.some((scope) => scope.wholeSchool)) {
      query = query.where(
        'education_plans.org_unit_id',
        'in',
        scopes.flatMap((scope) => scope.orgUnitIds),
      );
    }
    if (templateId) {
      query = query.where('education_plans.template_id', '=', templateId);
    }
    const plans = await query.execute();
    const empty = () => ({ draft: 0, pending: 0, approved: 0, returned: 0, total: 0 });
    const count = (
      map: Map<string, ReturnType<typeof empty> & { name: string }>,
      key: string,
      status: EducationPlanStatus,
    ) => {
      const row = map.get(key) ?? { name: key, ...empty() };
      row[status] += 1;
      row.total += 1;
      map.set(key, row);
    };
    const byTemplate = new Map<string, ReturnType<typeof empty> & { name: string }>();
    const byDepartment = new Map<string, ReturnType<typeof empty> & { name: string }>();
    const totals = empty();
    const byStep: Record<EducationPlanStep, number> = { leader: 0, vice_principal: 0, principal: 0 };
    for (const plan of plans) {
      count(byTemplate, plan.template_name, plan.status);
      count(byDepartment, plan.department_name ?? 'Không thuộc tổ', plan.status);
      totals[plan.status] += 1;
      totals.total += 1;
      if (plan.status === 'pending' && plan.current_step) {
        byStep[plan.current_step] += 1;
      }
    }
    const now = this.clock.now().getTime();
    const sort = (map: Map<string, ReturnType<typeof empty> & { name: string }>) =>
      [...map.values()]
        .map((row) => ({
          ...row,
          approved_percent: row.total === 0 ? 0 : Math.round((row.approved / row.total) * 1000) / 10,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
    return {
      totals: {
        ...totals,
        approved_percent: totals.total === 0 ? 0 : Math.round((totals.approved / totals.total) * 1000) / 10,
      },
      by_step: byStep,
      by_template: sort(byTemplate),
      by_department: sort(byDepartment),
      waiting: plans
        .filter((plan) => plan.status === 'pending')
        .map((plan) => ({
          id: plan.id,
          title: plan.title,
          owner_name: plan.owner_name,
          template_name: plan.template_name,
          department_name: plan.department_name,
          current_step: plan.current_step,
          step_label: plan.current_step ? EDUCATION_PLAN_STEP_LABELS[plan.current_step] : '',
          submitted_at: plan.submitted_at,
          waiting_days: plan.submitted_at ? Math.floor((now - plan.submitted_at.getTime()) / 86_400_000) : 0,
        }))
        .sort((left, right) => right.waiting_days - left.waiting_days)
        .slice(0, 200),
    };
  }

  async progressFile(currentUser: CurrentUser, templateId: string | null, format: TableFileFormat) {
    const data = await this.progress(currentUser, templateId);
    const columns = [
      { key: 'name', label: 'Tên', width: 40 },
      { key: 'draft', label: 'Đang soạn', width: 12 },
      { key: 'pending', label: 'Chờ duyệt', width: 12 },
      { key: 'returned', label: 'Bị trả lại', width: 12 },
      { key: 'approved', label: 'Đã duyệt', width: 12 },
      { key: 'total', label: 'Tổng', width: 10 },
      { key: 'approved_percent', label: 'Tỉ lệ đã duyệt (%)', width: 16 },
    ];
    const createdAt = this.clock.now();
    const buffer = await buildTableFile(
      format,
      [
        { title: 'Theo mẫu kế hoạch', columns, rows: data.by_template },
        { title: 'Theo tổ chuyên môn', columns, rows: data.by_department },
        {
          title: 'Kế hoạch đang chờ duyệt',
          columns: [
            { key: 'title', label: 'Kế hoạch', width: 40 },
            { key: 'owner_name', label: 'Người lập', width: 24 },
            { key: 'template_name', label: 'Mẫu', width: 30 },
            { key: 'step_label', label: 'Chờ bước', width: 18 },
            { key: 'waiting_days', label: 'Số ngày chờ', width: 12 },
          ],
          rows: data.waiting,
        },
      ],
      createdAt,
    );
    return { buffer, contentType: CONTENT_TYPES[format], fileName: `tien-do-duyet-ke-hoach.${format}` };
  }

  // ---- Nguồn cho Việc của tôi ----

  async pendingWork(currentUser: CurrentUser) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { review: [], returned: [] };
    }
    const context = await this.context(currentUser, current.database);
    const review = await context.database
      .selectFrom('education_plans')
      .select(['id', 'title', 'owner_name', 'status', 'current_step', 'updated_at', 'period_start'])
      .where(this.pendingCondition(context, currentUser))
      .orderBy('updated_at')
      .limit(100)
      .execute();
    const returned = await context.database
      .selectFrom('education_plans')
      .select(['id', 'title', 'return_note', 'updated_at'])
      .where('owner_user_id', '=', currentUser.id)
      .where('status', '=', 'returned')
      .limit(100)
      .execute();
    return { review: review.map((row) => ({ ...row, status_label: this.statusLabel(row) })), returned };
  }
}
