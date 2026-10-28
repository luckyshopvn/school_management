import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28g (YCTD-277): giờ học trực tuyến và phòng video nhóm, dùng lại bộ nối phòng video của 27a (không thêm dịch vụ video).
// Phòng của giờ học (`live_session`, gắn hoạt động của lớp học trực tuyến), phòng nhóm (`group`, gắn một nhóm của bộ nhóm) và phòng
// chia nhỏ (`breakout`, con của phòng giờ học). Mỗi hoạt động, mỗi nhóm chỉ một phòng đang mở. Không ghi hình (GD-131 của 27a giữ
// tắt). Người đang trong phòng và nhật ký vào ra để tính điểm danh gợi ý, phút theo gói và hiện "giáo viên đang xem" (GD-149).
// Học sinh tự mở phòng nhóm chỉ khi giáo viên bật cho bộ nhóm và trong giờ mở của trường (GD-144, Eric đã chốt 2026-10-28)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('learning_live_rooms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('live_session', 'group', 'breakout')`))
      .addColumn('space_id', 'uuid', (column) => column.references('course_spaces.id').onDelete('cascade'))
      .addColumn('activity_id', 'uuid', (column) => column.references('course_activities.id').onDelete('cascade'))
      .addColumn('group_id', 'uuid', (column) => column.references('child_groups.id').onDelete('cascade'))
      .addColumn('parent_room_id', 'uuid', (column) => column.references('learning_live_rooms.id').onDelete('cascade'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('opened_by', 'uuid', (column) => column.notNull())
      .addColumn('opened_by_name', 'text', (column) => column.notNull())
      .addColumn('opened_by_kind', 'text', (column) =>
        column.notNull().check(sql`opened_by_kind in ('teacher', 'student')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'ended')`),
      )
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('max_participants', 'integer', (column) =>
        column.notNull().check(sql`max_participants between 2 and 500`),
      )
      // Hạn của phòng chia nhỏ do giáo viên đặt; hết hạn thì giao diện nhắc về phòng chính
      .addColumn('ends_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('ended_at', 'timestamptz')
      .addCheckConstraint(
        'learning_live_rooms_context_check',
        sql`(kind <> 'live_session' or (activity_id is not null and space_id is not null))
          and (kind <> 'group' or group_id is not null)
          and (kind <> 'breakout' or parent_room_id is not null)`,
      )
      .execute();
    await sql`create unique index learning_live_rooms_activity_open
      on learning_live_rooms (activity_id) where kind = 'live_session' and status = 'open'`.execute(database);
    await sql`create unique index learning_live_rooms_group_open
      on learning_live_rooms (group_id) where kind = 'group' and status = 'open'`.execute(database);
    await database.schema
      .createIndex('learning_live_rooms_parent_index')
      .on('learning_live_rooms')
      .column('parent_room_id')
      .execute();

    await database.schema
      .createTable('learning_live_participants')
      .addColumn('room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('identity', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull().check(sql`role in ('host', 'student', 'observer')`))
      .addColumn('display_name', 'text', (column) => column.notNull())
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('joined_at', 'timestamptz', (column) => column.notNull())
      .addColumn('left_at', 'timestamptz')
      .addPrimaryKeyConstraint('learning_live_participants_pkey', ['room_id', 'identity'])
      .execute();

    await database.schema
      .createTable('learning_live_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('identity', 'text', (column) => column.notNull())
      .addColumn('role', 'text', (column) => column.notNull().check(sql`role in ('host', 'student', 'observer')`))
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('join', 'leave')`))
      .addColumn('at', 'timestamptz', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .execute();
    await database.schema
      .createIndex('learning_live_events_room_index')
      .on('learning_live_events')
      .columns(['room_id', 'at'])
      .execute();
    await database.schema
      .createIndex('learning_live_events_at_index')
      .on('learning_live_events')
      .column('at')
      .execute();

    // Giáo viên bật cho học sinh tự mở phòng nhóm của một bộ nhóm (tắt mặc định, GD-144)
    await database.schema
      .createTable('learning_group_room_settings')
      .addColumn('group_set_id', 'uuid', (column) =>
        column.primaryKey().references('group_sets.id').onDelete('cascade'),
      )
      .addColumn('student_open', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('learning_group_room_settings').execute();
    await database.schema.dropTable('learning_live_events').execute();
    await database.schema.dropTable('learning_live_participants').execute();
    await database.schema.dropTable('learning_live_rooms').execute();
  },
};
