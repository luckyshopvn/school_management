// Biểu báo cáo EMIS của phân hệ Báo cáo số liệu Mầm non (khảo sát mục 5 của Sở; DT-16 phần 16j). Máy chủ dùng để dựng và
// kiểm tra số liệu, cổng quản trị dùng để dựng màn hình. Từ DT-17 phần 17a (YCTD-132; khảo sát mục 10.4) Biểu 01.ĐN-MN, Biểu
// 08.ĐN-NSNN, thẻ 1 của 1.2.1, 2.1, 2.2, 2.3 theo đúng tên chỉ tiêu, mã số, cột của Sở; các thẻ chưa khảo sát được nội dung
// (thẻ 2 đến 5 của 1.2.1, 1.3, 2.4) giữ tên chỉ tiêu do Claude đặt và ghi chú cần đối chiếu

export const EMIS_FORMS = [
  { code: 'emis-start-of-year', menu: '1.1.1', name: 'Lập báo cáo đầu năm', path: '/emis' },
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

// Lưới biểu mẫu của 1.1.2 Gửi báo cáo đầu năm (khảo sát mục 10.4.3): bốn thẻ đầu của Biểu 01.ĐN-MN và Biểu 08.ĐN-NSNN gửi
// riêng từng dòng; mỗi dòng là một biểu mẫu của mẫu "gửi lên cấp trên" (phần 16a) với mã riêng
export const EMIS_START_OF_YEAR_PARTS = [
  { code: 'emis-01-school-classes', tab: 'school_classes', name: 'Biểu 01.ĐN-MN: Trường - Nhóm, lớp' },
  { code: 'emis-01-children', tab: 'children', name: 'Biểu 01.ĐN-MN: Trẻ em' },
  { code: 'emis-01-staff', tab: 'staff', name: 'Biểu 01.ĐN-MN: Đội ngũ' },
  { code: 'emis-01-rooms', tab: 'rooms', name: 'Biểu 01.ĐN-MN: Phòng học' },
  { code: 'emis-08-budget', tab: 'budget', name: 'Biểu 08.ĐN-NSNN: Ngân sách nhà nước' },
] as const;

export type EmisStartOfYearPartCode = (typeof EMIS_START_OF_YEAR_PARTS)[number]['code'];

// Lưới hồ sơ của 1.1.2 (khảo sát mục 10.4.3), thứ tự như Sở
export const EMIS_RECORD_TYPES = [
  { value: 'school', label: 'Hồ sơ trường' },
  { value: 'staff', label: 'Hồ sơ giáo viên' },
  { value: 'class', label: 'Hồ sơ lớp' },
  { value: 'child', label: 'Hồ sơ học sinh' },
  { value: 'health_first_term', label: 'Sức khỏe nuôi dưỡng kỳ I' },
] as const;

export type EmisRecordTypeCode = (typeof EMIS_RECORD_TYPES)[number]['value'];

// Hoàn thành dữ liệu của lưới biểu mẫu 1.1.2 như Sở; "Chưa đầy đủ dữ liệu" là trạng thái thêm của mình khi còn điều kiện
// chưa đạt
export const EMIS_DATA_COMPLETION_LABELS = {
  complete: 'Đã đầy đủ dữ liệu',
  no_data: 'Không có dữ liệu',
  incomplete: 'Chưa đầy đủ dữ liệu',
} as const;

export interface EmisColumn {
  key: string;
  label: string;
  // Tiêu đề nhóm của cột (hàng tiêu đề thứ nhất), ví dụ "Kiên cố" trên hai cột "Tổng số", "Xây dựng mới"
  group?: string;
}

// Thẻ 1. Trường – Lớp của Biểu 01.ĐN-MN
export const EMIS_OWNERSHIP_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'public', label: 'Công lập' },
  { key: 'private', label: 'Tư thục' },
  { key: 'people_founded', label: 'Dân lập' },
];

// Thẻ 2. Trẻ em của Biểu 01.ĐN-MN
export const EMIS_CHILD_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng', group: 'Tổng số' },
  { key: 'female', label: 'Nữ', group: 'Tổng số' },
  { key: 'ethnic_total', label: 'Tổng', group: 'Dân tộc thiểu số' },
  { key: 'ethnic_female', label: 'Nữ', group: 'Dân tộc thiểu số' },
];

// Thẻ 3. Đội ngũ của Biểu 01.ĐN-MN
export const EMIS_STAFF_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic', label: 'Dân tộc' },
  { key: 'civil_servant', label: 'Viên chức', group: 'Phân loại' },
  { key: 'labor_contract', label: 'Hợp đồng lao động', group: 'Phân loại' },
  { key: 'indefinite_contract', label: 'HĐLV không xác định thời hạn', group: 'Phân loại' },
  { key: 'fixed_term_contract', label: 'HĐLV xác định thời hạn', group: 'Phân loại' },
];

// Thẻ 4. Cơ sở vật chất của Biểu 01.ĐN-MN
export const EMIS_ROOM_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'permanent', label: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Bán kiên cố' },
  { key: 'temporary', label: 'Tạm' },
];

// Thẻ 5. Ngân sách nhà nước theo Biểu 08.ĐN-NSNN (triệu đồng)
export const EMIS_BUDGET_COLUMNS: EmisColumn[] = [
  { key: 'estimate', label: 'Dự toán' },
  { key: 'expected', label: 'Ước thực hiện' },
];

// Thẻ 1. Cơ sở vật chất của 1.2.1 Báo cáo cơ sở vật chất của TP.HCM
export const EMIS_HCM_FACILITY_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'permanent', label: 'Tổng số', group: 'Kiên cố' },
  { key: 'permanent_new', label: 'Xây dựng mới', group: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Tổng số', group: 'Bán kiên cố' },
  { key: 'semi_permanent_new', label: 'Xây dựng mới', group: 'Bán kiên cố' },
  { key: 'temporary', label: 'Tạm' },
];

// Cột theo số người của các biểu chưa khảo sát được nội dung (1.3, 2.4) và Biểu 1 cũ (YCTD-102)
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

// Cột cơ sở vật chất theo hiện trạng công trình của thẻ Nhà vệ sinh của 1.2.1 (thẻ chưa khảo sát được, DT-16 phần 16j)
export const EMIS_FACILITY_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'permanent', label: 'Kiên cố' },
  { key: 'semi_permanent', label: 'Bán kiên cố' },
  { key: 'temporary', label: 'Tạm' },
  { key: 'borrowed', label: 'Nhờ, mượn, thuê' },
  { key: 'area_m2', label: 'Diện tích (m²)' },
];

export const EMIS_QUANTITY_COLUMNS: EmisColumn[] = [{ key: 'total', label: 'Số lượng' }];

// Một cột Tổng số: 2.1 Báo cáo EMIS cuối năm, 2.3 Đề án ngoại ngữ
export const EMIS_TOTAL_COLUMNS: EmisColumn[] = [{ key: 'total', label: 'Tổng số' }];

// 2.2.1, 2.2.2 của Báo cáo đội ngũ
export const EMIS_TOTAL_FEMALE_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
];

// 2.2.3 Báo cáo chuẩn nghề nghiệp nhân sự: số người theo mức của xếp loại chung và của từng tiêu chí
export const EMIS_STANDARD_COLUMNS: EmisColumn[] = [
  { key: 'total', label: 'Tổng số' },
  { key: 'excellent', label: 'Tốt' },
  { key: 'good', label: 'Khá' },
  { key: 'met', label: 'Đạt' },
  { key: 'not_met', label: 'Chưa đạt' },
];

export const EMIS_EQUIPMENT_COLUMNS: EmisColumn[] = [
  { key: 'classes', label: 'Số nhóm, lớp' },
  { key: 'equipped_classes', label: 'Nhóm, lớp đủ thiết bị tối thiểu' },
  { key: 'items', label: 'Số thiết bị trong danh mục' },
  { key: 'met_items', label: 'Thiết bị đủ định mức' },
  { key: 'rate_percent', label: 'Tỷ lệ đáp ứng (%)' },
];
