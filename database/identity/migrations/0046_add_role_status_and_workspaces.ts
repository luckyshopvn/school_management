import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16d. 1.1 Nhóm người dùng có cột Hiệu lực như của Sở: nhóm hết hiệu lực không cấp quyền và phân hệ cho tài
// khoản. 1.2 Phân quyền nhóm theo phần mềm: lưu các phân hệ của cổng quản trị nhóm KHÔNG được dùng, để phân hệ thêm sau
// này mặc định hiện với mọi nhóm (quyền theo thao tác vẫn quyết định mục menu nào hiện). Nhóm Phụ huynh (VT-14) chỉ dùng
// ứng dụng phụ huynh nên bỏ mọi phân hệ của cổng quản trị; các nhóm khác giữ đủ phân hệ như trước
const PORTAL_WORKSPACE_KEYS = [
  'education',
  'facilities',
  'emis',
  'system',
  'finance',
  'personnel',
  'logistics',
  'interaction',
  'teaching',
  'admissions',
  'reports',
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('roles')
      .addColumn('is_active', 'boolean', (column) => column.notNull().defaultTo(true))
      .execute();
    await database.schema
      .createTable('role_workspace_exclusions')
      .addColumn('role_id', 'uuid', (column) => column.notNull().references('roles.id').onDelete('cascade'))
      .addColumn('workspace_key', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('role_workspace_exclusions_primary_key', ['role_id', 'workspace_key'])
      .execute();
    await sql`insert into role_workspace_exclusions (role_id, workspace_key)
      select roles.id, keys.workspace_key from roles,
        unnest(array[${sql.join(PORTAL_WORKSPACE_KEYS)}]::text[]) as keys(workspace_key)
      where roles.code = 'VT-14'`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('role_workspace_exclusions').execute();
    await database.schema.alterTable('roles').dropColumn('is_active').execute();
  },
};
