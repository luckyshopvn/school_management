// Văn bản đến theo hệ thống quản lý văn bản và điều hành VNPT iOffice (DT-18 phần 18a, YCTD-138; quyết định của Eric ngày
// 2026-10-19): nhãn dùng chung cho máy chủ API (phiếu PDF, sổ Excel) và cổng quản trị. Tên trường, nút, giá trị chọn theo
// khảo sát biểu mẫu THÔNG TIN VĂN BẢN ĐẾN ngày 2026-10-19
export type IncomingDocumentStatus = 'pending_registration' | 'registered' | 'processing' | 'completed';
export type IncomingDocumentAuthority = 'normal' | 'outside';
export type IncomingDocumentKind = 'new' | 'revoke' | 'replace';
export type IncomingTransferMethod = 'hand' | 'post' | 'email' | 'interconnect';
export type IncomingCopyType = 'original' | 'certified_copy' | 'transcribed_copy' | 'extract_copy';
export type IncomingAssignmentRole = 'leader' | 'main' | 'coordinate' | 'view';
export type IncomingAssignmentStatus = 'pending' | 'forwarded' | 'done' | 'returned' | 'revoked' | 'refused' | 'closed';
export type DocumentCatalogKind = 'form' | 'urgency' | 'secrecy' | 'field';

export const INCOMING_DOCUMENT_STATUS_LABELS: Record<IncomingDocumentStatus, string> = {
  pending_registration: 'Chờ vào sổ',
  registered: 'Đã vào sổ',
  processing: 'Đang xử lý',
  completed: 'Đã kết thúc',
};

export const INCOMING_AUTHORITY_LABELS: Record<IncomingDocumentAuthority, string> = {
  normal: 'Thường',
  outside: 'Không thuộc thẩm quyền',
};

export const INCOMING_KIND_LABELS: Record<IncomingDocumentKind, string> = {
  new: 'Văn bản mới',
  revoke: 'Thu hồi',
  replace: 'Thay thế',
};

export const INCOMING_TRANSFER_LABELS: Record<IncomingTransferMethod, string> = {
  hand: 'Trao tay',
  post: 'Bưu điện',
  email: 'E-mail',
  interconnect: 'Liên thông',
};

export const INCOMING_COPY_LABELS: Record<IncomingCopyType, string> = {
  original: 'Bản gốc',
  certified_copy: 'Sao y',
  transcribed_copy: 'Sao lục',
  extract_copy: 'Trích sao',
};

export const INCOMING_ROLE_LABELS: Record<IncomingAssignmentRole, string> = {
  leader: 'Lãnh đạo',
  main: 'Xử lý chính',
  coordinate: 'Phối hợp',
  view: 'Xem để biết',
};

// Ký hiệu vai trò trên danh sách như chú thích màu của iOffice
export const INCOMING_ROLE_TAGS: Partial<Record<IncomingAssignmentRole, string>> = {
  main: 'XLC',
  coordinate: 'PH',
};

export const INCOMING_ASSIGNMENT_STATUS_LABELS: Record<IncomingAssignmentStatus, string> = {
  pending: 'Chờ xử lý',
  forwarded: 'Đã chuyển',
  done: 'Đã xử lý',
  returned: 'Đã trả lại',
  revoked: 'Bị lấy lại',
  refused: 'Đã từ chối',
  closed: 'Văn bản đã kết thúc',
};

export const DOCUMENT_CATALOG_KIND_LABELS: Record<DocumentCatalogKind, string> = {
  form: 'Hình thức văn bản',
  urgency: 'Độ khẩn',
  secrecy: 'Độ mật',
  field: 'Lĩnh vực',
};

// Tệp đính kèm tối đa 50 MB mỗi tệp như iOffice
export const INCOMING_MAXIMUM_FILE_BYTES = 50 * 1024 * 1024;
// "Đến hạn": hạn xử lý trong 2 ngày tới, kể cả hôm nay (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const INCOMING_DUE_SOON_DAYS = 2;
