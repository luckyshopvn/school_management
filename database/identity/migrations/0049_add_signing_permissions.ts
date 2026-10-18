import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16k. Phân hệ Quản lý kí hồ sơ (mục 6 của Sở), bản chạy nội bộ; quyền tách theo thao tác:
// - xem chứng thư số, danh sách hồ sơ, tải tệp hồ sơ;
// - lập hồ sơ (tạo hồ sơ, tải thông tin thay đổi, hủy hồ sơ, xác nhận hoàn thành, hủy xác nhận, đánh dấu đã gửi);
// - kí xác nhận nội bộ hồ sơ đã tạo (người kí ghi tên trên tệp đã kí);
// - khai báo chứng thư số nhà trường, ảnh con dấu, đăng ký kí nội bộ, đánh dấu đồng bộ chứng thư với Bộ.
// Hiệu trưởng có đủ bốn quyền; Phó Hiệu trưởng xem và lập hồ sơ. Hồ sơ là của cả trường nên máy chủ đòi phạm vi toàn
// trường. Phụ huynh (VT-14) chỉ dùng ứng dụng phụ huynh nên bỏ phân hệ mới khỏi nhóm này như migration 0046
const PERMISSIONS = [
  {
    code: 'P01.signing.view',
    description: 'Xem chứng thư số nhà trường, danh sách hồ sơ kí, tải tệp hồ sơ',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P01.signing.manage',
    description:
      'Tạo hồ sơ kí, tải thông tin thay đổi, hủy hồ sơ, xác nhận hoàn thành, hủy xác nhận và đánh dấu đã gửi hồ sơ',
    roles: ['VT-02', 'VT-15'],
  },
  {
    code: 'P01.signing.sign',
    description: 'Kí xác nhận nội bộ hồ sơ đã tạo',
    roles: ['VT-02'],
  },
  {
    code: 'P01.signing.certificate',
    description: 'Khai báo chứng thư số nhà trường, ảnh con dấu, đăng ký kí nội bộ và đánh dấu đồng bộ chứng thư',
    roles: ['VT-02'],
  },
];
const WORKSPACE_KEY = 'signing';

export const migration: Migration = {
  async up(database) {
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P01', ${permission.description})`.execute(database);
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
