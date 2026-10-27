// Nhóm loại thông báo cho tuỳ chọn tắt đẩy và nội dung đẩy (DT-26 phần 26b, YCTD-232; tài liệu 32 mục 18). Nhóm cố định, ánh xạ từ
// `template_code` theo tiền tố; loại không khớp nhóm nào thuộc "Thông báo chung của trường".
// Nội dung đẩy đi qua máy chủ của nhà cung cấp trình duyệt (Google, Apple, Mozilla) ở nước ngoài và hiện trên màn hình khóa, nên chỉ
// gồm tiêu đề theo nhóm, tên trường và một câu chung; KHÔNG lấy tiêu đề, nội dung của thông báo (có thể có họ tên, số tiền, điểm, sức
// khỏe). Người dùng mở ứng dụng (đã đăng nhập) mới thấy nội dung đầy đủ.
export interface PushGroup {
  code: string;
  label: string;
  title: string;
  prefixes: readonly string[];
}

export const PUSH_GROUPS: readonly PushGroup[] = [
  {
    code: 'attendance',
    label: 'Điểm danh và đón trả',
    title: 'Điểm danh, đón trả',
    prefixes: ['attendance_', 'absence_', 'child_absent', 'pickup_', 'child_handed_over'],
  },
  {
    code: 'fees',
    label: 'Học phí và thanh toán',
    title: 'Học phí',
    prefixes: [
      'invoice_',
      'receipt_',
      'payment_',
      'debt_',
      'discount_',
      'supplementary_invoice',
      'online_payment',
      'buffet_',
    ],
  },
  {
    code: 'health',
    label: 'Sức khỏe và thuốc',
    title: 'Sức khỏe',
    prefixes: ['medication_', 'medical_', 'health_', 'medicine_'],
  },
  {
    code: 'learning',
    label: 'Học tập và điểm',
    title: 'Học tập',
    prefixes: [
      'evaluation_',
      'child_progress',
      'journal_published',
      'final_year_record',
      'timetable_',
      'score_',
      'learning_',
      'library_',
    ],
  },
  { code: 'exams', label: 'Thi trực tuyến', title: 'Thi trực tuyến', prefixes: ['exam_', 'online_exam'] },
  {
    code: 'messages',
    label: 'Tin nhắn và phản hồi',
    title: 'Tin nhắn',
    prefixes: ['message_', 'feedback_', 'content_comment', 'comment_', 'admission_support'],
  },
  {
    code: 'staff_work',
    label: 'Công việc của cán bộ, giáo viên',
    title: 'Công việc',
    prefixes: [
      'task_',
      'leave_',
      'timesheet_',
      'payroll_',
      'payslip_',
      'journal_reminder',
      'work_',
      'professional_',
      'kpi',
      'lesson_plan_',
      'purchase_',
      'stock_',
      'asset_',
      'recruitment_',
      'candidate_',
      'interview_',
      'fiscal_',
      'market_purchase',
      'incoming_document',
      'outgoing_document',
    ],
  },
  { code: 'school', label: 'Thông báo chung của trường', title: 'Thông báo', prefixes: [] },
];

const DEFAULT_GROUP = PUSH_GROUPS[PUSH_GROUPS.length - 1] as PushGroup;

export function pushGroupOf(templateCode: string): PushGroup {
  return PUSH_GROUPS.find((group) => group.prefixes.some((prefix) => templateCode.startsWith(prefix))) ?? DEFAULT_GROUP;
}

export function isPushGroupCode(code: string): boolean {
  return PUSH_GROUPS.some((group) => group.code === code);
}

export interface PushMessage {
  title: string;
  body: string;
  // Thông báo cùng nhóm thay nhau trên máy thay vì chồng nhiều dòng
  tag: string;
  // app_url: địa chỉ gốc của ứng dụng lúc đăng ký, chỉ kèm khi có (ứng dụng cài đặt dùng để mở đúng trường)
  data: { notification_id: string; group: string; url: string; app_url?: string };
}

// Dựng nội dung đẩy chỉ từ nhóm, tên trường và mã thông báo
export function buildPushMessage(input: {
  notificationId: string;
  templateCode: string;
  schoolName: string | null;
}): PushMessage {
  const group = pushGroupOf(input.templateCode);
  const school = input.schoolName?.trim();
  return {
    title: school ? `${group.title} · ${school}` : group.title,
    body: `Có thông báo mới về ${group.label.toLowerCase()}. Mở ứng dụng để xem.`,
    tag: `nhom-${group.code}`,
    data: {
      notification_id: input.notificationId,
      group: group.code,
      url: `/thong-bao?id=${encodeURIComponent(input.notificationId)}`,
    },
  };
}
