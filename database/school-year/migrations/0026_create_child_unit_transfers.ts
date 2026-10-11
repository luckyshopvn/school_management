import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lịch sử chuyển đơn vị của trẻ: đơn vị và lớp cũ, đơn vị và lớp mới, ngày hiệu lực, lý do (P02-07, LP-02; YCTD-67)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('child_unit_transfers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('from_org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('to_org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('from_class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('to_class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('effective_date', 'date', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('child_unit_transfers_child_index')
      .on('child_unit_transfers')
      .column('child_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('child_unit_transfers').execute();
  },
};
