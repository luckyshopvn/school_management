import type { KpiSchoolLevelCode } from './kpi.js';

// Kế hoạch giáo dục (DT-18 phần 22i, YCTD-147) theo mô tả công khai của trang kế hoạch đã khảo sát (tài liệu 32 mục 9.4):
// thư viện mẫu theo cấp học, kế hoạch theo năm học có phiên bản và sao chép từ năm trước, duyệt nhiều cấp (tổ trưởng, Phó
// Hiệu trưởng, Hiệu trưởng), kí nội bộ, bảng tiến độ duyệt, xuất Word, PDF. Mẫu là cấu hình lưu ở cơ sở dữ liệu; danh mục
// dưới đây chỉ là bản nạp mặc định (Mầm non; cấp phổ thông là khung rỗng, YCTD-345). Tên mẫu, mục, cột và luồng duyệt mặc định do
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, không chép nguyên văn văn bản hướng dẫn nào
export const EDUCATION_PLAN_RULE_CODE = 'YCTD-147';

// Kế hoạch của trường, của tổ chuyên môn (hoặc nhóm công tác), của nhóm lớp, của cá nhân giáo viên
export type EducationPlanScopeCode = 'school' | 'group' | 'class' | 'personal';
export type EducationPlanPeriodCode = 'year' | 'semester' | 'month' | 'week' | 'none';
// Bước duyệt theo thứ tự cố định; mẫu chọn các bước cần dùng
export type EducationPlanStepCode = 'leader' | 'vice_principal' | 'principal';
// Bốn trạng thái: đang soạn, chờ duyệt (ở một bước), đã duyệt, bị trả lại
export type EducationPlanStatusCode = 'draft' | 'pending' | 'approved' | 'returned';

export const EDUCATION_PLAN_SCOPE_LABELS: Record<EducationPlanScopeCode, string> = {
  school: 'Kế hoạch của trường',
  group: 'Kế hoạch của tổ chuyên môn',
  class: 'Kế hoạch của nhóm, lớp',
  personal: 'Kế hoạch cá nhân',
};

export const EDUCATION_PLAN_PERIOD_LABELS: Record<EducationPlanPeriodCode, string> = {
  year: 'Năm học',
  semester: 'Học kì',
  month: 'Tháng',
  week: 'Tuần',
  none: 'Không theo kì',
};

export const EDUCATION_PLAN_STEPS: EducationPlanStepCode[] = ['leader', 'vice_principal', 'principal'];

export const EDUCATION_PLAN_STEP_LABELS: Record<EducationPlanStepCode, string> = {
  leader: 'Tổ trưởng',
  vice_principal: 'Phó Hiệu trưởng',
  principal: 'Hiệu trưởng',
};

export const EDUCATION_PLAN_STATUS_LABELS: Record<EducationPlanStatusCode, string> = {
  draft: 'Đang soạn',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  returned: 'Bị trả lại',
};

export const EDUCATION_PLAN_ACTION_LABELS: Record<string, string> = {
  create: 'Tạo kế hoạch',
  copy: 'Sao chép từ năm trước',
  submit: 'Trình duyệt',
  withdraw: 'Rút lại',
  approve: 'Duyệt',
  return: 'Trả lại',
  sign: 'Kí nội bộ',
  archive: 'Lưu vào kho hồ sơ chuyên môn',
  work_plan: 'Tạo kế hoạch công việc',
};

// Giới hạn nội dung của một kế hoạch
export const EDUCATION_PLAN_LIMITS = {
  sections: 30,
  columns: 10,
  rows: 300,
  textLength: 20_000,
  cellLength: 2_000,
};

export interface EducationPlanColumn {
  key: string;
  label: string;
  // Cột ngày: dòng có ngày thành đầu việc có hạn khi tạo kế hoạch công việc
  type?: 'text' | 'date';
}

export interface EducationPlanSection {
  key: string;
  title: string;
  kind: 'text' | 'table';
  hint?: string;
  columns?: EducationPlanColumn[];
}

// Nội dung theo mã mục: mục văn bản là chuỗi, mục bảng là danh sách dòng (mỗi dòng một mảng ô theo thứ tự cột)
export type EducationPlanContent = Record<string, string | string[][]>;

export interface EducationPlanTemplateSeed {
  code: string;
  name: string;
  scope: EducationPlanScopeCode;
  period: EducationPlanPeriodCode;
  description: string;
  approval_steps: EducationPlanStepCode[];
  requires_signing: boolean;
  // Tên thư mục của kho hồ sơ chuyên môn (18e) nhận bản đã duyệt, cùng cấp học; không có thư mục thì không lưu
  archive_folder_name: string | null;
  sections: EducationPlanSection[];
}

const text = (key: string, title: string, hint?: string): EducationPlanSection => ({
  key,
  title,
  kind: 'text',
  ...(hint ? { hint } : {}),
});
const table = (key: string, title: string, columns: EducationPlanColumn[], hint?: string): EducationPlanSection => ({
  key,
  title,
  kind: 'table',
  columns,
  ...(hint ? { hint } : {}),
});
const column = (key: string, label: string, type?: 'date'): EducationPlanColumn => ({
  key,
  label,
  ...(type ? { type } : {}),
});

// Mẫu mặc định của Mầm non: kế hoạch giáo dục nhà trường, kế hoạch năm, tháng (chủ đề), tuần của nhóm lớp, kế hoạch của tổ
// chuyên môn (hoạt động tổ; dự giờ, thao giảng) và kế hoạch bồi dưỡng thường xuyên của giáo viên. Trường sửa, thêm mục,
// đổi luồng duyệt sau khi nạp; nạp lại không tạo trùng mã mẫu
const MN_TEMPLATES: EducationPlanTemplateSeed[] = [
  {
    code: 'MN-TRUONG-NAM',
    name: 'Kế hoạch giáo dục nhà trường',
    scope: 'school',
    period: 'year',
    description: 'Kế hoạch giáo dục năm học của nhà trường, Ban Giám hiệu lập, Hiệu trưởng phê duyệt',
    approval_steps: ['vice_principal', 'principal'],
    requires_signing: true,
    archive_folder_name: 'Kế hoạch giáo dục nhà trường',
    sections: [
      text('dac_diem', 'I. Đặc điểm tình hình', 'Thuận lợi, khó khăn; số nhóm, lớp, trẻ; đội ngũ; cơ sở vật chất'),
      text('muc_tieu', 'II. Mục tiêu năm học'),
      text(
        'nhiem_vu',
        'III. Nhiệm vụ và giải pháp',
        'Chăm sóc, nuôi dưỡng; giáo dục; phát triển đội ngũ; cơ sở vật chất',
      ),
      table('ke_hoach_thang', 'IV. Kế hoạch thực hiện theo tháng', [
        column('thang', 'Tháng'),
        column('noi_dung', 'Nội dung trọng tâm'),
        column('phu_trach', 'Người phụ trách'),
        column('han', 'Hạn hoàn thành', 'date'),
      ]),
      text('to_chuc', 'V. Tổ chức thực hiện'),
    ],
  },
  {
    code: 'MN-LOP-NAM',
    name: 'Kế hoạch giáo dục năm học của nhóm, lớp',
    scope: 'class',
    period: 'year',
    description: 'Giáo viên lập cho nhóm, lớp; tổ trưởng và Phó Hiệu trưởng duyệt',
    approval_steps: ['leader', 'vice_principal'],
    requires_signing: true,
    archive_folder_name: 'Kế hoạch giáo dục năm, tháng, tuần',
    sections: [
      text('dac_diem', 'I. Đặc điểm nhóm, lớp', 'Số trẻ, độ tuổi, thuận lợi, khó khăn'),
      table('muc_tieu', 'II. Mục tiêu và nội dung giáo dục theo lĩnh vực phát triển', [
        column('linh_vuc', 'Lĩnh vực'),
        column('muc_tieu', 'Mục tiêu'),
        column('noi_dung', 'Nội dung'),
      ]),
      table('chu_de', 'III. Dự kiến chủ đề và thời gian', [
        column('chu_de', 'Chủ đề'),
        column('thoi_gian', 'Thời gian'),
        column('bat_dau', 'Ngày bắt đầu', 'date'),
      ]),
      text('danh_gia', 'IV. Đánh giá sự phát triển của trẻ'),
    ],
  },
  {
    code: 'MN-LOP-THANG',
    name: 'Kế hoạch giáo dục tháng (chủ đề) của nhóm, lớp',
    scope: 'class',
    period: 'month',
    description: 'Giáo viên lập theo tháng hoặc chủ đề; tổ trưởng duyệt',
    approval_steps: ['leader'],
    requires_signing: false,
    archive_folder_name: 'Kế hoạch giáo dục năm, tháng, tuần',
    sections: [
      text('chu_de', 'I. Chủ đề, thời gian thực hiện'),
      table('muc_tieu', 'II. Mục tiêu, nội dung, hoạt động', [
        column('linh_vuc', 'Lĩnh vực'),
        column('muc_tieu', 'Mục tiêu'),
        column('noi_dung', 'Nội dung'),
        column('hoat_dong', 'Hoạt động'),
      ]),
      text('chuan_bi', 'III. Chuẩn bị, môi trường giáo dục'),
      text('danh_gia', 'IV. Đánh giá cuối tháng'),
    ],
  },
  {
    code: 'MN-LOP-TUAN',
    name: 'Kế hoạch giáo dục tuần của nhóm, lớp',
    scope: 'class',
    period: 'week',
    description: 'Giáo viên lập theo tuần; tổ trưởng duyệt',
    approval_steps: ['leader'],
    requires_signing: false,
    archive_folder_name: 'Kế hoạch giáo dục năm, tháng, tuần',
    sections: [
      table('lich_tuan', 'I. Hoạt động trong tuần', [
        column('hoat_dong', 'Hoạt động'),
        column('thu_2', 'Thứ Hai'),
        column('thu_3', 'Thứ Ba'),
        column('thu_4', 'Thứ Tư'),
        column('thu_5', 'Thứ Năm'),
        column('thu_6', 'Thứ Sáu'),
      ]),
      text('danh_gia', 'II. Đánh giá cuối tuần'),
    ],
  },
  {
    code: 'MN-TO-NAM',
    name: 'Kế hoạch hoạt động của tổ chuyên môn',
    scope: 'group',
    period: 'year',
    description: 'Tổ trưởng lập; Phó Hiệu trưởng và Hiệu trưởng duyệt',
    approval_steps: ['vice_principal', 'principal'],
    requires_signing: true,
    archive_folder_name: 'Kế hoạch hoạt động của tổ chuyên môn',
    sections: [
      text('dac_diem', 'I. Đặc điểm của tổ'),
      text('muc_tieu', 'II. Mục tiêu, chỉ tiêu'),
      table('hoat_dong', 'III. Kế hoạch hoạt động theo tháng', [
        column('thang', 'Tháng'),
        column('noi_dung', 'Nội dung'),
        column('nguoi_thuc_hien', 'Người thực hiện'),
        column('han', 'Hạn hoàn thành', 'date'),
      ]),
      text('giai_phap', 'IV. Giải pháp thực hiện'),
    ],
  },
  {
    code: 'MN-TO-DU-GIO',
    name: 'Kế hoạch dự giờ, thao giảng của tổ chuyên môn',
    scope: 'group',
    period: 'semester',
    description: 'Tổ trưởng lập lịch dự giờ, thao giảng; Phó Hiệu trưởng duyệt',
    approval_steps: ['vice_principal'],
    requires_signing: false,
    archive_folder_name: 'Biên bản dự giờ, thao giảng của tổ',
    sections: [
      table('lich', 'I. Lịch dự giờ, thao giảng', [
        column('ngay', 'Ngày', 'date'),
        column('nguoi_day', 'Giáo viên dạy'),
        column('nhom_lop', 'Nhóm, lớp'),
        column('hoat_dong', 'Hoạt động'),
        column('nguoi_du', 'Người dự'),
      ]),
      text('ghi_chu', 'II. Ghi chú'),
    ],
  },
  {
    code: 'MN-CA-NHAN-BDTX',
    name: 'Kế hoạch bồi dưỡng thường xuyên của giáo viên',
    scope: 'personal',
    period: 'year',
    description: 'Giáo viên lập; tổ trưởng và Phó Hiệu trưởng duyệt',
    approval_steps: ['leader', 'vice_principal'],
    requires_signing: false,
    archive_folder_name: 'Hồ sơ bồi dưỡng thường xuyên',
    sections: [
      text('muc_tieu', 'I. Mục tiêu bồi dưỡng'),
      table('noi_dung', 'II. Nội dung, thời gian, hình thức', [
        column('noi_dung', 'Nội dung bồi dưỡng'),
        column('thoi_gian', 'Thời gian'),
        column('hinh_thuc', 'Hình thức'),
        column('han', 'Hạn hoàn thành', 'date'),
      ]),
      text('tu_danh_gia', 'III. Tự đánh giá'),
    ],
  },
];

// Khung rỗng của Tiểu học, THCS, THPT (YCTD-345). Tài liệu dự án không có nội dung mẫu kế hoạch của cấp phổ thông; tài
// liệu 32 mục 22i chỉ nêu các loại mẫu cần có (năm học, tổ chuyên môn gồm dự giờ, thao giảng, giáo viên, chủ nhiệm, bài
// dạy). Mỗi khung là một loại đó với một mục văn bản trống để trường tự thêm mục, cột theo hướng dẫn hiện hành; không có
// mục, chỉ tiêu nào tự soạn. Thư mục lưu kho lấy theo tên thư mục mặc định của cấp phổ thông ở kho hồ sơ chuyên môn (18e).
// Loại kế hoạch, kì, luồng duyệt của từng khung do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo mẫu Mầm non
// cùng loại
export const EDUCATION_PLAN_FRAME_HINT =
  'Khung rỗng: tài liệu dự án chưa có mẫu chuẩn cho cấp học này. Trường sửa mẫu, thêm mục, cột theo hướng dẫn hiện hành';

const frameSection = (): EducationPlanSection[] => [text('noi_dung', 'Nội dung kế hoạch', EDUCATION_PLAN_FRAME_HINT)];

function generalFrames(level: Exclude<KpiSchoolLevelCode, 'MN'>): EducationPlanTemplateSeed[] {
  const frame = (
    suffix: string,
    name: string,
    scope: EducationPlanScopeCode,
    period: EducationPlanPeriodCode,
    approvalSteps: EducationPlanStepCode[],
    archiveFolderName: string | null,
  ): EducationPlanTemplateSeed => ({
    code: `${level}-KHUNG-${suffix}`,
    name,
    scope,
    period,
    description: EDUCATION_PLAN_FRAME_HINT,
    approval_steps: approvalSteps,
    requires_signing: false,
    archive_folder_name: archiveFolderName,
    sections: frameSection(),
  });
  return [
    frame(
      'TRUONG-NAM',
      'Kế hoạch giáo dục nhà trường',
      'school',
      'year',
      ['vice_principal', 'principal'],
      'Kế hoạch giáo dục nhà trường',
    ),
    frame(
      'TO',
      'Kế hoạch của tổ chuyên môn',
      'group',
      'year',
      ['vice_principal', 'principal'],
      'Kế hoạch dạy học của tổ chuyên môn',
    ),
    frame('DU-GIO', 'Kế hoạch dự giờ, thao giảng của tổ chuyên môn', 'group', 'semester', ['vice_principal'], null),
    frame(
      'GIAO-VIEN',
      'Kế hoạch giáo dục của giáo viên',
      'personal',
      'year',
      ['leader', 'vice_principal'],
      'Kế hoạch giáo dục của giáo viên',
    ),
    frame('CHU-NHIEM', 'Kế hoạch chủ nhiệm', 'class', 'year', ['leader', 'vice_principal'], 'Sổ chủ nhiệm'),
    frame('BAI-DAY', 'Kế hoạch bài dạy', 'personal', 'none', ['leader'], 'Kế hoạch bài dạy (giáo án)'),
  ];
}

export const EDUCATION_PLAN_DEFAULT_TEMPLATES: Record<KpiSchoolLevelCode, EducationPlanTemplateSeed[]> = {
  MN: MN_TEMPLATES,
  TH: generalFrames('TH'),
  THCS: generalFrames('THCS'),
  THPT: generalFrames('THPT'),
};

// Bộ nạp mặc định của từng cấp là mẫu dự án soạn (Mầm non, YCTD-147) hay khung rỗng (cấp phổ thông, YCTD-345)
export const EDUCATION_PLAN_DEFAULT_KIND: Record<KpiSchoolLevelCode, 'project' | 'frame'> = {
  MN: 'project',
  TH: 'frame',
  THCS: 'frame',
  THPT: 'frame',
};

// ---- So sánh khác biệt ----

export type EducationPlanDiffOperation = 'same' | 'added' | 'removed';

export interface EducationPlanDiffLine {
  op: EducationPlanDiffOperation;
  text: string;
}

export interface EducationPlanSectionDiff {
  key: string;
  title: string;
  kind: 'text' | 'table';
  state: 'same' | 'changed' | 'added' | 'removed';
  lines: EducationPlanDiffLine[];
}

// Mục văn bản so theo dòng; mục bảng so theo dòng bảng, các ô nối bằng " | "
export function educationPlanSectionLines(section: EducationPlanSection, content: EducationPlanContent): string[] {
  const value = content[section.key];
  if (section.kind === 'table') {
    return Array.isArray(value)
      ? value.map((row) => row.map((cell) => cell.trim()).join(' | ')).filter((line) => line.replace(/[\s|]/g, ''))
      : [];
  }
  return typeof value === 'string' && value.trim() !== '' ? value.replace(/\r\n/g, '\n').split('\n') : [];
}

// Dãy con chung dài nhất theo dòng; đủ cho kế hoạch vài trăm dòng
export function diffLines(before: string[], after: string[]): EducationPlanDiffLine[] {
  const rows = before.length;
  const columns = after.length;
  const lengths = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let left = rows - 1; left >= 0; left -= 1) {
    for (let right = columns - 1; right >= 0; right -= 1) {
      lengths[left]![right] =
        before[left] === after[right]
          ? lengths[left + 1]![right + 1]! + 1
          : Math.max(lengths[left + 1]![right]!, lengths[left]![right + 1]!);
    }
  }
  const result: EducationPlanDiffLine[] = [];
  let left = 0;
  let right = 0;
  while (left < rows && right < columns) {
    if (before[left] === after[right]) {
      result.push({ op: 'same', text: before[left]! });
      left += 1;
      right += 1;
    } else if (lengths[left + 1]![right]! >= lengths[left]![right + 1]!) {
      result.push({ op: 'removed', text: before[left]! });
      left += 1;
    } else {
      result.push({ op: 'added', text: after[right]! });
      right += 1;
    }
  }
  for (; left < rows; left += 1) {
    result.push({ op: 'removed', text: before[left]! });
  }
  for (; right < columns; right += 1) {
    result.push({ op: 'added', text: after[right]! });
  }
  return result;
}

// So sánh hai bản kế hoạch (bản năm trước hoặc phiên bản cũ với bản hiện tại) theo từng mục; mục chỉ có ở một bên là thêm
// hoặc bỏ. Thứ tự theo bản sau, mục bị bỏ xếp cuối
export function diffEducationPlans(
  before: { sections: EducationPlanSection[]; content: EducationPlanContent },
  after: { sections: EducationPlanSection[]; content: EducationPlanContent },
): EducationPlanSectionDiff[] {
  const previous = new Map(before.sections.map((section) => [section.key, section]));
  const result: EducationPlanSectionDiff[] = [];
  for (const section of after.sections) {
    const old = previous.get(section.key);
    const afterLines = educationPlanSectionLines(section, after.content);
    if (!old) {
      result.push({
        key: section.key,
        title: section.title,
        kind: section.kind,
        state: 'added',
        lines: afterLines.map((line) => ({ op: 'added', text: line })),
      });
      continue;
    }
    previous.delete(section.key);
    const lines = diffLines(educationPlanSectionLines(old, before.content), afterLines);
    result.push({
      key: section.key,
      title: section.title,
      kind: section.kind,
      state: lines.every((line) => line.op === 'same') && old.title === section.title ? 'same' : 'changed',
      lines,
    });
  }
  for (const section of previous.values()) {
    result.push({
      key: section.key,
      title: section.title,
      kind: section.kind,
      state: 'removed',
      lines: educationPlanSectionLines(section, before.content).map((line) => ({ op: 'removed', text: line })),
    });
  }
  return result;
}
