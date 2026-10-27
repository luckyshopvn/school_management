import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28b (YCTD-272): quyết định hình thức dạy học trực tuyến và nội quy dạy học trực tuyến theo Thông tư
// 09/2021/TT-BGDĐT (Điều 5 khoản 4, Điều 6, Điều 15 khoản 1 điểm a, khoản 3). Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11:
// - Mọi lớp mặc định dạy học trực tuyến hỗ trợ; dạy thay thế chỉ khi Hiệu trưởng nhập quyết định (số, ngày, lý do bất khả
//   kháng, phạm vi lớp, thời gian). Phạm vi trống là toàn trường. Quyết định thu hồi được, không xóa.
// - Nội quy có phiên bản; học sinh (hoặc phụ huynh khi học sinh chưa có tài khoản) xác nhận đã đọc phiên bản đang dùng
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('online_teaching_decisions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('decision_no', 'text', (column) =>
        column.notNull().check(sql`char_length(decision_no) between 1 and 100`),
      )
      .addColumn('decision_date', 'date', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 1000`))
      .addColumn('class_ids', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('starts_on', 'date', (column) => column.notNull())
      .addColumn('ends_on', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) =>
        column
          .notNull()
          .defaultTo('active')
          .check(sql`status in ('active', 'revoked')`),
      )
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('revoked_by', 'uuid')
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('online_teaching_decisions_dates_check', sql`starts_on <= ends_on`)
      .execute();

    await database.schema
      .createTable('online_learning_rules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('version', 'integer', (column) => column.notNull().unique())
      .addColumn('content', 'text', (column) => column.notNull().check(sql`char_length(content) between 1 and 20000`))
      .addColumn('published_by', 'uuid', (column) => column.notNull())
      .addColumn('published_by_name', 'text', (column) => column.notNull())
      .addColumn('published_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('online_learning_rule_acks')
      .addColumn('rule_id', 'uuid', (column) =>
        column.notNull().references('online_learning_rules.id').onDelete('cascade'),
      )
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('acknowledged_by', 'uuid', (column) => column.notNull())
      .addColumn('acknowledged_as', 'text', (column) =>
        column.notNull().check(sql`acknowledged_as in ('student', 'guardian')`),
      )
      .addColumn('acknowledged_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('online_learning_rule_acks_pkey', ['rule_id', 'child_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('online_learning_rule_acks').execute();
    await database.schema.dropTable('online_learning_rules').execute();
    await database.schema.dropTable('online_teaching_decisions').execute();
  },
};
