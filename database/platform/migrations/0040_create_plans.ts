import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gói dịch vụ và giới hạn (DT-SaaS phần S5a, YCTD-194; tài liệu 47 mục 14.5). Khối số giữ sẵn 0040 đến 0049. Claude tự chọn theo
// ủy quyền của Eric ngày 2026-10-11:
// - `plans`: gói có mã, tên, phân hệ được bật (mã phân hệ của cây menu, phân hệ quản trị hệ thống luôn bật), giới hạn (học sinh đang
//   học, dung lượng tệp theo MB, số cấp học bật; trống là không giới hạn), số ngày dùng thử; giá niêm yết chừa sẵn cho S5b: cách tính
//   (theo học sinh mặc định, theo trường, theo phân hệ, Eric chốt 2026-10-25), đơn giá, phí tối thiểu, giá từng phân hệ, kỳ thu;
// - `school_plans`: gán gói cho trường có ngày hiệu lực (từ ngày, đến ngày trống là còn hiệu lực); lịch sử giữ nguyên;
// - `schools` thêm hạn dùng thử, hạn đã trả phí, thời điểm đổi trạng thái; trạng thái (dùng thử, hoạt động, chỉ đọc, tạm ngưng)
//   đã có từ S1a;
// - `platform_settings.plan_lifecycle`: hạn chuyển trạng thái cấu hình được (giả định GD-99: nhắc trước 15, 7, 1 ngày; chỉ đọc sau
//   hạn 7 ngày; tạm ngưng sau 30 ngày; dùng thử mặc định 30 ngày); không xóa dữ liệu khi hết hạn;
// - gói mặc định `full` bật mọi phân hệ, không giới hạn: trường chưa gán gói vẫn dùng như trước.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('description', 'text')
      // Mảng mã phân hệ; trống (null) là mọi phân hệ
      .addColumn('modules', 'jsonb')
      .addColumn('max_active_students', 'integer')
      .addColumn('max_storage_mb', 'integer')
      .addColumn('max_school_levels', 'integer')
      .addColumn('trial_days', 'integer', (column) => column.notNull().defaultTo(30))
      .addColumn('pricing_mode', 'text', (column) => column.notNull().defaultTo('per_student'))
      .addColumn('unit_price', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('minimum_fee', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('module_prices', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('billing_cycle', 'text', (column) => column.notNull().defaultTo('monthly'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('plans_code_check', sql`code ~ '^[a-z0-9][a-z0-9-]{0,40}$'`)
      .addCheckConstraint('plans_pricing_mode_check', sql`pricing_mode in ('per_student', 'per_school', 'per_module')`)
      .addCheckConstraint('plans_billing_cycle_check', sql`billing_cycle in ('monthly', 'term', 'yearly')`)
      .addCheckConstraint('plans_status_check', sql`status in ('active', 'archived')`)
      .addCheckConstraint(
        'plans_limits_check',
        sql`(max_active_students is null or max_active_students >= 0) and (max_storage_mb is null or max_storage_mb >= 0)
          and (max_school_levels is null or max_school_levels between 1 and 4) and trial_days between 0 and 365
          and unit_price >= 0 and minimum_fee >= 0`,
      )
      .execute();

    await database.schema
      .createTable('school_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('plan_id', 'uuid', (column) => column.notNull().references('plans.id'))
      .addColumn('effective_from', 'date', (column) => column.notNull())
      .addColumn('effective_to', 'date')
      .addColumn('assigned_by', 'text')
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('school_plans_dates_check', sql`effective_to is null or effective_to > effective_from`)
      .execute();
    await database.schema
      .createIndex('school_plans_school_idx')
      .on('school_plans')
      .columns(['school_id', 'effective_from'])
      .execute();

    await database.schema
      .alterTable('schools')
      .addColumn('trial_ends_on', 'date')
      .addColumn('paid_until', 'date')
      .addColumn('status_changed_at', 'timestamptz')
      .execute();

    await database
      .insertInto('platform_settings' as never)
      .values({
        key: 'plan_lifecycle',
        value: JSON.stringify({
          remind_days: [15, 7, 1],
          read_only_after_days: 7,
          suspend_after_days: 30,
          default_trial_days: 30,
        }),
      } as never)
      .onConflict((conflict) => conflict.column('key' as never).doNothing())
      .execute();
    await database
      .insertInto('plans' as never)
      .values({
        code: 'full',
        name: 'Đầy đủ',
        description: 'Mọi phân hệ, không giới hạn; gói mặc định của trường chưa gán gói khác',
        pricing_mode: 'per_student',
      } as never)
      .execute();
  },
  async down(database) {
    await sql`delete from platform_settings where key = 'plan_lifecycle'`.execute(database);
    await database.schema
      .alterTable('schools')
      .dropColumn('trial_ends_on')
      .dropColumn('paid_until')
      .dropColumn('status_changed_at')
      .execute();
    await database.schema.dropTable('school_plans').execute();
    await database.schema.dropTable('plans').execute();
  },
};
