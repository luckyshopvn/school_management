import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-27 phần 27e (YCTD-255): loại yêu cầu AI mới `answer` (gợi ý trả lời câu hỏi bài tập của học sinh cho giáo viên gia sư). Lời
// nhắc chỉ có cấp, môn, chữ của câu hỏi đã quét dữ liệu cá nhân và ghi chú ngắn của giáo viên; không có ảnh, không có tên học sinh.
// Số 0120: sau 0111 của 28c (cùng ràng buộc `ai_requests_kind_check`), nên mọi cơ sở dữ liệu mới chạy 0111 trước rồi mới thêm `answer`;
// dải 0100 đến 0109 của DT-27 chạy trước 0111 nên không dùng được
export const migration: Migration = {
  async up(database) {
    await sql`alter table ai_requests drop constraint ai_requests_kind_check`.execute(database);
    await sql`alter table ai_requests add constraint ai_requests_kind_check
      check (kind in ('questions', 'lesson_plan', 'check', 'feedback', 'answer'))`.execute(database);
  },
  async down(database) {
    await sql`delete from ai_requests where kind = 'answer'`.execute(database);
    await sql`alter table ai_requests drop constraint ai_requests_kind_check`.execute(database);
    await sql`alter table ai_requests add constraint ai_requests_kind_check
      check (kind in ('questions', 'lesson_plan', 'check', 'feedback'))`.execute(database);
  },
};
