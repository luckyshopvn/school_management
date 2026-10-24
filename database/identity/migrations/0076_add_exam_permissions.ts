import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 22g1 (YCTD-168): quyền kiểm tra, đánh giá phần đề, do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - soạn câu hỏi, ra đề được giao: giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng chuyên môn;
// - thẩm định đề, duyệt câu hỏi vào ngân hàng: tổ trưởng chuyên môn, Hiệu trưởng, Phó Hiệu trưởng;
// - quản lý (kế hoạch kiểm tra duyệt, phân công ra đề, khoá và mở khoá đề, xem mọi đề): Hiệu trưởng, Phó Hiệu trưởng
const PERMISSIONS = [
  {
    code: 'P02.question.author',
    description: 'Soạn câu hỏi ở ngân hàng câu hỏi, soạn đề kiểm tra được giao',
    roles: ['VT-07', 'VT-08', 'VT-17'],
  },
  {
    code: 'P02.exam.review',
    description: 'Duyệt câu hỏi vào ngân hàng, thẩm định đề kiểm tra, lập kế hoạch kiểm tra',
    roles: ['VT-02', 'VT-15', 'VT-17'],
  },
  {
    code: 'P02.exam.manage',
    description: 'Duyệt kế hoạch kiểm tra, phân công ra đề, khoá và mở khoá đề kiểm tra',
    roles: ['VT-02', 'VT-15'],
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
