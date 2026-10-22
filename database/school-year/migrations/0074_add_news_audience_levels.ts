import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19e (YCTD-155): tin tức theo cấp học. `audience_levels` là các cấp nhận tin (mã MN, TH, THCS, THPT); mảng
// trống là mọi cấp, nên mọi tin đang có giữ nguyên người xem, người nhận. Chỉ dùng khi phạm vi công bố là toàn trường hoặc
// đơn vị (lớp, trẻ đã thuộc một cấp). Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('news')
      .addColumn('audience_levels', sql`text[]`, (column) =>
        column
          .notNull()
          .defaultTo(sql`'{}'::text[]`)
          .check(sql`audience_levels <@ array['MN', 'TH', 'THCS', 'THPT']::text[]`),
      )
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('news').dropColumn('audience_levels').execute();
  },
};
