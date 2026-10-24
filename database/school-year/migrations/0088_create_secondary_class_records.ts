import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21d (YCTD-171): sổ đầu bài, điểm danh theo tiết cho THCS, THPT; sơ đồ chỗ ngồi; thi đua lớp, sao đỏ. Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `class_logs.group_no`: tiết nhóm của 21b (0 là cả lớp) ghi sổ riêng từng nhóm; khóa duy nhất thêm nhóm. Sổ cũ giữ 0;
// - `class_log_settings`: quy tắc xếp loại tiết theo cấp (không dùng, tuỳ chọn, bắt buộc khi ký tiết), nhãn A đến D, tiết
//   xếp loại thấp (C, D) phải có nhận xét, điểm thi đua lớp theo xếp loại tiết. Tiểu học giữ như 20d (tuỳ chọn, không bắt
//   nhận xét, không tính thi đua); THCS, THPT bắt buộc xếp loại, tiết C, D phải nhận xét, tính điểm thi đua;
// - `seating_charts`, `seating_assignments`: sơ đồ chỗ ngồi theo lớp (hoặc theo môn nếu trường dùng), số dãy, số bàn mỗi
//   dãy, số chỗ mỗi bàn, ngày áp dụng; mỗi học sinh một chỗ;
// - `red_star_members`: đội sao đỏ là học sinh không có tài khoản; `conduct_entries.reporter_child_id` là sao đỏ báo lỗi,
//   giáo viên trực ghi thay.
const DEFAULT_LABELS = JSON.stringify({ A: 'Tốt', B: 'Khá', C: 'Trung bình', D: 'Chưa đạt' });
const SECONDARY_POINTS = JSON.stringify({ A: 2, B: 0, C: -2, D: -5 });

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('class_logs')
      .addColumn('group_no', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`group_no between 0 and 9`),
      )
      .execute();
    await sql`alter table class_logs drop constraint class_logs_slot_unique`.execute(database);
    await sql`alter table class_logs add constraint class_logs_slot_unique
      unique (class_id, lesson_date, period_no, group_no)`.execute(database);

    await database.schema
      .createTable('class_log_settings')
      .addColumn('school_level', 'text', (column) =>
        column.primaryKey().check(sql`school_level in ('TH', 'THCS', 'THPT')`),
      )
      .addColumn('rating_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('optional')
          .check(sql`rating_mode in ('off', 'optional', 'required')`),
      )
      .addColumn('rating_labels', 'jsonb', (column) => column.notNull())
      .addColumn('low_rating_comment', 'boolean', (column) => column.notNull().defaultTo(false))
      // Điểm cộng (dương), trừ (âm) vào thi đua lớp cho mỗi tiết theo xếp loại; trống là không tính
      .addColumn('conduct_points', 'jsonb')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`insert into class_log_settings (school_level, rating_mode, rating_labels, low_rating_comment, conduct_points)
      values ('TH', 'optional', ${DEFAULT_LABELS}::jsonb, false, null),
        ('THCS', 'required', ${DEFAULT_LABELS}::jsonb, true, ${SECONDARY_POINTS}::jsonb),
        ('THPT', 'required', ${DEFAULT_LABELS}::jsonb, true, ${SECONDARY_POINTS}::jsonb)
      on conflict do nothing`.execute(database);

    await database.schema
      .createTable('seating_charts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      // Trống là sơ đồ của lớp; có môn là sơ đồ riêng của môn (tuỳ trường)
      .addColumn('subject_id', 'uuid', (column) => column.references('subjects.id'))
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('desk_columns', 'smallint', (column) => column.notNull().check(sql`desk_columns between 1 and 8`))
      .addColumn('desk_rows', 'smallint', (column) => column.notNull().check(sql`desk_rows between 1 and 15`))
      .addColumn('seats_per_desk', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(2)
          .check(sql`seats_per_desk between 1 and 4`),
      )
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('updated_by', 'uuid')
      .addColumn('updated_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`create unique index seating_charts_effective_unique on seating_charts
      (class_id, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), effective_from)`.execute(database);

    await database.schema
      .createTable('seating_assignments')
      .addColumn('chart_id', 'uuid', (column) => column.notNull().references('seating_charts.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('column_no', 'smallint', (column) => column.notNull())
      .addColumn('row_no', 'smallint', (column) => column.notNull())
      .addColumn('seat_no', 'smallint', (column) => column.notNull())
      .addPrimaryKeyConstraint('seating_assignments_pkey', ['chart_id', 'child_id'])
      .addUniqueConstraint('seating_assignments_seat_unique', ['chart_id', 'column_no', 'row_no', 'seat_no'])
      .execute();

    await database.schema
      .createTable('red_star_members')
      .addColumn('child_id', 'uuid', (column) => column.primaryKey().references('children.id'))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'inactive')`),
      )
      .addColumn('duty', 'text', (column) => column.check(sql`char_length(duty) <= 200`))
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .alterTable('conduct_entries')
      .addColumn('reporter_child_id', 'uuid', (column) => column.references('children.id'))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('conduct_entries').dropColumn('reporter_child_id').execute();
    await database.schema.dropTable('red_star_members').execute();
    await database.schema.dropTable('seating_assignments').execute();
    await database.schema.dropTable('seating_charts').execute();
    await database.schema.dropTable('class_log_settings').execute();
    await sql`delete from class_logs where group_no <> 0`.execute(database);
    await sql`alter table class_logs drop constraint class_logs_slot_unique`.execute(database);
    await sql`alter table class_logs add constraint class_logs_slot_unique
      unique (class_id, lesson_date, period_no)`.execute(database);
    await database.schema.alterTable('class_logs').dropColumn('group_no').execute();
  },
};
