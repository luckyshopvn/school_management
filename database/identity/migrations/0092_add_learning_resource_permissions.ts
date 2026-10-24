import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22h1 (YCTD-183). Kho học liệu là phân hệ riêng của cổng quản trị, quyền thuộc P09 như các phân hệ DT-18, DT-22,
// tách theo thao tác. Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - dùng kho: tải lên, tìm, xem, tải về, bộ sưu tập, báo lỗi: mọi cán bộ, giáo viên, nhân viên dùng cổng quản trị;
// - duyệt cấp tổ: Tổ trưởng chuyên môn, chỉ học liệu của tổ mình;
// - duyệt cấp trường (bước Ban Giám hiệu của học liệu rủi ro): Hiệu trưởng, Phó Hiệu trưởng;
// - quản lý kho (thủ kho): danh mục, xử lý báo lỗi, ẩn, ngừng dùng, thống kê toàn trường: Hiệu trưởng, Phó Hiệu trưởng (trường
//   giao thêm cho người khác ở 1.2 Phân quyền nhóm).
// Phụ huynh (VT-14) không có phân hệ "Kho học liệu"
const WORKSPACE_KEY = 'learning-resources';
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
    code: 'P09.learning-resource.use',
    description: 'Dùng kho học liệu: tải lên, tìm, xem, tải về học liệu, bộ sưu tập, báo lỗi',
    roles: STAFF_ROLES,
  },
  {
    code: 'P09.learning-resource.review',
    description: 'Duyệt học liệu cấp tổ (tổ trưởng chuyên môn), trả lại học liệu của tổ mình',
    roles: ['VT-17'],
  },
  {
    code: 'P09.learning-resource.approve',
    description:
      'Duyệt học liệu cấp trường (Ban Giám hiệu): liên kết ngoài, video, tài liệu có xin phép, loại trường chọn',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.learning-resource.manage',
    description: 'Quản lý kho học liệu: danh mục, xử lý báo lỗi, ẩn, ngừng dùng học liệu, thống kê toàn trường',
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
