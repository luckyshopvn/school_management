import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ nhân sự, hợp đồng lao động, nhập nhân sự từ Excel (P07-01, P07-02, P07-04, P01-13; BR-37, BR-38, BR-46; YCTD-58).
// Không dùng `P07.view` vì giáo viên và nhân viên có quyền này nhưng chỉ được xem hồ sơ của chính mình
export const STAFF_MANAGE_PERMISSION = 'P07.staff.manage';
export const STAFF_VIEW_PERMISSION = 'P07.staff.view';
export const CONTRACT_VIEW_PERMISSION = 'P07.contract.view';
export const IMPORT_STAFF_PERMISSION = 'P01.import.staff';

const PERMISSIONS = [
  {
    code: STAFF_MANAGE_PERMISSION,
    moduleCode: 'P07',
    description: 'Tạo, sửa hồ sơ nhân sự và hợp đồng lao động, liên kết tài khoản trong phạm vi đơn vị',
    roleCodes: ['VT-06'],
  },
  {
    code: STAFF_VIEW_PERMISSION,
    moduleCode: 'P07',
    description: 'Xem danh sách và hồ sơ nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-05', 'VT-06'],
  },
  {
    code: CONTRACT_VIEW_PERMISSION,
    moduleCode: 'P07',
    description: 'Xem hợp đồng lao động kèm lương thỏa thuận trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-04', 'VT-05', 'VT-06'],
  },
  {
    code: IMPORT_STAFF_PERMISSION,
    moduleCode: 'P01',
    description: 'Nhập hồ sơ nhân sự từ tệp Excel trong phạm vi đơn vị',
    roleCodes: ['VT-06'],
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
