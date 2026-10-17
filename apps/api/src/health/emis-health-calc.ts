import type { SchoolOwnershipType } from '@school-management/shared';
import { EYE_CONDITIONS } from '@school-management/shared';
import { hasDisability, isEthnicMinority, type EmisRow } from '../facilities/emis-calc.js';
import type { GrowthAssessment } from './growth-calc.js';

// Số liệu "Báo cáo sức khỏe học sinh đầu năm" (khảo sát mục 5, dòng 1.3; DT-16 phần 16h). Hàm thuần, không đọc cơ sở dữ
// liệu; trả các dòng cùng dạng Biểu 1 EMIS đầu năm (tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số) để phần 16j
// dựng màn hình báo cáo, xuất tệp và gửi lên cấp trên theo mẫu chạy nội bộ của 16a. Quy tắc:
// - học sinh: trẻ trạng thái đang học;
// - được khám sức khỏe: có kết quả của đợt khám thuộc học kỳ I;
// - được cân đo và các kênh suy dinh dưỡng, thừa cân, béo phì: số đo gần nhất của các đợt cân đo thuộc học kỳ I, đánh giá
//   theo chuẩn WHO như mục 4.3;
// - bệnh về mắt: thông tin sức khỏe học kỳ I (mục 4.6);
// - cột công lập, tư thục, dân lập: cả số của trường vào cột theo loại hình trong hồ sơ trường, như Biểu 1.
// Tên chỉ tiêu, mã số do Claude đặt theo dữ liệu có trong hệ thống (Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11), cần đối chiếu biểu mẫu chính thức của Sở trước khi dùng thay biểu của Sở
export interface HealthReportChild {
  gender: 'male' | 'female';
  ethnicity: string | null;
  disability: string | null;
  examined: boolean;
  assessment: GrowthAssessment | null;
  eye_conditions: string[];
}

export interface HealthReportInput {
  ownership: SchoolOwnershipType | null;
  children: HealthReportChild[];
}

export function buildStartOfYearHealthReport(input: HealthReportInput): { rows: EmisRow[]; warnings: string[] } {
  const row = (code: string, label: string, members: HealthReportChild[]): EmisRow => {
    const total = members.length;
    return {
      code,
      label,
      unit: 'Trẻ',
      total,
      public: input.ownership === null ? null : input.ownership === 'public' ? total : 0,
      private: input.ownership === null ? null : input.ownership === 'private' ? total : 0,
      people_founded: input.ownership === null ? null : input.ownership === 'people_founded' ? total : 0,
      female: members.filter((child) => child.gender === 'female').length,
      ethnic_minority: members.filter((child) => isEthnicMinority(child.ethnicity)).length,
    };
  };
  const children = input.children;
  const measured = children.filter((child) => child.assessment !== null);
  const by = (test: (assessment: GrowthAssessment) => boolean) =>
    measured.filter((child) => child.assessment !== null && test(child.assessment));
  const rows: EmisRow[] = [
    row('1.3.01', 'Tổng số học sinh', children),
    row('1.3.02', 'Số học sinh được khám sức khỏe đầu năm', children.filter((child) => child.examined)),
    row('1.3.03', 'Số học sinh được cân đo, theo dõi biểu đồ tăng trưởng', measured),
    row(
      '1.3.04',
      'Suy dinh dưỡng thể nhẹ cân',
      by((assessment) => assessment.weight_status === 'underweight'),
    ),
    row(
      '1.3.05',
      'Suy dinh dưỡng thể thấp còi',
      by((assessment) => assessment.height_status === 'stunted'),
    ),
    row(
      '1.3.06',
      'Suy dinh dưỡng thể gầy còm',
      by((assessment) => assessment.weight_height_status === 'wasted'),
    ),
    row(
      '1.3.07',
      'Thừa cân',
      by((assessment) => assessment.weight_height_status === 'overweight'),
    ),
    row(
      '1.3.08',
      'Béo phì',
      by((assessment) => assessment.weight_height_status === 'obese'),
    ),
    row(
      '1.3.09',
      'Học sinh có bệnh về mắt',
      children.filter((child) => child.eye_conditions.length > 0),
    ),
    ...EYE_CONDITIONS.map((condition, index) =>
      row(
        `1.3.${String(10 + index).padStart(2, '0')}`,
        `Trong đó: ${condition.label.toLowerCase()}`,
        children.filter((child) => child.eye_conditions.includes(condition.value)),
      ),
    ),
    row(
      `1.3.${String(10 + EYE_CONDITIONS.length).padStart(2, '0')}`,
      'Học sinh khuyết tật',
      children.filter((child) => hasDisability(child.disability)),
    ),
  ];
  const warnings: string[] = [];
  if (input.ownership === null) {
    warnings.push('Chưa khai báo loại hình trường trong hồ sơ trường: cột công lập, tư thục, dân lập để trống');
  }
  if (children.length > 0 && measured.length === 0) {
    warnings.push('Chưa có đợt cân đo nào thuộc học kỳ I (mục 4.3.1)');
  }
  if (children.length > 0 && !children.some((child) => child.examined)) {
    warnings.push('Chưa có kết quả khám sức khỏe của đợt khám nào thuộc học kỳ I (mục 4.6.2)');
  }
  return { rows, warnings };
}
