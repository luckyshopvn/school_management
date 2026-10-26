import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Buổi học của chương trình gia sư và quyết định tăng thời lượng của Sở (DT-27 phần 27b, YCTD-252):
// - `tutoring_sessions`: buổi lẻ hoặc thuộc một chuỗi lặp theo tuần (`series_id`), giờ bắt đầu, kết thúc, số tiết quy đổi để đếm
//   giới hạn mỗi tuần; hủy có lý do; chỗ nối phòng video của 27a (`video_room_ref`, trống đến khi 27a gộp);
// - `tutoring_exemptions`, `tutoring_exemption_children`: quyết định của Giám đốc Sở cho học sinh học quá 02 tiết/tuần một môn
//   (số, ngày, môn, số tiết tối đa mới, tệp quyết định ở kho tệp, học sinh áp dụng).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('tutoring_sessions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('program_id', 'uuid', (column) =>
        column.notNull().references('tutoring_programs.id').onDelete('cascade'),
      )
      .addColumn('series_id', 'uuid')
      .addColumn('session_date', 'date', (column) => column.notNull())
      .addColumn('start_time', 'text', (column) => column.notNull())
      .addColumn('end_time', 'text', (column) => column.notNull())
      .addColumn('periods', 'integer', (column) => column.notNull())
      .addColumn('location', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('scheduled'))
      .addColumn('cancel_reason', 'text')
      .addColumn('video_room_ref', 'text')
      .addColumn('attendance_confirmed_at', 'timestamptz')
      .addColumn('attendance_confirmed_by_name', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_sessions_status_check', sql`status in ('scheduled', 'cancelled')`)
      .addCheckConstraint(
        'tutoring_sessions_time_check',
        sql`start_time ~ '^[0-2][0-9]:[0-5][0-9]$' and end_time ~ '^[0-2][0-9]:[0-5][0-9]$' and end_time > start_time and periods > 0`,
      )
      .execute();
    await database.schema
      .createIndex('tutoring_sessions_program_idx')
      .on('tutoring_sessions')
      .columns(['program_id', 'session_date'])
      .execute();

    await database.schema
      .createTable('tutoring_exemptions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('decision_no', 'text', (column) => column.notNull())
      .addColumn('decision_date', 'date', (column) => column.notNull())
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('max_periods_per_week', 'integer', (column) => column.notNull())
      .addColumn('file_key', 'text')
      .addColumn('file_name', 'text')
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('tutoring_exemptions_periods_check', sql`max_periods_per_week between 1 and 20`)
      .execute();
    await database.schema
      .createTable('tutoring_exemption_children')
      .addColumn('exemption_id', 'uuid', (column) =>
        column.notNull().references('tutoring_exemptions.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addPrimaryKeyConstraint('tutoring_exemption_children_pkey', ['exemption_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('tutoring_exemption_children').execute();
    await database.schema.dropTable('tutoring_exemptions').execute();
    await database.schema.dropTable('tutoring_sessions').execute();
  },
};
