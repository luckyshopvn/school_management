import type { FieldError } from '@school-management/server';
import { isUuid } from '../common/request-fields.js';
import type { CompletionRule } from './learning-rules.js';

// Danh mục loại hoạt động của lõi hệ thống quản lý học tập (DT-28 phần 28b, YCTD-272; tài liệu 32 mục 20.5, 20.7). Mỗi loại
// khai báo nhãn, cách tính hoàn thành được phép và cách đọc phần cài đặt riêng; lõi chỉ tra danh mục, không rẽ nhánh theo
// loại. Phần sau đăng ký loại của mình bằng cách thêm một dòng vào cuối `ACTIVITY_KINDS` (bài tập 28c, thảo luận và hỏi đáp
// 28e, giờ học trực tuyến 28g, gói SCORM 28h, bài kiểm tra của 23a khi 23a gộp). Loại chưa đăng ký thì không tạo được
export const MAX_PAGE_LENGTH = 20_000;

export interface ActivityKindDefinition {
  code: string;
  label: string;
  completionRules: readonly CompletionRule[];
  defaultCompletion: CompletionRule;
  // Loại có thể đặt trong khoá học mẫu của tổ (khoá mẫu chỉ chứa nội dung không gắn lớp, học sinh)
  allowedInTemplate: boolean;
  // Đọc phần cài đặt riêng; trả đối tượng đã chuẩn hóa hoặc ghi lỗi vào `errors`
  parseSettings(raw: unknown, field: string, errors: FieldError[]): Record<string, unknown>;
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

// Học liệu đã công bố của kho học liệu 22h1 (Thông tư 09/2021 Điều 7 khoản 3: học liệu dùng trong lớp đã qua tổ chuyên môn
// và Ban Giám hiệu); máy chủ kiểm học liệu có công bố khi tạo hoạt động
const resource: ActivityKindDefinition = {
  code: 'resource',
  label: 'Học liệu',
  completionRules: ['view', 'teacher'],
  defaultCompletion: 'view',
  allowedInTemplate: true,
  parseSettings(raw, field, errors) {
    const settings = asObject(raw);
    if (!isUuid(settings.resource_id)) {
      errors.push({ field: `${field}.resource_id`, message: 'Chọn một học liệu đã công bố của kho học liệu' });
      return {};
    }
    return { resource_id: settings.resource_id };
  },
};

// Trang nội dung giáo viên soạn (hướng dẫn, đọc thêm); chữ thuần có xuống dòng, tối đa 20.000 ký tự
const page: ActivityKindDefinition = {
  code: 'page',
  label: 'Trang nội dung',
  completionRules: ['view', 'teacher'],
  defaultCompletion: 'view',
  allowedInTemplate: true,
  parseSettings(raw, field, errors) {
    const settings = asObject(raw);
    const body = typeof settings.body === 'string' ? settings.body.trim() : '';
    if (body === '' || body.length > MAX_PAGE_LENGTH) {
      errors.push({ field: `${field}.body`, message: `Nội dung trang từ 1 đến ${MAX_PAGE_LENGTH} ký tự` });
      return {};
    }
    return { body };
  },
};

// Liên kết ngoài chỉ qua https; tên miền phải nằm trong danh sách trường cho phép (máy chủ kiểm với cấu hình của trường)
const link: ActivityKindDefinition = {
  code: 'link',
  label: 'Liên kết',
  completionRules: ['view', 'teacher'],
  defaultCompletion: 'view',
  allowedInTemplate: true,
  parseSettings(raw, field, errors) {
    const settings = asObject(raw);
    const url = typeof settings.url === 'string' ? settings.url.trim() : '';
    let parsed: URL | null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== 'https:' || url.length > 2000) {
      errors.push({ field: `${field}.url`, message: 'Liên kết bắt đầu bằng https://, tối đa 2000 ký tự' });
      return {};
    }
    return { url: parsed.toString(), host: parsed.hostname.toLowerCase() };
  },
};

// Bài tập trực tuyến (DT-28 phần 28c, YCTD-273): cài đặt riêng của bài (câu, phiên bản, đích giao, cách chấm) ở bảng
// `assignments` của phần 28c, soạn qua tuyến `/learning/activities/:id/assignment`; hoạt động chỉ giữ tên, hướng dẫn, hạn.
// Hoàn thành khi nộp (`submit`), khi đạt điểm (`pass`) hoặc khi giáo viên trả bài (`teacher`); không đặt trong khoá mẫu vì
// bài gắn đích giao của lớp
const assignment: ActivityKindDefinition = {
  code: 'assignment',
  label: 'Bài tập',
  completionRules: ['submit', 'pass', 'teacher'],
  defaultCompletion: 'submit',
  allowedInTemplate: false,
  parseSettings() {
    return {};
  },
};

export const ACTIVITY_KINDS: readonly ActivityKindDefinition[] = [resource, page, link, assignment];

export function activityKind(code: unknown): ActivityKindDefinition | null {
  return ACTIVITY_KINDS.find((kind) => kind.code === code) ?? null;
}

// Tên miền nằm trong danh sách cho phép (khớp đúng tên hoặc tên miền con); danh sách trống là không cho liên kết ngoài
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
  const normalized = host.toLowerCase();
  return allowed.some((entry) => {
    const domain = entry.trim().toLowerCase();
    return domain !== '' && (normalized === domain || normalized.endsWith(`.${domain}`));
  });
}
