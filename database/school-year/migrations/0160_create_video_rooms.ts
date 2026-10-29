import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lớp video trực tiếp (DT-27 phần 27a, YCTD-251; tài liệu 47 mục 19.5). Số 0160, 0161 thay số giữ sẵn 0150, 0151 vì phải chạy sau
// bảng buổi gia sư của 27b (0153). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11 ở chỗ
// kế hoạch chưa chốt:
// - `video_settings` một dòng của trường: số người dự tối đa một phòng (GD-130, mặc định 8 cả gia sư), thời hạn giữ bản ghi
//   (GD-132, mặc định 30 ngày), bật phòng chờ;
// - `video_rooms`: phòng gắn với một buổi gia sư (27b) hoặc phòng tức thời của giáo viên; một buổi một phòng; tên phòng ở máy chủ
//   video có tiền tố trường (`videoRoomName`);
// - `video_room_admissions`: phòng chờ, chủ phòng cho vào; mã vào phòng chỉ cấp cho người đã được cho vào;
// - `video_room_events`: nhật ký vào ra phòng từ sự kiện gọi lại của máy chủ video (nguồn điểm danh của 27b, đo phút theo gói).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('video_settings')
      .addColumn('id', 'boolean', (column) => column.primaryKey().defaultTo(true))
      .addColumn('max_participants', 'integer', (column) => column.notNull().defaultTo(8))
      .addColumn('recording_retention_days', 'integer', (column) => column.notNull().defaultTo(30))
      .addColumn('lobby_enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('video_settings_single_check', sql`id`)
      .addCheckConstraint('video_settings_participants_check', sql`max_participants between 2 and 50`)
      .addCheckConstraint('video_settings_retention_check', sql`recording_retention_days between 7 and 365`)
      .execute();
    await database
      .insertInto('video_settings' as never)
      .values({ id: true } as never)
      .execute();

    await database.schema
      .createTable('video_rooms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('tutoring_session_id', 'uuid', (column) => column.references('tutoring_sessions.id'))
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('host_user_id', 'uuid', (column) => column.notNull())
      .addColumn('host_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('max_participants', 'integer', (column) => column.notNull())
      .addColumn('lobby_enabled', 'boolean', (column) => column.notNull())
      .addColumn('recording_allowed', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('ended_at', 'timestamptz')
      .addCheckConstraint('video_rooms_kind_check', sql`kind in ('session', 'instant')`)
      .addCheckConstraint('video_rooms_status_check', sql`status in ('open', 'ended')`)
      .addCheckConstraint('video_rooms_session_check', sql`(kind = 'session') = (tutoring_session_id is not null)`)
      .execute();
    await sql`create unique index video_rooms_session_unique on video_rooms (tutoring_session_id)
      where tutoring_session_id is not null`.execute(database);

    await database.schema
      .createTable('video_room_admissions')
      .addColumn('room_id', 'uuid', (column) => column.notNull().references('video_rooms.id').onDelete('cascade'))
      .addColumn('identity', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('display_name', 'text', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('admitted_at', 'timestamptz')
      .addColumn('admitted_by_name', 'text')
      .addColumn('can_speak', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('can_share', 'boolean', (column) => column.notNull().defaultTo(false))
      .addPrimaryKeyConstraint('video_room_admissions_pkey', ['room_id', 'identity'])
      .addCheckConstraint('video_room_admissions_role_check', sql`role in ('host', 'student', 'guardian', 'observer')`)
      .execute();

    await database.schema
      .createTable('video_room_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) => column.notNull().references('video_rooms.id').onDelete('cascade'))
      .addColumn('identity', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('at', 'timestamptz', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .addCheckConstraint('video_room_events_kind_check', sql`kind in ('join', 'leave')`)
      .execute();
    await database.schema
      .createIndex('video_room_events_room_index')
      .on('video_room_events')
      .columns(['room_id', 'at'])
      .execute();
    await database.schema.createIndex('video_room_events_at_index').on('video_room_events').column('at').execute();
  },
  async down(database) {
    await database.schema.dropTable('video_room_events').execute();
    await database.schema.dropTable('video_room_admissions').execute();
    await database.schema.dropTable('video_rooms').execute();
    await database.schema.dropTable('video_settings').execute();
  },
};
