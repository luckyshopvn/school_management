import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phiếu đảo phiếu thu chờ Ban Giám hiệu duyệt theo hạn mức; hóa đơn công nợ đầu kỳ nhập từ Excel
// (P06-03, P01-13; BR-29, BR-34, BR-77; AC-34, AC-184, AC-212; YCTD-54)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('receipt_reversals')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Dạng DPT-000001, dãy số riêng toàn trường trong năm học
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('receipt_id', 'uuid', (column) => column.notNull().references('receipts.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('receipt_reversals_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .addCheckConstraint('receipt_reversals_amount_check', sql`amount > 0`)
      .execute();
    // Một phiếu thu chỉ có một phiếu đảo đang chờ hoặc đã duyệt
    await sql`create unique index receipt_reversals_active_unique on receipt_reversals (receipt_id)
      where status in ('pending', 'approved')`.execute(database);
    await database.schema
      .createIndex('receipt_reversals_unit_status_index')
      .on('receipt_reversals')
      .columns(['org_unit_id', 'status'])
      .execute();

    await sql`alter table invoices drop constraint invoices_kind_check`.execute(database);
    await sql`alter table invoices add constraint invoices_kind_check
      check (invoice_kind in ('main', 'supplementary', 'opening'))`.execute(database);
    // Mỗi trẻ có tối đa một hóa đơn công nợ đầu kỳ trong năm học
    await sql`create unique index invoices_opening_child_unique on invoices (child_id)
      where invoice_kind = 'opening'`.execute(database);
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service', 'opening'))`.execute(database);
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes', 'opening_debts'))`.execute(database);
  },
  async down(database) {
    await sql`alter table data_import_jobs drop constraint data_import_jobs_type_check`.execute(database);
    await sql`alter table data_import_jobs add constraint data_import_jobs_type_check
      check (import_type in ('classes', 'children', 'moet_codes'))`.execute(database);
    await sql`alter table invoice_items drop constraint invoice_items_type_check`.execute(database);
    await sql`alter table invoice_items add constraint invoice_items_type_check
      check (item_type in ('tuition', 'service'))`.execute(database);
    await sql`drop index invoices_opening_child_unique`.execute(database);
    await sql`alter table invoices drop constraint invoices_kind_check`.execute(database);
    await sql`alter table invoices add constraint invoices_kind_check
      check (invoice_kind in ('main', 'supplementary'))`.execute(database);
    await database.schema.dropTable('receipt_reversals').execute();
  },
};
