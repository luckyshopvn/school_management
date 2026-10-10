import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Điểm danh, chốt điểm danh ngày và báo vắng (P04-01, 02, 06; QT-02; YCTD-47)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('attendance_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('attendance_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      // Thời điểm ghi trên thiết bị; khác thời điểm máy chủ nhận khi gửi bù lúc có mạng lại (Q-09)
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull())
      .addColumn('is_backfilled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'attendance_records_status_check',
        sql`status in ('present', 'absent_notified', 'absent_unnotified', 'late', 'early_leave', 'late_and_early_leave')`,
      )
      .addCheckConstraint('attendance_records_source_check', sql`source in ('teacher', 'manager', 'parent', 'system')`)
      // Mỗi trẻ một bản ghi cho mỗi ngày (BR-12)
      .addUniqueConstraint('attendance_records_child_date_unique', ['child_id', 'attendance_date'])
      .execute();
    await database.schema
      .createIndex('attendance_records_class_date_index')
      .on('attendance_records')
      .columns(['class_id', 'attendance_date'])
      .execute();
    await database.schema
      .createIndex('attendance_records_org_unit_id_index')
      .on('attendance_records')
      .column('org_unit_id')
      .execute();

    await database.schema
      .createTable('attendance_days')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('attendance_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('locked_by', 'uuid')
      .addColumn('locked_at', 'timestamptz')
      .addColumn('unlocked_by', 'uuid')
      .addColumn('unlocked_at', 'timestamptz')
      .addColumn('unlock_reason', 'text')
      .addCheckConstraint('attendance_days_status_check', sql`status in ('open', 'locked')`)
      .addUniqueConstraint('attendance_days_class_date_unique', ['class_id', 'attendance_date'])
      .execute();

    await database.schema
      .createTable('absence_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('absence_date', 'date', (column) => column.notNull())
      .addColumn('reason', 'text')
      // Báo trước giờ bắt đầu học là nghỉ có báo; báo sau là báo muộn (BR-13)
      .addColumn('is_advised', 'boolean', (column) => column.notNull())
      .addColumn('advised_at', 'timestamptz', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('reported_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('absence_records_source_check', sql`source in ('teacher', 'manager', 'parent')`)
      .addUniqueConstraint('absence_records_child_date_unique', ['child_id', 'absence_date'])
      .execute();

    // Người nhận theo vai trò và đơn vị, phân hệ thông báo xác định tài khoản khi gửi (YCTD-47)
    await sql`alter table notification_recipients alter column user_id drop not null`.execute(database);
    await database.schema.alterTable('notification_recipients').addColumn('role_code', 'text').execute();
    await database.schema.alterTable('notification_recipients').addColumn('org_unit_id', 'uuid').execute();
    await sql`alter table notification_recipients add constraint notification_recipients_target_check
      check (user_id is not null or (role_code is not null and org_unit_id is not null))`.execute(database);
  },
  async down(database) {
    await sql`delete from notification_recipients where user_id is null`.execute(database);
    await database.schema.alterTable('notification_recipients').dropColumn('role_code').execute();
    await database.schema.alterTable('notification_recipients').dropColumn('org_unit_id').execute();
    await sql`alter table notification_recipients alter column user_id set not null`.execute(database);
    for (const table of ['absence_records', 'attendance_days', 'attendance_records']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
