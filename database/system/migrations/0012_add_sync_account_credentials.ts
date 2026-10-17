import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-16 phần 16d. Mục 1.6 Tài khoản đồng bộ của Bộ, của Sở: tên đăng nhập và mật khẩu nhà trường dùng để đồng bộ hồ sơ
// lên CSDL ngành của Bộ (moet_sync) và của Sở (doet_sync). Lưu chung bảng thông tin kết nối mã hóa (YCTD-92); mật khẩu mã
// hóa AES-256-GCM, không bao giờ trả qua API. Chưa có giao diện lập trình của Bộ, Sở nên chưa đồng bộ được
export const migration: Migration = {
  async up(database) {
    await sql`alter table integration_credentials drop constraint integration_credentials_connector_check`.execute(
      database,
    );
    await sql`alter table integration_credentials add constraint integration_credentials_connector_check
      check (connector in ('zalo', 'moet_sync', 'doet_sync'))`.execute(database);
    await database.schema
      .alterTable('integration_credentials')
      .addColumn('account_username', 'text')
      .addColumn('account_secret_encrypted', 'text')
      .execute();
  },
  async down(database) {
    await sql`delete from integration_credentials where connector in ('moet_sync', 'doet_sync')`.execute(database);
    await database.schema
      .alterTable('integration_credentials')
      .dropColumn('account_username')
      .dropColumn('account_secret_encrypted')
      .execute();
    await sql`alter table integration_credentials drop constraint integration_credentials_connector_check`.execute(
      database,
    );
    await sql`alter table integration_credentials add constraint integration_credentials_connector_check
      check (connector in ('zalo'))`.execute(database);
  },
};
