import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-18 phần 18h (YCTD-145). Quản trị và trình diễn:
// - impersonations: mỗi lần quản trị trường đăng nhập thay một tài khoản để hỗ trợ (ai, vào tài khoản nào, lý do, lúc bắt
//   đầu, lúc kết thúc, cách kết thúc). Phiên của tài khoản được đăng nhập thay là một dòng sessions có impersonation_id và
//   cách đăng nhập 'impersonation'; phiên gốc của quản trị giữ nguyên để quay lại khi thoát;
// - quyền P01.account.impersonate: đăng nhập thay;
// - quyền P01.data.export-all: xuất toàn bộ dữ liệu của trường thành gói ZIP.
// Vai trò nhận quyền do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: chỉ Hiệu trưởng (VT-02). Quản trị nền tảng
// (VT-01) không xem dữ liệu nghiệp vụ (PQ-10) nên không đăng nhập thay và không xuất toàn bộ dữ liệu
const PERMISSIONS = [
  {
    code: 'P01.account.impersonate',
    description: 'Đăng nhập thay tài khoản khác để hỗ trợ (có ghi nhật ký), xem nhật ký đăng nhập thay',
    roles: ['VT-02'],
  },
  {
    code: 'P01.data.export-all',
    description: 'Xuất toàn bộ dữ liệu của trường thành gói ZIP',
    roles: ['VT-02'],
  },
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('impersonations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('impersonator_user_id', 'uuid', (column) => column.notNull().references('users.id'))
      .addColumn('impersonator_name', 'text', (column) => column.notNull())
      .addColumn('target_user_id', 'uuid', (column) => column.notNull().references('users.id'))
      .addColumn('target_name', 'text', (column) => column.notNull())
      .addColumn('original_session_id', 'uuid', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('ended_at', 'timestamptz')
      .addColumn('end_reason', 'text')
      .addColumn('ip_address', 'text')
      .addColumn('user_agent', 'text')
      .addCheckConstraint(
        'impersonations_end_reason_check',
        sql`end_reason is null or end_reason in ('exit', 'expired', 'logout')`,
      )
      .execute();
    await database.schema
      .createIndex('impersonations_started_at_index')
      .on('impersonations')
      .column('started_at')
      .execute();
    await database.schema
      .alterTable('sessions')
      .addColumn('impersonation_id', 'uuid', (column) => column.references('impersonations.id'))
      .execute();
    await sql`alter table sessions drop constraint sessions_login_method_check`.execute(database);
    await sql`alter table sessions add constraint sessions_login_method_check
      check (login_method in ('password', 'one_time_code', 'impersonation'))`.execute(database);
    for (const permission of PERMISSIONS) {
      await sql`insert into permissions (code, module_code, description)
        values (${permission.code}, 'P01', ${permission.description})`.execute(database);
      await sql`insert into role_permissions (role_id, permission_id)
        select roles.id, permissions.id from roles, permissions
        where roles.code in (${sql.join(permission.roles)}) and permissions.code = ${permission.code}`.execute(
        database,
      );
    }
  },
  async down(database) {
    const codes = PERMISSIONS.map((permission) => permission.code);
    await sql`delete from role_permissions where permission_id in
      (select id from permissions where code in (${sql.join(codes)}))`.execute(database);
    await sql`delete from permissions where code in (${sql.join(codes)})`.execute(database);
    await sql`delete from sessions where login_method = 'impersonation'`.execute(database);
    await sql`alter table sessions drop constraint sessions_login_method_check`.execute(database);
    await sql`alter table sessions add constraint sessions_login_method_check
      check (login_method in ('password', 'one_time_code'))`.execute(database);
    await database.schema.alterTable('sessions').dropColumn('impersonation_id').execute();
    await database.schema.dropTable('impersonations').execute();
  },
};
