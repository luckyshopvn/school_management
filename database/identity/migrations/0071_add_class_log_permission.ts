import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20d (YCTD-162): quyền "Kiểm tra và ký sổ đầu bài" theo tuần cho Hiệu trưởng, Phó Hiệu trưởng, do Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11 (Ban giám hiệu kiểm tra sổ; giáo viên ghi, ký tiết mình dạy theo thời khoá biểu)
const PERMISSION = {
  code: 'P02.class-log.review',
  description: 'Kiểm tra và ký sổ đầu bài của lớp theo tuần',
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
