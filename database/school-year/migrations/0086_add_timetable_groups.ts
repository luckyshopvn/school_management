import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21b (YCTD-169): lớp theo tổ hợp, học nhóm (THPT). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `timetable_lessons.group_no`: 0 là tiết cả lớp, 1 đến 9 là nhóm học môn lựa chọn cùng tiết (một lớp có thể có nhiều tiết
//   của các nhóm khác nhau ở cùng ô); tiết cũ giữ 0 nên Mầm non, Tiểu học không đổi;
// - khóa duy nhất của tiết thêm `group_no`: một lớp, một nhóm, một tiết chỉ một dòng; tiết cả lớp cùng ô với tiết nhóm là xung
//   đột (kiểm ở `findTimetableConflicts`, không ở cơ sở dữ liệu)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('timetable_lessons')
      .addColumn('group_no', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`group_no between 0 and 9`),
      )
      .execute();
    await sql`alter table timetable_lessons drop constraint timetable_lessons_slot_unique`.execute(database);
    await sql`alter table timetable_lessons add constraint timetable_lessons_slot_unique
      unique (version_id, class_id, weekday, period_no, group_no)`.execute(database);
  },
  async down(database) {
    await sql`delete from timetable_lessons where group_no <> 0`.execute(database);
    await sql`alter table timetable_lessons drop constraint timetable_lessons_slot_unique`.execute(database);
    await sql`alter table timetable_lessons add constraint timetable_lessons_slot_unique
      unique (version_id, class_id, weekday, period_no)`.execute(database);
    await database.schema.alterTable('timetable_lessons').dropColumn('group_no').execute();
  },
};
