import type { Migration } from 'kysely/migration';

// YCTD-311: tài khoản tạo theo quy tắc số CCCD nhận mật khẩu mặc định (biến môi trường DEFAULT_INITIAL_PASSWORD), phải đổi ở lần
// đăng nhập đầu; quá hạn (mặc định 7 ngày, cấu hình initial_password_lifetime_days) mà chưa đổi thì không đăng nhập được, quản trị
// trường đặt lại. Trống là không có hạn (tài khoản cũ, mật khẩu tạm do quản trị đặt lại, tài khoản quản trị tổng)
export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('users').addColumn('initial_password_expires_at', 'timestamptz').execute();
  },
  async down(database) {
    await database.schema.alterTable('users').dropColumn('initial_password_expires_at').execute();
  },
};
