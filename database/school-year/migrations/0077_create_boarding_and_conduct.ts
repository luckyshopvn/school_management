import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20b (YCTD-159): bán trú Tiểu học; nề nếp và thi đua lớp. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - bán trú lớp ngoài Mầm non không dùng điểm danh theo ngày: danh sách ăn của ngày là học sinh đăng ký dịch vụ bán trú của
//   tháng trừ học sinh báo cắt suất (`boarding_meal_cuts`); giáo viên chủ nhiệm chốt suất của lớp trong ngày
//   (`boarding_meal_days`), chốt xong thì số suất là số chính thức cho bếp và tiền ăn (ngày ăn thực tế); mở lại khi cần sửa;
// - nề nếp, thi đua lớp tuỳ trường: `conduct_settings` (một dòng: bật, điểm nền mỗi tuần); tiêu chí cộng hoặc trừ điểm
//   (`conduct_criteria`, cấu hình được, theo cấp); ghi điểm theo lớp và ngày (`conduct_entries`: số lần, điểm, người ghi, ghi
//   thay đội cờ đỏ). Xếp hạng tính khi xem (tuần, tháng, học kỳ), không lưu. Tách khỏi thi đua cán bộ (22d)
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('boarding_meal_days')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('meal_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('closed'))
      // Số suất lúc chốt (học sinh đăng ký trừ cắt suất), giữ lại để đối chiếu với bếp
      .addColumn('headcount', 'integer', (column) => column.notNull().check(sql`headcount >= 0`))
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_by_name', 'text')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('boarding_meal_days_status_check', sql`status in ('closed', 'reopened')`)
      .addUniqueConstraint('boarding_meal_days_class_date_unique', ['class_id', 'meal_date'])
      .execute();

    await database.schema
      .createTable('boarding_meal_cuts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('meal_date', 'date', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.check(sql`char_length(reason) <= 500`))
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('boarding_meal_cuts_source_check', sql`source in ('parent', 'teacher', 'school')`)
      .addUniqueConstraint('boarding_meal_cuts_child_date_unique', ['child_id', 'meal_date'])
      .execute();
    await database.schema
      .createIndex('boarding_meal_cuts_class_date_index')
      .on('boarding_meal_cuts')
      .columns(['class_id', 'meal_date'])
      .execute();

    await database.schema
      .createTable('conduct_settings')
      .addColumn('id', 'smallint', (column) =>
        column
          .primaryKey()
          .defaultTo(1)
          .check(sql`id = 1`),
      )
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('base_points', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(100)
          .check(sql`base_points between 0 and 1000`),
      )
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`insert into conduct_settings (id) values (1) on conflict do nothing`.execute(database);

    await database.schema
      .createTable('conduct_criteria')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 30`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('kind', 'text', (column) => column.notNull())
      // Điểm mỗi lần ghi (số dương; tiêu chí trừ điểm trừ đi số này)
      .addColumn('points', 'integer', (column) => column.notNull().check(sql`points between 1 and 100`))
      .addColumn('school_level', 'text', (column) =>
        column
          .notNull()
          .defaultTo('TH')
          .check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('conduct_criteria_kind_check', sql`kind in ('plus', 'minus')`)
      .addCheckConstraint('conduct_criteria_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('conduct_entries')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('criterion_id', 'uuid', (column) => column.notNull().references('conduct_criteria.id'))
      .addColumn('entry_date', 'date', (column) => column.notNull())
      .addColumn('quantity', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(1)
          .check(sql`quantity between 1 and 50`),
      )
      // Điểm của dòng đã tính dấu (cộng dương, trừ âm) lúc ghi, để đổi điểm tiêu chí không đổi số đã ghi
      .addColumn('points', 'integer', (column) => column.notNull())
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      // Học sinh đội cờ đỏ không có tài khoản: giáo viên ghi thay, ghi tên người ghi thực tế ở đây
      .addColumn('reported_by', 'text', (column) => column.check(sql`char_length(reported_by) <= 100`))
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('recorded_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createIndex('conduct_entries_class_date_index')
      .on('conduct_entries')
      .columns(['class_id', 'entry_date'])
      .execute();
  },
  async down(database) {
    for (const table of [
      'conduct_entries',
      'conduct_criteria',
      'conduct_settings',
      'boarding_meal_cuts',
      'boarding_meal_days',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
