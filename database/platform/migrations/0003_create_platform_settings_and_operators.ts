import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấu hình của nền tảng (tên miền hệ thống, tên sản phẩm, mã trường dành riêng) và tài khoản vận hành nền tảng; tài khoản
// vận hành không thuộc trường nào (tài liệu 47 mục 14.2)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_settings')
      .addColumn('key', 'text', (column) => column.primaryKey())
      .addColumn('value', 'jsonb', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('platform_operators')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('login', 'text', (column) => column.notNull().unique())
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('password_hash', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('failed_login_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('locked_until', 'timestamptz')
      .addColumn('last_login_at', 'timestamptz')
      .addColumn('must_change_password', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('platform_operators_status_check', sql`status in ('active', 'locked')`)
      .addCheckConstraint(
        'platform_operators_login_check',
        sql`login = lower(login) and length(login) between 3 and 64`,
      )
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_operators').execute();
    await database.schema.dropTable('platform_settings').execute();
  },
};
