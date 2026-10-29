import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214; tài liệu 47 mục 15): câu hỏi do trợ lý AI soạn nháp vào ngân hàng câu hỏi (22g1) mang cờ `ai_generated`.
// Câu có cờ vào ở trạng thái nháp, chỉ dùng được trong đề sau khi qua luồng thẩm định của 22g1 (người soạn gửi thẩm định, người
// thẩm định khác duyệt); cờ giữ vĩnh viễn để giao diện ghi dấu "do AI soạn" và thống kê. `ai_request_id` là mã yêu cầu ở nhật ký AI
// của cơ sở dữ liệu hệ thống của trường (không có khóa ngoại vì khác cơ sở dữ liệu)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('questions')
      .addColumn('ai_generated', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('ai_request_id', 'uuid')
      .execute();
    await sql`create index questions_ai_idx on questions (ai_generated) where ai_generated`.execute(database);
  },
  async down(database) {
    await sql`drop index questions_ai_idx`.execute(database);
    await database.schema.alterTable('questions').dropColumn('ai_generated').dropColumn('ai_request_id').execute();
  },
};
