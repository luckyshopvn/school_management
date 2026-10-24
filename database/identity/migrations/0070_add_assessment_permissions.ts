import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20c (YCTD-161): quyền đánh giá học sinh theo Thông tư 27/2020. Vai trò nhận quyền do Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11:
// - nhập đánh giá: giáo viên (VT-07, VT-08); máy chủ chỉ cho nhập ở lớp, môn được phân công (giáo viên bộ môn nhập môn mình
//   dạy, giáo viên chủ nhiệm nhập môn chưa có giáo viên bộ môn, phẩm chất, năng lực, tổng hợp cuối năm);
// - xem kết quả, tổng hợp của đơn vị: quản lý đơn vị (VT-03);
// - quản lý (cấu hình mức đạt, danh mục, kỳ, bài kiểm tra; nhập thay mọi lớp; khoá, mở khoá số liệu): Ban Giám hiệu
const PERMISSIONS = [
  {
    code: 'P02.assessment.enter',
    module: 'P02',
    description: 'Nhập đánh giá học sinh (nhận xét thường xuyên, kết quả định kỳ) ở lớp, môn được phân công',
    roles: ['VT-07', 'VT-08'],
  },
  {
    code: 'P02.assessment.view',
    module: 'P02',
    description: 'Xem kết quả đánh giá, bảng tổng hợp cuối kỳ, cuối năm của các lớp trong đơn vị',
    roles: ['VT-02', 'VT-15', 'VT-03'],
  },
  {
    code: 'P02.assessment.manage',
    module: 'P02',
    description:
      'Quản lý đánh giá học sinh: mức đạt, phẩm chất, năng lực, kỳ đánh giá, bài kiểm tra định kỳ; nhập thay; khoá, mở khoá số liệu',
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
