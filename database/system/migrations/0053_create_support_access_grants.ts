import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trường cho phép nhân viên nền tảng vào hỗ trợ (DT-SaaS phần S4, YCTD-197): quản trị của trường bật cho phép có hạn (mặc định 24
// giờ), phạm vi chỉ đọc hoặc toàn quyền, ghi lý do; rút được bất kỳ lúc nào. Lưu ở cơ sở dữ liệu hệ thống của chính trường để bằng
// chứng đồng ý đi theo dữ liệu của trường; phiên hỗ trợ và từng thao tác ghi ở cơ sở dữ liệu nền tảng (support_sessions)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('support_access_grants')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('granted_by_user_id', 'uuid', (column) => column.notNull())
      .addColumn('granted_by_name', 'text', (column) => column.notNull())
      .addColumn('scope', 'text', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('revoked_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('support_access_grants_scope_check', sql`scope in ('read', 'full')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('support_access_grants').execute();
  },
};
