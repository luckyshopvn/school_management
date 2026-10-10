import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quản lý đơn vị chốt điểm danh thay giáo viên và sửa điểm danh đã chốt kèm lý do (P04-06, ghi chú 15 của tài liệu 08, YCTD-47)
export const ATTENDANCE_MANAGE_PERMISSION = 'P04.attendance.manage';

export const migration: Migration = {
  async up(database) {
    const description = 'Chốt điểm danh thay giáo viên và sửa điểm danh đã chốt kèm lý do trong phạm vi đơn vị';
    await sql`insert into permissions (code, module_code, description) values (${ATTENDANCE_MANAGE_PERMISSION}, 'P04', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-03' and permissions.code = ${ATTENDANCE_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${ATTENDANCE_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${ATTENDANCE_MANAGE_PERMISSION}`.execute(database);
  },
};
