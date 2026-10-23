import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 22c1 (YCTD-160): thời khoá biểu theo môn. Bảng `timetables` của phân hệ Giảng dạy (lịch hoạt động Mầm non) giữ
// nguyên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `timetable_versions`: một bản thời khoá biểu của một cấp, áp dụng từ một ngày; nháp sửa được, đã ban hành chỉ đọc (sửa
//   bằng cách tạo bản nháp mới chép từ bản cũ); bản áp dụng cho một ngày là bản đã ban hành có ngày áp dụng gần nhất không
//   sau ngày đó. `source` ghi bản nhập tay, nhập Excel hay do máy xếp (22c2) tạo;
// - `timetable_lessons`: một tiết của một lớp (thứ theo ISO, 1 là thứ Hai; tiết theo khung giờ của cấp), môn, giáo viên (mặc
//   định giáo viên được phân công môn đó ở lớp), phòng (tùy chọn). Một lớp một tiết chỉ một dòng trong một bản.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('timetable_versions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by', 'uuid')
      .addColumn('published_by_name', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('timetable_versions_status_check', sql`status in ('draft', 'published')`)
      .addCheckConstraint('timetable_versions_source_check', sql`source in ('manual', 'import', 'generator')`)
      .execute();

    await database.schema
      .createTable('timetable_lessons')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('version_id', 'uuid', (column) =>
        column.notNull().references('timetable_versions.id').onDelete('cascade'),
      )
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('weekday', 'smallint', (column) => column.notNull().check(sql`weekday between 1 and 7`))
      .addColumn('period_no', 'smallint', (column) => column.notNull().check(sql`period_no between 1 and 15`))
      .addColumn('subject_id', 'uuid', (column) => column.notNull().references('subjects.id'))
      .addColumn('teacher_user_id', 'uuid')
      .addColumn('teacher_name', 'text')
      .addColumn('room_id', 'uuid', (column) => column.references('rooms.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('timetable_lessons_slot_unique', ['version_id', 'class_id', 'weekday', 'period_no'])
      .execute();
    await database.schema
      .createIndex('timetable_lessons_teacher_index')
      .on('timetable_lessons')
      .columns(['version_id', 'teacher_user_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('timetable_lessons').execute();
    await database.schema.dropTable('timetable_versions').execute();
  },
};
