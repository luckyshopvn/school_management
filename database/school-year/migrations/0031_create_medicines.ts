import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thuốc: danh mục thuốc, nhà thuốc, yêu cầu dặn thuốc, nhật ký cho uống thuốc, đề nghị mua thuốc, phiếu mua thuốc, phiếu cấp
// thuốc (P10-02 đến P10-05, P10-09; BR-48, BR-49, BR-50, BR-63, BR-86, BR-88; YCTD-75)
const PREVIOUS_PURPOSES = `'birth_certificate', 'photo_consent', 'import', 'pickup_photo', 'payment_voucher'`;

export const migration: Migration = {
  async up(database) {
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}, 'medicine_photo', 'prescription'))`.execute(database);

    await database.schema
      .createTable('pharmacies')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('phone', 'text')
      .addColumn('address', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('pharmacies_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('medicines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('active_ingredient', 'text')
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('pharmacy_id', 'uuid', (column) => column.references('pharmacies.id'))
      .addColumn('stock_qty', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('medicines_unit_code_unique', ['org_unit_id', 'code'])
      .addCheckConstraint('medicines_stock_check', sql`stock_qty >= 0`)
      .addCheckConstraint('medicines_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('medication_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('requested_by', 'uuid', (column) => column.notNull())
      .addColumn('medicine_name', 'text', (column) => column.notNull())
      .addColumn('dosage', 'text', (column) => column.notNull())
      .addColumn('times', sql`text[]`, (column) => column.notNull())
      .addColumn('from_date', 'date', (column) => column.notNull())
      .addColumn('to_date', 'date', (column) => column.notNull())
      .addColumn('allergy_note', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('medicine_photo_ids', sql`uuid[]`, (column) => column.notNull())
      .addColumn('prescription_photo_id', 'uuid', (column) => column.references('files.id'))
      .addColumn('assigned_role', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('received_quantity', 'text')
      .addColumn('received_note', 'text')
      .addColumn('received_by', 'uuid')
      .addColumn('received_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addColumn('rejected_by', 'uuid')
      .addColumn('rejected_at', 'timestamptz')
      .addColumn('completed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('medication_requests_times_check', sql`cardinality(times) >= 1`)
      .addCheckConstraint('medication_requests_photos_check', sql`cardinality(medicine_photo_ids) >= 1`)
      .addCheckConstraint('medication_requests_range_check', sql`to_date >= from_date`)
      .addCheckConstraint('medication_requests_role_check', sql`assigned_role in ('nurse', 'homeroom')`)
      .addCheckConstraint(
        'medication_requests_status_check',
        sql`status in ('pending', 'administering', 'completed', 'rejected')`,
      )
      .execute();
    await database.schema
      .createIndex('medication_requests_child_index')
      .on('medication_requests')
      .columns(['child_id', 'status'])
      .execute();

    await database.schema
      .createTable('medication_administrations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('request_id', 'uuid', (column) => column.notNull().references('medication_requests.id'))
      .addColumn('scheduled_date', 'date', (column) => column.notNull())
      .addColumn('scheduled_time', 'text', (column) => column.notNull())
      .addColumn('administered_at', 'timestamptz')
      .addColumn('administered_by', 'uuid', (column) => column.notNull())
      .addColumn('dose_note', 'text')
      .addColumn('is_skipped', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('skip_reason', 'text')
      .addColumn('parent_acknowledged_at', 'timestamptz')
      .addColumn('parent_acknowledged_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('medication_administrations_dose_unique', ['request_id', 'scheduled_date', 'scheduled_time'])
      .addCheckConstraint(
        'medication_administrations_skip_check',
        sql`(is_skipped and skip_reason is not null) or (not is_skipped and administered_at is not null)`,
      )
      .execute();

    await database.schema
      .createTable('medicine_purchase_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('medicine_id', 'uuid', (column) => column.notNull().references('medicines.id'))
      .addColumn('quantity', 'integer', (column) => column.notNull())
      .addColumn('estimated_unit_price', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('estimated_amount', 'numeric(16, 2)', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('requires_principal', 'boolean', (column) => column.notNull())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addCheckConstraint('medicine_purchase_requests_quantity_check', sql`quantity > 0 and estimated_unit_price >= 0`)
      .addCheckConstraint(
        'medicine_purchase_requests_status_check',
        sql`status in ('pending', 'approved', 'rejected', 'ordered')`,
      )
      .execute();

    await database.schema
      .createTable('medicine_purchase_orders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('request_id', 'uuid', (column) =>
        column.notNull().unique().references('medicine_purchase_requests.id'),
      )
      .addColumn('pharmacy_id', 'uuid', (column) => column.notNull().references('pharmacies.id'))
      .addColumn('order_date', 'date', (column) => column.notNull())
      .addColumn('total_amount', 'numeric(16, 2)', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('received'))
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('medicine_purchase_orders_status_check', sql`status in ('received')`)
      .execute();

    await database.schema
      .createTable('medicine_purchase_order_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('order_id', 'uuid', (column) => column.notNull().references('medicine_purchase_orders.id'))
      .addColumn('medicine_id', 'uuid', (column) => column.notNull().references('medicines.id'))
      .addColumn('quantity', 'integer', (column) => column.notNull())
      .addColumn('unit_price', 'numeric(14, 2)', (column) => column.notNull())
      .addColumn('amount', 'numeric(16, 2)', (column) => column.notNull())
      .addColumn('received_qty', 'integer', (column) => column.notNull())
      .addCheckConstraint(
        'medicine_purchase_order_items_quantity_check',
        sql`quantity > 0 and unit_price >= 0 and received_qty >= 0`,
      )
      .execute();

    await database.schema
      .createTable('medicine_issues')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('medicine_id', 'uuid', (column) => column.notNull().references('medicines.id'))
      .addColumn('quantity', 'integer', (column) => column.notNull())
      .addColumn('recipient', 'text', (column) => column.notNull())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('issued_by', 'uuid', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('medicine_issues_quantity_check', sql`quantity > 0`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'medicine_issues',
      'medicine_purchase_order_items',
      'medicine_purchase_orders',
      'medicine_purchase_requests',
      'medication_administrations',
      'medication_requests',
      'medicines',
      'pharmacies',
    ]) {
      await database.schema.dropTable(table).execute();
    }
    await sql`delete from files where purpose in ('medicine_photo', 'prescription')`.execute(database);
    await sql`alter table files drop constraint files_purpose_check`.execute(database);
    await sql`alter table files add constraint files_purpose_check
      check (purpose in (${sql.raw(PREVIOUS_PURPOSES)}))`.execute(database);
  },
};
