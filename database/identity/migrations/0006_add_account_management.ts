import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhật ký thao tác của dịch vụ định danh và quyền tạo tài khoản trong đơn vị cho VT-03 (PQ-05, PQ-13, YCTD-39)
export const ACCOUNT_MANAGE_IN_UNIT_PERMISSION = 'P01.account.manage-in-unit';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('identity_audit_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('entity_name', 'text', (column) => column.notNull())
      .addColumn('entity_id', 'uuid', (column) => column.notNull())
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('before_data', 'jsonb')
      .addColumn('after_data', 'jsonb')
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('identity_audit_logs_entity_index')
      .on('identity_audit_logs')
      .columns(['entity_name', 'entity_id'])
      .execute();

    const description =
      'Tạo tài khoản trong đơn vị được gán; khóa, mở khóa, đặt lại mật khẩu tài khoản thuộc đơn vị đó';
    await sql`insert into permissions (code, module_code, description) values (${ACCOUNT_MANAGE_IN_UNIT_PERMISSION}, 'P01', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code = 'VT-03' and permissions.code = ${ACCOUNT_MANAGE_IN_UNIT_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${ACCOUNT_MANAGE_IN_UNIT_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${ACCOUNT_MANAGE_IN_UNIT_PERMISSION}`.execute(database);
    await database.schema.dropTable('identity_audit_logs').execute();
  },
};
