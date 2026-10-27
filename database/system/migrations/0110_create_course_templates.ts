import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): khoá học mẫu của tổ chuyên môn trong lõi hệ thống quản lý học tập. Khoá mẫu dùng qua nhiều năm
// học nên ở cơ sở dữ liệu hệ thống, giống học liệu của 22h1; bản của từng lớp ở năm học (0172 đến 0175). Claude tự chọn theo
// ủy quyền của Eric ngày 2026-10-11:
// - Môn, khối lưu mã và tên (môn nằm ở năm học), tổ lưu mã và tên phòng ban của người soạn lúc gửi duyệt (như 22h1).
// - Nội dung (chương và hoạt động) là một tài liệu JSON có phiên bản: `content` là bản đang soạn, `published_content` là bản
//   đã duyệt; sửa khoá đã duyệt rồi gửi lại thì bản đã duyệt vẫn dùng đến khi bản mới được duyệt.
// - Luồng duyệt giống 22h1 và đúng Thông tư 09/2021/TT-BGDĐT Điều 7 khoản 3 (tổ chuyên môn thông qua, người đứng đầu phê
//   duyệt): nháp hoặc bị trả lại, chờ tổ duyệt, chờ Ban Giám hiệu duyệt, đã duyệt; luôn qua cả hai bước.
// - `course_template_reviews` ghi mọi lần gửi, duyệt, trả lại kèm phiên bản và lý do.
const LEVELS = `'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('course_templates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('school_level', 'text', (column) => column.notNull().check(sql.raw(`school_level in (${LEVELS})`)))
      .addColumn('grade_level_code', 'text')
      .addColumn('subject_code', 'text')
      .addColumn('subject_name', 'text')
      .addColumn('department_id', 'uuid')
      .addColumn('department_name', 'text')
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('owner_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'pending_unit', 'pending_school', 'published', 'returned', 'retired')`),
      )
      .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('content', 'jsonb', (column) => column.notNull())
      .addColumn('published_version', 'integer')
      .addColumn('published_content', 'jsonb')
      .addColumn('published_at', 'timestamptz')
      .addColumn('return_reason', 'text', (column) => column.check(sql`char_length(return_reason) <= 1000`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('course_templates_subject_index')
      .on('course_templates')
      .columns(['school_level', 'subject_code', 'grade_level_code'])
      .execute();

    await database.schema
      .createTable('course_template_reviews')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('template_id', 'uuid', (column) =>
        column.notNull().references('course_templates.id').onDelete('cascade'),
      )
      .addColumn('version', 'integer', (column) => column.notNull())
      .addColumn('action', 'text', (column) =>
        column.notNull().check(sql`action in ('submit', 'approve_unit', 'approve_school', 'return', 'retire')`),
      )
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('course_template_reviews_template_index')
      .on('course_template_reviews')
      .columns(['template_id', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('course_template_reviews').execute();
    await database.schema.dropTable('course_templates').execute();
  },
};
