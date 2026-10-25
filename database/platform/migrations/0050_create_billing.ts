import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Thu phí tự động (DT-SaaS phần S5b, YCTD-196; tài liệu 32 mục 14.5). Khối số giữ sẵn 0050 đến 0059. Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11 ở những chỗ kế hoạch chưa chốt:
// - `price_rules`: quy tắc tính phí cấu hình được (Eric chốt 2026-10-25, GD-94): thành phần theo học sinh (bậc thang lũy tiến hoặc
//   theo bậc cả gói), theo trường (phí cố định mỗi kỳ), theo phân hệ (giá từng phân hệ mỗi kỳ), kết hợp được, mặc định theo học sinh;
//   phí tối thiểu, kỳ (tháng, quý, năm), VAT, số ngày hạn trả; số tiền là số nguyên đồng. Gói chọn quy tắc ở `plans.price_rule_id`;
//   gói chưa chọn thì tính theo giá niêm yết của gói (S5a);
// - `usage_snapshots`: số liệu chốt kỳ (học sinh đang học, dung lượng, số cấp học, phân hệ) của từng trường, mỗi kỳ một dòng;
// - `invoices`, `invoice_lines`: hóa đơn nội bộ kèm bản chụp quy tắc và số liệu lúc lập; mỗi kỳ của trường một hóa đơn còn hiệu lực;
//   nội dung chuyển khoản là mã hóa đơn bỏ dấu gạch;
// - `invoice_payments`: tiền vào (cổng báo, giả lập, vận hành ghi tay); trùng mã giao dịch của cổng thì bỏ qua (không gia hạn hai lần);
//   tiền không khớp hóa đơn nào giữ ở trạng thái chưa khớp để vận hành gán tay;
// - `billing_adjustments`: điều chỉnh tay của vận hành (giảm giá, tặng kỳ, ghi nhận tiền tay, hủy hóa đơn) bắt buộc có lý do;
// - `einvoice_documents`: hóa đơn điện tử phát hành qua bộ nối `EInvoiceProvider` (nhà cung cấp thật chưa chốt, có bộ giả lập);
// - `dunning_events`: mỗi lần nhắc gia hạn hoặc chuyển trạng thái do quá hạn, một dòng cho mỗi mốc (chạy lặp không nhắc lại);
// - `platform_integration_secrets`: khóa cổng thanh toán của nền tảng (tài khoản nhận tiền của nền tảng), mã hóa AES-256-GCM bằng khóa
//   gốc của nền tảng như khóa của trường ở S1a, S3; chỉ trả gợi ý bốn ký tự cuối;
// - `platform_settings.billing`: tiền tố mã hóa đơn, tài khoản nhận tiền, bộ nối hóa đơn điện tử, lịch nhắc, kênh nhắc.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('price_rules')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      // Thành phần tính phí: mảng con của per_student, per_school, per_module
      .addColumn('components', 'jsonb', (column) => column.notNull().defaultTo(sql`'["per_student"]'::jsonb`))
      // Bậc thang theo số học sinh: [{ up_to: số học sinh hoặc null (không giới hạn), unit_price }], tăng dần
      .addColumn('student_tiers', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('tier_mode', 'text', (column) => column.notNull().defaultTo('graduated'))
      .addColumn('school_fee', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('module_prices', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('minimum_fee', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('period', 'text', (column) => column.notNull().defaultTo('monthly'))
      .addColumn('vat_percent', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('due_days', 'integer', (column) => column.notNull().defaultTo(15))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('price_rules_code_check', sql`code ~ '^[a-z0-9][a-z0-9-]{0,40}$'`)
      .addCheckConstraint('price_rules_tier_mode_check', sql`tier_mode in ('graduated', 'volume')`)
      .addCheckConstraint('price_rules_period_check', sql`period in ('monthly', 'quarterly', 'yearly')`)
      .addCheckConstraint('price_rules_status_check', sql`status in ('active', 'archived')`)
      .addCheckConstraint(
        'price_rules_amounts_check',
        sql`school_fee >= 0 and minimum_fee >= 0 and vat_percent between 0 and 100 and due_days between 0 and 120`,
      )
      .execute();
    await database.schema
      .alterTable('plans')
      .addColumn('price_rule_id', 'uuid', (column) => column.references('price_rules.id'))
      .execute();

    await database.schema
      .createTable('usage_snapshots')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('period_start', 'date', (column) => column.notNull())
      .addColumn('period_end', 'date', (column) => column.notNull())
      .addColumn('active_students', 'integer', (column) => column.notNull())
      .addColumn('storage_mb', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('school_levels', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('modules', 'jsonb')
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('scheduler'))
      .addColumn('taken_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('usage_snapshots_period_key', ['school_id', 'period_start'])
      .addCheckConstraint('usage_snapshots_source_check', sql`source in ('scheduler', 'operator')`)
      .execute();

    await sql`create sequence invoice_number_seq`.execute(database);
    await database.schema
      .createTable('invoices')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('code', 'text', (column) => column.notNull().unique())
      // Nội dung chuyển khoản: mã hóa đơn bỏ dấu gạch, chữ hoa
      .addColumn('payment_content', 'text', (column) => column.notNull().unique())
      .addColumn('kind', 'text', (column) => column.notNull().defaultTo('period'))
      .addColumn('period_start', 'date', (column) => column.notNull())
      .addColumn('period_end', 'date', (column) => column.notNull())
      .addColumn('plan_id', 'uuid', (column) => column.references('plans.id'))
      .addColumn('plan_code', 'text')
      .addColumn('price_rule', 'jsonb', (column) => column.notNull())
      .addColumn('usage', 'jsonb', (column) => column.notNull())
      .addColumn('subtotal', 'bigint', (column) => column.notNull())
      .addColumn('discount_total', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('vat_percent', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('vat_amount', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('total', 'bigint', (column) => column.notNull())
      .addColumn('amount_paid', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('issued'))
      .addColumn('issued_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('due_on', 'date', (column) => column.notNull())
      .addColumn('paid_at', 'timestamptz')
      .addColumn('voided_at', 'timestamptz')
      .addColumn('void_reason', 'text')
      .addColumn('last_payment_request', 'jsonb')
      .addColumn('created_by', 'text', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('invoices_kind_check', sql`kind in ('period', 'manual')`)
      .addCheckConstraint('invoices_status_check', sql`status in ('issued', 'paid', 'void')`)
      .addCheckConstraint(
        'invoices_amounts_check',
        sql`subtotal >= 0 and discount_total >= 0 and vat_amount >= 0 and total >= 0 and amount_paid >= 0
          and period_end >= period_start`,
      )
      .execute();
    await sql`create unique index invoices_period_idx on invoices (school_id, period_start)
      where kind = 'period' and status <> 'void'`.execute(database);
    await database.schema
      .createIndex('invoices_school_idx')
      .on('invoices')
      .columns(['school_id', 'issued_at'])
      .execute();

    await database.schema
      .createTable('invoice_lines')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id').onDelete('cascade'))
      .addColumn('sort', 'integer', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('description', 'text', (column) => column.notNull())
      .addColumn('quantity', 'integer', (column) => column.notNull().defaultTo(1))
      .addColumn('unit_price', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addCheckConstraint(
        'invoice_lines_kind_check',
        sql`kind in ('per_student', 'per_school', 'per_module', 'minimum', 'discount')`,
      )
      .execute();

    await database.schema
      .createTable('invoice_payments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_id', 'uuid', (column) => column.references('invoices.id').onDelete('set null'))
      .addColumn('school_id', 'uuid', (column) => column.references('schools.id').onDelete('set null'))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('provider_reference', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull())
      .addColumn('transfer_content', 'text', (column) => column.notNull().defaultTo(''))
      .addColumn('received_at', 'timestamptz', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('recorded_by', 'text')
      .addColumn('note', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('invoice_payments_reference_key', ['provider', 'provider_reference'])
      .addCheckConstraint('invoice_payments_status_check', sql`status in ('matched', 'unmatched')`)
      .addCheckConstraint('invoice_payments_amount_check', sql`amount > 0`)
      .execute();

    await database.schema
      .createTable('billing_adjustments')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('invoice_id', 'uuid', (column) => column.references('invoices.id').onDelete('set null'))
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('amount', 'bigint', (column) => column.notNull().defaultTo(0))
      .addColumn('months', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint(
        'billing_adjustments_kind_check',
        sql`kind in ('discount', 'free_period', 'manual_payment', 'void', 'assign_payment')`,
      )
      .addCheckConstraint('billing_adjustments_reason_check', sql`char_length(btrim(reason)) between 3 and 500`)
      .execute();

    await database.schema
      .createTable('einvoice_documents')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('invoice_id', 'uuid', (column) => column.notNull().references('invoices.id').onDelete('cascade'))
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('external_id', 'text')
      .addColumn('lookup_code', 'text')
      .addColumn('error', 'text')
      .addColumn('issued_at', 'timestamptz')
      .addColumn('cancelled_at', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('einvoice_documents_status_check', sql`status in ('issued', 'cancelled', 'failed')`)
      .execute();
    await sql`create unique index einvoice_documents_active_idx on einvoice_documents (invoice_id) where status = 'issued'`.execute(
      database,
    );

    await database.schema
      .createTable('dunning_events')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('school_id', 'uuid', (column) => column.notNull().references('schools.id').onDelete('cascade'))
      .addColumn('invoice_id', 'uuid', (column) => column.references('invoices.id').onDelete('set null'))
      .addColumn('due_on', 'date', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('days', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('channels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('dunning_events_once_key', ['school_id', 'due_on', 'kind', 'days'])
      .addCheckConstraint(
        'dunning_events_kind_check',
        sql`kind in ('before_due', 'overdue', 'read_only', 'suspended', 'reopened')`,
      )
      .execute();

    await database.schema
      .createTable('platform_integration_secrets')
      .addColumn('connector', 'text', (column) => column.primaryKey())
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('values_encrypted', 'text', (column) => column.notNull())
      .addColumn('hints', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'text')
      .addCheckConstraint(
        'platform_integration_secrets_connector_check',
        sql`connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr')`,
      )
      .execute();

    await database
      .insertInto('platform_settings' as never)
      .values({
        key: 'billing',
        value: JSON.stringify({
          invoice_prefix: 'HD',
          receiving_account: { bank_bin: null, account_number: null, account_name: null },
          einvoice_provider: 'none',
          auto_issue_einvoice: false,
          remind_days_before: [15, 7, 1],
          remind_days_after: [1, 3],
          channels: ['in_app'],
        }),
      } as never)
      .onConflict((conflict) => conflict.column('key' as never).doNothing())
      .execute();
  },
  async down(database) {
    await sql`delete from platform_settings where key = 'billing'`.execute(database);
    await database.schema.dropTable('platform_integration_secrets').execute();
    await database.schema.dropTable('dunning_events').execute();
    await database.schema.dropTable('einvoice_documents').execute();
    await database.schema.dropTable('billing_adjustments').execute();
    await database.schema.dropTable('invoice_payments').execute();
    await database.schema.dropTable('invoice_lines').execute();
    await database.schema.dropTable('invoices').execute();
    await sql`drop sequence invoice_number_seq`.execute(database);
    await database.schema.dropTable('usage_snapshots').execute();
    await database.schema.alterTable('plans').dropColumn('price_rule_id').execute();
    await database.schema.dropTable('price_rules').execute();
  },
};
