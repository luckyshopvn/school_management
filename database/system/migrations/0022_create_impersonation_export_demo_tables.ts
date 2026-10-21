import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quản trị và trình diễn (DT-18 phần 18h, YCTD-145):
// - impersonation_actions: mọi thao tác ghi (và tải tệp) trên máy chủ API trong lúc quản trị đang đăng nhập thay một tài
//   khoản: ai đăng nhập thay, vào tài khoản nào, lúc nào, thao tác gì (phương thức, đường dẫn), kết quả. Lần bắt đầu và kết
//   thúc đăng nhập thay ghi ở cơ sở dữ liệu định danh (impersonations);
// - export_jobs nhận định dạng 'zip' cho gói toàn bộ dữ liệu của trường (tác vụ xuất nền của 16a);
// - export_job_downloads: nhật ký tải tệp đã tạo (ai tải, lúc nào, từ địa chỉ nào);
// - demo_environment: một dòng đánh dấu cơ sở dữ liệu này là bản trình diễn, chỉ lệnh tạo dữ liệu trình diễn ghi. Không có
//   dòng thì không phải bản trình diễn; lệnh tạo dữ liệu từ chối chạy trên cơ sở dữ liệu đã có dữ liệu mà chưa đánh dấu
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('impersonation_actions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('impersonation_id', 'uuid', (column) => column.notNull())
      .addColumn('impersonator_user_id', 'uuid', (column) => column.notNull())
      .addColumn('impersonator_name', 'text', (column) => column.notNull())
      .addColumn('target_user_id', 'uuid', (column) => column.notNull())
      .addColumn('target_name', 'text', (column) => column.notNull())
      .addColumn('method', 'text', (column) => column.notNull())
      .addColumn('path', 'text', (column) => column.notNull())
      .addColumn('status_code', 'integer', (column) => column.notNull())
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('impersonation_actions_impersonation_index')
      .on('impersonation_actions')
      .columns(['impersonation_id', 'created_at'])
      .execute();

    await sql`alter table export_jobs drop constraint export_jobs_format_check`.execute(database);
    await sql`alter table export_jobs add constraint export_jobs_format_check
      check (format in ('xlsx', 'pdf', 'zip'))`.execute(database);
    await database.schema
      .createTable('export_job_downloads')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('export_job_id', 'uuid', (column) => column.notNull().references('export_jobs.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('ip_address', 'text')
      .addColumn('downloaded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('export_job_downloads_job_index')
      .on('export_job_downloads')
      .column('export_job_id')
      .execute();

    await database.schema
      .createTable('demo_environment')
      .addColumn('id', 'smallint', (column) => column.primaryKey().defaultTo(1))
      .addColumn('seed_version', 'text', (column) => column.notNull())
      .addColumn('seeded_at', 'timestamptz', (column) => column.notNull())
      .addColumn('reset_interval_hours', 'integer', (column) => column.notNull().defaultTo(24))
      .addColumn('next_reset_at', 'timestamptz')
      .addColumn('accounts', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addCheckConstraint('demo_environment_single_row_check', sql`id = 1`)
      .addCheckConstraint('demo_environment_interval_check', sql`reset_interval_hours between 1 and 720`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('demo_environment').execute();
    await database.schema.dropTable('export_job_downloads').execute();
    await sql`delete from export_jobs where format = 'zip'`.execute(database);
    await sql`alter table export_jobs drop constraint export_jobs_format_check`.execute(database);
    await sql`alter table export_jobs add constraint export_jobs_format_check
      check (format in ('xlsx', 'pdf'))`.execute(database);
    await database.schema.dropTable('impersonation_actions').execute();
  },
};
