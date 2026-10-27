import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28e (YCTD-275): không gian học nhóm của một nhóm trong bộ nhóm (28a): việc chia việc (người làm, hạn, trạng thái),
// ghi chú chung có phiên bản (mỗi lần lưu một dòng, đọc bản mới nhất), tệp chung (ảnh, PDF). Bảng tin dùng `discussion_threads`
// phạm vi `group`. Người lập bộ nhóm và giáo viên của lớp luôn thấy mọi nội dung
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('group_tasks')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('group_id', 'uuid', (column) => column.notNull().references('child_groups.id'))
      .addColumn('title', 'text', (column) => column.notNull().check(sql`char_length(title) between 1 and 200`))
      .addColumn('assignee_child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('due_on', 'date')
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('todo')
          .check(sql`status in ('todo', 'doing', 'done')`),
      )
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema.createIndex('group_tasks_group_index').on('group_tasks').column('group_id').execute();

    await database.schema
      .createTable('group_notes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('group_id', 'uuid', (column) => column.notNull().references('child_groups.id'))
      .addColumn('version', 'integer', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) <= 20000`))
      .addColumn('edited_by', 'uuid', (column) => column.notNull())
      .addColumn('edited_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('group_notes_version_unique', ['group_id', 'version'])
      .execute();

    await database.schema
      .createTable('group_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('group_id', 'uuid', (column) => column.notNull().references('child_groups.id'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull())
      .addColumn('uploaded_by', 'uuid', (column) => column.notNull())
      .addColumn('uploaded_by_name', 'text', (column) => column.notNull())
      .addColumn('hidden_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema.createIndex('group_files_group_index').on('group_files').column('group_id').execute();
  },
  async down(database) {
    await database.schema.dropTable('group_files').execute();
    await database.schema.dropTable('group_notes').execute();
    await database.schema.dropTable('group_tasks').execute();
  },
};
