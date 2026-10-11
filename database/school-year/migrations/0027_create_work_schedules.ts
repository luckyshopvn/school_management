import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lịch nghỉ và lịch công tác của nhân sự: lập nháp, công bố cho nhân sự; ngày công tác chưa chấm công được tính là ngày
// làm việc (P08-02; YCTD-68)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('work_schedules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('schedule_date', 'date', (column) => column.notNull())
      .addColumn('schedule_type', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('published_at', 'timestamptz')
      .addColumn('published_by', 'uuid')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('work_schedules_staff_date_unique', ['staff_id', 'schedule_date'])
      .addCheckConstraint('work_schedules_type_check', sql`schedule_type in ('business_trip', 'day_off')`)
      .addCheckConstraint('work_schedules_status_check', sql`status in ('draft', 'published')`)
      .execute();
    await database.schema
      .createIndex('work_schedules_unit_date_index')
      .on('work_schedules')
      .columns(['org_unit_id', 'schedule_date'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('work_schedules').execute();
  },
};
