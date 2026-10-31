import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES, type EvidenceRecordTypeCode } from '@school-management/shared';
import { sql, type Kysely } from 'kysely';
import { VIETNAM_DATE } from '../attendance/school-calendar.js';
import type { CurrentUser } from '../authentication/current-user.js';
import { buildTableFile, type TableFileSheet } from '../exports/table-file.js';
import type { FileStorage } from '../files/file-storage.js';
import { isUuid } from '../common/request-fields.js';
import { EducationPlansService } from '../education-plans/education-plans.js';
import { FacilityReportService } from '../facilities/facility-report.js';
import { escapeLike } from '../incoming-documents/incoming-fields.js';
import { ProfessionalStandardsService } from '../professional-standards/professional-standards.js';
import { StaffStatisticsService } from '../statistics/staff-statistics.js';
import { PlansService } from '../work/plans.js';
import { AttendanceMealsService } from '../reports/attendance-meals.js';
import { ScoresService } from '../scores/scores.js';
import { UpperLevelSubmissions } from '../submissions/upper-level-submissions.js';
import { WorkFilesService } from '../work-files/work-files.js';

// Bộ đăng ký nguồn của kho minh chứng (YCTD-396 lát L2). Mỗi loại bản ghi khai báo quyền cần để xem, có dữ liệu cá nhân hay
// không, cách tìm, cách chụp thành tệp và thời điểm sửa gần nhất để báo "Nguồn đã thay đổi" (BR-540 đến BR-542). Thêm loại
// nguồn là thêm một khai báo ở đây, kho không phải sửa. Mã bản ghi là chữ, có thể ghép (ví dụ lớp và học kỳ)
export interface SourceContext {
  currentUser: CurrentUser;
  system: Kysely<SystemDatabase>;
  year: { database: Kysely<SchoolYearDatabase>; name: string };
  fileStorage: FileStorage;
  now: Date;
}

export interface SourceSnapshot {
  label: string;
  updated_at: Date | null;
  file: { file_name: string; content_type: string; body: Buffer } | null;
}

export interface EvidenceSourceDefinition {
  // Một trong các quyền này là đủ để tìm, gắn và (khi có dữ liệu cá nhân) tải bản chụp; null khi dịch vụ của phân hệ nguồn
  // tự kiểm quyền và phạm vi ở mỗi lần đọc
  permissions: string[] | null;
  // Quyền xem nguồn ghi vào minh chứng có dữ liệu cá nhân (một trong các quyền, cách nhau bằng dấu phẩy)
  personal_data_permissions?: string[];
  // Bản chụp có tên, thông tin của học sinh hoặc cán bộ (Q-396-5): tệp chỉ người có quyền xem nguồn tải được
  personal_data: boolean;
  // Năm học của bản ghi là năm học đang dùng (bản ghi ở cơ sở dữ liệu năm học)
  per_school_year: boolean;
  search(context: SourceContext, pattern: string | null): Promise<Array<{ id: string; label: string }>>;
  snapshot(context: SourceContext, id: string): Promise<SourceSnapshot | null>;
  updatedAt(context: SourceContext, id: string): Promise<Date | null>;
}

export const SEARCH_LIMIT = 50;

export const likePattern = (q: string | null) => (q ? `%${escapeLike(q)}%` : null);

export const formatVietnamDate = (value: Date | string | null) => {
  if (!value) {
    return '';
  }
  const text = typeof value === 'string' ? value : VIETNAM_DATE.format(value);
  return text.split('-').reverse().join('/');
};

// Bản chụp dạng bảng PDF dựng bằng bộ xuất bảng dùng chung
export async function tablePdf(fileName: string, sheets: TableFileSheet[], now: Date) {
  return {
    file_name: `${fileName}.pdf`,
    content_type: 'application/pdf',
    body: await buildTableFile('pdf', sheets, now),
  };
}

export function notFound(message: string): never {
  throw validationError([{ field: 'record_id', message }]);
}

// ---- Ba nguồn đã có từ lát L1 ----

async function professionalFile(context: SourceContext, documentId: string) {
  const document = await context.year.database
    .selectFrom('professional_documents')
    .select(['id', 'signed_file_id', 'current_version'])
    .where('id', '=', documentId)
    .executeTakeFirst();
  if (!document) {
    return null;
  }
  const version = document.signed_file_id
    ? null
    : await context.year.database
        .selectFrom('professional_document_versions')
        .select('file_id')
        .where('document_id', '=', document.id)
        .where('version_no', '=', document.current_version)
        .executeTakeFirst();
  const fileId = document.signed_file_id ?? version?.file_id ?? null;
  if (!fileId) {
    return null;
  }
  const file = await context.year.database
    .selectFrom('files')
    .select(['file_name', 'content_type', 'storage_key'])
    .where('id', '=', fileId)
    .executeTakeFirst();
  return file
    ? {
        file_name: file.file_name,
        content_type: file.content_type,
        body: await context.fileStorage.get(file.storage_key),
      }
    : null;
}

const professionalDocument: EvidenceSourceDefinition = {
  permissions: [
    PERMISSION_CODES.professionalRecordUse,
    PERMISSION_CODES.professionalRecordReview,
    PERMISSION_CODES.professionalRecordApprove,
    PERMISSION_CODES.professionalRecordManage,
  ],
  personal_data: false,
  per_school_year: true,
  async search(context, pattern) {
    let query = context.year.database
      .selectFrom('professional_documents')
      .select(['id', 'title', 'owner_name'])
      .where('status', '=', 'approved')
      .orderBy('updated_at', 'desc')
      .limit(SEARCH_LIMIT);
    if (pattern) {
      query = query.where('title', 'ilike', pattern);
    }
    return (await query.execute()).map((row) => ({ id: row.id, label: `${row.title} (${row.owner_name})` }));
  },
  async snapshot(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const document = await context.year.database
      .selectFrom('professional_documents')
      .select(['title', 'owner_name', 'status', 'updated_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!document || document.status !== 'approved') {
      return null;
    }
    return {
      label: `${document.title} (${document.owner_name})`,
      updated_at: document.updated_at,
      file: await professionalFile(context, id),
    };
  },
  async updatedAt(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const row = await context.year.database
      .selectFrom('professional_documents')
      .select('updated_at')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.updated_at ?? null;
  },
};

const incomingDocument: EvidenceSourceDefinition = {
  permissions: [
    PERMISSION_CODES.incomingDocumentView,
    PERMISSION_CODES.incomingDocumentSearch,
    PERMISSION_CODES.incomingDocumentAdmin,
  ],
  personal_data: false,
  per_school_year: false,
  async search(context, pattern) {
    let query = context.system
      .selectFrom('incoming_documents')
      .select(['id', 'symbol', 'document_date', 'summary'])
      .where('status', '<>', 'pending_registration')
      .orderBy('document_date', 'desc')
      .limit(SEARCH_LIMIT);
    if (pattern) {
      query = query.where((eb) => eb.or([eb('summary', 'ilike', pattern), eb('symbol', 'ilike', pattern)]));
    }
    return (await query.execute()).map((row) => ({
      id: row.id,
      label: `${row.symbol} ngày ${formatVietnamDate(row.document_date)}: ${row.summary}`,
    }));
  },
  async snapshot(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const row = await context.system
      .selectFrom('incoming_documents')
      .select(['symbol', 'document_date', 'summary', 'issuer_name', 'status', 'updated_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || row.status === 'pending_registration') {
      return null;
    }
    const file = await context.system
      .selectFrom('incoming_document_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('document_id', '=', id)
      .orderBy('created_at')
      .executeTakeFirst();
    return {
      label: `${row.symbol} ngày ${formatVietnamDate(row.document_date)} của ${row.issuer_name}: ${row.summary}`,
      updated_at: row.updated_at,
      file: file
        ? {
            file_name: file.file_name,
            content_type: file.content_type,
            body: await context.fileStorage.get(file.storage_key),
          }
        : null,
    };
  },
  async updatedAt(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const row = await context.system
      .selectFrom('incoming_documents')
      .select('updated_at')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.updated_at ?? null;
  },
};

const outgoingDocument: EvidenceSourceDefinition = {
  permissions: [
    PERMISSION_CODES.outgoingDocumentDraft,
    PERMISSION_CODES.outgoingDocumentSign,
    PERMISSION_CODES.outgoingDocumentIssue,
    PERMISSION_CODES.outgoingDocumentSearch,
  ],
  personal_data: false,
  per_school_year: false,
  async search(context, pattern) {
    let query = context.system
      .selectFrom('outgoing_documents')
      .select(['id', 'symbol', 'issued_at', 'summary'])
      .where('status', '=', 'issued')
      .orderBy('issued_at', 'desc')
      .limit(SEARCH_LIMIT);
    if (pattern) {
      query = query.where((eb) => eb.or([eb('summary', 'ilike', pattern), eb('symbol', 'ilike', pattern)]));
    }
    return (await query.execute()).map((row) => ({
      id: row.id,
      label: `${row.symbol ?? ''} ngày ${formatVietnamDate(row.issued_at)}: ${row.summary}`,
    }));
  },
  async snapshot(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const row = await context.system
      .selectFrom('outgoing_documents')
      .select(['symbol', 'issue_number', 'issued_at', 'summary', 'status', 'updated_at'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row || row.status !== 'issued') {
      return null;
    }
    const file = await context.system
      .selectFrom('outgoing_document_files')
      .select(['file_name', 'content_type', 'storage_key'])
      .where('document_id', '=', id)
      .where('kind', '=', 'signed')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    return {
      label: `${row.symbol ?? row.issue_number ?? ''} ngày ${formatVietnamDate(row.issued_at)}: ${row.summary}`,
      updated_at: row.updated_at,
      file: file
        ? {
            file_name: file.file_name,
            content_type: file.content_type,
            body: await context.fileStorage.get(file.storage_key),
          }
        : null,
    };
  },
  async updatedAt(context, id) {
    if (!isUuid(id)) {
      return null;
    }
    const row = await context.system
      .selectFrom('outgoing_documents')
      .select('updated_at')
      .where('id', '=', id)
      .executeTakeFirst();
    return row?.updated_at ?? null;
  },
};

const EVIDENCE_SOURCES_L1 = {
  professional_document: professionalDocument,
  incoming_document: incomingDocument,
  outgoing_document: outgoingDocument,
};

// ---- Nguồn của lát L2: đọc qua dịch vụ của phân hệ nguồn để giữ nguyên quyền và phạm vi xem ----

const WHOLE_SCHOOL = 'toan-truong';
const LEVEL_LABELS: Record<string, string> = { not_met: 'Chưa đạt', met: 'Đạt', good: 'Khá', excellent: 'Tốt' };
const STANDARD_TYPE_LABELS: Record<string, string> = { teacher: 'Chuẩn giáo viên', principal: 'Chuẩn hiệu trưởng' };
const unitOf = (id: string) => (id === WHOLE_SCHOOL ? null : isUuid(id) ? id : undefined);
// Ô tìm của các dịch vụ nhận chữ thường, không nhận mẫu LIKE
const needleOf = (pattern: string | null) => (pattern ? pattern.slice(1, -1).replace(/\\(.)/g, '$1') : null);

@Injectable()
export class EvidenceSources {
  private readonly sources: Record<EvidenceRecordTypeCode, EvidenceSourceDefinition>;

  constructor(
    educationPlans: EducationPlansService,
    workPlans: PlansService,
    staffStatistics: StaffStatisticsService,
    professionalStandards: ProfessionalStandardsService,
    facilityReport: FacilityReportService,
    workFiles: WorkFilesService,
    scores: ScoresService,
    attendanceMeals: AttendanceMealsService,
    submissions: UpperLevelSubmissions,
  ) {
    // Toàn trường và các đơn vị theo tên
    const units = async (context: SourceContext, pattern: string | null, title: string) => {
      let query = context.year.database
        .selectFrom('org_units')
        .select(['id', 'name'])
        .orderBy('name')
        .limit(SEARCH_LIMIT - 1);
      if (pattern) {
        query = query.where('name', 'ilike', pattern);
      }
      return [
        { id: WHOLE_SCHOOL, label: `${title} toàn trường, năm học ${context.year.name}` },
        ...(await query.execute()).map((row) => ({
          id: row.id,
          label: `${title} ${row.name}, năm học ${context.year.name}`,
        })),
      ];
    };
    const unitName = async (context: SourceContext, orgUnitId: string | null) =>
      orgUnitId
        ? ((
            await context.year.database
              .selectFrom('org_units')
              .select('name')
              .where('id', '=', orgUnitId)
              .executeTakeFirst()
          )?.name ?? '')
        : 'toàn trường';

    const educationPlan: EvidenceSourceDefinition = {
      permissions: [
        PERMISSION_CODES.educationPlanUse,
        PERMISSION_CODES.educationPlanReview,
        PERMISSION_CODES.educationPlanApprove,
        PERMISSION_CODES.educationPlanFinalize,
        PERMISSION_CODES.educationPlanManage,
      ],
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        const rows = await educationPlans.list(context.currentUser, {
          view: 'all',
          status: null,
          template_id: null,
          q: needleOf(pattern),
          processed: false,
        });
        return rows.slice(0, SEARCH_LIMIT).map((row) => ({
          id: row.id,
          label: `${row.title} (${row.period_label ?? ''}, ${row.owner_name}, ${row.status_label})`,
        }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const plan = await educationPlans.view(context.currentUser, id);
        const file = await educationPlans.exportDocument(context.currentUser, id, 'pdf');
        return {
          label: `${plan.title} (${plan.period_label ?? ''}, ${plan.owner_name})`,
          updated_at: plan.updated_at,
          file: { file_name: file.fileName, content_type: file.contentType, body: file.buffer },
        };
      },
      async updatedAt(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.year.database
          .selectFrom('education_plans')
          .select('updated_at')
          .where('id', '=', id)
          .executeTakeFirst();
        return row?.updated_at ?? null;
      },
    };

    const workPlan: EvidenceSourceDefinition = {
      permissions: null,
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        const rows = await workPlans.list(context.currentUser, { orgUnitId: null, status: null });
        const needle = needleOf(pattern)?.toLowerCase() ?? null;
        return rows
          .filter((row) => !needle || row.title.toLowerCase().includes(needle))
          .slice(0, SEARCH_LIMIT)
          .map((row) => ({ id: row.id, label: `${row.title} (${row.unit_name}, ${row.period_value})` }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const plan = await workPlans.read(context.currentUser, id);
        const unit = await unitName(context, plan.org_unit_id);
        return {
          label: `${plan.title} (${unit}, ${plan.period_value})`,
          updated_at: plan.updated_at,
          file: await tablePdf(
            'ke-hoach-cong-viec',
            [
              {
                title: plan.title,
                heading: [
                  `Đơn vị: ${unit}; kỳ: ${plan.period_value}`,
                  ...(plan.objectives ? [`Mục tiêu: ${plan.objectives}`] : []),
                ],
                columns: [
                  { key: 'content', label: 'Nội dung', width: 60 },
                  { key: 'owner', label: 'Người phụ trách', width: 24 },
                  { key: 'due', label: 'Thời hạn', width: 14 },
                ],
                numbered: true,
                rows: plan.items.map((item) => ({
                  content: item.content,
                  owner: item.owner_name ?? '',
                  due: formatVietnamDate(item.due_date),
                })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.year.database
          .selectFrom('plans')
          .select('updated_at')
          .where('id', '=', id)
          .executeTakeFirst();
        return row?.updated_at ?? null;
      },
    };

    const staffQualification: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.staffStatisticsView],
      personal_data: false,
      per_school_year: true,
      search: (context, pattern) => units(context, pattern, 'Đội ngũ theo trình độ'),
      snapshot: async (context, id) => {
        const orgUnitId = unitOf(id);
        if (orgUnitId === undefined) {
          return null;
        }
        const report = await staffStatistics.build(context.currentUser, orgUnitId);
        const unit = await unitName(context, orgUnitId);
        const total = report.by_qualification.reduce((sum, row) => sum + row.count, 0);
        return {
          label: `Thống kê đội ngũ theo trình độ ${unit}, năm học ${context.year.name}`,
          updated_at: await this.latest(context, 'staff'),
          file: await tablePdf(
            'doi-ngu-theo-trinh-do',
            [
              {
                title: 'Thống kê đội ngũ theo trình độ đào tạo',
                heading: [`Đơn vị: ${unit}; năm học ${context.year.name}; tổng số ${total} người`],
                columns: [
                  { key: 'value', label: 'Trình độ', width: 40 },
                  { key: 'count', label: 'Số người', width: 12 },
                  { key: 'female', label: 'Trong đó nữ', width: 12 },
                  { key: 'percent', label: 'Tỉ lệ (%)', width: 12 },
                ],
                numbered: true,
                rows: report.by_qualification.map((row) => ({ ...row })),
              },
            ],
            context.now,
          ),
        };
      },
      updatedAt: (context) => this.latest(context, 'staff'),
    };

    const professionalEvaluation: EvidenceSourceDefinition = {
      permissions: null,
      personal_data: true,
      personal_data_permissions: [
        PERMISSION_CODES.professionalStandardManage,
        PERMISSION_CODES.professionalStandardAssess,
      ],
      per_school_year: true,
      async search(context, pattern) {
        const rows = await professionalStandards.list(context.currentUser, {
          orgUnitId: null,
          standardType: null,
          status: null,
        });
        const needle = needleOf(pattern)?.toLowerCase() ?? null;
        return rows
          .filter((row) => !needle || row.full_name.toLowerCase().includes(needle))
          .slice(0, SEARCH_LIMIT)
          .map((row) => ({
            id: row.id,
            label: `${STANDARD_TYPE_LABELS[row.standard_type] ?? ''}: ${row.full_name}, năm học ${context.year.name}`,
          }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const evaluation = await professionalStandards.read(context.currentUser, id);
        const staff = await context.year.database
          .selectFrom('staff')
          .select('full_name')
          .where('id', '=', evaluation.staff_id)
          .executeTakeFirst();
        const name = staff?.full_name ?? '';
        const type = STANDARD_TYPE_LABELS[evaluation.standard_type] ?? '';
        return {
          label: `Phiếu đánh giá ${type.toLowerCase()}: ${name}, năm học ${context.year.name}`,
          updated_at: evaluation.updated_at,
          file: await tablePdf(
            'danh-gia-chuan-nghe-nghiep',
            [
              {
                title: `Phiếu đánh giá ${type.toLowerCase()}`,
                heading: [
                  `Người được đánh giá: ${name}; năm học ${context.year.name}`,
                  `Xếp loại: ${evaluation.overall_level ? LEVEL_LABELS[evaluation.overall_level] : 'Chưa xếp loại'}`,
                ],
                columns: [
                  { key: 'criterion', label: 'Tiêu chí', width: 40 },
                  { key: 'self', label: 'Tự đánh giá', width: 12 },
                  { key: 'evidence', label: 'Minh chứng tự ghi', width: 28 },
                  { key: 'assessor', label: 'Cấp trên đánh giá', width: 12 },
                ],
                rows: evaluation.items.map((item) => ({
                  criterion: `${item.criterion_code} ${item.criterion_name}`,
                  self: item.self_rating ? LEVEL_LABELS[item.self_rating] : '',
                  evidence: item.self_evidence ?? '',
                  assessor: item.assessor_rating ? LEVEL_LABELS[item.assessor_rating] : '',
                })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.year.database
          .selectFrom('professional_evaluations')
          .select('updated_at')
          .where('id', '=', id)
          .executeTakeFirst();
        return row?.updated_at ?? null;
      },
    };

    const facility: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.facilitiesReport, PERMISSION_CODES.schoolProfileManage],
      personal_data: false,
      per_school_year: true,
      search: (context, pattern) => units(context, pattern, 'Báo cáo cơ sở vật chất'),
      snapshot: async (context, id) => {
        const orgUnitId = unitOf(id);
        if (orgUnitId === undefined) {
          return null;
        }
        const file = await facilityReport.export(context.currentUser, orgUnitId, null, 'pdf');
        const unit = await unitName(context, orgUnitId);
        return {
          label: `Báo cáo cơ sở vật chất ${unit}, năm học ${context.year.name}`,
          updated_at: await this.latest(context, 'rooms'),
          file: { file_name: file.fileName, content_type: file.contentType ?? 'application/pdf', body: file.buffer },
        };
      },
      updatedAt: (context) => this.latest(context, 'rooms'),
    };

    // ---- Lát L2b: hồ sơ công việc, sổ điểm, điểm danh tháng, biểu đã gửi cấp trên ----

    const WORK_FILE_ITEM_LABELS: Record<string, string> = {
      incoming_document: 'Văn bản đến',
      task: 'Công việc',
      note: 'Ghi chú',
    };
    const workFile: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.workFileUse, PERMISSION_CODES.archiveManage, PERMISSION_CODES.archiveView],
      personal_data: false,
      per_school_year: false,
      async search(context, pattern) {
        const found = new Map<string, { id: string; label: string }>();
        for (const box of ['personal', 'shared', 'archive'] as const) {
          const rows = await workFiles
            .list(context.currentUser, box, { year: null, search: needleOf(pattern) })
            .catch(() => []);
          for (const row of rows) {
            found.set(row.id, { id: row.id, label: `${row.code} ${row.title} (${row.owner_name}, năm ${row.year})` });
          }
        }
        return [...found.values()].slice(0, SEARCH_LIMIT);
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const file = await workFiles.detail(context.currentUser, id);
        return {
          label: `Hồ sơ công việc ${file.code} ${file.title} (${file.owner_name}, năm ${file.year})`,
          updated_at: file.updated_at,
          file: await tablePdf(
            'ho-so-cong-viec',
            [
              {
                title: `Hồ sơ công việc ${file.code}: ${file.title}`,
                heading: [
                  `Người lập: ${file.owner_name}; năm ${file.year}; mở ngày ${formatVietnamDate(file.opened_on)}${
                    file.closed_on ? `, đóng ngày ${formatVietnamDate(file.closed_on)}` : ''
                  }`,
                ],
                columns: [
                  { key: 'type', label: 'Loại', width: 14 },
                  { key: 'title', label: 'Nội dung', width: 56 },
                  { key: 'added', label: 'Người thêm, ngày', width: 26 },
                ],
                numbered: true,
                rows: file.items.map((item) => ({
                  type: WORK_FILE_ITEM_LABELS[item.item_type] ?? item.item_type,
                  title: [item.document_symbol, item.title, item.note].filter(Boolean).join(' · '),
                  added: `${item.added_by_name}, ${formatVietnamDate(item.created_at)}`,
                })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.system
          .selectFrom('work_files')
          .select('updated_at')
          .where('id', '=', id)
          .executeTakeFirst();
        return row?.updated_at ?? null;
      },
    };

    // Sổ điểm một môn của một lớp trong một học kỳ: mã "<lớp>:<môn>:<học kỳ>"
    const TERM_LABELS: Record<string, string> = { first_term: 'Học kỳ I', second_term: 'Học kỳ II' };
    const scoreKey = (id: string) => {
      const [classId, subjectId, term] = id.split(':');
      return classId && subjectId && isUuid(classId) && isUuid(subjectId) && term && term in TERM_LABELS
        ? { classId, subjectId, term: term as 'first_term' | 'second_term' }
        : null;
    };
    const scoreBook: EvidenceSourceDefinition = {
      permissions: [
        PERMISSION_CODES.assessmentView,
        PERMISSION_CODES.assessmentEnter,
        PERMISSION_CODES.assessmentManage,
      ],
      personal_data: true,
      per_school_year: true,
      async search(context, pattern) {
        let query = context.year.database
          .selectFrom('classes')
          .select(['id', 'name'])
          .where('school_level', 'in', ['THCS', 'THPT'])
          .orderBy('name')
          .limit(10);
        if (pattern) {
          query = query.where('name', 'ilike', pattern);
        }
        const options: Array<{ id: string; label: string }> = [];
        for (const classRow of await query.execute()) {
          const overview = await scores.overview(context.currentUser, classRow.id).catch(() => null);
          for (const subject of overview?.subjects ?? []) {
            for (const term of ['first_term', 'second_term'] as const) {
              options.push({
                id: `${classRow.id}:${subject.subject_id}:${term}`,
                label: `Sổ điểm lớp ${classRow.name}, ${subject.subject_name}, ${TERM_LABELS[term]}, năm học ${context.year.name}`,
              });
            }
          }
        }
        return options.slice(0, SEARCH_LIMIT);
      },
      async snapshot(context, id) {
        const key = scoreKey(id);
        if (!key) {
          return null;
        }
        const overview = await scores.overview(context.currentUser, key.classId);
        const subject = overview.subjects.find((row) => row.subject_id === key.subjectId);
        if (!subject) {
          return null;
        }
        const body = await scores.sheetFile(context.currentUser, key.classId, key.subjectId, key.term, 'print');
        return {
          label: `Sổ điểm lớp ${overview.class.name}, ${subject.subject_name}, ${TERM_LABELS[key.term]}, năm học ${context.year.name}`,
          updated_at: await scoreChange(context, key),
          file: { file_name: 'so-diem.pdf', content_type: 'application/pdf', body },
        };
      },
      async updatedAt(context, id) {
        const key = scoreKey(id);
        return key ? scoreChange(context, key) : null;
      },
    };
    const scoreChange = async (
      context: SourceContext,
      key: { classId: string; subjectId: string; term: 'first_term' | 'second_term' },
    ) => {
      const row = await context.year.database
        .selectFrom('score_entries')
        .select((eb) => eb.fn.max('updated_at').as('updated_at'))
        .where('class_id', '=', key.classId)
        .where('subject_id', '=', key.subjectId)
        .where('term_type', '=', key.term)
        .executeTakeFirst();
      return row?.updated_at ? new Date(row.updated_at as unknown as string) : null;
    };

    // Điểm danh của một lớp trong một tháng: mã "<lớp>:<YYYY-MM>"
    const attendanceKey = (id: string) => {
      const [classId, month] = id.split(':');
      return classId && isUuid(classId) && month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? { classId, month } : null;
    };
    const monthLabel = (month: string) => `tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`;
    const attendance: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.attendanceReport],
      personal_data: true,
      per_school_year: true,
      async search(context, pattern) {
        let query = context.year.database.selectFrom('classes').select(['id', 'name']).orderBy('name').limit(10);
        if (pattern) {
          query = query.where('name', 'ilike', pattern);
        }
        const months = await context.year.database
          .selectFrom('attendance_records')
          .select(sql<string>`to_char(attendance_date::date, 'YYYY-MM')`.as('month'))
          .distinct()
          .orderBy('month', 'desc')
          .limit(12)
          .execute();
        const options: Array<{ id: string; label: string }> = [];
        for (const classRow of await query.execute()) {
          for (const { month } of months) {
            options.push({
              id: `${classRow.id}:${month}`,
              label: `Điểm danh lớp ${classRow.name}, ${monthLabel(month)}`,
            });
          }
        }
        return options.slice(0, SEARCH_LIMIT);
      },
      async snapshot(context, id) {
        const key = attendanceKey(id);
        if (!key) {
          return null;
        }
        const matrix = await attendanceMeals.classMatrix(context.currentUser, {
          period: 'month',
          date: `${key.month}-01`,
          orgUnitId: null,
          classId: key.classId,
        });
        if (!matrix.class) {
          return null;
        }
        const name = matrix.class.class_name;
        return {
          label: `Điểm danh lớp ${name}, ${monthLabel(key.month)}`,
          updated_at: await attendanceChange(context, key),
          file: await tablePdf(
            'diem-danh-thang',
            [
              {
                title: `Điểm danh lớp ${name}, ${monthLabel(key.month)}`,
                heading: [`Từ ${formatVietnamDate(matrix.from)} đến ${formatVietnamDate(matrix.to)}`],
                columns: [
                  { key: 'full_name', label: 'Họ và tên', width: 34 },
                  { key: 'expected', label: 'Ngày phải đi học', width: 14 },
                  { key: 'present', label: 'Có mặt', width: 10 },
                  { key: 'absent', label: 'Vắng', width: 10 },
                  { key: 'absent_b', label: 'Vắng không phép', width: 14 },
                  { key: 'rate', label: 'Tỉ lệ đi học (%)', width: 14 },
                ],
                numbered: true,
                rows: matrix.children.map((row) => ({ ...row, rate: row.rate_percent ?? '' })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        const key = attendanceKey(id);
        return key ? attendanceChange(context, key) : null;
      },
    };
    const attendanceChange = async (context: SourceContext, key: { classId: string; month: string }) => {
      const row = await context.year.database
        .selectFrom('attendance_records')
        .select((eb) => eb.fn.max('updated_at').as('updated_at'))
        .where('class_id', '=', key.classId)
        .where(sql<string>`to_char(attendance_date::date, 'YYYY-MM')`, '=', key.month)
        .executeTakeFirst();
      return row?.updated_at ? new Date(row.updated_at as unknown as string) : null;
    };

    // Biểu, báo cáo đã xuất tệp gửi cấp trên trong năm học đang dùng: mã là mã biểu; tệp là tệp đã lưu lúc xuất
    const submission: EvidenceSourceDefinition = {
      permissions: null,
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        const year = await context.system
          .selectFrom('academic_years')
          .select('id')
          .where('name', '=', context.year.name)
          .executeTakeFirst();
        if (!year) {
          return [];
        }
        let query = context.system
          .selectFrom('upper_level_submissions')
          .select(['form_code', 'file_name', 'status'])
          .where('academic_year_id', '=', year.id)
          .where('storage_key', 'is not', null)
          .orderBy('form_code')
          .limit(SEARCH_LIMIT);
        if (pattern) {
          query = query.where((eb) => eb.or([eb('form_code', 'ilike', pattern), eb('file_name', 'ilike', pattern)]));
        }
        return (await query.execute()).map((row) => ({
          id: row.form_code,
          label: `Biểu ${row.form_code} (${row.file_name ?? ''}), năm học ${context.year.name}`,
        }));
      },
      async snapshot(context, id) {
        const file = await submissions.file(context.currentUser, id);
        return {
          label: `Biểu ${id} đã gửi cấp trên (${file.fileName}), năm học ${context.year.name}`,
          updated_at: await submissionChange(context, id),
          file: {
            file_name: file.fileName,
            content_type: file.contentType ?? 'application/octet-stream',
            body: file.buffer,
          },
        };
      },
      updatedAt: (context, id) => submissionChange(context, id),
    };
    const submissionChange = async (context: SourceContext, formCode: string) => {
      const row = await context.system
        .selectFrom('upper_level_submissions')
        .innerJoin('academic_years', 'academic_years.id', 'upper_level_submissions.academic_year_id')
        .select('upper_level_submissions.updated_at')
        .where('academic_years.name', '=', context.year.name)
        .where('upper_level_submissions.form_code', '=', formCode)
        .executeTakeFirst();
      return row?.updated_at ?? null;
    };

    this.sources = {
      ...EVIDENCE_SOURCES_L1,
      education_plan: educationPlan,
      work_plan: workPlan,
      staff_qualification: staffQualification,
      professional_evaluation: professionalEvaluation,
      facility_report: facility,
      work_file: workFile,
      score_book: scoreBook,
      class_attendance: attendance,
      upper_level_submission: submission,
    };
  }

  get(type: EvidenceRecordTypeCode): EvidenceSourceDefinition {
    return this.sources[type];
  }

  // Quyền xem nguồn theo khai báo; nguồn do dịch vụ tự kiểm thì dịch vụ báo lỗi ở lần đọc
  allows(currentUser: CurrentUser, type: EvidenceRecordTypeCode): boolean {
    const permissions = this.sources[type].permissions;
    return permissions === null || permissions.some((code) => currentUser.hasPermission(code));
  }

  // Lần sửa gần nhất của các bản ghi gộp lại thành một nguồn (thống kê đội ngũ, báo cáo cơ sở vật chất)
  private async latest(context: SourceContext, table: 'staff' | 'rooms'): Promise<Date | null> {
    const row = await context.year.database
      .selectFrom(table)
      .select((eb) => eb.fn.max('updated_at').as('updated_at'))
      .executeTakeFirst();
    return row?.updated_at ? new Date(row.updated_at as unknown as string) : null;
  }
}
