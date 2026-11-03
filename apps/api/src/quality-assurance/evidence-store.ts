import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  bracketEvidenceCode,
  coveragePercent,
  EVIDENCE_EVENT_LABELS,
  EVIDENCE_EXPIRING_DAYS,
  EVIDENCE_RECORD_TYPE_LABELS,
  EVIDENCE_RULE_CODE,
  EVIDENCE_VALIDITY_LABELS,
  evidenceCoverage,
  evidencePackageFileName,
  evidenceValidity,
  DEFAULT_EVIDENCE_CODE_PATTERN,
  formatEvidenceCode,
  formatEvidenceCodePattern,
  PERMISSION_CODES,
  PROFESSIONAL_EVIDENCE_FRAMEWORKS,
  QUALITY_EVIDENCE_STATUS_LABELS,
  QUALITY_MAXIMUM_FILE_BYTES,
  type EvidenceEventActionCode,
  type EvidenceRecordTypeCode,
  type EvidenceValidityCode,
  type QualityEvidenceStatusCode,
} from '@school-management/shared';
import { sql, type Kysely, type Transaction } from 'kysely';
import { createHash, randomUUID } from 'node:crypto';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import { detectArchiveFileType } from '../archives/archives.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { CurrentSchoolYearResolver } from '../common/current-school-year.js';
import { Databases } from '../common/databases.js';
import { notFoundError } from '../common/request-fields.js';
import { storageKey } from '../common/resource-names.js';
import { ExportJobs } from '../exports/export-jobs.js';
import { ProfessionalStandardsService } from '../professional-standards/professional-standards.js';
import { buildTableFile, CONTENT_TYPES, type TableFileFormat } from '../exports/table-file.js';
import type { ExportedFile } from '../facilities/facilities-workbook.js';
import { FileStorage } from '../files/file-storage.js';
import { buildDocx, DOCX_TYPE, type DocumentBlock } from '../kpi/kpi-documents.js';
import { ZipWriter } from '../school-data-export/zip-writer.js';
import { escapeLike } from '../incoming-documents/incoming-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';
import { EvidenceSources, likePattern, type SourceContext } from './evidence-sources.js';

// Kho minh chứng dùng chung của trường (YCTD-396 lát L1). Minh chứng ở cơ sở dữ liệu hệ thống nên dùng cho nhiều năm học mà
// không chép (Q-396-2); mỗi bộ tiêu chí cấp một mã theo tiêu chí chính, dùng chung cho tiêu chí khác giữ mã đó (BR-533 đến
// BR-535). Bộ tiêu chí lát này vẫn đọc từ cơ sở dữ liệu năm học đang dùng (bảng của 22f, mã định danh giữ nguyên khi chuyển
// năm). Mỗi phiên bản là tệp tải lên hoặc bản ghi trong phần mềm được chụp lúc gắn (Q-396-4). Tệp có dữ liệu cá nhân chỉ người
// có quyền xem nguồn tải được; mọi lần xem, tải ghi nhật ký (Q-396-5, BM-271). Minh chứng của các đợt 22f cũ chuyển sang kho
// một lần cho mỗi cơ sở dữ liệu năm học, lần đầu kho được mở
type SystemExecutor = Kysely<SystemDatabase> | Transaction<SystemDatabase>;
type YearExecutor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

const VIEW = PERMISSION_CODES.evidenceView;
const CONTRIBUTE = PERMISSION_CODES.evidenceContribute;
const MANAGE = PERMISSION_CODES.evidenceManage;
const REVIEW = PERMISSION_CODES.evidenceReview;
export const EVIDENCE_PERMISSIONS = [VIEW, CONTRIBUTE, MANAGE, REVIEW];
const MAXIMUM_LIST = 1000;
const OVERVIEW_MISSING = 20;
const OVERVIEW_EXPIRING = 50;
export const EVIDENCE_PACKAGE_REPORT_CODE = 'quality-evidence-package';

export function evidenceRule(message: string): ApplicationError {
  return ruleViolationError(EVIDENCE_RULE_CODE, message);
}

function forbidden(message: string): ApplicationError {
  return new ApplicationError('ERR_FORBIDDEN', message);
}

const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const standardBox = (code: string) => {
  const number = Number.parseInt(code, 10);
  return Number.isInteger(number) && number >= 1 && number <= 99 ? number : 1;
};

export interface EvidenceItemInput {
  title: string;
  document_number: string | null;
  issued_date: string | null;
  issuer: string | null;
  description: string | null;
  valid_until: string | null;
  status: QualityEvidenceStatusCode;
  school_year_names: string[];
  shared_node_ids: string[];
}

export interface EvidenceCreateInput extends EvidenceItemInput {
  framework_id: string;
  node_id: string;
  box: number | null;
  record_type: EvidenceRecordTypeCode | null;
  record_id: string | null;
  // Bộ của cá nhân: người được đánh giá; trống là người đang thêm (người quản lý kho chọn được người khác), lát L6
  subject_user_id: string | null;
}

export interface EvidenceAssignInput {
  framework_id: string;
  node_ids: string[];
  user_id: string | null;
  due_date: string | null;
  note: string | null;
}

export interface EvidenceReviewGrantInput {
  user_id: string;
  user_name: string;
  framework_id: string;
  valid_until: string;
  note: string | null;
}

export interface EvidenceListFilter {
  framework_id: string;
  node_id: string | null;
  status: QualityEvidenceStatusCode | null;
  validity: EvidenceValidityCode | null;
  q: string | null;
  subject_user_id: string | null;
}

interface StoreContext {
  system: Kysely<SystemDatabase>;
  year: { database: Kysely<SchoolYearDatabase>; name: string };
  staffId: string | null;
  manager: boolean;
  contributor: boolean;
  today: string;
  // Đoàn đánh giá ngoài (lát L8): chỉ có quyền xem theo giao; bộ được giao còn hạn, null là không giới hạn
  reviewer: boolean;
  grantedFrameworkIds: string[] | null;
}

interface Snapshot {
  record_type: EvidenceRecordTypeCode;
  record_id: string;
  record_school_year: string | null;
  record_label: string;
  record_updated_at: Date | null;
  file: { file_name: string; content_type: string; body: Buffer } | null;
  // Quyền xem nguồn ghi vào minh chứng khi bản chụp có dữ liệu cá nhân (BR-542)
  personal_data_permissions: string[] | null;
}

interface NodeInfo {
  id: string;
  code: string;
  title: string;
  framework_id: string;
  standard_code: string;
}

@Injectable()
export class EvidenceStoreService {
  constructor(
    private readonly currentSchoolYear: CurrentSchoolYearResolver,
    private readonly organizationScopes: OrganizationScopes,
    private readonly databases: Databases,
    private readonly fileStorage: FileStorage,
    private readonly clock: Clock,
    private readonly sourceRegistry: EvidenceSources,
    private readonly exportJobs: ExportJobs,
    private readonly professionalStandards: ProfessionalStandardsService,
  ) {
    exportJobs.register(EVIDENCE_PACKAGE_REPORT_CODE, {
      title: 'Gói hồ sơ minh chứng',
      run: (currentUser, parameters) => this.packageFile(currentUser, String(parameters.framework_id)),
    });
  }

  // Tạo gói hồ sơ minh chứng ở tác vụ nền; tệp xem ở Tệp đã tạo (lát L5)
  async requestPackage(currentUser: CurrentUser, frameworkId: string, ipAddress: string | null) {
    const context = await this.context(currentUser);
    if (!context.manager) {
      throw forbidden('Chỉ người quản lý kho minh chứng toàn trường tạo gói hồ sơ minh chứng');
    }
    await this.catalogOf(context.year.database, frameworkId);
    if ((await this.frameworkSubject(context.year.database, frameworkId)) === 'person') {
      throw evidenceRule('Gói hồ sơ chỉ tạo cho bộ tiêu chí của nhà trường; bộ của cá nhân xuất danh mục');
    }
    return this.exportJobs.queue(
      currentUser,
      EVIDENCE_PACKAGE_REPORT_CODE,
      { framework_id: frameworkId },
      'zip',
      ipAddress,
    );
  }

  private async context(currentUser: CurrentUser): Promise<StoreContext> {
    if (!EVIDENCE_PERMISSIONS.some((code) => currentUser.hasPermission(code))) {
      throw forbidden('Bạn không có quyền xem kho minh chứng');
    }
    const current = await this.currentSchoolYear.require();
    const year = await this.databases.system
      .selectFrom('academic_years')
      .select('name')
      .where('id', '=', current.academicYearId)
      .executeTakeFirstOrThrow();
    const staff = await current.database
      .selectFrom('staff')
      .select('id')
      .where('user_id', '=', currentUser.id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    const manager =
      currentUser.hasPermission(MANAGE) &&
      (await this.organizationScopes.resolveStaff(currentUser, MANAGE)).wholeSchool;
    await this.ensureImported();
    const today = VIETNAM_DATE.format(this.clock.now());
    const reviewer = ![VIEW, CONTRIBUTE, MANAGE].some((code) => currentUser.hasPermission(code));
    const grantedFrameworkIds = reviewer
      ? (
          await this.databases.system
            .selectFrom('evidence_review_grants')
            .select('framework_id')
            .where('user_id', '=', currentUser.id)
            .where('school_year_name', '=', year.name)
            .where('valid_until', '>=', today)
            .execute()
        ).map((row) => row.framework_id)
      : null;
    return {
      system: this.databases.system,
      year: { database: current.database, name: year.name },
      staffId: staff?.id ?? null,
      manager,
      contributor: manager || currentUser.hasPermission(CONTRIBUTE),
      today,
      reviewer,
      grantedFrameworkIds,
    };
  }

  // ---- Bộ tiêu chí (đọc từ năm học đang dùng) ----

  private async nodes(database: YearExecutor, frameworkId: string | null): Promise<NodeInfo[]> {
    let query = database
      .selectFrom('quality_criteria as criteria')
      .innerJoin('quality_standards as standards', 'standards.id', 'criteria.standard_id')
      .select([
        'criteria.id',
        'criteria.code',
        'criteria.title',
        'criteria.framework_id',
        'standards.code as standard_code',
      ])
      .orderBy('standards.sort_order')
      .orderBy('standards.code')
      .orderBy('criteria.sort_order')
      .orderBy('criteria.code');
    if (frameworkId) {
      query = query.where('criteria.framework_id', '=', frameworkId);
    }
    return query.execute();
  }

  // Bộ và cây tiêu chuẩn, tiêu chí cho ô chọn của kho
  async frameworks(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    const frameworks = await context.year.database
      .selectFrom('quality_frameworks')
      .select(['id', 'code', 'name', 'school_level', 'status', 'kind', 'subject'])
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const standards = await context.year.database
      .selectFrom('quality_standards')
      .select(['id', 'framework_id', 'code', 'title'])
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const criteria = await this.nodes(context.year.database, null);
    const granted = context.grantedFrameworkIds;
    return {
      reviewer: context.reviewer,
      can_contribute: context.contributor,
      can_manage: context.manager,
      school_year_name: context.year.name,
      frameworks: frameworks
        .filter((framework) => granted === null || granted.includes(framework.id))
        .map((framework) => ({
          ...framework,
          standards: standards
            .filter((standard) => standard.framework_id === framework.id)
            .map((standard) => ({
              ...standard,
              criteria: criteria
                .filter(
                  (criterion) => criterion.framework_id === framework.id && criterion.standard_code === standard.code,
                )
                .map((criterion) => ({ id: criterion.id, code: criterion.code, title: criterion.title })),
            })),
        })),
    };
  }

  // ---- Danh sách, chi tiết ----

  async list(currentUser: CurrentUser, filter: EvidenceListFilter) {
    const context = await this.context(currentUser);
    this.assertFramework(context, filter.framework_id);
    const nodes = await this.nodes(context.year.database, filter.framework_id);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    let query = context.system
      .selectFrom('evidence_items as items')
      .innerJoin('evidence_codes as codes', 'codes.evidence_id', 'items.id')
      .select([
        'items.id',
        'items.title',
        'items.document_number',
        'items.issued_date',
        'items.issuer',
        'items.status',
        'items.valid_until',
        'items.school_year_names',
        'items.has_personal_data',
        'items.personal_data_permission',
        'items.updated_at',
        'codes.code',
        'codes.box',
        'codes.sequence',
        'codes.primary_node_id',
      ])
      .where('codes.framework_id', '=', filter.framework_id)
      .orderBy('codes.box')
      .orderBy('codes.code')
      .limit(MAXIMUM_LIST);
    if (filter.node_id) {
      const nodeId = filter.node_id;
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('evidence_node_links as links')
            .select('links.evidence_id')
            .whereRef('links.evidence_id', '=', 'items.id')
            .where('links.node_id', '=', nodeId),
        ),
      );
    }
    if (filter.status) {
      query = query.where('items.status', '=', filter.status);
    }
    if (filter.q) {
      const pattern = `%${escapeLike(filter.q)}%`;
      query = query.where((eb) =>
        eb.or([
          eb('items.title', 'ilike', pattern),
          eb('codes.code', 'ilike', pattern),
          eb('items.document_number', 'ilike', pattern),
        ]),
      );
    }
    const subject = await this.subjectOf(context, currentUser, filter.framework_id, filter.subject_user_id);
    if (subject) {
      query = query.where('codes.subject_user_id', '=', subject);
    }
    const rows = await query.execute();
    const ids = rows.map((row) => row.id);
    const links =
      ids.length > 0
        ? await context.system
            .selectFrom('evidence_node_links')
            .select(['evidence_id', 'node_id', 'is_primary'])
            .where('evidence_id', 'in', ids)
            .where('framework_id', '=', filter.framework_id)
            .execute()
        : [];
    const versions = ids.length > 0 ? await this.latestVersions(context.system, ids) : new Map();
    const result = rows.map((row) => {
      const validity = evidenceValidity(row.valid_until, context.today);
      const version = versions.get(row.id);
      return {
        id: row.id,
        code: row.code,
        display_code: bracketEvidenceCode(row.code),
        title: row.title,
        document_number: row.document_number,
        issued_date: row.issued_date,
        issuer: row.issuer,
        status: row.status,
        status_label: QUALITY_EVIDENCE_STATUS_LABELS[row.status],
        valid_until: row.valid_until,
        validity,
        validity_label: EVIDENCE_VALIDITY_LABELS[validity],
        school_year_names: row.school_year_names,
        has_personal_data: row.has_personal_data,
        primary_node: this.nodeLabel(nodeById, row.primary_node_id),
        shared_nodes: links
          .filter((link) => link.evidence_id === row.id && !link.is_primary)
          .map((link) => this.nodeLabel(nodeById, link.node_id)),
        source_label: version ? this.sourceLabel(version) : 'Chưa có tệp',
        version_no: version?.version_no ?? null,
        updated_at: row.updated_at,
      };
    });
    return filter.validity ? result.filter((row) => row.validity === filter.validity) : result;
  }

  private nodeLabel(nodes: Map<string, NodeInfo>, id: string) {
    const node = nodes.get(id);
    return node
      ? { id, code: node.code, title: node.title, missing: false }
      : { id, code: '?', title: 'Tiêu chí không còn trong bộ năm học này', missing: true };
  }

  private sourceLabel(version: { source_kind: string; record_type: string | null; file_name: string | null }) {
    if (version.source_kind === 'record' && version.record_type && version.record_type in EVIDENCE_RECORD_TYPE_LABELS) {
      return EVIDENCE_RECORD_TYPE_LABELS[version.record_type as EvidenceRecordTypeCode];
    }
    return version.file_name ? 'Tệp tải lên' : 'Chưa có tệp';
  }

  private async latestVersions(system: SystemExecutor, ids: string[]) {
    const rows = await system
      .selectFrom('evidence_versions')
      .select(['evidence_id', 'version_no', 'source_kind', 'record_type', 'file_name', 'storage_key'])
      .where('evidence_id', 'in', ids)
      .orderBy('version_no', 'desc')
      .execute();
    const result = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!result.has(row.evidence_id)) {
        result.set(row.evidence_id, row);
      }
    }
    return result;
  }

  private async itemRow(system: SystemExecutor, id: string) {
    const row = await system.selectFrom('evidence_items').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) {
      throw notFoundError('Không tìm thấy minh chứng', 'evidence_item');
    }
    return row;
  }

  async detail(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    const item = await this.itemRow(context.system, id);
    await this.assertVisible(context, currentUser, item);
    const nodes = await this.nodes(context.year.database, null);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const frameworks = await context.year.database
      .selectFrom('quality_frameworks')
      .select(['id', 'code', 'name'])
      .execute();
    const codes = await context.system.selectFrom('evidence_codes').selectAll().where('evidence_id', '=', id).execute();
    const links = await context.system
      .selectFrom('evidence_node_links')
      .selectAll()
      .where('evidence_id', '=', id)
      .execute();
    const versions = await context.system
      .selectFrom('evidence_versions')
      .selectAll()
      .where('evidence_id', '=', id)
      .orderBy('version_no', 'desc')
      .execute();
    // Người quản lý kho xem cả nhật ký truy cập (BM-271); người khác chỉ thấy lịch sử thay đổi
    let events = context.system
      .selectFrom('evidence_events')
      .select(['action', 'version_no', 'detail', 'actor_name', 'created_at'])
      .where('evidence_id', '=', id)
      .orderBy('created_at', 'desc')
      .limit(200);
    if (!context.manager) {
      events = events.where('action', 'not in', ['view_file', 'download_file']);
    }
    const current = versions[0];
    const changed = current ? await this.sourceChanged(context, currentUser, current) : false;
    const validity = evidenceValidity(item.valid_until, context.today);
    return {
      ...item,
      status_label: QUALITY_EVIDENCE_STATUS_LABELS[item.status],
      validity,
      validity_label: EVIDENCE_VALIDITY_LABELS[validity],
      can_edit: this.canEdit(context, currentUser, item),
      can_delete: context.manager,
      can_download: this.canDownload(currentUser, item),
      source_changed: changed,
      codes: codes.map((code) => {
        const framework = frameworks.find((row) => row.id === code.framework_id);
        return {
          framework_id: code.framework_id,
          framework_name: framework ? `${framework.code} · ${framework.name}` : 'Bộ không còn ở năm học này',
          code: code.code,
          display_code: bracketEvidenceCode(code.code),
          primary_node: this.nodeLabel(nodeById, code.primary_node_id),
          shared_nodes: links
            .filter((link) => link.framework_id === code.framework_id && !link.is_primary)
            .map((link) => this.nodeLabel(nodeById, link.node_id)),
        };
      }),
      versions: versions.map((version) => ({
        version_no: version.version_no,
        source_kind: version.source_kind,
        source_label: this.sourceLabel(version),
        record_type: version.record_type,
        record_id: version.record_id,
        record_label: version.record_label,
        record_school_year: version.record_school_year,
        file_name: version.file_name,
        size_bytes: version.size_bytes,
        has_file: version.storage_key !== null,
        note: version.note,
        created_by_name: version.created_by_name,
        created_at: version.created_at,
      })),
      events: (await events.execute()).map((event) => ({
        ...event,
        action_label: EVIDENCE_EVENT_LABELS[event.action as EvidenceEventActionCode],
      })),
    };
  }

  // Bản ghi nguồn đã sửa sau lần chụp (BR-541): so thời điểm sửa của bản ghi với thời điểm ghi ở phiên bản
  private async sourceChanged(
    context: StoreContext,
    currentUser: CurrentUser,
    version: {
      source_kind: string;
      record_type: string | null;
      record_id: string | null;
      record_updated_at: Date | null;
    },
  ): Promise<boolean> {
    if (version.source_kind !== 'record' || !version.record_id || !version.record_updated_at) {
      return false;
    }
    const updated = await this.sourceRegistry
      .get(version.record_type as EvidenceRecordTypeCode)
      .updatedAt(this.sourceContext(context, currentUser), version.record_id);
    return updated !== null && updated.getTime() > version.record_updated_at.getTime();
  }

  // ---- Phân công, độ phủ, tổng quan (lát L4) ----

  // Các năm học của chu kỳ đánh giá: năm đang dùng và các năm liền trước, tổng cộng `cycle_years` năm (theo tên năm học)
  private async cycleYearNames(context: StoreContext, cycleYears: number): Promise<string[]> {
    const rows = await context.system
      .selectFrom('academic_years')
      .select('name')
      .where('name', '<=', context.year.name)
      .orderBy('name', 'desc')
      .limit(Math.max(1, cycleYears))
      .execute();
    const names = rows.map((row) => row.name);
    return names.includes(context.year.name) ? names : [context.year.name, ...names].slice(0, Math.max(1, cycleYears));
  }

  private async frameworkRow(context: StoreContext, frameworkId: string) {
    const framework = await context.year.database
      .selectFrom('quality_frameworks')
      .select(['id', 'code', 'name', 'kind', 'subject', 'cycle_years'])
      .where('id', '=', frameworkId)
      .executeTakeFirst();
    if (!framework) {
      throw notFoundError('Không tìm thấy bộ tiêu chí trong năm học đang dùng', 'quality_framework');
    }
    return framework;
  }

  // Độ phủ của từng tiêu chí trong một bộ: số minh chứng theo trạng thái, tiêu chí thiếu, người phụ trách năm học đang dùng và
  // trưởng nhóm công tác của đợt tự đánh giá chưa hoàn thành (gợi ý phân công, MH-683)
  private async coverageOf(context: StoreContext, frameworkId: string, subject: string | null = null) {
    const framework = await this.frameworkRow(context, frameworkId);
    const cycleYearNames = await this.cycleYearNames(context, framework.cycle_years);
    const criteria = await context.year.database
      .selectFrom('quality_criteria as criteria')
      .innerJoin('quality_standards as standards', 'standards.id', 'criteria.standard_id')
      .select([
        'criteria.id',
        'criteria.code',
        'criteria.title',
        'criteria.evidence_hint',
        'standards.id as standard_id',
        'standards.code as standard_code',
        'standards.title as standard_title',
      ])
      .where('criteria.framework_id', '=', frameworkId)
      .orderBy('standards.sort_order')
      .orderBy('standards.code')
      .orderBy('criteria.sort_order')
      .orderBy('criteria.code')
      .execute();
    const links = await context.system
      .selectFrom('evidence_node_links as links')
      .innerJoin('evidence_items as items', 'items.id', 'links.evidence_id')
      .select(['links.node_id', 'items.status', 'items.valid_until', 'items.school_year_names'])
      .where('links.framework_id', '=', frameworkId)
      .$if(subject !== null, (query) => query.where('items.subject_user_id', '=', subject))
      .execute();
    const assignments = await context.system
      .selectFrom('evidence_assignments')
      .select(['node_id', 'user_id', 'user_name', 'due_date', 'note'])
      .where('framework_id', '=', frameworkId)
      .where('school_year_name', '=', context.year.name)
      .execute();
    const leaders = await this.groupLeaders(
      context,
      criteria.map((row) => row.id),
    );
    const rows = criteria.map((criterion) => {
      const counts = evidenceCoverage(
        links.filter((link) => link.node_id === criterion.id),
        cycleYearNames,
        context.today,
      );
      const assignment = assignments.find((row) => row.node_id === criterion.id) ?? null;
      return {
        ...criterion,
        ...counts,
        assignee: assignment,
        group_leader: leaders.get(criterion.id) ?? null,
      };
    });
    return { framework, cycleYearNames, rows };
  }

  // Trưởng nhóm công tác (có tài khoản) của tiêu chí ở đợt tự đánh giá chưa hoàn thành
  private async groupLeaders(context: StoreContext, nodeIds: string[]) {
    if (nodeIds.length === 0) {
      return new Map<string, { user_id: string; user_name: string }>();
    }
    const rows = await context.year.database
      .selectFrom('quality_criterion_reports as reports')
      .innerJoin('quality_assessments as assessments', 'assessments.id', 'reports.assessment_id')
      .innerJoin('quality_work_groups as groups', 'groups.id', 'reports.work_group_id')
      .innerJoin('staff', 'staff.id', 'groups.leader_staff_id')
      .select(['reports.criterion_id', 'staff.user_id', 'staff.full_name'])
      .where('reports.criterion_id', 'in', nodeIds)
      .where('assessments.status', '<>', 'completed')
      .where('staff.user_id', 'is not', null)
      .orderBy('assessments.created_at', 'desc')
      .execute();
    const leaders = new Map<string, { user_id: string; user_name: string }>();
    for (const row of rows) {
      if (row.user_id && !leaders.has(row.criterion_id)) {
        leaders.set(row.criterion_id, { user_id: row.user_id, user_name: row.full_name });
      }
    }
    return leaders;
  }

  // Bảng độ phủ theo tiêu chí (MH-682)
  async coverage(currentUser: CurrentUser, frameworkId: string, subjectUserId: string | null = null) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    const subject = await this.subjectOf(context, currentUser, frameworkId, subjectUserId);
    const { framework, cycleYearNames, rows } = await this.coverageOf(context, frameworkId, subject);
    const covered = rows.filter((row) => row.covered).length;
    return {
      framework,
      subject_user_id: subject,
      school_year_name: context.year.name,
      cycle_year_names: cycleYearNames,
      can_manage: context.manager,
      criterion_count: rows.length,
      covered_count: covered,
      covered_percent: coveragePercent(covered, rows.length),
      criteria: rows,
    };
  }

  // Tổng quan (MH-678): tỉ lệ tiêu chí đủ minh chứng của từng bộ, từng tiêu chuẩn; tiêu chí thiếu; minh chứng sắp hết hoặc
  // đã hết hiệu lực; tiêu chí được phân công cho người đang xem
  async overview(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    const frameworks = await context.year.database
      .selectFrom('quality_frameworks')
      .select(['id', 'subject'])
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const summaries = [];
    const mine = [];
    const personal = [];
    for (const { id, subject } of frameworks) {
      if (subject === 'person') {
        const own = await context.system
          .selectFrom('evidence_codes')
          .select('evidence_id')
          .where('framework_id', '=', id)
          .where('subject_user_id', '=', currentUser.id)
          .executeTakeFirst();
        if (own) {
          const { framework, rows } = await this.coverageOf(context, id, currentUser.id);
          const covered = rows.filter((row) => row.covered).length;
          personal.push({
            id: framework.id,
            code: framework.code,
            name: framework.name,
            criterion_count: rows.length,
            covered_count: covered,
            covered_percent: coveragePercent(covered, rows.length),
          });
        }
        continue;
      }
      const { framework, rows } = await this.coverageOf(context, id);
      const standards = new Map<
        string,
        { code: string; title: string; criterion_count: number; covered_count: number }
      >();
      for (const row of rows) {
        const standard = standards.get(row.standard_id) ?? {
          code: row.standard_code,
          title: row.standard_title,
          criterion_count: 0,
          covered_count: 0,
        };
        standard.criterion_count += 1;
        standard.covered_count += row.covered ? 1 : 0;
        standards.set(row.standard_id, standard);
      }
      const missing = rows.filter((row) => !row.covered);
      summaries.push({
        id: framework.id,
        code: framework.code,
        name: framework.name,
        criterion_count: rows.length,
        covered_count: rows.length - missing.length,
        covered_percent: coveragePercent(rows.length - missing.length, rows.length),
        standards: [...standards.values()].map((standard) => ({
          ...standard,
          covered_percent: coveragePercent(standard.covered_count, standard.criterion_count),
        })),
        missing: missing.slice(0, OVERVIEW_MISSING).map((row) => ({
          id: row.id,
          code: row.code,
          title: row.title,
          assignee_name: row.assignee?.user_name ?? null,
          due_date: row.assignee?.due_date ?? null,
        })),
        missing_count: missing.length,
      });
      for (const row of rows) {
        if (row.assignee?.user_id === currentUser.id) {
          mine.push({
            framework_id: framework.id,
            framework_name: framework.name,
            id: row.id,
            code: row.code,
            title: row.title,
            due_date: row.assignee.due_date,
            covered: row.covered,
          });
        }
      }
    }
    return {
      school_year_name: context.year.name,
      can_manage: context.manager,
      frameworks: summaries,
      expiring: await this.expiringEvidences(context, null),
      mine,
      personal,
    };
  }

  // Minh chứng còn dùng (chưa Cần cập nhật) sắp hết hoặc đã hết hiệu lực; `userId` lọc minh chứng người đó tạo hoặc phụ trách
  private async expiringEvidences(context: StoreContext, userId: string | null) {
    const limit = new Date(`${context.today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + EVIDENCE_EXPIRING_DAYS);
    let query = context.system
      .selectFrom('evidence_items')
      .select(['id', 'title', 'valid_until', 'status'])
      .where('valid_until', 'is not', null)
      .where('valid_until', '<=', limit.toISOString().slice(0, 10))
      .where('status', '<>', 'needs_update')
      .orderBy('valid_until')
      .limit(OVERVIEW_EXPIRING);
    if (userId) {
      query = query.where((eb) => eb.or([eb('owner_user_id', '=', userId), eb('created_by', '=', userId)]));
    }
    const rows = await query.execute();
    return rows.map((row) => {
      const validity = evidenceValidity(row.valid_until, context.today);
      return { ...row, validity, validity_label: EVIDENCE_VALIDITY_LABELS[validity] };
    });
  }

  // Cán bộ có tài khoản của năm học đang dùng, để chọn người phụ trách
  async assignees(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    return context.year.database
      .selectFrom('staff')
      .select(['user_id', 'full_name', 'code'])
      .where('status', '=', 'active')
      .where('user_id', 'is not', null)
      .orderBy('full_name')
      .execute();
  }

  private assertManager(context: StoreContext) {
    if (!context.manager) {
      throw forbidden('Chỉ người quản lý kho minh chứng toàn trường phân công phụ trách tiêu chí');
    }
  }

  // Phân công (hoặc bỏ phân công khi `user_id` trống) cho nhiều tiêu chí của một bộ trong năm học đang dùng (MH-683)
  async assign(currentUser: CurrentUser, input: EvidenceAssignInput) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await this.frameworkRow(context, input.framework_id);
    const nodes = await context.year.database
      .selectFrom('quality_criteria')
      .select('id')
      .where('framework_id', '=', input.framework_id)
      .where('id', 'in', input.node_ids)
      .execute();
    if (nodes.length !== input.node_ids.length) {
      throw evidenceRule('Có tiêu chí không thuộc bộ đã chọn');
    }
    if (!input.user_id) {
      const removed = await context.system
        .deleteFrom('evidence_assignments')
        .where('framework_id', '=', input.framework_id)
        .where('school_year_name', '=', context.year.name)
        .where('node_id', 'in', input.node_ids)
        .executeTakeFirst();
      return { assigned: 0, removed: Number(removed.numDeletedRows) };
    }
    const staff = await context.year.database
      .selectFrom('staff')
      .select(['user_id', 'full_name'])
      .where('user_id', '=', input.user_id)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!staff) {
      throw evidenceRule('Người phụ trách phải là cán bộ đang làm việc, có tài khoản trong năm học đang dùng');
    }
    await this.upsertAssignments(
      context,
      currentUser,
      input.framework_id,
      input.node_ids.map((nodeId) => ({
        node_id: nodeId,
        user_id: input.user_id as string,
        user_name: staff.full_name,
        due_date: input.due_date,
        note: input.note,
      })),
    );
    return { assigned: input.node_ids.length, removed: 0 };
  }

  // Tiêu chí chưa có người phụ trách nhận trưởng nhóm công tác của đợt tự đánh giá làm người phụ trách (sửa được sau)
  async assignFromGroups(currentUser: CurrentUser, frameworkId: string) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    const { rows } = await this.coverageOf(context, frameworkId);
    const values = rows
      .filter((row) => !row.assignee && row.group_leader)
      .map((row) => ({
        node_id: row.id,
        user_id: row.group_leader?.user_id as string,
        user_name: row.group_leader?.user_name as string,
        due_date: null,
        note: null,
      }));
    await this.upsertAssignments(context, currentUser, frameworkId, values);
    return { assigned: values.length };
  }

  private async upsertAssignments(
    context: StoreContext,
    currentUser: CurrentUser,
    frameworkId: string,
    values: Array<{
      node_id: string;
      user_id: string;
      user_name: string;
      due_date: string | null;
      note: string | null;
    }>,
  ) {
    if (values.length === 0) {
      return;
    }
    await context.system
      .insertInto('evidence_assignments')
      .values(
        values.map((value) => ({
          ...value,
          framework_id: frameworkId,
          school_year_name: context.year.name,
          assigned_by: currentUser.id,
          assigned_by_name: currentUser.description.full_name,
        })),
      )
      .onConflict((conflict) =>
        conflict.columns(['framework_id', 'node_id', 'school_year_name']).doUpdateSet((eb) => ({
          user_id: eb.ref('excluded.user_id'),
          user_name: eb.ref('excluded.user_name'),
          due_date: eb.ref('excluded.due_date'),
          note: eb.ref('excluded.note'),
          assigned_by: eb.ref('excluded.assigned_by'),
          assigned_by_name: eb.ref('excluded.assigned_by_name'),
          updated_at: new Date(),
        })),
      )
      .execute();
  }

  // Việc của tôi (nguồn "Minh chứng"): tiêu chí được phân công còn thiếu minh chứng; minh chứng mình tạo hoặc phụ trách sắp
  // hết hoặc đã hết hiệu lực
  async pendingWork(currentUser: CurrentUser) {
    // Chưa mở năm học thì chưa có bộ tiêu chí, không có việc
    if (
      !EVIDENCE_PERMISSIONS.some((code) => currentUser.hasPermission(code)) ||
      !(await this.currentSchoolYear.find())
    ) {
      return { missing: [], expiring: [] };
    }
    const context = await this.context(currentUser);
    const frameworkIds = [
      ...new Set(
        (
          await context.system
            .selectFrom('evidence_assignments')
            .select('framework_id')
            .where('user_id', '=', currentUser.id)
            .where('school_year_name', '=', context.year.name)
            .execute()
        ).map((row) => row.framework_id),
      ),
    ];
    const missing = [];
    for (const frameworkId of frameworkIds) {
      const exists = await context.year.database
        .selectFrom('quality_frameworks')
        .select('id')
        .where('id', '=', frameworkId)
        .executeTakeFirst();
      if (!exists) {
        continue;
      }
      const { framework, rows } = await this.coverageOf(context, frameworkId);
      for (const row of rows) {
        if (row.assignee?.user_id === currentUser.id && !row.covered) {
          missing.push({
            framework_id: framework.id,
            framework_name: framework.name,
            code: row.code,
            title: row.title,
            due_date: row.assignee.due_date,
            assigned_at: null,
          });
        }
      }
    }
    return { missing, expiring: await this.expiringEvidences(context, currentUser.id) };
  }

  // ---- Chủ thể của minh chứng (lát L6) ----

  private async frameworkSubject(database: YearExecutor, frameworkId: string) {
    const row = await database
      .selectFrom('quality_frameworks')
      .select('subject')
      .where('id', '=', frameworkId)
      .executeTakeFirst();
    return row?.subject ?? 'school';
  }

  // Người được đánh giá của bộ cá nhân: mặc định người đang xem; chỉ người quản lý kho chọn người khác. Bộ của nhà trường: trống
  private async subjectOf(
    context: StoreContext,
    currentUser: CurrentUser,
    frameworkId: string,
    requested: string | null,
    write = false,
  ): Promise<string | null> {
    if ((await this.frameworkSubject(context.year.database, frameworkId)) !== 'person') {
      return null;
    }
    if (requested && requested !== currentUser.id && !context.manager) {
      // Xem minh chứng của người khác: người đánh giá trực tiếp trong phạm vi (tổ trưởng, lát L10); thêm thì chỉ người quản lý kho
      if (write || !(await this.canReadPerson(context, currentUser, requested))) {
        throw forbidden(
          write
            ? 'Chỉ người quản lý kho thêm minh chứng cho cá nhân khác'
            : 'Bạn chỉ xem được minh chứng của cán bộ trong phạm vi đánh giá chuẩn nghề nghiệp của mình',
        );
      }
    }
    return requested ?? currentUser.id;
  }

  // Người đánh giá trực tiếp (YCTD-396 lát L10, Q-396-11 A): người có quyền đánh giá hoặc quản lý chuẩn nghề nghiệp (P07-05) ở
  // đơn vị của cán bộ, như phạm vi xem phiếu đánh giá chuẩn; tổ trưởng chuyên môn có quyền đánh giá ở tổ của mình
  private async canReadPerson(context: StoreContext, currentUser: CurrentUser, userId: string): Promise<boolean> {
    if (context.reviewer) {
      return false;
    }
    const staff = await context.year.database
      .selectFrom('staff')
      .select('org_unit_id')
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!staff) {
      return false;
    }
    const scope = await this.professionalStandards.readerScope(currentUser);
    return scope.wholeSchool || scope.orgUnitIds.includes(staff.org_unit_id);
  }

  // Cán bộ có tài khoản trong phạm vi xem minh chứng cá nhân của người đang xem (ô Người được đánh giá, lát L10)
  async people(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    const scope = context.manager
      ? { wholeSchool: true, orgUnitIds: [] as string[] }
      : await this.professionalStandards.readerScope(currentUser);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      return [];
    }
    return context.year.database
      .selectFrom('staff')
      .select(['user_id', 'full_name', 'code'])
      .where('status', '=', 'active')
      .where('user_id', 'is not', null)
      .where('user_id', '<>', currentUser.id)
      .$if(!scope.wholeSchool, (query) => query.where('org_unit_id', 'in', scope.orgUnitIds))
      .orderBy('full_name')
      .execute();
  }

  private async subjectName(context: StoreContext, currentUser: CurrentUser, userId: string) {
    if (userId === currentUser.id) {
      return currentUser.description.full_name;
    }
    const staff = await context.year.database
      .selectFrom('staff')
      .select('full_name')
      .where('user_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    if (!staff) {
      throw evidenceRule('Người được đánh giá phải là cán bộ đang làm việc, có tài khoản trong năm học đang dùng');
    }
    return staff.full_name;
  }

  // Minh chứng của cá nhân: người đó và người quản lý kho xem; đã gắn vào bộ của nhà trường thì người xem kho thấy (Q-396-11)
  private async assertVisible(
    context: StoreContext,
    currentUser: CurrentUser,
    item: { id: string; subject_user_id: string | null },
  ) {
    if (context.grantedFrameworkIds) {
      const granted = context.grantedFrameworkIds;
      const code =
        granted.length > 0
          ? await context.system
              .selectFrom('evidence_codes')
              .select('evidence_id')
              .where('evidence_id', '=', item.id)
              .where('framework_id', 'in', granted)
              .executeTakeFirst()
          : undefined;
      if (!code) {
        throw forbidden('Minh chứng không thuộc bộ tiêu chí được giao cho đoàn đánh giá');
      }
      return;
    }
    if (!item.subject_user_id || context.manager || item.subject_user_id === currentUser.id) {
      return;
    }
    if (await this.canReadPerson(context, currentUser, item.subject_user_id)) {
      return;
    }
    const schoolCode = await context.system
      .selectFrom('evidence_codes')
      .select('evidence_id')
      .where('evidence_id', '=', item.id)
      .where('subject_user_id', 'is', null)
      .executeTakeFirst();
    if (!schoolCode) {
      throw forbidden('Minh chứng của cá nhân; chỉ người đó, người đánh giá trực tiếp và người quản lý kho xem được');
    }
  }

  // ---- Phiếu đánh giá chuẩn nghề nghiệp (P07-05, lát L6b) ----

  // Minh chứng của người được đánh giá ở bộ chuẩn của cá nhân chép từ danh mục P07-05, theo từng tiêu chí của phiếu. Người xem
  // phiếu (chính người đó, người đánh giá trong phạm vi) xem được mã, tên, trạng thái; tệp vẫn theo quyền của kho (Q-396-11)
  async professionalEvidences(currentUser: CurrentUser, evaluationId: string) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    const evaluation = await this.professionalStandards.read(currentUser, evaluationId);
    const code = PROFESSIONAL_EVIDENCE_FRAMEWORKS.find((item) => item.standard_type === evaluation.standard_type)?.code;
    const framework = code
      ? await context.year.database
          .selectFrom('quality_frameworks')
          .select(['id', 'code', 'name'])
          .where('code', '=', code)
          .executeTakeFirst()
      : undefined;
    const staff = await context.year.database
      .selectFrom('staff')
      .select('user_id')
      .where('id', '=', evaluation.staff_id)
      .executeTakeFirst();
    if (!framework || !staff?.user_id) {
      return { framework: framework ?? null, subject_user_id: staff?.user_id ?? null, items: [] };
    }
    const nodes = new Map(
      (
        await context.year.database
          .selectFrom('quality_criteria')
          .select(['id', 'code'])
          .where('framework_id', '=', framework.id)
          .execute()
      ).map((row) => [row.id, row.code]),
    );
    const links = await this.byNodes(framework.id, null, staff.user_id);
    const items = new Map<
      string,
      Array<{ id: string; display_code: string; title: string; status_label: string; validity_label: string }>
    >();
    for (const link of links) {
      const criterionCode = nodes.get(link.node_id);
      if (!criterionCode) {
        continue;
      }
      const list = items.get(criterionCode) ?? [];
      if (!list.some((row) => row.id === link.id)) {
        list.push({
          id: link.id,
          display_code: link.display_code,
          title: link.title,
          status_label: link.status_label,
          validity_label: link.validity_label,
        });
      }
      items.set(criterionCode, list);
    }
    return {
      framework,
      subject_user_id: staff.user_id,
      items: [...items.entries()].map(([criterion_code, evidences]) => ({ criterion_code, evidences })),
    };
  }

  // ---- Đoàn đánh giá ngoài (lát L8) ----

  // Đoàn đánh giá chỉ xem bộ được giao còn hạn
  private assertFramework(context: StoreContext, frameworkId: string) {
    if (context.grantedFrameworkIds && !context.grantedFrameworkIds.includes(frameworkId)) {
      throw forbidden('Bộ tiêu chí chưa được giao cho đoàn đánh giá hoặc đã hết hạn giao');
    }
  }

  private assertStaff(context: StoreContext) {
    if (context.reviewer) {
      throw forbidden('Đoàn đánh giá ngoài chỉ xem danh sách, chi tiết, tệp và danh mục minh chứng của bộ được giao');
    }
  }

  // Các lần giao của năm học đang dùng (người quản lý kho)
  async reviewGrants(currentUser: CurrentUser) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    const grants = await context.system
      .selectFrom('evidence_review_grants')
      .select(['id', 'user_id', 'user_name', 'framework_id', 'valid_until', 'note', 'granted_by_name', 'updated_at'])
      .where('school_year_name', '=', context.year.name)
      .orderBy('user_name')
      .execute();
    const frameworks = new Map(
      (await context.year.database.selectFrom('quality_frameworks').select(['id', 'code', 'name']).execute()).map(
        (row) => [row.id, row],
      ),
    );
    return grants.map((grant) => ({
      ...grant,
      framework_code: frameworks.get(grant.framework_id)?.code ?? '',
      framework_name: frameworks.get(grant.framework_id)?.name ?? 'Bộ không còn ở năm học đang dùng',
      expired: grant.valid_until < context.today,
    }));
  }

  // Giao (hoặc gia hạn) một bộ cho một tài khoản đoàn đánh giá đến hết ngày giao (BR-555)
  async grantReview(currentUser: CurrentUser, input: EvidenceReviewGrantInput) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    await this.frameworkRow(context, input.framework_id);
    if (input.valid_until < context.today) {
      throw evidenceRule('Ngày hết hạn giao phải từ hôm nay trở đi');
    }
    const row = await context.system
      .insertInto('evidence_review_grants')
      .values({
        user_id: input.user_id,
        user_name: input.user_name,
        framework_id: input.framework_id,
        school_year_name: context.year.name,
        valid_until: input.valid_until,
        note: input.note,
        granted_by: currentUser.id,
        granted_by_name: currentUser.description.full_name,
      })
      .onConflict((conflict) =>
        conflict.columns(['user_id', 'framework_id', 'school_year_name']).doUpdateSet({
          user_name: input.user_name,
          valid_until: input.valid_until,
          note: input.note,
          granted_by: currentUser.id,
          granted_by_name: currentUser.description.full_name,
          updated_at: new Date(),
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: row.id };
  }

  async revokeReview(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    this.assertManager(context);
    const removed = await context.system.deleteFrom('evidence_review_grants').where('id', '=', id).executeTakeFirst();
    if (Number(removed.numDeletedRows) === 0) {
      throw notFoundError('Không tìm thấy lần giao', 'evidence_review_grant');
    }
  }

  // ---- Quyền sửa ----

  // Người quản lý kho sửa mọi minh chứng; người đóng góp sửa minh chứng mình tạo hoặc phụ trách, của tiêu chí mình được phân
  // công phụ trách trong năm học đang dùng (lát L4, BR-549), hoặc của tiêu chí giao cho nhóm công tác của mình ở đợt tự đánh
  // giá chưa hoàn thành (quy tắc của 22f)
  private canEdit(
    context: StoreContext,
    currentUser: CurrentUser,
    item: { created_by: string | null; owner_user_id: string | null },
  ): boolean {
    if (context.manager) {
      return true;
    }
    return context.contributor && (item.created_by === currentUser.id || item.owner_user_id === currentUser.id);
  }

  private async assertEditor(context: StoreContext, currentUser: CurrentUser, id: string) {
    const item = await this.itemRow(context.system, id);
    if (this.canEdit(context, currentUser, item)) {
      return item;
    }
    if (context.contributor) {
      const nodeIds = (
        await context.system.selectFrom('evidence_node_links').select('node_id').where('evidence_id', '=', id).execute()
      ).map((row) => row.node_id);
      if (
        nodeIds.length > 0 &&
        ((await this.assignedToCriteria(context, currentUser, nodeIds)) ||
          (await this.assignedToGroup(context, nodeIds)))
      ) {
        return item;
      }
    }
    throw forbidden(
      'Chỉ người tạo, người phụ trách, nhóm công tác của tiêu chí hoặc người quản lý kho sửa minh chứng này',
    );
  }

  // Người được phân công phụ trách một tiêu chí của minh chứng trong năm học đang dùng (lát L4)
  private async assignedToCriteria(context: StoreContext, currentUser: CurrentUser, nodeIds: string[]) {
    const row = await context.system
      .selectFrom('evidence_assignments')
      .select('id')
      .where('user_id', '=', currentUser.id)
      .where('school_year_name', '=', context.year.name)
      .where('node_id', 'in', nodeIds)
      .executeTakeFirst();
    return row !== undefined;
  }

  private async assignedToGroup(context: StoreContext, nodeIds: string[]): Promise<boolean> {
    const staffId = context.staffId;
    if (!staffId) {
      return false;
    }
    const row = await context.year.database
      .selectFrom('quality_criterion_reports as reports')
      .innerJoin('quality_assessments as assessments', 'assessments.id', 'reports.assessment_id')
      .innerJoin('quality_work_groups as groups', 'groups.id', 'reports.work_group_id')
      .leftJoin('quality_work_group_members as members', 'members.group_id', 'groups.id')
      .select('reports.id')
      .where('reports.criterion_id', 'in', nodeIds)
      .where('assessments.status', '<>', 'completed')
      .where((eb) => eb.or([eb('groups.leader_staff_id', '=', staffId), eb('members.staff_id', '=', staffId)]))
      .executeTakeFirst();
    return row !== undefined;
  }

  private canDownload(
    currentUser: CurrentUser,
    item: { has_personal_data: boolean; personal_data_permission: string | null },
  ): boolean {
    if (!item.has_personal_data) {
      return true;
    }
    return (item.personal_data_permission ?? '')
      .split(',')
      .some((code) => code !== '' && currentUser.hasPermission(code));
  }

  // ---- Tạo, sửa, xóa ----

  private async node(database: YearExecutor, frameworkId: string, id: string, field: string): Promise<NodeInfo> {
    const node = (await this.nodes(database, frameworkId)).find((row) => row.id === id);
    if (!node) {
      throw validationError([{ field, message: 'Tiêu chí không thuộc bộ tiêu chí đã chọn' }]);
    }
    return node;
  }

  private async checkSharedNodes(database: YearExecutor, frameworkId: string, primaryId: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const nodes = new Set((await this.nodes(database, frameworkId)).map((node) => node.id));
    if (ids.some((id) => !nodes.has(id))) {
      throw validationError([{ field: 'shared_node_ids', message: 'Có tiêu chí không thuộc bộ tiêu chí đã chọn' }]);
    }
    return [...new Set(ids)].filter((id) => id !== primaryId);
  }

  // Số thứ tự nhỏ nhất chưa dùng trong tiêu chí của bộ (BR-534)
  private async nextSequence(
    system: SystemExecutor,
    frameworkId: string,
    nodeId: string,
    subjectUserId: string | null,
  ): Promise<number> {
    const used = new Set(
      (
        await system
          .selectFrom('evidence_codes')
          .select('sequence')
          .where('framework_id', '=', frameworkId)
          .where('primary_node_id', '=', nodeId)
          .where('subject_user_id', subjectUserId ? '=' : 'is', subjectUserId)
          .execute()
      ).map((row) => row.sequence),
    );
    let sequence = 1;
    while (used.has(sequence)) {
      sequence += 1;
    }
    if (sequence > 999) {
      throw evidenceRule('Tiêu chí đã có 999 minh chứng');
    }
    return sequence;
  }

  // Mã theo mẫu của bộ (YCTD-396 lát L3); mặc định H{hop}-{tieu_chi}-{stt}
  private async codeOf(database: YearExecutor, frameworkId: string, box: number, node: NodeInfo, sequence: number) {
    const framework = await database
      .selectFrom('quality_frameworks')
      .select('code_pattern')
      .where('id', '=', frameworkId)
      .executeTakeFirst();
    return formatEvidenceCodePattern(framework?.code_pattern ?? DEFAULT_EVIDENCE_CODE_PATTERN, {
      box,
      standardCode: node.standard_code,
      criterionCode: node.code,
      sequence,
    }).slice(0, 50);
  }

  private checkDates(input: EvidenceItemInput) {
    if (input.valid_until && input.issued_date && input.valid_until < input.issued_date) {
      throw validationError([{ field: 'valid_until', message: 'Ngày hiệu lực phải sau ngày ban hành' }]);
    }
  }

  async create(currentUser: CurrentUser, input: EvidenceCreateInput) {
    const context = await this.context(currentUser);
    if (!context.contributor) {
      throw forbidden('Bạn không có quyền thêm minh chứng');
    }
    this.checkDates(input);
    const node = await this.node(context.year.database, input.framework_id, input.node_id, 'node_id');
    const shared = await this.checkSharedNodes(
      context.year.database,
      input.framework_id,
      node.id,
      input.shared_node_ids,
    );
    const snapshot =
      input.record_type && input.record_id
        ? await this.snapshot(context, currentUser, input.record_type, input.record_id)
        : null;
    const subject = await this.subjectOf(context, currentUser, input.framework_id, input.subject_user_id, true);
    const subjectName = subject ? await this.subjectName(context, currentUser, subject) : null;
    const stored = snapshot?.file ? await this.putFile(snapshot.file) : null;
    try {
      return await context.system.transaction().execute(async (transaction) => {
        const box = input.box ?? standardBox(node.standard_code);
        const sequence = await this.nextSequence(transaction, input.framework_id, node.id, subject);
        const code = await this.codeOf(context.year.database, input.framework_id, box, node, sequence);
        const taken = await transaction
          .selectFrom('evidence_codes')
          .select('evidence_id')
          .where('framework_id', '=', input.framework_id)
          .where('code', '=', code)
          .where('subject_user_id', subject ? '=' : 'is', subject)
          .executeTakeFirst();
        if (taken) {
          throw evidenceRule(`Mã ${bracketEvidenceCode(code)} đã có trong bộ; chọn số hộp khác`);
        }
        const item = await transaction
          .insertInto('evidence_items')
          .values({
            title: input.title,
            document_number: input.document_number,
            issued_date: input.issued_date,
            issuer: input.issuer,
            description: input.description,
            valid_until: input.valid_until,
            school_year_names: input.school_year_names.length > 0 ? input.school_year_names : [context.year.name],
            status: snapshot ? (input.status === 'missing' ? 'sufficient' : input.status) : input.status,
            owner_user_id: currentUser.id,
            owner_name: currentUser.description.full_name,
            created_by: currentUser.id,
            created_by_name: currentUser.description.full_name,
            subject_user_id: subject,
            subject_name: subjectName,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto('evidence_codes')
          .values({
            evidence_id: item.id,
            framework_id: input.framework_id,
            primary_node_id: node.id,
            box,
            sequence,
            code,
            subject_user_id: subject,
          })
          .execute();
        await transaction
          .insertInto('evidence_node_links')
          .values([
            { evidence_id: item.id, framework_id: input.framework_id, node_id: node.id, is_primary: true },
            ...shared.map((id) => ({
              evidence_id: item.id,
              framework_id: input.framework_id,
              node_id: id,
              is_primary: false,
            })),
          ])
          .execute();
        await this.event(
          transaction,
          item.id,
          'create',
          currentUser,
          null,
          `${bracketEvidenceCode(code)} ${input.title}`,
        );
        if (snapshot) {
          await this.insertVersion(transaction, item.id, currentUser, snapshot, stored);
        }
        return { id: item.id, code, display_code: bracketEvidenceCode(code) };
      });
    } catch (error) {
      if (stored) {
        await this.fileStorage.delete(stored.storage_key).catch(() => undefined);
      }
      throw error;
    }
  }

  // Gắn minh chứng đã có vào bộ tiêu chí khác: cấp mã riêng của bộ đó theo tiêu chí chính được chọn (BR-533)
  async attach(currentUser: CurrentUser, id: string, frameworkId: string, nodeId: string, box: number | null) {
    const context = await this.context(currentUser);
    const item = await this.assertEditor(context, currentUser, id);
    const node = await this.node(context.year.database, frameworkId, nodeId, 'node_id');
    const personal = (await this.frameworkSubject(context.year.database, frameworkId)) === 'person';
    if (personal && !item.subject_user_id) {
      throw evidenceRule('Minh chứng của nhà trường không gắn vào bộ tiêu chí của cá nhân');
    }
    const subject = personal ? item.subject_user_id : null;
    const result = await context.system.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('evidence_codes')
        .select('code')
        .where('evidence_id', '=', id)
        .where('framework_id', '=', frameworkId)
        .executeTakeFirst();
      if (existing) {
        throw evidenceRule(`Minh chứng đã có mã ${bracketEvidenceCode(existing.code)} ở bộ này`);
      }
      const chosenBox = box ?? standardBox(node.standard_code);
      const sequence = await this.nextSequence(transaction, frameworkId, node.id, subject);
      const code = await this.codeOf(context.year.database, frameworkId, chosenBox, node, sequence);
      const taken = await transaction
        .selectFrom('evidence_codes')
        .select('evidence_id')
        .where('framework_id', '=', frameworkId)
        .where('code', '=', code)
        .where('subject_user_id', subject ? '=' : 'is', subject)
        .executeTakeFirst();
      if (taken) {
        throw evidenceRule(`Mã ${bracketEvidenceCode(code)} đã có trong bộ; chọn số hộp khác`);
      }
      await transaction
        .insertInto('evidence_codes')
        .values({
          evidence_id: id,
          framework_id: frameworkId,
          primary_node_id: node.id,
          box: chosenBox,
          sequence,
          code,
          subject_user_id: subject,
        })
        .execute();
      await transaction
        .insertInto('evidence_node_links')
        .values({ evidence_id: id, framework_id: frameworkId, node_id: node.id, is_primary: true })
        .onConflict((conflict) => conflict.columns(['evidence_id', 'node_id']).doUpdateSet({ is_primary: true }))
        .execute();
      await this.event(
        transaction,
        id,
        'link',
        currentUser,
        null,
        `${bracketEvidenceCode(code)} tiêu chí ${node.code}`,
      );
      return { code, display_code: bracketEvidenceCode(code) };
    });
    return result;
  }

  async update(currentUser: CurrentUser, id: string, frameworkId: string, input: EvidenceItemInput) {
    const context = await this.context(currentUser);
    await this.assertEditor(context, currentUser, id);
    this.checkDates(input);
    const code = await context.system
      .selectFrom('evidence_codes')
      .selectAll()
      .where('evidence_id', '=', id)
      .where('framework_id', '=', frameworkId)
      .executeTakeFirst();
    if (!code) {
      throw validationError([{ field: 'framework_id', message: 'Minh chứng chưa có mã ở bộ tiêu chí này' }]);
    }
    const shared = await this.checkSharedNodes(
      context.year.database,
      frameworkId,
      code.primary_node_id,
      input.shared_node_ids,
    );
    await context.system.transaction().execute(async (transaction) => {
      await transaction
        .updateTable('evidence_items')
        .set({
          title: input.title,
          document_number: input.document_number,
          issued_date: input.issued_date,
          issuer: input.issuer,
          description: input.description,
          valid_until: input.valid_until,
          status: input.status,
          school_year_names: input.school_year_names.length > 0 ? input.school_year_names : [context.year.name],
          updated_at: this.clock.now(),
        })
        .where('id', '=', id)
        .execute();
      await this.event(transaction, id, 'update', currentUser, null, input.title);
      const before = (
        await transaction
          .selectFrom('evidence_node_links')
          .select('node_id')
          .where('evidence_id', '=', id)
          .where('framework_id', '=', frameworkId)
          .where('is_primary', '=', false)
          .execute()
      ).map((row) => row.node_id);
      const removed = before.filter((node) => !shared.includes(node));
      const added = shared.filter((node) => !before.includes(node));
      if (removed.length > 0) {
        await transaction
          .deleteFrom('evidence_node_links')
          .where('evidence_id', '=', id)
          .where('node_id', 'in', removed)
          .execute();
        await this.event(transaction, id, 'unlink', currentUser, null, `${removed.length} tiêu chí dùng chung`);
      }
      if (added.length > 0) {
        await transaction
          .insertInto('evidence_node_links')
          .values(
            added.map((node) => ({ evidence_id: id, framework_id: frameworkId, node_id: node, is_primary: false })),
          )
          .execute();
        await this.event(transaction, id, 'link', currentUser, null, `${added.length} tiêu chí dùng chung`);
      }
    });
    return this.detail(currentUser, id);
  }

  // Xóa minh chứng: người quản lý kho; không xóa khi tiêu chí của minh chứng đã có phiếu được duyệt ở năm học đang dùng (BR-539)
  async remove(currentUser: CurrentUser, id: string) {
    const context = await this.context(currentUser);
    if (!context.manager) {
      throw forbidden('Chỉ người quản lý kho minh chứng xóa minh chứng');
    }
    const item = await this.itemRow(context.system, id);
    const nodeIds = (
      await context.system.selectFrom('evidence_node_links').select('node_id').where('evidence_id', '=', id).execute()
    ).map((row) => row.node_id);
    if (nodeIds.length > 0) {
      const approved = await context.year.database
        .selectFrom('quality_criterion_reports')
        .select('id')
        .where('criterion_id', 'in', nodeIds)
        .where('status', '=', 'approved')
        .executeTakeFirst();
      if (approved) {
        throw evidenceRule('Tiêu chí của minh chứng đã có phiếu được duyệt; gỡ minh chứng khỏi tiêu chí thay vì xóa');
      }
    }
    await context.system.transaction().execute(async (transaction) => {
      await this.event(transaction, id, 'delete', currentUser, null, item.title);
      await transaction.deleteFrom('evidence_items').where('id', '=', id).execute();
    });
  }

  // ---- Phiên bản ----

  private async putFile(file: { file_name: string; content_type: string; body: Buffer }) {
    const key = storageKey('evidences', randomUUID());
    await this.fileStorage.put(key, file.body, file.content_type);
    return {
      storage_key: key,
      file_name: file.file_name.slice(0, 200),
      content_type: file.content_type,
      size_bytes: file.body.length,
      sha256: sha256(file.body),
    };
  }

  private async insertVersion(
    transaction: Transaction<SystemDatabase>,
    evidenceId: string,
    currentUser: CurrentUser,
    snapshot: Snapshot | null,
    stored: Awaited<ReturnType<EvidenceStoreService['putFile']>> | null,
    note: string | null = null,
  ) {
    const last = await transaction
      .selectFrom('evidence_versions')
      .select((eb) => eb.fn.max('version_no').as('version_no'))
      .where('evidence_id', '=', evidenceId)
      .executeTakeFirst();
    const versionNo = Number(last?.version_no ?? 0) + 1;
    await transaction
      .insertInto('evidence_versions')
      .values({
        evidence_id: evidenceId,
        version_no: versionNo,
        source_kind: snapshot ? 'record' : 'upload',
        record_type: snapshot?.record_type ?? null,
        record_id: snapshot?.record_id ?? null,
        record_school_year: snapshot?.record_school_year ?? null,
        record_label: snapshot?.record_label ?? null,
        record_updated_at: snapshot?.record_updated_at ?? null,
        storage_key: stored?.storage_key ?? null,
        file_name: stored?.file_name ?? null,
        content_type: stored?.content_type ?? null,
        size_bytes: stored?.size_bytes ?? null,
        sha256: stored?.sha256 ?? null,
        note,
        created_by: currentUser.id,
        created_by_name: currentUser.description.full_name,
      })
      .execute();
    await transaction
      .updateTable('evidence_items')
      .set({
        status: sql<QualityEvidenceStatusCode>`case when status = 'missing' then 'sufficient' else status end`,
        updated_at: this.clock.now(),
      })
      .where('id', '=', evidenceId)
      .execute();
    if (snapshot?.personal_data_permissions) {
      await transaction
        .updateTable('evidence_items')
        .set({ has_personal_data: true, personal_data_permission: snapshot.personal_data_permissions.join(',') })
        .where('id', '=', evidenceId)
        .execute();
    }
    await this.event(
      transaction,
      evidenceId,
      'add_version',
      currentUser,
      versionNo,
      snapshot?.record_label ?? stored?.file_name ?? null,
    );
    return versionNo;
  }

  async addUpload(currentUser: CurrentUser, id: string, file: { fileName: string; body: Buffer }, note: string | null) {
    const context = await this.context(currentUser);
    await this.assertEditor(context, currentUser, id);
    if (file.body.length === 0 || file.body.length > QUALITY_MAXIMUM_FILE_BYTES) {
      throw validationError([{ field: 'file', message: 'Tệp tối đa 20 MB' }]);
    }
    const contentType = detectArchiveFileType(file.fileName, file.body);
    if (!contentType) {
      throw validationError([{ field: 'file', message: 'Tệp minh chứng là PDF, ảnh JPEG, PNG, Word hoặc Excel' }]);
    }
    const stored = await this.putFile({ file_name: file.fileName, content_type: contentType, body: file.body });
    try {
      const versionNo = await context.system
        .transaction()
        .execute((transaction) => this.insertVersion(transaction, id, currentUser, null, stored, note));
      return { version_no: versionNo };
    } catch (error) {
      await this.fileStorage.delete(stored.storage_key).catch(() => undefined);
      throw error;
    }
  }

  async addRecord(currentUser: CurrentUser, id: string, type: EvidenceRecordTypeCode, recordId: string) {
    const context = await this.context(currentUser);
    await this.assertEditor(context, currentUser, id);
    const snapshot = await this.snapshot(context, currentUser, type, recordId);
    const stored = snapshot.file ? await this.putFile(snapshot.file) : null;
    try {
      const versionNo = await context.system
        .transaction()
        .execute((transaction) => this.insertVersion(transaction, id, currentUser, snapshot, stored));
      return { version_no: versionNo };
    } catch (error) {
      if (stored) {
        await this.fileStorage.delete(stored.storage_key).catch(() => undefined);
      }
      throw error;
    }
  }

  // Tệp của một phiên bản (mặc định phiên bản mới nhất); kiểm quyền xem nguồn với tệp có dữ liệu cá nhân và ghi nhật ký
  async file(currentUser: CurrentUser, id: string, versionNo: number | null, download: boolean) {
    const context = await this.context(currentUser);
    const item = await this.itemRow(context.system, id);
    await this.assertVisible(context, currentUser, item);
    if (!this.canDownload(currentUser, item)) {
      throw forbidden('Minh chứng có dữ liệu cá nhân; chỉ người có quyền xem nguồn tải được tệp');
    }
    let query = context.system
      .selectFrom('evidence_versions')
      .select(['version_no', 'storage_key', 'file_name', 'content_type'])
      .where('evidence_id', '=', id)
      .orderBy('version_no', 'desc');
    if (versionNo !== null) {
      query = query.where('version_no', '=', versionNo);
    }
    const version = await query.executeTakeFirst();
    if (!version?.storage_key) {
      throw notFoundError('Phiên bản không có tệp để tải', 'file');
    }
    const body = await this.fileStorage.get(version.storage_key);
    await this.event(
      context.system,
      id,
      download ? 'download_file' : 'view_file',
      currentUser,
      version.version_no,
      version.file_name,
    );
    return {
      file_name: version.file_name ?? 'minh-chung',
      content_type: version.content_type ?? 'application/octet-stream',
      body,
    };
  }

  // ---- Nguồn là bản ghi ----

  private sourceContext(context: StoreContext, currentUser: CurrentUser): SourceContext {
    return {
      currentUser,
      system: context.system,
      year: context.year,
      fileStorage: this.fileStorage,
      now: this.clock.now(),
    };
  }

  private assertRecordPermission(currentUser: CurrentUser, type: EvidenceRecordTypeCode) {
    if (!this.sourceRegistry.allows(currentUser, type)) {
      throw forbidden(`Bạn không có quyền xem ${EVIDENCE_RECORD_TYPE_LABELS[type].toLowerCase()}`);
    }
  }

  // Ô chọn bản ghi: tìm theo tên, số, trích yếu trong phạm vi người dùng xem được ở phân hệ nguồn
  async sources(currentUser: CurrentUser, type: EvidenceRecordTypeCode, q: string | null) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    this.assertRecordPermission(currentUser, type);
    return this.sourceRegistry.get(type).search(this.sourceContext(context, currentUser), likePattern(q));
  }

  // Minh chứng đã dùng bản ghi này làm nguồn (nút "Dùng làm minh chứng" ở trang nguồn)
  async byRecord(currentUser: CurrentUser, type: EvidenceRecordTypeCode, recordId: string) {
    const context = await this.context(currentUser);
    this.assertStaff(context);
    const rows = await context.system
      .selectFrom('evidence_versions as versions')
      .innerJoin('evidence_items as items', 'items.id', 'versions.evidence_id')
      .leftJoin('evidence_codes as codes', 'codes.evidence_id', 'items.id')
      .select(['items.id', 'items.title', 'codes.code', 'codes.framework_id'])
      .where('versions.record_type', '=', type)
      .where('versions.record_id', '=', recordId)
      .distinct()
      .execute();
    return rows.map((row) => ({ ...row, display_code: row.code ? bracketEvidenceCode(row.code) : null }));
  }

  // Chụp bản ghi lúc gắn (Q-396-4) qua bộ đăng ký nguồn: nhãn, thời điểm sửa của bản ghi và tệp (tệp gốc hoặc PDF dựng
  // từ dữ liệu) chép vào kho để nội dung không đổi theo bản ghi
  private async snapshot(
    context: StoreContext,
    currentUser: CurrentUser,
    type: EvidenceRecordTypeCode,
    id: string,
  ): Promise<Snapshot> {
    this.assertRecordPermission(currentUser, type);
    const definition = this.sourceRegistry.get(type);
    const taken = await definition.snapshot(this.sourceContext(context, currentUser), id);
    if (!taken) {
      throw validationError([
        { field: 'record_id', message: 'Không tìm thấy dữ liệu nguồn hoặc dữ liệu chưa đủ điều kiện' },
      ]);
    }
    return {
      record_type: type,
      record_id: id,
      record_school_year: definition.per_school_year ? context.year.name : null,
      record_label: taken.label.slice(0, 500),
      record_updated_at: taken.updated_at,
      file: taken.file,
      personal_data_permissions: definition.personal_data
        ? (definition.personal_data_permissions ?? definition.permissions ?? [])
        : null,
    };
  }

  private async professionalFileId(
    database: YearExecutor,
    document: { id: string; signed_file_id: string | null; current_version: number },
  ): Promise<string | null> {
    if (document.signed_file_id) {
      return document.signed_file_id;
    }
    const version = await database
      .selectFrom('professional_document_versions')
      .select('file_id')
      .where('document_id', '=', document.id)
      .where('version_no', '=', document.current_version)
      .executeTakeFirst();
    return version?.file_id ?? null;
  }

  // ---- Xuất danh mục ----

  // Danh mục minh chứng theo mẫu của hướng dẫn tự đánh giá (lát L5, BR-551): nhóm theo tiêu chuẩn, tiêu chí; mỗi tiêu chí liệt
  // kê minh chứng chính trước, minh chứng dùng chung ghi lại mã gốc. Không kiểm quyền: người gọi kiểm (kho, đợt tự đánh giá)
  async catalogOf(database: YearExecutor, frameworkId: string, subject: { id: string; name: string } | null = null) {
    const framework = await database
      .selectFrom('quality_frameworks')
      .select(['id', 'code', 'name'])
      .where('id', '=', frameworkId)
      .executeTakeFirst();
    if (!framework) {
      throw notFoundError('Không tìm thấy bộ tiêu chí trong năm học đang dùng', 'quality_framework');
    }
    const standards = await database
      .selectFrom('quality_standards')
      .select(['id', 'code', 'title'])
      .where('framework_id', '=', frameworkId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const criteria = await database
      .selectFrom('quality_criteria')
      .select(['id', 'code', 'title', 'standard_id'])
      .where('framework_id', '=', frameworkId)
      .orderBy('sort_order')
      .orderBy('code')
      .execute();
    const codeOfNode = new Map(criteria.map((row) => [row.id, row.code]));
    const links = await this.byNodes(frameworkId, null, subject?.id ?? null);
    return {
      framework,
      subject,
      standards: standards.map((standard) => ({
        code: standard.code,
        title: standard.title,
        criteria: criteria
          .filter((criterion) => criterion.standard_id === standard.id)
          .map((criterion) => ({
            code: criterion.code,
            title: criterion.title,
            rows: links
              .filter((link) => link.node_id === criterion.id)
              .sort((a, b) => Number(a.shared) - Number(b.shared) || a.code.localeCompare(b.code))
              .map((link) => ({
                evidence_id: link.id,
                code: link.code,
                display_code: link.display_code,
                box: link.box,
                shared: link.shared,
                title: link.title,
                issued: [link.document_number, link.issued_date ? formatVietnamDate(link.issued_date) : null]
                  .filter(Boolean)
                  .join(', '),
                issuer: link.issuer ?? '',
                note: [
                  link.shared ? `Dùng chung, mã gốc của tiêu chí ${codeOfNode.get(link.primary_node_id) ?? ''}` : null,
                  link.status === 'sufficient' ? null : link.status_label,
                  link.validity === 'expired' ? link.validity_label : null,
                ]
                  .filter(Boolean)
                  .join('; '),
              })),
          })),
      })),
    };
  }

  async listFile(
    currentUser: CurrentUser,
    frameworkId: string,
    format: TableFileFormat | 'docx',
    subjectUserId: string | null = null,
  ) {
    const context = await this.context(currentUser);
    this.assertFramework(context, frameworkId);
    const subject = await this.subjectOf(context, currentUser, frameworkId, subjectUserId);
    const catalog = await this.catalogOf(
      context.year.database,
      frameworkId,
      subject ? { id: subject, name: await this.subjectName(context, currentUser, subject) } : null,
    );
    const base = `danh-muc-minh-chung-${catalog.framework.code}`;
    if (format === 'docx') {
      return {
        fileName: `${base}.docx`,
        contentType: DOCX_TYPE,
        buffer: buildDocx(catalogBlocks(catalog), { title: `Danh mục minh chứng – ${catalog.framework.name}` }),
      };
    }
    const buffer = await buildTableFile(format, [catalogSheet(catalog)], this.clock.now());
    return { fileName: `${base}.${format}`, contentType: CONTENT_TYPES[format], buffer };
  }

  // Gói hồ sơ minh chứng (lát L5, BR-551, tác vụ nền): thư mục theo hộp H1, H2…, mỗi minh chứng một tệp đặt tên theo mã (bản
  // mới nhất có tệp), kèm danh mục; minh chứng có dữ liệu cá nhân mà người xuất không có quyền xem nguồn thì không đưa vào gói
  // và ghi ở tệp kèm theo; mỗi tệp đưa vào gói ghi nhật ký truy cập
  async packageFile(currentUser: CurrentUser, frameworkId: string): Promise<ExportedFile> {
    const context = await this.context(currentUser);
    if (!context.manager) {
      throw forbidden('Chỉ người quản lý kho minh chứng toàn trường tạo gói hồ sơ minh chứng');
    }
    if ((await this.frameworkSubject(context.year.database, frameworkId)) === 'person') {
      throw evidenceRule('Gói hồ sơ chỉ tạo cho bộ tiêu chí của nhà trường; bộ của cá nhân xuất danh mục');
    }
    const catalog = await this.catalogOf(context.year.database, frameworkId);
    const primaries = catalog.standards
      .flatMap((standard) => standard.criteria)
      .flatMap((criterion) => criterion.rows)
      .filter((row) => !row.shared);
    const ids = primaries.map((row) => row.evidence_id);
    const items =
      ids.length > 0
        ? await context.system
            .selectFrom('evidence_items')
            .select(['id', 'has_personal_data', 'personal_data_permission'])
            .where('id', 'in', ids)
            .execute()
        : [];
    const versions = ids.length > 0 ? await this.latestVersions(context.system, ids) : new Map();
    const zip = new ZipWriter(this.clock.now());
    const skipped: string[] = [];
    for (const row of primaries) {
      const item = items.find((entry) => entry.id === row.evidence_id);
      const version = versions.get(row.evidence_id);
      if (!item || !version?.storage_key) {
        skipped.push(`${row.display_code} ${row.title}: chưa có tệp`);
        continue;
      }
      if (!this.canDownload(currentUser, item)) {
        skipped.push(`${row.display_code} ${row.title}: có dữ liệu cá nhân, người xuất không có quyền xem nguồn`);
        continue;
      }
      zip.add(
        `H${row.box}/${evidencePackageFileName(row.code, version.file_name)}`,
        await this.fileStorage.get(version.storage_key),
      );
      await this.event(
        context.system,
        row.evidence_id,
        'download_file',
        currentUser,
        version.version_no,
        `Gói hồ sơ minh chứng ${catalog.framework.code}`,
      );
    }
    zip.add('danh-muc-minh-chung.xlsx', await buildTableFile('xlsx', [catalogSheet(catalog)], this.clock.now()));
    if (skipped.length > 0) {
      zip.add('khong-dua-vao-goi.txt', `Minh chứng không đưa vào gói:\r\n${skipped.join('\r\n')}\r\n`);
    }
    return {
      fileName: `goi-minh-chung-${catalog.framework.code}.zip`,
      contentType: 'application/zip',
      buffer: zip.finish(),
      logId: randomUUID(),
      rowCount: primaries.length,
    };
  }

  // ---- Dùng cho phân hệ tự đánh giá (22f) ----

  // Minh chứng của các tiêu chí trong một bộ: mã, tên, trạng thái, hiệu lực, kèm tiêu chí dùng chung
  async byNodes(frameworkId: string, nodeIds: string[] | null, subjectUserId: string | null = null) {
    await this.ensureImported();
    const today = VIETNAM_DATE.format(this.clock.now());
    let query = this.databases.system
      .selectFrom('evidence_node_links as links')
      .innerJoin('evidence_items as items', 'items.id', 'links.evidence_id')
      .innerJoin('evidence_codes as codes', (join) =>
        join.onRef('codes.evidence_id', '=', 'items.id').onRef('codes.framework_id', '=', 'links.framework_id'),
      )
      .select([
        'items.id',
        'items.title',
        'items.document_number',
        'items.issued_date',
        'items.issuer',
        'items.status',
        'items.valid_until',
        'codes.code',
        'codes.box',
        'codes.primary_node_id',
        'links.node_id',
      ])
      .where('links.framework_id', '=', frameworkId)
      .$if(subjectUserId !== null, (rows) => rows.where('codes.subject_user_id', '=', subjectUserId))
      .orderBy('codes.box')
      .orderBy('codes.code');
    if (nodeIds) {
      if (nodeIds.length === 0) {
        return [];
      }
      query = query.where('links.node_id', 'in', nodeIds);
    }
    return (await query.execute()).map((row) => {
      const validity = evidenceValidity(row.valid_until, today);
      return {
        ...row,
        display_code: bracketEvidenceCode(row.code),
        shared: row.primary_node_id !== row.node_id,
        status_label: QUALITY_EVIDENCE_STATUS_LABELS[row.status],
        validity,
        validity_label: EVIDENCE_VALIDITY_LABELS[validity],
      };
    });
  }

  // Tiêu chí đã có minh chứng trong kho thì bộ tiêu chuẩn không xóa tiêu chí đó
  async nodesInUse(nodeIds: string[]): Promise<boolean> {
    if (nodeIds.length === 0) {
      return false;
    }
    await this.ensureImported();
    const row = await this.databases.system
      .selectFrom('evidence_node_links')
      .select('evidence_id')
      .where('node_id', 'in', nodeIds)
      .executeTakeFirst();
    return row !== undefined;
  }

  // ---- Nhật ký ----

  private async event(
    database: SystemExecutor,
    evidenceId: string,
    action: EvidenceEventActionCode,
    currentUser: CurrentUser | null,
    versionNo: number | null,
    detail: string | null,
  ) {
    await database
      .insertInto('evidence_events')
      .values({
        evidence_id: evidenceId,
        action,
        version_no: versionNo,
        detail: detail ? detail.slice(0, 1000) : null,
        actor_id: currentUser?.id ?? null,
        actor_name: currentUser?.description.full_name ?? 'Hệ thống',
      })
      .execute();
  }

  // ---- Chuyển minh chứng của các đợt 22f sang kho ----

  // Mỗi cơ sở dữ liệu năm học chuyển một lần, từ năm cũ đến năm mới; khóa cố vấn giữ một lượt chạy cho mỗi trường. Minh chứng
  // kế thừa (có mã cũ) gộp vào minh chứng đã chuyển cùng mã của bộ; mã trùng mà không phải kế thừa thì cấp số thứ tự kế tiếp
  async ensureImported(): Promise<void> {
    const system = this.databases.system;
    const years = await system
      .selectFrom('academic_years')
      .innerJoin('academic_year_databases', 'academic_year_databases.academic_year_id', 'academic_years.id')
      .leftJoin('evidence_imports', 'evidence_imports.school_year_database', 'academic_year_databases.database_name')
      .select(['academic_years.name', 'academic_year_databases.database_name', 'evidence_imports.imported_at'])
      .where('academic_years.status', '<>', 'draft')
      .orderBy('academic_years.start_date')
      .execute();
    for (const year of years) {
      if (year.imported_at) {
        continue;
      }
      await this.importYear(year.name, year.database_name);
    }
  }

  private async importYear(yearName: string, databaseName: string) {
    const old = this.databases.schoolYear<SchoolYearDatabase>(databaseName);
    const evidences = await old
      .selectFrom('quality_evidences as evidences')
      .innerJoin('quality_assessments as assessments', 'assessments.id', 'evidences.assessment_id')
      .innerJoin('quality_criteria as criteria', 'criteria.id', 'evidences.criterion_id')
      .selectAll('evidences')
      .select(['assessments.framework_id', 'criteria.code as criterion_code'])
      .orderBy('assessments.created_at')
      .orderBy('evidences.box')
      .orderBy('evidences.sequence')
      .execute();
    const shared = await old.selectFrom('quality_evidence_criteria').selectAll().execute();
    const fileIds = evidences.map((row) => row.file_id).filter((id): id is string => id !== null);
    const files =
      fileIds.length > 0
        ? await old
            .selectFrom('files')
            .select(['id', 'file_name', 'content_type', 'size_bytes', 'storage_key'])
            .where('id', 'in', fileIds)
            .execute()
        : [];
    const documents = new Map<string, string | null>();
    for (const row of evidences) {
      if (row.professional_document_id && !documents.has(row.professional_document_id)) {
        const document = await old
          .selectFrom('professional_documents')
          .select(['id', 'signed_file_id', 'current_version'])
          .where('id', '=', row.professional_document_id)
          .executeTakeFirst();
        documents.set(row.professional_document_id, document ? await this.professionalFileId(old, document) : null);
      }
    }
    const documentFileIds = [...documents.values()].filter((id): id is string => id !== null);
    const documentFiles =
      documentFileIds.length > 0
        ? await old
            .selectFrom('files')
            .select(['id', 'file_name', 'content_type', 'size_bytes', 'storage_key'])
            .where('id', 'in', documentFileIds)
            .execute()
        : [];
    await this.databases.system.transaction().execute(async (transaction) => {
      await sql`select pg_advisory_xact_lock(hashtext('evidence-import'))`.execute(transaction);
      const done = await transaction
        .selectFrom('evidence_imports')
        .select('school_year_database')
        .where('school_year_database', '=', databaseName)
        .executeTakeFirst();
      if (done) {
        return;
      }
      for (const row of evidences) {
        const importKey = `${databaseName}:${row.id}`;
        const exists = await transaction
          .selectFrom('evidence_items')
          .select('id')
          .where('import_key', '=', importKey)
          .executeTakeFirst();
        if (exists) {
          continue;
        }
        const inherited = row.inherited_code
          ? await transaction
              .selectFrom('evidence_codes')
              .select('evidence_id')
              .where('framework_id', '=', row.framework_id)
              .where('code', '=', row.inherited_code)
              .executeTakeFirst()
          : undefined;
        let evidenceId: string;
        if (inherited) {
          evidenceId = inherited.evidence_id;
          await transaction
            .updateTable('evidence_items')
            .set((eb) => ({
              school_year_names: sql<
                string[]
              >`array_append(array_remove(${eb.ref('school_year_names')}, ${yearName}), ${yearName})`,
              status: row.status,
              updated_at: row.updated_at,
            }))
            .where('id', '=', evidenceId)
            .execute();
        } else {
          let sequence = row.sequence;
          let code = row.code;
          const taken = await transaction
            .selectFrom('evidence_codes')
            .select('evidence_id')
            .where('framework_id', '=', row.framework_id)
            .where('code', '=', code)
            .where('subject_user_id', 'is', null)
            .executeTakeFirst();
          if (taken) {
            sequence = await this.nextSequence(transaction, row.framework_id, row.criterion_id, null);
            code = formatEvidenceCode(row.box, row.criterion_code, sequence);
          }
          const item = await transaction
            .insertInto('evidence_items')
            .values({
              title: row.title,
              document_number: row.document_number,
              issued_date: row.issued_date,
              issuer: row.issuer,
              description: row.description,
              school_year_names: [yearName],
              status: row.status,
              owner_user_id: row.created_by,
              owner_name: row.created_by_name,
              import_key: importKey,
              created_by: row.created_by,
              created_by_name: row.created_by_name,
              created_at: row.created_at,
              updated_at: row.updated_at,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
          evidenceId = item.id;
          await transaction
            .insertInto('evidence_codes')
            .values({
              evidence_id: evidenceId,
              framework_id: row.framework_id,
              primary_node_id: row.criterion_id,
              box: row.box,
              sequence,
              code,
            })
            .execute();
          await transaction
            .insertInto('evidence_node_links')
            .values({
              evidence_id: evidenceId,
              framework_id: row.framework_id,
              node_id: row.criterion_id,
              is_primary: true,
            })
            .execute();
        }
        const links = shared.filter((link) => link.evidence_id === row.id && link.criterion_id !== row.criterion_id);
        for (const link of links) {
          await transaction
            .insertInto('evidence_node_links')
            .values({
              evidence_id: evidenceId,
              framework_id: row.framework_id,
              node_id: link.criterion_id,
              is_primary: false,
            })
            .onConflict((conflict) => conflict.columns(['evidence_id', 'node_id']).doNothing())
            .execute();
        }
        // Tệp ở kho tệp dùng lại cùng khóa (không chép); văn bản đến, đi giữ liên kết và nhãn
        const fileRow =
          row.source_type === 'upload' && row.file_id
            ? files.find((file) => file.id === row.file_id)
            : row.source_type === 'professional_document' && row.professional_document_id
              ? documentFiles.find((file) => file.id === documents.get(row.professional_document_id as string))
              : undefined;
        const recordId =
          row.source_type === 'professional_document' ? row.professional_document_id : row.system_document_id;
        const isRecord = row.source_type !== 'upload' && row.source_type !== 'none' && recordId !== null;
        if (fileRow || isRecord) {
          const last = await transaction
            .selectFrom('evidence_versions')
            .select((eb) => eb.fn.max('version_no').as('version_no'))
            .where('evidence_id', '=', evidenceId)
            .executeTakeFirst();
          const sameFile = fileRow
            ? await transaction
                .selectFrom('evidence_versions')
                .select('id')
                .where('evidence_id', '=', evidenceId)
                .where('storage_key', '=', fileRow.storage_key)
                .executeTakeFirst()
            : undefined;
          if (!sameFile) {
            await transaction
              .insertInto('evidence_versions')
              .values({
                evidence_id: evidenceId,
                version_no: Number(last?.version_no ?? 0) + 1,
                source_kind: isRecord ? 'record' : 'upload',
                record_type: isRecord ? row.source_type : null,
                record_id: isRecord ? recordId : null,
                record_school_year: row.source_type === 'professional_document' ? yearName : null,
                record_label: row.source_label,
                record_updated_at: isRecord ? row.updated_at : null,
                storage_key: fileRow?.storage_key ?? null,
                file_name: fileRow?.file_name ?? null,
                content_type: fileRow?.content_type ?? null,
                size_bytes: fileRow?.size_bytes ?? null,
                note: `Năm học ${yearName}`,
                created_by: row.created_by,
                created_by_name: row.created_by_name,
                created_at: row.updated_at,
              })
              .execute();
          }
        }
        await this.event(transaction, evidenceId, 'import', null, null, `Năm học ${yearName}, mã cũ ${row.code}`);
      }
      await transaction
        .insertInto('evidence_imports')
        .values({ school_year_database: databaseName, evidence_count: evidences.length })
        .execute();
    });
  }
}

// Ngày dạng dd/mm/yyyy cho danh mục minh chứng
const formatVietnamDate = (date: string) => date.split('-').reverse().join('/');

type EvidenceCatalog = Awaited<ReturnType<EvidenceStoreService['catalogOf']>>;

// Cột danh mục theo phụ lục của hướng dẫn tự đánh giá (lát L5)
const CATALOG_COLUMNS = [
  { key: 'no', label: 'TT', width: 6 },
  { key: 'code', label: 'Mã minh chứng', width: 16 },
  { key: 'title', label: 'Tên minh chứng', width: 44 },
  {
    key: 'issued',
    label: 'Số, ngày ban hành, hoặc thời điểm khảo sát, điều tra, phỏng vấn, quan sát',
    width: 26,
  },
  { key: 'issuer', label: 'Nơi ban hành hoặc nhóm, cá nhân thực hiện', width: 26 },
  { key: 'note', label: 'Ghi chú', width: 30 },
];

// Bảng danh mục: dòng tiêu chuẩn, dòng tiêu chí, rồi minh chứng của tiêu chí; số thứ tự chỉ đánh cho dòng minh chứng
function catalogSheet(catalog: EvidenceCatalog) {
  const rows: Array<Record<string, unknown>> = [];
  let number = 0;
  for (const standard of catalog.standards) {
    rows.push({ title: `Tiêu chuẩn ${standard.code}: ${standard.title}` });
    for (const criterion of standard.criteria) {
      rows.push({ title: `Tiêu chí ${criterion.code}: ${criterion.title}` });
      for (const row of criterion.rows) {
        number += 1;
        rows.push({
          no: number,
          code: row.display_code,
          title: row.title,
          issued: row.issued,
          issuer: row.issuer,
          note: row.note,
        });
      }
    }
  }
  return {
    title: 'Danh mục minh chứng',
    heading: [
      'DANH MỤC MÃ MINH CHỨNG',
      catalog.framework.name,
      ...(catalog.subject ? [`Người được đánh giá: ${catalog.subject.name}`] : []),
    ],
    columns: CATALOG_COLUMNS,
    rows,
  };
}

function catalogBlocks(catalog: EvidenceCatalog): DocumentBlock[] {
  return [
    {
      kind: 'title',
      text: 'DANH MỤC MÃ MINH CHỨNG',
      subtitle: catalog.subject ? `${catalog.framework.name} – ${catalog.subject.name}` : catalog.framework.name,
    },
    ...catalogTableBlocks(catalog),
  ];
}

// Bảng danh mục theo tiêu chuẩn, dùng ở tệp danh mục và phụ lục của báo cáo tự đánh giá
export function catalogTableBlocks(catalog: EvidenceCatalog): DocumentBlock[] {
  let number = 0;
  const blocks: DocumentBlock[] = [];
  for (const standard of catalog.standards) {
    blocks.push({ kind: 'heading', text: `Tiêu chuẩn ${standard.code}: ${standard.title}` });
    const rows: string[][] = [];
    for (const criterion of standard.criteria) {
      rows.push(['', '', `Tiêu chí ${criterion.code}: ${criterion.title}`, '', '', '']);
      for (const row of criterion.rows) {
        number += 1;
        rows.push([String(number), row.display_code, row.title, row.issued, row.issuer, row.note]);
      }
    }
    blocks.push({
      kind: 'table',
      header: CATALOG_COLUMNS.map((column) => column.label),
      rows,
      widths: [1, 3, 7, 4, 4, 4],
    });
  }
  return blocks;
}
