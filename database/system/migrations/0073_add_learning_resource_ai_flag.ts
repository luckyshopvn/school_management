import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214): học liệu do AI soạn (kế hoạch bài dạy nháp) mang cờ `ai_generated` và mã yêu cầu ở nhật ký, để giao diện
// ghi dấu "do AI soạn, cần giáo viên kiểm tra" và người kiểm duyệt (22h1) biết nguồn. Học liệu có cờ này vẫn đi đủ luồng kiểm duyệt
// của 22h1 trước khi chia sẻ
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('learning_resources')
      .addColumn('ai_generated', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('ai_request_id', 'uuid')
      .execute();
    await sql`create index learning_resources_ai_idx on learning_resources (ai_generated) where ai_generated`.execute(
      database,
    );
  },
  async down(database) {
    await sql`drop index learning_resources_ai_idx`.execute(database);
    await database.schema.alterTable('learning_resources').dropColumn('ai_generated').dropColumn('ai_request_id').execute();
  },
};
