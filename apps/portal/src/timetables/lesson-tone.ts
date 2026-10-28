// Màu ô tiết học trên lưới thời khoá biểu (mẫu thiết kế Timetable.dc.html): mỗi môn một tông nhạt để nhìn lưới phân biệt được môn.
// Chỉ dùng mã màu của giao diện (nền nhạt cùng tông với chữ đậm, đạt tương phản 4,5:1); màu đỏ báo lỗi để dành cho ô xung đột nên
// không có trong danh sách. Cùng một môn luôn ra cùng một tông vì chọn theo mã môn.
const TONES = [
  'bg-brand/10 text-brand-strong',
  'bg-success/10 text-success',
  'bg-warning/10 text-warning',
  'bg-info/10 text-info',
  'bg-workspace/15 text-text',
  'bg-neutral/10 text-text',
];

export function lessonTone(subjectKey: string): string {
  let hash = 0;
  for (const character of subjectKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return TONES[hash % TONES.length] ?? '';
}
