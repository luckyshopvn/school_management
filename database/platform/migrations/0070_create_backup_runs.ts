import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Sao lưu, khôi phục, diễn tập khôi phục và chuyển cụm theo từng trường (DT-SaaS phần S7b, YCTD-199): mỗi lần chạy một dòng,
// kèm tệp sao lưu (đường dẫn tương đối, kích thước, mã băm), số bảng, số dòng, kết quả kiểm tra và lỗi. Bảng điều khiển nền
// tảng (S4) đọc dòng mới nhất của từng trường để báo sao lưu, diễn tập quá hạn
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('backup_runs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.references('schools.id').onDelete('set null'))
      .addColumn('school_code', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('running'))
      .addColumn('file_name', 'text')
      .addColumn('file_bytes', 'bigint')
      .addColumn('file_sha256', 'text')
      .addColumn('databases', 'integer')
      .addColumn('tables', 'integer')
      .addColumn('rows', 'bigint')
      .addColumn('details', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('error', 'text')
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'uuid')
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addCheckConstraint('backup_runs_kind_check', sql`kind in ('backup', 'restore', 'drill', 'cluster-move')`)
      .addCheckConstraint('backup_runs_status_check', sql`status in ('running', 'done', 'failed')`)
      .execute();
    await database.schema
      .createIndex('backup_runs_school_index')
      .on('backup_runs')
      .columns(['school_code', 'kind', 'started_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('backup_runs').execute();
  },
};
