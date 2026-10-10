import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Phiếu đảo phiếu chi chờ Ban Giám hiệu duyệt theo hạn mức; số dư nguồn chi chỉ hoàn lại khi đã duyệt
// (P06-04; QT-05 bước 8; BR-29, BR-77; AC-214; YCTD-24, YCTD-56)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('payment_reversals')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Dạng DPC-000001, dãy số riêng toàn trường trong năm học
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('payment_id', 'uuid', (column) => column.notNull().references('payments.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('payment_reversals_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .addCheckConstraint('payment_reversals_amount_check', sql`amount > 0`)
      .execute();
    // Một phiếu chi chỉ có một phiếu đảo đang chờ hoặc đã duyệt
    await sql`create unique index payment_reversals_active_unique on payment_reversals (payment_id)
      where status in ('pending', 'approved')`.execute(database);
    await database.schema
      .createIndex('payment_reversals_unit_status_index')
      .on('payment_reversals')
      .columns(['org_unit_id', 'status'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('payment_reversals').execute();
  },
};
