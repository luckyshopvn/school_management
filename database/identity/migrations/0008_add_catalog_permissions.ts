import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền quản lý các danh mục của P01 (P01-03, 04, 05, 10, 11, 12; YCTD-42)
const CATALOG_PERMISSIONS: { code: string; description: string; roleCodes: string[] }[] = [
  {
    code: 'P01.department.manage',
    description: 'Tạo, sửa, ngừng sử dụng phòng ban và chức danh trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-06'],
  },
  {
    code: 'P01.catalog.manage',
    description: 'Tạo, sửa, ngừng sử dụng mục danh mục dùng chung và bậc học',
    roleCodes: ['VT-02'],
  },
  {
    code: 'P01.approval-threshold.manage',
    description: 'Lưu hạn mức phê duyệt theo đơn vị và loại chứng từ',
    roleCodes: ['VT-02'],
  },
  {
    code: 'P01.room.manage',
    description: 'Tạo, sửa, ngừng sử dụng phòng học trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-03'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of CATALOG_PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description) values (${permission.code}, 'P01', ${permission.description})`.execute(
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
    for (const permission of CATALOG_PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${permission.code})`.execute(
        database,
      );
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
