// Danh mục của Bộ GD&ĐT cho các ô của hồ sơ cán bộ, giáo viên (DT-16 phần 16f): dân tộc, tôn giáo, trạng thái cán bộ, vị
// trí việc làm, nhóm chức vụ, hình thức hợp đồng, trình độ chuyên môn. Vị trí việc làm, hình thức hợp đồng, trình độ theo các
// nhóm của mục 5.2 "Thống kê nhân sự" của hệ thống Sở; trạng thái cán bộ theo danh mục của tệp CSDL ngành. Biểu mẫu hồ sơ
// hiện các ô này dạng danh sách chọn; giá trị chữ tự do đã có (nhập từ tệp cũ) vẫn đọc được, hiện kèm chữ "giá trị cũ"
export type StaffCatalogKey =
  | 'staff_status'
  | 'ethnicity'
  | 'religion'
  | 'job_position'
  | 'position_group'
  | 'contract_form'
  | 'professional_qualification';

export const STAFF_CATALOGS: Record<StaffCatalogKey, { title: string; items: readonly string[] }> = {
  staff_status: {
    title: 'Trạng thái cán bộ',
    items: [
      'Đang làm việc',
      'Chuyển đến',
      'Chờ nghỉ hưu',
      'Đã biệt phái',
      'Đã chuyển đi',
      'Đã điều động',
      'Đã nghỉ hưu',
    ],
  },
  ethnicity: {
    title: 'Dân tộc',
    items: [
      'Kinh',
      'Tày',
      'Thái',
      'Mường',
      'Khmer',
      'Hoa',
      'Nùng',
      "H'Mông",
      'Dao',
      'Gia Rai',
      'Ê Đê',
      'Ba Na',
      'Sán Chay',
      'Chăm',
      'Cơ Ho',
      'Xơ Đăng',
      'Sán Dìu',
      'Hrê',
      'Ra Glai',
      'Mnông',
      'Thổ',
      'Xtiêng',
      'Khơ Mú',
      'Bru - Vân Kiều',
      'Cơ Tu',
      'Giáy',
      'Tà Ôi',
      'Mạ',
      'Giẻ - Triêng',
      'Co',
      'Chơ Ro',
      'Xinh Mun',
      'Hà Nhì',
      'Chu Ru',
      'Lào',
      'Kháng',
      'La Chí',
      'Phù Lá',
      'La Hủ',
      'La Ha',
      'Pà Thẻn',
      'Chứt',
      'Lự',
      'Lô Lô',
      'Mảng',
      'Cờ Lao',
      'Bố Y',
      'Cống',
      'Ngái',
      'Si La',
      'Pu Péo',
      'Rơ Măm',
      'Brâu',
      'Ơ Đu',
      'Người nước ngoài',
    ],
  },
  religion: {
    title: 'Tôn giáo',
    items: [
      'Không',
      'Phật giáo',
      'Công giáo',
      'Tin lành',
      'Cao Đài',
      'Phật giáo Hòa Hảo',
      'Hồi giáo',
      'Bà La Môn',
      'Tịnh độ cư sĩ Phật hội Việt Nam',
      'Bửu Sơn Kỳ Hương',
      'Tứ Ân Hiếu Nghĩa',
      'Khác',
    ],
  },
  job_position: {
    title: 'Vị trí việc làm',
    items: [
      'Cán bộ quản lý',
      'Giáo viên nhà trẻ',
      'Giáo viên mẫu giáo',
      'Văn thư',
      'Kế toán',
      'Y tế',
      'Thủ quỹ',
      'Bảo vệ',
      'Nấu ăn',
      'Thư viện',
      'Thiết bị',
      'Cấp dưỡng',
      'Bảo mẫu',
      'Nhân viên khác',
    ],
  },
  position_group: {
    title: 'Nhóm chức vụ',
    items: ['Cán bộ quản lý', 'Giáo viên', 'Nhân viên'],
  },
  contract_form: {
    title: 'Hình thức hợp đồng',
    items: [
      'Viên chức không xác định thời hạn',
      'Viên chức có thời hạn',
      'Hợp đồng lao động trên 1 năm',
      'Hợp đồng lao động dưới 1 năm',
      'Hợp đồng theo Nghị định 68',
      'Hợp đồng theo Nghị định 06',
      'Hợp đồng theo Nghị định 111',
      'Thỉnh giảng',
      'Thuê khoán',
    ],
  },
  professional_qualification: {
    title: 'Trình độ chuyên môn',
    items: [
      'Tiến sĩ',
      'Thạc sĩ',
      'Đại học',
      'Cao đẳng',
      'Trung cấp',
      'Trung cấp sư phạm',
      'Có chứng chỉ bồi dưỡng nghiệp vụ sư phạm',
      'Sơ cấp',
      'Chưa qua đào tạo',
    ],
  },
};

// So khớp không phân biệt hoa thường, dấu, khoảng trắng thừa ("giao vien mau giao" = "Giáo viên mẫu giáo")
export function foldCatalogText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Mục danh mục khớp với chữ đã nhập; không khớp thì null (giá trị cũ ngoài danh mục)
export function matchStaffCatalog(key: StaffCatalogKey, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const folded = foldCatalogText(value);
  return STAFF_CATALOGS[key].items.find((item) => foldCatalogText(item) === folded) ?? null;
}
