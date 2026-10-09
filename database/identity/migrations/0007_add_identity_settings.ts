import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cấu hình chung của dịch vụ định danh, quyền sửa cấu hình, tên người thực hiện trong nhật ký (PQ-07, PQ-15, YCTD-40)
export const SETTING_MANAGE_PERMISSION = 'P01.setting.manage';

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('identity_settings')
      .addColumn('key', 'text', (column) => column.primaryKey())
      .addColumn('value', 'jsonb', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .execute();
    await database.schema.alterTable('identity_audit_logs').addColumn('actor_name', 'text').execute();

    const description = 'Sửa cấu hình theo đơn vị; ở phạm vi toàn trường thì sửa cả cấu hình chung';
    await sql`insert into permissions (code, module_code, description) values (${SETTING_MANAGE_PERMISSION}, 'P01', ${description})`.execute(
      database,
    );
    await sql`insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id from roles, permissions
      where roles.code in ('VT-02', 'VT-03') and permissions.code = ${SETTING_MANAGE_PERMISSION}`.execute(database);
  },
  async down(database) {
    await sql`delete from role_permissions where permission_id in (select id from permissions where code = ${SETTING_MANAGE_PERMISSION})`.execute(
      database,
    );
    await sql`delete from permissions where code = ${SETTING_MANAGE_PERMISSION}`.execute(database);
    await database.schema.alterTable('identity_audit_logs').dropColumn('actor_name').execute();
    await database.schema.dropTable('identity_settings').execute();
  },
};
