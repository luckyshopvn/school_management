import type { Migration } from 'kysely/migration';

// Tên miền riêng cấu hình tay qua bộ nối DomainProvider (DT-SaaS phần S2, YCTD-193): mã xác nhận (bản ghi TXT), địa chỉ CNAME
// cần trỏ tới, nhà cung cấp đã dùng, lần kiểm tra gần nhất và lỗi. Tên miền riêng chỉ chuyển sang `active` khi kiểm tra đạt
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('school_domains')
      .addColumn('provider', 'text', (column) => column.notNull().defaultTo('system'))
      .addColumn('verification_token', 'text')
      .addColumn('cname_target', 'text')
      .addColumn('last_checked_at', 'timestamptz')
      .addColumn('check_error', 'text')
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('school_domains')
      .dropColumn('provider')
      .dropColumn('verification_token')
      .dropColumn('cname_target')
      .dropColumn('last_checked_at')
      .dropColumn('check_error')
      .execute();
  },
};
