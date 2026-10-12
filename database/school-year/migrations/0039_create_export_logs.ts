import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhật ký xuất dữ liệu (P17-12; BR-74; YCTD-83): mỗi lần xuất báo cáo ra tệp ghi một dòng gồm người xuất, báo cáo, bộ lọc,
// đơn vị trong phạm vi, số dòng, có dữ liệu cá nhân hay không. Tệp không lưu lại trên hệ thống nên không có file_id
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('export_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('report_code', 'text', (column) => column.notNull())
      .addColumn('filters_data', 'jsonb', (column) => column.notNull())
      .addColumn('org_unit_ids', sql`uuid[]`, (column) => column.notNull())
      .addColumn('row_count', 'integer', (column) => column.notNull())
      .addColumn('contains_personal_data', 'boolean', (column) => column.notNull())
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('ip_address', 'text')
      .addColumn('exported_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('export_logs_exported_at_index')
      .on('export_logs')
      .columns(['exported_at'])
      .execute();
    await database.schema.createIndex('export_logs_user_index').on('export_logs').columns(['user_id']).execute();
  },
  async down(database) {
    await database.schema.dropTable('export_logs').execute();
  },
};
