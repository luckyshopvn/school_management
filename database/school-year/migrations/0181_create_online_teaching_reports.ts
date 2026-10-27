import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28d (YCTD-274), Thông tư 09/2021/TT-BGDĐT Điều 15 khoản 6, Điều 8 khoản 1:
// - `online_teaching_term_reports`: báo cáo tổng kết dạy học trực tuyến theo học kỳ; số liệu máy tự tổng hợp lúc xem, xuất; phần
//   đánh giá, khó khăn, nguyên nhân, kiến nghị do Ban Giám hiệu nhập (một báo cáo mỗi học kỳ của năm học).
// - `activity_score_transfers`: nhật ký mỗi lần giáo viên đưa kết quả hoạt động vào sổ điểm hoặc sổ nhận xét (hoạt động, cách gộp,
//   học kỳ, lần đánh giá, số học sinh đã ghi), để tra lại điểm nào đến từ hoạt động nào
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('online_teaching_term_reports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('term_type', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('evaluation', 'text', (column) =>
        column.check(sql`evaluation is null or char_length(evaluation) <= 4000`),
      )
      .addColumn('difficulties', 'text', (column) =>
        column.check(sql`difficulties is null or char_length(difficulties) <= 4000`),
      )
      .addColumn('causes', 'text', (column) => column.check(sql`causes is null or char_length(causes) <= 4000`))
      .addColumn('recommendations', 'text', (column) =>
        column.check(sql`recommendations is null or char_length(recommendations) <= 4000`),
      )
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('activity_score_transfers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('target', 'text', (column) => column.notNull().check(sql`target in ('score_book', 'comment_book')`))
      .addColumn('activity_ids', 'jsonb', (column) => column.notNull())
      .addColumn('method', 'text', (column) => column.notNull().check(sql`method in ('single', 'weighted')`))
      .addColumn('term_type', 'text', (column) =>
        column.notNull().check(sql`term_type in ('first_term', 'second_term')`),
      )
      .addColumn('seq', 'smallint', (column) => column.check(sql`seq is null or seq between 1 and 20`))
      .addColumn('written', 'integer', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('activity_score_transfers_space_index')
      .on('activity_score_transfers')
      .columns(['space_id', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('activity_score_transfers').execute();
    await database.schema.dropTable('online_teaching_term_reports').execute();
  },
};
