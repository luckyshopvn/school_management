import type { Migration } from 'kysely/migration';

// Chuyển trường qua hộp thư nền tảng, lát L2 (YCTD-390): đề nghị chuyển đi và hồ sơ chuyển đến ghi thư trong hộp thư nền tảng
// (`transfer_mailbox.id`) và trường đối tác trên nền tảng (`schools.id`); hai cột ở cơ sở dữ liệu khác nên không có khóa ngoại
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('student_transfers')
      .addColumn('mailbox_id', 'uuid')
      .addColumn('partner_school_id', 'uuid')
      .execute();
  },
  async down(database) {
    await database.schema
      .alterTable('student_transfers')
      .dropColumn('mailbox_id')
      .dropColumn('partner_school_id')
      .execute();
  },
};
