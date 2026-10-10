import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đăng nhập của phụ huynh: mật khẩu mặc định chung, mã một lần, cách đăng nhập của phiên (PQ-06, XT-09, BM-61, YCTD-43)
export const migration: Migration = {
  async up(database) {
    // Mật khẩu để trống nghĩa là tài khoản còn dùng mật khẩu mặc định chung lưu ở identity_settings
    await sql`alter table users alter column password_hash drop not null`.execute(database);

    await database.schema
      .alterTable('sessions')
      .addColumn('login_method', 'text', (column) => column.notNull().defaultTo('password'))
      .execute();
    await sql`alter table sessions add constraint sessions_login_method_check
      check (login_method in ('password', 'one_time_code'))`.execute(database);

    await database.schema
      .createTable('one_time_codes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id'))
      .addColumn('phone', 'text', (column) => column.notNull())
      .addColumn('purpose', 'text', (column) => column.notNull())
      .addColumn('code_hash', 'text', (column) => column.notNull())
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('attempt_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('used_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('one_time_codes_purpose_check', sql`purpose in ('login')`)
      .execute();
    await database.schema
      .createIndex('one_time_codes_phone_created_at_index')
      .on('one_time_codes')
      .columns(['phone', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('one_time_codes').execute();
    await database.schema.alterTable('sessions').dropColumn('login_method').execute();
    await sql`update users set password_hash = '' where password_hash is null`.execute(database);
    await sql`alter table users alter column password_hash set not null`.execute(database);
  },
};
