import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19f (YCTD-156): nạp cấp học của trường từ cấu hình website (18f) vào `school_levels` (19a), chạy lặp được. Cấp
// website đã khai báo thì bật ở `school_levels`; không tắt cấp nào (cấp đã bật ở 1.4 Cấu hình trường giữ nguyên). Trường chưa có
// cấu hình website hoặc chỉ khai báo Mầm non thì không đổi. Học kỳ, tuần đang có không có cấp nghĩa là lịch chung cả trường
// (19b) nên không cần gán cấp
export const migration: Migration = {
  async up(database) {
    await sql`update school_levels set is_enabled = true
      where not is_enabled
        and code in (select unnest(school_levels) from website_settings)`.execute(database);
  },
  // Không biết cấp nào bật do tệp này hay do người dùng nên quay lui không tắt cấp
  async down() {},
};
