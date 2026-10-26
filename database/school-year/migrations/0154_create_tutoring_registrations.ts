import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đăng ký và điểm danh của chương trình gia sư (DT-27 phần 27b, YCTD-252):
// - `tutoring_registrations`: đơn đăng ký của cha mẹ gửi trên ứng dụng phụ huynh (bản chụp văn bản mẫu đơn lúc gửi), giáo viên chủ
//   nhiệm hoặc quản trị duyệt, cha mẹ rút được; mỗi học sinh một đơn còn hiệu lực ở mỗi chương trình;
// - `tutoring_attendance`: điểm danh từng buổi (có mặt, muộn, về sớm, vắng); nguồn là nhật ký vào ra phòng video (27a) hoặc giáo
//   viên; giáo viên xác nhận; vắng thì báo cha mẹ một lần;
// - `tutoring_room_events`: chỗ nối nhật ký vào ra phòng của 27a (27b chỉ nhận sự kiện và suy ra điểm danh gợi ý, chưa dựng video).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('tutoring_registrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('program_id', 'uuid', (column) => column.notNull().references('tutoring_programs.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('guardian_user_id', 'uuid', (column) => column.notNull())
      .addColumn('guardian_name', 'text', (column) => column.notNull())
      .addColumn('form_text', 'text', (column) => column.notNull())
      .addColumn('form_hash', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('submitted_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('decided_by_name', 'text')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addColumn('withdrawn_at', 'timestamptz')
      .addCheckConstraint(
        'tutoring_registrations_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'withdrawn')`,
      )
      .execute();
    await sql`create unique index tutoring_registrations_active_idx on tutoring_registrations (program_id, child_id)
      where status in ('pending', 'approved')`.execute(database);

    await database.schema
      .createTable('tutoring_attendance')
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('tutoring_sessions.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('joined_at', 'timestamptz')
      .addColumn('left_at', 'timestamptz')
      .addColumn('note', 'text')
      .addColumn('confirmed_by_name', 'text')
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('guardian_notified_at', 'timestamptz')
      .addPrimaryKeyConstraint('tutoring_attendance_pkey', ['session_id', 'child_id'])
      .addCheckConstraint('tutoring_attendance_status_check', sql`status in ('present', 'late', 'left_early', 'absent')`)
      .addCheckConstraint('tutoring_attendance_source_check', sql`source in ('room_log', 'teacher')`)
      .execute();

    await database.schema
      .createTable('tutoring_room_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('session_id', 'uuid', (column) => column.notNull().references('tutoring_sessions.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('at', 'timestamptz', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .addCheckConstraint('tutoring_room_events_kind_check', sql`kind in ('join', 'leave')`)
      .execute();
    await database.schema
      .createIndex('tutoring_room_events_session_idx')
      .on('tutoring_room_events')
      .columns(['session_id', 'child_id', 'at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_room_events').execute();
    await database.schema.dropTable('tutoring_attendance').execute();
    await database.schema.dropTable('tutoring_registrations').execute();
  },
};
