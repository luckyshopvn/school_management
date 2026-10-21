import type { KpiSchoolLevelCode } from './kpi.js';

// Hồ sơ chuyên môn và Việc của tôi (DT-18 phần 18e, YCTD-142). Kho hồ sơ theo mô tả công khai của GIKIDI Nhà Trường (tài
// liệu 32 mục 9.4); tên thư mục mặc định, luồng duyệt mặc định của từng thư mục, các nguồn của Việc của tôi do Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11
export const PROFESSIONAL_RULE_CODE = 'YCTD-142';
export const PROFESSIONAL_MAXIMUM_FILE_BYTES = 20 * 1024 * 1024;

export type ProfessionalBranchCode = 'personal' | 'group' | 'school';
export type ProfessionalApprovalFlowCode = 'none' | 'leader' | 'two_level';
export type ProfessionalDocumentStatusCode = 'draft' | 'pending_leader' | 'pending_approval' | 'approved' | 'returned';

export const PROFESSIONAL_BRANCH_LABELS: Record<ProfessionalBranchCode, string> = {
  personal: 'Hồ sơ cá nhân',
  group: 'Hồ sơ tổ, nhóm',
  school: 'Hồ sơ trường',
};

export const PROFESSIONAL_APPROVAL_FLOW_LABELS: Record<ProfessionalApprovalFlowCode, string> = {
  none: 'Không duyệt (lưu kho)',
  leader: 'Tổ trưởng duyệt',
  two_level: 'Tổ trưởng duyệt, Ban Giám hiệu duyệt',
};

export const PROFESSIONAL_STATUS_LABELS: Record<ProfessionalDocumentStatusCode, string> = {
  draft: 'Chưa nộp',
  pending_leader: 'Chờ tổ trưởng duyệt',
  pending_approval: 'Chờ Ban Giám hiệu duyệt',
  approved: 'Đã duyệt',
  returned: 'Bị trả lại',
};

export const PROFESSIONAL_ACTION_LABELS: Record<string, string> = {
  create: 'Tạo hồ sơ',
  upload: 'Tải phiên bản',
  submit: 'Nộp',
  leader_approve: 'Tổ trưởng duyệt',
  approve: 'Duyệt',
  return: 'Trả lại',
  sign: 'Kí nội bộ',
  withdraw: 'Rút lại',
};

export interface ProfessionalFolderTemplate {
  branch: ProfessionalBranchCode;
  name: string;
  approval_flow: ProfessionalApprovalFlowCode;
  requires_signing?: boolean;
}

// Danh mục thư mục mặc định theo cấp học. Mầm non theo hồ sơ chuyên môn thường dùng ở trường mầm non (Điều lệ trường mầm
// non); các cấp phổ thông theo hồ sơ của giáo viên, tổ chuyên môn thường dùng (Điều lệ trường phổ thông). Trường sửa, thêm,
// ẩn thư mục sau khi nạp; nạp lại không tạo trùng tên trong cùng nhánh
const GENERAL_SCHOOL: ProfessionalFolderTemplate[] = [
  { branch: 'school', name: 'Kế hoạch giáo dục nhà trường', approval_flow: 'none' },
  { branch: 'school', name: 'Kế hoạch kiểm tra nội bộ', approval_flow: 'none' },
  { branch: 'school', name: 'Văn bản chỉ đạo chuyên môn', approval_flow: 'none' },
];
const GENERAL_LEVEL: ProfessionalFolderTemplate[] = [
  { branch: 'personal', name: 'Kế hoạch giáo dục của giáo viên', approval_flow: 'two_level', requires_signing: true },
  { branch: 'personal', name: 'Kế hoạch bài dạy (giáo án)', approval_flow: 'two_level' },
  { branch: 'personal', name: 'Sổ dự giờ', approval_flow: 'leader' },
  { branch: 'personal', name: 'Sổ chủ nhiệm', approval_flow: 'leader' },
  { branch: 'personal', name: 'Sổ theo dõi và đánh giá học sinh', approval_flow: 'leader' },
  { branch: 'personal', name: 'Hồ sơ bồi dưỡng thường xuyên', approval_flow: 'two_level' },
  { branch: 'group', name: 'Kế hoạch dạy học của tổ chuyên môn', approval_flow: 'two_level', requires_signing: true },
  { branch: 'group', name: 'Sổ sinh hoạt tổ chuyên môn', approval_flow: 'two_level' },
  { branch: 'group', name: 'Biên bản sinh hoạt chuyên môn theo nghiên cứu bài học', approval_flow: 'two_level' },
  ...GENERAL_SCHOOL,
];

export const PROFESSIONAL_DEFAULT_FOLDERS: Record<KpiSchoolLevelCode, ProfessionalFolderTemplate[]> = {
  MN: [
    {
      branch: 'personal',
      name: 'Kế hoạch giáo dục năm, tháng, tuần',
      approval_flow: 'two_level',
      requires_signing: true,
    },
    { branch: 'personal', name: 'Kế hoạch hoạt động ngày', approval_flow: 'leader' },
    { branch: 'personal', name: 'Sổ dự giờ', approval_flow: 'leader' },
    { branch: 'personal', name: 'Sổ theo dõi trẻ', approval_flow: 'none' },
    { branch: 'personal', name: 'Hồ sơ bồi dưỡng thường xuyên', approval_flow: 'two_level' },
    { branch: 'personal', name: 'Sáng kiến, đề tài', approval_flow: 'two_level', requires_signing: true },
    {
      branch: 'group',
      name: 'Kế hoạch hoạt động của tổ chuyên môn',
      approval_flow: 'two_level',
      requires_signing: true,
    },
    { branch: 'group', name: 'Sổ sinh hoạt tổ chuyên môn', approval_flow: 'two_level' },
    { branch: 'group', name: 'Biên bản dự giờ, thao giảng của tổ', approval_flow: 'two_level' },
    ...GENERAL_SCHOOL,
  ],
  TH: GENERAL_LEVEL,
  THCS: GENERAL_LEVEL,
  THPT: GENERAL_LEVEL,
};

// Việc của tôi: mỗi phân hệ cung cấp một nguồn việc qua giao diện chung ở máy chủ; phần sau thêm nguồn thì thêm mã ở đây
export type MyWorkSourceCode =
  | 'incoming'
  | 'outgoing'
  | 'directives'
  | 'schedules'
  | 'kpi'
  | 'professional'
  | 'education_plans'
  | 'teaching'
  | 'signing'
  | 'leave'
  | 'food_safety';

export const MY_WORK_SOURCE_LABELS: Record<MyWorkSourceCode, string> = {
  incoming: 'Văn bản đến',
  outgoing: 'Văn bản đi',
  directives: 'Giao việc',
  schedules: 'Lịch, phòng họp',
  kpi: 'Đánh giá KPI',
  professional: 'Hồ sơ chuyên môn',
  education_plans: 'Kế hoạch giáo dục',
  teaching: 'Kế hoạch bài dạy',
  signing: 'Kí hồ sơ',
  leave: 'Nghỉ phép',
  food_safety: 'Bán trú, an toàn thực phẩm',
};

// Hạn còn từ hôm nay đến số ngày này thì là sắp đến hạn
export const MY_WORK_DUE_SOON_DAYS = 2;

export interface MyWorkItem {
  source: MyWorkSourceCode;
  // Loại việc trong nguồn, ví dụ "Xử lý chính", "Chờ ký"
  kind: string;
  title: string;
  detail: string | null;
  // Đường dẫn của trang xử lý trên cổng quản trị
  link: string;
  // Hạn (YYYY-MM-DD hoặc thời điểm ISO), trống là không có hạn
  deadline: string | null;
  overdue: boolean;
  due_soon: boolean;
  received_at: string | null;
}

export interface MyWorkCount {
  total: number;
  overdue: number;
  by_source: Partial<Record<MyWorkSourceCode, number>>;
}
