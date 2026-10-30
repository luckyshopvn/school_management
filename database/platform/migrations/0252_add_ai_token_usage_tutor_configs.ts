import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gia sư AI trả phí, lát L2 (YCTD-383; quyết định Q8 của Eric ngày 2026-10-30: chỉ dùng khóa AI của nền tảng): token của gia sư AI học sinh
// tổng hợp vào `ai_token_usage` thành hai phân loại riêng với trợ lý AI của giáo viên. `tutor_school`: lượt dùng từ gói trường bán, tính
// lên hóa đơn dịch vụ của trường cùng đơn giá AI của gói dịch vụ; `tutor_platform`: lượt dùng từ gói nền tảng bán, là chi phí của nền
// tảng, chỉ để xem, không tính cho trường
export const migration: Migration = {
  async up(database) {
    await sql`alter table ai_token_usage drop constraint ai_token_usage_config_check`.execute(database);
    await sql`alter table ai_token_usage add constraint ai_token_usage_config_check
      check (config in ('school', 'platform', 'tutor_school', 'tutor_platform'))`.execute(database);
  },
  async down(database) {
    await sql`delete from ai_token_usage where config in ('tutor_school', 'tutor_platform')`.execute(database);
    await sql`alter table ai_token_usage drop constraint ai_token_usage_config_check`.execute(database);
    await sql`alter table ai_token_usage add constraint ai_token_usage_config_check
      check (config in ('school', 'platform'))`.execute(database);
  },
};
