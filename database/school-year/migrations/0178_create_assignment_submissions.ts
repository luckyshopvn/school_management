import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): bài nộp và tệp của bài nộp. Mỗi lần nộp là một dòng (lần 1, 2...); bản nháp là dòng trạng thái
// `draft` của lần kế tiếp, lưu từng phần, có số `version` để khóa lạc quan (bài nhóm nhiều em cùng sửa một bản nháp).
// Bài cá nhân gắn `child_id`; bài nhóm gắn `group_id` (một bài nộp cho cả nhóm). Người nộp ghi rõ `student`, `guardian`
// (nộp thay ở 28f), `teacher` (giáo viên ghi hộ). Tệp lưu ở kho theo khóa `assignment-submissions/<bài nộp>/<mã>`; ảnh đã
// xóa siêu dữ liệu trên máy học sinh, máy chủ bỏ thêm khối EXIF của JPEG khi nhận
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('assignment_submissions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('group_id', 'uuid', (column) => column.references('child_groups.id'))
      .addColumn('attempt_no', 'smallint', (column) => column.notNull().check(sql`attempt_no between 1 and 5`))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'submitted', 'returned')`),
      )
      .addColumn('version', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('answers', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('late', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('submitted_by', 'uuid')
      .addColumn('submitted_by_kind', 'text', (column) =>
        column.check(sql`submitted_by_kind is null or submitted_by_kind in ('student', 'guardian', 'teacher')`),
      )
      .addColumn('submitted_at', 'timestamptz')
      // Điểm tự chấm phần trắc nghiệm, điểm từng câu tự luận giáo viên chấm, tổng (thang 10)
      .addColumn('auto_score', 'numeric(4, 2)')
      .addColumn('item_scores', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('criteria_scores', 'jsonb')
      .addColumn('score', 'numeric(4, 2)', (column) => column.check(sql`score is null or score between 0 and 10`))
      .addColumn('level', 'text', (column) =>
        column.check(sql`level is null or level in ('excellent', 'completed', 'not_completed')`),
      )
      .addColumn('feedback', 'text', (column) => column.check(sql`feedback is null or char_length(feedback) <= 4000`))
      .addColumn('feedback_ai_assisted', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('graded_by', 'uuid')
      .addColumn('graded_at', 'timestamptz')
      .addColumn('returned_by', 'uuid')
      .addColumn('returned_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('assignment_submissions_owner_check', sql`(child_id is null) <> (group_id is null)`)
      .execute();
    await sql`create unique index assignment_submissions_child_unique
      on assignment_submissions (assignment_id, child_id, attempt_no) where child_id is not null`.execute(database);
    await sql`create unique index assignment_submissions_group_unique
      on assignment_submissions (assignment_id, group_id, attempt_no) where group_id is not null`.execute(database);

    await database.schema
      .createTable('submission_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('submission_id', 'uuid', (column) =>
        column.notNull().references('assignment_submissions.id').onDelete('cascade'),
      )
      .addColumn('item_id', 'uuid', (column) => column.notNull().references('assignment_items.id').onDelete('cascade'))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('image', 'document', 'audio')`))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('uploaded_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('submission_files_submission_index')
      .on('submission_files')
      .column('submission_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('submission_files').execute();
    await database.schema.dropTable('assignment_submissions').execute();
  },
};
