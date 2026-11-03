import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bộ tiêu chí nhiều loại (YCTD-396 lát L3, Q-396-15 phương án A): bộ vẫn ở cơ sở dữ liệu năm học, thêm loại bộ, đối tượng được
// đánh giá (nhà trường hoặc cá nhân), mẫu mã minh chứng, chu kỳ đánh giá (số năm học) và phiên bản của bộ mẫu đã nạp. Bộ đang
// có là bộ kiểm định của nhà trường, chu kỳ 5 năm, mẫu mã H{hop}-{tieu_chi}-{stt}
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('quality_frameworks')
      .addColumn('kind', 'text', (column) =>
        column
          .notNull()
          .defaultTo('accreditation')
          .check(
            sql`kind in ('accreditation', 'teacher_standard', 'principal_standard', 'emulation', 'safe_school', 'school_year_plan', 'other')`,
          ),
      )
      .addColumn('subject', 'text', (column) =>
        column
          .notNull()
          .defaultTo('school')
          .check(sql`subject in ('school', 'person')`),
      )
      .addColumn('code_pattern', 'text', (column) =>
        column
          .notNull()
          .defaultTo('H{hop}-{tieu_chi}-{stt}')
          .check(sql`char_length(code_pattern) between 5 and 40 and code_pattern like '%{stt}%'`),
      )
      .addColumn('cycle_years', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(5)
          .check(sql`cycle_years between 1 and 10`),
      )
      .addColumn('template_version', 'text', (column) => column.check(sql`char_length(template_version) <= 50`))
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('quality_frameworks')
      .dropColumn('kind')
      .dropColumn('subject')
      .dropColumn('code_pattern')
      .dropColumn('cycle_years')
      .dropColumn('template_version')
      .execute();
  },
};
