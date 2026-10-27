import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28h (YCTD-278): gói SCORM là học liệu của kho 22h1 (loại `scorm`, qua tổ chuyên môn và Ban Giám hiệu duyệt theo
// Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3). Mỗi phiên bản tệp zip của học liệu loại này có một dòng `scorm_packages`: chuẩn
// (1.2 hay 2004), danh sách SCO theo thứ tự của tổ chức mặc định, danh sách tệp đã giải nén (đường dẫn trong gói, khóa kho tệp,
// kiểu nội dung, cỡ). Gói ở cơ sở dữ liệu hệ thống vì học liệu dùng qua nhiều năm học
export const migration: Migration = {
  async up(database) {
    await sql`insert into resource_types (code, name, requires_school_review, order_no)
      values ('scorm', 'Gói bài giảng SCORM', true, 90)
      on conflict (code) do nothing`.execute(database);

    await database.schema
      .createTable('scorm_packages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('resource_id', 'uuid', (column) =>
        column.notNull().references('learning_resources.id').onDelete('cascade'),
      )
      .addColumn('version_id', 'uuid', (column) =>
        column.notNull().unique().references('learning_resource_versions.id').onDelete('cascade'),
      )
      .addColumn('standard', 'text', (column) => column.notNull().check(sql`standard in ('1.2', '2004')`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      // [{ identifier, title, href }] theo thứ tự chạy
      .addColumn('scos', 'jsonb', (column) => column.notNull())
      // { "<đường dẫn trong gói>": { key, type, size } }
      .addColumn('files', 'jsonb', (column) => column.notNull())
      .addColumn('file_count', 'integer', (column) => column.notNull())
      .addColumn('total_bytes', 'bigint', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('scorm_packages_resource_index')
      .on('scorm_packages')
      .column('resource_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('scorm_packages').execute();
    await sql`delete from resource_types where code = 'scorm'
      and not exists (select 1 from learning_resources where learning_resources.type_id = resource_types.id)`.execute(
      database,
    );
  },
};
