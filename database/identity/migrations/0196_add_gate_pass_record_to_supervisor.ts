import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giám thị và rèn luyện từng học sinh, lát L2 (YCTD-391): vai VT-22 "Giám thị, nề nếp" được ghi lượt qua cổng bằng điện thoại
// (quét thẻ QR của học sinh), dùng quyền `P04.gate-pass.record` của điểm danh bằng thiết bị (YCTD-389, tệp định danh 0195).
// Chèn theo mã quyền nên chỉ có tác dụng khi quyền đã có; tệp này chạy sau 0195 theo thứ tự tên
const PERMISSION_CODE = 'P04.gate-pass.record';
const ROLE_CODE = 'VT-22';

export const migration: Migration = {
  async up(database) {
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = ${ROLE_CODE} and permissions.code = ${PERMISSION_CODE}
      on conflict do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions
      where role_id in (select id from roles where code = ${ROLE_CODE})
        and permission_id in (select id from permissions where code = ${PERMISSION_CODE})`.execute(database);
  },
};
