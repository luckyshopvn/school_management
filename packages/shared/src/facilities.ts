// Danh mục cố định của cơ sở vật chất, thiết bị dạy học tối thiểu và hồ sơ trường (DT-14 phần 14d, YCTD-102). Máy chủ
// dùng để kiểm tra dữ liệu gửi lên, cổng quản trị dùng để dựng biểu mẫu; tên chỉ tiêu theo khảo sát hệ thống của Sở
// GD&ĐT TP.HCM (tài liệu 31), cần đối chiếu biểu mẫu chính thức của Bộ

export interface CodeLabel<T extends string = string> {
  value: T;
  label: string;
}

// Nhóm tuổi theo Thông tư 02/2010/TT-BGDĐT (sửa đổi bởi Thông tư 34/2013/TT-BGDĐT): ba nhóm nhà trẻ, ba lớp mẫu giáo
export const EQUIPMENT_AGE_GROUPS = [
  { value: 'nt_3_12', label: 'Nhà trẻ 3–12 tháng' },
  { value: 'nt_12_24', label: 'Nhà trẻ 12–24 tháng' },
  { value: 'nt_24_36', label: 'Nhà trẻ 24–36 tháng' },
  { value: 'mg_3_4', label: 'Mẫu giáo 3–4 tuổi' },
  { value: 'mg_4_5', label: 'Mẫu giáo 4–5 tuổi' },
  { value: 'mg_5_6', label: 'Mẫu giáo 5–6 tuổi' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type EquipmentAgeGroup = (typeof EQUIPMENT_AGE_GROUPS)[number]['value'];

// Nhóm thiết bị trong danh mục tối thiểu
export const EQUIPMENT_GROUPS = [
  { value: 'do_dung', label: 'Đồ dùng' },
  { value: 'thiet_bi_do_choi', label: 'Thiết bị dạy học, đồ chơi và học liệu' },
  { value: 'sach_tai_lieu', label: 'Sách, tài liệu, băng đĩa' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type EquipmentGroup = (typeof EQUIPMENT_GROUPS)[number]['value'];

// Lĩnh vực phát triển (thay cho "môn học" của cấp phổ thông)
export const DEVELOPMENT_AREAS = [
  { value: 'the_chat', label: 'Phát triển thể chất' },
  { value: 'nhan_thuc', label: 'Phát triển nhận thức' },
  { value: 'ngon_ngu', label: 'Phát triển ngôn ngữ' },
  { value: 'tinh_cam_xa_hoi', label: 'Phát triển tình cảm, kỹ năng xã hội' },
  { value: 'tham_my', label: 'Phát triển thẩm mỹ' },
] as const satisfies ReadonlyArray<CodeLabel>;

// Định mức tính theo nhóm, lớp hoặc theo số học sinh của nhóm, lớp
export const EQUIPMENT_NORM_BASES = [
  { value: 'class', label: 'Theo nhóm, lớp' },
  { value: 'child', label: 'Theo học sinh' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type EquipmentNormBasis = (typeof EQUIPMENT_NORM_BASES)[number]['value'];

export const EQUIPMENT_TARGET_USERS = [
  { value: 'tre', label: 'Học sinh' },
  { value: 'giao_vien', label: 'Giáo viên' },
  { value: 'tre_giao_vien', label: 'Học sinh và giáo viên' },
] as const satisfies ReadonlyArray<CodeLabel>;

// Năm khối phòng (khảo sát mục 4, dòng 1.1)
export const ROOM_BLOCKS = [
  { value: 'care_education', label: 'Khối phòng nuôi dưỡng, chăm sóc và giáo dục trẻ' },
  { value: 'meal', label: 'Khối phòng tổ chức ăn' },
  { value: 'support', label: 'Khối phòng phụ trợ' },
  { value: 'administration', label: 'Khối phòng hành chính quản trị' },
  { value: 'other', label: 'Khối phòng khác' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type RoomBlock = (typeof ROOM_BLOCKS)[number]['value'];

// Loại phòng theo khối
export const ROOM_TYPES: ReadonlyArray<CodeLabel & { block: RoomBlock }> = [
  { value: 'group_room', label: 'Phòng sinh hoạt chung', block: 'care_education' },
  { value: 'bedroom', label: 'Phòng ngủ', block: 'care_education' },
  { value: 'toilet', label: 'Phòng vệ sinh', block: 'care_education' },
  { value: 'veranda', label: 'Hiên chơi', block: 'care_education' },
  { value: 'physical_education', label: 'Phòng giáo dục thể chất', block: 'support' },
  { value: 'arts_education', label: 'Phòng giáo dục nghệ thuật', block: 'support' },
  { value: 'multi_purpose', label: 'Phòng đa chức năng', block: 'support' },
  { value: 'library', label: 'Thư viện', block: 'support' },
  { value: 'english_room', label: 'Phòng tiếng Anh', block: 'support' },
  { value: 'computer_room', label: 'Phòng tin học', block: 'support' },
  { value: 'health_room', label: 'Phòng y tế', block: 'support' },
  { value: 'storage', label: 'Nhà kho', block: 'support' },
  { value: 'kitchen', label: 'Bếp ăn', block: 'meal' },
  { value: 'food_storage', label: 'Kho thực phẩm', block: 'meal' },
  { value: 'dining_hall', label: 'Nhà ăn', block: 'meal' },
  { value: 'office', label: 'Văn phòng', block: 'administration' },
  { value: 'principal_office', label: 'Phòng hiệu trưởng', block: 'administration' },
  { value: 'vice_principal_office', label: 'Phòng phó hiệu trưởng', block: 'administration' },
  { value: 'administration_office', label: 'Phòng hành chính quản trị', block: 'administration' },
  { value: 'staff_room', label: 'Phòng nhân viên', block: 'administration' },
  { value: 'meeting_room', label: 'Phòng họp', block: 'administration' },
  { value: 'guard_house', label: 'Phòng bảo vệ', block: 'other' },
  { value: 'parking', label: 'Nhà để xe', block: 'other' },
  { value: 'other', label: 'Phòng khác', block: 'other' },
];

// Hiện trạng công trình (khảo sát mục 4, dòng 1.2)
export const ROOM_CONDITIONS = [
  { value: 'permanent', label: 'Kiên cố' },
  { value: 'semi_permanent', label: 'Bán kiên cố' },
  { value: 'temporary', label: 'Tạm' },
  { value: 'borrowed', label: 'Nhờ, mượn, thuê' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type RoomCondition = (typeof ROOM_CONDITIONS)[number]['value'];

export type ProfileFieldKind = 'text' | 'integer' | 'number' | 'boolean' | 'date' | 'choice';

export interface ProfileField {
  key: string;
  label: string;
  kind: ProfileFieldKind;
  options?: ReadonlyArray<CodeLabel>;
}

// Thuộc tính thêm của phòng theo quy chuẩn (khảo sát mục 4, dòng 1.1)
export const ROOM_ATTRIBUTES: ReadonlyArray<ProfileField> = [
  { key: 'sleeping_places', label: 'Số chỗ ngủ', kind: 'integer' },
  { key: 'clear_height_m', label: 'Chiều cao thông thủy (m)', kind: 'number' },
  { key: 'exercise_floor_size', label: 'Kích thước sàn tập', kind: 'text' },
  { key: 'dining_seats', label: 'Số chỗ nhà ăn', kind: 'integer' },
  {
    key: 'toilet',
    label: 'Vệ sinh',
    kind: 'choice',
    options: [
      { value: 'ensuite', label: 'Khép kín' },
      { value: 'adjacent', label: 'Liền kề' },
      { value: 'none', label: 'Không có' },
    ],
  },
  { key: 'has_reading_room', label: 'Phòng đọc', kind: 'boolean' },
  { key: 'has_private_playground', label: 'Sân chơi riêng', kind: 'boolean' },
  { key: 'has_discovery_garden', label: 'Sân vườn khám phá', kind: 'boolean' },
  { key: 'combined_nap', label: 'Phòng học kết hợp nghỉ trưa', kind: 'boolean' },
  { key: 'has_book_storage', label: 'Kho sách', kind: 'boolean' },
  { key: 'library_seats', label: 'Số chỗ thư viện', kind: 'integer' },
];

// Loại hình trường, quyết định cột công lập, tư thục, dân lập của biểu EMIS
export const SCHOOL_OWNERSHIP_TYPES = [
  { value: 'public', label: 'Công lập' },
  { value: 'private', label: 'Tư thục' },
  { value: 'people_founded', label: 'Dân lập' },
] as const satisfies ReadonlyArray<CodeLabel>;

export type SchoolOwnershipType = (typeof SCHOOL_OWNERSHIP_TYPES)[number]['value'];

const flag = (key: string, label: string): ProfileField => ({ key, label, kind: 'boolean' });

// Sáu thẻ của hồ sơ trường (khảo sát mục 3.1, dòng 1.1). Thẻ tài khoản văn phòng điện tử là bảng nhiều dòng, không lưu mật
// khẩu
// Mã định danh điện tử của tổ chức theo Nghị định 69/2024/NĐ-CP gồm đúng 12 chữ số (DT-16 phần 16c)
export const ORGANIZATION_IDENTIFIER_PATTERN = /^\d{12}$/;

export function isValidOrganizationIdentifier(value: string | null | undefined): boolean {
  return typeof value === 'string' && ORGANIZATION_IDENTIFIER_PATTERN.test(value);
}

export const SCHOOL_PROFILE_SECTIONS: ReadonlyArray<{
  key: string;
  label: string;
  fields: ReadonlyArray<ProfileField>;
}> = [
  {
    key: 'general',
    label: 'Thông tin chung',
    fields: [
      {
        key: 'institution_type',
        label: 'Cơ sở giáo dục mầm non',
        kind: 'choice',
        options: [
          { value: 'truong_mam_non', label: 'Trường mầm non' },
          { value: 'truong_mau_giao', label: 'Trường mẫu giáo' },
          { value: 'nha_tre', label: 'Nhà trẻ' },
          { value: 'nhom_tre_doc_lap', label: 'Nhóm trẻ, lớp mẫu giáo độc lập' },
        ],
      },
      { key: 'ownership_type', label: 'Loại hình trường', kind: 'choice', options: SCHOOL_OWNERSHIP_TYPES },
      { key: 'moet_code', label: 'Mã định danh', kind: 'text' },
      // Mã định danh điện tử của tổ chức theo Nghị định 69/2024/NĐ-CP: 12 chữ số (DT-16 phần 16c)
      { key: 'electronic_id_code', label: 'Mã định danh điện tử (NĐ 69, 12 chữ số)', kind: 'text' },
      { key: 'tax_code', label: 'Mã số thuế', kind: 'text' },
      { key: 'name_by_decision', label: 'Tên theo quyết định thành lập', kind: 'text' },
      { key: 'principal_name', label: 'Hiệu trưởng', kind: 'text' },
      { key: 'phone', label: 'Điện thoại', kind: 'text' },
      { key: 'address', label: 'Địa chỉ', kind: 'text' },
      { key: 'fax', label: 'Fax', kind: 'text' },
      { key: 'email', label: 'Thư điện tử', kind: 'text' },
      { key: 'website', label: 'Trang thông tin điện tử', kind: 'text' },
      { key: 'land_area_m2', label: 'Diện tích đất (m²)', kind: 'number' },
      { key: 'building_area_m2', label: 'Diện tích xây dựng (m²)', kind: 'number' },
      { key: 'decision_number', label: 'Số quyết định thành lập', kind: 'text' },
      { key: 'decision_date', label: 'Ngày quyết định thành lập', kind: 'date' },
      { key: 'decision_authority', label: 'Cơ quan cấp quyết định', kind: 'text' },
      { key: 'certificate_number', label: 'Số giấy chứng nhận', kind: 'text' },
      { key: 'change_count', label: 'Lần thay đổi', kind: 'integer' },
      { key: 'program', label: 'Chương trình giáo dục', kind: 'text' },
      // Cập nhật đơn vị quản lý (khảo sát mục 3.1, dòng 1.5)
      { key: 'managing_authority', label: 'Đơn vị quản lý', kind: 'text' },
      { key: 'people_committee', label: 'Ủy ban nhân dân quản lý', kind: 'text' },
      { key: 'province', label: 'Tỉnh, thành phố', kind: 'text' },
      { key: 'ward', label: 'Phường, xã', kind: 'text' },
    ],
  },
  {
    key: 'other_info',
    label: 'Thông tin khác',
    fields: [
      flag('disadvantaged_commune', 'Thuộc xã đặc biệt khó khăn'),
      flag('international_school', 'Trường quốc tế'),
      flag('party_cell', 'Có chi bộ Đảng'),
      flag('industrial_meals', 'Dùng suất ăn công nghiệp'),
      flag('onsite_kitchen', 'Có bếp ăn tại trường'),
      flag('has_computers', 'Có máy tính'),
      flag('has_internet', 'Có kết nối internet'),
      flag('grid_electricity', 'Có điện lưới'),
      flag('clean_water', 'Có nước sạch'),
      flag('drinking_water', 'Có nước uống'),
      flag('gender_separated_toilets', 'Có công trình vệ sinh riêng theo giới'),
      flag('handwashing', 'Có chỗ rửa tay'),
      flag('sex_education', 'Giáo dục giới tính và phòng chống xâm hại'),
      flag('disaster_prevention', 'Giáo dục phòng chống thiên tai'),
      flag('integrated_program', 'Thực hiện chương trình tích hợp'),
      flag('safe_school', 'Đạt trường học an toàn'),
      flag('industrial_zone', 'Thuộc khu công nghiệp'),
      flag('decree_105_support', 'Được hỗ trợ theo Nghị định 105/2020/NĐ-CP'),
      flag('after_hours_care', 'Có giữ trẻ ngoài giờ'),
      flag('advanced_program', 'Thực hiện chương trình tiên tiến'),
      flag('english_familiarization', 'Cho trẻ làm quen tiếng Anh'),
      flag('english_room', 'Có phòng tiếng Anh'),
      flag('playground', 'Có sân chơi'),
      flag('movement_area', 'Có khu vận động'),
      flag('kitchen', 'Có bếp ăn'),
      flag('vietnamese_reinforcement', 'Tăng cường tiếng Việt'),
      flag('minimum_outdoor_toys', 'Đủ đồ chơi ngoài trời tối thiểu'),
      flag('library', 'Có thư viện'),
    ],
  },
  {
    key: 'foreign_elements',
    label: 'Trường có yếu tố nước ngoài',
    fields: [
      flag('has_foreign_element', 'Trường có yếu tố nước ngoài'),
      { key: 'foreign_partner', label: 'Đối tác nước ngoài', kind: 'text' },
      { key: 'investor_country', label: 'Quốc gia của nhà đầu tư', kind: 'text' },
      { key: 'foreign_children', label: 'Số học sinh người nước ngoài', kind: 'integer' },
      { key: 'foreign_teachers', label: 'Số giáo viên người nước ngoài', kind: 'integer' },
    ],
  },
  {
    key: 'internet',
    label: 'Kết nối internet',
    fields: [
      flag('connected', 'Có kết nối internet'),
      {
        key: 'connection_type',
        label: 'Hình thức kết nối',
        kind: 'choice',
        options: [
          { value: 'fiber', label: 'Cáp quang' },
          { value: 'adsl', label: 'ADSL' },
          { value: 'mobile', label: 'Mạng di động 4G, 5G' },
          { value: 'other', label: 'Khác' },
        ],
      },
      { key: 'bandwidth_mbps', label: 'Băng thông (Mbps)', kind: 'number' },
      { key: 'provider', label: 'Nhà cung cấp', kind: 'text' },
      flag('wifi', 'Có wifi cho lớp học'),
    ],
  },
  {
    key: 'it_infrastructure',
    label: 'Hạ tầng, thiết bị, ứng dụng CNTT',
    fields: [
      { key: 'computer_rooms', label: 'Số phòng máy', kind: 'integer' },
      { key: 'management_computers', label: 'Số máy tính dùng cho quản lý', kind: 'integer' },
      { key: 'desktops', label: 'Số máy để bàn', kind: 'integer' },
      { key: 'laptops', label: 'Số máy xách tay', kind: 'integer' },
      { key: 'tablets', label: 'Số máy tính bảng', kind: 'integer' },
      { key: 'projectors', label: 'Số máy chiếu', kind: 'integer' },
      { key: 'smart_tvs', label: 'Số ti vi thông minh', kind: 'integer' },
      { key: 'management_software', label: 'Phần mềm quản lý đang dùng', kind: 'text' },
    ],
  },
];

// Cột của bảng tài khoản văn phòng điện tử (thẻ thứ sáu); không có cột mật khẩu
export const OFFICE_ACCOUNT_FIELDS: ReadonlyArray<ProfileField> = [
  { key: 'account_name', label: 'Tên tài khoản', kind: 'text' },
  { key: 'holder_name', label: 'Người sử dụng', kind: 'text' },
  { key: 'position', label: 'Chức vụ', kind: 'text' },
  { key: 'email', label: 'Thư điện tử', kind: 'text' },
];

export const OFFICE_ACCOUNTS_SECTION = { key: 'office_accounts', label: 'Tài khoản văn phòng điện tử' } as const;
