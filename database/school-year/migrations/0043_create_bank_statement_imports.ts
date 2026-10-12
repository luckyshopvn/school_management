import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nhập tệp sao kê ngân hàng (Excel, CSV) theo cấu hình cột của từng tài khoản, đối soát tự động và đề xuất lập phiếu thu;
// mỗi tài khoản ngân hàng chọn cổng thanh toán trực tuyến (G3-05; P06-06, P06-11; BR-34; YCTD-89)
export const migration: Migration = {
  async up(database) {
    // Cổng thanh toán của tài khoản (trống là cổng mặc định của máy chủ) và mã BIN ngân hàng để dựng mã VietQR
    await database.schema
      .alterTable('cash_accounts')
      .addColumn('payment_provider', 'text')
      .addColumn('bank_bin', 'text', (column) => column.check(sql`bank_bin ~ '^[0-9]{6}$'`))
      .execute();

    // Cấu hình cột của tệp sao kê, mỗi tài khoản ngân hàng một cấu hình, dùng lại cho các lần nhập sau. Cột ghi theo tên
    // tiêu đề trong tệp; số tiền một cột có dấu hoặc hai cột tiền vào, tiền ra
    await database.schema
      .createTable('bank_statement_profiles')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('account_id', 'uuid', (column) => column.notNull().unique().references('cash_accounts.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('header_row', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('date_column', 'text', (column) => column.notNull())
      .addColumn('date_format', 'text', (column) => column.notNull().defaultTo('dmy'))
      .addColumn('amount_mode', 'text', (column) => column.notNull())
      .addColumn('amount_column', 'text')
      .addColumn('credit_column', 'text')
      .addColumn('debit_column', 'text')
      .addColumn('description_column', 'text', (column) => column.notNull())
      .addColumn('reference_column', 'text')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('bank_statement_profiles_header_check', sql`header_row between 1 and 50`)
      .addCheckConstraint('bank_statement_profiles_date_format_check', sql`date_format in ('dmy', 'ymd', 'mdy')`)
      .addCheckConstraint(
        'bank_statement_profiles_amount_check',
        sql`(amount_mode = 'signed' and amount_column is not null)
          or (amount_mode = 'split' and credit_column is not null and debit_column is not null)`,
      )
      .execute();

    // Mỗi lần nhập tệp: số dòng đọc được, đã ghi, trùng bỏ qua, lỗi, khớp tự động, đề xuất lập phiếu thu
    await database.schema
      .createTable('bank_statement_imports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('cash_accounts.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('file_format', 'text', (column) => column.notNull())
      .addColumn('total_rows', 'integer', (column) => column.notNull())
      .addColumn('imported_count', 'integer', (column) => column.notNull())
      .addColumn('duplicate_count', 'integer', (column) => column.notNull())
      .addColumn('error_count', 'integer', (column) => column.notNull())
      .addColumn('auto_matched_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('suggested_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('errors', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('duplicates', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('bank_statement_imports_format_check', sql`file_format in ('xlsx', 'csv')`)
      .execute();
    await database.schema
      .createIndex('bank_statement_imports_account_index')
      .on('bank_statement_imports')
      .columns(['account_id', 'created_at'])
      .execute();

    // Dòng sao kê nhớ lần nhập tạo ra nó và hóa đơn được đề xuất lập phiếu thu (dòng tiền vào có mã hóa đơn còn nợ mà
    // chưa có phiếu thu); kế toán xác nhận mới lập phiếu
    await database.schema
      .alterTable('bank_statement_lines')
      .addColumn('import_id', 'uuid', (column) => column.references('bank_statement_imports.id'))
      .addColumn('suggested_invoice_id', 'uuid', (column) => column.references('invoices.id'))
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('bank_statement_lines')
      .dropColumn('suggested_invoice_id')
      .dropColumn('import_id')
      .execute();
    await database.schema.dropTable('bank_statement_imports').execute();
    await database.schema.dropTable('bank_statement_profiles').execute();
    await database.schema.alterTable('cash_accounts').dropColumn('bank_bin').dropColumn('payment_provider').execute();
  },
};
