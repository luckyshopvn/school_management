import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28g (YCTD-277): phòng chia nhỏ của giờ học trực tuyến. Mỗi học sinh ở đúng một phòng chia nhỏ của một phòng giờ học
// (giáo viên chuyển phòng thì đổi dòng); thông báo giáo viên gửi tới mọi phòng; học sinh "gọi giáo viên" từ phòng của em
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('learning_breakout_members')
      .addColumn('parent_room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('moved_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('learning_breakout_members_pkey', ['parent_room_id', 'child_id'])
      .execute();
    await database.schema
      .createIndex('learning_breakout_members_room_index')
      .on('learning_breakout_members')
      .column('room_id')
      .execute();

    await database.schema
      .createTable('learning_live_notices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 500`))
      .addColumn('sent_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('learning_live_notices_room_index')
      .on('learning_live_notices')
      .columns(['room_id', 'created_at'])
      .execute();

    await database.schema
      .createTable('learning_live_help_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('room_id', 'uuid', (column) =>
        column.notNull().references('learning_live_rooms.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('child_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('resolved_at', 'timestamptz')
      .execute();
    await sql`create unique index learning_live_help_requests_open
      on learning_live_help_requests (room_id, child_id) where resolved_at is null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('learning_live_help_requests').execute();
    await database.schema.dropTable('learning_live_notices').execute();
    await database.schema.dropTable('learning_breakout_members').execute();
  },
};
