import type { KpiSchoolLevelCode } from './kpi.js';

// Bảo đảm chất lượng, tự đánh giá (DT-18 phần 22f, YCTD-149) theo mô tả công khai của trang bảo đảm chất lượng đã khảo sát
// (tài liệu 47 mục 9.4): bộ tiêu chuẩn kiểm định cấu hình được theo cấp học (tiêu chuẩn, tiêu chí, chỉ báo theo mức), đợt tự
// đánh giá có hội đồng và nhóm công tác, phiếu đánh giá tiêu chí, minh chứng có mã và bốn trạng thái, kế hoạch cải tiến nối
// Quản lý công việc, báo cáo tự đánh giá xuất Word, PDF, theo dõi hiệu lực công nhận nối mục 1.7 (17e). Bộ tiêu chuẩn là cấu
// hình lưu ở cơ sở dữ liệu; bộ dưới đây chỉ là bản nạp mặc định (Mầm non trước, các cấp khác thêm sau DT-19). Các lựa chọn
// chi tiết do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const QUALITY_RULE_CODE = 'YCTD-149';

// Đợt tự đánh giá: đang chuẩn bị (lập hội đồng, nhóm, phân công), đang đánh giá, đã hoàn thành
export type QualityAssessmentStatusCode = 'draft' | 'in_progress' | 'completed';
// Phiếu đánh giá tiêu chí: đang soạn, đã nộp chờ duyệt, đã duyệt, bị trả lại
export type QualityReportStatusCode = 'draft' | 'submitted' | 'approved' | 'returned';
// Bốn trạng thái của minh chứng
export type QualityEvidenceStatusCode = 'missing' | 'collecting' | 'sufficient' | 'needs_update';
// Nguồn của minh chứng: tệp tải lên, hồ sơ của kho hồ sơ chuyên môn (18e), văn bản đến (18a), văn bản đi (18b), chưa có tệp
export type QualityEvidenceSourceCode =
  'upload' | 'professional_document' | 'incoming_document' | 'outgoing_document' | 'none';
export type QualityCouncilPositionCode = 'chair' | 'vice_chair' | 'secretary' | 'member';

export const QUALITY_ASSESSMENT_STATUS_LABELS: Record<QualityAssessmentStatusCode, string> = {
  draft: 'Đang chuẩn bị',
  in_progress: 'Đang đánh giá',
  completed: 'Đã hoàn thành',
};

export const QUALITY_REPORT_STATUS_LABELS: Record<QualityReportStatusCode, string> = {
  draft: 'Đang soạn',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  returned: 'Bị trả lại',
};

export const QUALITY_EVIDENCE_STATUS_LABELS: Record<QualityEvidenceStatusCode, string> = {
  missing: 'Chưa có',
  collecting: 'Đang thu thập',
  sufficient: 'Đã đủ',
  needs_update: 'Cần cập nhật',
};

export const QUALITY_EVIDENCE_SOURCE_LABELS: Record<QualityEvidenceSourceCode, string> = {
  upload: 'Tệp tải lên',
  professional_document: 'Kho hồ sơ chuyên môn',
  incoming_document: 'Văn bản đến',
  outgoing_document: 'Văn bản đi',
  none: 'Chưa có tệp',
};

export const QUALITY_COUNCIL_POSITION_LABELS: Record<QualityCouncilPositionCode, string> = {
  chair: 'Chủ tịch',
  vice_chair: 'Phó Chủ tịch',
  secretary: 'Thư kí',
  member: 'Ủy viên',
};

// Mức đạt của tiêu chí: 0 là chưa đạt Mức 1
export const QUALITY_MAXIMUM_LEVEL = 4;
export const qualityLevelLabel = (level: number | null | undefined): string =>
  level === null || level === undefined ? 'Chưa đánh giá' : level === 0 ? 'Chưa đạt' : `Mức ${level}`;

export const QUALITY_LIMITS = {
  text: 20_000,
  actions: 30,
  members: 100,
  groups: 30,
  // Thời hạn hiệu lực của công nhận khi không ghi ngày hết hiệu lực: 5 năm kể từ ngày công nhận
  recognitionYears: 5,
  // Báo trước khi công nhận sắp hết hiệu lực
  recognitionWarningDays: 365,
};

export const QUALITY_MAXIMUM_FILE_BYTES = 20 * 1024 * 1024;

// Một việc của kế hoạch cải tiến trong phiếu đánh giá tiêu chí; việc có người phụ trách và hạn thành đầu việc của kế hoạch
// công việc
export interface QualityImprovementAction {
  content: string;
  owner_staff_id: string | null;
  due_date: string | null;
  resources: string | null;
}

// Mã minh chứng theo cách đánh mã quen dùng ở báo cáo tự đánh giá: [Hn-a.b-c] với n là số hộp (mặc định số tiêu chuẩn),
// a.b là mã tiêu chí, c là số thứ tự trong tiêu chí (hai chữ số)
export function formatEvidenceCode(box: number, criterionCode: string, sequence: number): string {
  return `H${box}-${criterionCode}-${String(sequence).padStart(2, '0')}`;
}

// Mức gợi ý của một tiêu chí từ các chỉ báo: đạt mức L khi mọi chỉ báo của các mức từ 1 đến L đều đạt; mức không có chỉ báo
// thì không tính. Không có chỉ báo nào thì không gợi ý (người đánh giá tự chọn)
export function suggestCriterionLevel(
  indicators: Array<{ id: string; level: number }>,
  results: Record<string, boolean>,
): number | null {
  if (indicators.length === 0) {
    return null;
  }
  const levels = [...new Set(indicators.map((indicator) => indicator.level))].sort((a, b) => a - b);
  let reached = 0;
  for (const level of levels) {
    if (level !== reached + 1) {
      break;
    }
    if (!indicators.filter((indicator) => indicator.level === level).every((indicator) => results[indicator.id])) {
      break;
    }
    reached = level;
  }
  return reached;
}

export interface QualityLevelSummary {
  total: number;
  assessed: number;
  // Số tiêu chí theo mức tự đánh giá, chỉ số 0 là chưa đạt
  by_level: number[];
  // Mức gợi ý của trường: mức thấp nhất của các tiêu chí, khi mọi tiêu chí đã đánh giá
  suggested: number | null;
}

// Tổng hợp mức đạt; mức của trường do hội đồng quyết định, hệ thống chỉ gợi ý mức thấp nhất của các tiêu chí vì quy định
// xếp mức của từng cấp học khác nhau (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export function summarizeQualityLevels(levels: Array<number | null>): QualityLevelSummary {
  const byLevel = Array.from({ length: QUALITY_MAXIMUM_LEVEL + 1 }, () => 0);
  let assessed = 0;
  for (const level of levels) {
    if (level !== null && level >= 0 && level <= QUALITY_MAXIMUM_LEVEL) {
      byLevel[level] = (byLevel[level] ?? 0) + 1;
      assessed += 1;
    }
  }
  const suggested =
    levels.length > 0 && assessed === levels.length ? Math.min(...levels.map((level) => level ?? 0)) : null;
  return { total: levels.length, assessed, by_level: byLevel, suggested };
}

// Ngày hết hiệu lực của công nhận: ngày ghi ở quyết định, không có thì cộng thời hạn mặc định
export function recognitionValidUntil(recognitionDate: string | null, validUntil: string | null): string | null {
  if (validUntil) {
    return validUntil;
  }
  if (!recognitionDate) {
    return null;
  }
  const year = Number(recognitionDate.slice(0, 4)) + QUALITY_LIMITS.recognitionYears;
  return `${year}${recognitionDate.slice(4)}`;
}

export interface QualityCriterionSeed {
  code: string;
  title: string;
  evidence_hint?: string;
}

export interface QualityStandardSeed {
  code: string;
  title: string;
  criteria: QualityCriterionSeed[];
}

export interface QualityFrameworkSeed {
  code: string;
  name: string;
  legal_basis: string;
  max_level: number;
  standards: QualityStandardSeed[];
}

const criterion = (code: string, title: string, evidence_hint?: string): QualityCriterionSeed => ({
  code,
  title,
  ...(evidence_hint ? { evidence_hint } : {}),
});

// Bộ mẫu Mầm non: năm tiêu chuẩn, hai mươi lăm tiêu chí theo cấu trúc của quy định kiểm định chất lượng giáo dục và công nhận
// đạt chuẩn quốc gia đối với trường mầm non (Thông tư 19/2018/TT-BGDĐT, đã sửa đổi, bổ sung). Chỉ nạp tên tiêu chuẩn, tiêu
// chí và gợi ý minh chứng; nội dung chỉ báo từng mức trường nhập theo văn bản hiện hành (không chép nguyên văn ở đây). Trường
// đối chiếu với văn bản gốc, sửa tên, thêm, bớt sau khi nạp; nạp lại không tạo trùng mã bộ
const MN_FRAMEWORK: QualityFrameworkSeed = {
  code: 'MN-KDCL',
  name: 'Kiểm định chất lượng giáo dục trường mầm non',
  legal_basis:
    'Thông tư 19/2018/TT-BGDĐT và các văn bản sửa đổi, bổ sung; trường đối chiếu văn bản hiện hành trước khi dùng',
  max_level: 3,
  standards: [
    {
      code: '1',
      title: 'Tổ chức và quản lý nhà trường',
      criteria: [
        criterion(
          '1.1',
          'Phương hướng, chiến lược xây dựng và phát triển nhà trường',
          'Kế hoạch chiến lược, nghị quyết',
        ),
        criterion('1.2', 'Hội đồng trường và các hội đồng khác', 'Quyết định thành lập, biên bản họp'),
        criterion('1.3', 'Tổ chức Đảng, các đoàn thể và tổ chức khác trong nhà trường'),
        criterion('1.4', 'Hiệu trưởng, phó hiệu trưởng, tổ chuyên môn và tổ văn phòng'),
        criterion('1.5', 'Tổ chức nhóm trẻ và lớp mẫu giáo', 'Danh sách nhóm, lớp; quyết định phân công'),
        criterion('1.6', 'Quản lý hành chính, tài chính và tài sản', 'Sổ sách hành chính, báo cáo tài chính, kiểm kê'),
        criterion('1.7', 'Quản lý cán bộ, giáo viên và nhân viên'),
        criterion('1.8', 'Quản lý các hoạt động giáo dục', 'Kế hoạch giáo dục nhà trường'),
        criterion('1.9', 'Thực hiện quy chế dân chủ cơ sở', 'Quy chế dân chủ, biên bản hội nghị'),
        criterion('1.10', 'Bảo đảm an ninh trật tự, an toàn trường học'),
      ],
    },
    {
      code: '2',
      title: 'Cán bộ quản lý, giáo viên và nhân viên',
      criteria: [
        criterion('2.1', 'Đối với hiệu trưởng, phó hiệu trưởng', 'Kết quả đánh giá chuẩn hiệu trưởng'),
        criterion('2.2', 'Đối với giáo viên', 'Kết quả đánh giá chuẩn nghề nghiệp giáo viên'),
        criterion('2.3', 'Đối với nhân viên'),
      ],
    },
    {
      code: '3',
      title: 'Cơ sở vật chất và thiết bị dạy học',
      criteria: [
        criterion('3.1', 'Diện tích, khuôn viên và sân vườn', 'Số liệu diện tích ở mục 1.7, hồ sơ đất'),
        criterion('3.2', 'Khối phòng nhóm trẻ, lớp mẫu giáo và khối phòng phục vụ học tập'),
        criterion('3.3', 'Khối phòng hành chính - quản trị'),
        criterion('3.4', 'Khối phòng tổ chức ăn', 'Hồ sơ bếp, an toàn thực phẩm'),
        criterion('3.5', 'Thiết bị, đồ dùng, đồ chơi', 'Sổ thiết bị, đối sánh danh mục tối thiểu'),
        criterion('3.6', 'Hệ thống cấp thoát nước, công trình vệ sinh và xử lý chất thải'),
      ],
    },
    {
      code: '4',
      title: 'Quan hệ giữa nhà trường, gia đình và xã hội',
      criteria: [
        criterion('4.1', 'Ban đại diện cha mẹ trẻ', 'Danh sách, kế hoạch, biên bản họp'),
        criterion(
          '4.2',
          'Công tác tham mưu cấp ủy đảng, chính quyền và phối hợp với các tổ chức, cá nhân của nhà trường',
        ),
      ],
    },
    {
      code: '5',
      title: 'Hoạt động và kết quả nuôi dưỡng, chăm sóc và giáo dục trẻ',
      criteria: [
        criterion('5.1', 'Thực hiện Chương trình giáo dục mầm non'),
        criterion('5.2', 'Tổ chức hoạt động nuôi dưỡng, chăm sóc và giáo dục trẻ'),
        criterion('5.3', 'Kết quả nuôi dưỡng và chăm sóc sức khỏe', 'Báo cáo sức khỏe, dinh dưỡng'),
        criterion('5.4', 'Kết quả giáo dục'),
      ],
    },
  ],
};

export const QUALITY_DEFAULT_FRAMEWORKS: Record<KpiSchoolLevelCode, QualityFrameworkSeed[]> = {
  MN: [MN_FRAMEWORK],
  TH: [],
  THCS: [],
  THPT: [],
};
