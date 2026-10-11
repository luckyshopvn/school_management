import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phiếu chi lương gắn bảng lương hoặc bảng quyết toán; bảng quyết toán khi chấm dứt hợp đồng; phiếu thu thu hồi lương
// không gắn trẻ; bảng điều chỉnh lương cho kỳ sau (P08-06; BR-45, BR-90; CTC-P06-034; YCTD-61)
export const migration: Migration = {
  async up(database) {
    // Bảng quyết toán: lương được hưởng của tháng nghỉ việc so với phần đã trả trước; dương là trả thêm, âm là thu hồi
    await database.schema
      .createTable('payroll_settlements')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('contract_id', 'uuid', (column) => column.notNull().unique().references('employment_contracts.id'))
      .addColumn('terminated_on', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('earned_amount', 'bigint', (column) => column.notNull())
      .addColumn('prepaid_amount', 'bigint', (column) => column.notNull())
      .addColumn('tax_difference', 'bigint', (column) => column.notNull())
      .addColumn('payable_amount', 'bigint', (column) => column.notNull())
      .addColumn('lines', 'jsonb', (column) => column.notNull())
      .addColumn('requires_principal', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('calculated_by', 'uuid')
      .addColumn('calculated_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('return_reason', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('payroll_settlements_status_check', sql`status in ('draft', 'pending', 'approved')`)
      .execute();

    // Khoản điều chỉnh có lý do và người phê duyệt, cộng trừ vào bảng lương của tháng chỉ định (BR-45)
    await database.schema
      .createTable('payroll_adjustments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('staff_id', 'uuid', (column) => column.notNull().references('staff.id'))
      .addColumn('target_year', 'integer', (column) => column.notNull())
      .addColumn('target_month', 'integer', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('payroll_adjustments_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .addCheckConstraint('payroll_adjustments_amount_check', sql`amount <> 0`)
      .execute();

    await database.schema
      .alterTable('payments')
      .addColumn('payroll_id', 'uuid', (column) => column.references('payrolls.id'))
      .addColumn('settlement_id', 'uuid', (column) => column.references('payroll_settlements.id'))
      .execute();

    // Phiếu thu thu hồi lương không gắn trẻ mà gắn nhân sự và bảng quyết toán (BR-90)
    await sql`alter table receipts alter column child_id drop not null`.execute(database);
    await database.schema
      .alterTable('receipts')
      .addColumn('staff_id', 'uuid', (column) => column.references('staff.id'))
      .addColumn('settlement_id', 'uuid', (column) => column.references('payroll_settlements.id'))
      .execute();
    await sql`alter table receipts add constraint receipts_payer_check
      check ((child_id is null) <> (staff_id is null))`.execute(database);
  },
  async down(database) {
    await sql`alter table receipts drop constraint receipts_payer_check`.execute(database);
    await database.schema.alterTable('receipts').dropColumn('settlement_id').dropColumn('staff_id').execute();
    await sql`alter table receipts alter column child_id set not null`.execute(database);
    await database.schema.alterTable('payments').dropColumn('settlement_id').dropColumn('payroll_id').execute();
    await database.schema.dropTable('payroll_adjustments').execute();
    await database.schema.dropTable('payroll_settlements').execute();
  },
};
