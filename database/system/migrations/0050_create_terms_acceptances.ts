import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Việc đồng ý điều khoản sử dụng của trường (DT-SaaS phần S2, YCTD-193): phiên bản điều khoản (mẫu PL-04 của S8a), thời điểm,
// người đồng ý và nguồn (bước setup ở cổng nền tảng, hoặc người dùng của trường sau này). Lưu ở cơ sở dữ liệu hệ thống của
// chính trường để đi theo dữ liệu của trường khi xuất, chuyển cụm
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('terms_acceptances')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('terms_version', 'text', (column) =>
        column.notNull().check(sql`char_length(terms_version) between 1 and 50`),
      )
      .addColumn('accepted_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('accepted_by_name', 'text', (column) => column.notNull())
      .addColumn('accepted_by_title', 'text')
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('recorded_by', 'text', (column) => column.notNull())
      .addCheckConstraint('terms_acceptances_source_check', sql`source in ('platform-setup', 'school-user')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('terms_acceptances').execute();
  },
};
