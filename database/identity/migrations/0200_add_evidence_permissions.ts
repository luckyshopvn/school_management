import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kho minh chứng dùng chung (YCTD-396 lát L1, Q-396-7). Ba quyền thuộc P09; vai trò nhận quyền theo đặc tả YCTD-396 mục 4.7:
// - xem kho: Ban Giám hiệu, quản lý đơn vị, tổ trưởng chuyên môn;
// - đóng góp (thêm minh chứng, phiên bản, gắn từ trang nguồn): mọi vai trò đang có quyền tham gia tự đánh giá
//   `P09.quality.use`; quyền này kèm quyền xem;
// - quản lý kho: Ban Giám hiệu.
// Minh chứng có dữ liệu cá nhân còn cần quyền xem loại nguồn đó (Q-396-5), máy chủ kiểm ở từng lần tải
const PERMISSIONS = [
  {
    code: 'P09.evidence.view',
    description: 'Xem kho minh chứng, tải tệp minh chứng (tệp có dữ liệu cá nhân cần thêm quyền xem nguồn)',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-17'],
  },
  {
    code: 'P09.evidence.contribute',
    description: 'Thêm minh chứng, phiên bản, gắn dữ liệu của phần mềm làm minh chứng; sửa minh chứng của mình',
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
    code: 'P09.evidence.manage',
    description: 'Quản lý kho minh chứng: sửa, gỡ, xóa mọi minh chứng, xem nhật ký truy cập',
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
