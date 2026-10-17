import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Công cụ xuất, nhập và mẫu gửi lên cấp trên dùng chung (DT-16 phần 16a, khảo sát mục 2.3 của Sở):
// - export_jobs: tác vụ xuất nền cho tệp lớn và danh sách "Tệp đã tạo" của từng người; tham số là bộ lọc, cột của lần xuất;
//   user_snapshot là vai trò và quyền của người tạo tại thời điểm tạo để tiến trình nền xuất đúng phạm vi; tệp lưu ở kho tệp
//   (storage_key), hết hạn thì xóa tệp và chuyển trạng thái `expired`;
// - upper_level_submissions: trạng thái gửi từng biểu mẫu lên cấp trên theo năm học (Chưa gửi, Đã gửi, Đã gửi yêu cầu mở
//   khóa, Cần gửi lại), tệp gửi và bản chụp số liệu của lần "Xuất tệp gửi" gần nhất, ngày gửi và người đánh dấu đã gửi;
//   chưa có giao diện lập trình của Bộ, Sở nên việc gửi là thủ công;
// - upper_level_submission_events: lịch sử thao tác của từng biểu mẫu (xuất tệp gửi, đánh dấu đã gửi, yêu cầu mở khóa,
//   mở khóa, từ chối, đặt trạng thái gửi lại).
// Đặt ở cơ sở dữ liệu hệ thống để giữ qua các năm học; user_id là mã ở dịch vụ định danh (khác cơ sở dữ liệu nên không có
// khóa ngoại); tên người thao tác ghi lại tại thời điểm thao tác
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('export_jobs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('user_snapshot', 'jsonb', (column) => column.notNull())
      .addColumn('report_code', 'text', (column) => column.notNull())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('format', 'text', (column) => column.notNull())
      .addColumn('parameters', 'jsonb', (column) => column.notNull())
      .addColumn('ip_address', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('row_count', 'integer')
      .addColumn('file_name', 'text')
      .addColumn('content_type', 'text')
      .addColumn('size_bytes', 'integer')
      .addColumn('storage_key', 'text')
      .addColumn('error_message', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('started_at', 'timestamptz')
      .addColumn('finished_at', 'timestamptz')
      .addColumn('expires_at', 'timestamptz')
      .addCheckConstraint('export_jobs_format_check', sql`format in ('xlsx', 'pdf')`)
      .addCheckConstraint(
        'export_jobs_status_check',
        sql`status in ('pending', 'running', 'done', 'failed', 'expired')`,
      )
      .execute();
    await database.schema
      .createIndex('export_jobs_user_created_index')
      .on('export_jobs')
      .columns(['user_id', 'created_at'])
      .execute();
    await database.schema
      .createIndex('export_jobs_status_created_index')
      .on('export_jobs')
      .columns(['status', 'created_at'])
      .execute();

    await database.schema
      .createTable('upper_level_submissions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('academic_year_id', 'uuid', (column) => column.notNull().references('academic_years.id'))
      .addColumn('form_code', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('no_data', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('data_complete', 'boolean')
      .addColumn('snapshot', 'jsonb')
      .addColumn('file_name', 'text')
      .addColumn('content_type', 'text')
      .addColumn('size_bytes', 'integer')
      .addColumn('storage_key', 'text')
      .addColumn('exported_at', 'timestamptz')
      .addColumn('exported_by', 'uuid')
      .addColumn('exported_by_name', 'text')
      .addColumn('sent_on', 'date')
      .addColumn('sent_note', 'text')
      .addColumn('sent_by', 'uuid')
      .addColumn('sent_by_name', 'text')
      .addColumn('marked_sent_at', 'timestamptz')
      .addColumn('unlock_reason', 'text')
      .addColumn('unlock_requested_by', 'uuid')
      .addColumn('unlock_requested_by_name', 'text')
      .addColumn('unlock_requested_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addUniqueConstraint('upper_level_submissions_year_form_unique', ['academic_year_id', 'form_code'])
      .addCheckConstraint(
        'upper_level_submissions_status_check',
        sql`status in ('draft', 'sent', 'unlock_requested', 'resend')`,
      )
      .execute();

    await database.schema
      .createTable('upper_level_submission_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('submission_id', 'uuid', (column) =>
        column.notNull().references('upper_level_submissions.id').onDelete('cascade'),
      )
      .addColumn('action', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('actor_id', 'uuid', (column) => column.notNull())
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'upper_level_submission_events_action_check',
        sql`action in ('export', 'mark_sent', 'unlock_request', 'unlock', 'unlock_reject', 'resend')`,
      )
      .execute();
    await database.schema
      .createIndex('upper_level_submission_events_submission_index')
      .on('upper_level_submission_events')
      .columns(['submission_id', 'created_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('upper_level_submission_events').execute();
    await database.schema.dropTable('upper_level_submissions').execute();
    await database.schema.dropTable('export_jobs').execute();
  },
};
