// Phân hệ Tuyển sinh đầu cấp (DT-17 phần 17c, YCTD-134; khảo sát 31 mục 10.2): nhãn và danh sách giá trị dùng chung cho máy
// chủ API (lưới, tệp Excel, PDF), cổng quản trị và ứng dụng phụ huynh. Hồ sơ cuối cấp là hồ sơ của trẻ học năm cuối cấp
// chuẩn bị vào cấp trên; cấp Mầm non là trẻ lớp mẫu giáo 5–6 tuổi chuẩn bị vào lớp 1
export type FinalYearStatus =
  | 'parent_pending'
  | 'awaiting_school_edit'
  | 'awaiting_parent_reconfirm'
  | 'parent_confirmed'
  | 'school_edited'
  | 'parent_confirmed_after_edit';
export type FinalYearReviewStatus = 'pending' | 'approved';
export type FinalYearIdentityType = 'has_id' | 'no_id' | 'temporary_id';
export type FinalYearRegistrationSource = 'parent' | 'universal' | 'none';
export type FinalYearResidenceType = 'permanent' | 'temporary' | 'other';
export type FinalYearFileKind = 'birth_certificate' | 'residence' | 'evidence';
export type AdmissionSupportStatus = 'pending' | 'answered';

// Sáu trạng thái hồ sơ theo thứ tự ô lọc của Sở
export const FINAL_YEAR_STATUSES: ReadonlyArray<{ value: FinalYearStatus; label: string }> = [
  { value: 'parent_pending', label: 'PHHS chưa xác nhận' },
  { value: 'awaiting_school_edit', label: 'Chờ đơn vị chỉnh sửa' },
  { value: 'awaiting_parent_reconfirm', label: 'Chờ PHHS xác nhận lại' },
  { value: 'parent_confirmed', label: 'PHHS đã xác nhận' },
  { value: 'school_edited', label: 'Đã chỉnh sửa' },
  { value: 'parent_confirmed_after_edit', label: 'PHHS đã xác nhận sau chỉnh sửa' },
];

export const FINAL_YEAR_REVIEW_STATUSES: ReadonlyArray<{ value: FinalYearReviewStatus; label: string }> = [
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'pending', label: 'Chưa duyệt' },
];

export const FINAL_YEAR_IDENTITY_TYPES: ReadonlyArray<{ value: FinalYearIdentityType; label: string }> = [
  { value: 'has_id', label: 'Đã có số ĐDCN' },
  { value: 'no_id', label: 'Chưa có số ĐDCN' },
  { value: 'temporary_id', label: 'Đã được cấp số ĐDCN tạm' },
];

export const FINAL_YEAR_REGISTRATION_SOURCES: ReadonlyArray<{ value: FinalYearRegistrationSource; label: string }> = [
  { value: 'parent', label: 'PHHS đăng ký' },
  { value: 'universal', label: 'Phổ cập đăng ký' },
  { value: 'none', label: 'Chưa đăng ký' },
];

// Diện cư trú: khảo sát chỉ có nhãn, chưa có danh sách giá trị (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const FINAL_YEAR_RESIDENCE_TYPES: ReadonlyArray<{ value: FinalYearResidenceType; label: string }> = [
  { value: 'permanent', label: 'Thường trú' },
  { value: 'temporary', label: 'Tạm trú' },
  { value: 'other', label: 'Khác' },
];

export const FINAL_YEAR_FILE_KINDS: ReadonlyArray<{ value: FinalYearFileKind; label: string }> = [
  { value: 'birth_certificate', label: 'Giấy khai sinh' },
  { value: 'residence', label: 'Hình ảnh thông tin cư trú trên VNeID (hoặc giấy xác nhận cư trú)' },
  { value: 'evidence', label: 'Minh chứng' },
];

export const ADMISSION_SUPPORT_STATUSES: ReadonlyArray<{ value: AdmissionSupportStatus; label: string }> = [
  { value: 'pending', label: 'Chưa trả lời' },
  { value: 'answered', label: 'Đã trả lời' },
];

const labelsOf = <Value extends string>(items: ReadonlyArray<{ value: Value; label: string }>) =>
  Object.fromEntries(items.map((item) => [item.value, item.label])) as Record<Value, string>;

export const FINAL_YEAR_STATUS_LABELS = labelsOf(FINAL_YEAR_STATUSES);
export const FINAL_YEAR_REVIEW_LABELS = labelsOf(FINAL_YEAR_REVIEW_STATUSES);
export const FINAL_YEAR_IDENTITY_LABELS = labelsOf(FINAL_YEAR_IDENTITY_TYPES);
export const FINAL_YEAR_SOURCE_LABELS = labelsOf(FINAL_YEAR_REGISTRATION_SOURCES);
export const FINAL_YEAR_RESIDENCE_LABELS = labelsOf(FINAL_YEAR_RESIDENCE_TYPES);
export const FINAL_YEAR_FILE_KIND_LABELS = labelsOf(FINAL_YEAR_FILE_KINDS);
export const ADMISSION_SUPPORT_STATUS_LABELS = labelsOf(ADMISSION_SUPPORT_STATUSES);

// Trạng thái phụ huynh đã xác nhận (lần đầu hoặc sau chỉnh sửa): điều kiện để duyệt hồ sơ
export const FINAL_YEAR_CONFIRMED_STATUSES: ReadonlyArray<FinalYearStatus> = [
  'parent_confirmed',
  'parent_confirmed_after_edit',
];

// Năm cuối cấp theo cấp học: cấp Mầm non là bậc học có tháng tuổi bắt đầu từ 60 (lớp mẫu giáo 5–6 tuổi), như hoàn thành
// chương trình (YCTD-102). Cấp học khác thêm dòng ở đây khi hệ thống phục vụ cấp đó
export type EntryAdmissionLevel = 'preschool';
export const FINAL_YEAR_LEVELS: Record<EntryAdmissionLevel, { label: string; minimumAgeMonths: number }> = {
  preschool: { label: 'mầm non', minimumAgeMonths: 60 },
};

// Mục kiểm dò: thông tin bắt buộc của hồ sơ cuối cấp; nội dung kiểm dò liệt kê nhãn của mục còn thiếu
export type FinalYearCheckItem = 'identity' | 'residence' | 'contact' | 'birth_certificate' | 'residence_proof';
export const FINAL_YEAR_CHECK_LABELS: Record<FinalYearCheckItem, string> = {
  identity: 'Chưa có số định danh cá nhân',
  residence: 'Thiếu nơi ở hiện tại (nơi ở theo VNeID, phường/xã, tỉnh/thành phố)',
  contact: 'Thiếu số điện thoại liên hệ',
  birth_certificate: 'Thiếu giấy khai sinh',
  residence_proof: 'Thiếu hình ảnh thông tin cư trú trên VNeID',
};

// Tuyển sinh đầu cấp phần 2 (DT-17 phần 17d, YCTD-135; khảo sát 31 mục 10.2.4): tiếp nhận hồ sơ được phân tuyến về trường,
// đăng ký trường tiên tiến, thông báo tuyển sinh, chuyển hồ sơ trúng tuyển sang hồ sơ học sinh. Hồ sơ là hồ sơ tuyển sinh
// của phân hệ Tuyển sinh (YCTD-86); đợt tuyển sinh thêm loại hình và năm học nhận trẻ
export type AdmissionProgramType = 'general' | 'advanced' | 'survey';
export type AdmissionDecision = 'pending' | 'accepted' | 'declined';
export type AdvancedReviewStatus = 'pending' | 'admitted' | 'not_admitted';
export type AdmissionRecordType = 'account' | 'free';
export type AdmissionDocument =
  'admission_notice' | 'declaration' | 'birth_certificate_copy' | 'primary_transcript' | 'primary_completion';

export const ADMISSION_PROGRAM_TYPES: ReadonlyArray<{ value: AdmissionProgramType; label: string }> = [
  { value: 'general', label: 'Đại trà' },
  { value: 'advanced', label: 'Tiên tiến' },
  { value: 'survey', label: 'Khảo sát' },
];

export const ADMISSION_DECISIONS: ReadonlyArray<{ value: AdmissionDecision; label: string }> = [
  { value: 'pending', label: 'Chưa trả lời' },
  { value: 'accepted', label: 'Phụ huynh đồng ý nhập học' },
  { value: 'declined', label: 'Phụ huynh từ chối nhập học' },
];

// Trường duyệt, xã/phường đồng ý của hồ sơ trường tiên tiến: ba giá trị như ô lọc của Sở
export const ADVANCED_REVIEW_STATUSES: ReadonlyArray<{ value: AdvancedReviewStatus; label: string }> = [
  { value: 'admitted', label: 'Trúng tuyển' },
  { value: 'not_admitted', label: 'Không trúng tuyển' },
  { value: 'pending', label: 'Chưa xác nhận' },
];

export const ADMISSION_RECORD_TYPES: ReadonlyArray<{ value: AdmissionRecordType; label: string }> = [
  { value: 'account', label: 'Có tài khoản' },
  { value: 'free', label: 'Tự do' },
];

// Giấy tờ đã nộp (ô tích ở 1.4): mẫu dùng chung các cấp nên có cả học bạ và giấy xác nhận hoàn thành chương trình tiểu học
export const ADMISSION_DOCUMENTS: ReadonlyArray<{ value: AdmissionDocument; label: string }> = [
  { value: 'admission_notice', label: 'Giấy báo nhập học' },
  { value: 'declaration', label: 'Phiếu kê khai' },
  { value: 'birth_certificate_copy', label: 'Bản sao giấy khai sinh' },
  { value: 'primary_transcript', label: 'Học bạ tiểu học' },
  { value: 'primary_completion', label: 'Giấy xác nhận hoàn thành chương trình tiểu học' },
];

export const ADMISSION_PROGRAM_LABELS = labelsOf(ADMISSION_PROGRAM_TYPES);
export const ADMISSION_DECISION_LABELS = labelsOf(ADMISSION_DECISIONS);
export const ADVANCED_REVIEW_LABELS = labelsOf(ADVANCED_REVIEW_STATUSES);
export const ADMISSION_RECORD_TYPE_LABELS = labelsOf(ADMISSION_RECORD_TYPES);
export const ADMISSION_DOCUMENT_LABELS = labelsOf(ADMISSION_DOCUMENTS);
