import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khai báo người được ủy quyền đón trẻ phía nhà trường và bảo vệ xác nhận người đón tại cổng (P02-04, P04-03, YCTD-48)
export const AUTHORIZED_PICKUP_MANAGE_PERMISSION = 'P02.authorized-pickup.manage';
export const PICKUP_GATE_CONFIRM_PERMISSION = 'P04.pickup.gate-confirm';

const PERMISSIONS = [
  {
    code: AUTHORIZED_PICKUP_MANAGE_PERMISSION,
    moduleCode: 'P02',
    description: 'Khai báo và hủy người được ủy quyền đón trẻ trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
  },
  {
    code: PICKUP_GATE_CONFIRM_PERMISSION,
    moduleCode: 'P04',
    description: 'Xem danh sách người đón và xác nhận người đón tại cổng trong đơn vị được gán',
    roleCodes: ['VT-18'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.moduleCode}, ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roleCodes)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    for (const permission of PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${permission.code})`.execute(
        database,
      );
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
