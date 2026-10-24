import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22h2 (YCTD-184): quyền xuất, nhập gói chia sẻ học liệu liên trường (bản chạy nội bộ) cho Hiệu trưởng, Phó Hiệu
// trưởng (trường giao thêm ở 1.2 Phân quyền nhóm). Câu hỏi, đề, ma trận trong kho, rubric dùng quyền dùng kho của 22h1. Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11
const PERMISSION = {
  code: 'P09.learning-resource.share',
  description: 'Xuất, nhập gói chia sẻ học liệu liên trường (bản chạy nội bộ)',
  roles: ['VT-02', 'VT-15'],
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P09', ${PERMISSION.description})`.execute(database);
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
