import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Ghi hình lớp video (DT-27 phần 27a, YCTD-251; tài liệu 47 mục 19.2 phần 3, 19.5). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11 ở chỗ kế hoạch chưa chốt:
// - trong trường ghi hình tắt mặc định (GD-131): chương trình bật `recording_enabled`, phòng của buổi chỉ ghi được khi mọi học sinh
//   có đơn được duyệt đều có đồng ý ghi hình còn hiệu lực của cha mẹ (`video_recording_consents`, lưu bản chụp văn bản và mã băm,
//   rút lại được);
// - bản ghi ở kho tệp theo `storageKey('video-recordings', …)`, hết hạn theo cấu hình trường (GD-132), giữ lại khi có lý do giữ
//   (tranh chấp, báo cáo), việc nền xóa tệp khi hết hạn; mỗi lần xem ghi `video_recording_views`; không có nút tải xuống.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('tutoring_programs')
      .addColumn('recording_enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();

    await database.schema
      .createTable('video_recording_consents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('program_id', 'uuid', (column) =>
        column.notNull().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('guardian_user_id', 'uuid', (column) => column.notNull())
      .addColumn('guardian_name', 'text', (column) => column.notNull())
      .addColumn('consent_text', 'text', (column) => column.notNull())
      .addColumn('consent_hash', 'text', (column) => column.notNull())
      .addColumn('consented_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('withdrawn_at', 'timestamptz')
      .execute();
    await sql`create unique index video_recording_consents_active_unique on video_recording_consents (program_id, child_id)
      where withdrawn_at is null`.execute(database);

    await database.schema
      .createTable('video_recordings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) => column.notNull().references('video_rooms.id'))
      .addColumn('egress_id', 'text', (column) => column.unique())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('recording'))
      .addColumn('started_by_name', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('ended_at', 'timestamptz')
      .addColumn('size_bytes', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('hold_reason', 'text')
      .addColumn('deleted_at', 'timestamptz')
      .addCheckConstraint('video_recordings_status_check', sql`status in ('recording', 'ready', 'failed', 'deleted')`)
      .addCheckConstraint('video_recordings_size_check', sql`size_bytes >= 0`)
      .execute();
    await database.schema
      .createIndex('video_recordings_expires_index')
      .on('video_recordings')
      .columns(['status', 'expires_at'])
      .execute();

    await database.schema
      .createTable('video_recording_views')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('recording_id', 'uuid', (column) =>
        column.notNull().references('video_recordings.id').onDelete('cascade'),
      )
      .addColumn('viewer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('viewer_name', 'text', (column) => column.notNull())
      .addColumn('viewed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('video_recording_views').execute();
    await database.schema.dropTable('video_recordings').execute();
    await database.schema.dropTable('video_recording_consents').execute();
    await database.schema.alterTable('tutoring_programs').dropColumn('recording_enabled').execute();
  },
};
