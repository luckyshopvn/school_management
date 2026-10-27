import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28f (YCTD-276): bài về nhà là bài tập 28c có ngữ cảnh `homework`.
// - `assignments` thêm tiết của sổ đầu bài đã giao bài (`class_log_id`, tiết nhóm 21b thì có `group_no`) và lý do khi Ban Giám hiệu
//   phát hành vượt quy tắc chặn.
// - `homework_policies`: quy tắc khối lượng do trường tự đặt theo cấp, khối (GD-143, Eric chốt 2026-10-26: nền tảng không đặt giới
//   hạn mặc định, chưa có dòng nào là không chặn, không cảnh báo). Khối 0 là quy tắc chung của cấp; quy tắc của khối thay quy tắc
//   chung. Ô `basis` để trường ghi văn bản của Sở, của trường làm căn cứ.
// - `homework_acknowledgements`: phụ huynh bấm "Đã xem cùng con" trên bài về nhà của con
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('assignments')
      .addColumn('class_log_id', 'uuid', (column) => column.references('class_logs.id').onDelete('set null'))
      .addColumn('group_no', 'smallint', (column) => column.check(sql`group_no is null or group_no between 0 and 9`))
      .addColumn('policy_override_reason', 'text', (column) =>
        column.check(sql`policy_override_reason is null or char_length(policy_override_reason) <= 500`),
      )
      .addColumn('policy_override_by', 'uuid')
      .execute();
    await sql`create index assignments_class_log_index on assignments (class_log_id)
      where class_log_id is not null`.execute(database);

    await database.schema
      .createTable('homework_policies')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('TH', 'THCS', 'THPT')`),
      )
      .addColumn('grade', 'smallint', (column) =>
        column
          .notNull()
          .defaultTo(0)
          .check(sql`grade between 0 and 12`),
      )
      .addColumn('no_homework', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('max_items_per_day', 'smallint', (column) =>
        column.check(sql`max_items_per_day is null or max_items_per_day between 1 and 20`),
      )
      .addColumn('max_minutes_per_day', 'smallint', (column) =>
        column.check(sql`max_minutes_per_day is null or max_minutes_per_day between 5 and 600`),
      )
      // Thứ trong tuần không để hạn bài về nhà (1 là thứ Hai, 7 là Chủ nhật)
      .addColumn('blocked_weekdays', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('skip_holidays', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('action', 'text', (column) =>
        column
          .notNull()
          .defaultTo('warn')
          .check(sql`action in ('warn', 'block')`),
      )
      .addColumn('basis', 'text', (column) => column.check(sql`basis is null or char_length(basis) <= 1000`))
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('homework_policies_scope_unique', ['school_level', 'grade'])
      .execute();

    await database.schema
      .createTable('homework_acknowledgements')
      .addColumn('assignment_id', 'uuid', (column) => column.notNull().references('assignments.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('guardian_user_id', 'uuid', (column) => column.notNull())
      .addColumn('guardian_name', 'text', (column) => column.notNull())
      .addColumn('acknowledged_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('homework_acknowledgements_pkey', ['assignment_id', 'child_id', 'guardian_user_id'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('homework_acknowledgements').execute();
    await database.schema.dropTable('homework_policies').execute();
    await database.schema.dropIndex('assignments_class_log_index').ifExists().execute();
    await database.schema
      .alterTable('assignments')
      .dropColumn('policy_override_by')
      .dropColumn('policy_override_reason')
      .dropColumn('group_no')
      .dropColumn('class_log_id')
      .execute();
  },
};
