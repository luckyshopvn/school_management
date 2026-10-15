// Khối và thứ tự ô của hồ sơ cán bộ, giáo viên theo Sở (DT-15 phần 15d, YCTD-112), theo thứ tự cột của tệp CSDL ngành 75
// cột (YCTD-100). Ô `core` ghi vào cột riêng của hồ sơ; ô còn lại ghi vào thông tin theo Sở (`moet_profile`) đúng khóa của
// tệp ngành. Nhãn viết đủ chữ thay cho tiêu đề viết tắt của tệp
export type StaffFieldKind = 'text' | 'date' | 'flag' | 'secret' | 'gender';

export interface StaffField {
  key: string;
  label: string;
  kind: StaffFieldKind;
  core?: boolean;
}

const text = (key: string, label: string): StaffField => ({ key, label, kind: 'text' });
const date = (key: string, label: string): StaffField => ({ key, label, kind: 'date' });
const flag = (key: string, label: string): StaffField => ({ key, label, kind: 'flag' });
const core = (key: string, label: string, kind: StaffFieldKind = 'text'): StaffField => ({
  key,
  label,
  kind,
  core: true,
});

// Nhóm địa chỉ của tệp ngành: tỉnh, quận/huyện cũ, xã/phường, tổ/thôn/xóm
const address = (prefix: string, label: string, withHamlet: boolean): StaffField[] => [
  text(`${prefix}_province`, `Tỉnh/Thành phố (${label})`),
  text(`${prefix}_district`, `Quận/Huyện cũ (${label})`),
  text(`${prefix}_ward`, `Xã/Phường (${label})`),
  ...(withHamlet ? [text(`${prefix}_hamlet`, `Tổ/Thôn/Xóm (${label})`)] : []),
];

export const STAFF_PROFILE_BLOCKS: Array<{ title: string; fields: StaffField[] }> = [
  {
    title: 'Thông tin chung',
    fields: [
      core('moet_staff_code', 'Mã định danh Bộ GD&ĐT'),
      core('full_name', 'Họ tên'),
      core('gender', 'Giới tính', 'gender'),
      core('dob', 'Ngày sinh', 'date'),
      text('staff_status', 'Trạng thái cán bộ'),
      date('status_date', 'Ngày nhập trạng thái'),
      core('id_number', 'Số định danh cá nhân', 'secret'),
      date('id_issued_date', 'Ngày cấp'),
      text('id_issued_place', 'Nơi cấp'),
      flag('vneid_level2', 'VNeID mức độ 2'),
      core('email', 'Email'),
      core('phone', 'Điện thoại'),
      text('ethnicity', 'Dân tộc'),
      text('religion', 'Tôn giáo'),
    ],
  },
  {
    title: 'Địa chỉ',
    fields: [
      ...address('permanent', 'thường trú', true),
      ...address('hometown', 'quê quán', true),
      ...address('birth_registration', 'nơi khai sinh', false),
      ...address('current', 'chỗ ở hiện nay', false),
      core('address', 'Chỗ ở hiện nay chi tiết'),
    ],
  },
  {
    title: 'Đoàn, Đảng',
    fields: [
      flag('youth_union_member', 'Là Đoàn viên'),
      flag('party_member', 'Là Đảng viên'),
      date('party_probation_date', 'Ngày vào Đảng dự bị'),
      date('party_official_date', 'Ngày vào Đảng chính thức'),
    ],
  },
  {
    title: 'Tuyển dụng, công tác',
    fields: [
      { key: 'social_insurance_number', label: 'Số sổ BHXH', kind: 'secret' },
      text('job_position', 'Vị trí việc làm'),
      text('position_group', 'Nhóm chức vụ'),
      text('contract_form', 'Hình thức hợp đồng'),
      date('recruitment_date', 'Ngày tuyển dụng'),
      text('recruiting_agency', 'Cơ quan tuyển dụng'),
      text('occupation_at_recruitment', 'Nghề nghiệp khi được tuyển dụng'),
      text('teaching_group', 'Dạy nhóm lớp'),
      text('civil_service_rank', 'Ngạch/Hạng'),
      text('teaching_periods_per_week', 'Số tiết thực dạy trên tuần'),
      text('concurrent_periods_per_week', 'Số tiết kiêm nhiệm trên tuần'),
      flag('life_skills_trained', 'Đã tập huấn dạy kỹ năng sống'),
      flag('teaches_inclusive', 'Dạy học sinh khuyết tật học hòa nhập'),
      flag('one_session_per_day', 'Dạy 1 buổi/ngày'),
      flag('two_sessions_per_day', 'Dạy 2 buổi/ngày'),
    ],
  },
  {
    title: 'Lương, phụ cấp theo ngạch bậc',
    fields: [
      text('attraction_allowance_percent', 'Mức phụ cấp thu hút nghề (%)'),
      text('seniority_allowance_percent', 'Mức phụ cấp thâm niên (%)'),
      text('incentive_allowance_percent', 'Mức phụ cấp ưu đãi nghề (%)'),
      text('leadership_allowance_percent', 'Mức phụ cấp chức vụ lãnh đạo (%)'),
      text('salary_step', 'Bậc lương'),
      text('over_frame_percent', 'Phần trăm vượt khung (%)'),
      text('salary_coefficient', 'Hệ số lương'),
      date('salary_effective_date', 'Ngày hưởng'),
    ],
  },
  {
    title: 'Trình độ',
    fields: [
      text('regular_training_result', 'Kết quả bồi dưỡng thường xuyên'),
      text('professional_qualification', 'Trình độ chuyên môn nghiệp vụ'),
      text('political_theory_level', 'Trình độ lý luận chính trị'),
      text('education_management_level', 'Trình độ quản lý giáo dục'),
      text('main_foreign_language', 'Ngoại ngữ chính'),
      text('language_certificate_group', 'Nhóm chứng chỉ ngoại ngữ'),
      text('language_certificate_type', 'Loại chứng chỉ ngoại ngữ'),
      text('language_score', 'Điểm ngoại ngữ'),
      text('language_framework_level', 'Khung năng lực ngoại ngữ'),
      text('language_training_level', 'Trình độ đào tạo ngoại ngữ'),
      text('it_level', 'Trình độ tin học'),
      text('main_major', 'Chuyên ngành chính'),
      text('main_major_level', 'Trình độ chuyên ngành chính'),
      text('other_major', 'Chuyên ngành khác'),
      text('other_major_level', 'Trình độ chuyên ngành khác'),
      text('training_institution', 'Cơ sở đào tạo'),
    ],
  },
  {
    title: 'Đánh giá, khen thưởng',
    fields: [
      text('civil_servant_evaluation', 'Đánh giá viên chức/công chức'),
      text('excellent_teacher', 'Giáo viên dạy giỏi'),
      text('honorary_titles', 'Danh hiệu phong tặng'),
    ],
  },
];
