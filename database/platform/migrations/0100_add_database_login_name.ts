import type { Migration } from 'kysely/migration';

// Tên đăng nhập kết nối khác tên vai trò (DT-SaaS phần S9, YCTD-203): bộ gom kết nối dùng chung của Supabase (Supavisor) nhận
// tên đăng nhập dạng `<vai trò>.<mã dự án>`, trong khi lệnh tạo, khóa, xóa vai trò vẫn dùng tên vai trò. Trống là đăng nhập bằng
// tên vai trò như trước (bố cục tự dựng, Neon)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('school_databases').addColumn('login_name', 'text').execute();
  },
  async down(database) {
    await database.schema.alterTable('school_databases').dropColumn('login_name').execute();
  },
};
