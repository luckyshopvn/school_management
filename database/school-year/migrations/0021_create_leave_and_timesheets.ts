import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quy định và số ngày phép năm, đơn nghỉ phép, bảng công đã chốt và đề nghị mở lại
// (P08-03, P08-04, P08-11; BR-40, BR-41; Q-135; YCTD-59)
export const migration: Migration = {
  async up(database) {
    // Quy định chung toàn trường: chức danh, khoảng thâm niên tính bằng năm tròn, số ngày phép năm
    await database.schema
      .createTable('leave_policies')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('job_title_id', 'uuid', (column) => column.notNull().references('job_titles.id'))
      .addColumn('seniority_from_years', 'integer', (column) => column.notNull())
      .addColumn('seniority_to_years', 'integer')
      .addColumn('entitled_days', 'numeric(4, 1)', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('leave_policies_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint(
        'leave_policies_range_check',
        sql`seniority_from_years >= 0 and (seniority_to_years is null or seniority_to_years > seniority_from_years)
          and entitled_days >= 0`,
      )
      .execute();

    // Số ngày phép năm theo năm dương lịch; cấp khi cần dùng lần đầu theo quy định, phòng nhân sự chỉnh được kèm lý do
    await database.schema
      .createTable('leave_balances')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('balance_year', 'integer', (column) => column.notNull())
      .addColumn('entitled_days', 'numeric(5, 1)', (column) => column.notNull())
      .addColumn('used_days', 'numeric(5, 1)', (column) => column.notNull().defaultTo(0))
      .addColumn('policy_id', 'uuid', (column) => column.references('leave_policies.id'))
      .addColumn('adjust_reason', 'text')
      .addColumn('updated_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('leave_balances_staff_year_unique', ['staff_id', 'balance_year'])
      .addCheckConstraint('leave_balances_days_check', sql`entitled_days >= 0 and used_days >= 0`)
      .execute();

    // Đơn nghỉ: ngày đầu chỉ nghỉ buổi chiều, ngày cuối chỉ nghỉ buổi sáng; nghỉ một ngày thì chọn buổi bất kỳ.
    // Thuộc tính của loại nghỉ chép vào đơn lúc gửi để đổi danh mục sau không làm đổi đơn cũ
    await database.schema
      .createTable('leave_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('leave_type_id', 'uuid', (column) => column.notNull().references('catalog_items.id'))
      .addColumn('is_paid', 'boolean', (column) => column.notNull())
      .addColumn('deducts_annual_leave', 'boolean', (column) => column.notNull())
      .addColumn('insurance_paid', 'boolean', (column) => column.notNull())
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date', (column) => column.notNull())
      .addColumn('first_day_half', 'text')
      .addColumn('last_day_half', 'text')
      .addColumn('days', 'numeric(5, 1)', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint(
        'leave_requests_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'cancelled')`,
      )
      .addCheckConstraint(
        'leave_requests_half_check',
        sql`(first_day_half is null or first_day_half in ('morning', 'afternoon'))
          and (last_day_half is null or last_day_half in ('morning', 'afternoon'))`,
      )
      .addCheckConstraint('leave_requests_dates_check', sql`to_date >= from_date and days > 0`)
      .execute();
    await database.schema
      .createIndex('leave_requests_staff_id_index')
      .on('leave_requests')
      .column('staff_id')
      .execute();

    // Kỳ công của một đơn vị trong tháng; chưa có dòng là chưa chốt
    await database.schema
      .createTable('timesheet_periods')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('timesheet_periods_unit_month_unique', ['org_unit_id', 'period_year', 'period_month'])
      .addCheckConstraint('timesheet_periods_status_check', sql`status in ('closed', 'reopened')`)
      .execute();

    // Bảng công đã chốt từng ngày: dùng khi tính bảng lương tháng sau (BR-43, BR-82)
    await database.schema
      .createTable('timesheet_days')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('timesheet_periods.id'))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('work_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('worked_minutes', 'integer')
      .addColumn('late_minutes', 'integer')
      .addColumn('early_leave_minutes', 'integer')
      .addColumn('overtime_minutes', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('leave_request_id', 'uuid', (column) => column.references('leave_requests.id'))
      .addColumn('leave_days', 'numeric(2, 1)', (column) => column.notNull().defaultTo(0))
      .addColumn('absent_days', 'numeric(2, 1)', (column) => column.notNull().defaultTo(0))
      .addColumn('unpaid_days', 'numeric(2, 1)', (column) => column.notNull().defaultTo(0))
      .addColumn('insurance_days', 'numeric(2, 1)', (column) => column.notNull().defaultTo(0))
      .addColumn('note', 'text')
      .addUniqueConstraint('timesheet_days_period_staff_date_unique', ['period_id', 'staff_id', 'work_date'])
      .addCheckConstraint(
        'timesheet_days_status_check',
        sql`status in ('present', 'leave', 'absent', 'holiday', 'day_off')`,
      )
      .execute();

    await database.schema
      .createTable('timesheet_reopen_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_id', 'uuid', (column) => column.notNull().references('timesheet_periods.id'))
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('timesheet_reopen_requests_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('timesheet_reopen_requests').execute();
    await database.schema.dropTable('timesheet_days').execute();
    await database.schema.dropTable('timesheet_periods').execute();
    await database.schema.dropTable('leave_requests').execute();
    await database.schema.dropTable('leave_balances').execute();
    await database.schema.dropTable('leave_policies').execute();
  },
};
