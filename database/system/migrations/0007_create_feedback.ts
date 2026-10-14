import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Ý kiến phản hồi gửi từ chân trang cổng quản trị (DT-15 phần 15g, YCTD-110): người gửi, đơn vị, trang đang mở, loại ý
// kiến, tiêu đề, nội dung, số điện thoại và thư điện tử liên hệ (theo biểu mẫu của Sở), ảnh chụp màn hình kèm theo; quản
// trị xử lý bằng trạng thái và trả lời. Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học; user_id, org_unit_id,
// replied_by là mã ở dịch vụ định danh và cây đơn vị (khác cơ sở dữ liệu nên không có khóa ngoại); tên người gửi, người
// trả lời ghi lại tại thời điểm thao tác
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('feedback')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid')
      .addColumn('page_url', 'text')
      .addColumn('feedback_type', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('contact_phone', 'text')
      .addColumn('contact_email', 'text')
      .addColumn('attachment_key', 'text')
      .addColumn('attachment_name', 'text')
      .addColumn('attachment_content_type', 'text')
      .addColumn('attachment_size', 'integer')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('new'))
      .addColumn('reply', 'text')
      .addColumn('replied_by', 'uuid')
      .addColumn('replied_by_name', 'text')
      .addColumn('replied_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('feedback_type_check', sql`feedback_type in ('suggestion', 'bug', 'request')`)
      .addCheckConstraint('feedback_status_check', sql`status in ('new', 'in_progress', 'resolved')`)
      .addCheckConstraint('feedback_title_check', sql`length(title) between 1 and 200`)
      .addCheckConstraint('feedback_content_check', sql`length(content) between 1 and 5000`)
      .execute();
    // Danh sách ý kiến của một người và đếm số lần gửi trong một giờ để giới hạn; danh sách quản trị lọc theo trạng thái
    await database.schema
      .createIndex('feedback_user_created_index')
      .on('feedback')
      .columns(['user_id', 'created_at'])
      .execute();
    await database.schema
      .createIndex('feedback_status_created_index')
      .on('feedback')
      .columns(['status', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('feedback').execute();
  },
};
