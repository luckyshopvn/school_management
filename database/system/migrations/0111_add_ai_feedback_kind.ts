import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): loại yêu cầu AI mới `feedback` (gợi ý nhận xét bài tập cho giáo viên). Lời nhắc chỉ có môn, khối,
// đề, thang tiêu chí, điểm hoặc mức giáo viên đã cho và ghi chú ngắn đã quét dữ liệu cá nhân; không bao giờ có bài làm, ảnh, ghi
// âm của học sinh (Eric chốt 2026-10-26, GD-142)
export const migration: Migration = {
  async up(database) {
    await sql`alter table ai_requests drop constraint ai_requests_kind_check`.execute(database);
    await sql`alter table ai_requests add constraint ai_requests_kind_check
      check (kind in ('questions', 'lesson_plan', 'check', 'feedback'))`.execute(database);
  },
  async down(database) {
    await sql`delete from ai_requests where kind = 'feedback'`.execute(database);
    await sql`alter table ai_requests drop constraint ai_requests_kind_check`.execute(database);
    await sql`alter table ai_requests add constraint ai_requests_kind_check
      check (kind in ('questions', 'lesson_plan', 'check'))`.execute(database);
  },
};
