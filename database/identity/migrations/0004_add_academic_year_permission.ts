import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền quản lý năm học chỉ Hiệu trưởng có (PQ-11, YCTD-37)
export const ACADEMIC_YEAR_MANAGE_PERMISSION = 'P01.academic-year.manage';

export const migration: Migration = {
  async up(database) {
    const description = 'Tạo năm học, lưu lịch năm học, đánh dấu tuần nghỉ, mở năm học mới';
    await sql`insert into permissions (code, module_code, description) values (${ACADEMIC_YEAR_MANAGE_PERMISSION}, 'P01', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-02' and permissions.code = ${ACADEMIC_YEAR_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${ACADEMIC_YEAR_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${ACADEMIC_YEAR_MANAGE_PERMISSION}`.execute(database);
  },
};
