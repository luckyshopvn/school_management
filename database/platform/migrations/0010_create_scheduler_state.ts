import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trạng thái bộ lập lịch theo trường (DT-SaaS phần S1b, tài liệu 32 mục 14.5): mỗi việc nền của mỗi trường một dòng, ghi lần chạy
// gần nhất để việc đến hạn tính từ dấu thời gian ở cơ sở dữ liệu (tiến trình ngủ rồi gọi lại muộn vẫn bù đủ, nhiều bản máy chủ
// không chạy trùng một việc) và để bảng điều khiển nền tảng xem việc nào của trường nào chạy lúc nào, lỗi gì
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('scheduler_state')
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('job', 'text', (column) => column.notNull())
      .addColumn('last_run_at', 'timestamptz', (column) => column.notNull())
      .addColumn('run_count', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('last_status', 'text')
      .addColumn('last_duration_ms', 'integer')
      .addColumn('last_error', 'text')
      .addPrimaryKeyConstraint('scheduler_state_pkey', ['school_id', 'job'])
      .addCheckConstraint('scheduler_state_status_check', sql`last_status in ('ok', 'error') or last_status is null`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('scheduler_state').execute();
  },
};
