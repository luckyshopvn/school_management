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
import { EmulationCouncilService } from '../emulation/emulation-council.js';
import { EquipmentStocktakesService } from '../facilities/equipment-stocktakes.js';
import { SchoolTerms } from '../health/school-terms.js';
import { StudentHealthService } from '../health/student-health.js';
import { FoodInspectionsService } from '../kitchen/food-inspections.js';
import { FoodSafetyTraceService } from '../kitchen/food-safety-trace.js';
import { SupervisionRecordsService } from '../supervision/supervision-records.js';

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
    emulationCouncil: EmulationCouncilService,
    foodInspections: FoodInspectionsService,
    foodSafetyTrace: FoodSafetyTraceService,
    equipmentStocktakes: EquipmentStocktakesService,
    studentHealth: StudentHealthService,
    schoolTerms: SchoolTerms,
    supervisionRecords: SupervisionRecordsService,
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

    // ---- Lát L7: khen thưởng, biên bản hội đồng thi đua, kiểm thực ba bước, kiểm kê thiết bị, sức khỏe, rèn luyện ----

    // Quyết định khen thưởng, tờ trình đã ban hành: tệp do phân hệ thi đua dựng (kiểm quyền quản lý hoặc quyết định)
    const emulationDecision: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.emulationManage, PERMISSION_CODES.emulationDecide],
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        let query = context.year.database
          .selectFrom('emulation_decisions')
          .select(['id', 'kind', 'number', 'issue_date', 'title'])
          .where('status', '=', 'issued')
          .orderBy('issue_date', 'desc')
          .limit(SEARCH_LIMIT);
        if (pattern) {
          query = query.where((eb) => eb.or([eb('number', 'ilike', pattern), eb('title', 'ilike', pattern)]));
        }
        return (await query.execute()).map((row) => ({ id: row.id, label: decisionLabel(row) }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.year.database
          .selectFrom('emulation_decisions')
          .select(['id', 'kind', 'number', 'issue_date', 'title', 'updated_at'])
          .where('id', '=', id)
          .where('status', '=', 'issued')
          .executeTakeFirst();
        if (!row) {
          return null;
        }
        const file = await emulationCouncil.decisionDocument(context.currentUser, id, 'pdf');
        return {
          label: decisionLabel(row),
          updated_at: row.updated_at,
          file: { file_name: file.fileName, content_type: file.contentType, body: file.buffer },
        };
      },
      async updatedAt(context, id) {
        const row = isUuid(id)
          ? await context.year.database
              .selectFrom('emulation_decisions')
              .select('updated_at')
              .where('id', '=', id)
              .executeTakeFirst()
          : undefined;
        return row?.updated_at ?? null;
      },
    };
    const decisionLabel = (row: { kind: string; number: string | null; issue_date: string | null; title: string }) =>
      [
        row.kind === 'decision' ? 'Quyết định khen thưởng' : 'Tờ trình đề nghị khen thưởng',
        row.number ? `số ${row.number}` : null,
        row.issue_date ? `ngày ${formatVietnamDate(row.issue_date)}` : null,
        row.title,
      ]
        .filter(Boolean)
        .join(', ');

    // Biên bản họp hội đồng thi đua đã kết thúc: bản PDF lưu lúc kết thúc, không đổi
    const emulationMinutes: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.emulationManage, PERMISSION_CODES.emulationDecide, PERMISSION_CODES.emulationUse],
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        let query = context.year.database
          .selectFrom('emulation_meetings as meetings')
          .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'meetings.campaign_id')
          .select(['meetings.id', 'meetings.held_at', 'campaigns.name'])
          .where('meetings.status', '=', 'closed')
          .orderBy('meetings.held_at', 'desc')
          .limit(SEARCH_LIMIT);
        if (pattern) {
          query = query.where('campaigns.name', 'ilike', pattern);
        }
        return (await query.execute()).map((row) => ({ id: row.id, label: minutesLabel(row) }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const row = await context.year.database
          .selectFrom('emulation_meetings as meetings')
          .innerJoin('emulation_campaigns as campaigns', 'campaigns.id', 'meetings.campaign_id')
          .select(['meetings.id', 'meetings.held_at', 'meetings.closed_at', 'campaigns.name'])
          .where('meetings.id', '=', id)
          .where('meetings.status', '=', 'closed')
          .executeTakeFirst();
        if (!row) {
          return null;
        }
        const minutes = await emulationCouncil.minutesFile(context.currentUser, id);
        return {
          label: minutesLabel(row),
          updated_at: row.closed_at,
          file: { file_name: minutes.file.file_name, content_type: minutes.file.content_type, body: minutes.body },
        };
      },
      async updatedAt(context, id) {
        const row = isUuid(id)
          ? await context.year.database
              .selectFrom('emulation_meetings')
              .select('closed_at')
              .where('id', '=', id)
              .executeTakeFirst()
          : undefined;
        return row?.closed_at ?? null;
      },
    };
    const minutesLabel = (row: { held_at: Date | string | null; name: string }) =>
      `Biên bản họp hội đồng thi đua, khen thưởng: ${row.name}${row.held_at ? `, ngày ${formatVietnamDate(row.held_at)}` : ''}`;

    // Kiểm thực ba bước của một bếp trong một ngày: mã "<đơn vị>:<YYYY-MM-DD>"; sổ do phân hệ bếp dựng (ghi nhật ký xuất)
    const inspectionKey = (id: string) => {
      const [orgUnitId, date] = id.split(':');
      return orgUnitId && isUuid(orgUnitId) && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { orgUnitId, date } : null;
    };
    const foodInspection: EvidenceSourceDefinition = {
      permissions: [
        PERMISSION_CODES.kitchenManage,
        PERMISSION_CODES.menuApprove,
        PERMISSION_CODES.kitchenReport,
        PERMISSION_CODES.foodSafetyInspect,
      ],
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        let query = context.year.database
          .selectFrom('food_inspections as inspections')
          .innerJoin('org_units', 'org_units.id', 'inspections.org_unit_id')
          .select(['inspections.org_unit_id', 'inspections.inspection_date', 'org_units.name'])
          .groupBy(['inspections.org_unit_id', 'inspections.inspection_date', 'org_units.name'])
          .orderBy('inspections.inspection_date', 'desc')
          .limit(SEARCH_LIMIT);
        if (pattern) {
          const date = /^%(\d{2})\/(\d{2})\/(\d{4})%$/.exec(pattern);
          query = date
            ? query.where('inspections.inspection_date', '=', `${date[3]}-${date[2]}-${date[1]}`)
            : query.where('org_units.name', 'ilike', pattern);
        }
        return (await query.execute()).map((row) => ({
          id: `${row.org_unit_id}:${String(row.inspection_date).slice(0, 10)}`,
          label: `Kiểm thực ba bước ${row.name}, ngày ${formatVietnamDate(String(row.inspection_date).slice(0, 10))}`,
        }));
      },
      async snapshot(context, id) {
        const key = inspectionKey(id);
        if (!key) {
          return null;
        }
        const day = await foodInspections.day(context.currentUser, key.orgUnitId, key.date);
        if (day.steps.every((step) => step === null)) {
          return null;
        }
        const book = await foodSafetyTrace.book(
          context.currentUser,
          { orgUnitId: key.orgUnitId, from: key.date, to: key.date, book: 'inspections', format: 'pdf' },
          null,
        );
        return {
          label: `Kiểm thực ba bước ${await unitName(context, key.orgUnitId)}, ngày ${formatVietnamDate(key.date)}`,
          updated_at: await inspectionChange(context, key),
          file: { file_name: book.fileName, content_type: book.contentType ?? 'application/pdf', body: book.buffer },
        };
      },
      async updatedAt(context, id) {
        const key = inspectionKey(id);
        return key ? inspectionChange(context, key) : null;
      },
    };
    const inspectionChange = async (context: SourceContext, key: { orgUnitId: string; date: string }) => {
      const row = await context.year.database
        .selectFrom('food_inspections')
        .select((eb) => eb.fn.max('updated_at').as('updated_at'))
        .where('org_unit_id', '=', key.orgUnitId)
        .where('inspection_date', '=', key.date)
        .executeTakeFirst();
      return row?.updated_at ? new Date(row.updated_at as unknown as string) : null;
    };

    // Biên bản kiểm kê thiết bị (đã nộp, đã duyệt, đã đóng); phân hệ thiết bị kiểm phạm vi đơn vị
    const stocktake: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.equipmentManage, PERMISSION_CODES.equipmentStocktake],
      personal_data: false,
      per_school_year: true,
      async search(context, pattern) {
        const needle = needleOf(pattern)?.toLowerCase() ?? null;
        const rows = await equipmentStocktakes.list(context.currentUser, { orgUnitId: null, status: null });
        return rows
          .filter((row) => ['submitted', 'approved', 'closed'].includes(row.status))
          .filter((row) => !needle || `${row.code} ${row.name}`.toLowerCase().includes(needle))
          .slice(0, SEARCH_LIMIT)
          .map((row) => ({ id: row.id, label: `Biên bản kiểm kê thiết bị ${row.code} ${row.name}` }));
      },
      async snapshot(context, id) {
        if (!isUuid(id)) {
          return null;
        }
        const detail = await equipmentStocktakes.detail(context.currentUser, id);
        if (!['submitted', 'approved', 'closed'].includes(detail.status)) {
          return null;
        }
        const file = await equipmentStocktakes.minutes(context.currentUser, id, 'pdf', null);
        return {
          label: `Biên bản kiểm kê thiết bị ${detail.code} ${detail.name}`,
          updated_at: await stocktakeChange(context, id),
          file: { file_name: file.fileName, content_type: file.contentType ?? 'application/pdf', body: file.buffer },
        };
      },
      updatedAt: (context, id) => (isUuid(id) ? stocktakeChange(context, id) : Promise.resolve(null)),
    };
    const stocktakeChange = async (context: SourceContext, id: string) => {
      const row = await context.year.database
        .selectFrom('equipment_stocktakes')
        .select('updated_at')
        .where('id', '=', id)
        .executeTakeFirst();
      const line = await context.year.database
        .selectFrom('equipment_stocktake_lines')
        .select((eb) => eb.fn.max('counted_at').as('counted_at'))
        .where('stocktake_id', '=', id)
        .executeTakeFirst();
      const times = [row?.updated_at, line?.counted_at ? new Date(line.counted_at as unknown as string) : null]
        .filter((value): value is Date => value instanceof Date)
        .map((value) => value.getTime());
      return times.length > 0 ? new Date(Math.max(...times)) : null;
    };

    // Lớp và học kỳ: mã "<lớp>:<first_term|second_term>" (sức khỏe, rèn luyện)
    const classTermKey = (id: string) => {
      const [classId, term] = id.split(':');
      return classId && isUuid(classId) && (term === 'first_term' || term === 'second_term') ? { classId, term } : null;
    };
    const classTerms = async (context: SourceContext, pattern: string | null, title: string) => {
      let query = context.year.database.selectFrom('classes').select(['id', 'name']).orderBy('name').limit(25);
      if (pattern) {
        query = query.where('name', 'ilike', pattern);
      }
      return (await query.execute()).flatMap((row) =>
        (['first_term', 'second_term'] as const).map((term) => ({
          id: `${row.id}:${term}`,
          label: `${title} lớp ${row.name}, ${TERM_LABELS[term]}, năm học ${context.year.name}`,
        })),
      );
    };
    const className = async (context: SourceContext, classId: string) =>
      (await context.year.database.selectFrom('classes').select('name').where('id', '=', classId).executeTakeFirst())
        ?.name ?? null;

    // Cân đo, sức khỏe của một lớp trong một học kỳ: bản đầy đủ có tên học sinh (Q-396-5)
    const health: EvidenceSourceDefinition = {
      permissions: null,
      personal_data: true,
      personal_data_permissions: [PERMISSION_CODES.healthManage, PERMISSION_CODES.growthReport],
      per_school_year: true,
      search: (context, pattern) => classTerms(context, pattern, 'Cân đo, sức khỏe'),
      async snapshot(context, id) {
        const key = classTermKey(id);
        if (!key) {
          return null;
        }
        const grid = await studentHealth.grid(
          context.currentUser,
          key.classId,
          key.term as 'first_term' | 'second_term',
        );
        const label = `Cân đo, sức khỏe lớp ${grid.class.name}, ${TERM_LABELS[key.term as 'first_term']}, năm học ${context.year.name}`;
        return {
          label,
          updated_at: await healthChange(context, key),
          file: await tablePdf(
            'can-do-suc-khoe',
            [
              {
                title: label,
                columns: [
                  { key: 'full_name', label: 'Họ và tên', width: 28 },
                  { key: 'dob', label: 'Ngày sinh', width: 12 },
                  { key: 'measured_on', label: 'Ngày đo', width: 12 },
                  { key: 'weight_kg', label: 'Cân nặng (kg)', width: 12 },
                  { key: 'height_cm', label: 'Chiều cao (cm)', width: 12 },
                  { key: 'note', label: 'Ghi chú', width: 30 },
                ],
                numbered: true,
                rows: grid.rows.map((row) => ({
                  full_name: row.full_name,
                  dob: formatVietnamDate(row.dob),
                  measured_on: formatVietnamDate(row.measured_on),
                  weight_kg: row.weight_kg ?? '',
                  height_cm: row.height_cm ?? '',
                  note: row.note ?? '',
                })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        const key = classTermKey(id);
        return key ? healthChange(context, key) : null;
      },
    };
    const healthChange = async (context: SourceContext, key: { classId: string; term: string }) => {
      const row = await context.year.database
        .selectFrom('student_health_records as records')
        .innerJoin('class_enrollments as enrollments', 'enrollments.child_id', 'records.child_id')
        .select((eb) => eb.fn.max('records.updated_at').as('updated_at'))
        .where('enrollments.class_id', '=', key.classId)
        .where('records.term_type', '=', key.term as 'first_term')
        .executeTakeFirst();
      return row?.updated_at ? new Date(row.updated_at as unknown as string) : null;
    };

    // Ghi nhận rèn luyện của một lớp trong một học kỳ: vi phạm, khen của từng học sinh, bản đầy đủ có tên (Q-396-5)
    const conduct: EvidenceSourceDefinition = {
      permissions: [PERMISSION_CODES.supervisionRecord, PERMISSION_CODES.supervisionManage],
      personal_data: true,
      per_school_year: true,
      search: (context, pattern) => classTerms(context, pattern, 'Ghi nhận rèn luyện'),
      async snapshot(context, id) {
        const key = classTermKey(id);
        const range = key ? (await schoolTerms.ranges()).find((row) => row.term_type === key.term) : undefined;
        if (!key || !range?.start_date || !range.end_date) {
          return null;
        }
        const name = await className(context, key.classId);
        if (!name) {
          return null;
        }
        const records = await supervisionRecords.records(context.currentUser, {
          from: range.start_date,
          to: range.end_date,
          classId: key.classId,
          childId: null,
          mine: false,
        });
        const label = `Ghi nhận rèn luyện lớp ${name}, ${TERM_LABELS[key.term as 'first_term']}, năm học ${context.year.name}`;
        return {
          label,
          updated_at: await conductChange(context, key.classId),
          file: await tablePdf(
            'ghi-nhan-ren-luyen',
            [
              {
                title: label,
                columns: [
                  { key: 'occurred_at', label: 'Ngày', width: 12 },
                  { key: 'full_name', label: 'Học sinh', width: 26 },
                  { key: 'kind', label: 'Loại', width: 10 },
                  { key: 'rule_name', label: 'Nội dung', width: 36 },
                  { key: 'status', label: 'Trạng thái', width: 12 },
                ],
                numbered: true,
                rows: records.map((row) => ({
                  occurred_at: formatVietnamDate(row.occurred_at),
                  full_name: row.full_name,
                  kind: row.kind === 'violation' ? 'Vi phạm' : 'Khen',
                  rule_name: row.rule_name,
                  status: row.status === 'revoked' ? 'Đã hủy' : 'Có hiệu lực',
                })),
              },
            ],
            context.now,
          ),
        };
      },
      async updatedAt(context, id) {
        const key = classTermKey(id);
        return key ? conductChange(context, key.classId) : null;
      },
    };
    const conductChange = async (context: SourceContext, classId: string) => {
      const row = await context.year.database
        .selectFrom('student_conduct_records')
        .select((eb) => [eb.fn.max('created_at').as('created_at'), eb.fn.max('revoked_at').as('revoked_at')])
        .where('class_id', '=', classId)
        .executeTakeFirst();
      const times = [row?.created_at, row?.revoked_at]
        .filter((value) => value !== null && value !== undefined)
        .map((value) => new Date(value as unknown as string).getTime());
      return times.length > 0 ? new Date(Math.max(...times)) : null;
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
      emulation_decision: emulationDecision,
      emulation_minutes: emulationMinutes,
      food_inspection: foodInspection,
      equipment_stocktake: stocktake,
      student_health: health,
      student_conduct: conduct,
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
