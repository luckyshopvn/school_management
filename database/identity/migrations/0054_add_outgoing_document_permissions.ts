import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18b (YCTD-140). Văn bản đi theo VNPT iOffice trong phân hệ Quản lý văn bản và điều hành; quyền tách theo thao
// tác (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - soạn dự thảo, lấy ý kiến, cho ý kiến khi được hỏi, trình ký, lấy lại: mọi cán bộ, nhân viên dùng cổng quản trị (cùng
//   nhóm vai trò với quyền xem văn bản đến của migration 0052);
// - ký, không ký, trả lại văn bản trình mình ký: Ban Giám hiệu;
// - văn thư: cấp số và phát hành theo sổ văn bản đi, liên thông, công bố lên website, đóng băng, lưu hồ sơ, in sổ văn bản
//   đi; xem mọi văn bản đi đã ký;
// - tra cứu mọi văn bản đi: Ban Giám hiệu.
// Văn bản là của cả trường nên ba quyền sau cần phạm vi toàn trường (dịch vụ kiểm tra)
const PERMISSIONS = [
  {
    code: 'P09.outgoing-document.draft',
    description: 'Soạn dự thảo văn bản đi, lấy ý kiến, cho ý kiến khi được hỏi, trình ký',
    roles: [
      'VT-02',
      'VT-15',
      'VT-03',
      'VT-04',
      'VT-05',
      'VT-06',
      'VT-07',
      'VT-08',
      'VT-09',
      'VT-10',
      'VT-11',
      'VT-12',
      'VT-16',
      'VT-17',
    ],
  },
  {
    code: 'P09.outgoing-document.sign',
    description: 'Ký, không ký, trả lại văn bản đi được trình mình ký',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.outgoing-document.issue',
    description:
      'Văn thư: cấp số và phát hành văn bản đi, liên thông, công bố lên website, đóng băng, lưu hồ sơ, in sổ văn bản đi',
    roles: ['VT-02', 'VT-15', 'VT-06'],
  },
  {
    code: 'P09.outgoing-document.search',
    description: 'Tra cứu mọi văn bản đi',
    roles: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P09', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
