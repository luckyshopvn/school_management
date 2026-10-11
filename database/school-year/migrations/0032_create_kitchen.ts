import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Bếp, thực đơn, định lượng, suất ăn, báo cơm, buffet, nhà cung cấp thực phẩm, phiếu đi chợ (P12-01 đến P12-09, P17-08;
// BR-58, BR-59, BR-60, BR-63, BR-83, BR-28; YCTD-76)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ingredients')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('code', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('current_stock', 'numeric(14, 3)', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('ingredients_unit_code_unique', ['org_unit_id', 'code'])
      .addCheckConstraint('ingredients_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('ingredients_stock_check', sql`current_stock >= 0`)
      .execute();

    await database.schema
      .createTable('dishes')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('group_name', 'text')
      .addColumn('recipe_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('dishes_unit_name_unique', ['org_unit_id', 'name'])
      .addCheckConstraint('dishes_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    // Định lượng trên một suất của từng nguyên liệu trong món (BR-60)
    await database.schema
      .createTable('ingredient_norms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('dish_id', 'uuid', (column) => column.notNull().references('dishes.id'))
      .addColumn('ingredient_id', 'uuid', (column) => column.notNull().references('ingredients.id'))
      .addColumn('quantity_per_serving', 'numeric(12, 4)', (column) => column.notNull())
      .addUniqueConstraint('ingredient_norms_dish_ingredient_unique', ['dish_id', 'ingredient_id'])
      .addCheckConstraint('ingredient_norms_quantity_check', sql`quantity_per_serving > 0`)
      .execute();

    await database.schema
      .createTable('menus')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('week_start_date', 'date', (column) => column.notNull())
      .addColumn('age_group', 'text', (column) => column.notNull().defaultTo('all'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('note', 'text')
      .addColumn('submitted_by', 'uuid')
      .addColumn('submitted_at', 'timestamptz')
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('published_at', 'timestamptz')
      .addColumn('reject_reason', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('menus_unit_week_age_unique', ['org_unit_id', 'week_start_date', 'age_group'])
      .addCheckConstraint('menus_status_check', sql`status in ('draft', 'submitted', 'published')`)
      .execute();

    await database.schema
      .createTable('menu_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('menu_id', 'uuid', (column) => column.notNull().references('menus.id').onDelete('cascade'))
      .addColumn('weekday', 'integer', (column) => column.notNull())
      .addColumn('meal_type', 'text', (column) => column.notNull())
      .addColumn('dish_id', 'uuid', (column) => column.notNull().references('dishes.id'))
      .addColumn('note', 'text')
      .addUniqueConstraint('menu_items_menu_day_meal_dish_unique', ['menu_id', 'weekday', 'meal_type', 'dish_id'])
      .addCheckConstraint('menu_items_weekday_check', sql`weekday between 1 and 6`)
      .addCheckConstraint('menu_items_meal_type_check', sql`meal_type in ('breakfast', 'lunch', 'snack')`)
      .execute();

    // Báo cơm của giáo viên chủ nhiệm khi chưa chốt điểm danh (P12-07)
    await database.schema
      .createTable('meal_reports')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('class_id', 'uuid', (column) => column.notNull().references('classes.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('report_date', 'date', (column) => column.notNull())
      .addColumn('headcount', 'integer', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('reported_by', 'uuid', (column) => column.notNull())
      .addColumn('reported_at', 'timestamptz', (column) => column.notNull())
      .addUniqueConstraint('meal_reports_class_date_unique', ['class_id', 'report_date'])
      .addCheckConstraint('meal_reports_headcount_check', sql`headcount >= 0`)
      .execute();

    // Số suất ăn của ngày theo bữa (BR-58); ba bữa cùng một số
    await database.schema
      .createTable('meal_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('meal_date', 'date', (column) => column.notNull())
      .addColumn('meal_type', 'text', (column) => column.notNull())
      .addColumn('headcount', 'integer', (column) => column.notNull())
      .addColumn('computed_from', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('computed_by', 'uuid', (column) => column.notNull())
      .addColumn('computed_at', 'timestamptz', (column) => column.notNull())
      .addUniqueConstraint('meal_plans_unit_date_meal_unique', ['org_unit_id', 'meal_date', 'meal_type'])
      .addCheckConstraint('meal_plans_meal_type_check', sql`meal_type in ('breakfast', 'lunch', 'snack')`)
      .addCheckConstraint('meal_plans_source_check', sql`computed_from in ('attendance', 'mixed')`)
      .addCheckConstraint('meal_plans_status_check', sql`status in ('provisional', 'final')`)
      .execute();

    await database.schema
      .createTable('buffet_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('buffet_date', 'date', (column) => column.notNull())
      .addColumn('occasion', 'text', (column) => column.notNull())
      .addColumn('class_id', 'uuid', (column) => column.references('classes.id'))
      .addColumn('menu_note', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('approved_by', 'uuid')
      .addColumn('approved_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('buffet_events_status_check', sql`status in ('draft', 'approved', 'cancelled')`)
      .execute();

    // Nhà cung cấp thực phẩm của bếp (P12-08); khi có danh mục nhà cung cấp dùng chung thì gộp vào (YCTD-76)
    await database.schema
      .createTable('food_suppliers')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('food_groups', 'text')
      .addColumn('tax_code', 'text')
      .addColumn('contact_name', 'text')
      .addColumn('phone', 'text')
      .addColumn('address', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('food_suppliers_unit_name_unique', ['org_unit_id', 'name'])
      .addCheckConstraint('food_suppliers_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('market_purchases')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('purchase_date', 'date', (column) => column.notNull())
      .addColumn('supplier_id', 'uuid', (column) => column.notNull().references('food_suppliers.id'))
      .addColumn('total_amount', 'numeric(15, 0)', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('draft'))
      .addColumn('payment_status', 'text')
      .addColumn('payment_id', 'uuid', (column) => column.references('payments.id').unique())
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('received_by', 'uuid')
      .addColumn('received_at', 'timestamptz')
      .addColumn('paid_linked_by', 'uuid')
      .addColumn('paid_linked_at', 'timestamptz')
      .addCheckConstraint('market_purchases_status_check', sql`status in ('draft', 'received', 'cancelled')`)
      .addCheckConstraint(
        'market_purchases_payment_status_check',
        sql`(status = 'received' and payment_status in ('awaiting_payment', 'paid')) or (status <> 'received' and payment_status is null)`,
      )
      .execute();

    await database.schema
      .createTable('market_purchase_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('purchase_id', 'uuid', (column) =>
        column.notNull().references('market_purchases.id').onDelete('cascade'),
      )
      .addColumn('ingredient_id', 'uuid', (column) => column.notNull().references('ingredients.id'))
      .addColumn('quantity', 'numeric(14, 3)', (column) => column.notNull())
      .addColumn('planned_quantity', 'numeric(14, 3)')
      .addColumn('unit_price', 'numeric(15, 0)', (column) => column.notNull())
      .addColumn('amount', 'numeric(15, 0)', (column) => column.notNull())
      .addUniqueConstraint('market_purchase_items_purchase_ingredient_unique', ['purchase_id', 'ingredient_id'])
      .addCheckConstraint('market_purchase_items_quantity_check', sql`quantity > 0 and unit_price >= 0`)
      .execute();
  },
  async down(database) {
    for (const table of [
      'market_purchase_items',
      'market_purchases',
      'food_suppliers',
      'buffet_events',
      'meal_plans',
      'meal_reports',
      'menu_items',
      'menus',
      'ingredient_norms',
      'dishes',
      'ingredients',
    ]) {
      await database.schema.dropTable(table).execute();
    }
  },
};
