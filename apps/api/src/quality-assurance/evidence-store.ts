import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { ApplicationError, Clock, ruleViolationError, validationError } from '@school-management/server';
import {
  bracketEvidenceCode,
  EVIDENCE_EVENT_LABELS,
  EVIDENCE_RECORD_TYPE_LABELS,
  EVIDENCE_RULE_CODE,
  EVIDENCE_VALIDITY_LABELS,
  evidenceValidity,
  formatEvidenceCode,
  PERMISSION_CODES,
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
import { buildTableFile, CONTENT_TYPES, type TableFileFormat } from '../exports/table-file.js';
import { FileStorage } from '../files/file-storage.js';
import { escapeLike } from '../incoming-documents/incoming-fields.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

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
export const EVIDENCE_PERMISSIONS = [VIEW, CONTRIBUTE, MANAGE];
const MAXIMUM_LIST = 1000;

// Quyền cần để chọn bản ghi của từng loại nguồn (BR-540): gắn bản ghi cần quyền xem bản ghi đó ở phân hệ nguồn
const RECORD_PERMISSIONS: Record<EvidenceRecordTypeCode, string[]> = {
  professional_document: [
    PERMISSION_CODES.professionalRecordUse,
    PERMISSION_CODES.professionalRecordReview,
    PERMISSION_CODES.professionalRecordApprove,
    PERMISSION_CODES.professionalRecordManage,
  ],
  incoming_document: [
    PERMISSION_CODES.incomingDocumentView,
    PERMISSION_CODES.incomingDocumentSearch,
    PERMISSION_CODES.incomingDocumentAdmin,
  ],
  outgoing_document: [
    PERMISSION_CODES.outgoingDocumentDraft,
    PERMISSION_CODES.outgoingDocumentSign,
    PERMISSION_CODES.outgoingDocumentIssue,
    PERMISSION_CODES.outgoingDocumentSearch,
  ],
};

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
}

export interface EvidenceListFilter {
  framework_id: string;
  node_id: string | null;
  status: QualityEvidenceStatusCode | null;
  validity: EvidenceValidityCode | null;
  q: string | null;
}

interface StoreContext {
  system: Kysely<SystemDatabase>;
  year: { database: Kysely<SchoolYearDatabase>; name: string };
  staffId: string | null;
  manager: boolean;
  contributor: boolean;
  today: string;
}

interface Snapshot {
  record_type: EvidenceRecordTypeCode;
  record_id: string;
  record_school_year: string | null;
  record_label: string;
  record_updated_at: Date | null;
  file: { file_name: string; content_type: string; body: Buffer } | null;
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
  ) {}

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
    return {
      system: this.databases.system,
      year: { database: current.database, name: year.name },
      staffId: staff?.id ?? null,
      manager,
      contributor: manager || currentUser.hasPermission(CONTRIBUTE),
      today: VIETNAM_DATE.format(this.clock.now()),
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
      .select(['id', 'code', 'name', 'school_level', 'status'])
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
    return {
      can_contribute: context.contributor,
      can_manage: context.manager,
      school_year_name: context.year.name,
      frameworks: frameworks.map((framework) => ({
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
      .select(['evidence_id', 'version_no', 'source_kind', 'record_type', 'file_name'])
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
    const changed = current ? await this.sourceChanged(context, current) : false;
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
    const updated = await this.recordUpdatedAt(
      context,
      version.record_type as EvidenceRecordTypeCode,
      version.record_id,
    );
    return updated !== null && updated.getTime() > version.record_updated_at.getTime();
  }

  private async recordUpdatedAt(context: StoreContext, type: EvidenceRecordTypeCode, id: string) {
    if (type === 'professional_document') {
      const row = await context.year.database
        .selectFrom('professional_documents')
        .select('updated_at')
        .where('id', '=', id)
        .executeTakeFirst();
      return row?.updated_at ?? null;
    }
    const table = type === 'incoming_document' ? 'incoming_documents' : 'outgoing_documents';
    const row = await context.system.selectFrom(table).select('updated_at').where('id', '=', id).executeTakeFirst();
    return row?.updated_at ?? null;
  }

  // ---- Quyền sửa ----

  // Người quản lý kho sửa mọi minh chứng; người đóng góp sửa minh chứng mình tạo hoặc phụ trách, hoặc của tiêu chí được phân
  // công cho nhóm công tác của mình ở đợt tự đánh giá chưa hoàn thành (giữ quy tắc của 22f đến khi có phân công ở lát L4)
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
    if (context.contributor && context.staffId) {
      const nodeIds = (
        await context.system.selectFrom('evidence_node_links').select('node_id').where('evidence_id', '=', id).execute()
      ).map((row) => row.node_id);
      if (nodeIds.length > 0 && (await this.assignedToGroup(context, nodeIds))) {
        return item;
      }
    }
    throw forbidden(
      'Chỉ người tạo, người phụ trách, nhóm công tác của tiêu chí hoặc người quản lý kho sửa minh chứng này',
    );
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
    return item.personal_data_permission !== null && currentUser.hasPermission(item.personal_data_permission);
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
  private async nextSequence(system: SystemExecutor, frameworkId: string, nodeId: string): Promise<number> {
    const used = new Set(
      (
        await system
          .selectFrom('evidence_codes')
          .select('sequence')
          .where('framework_id', '=', frameworkId)
          .where('primary_node_id', '=', nodeId)
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
    const stored = snapshot?.file ? await this.putFile(snapshot.file) : null;
    try {
      return await context.system.transaction().execute(async (transaction) => {
        const box = input.box ?? standardBox(node.standard_code);
        const sequence = await this.nextSequence(transaction, input.framework_id, node.id);
        const code = formatEvidenceCode(box, node.code, sequence);
        const taken = await transaction
          .selectFrom('evidence_codes')
          .select('evidence_id')
          .where('framework_id', '=', input.framework_id)
          .where('code', '=', code)
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
    await this.assertEditor(context, currentUser, id);
    const node = await this.node(context.year.database, frameworkId, nodeId, 'node_id');
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
      const sequence = await this.nextSequence(transaction, frameworkId, node.id);
      const code = formatEvidenceCode(chosenBox, node.code, sequence);
      const taken = await transaction
        .selectFrom('evidence_codes')
        .select('evidence_id')
        .where('framework_id', '=', frameworkId)
        .where('code', '=', code)
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

  private assertRecordPermission(currentUser: CurrentUser, type: EvidenceRecordTypeCode) {
    if (!RECORD_PERMISSIONS[type].some((code) => currentUser.hasPermission(code))) {
      throw forbidden(`Bạn không có quyền xem ${EVIDENCE_RECORD_TYPE_LABELS[type].toLowerCase()}`);
    }
  }

  // Ô chọn bản ghi: tìm hồ sơ, văn bản theo tên, số, trích yếu
  async sources(currentUser: CurrentUser, type: EvidenceRecordTypeCode, q: string | null) {
    const context = await this.context(currentUser);
    this.assertRecordPermission(currentUser, type);
    const pattern = q ? `%${escapeLike(q)}%` : null;
    if (type === 'professional_document') {
      let query = context.year.database
        .selectFrom('professional_documents')
        .select(['id', 'title', 'owner_name'])
        .where('status', '=', 'approved')
        .orderBy('updated_at', 'desc')
        .limit(50);
      if (pattern) {
        query = query.where('title', 'ilike', pattern);
      }
      return (await query.execute()).map((row) => ({ id: row.id, label: `${row.title} (${row.owner_name})` }));
    }
    if (type === 'incoming_document') {
      let query = context.system
        .selectFrom('incoming_documents')
        .select(['id', 'symbol', 'document_date', 'summary'])
        .where('status', '<>', 'pending_registration')
        .orderBy('document_date', 'desc')
        .limit(50);
      if (pattern) {
        query = query.where((eb) => eb.or([eb('summary', 'ilike', pattern), eb('symbol', 'ilike', pattern)]));
      }
      return (await query.execute()).map((row) => ({
        id: row.id,
        label: `${row.symbol} ngày ${row.document_date}: ${row.summary}`,
      }));
    }
    let query = context.system
      .selectFrom('outgoing_documents')
      .select(['id', 'symbol', 'issued_at', 'summary'])
      .where('status', '=', 'issued')
      .orderBy('issued_at', 'desc')
      .limit(50);
    if (pattern) {
      query = query.where((eb) => eb.or([eb('summary', 'ilike', pattern), eb('symbol', 'ilike', pattern)]));
    }
    return (await query.execute()).map((row) => ({
      id: row.id,
      label: `${row.symbol ?? ''} ngày ${row.issued_at ? VIETNAM_DATE.format(row.issued_at) : ''}: ${row.summary}`,
    }));
  }

  // Chụp bản ghi lúc gắn (Q-396-4): nhãn, thời điểm sửa của bản ghi và tệp gốc (bản đã ký nếu có) chép vào kho để nội dung
  // không đổi theo bản ghi
  private async snapshot(
    context: StoreContext,
    currentUser: CurrentUser,
    type: EvidenceRecordTypeCode,
    id: string,
  ): Promise<Snapshot> {
    this.assertRecordPermission(currentUser, type);
    if (type === 'professional_document') {
      const document = await context.year.database
        .selectFrom('professional_documents')
        .select(['id', 'title', 'owner_name', 'status', 'signed_file_id', 'current_version', 'updated_at'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (!document || document.status !== 'approved') {
        throw validationError([
          { field: 'record_id', message: 'Không tìm thấy hồ sơ đã duyệt ở kho hồ sơ chuyên môn' },
        ]);
      }
      const fileId = await this.professionalFileId(context.year.database, document);
      return {
        record_type: type,
        record_id: id,
        record_school_year: context.year.name,
        record_label: `${document.title} (${document.owner_name})`.slice(0, 500),
        record_updated_at: document.updated_at,
        file: fileId ? await this.yearFile(context.year.database, fileId) : null,
      };
    }
    const label = await this.documentLabel(context.system, type, id);
    if (!label) {
      throw validationError([{ field: 'record_id', message: 'Không tìm thấy văn bản' }]);
    }
    const stored = await this.documentFile(context.system, type, id);
    return {
      record_type: type,
      record_id: id,
      record_school_year: null,
      record_label: label.label,
      record_updated_at: label.updated_at,
      file: stored ? { ...stored, body: await this.fileStorage.get(stored.storage_key) } : null,
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

  private async yearFile(database: YearExecutor, fileId: string) {
    const file = await database
      .selectFrom('files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('id', '=', fileId)
      .executeTakeFirst();
    return file
      ? {
          file_name: file.file_name,
          content_type: file.content_type,
          body: await this.fileStorage.get(file.storage_key),
        }
      : null;
  }

  private async documentLabel(system: SystemExecutor, type: 'incoming_document' | 'outgoing_document', id: string) {
    if (type === 'incoming_document') {
      const row = await system
        .selectFrom('incoming_documents')
        .select(['symbol', 'document_date', 'summary', 'issuer_name', 'status', 'updated_at'])
        .where('id', '=', id)
        .executeTakeFirst();
      return row && row.status !== 'pending_registration'
        ? {
            label: `${row.symbol} ngày ${row.document_date} của ${row.issuer_name}: ${row.summary}`.slice(0, 500),
            updated_at: row.updated_at,
          }
        : null;
    }
    const row = await system
      .selectFrom('outgoing_documents')
      .select(['symbol', 'issue_number', 'issued_at', 'summary', 'status', 'updated_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || row.status !== 'issued') {
      return null;
    }
    const issued = row.issued_at ? VIETNAM_DATE.format(row.issued_at) : '';
    return {
      label: `${row.symbol ?? row.issue_number ?? ''} ngày ${issued}: ${row.summary}`.slice(0, 500),
      updated_at: row.updated_at,
    };
  }

  // Tệp chính của văn bản: văn bản đi lấy bản đã ký, văn bản đến lấy tệp đầu tiên
  private async documentFile(system: SystemExecutor, type: 'incoming_document' | 'outgoing_document', id: string) {
    if (type === 'outgoing_document') {
      return (
        (await system
          .selectFrom('outgoing_document_files')
          .select(['file_name', 'content_type', 'storage_key'])
          .where('document_id', '=', id)
          .where('kind', '=', 'signed')
          .orderBy('created_at', 'desc')
          .executeTakeFirst()) ?? null
      );
    }
    return (
      (await system
        .selectFrom('incoming_document_files')
        .select(['file_name', 'content_type', 'storage_key'])
        .where('document_id', '=', id)
        .orderBy('created_at')
        .executeTakeFirst()) ?? null
    );
  }

  // ---- Xuất danh mục ----

  async listFile(currentUser: CurrentUser, frameworkId: string, format: TableFileFormat) {
    const rows = await this.list(currentUser, {
      framework_id: frameworkId,
      node_id: null,
      status: null,
      validity: null,
      q: null,
    });
    const columns = [
      { key: 'code', label: 'Mã minh chứng', width: 16 },
      { key: 'title', label: 'Tên minh chứng', width: 40 },
      { key: 'issued', label: 'Số, ngày ban hành', width: 20 },
      { key: 'issuer', label: 'Nơi ban hành', width: 24 },
      { key: 'criteria', label: 'Tiêu chí', width: 14 },
      { key: 'status_label', label: 'Trạng thái', width: 14 },
      { key: 'validity_label', label: 'Hiệu lực', width: 16 },
      { key: 'source', label: 'Nguồn', width: 24 },
    ];
    const buffer = await buildTableFile(
      format,
      [
        {
          title: 'Danh mục minh chứng',
          columns,
          numbered: true,
          rows: rows.map((row) => ({
            code: row.display_code,
            title: row.title,
            issued: [row.document_number, row.issued_date].filter(Boolean).join(', '),
            issuer: row.issuer ?? '',
            criteria: [row.primary_node.code, ...row.shared_nodes.map((node) => node.code)].join(', '),
            status_label: row.status_label,
            validity_label: row.validity_label,
            source: row.source_label,
          })),
        },
      ],
      this.clock.now(),
    );
    return { fileName: `danh-muc-minh-chung.${format}`, contentType: CONTENT_TYPES[format], buffer };
  }

  // ---- Dùng cho phân hệ tự đánh giá (22f) ----

  // Minh chứng của các tiêu chí trong một bộ: mã, tên, trạng thái, hiệu lực, kèm tiêu chí dùng chung
  async byNodes(frameworkId: string, nodeIds: string[] | null) {
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
            .executeTakeFirst();
          if (taken) {
            sequence = await this.nextSequence(transaction, row.framework_id, row.criterion_id);
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
