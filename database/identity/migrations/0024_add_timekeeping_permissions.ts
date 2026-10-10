import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Ngày nghỉ lễ, lịch học bù và nghỉ bù, chấm công (P08-01, P08-09, P08-10; BR-39, BR-84; YCTD-59).
// Nhân sự có hồ sơ liên kết tài khoản tự chấm công của mình nên không cần mã quyền riêng
export const HOLIDAY_MANAGE_PERMISSION = 'P08.holiday.manage';
export const SCHOOL_DAY_CHANGE_MANAGE_PERMISSION = 'P08.school-day-change.manage';
export const STAFF_ATTENDANCE_MANAGE_PERMISSION = 'P08.attendance.manage';
export const STAFF_ATTENDANCE_VIEW_PERMISSION = 'P08.attendance.view';

const PERMISSIONS = [
  {
    code: HOLIDAY_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Lập lịch ngày nghỉ lễ chung toàn trường, cần được gán ở Trường chính',
    roleCodes: ['VT-06'],
  },
  {
    code: SCHOOL_DAY_CHANGE_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Lập ngày học bù thứ bảy và ngày nghỉ bù chung toàn trường',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: STAFF_ATTENDANCE_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description: 'Nhập và sửa giờ chấm công của nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-06'],
  },
  {
    code: STAFF_ATTENDANCE_VIEW_PERMISSION,
    moduleCode: 'P08',
    description: 'Xem bảng chấm công của nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-05', 'VT-06'],
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
