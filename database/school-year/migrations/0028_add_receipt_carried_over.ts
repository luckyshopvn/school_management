import type { Migration } from 'kysely/migration';

// Phiếu thu ghi số dư có của trẻ chuyển từ năm học trước: không phát sinh tiền vào quỹ, không vào báo cáo thu chi, không
// lập phiếu điều chỉnh được (YCTD-69)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('receipts')
      .addColumn('carried_over', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('receipts').dropColumn('carried_over').execute();
  },
};
