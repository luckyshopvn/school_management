import { sql, type CreateTableBuilder } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục dịch vụ, biểu phí theo phiên bản, loại miễn giảm, khoản mục thu chi; dùng chung toàn trường
// (P05-01, P05-02, P05-11, P06-10; BR-17, BR-18, BR-20, BR-21, BR-83; YCTD-49)
export const MEAL_SERVICE_ID = '00000000-0000-4000-8000-0000000000b1';

function withCommonColumns<Table extends string>(table: CreateTableBuilder<Table>) {
  return table
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'uuid');
}

const ACTIVE_OR_INACTIVE = sql`status in ('active', 'inactive')`;

export const migration: Migration = {
  async up(database) {
    await withCommonColumns(database.schema.createTable('services'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('calculation_method', 'text', (column) => column.notNull())
      .addColumn('is_mandatory', 'boolean', (column) => column.notNull().defaultTo(false))
      // Dịch vụ hệ thống tạo sẵn như bán trú: không ngừng sử dụng, không đổi cách tính
      .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint(
        'services_calculation_method_check',
        sql`calculation_method in ('monthly', 'per_present_day')`,
      )
      .addCheckConstraint('services_status_check', ACTIVE_OR_INACTIVE)
      .execute();
    // Bán trú bắt buộc với mọi trẻ đang học, tiền ăn theo số ngày có mặt (BR-83, BR-58, BR-14)
    await sql`insert into services (id, code, name, unit, calculation_method, is_mandatory, is_system)
      values (${MEAL_SERVICE_ID}, 'BAN_TRU', 'Bán trú', 'ngày', 'per_present_day', true, true)`.execute(database);

    await withCommonColumns(database.schema.createTable('fee_schedules'))
      .addColumn('name', 'text', (column) => column.notNull())
      // Ngày 1 của tháng; phiên bản sau đặt ngày kết thúc của phiên bản trước (BR-18)
      .addColumn('effective_from', 'date', (column) => column.notNull().unique())
      .addColumn('effective_to', 'date')
      .addCheckConstraint('fee_schedules_first_day_check', sql`extract(day from effective_from) = 1`)
      .addCheckConstraint('fee_schedules_range_check', sql`effective_to is null or effective_to >= effective_from`)
      .execute();

    await database.schema
      .createTable('fee_schedule_items')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('fee_schedule_id', 'uuid', (column) =>
        column.notNull().references('fee_schedules.id').onDelete('cascade'),
      )
      .addColumn('grade_level', 'text', (column) => column.notNull())
      // Học phí chính khóa mỗi tháng hoặc giá của một dịch vụ
      .addColumn('fee_type', 'text', (column) => column.notNull())
      .addColumn('service_id', 'uuid', (column) => column.references('services.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addCheckConstraint('fee_schedule_items_type_check', sql`fee_type in ('tuition', 'service')`)
      .addCheckConstraint(
        'fee_schedule_items_service_check',
        sql`(fee_type = 'tuition' and service_id is null) or (fee_type = 'service' and service_id is not null)`,
      )
      .addCheckConstraint('fee_schedule_items_amount_check', sql`amount >= 0`)
      .execute();
    await sql`create unique index fee_schedule_items_unique on fee_schedule_items
      (fee_schedule_id, grade_level, fee_type, coalesce(service_id, '00000000-0000-0000-0000-000000000000'))`.execute(
      database,
    );

    await withCommonColumns(database.schema.createTable('discount_types'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('calculation_method', 'text', (column) => column.notNull())
      // Phần trăm từ 1 đến 100, hoặc số tiền đồng
      .addColumn('value', 'bigint', (column) => column.notNull())
      // Khoản áp dụng: 'tuition' là học phí chính khóa, còn lại là mã dịch vụ
      .addColumn('applies_to', 'jsonb', (column) => column.notNull())
      .addColumn('condition_note', 'text')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('discount_types_method_check', sql`calculation_method in ('percent', 'amount')`)
      .addCheckConstraint(
        'discount_types_value_check',
        sql`(calculation_method = 'percent' and value between 1 and 100) or (calculation_method = 'amount' and value > 0)`,
      )
      .addCheckConstraint('discount_types_status_check', ACTIVE_OR_INACTIVE)
      .execute();

    await withCommonColumns(database.schema.createTable('cashflow_categories'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('group_name', 'text', (column) => column.notNull())
      .addColumn('flow_type', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addCheckConstraint('cashflow_categories_flow_type_check', sql`flow_type in ('income', 'expense')`)
      .addCheckConstraint('cashflow_categories_status_check', ACTIVE_OR_INACTIVE)
      .execute();
  },
  async down(database) {
    for (const table of ['cashflow_categories', 'discount_types', 'fee_schedule_items', 'fee_schedules', 'services']) {
      await database.schema.dropTable(table).execute();
    }
  },
};
