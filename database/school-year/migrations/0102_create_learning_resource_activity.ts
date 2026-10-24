import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-22 phần 22h1 (YCTD-183): phần theo năm học của kho học liệu (học liệu ở cơ sở dữ liệu hệ thống 0042). Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11:
// - Sự kiện duyệt (`learning_resource_events`): gửi, duyệt tổ, duyệt trường, trả lại, công bố, ẩn tạm, mở lại, ngừng dùng,
//   kèm phiên bản và lý do.
// - Báo lỗi (`learning_resource_reports`): sai nội dung, lỗi tệp, nghi vi phạm bản quyền; thủ kho tiếp nhận, xử lý (ẩn tạm
//   học liệu nếu cần), trả lời.
// - Lượt xem, tải (`learning_resource_usage`): mỗi lượt một dòng để thống kê theo người, theo học liệu
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('learning_resource_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('resource_id', 'uuid', (column) => column.notNull())
      .addColumn('version_no', 'integer')
      .addColumn('action', 'text', (column) =>
        column
          .notNull()
          .check(
            sql`action in ('submit', 'unit_approve', 'school_approve', 'return', 'publish', 'hide', 'restore', 'retire')`,
          ),
      )
      .addColumn('note', 'text')
      .addColumn('actor_user_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('learning_resource_events_resource_index')
      .on('learning_resource_events')
      .column('resource_id')
      .execute();

    await database.schema
      .createTable('learning_resource_reports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('resource_id', 'uuid', (column) => column.notNull())
      .addColumn('resource_title', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('content', 'file', 'copyright')`))
      .addColumn('description', 'text', (column) =>
        column.notNull().check(sql`char_length(description) between 1 and 2000`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'resolved', 'rejected')`),
      )
      .addColumn('reporter_user_id', 'uuid', (column) => column.notNull())
      .addColumn('reporter_name', 'text', (column) => column.notNull())
      .addColumn('response', 'text')
      .addColumn('handled_by_name', 'text')
      .addColumn('handled_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('learning_resource_usage')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('resource_id', 'uuid', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('view', 'download')`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('learning_resource_usage_resource_index')
      .on('learning_resource_usage')
      .columns(['resource_id', 'kind'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('learning_resource_usage').execute();
    await database.schema.dropTable('learning_resource_reports').execute();
    await database.schema.dropTable('learning_resource_events').execute();
  },
};
