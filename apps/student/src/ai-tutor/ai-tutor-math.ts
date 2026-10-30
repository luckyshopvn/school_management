// Chuẩn hóa ký hiệu công thức trước khi hiển thị câu trả lời của gia sư AI (YCTD-383 lát L2): nhà cung cấp có lúc viết `\(...\)`, `\[...\]`
// thay cho `$...$`, `$$...$$` mà remark-math đọc được. Khối công thức chưa đóng giữ nguyên chữ, không đổi
export function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, body: string) => `\n$$\n${body.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, body: string) => `$${body.trim()}$`);
}

// Thanh số lượt: phần còn lại trên tổng số lượt của các gói đang dùng, từ 0 đến 100
export function remainingPercent(remaining: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
}

// Ảnh bài tập (YCTD-383 lát L4): kiểm sơ bộ ở ứng dụng trước khi nén; máy chủ kiểm lại loại, cỡ, số ảnh
export const TUTOR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function tutorImagesProblem(
  picked: ReadonlyArray<{ type: string }>,
  alreadyChosen: number,
  maxCount: number,
): string | null {
  if (alreadyChosen + picked.length > maxCount) {
    return `Mỗi câu hỏi gửi tối đa ${maxCount} ảnh`;
  }
  if (picked.some((file) => !TUTOR_IMAGE_TYPES.includes(file.type))) {
    return 'Chỉ gửi ảnh JPEG, PNG hoặc WebP';
  }
  return null;
}
