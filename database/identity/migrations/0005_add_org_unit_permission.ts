import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền quản lý cây đơn vị chỉ Hiệu trưởng có (PQ-12, YCTD-38)
export const ORG_UNIT_MANAGE_PERMISSION = 'P01.org-unit.manage';

export const migration: Migration = {
  async up(database) {
    const description = 'Tạo, sửa, ngừng sử dụng đơn vị trong cây đơn vị';
    await sql`insert into permissions (code, module_code, description) values (${ORG_UNIT_MANAGE_PERMISSION}, 'P01', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-02' and permissions.code = ${ORG_UNIT_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${ORG_UNIT_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${ORG_UNIT_MANAGE_PERMISSION}`.execute(database);
  },
};
