import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 22c1 (YCTD-160): quyền "Lập và ban hành thời khoá biểu" (khung giờ tiết, bản nháp, nhập Excel, ban hành) cho
// Hiệu trưởng và Phó Hiệu trưởng, do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 (thời khoá biểu là việc chuyên môn
// toàn trường; giáo viên, phụ huynh chỉ xem bản đã ban hành)
const PERMISSION = {
  code: 'P02.timetable.manage',
  description: 'Lập, nhập và ban hành thời khoá biểu, khai báo khung giờ tiết học',
  roles: ['VT-02', 'VT-15'],
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P02', ${PERMISSION.description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in (${sql.join(PERMISSION.roles)}) and permissions.code = ${PERMISSION.code}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code = ${PERMISSION.code})`.execute(database);
    await sql`delete from permissions where code = ${PERMISSION.code}`.execute(database);
  },
};
