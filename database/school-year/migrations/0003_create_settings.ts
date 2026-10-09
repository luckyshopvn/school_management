import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấu hình theo đơn vị (P01-08, YCTD-40) và tên người thực hiện trong nhật ký thao tác
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('settings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('key', 'text', (column) => column.notNull())
      .addColumn('value', 'jsonb', (column) => column.notNull())
      .addColumn('value_type', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addUniqueConstraint('settings_unit_key_unique', ['org_unit_id', 'key'])
      .execute();
    await database.schema.createIndex('settings_org_unit_id_index').on('settings').column('org_unit_id').execute();
    await database.schema.alterTable('audit_logs').addColumn('actor_name', 'text').execute();
  },
  async down(database) {
    await database.schema.alterTable('audit_logs').dropColumn('actor_name').execute();
    await database.schema.dropTable('settings').execute();
  },
};
