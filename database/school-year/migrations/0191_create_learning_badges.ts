import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28i (YCTD-279): huy hiệu nội bộ của học tập trực tuyến (tắt mặc định, GD-155). Huy hiệu tự động theo tiêu chí có sẵn
// (hoàn thành chương, hoàn thành khoá, nộp bài đúng hạn nhiều lần liên tiếp) hoặc giáo viên trao kèm lý do. Chỉ học sinh đó, phụ
// huynh, giáo viên của lớp học trực tuyến thấy; không có bảng xếp hạng, không so sánh giữa học sinh. Huy hiệu tự động mỗi tiêu chí
// chỉ một lần (chỉ mục duy nhất), thu hồi thì giữ dòng
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('learning_badges')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('section_complete', 'course_complete', 'on_time_streak', 'teacher_award')`),
      )
      .addColumn('section_id', 'uuid', (column) => column.references('course_sections.id').onDelete('set null'))
      // Khóa của tiêu chí tự động (chương, khoá, chuỗi); trống với huy hiệu giáo viên trao
      .addColumn('criterion_key', 'text')
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 120`))
      .addColumn('reason', 'text', (column) => column.check(sql`reason is null or char_length(reason) <= 500`))
      .addColumn('awarded_by', 'uuid')
      .addColumn('awarded_by_name', 'text')
      .addColumn('awarded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by', 'uuid')
      .addColumn('revoke_reason', 'text', (column) =>
        column.check(sql`revoke_reason is null or char_length(revoke_reason) <= 500`),
      )
      .addCheckConstraint(
        'learning_badges_award_check',
        sql`(kind = 'teacher_award') = (criterion_key is null) and (kind <> 'teacher_award' or reason is not null)`,
      )
      .execute();
    await sql`create unique index learning_badges_criterion_unique
      on learning_badges (child_id, space_id, criterion_key) where criterion_key is not null`.execute(database);
    await database.schema
      .createIndex('learning_badges_child_index')
      .on('learning_badges')
      .columns(['child_id', 'awarded_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('learning_badges').execute();
  },
};
