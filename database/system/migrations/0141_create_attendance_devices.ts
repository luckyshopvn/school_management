import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thiết bị điểm danh của trường, lát L2 (YCTD-389): máy quét thẻ, đầu đọc RFID, máy chấm công khuôn mặt, trạm camera. Ở cơ sở dữ
// liệu hệ thống để dùng qua các năm học. Khóa thiết bị chỉ hiện một lần khi tạo hoặc đổi; ở đây chỉ lưu mã băm SHA-256 và bốn ký
// tự cuối để nhận biết
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('attendance_devices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull())
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('qr_scanner', 'rfid_reader', 'face_terminal', 'camera_station')`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 120`))
      .addColumn('location_name', 'text')
      .addColumn('direction', 'text', (column) => column.notNull().check(sql`direction in ('in', 'out', 'both')`))
      .addColumn('key_hash', 'text', (column) => column.notNull().unique())
      .addColumn('key_hint', 'text', (column) => column.notNull())
      .addColumn('last_seen_at', 'timestamptz')
      .addColumn('disabled_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('attendance_devices').execute();
  },
};
