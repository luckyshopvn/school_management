import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { ensureRemovedDataBackupsTable } from '../../src/removed-data-log.js';

// Chợ gia sư tách thành sản phẩm riêng (YCTD-384, quyết định của Eric ngày 2026-10-30): xóa cấu hình chợ (khóa `market` của
// platform_settings). Có khóa này mà chưa chạy lệnh sao lưu dữ liệu chợ (bản ghi chức năng `cho-gia-su` trong removed_data_backups) thì
// dừng: dữ liệu chợ phải được sao lưu trước. Bản triển khai chưa từng bật chợ không có khóa nên chạy qua. Không có bước lùi: dữ liệu đã
// nằm trong tệp sao lưu
export const migration: Migration = {
  async up(database) {
    await ensureRemovedDataBackupsTable(database);
    const setting = await sql<{ found: boolean }>`
      select exists(select 1 from platform_settings where key = 'market') as found`.execute(database);
    if (setting.rows[0]?.found) {
      const recorded = await sql<{ found: boolean }>`
        select exists(select 1 from removed_data_backups where feature = 'cho-gia-su') as found`.execute(database);
      if (!recorded.rows[0]?.found) {
        throw new Error(
          'Chưa sao lưu dữ liệu chợ gia sư: chạy pnpm --filter @school-management/database xoa-du-lieu-da-bo -- --tinh-nang cho-gia-su rồi chạy lại database migration',
        );
      }
      await sql`delete from platform_settings where key = 'market'`.execute(database);
    }
  },
  async down() {},
};
