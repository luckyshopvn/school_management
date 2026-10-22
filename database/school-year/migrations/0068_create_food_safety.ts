import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bán trú: kiểm thực ba bước và an toàn thực phẩm (DT-18 phần 22b, YCTD-146), theo Quyết định 1246/QĐ-BYT ngày 31/3/2017:
// - `food_safety_files`: tệp quét giấy chứng nhận của nhà cung cấp, chứng từ giao hàng của lô; giữ riêng, không thêm mục
//   đích vào bảng `files` (tránh đụng ràng buộc mục đích của phần khác chạy song song);
// - `food_supplier_certificates`: hồ sơ an toàn thực phẩm của nhà cung cấp (giấy chứng nhận cơ sở đủ điều kiện, đăng ký kinh
//   doanh, thú y, kiểm dịch, bản tự công bố, hợp đồng), hạn hiệu lực;
// - `food_lots`: lô hàng nhập (mỗi dòng phiếu đi chợ khi xác nhận nhập, hoặc nhập tay): nhà cung cấp, cơ sở sản xuất, số lô,
//   hạn dùng, chứng từ, kết quả kiểm tra bước 1 và cách xử lý khi không đạt;
// - `food_inspections`, `food_inspection_lines`, `food_inspection_line_lots`: phiếu kiểm thực theo ngày và bước (1 trước khi
//   chế biến theo mẫu số 1, 2 khi chế biến theo mẫu số 2, 3 trước khi ăn theo mẫu số 3), dòng của phiếu, lô đã dùng cho món ở
//   bước 2 (để truy xuất từ món ra lô và nhà cung cấp);
// - `food_samples`: lưu và hủy mẫu thức ăn theo mẫu số 5 (người lưu, người hủy, nhiệt độ, thời gian, giữ mẫu khi có phản ánh)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('food_safety_files')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('file_name', 'text', (column) => column.notNull())
      .addColumn('content_type', 'text', (column) => column.notNull())
      .addColumn('size_bytes', 'integer', (column) => column.notNull())
      .addColumn('storage_key', 'text', (column) => column.notNull().unique())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();

    await database.schema
      .createTable('food_supplier_certificates')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('supplier_id', 'uuid', (column) => column.notNull().references('food_suppliers.id'))
      .addColumn('certificate_type', 'text', (column) => column.notNull())
      .addColumn('number', 'text', (column) => column.notNull())
      .addColumn('issued_by', 'text')
      .addColumn('issued_on', 'date')
      .addColumn('expires_on', 'date')
      .addColumn('scope_note', 'text')
      .addColumn('file_id', 'uuid', (column) => column.references('food_safety_files.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'food_supplier_certificates_type_check',
        sql`certificate_type in ('food_safety', 'business_registration', 'veterinary', 'quarantine',
          'product_declaration', 'contract', 'other')`,
      )
      .addCheckConstraint('food_supplier_certificates_status_check', sql`status in ('active', 'revoked')`)
      .addCheckConstraint(
        'food_supplier_certificates_dates_check',
        sql`issued_on is null or expires_on is null or expires_on >= issued_on`,
      )
      .execute();

    await database.schema
      .createTable('food_lots')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('ingredient_id', 'uuid', (column) => column.notNull().references('ingredients.id'))
      .addColumn('supplier_id', 'uuid', (column) => column.notNull().references('food_suppliers.id'))
      .addColumn('purchase_item_id', 'uuid', (column) => column.unique().references('market_purchase_items.id'))
      .addColumn('food_category', 'text', (column) => column.notNull().defaultTo('fresh'))
      .addColumn('received_date', 'date', (column) => column.notNull())
      .addColumn('received_time', 'time')
      .addColumn('quantity', 'numeric(12, 3)', (column) => column.notNull())
      .addColumn('deliverer_name', 'text')
      .addColumn('manufacturer', 'text')
      .addColumn('manufacturer_address', 'text')
      .addColumn('lot_number', 'text')
      .addColumn('production_date', 'date')
      .addColumn('expiry_date', 'date')
      .addColumn('storage_condition', 'text')
      .addColumn('document_number', 'text')
      .addColumn('document_file_id', 'uuid', (column) => column.references('food_safety_files.id'))
      .addColumn('veterinary_certificate', 'text')
      .addColumn('quarantine_certificate', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('rejection_action', 'text')
      .addColumn('handling_note', 'text')
      .addColumn('closed_by', 'uuid')
      .addColumn('closed_at', 'timestamptz')
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('food_lots_category_check', sql`food_category in ('fresh', 'dry')`)
      .addCheckConstraint(
        'food_lots_storage_check',
        sql`storage_condition is null or storage_condition in ('ambient', 'chilled', 'frozen')`,
      )
      .addCheckConstraint(
        'food_lots_status_check',
        sql`status in ('pending', 'accepted', 'rejected', 'used_up', 'disposed')`,
      )
      .addCheckConstraint(
        'food_lots_rejection_check',
        sql`rejection_action is null or rejection_action in ('returned', 'destroyed', 'other')`,
      )
      .addCheckConstraint('food_lots_quantity_check', sql`quantity > 0`)
      .addCheckConstraint(
        'food_lots_dates_check',
        sql`(production_date is null or expiry_date is null or expiry_date >= production_date)`,
      )
      .execute();
    await sql`create index food_lots_unit_date_index on food_lots (org_unit_id, received_date)`.execute(database);
    await sql`create index food_lots_ingredient_index on food_lots (ingredient_id, status)`.execute(database);

    await database.schema
      .createTable('food_inspections')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('inspection_date', 'date', (column) => column.notNull())
      .addColumn('step', 'smallint', (column) => column.notNull())
      .addColumn('inspector_name', 'text', (column) => column.notNull())
      .addColumn('inspector_title', 'text')
      .addColumn('inspected_time', 'time')
      .addColumn('location', 'text')
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('confirmed_by', 'uuid')
      .addColumn('confirmed_at', 'timestamptz')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('food_inspections_unit_date_step_unique', ['org_unit_id', 'inspection_date', 'step'])
      .addCheckConstraint('food_inspections_step_check', sql`step in (1, 2, 3)`)
      .addCheckConstraint('food_inspections_status_check', sql`status in ('draft', 'confirmed')`)
      .execute();

    await database.schema
      .createTable('food_inspection_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('inspection_id', 'uuid', (column) =>
        column.notNull().references('food_inspections.id').onDelete('cascade'),
      )
      .addColumn('line_no', 'integer', (column) => column.notNull())
      .addColumn('lot_id', 'uuid', (column) => column.references('food_lots.id'))
      .addColumn('meal_type', 'text')
      .addColumn('dish_id', 'uuid', (column) => column.references('dishes.id'))
      .addColumn('dish_name', 'text')
      .addColumn('main_ingredients', 'text')
      .addColumn('servings', 'integer')
      .addColumn('first_time', 'time')
      .addColumn('second_time', 'time')
      .addColumn('hygiene_people', 'text')
      .addColumn('hygiene_equipment', 'text')
      .addColumn('hygiene_area', 'text')
      .addColumn('utensils', 'text')
      .addColumn('sensory_result', 'text')
      .addColumn('rapid_test_result', 'text')
      .addColumn('rejection_action', 'text')
      .addColumn('action', 'text')
      .addColumn('note', 'text')
      .addUniqueConstraint('food_inspection_lines_number_unique', ['inspection_id', 'line_no'])
      .addCheckConstraint(
        'food_inspection_lines_meal_check',
        sql`meal_type is null or meal_type in ('breakfast', 'lunch', 'snack')`,
      )
      .addCheckConstraint(
        'food_inspection_lines_result_check',
        sql`(sensory_result is null or sensory_result in ('pass', 'fail'))
          and (rapid_test_result is null or rapid_test_result in ('pass', 'fail'))
          and (hygiene_people is null or hygiene_people in ('pass', 'fail'))
          and (hygiene_equipment is null or hygiene_equipment in ('pass', 'fail'))
          and (hygiene_area is null or hygiene_area in ('pass', 'fail'))`,
      )
      .addCheckConstraint(
        'food_inspection_lines_rejection_check',
        sql`rejection_action is null or rejection_action in ('returned', 'destroyed', 'other')`,
      )
      .addCheckConstraint('food_inspection_lines_servings_check', sql`servings is null or servings >= 0`)
      .execute();
    await sql`create unique index food_inspection_lines_lot_unique on food_inspection_lines (inspection_id, lot_id)
      where lot_id is not null`.execute(database);

    await database.schema
      .createTable('food_inspection_line_lots')
      .addColumn('line_id', 'uuid', (column) =>
        column.notNull().references('food_inspection_lines.id').onDelete('cascade'),
      )
      .addColumn('lot_id', 'uuid', (column) => column.notNull().references('food_lots.id'))
      .addPrimaryKeyConstraint('food_inspection_line_lots_pkey', ['line_id', 'lot_id'])
      .execute();
    await sql`create index food_inspection_line_lots_lot_index on food_inspection_line_lots (lot_id)`.execute(database);

    await database.schema
      .createTable('food_samples')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('sample_date', 'date', (column) => column.notNull())
      .addColumn('meal_type', 'text', (column) => column.notNull())
      .addColumn('dish_id', 'uuid', (column) => column.references('dishes.id'))
      .addColumn('dish_name', 'text', (column) => column.notNull())
      .addColumn('servings', 'integer', (column) => column.notNull())
      .addColumn('food_form', 'text', (column) => column.notNull())
      .addColumn('quantity', 'numeric(8, 1)', (column) => column.notNull())
      .addColumn('container', 'text', (column) => column.notNull())
      .addColumn('storage_temperature', 'numeric(4, 1)', (column) => column.notNull())
      .addColumn('sampled_at', 'timestamptz', (column) => column.notNull())
      .addColumn('sampled_by', 'uuid', (column) => column.notNull())
      .addColumn('sampled_by_name', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('stored'))
      .addColumn('hold_reason', 'text')
      .addColumn('held_by', 'uuid')
      .addColumn('held_at', 'timestamptz')
      .addColumn('destroyed_at', 'timestamptz')
      .addColumn('destroyed_by', 'uuid')
      .addColumn('destroyed_by_name', 'text')
      .addColumn('quality_note', 'text')
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('food_samples_meal_check', sql`meal_type in ('breakfast', 'lunch', 'snack')`)
      .addCheckConstraint('food_samples_form_check', sql`food_form in ('solid', 'liquid')`)
      .addCheckConstraint('food_samples_status_check', sql`status in ('stored', 'held', 'destroyed')`)
      .addCheckConstraint(
        'food_samples_quantity_check',
        sql`(food_form = 'solid' and quantity >= 100) or (food_form = 'liquid' and quantity >= 150)`,
      )
      .addCheckConstraint('food_samples_temperature_check', sql`storage_temperature between 2 and 8`)
      .addCheckConstraint(
        'food_samples_destroy_check',
        sql`(status = 'destroyed') = (destroyed_at is not null)
          and (destroyed_at is null or destroyed_at >= sampled_at + interval '24 hours')`,
      )
      .addCheckConstraint('food_samples_servings_check', sql`servings >= 0`)
      .execute();
    await sql`create index food_samples_unit_date_index on food_samples (org_unit_id, sample_date)`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('food_samples').execute();
    await database.schema.dropTable('food_inspection_line_lots').execute();
    await database.schema.dropTable('food_inspection_lines').execute();
    await database.schema.dropTable('food_inspections').execute();
    await database.schema.dropTable('food_lots').execute();
    await database.schema.dropTable('food_supplier_certificates').execute();
    await database.schema.dropTable('food_safety_files').execute();
  },
};
