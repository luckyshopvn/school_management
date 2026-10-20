import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thiết bị: nơi để, tem QR, kiểm kê bằng điện thoại, đối sánh danh mục tối thiểu theo cấp học (DT-18 phần 18g, YCTD-143):
// - `equipment_locations`: nơi để của một đơn vị: phòng (gắn với phòng đã khai báo), kho, vị trí nằm trong phòng hoặc kho;
// - `assets.equipment_location_id`, `equipment_holdings.location_id`: nơi để của từng thiết bị (tài sản) và của lô (số
//   lượng hiện có của một thiết bị tại đơn vị hoặc lớp);
// - `assets.qr_code`, `equipment_holdings.qr_code`: mã tem QR, cấp khi in tem lần đầu, không đổi khi in lại;
// - `equipment_items.school_level`, `template_code`: cấp học của danh mục và mã danh mục mẫu đã nạp dòng đó;
// - `equipment_stocktakes`, `equipment_stocktake_lines`: đợt kiểm kê của một đơn vị (cả đơn vị hoặc một nơi để) và từng
//   dòng chụp từ sổ lúc lập đợt (số theo sổ), kết quả quét (số đếm được, số dùng được, tình trạng, nơi thấy)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('equipment_locations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('location_type', 'text', (column) => column.notNull())
      .addColumn('room_id', 'uuid', (column) => column.references('rooms.id'))
      .addColumn('parent_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('equipment_locations_unit_code_unique', ['org_unit_id', 'code'])
      .addCheckConstraint('equipment_locations_type_check', sql`location_type in ('room', 'store', 'position')`)
      .addCheckConstraint('equipment_locations_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('equipment_locations_parent_check', sql`parent_id is null or parent_id <> id`)
      .execute();

    await database.schema
      .alterTable('equipment_items')
      .addColumn('school_level', 'text', (column) => column.notNull().defaultTo('MN'))
      .addColumn('template_code', 'text')
      .execute();
    await sql`alter table equipment_items add constraint equipment_items_school_level_check
      check (school_level in ('MN', 'TH', 'THCS', 'THPT'))`.execute(database);

    await database.schema
      .alterTable('equipment_holdings')
      .addColumn('location_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('qr_code', 'text', (column) => column.unique())
      .execute();
    await database.schema
      .alterTable('assets')
      .addColumn('equipment_location_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('qr_code', 'text', (column) => column.unique())
      .execute();

    await database.schema
      .createTable('equipment_stocktakes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('location_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('started_on', 'date', (column) => column.notNull())
      .addColumn('members', 'text')
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('counting'))
      .addColumn('return_note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('submitted_by', 'uuid')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'equipment_stocktakes_status_check',
        sql`status in ('counting', 'submitted', 'approved', 'closed', 'cancelled')`,
      )
      .execute();
    // Mỗi đơn vị chỉ một đợt chưa chốt để một mã QR quét ra đúng một dòng
    await sql`create unique index equipment_stocktakes_open_unique on equipment_stocktakes (org_unit_id)
      where status in ('counting', 'submitted', 'approved')`.execute(database);

    await database.schema
      .createTable('equipment_stocktake_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('stocktake_id', 'uuid', (column) => column.notNull().references('equipment_stocktakes.id'))
      .addColumn('target_type', 'text', (column) => column.notNull())
      .addColumn('asset_id', 'uuid', (column) => column.references('assets.id'))
      .addColumn('holding_id', 'uuid', (column) => column.references('equipment_holdings.id'))
      .addColumn('equipment_item_id', 'uuid', (column) => column.references('equipment_items.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('location_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('in_scope', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('expected_quantity', 'numeric(10, 2)', (column) => column.notNull())
      .addColumn('counted_quantity', 'numeric(10, 2)')
      .addColumn('usable_quantity', 'numeric(10, 2)')
      .addColumn('condition', 'text')
      .addColumn('found_location_id', 'uuid', (column) => column.references('equipment_locations.id'))
      .addColumn('note', 'text')
      .addColumn('counted_by', 'uuid')
      .addColumn('counted_at', 'timestamptz')
      .addColumn('damage_id', 'uuid', (column) => column.references('asset_damages.id'))
      .addCheckConstraint('equipment_stocktake_lines_type_check', sql`target_type in ('asset', 'holding')`)
      .addCheckConstraint(
        'equipment_stocktake_lines_target_check',
        sql`(target_type = 'asset' and asset_id is not null and holding_id is null)
          or (target_type = 'holding' and holding_id is not null and asset_id is null)`,
      )
      .addCheckConstraint(
        'equipment_stocktake_lines_condition_check',
        sql`condition is null or condition in ('good', 'damaged', 'unusable', 'missing')`,
      )
      .addCheckConstraint(
        'equipment_stocktake_lines_quantity_check',
        sql`expected_quantity >= 0 and (counted_quantity is null or counted_quantity >= 0)
          and (usable_quantity is null or (usable_quantity >= 0 and usable_quantity <= counted_quantity))`,
      )
      .execute();
    await sql`create unique index equipment_stocktake_lines_asset_unique on equipment_stocktake_lines
      (stocktake_id, asset_id) where asset_id is not null`.execute(database);
    await sql`create unique index equipment_stocktake_lines_holding_unique on equipment_stocktake_lines
      (stocktake_id, holding_id) where holding_id is not null`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('equipment_stocktake_lines').execute();
    await database.schema.dropTable('equipment_stocktakes').execute();
    await database.schema.alterTable('assets').dropColumn('qr_code').dropColumn('equipment_location_id').execute();
    await database.schema.alterTable('equipment_holdings').dropColumn('qr_code').dropColumn('location_id').execute();
    await sql`alter table equipment_items drop constraint equipment_items_school_level_check`.execute(database);
    await database.schema
      .alterTable('equipment_items')
      .dropColumn('template_code')
      .dropColumn('school_level')
      .execute();
    await database.schema.dropTable('equipment_locations').execute();
  },
};
