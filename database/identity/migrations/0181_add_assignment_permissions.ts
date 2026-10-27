import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28c (YCTD-273): quyền soạn, giao, chấm, trả bài tập trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11: cùng các vai trò dạy lớp học trực tuyến của 28b (giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng chuyên môn);
// bài nào của giáo viên do lớp học trực tuyến quyết định (giáo viên của lớp đó), quyền chỉ là điều kiện cần. Học sinh làm, nộp
// bài bằng quyền học `P02.learning.study` sẵn có của 28b (kênh student), không thêm quyền mới
const PERMISSIONS = [
  {
    code: 'P02.assignment.manage',
    description: 'Soạn, giao, chấm, trả bài tập trực tuyến ở lớp học trực tuyến của mình',
    roles: ['VT-07', 'VT-08', 'VT-17'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    for (const permission of PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in
        (select id from permissions where code = ${permission.code})`.execute(database);
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
