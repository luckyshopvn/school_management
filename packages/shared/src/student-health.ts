// Sức khỏe học sinh theo học kỳ và thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h; khảo sát mục 4.6, 5.3)
export const STUDENT_HEALTH_TERMS = [
  { value: 'first_term', label: 'Học kỳ I' },
  { value: 'second_term', label: 'Học kỳ II' },
] as const;
export type StudentHealthTermValue = (typeof STUDENT_HEALTH_TERMS)[number]['value'];

// Kết quả giáo dục thể chất (Claude tự chọn hai mức Đạt, Chưa đạt theo ủy quyền của Eric ngày 2026-10-11)
export const PHYSICAL_EDUCATION_RESULTS = [
  { value: 'passed', label: 'Đạt' },
  { value: 'not_passed', label: 'Chưa đạt' },
] as const;
export type PhysicalEducationValue = (typeof PHYSICAL_EDUCATION_RESULTS)[number]['value'];

// Bệnh về mắt như mục 5.3 của Sở
export const EYE_CONDITIONS = [
  { value: 'myopia', label: 'Cận thị' },
  { value: 'hyperopia', label: 'Viễn thị' },
  { value: 'astigmatism', label: 'Loạn thị' },
  { value: 'cataract', label: 'Đục thủy tinh thể' },
  { value: 'macular_degeneration', label: 'Thoái hóa điểm vàng' },
  { value: 'dry_eye', label: 'Khô mắt' },
  { value: 'strabismus', label: 'Lác' },
] as const;
export type EyeConditionValue = (typeof EYE_CONDITIONS)[number]['value'];
