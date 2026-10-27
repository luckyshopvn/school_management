import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): chương và hoạt động của lớp học trực tuyến. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Hai tầng chương (chủ đề) và hoạt động; "bài" là tiêu đề gom hoạt động trong chương (`lesson_label`), không thành tầng thứ ba.
// - Loại hoạt động là danh mục cắm được: ràng buộc liệt kê sẵn mọi loại của kế hoạch DT-28 (28b làm `resource`, `page`,
//   `link`; `exam` khi 23a gộp; các loại khác do 28c, 28e, 28g, 28h đăng ký) để phần sau không phải đổi bảng.
// - Hình thức dạy học trực tuyến của hoạt động theo Thông tư 09/2021/TT-BGDĐT Điều 2 khoản 3, 4: `support` (hỗ trợ dạy trực
//   tiếp, mặc định) hoặc `replace` (thay thế, chỉ chọn được khi có quyết định của Hiệu trưởng còn hiệu lực cho lớp).
// - Điều kiện mở lưu JSON `{ mode: 'all' | 'any', rules: [...] }`; giáo viên mở riêng cho một học sinh ở `activity_exceptions`.
// - `template_item_key` gắn hoạt động với mục của khoá học mẫu; `edited_locally` cho biết giáo viên đã sửa để khi nhận cập
//   nhật của mẫu không ghi đè.
const ACTIVITY_KINDS = [
  'resource',
  'page',
  'link',
  'exam',
  'live_session',
  'assignment',
  'discussion',
  'question_board',
  'group_work',
  'scorm',
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('course_sections')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('planned_week', 'smallint', (column) => column.check(sql`planned_week between 1 and 60`))
      .addColumn('template_section_key', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('course_sections_space_index')
      .on('course_sections')
      .columns(['space_id', 'position'])
      .execute();

    await database.schema
      .createTable('course_activities')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('space_id', 'uuid', (column) => column.notNull().references('course_spaces.id').onDelete('cascade'))
      .addColumn('section_id', 'uuid', (column) =>
        column.notNull().references('course_sections.id').onDelete('cascade'),
      )
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql.raw(`kind in (${ACTIVITY_KINDS.map((kind) => `'${kind}'`).join(', ')})`)),
      )
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 300`))
      .addColumn('lesson_label', 'text', (column) => column.check(sql`char_length(lesson_label) <= 200`))
      .addColumn('instructions', 'text', (column) => column.check(sql`char_length(instructions) <= 5000`))
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('draft')
          .check(sql`status in ('draft', 'published')`),
      )
      .addColumn('required', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('teaching_mode', 'text', (column) =>
        column
          .notNull()
          .defaultTo('support')
          .check(sql`teaching_mode in ('support', 'replace')`),
      )
      .addColumn('estimated_minutes', 'smallint', (column) =>
        column.check(sql`estimated_minutes is null or estimated_minutes between 1 and 600`),
      )
      .addColumn('opens_at', 'timestamptz')
      .addColumn('due_at', 'timestamptz')
      .addColumn('closes_at', 'timestamptz')
      .addColumn('group_set_id', 'uuid')
      .addColumn('open_rules', 'jsonb')
      .addColumn('completion_rule', 'text', (column) =>
        column
          .notNull()
          .defaultTo('view')
          .check(sql`completion_rule in ('view', 'submit', 'pass', 'teacher')`),
      )
      .addColumn('graded', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('weight', 'numeric(5, 2)', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`weight between 0 and 100`),
      )
      .addColumn('pass_score', 'numeric(4, 2)', (column) =>
        column.check(sql`pass_score is null or pass_score between 0 and 10`),
      )
      .addColumn('planned_week', 'smallint', (column) => column.check(sql`planned_week between 1 and 60`))
      .addColumn('settings', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('template_item_key', 'text')
      .addColumn('edited_locally', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'course_activities_dates_check',
        sql`(opens_at is null or due_at is null or opens_at <= due_at) and (due_at is null or closes_at is null or due_at <= closes_at)`,
      )
      .execute();
    await database.schema
      .createIndex('course_activities_space_index')
      .on('course_activities')
      .columns(['space_id', 'section_id', 'position'])
      .execute();
    await database.schema
      .createIndex('course_activities_due_index')
      .on('course_activities')
      .columns(['due_at'])
      .execute();

    await database.schema
      .createTable('activity_exceptions')
      .addColumn('activity_id', 'uuid', (column) =>
        column.notNull().references('course_activities.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('unlocked', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('due_at', 'timestamptz')
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('granted_by', 'uuid', (column) => column.notNull())
      .addColumn('granted_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('activity_exceptions_pkey', ['activity_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('activity_exceptions').execute();
    await database.schema.dropTable('course_activities').execute();
    await database.schema.dropTable('course_sections').execute();
  },
};
