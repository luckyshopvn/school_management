import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khoá học ghi sẵn của chương trình gia sư, phần riêng của gia sư (DT-27 phần 27d1, YCTD-254; tài liệu 32 mục 19.5, YCTD-270). 27d tách
// làm 27d1 (phần này) và 27d2 (tiến độ cho học sinh, giáo viên, phụ huynh, làm sau khi 28d gộp). Số 0200: sau dải của DT-28 vì cần
// course_spaces (0172), course_activities (0173); dải DT-27 chạy trước. 27d2 dùng 0201. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - khoá học ghi sẵn là một `course_spaces` loại `elective` của lõi LMS 28b, gắn với một chương trình gia sư 27b
//   (`tutoring_program_courses`, một chương trình một khoá); không dựng bảng khoá học thứ hai;
// - học sinh của khoá là học sinh có đơn được duyệt của chương trình (đồng bộ vào `course_enrollments` của 28b);
// - `tutoring_media_views`: mỗi lần lấy đường dẫn xem video bài học ghi một dòng (nhật ký xem; tiến độ đã xem là của 27d2, 28d).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('tutoring_program_courses')
      .addColumn('program_id', 'uuid', (column) =>
        column.primaryKey().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('course_space_id', 'uuid', (column) => column.notNull().unique().references('course_spaces.id'))
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('tutoring_media_views')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('activity_id', 'uuid', (column) =>
        column.notNull().references('course_activities.id').onDelete('cascade'),
      )
      .addColumn('viewer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('viewer_name', 'text', (column) => column.notNull())
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('viewed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('tutoring_media_views_activity_index')
      .on('tutoring_media_views')
      .columns(['activity_id', 'viewed_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_media_views').execute();
    await database.schema.dropTable('tutoring_program_courses').execute();
  },
};
