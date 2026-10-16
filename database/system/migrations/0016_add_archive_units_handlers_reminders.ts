import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Văn thư lưu trữ, sửa các hạn chế của YCTD-118 (DT-15 phần 15h2, YCTD-120):
// - phông và hồ sơ thuộc một đơn vị (`org_unit_id`, trống là toàn trường) để lọc theo phạm vi đơn vị của người dùng;
// - người giải quyết chọn từ danh sách nhân sự (`handler_staff_id`, mã nhân sự ở năm học đang dùng, khác cơ sở dữ liệu nên
//   không có khóa ngoại; tên vẫn ghi ở `handler_name`);
// - nhắc hạn: thời điểm đã gửi nhắc sắp đến hạn và nhắc quá hạn, mỗi loại một lần, đổi thời hạn hoặc người giải quyết thì
//   nhắc lại;
// - tệp chờ xóa ở kho tệp: lần xóa lỗi được ghi lại để tiến trình chạy nền thử lại, không để tệp mồ côi.
// Số 0010 đến 0015 giữ cho DT-16; công cụ chạy tệp thay đổi cấu trúc cho chạy lệch thứ tự (YCTD-120)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('archive_fonds').addColumn('org_unit_id', 'uuid').execute();
    await database.schema
      .alterTable('archive_records')
      .addColumn('org_unit_id', 'uuid')
      .addColumn('handler_staff_id', 'uuid')
      .addColumn('due_reminded_at', 'timestamptz')
      .addColumn('overdue_reminded_at', 'timestamptz')
      .execute();
    await database.schema.createIndex('archive_fonds_unit_index').on('archive_fonds').column('org_unit_id').execute();
    await database.schema
      .createIndex('archive_records_unit_index')
      .on('archive_records')
      .column('org_unit_id')
      .execute();
    await database.schema
      .createTable('archive_file_deletions')
      .addColumn('storage_key', 'text', (column) => column.primaryKey())
      .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('last_error', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_attempt_at', 'timestamptz')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('archive_file_deletions').execute();
    await database.schema.dropIndex('archive_records_unit_index').execute();
    await database.schema.dropIndex('archive_fonds_unit_index').execute();
    await database.schema
      .alterTable('archive_records')
      .dropColumn('overdue_reminded_at')
      .dropColumn('due_reminded_at')
      .dropColumn('handler_staff_id')
      .dropColumn('org_unit_id')
      .execute();
    await database.schema.alterTable('archive_fonds').dropColumn('org_unit_id').execute();
  },
};
