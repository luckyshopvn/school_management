import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214): đo token AI theo trường để thu phí (cấu hình `platform`, GD-103). Mỗi dòng là tổng của một ngày (giờ
// Việt Nam), một mô hình, một cấu hình của một trường, tổng hợp từ nhật ký yêu cầu ở cơ sở dữ liệu hệ thống của trường bằng việc nền
// theo trường (S1b); ghi lặp không cộng trùng (ghi đè theo khóa ngày, mô hình, cấu hình). Chỉ các yêu cầu của cấu hình `platform` mới
// thành phí; dòng của cấu hình `school` (nếu có) chỉ để xem. Số token lấy từ phản hồi của nhà cung cấp, không ước lượng
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_token_usage')
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('usage_date', 'date', (column) => column.notNull())
      .addColumn('model', 'text', (column) => column.notNull())
      .addColumn('config', 'text', (column) => column.notNull())
      .addColumn('requests', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('input_tokens', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('output_tokens', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addPrimaryKeyConstraint('ai_token_usage_pkey', ['school_id', 'usage_date', 'model', 'config'])
      .addCheckConstraint('ai_token_usage_config_check', sql`config in ('school', 'platform')`)
      .addCheckConstraint(
        'ai_token_usage_amounts_check',
        sql`requests >= 0 and input_tokens >= 0 and output_tokens >= 0`,
      )
      .execute();
    await database.schema.createIndex('ai_token_usage_date_idx').on('ai_token_usage').column('usage_date').execute();
  },
  async down(database) {
    await database.schema.dropTable('ai_token_usage').execute();
  },
};
