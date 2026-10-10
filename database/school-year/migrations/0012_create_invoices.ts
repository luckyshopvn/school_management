import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Lần chạy tính học phí, hóa đơn và dòng khoản phải thu, số chứng từ theo năm học
// (P05-05, P05-06; QT-03; BR-17, BR-19, BR-23, BR-25, BR-85; YCTD-30, YCTD-51)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('fee_calculation_runs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .addColumn('error_detail', 'text')
      .addColumn('child_count', 'integer')
      .addColumn('total_amount', 'bigint')
      .addColumn('run_by', 'uuid', (column) => column.notNull())
      .addCheckConstraint('fee_calculation_runs_status_check', sql`status in ('running', 'succeeded', 'failed')`)
      .execute();

    await database.schema
      .createTable('invoices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Cấp khi phát hành; hóa đơn nháp chưa có số
      .addColumn('code', 'text', (column) => column.unique())
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('invoice_kind', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('calculation_run_id', 'uuid', (column) => column.references('fee_calculation_runs.id'))
      .addColumn('total_amount', 'bigint', (column) => column.notNull())
      // Căn cứ tính: số ngày học của tháng, số ngày đang học, số ngày có mặt, bậc học, phiên bản biểu phí
      .addColumn('basis', 'jsonb', (column) => column.notNull())
      // Dòng cần kế toán xem lại (QT-03 bước 6), không chặn phát hành
      .addColumn('review_flags', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('due_date', 'date')
      .addColumn('issued_at', 'timestamptz')
      .addColumn('issued_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('invoices_kind_check', sql`invoice_kind in ('main', 'supplementary')`)
      .addCheckConstraint('invoices_status_check', sql`status in ('draft', 'issued')`)
      .addCheckConstraint('invoices_total_check', sql`total_amount >= 0`)
      .execute();
    // Mỗi trẻ mỗi kỳ một hóa đơn chính; hóa đơn bổ sung không giới hạn (BR-85)
    await sql`create unique index invoices_main_unique on invoices (child_id, period_year, period_month)
      where invoice_kind = 'main'`.execute(database);
    await database.schema
      .createIndex('invoices_unit_period_index')
      .on('invoices')
      .columns(['org_unit_id', 'period_year', 'period_month'])
      .execute();

    await database.schema
      .createTable('invoice_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id').onDelete('cascade'))
      .addColumn('item_type', 'text', (column) => column.notNull())
      .addColumn('service_id', 'uuid', (column) => column.references('services.id'))
      // Đăng ký đã lập khoản thu, dùng để hóa đơn bổ sung không thu trùng
      .addColumn('service_registration_id', 'uuid', (column) => column.references('service_registrations.id'))
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('quantity', sql`numeric(10, 4)`, (column) => column.notNull())
      .addColumn('unit_price', 'bigint', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('basis_note', 'text')
      .addCheckConstraint('invoice_items_type_check', sql`item_type in ('tuition', 'service')`)
      .addCheckConstraint('invoice_items_amount_check', sql`amount >= 0`)
      .execute();
    await database.schema
      .createIndex('invoice_items_invoice_id_index')
      .on('invoice_items')
      .column('invoice_id')
      .execute();

    // Số chứng từ cấp liên tục trong một năm học, mỗi loại một dãy (YCTD-30)
    await database.schema
      .createTable('document_sequences')
      .addColumn('document_type', 'text', (column) => column.primaryKey())
      .addColumn('last_value', 'integer', (column) => column.notNull())
      .execute();
  },
  async down(database) {
    for (const table of ['document_sequences', 'invoice_items', 'invoices', 'fee_calculation_runs']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
