import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Kho, tài sản và mua hàng (P13-01 đến P13-10; BR-28, BR-61, BR-62, BR-63; LP-12; YCTD-77). Tiền là số nguyên đồng,
// số lượng có hai chữ số thập phân; tồn hiện tại của mặt hàng là tổng các giao dịch kho
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('suppliers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('tax_code', 'text')
      .addColumn('contact_name', 'text')
      .addColumn('phone', 'text')
      .addColumn('address', 'text')
      .addColumn('payment_terms', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('suppliers_status_check', sql`status in ('active', 'inactive')`)
      .addUniqueConstraint('suppliers_unit_name_unique', ['org_unit_id', 'name'])
      .execute();

    await database.schema
      .createTable('assets')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('category', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('original_cost', 'bigint', (column) => column.notNull())
      .addColumn('purchase_date', 'date', (column) => column.notNull())
      .addColumn('location_type', 'text', (column) => column.notNull().defaultTo('store'))
      .addColumn('location_id', 'uuid')
      .addColumn('location_name', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('in_stock'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('assets_cost_check', sql`original_cost >= 0`)
      .addCheckConstraint(
        'assets_location_type_check',
        sql`location_type in ('store', 'room', 'class', 'staff', 'unit')`,
      )
      .addCheckConstraint(
        'assets_status_check',
        sql`status in ('in_stock', 'assigned', 'on_loan', 'damaged', 'lost', 'disposed')`,
      )
      .execute();

    await database.schema
      .createTable('asset_assignments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('asset_id', 'uuid', (column) => column.notNull().references('assets.id'))
      .addColumn('assigned_to_type', 'text', (column) => column.notNull())
      .addColumn('assigned_to_id', 'uuid')
      .addColumn('assigned_to_name', 'text', (column) => column.notNull())
      .addColumn('received_by_name', 'text', (column) => column.notNull())
      .addColumn('assigned_on', 'date', (column) => column.notNull())
      .addColumn('handed_by', 'uuid', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('return_code', 'text', (column) => column.unique())
      .addColumn('returned_on', 'date')
      .addColumn('returned_by_name', 'text')
      .addColumn('return_received_by', 'uuid')
      .addColumn('return_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('asset_assignments_type_check', sql`assigned_to_type in ('room', 'class', 'staff', 'unit')`)
      .execute();
    await sql`create unique index asset_assignments_open_unique on asset_assignments (asset_id) where returned_on is null`.execute(
      database,
    );

    await database.schema
      .createTable('asset_loans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('asset_id', 'uuid', (column) => column.notNull().references('assets.id'))
      .addColumn('borrower_name', 'text', (column) => column.notNull())
      .addColumn('borrower_user_id', 'uuid')
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('due_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('open'))
      .addColumn('note', 'text')
      .addColumn('lent_by', 'uuid', (column) => column.notNull())
      .addColumn('returned_on', 'date')
      .addColumn('return_received_by', 'uuid')
      .addColumn('return_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('asset_loans_status_check', sql`status in ('open', 'returned')`)
      .addCheckConstraint('asset_loans_range_check', sql`due_date >= from_date`)
      .execute();
    await sql`create unique index asset_loans_open_unique on asset_loans (asset_id) where status = 'open'`.execute(
      database,
    );

    await database.schema
      .createTable('asset_damages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('asset_id', 'uuid', (column) => column.notNull().references('assets.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('incident_type', 'text', (column) => column.notNull())
      .addColumn('severity', 'text', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('occurred_on', 'date', (column) => column.notNull())
      .addColumn('proposed_handling', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('reported_by', 'uuid', (column) => column.notNull())
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('decision_note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('asset_damages_type_check', sql`incident_type in ('damaged', 'lost')`)
      .addCheckConstraint('asset_damages_severity_check', sql`severity in ('minor', 'major', 'total')`)
      .addCheckConstraint('asset_damages_status_check', sql`status in ('pending', 'approved', 'rejected')`)
      .execute();

    await database.schema
      .createTable('stock_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('min_qty', 'numeric(14, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('current_qty', 'numeric(14, 2)', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('stock_items_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('stock_items_quantity_check', sql`current_qty >= 0 and min_qty >= 0`)
      .addUniqueConstraint('stock_items_unit_code_unique', ['org_unit_id', 'code'])
      .execute();

    await database.schema
      .createTable('stock_transactions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('stock_item_id', 'uuid', (column) => column.notNull().references('stock_items.id'))
      .addColumn('transaction_type', 'text', (column) => column.notNull())
      // Số lượng có dấu: nhập dương, xuất âm, điều chỉnh kiểm kê theo chênh lệch
      .addColumn('quantity', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('unit_price', 'bigint')
      .addColumn('balance_after', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('reference_type', 'text')
      .addColumn('reference_id', 'uuid')
      .addColumn('transaction_date', 'date', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'stock_transactions_type_check',
        sql`transaction_type in ('opening', 'receipt', 'issue', 'count_adjustment', 'carry_over')`,
      )
      .addCheckConstraint('stock_transactions_quantity_check', sql`quantity <> 0 or transaction_type = 'carry_over'`)
      .execute();
    await database.schema
      .createIndex('stock_transactions_item_index')
      .on('stock_transactions')
      .columns(['stock_item_id', 'transaction_date'])
      .execute();

    await database.schema
      .createTable('stock_counts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('count_date', 'date', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('decided_by', 'uuid')
      .addColumn('decided_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('stock_counts_status_check', sql`status in ('matched', 'pending', 'approved', 'rejected')`)
      .execute();

    await database.schema
      .createTable('stock_count_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('count_id', 'uuid', (column) => column.notNull().references('stock_counts.id'))
      .addColumn('stock_item_id', 'uuid', (column) => column.notNull().references('stock_items.id'))
      .addColumn('system_qty', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('actual_qty', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('difference', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('note', 'text')
      .addCheckConstraint('stock_count_lines_actual_check', sql`actual_qty >= 0`)
      .addUniqueConstraint('stock_count_lines_item_unique', ['count_id', 'stock_item_id'])
      .execute();

    await database.schema
      .createTable('purchase_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('requester_id', 'uuid', (column) => column.notNull())
      .addColumn('requester_name', 'text', (column) => column.notNull())
      .addColumn('needed_by', 'date', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('total_amount', 'bigint', (column) => column.notNull())
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'purchase_requests_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'ordered')`,
      )
      .addCheckConstraint('purchase_requests_amount_check', sql`total_amount > 0`)
      .execute();

    await database.schema
      .createTable('purchase_request_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('request_id', 'uuid', (column) => column.notNull().references('purchase_requests.id'))
      .addColumn('item_name', 'text', (column) => column.notNull())
      .addColumn('quantity', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('estimated_price', 'bigint', (column) => column.notNull())
      .addColumn('note', 'text')
      .addCheckConstraint('purchase_request_items_check', sql`quantity > 0 and estimated_price > 0`)
      .execute();

    await database.schema
      .createTable('purchase_orders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('request_id', 'uuid', (column) => column.notNull().unique().references('purchase_requests.id'))
      .addColumn('supplier_id', 'uuid', (column) => column.notNull().references('suppliers.id'))
      .addColumn('order_date', 'date', (column) => column.notNull())
      .addColumn('total_amount', 'bigint', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('ordered'))
      // Công nợ phải trả nhà cung cấp: chờ thanh toán đến khi kế toán gắn phiếu chi đã phát hành (QT-05)
      .addColumn('payment_status', 'text', (column) => column.notNull().defaultTo('awaiting_payment'))
      .addColumn('payment_id', 'uuid', (column) => column.unique().references('payments.id'))
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('received_by', 'uuid')
      .addColumn('received_at', 'timestamptz')
      .addCheckConstraint('purchase_orders_status_check', sql`status in ('ordered', 'received')`)
      .addCheckConstraint('purchase_orders_payment_status_check', sql`payment_status in ('awaiting_payment', 'paid')`)
      .execute();

    await database.schema
      .createTable('purchase_order_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('order_id', 'uuid', (column) => column.notNull().references('purchase_orders.id'))
      .addColumn('stock_item_id', 'uuid', (column) => column.references('stock_items.id'))
      .addColumn('item_name', 'text', (column) => column.notNull())
      .addColumn('quantity', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('unit_price', 'bigint', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('received_qty', 'numeric(14, 2)', (column) => column.notNull().defaultTo(0))
      .addCheckConstraint('purchase_order_items_check', sql`quantity > 0 and unit_price >= 0 and amount >= 0`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'purchase_order_items',
      'purchase_orders',
      'purchase_request_items',
      'purchase_requests',
      'stock_count_lines',
      'stock_counts',
      'stock_transactions',
      'stock_items',
      'asset_damages',
      'asset_loans',
      'asset_assignments',
      'assets',
      'suppliers',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
