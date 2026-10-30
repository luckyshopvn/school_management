import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L3 (YCTD-383): giáo viên chủ nhiệm (hoặc Ban Giám hiệu khi lớp chưa có giáo viên chủ nhiệm) đánh dấu cờ cảnh
// báo "đã xử lý". `notified_at` của lát L2 ghi khi đã tạo thông báo; `resolved_at`, người xử lý ghi khi đánh dấu đã xử lý
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('ai_tutor_safety_flags')
      .addColumn('resolved_at', 'timestamptz')
      .addColumn('resolved_by', 'uuid')
      .addColumn('resolved_by_name', 'text')
      .execute();
    await sql`create index ai_tutor_safety_flags_child_idx on ai_tutor_safety_flags (child_id, created_at)`.execute(
      database,
    );
  },
  async down(database) {
    await sql`drop index ai_tutor_safety_flags_child_idx`.execute(database);
    await database.schema
      .alterTable('ai_tutor_safety_flags')
      .dropColumn('resolved_by_name')
      .dropColumn('resolved_by')
      .dropColumn('resolved_at')
      .execute();
  },
};
