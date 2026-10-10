import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Ngày nghỉ lễ và ngày học bù, nghỉ bù chung toàn trường; chấm công của nhân sự; thuộc tính tính công của loại nghỉ
// (P08-01, P08-09, P08-10; BR-39, BR-84; YCTD-59)
export const migration: Migration = {
  async up(database) {
    // Thuộc tính riêng của từng loại danh mục; loại nghỉ phép có trường trả lương, trừ phép năm, bảo hiểm chi trả
    await database.schema
      .alterTable('catalog_items')
      .addColumn('attributes', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .execute();

    // Ngày lễ không là ngày học của trẻ và là ngày nghỉ lễ của nhân sự
    await database.schema
      .createTable('holidays')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('holiday_date', 'date', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('is_paid', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    // Thứ bảy mặc định nghỉ; học bù biến một ngày thứ bảy thành ngày học và ngày làm việc, nghỉ bù biến một ngày
    // thứ hai đến thứ sáu thành ngày nghỉ có lương
    await database.schema
      .createTable('school_day_changes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('change_date', 'date', (column) => column.notNull().unique())
      .addColumn('change_type', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'school_day_changes_type_check',
        sql`change_type in ('makeup_school_day', 'compensatory_day_off')`,
      )
      .execute();

    // Mỗi nhân sự mỗi ngày một bản ghi; giờ dạng HH:MM theo giờ Việt Nam
    await database.schema
      .createTable('attendance_logs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('work_date', 'date', (column) => column.notNull())
      .addColumn('check_in', 'text', (column) => column.notNull())
      .addColumn('check_out', 'text')
      .addColumn('worked_minutes', 'integer')
      .addColumn('late_minutes', 'integer')
      .addColumn('early_leave_minutes', 'integer')
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('updated_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('attendance_logs_staff_date_unique', ['staff_id', 'work_date'])
      .addCheckConstraint('attendance_logs_source_check', sql`source in ('self', 'manual')`)
      .addCheckConstraint(
        'attendance_logs_time_check',
        sql`check_in ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          and (check_out is null or (check_out ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and check_out > check_in))`,
      )
      .execute();
    await database.schema
      .createIndex('attendance_logs_work_date_index')
      .on('attendance_logs')
      .column('work_date')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('attendance_logs').execute();
    await database.schema.dropTable('school_day_changes').execute();
    await database.schema.dropTable('holidays').execute();
    await database.schema.alterTable('catalog_items').dropColumn('attributes').execute();
  },
};
