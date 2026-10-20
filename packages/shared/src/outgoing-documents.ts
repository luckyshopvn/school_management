// Văn bản đi theo hệ thống quản lý văn bản và điều hành VNPT iOffice (DT-18 phần 18b, YCTD-140; quyết định của Eric ngày
// 2026-10-19): nhãn dùng chung cho máy chủ API (phiếu trình PDF, sổ văn bản đi Excel, trang tra cứu mã QR) và cổng quản
// trị. Tên trường, nút theo khảo sát biểu mẫu văn bản đi ngày 2026-10-19
export type OutgoingDocumentStatus = 'draft' | 'consulting' | 'pending_signature' | 'signed' | 'issued';
export type OutgoingFileKind = 'draft' | 'submission' | 'attachment' | 'signed';
export type OutgoingOpinionStatus = 'pending' | 'answered' | 'finished' | 'closed';
export type OutgoingRecipientType = 'external' | 'internal';
export type OutgoingSendStatus = 'pending' | 'sent' | 'delivered';

export const OUTGOING_DOCUMENT_STATUS_LABELS: Record<OutgoingDocumentStatus, string> = {
  draft: 'Dự thảo',
  consulting: 'Đang lấy ý kiến',
  pending_signature: 'Chờ ký',
  signed: 'Đã ký, chờ cấp số',
  issued: 'Đã ban hành',
};

export const OUTGOING_FILE_KIND_LABELS: Record<OutgoingFileKind, string> = {
  draft: 'Dự thảo',
  submission: 'File phiếu trình',
  attachment: 'Văn bản gửi kèm',
  signed: 'Bản đã ký',
};

export const OUTGOING_OPINION_STATUS_LABELS: Record<OutgoingOpinionStatus, string> = {
  pending: 'Chờ cho ý kiến',
  answered: 'Đã cho ý kiến',
  finished: 'Kết thúc cho ý kiến',
  closed: 'Đã kết thúc lấy ý kiến',
};

export const OUTGOING_RECIPIENT_TYPE_LABELS: Record<OutgoingRecipientType, string> = {
  external: 'Đơn vị bên ngoài',
  internal: 'Đơn vị trong trường',
};

// Đơn vị bên ngoài: chưa kết nối trục liên thông nên văn thư gửi rồi đánh dấu đã gửi; đơn vị trong trường nhận ngay
export const OUTGOING_SEND_STATUS_LABELS: Record<OutgoingSendStatus, string> = {
  pending: 'Chờ gửi',
  sent: 'Đã đánh dấu gửi',
  delivered: 'Đã chuyển vào văn bản đến',
};

// Tệp đính kèm tối đa 50 MB mỗi tệp như văn bản đến
export const OUTGOING_MAXIMUM_FILE_BYTES = 50 * 1024 * 1024;
