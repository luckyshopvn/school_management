import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase, SystemDatabase } from '@school-management/database';
import { validationError } from '@school-management/server';
import { PERMISSION_CODES, type EvidenceRecordTypeCode } from '@school-management/shared';
import type { Kysely } from 'kysely';
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

    this.sources = {
      ...EVIDENCE_SOURCES_L1,
      education_plan: educationPlan,
      work_plan: workPlan,
      staff_qualification: staffQualification,
      professional_evaluation: professionalEvaluation,
      facility_report: facility,
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
