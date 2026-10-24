import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22a (YCTD-181): quyền thư viện trường học, phân hệ riêng "Thư viện" của cổng quản trị, quyền thuộc P02. Vai trò
// nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - tra cứu danh mục, xem sách mình đang mượn, đặt trước: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị;
// - quản lý thư viện (danh mục, bản sao, thẻ bạn đọc, mượn trả, phát và thu sách giáo khoa, kiểm kê, thiết lập, báo cáo):
//   Ban Giám hiệu và quản lý đơn vị; trường có thủ thư thì gán quyền này cho nhóm người dùng của thủ thư ở 1.1 Nhóm người
//   dùng (chưa thêm vai trò thủ thư cố định).
// Phụ huynh (VT-14) không có phân hệ "Thư viện" ở 1.2 Phân quyền nhóm theo phần mềm; phụ huynh xem sách của con ở ứng dụng
const WORKSPACE_KEY = 'library';
const STAFF_ROLES = [
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
];
const PERMISSIONS = [
  {
    code: 'P02.library.view',
    description: 'Thư viện: tra cứu danh mục ấn phẩm, xem sách mình đang mượn, đặt trước ấn phẩm',
    roles: STAFF_ROLES,
  },
  {
    code: 'P02.library.manage',
    description:
      'Quản lý thư viện: danh mục, bản sao, thẻ bạn đọc, mượn trả, phát và thu sách giáo khoa, kiểm kê, thiết lập, báo cáo',
    roles: ['VT-02', 'VT-15', 'VT-03'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P02', ${permission.description})
        on conflict (code) do nothing`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}
        on conflict do nothing`.execute(database);
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
