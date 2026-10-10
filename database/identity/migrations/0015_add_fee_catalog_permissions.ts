import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục của học phí và tài chính, dùng chung toàn trường (P05-01, P05-02, P05-11, P06-10; YCTD-49)
export const FEE_CATALOG_MANAGE_PERMISSION = 'P05.fee-catalog.manage';
export const DISCOUNT_TYPE_MANAGE_PERMISSION = 'P05.discount-type.manage';
export const CASHFLOW_CATEGORY_MANAGE_PERMISSION = 'P06.cashflow-category.manage';

const PERMISSIONS = [
  {
    code: FEE_CATALOG_MANAGE_PERMISSION,
    moduleCode: 'P05',
    description: 'Quản lý danh mục dịch vụ và biểu phí dùng chung toàn trường',
    roleCodes: ['VT-04'],
  },
  {
    code: DISCOUNT_TYPE_MANAGE_PERMISSION,
    moduleCode: 'P05',
    description: 'Quản lý danh mục loại miễn giảm dùng chung toàn trường',
    roleCodes: ['VT-04', 'VT-02'],
  },
  {
    code: CASHFLOW_CATEGORY_MANAGE_PERMISSION,
    moduleCode: 'P06',
    description: 'Quản lý khoản mục và nhóm thu chi dùng chung toàn trường',
    roleCodes: ['VT-04', 'VT-05'],
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
