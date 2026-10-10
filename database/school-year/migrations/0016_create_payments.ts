import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phiếu chi trình Ban Giám hiệu duyệt theo hạn mức, duyệt là phát hành; chứng từ kèm theo; phiếu chi hoàn tiền thôi học
// trừ vào số dư có của trẻ (P06-04; QT-05; BR-24, BR-28, BR-29, BR-30, BR-34, BR-77; YCTD-55)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('payments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Dạng PC-000001, cấp khi phát hành, một dãy số toàn trường trong năm học (BR-30)
      .addColumn('code', 'text', (column) => column.unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('payment_type', 'text', (column) => column.notNull())
      .addColumn('child_id', 'uuid', (column) => column.references('children.id'))
      .addColumn('payee_name', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('content', 'text', (column) => column.notNull())
      .addColumn('account_id', 'uuid', (column) => column.notNull().references('cash_accounts.id'))
      .addColumn('category_id', 'uuid', (column) => column.notNull().references('cashflow_categories.id'))
      .addColumn('payment_date', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('requires_principal', 'boolean')
      // Mã yêu cầu do màn hình sinh để gửi lại không tạo phiếu thứ hai (QT-05 E5)
      .addColumn('request_key', 'uuid', (column) => column.notNull().unique())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('payments_amount_check', sql`amount > 0`)
      .addCheckConstraint('payments_type_check', sql`payment_type in ('regular', 'refund', 'payroll')`)
      .addCheckConstraint(
        'payments_status_check',
        sql`status in ('draft', 'pending', 'issued', 'pending_reversal', 'reversed')`,
      )
      .addCheckConstraint('payments_refund_child_check', sql`payment_type <> 'refund' or child_id is not null`)
      .execute();
    await database.schema
      .createIndex('payments_unit_status_index')
      .on('payments')
      .columns(['org_unit_id', 'status'])
      .execute();

    await database.schema
      .createTable('payment_attachments')
      .addColumn('payment_id', 'uuid', (column) => column.notNull().references('payments.id').onDelete('cascade'))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addPrimaryKeyConstraint('payment_attachments_primary_key', ['payment_id', 'file_id'])
      .execute();

    // Số hoàn lấy từ phiếu thu còn tiền chưa phân bổ của trẻ, phiếu cũ nhất trước (GD-27, YCTD-55)
    await database.schema
      .createTable('payment_refund_sources')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('payment_id', 'uuid', (column) => column.notNull().references('payments.id'))
      .addColumn('receipt_id', 'uuid', (column) => column.notNull().references('receipts.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addCheckConstraint('payment_refund_sources_amount_check', sql`amount > 0`)
      .execute();
    await database.schema
      .createIndex('payment_refund_sources_receipt_id_index')
      .on('payment_refund_sources')
      .column('receipt_id')
      .execute();

    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher'))`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from files where purpose = 'payment_voucher'`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in ('birth_certificate', 'photo_consent', 'import', 'pickup_photo'))`.execute(database);
    for (const table of ['payment_refund_sources', 'payment_attachments', 'payments']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
