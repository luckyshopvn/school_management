import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20d (YCTD-162): sổ đầu bài và điểm danh theo tiết, nguồn là thời khoá biểu đang áp dụng của 22c1. Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `class_logs`: một tiết đã dạy của lớp vào một ngày (tên bài, nội dung, nhận xét tiết, xếp loại tiết nếu trường dùng),
//   giáo viên dạy thực tế; giáo viên ký sổ thì tiết khoá với giáo viên. `timetable_lesson_id` trỏ về tiết của thời khoá biểu
//   (xoá bản nháp thì để trống, sổ giữ nguyên);
// - `period_attendance`: điểm danh từng học sinh trong tiết (có mặt, đi muộn, vắng có phép, vắng không phép);
// - `class_log_reviews`: Ban giám hiệu kiểm tra và ký sổ đầu bài của lớp theo tuần (tuần bắt đầu thứ Hai); tuần đã ký khoá
//   mọi tiết của tuần. Điểm danh theo ngày của Mầm non (`attendance_records`) không đổi.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('class_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('lesson_date', 'date', (column) => column.notNull())
      .addColumn('period_no', 'smallint', (column) => column.notNull().check(sql`period_no between 1 and 15`))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('timetable_lesson_id', 'uuid', (column) =>
        column.references('timetable_lessons.id').onDelete('set null'),
      )
      .addColumn('teacher_user_id', 'uuid', (column) => column.notNull())
      .addColumn('teacher_name', 'text', (column) => column.notNull())
      .addColumn('lesson_title', 'text', (column) =>
        column.notNull().check(sql`char_length(lesson_title) between 1 and 300`),
      )
      .addColumn('content', 'text', (column) => column.check(sql`char_length(content) <= 2000`))
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('rating', 'text', (column) => column.check(sql`rating in ('A', 'B', 'C', 'D')`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('signed_at', 'timestamptz')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('class_logs_status_check', sql`status in ('draft', 'signed')`)
      .addUniqueConstraint('class_logs_slot_unique', ['class_id', 'lesson_date', 'period_no'])
      .execute();
    await database.schema
      .createIndex('class_logs_teacher_index')
      .on('class_logs')
      .columns(['teacher_user_id', 'lesson_date'])
      .execute();

    await database.schema
      .createTable('period_attendance')
      .addColumn('class_log_id', 'uuid', (column) => column.notNull().references('class_logs.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 300`))
      .addPrimaryKeyConstraint('period_attendance_pkey', ['class_log_id', 'child_id'])
      .addCheckConstraint(
        'period_attendance_status_check',
        sql`status in ('present', 'late', 'absent_excused', 'absent_unexcused')`,
      )
      .execute();

    await database.schema
      .createTable('class_log_reviews')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('week_start', 'date', (column) => column.notNull())
      .addColumn('reviewer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('reviewer_name', 'text', (column) => column.notNull())
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('signed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('class_log_reviews_monday_check', sql`extract(isodow from week_start) = 1`)
      .addUniqueConstraint('class_log_reviews_week_unique', ['class_id', 'week_start'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('class_log_reviews').execute();
    await database.schema.dropTable('period_attendance').execute();
    await database.schema.dropTable('class_logs').execute();
  },
};
