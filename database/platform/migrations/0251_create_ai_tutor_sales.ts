import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L1b (YCTD-383): nền tảng bán thẳng gói cho phụ huynh qua cổng thanh toán của nền tảng. Lần mua của con vẫn ghi ở
// `ai_tutor_subscriptions` của trường (chung chỉ mục chặn mua trùng với gói trường bán); các bảng ở đây là phần tiền của nền tảng:
// - `platform_ai_tutor_orders`: giao dịch, mỗi lần phụ huynh bấm mua hoặc nâng gói một dòng; giữ chỗ tới `pending_expires_at`; nội dung
//   chuyển khoản riêng để đối chiếu tiền vào. Không lưu họ tên học sinh (chỉ mã con, cùng mã với cơ sở dữ liệu của trường);
// - `platform_ai_tutor_payments`: thông báo tiền vào của cổng, duy nhất theo cổng và mã giao dịch của cổng nên thông báo lặp không ghi hai
//   lần; kết quả đối chiếu ghi ở `outcome`;
// - `platform_ai_tutor_receipts`: biên lai của giao dịch đã thu, số biên lai tăng dần;
// - `platform_ai_tutor_refunds`: hoàn tiền do nhân viên vận hành ghi, kèm người thao tác và lý do (việc chuyển tiền trả thật làm ngoài hệ
//   thống). Tiền theo đồng, số nguyên như `platform_ai_tutor_plans`
export const migration: Migration = {
  async up(database) {
    await sql`create sequence platform_ai_tutor_order_number_seq`.execute(database);
    await sql`create sequence platform_ai_tutor_receipt_number_seq`.execute(database);

    await database.schema
      .createTable('platform_ai_tutor_orders')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('transfer_content', 'text', (column) => column.notNull().unique())
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id'))
      .addColumn('school_name', 'text', (column) => column.notNull())
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      // Dòng `ai_tutor_subscriptions` ở cơ sở dữ liệu hệ thống của trường (khác cơ sở dữ liệu nên không khóa ngoại)
      .addColumn('subscription_id', 'uuid', (column) => column.notNull())
      .addColumn('buyer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('buyer_name', 'text', (column) => column.notNull())
      .addColumn('plan_id', 'uuid', (column) => column.notNull().references('platform_ai_tutor_plans.id'))
      .addColumn('plan_name', 'text', (column) => column.notNull())
      .addColumn('plan_kind', 'text', (column) => column.notNull())
      .addColumn('period_month', 'date')
      .addColumn('turns', 'integer', (column) => column.notNull().check(sql`turns between 1 and 100000`))
      // `purchase`: mua mới; `upgrade`: nâng gói tháng giữa tháng, chỉ trả phần chênh lệch
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('purchase'))
      // Lần nâng ở `ai_tutor_upgrades` của trường (khác cơ sở dữ liệu nên không khóa ngoại)
      .addColumn('upgrade_id', 'uuid')
      .addColumn('amount', 'bigint', (column) => column.notNull().check(sql`amount > 0`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('pending_expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('provider', 'text')
      .addColumn('provider_reference', 'text')
      .addColumn('qr_content', 'text')
      .addColumn('paid_at', 'timestamptz')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancel_reason', 'text', (column) => column.check(sql`char_length(cancel_reason) <= 500`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('platform_ai_tutor_orders_kind_check', sql`kind in ('purchase', 'upgrade')`)
      .addCheckConstraint('platform_ai_tutor_orders_plan_kind_check', sql`plan_kind in ('monthly', 'top_up')`)
      .addCheckConstraint(
        'platform_ai_tutor_orders_status_check',
        sql`status in ('pending', 'paid', 'expired', 'cancelled', 'refunded', 'needs_refund')`,
      )
      .addCheckConstraint(
        'platform_ai_tutor_orders_upgrade_check',
        sql`(kind = 'upgrade') = (upgrade_id is not null)`,
      )
      .execute();
    await database.schema
      .createIndex('platform_ai_tutor_orders_child_index')
      .on('platform_ai_tutor_orders')
      .columns(['school_id', 'child_id', 'created_at'])
      .execute();
    await database.schema
      .createIndex('platform_ai_tutor_orders_pending_index')
      .on('platform_ai_tutor_orders')
      .columns(['school_id', 'pending_expires_at'])
      .where(sql.ref('status'), '=', 'pending')
      .execute();
    await database.schema
      .createIndex('platform_ai_tutor_orders_created_index')
      .on('platform_ai_tutor_orders')
      .column('created_at')
      .execute();

    await database.schema
      .createTable('platform_ai_tutor_payments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('order_id', 'uuid', (column) => column.references('platform_ai_tutor_orders.id'))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('provider_reference', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('transfer_content', 'text', (column) => column.notNull())
      .addColumn('received_at', 'timestamptz', (column) => column.notNull())
      // activated: kích hoạt được; already_settled: giao dịch đã thu hoặc đã đóng trước đó; amount_mismatch: sai số tiền; late: đến sau hạn
      // giữ chỗ, chờ hoàn tiền; unmatched: không thấy giao dịch
      .addColumn('outcome', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('platform_ai_tutor_payments_reference_unique', ['provider', 'provider_reference'])
      .addCheckConstraint(
        'platform_ai_tutor_payments_outcome_check',
        sql`outcome in ('activated', 'already_settled', 'amount_mismatch', 'late', 'unmatched')`,
      )
      .execute();

    await database.schema
      .createTable('platform_ai_tutor_receipts')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('order_id', 'uuid', (column) => column.notNull().unique().references('platform_ai_tutor_orders.id'))
      .addColumn('number', 'text', (column) => column.notNull().unique())
      .addColumn('payer_name', 'text', (column) => column.notNull())
      .addColumn('school_name', 'text', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull().check(sql`amount > 0`))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('provider_reference', 'text', (column) => column.notNull())
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull())
      .execute();

    await database.schema
      .createTable('platform_ai_tutor_refunds')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('order_id', 'uuid', (column) => column.notNull().unique().references('platform_ai_tutor_orders.id'))
      .addColumn('amount', 'bigint', (column) => column.notNull().check(sql`amount > 0`))
      .addColumn('reason', 'text', (column) => column.notNull().check(sql`char_length(reason) between 1 and 500`))
      .addColumn('operator_id', 'uuid', (column) => column.notNull().references('platform_operators.id'))
      .addColumn('operator_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('platform_ai_tutor_refunds').execute();
    await database.schema.dropTable('platform_ai_tutor_receipts').execute();
    await database.schema.dropTable('platform_ai_tutor_payments').execute();
    await database.schema.dropTable('platform_ai_tutor_orders').execute();
    await sql`drop sequence platform_ai_tutor_receipt_number_seq`.execute(database);
    await sql`drop sequence platform_ai_tutor_order_number_seq`.execute(database);
  },
};
