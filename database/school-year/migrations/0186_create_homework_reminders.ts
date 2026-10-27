import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28f (YCTD-276): nhật ký nhắc bài về nhà. Việc nền gửi bốn loại nhắc (đã giao, sắp đến hạn, chưa nộp, đã trả) tới phụ
// huynh và tài khoản học của học sinh, gộp nhiều bài của một em trong một lượt thành một thông báo; mỗi bài, mỗi em, mỗi loại chỉ
// nhắc một lần nên dòng ở đây là khóa chống gửi trùng (kể cả khi nhiều bản máy chủ cùng chạy)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('homework_reminders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) =>
        column.notNull().check(sql`kind in ('assigned', 'due_soon', 'missing', 'returned')`),
      )
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('homework_reminders_unique', ['kind', 'assignment_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('homework_reminders').execute();
  },
};
