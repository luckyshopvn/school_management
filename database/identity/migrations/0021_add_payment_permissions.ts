import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lập, trình và duyệt phiếu chi theo hạn mức (P06-04; QT-05; BR-24, BR-77; YCTD-55).
// Thủ quỹ chỉ lập phiếu chi tiền mặt; người duyệt không phải người lập
export const PAYMENT_MANAGE_PERMISSION = 'P06.payment.manage';
export const PAYMENT_APPROVE_PERMISSION = 'P06.payment.approve';

const PERMISSIONS = [
  {
    code: PAYMENT_MANAGE_PERMISSION,
    description: 'Lập, sửa và trình duyệt phiếu chi trong phạm vi đơn vị; thủ quỹ chỉ chi tiền mặt',
    roleCodes: ['VT-04', 'VT-05', 'VT-16'],
  },
  {
    code: PAYMENT_APPROVE_PERMISSION,
    description: 'Duyệt phiếu chi theo hạn mức trong phạm vi đơn vị; phiếu hoàn tiền thôi học chỉ Hiệu trưởng',
    roleCodes: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P06', ${permission.description})`.execute(database);
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
