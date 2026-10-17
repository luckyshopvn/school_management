import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16e (khảo sát mục 3.1 dòng 1.7, 1.8 của Sở):
// - `accreditation_reviews`: 1.7 Rà soát thông tin kiểm định chất lượng giáo dục, một bản mỗi năm học gắn với Trường chính.
//   "Lấy dữ liệu" tính số lớp, phòng, diện tích, số học sinh từ dữ liệu sẵn có; người dùng sửa được rồi "Ghi";
// - `school_split_requests`, `school_split_items`: 1.8 Tách trường bản chạy nội bộ (quyết định của Eric ngày 2026-10-16).
//   Yêu cầu tách ghi trường đến, lý do, danh sách học sinh, nhân sự; trạng thái xác nhận đi và đã tiếp nhận do người dùng
//   đánh dấu, hệ thống không truyền dữ liệu sang trường khác. Hồ sơ gửi đi là tệp theo mẫu CSDL ngành của Bộ
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('accreditation_reviews')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().unique().references('org_units.id'))
      .addColumn('class_count', 'integer', (column) => column.check(sql`class_count >= 0`))
      .addColumn('classroom_count', 'integer', (column) => column.check(sql`classroom_count >= 0`))
      .addColumn('subject_room_count', 'integer', (column) => column.check(sql`subject_room_count >= 0`))
      .addColumn('land_area_m2', 'numeric(12, 2)', (column) => column.check(sql`land_area_m2 >= 0`))
      .addColumn('floor_area_m2', 'numeric(12, 2)', (column) => column.check(sql`floor_area_m2 >= 0`))
      .addColumn('child_count', 'integer', (column) => column.check(sql`child_count >= 0`))
      .addColumn('area_per_child_m2', 'numeric(12, 2)', (column) => column.check(sql`area_per_child_m2 >= 0`))
      .addColumn('note', 'text')
      .addColumn('collected_at', 'timestamptz')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_split_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('destination_school', 'text', (column) => column.notNull())
      .addColumn('destination_code', 'text')
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column.notNull().defaultTo('draft').check(sql`status in ('draft', 'confirmed', 'received')`),
      )
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('confirmed_by', 'uuid')
      .addColumn('received_at', 'timestamptz')
      .addColumn('received_by', 'uuid')
      .addColumn('received_note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('school_split_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('request_id', 'uuid', (column) =>
        column.notNull().references('school_split_requests.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('school_split_items_child_unique', ['request_id', 'child_id'])
      .addUniqueConstraint('school_split_items_staff_unique', ['request_id', 'staff_id'])
      .addCheckConstraint('school_split_items_subject_check', sql`(child_id is null) <> (staff_id is null)`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('school_split_items').execute();
    await database.schema.dropTable('school_split_requests').execute();
    await database.schema.dropTable('accreditation_reviews').execute();
  },
};
