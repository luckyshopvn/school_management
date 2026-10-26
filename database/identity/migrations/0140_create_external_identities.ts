import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bộ nối nhà cung cấp định danh bên ngoài theo chuẩn OIDC, sẵn cho VNeID (DT-25, YCTD-225, tài liệu 32 mục 17):
// - `external_identity_providers`: cấu hình của trường cho từng nhà cung cấp nền tảng đã khai (bật tắt, mã ứng dụng riêng, khóa bí mật
//   mã hóa bằng khóa của trường, nhóm vai trò được dùng, có coi là đạt xác thực hai lớp); có cột `id` để công cụ đổi khóa của S3 tự mã
//   hóa lại `client_secret_encrypted`.
// - `external_identities`: liên kết tài khoản. Chỉ lưu mã liên kết (subject) do nhà cung cấp trả, mã hóa bằng khóa của trường, kèm băm có
//   khóa để tra; không lưu số định danh, căn cước hay thông tin nào khác của người dùng. Mỗi tài khoản một liên kết với mỗi nhà cung cấp,
//   mỗi subject chỉ liên kết một tài khoản.
// - `external_identity_events`: nhật ký liên kết, gỡ liên kết, đăng nhập và từ chối.
// - Thêm cách đăng nhập `external_provider` cho phiên.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('external_identity_providers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('provider_code', 'text', (column) => column.notNull().unique())
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('client_id', 'text')
      .addColumn('client_secret_encrypted', 'text')
      .addColumn('allowed_roles', sql`text[]`)
      .addColumn('satisfies_mfa', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_by', 'uuid', (column) => column.references('users.id').onDelete('set null'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('external_identities')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('provider_code', 'text', (column) => column.notNull())
      .addColumn('subject_encrypted', 'text', (column) => column.notNull())
      .addColumn('subject_hash', 'text', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id').onDelete('cascade'))
      .addColumn('linked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_login_at', 'timestamptz')
      .addUniqueConstraint('external_identities_subject_key', ['provider_code', 'subject_hash'])
      .addUniqueConstraint('external_identities_user_key', ['provider_code', 'user_id'])
      .execute();

    await database.schema
      .createTable('external_identity_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('provider_code', 'text', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.references('users.id').onDelete('set null'))
      .addColumn('actor_user_id', 'uuid', (column) => column.references('users.id').onDelete('set null'))
      .addColumn('event_type', 'text', (column) => column.notNull())
      .addColumn('reason', 'text')
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('external_identity_events_user_index')
      .on('external_identity_events')
      .columns(['user_id', 'created_at'])
      .execute();

    await sql`alter table sessions drop constraint sessions_login_method_check`.execute(database);
    await sql`alter table sessions add constraint sessions_login_method_check
      check (login_method in ('password', 'one_time_code', 'impersonation', 'external_provider'))`.execute(database);
  },
  async down(database) {
    await sql`delete from sessions where login_method = 'external_provider'`.execute(database);
    await sql`alter table sessions drop constraint sessions_login_method_check`.execute(database);
    await sql`alter table sessions add constraint sessions_login_method_check
      check (login_method in ('password', 'one_time_code', 'impersonation'))`.execute(database);
    await database.schema.dropTable('external_identity_events').execute();
    await database.schema.dropTable('external_identities').execute();
    await database.schema.dropTable('external_identity_providers').execute();
  },
};
