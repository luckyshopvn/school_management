import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// QT-07 mục 7 (YCTD-344): phiếu dặn thuốc có trạng thái "Đã nhận thuốc" (`received`) riêng giữa "Phụ huynh gửi" và "Đang cho uống";
// ghi liều đầu tiên mới chuyển sang đang cho uống. Phiếu đang cho uống mà chưa có liều nào là phiếu vừa nhận theo cách cũ, chuyển về
// đã nhận thuốc. Số 0224 theo phiên bản 0.224.0, tránh dải 0202 trở đi các phần song song có thể dùng (kho mã bật
// allowUnorderedMigrations)
export const migration: Migration = {
  async up(database) {
    await sql`alter table medication_requests drop constraint medication_requests_status_check`.execute(database);
    await sql`alter table medication_requests add constraint medication_requests_status_check
      check (status in ('pending', 'received', 'administering', 'completed', 'rejected'))`.execute(database);
    await sql`update medication_requests set status = 'received'
      where status = 'administering'
        and not exists (select 1 from medication_administrations where request_id = medication_requests.id)`.execute(
      database,
    );
  },
  async down(database) {
    await sql`update medication_requests set status = 'administering' where status = 'received'`.execute(database);
    await sql`alter table medication_requests drop constraint medication_requests_status_check`.execute(database);
    await sql`alter table medication_requests add constraint medication_requests_status_check
      check (status in ('pending', 'administering', 'completed', 'rejected'))`.execute(database);
  },
};
