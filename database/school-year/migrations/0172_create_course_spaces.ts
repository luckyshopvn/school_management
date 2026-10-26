import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): lớp học trực tuyến của lõi hệ thống quản lý học tập. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `course_spaces` loại `class_subject` là một cặp lớp, môn, tự sinh từ phân công giảng dạy (`class_staff_assignments` có
//   môn) hoặc, khi chưa phân công, từ thời khoá biểu đang áp dụng; mỗi cặp lớp, môn một dòng. Loại `elective` là khoá tự chọn
//   (câu lạc bộ, bồi dưỡng, trải nghiệm) do trường tạo, học sinh ghi danh.
// - Học sinh của lớp học trực tuyến theo lớp suy ra từ danh sách lớp hiện tại, không chép; khoá tự chọn có `course_enrollments`.
// - Lớp tự sinh ẩn với học sinh đến khi giáo viên mở (GD-154); trường xóa được lớp chưa có nội dung, lớp có nội dung chỉ lưu trữ.
// - Giáo viên của lớp ở `course_space_teachers` kèm nguồn (phân công, thời khoá biểu, thêm tay) để đồng bộ lại khi đổi phân công.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('course_spaces')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('class_subject', 'elective')`))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('TH', 'THCS', 'THPT')`),
      )
      .addColumn('grade_level', 'text')
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 2000`))
      .addColumn('visible_to_students', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'archived')`),
      )
      .addColumn('enrollment_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('teacher')
          .check(sql`enrollment_mode in ('teacher', 'request')`),
      )
      .addColumn('capacity', 'integer', (column) => column.check(sql`capacity is null or capacity between 1 and 2000`))
      .addColumn('source_template_id', 'uuid')
      .addColumn('source_template_version', 'integer')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'course_spaces_kind_target_check',
        sql`(kind = 'class_subject' and class_id is not null and subject_id is not null) or kind = 'elective'`,
      )
      .execute();
    await sql`create unique index course_spaces_class_subject_unique on course_spaces (class_id, subject_id)
      where kind = 'class_subject'`.execute(database);

    await database.schema
      .createTable('course_space_teachers')
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('source', 'text', (column) =>
        column.notNull().check(sql`source in ('assignment', 'timetable', 'manual')`),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('course_space_teachers_pkey', ['space_id', 'user_id'])
      .execute();
    await database.schema
      .createIndex('course_space_teachers_user_index')
      .on('course_space_teachers')
      .column('user_id')
      .execute();

    await database.schema
      .createTable('course_enrollments')
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('requested', 'active', 'removed')`),
      )
      .addColumn('requested_by', 'uuid')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('course_enrollments_pkey', ['space_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('course_enrollments').execute();
    await database.schema.dropTable('course_space_teachers').execute();
    await database.schema.dropTable('course_spaces').execute();
  },
};
