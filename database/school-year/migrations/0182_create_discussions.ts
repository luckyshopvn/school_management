import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28e (YCTD-275): một bộ máy thảo luận cho thông báo lớp, diễn đàn lớp, hỏi đáp (phạm vi lớp học trực tuyến) và bảng
// tin của không gian học nhóm (phạm vi nhóm của bộ nhóm 28a). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - Không có tin nhắn riêng giữa hai học sinh: chủ đề luôn thuộc một lớp học trực tuyến hoặc một nhóm; câu hỏi riêng chỉ người hỏi
//   và giáo viên thấy.
// - Xóa của học sinh là ẩn (`hidden_at`), nội dung vẫn lưu cho giáo viên và người xử lý; lọc thông tin liên lạc ghi `flags`.
// - Báo cáo vi phạm vào hàng chờ của trường có hạn xử lý; người xử lý ghi kết quả, có thể ẩn nội dung, tạm khóa quyền viết.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('discussion_threads')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('scope', 'text', (column) => column.notNull().check(sql`scope in ('course_space', 'group')`))
      .addColumn('space_id', 'uuid', (column) => column.references('course_spaces.id').onDelete('cascade'))
      .addColumn('group_id', 'uuid', (column) => column.references('child_groups.id'))
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('announcement', 'forum', 'question', 'group_board')`),
      )
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 5000`))
      .addColumn('section_id', 'uuid', (column) => column.references('course_sections.id').onDelete('set null'))
      .addColumn('activity_id', 'uuid', (column) => column.references('course_activities.id').onDelete('set null'))
      .addColumn('private', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'locked')`),
      )
      .addColumn('accepted_post_id', 'uuid')
      .addColumn('author_user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('author_kind', 'text', (column) =>
        column.notNull().check(sql`author_kind in ('teacher', 'student', 'staff')`),
      )
      .addColumn('author_child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('flags', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('hidden_at', 'timestamptz')
      .addColumn('hidden_by', 'uuid')
      .addColumn('last_post_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'discussion_threads_target_check',
        sql`(scope = 'course_space' and space_id is not null and group_id is null and kind <> 'group_board')
          or (scope = 'group' and group_id is not null and space_id is null and kind = 'group_board')`,
      )
      .execute();
    await database.schema
      .createIndex('discussion_threads_space_index')
      .on('discussion_threads')
      .columns(['space_id', 'kind', 'last_post_at'])
      .execute();
    await database.schema
      .createIndex('discussion_threads_group_index')
      .on('discussion_threads')
      .columns(['group_id', 'last_post_at'])
      .execute();

    await database.schema
      .createTable('discussion_posts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('thread_id', 'uuid', (column) =>
        column.notNull().references('discussion_threads.id').onDelete('cascade'),
      )
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 5000`))
      .addColumn('author_user_id', 'uuid', (column) => column.notNull())
      .addColumn('author_name', 'text', (column) => column.notNull())
      .addColumn('author_kind', 'text', (column) =>
        column.notNull().check(sql`author_kind in ('teacher', 'student', 'staff')`),
      )
      .addColumn('author_child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('flags', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('hidden_at', 'timestamptz')
      .addColumn('hidden_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('discussion_posts_thread_index')
      .on('discussion_posts')
      .columns(['thread_id', 'created_at'])
      .execute();

    await database.schema
      .createTable('discussion_reports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('thread_id', 'uuid', (column) =>
        column.notNull().references('discussion_threads.id').onDelete('cascade'),
      )
      .addColumn('post_id', 'uuid', (column) => column.references('discussion_posts.id').onDelete('cascade'))
      .addColumn('source', 'text', (column) => column.notNull().check(sql`source in ('report', 'filter')`))
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('reporter_user_id', 'uuid')
      .addColumn('reporter_kind', 'text', (column) =>
        column.check(sql`reporter_kind is null or reporter_kind in ('teacher', 'student', 'guardian', 'staff')`),
      )
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('open')
          .check(sql`status in ('open', 'resolved', 'dismissed')`),
      )
      .addColumn('due_at', 'timestamptz', (column) => column.notNull())
      .addColumn('resolution', 'text', (column) =>
        column.check(sql`resolution is null or char_length(resolution) <= 1000`),
      )
      .addColumn('resolved_by', 'uuid')
      .addColumn('resolved_by_name', 'text')
      .addColumn('resolved_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('discussion_reports_status_index')
      .on('discussion_reports')
      .columns(['status', 'due_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('discussion_reports').execute();
    await database.schema.dropTable('discussion_posts').execute();
    await database.schema.dropTable('discussion_threads').execute();
  },
};
