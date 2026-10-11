import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục phụ cấp, khấu trừ, biểu thuế, bảng lương toàn trường, phiếu lương (P08-06, P08-08, P08-11, P08-12; BR-43,
// BR-44, BR-46, BR-77, BR-82; YCTD-60). Quản lý đơn vị, thủ quỹ, giáo viên không xem bảng lương
export const PAYROLL_CATALOG_MANAGE_PERMISSION = 'P08.pay-item-type.manage';
export const STAFF_PAY_ITEM_MANAGE_PERMISSION = 'P08.staff-pay-item.manage';
export const TAX_TABLE_MANAGE_PERMISSION = 'P08.tax-table.manage';
export const PAYROLL_MANAGE_PERMISSION = 'P08.payroll.manage';
export const PAYROLL_VIEW_PERMISSION = 'P08.payroll.view';
export const PAYROLL_APPROVE_PERMISSION = 'P08.payroll.approve';

const PERMISSIONS = [
  {
    code: PAYROLL_CATALOG_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Khai báo danh mục phụ cấp, thưởng và khấu trừ chung toàn trường',
    roleCodes: ['VT-04'],
  },
  {
    code: STAFF_PAY_ITEM_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Gán khoản phụ cấp, khấu trừ và số người phụ thuộc cho nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-06'],
  },
  {
    code: TAX_TABLE_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Khai báo biểu thuế thu nhập cá nhân và mức giảm trừ gia cảnh',
    roleCodes: ['VT-05'],
  },
  {
    code: PAYROLL_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Tính bảng lương toàn trường và trình duyệt',
    roleCodes: ['VT-04'],
  },
  {
    code: PAYROLL_VIEW_PERMISSION,
    moduleCode: 'P08',
    description: 'Xem bảng lương của nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-04', 'VT-05', 'VT-06', 'VT-20'],
  },
  {
    code: PAYROLL_APPROVE_PERMISSION,
    moduleCode: 'P08',
    description: 'Phê duyệt bảng lương theo hạn mức của Trường chính',
    roleCodes: ['VT-02', 'VT-15'],
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
