import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhập dữ liệu ban đầu từ Excel (P01-13) và nhập mã định danh ngành (P02-12) (YCTD-46)
export const migration: Migration = {
  async up(database) {
    // Trẻ nhập từ Excel đang học sẵn, bổ sung giấy khai sinh sau (YCTD-46)
    await sql`alter table children alter column birth_certificate_file_id drop not null`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent', 'import'))`.execute(database);

    await database.schema
      .createTable('data_import_jobs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('import_type', 'text', (column) => column.notNull())
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('total_rows', 'integer', (column) => column.notNull())
      .addColumn('error_rows', 'integer', (column) => column.notNull())
      // Báo cáo dòng lỗi: số dòng, cột, nội dung; không chứa số định danh ở dạng rõ
      .addColumn('errors', 'jsonb', (column) => column.notNull())
      .addColumn('error_report_file_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('committed_by', 'uuid')
      .addColumn('committed_at', 'timestamptz')
      .addCheckConstraint('data_import_jobs_type_check', sql`import_type in ('classes', 'children', 'moet_codes')`)
      .addCheckConstraint('data_import_jobs_status_check', sql`status in ('validated', 'failed', 'committed')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('data_import_jobs').execute();
    await sql`delete from files where purpose = 'import'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent'))`.execute(database);
    await sql`alter table children alter column birth_certificate_file_id set not null`.execute(database);
  },
};
