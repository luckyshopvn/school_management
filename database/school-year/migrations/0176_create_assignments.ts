import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): bài tập trực tuyến là loại hoạt động `assignment` của lõi 28b. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11 (tài liệu 47 mục 20.7):
// - Mỗi hoạt động loại bài tập có đúng một dòng `assignments` (cài đặt riêng của bài: ngữ cảnh, cách làm, nộp muộn, số lần
//   nộp, cách chấm); tên, hướng dẫn, hạn, điều kiện mở vẫn ở `course_activities` của lõi.
// - Phiên bản bài (phân hóa) và câu của bài ở bảng riêng; câu trắc nghiệm lưu **bản chụp** câu đã duyệt của 22g1 (sửa câu ở
//   ngân hàng không đổi bài đã giao), chấm ở máy chủ bằng hàm chấm của 22g2.
// - Thang tiêu chí 22h2 cũng lưu bản chụp khi chọn, để thang sửa sau không đổi điểm đã chấm.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('activity_id', 'uuid', (column) =>
        column.notNull().unique().references('course_activities.id').onDelete('cascade'),
      )
      .addColumn('context', 'text', (column) =>
        column
          .notNull()
          .defaultTo('in_class')
          .check(sql`context in ('in_class', 'homework')`),
      )
      .addColumn('work_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('individual')
          .check(sql`work_mode in ('individual', 'group')`),
      )
      .addColumn('group_set_id', 'uuid', (column) => column.references('group_sets.id'))
      .addColumn('late_policy', 'text', (column) =>
        column
          .notNull()
          .defaultTo('allow')
          .check(sql`late_policy in ('allow', 'block')`),
      )
      .addColumn('max_attempts', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`max_attempts between 1 and 5`),
      )
      .addColumn('grading', 'text', (column) =>
        column
          .notNull()
          .defaultTo('score')
          .check(sql`grading in ('score', 'rubric', 'level', 'completion', 'none')`),
      )
      .addColumn('rubric_id', 'uuid')
      .addColumn('rubric_snapshot', 'jsonb')
      .addColumn('show_results', 'text', (column) =>
        column
          .notNull()
          .defaultTo('after_return')
          .check(sql`show_results in ('after_submit', 'after_return')`),
      )
      .addColumn('estimated_minutes', 'smallint', (column) =>
        column.check(sql`estimated_minutes is null or estimated_minutes between 1 and 600`),
      )
      .addColumn('released_at', 'timestamptz')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('assignments_group_set_check', sql`(work_mode = 'group') = (group_set_id is not null)`)
      .addCheckConstraint('assignments_rubric_check', sql`grading <> 'rubric' or rubric_snapshot is not null`)
      .execute();

    await database.schema
      .createTable('assignment_variants')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`code ~ '^[A-Z]$'`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 120`))
      .addUniqueConstraint('assignment_variants_code_unique', ['assignment_id', 'code'])
      .execute();

    await database.schema
      .createTable('assignment_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      // Không gắn phiên bản là câu chung của mọi phiên bản
      .addColumn('variant_id', 'uuid', (column) => column.references('assignment_variants.id').onDelete('cascade'))
      .addColumn('position', 'smallint', (column) => column.notNull())
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('question', 'essay', 'upload', 'audio', 'resource')`),
      )
      .addColumn('question_id', 'uuid', (column) => column.references('questions.id'))
      .addColumn('snapshot', 'jsonb')
      .addColumn('prompt', 'text', (column) => column.check(sql`prompt is null or char_length(prompt) <= 5000`))
      .addColumn('score', 'numeric(4, 2)', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`score between 0 and 10`),
      )
      .addColumn('settings', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addCheckConstraint(
        'assignment_items_question_check',
        sql`(kind = 'question') = (question_id is not null and snapshot is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('assignment_items_assignment_index')
      .on('assignment_items')
      .columns(['assignment_id', 'position'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('assignment_items').execute();
    await database.schema.dropTable('assignment_variants').execute();
    await database.schema.dropTable('assignments').execute();
  },
};
