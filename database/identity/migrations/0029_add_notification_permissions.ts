import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mẫu thông báo và xem ai đã đọc thông báo (P19-04, P19-05; BR-70; YCTD-64)
const PERMISSIONS = [
  {
    code: 'P19.notification-template.manage',
    description: 'Sửa mẫu tiêu đề và nội dung thông báo chung toàn trường, cần được gán ở Trường chính',
    roleCodes: ['VT-02', 'VT-03'],
  },
  {
    code: 'P19.notification-receipt.view',
    description: 'Xem ai đã đọc, ai chưa đọc thông báo của đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P19', ${permission.description})`.execute(database);
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
