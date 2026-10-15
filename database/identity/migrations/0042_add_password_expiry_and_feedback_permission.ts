import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-15 phần 15g (YCTD-110). Hết hạn mật khẩu: thời điểm đặt mật khẩu gần nhất của từng tài khoản; tài khoản đã có lấy
// thời điểm cập nhật gần nhất, không có thì thời điểm tạo. Quyền xem, xử lý và trả lời ý kiến phản hồi cho Quản trị nền
// tảng và Hiệu trưởng
export const FEEDBACK_MANAGE_PERMISSION = 'P01.feedback.manage';

export const migration: Migration = {
  async up(database) {
    await database.schema.alterTable('users').addColumn('password_changed_at', 'timestamptz').execute();
    await sql`update users set password_changed_at = coalesce(updated_at, created_at)`.execute(database);
    await database.schema
      .alterTable('users')
      .alterColumn('password_changed_at', (column) => column.setNotNull())
      .execute();
    await database.schema
      .alterTable('users')
      .alterColumn('password_changed_at', (column) => column.setDefault(sql`now()`))
      .execute();

    const description = 'Xem mọi ý kiến phản hồi gửi từ chân trang, đổi trạng thái xử lý và trả lời người gửi';
    await sql`insert into permissions (code, module_code, description)
      values (${FEEDBACK_MANAGE_PERMISSION}, 'P01', ${description})`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-01', 'VT-02') and permissions.code = ${FEEDBACK_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${FEEDBACK_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${FEEDBACK_MANAGE_PERMISSION}`.execute(database);
    await database.schema.alterTable('users').dropColumn('password_changed_at').execute();
  },
};
