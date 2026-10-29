import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Trang đơn vị cấp trên (YCTD-367, Eric cho làm ngày 2026-10-29; giao diện YCTD-363):
// - cấp trên rút đề nghị xem chi tiết của mình (trạng thái `withdrawn`, khác `revoked` là trường rút): đề nghị chờ duyệt hoặc đã duyệt
//   còn hạn; phiên xem chi tiết đang mở kết thúc ngay;
// - xuất báo cáo chạy nền (`parent_org_exports`): mỗi lần xuất là một việc, máy chủ API dựng tệp ở việc định kỳ, lưu ở kho tệp chung của
//   bản triển khai theo thư mục của đơn vị cấp trên, giữ có hạn rồi tự xóa. Tệp chỉ có số liệu tổng hợp, cùng quy tắc ẩn ô nhỏ
export const migration: Migration = {
  async up(database) {
    await sql`alter table parent_org_access_requests drop constraint parent_org_access_requests_status_check`.execute(
      database,
    );
    await sql`alter table parent_org_access_requests add constraint parent_org_access_requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'revoked', 'withdrawn'))`.execute(database);
    await database.schema.alterTable('parent_org_access_requests').addColumn('withdrawn_at', 'timestamptz').execute();

    await database.schema
      .createTable('parent_org_exports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull().references('parent_org_users.id').onDelete('cascade'))
      .addColumn('admin_unit_id', 'uuid', (column) => column.notNull().references('admin_units.id').onDelete('cascade'))
      .addColumn('unit_name', 'text', (column) => column.notNull())
      .addColumn('categories', 'jsonb', (column) => column.notNull())
      .addColumn('layout', 'text', (column) => column.notNull())
      .addColumn('format', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('queued'))
      .addColumn('storage_key', 'text')
      .addColumn('file_name', 'text')
      .addColumn('size_bytes', 'integer')
      .addColumn('error', 'text')
      .addColumn('attempts', 'smallint', (column) => column.notNull().defaultTo(0))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('started_at', 'timestamptz')
      .addColumn('finished_at', 'timestamptz')
      .addColumn('expires_at', 'timestamptz')
      .addCheckConstraint('parent_org_exports_layout_check', sql`layout in ('summary', 'compare')`)
      .addCheckConstraint('parent_org_exports_format_check', sql`format in ('xlsx', 'pdf')`)
      .addCheckConstraint(
        'parent_org_exports_status_check',
        sql`status in ('queued', 'running', 'done', 'failed', 'expired')`,
      )
      .execute();
    await database.schema
      .createIndex('parent_org_exports_user_idx')
      .on('parent_org_exports')
      .columns(['user_id', 'created_at'])
      .execute();
    await database.schema
      .createIndex('parent_org_exports_status_idx')
      .on('parent_org_exports')
      .columns(['status', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('parent_org_exports').execute();
    await sql`update parent_org_access_requests set status = 'revoked', revoked_at = withdrawn_at where status = 'withdrawn'`.execute(
      database,
    );
    await database.schema.alterTable('parent_org_access_requests').dropColumn('withdrawn_at').execute();
    await sql`alter table parent_org_access_requests drop constraint parent_org_access_requests_status_check`.execute(
      database,
    );
    await sql`alter table parent_org_access_requests add constraint parent_org_access_requests_status_check
      check (status in ('pending', 'approved', 'rejected', 'revoked'))`.execute(database);
  },
};
