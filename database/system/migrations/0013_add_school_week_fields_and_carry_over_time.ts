import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16e (khảo sát mục 3.3 dòng 3.4 và mục 3.5 dòng 5.7 của Sở):
// - `school_weeks.term_type`: học kỳ của tuần khi nhà trường chọn khác lịch (trống là theo lịch năm học);
//   `school_weeks.is_visible`: tuần có hiện ở các màn hình chọn tuần không. Tuần đệm, tên tuần đệm dùng lại cột `is_off`,
//   `note` để lịch năm học chỉ có một nguồn dữ liệu;
// - `academic_year_databases.carried_over_at`: giờ của máy chủ cơ sở dữ liệu khi chuyển xong hồ sơ lên năm học mới; "Hủy"
//   chuyển hồ sơ chỉ cho khi năm học mới chưa có dòng nào thêm hoặc sửa sau giờ này. Năm học mở trước khi có cột thì trống
//   và không hủy được
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('school_weeks')
      .addColumn('term_type', 'text', (column) =>
        column.check(sql`term_type in ('first_term', 'second_term', 'summer_term')`),
      )
      .addColumn('is_visible', 'boolean', (column) => column.notNull().defaultTo(true))
      .execute();
    await database.schema.alterTable('academic_year_databases').addColumn('carried_over_at', 'timestamptz').execute();
  },
  async down(database) {
    await database.schema.alterTable('academic_year_databases').dropColumn('carried_over_at').execute();
    await database.schema.alterTable('school_weeks').dropColumn('term_type').dropColumn('is_visible').execute();
  },
};
