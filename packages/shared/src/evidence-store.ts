import type { QualityEvidenceStatusCode } from './quality-assurance.js';

// Kho minh chứng dùng chung của trường (YCTD-396). Một minh chứng dùng cho nhiều tiêu chí, nhiều năm học, nhiều bộ tiêu chí;
// mỗi bộ cấp một mã dạng [Hn-a.b-c] (formatEvidenceCode). Nguồn của mỗi phiên bản là tệp tải lên hoặc bản ghi trong phần mềm
// được chụp lúc gắn (Q-396-4). Bản chụp luôn đầy đủ (Q-396-5); tệp có dữ liệu cá nhân chỉ người có quyền xem nguồn tải được
export const EVIDENCE_RULE_CODE = 'YCTD-396';

// Minh chứng sắp hết hiệu lực khi còn không quá số ngày này (BR-537)
export const EVIDENCE_EXPIRING_DAYS = 30;

export type EvidenceValidityCode = 'none' | 'valid' | 'expiring' | 'expired';

export const EVIDENCE_VALIDITY_LABELS: Record<EvidenceValidityCode, string> = {
  none: 'Không thời hạn',
  valid: 'Còn hiệu lực',
  expiring: 'Sắp hết hiệu lực',
  expired: 'Hết hiệu lực',
};

// Hiệu lực tính từ ngày hết hạn và hôm nay (cả hai dạng YYYY-MM-DD theo giờ Việt Nam); không lưu
export function evidenceValidity(validUntil: string | null, today: string): EvidenceValidityCode {
  if (!validUntil) {
    return 'none';
  }
  if (validUntil < today) {
    return 'expired';
  }
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + EVIDENCE_EXPIRING_DAYS);
  return validUntil <= limit.toISOString().slice(0, 10) ? 'expiring' : 'valid';
}

// Loại bản ghi làm nguồn minh chứng: ba loại đã dùng ở 22f (lát L1) và các loại của bộ đăng ký nguồn (lát L2, L2b)
export type EvidenceRecordTypeCode =
  | 'professional_document'
  | 'incoming_document'
  | 'outgoing_document'
  | 'education_plan'
  | 'work_plan'
  | 'staff_qualification'
  | 'professional_evaluation'
  | 'facility_report'
  | 'work_file'
  | 'score_book'
  | 'class_attendance'
  | 'upper_level_submission';

export const EVIDENCE_RECORD_TYPE_LABELS: Record<EvidenceRecordTypeCode, string> = {
  professional_document: 'Hồ sơ chuyên môn đã duyệt',
  incoming_document: 'Văn bản đến đã vào sổ',
  outgoing_document: 'Văn bản đi đã phát hành',
  education_plan: 'Kế hoạch giáo dục (cá nhân, tổ, trường)',
  work_plan: 'Kế hoạch công việc',
  staff_qualification: 'Thống kê đội ngũ theo trình độ',
  professional_evaluation: 'Phiếu đánh giá chuẩn nghề nghiệp',
  facility_report: 'Báo cáo cơ sở vật chất',
  work_file: 'Hồ sơ công việc',
  score_book: 'Sổ điểm một môn của lớp (một học kỳ)',
  class_attendance: 'Điểm danh của lớp (một tháng)',
  upper_level_submission: 'Biểu, báo cáo đã gửi cấp trên',
};

export type EvidenceEventActionCode =
  'create' | 'update' | 'add_version' | 'link' | 'unlink' | 'delete' | 'import' | 'view_file' | 'download_file';

export const EVIDENCE_EVENT_LABELS: Record<EvidenceEventActionCode, string> = {
  create: 'Tạo minh chứng',
  update: 'Sửa thông tin',
  add_version: 'Thêm phiên bản',
  link: 'Gắn vào tiêu chí',
  unlink: 'Gỡ khỏi tiêu chí',
  delete: 'Xóa minh chứng',
  import: 'Chuyển từ minh chứng của đợt tự đánh giá',
  view_file: 'Xem tệp',
  download_file: 'Tải tệp',
};

// Mã hiển thị trong ngoặc vuông như ở báo cáo tự đánh giá
export const bracketEvidenceCode = (code: string): string => `[${code}]`;

// Loại bộ tiêu chí và đối tượng được đánh giá (YCTD-396 lát L3, Q-396-15)
export type QualityFrameworkKindCode =
  | 'accreditation'
  | 'teacher_standard'
  | 'principal_standard'
  | 'emulation'
  | 'safe_school'
  | 'school_year_plan'
  | 'other';

export const QUALITY_FRAMEWORK_KIND_LABELS: Record<QualityFrameworkKindCode, string> = {
  accreditation: 'Kiểm định chất lượng, chuẩn quốc gia',
  teacher_standard: 'Chuẩn nghề nghiệp giáo viên',
  principal_standard: 'Chuẩn hiệu trưởng',
  emulation: 'Thi đua, khen thưởng',
  safe_school: 'Trường học an toàn',
  school_year_plan: 'Kế hoạch năm học, kiểm tra nội bộ',
  other: 'Khác',
};

export type QualityFrameworkSubjectCode = 'school' | 'person';

export const QUALITY_FRAMEWORK_SUBJECT_LABELS: Record<QualityFrameworkSubjectCode, string> = {
  school: 'Nhà trường',
  person: 'Cá nhân',
};

export const DEFAULT_EVIDENCE_CODE_PATTERN = 'H{hop}-{tieu_chi}-{stt}';

// Mã minh chứng theo mẫu của bộ: {hop} số hộp, {tieu_chuan} mã tiêu chuẩn, {tieu_chi} mã tiêu chí, {stt} số thứ tự hai chữ số
export function formatEvidenceCodePattern(
  pattern: string,
  parts: { box: number; standardCode: string; criterionCode: string; sequence: number },
): string {
  return pattern
    .replaceAll('{hop}', String(parts.box))
    .replaceAll('{tieu_chuan}', parts.standardCode)
    .replaceAll('{tieu_chi}', parts.criterionCode)
    .replaceAll('{stt}', String(parts.sequence).padStart(2, '0'));
}

// Mẫu mã hợp lệ: 5 đến 40 ký tự, có {stt}, chỉ dùng các ô đã biết
export function isEvidenceCodePattern(pattern: string): boolean {
  if (pattern.length < 5 || pattern.length > 40 || !pattern.includes('{stt}')) {
    return false;
  }
  const rest = pattern.replace(/\{(hop|tieu_chuan|tieu_chi|stt)\}/g, '');
  return !/[{}]/.test(rest);
}

// Độ phủ minh chứng của một tiêu chí (YCTD-396 lát L4, MH-682). Tiêu chí thiếu khi không có minh chứng ở trạng thái Đã đủ, còn
// hiệu lực, dùng cho một năm học trong chu kỳ của bộ; minh chứng không ghi năm học dùng cho mọi năm (BR-548)
export interface EvidenceCoverageInput {
  status: QualityEvidenceStatusCode;
  valid_until: string | null;
  school_year_names: string[];
}

export interface EvidenceCoverageCounts {
  sufficient: number;
  collecting: number;
  missing: number;
  needs_update: number;
  expired: number;
  out_of_cycle: number;
  covered: boolean;
}

export function evidenceCoverage(
  evidences: EvidenceCoverageInput[],
  cycleYearNames: string[],
  today: string,
): EvidenceCoverageCounts {
  const counts = { sufficient: 0, collecting: 0, missing: 0, needs_update: 0, expired: 0, out_of_cycle: 0 };
  for (const evidence of evidences) {
    if (evidenceValidity(evidence.valid_until, today) === 'expired') {
      counts.expired += 1;
      continue;
    }
    const inCycle =
      evidence.school_year_names.length === 0 ||
      evidence.school_year_names.some((name) => cycleYearNames.includes(name));
    if (!inCycle) {
      counts.out_of_cycle += 1;
      continue;
    }
    counts[evidence.status] += 1;
  }
  return { ...counts, covered: counts.sufficient > 0 };
}

// Tỉ lệ phần trăm làm tròn, không chia cho 0
export const coveragePercent = (covered: number, total: number): number =>
  total === 0 ? 0 : Math.round((covered * 100) / total);

// Mã minh chứng trích dẫn trong văn bản báo cáo (YCTD-396 lát L5, BR-550): mọi chuỗi trong ngoặc vuông không có khoảng trắng,
// 1 đến 50 ký tự, ví dụ [H1-1.1-01]; trả mã không kèm ngoặc, giữ thứ tự xuất hiện, bỏ trùng
export function citedEvidenceCodes(text: string | null | undefined): string[] {
  const codes: string[] = [];
  for (const match of (text ?? '').matchAll(/\[([^[\]\s]{1,50})\]/g)) {
    const code = match[1] as string;
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  return codes;
}

// Tên tệp trong gói hồ sơ minh chứng: mã minh chứng, bỏ ký tự không dùng được trong tên tệp, giữ phần mở rộng của tệp gốc
export function evidencePackageFileName(code: string, originalName: string | null): string {
  const extension = /\.([A-Za-z0-9]{1,8})$/.exec(originalName ?? '')?.[1]?.toLowerCase() ?? 'pdf';
  return `${code.replace(/[\\/:*?"<>|]/g, '_')}.${extension}`;
}
