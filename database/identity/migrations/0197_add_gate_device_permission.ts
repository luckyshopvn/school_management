import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thiết bị điểm danh, lát L2 (YCTD-389): Ban Giám hiệu, quản lý đơn vị khai báo thiết bị, cấp và đổi khóa thiết bị, nhập tệp máy
// chấm công
export const GATE_DEVICE_MANAGE_PERMISSION = 'P04.gate-device.manage';

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${GATE_DEVICE_MANAGE_PERMISSION}, 'P04', 'Khai báo thiết bị điểm danh, cấp khóa thiết bị, nhập tệp máy chấm công trong phạm vi đơn vị')`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-02', 'VT-15', 'VT-03') and permissions.code = ${GATE_DEVICE_MANAGE_PERMISSION}`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${GATE_DEVICE_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${GATE_DEVICE_MANAGE_PERMISSION}`.execute(database);
  },
};
