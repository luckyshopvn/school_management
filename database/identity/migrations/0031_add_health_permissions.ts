import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Y tế học đường phần hồ sơ, khám, sự kiện, chăm sóc (P10-01, P10-06, P10-07, P10-08, P10-10, P10-11, P10-12; YCTD-74)
const PERMISSIONS = [
  {
    code: 'P10.health.manage',
    description:
      'Ghi chỉ số sức khỏe, quản lý tiêu chuẩn sức khỏe, đợt khám, lịch khám, kết quả khám, trả lời yêu cầu báo cáo sức khỏe của trẻ trong đơn vị',
    roleCodes: ['VT-09'],
  },
  {
    code: 'P10.medical-event.record',
    description: 'Ghi sự kiện y tế của trẻ; giáo viên chỉ ghi cho trẻ của lớp mình chủ nhiệm',
    roleCodes: ['VT-09', 'VT-07'],
  },
  {
    code: 'P10.daily-care.record',
    description: 'Ghi chăm sóc hằng ngày của trẻ; giáo viên chỉ ghi cho trẻ của lớp mình chủ nhiệm',
    roleCodes: ['VT-09', 'VT-07'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P10', ${permission.description})`.execute(database);
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
