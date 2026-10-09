import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bảng tài khoản, vai trò, quyền, phiên của dịch vụ định danh (16_CO_SO_DU_LIEU.md mục 2, YCTD-35)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('users')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('phone', 'text', (column) => column.unique())
      .addColumn('username', 'text', (column) => column.unique())
      .addColumn('password_hash', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('last_login_at', 'timestamptz')
      .addColumn('failed_login_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('locked_until', 'timestamptz')
      .addColumn('must_change_password', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('valid_until', 'date')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('users_status_check', sql`status in ('active', 'locked')`)
      .addCheckConstraint('users_login_identifier_check', sql`phone is not null or username is not null`)
      .execute();

    await database.schema
      .createTable('roles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();

    await database.schema
      .createTable('permissions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('module_code', 'text', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();

    await database.schema
      .createTable('role_permissions')
      .addColumn('role_id', 'uuid', (column) => column.notNull().references('roles.id'))
      .addColumn('permission_id', 'uuid', (column) => column.notNull().references('permissions.id'))
      .addPrimaryKeyConstraint('role_permissions_primary_key', ['role_id', 'permission_id'])
      .execute();

    // org_unit_id trống nghĩa là toàn trường; không có khóa ngoại vì org_units nằm ở cơ sở dữ liệu năm học
    await database.schema
      .createTable('user_roles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id'))
      .addColumn('role_id', 'uuid', (column) => column.notNull().references('roles.id'))
      .addColumn('org_unit_id', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .execute();
    await database.schema.createIndex('user_roles_user_id_index').on('user_roles').column('user_id').execute();
    await sql`create unique index user_roles_assignment_unique on user_roles (user_id, role_id, coalesce(org_unit_id, '00000000-0000-0000-0000-000000000000'))`.execute(
      database,
    );

    await database.schema
      .createTable('sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('users.id'))
      .addColumn('channel', 'text', (column) => column.notNull())
      .addColumn('refresh_token_hash', 'text', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull())
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('ip_address', 'text')
      .addColumn('user_agent', 'text')
      .addCheckConstraint('sessions_channel_check', sql`channel in ('portal', 'teacher', 'parent')`)
      .execute();
    await database.schema.createIndex('sessions_user_id_index').on('sessions').column('user_id').execute();

    await database.schema
      .createTable('security_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('event_type', 'text', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.references('users.id'))
      .addColumn('login_identifier', 'text')
      .addColumn('ip_address', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('security_events_user_id_index')
      .on('security_events')
      .column('user_id')
      .execute();
    await database.schema
      .createIndex('security_events_ip_address_index')
      .on('security_events')
      .column('ip_address')
      .execute();
  },
  async down(database) {
    for (const table of [
      'security_events',
      'sessions',
      'user_roles',
      'role_permissions',
      'permissions',
      'roles',
      'users',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
