import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 22g2 (YCTD-173): quyền chấm bài kiểm tra (tạo bài kiểm tra của lớp từ đề đã khoá, nhập phiếu trả lời, nhập tệp
// quét, chấm tự luận) cho giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng chuyên môn, Hiệu trưởng, Phó Hiệu trưởng; khoá
// điểm bài kiểm tra dùng quyền P02.exam.manage của 22g1; chuyển điểm vào sổ điểm theo quyền nhập điểm của 21c. Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11
const PERMISSION = {
  code: 'P02.exam.grade',
  description: 'Chấm bài kiểm tra: nhập phiếu trả lời, tệp quét, điểm tự luận',
  roles: ['VT-02', 'VT-07', 'VT-08', 'VT-15', 'VT-17'],
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
