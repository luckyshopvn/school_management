// Phân hệ Quản lý kí hồ sơ (mục 6 của Sở), bản chạy nội bộ (DT-16 phần 16k): nhãn dùng chung cho máy chủ API (tệp PDF, tệp
// Excel) và cổng quản trị. Không có chữ ký số thật: "kí" là xác nhận nội bộ của người có quyền kí, ghi tên, ngày kí và mã
// băm SHA-256 của tệp hồ sơ lên tệp đã kí
export type SigningObjectType = 'school' | 'class' | 'staff' | 'child' | 'class_log';
export type SigningDossierStatus = 'created' | 'signed' | 'completed' | 'sent' | 'cancelled';
export type SigningSignatureType = 'remote' | 'usb_token' | 'hsm';
export type SigningCertificateStatus = 'draft' | 'registered' | 'revoked';
export type SigningSyncStatus = 'not_synced' | 'synced';

export const SIGNING_OBJECT_TYPES: ReadonlyArray<{ value: SigningObjectType; label: string; tab: string }> = [
  { value: 'school', label: 'Hồ sơ trường', tab: 'Trường' },
  { value: 'class', label: 'Hồ sơ lớp', tab: 'Lớp' },
  { value: 'staff', label: 'Hồ sơ nhân sự', tab: 'Nhân sự' },
  { value: 'child', label: 'Hồ sơ học sinh', tab: 'Học sinh' },
  { value: 'class_log', label: 'Sổ đầu bài', tab: 'Sổ đầu bài' },
];

export const SIGNING_OBJECT_LABELS: Record<SigningObjectType, string> = Object.fromEntries(
  SIGNING_OBJECT_TYPES.map((type) => [type.value, type.label]),
) as Record<SigningObjectType, string>;

// "Chưa tạo" là đối tượng chưa có hồ sơ (chưa hủy) trong năm học
export const SIGNING_STATUS_LABELS: Record<SigningDossierStatus | 'none', string> = {
  none: 'Chưa tạo hồ sơ',
  created: 'Đã tạo, chưa kí',
  signed: 'Đã kí nội bộ',
  completed: 'Đã xác nhận hoàn thành',
  sent: 'Đã đánh dấu gửi',
  cancelled: 'Đã hủy',
};

export const SIGNING_SIGNATURE_TYPE_LABELS: Record<SigningSignatureType, string> = {
  remote: 'Kí từ xa',
  usb_token: 'Thiết bị kí số (USB token)',
  hsm: 'Kí số bằng thiết bị HSM',
};

export const SIGNING_CERTIFICATE_STATUS_LABELS: Record<SigningCertificateStatus, string> = {
  draft: 'Chưa đăng ký',
  registered: 'Đã đăng ký kí nội bộ',
  revoked: 'Đã hủy đăng ký',
};

export const SIGNING_SYNC_STATUS_LABELS: Record<SigningSyncStatus, string> = {
  not_synced: 'Chưa đồng bộ',
  synced: 'Đã đánh dấu đồng bộ',
};
