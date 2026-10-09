import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Năm học, học kỳ, tuần học và danh sách cơ sở dữ liệu năm học ở cơ sở dữ liệu hệ thống (QĐ-17, BR-91, BR-93)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('academic_years')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull().unique())
      .addColumn('start_date', 'date')
      .addColumn('end_date', 'date')
      .addColumn('school_days_of_week', sql`smallint[]`, (column) => column.notNull().defaultTo(sql`'{1,2,3,4,5}'`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('academic_years_status_check', sql`status in ('draft', 'open', 'closed')`)
      .execute();
    // Mỗi thời điểm chỉ một năm học đang dùng (BR-93)
    await sql`create unique index academic_years_single_open on academic_years ((status)) where status = 'open'`.execute(
      database,
    );

    await database.schema
      .createTable('academic_terms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('term_type', 'text', (column) => column.notNull())
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('academic_terms_type_check', sql`term_type in ('first_term', 'second_term', 'summer_term')`)
      .addCheckConstraint('academic_terms_dates_check', sql`start_date <= end_date`)
      .addUniqueConstraint('academic_terms_year_type_unique', ['academic_year_id', 'term_type'])
      .execute();

    await database.schema
      .createTable('school_weeks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('week_no', 'integer', (column) => column.notNull())
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date', (column) => column.notNull())
      .addColumn('is_off', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addUniqueConstraint('school_weeks_year_number_unique', ['academic_year_id', 'week_no'])
      .execute();

    await database.schema
      .createTable('academic_year_databases')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().unique().references('academic_years.id'))
      .addColumn('database_name', 'text', (column) => column.notNull().unique())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('opened_at', 'timestamptz', (column) => column.notNull())
      .addColumn('closed_at', 'timestamptz')
      .addColumn('carried_over_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('academic_year_databases_status_check', sql`status in ('active', 'read_only')`)
      .execute();
  },
  async down(database) {
    for (const table of ['academic_year_databases', 'school_weeks', 'academic_terms', 'academic_years']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
