import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục phụ cấp, thưởng, khấu trừ; khoản gán cho từng nhân sự; biểu thuế thu nhập cá nhân; bảng lương toàn trường
// theo tháng và phiếu lương từng người (P08-06, P08-08, P08-11, P08-12; BR-43, BR-44, BR-82; YCTD-60)
export const DEFAULT_TAX_TABLE_ID = '00000000-0000-4000-8000-000000000060';

export const migration: Migration = {
  async up(database) {
    // Cách tính: số tiền cố định mỗi tháng, số tiền mỗi ngày đi làm thực tế, phần trăm lương hợp đồng
    await database.schema
      .createTable('pay_item_types')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('calculation_method', 'text', (column) => column.notNull())
      .addColumn('default_amount', 'bigint')
      .addColumn('rate_percent', 'numeric(6, 3)')
      .addColumn('is_tax_exempt', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('is_mandatory_insurance', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('pay_item_types_kind_check', sql`kind in ('allowance', 'deduction')`)
      .addCheckConstraint(
        'pay_item_types_method_check',
        sql`calculation_method in ('fixed_monthly', 'per_workday', 'percent_of_base')`,
      )
      .addCheckConstraint('pay_item_types_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint(
        'pay_item_types_flags_check',
        sql`(kind = 'allowance' or is_tax_exempt = false) and (kind = 'deduction' or is_mandatory_insurance = false)`,
      )
      .execute();

    // Khoản gán cho nhân sự; số tiền hoặc tỷ lệ riêng thay cho mức của danh mục khi có
    await database.schema
      .createTable('staff_pay_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('pay_item_type_id', 'uuid', (column) => column.notNull().references('pay_item_types.id'))
      .addColumn('amount', 'bigint')
      .addColumn('rate_percent', 'numeric(6, 3)')
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('staff_pay_items_staff_type_unique', ['staff_id', 'pay_item_type_id'])
      .execute();

    await database.schema
      .alterTable('staff')
      .addColumn('dependents_count', 'integer', (column) => column.notNull().defaultTo(0))
      .execute();

    // Biểu thuế lũy tiến từng phần theo tháng; mỗi lần sửa là một phiên bản có ngày hiệu lực
    await database.schema
      .createTable('tax_tables')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('effective_from', 'date', (column) => column.notNull().unique())
      .addColumn('personal_deduction', 'bigint', (column) => column.notNull())
      .addColumn('dependent_deduction', 'bigint', (column) => column.notNull())
      .addColumn('brackets', 'jsonb', (column) => column.notNull())
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    // Mức theo luật thuế thu nhập cá nhân sửa đổi hiệu lực 01/07/2026, Eric xác nhận ngày 11/10/2026
    await database
      .insertInto('tax_tables' as never)
      .values({
        id: DEFAULT_TAX_TABLE_ID,
        effective_from: '2026-07-01',
        personal_deduction: 15_500_000,
        dependent_deduction: 6_200_000,
        brackets: JSON.stringify([
          { up_to: 10_000_000, rate_percent: 5 },
          { up_to: 30_000_000, rate_percent: 10 },
          { up_to: 60_000_000, rate_percent: 20 },
          { up_to: 100_000_000, rate_percent: 30 },
          { up_to: null, rate_percent: 35 },
        ]),
      } as never)
      .execute();

    await database.schema
      .createTable('payrolls')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('total_net', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('requires_principal', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('tax_table_id', 'uuid', (column) => column.references('tax_tables.id'))
      .addColumn('skipped', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('calculated_by', 'uuid')
      .addColumn('calculated_at', 'timestamptz')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('return_reason', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('payrolls_month_unique', ['period_year', 'period_month'])
      .addCheckConstraint('payrolls_status_check', sql`status in ('draft', 'pending', 'approved')`)
      .execute();

    await database.schema
      .createTable('payslips')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('payroll_id', 'uuid', (column) => column.notNull().references('payrolls.id'))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('contract_id', 'uuid', (column) => column.references('employment_contracts.id'))
      .addColumn('prepaid_amount', 'bigint', (column) => column.notNull())
      .addColumn('adjustment_amount', 'bigint', (column) => column.notNull())
      .addColumn('taxable_income', 'bigint', (column) => column.notNull())
      .addColumn('tax_amount', 'bigint', (column) => column.notNull())
      .addColumn('net_amount', 'bigint', (column) => column.notNull())
      .addUniqueConstraint('payslips_payroll_staff_unique', ['payroll_id', 'staff_id'])
      .execute();

    // Số tiền mang dấu: thu nhập dương, khấu trừ âm; phần trả trước của tháng hoặc phần điều chỉnh theo công tháng trước
    await database.schema
      .createTable('payslip_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('payslip_id', 'uuid', (column) => column.notNull().references('payslips.id').onDelete('cascade'))
      .addColumn('section', 'text', (column) => column.notNull())
      .addColumn('line_type', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('basis', 'text', (column) => column.notNull())
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addCheckConstraint('payslip_lines_section_check', sql`section in ('prepaid', 'adjustment', 'tax')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('payslip_lines').execute();
    await database.schema.dropTable('payslips').execute();
    await database.schema.dropTable('payrolls').execute();
    await database.schema.dropTable('tax_tables').execute();
    await database.schema.alterTable('staff').dropColumn('dependents_count').execute();
    await database.schema.dropTable('staff_pay_items').execute();
    await database.schema.dropTable('pay_item_types').execute();
  },
};
