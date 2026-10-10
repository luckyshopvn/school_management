import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quy định phép năm, duyệt đơn nghỉ phép, duyệt mở lại kỳ công (P08-03, P08-04, P08-11; BR-40, BR-41; Q-135; YCTD-59).
// Phòng nhân sự lập đơn hộ, chỉnh số ngày phép, chốt bảng công và đề nghị mở lại bằng `P08.attendance.manage`
export const LEAVE_POLICY_MANAGE_PERMISSION = 'P08.leave-policy.manage';
export const LEAVE_APPROVE_PERMISSION = 'P08.leave.approve';
export const TIMESHEET_REOPEN_APPROVE_PERMISSION = 'P08.timesheet-reopen.approve';

const PERMISSIONS = [
  {
    code: LEAVE_POLICY_MANAGE_PERMISSION,
    moduleCode: 'P08',
    description:
      'Lập quy định số ngày phép năm theo chức danh và thâm niên chung toàn trường, cần được gán ở Trường chính',
    roleCodes: ['VT-06'],
  },
  {
    code: LEAVE_APPROVE_PERMISSION,
    moduleCode: 'P08',
    description: 'Duyệt hoặc từ chối đơn nghỉ phép của nhân sự trong phạm vi đơn vị',
    roleCodes: ['VT-02', 'VT-15'],
  },
  {
    code: TIMESHEET_REOPEN_APPROVE_PERMISSION,
    moduleCode: 'P08',
    description: 'Duyệt hoặc từ chối đề nghị mở lại bảng công đã chốt trong phạm vi đơn vị',
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
