import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mã khôi phục dùng một lần của người dùng trường khi mất điện thoại (DT-SaaS phần S8b, YCTD-201): chỉ lưu bản băm
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('user_recovery_codes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id').onDelete('cascade'))
      .addColumn('code_hash', 'text', (column) => column.notNull())
      .addColumn('used_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('user_recovery_codes_unique', ['user_id', 'code_hash'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('user_recovery_codes').execute();
  },
};
