import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-28 phần 28j (YCTD-280): học khi mạng yếu. Máy của học sinh giữ hàng đợi gửi lại (tắt mặc định, trường bật; GD-148 chờ Eric
// chốt); mỗi lần nộp, mỗi tệp gửi kèm mã chống trùng do máy sinh để gửi lại nhiều lần chỉ ghi một lần. Lần nộp ghi thêm thời điểm em
// bấm nộp trên máy để giáo viên xét khi bài muộn do mạng (máy chủ vẫn tính muộn theo lúc nhận)
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('assignment_submissions')
      .addColumn('client_submit_key', 'uuid')
      .addColumn('client_submitted_at', 'timestamptz')
      .execute();
    await sql`create unique index assignment_submissions_client_key_unique
      on assignment_submissions (client_submit_key) where client_submit_key is not null`.execute(database);
    await database.schema.alterTable('submission_files').addColumn('client_key', 'uuid').execute();
    await sql`create unique index submission_files_client_key_unique
      on submission_files (submission_id, client_key) where client_key is not null`.execute(database);
  },
  async down(database) {
    await sql`drop index if exists submission_files_client_key_unique`.execute(database);
    await database.schema.alterTable('submission_files').dropColumn('client_key').execute();
    await sql`drop index if exists assignment_submissions_client_key_unique`.execute(database);
    await database.schema
      .alterTable('assignment_submissions')
      .dropColumn('client_submitted_at')
      .dropColumn('client_submit_key')
      .execute();
  },
};
