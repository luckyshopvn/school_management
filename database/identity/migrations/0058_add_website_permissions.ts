import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18f (YCTD-144). Phân hệ Website trường thuộc P14 Hoạt động, nội dung, truyền thông, quyền tách theo thao tác:
// - soạn: soạn tin tức, thông báo, trang giới thiệu, công khai theo quy định, album ảnh; gửi duyệt; xem thư liên hệ;
// - duyệt: duyệt và đăng, trả lại, gỡ bài và album đã đăng; xử lý thư liên hệ;
// - cấu hình: thông tin website, tên miền (thêm, đánh dấu đã trỏ, ngừng dùng), chế độ trình diễn, nội dung mẫu.
// Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: Ban Giám hiệu, Quản lý đơn vị, Nhân viên
// tuyển sinh soạn; Ban Giám hiệu duyệt; Hiệu trưởng và Quản trị nền tảng cấu hình (tên miền là cấu hình kỹ thuật). Phụ
// huynh (VT-14) không có phân hệ "Website trường" ở 1.2 Phân quyền nhóm theo phần mềm
const WORKSPACE_KEY = 'website';
const PERMISSIONS = [
  {
    code: 'P14.website.edit',
    description: 'Soạn tin tức, thông báo, trang, công khai, album ảnh của website trường và gửi duyệt',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-12'],
  },
  {
    code: 'P14.website.approve',
    description: 'Duyệt và đăng, trả lại, gỡ nội dung website trường; xử lý thư liên hệ',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P14.website.configure',
    description: 'Cấu hình thông tin website, tên miền, chế độ trình diễn của website trường',
    roles: ['VT-01', 'VT-02'],
  },
];

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P14', ${permission.description})`.execute(database);
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
