// Biểu báo cáo EMIS của phân hệ Báo cáo số liệu Mầm non (khảo sát mục 5 của Sở; DT-16 phần 16j). Máy chủ dùng để dựng và
// kiểm tra số liệu, cổng quản trị dùng để dựng màn hình. Tên biểu, số menu theo khảo sát; nội dung chỉ tiêu của Sở chưa xem
// được (biểu trống tới khi bấm Lấy dữ liệu) nên tên chỉ tiêu, mã số do Claude đặt theo dữ liệu có trong hệ thống (Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11), cần đối chiếu biểu mẫu chính thức trước khi dùng thay biểu của Sở

export const EMIS_FORMS = [
  { code: 'emis-start-of-year', menu: '1.1', name: 'Báo cáo EMIS đầu năm', path: '/emis' },
  { code: 'emis-facilities', menu: '1.2', name: 'Báo cáo cơ sở vật chất', path: '/emis/facilities' },
  { code: 'emis-start-of-year-health', menu: '1.3', name: 'Báo cáo sức khỏe học sinh đầu năm', path: '/emis/health' },
  { code: 'emis-end-of-year', menu: '2.1', name: 'Báo cáo EMIS cuối năm', path: '/emis/end-of-year' },
  { code: 'emis-staff', menu: '2.2', name: 'Báo cáo đội ngũ', path: '/emis/staff' },
  { code: 'emis-foreign-language', menu: '2.3', name: 'Đề án ngoại ngữ', path: '/emis/foreign-language' },
  {
    code: 'emis-preschool-end-of-year',
    menu: '2.4',
    name: 'Báo cáo giáo dục mầm non cuối năm',
    path: '/emis/preschool-end-of-year',
  },
] as const;

export type EmisFormCode = (typeof EMIS_FORMS)[number]['code'];

export const EMIS_FORM_CODES = EMIS_FORMS.map((form) => form.code) as EmisFormCode[];

export function isEmisFormCode(value: string): value is EmisFormCode {
  return (EMIS_FORM_CODES as string[]).includes(value);
}

export interface EmisColumn {
  key: string;
  label: string;
}

// Cột của Biểu 1 và các biểu theo số người (khảo sát mục 5, dòng 1.1)
export const EMIS_POPULATION_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'public', label: 'Công lập' },
  { key: 'private', label: 'Tư thục' },
  { key: 'people_founded', label: 'Dân lập' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic_minority', label: 'Dân tộc thiểu số' },
];

// Cột của 1.3 Báo cáo sức khỏe học sinh đầu năm theo khảo sát: theo học sinh, công lập, tư thục, dân lập, nữ, dân tộc
export const EMIS_HEALTH_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số học sinh' },
  { key: 'public', label: 'Công lập' },
  { key: 'private', label: 'Tư thục' },
  { key: 'people_founded', label: 'Dân lập' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic_minority', label: 'Dân tộc' },
];

// Thẻ Ngân sách nhà nước của 1.1: quyết toán năm trước, dự toán và ước thực hiện năm nay (triệu đồng)
export const EMIS_BUDGET_COLUMNS: EmisColumn[] = [
  { key: 'last_year_settlement', label: 'Quyết toán năm trước' },
  { key: 'this_year_estimate', label: 'Dự toán năm nay' },
  { key: 'this_year_expected', label: 'Ước thực hiện năm nay' },
];

// Cột cơ sở vật chất theo hiện trạng công trình (khảo sát mục 4, dòng 1.2)
export const EMIS_FACILITY_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'permanent', label: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Bán kiên cố' },
  { key: 'temporary', label: 'Tạm' },
  { key: 'borrowed', label: 'Nhờ, mượn, thuê' },
  { key: 'area_m2', label: 'Diện tích (m²)' },
];

export const EMIS_QUANTITY_COLUMNS: EmisColumn[] = [{ key: 'total', label: 'Số lượng' }];

export const EMIS_EQUIPMENT_COLUMNS: EmisColumn[] = [
  { key: 'classes', label: 'Số nhóm, lớp' },
  { key: 'equipped_classes', label: 'Nhóm, lớp đủ thiết bị tối thiểu' },
  { key: 'items', label: 'Số thiết bị trong danh mục' },
  { key: 'met_items', label: 'Thiết bị đủ định mức' },
  { key: 'rate_percent', label: 'Tỷ lệ đáp ứng (%)' },
];

// 2.2 Báo cáo đội ngũ
export const EMIS_STAFF_GENERAL_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic_minority', label: 'Dân tộc thiểu số' },
  { key: 'party_member', label: 'Đảng viên' },
  { key: 'postgraduate', label: 'Sau đại học' },
  { key: 'university', label: 'Đại học' },
  { key: 'college', label: 'Cao đẳng' },
  { key: 'intermediate', label: 'Trung cấp' },
  { key: 'other_qualification', label: 'Khác, chưa ghi' },
];

export const EMIS_STAFF_SKILL_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'foreign_language', label: 'Có trình độ ngoại ngữ' },
  { key: 'english', label: 'Tiếng Anh' },
  { key: 'framework_level_3', label: 'Khung năng lực bậc 3 trở lên' },
  { key: 'it', label: 'Có trình độ tin học' },
  { key: 'it_advanced', label: 'Tin học nâng cao' },
];

export const EMIS_STANDARD_COLUMNS: EmisColumn[] = [
  { key: 'evaluated', label: 'Số được đánh giá' },
  { key: 'not_met', label: 'Chưa đạt' },
  { key: 'met', label: 'Đạt' },
  { key: 'good', label: 'Khá' },
  { key: 'excellent', label: 'Tốt' },
];

// 2.3 Đề án ngoại ngữ: thống kê số trường, số trẻ làm quen tiếng Anh
export const EMIS_FOREIGN_LANGUAGE_COLUMNS: EmisColumn[] = [
  { key: 'classes', label: 'Số nhóm, lớp' },
  { key: 'children', label: 'Số trẻ' },
  { key: 'female', label: 'Trẻ nữ' },
  { key: 'periods_per_week', label: 'Số tiết/tuần' },
];
