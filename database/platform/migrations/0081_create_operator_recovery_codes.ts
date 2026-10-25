import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mã khôi phục dùng một lần của tài khoản vận hành nền tảng khi mất điện thoại (DT-SaaS phần S8b, YCTD-201): chỉ lưu bản băm
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_operator_recovery_codes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('operator_id', 'uuid', (column) =>
        column.notNull().references('platform_operators.id').onDelete('cascade'),
      )
      .addColumn('code_hash', 'text', (column) => column.notNull())
      .addColumn('used_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('platform_operator_recovery_codes_unique', ['operator_id', 'code_hash'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_operator_recovery_codes').execute();
  },
};
