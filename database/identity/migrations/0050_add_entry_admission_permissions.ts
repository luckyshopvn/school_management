import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-17 phần 17c (YCTD-134). Phân hệ Tuyển sinh đầu cấp phần 1 (khảo sát mục 10.2), quyền tách theo thao tác:
// - xem hồ sơ cuối cấp, xác nhận hoàn thành theo lớp, thống kê, thông tin trường theo bản đồ, dịch vụ tại trường, danh sách
//   nhân sự và lớp của phân hệ, yêu cầu hỗ trợ tuyển sinh;
// - cập nhật hồ sơ cuối cấp (sửa thông tin, cập nhật từ Excel, tải giấy tờ, xác nhận thay phụ huynh, đánh dấu đã chỉnh sửa,
//   đặt hạn điều chỉnh), xác nhận hoàn thành theo lớp, tọa độ trường và điểm trường, danh mục dịch vụ;
// - duyệt và hủy duyệt hồ sơ cuối cấp;
// - trả lời yêu cầu hỗ trợ tuyển sinh và gửi câu trả lời cho phụ huynh.
// Hiệu trưởng, Phó Hiệu trưởng có đủ bốn quyền; Nhân viên tuyển sinh xem, cập nhật và trả lời hỗ trợ; Quản lý đơn vị xem hồ
// sơ của đơn vị mình (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11). Phụ huynh (VT-14) dùng ứng dụng phụ huynh nên bỏ
// phân hệ mới khỏi nhóm này như migration 0046; phụ huynh xem, xác nhận hồ sơ của con theo quan hệ phụ huynh, không cần quyền
const PERMISSIONS = [
  {
    code: 'P02.final-year.view',
    description: 'Xem hồ sơ cuối cấp, xác nhận hoàn thành, thống kê và các danh mục của phân hệ Tuyển sinh đầu cấp',
    roles: ['VT-02', 'VT-15', 'VT-12', 'VT-03'],
  },
  {
    code: 'P02.final-year.manage',
    description:
      'Cập nhật hồ sơ cuối cấp, xác nhận hoàn thành hồ sơ theo lớp, tọa độ trường và điểm trường, dịch vụ đăng ký tại trường',
    roles: ['VT-02', 'VT-15', 'VT-12'],
  },
  {
    code: 'P02.final-year.approve',
    description: 'Duyệt và hủy duyệt hồ sơ cuối cấp',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P02.admission-support.reply',
    description: 'Trả lời yêu cầu hỗ trợ tuyển sinh của phụ huynh',
    roles: ['VT-02', 'VT-15', 'VT-12'],
  },
];
const WORKSPACE_KEY = 'entry-admissions';

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
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, ${WORKSPACE_KEY} from roles where roles.code = 'VT-14'
      on conflict do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from role_workspace_exclusions where workspace_key = ${WORKSPACE_KEY}`.execute(database);
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
  },
};
