import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Điểm danh bằng thẻ ở cổng, lát L1 (YCTD-389): bảo vệ và quản lý đơn vị quét thẻ ghi lượt qua cổng; Ban Giám hiệu, quản lý đơn vị
// cấp, thu hồi thẻ QR
export const GATE_PASS_RECORD_PERMISSION = 'P04.gate-pass.record';
export const GATE_CARD_MANAGE_PERMISSION = 'P04.gate-card.manage';

const PERMISSIONS = [
  {
    code: GATE_PASS_RECORD_PERMISSION,
    moduleCode: 'P04',
    description: 'Quét thẻ học sinh ghi lượt vào, ra cổng trong đơn vị được gán',
    roleCodes: ['VT-18', 'VT-03', 'VT-02', 'VT-15'],
  },
  {
    code: GATE_CARD_MANAGE_PERMISSION,
    moduleCode: 'P04',
    description: 'Cấp, in, thu hồi thẻ QR điểm danh của học sinh trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
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
