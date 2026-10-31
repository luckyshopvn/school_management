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

// Loại bản ghi làm nguồn minh chứng. Lát L1 có ba loại đã dùng ở 22f; lát L2 thêm bộ đăng ký nguồn và các loại khác
export type EvidenceRecordTypeCode = 'professional_document' | 'incoming_document' | 'outgoing_document';

export const EVIDENCE_RECORD_TYPE_LABELS: Record<EvidenceRecordTypeCode, string> = {
  professional_document: 'Hồ sơ chuyên môn đã duyệt',
  incoming_document: 'Văn bản đến đã vào sổ',
  outgoing_document: 'Văn bản đi đã phát hành',
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
