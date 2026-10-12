import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Tài chính giai đoạn 2: nhắc nợ, xử lý công nợ quá hạn, giao dịch ngân hàng và đối chiếu, công nợ phải trả, chốt kỳ tài
// chính (P05-10, P05-12, P06-06, P06-07, P06-09; BR-25, BR-29, BR-33, BR-34, BR-36, BR-77; YCTD-23, YCTD-82)
export const migration: Migration = {
  async up(database) {
    // Mỗi hóa đơn nhắc tối đa một lần ở mỗi mốc quá hạn; mốc 0 là nhắc trước khi tới mốc cấu hình đầu tiên
    await database.schema
      .createTable('debt_reminders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id'))
      .addColumn('milestone_days', 'integer', (column) => column.notNull())
      .addColumn('overdue_days', 'integer', (column) => column.notNull())
      .addColumn('outstanding_amount', 'bigint', (column) => column.notNull())
      .addColumn('sent_by', 'uuid', (column) => column.notNull())
      .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('debt_reminders_invoice_milestone_unique', ['invoice_id', 'milestone_days'])
      .execute();

    await database.schema
      .createTable('debt_resolutions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('invoice_id', 'uuid', (column) => column.references('invoices.id'))
      .addColumn('overdue_amount', 'bigint', (column) => column.notNull())
      .addColumn('overdue_days', 'integer', (column) => column.notNull())
      .addColumn('proposal', 'text', (column) => column.notNull())
      .addColumn('proposed_by', 'uuid', (column) => column.notNull())
      .addColumn('proposed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decision', 'text')
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addCheckConstraint('debt_resolutions_status_check', sql`status in ('pending', 'decided')`)
      .addCheckConstraint('debt_resolutions_amount_check', sql`overdue_amount > 0`)
      .execute();
    await database.schema
      .createIndex('debt_resolutions_pending_child_unique')
      .on('debt_resolutions')
      .column('child_id')
      .unique()
      .where(sql.ref('status'), '=', 'pending')
      .execute();

    // Dòng sao kê ngân hàng nhập tay; không đổi số dư (số dư chỉ đổi qua phiếu thu, phiếu chi, BR-34), dùng để đối chiếu
    // với giao dịch tài khoản của hệ thống. Số tiền dương là tiền vào, âm là tiền ra
    await database.schema
      .createTable('bank_statement_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('cash_accounts.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('transaction_date', 'date', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('bank_reference', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('unmatched'))
      .addColumn('matched_transaction_id', 'uuid', (column) => column.unique().references('account_transactions.id'))
      .addColumn('matched_by', 'uuid')
      .addColumn('matched_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('bank_statement_lines_amount_check', sql`amount <> 0`)
      .addCheckConstraint('bank_statement_lines_status_check', sql`status in ('unmatched', 'matched')`)
      .addCheckConstraint(
        'bank_statement_lines_match_check',
        sql`(status = 'matched') = (matched_transaction_id is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('bank_statement_lines_account_index')
      .on('bank_statement_lines')
      .columns(['account_id', 'transaction_date'])
      .execute();

    // Công nợ phải trả nhà cung cấp: lập tay hoặc từ phiếu mua hàng (P13-07), phiếu mua thuốc (P10-09); trả bằng phiếu chi
    // đã phát hành cùng số tiền
    await database.schema
      .createTable('payables')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('supplier_id', 'uuid', (column) => column.references('suppliers.id'))
      .addColumn('payee_name', 'text', (column) => column.notNull())
      .addColumn('source_type', 'text', (column) => column.notNull().defaultTo('manual'))
      .addColumn('source_id', 'uuid')
      .addColumn('document_ref', 'text')
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('document_date', 'date', (column) => column.notNull())
      .addColumn('due_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('payment_id', 'uuid', (column) => column.unique().references('payments.id'))
      .addColumn('paid_at', 'timestamptz')
      .addColumn('cancel_reason', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('payables_amount_check', sql`amount > 0`)
      .addCheckConstraint('payables_due_check', sql`due_date >= document_date`)
      .addCheckConstraint(
        'payables_source_check',
        sql`source_type in ('manual', 'purchase_order', 'medicine_purchase_order', 'market_purchase')
          and ((source_type = 'manual') = (source_id is null))`,
      )
      .addCheckConstraint('payables_status_check', sql`status in ('open', 'paid', 'cancelled')`)
      .addCheckConstraint('payables_paid_check', sql`(status = 'paid') = (payment_id is not null)`)
      .addUniqueConstraint('payables_source_unique', ['source_type', 'source_id'])
      .execute();

    await database.schema
      .createTable('fiscal_periods')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('period_year', 'integer', (column) => column.notNull())
      .addColumn('period_month', 'integer', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('summary', 'jsonb', (column) => column.notNull())
      .addColumn('request_note', 'text')
      .addColumn('close_requested_by', 'uuid', (column) => column.notNull())
      .addColumn('close_requested_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('rejected_by', 'uuid')
      .addColumn('rejected_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('fiscal_periods_status_check', sql`status in ('pending', 'closed', 'rejected')`)
      .addCheckConstraint('fiscal_periods_month_check', sql`period_month between 1 and 12`)
      .addUniqueConstraint('fiscal_periods_unit_period_unique', ['org_unit_id', 'period_year', 'period_month'])
      .execute();
  },
  async down(database) {
    for (const table of ['fiscal_periods', 'payables', 'bank_statement_lines', 'debt_resolutions', 'debt_reminders']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
