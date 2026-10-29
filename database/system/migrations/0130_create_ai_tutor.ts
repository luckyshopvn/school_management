import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí trong ứng dụng học sinh, lát L0 (YCTD-383; đề xuất Eric duyệt ngày 2026-10-30). Bảng ở cơ sở dữ liệu hệ thống của
// trường (không theo năm học) vì gói tháng, lượt mua thêm (giữ 12 tháng) và lịch sử trò chuyện (giữ 12 tháng) đi qua ranh giới năm học;
// mã trẻ giữ nguyên khi sang năm học mới (tài liệu 16 mục 1, quy ước 10) nên không có khóa ngoại tới `children`:
// - `ai_tutor_plans`: gói do trường bán (nguồn `school`); gói do nền tảng bán nằm ở cơ sở dữ liệu nền tảng (`platform_ai_tutor_plans`);
// - `ai_tutor_subscriptions`: mỗi lần mua cho một con (gói tháng hoặc gói lượt), chụp lại gói lúc mua, cả hai nguồn ghi vào đây nên chỉ
//   mục duy nhất `ai_tutor_subscriptions_one_monthly` chặn mua trùng gói tháng cho cùng một con trong cùng tháng giữa hai nguồn; dòng
//   chờ thanh toán quá hạn được hủy trước khi ghi dòng mới; số lượt đã dùng, đang tạm giữ nằm ngay trên dòng;
// - `ai_tutor_turn_ledger`: sổ lượt, mỗi lượt hỏi một dòng: tạm giữ trước khi gọi AI, trừ thật sau khi gọi, hoàn khi lỗi;
// - `ai_tutor_conversations`, `ai_tutor_messages`: hội thoại của em, giữ 12 tháng (việc xóa theo hạn thuộc lát L2)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_tutor_plans')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
      .addColumn('price', sql`numeric(14, 2)`, (column) => column.notNull().check(sql`price >= 0`))
      // Gói tháng: số lượt mỗi tháng; gói lượt: số lượt của một lần mua
      .addColumn('turns', 'integer', (column) => column.notNull().check(sql`turns between 1 and 100000`))
      // Chỉ gói tháng mới cho gửi ảnh; gói lượt dùng theo quyền gửi ảnh của gói tháng đang có
      .addColumn('allow_images', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('school_levels', sql`text[]`, (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_plans_kind_check', sql`kind in ('monthly', 'top_up')`)
      .addCheckConstraint('ai_tutor_plans_images_check', sql`kind = 'monthly' or not allow_images`)
      .addCheckConstraint(
        'ai_tutor_plans_levels_check',
        sql`cardinality(school_levels) >= 1 and school_levels <@ array['TH', 'THCS', 'THPT']::text[]`,
      )
      .addCheckConstraint('ai_tutor_plans_status_check', sql`status in ('active', 'archived')`)
      .execute();

    await database.schema
      .createTable('ai_tutor_subscriptions')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('plan_source', 'text', (column) => column.notNull())
      // Mã gói ở `ai_tutor_plans` (nguồn `school`) hoặc `platform_ai_tutor_plans` (nguồn `platform`), không khóa ngoại vì khác nơi
      .addColumn('plan_id', 'uuid', (column) => column.notNull())
      .addColumn('plan_kind', 'text', (column) => column.notNull())
      .addColumn('plan_name', 'text', (column) => column.notNull())
      .addColumn('price', sql`numeric(14, 2)`, (column) => column.notNull().check(sql`price >= 0`))
      .addColumn('allow_images', 'boolean', (column) => column.notNull())
      // Gói tháng: ngày đầu của tháng dùng; gói lượt: trống
      .addColumn('period_month', 'date')
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('pending'))
      // Dòng chờ thanh toán của nền tảng hết giữ chỗ lúc này; trống là giữ tới khi kích hoạt hoặc hủy (trường bán qua hóa đơn học phí)
      .addColumn('pending_expires_at', 'timestamptz')
      .addColumn('buyer_user_id', 'uuid', (column) => column.notNull())
      .addColumn('buyer_name', 'text', (column) => column.notNull())
      // Mã dòng thu trên hóa đơn học phí (lát L1a) hoặc mã giao dịch của nền tảng (lát L1b)
      .addColumn('external_reference', 'text')
      .addColumn('turns', 'integer', (column) => column.notNull().check(sql`turns between 1 and 100000`))
      .addColumn('used_turns', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('held_turns', 'integer', (column) => column.notNull().defaultTo(0))
      // Khoảng dùng được, đặt khi kích hoạt: gói tháng từ đầu tháng tới đầu tháng sau (giờ Việt Nam); gói lượt 12 tháng từ ngày mua
      .addColumn('valid_from', 'timestamptz')
      .addColumn('valid_until', 'timestamptz')
      .addColumn('activated_at', 'timestamptz')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('cancel_reason', 'text', (column) => column.check(sql`char_length(cancel_reason) <= 500`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_subscriptions_source_check', sql`plan_source in ('school', 'platform')`)
      .addCheckConstraint('ai_tutor_subscriptions_kind_check', sql`plan_kind in ('monthly', 'top_up')`)
      .addCheckConstraint(
        'ai_tutor_subscriptions_status_check',
        sql`status in ('pending', 'active', 'cancelled', 'refunded')`,
      )
      .addCheckConstraint(
        'ai_tutor_subscriptions_period_check',
        sql`case when plan_kind = 'monthly'
          then period_month is not null and extract(day from period_month) = 1
          else period_month is null end`,
      )
      .addCheckConstraint(
        'ai_tutor_subscriptions_counters_check',
        sql`used_turns >= 0 and held_turns >= 0 and used_turns + held_turns <= turns`,
      )
      .addCheckConstraint(
        'ai_tutor_subscriptions_window_check',
        sql`status <> 'active' or (valid_from is not null and valid_until > valid_from and activated_at is not null)`,
      )
      .execute();
    // Mỗi con một gói tháng còn hiệu lực hoặc đang chờ trong một tháng, bất kể trường bán hay nền tảng bán
    await sql`create unique index ai_tutor_subscriptions_one_monthly
      on ai_tutor_subscriptions (child_id, period_month)
      where plan_kind = 'monthly' and status in ('pending', 'active')`.execute(database);
    await database.schema
      .createIndex('ai_tutor_subscriptions_child_idx')
      .on('ai_tutor_subscriptions')
      .columns(['child_id', 'status', 'valid_until'])
      .execute();

    await database.schema
      .createTable('ai_tutor_turn_ledger')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('subscription_id', 'uuid', (column) => column.notNull().references('ai_tutor_subscriptions.id'))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('held'))
      .addColumn('held_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('settled_at', 'timestamptz')
      // Lý do hoàn lượt: lỗi nhà cung cấp, bị chặn, tạm giữ quá hạn
      .addColumn('release_reason', 'text', (column) => column.check(sql`char_length(release_reason) <= 200`))
      .addCheckConstraint('ai_tutor_turn_ledger_status_check', sql`status in ('held', 'captured', 'released')`)
      .addCheckConstraint('ai_tutor_turn_ledger_settled_check', sql`(status = 'held') = (settled_at is null)`)
      .execute();
    await database.schema
      .createIndex('ai_tutor_turn_ledger_child_idx')
      .on('ai_tutor_turn_ledger')
      .columns(['child_id', 'held_at'])
      .execute();
    await sql`create index ai_tutor_turn_ledger_held_idx on ai_tutor_turn_ledger (held_at)
      where status = 'held'`.execute(database);

    await database.schema
      .createTable('ai_tutor_conversations')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull())
      .addColumn('school_level', 'text', (column) => column.notNull())
      .addColumn('grade_level_code', 'text', (column) => column.notNull())
      .addColumn('subject_code', 'text', (column) => column.notNull())
      .addColumn('subject_name', 'text', (column) => column.notNull())
      // Chủ đề ngắn cho cha mẹ xem (không có toàn văn)
      .addColumn('topic', 'text', (column) => column.check(sql`char_length(topic) <= 200`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_message_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_conversations_level_check', sql`school_level in ('TH', 'THCS', 'THPT')`)
      .execute();
    await database.schema
      .createIndex('ai_tutor_conversations_child_idx')
      .on('ai_tutor_conversations')
      .columns(['child_id', 'last_message_at'])
      .execute();

    await database.schema
      .createTable('ai_tutor_messages')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('conversation_id', 'uuid', (column) =>
        column.notNull().references('ai_tutor_conversations.id').onDelete('cascade'),
      )
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('body', 'text', (column) => column.notNull().check(sql`char_length(body) between 1 and 8000`))
      // Lượt đã trừ cho câu trả lời của gia sư
      .addColumn('ledger_entry_id', 'uuid', (column) => column.references('ai_tutor_turn_ledger.id'))
      .addColumn('model', 'text')
      .addColumn('input_tokens', 'integer', (column) => column.check(sql`input_tokens >= 0`))
      .addColumn('output_tokens', 'integer', (column) => column.check(sql`output_tokens >= 0`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('ai_tutor_messages_role_check', sql`role in ('student', 'tutor')`)
      .execute();
    await database.schema
      .createIndex('ai_tutor_messages_conversation_idx')
      .on('ai_tutor_messages')
      .columns(['conversation_id', 'created_at'])
      .execute();
    // Xóa theo hạn giữ 12 tháng
    await database.schema
      .createIndex('ai_tutor_messages_created_idx')
      .on('ai_tutor_messages')
      .column('created_at')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('ai_tutor_messages').execute();
    await database.schema.dropTable('ai_tutor_conversations').execute();
    await database.schema.dropTable('ai_tutor_turn_ledger').execute();
    await database.schema.dropTable('ai_tutor_subscriptions').execute();
    await database.schema.dropTable('ai_tutor_plans').execute();
  },
};
