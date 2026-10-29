import { levelOf } from './level-features.js';
import type { SchoolLevelCode } from './school-levels.js';

// Hộp công cụ giảng dạy của ứng dụng giáo viên (DT-29, YCTD-325; tài liệu 32 mục 21): danh mục khai báo một nơi các công cụ, mini
// app hỗ trợ giảng dạy, cấp học áp dụng, có chạy được khi mất mạng không, gắn với tính năng nào của gói. Màn Hộp công cụ lọc theo
// cấp của lớp đang chọn, bỏ công cụ trường đã tắt (cấu hình `teaching_tools_disabled`) và công cụ thuộc tính năng gói chưa bật.
// Mỗi phần của DT-29 thêm công cụ của mình vào cuối danh sách. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type TeachingToolSection = 'classroom' | 'games' | 'subject' | 'online';

export const TEACHING_TOOL_SECTIONS: ReadonlyArray<{ key: TeachingToolSection; label: string; hint: string }> = [
  { key: 'classroom', label: 'Trên lớp', hint: 'Dùng ngay trên lớp, chạy cả khi mất mạng' },
  { key: 'games', label: 'Trò chơi và câu hỏi', hint: 'Câu hỏi lấy từ ngân hàng câu hỏi đã duyệt của khối' },
  { key: 'subject', label: 'Mini app theo môn', hint: 'Riêng cho cấp học của lớp' },
  { key: 'online', label: 'Giao bài và học trực tuyến', hint: 'Mở các màn đã có, cần mạng' },
];

export interface TeachingTool {
  key: string;
  label: string;
  description: string;
  section: TeachingToolSection;
  levels: readonly SchoolLevelCode[];
  // Chạy hoàn toàn trên máy giáo viên khi mất mạng (sau lần mở đầu có mạng)
  offline: boolean;
  // Tính năng của gói dịch vụ (plan-modules.ts); gói không có thì công cụ ẩn
  planModule?: string;
}

const ALL: readonly SchoolLevelCode[] = ['MN', 'TH', 'THCS', 'THPT'];
const GENERAL: readonly SchoolLevelCode[] = ['TH', 'THCS', 'THPT'];
const PRIMARY_AND_BELOW: readonly SchoolLevelCode[] = ['MN', 'TH'];

export const TEACHING_TOOLS: readonly TeachingTool[] = [
  // Công cụ lớp học đã có (DT-23 phần 23b, 23c)
  {
    key: 'call',
    label: 'Gọi tên ngẫu nhiên',
    description: 'Bốc tên từ danh sách lớp, không lặp trong một lượt',
    section: 'classroom',
    levels: ALL,
    offline: true,
  },
  {
    key: 'group',
    label: 'Chia nhóm',
    description: 'Ngẫu nhiên hoặc cân bằng, lưu thành bộ nhóm của lớp',
    section: 'classroom',
    levels: ALL,
    offline: true,
  },
  {
    key: 'timer',
    label: 'Đếm ngược, bấm giờ',
    description: 'Nhiều đồng hồ cùng chạy, có tiếng báo hết giờ',
    section: 'classroom',
    levels: ALL,
    offline: true,
  },
  {
    key: 'scoreboard',
    label: 'Bảng điểm nhanh',
    description: 'Cộng, trừ điểm theo nhóm hoặc học sinh, ghi nề nếp khi chọn',
    section: 'classroom',
    // Mọi cấp: nề nếp, thi đua có tiêu chí Mầm non (DT-21), không bỏ chức năng đã có
    levels: ALL,
    offline: true,
  },
  {
    key: 'games',
    label: 'Trò chơi kiến thức',
    description: 'Hỏi đáp theo vòng, vòng quay, ô chữ, thẻ đáp án giấy',
    section: 'games',
    levels: GENERAL,
    offline: false,
  },
  // Công cụ chung và Mầm non (DT-29 phần 29b, YCTD-326): chạy hoàn toàn trên máy giáo viên
  {
    key: 'whiteboard',
    label: 'Bảng trắng',
    description: 'Viết, vẽ bằng ngón tay hoặc bút cảm ứng',
    section: 'classroom',
    levels: ALL,
    offline: true,
  },
  {
    key: 'dice',
    label: 'Xúc xắc, bốc số',
    description: 'Tung xúc xắc, bốc số trong khoảng tự đặt',
    section: 'classroom',
    levels: ALL,
    offline: true,
  },
  {
    key: 'visual-timer',
    label: 'Đồng hồ hình ảnh',
    description: 'Đĩa màu vơi dần, trẻ nhìn là hiểu còn bao lâu',
    section: 'classroom',
    levels: PRIMARY_AND_BELOW,
    offline: true,
  },
  {
    key: 'noise-light',
    label: 'Đèn giữ trật tự',
    description: 'Đo độ ồn bằng micro trên máy, không ghi âm',
    section: 'classroom',
    levels: PRIMARY_AND_BELOW,
    offline: true,
  },
  {
    key: 'star-board',
    label: 'Bảng thưởng sao',
    description: 'Gắn sao cho nhóm, không xếp hạng',
    section: 'classroom',
    levels: PRIMARY_AND_BELOW,
    offline: true,
  },
  {
    key: 'shapes-colors',
    label: 'Hình và màu',
    description: 'Nhận biết hình, gọi tên màu, chữ to',
    section: 'subject',
    levels: ['MN'],
    offline: true,
  },
  {
    key: 'counting',
    label: 'Đếm và số',
    description: 'Chạm để đếm đồ vật từ 1 đến 10',
    section: 'subject',
    levels: ['MN'],
    offline: true,
  },
  {
    key: 'alphabet',
    label: 'Làm quen chữ cái',
    description: '29 chữ cái tiếng Việt cỡ lớn',
    section: 'subject',
    levels: ['MN'],
    offline: true,
  },
  // Tiểu học (DT-29 phần 29c, YCTD-327)
  {
    key: 'multiplication',
    label: 'Bảng cửu chương',
    description: 'Xem bảng nhân 2 đến 9, hỏi nhanh',
    section: 'subject',
    levels: ['TH'],
    offline: true,
  },
  {
    key: 'ruled-board',
    label: 'Khung ô li',
    description: 'Ô li để viết mẫu bằng bút cảm ứng',
    section: 'subject',
    levels: ['TH'],
    offline: true,
  },
  {
    key: 'clock-reading',
    label: 'Học xem đồng hồ',
    description: 'Đồng hồ kim kéo được, đọc giờ',
    section: 'subject',
    levels: ['TH'],
    offline: true,
  },
  {
    key: 'fractions',
    label: 'Phân số trực quan',
    description: 'Chia hình thành phần bằng nhau, tô theo tử số',
    section: 'subject',
    levels: ['TH'],
    offline: true,
  },
  // Lối vào các màn đã có của ứng dụng giáo viên
  {
    key: 'lesson-plans',
    label: 'Giáo án, kế hoạch bài dạy',
    description: 'Soạn bài, gửi tổ trưởng duyệt, xem góp ý',
    section: 'online',
    levels: ALL,
    offline: false,
  },
  {
    key: 'class-log',
    label: 'Sổ đầu bài, bài về nhà',
    description: 'Ghi tiết dạy, giao bài về nhà từ tiết',
    section: 'online',
    levels: GENERAL,
    offline: false,
  },
  {
    key: 'online-classes',
    label: 'Lớp học trực tuyến',
    description: 'Bài tập trực tuyến, giờ học trực tuyến, hỏi đáp của lớp',
    section: 'online',
    levels: GENERAL,
    offline: false,
    planModule: 'online-learning',
  },
];

export function isTeachingToolKey(value: unknown): value is string {
  return typeof value === 'string' && TEACHING_TOOLS.some((tool) => tool.key === value);
}

export interface TeachingToolFilter {
  // Cấp của lớp; null là chưa biết cấp (bản chụp danh sách lớp cũ lưu trước DT-29): không lọc theo cấp
  level: unknown;
  // Công cụ trường đã tắt
  disabled?: readonly string[];
  // Phân hệ, tính năng của gói; null là không giới hạn
  planModules?: readonly string[] | null;
}

export function teachingToolsFor(filter: TeachingToolFilter): TeachingTool[] {
  const level = filter.level === null ? null : levelOf(filter.level);
  const disabled = new Set(filter.disabled ?? []);
  const planModules = filter.planModules ?? null;
  return TEACHING_TOOLS.filter(
    (tool) =>
      (level === null || tool.levels.includes(level)) &&
      !disabled.has(tool.key) &&
      (!tool.planModule || planModules === null || planModules.includes(tool.planModule)),
  );
}
