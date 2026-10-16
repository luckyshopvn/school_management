import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16c. Lịch sử mật khẩu để không cho đặt lại mật khẩu đã dùng gần đây: mỗi lần người dùng tự đổi hoặc tự đặt
// lại mật khẩu thì lưu giá trị băm của mật khẩu mới; mật khẩu tạm do quản trị cấp không lưu. Quyền soạn thông báo hệ
// thống bật lên khi vào cổng quản trị và cấu hình ứng dụng liên kết cho Quản trị nền tảng và Hiệu trưởng. Mã một lần có
// thêm mục đích đặt lại mật khẩu (quên mật khẩu tự phục vụ)
export const ANNOUNCEMENT_MANAGE_PERMISSION = 'P01.announcement.manage';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('password_history')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id').onDelete('cascade'))
      .addColumn('password_hash', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('password_history_user_created_index')
      .on('password_history')
      .columns(['user_id', 'created_at'])
      .execute();

    await sql`alter table one_time_codes drop constraint one_time_codes_purpose_check`.execute(database);
    await sql`alter table one_time_codes add constraint one_time_codes_purpose_check
      check (purpose in ('login', 'password_reset'))`.execute(database);

    const description = 'Soạn thông báo hệ thống bật lên khi vào cổng quản trị và cấu hình ứng dụng liên kết';
    await sql`insert into permissions (code, module_code, description)
      values (${ANNOUNCEMENT_MANAGE_PERMISSION}, 'P01', ${description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-01', 'VT-02') and permissions.code = ${ANNOUNCEMENT_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${ANNOUNCEMENT_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${ANNOUNCEMENT_MANAGE_PERMISSION}`.execute(database);
    await sql`delete from one_time_codes where purpose = 'password_reset'`.execute(database);
    await sql`alter table one_time_codes drop constraint one_time_codes_purpose_check`.execute(database);
    await sql`alter table one_time_codes add constraint one_time_codes_purpose_check check (purpose in ('login'))`.execute(
      database,
    );
    await database.schema.dropTable('password_history').execute();
  },
};
