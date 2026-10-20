import { Injectable } from '@nestjs/common';
import type {
  ProfessionalApprovalFlow,
  ProfessionalBranch,
  ProfessionalDocumentAction,
  ProfessionalDocumentStatus,
  SchoolYearDatabase,
} from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  isSigningProvider,
  PERMISSION_CODES,
  PROFESSIONAL_BRANCH_LABELS,
  PROFESSIONAL_DEFAULT_FOLDERS,
  PROFESSIONAL_MAXIMUM_FILE_BYTES,
  PROFESSIONAL_RULE_CODE,
  PROFESSIONAL_STATUS_LABELS,
  SIGNING_SIGNATURE_TYPE_LABELS,
  type KpiSchoolLevelCode,
} from '@school-management/shared';
import { type ExpressionBuilder, type Kysely, type Selectable, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { detectArchiveFileType } from '../archives/archives.js';
import type { CurrentUser, OrganizationScope } from '../authentication/current-user.js';
import { writeAuditLog, type ChangeOrigin } from '../common/audit-log.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { queueNotification, type NotificationRecipient } from '../common/notification-queue.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { CONTENT_TYPES } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { DossierSigner } from '../signing/dossier-signer.js';

// Hồ sơ chuyên môn (DT-18 phần 18e, YCTD-142) theo mô tả công khai của GIKIDI Nhà Trường. Kho dạng cây theo năm học (cơ sở dữ
// liệu năm học), ba nhánh: cá nhân, tổ hoặc nhóm công tác, trường. Mỗi thư mục có luồng duyệt riêng:
// - không duyệt: nộp là lưu kho;
// - tổ trưởng duyệt: tổ trưởng của tổ (Tổ trưởng chuyên môn cùng phòng ban, có quyền duyệt cấp tổ) hoặc trưởng nhóm công tác;
// - tổ trưởng rồi Ban Giám hiệu duyệt (Hiệu trưởng, Phó Hiệu trưởng phụ trách chuyên môn, có quyền duyệt cấp trường).
// Người nộp là tổ trưởng, hồ sơ của trường, hay hồ sơ không thuộc tổ, nhóm nào thì bỏ bước tổ trưởng. Trả lại ở bước nào cũng
// về người nộp; người nộp tải phiên bản mới (giữ phiên bản cũ) rồi nộp lại. Bước duyệt cuối kí nội bộ khi thư mục cần kí (quy
// trình kí của Quản lý kí hồ sơ 16k, 17b qua chỗ nối DossierSigner). Đợt nộp có hạn: nộp lần đầu sau hạn là nộp trễ; thống kê
// ai đã nộp đúng hạn, nộp trễ, chưa nộp; nhắc người chưa nộp. Khóa năm học thì không thêm, sửa, nộp, duyệt được nữa.
// Các lựa chọn chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;
type DocumentRow = Selectable<SchoolYearDatabase['professional_documents']>;
type FolderRow = Selectable<SchoolYearDatabase['professional_folders']>;
type RoundRow = Selectable<SchoolYearDatabase['professional_rounds']>;

const USE = PERMISSION_CODES.professionalRecordUse;
const REVIEW = PERMISSION_CODES.professionalRecordReview;
const APPROVE = PERMISSION_CODES.professionalRecordApprove;
const MANAGE = PERMISSION_CODES.professionalRecordManage;
export const PROFESSIONAL_PERMISSIONS = [USE, REVIEW, APPROVE, MANAGE];
const MAXIMUM_VERSIONS = 50;
const MAXIMUM_LIST = 500;

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export function professionalRule(message: string): ApplicationError {
  return ruleViolationError(PROFESSIONAL_RULE_CODE, message);
}

function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

function inScope(scope: OrganizationScope, orgUnitId: string | null): boolean {
  return scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId));
}

export interface ProfessionalContext {
  database: Kysely<SchoolYearDatabase>;
  staff: { id: string; org_unit_id: string; department_id: string | null; full_name: string } | null;
  groupIds: string[];
  leaderGroupIds: string[];
  approveScope: OrganizationScope;
  manageScope: OrganizationScope;
  viewScope: OrganizationScope;
  locked: boolean;
}

export interface FolderInput {
  parent_id: string | null;
  branch: ProfessionalBranch;
  name: string;
  description: string | null;
  school_level: KpiSchoolLevelCode | null;
  approval_flow: ProfessionalApprovalFlow;
  requires_signing: boolean;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface RoundInput {
  folder_id: string;
  title: string;
  description: string | null;
  submitter_kind: 'staff' | 'group';
  org_unit_id: string | null;
  department_ids: string[] | null;
  opens_on: string;
  due_at: Date;
}

export interface DocumentInput {
  folder_id: string;
  round_id: string | null;
  title: string;
  description: string | null;
  department_id: string | null;
  work_group_id: string | null;
}

export interface DocumentFilter {
  view: 'mine' | 'groups' | 'school' | 'review';
  all: boolean;
  folder_id: string | null;
  round_id: string | null;
  status: ProfessionalDocumentStatus | null;
  q: string | null;
  processed: boolean;
}

export interface RoundSubmitter {
  key: string;
  name: string;
  department_name: string | null;
  org_unit_name: string | null;
  document_id: string | null;
  status: ProfessionalDocumentStatus | null;
  submitted_at: Date | null;
  state: 'on_time' | 'late' | 'missing' | 'draft';
}

@Injectable()
export class ProfessionalRecordsService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly signer: DossierSigner,
    private readonly clock: Clock,
  ) {}

  today(): string {
    return VIETNAM_DATE.format(this.clock.now());
  }

  async database(): Promise<Kysely<SchoolYearDatabase>> {
    return (await this.currentSchoolYear.require()).database;
  }

  async context(currentUser: CurrentUser, database?: Kysely<SchoolYearDatabase>): Promise<ProfessionalContext> {
    const db = database ?? (await this.database());
    const staff =
      (await db
        .selectFrom('staff')
        .select(['id', 'org_unit_id', 'department_id', 'full_name'])
        .where('user_id', '=', currentUser.id)
        .where('status', '=', 'active')
        .executeTakeFirst()) ?? null;
    const memberships = staff
      ? await db
          .selectFrom('professional_work_group_members as members')
          .innerJoin('professional_work_groups as groups', 'groups.id', 'members.group_id')
          .select(['members.group_id', 'members.is_leader'])
          .where('members.staff_id', '=', staff.id)
          .where('groups.status', '=', 'active')
          .execute()
      : [];
    const settings = await db
      .selectFrom('professional_record_settings')
      .select('locked')
      .where('id', '=', 1)
      .executeTakeFirst();
    const empty: OrganizationScope = { wholeSchool: false, orgUnitIds: [] };
    return {
      database: db,
      staff,
      groupIds: memberships.map((member) => member.group_id),
      leaderGroupIds: memberships.filter((member) => member.is_leader).map((member) => member.group_id),
      approveScope: currentUser.hasPermission(APPROVE)
        ? await this.organizationScopes.resolveStaff(currentUser, APPROVE)
        : empty,
      manageScope: currentUser.hasPermission(MANAGE)
        ? await this.organizationScopes.resolveStaff(currentUser, MANAGE)
        : empty,
      viewScope: await this.organizationScopes.resolveAnyRole(currentUser),
      locked: settings?.locked ?? false,
    };
  }

  private assertUnlocked(context: ProfessionalContext): void {
    if (context.locked) {
      throw professionalRule('Năm học đã khóa hồ sơ chuyên môn; mở khóa trước khi thêm, sửa, nộp, duyệt');
    }
  }

  private assertManage(context: ProfessionalContext, orgUnitId: string | null = null): void {
    const scope = context.manageScope;
    if (!(scope.wholeSchool || (orgUnitId !== null && scope.orgUnitIds.includes(orgUnitId)))) {
      throw forbidden('Chỉ người quản lý kho hồ sơ chuyên môn (toàn trường hoặc đơn vị) được thao tác');
    }
  }

  // ---- Tổng quan, khóa năm học ----

  async overview(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const database = context.database;
    const settings = await database
      .selectFrom('professional_record_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
    const departments = context.staff?.department_id
      ? await database
          .selectFrom('departments')
          .select(['id', 'name'])
          .where('id', '=', context.staff.department_id)
          .execute()
      : [];
    const groups =
      context.groupIds.length > 0
        ? await database
            .selectFrom('professional_work_groups')
            .select(['id', 'name'])
            .where('id', 'in', context.groupIds)
            .orderBy('name')
            .execute()
        : [];
    return {
      locked: settings.locked,
      locked_at: settings.locked_at,
      locked_by_name: settings.locked_by_name,
      has_staff: context.staff !== null,
      can_use: currentUser.hasPermission(USE),
      can_review: currentUser.hasPermission(REVIEW) || context.leaderGroupIds.length > 0,
      can_approve: currentUser.hasPermission(APPROVE),
      can_manage: currentUser.hasPermission(MANAGE),
      signer_description: this.signer.description,
      my_groups: [
        ...departments.map((department) => ({ kind: 'department' as const, id: department.id, name: department.name })),
        ...groups.map((group) => ({
          kind: 'work_group' as const,
          id: group.id,
          name: group.name,
          leader: context.leaderGroupIds.includes(group.id),
        })),
      ],
    };
  }

  async setLock(currentUser: CurrentUser, locked: boolean, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    const now = this.clock.now();
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_record_settings')
        .set({
          locked,
          locked_at: locked ? now : null,
          locked_by_name: locked ? currentUser.description.full_name : null,
          updated_at: now,
        })
        .where('id', '=', 1)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_record_settings',
        entityId: '1',
        action: 'update',
        before: { locked: context.locked },
        after: { locked },
      });
    });
    return this.overview(currentUser);
  }

  // ---- Thư mục ----

  async folders(currentUser: CurrentUser, branch: ProfessionalBranch | null, includeInactive: boolean) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('professional_folders as folders')
      .select((eb) => [
        'folders.id',
        'folders.parent_id',
        'folders.branch',
        'folders.name',
        'folders.description',
        'folders.school_level',
        'folders.approval_flow',
        'folders.requires_signing',
        'folders.sort_order',
        'folders.status',
        eb
          .selectFrom('professional_documents')
          .select((inner) => inner.fn.countAll<string>().as('total'))
          .whereRef('professional_documents.folder_id', '=', 'folders.id')
          .as('document_count'),
      ])
      .orderBy('folders.branch')
      .orderBy('folders.sort_order')
      .orderBy('folders.name');
    if (branch) {
      query = query.where('folders.branch', '=', branch);
    }
    if (!includeInactive || !currentUser.hasPermission(MANAGE)) {
      query = query.where('folders.status', '=', 'active');
    }
    const rows = await query.execute();
    return rows.map((row) => ({ ...row, document_count: Number(row.document_count ?? 0) }));
  }

  private async checkParent(database: Executor, input: FolderInput, id: string | null): Promise<void> {
    if (!input.parent_id) {
      return;
    }
    const parent = await database
      .selectFrom('professional_folders')
      .select(['id', 'branch', 'parent_id'])
      .where('id', '=', input.parent_id)
      .executeTakeFirst();
    if (!parent) {
      throw validationError([{ field: 'parent_id', message: 'Thư mục cha không tồn tại' }]);
    }
    if (parent.branch !== input.branch) {
      throw validationError([{ field: 'parent_id', message: 'Thư mục cha phải cùng nhánh' }]);
    }
    // Không cho thư mục nằm dưới chính nó hay thư mục con của nó
    let cursor: string | null = parent.id;
    for (let depth = 0; cursor && depth < 50; depth += 1) {
      if (cursor === id) {
        throw validationError([{ field: 'parent_id', message: 'Không chọn thư mục con làm thư mục cha' }]);
      }
      const next: { parent_id: string | null } | undefined = await database
        .selectFrom('professional_folders')
        .select('parent_id')
        .where('id', '=', cursor)
        .executeTakeFirst();
      cursor = next?.parent_id ?? null;
    }
  }

  async createFolder(currentUser: CurrentUser, input: FolderInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    this.assertUnlocked(context);
    await this.checkParent(context.database, input, null);
    return context.database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('professional_folders')
        .values({ ...input, created_by: currentUser.id })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_folders',
        entityId: created.id,
        action: 'create',
        before: null,
        after: created,
      });
      return created;
    });
  }

  async updateFolder(currentUser: CurrentUser, id: string, input: FolderInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    this.assertUnlocked(context);
    const before = await this.folder(context.database, id);
    if (before.branch !== input.branch) {
      throw validationError([{ field: 'branch', message: 'Không đổi nhánh của thư mục đã tạo' }]);
    }
    await this.checkParent(context.database, input, id);
    return context.database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('professional_folders')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_folders',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async deleteFolder(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    this.assertUnlocked(context);
    const before = await this.folder(context.database, id);
    const [child, document, round] = await Promise.all([
      context.database.selectFrom('professional_folders').select('id').where('parent_id', '=', id).executeTakeFirst(),
      context.database.selectFrom('professional_documents').select('id').where('folder_id', '=', id).executeTakeFirst(),
      context.database.selectFrom('professional_rounds').select('id').where('folder_id', '=', id).executeTakeFirst(),
    ]);
    const used = child ?? document ?? round;
    if (used) {
      throw professionalRule('Thư mục đã có thư mục con, hồ sơ hoặc đợt nộp; chuyển sang ngừng dùng thay vì xóa');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('professional_folders').where('id', '=', id).execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: null,
        entityName: 'professional_folders',
        entityId: id,
        action: 'delete',
        before,
        after: null,
      });
    });
  }

  // Nạp danh mục thư mục mặc định theo cấp học; thư mục cùng nhánh, cùng tên ở gốc đã có thì bỏ qua
  async loadDefaults(currentUser: CurrentUser, level: KpiSchoolLevelCode, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context);
    this.assertUnlocked(context);
    const existing = await context.database
      .selectFrom('professional_folders')
      .select(['branch', 'name'])
      .where('parent_id', 'is', null)
      .execute();
    const known = new Set(existing.map((folder) => `${folder.branch}:${folder.name.toLowerCase()}`));
    const templates = PROFESSIONAL_DEFAULT_FOLDERS[level].filter(
      (template) => !known.has(`${template.branch}:${template.name.toLowerCase()}`),
    );
    if (templates.length > 0) {
      await context.database.transaction().execute(async (transaction) => {
        const created = await transaction
          .insertInto('professional_folders')
          .values(
            templates.map((template, index) => ({
              branch: template.branch,
              name: template.name,
              school_level: level,
              approval_flow: template.approval_flow,
              requires_signing: template.requires_signing ?? false,
              sort_order: (index + 1) * 10,
              created_by: currentUser.id,
            })),
          )
          .returning('id')
          .execute();
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: null,
          entityName: 'professional_folders',
          entityId: created[0]?.id ?? '',
          action: 'create',
          before: null,
          after: { school_level: level, created: templates.map((template) => template.name) },
        });
      });
    }
    return { created: templates.length, skipped: PROFESSIONAL_DEFAULT_FOLDERS[level].length - templates.length };
  }

  private async folder(database: Executor, id: string): Promise<FolderRow> {
    const folder = await database.selectFrom('professional_folders').selectAll().where('id', '=', id).executeTakeFirst();
    if (!folder) {
      throw notFoundError('Không tìm thấy thư mục hồ sơ', 'professional_folder');
    }
    return folder;
  }

  // ---- Nhóm công tác ----

  async workGroups(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const groups = await context.database
      .selectFrom('professional_work_groups as groups')
      .innerJoin('org_units', 'org_units.id', 'groups.org_unit_id')
      .select([
        'groups.id',
        'groups.org_unit_id',
        'org_units.name as org_unit_name',
        'groups.name',
        'groups.description',
        'groups.status',
        'groups.updated_at',
      ])
      .orderBy('groups.name')
      .execute();
    const members =
      groups.length > 0
        ? await context.database
            .selectFrom('professional_work_group_members as members')
            .innerJoin('staff', 'staff.id', 'members.staff_id')
            .select(['members.group_id', 'members.staff_id', 'members.is_leader', 'staff.full_name', 'staff.code'])
            .where(
              'members.group_id',
              'in',
              groups.map((group) => group.id),
            )
            .orderBy('staff.full_name')
            .execute()
        : [];
    return groups.map((group) => ({
      ...group,
      members: members
        .filter((member) => member.group_id === group.id)
        .map(({ group_id: _group, ...member }) => member),
    }));
  }

  async saveWorkGroup(
    currentUser: CurrentUser,
    id: string | null,
    input: {
      org_unit_id: string;
      name: string;
      description: string | null;
      status: 'active' | 'inactive';
      members: Array<{ staff_id: string; is_leader: boolean }>;
    },
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    this.assertManage(context, input.org_unit_id);
    this.assertUnlocked(context);
    const staffIds = input.members.map((member) => member.staff_id);
    if (staffIds.length > 0) {
      const found = await context.database.selectFrom('staff').select('id').where('id', 'in', staffIds).execute();
      if (found.length !== staffIds.length) {
        throw validationError([{ field: 'members', message: 'Có nhân sự không tồn tại' }]);
      }
    }
    return context.database.transaction().execute(async (transaction) => {
      const before = id
        ? await transaction.selectFrom('professional_work_groups').selectAll().where('id', '=', id).executeTakeFirst()
        : undefined;
      if (id && !before) {
        throw notFoundError('Không tìm thấy nhóm công tác', 'professional_work_group');
      }
      const saved = id
        ? await transaction
            .updateTable('professional_work_groups')
            .set({
              org_unit_id: input.org_unit_id,
              name: input.name,
              description: input.description,
              status: input.status,
              updated_at: this.clock.now(),
            })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow()
        : await transaction
            .insertInto('professional_work_groups')
            .values({
              org_unit_id: input.org_unit_id,
              name: input.name,
              description: input.description,
              status: input.status,
              created_by: currentUser.id,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
      await transaction.deleteFrom('professional_work_group_members').where('group_id', '=', saved.id).execute();
      if (input.members.length > 0) {
        await transaction
          .insertInto('professional_work_group_members')
          .values(input.members.map((member) => ({ group_id: saved.id, ...member })))
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'professional_work_groups',
        entityId: saved.id,
        action: id ? 'update' : 'create',
        before: before ?? null,
        after: { ...saved, members: input.members },
      });
      return saved;
    });
  }

  // ---- Đợt nộp ----

  async rounds(currentUser: CurrentUser, status: 'open' | 'closed' | 'all') {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('professional_rounds as rounds')
      .innerJoin('professional_folders as folders', 'folders.id', 'rounds.folder_id')
      .leftJoin('org_units', 'org_units.id', 'rounds.org_unit_id')
      .select([
        'rounds.id',
        'rounds.folder_id',
        'folders.name as folder_name',
        'folders.branch',
        'rounds.title',
        'rounds.description',
        'rounds.submitter_kind',
        'rounds.org_unit_id',
        'org_units.name as org_unit_name',
        'rounds.department_ids',
        'rounds.opens_on',
        'rounds.due_at',
        'rounds.status',
        'rounds.reminded_at',
        'rounds.created_by_name',
        'rounds.created_at',
      ])
      .orderBy('rounds.due_at', 'desc');
    if (status !== 'all') {
      query = query.where('rounds.status', '=', status);
    }
    if (!context.viewScope.wholeSchool) {
      const units = context.viewScope.orgUnitIds;
      query = query.where((eb) =>
        units.length > 0
          ? eb.or([eb('rounds.org_unit_id', 'is', null), eb('rounds.org_unit_id', 'in', units)])
          : eb('rounds.org_unit_id', 'is', null),
      );
    }
    const rounds = await query.limit(MAXIMUM_LIST).execute();
    const result = [];
    for (const round of rounds) {
      const submitters = await this.submitters(context.database, round as unknown as RoundRow);
      const mine = this.mySubmitter(context, round as unknown as RoundRow, submitters);
      result.push({
        ...round,
        expected: submitters.length,
        on_time: submitters.filter((item) => item.state === 'on_time').length,
        late: submitters.filter((item) => item.state === 'late').length,
        missing: submitters.filter((item) => item.state === 'missing' || item.state === 'draft').length,
        my_state: mine?.state ?? null,
        my_document_id: mine?.document_id ?? null,
        overdue: round.status === 'open' && round.due_at < this.clock.now(),
      });
    }
    return result;
  }

  private mySubmitter(context: ProfessionalContext, round: RoundRow, submitters: RoundSubmitter[]) {
    if (!context.staff) {
      return undefined;
    }
    const key = round.submitter_kind === 'staff' ? context.staff.id : context.staff.department_id;
    return key ? submitters.find((item) => item.key === key) : undefined;
  }

  private async checkRound(database: Executor, input: RoundInput): Promise<void> {
    const folder = await this.folder(database, input.folder_id);
    if (folder.status !== 'active') {
      throw validationError([{ field: 'folder_id', message: 'Thư mục đã ngừng dùng' }]);
    }
    const expected = input.submitter_kind === 'staff' ? 'personal' : 'group';
    if (folder.branch !== expected) {
      throw validationError([
        {
          field: 'folder_id',
          message: `Đợt nộp theo ${input.submitter_kind === 'staff' ? 'cá nhân' : 'tổ'} chọn thư mục ở nhánh ${PROFESSIONAL_BRANCH_LABELS[expected]}`,
        },
      ]);
    }
    if (input.due_at.getTime() < new Date(`${input.opens_on}T00:00:00+07:00`).getTime()) {
      throw validationError([{ field: 'due_at', message: 'Hạn nộp phải sau ngày mở đợt' }]);
    }
    if (input.department_ids && input.department_ids.length > 0) {
      const found = await database
        .selectFrom('departments')
        .select('id')
        .where('id', 'in', input.department_ids)
        .execute();
      if (found.length !== input.department_ids.length) {
        throw validationError([{ field: 'department_ids', message: 'Có tổ chuyên môn không tồn tại' }]);
      }
    }
  }

  async createRound(currentUser: CurrentUser, input: RoundInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertManage(context, input.org_unit_id);
    this.assertUnlocked(context);
    await this.checkRound(context.database, input);
    const created = await context.database.transaction().execute(async (transaction) => {
      const round = await transaction
        .insertInto('professional_rounds')
        .values({
          ...input,
          created_by: currentUser.id,
          created_by_name: currentUser.description.full_name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'professional_rounds',
        entityId: round.id,
        action: 'create',
        before: null,
        after: round,
      });
      return round;
    });
    await this.notifyRound(context.database, created, 'Đợt nộp hồ sơ chuyên môn mới', false);
    return created;
  }

  async updateRound(currentUser: CurrentUser, id: string, input: RoundInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const before = await this.round(context.database, id);
    this.assertManage(context, before.org_unit_id);
    this.assertManage(context, input.org_unit_id);
    this.assertUnlocked(context);
    await this.checkRound(context.database, input);
    const used = await context.database
      .selectFrom('professional_documents')
      .select('id')
      .where('round_id', '=', id)
      .executeTakeFirst();
    if (used && (input.folder_id !== before.folder_id || input.submitter_kind !== before.submitter_kind)) {
      throw professionalRule('Đợt đã có hồ sơ nộp, không đổi thư mục hay cách nộp');
    }
    return context.database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('professional_rounds')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: input.org_unit_id,
        entityName: 'professional_rounds',
        entityId: id,
        action: 'update',
        before,
        after: updated,
      });
      return updated;
    });
  }

  async setRoundStatus(currentUser: CurrentUser, id: string, status: 'open' | 'closed', origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    const before = await this.round(context.database, id);
    this.assertManage(context, before.org_unit_id);
    this.assertUnlocked(context);
    return context.database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable('professional_rounds')
        .set({ status, updated_at: this.clock.now() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: before.org_unit_id,
        entityName: 'professional_rounds',
        entityId: id,
        action: 'update',
        before: { status: before.status },
        after: { status },
      });
      return updated;
    });
  }

  private async round(database: Executor, id: string): Promise<RoundRow> {
    const round = await database.selectFrom('professional_rounds').selectAll().where('id', '=', id).executeTakeFirst();
    if (!round) {
      throw notFoundError('Không tìm thấy đợt nộp', 'professional_round');
    }
    return round;
  }

  // Đối tượng phải nộp của đợt và tình trạng nộp: cá nhân là nhân sự đang làm việc có tài khoản thuộc đơn vị, tổ của đợt;
  // theo tổ là các tổ chuyên môn (phòng ban) đang dùng của đơn vị hoặc danh sách tổ của đợt
  async submitters(database: Executor, round: RoundRow): Promise<RoundSubmitter[]> {
    const documents = await database
      .selectFrom('professional_documents')
      .select(['id', 'owner_staff_id', 'department_id', 'status', 'submitted_at', 'submitted_late'])
      .where('round_id', '=', round.id)
      .execute();
    const stateOf = (document: (typeof documents)[number] | undefined): RoundSubmitter['state'] => {
      if (!document) {
        return 'missing';
      }
      if (!document.submitted_at) {
        return 'draft';
      }
      return document.submitted_late ? 'late' : 'on_time';
    };
    if (round.submitter_kind === 'staff') {
      let query = database
        .selectFrom('staff')
        .leftJoin('departments', 'departments.id', 'staff.department_id')
        .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
        .select([
          'staff.id',
          'staff.full_name',
          'departments.name as department_name',
          'org_units.name as org_unit_name',
        ])
        .where('staff.status', '=', 'active')
        .where('staff.user_id', 'is not', null)
        .orderBy('staff.full_name');
      if (round.org_unit_id) {
        query = query.where('staff.org_unit_id', '=', round.org_unit_id);
      }
      if (round.department_ids && round.department_ids.length > 0) {
        query = query.where('staff.department_id', 'in', round.department_ids);
      }
      const staff = await query.execute();
      return staff.map((person) => {
        const document = documents.find((item) => item.owner_staff_id === person.id);
        return {
          key: person.id,
          name: person.full_name,
          department_name: person.department_name,
          org_unit_name: person.org_unit_name,
          document_id: document?.id ?? null,
          status: document?.status ?? null,
          submitted_at: document?.submitted_at ?? null,
          state: stateOf(document),
        };
      });
    }
    let query = database
      .selectFrom('departments')
      .innerJoin('org_units', 'org_units.id', 'departments.org_unit_id')
      .select(['departments.id', 'departments.name', 'org_units.name as org_unit_name'])
      .where('departments.status', '=', 'active')
      .orderBy('departments.name');
    if (round.org_unit_id) {
      query = query.where('departments.org_unit_id', '=', round.org_unit_id);
    }
    if (round.department_ids && round.department_ids.length > 0) {
      query = query.where('departments.id', 'in', round.department_ids);
    }
    const departments = await query.execute();
    return departments.map((department) => {
      const document = documents.find((item) => item.department_id === department.id);
      return {
        key: department.id,
        name: department.name,
        department_name: department.name,
        org_unit_name: department.org_unit_name,
        document_id: document?.id ?? null,
        status: document?.status ?? null,
        submitted_at: document?.submitted_at ?? null,
        state: stateOf(document),
      };
    });
  }

  async roundStatus(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const round = await this.round(context.database, id);
    const canSee =
      inScope(context.manageScope, round.org_unit_id) ||
      inScope(context.approveScope, round.org_unit_id) ||
      currentUser.hasPermission(REVIEW);
    if (!canSee) {
      throw forbidden('Chỉ tổ trưởng, Ban Giám hiệu, người quản lý kho xem được tình trạng nộp của đợt');
    }
    let submitters = await this.submitters(context.database, round);
    // Tổ trưởng chỉ xem người trong tổ mình
    if (
      !inScope(context.manageScope, round.org_unit_id) &&
      !inScope(context.approveScope, round.org_unit_id) &&
      round.submitter_kind === 'staff'
    ) {
      const department = context.staff?.department_id ?? null;
      const name = department
        ? (
            await context.database
              .selectFrom('departments')
              .select('name')
              .where('id', '=', department)
              .executeTakeFirst()
          )?.name
        : undefined;
      submitters = submitters.filter((item) => name !== undefined && item.department_name === name);
    }
    return { round, submitters };
  }

  // Nhắc người chưa nộp (thông báo trong ứng dụng); đợt theo tổ thì nhắc tổ trưởng của đơn vị có tổ chưa nộp
  async remind(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const round = await this.round(context.database, id);
    this.assertManage(context, round.org_unit_id);
    if (round.status !== 'open') {
      throw professionalRule('Đợt nộp đã đóng');
    }
    const reminded = await this.notifyRound(context.database, round, 'Nhắc hạn nộp hồ sơ chuyên môn', true);
    await context.database
      .updateTable('professional_rounds')
      .set({ reminded_at: this.clock.now() })
      .where('id', '=', id)
      .execute();
    return { reminded };
  }

  private async notifyRound(database: Executor, round: RoundRow, title: string, missingOnly: boolean) {
    const submitters = await this.submitters(database, round);
    const targets = submitters.filter((item) => !missingOnly || item.state === 'missing' || item.state === 'draft');
    const due = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(round.due_at);
    let recipients: NotificationRecipient[] = [];
    if (round.submitter_kind === 'staff') {
      const keys = targets.map((item) => item.key);
      const users =
        keys.length > 0
          ? await database.selectFrom('staff').select('user_id').where('id', 'in', keys).execute()
          : [];
      recipients = users
        .filter((user): user is { user_id: string } => user.user_id !== null)
        .map((user) => ({ userId: user.user_id, channel: 'in_app' }));
    } else {
      const keys = targets.map((item) => item.key);
      const departments =
        keys.length > 0
          ? await database.selectFrom('departments').select('org_unit_id').where('id', 'in', keys).execute()
          : [];
      recipients = [...new Set(departments.map((department) => department.org_unit_id))].map((orgUnitId) => ({
        roleCode: 'VT-17',
        orgUnitId,
        channel: 'in_app',
      }));
    }
    await queueNotification(database, {
      orgUnitId: round.org_unit_id,
      templateCode: 'professional_record',
      title,
      body: `${round.title}: hạn nộp ${due}`,
      targetType: 'professional_round',
      targetId: round.id,
      recipients,
    });
    return recipients.length;
  }

  // ---- Hồ sơ ----

  private visibleCondition(context: ProfessionalContext, currentUser: CurrentUser) {
    return (eb: ExpressionBuilder<SchoolYearDatabase, 'professional_documents'>) => {
      const conditions = [eb('professional_documents.owner_user_id', '=', currentUser.id)];
      const staff = context.staff;
      if (staff?.department_id) {
        // Hồ sơ của tổ mình; hồ sơ cá nhân của người trong tổ thì tổ trưởng xem
        conditions.push(
          eb.and([
            eb('professional_documents.branch', '=', 'group'),
            eb('professional_documents.department_id', '=', staff.department_id),
          ]),
        );
        if (currentUser.hasPermission(REVIEW)) {
          conditions.push(eb('professional_documents.department_id', '=', staff.department_id));
        }
      }
      if (context.groupIds.length > 0) {
        conditions.push(
          eb.and([
            eb('professional_documents.branch', '=', 'group'),
            eb('professional_documents.work_group_id', 'in', context.groupIds),
          ]),
        );
      }
      if (context.leaderGroupIds.length > 0) {
        conditions.push(eb('professional_documents.work_group_id', 'in', context.leaderGroupIds));
      }
      // Hồ sơ trường đã duyệt: ai trong đơn vị cũng xem
      if (context.viewScope.wholeSchool) {
        conditions.push(
          eb.and([eb('professional_documents.branch', '=', 'school'), eb('professional_documents.status', '=', 'approved')]),
        );
      } else if (context.viewScope.orgUnitIds.length > 0) {
        conditions.push(
          eb.and([
            eb('professional_documents.branch', '=', 'school'),
            eb('professional_documents.status', '=', 'approved'),
            eb('professional_documents.org_unit_id', 'in', context.viewScope.orgUnitIds),
          ]),
        );
      }
      for (const scope of [context.approveScope, context.manageScope]) {
        if (scope.wholeSchool) {
          conditions.push(eb.val(true));
        } else if (scope.orgUnitIds.length > 0) {
          conditions.push(eb('professional_documents.org_unit_id', 'in', scope.orgUnitIds));
        }
      }
      return eb.or(conditions);
    };
  }

  // Hồ sơ đang chờ người dùng duyệt (tổ trưởng hoặc Ban Giám hiệu), không gồm hồ sơ của chính mình
  pendingReviewCondition(context: ProfessionalContext, currentUser: CurrentUser) {
    return (eb: ExpressionBuilder<SchoolYearDatabase, 'professional_documents'>) => {
      const conditions = [];
      const staff = context.staff;
      if (staff?.department_id && currentUser.hasPermission(REVIEW)) {
        conditions.push(
          eb.and([
            eb('professional_documents.status', '=', 'pending_leader'),
            eb('professional_documents.work_group_id', 'is', null),
            eb('professional_documents.department_id', '=', staff.department_id),
          ]),
        );
      }
      if (context.leaderGroupIds.length > 0) {
        conditions.push(
          eb.and([
            eb('professional_documents.status', '=', 'pending_leader'),
            eb('professional_documents.work_group_id', 'in', context.leaderGroupIds),
          ]),
        );
      }
      if (context.approveScope.wholeSchool) {
        conditions.push(eb('professional_documents.status', '=', 'pending_approval'));
      } else if (context.approveScope.orgUnitIds.length > 0) {
        conditions.push(
          eb.and([
            eb('professional_documents.status', '=', 'pending_approval'),
            eb('professional_documents.org_unit_id', 'in', context.approveScope.orgUnitIds),
          ]),
        );
      }
      if (conditions.length === 0) {
        return eb.val(false);
      }
      return eb.and([eb('professional_documents.owner_user_id', '!=', currentUser.id), eb.or(conditions)]);
    };
  }

  async list(currentUser: CurrentUser, filter: DocumentFilter) {
    const context = await this.context(currentUser);
    let query = context.database
      .selectFrom('professional_documents')
      .innerJoin('professional_folders as folders', 'folders.id', 'professional_documents.folder_id')
      .leftJoin('professional_rounds as rounds', 'rounds.id', 'professional_documents.round_id')
      .leftJoin('departments', 'departments.id', 'professional_documents.department_id')
      .leftJoin('professional_work_groups as groups', 'groups.id', 'professional_documents.work_group_id')
      .innerJoin('org_units', 'org_units.id', 'professional_documents.org_unit_id')
      .select([
        'professional_documents.id',
        'professional_documents.folder_id',
        'folders.name as folder_name',
        'professional_documents.branch',
        'professional_documents.round_id',
        'rounds.title as round_title',
        'rounds.due_at as round_due_at',
        'professional_documents.title',
        'professional_documents.owner_name',
        'professional_documents.owner_user_id',
        'departments.name as department_name',
        'groups.name as work_group_name',
        'org_units.name as org_unit_name',
        'professional_documents.status',
        'professional_documents.approval_flow',
        'professional_documents.requires_signing',
        'professional_documents.current_version',
        'professional_documents.submitted_at',
        'professional_documents.submitted_late',
        'professional_documents.leader_name',
        'professional_documents.approved_by_name',
        'professional_documents.approved_at',
        'professional_documents.signed_at',
        'professional_documents.updated_at',
      ])
      .where(this.visibleCondition(context, currentUser))
      .orderBy('professional_documents.updated_at', 'desc');
    if (filter.view === 'mine') {
      query = query.where('professional_documents.branch', '=', 'personal');
      if (!filter.all) {
        query = query.where('professional_documents.owner_user_id', '=', currentUser.id);
      }
    } else if (filter.view === 'groups') {
      query = query.where('professional_documents.branch', '=', 'group');
    } else if (filter.view === 'school') {
      query = query.where('professional_documents.branch', '=', 'school');
    } else if (filter.processed) {
      query = query.where((eb) =>
        eb.or([
          eb('professional_documents.leader_user_id', '=', currentUser.id),
          eb('professional_documents.approved_by', '=', currentUser.id),
        ]),
      );
    } else {
      query = query.where(this.pendingReviewCondition(context, currentUser));
    }
    if (filter.folder_id) {
      query = query.where('professional_documents.folder_id', '=', filter.folder_id);
    }
    if (filter.round_id) {
      query = query.where('professional_documents.round_id', '=', filter.round_id);
    }
    if (filter.status) {
      query = query.where('professional_documents.status', '=', filter.status);
    }
    if (filter.q) {
      const like = `%${filter.q.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
      query = query.where((eb) =>
        eb.or([
          eb('professional_documents.title', 'ilike', like),
          eb('professional_documents.owner_name', 'ilike', like),
        ]),
      );
    }
    const rows = await query.limit(MAXIMUM_LIST).execute();
    return rows.map((row) => ({ ...row, status_label: PROFESSIONAL_STATUS_LABELS[row.status] }));
  }

  private async document(database: Executor, id: string): Promise<DocumentRow> {
    const document = await database
      .selectFrom('professional_documents')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!document) {
      throw notFoundError('Không tìm thấy hồ sơ', 'professional_document');
    }
    return document;
  }

  private async visibleDocument(context: ProfessionalContext, currentUser: CurrentUser, id: string) {
    const document = await this.document(context.database, id);
    const visible = await context.database
      .selectFrom('professional_documents')
      .select('id')
      .where('id', '=', id)
      .where((eb) => eb.or([this.visibleCondition(context, currentUser)(eb), this.pendingReviewCondition(context, currentUser)(eb)]))
      .executeTakeFirst();
    if (!visible) {
      throw forbidden('Hồ sơ này nằm ngoài phạm vi của bạn');
    }
    return document;
  }

  private canReview(context: ProfessionalContext, currentUser: CurrentUser, document: DocumentRow): boolean {
    if (document.status !== 'pending_leader' || document.owner_user_id === currentUser.id) {
      return false;
    }
    if (document.work_group_id) {
      return context.leaderGroupIds.includes(document.work_group_id);
    }
    return (
      document.department_id !== null &&
      currentUser.hasPermission(REVIEW) &&
      context.staff?.department_id === document.department_id
    );
  }

  private canApprove(context: ProfessionalContext, currentUser: CurrentUser, document: DocumentRow): boolean {
    return (
      document.status === 'pending_approval' &&
      document.owner_user_id !== currentUser.id &&
      inScope(context.approveScope, document.org_unit_id)
    );
  }

  private isOwner(context: ProfessionalContext, currentUser: CurrentUser, document: DocumentRow): boolean {
    if (document.owner_user_id === currentUser.id) {
      return true;
    }
    // Hồ sơ của tổ, nhóm: tổ trưởng, trưởng nhóm cũng sửa, nộp được
    if (document.branch === 'group') {
      if (document.work_group_id) {
        return context.leaderGroupIds.includes(document.work_group_id);
      }
      return currentUser.hasPermission(REVIEW) && context.staff?.department_id === document.department_id;
    }
    if (document.branch === 'school') {
      return inScope(context.manageScope, document.org_unit_id);
    }
    return false;
  }

  async view(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const document = await this.visibleDocument(context, currentUser, id);
    const database = context.database;
    const [folder, round, department, group, versions, events] = await Promise.all([
      this.folder(database, document.folder_id),
      document.round_id ? this.round(database, document.round_id) : Promise.resolve(null),
      document.department_id
        ? database.selectFrom('departments').select('name').where('id', '=', document.department_id).executeTakeFirst()
        : Promise.resolve(undefined),
      document.work_group_id
        ? database
            .selectFrom('professional_work_groups')
            .select('name')
            .where('id', '=', document.work_group_id)
            .executeTakeFirst()
        : Promise.resolve(undefined),
      database
        .selectFrom('professional_document_versions as versions')
        .innerJoin('files', 'files.id', 'versions.file_id')
        .select([
          'versions.id',
          'versions.version_no',
          'versions.note',
          'versions.sha256',
          'versions.created_by_name',
          'versions.created_at',
          'files.file_name',
          'files.content_type',
          'files.size_bytes',
        ])
        .where('versions.document_id', '=', id)
        .orderBy('versions.version_no', 'desc')
        .execute(),
      database
        .selectFrom('professional_document_events')
        .select(['id', 'action', 'note', 'actor_name', 'created_at'])
        .where('document_id', '=', id)
        .orderBy('created_at')
        .orderBy('id')
        .execute(),
    ]);
    const owner = this.isOwner(context, currentUser, document);
    const editable = owner && ['draft', 'returned'].includes(document.status) && !context.locked;
    return {
      ...document,
      status_label: PROFESSIONAL_STATUS_LABELS[document.status],
      folder_name: folder.name,
      round_title: round?.title ?? null,
      round_due_at: round?.due_at ?? null,
      round_status: round?.status ?? null,
      department_name: department?.name ?? null,
      work_group_name: group?.name ?? null,
      versions,
      events,
      locked: context.locked,
      signer_description: this.signer.description,
      actions: {
        upload: editable,
        submit: editable && document.current_version > 0,
        withdraw: owner && document.status === 'pending_leader' && !context.locked,
        delete: owner && document.status === 'draft' && document.submitted_at === null && !context.locked,
        leader_approve: this.canReview(context, currentUser, document) && !context.locked,
        approve: this.canApprove(context, currentUser, document) && !context.locked,
        return:
          (this.canReview(context, currentUser, document) || this.canApprove(context, currentUser, document)) &&
          !context.locked,
      },
    };
  }

  async create(currentUser: CurrentUser, input: DocumentInput, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const database = context.database;
    const folder = await this.folder(database, input.folder_id);
    if (folder.status !== 'active') {
      throw validationError([{ field: 'folder_id', message: 'Thư mục đã ngừng dùng' }]);
    }
    const staff = context.staff;
    let orgUnitId = staff?.org_unit_id ?? null;
    let departmentId: string | null = null;
    let workGroupId: string | null = null;
    if (folder.branch === 'personal') {
      if (!currentUser.hasPermission(USE) || !staff) {
        throw forbidden('Tài khoản chưa gắn với hồ sơ nhân sự hoặc không có quyền dùng kho hồ sơ chuyên môn');
      }
      departmentId = staff.department_id;
    } else if (folder.branch === 'group') {
      if (!staff) {
        throw forbidden('Tài khoản chưa gắn với hồ sơ nhân sự');
      }
      if (input.work_group_id) {
        if (!context.groupIds.includes(input.work_group_id)) {
          throw forbidden('Chỉ thành viên của nhóm công tác tạo được hồ sơ của nhóm');
        }
        workGroupId = input.work_group_id;
        const group = await database
          .selectFrom('professional_work_groups')
          .select('org_unit_id')
          .where('id', '=', workGroupId)
          .executeTakeFirstOrThrow();
        orgUnitId = group.org_unit_id;
      } else {
        const department = input.department_id ?? staff.department_id;
        if (!department || department !== staff.department_id) {
          throw validationError([
            { field: 'department_id', message: 'Hồ sơ của tổ chỉ tạo cho tổ chuyên môn của mình hoặc nhóm công tác' },
          ]);
        }
        departmentId = department;
        const found = await database
          .selectFrom('departments')
          .select('org_unit_id')
          .where('id', '=', department)
          .executeTakeFirstOrThrow();
        orgUnitId = found.org_unit_id;
      }
    } else {
      if (!currentUser.hasPermission(MANAGE)) {
        throw forbidden('Chỉ người quản lý kho tạo được hồ sơ của trường');
      }
      if (!orgUnitId) {
        const root = await database
          .selectFrom('org_units')
          .select('id')
          .where('unit_type', '=', 'truong_chinh')
          .executeTakeFirst();
        orgUnitId = root?.id ?? null;
      }
      this.assertManage(context, orgUnitId);
    }
    if (!orgUnitId) {
      throw professionalRule('Không xác định được đơn vị của hồ sơ');
    }
    if (input.round_id) {
      const round = await this.round(database, input.round_id);
      if (round.folder_id !== folder.id) {
        throw validationError([{ field: 'round_id', message: 'Đợt nộp thuộc thư mục khác' }]);
      }
      if (round.status !== 'open') {
        throw professionalRule('Đợt nộp đã đóng');
      }
      const duplicate = await database
        .selectFrom('professional_documents')
        .select('id')
        .where('round_id', '=', round.id)
        .where((eb) =>
          round.submitter_kind === 'staff'
            ? eb('owner_staff_id', '=', staff?.id ?? '')
            : workGroupId
              ? eb('work_group_id', '=', workGroupId)
              : eb('department_id', '=', departmentId ?? ''),
        )
        .executeTakeFirst();
      if (duplicate) {
        throw professionalRule('Đã có hồ sơ của đợt nộp này; mở hồ sơ đó để tải phiên bản mới');
      }
    }
    return database.transaction().execute(async (transaction) => {
      const created = await transaction
        .insertInto('professional_documents')
        .values({
          folder_id: folder.id,
          round_id: input.round_id,
          branch: folder.branch,
          org_unit_id: orgUnitId,
          owner_user_id: currentUser.id,
          owner_staff_id: staff?.id ?? null,
          owner_name: currentUser.description.full_name,
          department_id: departmentId,
          work_group_id: workGroupId,
          title: input.title,
          description: input.description,
          approval_flow: folder.approval_flow,
          requires_signing: folder.requires_signing,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.event(transaction, created.id, 'create', null, currentUser);
      await writeAuditLog(transaction, {
        origin,
        orgUnitId,
        entityName: 'professional_documents',
        entityId: created.id,
        action: 'create',
        before: null,
        after: { title: created.title, folder_id: created.folder_id, round_id: created.round_id },
      });
      return created;
    });
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    input: { title: string; description: string | null },
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.isOwner(context, currentUser, document) || !['draft', 'returned'].includes(document.status)) {
      throw professionalRule('Chỉ sửa được hồ sơ của mình khi chưa nộp hoặc bị trả lại');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_documents')
        .set({ ...input, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: document.org_unit_id,
        entityName: 'professional_documents',
        entityId: id,
        action: 'update',
        before: { title: document.title, description: document.description },
        after: input,
      });
    });
    return this.view(currentUser, id);
  }

  async remove(currentUser: CurrentUser, id: string, origin: ChangeOrigin) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.isOwner(context, currentUser, document) || document.status !== 'draft' || document.submitted_at) {
      throw professionalRule('Chỉ xóa được hồ sơ của mình chưa nộp lần nào');
    }
    const files = await context.database
      .selectFrom('professional_document_versions as versions')
      .innerJoin('files', 'files.id', 'versions.file_id')
      .select(['files.id', 'files.storage_key'])
      .where('versions.document_id', '=', id)
      .execute();
    await context.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom('professional_documents').where('id', '=', id).execute();
      if (files.length > 0) {
        await transaction
          .deleteFrom('files')
          .where(
            'id',
            'in',
            files.map((file) => file.id),
          )
          .execute();
      }
      await writeAuditLog(transaction, {
        origin,
        orgUnitId: document.org_unit_id,
        entityName: 'professional_documents',
        entityId: id,
        action: 'delete',
        before: { title: document.title },
        after: null,
      });
    });
    for (const file of files) {
      await this.fileStorage.delete(file.storage_key).catch(() => undefined);
    }
  }

  // Mỗi lần tải là một phiên bản mới; phiên bản cũ giữ nguyên
  async upload(
    currentUser: CurrentUser,
    id: string,
    file: { fileName: string; body: Buffer },
    note: string | null,
    origin: ChangeOrigin,
  ) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.isOwner(context, currentUser, document) || !['draft', 'returned'].includes(document.status)) {
      throw professionalRule('Chỉ tải phiên bản cho hồ sơ của mình khi chưa nộp hoặc bị trả lại');
    }
    if (document.current_version >= MAXIMUM_VERSIONS) {
      throw professionalRule(`Mỗi hồ sơ tối đa ${MAXIMUM_VERSIONS} phiên bản`);
    }
    if (file.body.length === 0 || file.body.length > PROFESSIONAL_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 20 MB' }]);
    }
    const contentType = detectArchiveFileType(file.fileName, file.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Tệp hồ sơ là PDF, ảnh JPEG, PNG, Word hoặc Excel' }]);
    }
    const key = storageKey('professional-records', id, randomUUID());
    await this.fileStorage.put(key, file.body, contentType);
    try {
      await context.database.transaction().execute(async (transaction) => {
        const stored = await transaction
          .insertInto('files')
          .values({
            org_unit_id: document.org_unit_id,
            purpose: 'professional_record',
            file_name: file.fileName.slice(0, 200),
            content_type: contentType,
            size_bytes: file.body.length,
            storage_key: key,
            created_by: currentUser.id,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const changed = await transaction
          .updateTable('professional_documents')
          .set((eb) => ({ current_version: eb('current_version', '+', 1), updated_at: this.clock.now() }))
          .where('id', '=', id)
          .where('current_version', '=', document.current_version)
          .returning('current_version')
          .executeTakeFirst();
        if (!changed) {
          throw professionalRule('Hồ sơ vừa có phiên bản khác; tải lại trang rồi thử lại');
        }
        await transaction
          .insertInto('professional_document_versions')
          .values({
            document_id: id,
            version_no: changed.current_version,
            file_id: stored.id,
            sha256: sha256(file.body),
            note,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
          })
          .execute();
        await this.event(transaction, id, 'upload', `Phiên bản ${changed.current_version}`, currentUser);
        await writeAuditLog(transaction, {
          origin,
          orgUnitId: document.org_unit_id,
          entityName: 'professional_document_versions',
          entityId: stored.id,
          action: 'create',
          before: null,
          after: { document_id: id, version_no: changed.current_version, file_name: file.fileName },
        });
      });
    } catch (error) {
      await this.fileStorage.delete(key).catch(() => undefined);
      throw error;
    }
    return this.view(currentUser, id);
  }

  async versionFile(currentUser: CurrentUser, id: string, versionId: string) {
    const context = await this.context(currentUser);
    await this.visibleDocument(context, currentUser, id);
    const file = await context.database
      .selectFrom('professional_document_versions as versions')
      .innerJoin('files', 'files.id', 'versions.file_id')
      .select(['files.file_name', 'files.content_type', 'files.storage_key'])
      .where('versions.document_id', '=', id)
      .where('versions.id', '=', versionId)
      .executeTakeFirst();
    if (!file) {
      throw notFoundError('Không tìm thấy phiên bản', 'professional_document_version');
    }
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  async signedFile(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!document.signed_file_id) {
      throw notFoundError('Hồ sơ chưa có bản đã kí', 'file');
    }
    const file = await context.database
      .selectFrom('files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', document.signed_file_id)
      .executeTakeFirstOrThrow();
    return { file, body: await this.fileStorage.get(file.storage_key) };
  }

  // Bước tiếp theo sau khi nộp: bỏ bước tổ trưởng khi người nộp là tổ trưởng, hồ sơ của trường hoặc không thuộc tổ, nhóm
  private async firstStep(
    context: ProfessionalContext,
    currentUser: CurrentUser,
    document: DocumentRow,
  ): Promise<ProfessionalDocumentStatus> {
    if (document.approval_flow === 'none') {
      return 'approved';
    }
    const hasLeaderStep =
      document.branch !== 'school' &&
      (document.work_group_id !== null || document.department_id !== null) &&
      !this.isLeaderOf(context, currentUser, document);
    if (hasLeaderStep) {
      return 'pending_leader';
    }
    return 'pending_approval';
  }

  private isLeaderOf(context: ProfessionalContext, currentUser: CurrentUser, document: DocumentRow): boolean {
    if (document.work_group_id) {
      return context.leaderGroupIds.includes(document.work_group_id);
    }
    return currentUser.hasPermission(REVIEW) && context.staff?.department_id === document.department_id;
  }

  async submit(currentUser: CurrentUser, id: string, note: string | null) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.isOwner(context, currentUser, document) || !['draft', 'returned'].includes(document.status)) {
      throw professionalRule('Chỉ nộp được hồ sơ của mình khi chưa nộp hoặc bị trả lại');
    }
    if (document.current_version === 0) {
      throw professionalRule('Tải tệp hồ sơ trước khi nộp');
    }
    const round = document.round_id ? await this.round(context.database, document.round_id) : null;
    const first = document.submitted_at === null;
    if (round && first && round.status !== 'open') {
      throw professionalRule('Đợt nộp đã đóng, không nộp mới được');
    }
    const now = this.clock.now();
    const next = await this.firstStep(context, currentUser, document);
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_documents')
        .set({
          status: next,
          ...(first ? { submitted_at: now, submitted_late: round !== null && now > round.due_at } : {}),
          return_note: null,
          leader_user_id: null,
          leader_name: null,
          leader_reviewed_at: null,
          approved_by: null,
          approved_by_name: null,
          approved_at: next === 'approved' ? now : null,
          updated_at: now,
        })
        .where('id', '=', id)
        .execute();
      await this.event(
        transaction,
        id,
        'submit',
        [first ? null : 'Nộp lại', round && first && now > round.due_at ? 'nộp trễ hạn' : null, note]
          .filter(Boolean)
          .join('; ') || null,
        currentUser,
      );
    });
    if (next === 'pending_leader') {
      await this.notifyLeaders(context.database, document, 'Hồ sơ chuyên môn chờ tổ trưởng duyệt');
    } else if (next === 'pending_approval') {
      await this.notifyApprovers(context.database, document);
    }
    return this.view(currentUser, id);
  }

  async withdraw(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.isOwner(context, currentUser, document) || document.status !== 'pending_leader') {
      throw professionalRule('Chỉ rút lại được hồ sơ của mình đang chờ tổ trưởng duyệt');
    }
    await context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('professional_documents')
        .set({ status: 'draft', updated_at: this.clock.now() })
        .where('id', '=', id)
        .where('status', '=', 'pending_leader')
        .execute();
      await this.event(transaction, id, 'withdraw', null, currentUser);
    });
    return this.view(currentUser, id);
  }

  async leaderApprove(currentUser: CurrentUser, id: string, note: string | null) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.canReview(context, currentUser, document)) {
      throw professionalRule('Chỉ tổ trưởng của tổ, trưởng nhóm duyệt được hồ sơ đang chờ tổ trưởng duyệt');
    }
    const now = this.clock.now();
    const final = document.approval_flow === 'leader';
    if (final && document.requires_signing) {
      return this.finalApprove(context, currentUser, document, note, 'leader');
    }
    await context.database.transaction().execute(async (transaction) => {
      const changed = await transaction
        .updateTable('professional_documents')
        .set({
          status: final ? 'approved' : 'pending_approval',
          leader_user_id: currentUser.id,
          leader_name: currentUser.description.full_name,
          leader_reviewed_at: now,
          ...(final ? { approved_by: currentUser.id, approved_by_name: currentUser.description.full_name, approved_at: now } : {}),
          updated_at: now,
        })
        .where('id', '=', id)
        .where('status', '=', 'pending_leader')
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw professionalRule('Hồ sơ không còn chờ tổ trưởng duyệt');
      }
      await this.event(transaction, id, 'leader_approve', note, currentUser);
    });
    if (final) {
      await this.notifyOwner(context.database, document, 'Hồ sơ chuyên môn đã được duyệt', note);
    } else {
      await this.notifyApprovers(context.database, document);
    }
    return this.view(currentUser, id);
  }

  async approve(currentUser: CurrentUser, id: string, note: string | null) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.canApprove(context, currentUser, document)) {
      throw professionalRule('Chỉ Ban Giám hiệu trong phạm vi đơn vị duyệt được hồ sơ đang chờ Ban Giám hiệu duyệt');
    }
    return this.finalApprove(context, currentUser, document, note, 'approver');
  }

  // Duyệt bước cuối, kí nội bộ khi thư mục cần kí: lập bản đã kí qua DossierSigner (khối xác nhận ghi người kí, thời điểm kí,
  // mã băm của tệp phiên bản cuối) khi chứng thư số nhà trường đã đăng ký kí nội bộ và còn hiệu lực, như kí văn bản đi ở 18b
  private async finalApprove(
    context: ProfessionalContext,
    currentUser: CurrentUser,
    document: DocumentRow,
    note: string | null,
    stage: 'leader' | 'approver',
  ) {
    const database = context.database;
    const expectedStatus: ProfessionalDocumentStatus = stage === 'leader' ? 'pending_leader' : 'pending_approval';
    const now = this.clock.now();
    let signed: { key: string; pdf: Buffer; method: string } | null = null;
    if (document.requires_signing) {
      signed = await this.signDocument(database, currentUser, document, now);
    }
    try {
      await database.transaction().execute(async (transaction) => {
        let signedFileId: string | null = null;
        if (signed) {
          const stored = await transaction
            .insertInto('files')
            .values({
              org_unit_id: document.org_unit_id,
              purpose: 'professional_record',
              file_name: `ho-so-chuyen-mon-${document.id.slice(0, 8)}-da-ki.pdf`,
              content_type: CONTENT_TYPES.pdf,
              size_bytes: signed.pdf.length,
              storage_key: signed.key,
              created_by: currentUser.id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          signedFileId = stored.id;
        }
        const changed = await transaction
          .updateTable('professional_documents')
          .set({
            status: 'approved',
            ...(stage === 'leader'
              ? {
                  leader_user_id: currentUser.id,
                  leader_name: currentUser.description.full_name,
                  leader_reviewed_at: now,
                }
              : {}),
            approved_by: currentUser.id,
            approved_by_name: currentUser.description.full_name,
            approved_at: now,
            ...(signed
              ? { signed_at: now, signature_method: signed.method, signed_file_id: signedFileId }
              : {}),
            updated_at: now,
          })
          .where('id', '=', document.id)
          .where('status', '=', expectedStatus)
          .executeTakeFirst();
        if (Number(changed.numUpdatedRows) !== 1) {
          throw professionalRule('Hồ sơ không còn chờ bạn duyệt');
        }
        await this.event(transaction, document.id, stage === 'leader' ? 'leader_approve' : 'approve', note, currentUser);
        if (signed) {
          await this.event(
            transaction,
            document.id,
            'sign',
            this.signer.digital ? 'Kí số' : 'Kí xác nhận nội bộ',
            currentUser,
          );
        }
      });
    } catch (error) {
      if (signed) {
        await this.fileStorage.delete(signed.key).catch(() => undefined);
      }
      throw error;
    }
    await this.notifyOwner(database, document, 'Hồ sơ chuyên môn đã được duyệt', note);
    return this.view(currentUser, document.id);
  }

  private async signDocument(
    database: Executor,
    currentUser: CurrentUser,
    document: DocumentRow,
    signedAt: Date,
  ): Promise<{ key: string; pdf: Buffer; method: string }> {
    const certificate = await this.databases.system.selectFrom('signing_certificates').selectAll().executeTakeFirst();
    if (certificate?.status !== 'registered') {
      throw professionalRule(
        'Thư mục cần kí nhưng chứng thư số nhà trường chưa đăng ký kí nội bộ (Quản lý kí hồ sơ, mục 1.1); đăng ký trước khi duyệt',
      );
    }
    if (certificate.valid_to && certificate.valid_to < this.today()) {
      throw professionalRule('Chứng thư số nhà trường đã hết hiệu lực');
    }
    if (!isSigningProvider(certificate.provider)) {
      throw professionalRule(
        'Nhà phát hành chứng thư không có trong danh sách của Sở; đăng ký lại chứng thư (Quản lý kí hồ sơ, mục 1.1)',
      );
    }
    const version = await database
      .selectFrom('professional_document_versions as versions')
      .innerJoin('files', 'files.id', 'versions.file_id')
      .select(['versions.version_no', 'versions.sha256', 'files.file_name', 'files.storage_key'])
      .where('versions.document_id', '=', document.id)
      .orderBy('versions.version_no', 'desc')
      .executeTakeFirst();
    if (!version) {
      throw professionalRule('Hồ sơ chưa có tệp để kí');
    }
    const folder = await this.folder(database, document.folder_id);
    const sealImage =
      certificate.seal_storage_key && certificate.seal_content_type
        ? `data:${certificate.seal_content_type};base64,${(await this.fileStorage.get(certificate.seal_storage_key)).toString('base64')}`
        : null;
    const title = 'HỒ SƠ CHUYÊN MÔN ĐÃ DUYỆT';
    const result = await this.signer.sign({
      code: `HSCM-${document.id.slice(0, 8).toUpperCase()}`,
      title,
      heading: [title, `${PROFESSIONAL_BRANCH_LABELS[document.branch]}: ${folder.name}`],
      sheets: [
        {
          title,
          columns: [
            { key: 'label', label: 'Thông tin', width: 22 },
            { key: 'value', label: 'Nội dung', width: 70 },
          ],
          rows: [
            { label: 'Tên hồ sơ', value: document.title },
            { label: 'Thư mục', value: folder.name },
            { label: 'Người nộp', value: document.owner_name },
            { label: 'Tổ trưởng duyệt', value: document.leader_name ?? '' },
            { label: 'Phiên bản', value: String(version.version_no) },
            { label: 'Tệp đã duyệt', value: version.file_name },
            { label: 'Mã băm SHA-256 của tệp', value: version.sha256 },
          ],
        },
      ],
      originalPdf: await this.fileStorage.get(version.storage_key),
      originalSha256: version.sha256,
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
    const key = storageKey('professional-records', document.id, randomUUID());
    await this.fileStorage.put(key, result.pdf, CONTENT_TYPES.pdf);
    return { key, pdf: result.pdf, method: result.method };
  }

  async giveBack(currentUser: CurrentUser, id: string, note: string) {
    const context = await this.context(currentUser);
    this.assertUnlocked(context);
    const document = await this.visibleDocument(context, currentUser, id);
    if (!this.canReview(context, currentUser, document) && !this.canApprove(context, currentUser, document)) {
      throw professionalRule('Chỉ người đang được chờ duyệt trả lại được hồ sơ');
    }
    await context.database.transaction().execute(async (transaction) => {
      const changed = await transaction
        .updateTable('professional_documents')
        .set({ status: 'returned', return_note: note, updated_at: this.clock.now() })
        .where('id', '=', id)
        .where('status', '=', document.status)
        .executeTakeFirst();
      if (Number(changed.numUpdatedRows) !== 1) {
        throw professionalRule('Hồ sơ vừa được người khác xử lý');
      }
      await this.event(transaction, id, 'return', note, currentUser);
    });
    await this.notifyOwner(context.database, document, 'Hồ sơ chuyên môn bị trả lại', note);
    return this.view(currentUser, id);
  }

  private async event(
    executor: Executor,
    documentId: string,
    action: ProfessionalDocumentAction,
    note: string | null,
    currentUser: CurrentUser,
  ): Promise<void> {
    await executor
      .insertInto('professional_document_events')
      .values({
        document_id: documentId,
        action,
        note,
        actor_id: currentUser.id,
        actor_name: currentUser.description.full_name,
      })
      .execute();
  }

  private async notifyOwner(database: Executor, document: DocumentRow, title: string, note: string | null) {
    await queueNotification(database, {
      orgUnitId: document.org_unit_id,
      templateCode: 'professional_record',
      title,
      body: [document.title, note].filter(Boolean).join(': '),
      targetType: 'professional_document',
      targetId: document.id,
      recipients: [{ userId: document.owner_user_id, channel: 'in_app' }],
    });
  }

  private async notifyLeaders(database: Executor, document: DocumentRow, title: string) {
    let recipients: NotificationRecipient[] = [];
    if (document.work_group_id) {
      const leaders = await database
        .selectFrom('professional_work_group_members as members')
        .innerJoin('staff', 'staff.id', 'members.staff_id')
        .select('staff.user_id')
        .where('members.group_id', '=', document.work_group_id)
        .where('members.is_leader', '=', true)
        .execute();
      recipients = leaders
        .filter((leader): leader is { user_id: string } => leader.user_id !== null)
        .map((leader) => ({ userId: leader.user_id, channel: 'in_app' }));
    } else if (document.department_id) {
      // Quyền ở dịch vụ định danh nên không lọc được theo tổ ở đây: gửi người có vai trò tổ trưởng ở đơn vị của hồ sơ
      recipients = [{ roleCode: 'VT-17', orgUnitId: document.org_unit_id, channel: 'in_app' }];
    }
    await queueNotification(database, {
      orgUnitId: document.org_unit_id,
      templateCode: 'professional_record',
      title,
      body: `${document.owner_name}: ${document.title}`,
      targetType: 'professional_document',
      targetId: document.id,
      recipients,
    });
  }

  private async notifyApprovers(database: Executor, document: DocumentRow) {
    await queueNotification(database, {
      orgUnitId: document.org_unit_id,
      templateCode: 'professional_record',
      title: 'Hồ sơ chuyên môn chờ Ban Giám hiệu duyệt',
      body: `${document.owner_name}: ${document.title}`,
      targetType: 'professional_document',
      targetId: document.id,
      recipients: [
        { roleCode: 'VT-02', orgUnitId: document.org_unit_id, channel: 'in_app' },
        { roleCode: 'VT-15', orgUnitId: document.org_unit_id, channel: 'in_app' },
      ],
    });
  }

  // ---- Thống kê ----

  // Thống kê nộp đúng hạn, nộp trễ, chưa nộp theo đợt và theo tổ
  async statistics(currentUser: CurrentUser, roundId: string | null) {
    const context = await this.context(currentUser);
    if (!currentUser.hasPermission(MANAGE) && !currentUser.hasPermission(APPROVE)) {
      throw forbidden('Chỉ Ban Giám hiệu, người quản lý kho xem thống kê');
    }
    let query = context.database.selectFrom('professional_rounds').selectAll().orderBy('due_at', 'desc');
    if (roundId) {
      query = query.where('id', '=', roundId);
    }
    const rounds = (await query.limit(100).execute()).filter(
      (round) => inScope(context.manageScope, round.org_unit_id) || inScope(context.approveScope, round.org_unit_id),
    );
    const byDepartment = new Map<string, { department: string; on_time: number; late: number; missing: number }>();
    const result = [];
    for (const round of rounds) {
      const submitters = await this.submitters(context.database, round);
      const count = (state: RoundSubmitter['state'][]) => submitters.filter((item) => state.includes(item.state)).length;
      result.push({
        id: round.id,
        title: round.title,
        due_at: round.due_at,
        status: round.status,
        submitter_kind: round.submitter_kind,
        expected: submitters.length,
        on_time: count(['on_time']),
        late: count(['late']),
        missing: count(['missing', 'draft']),
        on_time_percent:
          submitters.length === 0 ? null : Math.round((count(['on_time']) / submitters.length) * 1000) / 10,
      });
      for (const item of submitters) {
        const name = item.department_name ?? 'Chưa thuộc tổ';
        const row = byDepartment.get(name) ?? { department: name, on_time: 0, late: 0, missing: 0 };
        if (item.state === 'on_time') {
          row.on_time += 1;
        } else if (item.state === 'late') {
          row.late += 1;
        } else {
          row.missing += 1;
        }
        byDepartment.set(name, row);
      }
    }
    return {
      rounds: result,
      departments: [...byDepartment.values()].sort((left, right) => left.department.localeCompare(right.department, 'vi')),
      totals: {
        expected: result.reduce((sum, round) => sum + round.expected, 0),
        on_time: result.reduce((sum, round) => sum + round.on_time, 0),
        late: result.reduce((sum, round) => sum + round.late, 0),
        missing: result.reduce((sum, round) => sum + round.missing, 0),
      },
    };
  }

  // ---- Nguồn cho Việc của tôi ----

  async pendingWork(currentUser: CurrentUser) {
    const current = await this.currentSchoolYear.find();
    if (!current) {
      return { review: [], returned: [], rounds: [] };
    }
    const context = await this.context(currentUser, current.database);
    const select = [
      'professional_documents.id',
      'professional_documents.title',
      'professional_documents.owner_name',
      'professional_documents.status',
      'professional_documents.updated_at',
      'professional_documents.round_id',
    ] as const;
    const review = await context.database
      .selectFrom('professional_documents')
      .select(select)
      .where(this.pendingReviewCondition(context, currentUser))
      .orderBy('updated_at')
      .limit(100)
      .execute();
    const returned = await context.database
      .selectFrom('professional_documents')
      .select([...select, 'professional_documents.return_note'])
      .where('owner_user_id', '=', currentUser.id)
      .where('status', '=', 'returned')
      .limit(100)
      .execute();
    const rounds = [];
    if (context.staff && currentUser.hasPermission(USE)) {
      const open = await context.database
        .selectFrom('professional_rounds')
        .selectAll()
        .where('status', '=', 'open')
        .where('opens_on', '<=', this.today())
        .execute();
      for (const round of open) {
        const applies =
          (round.org_unit_id === null || round.org_unit_id === context.staff.org_unit_id) &&
          (!round.department_ids ||
            round.department_ids.length === 0 ||
            (context.staff.department_id !== null && round.department_ids.includes(context.staff.department_id)));
        if (!applies) {
          continue;
        }
        // Đợt nộp theo tổ: tổ trưởng của tổ nộp
        const leadsDepartment = currentUser.hasPermission(REVIEW) && context.staff.department_id !== null;
        if (round.submitter_kind === 'group' && !leadsDepartment) {
          continue;
        }
        const submitted = await context.database
          .selectFrom('professional_documents')
          .select(['id', 'submitted_at'])
          .where('round_id', '=', round.id)
          .where((eb) =>
            round.submitter_kind === 'staff'
              ? eb('owner_staff_id', '=', context.staff?.id ?? '')
              : eb('department_id', '=', context.staff?.department_id ?? ''),
          )
          .executeTakeFirst();
        if (!submitted?.submitted_at) {
          rounds.push({ ...round, document_id: submitted?.id ?? null });
        }
      }
    }
    return { review, returned, rounds };
  }
}
