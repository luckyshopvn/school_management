import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhật ký của nền tảng: thao tác của người vận hành và của lệnh dòng lệnh; không khóa ngoại tới trường để giữ lại sau khi
// trường bị xóa (bằng chứng ở tài liệu 47 mục 14.5, S2)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_audit_log')
      .addColumn('id', 'bigserial', (column) => column.primaryKey())
      .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'text')
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('school_id', 'uuid')
      .addColumn('details', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('ip_address', 'text')
      .addCheckConstraint('platform_audit_log_actor_check', sql`actor_type in ('operator', 'system', 'cli')`)
      .execute();
    await database.schema
      .createIndex('platform_audit_log_school_idx')
      .on('platform_audit_log')
      .columns(['school_id', 'at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_audit_log').execute();
  },
};
