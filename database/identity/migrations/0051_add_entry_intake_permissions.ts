import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-17 phần 17d (YCTD-135). Tuyển sinh đầu cấp phần 2 (khảo sát mục 10.2.4), quyền tách theo thao tác:
// - xem 1.3 Danh sách đăng ký trường tiên tiến, 1.4 Tiếp nhận hồ sơ, 1.5 Gửi thông báo, 1.6 Chuyển hồ sơ, 1.7 Kết quả chuyển
//   hồ sơ và 5.11 Danh sách trúng tuyển của phân hệ Mầm non;
// - tiếp nhận hồ sơ (nhập danh sách phân tuyến từ Excel, giấy tờ đã nộp, phụ huynh đồng ý hoặc từ chối nhập học, hủy nhập
//   học hồ sơ chưa chuyển), xác nhận hồ sơ trường tiên tiến, gửi thông báo tuyển sinh;
// - xếp lớp, chuyển hồ sơ trúng tuyển sang hồ sơ học sinh và hủy nhập học hồ sơ đã chuyển.
// Hiệu trưởng, Phó Hiệu trưởng có đủ ba quyền; Nhân viên tuyển sinh xem và tiếp nhận; Quản lý đơn vị xem (Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11). Chuyển hồ sơ tạo hồ sơ học sinh nên người chuyển cần thêm quyền cập nhật hồ sơ
// trẻ như luồng chuyển hồ sơ tuyển sinh của YCTD-86
const PERMISSIONS = [
  {
    code: 'P02.entry-intake.view',
    description: 'Xem hồ sơ tiếp nhận, đăng ký trường tiên tiến, thông báo, kết quả chuyển hồ sơ của Tuyển sinh đầu cấp',
    roles: ['VT-02', 'VT-15', 'VT-12', 'VT-03'],
  },
  {
    code: 'P02.entry-intake.manage',
    description:
      'Tiếp nhận hồ sơ tuyển sinh đầu cấp, xác nhận hồ sơ trường tiên tiến, gửi thông báo tuyển sinh, hủy nhập học hồ sơ chưa chuyển',
    roles: ['VT-02', 'VT-15', 'VT-12'],
  },
  {
    code: 'P02.entry-intake.transfer',
    description: 'Xếp lớp, chuyển hồ sơ trúng tuyển sang hồ sơ học sinh và hủy nhập học hồ sơ đã chuyển',
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
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
