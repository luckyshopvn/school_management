import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214; tài liệu 47 mục 15): giới hạn AI của gói và khóa AI của nền tảng. Khối số giữ sẵn 0200 đến 0202. Claude tự
// chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `plans.ai_max_requests`, `plans.ai_max_tokens`: hạn mức số yêu cầu và số token mỗi tháng (tháng dương lịch, giờ Việt Nam) của
//   trường; trống là không giới hạn, 0 là gói không dùng AI. Hạn mức áp ở máy chủ API cho cả hai cấu hình AI (ở cấu hình `school`
//   chỉ để chống lạm dụng nên thường để trống);
// - khóa nhà cung cấp AI của nền tảng (cấu hình `platform`, GD-102) cất ở `platform_integration_secrets` với `connector = 'ai'`,
//   mã hóa bằng khóa gốc của nền tảng như khóa cổng thanh toán (S5b); không bao giờ xuống cơ sở dữ liệu của trường. Ràng buộc kết nối
//   của bảng được mở thêm giá trị `ai`;
// - `platform_settings.ai`: nhà cung cấp, mã mô hình, địa chỉ của nền tảng (cấu hình, không ghi cứng trong mã).
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('plans')
      .addColumn('ai_max_requests', 'integer')
      .addColumn('ai_max_tokens', 'integer')
      .execute();
    await sql`alter table plans add constraint plans_ai_limits_check
      check ((ai_max_requests is null or ai_max_requests >= 0) and (ai_max_tokens is null or ai_max_tokens >= 0))`.execute(
      database,
    );
    await sql`alter table platform_integration_secrets drop constraint platform_integration_secrets_connector_check`.execute(
      database,
    );
    await sql`alter table platform_integration_secrets add constraint platform_integration_secrets_connector_check
      check (connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr', 'ai'))`.execute(database);
    await database
      .insertInto('platform_settings' as never)
      .values({
        key: 'ai',
        value: JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5-5', endpoint: null }),
      } as never)
      .onConflict((conflict) => conflict.column('key' as never).doNothing())
      .execute();
  },
  async down(database) {
    await sql`delete from platform_settings where key = 'ai'`.execute(database);
    await sql`delete from platform_integration_secrets where connector = 'ai'`.execute(database);
    await sql`alter table platform_integration_secrets drop constraint platform_integration_secrets_connector_check`.execute(
      database,
    );
    await sql`alter table platform_integration_secrets add constraint platform_integration_secrets_connector_check
      check (connector in ('payos', 'sepay', 'casso', 'vnpay', 'vietqr'))`.execute(database);
    await sql`alter table plans drop constraint plans_ai_limits_check`.execute(database);
    await database.schema.alterTable('plans').dropColumn('ai_max_requests').dropColumn('ai_max_tokens').execute();
  },
};
