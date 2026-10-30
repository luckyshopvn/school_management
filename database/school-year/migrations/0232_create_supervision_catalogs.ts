import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Giám thị và rèn luyện từng học sinh, lát L1 (YCTD-391): danh mục dùng chung cho các lát sau
// - `school_zones`: khu vực trong trường (sân trước, cổng chính, hành lang tầng 2...); ghi nhận rèn luyện ghi tên khu vực, không
//   ghi tọa độ (vị trí chính xác là dữ liệu nhạy cảm, Điều 4 Nghị định 356/2025/NĐ-CP); cảnh báo camera (phiên camera, YCTD-389)
//   gắn vùng ảnh vào một khu vực;
// - `student_rule_items`: danh mục nội quy của trường (vi phạm, khen) theo cấp, cách báo phụ huynh; mục có gắn tiêu chí nề nếp
//   lớp (`conduct_criteria`) thì ghi nhận từng học sinh ghi thêm điểm cho lớp (Eric chọn ngày 2026-10-30);
// - `supervision_assignments`: phân công trực của giám thị theo nhân sự, khối, khu vực, thứ trong tuần, giờ; dùng để tra người
//   đang trực một khu vực ở một thời điểm. Danh sách khối hoặc khu vực trống nghĩa là mọi khối, mọi khu vực
const SCHOOL_LEVELS = `'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('school_zones')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('name', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(name) between 1 and 100`),
      )
      .addColumn('description', 'text', (column) => column.check(sql`char_length(description) <= 500`))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_zones_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('student_rule_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 30`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      // Báo phụ huynh khi có ghi nhận: không báo, báo ngay, gộp vào tin cuối ngày
      .addColumn('parent_notice', 'text', (column) => column.notNull().defaultTo('daily_digest'))
      // Tiêu chí nề nếp lớp cùng cấp; có thì mỗi ghi nhận ghi thêm một dòng điểm cho lớp của học sinh
      .addColumn('class_criterion_id', 'uuid', (column) => column.references('conduct_criteria.id'))
      .addColumn('order_no', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('student_rule_items_level_code_unique', ['school_level', 'code'])
      .addCheckConstraint('student_rule_items_kind_check', sql`kind in ('violation', 'commendation')`)
      .addCheckConstraint(
        'student_rule_items_parent_notice_check',
        sql`parent_notice in ('none', 'immediate', 'daily_digest')`,
      )
      .addCheckConstraint('student_rule_items_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('supervision_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('grade_levels', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .addColumn('zone_ids', sql`uuid[]`, (column) => column.notNull().defaultTo(sql`'{}'::uuid[]`))
      // Thứ trong tuần: 1 là thứ hai, 7 là chủ nhật
      .addColumn('weekdays', sql`smallint[]`, (column) =>
        column
          .notNull()
          .check(sql`cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]`),
      )
      // Giờ theo giờ Việt Nam, dạng HH:MM
      .addColumn('start_time', 'text', (column) =>
        column.notNull().check(sql`start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
      )
      .addColumn('end_time', 'text', (column) =>
        column.notNull().check(sql`end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
      )
      .addColumn('from_date', 'date')
      .addColumn('to_date', 'date')
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 500`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('updated_by_name', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('supervision_assignments_time_check', sql`start_time < end_time`)
      .addCheckConstraint(
        'supervision_assignments_date_check',
        sql`from_date is null or to_date is null or from_date <= to_date`,
      )
      .addCheckConstraint('supervision_assignments_status_check', sql`status in ('active', 'inactive')`)
      .execute();
    await database.schema
      .createIndex('supervision_assignments_staff_index')
      .on('supervision_assignments')
      .column('staff_id')
      .execute();
  },
  async down(database) {
    for (const table of ['supervision_assignments', 'student_rule_items', 'school_zones']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
