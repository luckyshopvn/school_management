import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20b (YCTD-159): quyền bán trú Tiểu học, nề nếp và thi đua lớp. Vai trò nhận quyền do Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11:
// - chốt suất, cắt suất bán trú của lớp: giáo viên chủ nhiệm ở lớp mình (theo phân công, không cần quyền), quản lý đơn vị (VT-03), Ban Giám hiệu, nhân
//   viên bếp (VT-10) xem và cắt suất hộ khi phụ huynh báo qua điện thoại; phụ huynh báo cắt suất của con qua ứng dụng (không
//   cần quyền, máy chủ kiểm tra quan hệ phụ huynh);
// - ghi nề nếp: giáo viên chủ nhiệm, giáo viên bộ môn (giáo viên trực tuần, ghi thay đội cờ đỏ), Ban Giám hiệu, quản lý đơn vị;
// - quản lý nề nếp, thi đua lớp (bật tắt, điểm nền, tiêu chí): Ban Giám hiệu
const PERMISSIONS = [
  {
    code: 'P04.boarding.manage',
    module: 'P04',
    description:
      'Bán trú lớp ngoài Mầm non: xem danh sách ăn của ngày, cắt suất hộ học sinh, chốt và mở lại suất của lớp',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-10'],
  },
  {
    code: 'P02.conduct.record',
    module: 'P02',
    description:
      'Ghi điểm nề nếp của lớp (giáo viên trực tuần, ghi thay đội cờ đỏ), xem tổng hợp, xếp hạng thi đua lớp',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-07', 'VT-08'],
  },
  {
    code: 'P02.conduct.manage',
    module: 'P02',
    description: 'Quản lý nề nếp, thi đua lớp: bật tắt, điểm nền mỗi tuần, tiêu chí cộng trừ điểm, xóa điểm đã ghi',
    roles: ['VT-02', 'VT-15'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, ${permission.module}, ${permission.description})
        on conflict (code) do nothing`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}
        on conflict do nothing`.execute(database);
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
