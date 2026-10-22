import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 22b (YCTD-146). Kiểm thực ba bước và lưu, hủy mẫu thức ăn theo Quyết định 1246/QĐ-BYT (Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11): Ban Giám hiệu, quản lý đơn vị, nhân viên y tế và nhân viên bếp (người kiểm tra thường là
// Phó Hiệu trưởng phụ trách bán trú, nhân viên y tế hoặc bếp trưởng). Lô hàng, hồ sơ an toàn thực phẩm của nhà cung cấp vẫn
// dùng quyền quản lý bếp P12.kitchen.manage
const PERMISSION = {
  code: 'P12.food-safety.inspect',
  description: 'Kiểm thực ba bước (trước khi chế biến, khi chế biến, trước khi ăn), lưu và hủy mẫu thức ăn của đơn vị',
  roles: ['VT-02', 'VT-15', 'VT-03', 'VT-09', 'VT-10'],
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P12', ${PERMISSION.description})`.execute(database);
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
