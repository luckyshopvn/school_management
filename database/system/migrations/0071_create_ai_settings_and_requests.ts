import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214; tài liệu 47 mục 15): trợ lý AI soạn câu hỏi nháp và kế hoạch bài dạy nháp. Khối số giữ sẵn 0071 đến 0073.
// Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `ai_settings`: một dòng, bật tắt theo trường (mặc định tắt), cấu hình khóa (`school`: trường tự nhập khóa, miễn phí; `platform`:
//   khóa của nền tảng, thu phí theo gói và token; GD-102), nhà cung cấp, mã mô hình riêng của trường, hạn mức yêu cầu mỗi người mỗi
//   ngày, thời hạn giữ nhật ký (12 tháng, GD-104). Khóa của cấu hình `school` ở `integration_secrets` (`connector = 'ai'`) mã hóa
//   bằng khóa của trường như S3; khóa của cấu hình `platform` không ở cơ sở dữ liệu trường;
// - `ai_requests`: nhật ký yêu cầu (ai, lúc nào, loại, môn, lớp, chủ đề, kích thước vào ra, số token vào ra từ phản hồi nhà cung cấp,
//   nhà cung cấp, mã mô hình, cấu hình dùng, kết quả, lỗi); **không lưu toàn văn lời nhắc**, chỉ mã băm SHA-256 để tra. Số token của
//   cấu hình `platform` được việc nền tổng hợp lên cơ sở dữ liệu nền tảng để tính phí.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('ai_settings')
      .addColumn('id', 'integer', (column) => column.primaryKey().check(sql`id = 1`))
      .addColumn('enabled', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('key_mode', 'text', (column) => column.notNull().defaultTo('school'))
      .addColumn('provider', 'text', (column) => column.notNull().defaultTo('anthropic'))
      .addColumn('model', 'text', (column) => column.check(sql`char_length(model) between 1 and 100`))
      .addColumn('per_user_daily_requests', 'integer', (column) => column.check(sql`per_user_daily_requests >= 0`))
      .addColumn('log_retention_months', 'integer', (column) =>
        column
          .notNull()
          .defaultTo(12)
          .check(sql`log_retention_months between 1 and 120`),
      )
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by_name', 'text')
      .addCheckConstraint('ai_settings_key_mode_check', sql`key_mode in ('school', 'platform')`)
      .addCheckConstraint('ai_settings_provider_check', sql`provider ~ '^[a-z0-9][a-z0-9-]{0,30}$'`)
      .execute();

    await database.schema
      .createTable('ai_requests')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('user_id', 'uuid', (column) => column.notNull())
      .addColumn('user_name', 'text', (column) => column.notNull())
      .addColumn('kind', 'text', (column) => column.notNull())
      .addColumn('school_level', 'text')
      .addColumn('grade_level_code', 'text')
      .addColumn('subject_name', 'text')
      .addColumn('topic', 'text')
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('key_mode', 'text', (column) => column.notNull())
      .addColumn('provider', 'text', (column) => column.notNull())
      .addColumn('model', 'text', (column) => column.notNull())
      // Mã băm của lời nhắc đã gửi; không lưu toàn văn
      .addColumn('prompt_sha256', 'text', (column) => column.notNull())
      .addColumn('prompt_chars', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('response_chars', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('input_tokens', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('output_tokens', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('result_count', 'integer', (column) => column.notNull().defaultTo(0))
      // Mã các bản nháp đã sinh (câu hỏi hoặc học liệu)
      .addColumn('result_ids', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('error', 'text')
      .addColumn('duration_ms', 'integer', (column) => column.notNull().defaultTo(0))
      .addCheckConstraint('ai_requests_kind_check', sql`kind in ('questions', 'lesson_plan', 'check')`)
      .addCheckConstraint('ai_requests_status_check', sql`status in ('success', 'failed', 'rejected', 'blocked')`)
      .addCheckConstraint('ai_requests_key_mode_check', sql`key_mode in ('school', 'platform')`)
      .addCheckConstraint('ai_requests_tokens_check', sql`input_tokens >= 0 and output_tokens >= 0`)
      .execute();
    await database.schema.createIndex('ai_requests_created_idx').on('ai_requests').column('created_at').execute();
    await database.schema
      .createIndex('ai_requests_user_idx')
      .on('ai_requests')
      .columns(['user_id', 'created_at'])
      .execute();

    await sql`alter table integration_secrets drop constraint integration_secrets_connector_check`.execute(database);
    await sql`alter table integration_secrets add constraint integration_secrets_connector_check
      check (connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr', 'esms', 'zalo', 'facebook', 'storage', 'ai'))`.execute(
      database,
    );
  },
  async down(database) {
    await sql`delete from integration_secrets where connector = 'ai'`.execute(database);
    await sql`alter table integration_secrets drop constraint integration_secrets_connector_check`.execute(database);
    await sql`alter table integration_secrets add constraint integration_secrets_connector_check
      check (connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr', 'esms', 'zalo', 'facebook', 'storage'))`.execute(
      database,
    );
    await database.schema.dropTable('ai_requests').execute();
    await database.schema.dropTable('ai_settings').execute();
  },
};
