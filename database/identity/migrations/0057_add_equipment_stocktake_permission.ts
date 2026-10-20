import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18g (YCTD-143). Quét mã QR kiểm kê thiết bị trên ứng dụng giáo viên hoặc web di động, ghi tình trạng trong
// đợt kiểm kê đang mở của đơn vị (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11): Ban Giám hiệu, quản lý đơn vị,
// nhân viên kho và giáo viên (thành viên tổ kiểm kê thường là giáo viên phụ trách phòng, lớp). Lập đợt, duyệt, chốt chênh
// lệch, nơi để, in tem vẫn dùng quyền quản lý thiết bị P13.equipment.manage
const PERMISSION = {
  code: 'P13.equipment.stocktake',
  description: 'Quét mã QR kiểm kê thiết bị, ghi số đếm được và tình trạng trong đợt kiểm kê đang mở của đơn vị',
  roles: ['VT-02', 'VT-15', 'VT-03', 'VT-11', 'VT-07', 'VT-08'],
};

export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values (${PERMISSION.code}, 'P13', ${PERMISSION.description})`.execute(database);
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
