import { Injectable } from '@nestjs/common';
import type { EmulationNominationStatus, SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  consecutiveYearsBefore,
  EMULATION_DEFAULT_TITLES,
  EMULATION_NOMINATION_STATUS_LABELS,
  EMULATION_RULE_CODE,
  emulationScore,
  PERMISSION_CODES,
  type EmulationCheck,
  type EmulationCriterion,
  type KpiRuleConfig,
} from '@school-management/shared';
import { sql, type Kysely, type Selectable, type Transaction } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { FileStorage } from '../files/file-storage.js';
import { buildDocumentPdf, buildDocx, DOCX_TYPE, PDF_TYPE } from '../kpi/kpi-documents.js';
import { launchBlocks, nominationBlocks } from './emulation-documents.js';
import type {
  CampaignInput,
  NominationUpdate,
  RegistrationInput,
  SubjectInput,
  TitleInput,
} from './emulation-fields.js';

// Thi đua, khen thưởng cán bộ, giáo viên (DT-18 phần 22d, YCTD-148): danh mục danh hiệu và hình thức khen thưởng (cấu hình của
// trường), đợt thi đua và phát động, đăng ký thi đua đầu năm của cá nhân, tập thể, hồ sơ đề nghị lấy kết quả KPI (18d) làm đầu
// vào và minh chứng từ kho hồ sơ chuyên môn (18e). Điều kiện của danh hiệu (mức KPI, sáng kiến, điểm tiêu chí, số năm liên tục
// đạt danh hiệu tiền đề đọc từ sổ khen thưởng mọi năm học, tỉ lệ tối đa) chỉ là thông tin cho hội đồng: không chặn nộp hồ sơ,
// hội đồng bỏ phiếu quyết định. Hội đồng, phiên họp, phúc khảo, khiếu nại, quyết định, sổ theo dõi ở emulation-council.ts. Các
// lựa chọn chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
export type TitleRow = Selectable<SchoolYearDatabase['emulation_titles']>;
export type CampaignRow = Selectable<SchoolYearDatabase['emulation_campaigns']>;
export type NominationRow = Selectable<SchoolYearDatabase['emulation_nominations']>;

const USE = PERMISSION_CODES.emulationUse;
const MANAGE = PERMISSION_CODES.emulationManage;
const DECIDE = PERMISSION_CODES.emulationDecide;
export const EMULATION_PERMISSIONS = [USE, MANAGE, DECIDE];
// Tổ trưởng chuyên môn lập đăng ký, hồ sơ cho tổ của mình
const LEADER_ROLE = 'VT-17';
const EDITABLE: EmulationNominationStatus[] = ['draft', 'returned'];

export function emulationRule(message: string): ApplicationError {
  return ruleViolationError(EMULATION_RULE_CODE, message);
}

export function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

export const criteriaOf = (value: unknown) => (Array.isArray(value) ? value : []) as EmulationCriterion[];
export const scoresOf = (value: unknown) =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, number>;
export const checksOf = (value: unknown) => (Array.isArray(value) ? value : []) as EmulationCheck[];

export interface EmulationContext {
  database: Kysely<SchoolYearDatabase>;
  academicYearId: string;
  yearName: string;
  yearStart: number;
  staff: { id: string; org_unit_id: string; department_id: string | null; full_name: string } | null;
  isLeader: boolean;
  canManage: boolean;
  canDecide: boolean;
}

export interface Subject {
  target: 'individual' | 'collective';
  staff_id: string | null;
  department_id: string | null;
}

@Injectable()
export class EmulationService {
  constructor(
    readonly currentSchoolYear: CurrentSchoolYearResolver,
    readonly databases: Databases,
    readonly fileStorage: FileStorage,
    readonly clock: Clock,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async context(currentUser: CurrentUser, database?: Kysely<SchoolYearDatabase>): Promise<EmulationContext> {
    const current = await this.currentSchoolYear.require();
    const db = database ?? current.database;
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select(['name', 'start_date'])
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const staff =
      (await db
        .selectFrom('staff')
        .select(['id', 'org_unit_id', 'department_id', 'full_name'])
        .where('user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst()) ?? null;
    return {
      database: db,
      academicYearId: current.academicYearId,
      yearName: year.name,
      yearStart: Number(String(year.start_date).slice(0, 4)),
      staff,
      isLeader: currentUser.description.assignments.some((assignment) => assignment.role_code === LEADER_ROLE),
      canManage: currentUser.hasPermission(MANAGE),
      canDecide: currentUser.hasPermission(DECIDE),
    };
  }

  assertManage(context: EmulationContext): void {
    if (!context.canManage) {
      throw forbidden('Chỉ người quản lý thi đua, khen thưởng (Ban Giám hiệu, thường trực hội đồng) được thao tác');
    }
  }

  async schoolName(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('name')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirst();
    return root?.name ?? '';
  }

  async rootUnit(database: Executor): Promise<string> {
    const root = await database
      .selectFrom('org_units')
      .select('id')
      .where('parent_id', 'is', null)
      .orderBy('created_at')
      .executeTakeFirstOrThrow();
    return root.id;
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
    const elevated = context.canManage || context.canDecide;
    return {
      year_name: context.yearName,
      has_staff: context.staff !== null,
      my_staff: context.staff ? { id: context.staff.id, full_name: context.staff.full_name } : null,
      my_department: department ?? null,
      is_leader: context.isLeader && department !== undefined,
      can_use: currentUser.hasPermission(USE),
      can_manage: context.canManage,
      can_decide: context.canDecide,
      can_draft_outgoing: currentUser.hasPermission(PERMISSION_CODES.outgoingDocumentDraft),
      // Người quản lý lập hồ sơ thay, chọn thành viên hội đồng: nhân sự đang làm việc (có tài khoản thì chọn được vào hội đồng)
      staff: elevated
        ? await database
            .selectFrom('staff')
            .leftJoin('departments', 'departments.id', 'staff.department_id')
            .select([
              'staff.id',
              'staff.code',
              'staff.full_name',
              'staff.user_id',
              'staff.department_id',
              'departments.name as department_name',
            ])
            .where('staff.status', '=', 'active')
            .orderBy('staff.full_name')
            .limit(2000)
            .execute()
        : [],
      departments: await database
        .selectFrom('departments')
        .select(['id', 'name'])
        .where('status', '=', 'active')
        .orderBy('name')
        .execute(),
      kpi_periods: await database
        .selectFrom('kpi_periods')
        .select(['id', 'code', 'name', 'period_type', 'status'])
        .orderBy('start_date', 'desc')
        .limit(100)
        .execute(),
    };
  }

  // ---- Danh mục danh hiệu, hình thức khen thưởng ----

  async titles(currentUser: CurrentUser, includeInactive: boolean) {
    const { database } = await this.context(currentUser);
    let query = database
      .selectFrom('emulation_titles as titles')
      .selectAll('titles')
      .select((eb) =>
        eb
          .selectFrom('emulation_nominations')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('emulation_nominations.title_id', '=', 'titles.id')
          .as('nomination_count'),
      )
      .orderBy('titles.sort_order')
      .orderBy('titles.name');
    if (!includeInactive) {
      query = query.where('titles.status', '=', 'active');
    }
    return (await query.execute()).map((row) => ({ ...row, nomination_count: Number(row.nomination_count ?? 0) }));
  }

  async title(database: Executor, id: string): Promise<TitleRow> {
    const title = await database.selectFrom('emulation_titles').selectAll().where('id', '=', id).executeTakeFirst();
    if (!title) {
      throw notFoundError('Không tìm thấy danh hiệu, hình thức khen thưởng', 'emulation_title');
    }
    return title;
  }

  private async checkTitle(database: Executor, input: TitleInput, id: string | null): Promise<void> {
    const errors: Array<{ field: string; message: string }> = [];
    const rows = await database.selectFrom('emulation_titles').select(['id', 'code', 'target']).execute();
    if (rows.some((row) => row.code === input.code && row.id !== id)) {
      errors.push({ field: 'code', message: 'Mã danh hiệu đã có' });
    }
    for (const [field, code] of [
      ['prerequisite_code', input.prerequisite_code],
      ['quota_base_code', input.quota_base_code],
    ] as const) {
      if (code && code === input.code) {
        errors.push({ field, message: 'Không chọn chính danh hiệu này' });
      } else if (code && !rows.some((row) => row.code === code)) {
        errors.push({ field, message: 'Không có danh hiệu có mã này trong danh mục' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  private titleValues(input: TitleInput) {
    return {
      code: input.code,
      name: input.name,
      description: input.description,
      kind: input.kind,
      target: input.target,
      decision_level: input.decision_level,
      school_level: input.school_level,
      min_kpi_rank: input.min_kpi_rank,
      requires_initiative: input.requires_initiative,
      prerequisite_code: input.prerequisite_code,
      consecutive_years: input.consecutive_years,
      quota_percent: input.quota_percent,
      quota_base_code: input.quota_base_code,
      vote_threshold_percent: input.vote_threshold_percent,
      min_score: input.min_score,
      criteria: JSON.stringify(input.criteria),
      sort_order: input.sort_order,
      status: input.status,
    };
  }

  async createTitle(currentUser: CurrentUser, input: TitleInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.checkTitle(transaction, input, null);
      const created = await transaction
        .insertInto('emulation_titles')
        .values({ ...this.titleValues(input), created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_titles',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Sửa tiêu chí, điều kiện thì tăng số hiệu; hồ sơ đã lập giữ tiêu chí đã chụp lại lúc tạo. Mã đã dùng ở hồ sơ thì không đổi
  // để sổ theo dõi nhiều năm vẫn đối chiếu được
  async updateTitle(currentUser: CurrentUser, id: string, input: TitleInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.title(transaction, id);
      await this.checkTitle(transaction, input, id);
      const used = await transaction
        .selectFrom('emulation_nominations')
        .select('id')
        .where('title_id', '=', id)
        .executeTakeFirst();
      if (used && (before.code !== input.code || before.target !== input.target)) {
        throw emulationRule('Danh hiệu đã có hồ sơ đề nghị; không đổi mã hay đối tượng (thêm danh hiệu mới nếu cần)');
      }
      const changed =
        JSON.stringify(before.criteria) !== JSON.stringify(input.criteria) ||
        Number(before.vote_threshold_percent) !== input.vote_threshold_percent ||
        before.min_kpi_rank !== input.min_kpi_rank ||
        before.consecutive_years !== input.consecutive_years ||
        before.prerequisite_code !== input.prerequisite_code;
      const updated = await transaction
        .updateTable('emulation_titles')
        .set({
          ...this.titleValues(input),
          revision: changed ? before.revision + 1 : before.revision,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_titles',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async deleteTitle(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.title(transaction, id);
      const used =
        (await transaction
          .selectFrom('emulation_nominations')
          .select('id')
          .where('title_id', '=', id)
          .executeTakeFirst()) ??
        (await transaction
          .selectFrom('emulation_registrations')
          .select('id')
          .where('title_id', '=', id)
          .executeTakeFirst()) ??
        (await transaction
          .selectFrom('emulation_campaigns')
          .select('id')
          .where(sql<boolean>`${id}::uuid = any(title_ids)`)
          .executeTakeFirst());
      if (used) {
        throw emulationRule('Danh hiệu đã dùng ở đợt thi đua, đăng ký hoặc hồ sơ; chuyển sang ngừng dùng thay vì xóa');
      }
      await transaction.deleteFrom('emulation_titles').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_titles',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  // Nạp danh mục mặc định; mã đã có thì bỏ qua
  async loadDefaults(currentUser: CurrentUser, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    let created = 0;
    let skipped = 0;
    await context.database.transaction().execute(async (transaction) => {
      const existing = new Set(
        (await transaction.selectFrom('emulation_titles').select('code').execute()).map((row) => row.code),
      );
      for (const [index, seed] of EMULATION_DEFAULT_TITLES.entries()) {
        if (existing.has(seed.code)) {
          skipped += 1;
          continue;
        }
        const row = await transaction
          .insertInto('emulation_titles')
          .values({
            ...seed,
            school_level: null,
            criteria: JSON.stringify(seed.criteria),
            sort_order: (index + 1) * 10,
            created_by: currentUser.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'emulation_titles',
          entityId: row.id,
          action: 'create',
          before: null,
          after: { code: seed.code, name: seed.name },
        });
        created += 1;
      }
    });
    return { created, skipped };
  }

  // ---- Đợt thi đua ----

  async campaigns(currentUser: CurrentUser) {
    const { database } = await this.context(currentUser);
    const rows = await database
      .selectFrom('emulation_campaigns as campaigns')
      .leftJoin('kpi_periods', 'kpi_periods.id', 'campaigns.kpi_period_id')
      .selectAll('campaigns')
      .select('kpi_periods.name as kpi_period_name')
      .select((eb) => [
        eb
          .selectFrom('emulation_registrations')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('emulation_registrations.campaign_id', '=', 'campaigns.id')
          .as('registration_count'),
        eb
          .selectFrom('emulation_nominations')
          .select((count) => count.fn.countAll<string>().as('count'))
          .whereRef('emulation_nominations.campaign_id', '=', 'campaigns.id')
          .where('emulation_nominations.status', '<>', 'draft')
          .as('nomination_count'),
      ])
      .orderBy('campaigns.created_at', 'desc')
      .execute();
    const titles = await database.selectFrom('emulation_titles').select(['id', 'code', 'name', 'target']).execute();
    return rows.map((row) => ({
      ...row,
      registration_count: Number(row.registration_count ?? 0),
      nomination_count: Number(row.nomination_count ?? 0),
      titles: row.title_ids.flatMap((id) => titles.filter((title) => title.id === id)),
    }));
  }

  async campaign(database: Executor, id: string): Promise<CampaignRow> {
    const campaign = await database
      .selectFrom('emulation_campaigns')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!campaign) {
      throw notFoundError('Không tìm thấy đợt thi đua', 'emulation_campaign');
    }
    return campaign;
  }

  private async checkCampaign(database: Executor, input: CampaignInput, id: string | null): Promise<void> {
    const errors: Array<{ field: string; message: string }> = [];
    const duplicate = await database
      .selectFrom('emulation_campaigns')
      .select('id')
      .where('code', '=', input.code)
      .executeTakeFirst();
    if (duplicate && duplicate.id !== id) {
      errors.push({ field: 'code', message: 'Mã đợt đã có' });
    }
    const titles = await database
      .selectFrom('emulation_titles')
      .select(['id', 'status'])
      .where('id', 'in', input.title_ids)
      .execute();
    if (titles.length !== input.title_ids.length || titles.some((title) => title.status !== 'active')) {
      errors.push({ field: 'title_ids', message: 'Chọn danh hiệu đang dùng trong danh mục' });
    }
    if (input.kpi_period_id) {
      const period = await database
        .selectFrom('kpi_periods')
        .select('id')
        .where('id', '=', input.kpi_period_id)
        .executeTakeFirst();
      if (!period) {
        errors.push({ field: 'kpi_period_id', message: 'Không có kỳ đánh giá KPI này' });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
  }

  async createCampaign(currentUser: CurrentUser, input: CampaignInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      await this.checkCampaign(transaction, input, null);
      const created = await transaction
        .insertInto('emulation_campaigns')
        .values({ ...input, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_campaigns',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  // Đã phát động vẫn sửa được hạn, nội dung, thêm danh hiệu; bỏ danh hiệu đã có đăng ký, hồ sơ thì bị chặn
  async updateCampaign(currentUser: CurrentUser, id: string, input: CampaignInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    return context.database.transaction().execute(async (transaction) => {
      const before = await this.campaign(transaction, id);
      if (before.status === 'closed') {
        throw emulationRule('Đợt thi đua đã kết thúc, không sửa được');
      }
      await this.checkCampaign(transaction, input, id);
      const removed = before.title_ids.filter((titleId) => !input.title_ids.includes(titleId));
      if (removed.length > 0) {
        const used =
          (await transaction
            .selectFrom('emulation_registrations')
            .select('id')
            .where('campaign_id', '=', id)
            .where('title_id', 'in', removed)
            .executeTakeFirst()) ??
          (await transaction
            .selectFrom('emulation_nominations')
            .select('id')
            .where('campaign_id', '=', id)
            .where('title_id', 'in', removed)
            .executeTakeFirst());
        if (used) {
          throw emulationRule('Không bỏ được danh hiệu đã có đăng ký hoặc hồ sơ đề nghị trong đợt');
        }
      }
      const updated = await transaction
        .updateTable('emulation_campaigns')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_campaigns',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async deleteCampaign(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    await context.database.transaction().execute(async (transaction) => {
      const before = await this.campaign(transaction, id);
      if (before.status !== 'draft') {
        throw emulationRule('Chỉ xóa đợt thi đua chưa phát động');
      }
      await transaction.deleteFrom('emulation_campaigns').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'emulation_campaigns',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  // Phát động: báo cho mọi cán bộ có tài khoản ở Thông báo
  async launch(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const campaign = await this.campaign(context.database, id);
    if (campaign.status !== 'draft') {
      throw emulationRule('Đợt thi đua đã phát động');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_campaigns')
        .set({
          status: 'launched',
          launched_at: this.clock.now(),
          launched_by_name: currentUser.description.full_name,
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .where('status', '=', 'draft')
        .execute();
      const users = await transaction
        .selectFrom('staff')
        .select('user_id')
        .where('status', '=', 'active')
        .where('user_id', 'is not', null)
        .limit(2000)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: null,
        templateCode: 'emulation',
        title: 'Phát động thi đua',
        body: [campaign.name, campaign.registration_deadline ? `hạn đăng ký ${campaign.registration_deadline}` : null]
          .filter(Boolean)
          .join(', '),
        targetType: 'emulation_campaign',
        targetId: id,
        recipients: users.flatMap((row) => (row.user_id ? [{ userId: row.user_id, channel: 'in_app' as const }] : [])),
      });
    });
    return this.campaign(context.database, id);
  }

  async closeCampaign(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const campaign = await this.campaign(context.database, id);
    if (campaign.status !== 'published') {
      throw emulationRule('Chỉ kết thúc đợt đã công bố kết quả bình xét');
    }
    const pending = await context.database
      .selectFrom('emulation_appeals')
      .select('id')
      .where('campaign_id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (pending) {
      throw emulationRule('Còn phúc khảo, khiếu nại chưa giải quyết');
    }
    await context.database
      .updateTable('emulation_campaigns')
      .set({ status: 'closed', closed_at: this.clock.now(), updated_at: this.clock.now() })
      .where('id', '=', id)
      .execute();
    return this.campaign(context.database, id);
  }

  async launchDocument(currentUser: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const context = await this.context(currentUser);
    const campaign = await this.campaign(context.database, id);
    const titles = await context.database
      .selectFrom('emulation_titles')
      .select(['id', 'name', 'target', 'description'])
      .where('id', 'in', campaign.title_ids.length > 0 ? campaign.title_ids : ['00000000-0000-0000-0000-000000000000'])
      .orderBy('sort_order')
      .execute();
    const blocks = launchBlocks({
      school: await this.schoolName(context.database),
      name: campaign.name,
      description: campaign.description,
      year_name: context.yearName,
      registration_deadline: campaign.registration_deadline,
      nomination_deadline: campaign.nomination_deadline,
      titles,
      date: campaign.launched_at ?? this.clock.now(),
      signer: '',
    });
    const title = `Phát động thi đua ${campaign.code}`;
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title }), contentType: DOCX_TYPE, fileName: `phat-dong-${campaign.code}.docx` }
      : {
          buffer: await buildDocumentPdf(blocks, { title }),
          contentType: PDF_TYPE,
          fileName: `phat-dong-${campaign.code}.pdf`,
        };
  }

  // ---- Đối tượng: cá nhân (nhân sự) hoặc tập thể (tổ) ----

  // Cá nhân: chính mình, người quản lý chọn bất kì nhân sự đang làm việc. Tập thể: tổ trưởng của tổ, người quản lý mọi tổ
  async resolveSubject(context: EmulationContext, input: SubjectInput) {
    const database = context.database;
    if (input.target === 'individual') {
      const staffId = input.staff_id ?? context.staff?.id ?? null;
      if (!staffId) {
        throw emulationRule('Tài khoản chưa gắn hồ sơ nhân sự đang làm việc');
      }
      if (staffId !== context.staff?.id && !context.canManage) {
        throw forbidden('Chỉ đăng ký, lập hồ sơ cho chính mình');
      }
      const staff = await database
        .selectFrom('staff')
        .select(['id', 'full_name', 'org_unit_id', 'user_id'])
        .where('id', '=', staffId)
        .where('status', '=', 'active')
        .executeTakeFirst();
      if (!staff) {
        throw validationError([{ field: 'staff_id', message: 'Không có nhân sự đang làm việc này' }]);
      }
      return { staff_id: staff.id, department_id: null, name: staff.full_name, org_unit_id: staff.org_unit_id };
    }
    const department = await database
      .selectFrom('departments')
      .select(['id', 'name', 'org_unit_id'])
      .where('id', '=', input.department_id ?? '')
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!department) {
      throw validationError([{ field: 'department_id', message: 'Không có tổ, tập thể này' }]);
    }
    if (!context.canManage && !(context.isLeader && context.staff?.department_id === department.id)) {
      throw forbidden('Chỉ tổ trưởng của tổ đăng ký, lập hồ sơ cho tập thể');
    }
    return { staff_id: null, department_id: department.id, name: department.name, org_unit_id: department.org_unit_id };
  }

  async campaignTitle(context: EmulationContext, campaignId: string, titleId: string, target: string) {
    const campaign = await this.campaign(context.database, campaignId);
    if (campaign.status !== 'launched') {
      throw emulationRule('Đợt thi đua chưa phát động hoặc đã công bố kết quả');
    }
    if (!campaign.title_ids.includes(titleId)) {
      throw validationError([{ field: 'title_id', message: 'Danh hiệu không thuộc đợt thi đua này' }]);
    }
    const title = await this.title(context.database, titleId);
    if (title.target !== target) {
      throw validationError([{ field: 'target', message: 'Danh hiệu dành cho đối tượng khác' }]);
    }
    return { campaign, title };
  }

  // ---- Đăng ký thi đua ----

  async registrations(currentUser: CurrentUser, campaignId: string | null, view: 'mine' | 'all') {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('emulation_registrations as registrations')
      .innerJoin('emulation_titles as titles', 'titles.id', 'registrations.title_id')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'registrations.campaign_id')
      .selectAll('registrations')
      .select(['titles.name as title_name', 'campaigns.name as campaign_name'])
      .orderBy('registrations.created_at', 'desc');
    if (campaignId) {
      query = query.where('registrations.campaign_id', '=', campaignId);
    }
    if (view === 'all' && (context.canManage || context.canDecide)) {
      return query.limit(2000).execute();
    }
    const staffId = context.staff?.id ?? null;
    const departmentId = context.isLeader ? (context.staff?.department_id ?? null) : null;
    return query
      .where((eb) =>
        eb.or([
          eb('registrations.registered_by', '=', currentUser.id),
          ...(staffId ? [eb('registrations.staff_id', '=', staffId)] : []),
          ...(departmentId ? [eb('registrations.department_id', '=', departmentId)] : []),
        ]),
      )
      .limit(500)
      .execute();
  }

  async register(currentUser: CurrentUser, input: RegistrationInput) {
    const context = await this.context(currentUser);
    const { campaign, title } = await this.campaignTitle(context, input.campaign_id, input.title_id, input.target);
    if (campaign.registration_deadline && campaign.registration_deadline < this.today() && !context.canManage) {
      throw emulationRule(`Đã quá hạn đăng ký thi đua (${campaign.registration_deadline})`);
    }
    const subject = await this.resolveSubject(context, input);
    const duplicate = await context.database
      .selectFrom('emulation_registrations')
      .select('id')
      .where('campaign_id', '=', input.campaign_id)
      .where('title_id', '=', input.title_id)
      .where(subject.staff_id ? 'staff_id' : 'department_id', '=', subject.staff_id ?? subject.department_id ?? '')
      .executeTakeFirst();
    if (duplicate) {
      throw emulationRule(`${subject.name} đã đăng ký danh hiệu này trong đợt`);
    }
    const created = await context.database
      .insertInto('emulation_registrations')
      .values({
        campaign_id: input.campaign_id,
        title_id: input.title_id,
        target: input.target,
        staff_id: subject.staff_id,
        department_id: subject.department_id,
        subject_name: subject.name,
        commitment: input.commitment,
        registered_by: currentUser.id,
        registered_by_name: currentUser.description.full_name,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...created, title_name: title.name, campaign_name: campaign.name };
  }

  private async ownRegistration(context: EmulationContext, currentUser: CurrentUser, id: string) {
    const row = await context.database
      .selectFrom('emulation_registrations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy đăng ký thi đua', 'emulation_registration');
    }
    if (row.registered_by !== currentUser.id && !context.canManage) {
      throw forbidden('Chỉ người đăng ký sửa được');
    }
    return row;
  }

  async updateRegistration(currentUser: CurrentUser, id: string, commitment: string | null) {
    const context = await this.context(currentUser);
    const row = await this.ownRegistration(context, currentUser, id);
    if (row.status === 'accepted') {
      throw emulationRule('Đăng ký đã được duyệt, không sửa được');
    }
    return context.database
      .updateTable('emulation_registrations')
      .set({ commitment, status: 'pending', review_note: null, updated_at: this.clock.now() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async deleteRegistration(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.ownRegistration(context, currentUser, id);
    const used = await context.database
      .selectFrom('emulation_nominations')
      .select('id')
      .where('registration_id', '=', id)
      .executeTakeFirst();
    if (row.status === 'accepted' || used) {
      throw emulationRule('Đăng ký đã được duyệt hoặc đã có hồ sơ đề nghị, không xóa được');
    }
    await context.database.deleteFrom('emulation_registrations').where('id', '=', id).execute();
  }

  async reviewRegistrations(currentUser: CurrentUser, ids: string[], accept: boolean, note: string | null) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    if (!accept && !note) {
      throw validationError([{ field: 'note', message: 'Nhập lý do trả lại' }]);
    }
    const rows = await context.database
      .updateTable('emulation_registrations')
      .set({
        status: accept ? 'accepted' : 'returned',
        review_note: note,
        reviewed_by_name: currentUser.description.full_name,
        reviewed_at: this.clock.now(),
        updated_at: this.clock.now(),
      })
      .where('id', 'in', ids)
      .where('status', '<>', accept ? 'accepted' : 'returned')
      .returning(['id', 'registered_by', 'subject_name'])
      .execute();
    if (!accept) {
      for (const row of rows) {
        await queueNotification(context.database, {
          orgUnitId: null,
          templateCode: 'emulation',
          title: 'Đăng ký thi đua bị trả lại',
          body: [row.subject_name, note].filter(Boolean).join(': '),
          targetType: 'emulation_registration',
          targetId: row.id,
          recipients: [{ userId: row.registered_by, channel: 'in_app' }],
        });
      }
    }
    return { updated: rows.length };
  }

  // ---- Hồ sơ đề nghị ----

  async nomination(database: Executor, id: string): Promise<NominationRow> {
    const row = await database.selectFrom('emulation_nominations').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy hồ sơ đề nghị', 'emulation_nomination');
    }
    return row;
  }

  async isMember(database: Executor, campaignId: string, userId: string): Promise<boolean> {
    return (
      (await database
        .selectFrom('emulation_council_members')
        .select('id')
        .where('campaign_id', '=', campaignId)
        .where('user_id', '=', userId)
        .executeTakeFirst()) !== undefined
    );
  }

  // Người lập, người được đề nghị, tổ trưởng của tổ được đề nghị, người quản lý, người ban hành, thành viên hội đồng của đợt
  // (từ khi hồ sơ được tiếp nhận) xem được hồ sơ
  async visibleNomination(context: EmulationContext, currentUser: CurrentUser, id: string): Promise<NominationRow> {
    const row = await this.nomination(context.database, id);
    if (
      row.owner_user_id === currentUser.id ||
      context.canManage ||
      context.canDecide ||
      (row.staff_id !== null && row.staff_id === context.staff?.id) ||
      (row.department_id !== null && context.isLeader && row.department_id === context.staff?.department_id) ||
      (!EDITABLE.includes(row.status) &&
        row.status !== 'submitted' &&
        (await this.isMember(context.database, row.campaign_id, currentUser.id)))
    ) {
      return row;
    }
    throw notFoundError('Không tìm thấy hồ sơ đề nghị', 'emulation_nomination');
  }

  async nominations(
    currentUser: CurrentUser,
    filter: { view: 'mine' | 'review'; campaign_id: string | null; status: EmulationNominationStatus | null },
  ) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('emulation_nominations as nominations')
      .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'nominations.campaign_id')
      .leftJoin('departments', 'departments.id', 'nominations.department_id')
      .select([
        'nominations.id',
        'nominations.campaign_id',
        'campaigns.name as campaign_name',
        'nominations.title_id',
        'nominations.title_code',
        'nominations.title_name',
        'nominations.target',
        'nominations.staff_id',
        'nominations.department_id',
        'nominations.subject_name',
        'nominations.owner_name',
        'nominations.total_score',
        'nominations.kpi_rank_label',
        'nominations.status',
        'nominations.agree_percent',
        'nominations.eligibility',
        'nominations.return_note',
        'nominations.submitted_at',
        'nominations.updated_at',
      ])
      .orderBy('nominations.updated_at', 'desc');
    if (filter.campaign_id) {
      query = query.where('nominations.campaign_id', '=', filter.campaign_id);
    }
    if (filter.status) {
      query = query.where('nominations.status', '=', filter.status);
    }
    if (filter.view === 'review') {
      if (!context.canManage && !context.canDecide) {
        throw forbidden('Chỉ người quản lý thi đua tiếp nhận hồ sơ');
      }
      query = query.where('nominations.status', '<>', 'draft');
    } else {
      const staffId = context.staff?.id ?? null;
      const departmentId = context.isLeader ? (context.staff?.department_id ?? null) : null;
      query = query.where((eb) =>
        eb.or([
          eb('nominations.owner_user_id', '=', currentUser.id),
          ...(staffId ? [eb('nominations.staff_id', '=', staffId)] : []),
          ...(departmentId ? [eb('nominations.department_id', '=', departmentId)] : []),
        ]),
      );
    }
    const rows = await query.limit(2000).execute();
    return rows.map(({ eligibility, ...row }) => ({
      ...row,
      status_label: EMULATION_NOMINATION_STATUS_LABELS[row.status],
      failed_checks: checksOf(eligibility).filter((check) => check.state === 'failed').length,
    }));
  }

  async createNomination(currentUser: CurrentUser, input: SubjectInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const { campaign, title } = await this.campaignTitle(context, input.campaign_id, input.title_id, input.target);
    if (campaign.nomination_deadline && campaign.nomination_deadline < this.today() && !context.canManage) {
      throw emulationRule(`Đã quá hạn nộp hồ sơ đề nghị (${campaign.nomination_deadline})`);
    }
    const subject = await this.resolveSubject(context, input);
    const key = subject.staff_id ? 'staff_id' : 'department_id';
    const value = subject.staff_id ?? subject.department_id ?? '';
    const duplicate = await context.database
      .selectFrom('emulation_nominations')
      .select('id')
      .where('campaign_id', '=', campaign.id)
      .where('title_id', '=', title.id)
      .where(key, '=', value)
      .executeTakeFirst();
    if (duplicate) {
      throw emulationRule(`${subject.name} đã có hồ sơ đề nghị danh hiệu này trong đợt`);
    }
    const registration = await context.database
      .selectFrom('emulation_registrations')
      .select(['id', 'commitment'])
      .where('campaign_id', '=', campaign.id)
      .where('title_id', '=', title.id)
      .where(key, '=', value)
      .where('status', '=', 'accepted')
      .executeTakeFirst();
    const created = await context.database.transaction().execute(async (transaction) => {
      const row = await transaction
        .insertInto('emulation_nominations')
        .values({
          campaign_id: campaign.id,
          title_id: title.id,
          title_code: title.code,
          title_name: title.name,
          title_revision: title.revision,
          criteria: JSON.stringify(criteriaOf(title.criteria)),
          vote_threshold_percent: title.vote_threshold_percent,
          target: title.target,
          staff_id: subject.staff_id,
          department_id: subject.department_id,
          subject_name: subject.name,
          org_unit_id: subject.org_unit_id,
          registration_id: registration?.id ?? null,
          owner_user_id: currentUser.id,
          owner_name: currentUser.description.full_name,
          achievements: registration?.commitment ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: subject.org_unit_id,
        entityName: 'emulation_nominations',
        entityId: row.id,
        action: 'create',
        before: null,
        after: { campaign_id: campaign.id, title_code: title.code, subject_name: subject.name },
      });
      return row;
    });
    return this.viewNomination(currentUser, created.id);
  }

  private assertOwner(row: NominationRow, currentUser: CurrentUser, context: EmulationContext): void {
    if (row.owner_user_id !== currentUser.id && !context.canManage) {
      throw forbidden('Chỉ người lập hồ sơ thao tác được');
    }
  }

  async updateNomination(currentUser: CurrentUser, id: string, input: NominationUpdate) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (!EDITABLE.includes(row.status)) {
      throw emulationRule('Chỉ sửa hồ sơ đang soạn hoặc bị trả lại');
    }
    const criteria = criteriaOf(row.criteria);
    const errors: Array<{ field: string; message: string }> = [];
    for (const [code, value] of Object.entries(input.scores)) {
      const criterion = criteria.find((item) => item.code === code);
      if (!criterion) {
        errors.push({ field: `scores.${code}`, message: 'Không có tiêu chí này' });
      } else if (value > criterion.max_score) {
        errors.push({ field: `scores.${code}`, message: `Tối đa ${criterion.max_score} điểm` });
      }
    }
    if (errors.length > 0) {
      throw validationError(errors);
    }
    await context.database
      .updateTable('emulation_nominations')
      .set({
        achievements: input.achievements,
        initiative: input.initiative,
        scores: JSON.stringify(input.scores),
        total_score: emulationScore(criteria, input.scores),
        updated_at: this.clock.now(),
      })
      .where('id', '=', id)
      .execute();
    return this.viewNomination(currentUser, id);
  }

  async deleteNomination(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (row.status !== 'draft' || row.submitted_at) {
      throw emulationRule('Chỉ xóa hồ sơ đang soạn, chưa nộp lần nào');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('emulation_nominations').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: row.org_unit_id,
        entityName: 'emulation_nominations',
        entityId: id,
        action: 'delete',
        before: row,
        after: null,
      });
    });
  }

  // Nộp: chụp lại kết quả KPI và kết quả kiểm tra điều kiện; điều kiện không đạt không chặn nộp, hội đồng xem khi bình xét
  async submitNomination(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (!EDITABLE.includes(row.status)) {
      throw emulationRule('Hồ sơ đã nộp');
    }
    const campaign = await this.campaign(context.database, row.campaign_id);
    if (campaign.status !== 'launched') {
      throw emulationRule('Đợt thi đua không còn nhận hồ sơ');
    }
    if (campaign.nomination_deadline && campaign.nomination_deadline < this.today() && !context.canManage) {
      throw emulationRule(`Đã quá hạn nộp hồ sơ đề nghị (${campaign.nomination_deadline})`);
    }
    if (!row.achievements) {
      throw validationError([{ field: 'achievements', message: 'Nhập tóm tắt thành tích trước khi nộp' }]);
    }
    const kpi = await this.kpiResult(context.database, campaign, row);
    const checks = await this.checks(context, campaign, row, kpi);
    await context.database
      .updateTable('emulation_nominations')
      .set({
        status: 'submitted',
        submitted_at: this.clock.now(),
        return_note: null,
        kpi_evaluation_id: kpi?.evaluation_id ?? null,
        kpi_period_name: kpi?.period_name ?? null,
        kpi_rank: kpi?.rank ?? null,
        kpi_rank_label: kpi?.rank_label ?? null,
        kpi_score: kpi?.score ?? null,
        eligibility: JSON.stringify(checks),
        updated_at: this.clock.now(),
      })
      .where('id', '=', id)
      .where('status', 'in', EDITABLE)
      .execute();
    return this.viewNomination(currentUser, id);
  }

  async withdrawNomination(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (row.status !== 'submitted') {
      throw emulationRule('Chỉ rút hồ sơ đã nộp, chưa được tiếp nhận');
    }
    await context.database
      .updateTable('emulation_nominations')
      .set({ status: 'draft', updated_at: this.clock.now() })
      .where('id', '=', id)
      .where('status', '=', 'submitted')
      .execute();
    return this.viewNomination(currentUser, id);
  }

  // Tiếp nhận: hồ sơ vào danh sách bình xét của hội đồng; kiểm tra lại điều kiện lúc tiếp nhận
  async acceptNomination(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const row = await this.nomination(context.database, id);
    if (row.status !== 'submitted') {
      throw emulationRule('Chỉ tiếp nhận hồ sơ đã nộp');
    }
    const campaign = await this.campaign(context.database, row.campaign_id);
    const kpi = await this.kpiResult(context.database, campaign, row);
    const checks = await this.checks(context, campaign, row, kpi);
    await context.database
      .updateTable('emulation_nominations')
      .set({
        status: 'accepted',
        accepted_at: this.clock.now(),
        eligibility: JSON.stringify(checks),
        updated_at: this.clock.now(),
      })
      .where('id', '=', id)
      .where('status', '=', 'submitted')
      .execute();
    return this.viewNomination(currentUser, id);
  }

  async returnNomination(currentUser: CurrentUser, id: string, note: string) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const row = await this.nomination(context.database, id);
    if (!['submitted', 'accepted'].includes(row.status) || row.meeting_id) {
      throw emulationRule('Chỉ trả lại hồ sơ đã nộp, chưa đưa ra phiên bỏ phiếu');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('emulation_nominations')
        .set({ status: 'returned', return_note: note, accepted_at: null, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await queueNotification(transaction, {
        orgUnitId: row.org_unit_id,
        templateCode: 'emulation',
        title: 'Hồ sơ đề nghị khen thưởng bị trả lại',
        body: `${row.title_name} – ${row.subject_name}: ${note}`,
        targetType: 'emulation_nomination',
        targetId: id,
        recipients: [{ userId: row.owner_user_id, channel: 'in_app' }],
      });
    });
    return this.viewNomination(currentUser, id);
  }

  async viewNomination(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    const campaign = await this.campaign(context.database, row.campaign_id);
    const evidence = await context.database
      .selectFrom('emulation_nomination_evidence as evidence')
      .innerJoin('professional_documents as documents', 'documents.id', 'evidence.document_id')
      .select([
        'evidence.id',
        'evidence.document_id',
        'evidence.note',
        'documents.title',
        'documents.status as document_status',
        'documents.owner_name',
      ])
      .where('evidence.nomination_id', '=', id)
      .orderBy('evidence.created_at')
      .execute();
    // Hồ sơ đang soạn: kiểm tra điều kiện theo dữ liệu hiện tại; đã nộp: kết quả đã chụp lại
    const editable = EDITABLE.includes(row.status);
    const kpi = editable ? await this.kpiResult(context.database, campaign, row) : null;
    const checks = editable ? await this.checks(context, campaign, row, kpi) : checksOf(row.eligibility);
    const department = row.department_id
      ? null
      : row.staff_id
        ? await context.database
            .selectFrom('staff')
            .leftJoin('departments', 'departments.id', 'staff.department_id')
            .select('departments.name')
            .where('staff.id', '=', row.staff_id)
            .executeTakeFirst()
        : undefined;
    const appeals = await context.database
      .selectFrom('emulation_appeals')
      .select(['id', 'kind', 'content', 'status', 'response', 'submitted_by_name', 'created_at'])
      .where('nomination_id', '=', id)
      .orderBy('created_at')
      .execute();
    const showVotes = campaign.status === 'published' || campaign.status === 'closed' || context.canManage;
    return {
      ...row,
      criteria: criteriaOf(row.criteria),
      scores: scoresOf(row.scores),
      eligibility: checks,
      kpi_live: kpi,
      department_name: department?.name ?? null,
      campaign_name: campaign.name,
      campaign_status: campaign.status,
      appeal_deadline: campaign.appeal_deadline,
      status_label: EMULATION_NOMINATION_STATUS_LABELS[row.status],
      evidence,
      appeals,
      agree_count: showVotes ? row.agree_count : null,
      disagree_count: showVotes ? row.disagree_count : null,
      abstain_count: showVotes ? row.abstain_count : null,
      agree_percent: showVotes ? row.agree_percent : null,
      can_edit: editable && (row.owner_user_id === currentUser.id || context.canManage),
      can_manage: context.canManage,
    };
  }

  // ---- Đầu vào KPI (18d) ----

  // Kết quả đánh giá, xếp loại của kỳ KPI gắn với đợt; mức cuối là kết luận của cấp trên (hoặc kết quả biểu quyết đã chốt)
  async kpiResult(database: Executor, campaign: CampaignRow, row: Pick<NominationRow, 'staff_id'>) {
    if (!campaign.kpi_period_id || !row.staff_id) {
      return null;
    }
    const evaluation = await database
      .selectFrom('kpi_evaluations as evaluations')
      .innerJoin('kpi_periods as periods', 'periods.id', 'evaluations.period_id')
      .innerJoin('kpi_rule_set_versions as versions', 'versions.id', 'evaluations.rule_set_version_id')
      .select([
        'evaluations.id',
        'evaluations.status',
        'evaluations.final_rank',
        'evaluations.superior_rank',
        'evaluations.total_score',
        'periods.name as period_name',
        'versions.config',
      ])
      .where('evaluations.period_id', '=', campaign.kpi_period_id)
      .where('evaluations.staff_id', '=', row.staff_id)
      .executeTakeFirst();
    if (!evaluation) {
      return null;
    }
    const config = evaluation.config as KpiRuleConfig;
    const ranks = Array.isArray(config?.ranks) ? config.ranks : [];
    const rank = evaluation.final_rank ?? (String(evaluation.status) === 'concluded' ? evaluation.superior_rank : null);
    return {
      evaluation_id: evaluation.id,
      period_name: evaluation.period_name,
      rank,
      rank_label: ranks.find((item) => item.code === rank)?.label ?? rank,
      score: evaluation.total_score,
      // Thứ tự xếp loại từ cao xuống thấp theo bộ quy tắc của kỳ
      ranks: ranks.map((item) => ({ code: item.code, label: item.label })),
    };
  }

  // ---- Sổ khen thưởng mọi năm học ----

  // Khen thưởng của một cá nhân, tập thể ở mọi năm học có cơ sở dữ liệu (kể cả khen thưởng nhập tay các năm trước); mã nhân
  // sự, mã tổ giữ nguyên khi chuyển năm học nên đối chiếu theo mã định danh
  async awardsAcrossYears(subject: { staff_id: string | null; department_id: string | null }) {
    const years = await this.databases.system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .select(['academic_years.name', 'academic_years.start_date', 'academic_year_databases.database_name'])
      .orderBy('academic_years.start_date')
      .execute();
    const rows: Array<{ year_start: number; year_name: string; title_code: string; title_name: string }> = [];
    for (const year of years) {
      const database = this.databases.schoolYear<SchoolYearDatabase>(year.database_name);
      try {
        let query = database
          .selectFrom('emulation_awards')
          .select(['year_start', 'year_name', 'title_code', 'title_name']);
        query = subject.staff_id
          ? query.where('staff_id', '=', subject.staff_id)
          : query.where('department_id', '=', subject.department_id ?? '');
        rows.push(...(await query.execute()));
      } catch {
        // Năm học cũ chưa có bảng khen thưởng thì bỏ qua
      }
    }
    return rows;
  }

  // Kiểm tra điều kiện của danh hiệu cho một hồ sơ
  async checks(
    context: EmulationContext,
    campaign: CampaignRow,
    row: NominationRow,
    kpi: Awaited<ReturnType<EmulationService['kpiResult']>>,
  ): Promise<EmulationCheck[]> {
    const database = context.database;
    const title = await this.title(database, row.title_id);
    const checks: EmulationCheck[] = [];
    if (campaign.kind === 'regular' && title.kind === 'title') {
      checks.push({
        code: 'registration',
        label: 'Đăng ký thi đua đầu năm',
        state: row.registration_id ? 'ok' : 'failed',
        detail: row.registration_id ? 'Có đăng ký đã được duyệt' : 'Không có đăng ký thi đua đã được duyệt trong đợt',
      });
    }
    if (title.min_kpi_rank && row.target === 'individual') {
      if (!campaign.kpi_period_id) {
        checks.push({
          code: 'kpi',
          label: 'Mức đánh giá, xếp loại KPI',
          state: 'unknown',
          detail: 'Đợt thi đua chưa chọn kỳ đánh giá KPI làm đầu vào',
        });
      } else if (!kpi?.rank) {
        checks.push({
          code: 'kpi',
          label: 'Mức đánh giá, xếp loại KPI',
          state: 'unknown',
          detail: 'Chưa có kết quả xếp loại KPI của kỳ đã chọn',
        });
      } else {
        const order = kpi.ranks.map((item) => item.code);
        const actual = order.indexOf(kpi.rank);
        const required = order.indexOf(title.min_kpi_rank);
        const label = kpi.ranks[required]?.label ?? title.min_kpi_rank;
        checks.push(
          required < 0
            ? {
                code: 'kpi',
                label: 'Mức đánh giá, xếp loại KPI',
                state: 'unknown',
                detail: `Bộ quy tắc KPI không có mức "${title.min_kpi_rank}"`,
              }
            : {
                code: 'kpi',
                label: 'Mức đánh giá, xếp loại KPI',
                state: actual >= 0 && actual <= required ? 'ok' : 'failed',
                detail: `Đạt "${kpi.rank_label}", yêu cầu từ "${label}" trở lên (${kpi.period_name})`,
              },
        );
      }
    }
    if (title.requires_initiative) {
      checks.push({
        code: 'initiative',
        label: 'Sáng kiến, giải pháp',
        state: row.initiative ? 'ok' : 'failed',
        detail: row.initiative ? 'Có nêu sáng kiến, giải pháp' : 'Chưa nêu sáng kiến, giải pháp được công nhận',
      });
    }
    if (title.min_score !== null) {
      const total = Number(row.total_score);
      checks.push({
        code: 'score',
        label: 'Điểm tiêu chí',
        state: total >= Number(title.min_score) ? 'ok' : 'failed',
        detail: `${total} điểm, yêu cầu từ ${Number(title.min_score)}`,
      });
    }
    if (title.prerequisite_code && title.consecutive_years > 0) {
      const awards = await this.awardsAcrossYears(row);
      const years = awards.filter((award) => award.title_code === title.prerequisite_code).map((a) => a.year_start);
      const count = consecutiveYearsBefore(years, context.yearStart);
      const prerequisite = await database
        .selectFrom('emulation_titles')
        .select('name')
        .where('code', '=', title.prerequisite_code)
        .executeTakeFirst();
      checks.push({
        code: 'consecutive',
        label: `${title.consecutive_years} năm liên tục đạt ${prerequisite?.name ?? title.prerequisite_code}`,
        state: count >= title.consecutive_years ? 'ok' : 'failed',
        detail: `Đạt ${count} năm liên tục liền trước năm học ${context.yearName}`,
      });
    }
    if (title.quota_percent !== null && title.quota_base_code) {
      const counted: EmulationNominationStatus[] = ['accepted', 'passed', 'proposed', 'awarded'];
      const count = async (code: string) =>
        Number(
          (
            await database
              .selectFrom('emulation_nominations')
              .select((eb) => eb.fn.countAll<string>().as('count'))
              .where('campaign_id', '=', campaign.id)
              .where('title_code', '=', code)
              .where('status', 'in', counted)
              .executeTakeFirstOrThrow()
          ).count,
        );
      const base = await count(title.quota_base_code);
      // Tính cả chính hồ sơ đang xét khi hồ sơ chưa ở trạng thái được đếm (đang soạn, mới nộp)
      const own = (await count(title.code)) + (counted.includes(row.status) ? 0 : 1);
      const limit = Math.floor((base * Number(title.quota_percent)) / 100);
      checks.push({
        code: 'quota',
        label: `Tỉ lệ tối đa ${Number(title.quota_percent)}% số đạt ${title.quota_base_code}`,
        state: own <= limit ? 'ok' : 'failed',
        detail: `${own} hồ sơ đã tiếp nhận, tối đa ${limit} (tính trên ${base} hồ sơ ${title.quota_base_code})`,
      });
    }
    return checks;
  }

  // ---- Minh chứng (kho hồ sơ chuyên môn 18e) ----

  // Hồ sơ trong kho của người được đề nghị (nhánh cá nhân) hoặc của tổ (nhánh tổ), trạng thái đã duyệt hoặc đang soạn
  async evidenceOptions(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    let query = context.database
      .selectFrom('professional_documents as documents')
      .innerJoin('professional_folders as folders', 'folders.id', 'documents.folder_id')
      .select([
        'documents.id',
        'documents.title',
        'documents.status',
        'documents.owner_name',
        'documents.branch',
        'folders.name as folder_name',
        'documents.updated_at',
      ])
      .orderBy('documents.updated_at', 'desc')
      .limit(500);
    if (row.staff_id) {
      const staff = await context.database
        .selectFrom('staff')
        .select(['user_id', 'department_id'])
        .where('id', '=', row.staff_id)
        .executeTakeFirst();
      query = query.where((eb) =>
        eb.or([
          eb('documents.owner_staff_id', '=', row.staff_id ?? ''),
          ...(staff?.user_id ? [eb('documents.owner_user_id', '=', staff.user_id)] : []),
        ]),
      );
    } else {
      query = query.where('documents.department_id', '=', row.department_id ?? '');
    }
    return query.execute();
  }

  async addEvidence(currentUser: CurrentUser, id: string, documentId: string, note: string | null) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (!EDITABLE.includes(row.status)) {
      throw emulationRule('Chỉ thêm minh chứng khi hồ sơ đang soạn hoặc bị trả lại');
    }
    const options = await this.evidenceOptions(currentUser, id);
    if (!options.some((option) => option.id === documentId)) {
      throw validationError([
        { field: 'document_id', message: 'Chọn hồ sơ trong kho hồ sơ chuyên môn của người, tổ được đề nghị' },
      ]);
    }
    const count = await context.database
      .selectFrom('emulation_nomination_evidence')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('nomination_id', '=', id)
      .executeTakeFirstOrThrow();
    if (Number(count.count) >= 30) {
      throw emulationRule('Mỗi hồ sơ tối đa 30 minh chứng');
    }
    await context.database
      .insertInto('emulation_nomination_evidence')
      .values({ nomination_id: id, document_id: documentId, note, created_by: currentUser.id })
      .onConflict((conflict) => conflict.columns(['nomination_id', 'document_id']).doUpdateSet({ note }))
      .execute();
    return this.viewNomination(currentUser, id);
  }

  async removeEvidence(currentUser: CurrentUser, id: string, evidenceId: string) {
    const context = await this.context(currentUser);
    const row = await this.visibleNomination(context, currentUser, id);
    this.assertOwner(row, currentUser, context);
    if (!EDITABLE.includes(row.status)) {
      throw emulationRule('Chỉ bỏ minh chứng khi hồ sơ đang soạn hoặc bị trả lại');
    }
    await context.database
      .deleteFrom('emulation_nomination_evidence')
      .where('id', '=', evidenceId)
      .where('nomination_id', '=', id)
      .execute();
    return this.viewNomination(currentUser, id);
  }

  // Tệp của minh chứng: bản đã kí nếu có, không thì phiên bản mới nhất. Ai xem được hồ sơ đề nghị thì tải được minh chứng
  async evidenceFile(currentUser: CurrentUser, id: string, evidenceId: string) {
    const context = await this.context(currentUser);
    await this.visibleNomination(context, currentUser, id);
    const evidence = await context.database
      .selectFrom('emulation_nomination_evidence as evidence')
      .innerJoin('professional_documents as documents', 'documents.id', 'evidence.document_id')
      .select(['documents.id', 'documents.signed_file_id'])
      .where('evidence.id', '=', evidenceId)
      .where('evidence.nomination_id', '=', id)
      .executeTakeFirst();
    if (!evidence) {
      throw notFoundError('Không tìm thấy minh chứng', 'emulation_evidence');
    }
    const fileId =
      evidence.signed_file_id ??
      (
        await context.database
          .selectFrom('professional_document_versions')
          .select('file_id')
          .where('document_id', '=', evidence.id)
          .orderBy('version_no', 'desc')
          .executeTakeFirst()
      )?.file_id;
    if (!fileId) {
      throw notFoundError('Hồ sơ minh chứng chưa có tệp', 'file');
    }
    const file = await context.database
      .selectFrom('files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .executeTakeFirstOrThrow();
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // Báo cáo thành tích theo mẫu (Word, PDF)
  async nominationReport(currentUser: CurrentUser, id: string, format: 'pdf' | 'docx') {
    const detail = await this.viewNomination(currentUser, id);
    const context = await this.context(currentUser);
    const department =
      detail.department_name ??
      (detail.department_id
        ? ((
            await context.database
              .selectFrom('departments')
              .select('name')
              .where('id', '=', detail.department_id)
              .executeTakeFirst()
          )?.name ?? null)
        : null);
    const blocks = nominationBlocks({
      school: await this.schoolName(context.database),
      title_name: detail.title_name,
      target: detail.target,
      subject_name: detail.subject_name,
      department_name: detail.target === 'individual' ? department : null,
      year_name: context.yearName,
      achievements: detail.achievements,
      initiative: detail.initiative,
      criteria: detail.criteria,
      scores: detail.scores,
      total_score: Number(detail.total_score),
      kpi: {
        period: detail.kpi_period_name ?? detail.kpi_live?.period_name ?? null,
        rank: detail.kpi_rank_label ?? detail.kpi_live?.rank_label ?? null,
        score: detail.kpi_score ?? detail.kpi_live?.score ?? null,
      },
      evidence: detail.evidence.map((item) => ({ title: item.title, note: item.note })),
      checks: detail.eligibility,
      owner_name: detail.owner_name,
      date: detail.submitted_at ?? this.clock.now(),
    });
    const title = `Báo cáo thành tích ${detail.subject_name}`;
    const stem = `bao-cao-thanh-tich-${detail.id.slice(0, 8)}`;
    return format === 'docx'
      ? { buffer: buildDocx(blocks, { title }), contentType: DOCX_TYPE, fileName: `${stem}.docx` }
      : { buffer: await buildDocumentPdf(blocks, { title }), contentType: PDF_TYPE, fileName: `${stem}.pdf` };
  }
}
