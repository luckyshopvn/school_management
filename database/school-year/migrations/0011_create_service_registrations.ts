import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Đăng ký dịch vụ theo tháng, chốt danh sách kỳ theo đơn vị, đăng ký học hè (P05-03, P05-04, P05-13; BR-26, BR-83, BR-92;
// YCTD-49, YCTD-50)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('service_registrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      // Đơn vị của trẻ lúc tạo dòng, dùng cho phạm vi duyệt và chốt
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('service_id', 'uuid', (column) => column.notNull().references('services.id'))
      // Đang hiệu lực, chờ duyệt đăng ký trễ, chờ duyệt hủy trễ, đã hủy, bị từ chối
      .addColumn('status', 'text', (column) => column.notNull())
      // Phụ huynh, nhà trường, hệ thống (dịch vụ bắt buộc), tự giữ từ tháng trước
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('registered_by', 'uuid')
      .addColumn('registered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('is_late', 'boolean', (column) => column.notNull().defaultTo(false))
      // Bắt buộc khi đăng ký trễ, thuộc kỳ đăng ký (Q-150)
      .addColumn('service_start_date', 'date')
      .addColumn('late_charge_method', 'text')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text')
      .addColumn('cancel_requested_by', 'uuid')
      .addColumn('cancel_requested_at', 'timestamptz')
      .addColumn('cancelled_by', 'uuid')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'service_registrations_status_check',
        sql`status in ('active', 'pending_late', 'pending_cancel', 'cancelled', 'rejected')`,
      )
      .addCheckConstraint('service_registrations_source_check', sql`source in ('parent', 'staff', 'system', 'carried')`)
      .addCheckConstraint(
        'service_registrations_charge_check',
        sql`late_charge_method is null or late_charge_method in ('full_month', 'actual_days')`,
      )
      .addCheckConstraint('service_registrations_month_check', sql`period_month between 1 and 12`)
      .addUniqueConstraint('service_registrations_child_period_service_unique', [
        'child_id',
        'period_year',
        'period_month',
        'service_id',
      ])
      .execute();
    await database.schema
      .createIndex('service_registrations_unit_period_index')
      .on('service_registrations')
      .columns(['org_unit_id', 'period_year', 'period_month'])
      .execute();

    await database.schema
      .createTable('registration_periods')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('locked_by', 'uuid')
      .addColumn('locked_at', 'timestamptz')
      .addCheckConstraint('registration_periods_status_check', sql`status in ('open', 'locked')`)
      .addUniqueConstraint('registration_periods_unit_period_unique', ['org_unit_id', 'period_year', 'period_month'])
      .execute();

    await database.schema
      .createTable('summer_registrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('registered_by', 'uuid', (column) => column.notNull())
      .addColumn('registered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('cancelled_by', 'uuid')
      .addColumn('cancelled_at', 'timestamptz')
      .addCheckConstraint('summer_registrations_status_check', sql`status in ('active', 'cancelled')`)
      .addCheckConstraint('summer_registrations_source_check', sql`source in ('parent', 'staff')`)
      .addUniqueConstraint('summer_registrations_child_period_unique', ['child_id', 'period_year', 'period_month'])
      .execute();
  },
  async down(database) {
    for (const table of ['summer_registrations', 'registration_periods', 'service_registrations']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
