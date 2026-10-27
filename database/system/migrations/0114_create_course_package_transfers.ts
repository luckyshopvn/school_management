import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28h (YCTD-278): nhật ký xuất, nhập gói khoá học `school-management.course-package/1` giữa các trường. Gói không
// chứa dữ liệu học sinh; nhập tạo khoá học mẫu nháp (qua duyệt như khoá mẫu tự soạn) và học liệu nháp của kho 22h1
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('course_package_transfers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('direction', 'text', (column) => column.notNull().check(sql`direction in ('export', 'import')`))
      .addColumn('package_code', 'text', (column) => column.notNull())
      .addColumn('source_school', 'text', (column) => column.notNull())
      .addColumn('template_id', 'uuid', (column) => column.references('course_templates.id').onDelete('set null'))
      .addColumn('template_title', 'text', (column) => column.notNull())
      .addColumn('resource_count', 'integer', (column) => column.notNull().defaultTo(0))
      // [{ title, reason }] của học liệu, hoạt động bị bỏ qua khi nhập
      .addColumn('skipped', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('course_package_transfers').execute();
  },
};
