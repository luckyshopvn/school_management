import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của DT-14 phần 14d (YCTD-102): thiết bị dạy học tối thiểu, báo cáo cơ sở vật chất, hồ sơ trường, báo cáo EMIS.
// Người xem được báo cáo của phần này thì xuất được Excel của báo cáo đó (vẫn ghi nhật ký xuất), không cần quyền xuất dữ
// liệu P17.data.export
const PERMISSIONS = [
  {
    code: 'P13.equipment.manage',
    module: 'P13',
    description:
      'Quản lý danh mục thiết bị dạy học (cần phạm vi toàn trường), nhập số lượng hiện có của đơn vị, gắn tài sản với thiết bị',
    roleCodes: ['VT-02', 'VT-03', 'VT-11'],
  },
  {
    code: 'P17.report.facilities',
    module: 'P17',
    description: 'Xem, xuất báo cáo tổng hợp thiết bị dạy học và khai báo cơ sở vật chất của đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-11'],
  },
  {
    code: 'P01.school-profile.manage',
    module: 'P01',
    description: 'Cập nhật hồ sơ trường (thông tin chung, tiêu chí, yếu tố nước ngoài, internet, CNTT, tài khoản)',
    roleCodes: ['VT-02'],
  },
  {
    code: 'P17.report.emis',
    module: 'P17',
    description: 'Lập và xuất báo cáo EMIS đầu năm (Biểu 1) toàn trường',
    roleCodes: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.module}, ${permission.description})`.execute(database);
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
