import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// YCTD-311: phân vai nhân viên vận hành của công ty. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - quan_tri: quản trị nền tảng, tạo và khóa nhân viên vận hành, mọi trang của cổng;
// - ho_tro: hỗ trợ trường, mở phiên hỗ trợ khi trường đã cấp quyền;
// - ky_thuat: kỹ thuật, mở phiên hỗ trợ, theo dõi bảng điều khiển, bảo trì;
// - ke_toan: kế toán, gói dịch vụ và thu phí, không mở phiên hỗ trợ vào dữ liệu trường.
// Tài khoản đã có trước đều là quản trị (cổng trước đây chỉ có một loại tài khoản)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('platform_operators')
      .addColumn('role', 'text', (column) => column.notNull().defaultTo('quan_tri'))
      .execute();
    await sql`alter table platform_operators add constraint platform_operators_role_check
      check (role in ('quan_tri', 'ho_tro', 'ky_thuat', 'ke_toan'))`.execute(database);
  },
  async down(database) {
    await sql`alter table platform_operators drop constraint platform_operators_role_check, drop column role`.execute(
      database,
    );
  },
};
