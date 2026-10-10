import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền quản lý lớp học và phân công giáo viên (P02-05, YCTD-44)
export const CLASS_MANAGE_PERMISSION = 'P02.class.manage';

export const migration: Migration = {
  async up(database) {
    const description = 'Tạo, sửa, đóng lớp và phân công giáo viên trong phạm vi đơn vị';
    await sql`insert into permissions (code, module_code, description) values (${CLASS_MANAGE_PERMISSION}, 'P02', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-02', 'VT-15', 'VT-03') and permissions.code = ${CLASS_MANAGE_PERMISSION}`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${CLASS_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${CLASS_MANAGE_PERMISSION}`.execute(database);
  },
};
