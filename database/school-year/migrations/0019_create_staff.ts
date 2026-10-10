import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ nhân sự gắn một đơn vị chính, liên kết tài khoản có sẵn; hợp đồng lao động có thời hạn và lương thỏa thuận
// (P07-01, P07-02, P07-04, P01-13; BR-05, BR-37, BR-38; YCTD-58)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('staff')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('dob', 'date')
      .addColumn('gender', 'text')
      .addColumn('phone', 'text')
      .addColumn('email', 'text')
      .addColumn('address', 'text')
      // Số định danh cá nhân mã hóa, chỉ hiện bốn số cuối (BM-64)
      .addColumn('id_number_encrypted', 'text')
      .addColumn('id_number_last4', 'text')
      .addColumn('department_id', 'uuid', (column) => column.references('departments.id'))
      .addColumn('job_title_id', 'uuid', (column) => column.references('job_titles.id'))
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      // Mỗi tài khoản gắn tối đa một hồ sơ
      .addColumn('user_id', 'uuid', (column) => column.unique())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('staff_gender_check', sql`gender is null or gender in ('male', 'female')`)
      .addCheckConstraint('staff_status_check', sql`status in ('active', 'terminated')`)
      .execute();
    await database.schema.createIndex('staff_org_unit_id_index').on('staff').column('org_unit_id').execute();

    await database.schema
      .createTable('employment_contracts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('contract_no', 'text', (column) => column.notNull().unique())
      .addColumn('contract_type', 'text', (column) => column.notNull())
      .addColumn('start_date', 'date', (column) => column.notNull())
      .addColumn('end_date', 'date')
      .addColumn('base_salary', 'bigint', (column) => column.notNull())
      // Phụ cấp thỏa thuận theo hợp đồng: danh sách tên và số tiền mỗi tháng
      .addColumn('allowances', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('terminated_on', 'date')
      .addColumn('terminate_reason', 'text')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'employment_contracts_type_check',
        sql`contract_type in ('probation', 'fixed_term', 'indefinite')`,
      )
      .addCheckConstraint('employment_contracts_status_check', sql`status in ('active', 'terminated')`)
      .addCheckConstraint('employment_contracts_salary_check', sql`base_salary > 0`)
      .addCheckConstraint(
        'employment_contracts_dates_check',
        sql`(contract_type = 'indefinite' or end_date is not null) and (end_date is null or end_date >= start_date)`,
      )
      .execute();
    await database.schema
      .createIndex('employment_contracts_staff_id_index')
      .on('employment_contracts')
      .column('staff_id')
      .execute();

    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes', 'opening_debts', 'staff'))`.execute(database);
  },
  async down(database) {
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes', 'opening_debts'))`.execute(database);
    await database.schema.dropTable('employment_contracts').execute();
    await database.schema.dropTable('staff').execute();
  },
};
