import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quyền xem và trả hóa đơn dịch vụ của trường (DT-SaaS phần S5b, YCTD-196): Hiệu trưởng và quản trị trường. Số 0105 lấy ở dải định
// danh của DT-SaaS (từ 0100), không trùng phần khác chạy song song (kho mã bật allowUnorderedMigrations)
export const migration: Migration = {
  async up(database) {
    await sql`insert into permissions (code, module_code, description)
      values ('P01.billing.manage', 'P01', 'Xem, tải và thanh toán hóa đơn dịch vụ của trường')`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-01', 'VT-02') and permissions.code = 'P01.billing.manage'`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = 'P01.billing.manage')`.execute(
      database,
    );
    await sql`delete from permissions where code = 'P01.billing.manage'`.execute(database);
  },
};
