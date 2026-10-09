import { sql, type CreateTableBuilder } from 'kysely';
import type { Migration } from 'kysely/migration';

// Các danh mục của P01: phòng ban, chức danh, danh mục dùng chung, hạn mức phê duyệt, phòng học, bậc học (YCTD-42)
function withCommonColumns<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'uuid');
}

const ACTIVE_OR_INACTIVE = sql`status in ('active', 'inactive')`;

export const migration: Migration = {
  async up(database) {
    await withCommonColumns(database.schema.createTable('departments'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('parent_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('departments_status_check', ACTIVE_OR_INACTIVE)
      .execute();
    await database.schema
      .createIndex('departments_org_unit_id_index')
      .on('departments')
      .column('org_unit_id')
      .execute();
    await database.schema.createIndex('departments_parent_id_index').on('departments').column('parent_id').execute();

    await withCommonColumns(database.schema.createTable('job_titles'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('level', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('job_titles_status_check', ACTIVE_OR_INACTIVE)
      .addUniqueConstraint('job_titles_unit_name_unique', ['org_unit_id', 'name'])
      .execute();
    await database.schema.createIndex('job_titles_org_unit_id_index').on('job_titles').column('org_unit_id').execute();

    await withCommonColumns(database.schema.createTable('catalog_items'))
      .addColumn('catalog_type', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('catalog_items_status_check', ACTIVE_OR_INACTIVE)
      .addUniqueConstraint('catalog_items_type_code_unique', ['catalog_type', 'code'])
      .execute();

    await withCommonColumns(database.schema.createTable('approval_thresholds'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('document_type', 'text', (column) => column.notNull())
      .addColumn('threshold_amount', sql`numeric(15, 2)`, (column) => column.notNull())
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('approval_thresholds_status_check', sql`status in ('active', 'expired')`)
      .addCheckConstraint('approval_thresholds_amount_check', sql`threshold_amount > 0`)
      .execute();
    await database.schema
      .createIndex('approval_thresholds_org_unit_id_index')
      .on('approval_thresholds')
      .column('org_unit_id')
      .execute();
    // Mỗi đơn vị và loại chứng từ chỉ có một hạn mức đang hiệu lực
    await sql`create unique index approval_thresholds_single_active on approval_thresholds (org_unit_id, document_type)
      where status = 'active'`.execute(database);

    await withCommonColumns(database.schema.createTable('rooms'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('capacity', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('rooms_status_check', ACTIVE_OR_INACTIVE)
      .addCheckConstraint('rooms_capacity_check', sql`capacity > 0`)
      .addUniqueConstraint('rooms_unit_code_unique', ['org_unit_id', 'code'])
      .execute();
    await database.schema.createIndex('rooms_org_unit_id_index').on('rooms').column('org_unit_id').execute();

    await withCommonColumns(database.schema.createTable('grade_levels'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('age_from_months', 'integer', (column) => column.notNull())
      .addColumn('age_to_months', 'integer', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('grade_levels_status_check', ACTIVE_OR_INACTIVE)
      .addCheckConstraint('grade_levels_age_check', sql`age_from_months >= 0 and age_from_months <= age_to_months`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'grade_levels',
      'rooms',
      'approval_thresholds',
      'catalog_items',
      'job_titles',
      'departments',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
