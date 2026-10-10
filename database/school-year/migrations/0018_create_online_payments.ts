import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thanh toán trực tuyến bằng mã QR qua tài khoản ảo dùng một lần do nhà cung cấp cấp, tiền về một tài khoản duy nhất
// của trường; đối chiếu giao dịch tiền vào, tự lập phiếu thu (P06-11; QT-04 bước 11, E10, E11; BR-28, BR-31; BM-62;
// YCTD-57)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('cash_accounts')
      .addColumn('receives_online_payments', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('online_payment_category_id', 'uuid', (column) => column.references('cashflow_categories.id'))
      .execute();
    // Toàn trường chỉ một tài khoản nhận thanh toán trực tuyến
    await sql`create unique index cash_accounts_online_payments_unique on cash_accounts (receives_online_payments)
      where receives_online_payments`.execute(database);

    await database.schema
      .createTable('payment_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('transfer_content', 'text', (column) => column.notNull())
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('provider_reference', 'text', (column) => column.notNull())
      .addColumn('virtual_account_number', 'text', (column) => column.notNull())
      .addColumn('qr_content', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('expires_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('closed_at', 'timestamptz')
      .addCheckConstraint('payment_requests_amount_check', sql`amount > 0`)
      .addCheckConstraint('payment_requests_status_check', sql`status in ('active', 'paid', 'cancelled')`)
      .execute();
    // Mỗi hóa đơn tối đa một mã QR còn hiệu lực
    await sql`create unique index payment_requests_active_unique on payment_requests (invoice_id)
      where status = 'active'`.execute(database);
    await database.schema
      .createIndex('payment_requests_virtual_account_index')
      .on('payment_requests')
      .column('virtual_account_number')
      .execute();

    await database.schema
      .createTable('online_payment_transactions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('provider', 'text', (column) => column.notNull())
      // Nhà cung cấp gửi lại cùng mã giao dịch thì không xử lý lần hai (QT-04 E11, AC-187)
      .addColumn('provider_transaction_ref', 'text', (column) => column.notNull().unique())
      .addColumn('virtual_account_number', 'text')
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('transfer_content', 'text', (column) => column.notNull())
      .addColumn('received_at', 'timestamptz', (column) => column.notNull())
      .addColumn('match_status', 'text', (column) => column.notNull())
      .addColumn('payment_request_id', 'uuid', (column) => column.references('payment_requests.id'))
      .addColumn('invoice_id', 'uuid', (column) => column.references('invoices.id'))
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.references('org_units.id'))
      .addColumn('receipt_id', 'uuid', (column) => column.references('receipts.id'))
      .addColumn('resolution_note', 'text')
      .addColumn('handled_by', 'uuid')
      .addColumn('handled_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('online_payment_transactions_amount_check', sql`amount > 0`)
      .addCheckConstraint(
        'online_payment_transactions_match_check',
        sql`match_status in ('matched', 'wrong_amount', 'unknown_invoice', 'already_paid')`,
      )
      .execute();
    await database.schema
      .createIndex('online_payment_transactions_status_index')
      .on('online_payment_transactions')
      .columns(['match_status', 'handled_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('online_payment_transactions').execute();
    await database.schema.dropTable('payment_requests').execute();
    await sql`drop index cash_accounts_online_payments_unique`.execute(database);
    await database.schema
      .alterTable('cash_accounts')
      .dropColumn('online_payment_category_id')
      .dropColumn('receives_online_payments')
      .execute();
  },
};
