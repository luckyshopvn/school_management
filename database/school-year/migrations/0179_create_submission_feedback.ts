import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): trao đổi trên bài, đánh giá đóng góp của bài nhóm, ngân hàng nhận xét của giáo viên.
// - `submission_comments`: giáo viên và học sinh (hoặc phụ huynh) trao đổi trên một bài nộp; chỉ người của bài đó thấy.
// - `submission_contributions`: mỗi em trong nhóm tự đánh giá và đánh giá ngắn các bạn (chỉ giáo viên xem); giáo viên điều
//   chỉnh điểm cá nhân có lý do.
// - `assignment_comment_bank`: câu nhận xét riêng của giáo viên, dùng cùng thư viện câu nhận xét của trường (20c)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('submission_comments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('submission_id', 'uuid', (column) =>
        column.notNull().references('assignment_submissions.id').onDelete('cascade'),
      )
      .addColumn('author_user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('author_kind', 'text', (column) =>
        column.notNull().check(sql`author_kind in ('teacher', 'student', 'guardian')`),
      )
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 2000`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('submission_comments_submission_index')
      .on('submission_comments')
      .columns(['submission_id', 'created_at'])
      .execute();

    await database.schema
      .createTable('submission_contributions')
      .addColumn('submission_id', 'uuid', (column) =>
        column.notNull().references('assignment_submissions.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('self_rating', 'smallint', (column) =>
        column.check(sql`self_rating is null or self_rating between 1 and 5`),
      )
      .addColumn('self_note', 'text', (column) => column.check(sql`self_note is null or char_length(self_note) <= 500`))
      // { "<mã học sinh>": 1..5 } đánh giá các bạn cùng nhóm
      .addColumn('peer_ratings', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('adjusted_score', 'numeric(4, 2)', (column) =>
        column.check(sql`adjusted_score is null or adjusted_score between 0 and 10`),
      )
      .addColumn('adjust_reason', 'text', (column) =>
        column.check(sql`adjust_reason is null or char_length(adjust_reason) <= 500`),
      )
      .addColumn('adjusted_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('submission_contributions_pkey', ['submission_id', 'child_id'])
      .addCheckConstraint(
        'submission_contributions_reason_check',
        sql`adjusted_score is null or adjust_reason is not null`,
      )
      .execute();

    await database.schema
      .createTable('assignment_comment_bank')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('owner_user_id', 'uuid', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 500`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('assignment_comment_bank_owner_index')
      .on('assignment_comment_bank')
      .column('owner_user_id')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('assignment_comment_bank').execute();
    await database.schema.dropTable('submission_contributions').execute();
    await database.schema.dropTable('submission_comments').execute();
  },
};
