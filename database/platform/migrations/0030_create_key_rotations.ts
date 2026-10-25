import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhật ký đổi khóa mã hóa dữ liệu trẻ của trường (DT-SaaS phần S3, YCTD-195, tài liệu 32 mục 14.5): khóa mới (bọc bằng khóa gốc của
// nền tảng) và tiến độ mã hóa lại từng bảng, ghi sau mỗi lô để công cụ làm tiếp được khi bị gián đoạn. Mỗi trường chỉ có một lần
// đổi khóa đang chạy; khóa mới chỉ thay khóa hiện tại ở `school_keys` khi mã hóa lại xong toàn bộ
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_key_rotations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('running'))
      .addColumn('new_encryption_key_encrypted', 'text', (column) => column.notNull())
      .addColumn('new_hash_key_encrypted', 'text', (column) => column.notNull())
      // Khóa tiến độ `<loại>:<tên>:<bảng>.<cột>` → mã dòng đã xử lý cuối cùng
      .addColumn('progress', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('rows_done', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('started_by', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addColumn('error', 'text')
      .addCheckConstraint('school_key_rotations_status_check', sql`status in ('running', 'completed', 'failed')`)
      .execute();
    await sql`create unique index school_key_rotations_running_idx on school_key_rotations (school_id) where status = 'running'`.execute(
      database,
    );
  },
  async down(database) {
    await database.schema.dropTable('school_key_rotations').execute();
  },
};
