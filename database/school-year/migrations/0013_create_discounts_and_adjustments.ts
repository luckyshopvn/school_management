import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Miễn giảm trên hóa đơn và phiếu điều chỉnh hóa đơn, Ban Giám hiệu duyệt theo hạn mức
// (P05-07, P05-08; BR-20, BR-21, BR-22, BR-25, BR-77; Q-112; YCTD-52)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('discounts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      // Hóa đơn nháp bị bỏ khi chạy lại tính học phí thì miễn giảm của nó cũng bỏ theo
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id').onDelete('cascade'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('discount_type_id', 'uuid', (column) => column.notNull().references('discount_types.id'))
      .addColumn('basis', 'text', (column) => column.notNull())
      // Cách tính và mức lúc lập, căn cứ và kết quả cùng được lưu (BR-21)
      .addColumn('calculation_method', 'text', (column) => column.notNull())
      .addColumn('rate_value', 'bigint', (column) => column.notNull())
      .addColumn('base_amount', 'bigint', (column) => column.notNull())
      .addColumn('applied_amount', 'bigint', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      // Từ hạn mức trở lên hoặc đơn vị chưa đặt hạn mức thì chỉ Hiệu trưởng duyệt (Q-112)
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('copied_from_id', 'uuid')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('discounts_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .addCheckConstraint('discounts_method_check', sql`calculation_method in ('percent', 'amount')`)
      .addCheckConstraint('discounts_amount_check', sql`applied_amount > 0 and base_amount >= 0`)
      .execute();
    await database.schema.createIndex('discounts_invoice_id_index').on('discounts').column('invoice_id').execute();
    await database.schema
      .createIndex('discounts_unit_status_index')
      .on('discounts')
      .columns(['org_unit_id', 'status'])
      .execute();

    await database.schema
      .createTable('invoice_adjustments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('reason', 'text', (column) => column.notNull())
      // Dương là tăng số phải nộp, âm là giảm
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('invoice_adjustments_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .addCheckConstraint('invoice_adjustments_amount_check', sql`amount <> 0`)
      .execute();
    await database.schema
      .createIndex('invoice_adjustments_invoice_id_index')
      .on('invoice_adjustments')
      .column('invoice_id')
      .execute();
  },
  async down(database) {
    for (const table of ['invoice_adjustments', 'discounts']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
