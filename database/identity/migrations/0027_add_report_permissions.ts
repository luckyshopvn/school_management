import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bảng điều khiển và báo cáo cơ bản (P17-01 đến P17-07, P17-13, P17-14; BR-36; YCTD-62). Không dùng `P17.view` vì gần như
// mọi vai trò có quyền này; giáo viên xem điểm danh và sinh nhật theo lớp được phân công, không cần mã quyền
const PERMISSIONS = [
  { code: 'P17.dashboard.leadership', description: 'Xem bảng điều khiển Ban Giám hiệu', roleCodes: ['VT-02', 'VT-15'] },
  { code: 'P17.dashboard.unit', description: 'Xem bảng điều khiển của đơn vị được gán', roleCodes: ['VT-03'] },
  {
    code: 'P17.report.tuition',
    description: 'Xem báo cáo học phí',
    roleCodes: ['VT-02', 'VT-15', 'VT-04', 'VT-05'],
  },
  { code: 'P17.report.debt', description: 'Xem báo cáo công nợ', roleCodes: ['VT-02', 'VT-15', 'VT-04', 'VT-05'] },
  { code: 'P17.report.cash-flow', description: 'Xem báo cáo thu chi', roleCodes: ['VT-02', 'VT-04', 'VT-05'] },
  {
    code: 'P17.report.attendance',
    description: 'Xem báo cáo điểm danh và trẻ vắng của đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
  },
  {
    code: 'P17.report.staff-attendance',
    description: 'Xem báo cáo chấm công',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-06'],
  },
  {
    code: 'P17.report.saturday',
    description: 'Xem báo cáo học thứ 7',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-04'],
  },
  {
    code: 'P17.birthday.view',
    description: 'Xem sinh nhật trẻ trong tháng của đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03'],
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
