import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 22g2 (YCTD-173): chấm bài kiểm tra. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `exam_sessions`: bài kiểm tra của một lớp dùng một đề đã khoá (22g1): học kỳ, loại điểm của sổ điểm 21c (thường xuyên kèm
//   lần, giữa kỳ, cuối kỳ), cách chấm câu đúng sai, chấm hai người và ngưỡng lệch, cách xử lý học sinh vắng; trạng thái đang
//   chấm, đã khoá, đã chuyển vào sổ điểm;
// - `exam_sheets`: bài làm của từng học sinh: mã đề, câu trả lời theo số câu của mã, điểm tự luận theo câu (người chấm thứ
//   nhất, thứ hai), vắng; điểm trắc nghiệm, tự luận, tổng (lưu khi ghi để báo cáo đọc nhanh), cần xem lại; nguồn nhập tay hay
//   tệp quét;
// - `question_usages` thêm số bài, độ khó, độ phân biệt: ghi khi khoá bài kiểm tra (gộp mọi bài đã khoá của đề).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('exam_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('exam_id', 'uuid', (column) => column.notNull().references('exams.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('score_kind', 'text', (column) =>
        column.notNull().check(sql`score_kind in ('regular', 'mid', 'final')`),
      )
      .addColumn('score_seq', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`score_seq between 1 and 20`),
      )
      .addColumn('true_false_rule', 'text', (column) =>
        column
          .notNull()
          .defaultTo('tiered')
          .check(sql`true_false_rule in ('tiered', 'proportional')`),
      )
      .addColumn('double_marking', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('mark_tolerance', 'numeric', (column) => column.notNull().defaultTo(1))
      .addColumn('absent_policy', 'text', (column) =>
        column
          .notNull()
          .defaultTo('skip')
          .check(sql`absent_policy in ('skip', 'zero')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('grading')
          .check(sql`status in ('grading', 'locked', 'transferred')`),
      )
      .addColumn('locked_at', 'timestamptz')
      .addColumn('locked_by_name', 'text')
      .addColumn('transferred_at', 'timestamptz')
      .addColumn('transferred_by_name', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('exam_sessions_unique', ['exam_id', 'class_id'])
      .execute();

    await database.schema
      .createTable('exam_sheets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('exam_sessions.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('variant_code', 'text')
      .addColumn('absent', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('answers', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('essay', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('objective_score', 'numeric')
      .addColumn('essay_score', 'numeric')
      .addColumn('total_score', 'numeric')
      .addColumn('results', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('needs_review', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('source', 'text', (column) =>
        column
          .notNull()
          .defaultTo('manual')
          .check(sql`source in ('manual', 'import')`),
      )
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('exam_sheets_unique', ['session_id', 'child_id'])
      .execute();

    await database.schema
      .alterTable('question_usages')
      .addColumn('attempts', 'integer')
      .addColumn('difficulty', 'numeric')
      .addColumn('discrimination', 'numeric')
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('question_usages')
      .dropColumn('attempts')
      .dropColumn('difficulty')
      .dropColumn('discrimination')
      .execute();
    await database.schema.dropTable('exam_sheets').execute();
    await database.schema.dropTable('exam_sessions').execute();
  },
};
