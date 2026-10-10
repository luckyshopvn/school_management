import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền lập hồ sơ trẻ và xem đầy đủ số định danh (P02-02, BR-81, YCTD-45)
const CHILD_PERMISSIONS: { code: string; description: string; roleCodes: string[] }[] = [
  {
    code: 'P02.child.manage',
    description: 'Tạo, sửa hồ sơ trẻ ở trạng thái nháp và chờ duyệt, gửi trình duyệt',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-12'],
  },
  {
    code: 'P02.national-id.view',
    description: 'Xem đầy đủ số định danh cá nhân và giấy khai sinh của trẻ',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-12'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of CHILD_PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description) values (${permission.code}, 'P02', ${permission.description})`.execute(
        database,
      );
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roleCodes)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    for (const permission of CHILD_PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${permission.code})`.execute(
        database,
      );
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
