import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18a (YCTD-138). Văn bản đến theo VNPT iOffice, phân hệ Quản lý văn bản và điều hành; quyền tách theo thao
// tác (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11):
// - xem và xử lý văn bản đến được chuyển cho mình (nhận, chuyển tiếp, trả lại, lấy lại, xin gia hạn, kết thúc phần mình),
//   đánh dấu, theo dõi: mọi cán bộ, nhân viên dùng cổng quản trị;
// - văn thư: vào sổ, cập nhật thông tin, trình lãnh đạo, chuyển trực tiếp, nhận văn bản liên thông, kết thúc, lưu hồ sơ,
//   hạn chế xem, in sổ; xem mọi văn bản đến trừ văn bản hạn chế xem không qua tay mình;
// - tra cứu mọi văn bản đến không hạn chế xem: Ban Giám hiệu;
// - quản trị văn bản: sổ văn bản, đơn vị bên ngoài, nhóm đơn vị ban hành, danh mục văn bản, lãnh đạo nhận văn bản.
// Văn bản là của cả trường nên ba quyền sau cần phạm vi toàn trường. Phụ huynh (VT-14) chỉ dùng ứng dụng phụ huynh nên bỏ
// phân hệ mới khỏi nhóm này như migration 0046
const PERMISSIONS = [
  {
    code: 'P09.incoming-document.view',
    description: 'Xem, xử lý văn bản đến được chuyển cho mình; đánh dấu, theo dõi văn bản',
    roles: ['VT-02', 'VT-15', 'VT-03', 'VT-04', 'VT-05', 'VT-06', 'VT-07', 'VT-08', 'VT-09', 'VT-10', 'VT-11', 'VT-12', 'VT-16', 'VT-17'],
  },
  {
    code: 'P09.incoming-document.register',
    description:
      'Văn thư: vào sổ văn bản đến, cập nhật thông tin, trình lãnh đạo, chuyển trực tiếp, nhận liên thông, kết thúc, lưu hồ sơ, hạn chế xem',
    roles: ['VT-02', 'VT-15', 'VT-06'],
  },
  {
    code: 'P09.incoming-document.search',
    description: 'Tra cứu mọi văn bản đến không hạn chế xem',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P09.incoming-document.admin',
    description: 'Quản trị văn bản: sổ văn bản, đơn vị bên ngoài, nhóm đơn vị ban hành, danh mục văn bản, lãnh đạo nhận văn bản',
    roles: ['VT-02', 'VT-06'],
  },
];
const WORKSPACE_KEY = 'documents';

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
