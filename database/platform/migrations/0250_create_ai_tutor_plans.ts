import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L0 (YCTD-383): gói do nền tảng bán thẳng cho phụ huynh (nguồn `platform`), cùng cột với `ai_tutor_plans` của
// trường. Việc mua của phụ huynh ghi vào `ai_tutor_subscriptions` ở cơ sở dữ liệu hệ thống của trường có con, chung chỉ mục chặn mua trùng
// với gói trường bán; giao dịch thanh toán của nền tảng thuộc lát L1b. Giá theo đồng, số nguyên như `plans`
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('platform_ai_tutor_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
      .addColumn('price', 'bigint', (column) => column.notNull().check(sql`price >= 0`))
      .addColumn('turns', 'integer', (column) => column.notNull().check(sql`turns between 1 and 100000`))
      .addColumn('allow_images', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('school_levels', sql`text[]`, (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('platform_ai_tutor_plans_kind_check', sql`kind in ('monthly', 'top_up')`)
      .addCheckConstraint('platform_ai_tutor_plans_images_check', sql`kind = 'monthly' or not allow_images`)
      .addCheckConstraint(
        'platform_ai_tutor_plans_levels_check',
        sql`cardinality(school_levels) >= 1 and school_levels <@ array['TH', 'THCS', 'THPT']::text[]`,
      )
      .addCheckConstraint('platform_ai_tutor_plans_status_check', sql`status in ('active', 'archived')`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_ai_tutor_plans').execute();
  },
};
