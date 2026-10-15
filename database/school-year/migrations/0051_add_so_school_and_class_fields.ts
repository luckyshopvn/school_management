import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trường học, lớp học theo hệ thống của Sở (DT-15 phần 15b, YCTD-111):
// - `org_units.distance_km`, `org_units.area_m2`: khoảng cách đến cơ sở chính và diện tích của phân hiệu, điểm trường (mục
//   1.2, 1.3 của Sở); địa chỉ, điện thoại đã có;
// - `classes`: nhóm tuổi (trống là theo bậc học), thứ tự, học 2 buổi/ngày, lớp mẫu giáo ghép 2 hoặc 3 độ tuổi, lớp ghép,
//   ghép vào lớp, lớp bán trú (mục 2.1 của Sở). Lớp giải thể là lớp đã đóng (`status = 'closed'`), không thêm cột. Ghép vào
//   lớp không đặt khóa ngoại để chép sang năm học mới không phụ thuộc thứ tự chép; máy chủ kiểm tra khi ghi
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('org_units')
      .addColumn('distance_km', 'numeric(8, 2)', (column) => column.check(sql`distance_km >= 0`))
      .addColumn('area_m2', 'numeric(12, 2)', (column) => column.check(sql`area_m2 >= 0`))
      .execute();
    await database.schema
      .alterTable('classes')
      .addColumn('age_group', 'text', (column) =>
        column.check(
          sql`age_group in ('months_3_12', 'months_13_24', 'months_25_36', 'years_3_4', 'years_4_5', 'years_5_6')`,
        ),
      )
      .addColumn('sort_order', 'integer', (column) => column.check(sql`sort_order >= 0`))
      .addColumn('two_sessions_per_day', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('mixed_age_count', 'smallint', (column) => column.check(sql`mixed_age_count in (2, 3)`))
      .addColumn('is_combined', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('combined_into_class_id', 'uuid')
      .addColumn('boarding', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await sql`alter table classes add constraint classes_combined_check
      check (combined_into_class_id is null or (is_combined and combined_into_class_id <> id))`.execute(database);
  },
  async down(database) {
    await database.schema
      .alterTable('classes')
      .dropColumn('combined_into_class_id')
      .dropColumn('age_group')
      .dropColumn('sort_order')
      .dropColumn('two_sessions_per_day')
      .dropColumn('mixed_age_count')
      .dropColumn('is_combined')
      .dropColumn('boarding')
      .execute();
    await database.schema.alterTable('org_units').dropColumn('distance_km').dropColumn('area_m2').execute();
  },
};
