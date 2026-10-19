import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// 1.7 Rà soát thông tin phục vụ kiểm định CLGD đủ ô như Sở (DT-17 phần 17e, YCTD-136; khảo sát mục 10.5, chênh lệch R1–R5):
// tên trường, mã trường, loại hình, cấp học; năm, ngày công nhận và mức độ chuẩn quốc gia; năm, ngày công nhận và cấp độ
// kiểm định CLGD; thời điểm đăng ký chuẩn quốc gia; diện tích sàn xây dựng trên học sinh. Bản rà soát đã ghi trước đây giữ
// nguyên, các ô mới để trống đến lần ghi sau
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('accreditation_reviews')
      .addColumn('school_name', 'text', (column) => column.check(sql`char_length(school_name) <= 200`))
      .addColumn('school_code', 'text', (column) => column.check(sql`char_length(school_code) <= 20`))
      .addColumn('ownership_type', 'text', (column) =>
        column.check(sql`ownership_type in ('public', 'private', 'people_founded')`),
      )
      .addColumn('education_level', 'text')
      .addColumn('national_standard_year', 'integer', (column) =>
        column.check(sql`national_standard_year between 1900 and 2100`),
      )
      .addColumn('national_standard_date', 'date')
      .addColumn('national_standard_level', 'text', (column) =>
        column.check(sql`national_standard_level in ('1', '2')`),
      )
      .addColumn('accreditation_year', 'integer', (column) =>
        column.check(sql`accreditation_year between 1900 and 2100`),
      )
      .addColumn('accreditation_date', 'date')
      .addColumn('accreditation_level', 'text', (column) =>
        column.check(sql`accreditation_level in ('1', '2', '3', '4')`),
      )
      .addColumn('national_standard_registration', 'text')
      .addColumn('floor_area_per_child_m2', 'numeric(12, 2)', (column) =>
        column.check(sql`floor_area_per_child_m2 >= 0`),
      )
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('accreditation_reviews')
      .dropColumn('school_name')
      .dropColumn('school_code')
      .dropColumn('ownership_type')
      .dropColumn('education_level')
      .dropColumn('national_standard_year')
      .dropColumn('national_standard_date')
      .dropColumn('national_standard_level')
      .dropColumn('accreditation_year')
      .dropColumn('accreditation_date')
      .dropColumn('accreditation_level')
      .dropColumn('national_standard_registration')
      .dropColumn('floor_area_per_child_m2')
      .execute();
  },
};
