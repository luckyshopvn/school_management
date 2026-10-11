import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Khóa API cho đối tác chỉ đọc (P01-14; BR-73, BR-74; BM-65, BM-66; YCTD-63): khóa lưu dạng băm, chỉ hiện một lần khi
// cấp; mỗi khóa có phạm vi dữ liệu, căn cứ pháp lý, địa chỉ mạng cho phép, ngày hết hạn; thu hồi có hiệu lực ngay
export const API_CLIENT_MANAGE_PERMISSION = 'P01.api-client.manage';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('api_clients')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('partner_type', 'text', (column) => column.notNull())
      .addColumn('scopes', 'jsonb', (column) => column.notNull())
      .addColumn('legal_basis', 'text')
      .addColumn('key_prefix', 'text', (column) => column.notNull())
      .addColumn('key_hash', 'text', (column) => column.notNull().unique())
      .addColumn('allowed_ips', 'jsonb', (column) => column.notNull())
      .addColumn('valid_until', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_by', 'uuid')
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('last_used_at', 'timestamptz')
      .addCheckConstraint('api_clients_status_check', sql`status in ('active', 'revoked')`)
      .execute();
    await sql`insert into permissions (code, module_code, description)
      values (${API_CLIENT_MANAGE_PERMISSION}, 'P01', 'Cấp và thu hồi khóa API cho đối tác')`.execute(database);
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-02' and permissions.code = ${API_CLIENT_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${API_CLIENT_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${API_CLIENT_MANAGE_PERMISSION}`.execute(database);
    await database.schema.dropTable('api_clients').execute();
  },
};
