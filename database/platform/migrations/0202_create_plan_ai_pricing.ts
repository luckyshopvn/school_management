import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214): thành phần phí AI của quy tắc tính phí S5b (GD-103). Quản trị nền tảng đặt cho từng gói ở màn hình thiết
// lập riêng: số token miễn phí mỗi kỳ, đơn giá theo một nghìn token vào và ra (đồng), đơn giá riêng theo mô hình nếu cần, phí tối thiểu
// của thành phần AI, bước làm tròn lên. Số tiền để trống (null) cho đến khi nhập lúc triển khai: gói chưa đặt đơn giá thì cấu hình
// `platform` chưa dùng được ở trường thuộc gói đó và hóa đơn không có dòng AI. Dòng phí AI dùng loại `ai` ở `invoice_lines`
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('plan_ai_pricing')
      .addColumn('plan_id', 'uuid', (column) => column.primaryKey().references('plans.id').onDelete('cascade'))
      .addColumn('free_tokens', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('input_price_per_1k', 'bigint')
      .addColumn('output_price_per_1k', 'bigint')
      // Đơn giá riêng theo mô hình: { "<mã mô hình>": { input, output } }, thiếu thì dùng đơn giá chung
      .addColumn('model_prices', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('minimum_fee', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('rounding_step', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'text')
      .addCheckConstraint(
        'plan_ai_pricing_amounts_check',
        sql`free_tokens >= 0 and (input_price_per_1k is null or input_price_per_1k >= 0)
          and (output_price_per_1k is null or output_price_per_1k >= 0) and minimum_fee >= 0 and rounding_step >= 1`,
      )
      .execute();
    await sql`alter table invoice_lines drop constraint invoice_lines_kind_check`.execute(database);
    await sql`alter table invoice_lines add constraint invoice_lines_kind_check
      check (kind in ('per_student', 'per_school', 'per_module', 'minimum', 'discount', 'ai'))`.execute(database);
  },
  async down(database) {
    await sql`delete from invoice_lines where kind = 'ai'`.execute(database);
    await sql`alter table invoice_lines drop constraint invoice_lines_kind_check`.execute(database);
    await sql`alter table invoice_lines add constraint invoice_lines_kind_check
      check (kind in ('per_student', 'per_school', 'per_module', 'minimum', 'discount'))`.execute(database);
    await database.schema.dropTable('plan_ai_pricing').execute();
  },
};
