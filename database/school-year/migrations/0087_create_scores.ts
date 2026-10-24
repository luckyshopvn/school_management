import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21c (YCTD-170): sổ điểm THCS, THPT theo Thông tư 22/2021/TT-BGDĐT. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - `score_configs`: cấu hình theo cấp (hệ số, số lần đánh giá thường xuyên, ngưỡng xếp loại) dạng JSON; chưa có dòng thì
//   dùng bộ mặc định của gói dùng chung;
// - `score_entries`: từng điểm của học sinh, môn, học kỳ (thường xuyên theo thứ tự, giữa kỳ, cuối kỳ), ghi nguồn
//   (`manual`, `import`, `exam`: điểm kiểm tra tập trung chuyển từ 22g2); điểm trung bình tính khi đọc, không lưu;
// - `subject_term_results`: kết quả Đạt, Chưa đạt của môn đánh giá bằng nhận xét và nhận xét của giáo viên môn;
// - `term_ratings`: xếp loại học tập (gợi ý của máy, kết quả giáo viên chủ nhiệm xác nhận), rèn luyện theo học kỳ và cả năm;
// - `score_locks`: khoá điểm theo học kỳ và lớp. Học bạ (21e), 22g2, báo cáo (21g) đọc các bảng này
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('score_configs')
      .addColumn('school_level', 'text', (column) => column.primaryKey().check(sql`school_level in ('THCS', 'THPT')`))
      .addColumn('config', 'jsonb', (column) => column.notNull())
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('score_entries')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('regular', 'mid', 'final')`))
      .addColumn('seq', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`seq between 1 and 20`),
      )
      .addColumn('score', 'numeric(3, 1)', (column) => column.notNull().check(sql`score between 0 and 10`))
      .addColumn('source', 'text', (column) =>
        column
          .notNull()
          .defaultTo('manual')
          .check(sql`source in ('manual', 'import', 'exam')`),
      )
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('score_entries_unique', ['child_id', 'subject_id', 'term_type', 'kind', 'seq'])
      .execute();
    await database.schema
      .createIndex('score_entries_class_index')
      .on('score_entries')
      .columns(['class_id', 'subject_id', 'term_type'])
      .execute();

    await database.schema
      .createTable('subject_term_results')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('result', 'text', (column) => column.check(sql`result is null or result in ('pass', 'fail')`))
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('subject_term_results_unique', ['child_id', 'subject_id', 'term_type'])
      .execute();

    await database.schema
      .createTable('term_ratings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term', 'year')`),
      )
      .addColumn('learning_suggested', 'text', (column) =>
        column.check(sql`learning_suggested is null or learning_suggested in ('good', 'fair', 'pass', 'fail')`),
      )
      .addColumn('learning', 'text', (column) =>
        column.check(sql`learning is null or learning in ('good', 'fair', 'pass', 'fail')`),
      )
      .addColumn('conduct', 'text', (column) =>
        column.check(sql`conduct is null or conduct in ('good', 'fair', 'pass', 'fail')`),
      )
      .addColumn('comment', 'text', (column) => column.check(sql`char_length(comment) <= 1000`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('term_ratings_unique', ['class_id', 'child_id', 'term_type'])
      .execute();

    await database.schema
      .createTable('score_locks')
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('locked_by', 'uuid', (column) => column.notNull())
      .addColumn('locked_by_name', 'text', (column) => column.notNull())
      .addColumn('locked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('score_locks_pkey', ['class_id', 'term_type'])
      .execute();
  },
  async down(database) {
    for (const table of ['score_locks', 'term_ratings', 'subject_term_results', 'score_entries', 'score_configs']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
