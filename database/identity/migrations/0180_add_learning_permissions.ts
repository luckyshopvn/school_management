import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): quyền của lõi hệ thống quản lý học tập, do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - dạy lớp học trực tuyến của mình (soạn chương, hoạt động, xem tiến độ): giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng
//   chuyên môn; lớp học trực tuyến nào là của giáo viên do phân công giảng dạy quyết định, quyền chỉ là điều kiện cần;
// - soạn khoá học mẫu của tổ: giáo viên chủ nhiệm, giáo viên bộ môn, tổ trưởng chuyên môn, Ban Giám hiệu; duyệt khoá mẫu
//   dùng quyền duyệt học liệu của 22h1 (tổ trưởng duyệt bước tổ, Ban Giám hiệu phê duyệt) theo Thông tư 09/2021/TT-BGDĐT
//   Điều 7 khoản 3;
// - quyết định hình thức dạy học trực tuyến thay thế, ban hành nội quy dạy học trực tuyến: Hiệu trưởng (Điều 5 khoản 4, Điều 15);
// - xem mọi lớp học trực tuyến, đồng bộ lớp từ phân công, tạo khoá tự chọn: Hiệu trưởng, Phó Hiệu trưởng, tổ trưởng chuyên môn
//   (tổ trưởng chỉ thấy lớp của môn trong tổ khi xem, việc lọc theo tổ do máy chủ làm)
const PERMISSIONS = [
  {
    code: 'P02.learning.teach',
    description: 'Dạy lớp học trực tuyến của mình: soạn chương, hoạt động, xem tiến độ học sinh',
    roles: ['VT-07', 'VT-08', 'VT-17'],
  },
  {
    code: 'P02.learning.template',
    description: 'Soạn khoá học mẫu của tổ chuyên môn và gửi duyệt',
    roles: ['VT-02', 'VT-15', 'VT-07', 'VT-08', 'VT-17'],
  },
  {
    code: 'P02.learning.decide',
    description: 'Quyết định hình thức dạy học trực tuyến thay thế, ban hành nội quy dạy học trực tuyến',
    roles: ['VT-02'],
  },
  {
    code: 'P02.learning.view',
    description: 'Xem mọi lớp học trực tuyến, đồng bộ lớp từ phân công giảng dạy, tạo khoá tự chọn',
    roles: ['VT-02', 'VT-15', 'VT-17'],
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
