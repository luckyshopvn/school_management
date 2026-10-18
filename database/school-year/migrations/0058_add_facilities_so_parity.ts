import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cơ sở vật chất đủ theo hệ thống của Sở (DT-16 phần 16i, YCTD-128):
// - `facility_investments`: 6.1 Thực trạng và nhu cầu đầu tư phòng học, nhà công vụ của toàn trường (gắn với Trường chính),
//   mỗi chỉ tiêu một dòng: số phòng kiên cố, bán kiên cố, cấp 4 xuống cấp, nhờ mượn; nhu cầu số lớp, số phòng, kinh phí
//   (triệu đồng);
// - `facility_standard_levels`: mức độ đạt chuẩn cơ sở vật chất theo từng khối phòng của 1.2 Báo cáo cơ sở vật chất (chưa
//   đạt, mức độ 1, mức độ 2), do Hiệu trưởng đánh giá; mức của trường là mức thấp nhất của các khối;
// - `facility_import_jobs`: lần nhập phòng (1.1) và danh mục thiết bị dạy học (2.1, 2.2) từ Excel; bảng riêng của phân hệ để
//   không đổi ràng buộc loại nhập của bảng lần nhập chung.
// Dữ liệu nhà vệ sinh lưu ở thuộc tính theo quy chuẩn của phòng (jsonb của bảng rooms), không cần cột mới
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('facility_investments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('category', 'text', (column) => column.notNull())
      .addColumn('permanent', 'integer')
      .addColumn('semi_permanent', 'integer')
      .addColumn('degraded_level4', 'integer')
      .addColumn('borrowed', 'integer')
      .addColumn('need_classes', 'integer')
      .addColumn('need_rooms', 'integer')
      .addColumn('need_budget_million', 'numeric(14, 2)')
      .addColumn('note', 'text')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('facility_investments_unique', ['org_unit_id', 'category'])
      .addCheckConstraint('facility_investments_category_check', sql`category in ('classroom', 'teacher_housing')`)
      .addCheckConstraint(
        'facility_investments_counts_check',
        sql`coalesce(permanent, 0) >= 0 and coalesce(semi_permanent, 0) >= 0 and coalesce(degraded_level4, 0) >= 0
          and coalesce(borrowed, 0) >= 0 and coalesce(need_classes, 0) >= 0 and coalesce(need_rooms, 0) >= 0
          and coalesce(need_budget_million, 0) >= 0`,
      )
      .execute();

    await database.schema
      .createTable('facility_standard_levels')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('room_block', 'text', (column) => column.notNull())
      .addColumn('level', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('facility_standard_levels_unique', ['org_unit_id', 'room_block'])
      .addCheckConstraint(
        'facility_standard_levels_block_check',
        sql`room_block in ('care_education', 'meal', 'support', 'administration', 'other')`,
      )
      .addCheckConstraint('facility_standard_levels_level_check', sql`level in ('not_met', 'level_1', 'level_2')`)
      .execute();

    await database.schema
      .createTable('facility_import_jobs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('import_type', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('total_rows', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('error_rows', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('errors', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('payload', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('committed_at', 'timestamptz')
      .addCheckConstraint('facility_import_jobs_type_check', sql`import_type in ('rooms', 'equipment_items')`)
      .addCheckConstraint('facility_import_jobs_status_check', sql`status in ('validated', 'failed', 'committed')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('facility_import_jobs').execute();
    await database.schema.dropTable('facility_standard_levels').execute();
    await database.schema.dropTable('facility_investments').execute();
  },
};
