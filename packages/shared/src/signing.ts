// Phân hệ Quản lý kí hồ sơ (mục 6 của Sở), bản chạy nội bộ (DT-16 phần 16k): nhãn dùng chung cho máy chủ API (tệp PDF, tệp
// Excel) và cổng quản trị. Không có chữ ký số thật: "kí" là xác nhận nội bộ của người có quyền kí, ghi tên, ngày kí và mã
// băm SHA-256 của tệp hồ sơ lên tệp đã kí. DT-17 phần 17b (YCTD-133) chỉnh theo mẫu thật của Sở khảo sát ngày 2026-10-19
export type SigningObjectType = 'school' | 'class' | 'staff' | 'child' | 'class_log';
export type SigningDossierStatus = 'created' | 'signed' | 'completed' | 'sent' | 'cancelled';
export type SigningSignatureType = 'remote' | 'usb_token';
export type SigningCertificateStatus = 'draft' | 'registered' | 'revoked';
export type SigningSyncStatus = 'not_synced' | 'synced';

export const SIGNING_OBJECT_TYPES: ReadonlyArray<{ value: SigningObjectType; label: string; tab: string }> = [
  { value: 'school', label: 'Hồ sơ trường', tab: 'Trường' },
  { value: 'class', label: 'Hồ sơ lớp', tab: 'Lớp' },
  { value: 'staff', label: 'Hồ sơ nhân sự', tab: 'Nhân sự' },
  { value: 'child', label: 'Hồ sơ học sinh', tab: 'Học sinh' },
  { value: 'class_log', label: 'Sổ đầu bài', tab: 'Sổ đầu bài' },
];

// Cấp Mầm non của Sở ẩn "Ký sổ đầu bài", "Xuất dữ liệu sổ đầu bài" (tài liệu 46 mục 10.3.2) nên không tạo hồ sơ sổ đầu bài
// mới; loại class_log giữ lại cho cấp học khác sau này, hồ sơ sổ đầu bài đã có vẫn xem, tải, xác nhận được (DT-17 phần 17b)
export const SIGNING_HIDDEN_OBJECT_TYPES: ReadonlyArray<SigningObjectType> = ['class_log'];
export const SIGNING_VISIBLE_OBJECT_TYPES = SIGNING_OBJECT_TYPES.filter(
  (type) => !SIGNING_HIDDEN_OBJECT_TYPES.includes(type.value),
);

// Hồ sơ có số định danh cá nhân, số CCCD in đủ: chỉ người có quyền xem số định danh tạo, xem, tải được (quyết định của Eric
// ngày 2026-10-19, ngoại lệ có kiểm soát của quy định che số ở YCTD-13)
export const SIGNING_IDENTITY_OBJECT_TYPES: ReadonlyArray<SigningObjectType> = ['staff', 'child'];

export const SIGNING_OBJECT_LABELS: Record<SigningObjectType, string> = Object.fromEntries(
  SIGNING_OBJECT_TYPES.map((type) => [type.value, type.label]),
) as Record<SigningObjectType, string>;

// Mã loại hồ sơ của Sở, là tên phần tử gốc của tệp dữ liệu XML
export const SIGNING_DOSSIER_ROOTS: Record<SigningObjectType, string> = {
  school: 'HO_SO_TRUONG',
  class: 'HO_SO_LOP',
  staff: 'HO_SO_NHAN_SU',
  child: 'HO_SO_HOC_SINH',
  class_log: 'SO_DAU_BAI',
};

// "Chưa tạo hồ sơ", "Chờ ký" như Sở; các trạng thái sau kí là của bản chạy nội bộ
export const SIGNING_STATUS_LABELS: Record<SigningDossierStatus | 'none', string> = {
  none: 'Chưa tạo hồ sơ',
  created: 'Chờ ký',
  signed: 'Đã kí nội bộ',
  completed: 'Đã xác nhận hoàn thành',
  sent: 'Đã đánh dấu gửi',
  cancelled: 'Đã hủy',
};

// Hai kiểu chữ ký của biểu mẫu đăng ký chứng thư số của Sở; chứng thư kiểu HSM của 16k đã chuyển thành REMOTE SIGNING
export const SIGNING_SIGNATURE_TYPE_LABELS: Record<SigningSignatureType, string> = {
  remote: 'REMOTE SIGNING',
  usb_token: 'USB TOKEN',
};

// Năm nhà phát hành chứng thư của biểu mẫu đăng ký của Sở
export const SIGNING_PROVIDERS = ['VNPT-CA', 'BkavCA', 'VIETTEL', 'Ban Cơ yếu Chính phủ', 'MISA'] as const;

export function isSigningProvider(value: string | null | undefined): boolean {
  return (SIGNING_PROVIDERS as readonly string[]).includes(value ?? '');
}

export const SIGNING_CERTIFICATE_STATUS_LABELS: Record<SigningCertificateStatus, string> = {
  draft: 'Chưa đăng ký',
  registered: 'Đã đăng ký kí nội bộ',
  revoked: 'Đã hủy đăng ký',
};

export const SIGNING_SYNC_STATUS_LABELS: Record<SigningSyncStatus, string> = {
  not_synced: 'Chưa đồng bộ',
  synced: 'Đã đánh dấu đồng bộ',
};

// Nội dung hồ sơ kí dạng phần và mục theo mẫu của Sở; dựng tệp PDF, tệp XML và cửa sổ "Xem hồ sơ kí" từ cùng nội dung này
export interface SigningDocumentItem {
  // Tên phần tử XML suy từ nhãn mục (bỏ dấu, viết hoa, nối bằng gạch dưới)
  key: string;
  label: string;
  value: string;
  // Số định danh, CCCD, sổ BHXH: in đủ trên hồ sơ, không ghi giá trị vào nội dung thay đổi
  secret?: boolean;
}

export interface SigningDocumentSection {
  key: string;
  title: string;
  items?: SigningDocumentItem[];
  table?: { columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string>> };
}

export interface SigningDocument {
  root: string;
  title: string;
  sections: SigningDocumentSection[];
}
