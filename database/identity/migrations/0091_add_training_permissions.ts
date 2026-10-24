import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22e (YCTD-182): hồ sơ bồi dưỡng giáo viên là nhóm mới của phân hệ Hồ sơ chuyên môn, quyền thuộc P09 như 18e,
// tách theo thao tác. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - dùng: đăng ký khoá, xem hồ sơ bồi dưỡng của mình, nhập chứng chỉ của mình, tự đánh giá năng lực số: mọi cán bộ, giáo
//   viên, nhân viên dùng cổng quản trị (như quyền dùng kho hồ sơ của 18e);
// - duyệt cấp tổ: Tổ trưởng chuyên môn, chỉ đăng ký, hồ sơ, tự đánh giá của giáo viên trong tổ mình;
// - quản lý: khoá, duyệt đăng ký cấp trường, điểm danh, kết quả, cấp và thu hồi chứng nhận, danh mục, báo cáo: Ban Giám hiệu
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
    code: 'P09.training.use',
    description: 'Hồ sơ bồi dưỡng của mình: đăng ký khoá, nhập chứng chỉ, tự đánh giá năng lực số',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.training.review',
    description: 'Duyệt đăng ký bồi dưỡng cấp tổ, xem hồ sơ bồi dưỡng, xác nhận năng lực số của tổ mình',
    roles: ['VT-17'],
  },
  {
    code: 'P09.training.manage',
    description: 'Quản lý bồi dưỡng: khoá, duyệt đăng ký, kết quả, cấp và thu hồi chứng nhận, danh mục, báo cáo',
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
    for (const permission of PERMISSIONS) {
      await sql`delete from role_permissions where permission_id in
        (select id from permissions where code = ${permission.code})`.execute(database);
      await sql`delete from permissions where code = ${permission.code}`.execute(database);
    }
  },
};
