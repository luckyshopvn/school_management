// Trao đổi trên bài nộp ở ứng dụng giáo viên (YCTD-346, MH-421): kiểm lời trả lời trước khi gửi và ghép lời vừa gửi vào luồng.
// Hàm thuần, không nhập gì, để kiểm thử đơn vị bằng node --test. Giới hạn khớp máy chủ (`MAX_COMMENT` của `assignments.ts`)
export const MAX_SUBMISSION_COMMENT = 2000;

export interface SubmissionComment {
  id: string;
  author_name: string;
  author_kind?: 'teacher' | 'student' | 'guardian';
  body: string;
  created_at?: string;
}

// Trả về câu báo lỗi khi lời trả lời không gửi được, `null` khi hợp lệ
export function replyProblem(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return 'Nhập nội dung trả lời trước khi gửi';
  }
  if (trimmed.length > MAX_SUBMISSION_COMMENT) {
    return `Lời trả lời dài ${trimmed.length} ký tự, tối đa ${MAX_SUBMISSION_COMMENT} ký tự`;
  }
  return null;
}

// Thêm lời vừa gửi vào cuối luồng; bỏ qua nếu đã có (đọc lại bài nộp về trước khi phản hồi gửi đến)
export function appendComment(comments: SubmissionComment[], added: SubmissionComment): SubmissionComment[] {
  return comments.some((comment) => comment.id === added.id) ? comments : [...comments, added];
}

export const AUTHOR_KIND_LABELS: Record<NonNullable<SubmissionComment['author_kind']>, string> = {
  teacher: 'Giáo viên',
  student: 'Học sinh',
  guardian: 'Phụ huynh',
};
