import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Nâng gói tháng giữa tháng của gia sư AI trả phí (YCTD-383, Eric chọn ngày 2026-10-30; dùng chung cho trường bán và nền tảng bán).
// Mỗi lần nâng một dòng: chụp gói cũ, gói mới, số ngày còn lại của tháng, phần chênh lệch phải trả và số lượt cộng thêm theo cùng tỉ lệ.
// Trường bán: ghi rồi áp ngay, phần chênh lệch thành dòng thu trên hóa đơn học phí. Nền tảng bán: ghi ở trạng thái chờ, áp khi đã thu
// tiền. Khi áp, dòng đăng ký đổi sang gói mới (mã gói, tên, quyền gửi ảnh) và cộng thêm lượt; giá trên dòng đăng ký giữ giá mua ban đầu
// để không thu trùng, giá tháng đang dùng là giá đích của lần nâng gần nhất đã áp
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_tutor_upgrades')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('subscription_id', 'uuid', (column) => column.notNull().references('ai_tutor_subscriptions.id'))
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('plan_source', 'text', (column) => column.notNull())
      .addColumn('from_plan_id', 'uuid', (column) => column.notNull())
      .addColumn('from_plan_name', 'text', (column) => column.notNull())
      .addColumn('from_price', sql`numeric(14, 2)`, (column) => column.notNull().check(sql`from_price >= 0`))
      .addColumn('from_turns', 'integer', (column) => column.notNull())
      .addColumn('to_plan_id', 'uuid', (column) => column.notNull())
      .addColumn('to_plan_name', 'text', (column) => column.notNull())
      .addColumn('to_price', sql`numeric(14, 2)`, (column) => column.notNull())
      .addColumn('to_turns', 'integer', (column) => column.notNull())
      .addColumn('to_allow_images', 'boolean', (column) => column.notNull())
      .addColumn('remaining_days', 'integer', (column) => column.notNull())
      .addColumn('days_in_month', 'integer', (column) => column.notNull())
      .addColumn('price_difference', sql`numeric(14, 2)`, (column) =>
        column.notNull().check(sql`price_difference >= 0`),
      )
      .addColumn('extra_turns', 'integer', (column) => column.notNull().check(sql`extra_turns >= 0`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      // Hạn giữ chỗ khi chờ thanh toán (nền tảng bán); trống là giữ tới khi áp hoặc hủy
      .addColumn('pending_expires_at', 'timestamptz')
      .addColumn('buyer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('buyer_name', 'text', (column) => column.notNull())
      // Mã dòng thu trên hóa đơn học phí hoặc mã giao dịch của nền tảng
      .addColumn('external_reference', 'text')
      .addColumn('applied_at', 'timestamptz')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancel_reason', 'text', (column) => column.check(sql`char_length(cancel_reason) <= 500`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_upgrades_source_check', sql`plan_source in ('school', 'platform')`)
      .addCheckConstraint(
        'ai_tutor_upgrades_status_check',
        sql`status in ('pending', 'applied', 'cancelled', 'refunded')`,
      )
      .addCheckConstraint(
        'ai_tutor_upgrades_terms_check',
        sql`to_price > from_price and to_turns >= from_turns and to_plan_id <> from_plan_id`,
      )
      .addCheckConstraint(
        'ai_tutor_upgrades_days_check',
        sql`days_in_month between 28 and 31 and remaining_days between 1 and days_in_month`,
      )
      .addCheckConstraint(
        'ai_tutor_upgrades_applied_check',
        sql`status = 'pending' or status = 'cancelled' or applied_at is not null`,
      )
      .execute();
    // Mỗi đăng ký chỉ một lần nâng đang chờ
    await sql`create unique index ai_tutor_upgrades_one_pending
      on ai_tutor_upgrades (subscription_id)
      where status = 'pending'`.execute(database);
    await database.schema
      .createIndex('ai_tutor_upgrades_subscription_idx')
      .on('ai_tutor_upgrades')
      .columns(['subscription_id', 'status', 'applied_at'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('ai_tutor_upgrades').execute();
  },
};
