import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lượt qua cổng từ thiết bị, lát L2 (YCTD-389): lượt ghi mã thiết bị gửi (thiết bị ở cơ sở dữ liệu hệ thống nên không có khóa ngoại);
// chấm công cán bộ thêm nguồn `device` (máy chấm công gửi hoặc nhập tệp)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('gate_passes').addColumn('device_id', 'uuid').execute();
    await sql`alter table attendance_logs drop constraint attendance_logs_source_check`.execute(database);
    await sql`alter table attendance_logs add constraint attendance_logs_source_check
      check (source in ('self', 'manual', 'device'))`.execute(database);
  },
  async down(database) {
    await sql`delete from attendance_logs where source = 'device'`.execute(database);
    await sql`alter table attendance_logs drop constraint attendance_logs_source_check`.execute(database);
    await sql`alter table attendance_logs add constraint attendance_logs_source_check
      check (source in ('self', 'manual'))`.execute(database);
    await database.schema.alterTable('gate_passes').dropColumn('device_id').execute();
  },
};
