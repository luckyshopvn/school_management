import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kế toán đăng ký dịch vụ thay phụ huynh và chốt danh sách kỳ; Ban Giám hiệu duyệt đăng ký trễ và hủy trễ
// (P05-03, P05-04, P05-13, BR-26, Q-134; YCTD-50)
export const REGISTRATION_MANAGE_PERMISSION = 'P05.registration.manage';
export const LATE_REGISTRATION_APPROVE_PERMISSION = 'P05.late-registration.approve';

const PERMISSIONS = [
  {
    code: REGISTRATION_MANAGE_PERMISSION,
    description: 'Đăng ký dịch vụ, đăng ký học hè cho trẻ và chốt danh sách đăng ký của kỳ trong phạm vi đơn vị',
    roleCodes: ['VT-04'],
  },
  {
    code: LATE_REGISTRATION_APPROVE_PERMISSION,
    description: 'Duyệt đăng ký dịch vụ trễ và hủy dịch vụ trễ trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P05', ${permission.description})`.execute(database);
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
