import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20f (YCTD-165): quyền sửa khung biểu báo cáo (EMIS Tiểu học): dòng chỉ tiêu, công thức, mã số. Xem, lập, xuất,
// gửi biểu dùng quyền báo cáo EMIS có sẵn (`P17.report.emis`); thống kê Tiểu học dùng quyền thống kê học sinh. Vai trò nhận
// quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: Ban Giám hiệu
const PERMISSIONS = [
  {
    code: 'P17.report-form.manage',
    module: 'P17',
    description: 'Sửa khung biểu báo cáo cấu hình được (EMIS Tiểu học): dòng chỉ tiêu, công thức tính, mã số, đơn vị',
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
