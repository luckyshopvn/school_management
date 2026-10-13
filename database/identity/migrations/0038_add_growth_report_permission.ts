import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền của DT-14 phần 14a (YCTD-102):
// - báo cáo tổng hợp cân nặng, chiều cao theo đợt cân đo (mục 4.3.2 của hệ thống Sở). Dữ liệu sức khỏe nhạy cảm (BR-53)
//   nên không dùng chung quyền báo cáo điểm danh; nhân viên y tế nhập số đo bằng P10.health.manage;
// - thống kê học sinh, lớp học và hồ sơ học sinh chưa nhập đủ (mục 5.1, 5.3, 5.8);
// - thống kê nhân sự và hồ sơ nhân sự chưa nhập đủ (mục 5.2, 5.9)
const PERMISSIONS = [
  {
    code: 'P17.report.growth',
    description: 'Xem báo cáo tổng hợp cân nặng, chiều cao và kênh tăng trưởng của trẻ trong đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-09'],
  },
  {
    code: 'P17.child-statistics.view',
    description: 'Xem thống kê lớp học, học sinh và hồ sơ học sinh chưa nhập đủ trong đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
  },
  {
    code: 'P17.staff-statistics.view',
    description: 'Xem thống kê nhân sự và hồ sơ nhân sự chưa nhập đủ trong đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-06'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P17', ${permission.description})`.execute(database);
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
