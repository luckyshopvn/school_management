import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19b (YCTD-152): học kỳ, tuần và ngày học theo cấp cho trường liên cấp. `school_level` trống là lịch chung cả
// trường (hành vi hiện có); cấp nào khai báo riêng thì có bộ học kỳ, tuần riêng của cấp đó. Ngày học trong tuần của cấp ở
// `academic_year_level_settings`; cấp không có dòng thì theo `academic_years.school_days_of_week`. Không trùng học kỳ, số tuần
// trong cùng năm học và cùng cấp (kể cả lịch chung) nên khóa không trùng tính trống như một giá trị
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    for (const table of ['academic_terms', 'school_weeks']) {
      await database.schema
        .alterTable(table)
        .addColumn('school_level', 'text', (column) => column.check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)))
        .execute();
    }
    await sql`alter table academic_terms drop constraint academic_terms_year_type_unique`.execute(database);
    await sql`create unique index academic_terms_year_level_type_unique
      on academic_terms (academic_year_id, school_level, term_type) nulls not distinct`.execute(database);
    await sql`alter table school_weeks drop constraint school_weeks_year_number_unique`.execute(database);
    await sql`create unique index school_weeks_year_level_number_unique
      on school_weeks (academic_year_id, school_level, week_no) nulls not distinct`.execute(database);

    await database.schema
      .createTable('academic_year_level_settings')
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('school_days_of_week', sql`smallint[]`, (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addPrimaryKeyConstraint('academic_year_level_settings_pkey', ['academic_year_id', 'school_level'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('academic_year_level_settings').execute();
    await sql`delete from school_weeks where school_level is not null`.execute(database);
    await sql`delete from academic_terms where school_level is not null`.execute(database);
    await sql`drop index school_weeks_year_level_number_unique`.execute(database);
    await sql`alter table school_weeks add constraint school_weeks_year_number_unique
      unique (academic_year_id, week_no)`.execute(database);
    await sql`drop index academic_terms_year_level_type_unique`.execute(database);
    await sql`alter table academic_terms add constraint academic_terms_year_type_unique
      unique (academic_year_id, term_type)`.execute(database);
    for (const table of ['academic_terms', 'school_weeks']) {
      await database.schema.alterTable(table).dropColumn('school_level').execute();
    }
  },
};
