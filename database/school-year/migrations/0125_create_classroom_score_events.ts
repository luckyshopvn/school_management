import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23b (YCTD-212): bảng điểm nhanh của công cụ lớp học. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `classroom_score_events`: mỗi lần cộng, trừ điểm của một nhóm hoặc một học sinh trong một buổi (`session_key` do máy giáo
//   viên sinh cho mỗi buổi). `client_id` do máy sinh để gửi lại từ hàng đợi ngoại tuyến không tạo dòng trùng; `occurred_at`
//   là thời điểm bấm thật trên máy, tổng điểm là tổng các dòng nên hai máy cùng ghi một buổi vẫn cộng đúng, thứ tự theo thời điểm;
// - dòng chỉ là nháp của buổi học. Điểm chỉ vào nề nếp, thi đua (`conduct_entries`, DT-21) khi giáo viên chọn tiêu chí và xác
//   nhận: các dòng được xác nhận ghi `conduct_entry_id`, `confirmed_at`, không xác nhận lại lần hai; không xác nhận thì bỏ buổi
//   (xóa dòng) và không có gì vào nề nếp
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('classroom_score_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('client_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('session_key', 'uuid', (column) => column.notNull())
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('target_kind', 'text', (column) => column.notNull())
      // Tên nhóm theo bản chia nhóm lúc chấm (target_kind = group); mã học sinh khi chấm cho từng học sinh
      .addColumn('group_name', 'text', (column) => column.check(sql`char_length(group_name) between 1 and 60`))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('delta', 'integer', (column) => column.notNull().check(sql`delta between -50 and 50 and delta <> 0`))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 200`))
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull())
      .addColumn('conduct_entry_id', 'uuid', (column) => column.references('conduct_entries.id').onDelete('set null'))
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('classroom_score_events_target_check', sql`target_kind in ('group', 'student')`)
      .addCheckConstraint(
        'classroom_score_events_target_ref_check',
        sql`(target_kind = 'group' and group_name is not null and child_id is null)
          or (target_kind = 'student' and child_id is not null and group_name is null)`,
      )
      .execute();
    await database.schema
      .createIndex('classroom_score_events_session_index')
      .on('classroom_score_events')
      .columns(['class_id', 'session_key', 'occurred_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('classroom_score_events').execute();
  },
};
