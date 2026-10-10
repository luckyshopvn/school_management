import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Quỹ tiền mặt, tài khoản ngân hàng, phiếu thu và phân bổ phiếu thu vào hóa đơn
// (P06-01, P06-02, P06-05; BR-28, BR-30, BR-31, BR-32, BR-34; Q-152; YCTD-53)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('cash_accounts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('account_type', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('bank_name', 'text')
      .addColumn('account_number', 'text')
      .addColumn('opening_balance', 'bigint', (column) => column.notNull())
      .addColumn('current_balance', 'bigint', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('cash_accounts_type_check', sql`account_type in ('cash', 'bank')`)
      .addCheckConstraint('cash_accounts_status_check', sql`status in ('active', 'inactive')`)
      // Số dư quỹ tiền mặt không được âm (BR-34)
      .addCheckConstraint('cash_accounts_cash_balance_check', sql`account_type <> 'cash' or current_balance >= 0`)
      .addCheckConstraint(
        'cash_accounts_bank_fields_check',
        sql`account_type <> 'bank' or (bank_name is not null and account_number is not null)`,
      )
      .addUniqueConstraint('cash_accounts_unit_name_unique', ['org_unit_id', 'name'])
      .execute();

    await database.schema
      .createTable('receipts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Dạng PT-000001, một dãy số toàn trường trong năm học nên không trùng trong đơn vị (BR-30)
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('payer_name', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('method', 'text', (column) => column.notNull())
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('cash_accounts.id'))
      .addColumn('category_id', 'uuid', (column) => column.notNull().references('cashflow_categories.id'))
      .addColumn('receipt_date', 'date', (column) => column.notNull())
      .addColumn('content', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('issued'))
      // Mã yêu cầu do màn hình sinh để gửi lại không tạo phiếu thứ hai (QT-04 E5)
      .addColumn('request_key', 'uuid', (column) => column.notNull().unique())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('receipts_amount_check', sql`amount > 0`)
      .addCheckConstraint('receipts_method_check', sql`method in ('cash', 'transfer', 'other')`)
      .addCheckConstraint('receipts_status_check', sql`status in ('issued', 'pending_reversal', 'reversed')`)
      .execute();
    await database.schema.createIndex('receipts_child_id_index').on('receipts').column('child_id').execute();
    await database.schema
      .createIndex('receipts_unit_date_index')
      .on('receipts')
      .columns(['org_unit_id', 'receipt_date'])
      .execute();

    // Phân bổ theo hóa đơn vì miễn giảm và điều chỉnh tính ở cấp hóa đơn; tiền chưa phân bổ là số dư có của trẻ (GD-27)
    await database.schema
      .createTable('receipt_allocations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('receipt_id', 'uuid', (column) => column.notNull().references('receipts.id'))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('receipt_allocations_amount_check', sql`amount > 0`)
      .execute();
    await database.schema
      .createIndex('receipt_allocations_receipt_id_index')
      .on('receipt_allocations')
      .column('receipt_id')
      .execute();
    await database.schema
      .createIndex('receipt_allocations_invoice_id_index')
      .on('receipt_allocations')
      .column('invoice_id')
      .execute();

    await database.schema
      .createTable('account_transactions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('cash_accounts.id'))
      .addColumn('transaction_date', 'date', (column) => column.notNull())
      .addColumn('transaction_type', 'text', (column) => column.notNull())
      // Dương là tiền vào, âm là tiền ra
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('balance_after', 'bigint', (column) => column.notNull())
      .addColumn('reference_type', 'text', (column) => column.notNull())
      .addColumn('reference_id', 'uuid', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('account_transactions_amount_check', sql`amount <> 0`)
      .execute();
    await database.schema
      .createIndex('account_transactions_account_date_index')
      .on('account_transactions')
      .columns(['account_id', 'transaction_date'])
      .execute();
  },
  async down(database) {
    for (const table of ['account_transactions', 'receipt_allocations', 'receipts', 'cash_accounts']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
