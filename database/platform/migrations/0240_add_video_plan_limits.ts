import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-27 phần 27a (YCTD-251; tài liệu 47 mục 19.2 phần 4, 19.5): giới hạn của gói cho lớp video để chi phí băng thông và lưu trữ đi cùng
// doanh thu. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `plans.video_max_minutes`: số phút người dự mỗi tháng (tháng dương lịch, giờ Việt Nam), đo từ nhật ký vào ra phòng ở cơ sở dữ
//   liệu của trường; vượt thì không mở phòng mới, không cấp mã vào phòng; trống là không giới hạn, 0 là gói không có video;
// - `plans.video_max_recording_mb`: tổng dung lượng bản ghi còn giữ; vượt thì không bắt đầu ghi mới; trống là không giới hạn, 0 là
//   gói không ghi hình.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('plans')
      .addColumn('video_max_minutes', 'integer')
      .addColumn('video_max_recording_mb', 'integer')
      .execute();
    await sql`alter table plans add constraint plans_video_limits_check
      check ((video_max_minutes is null or video_max_minutes >= 0)
        and (video_max_recording_mb is null or video_max_recording_mb >= 0))`.execute(database);
  },
  async down(database) {
    await sql`alter table plans drop constraint plans_video_limits_check, drop column video_max_recording_mb,
      drop column video_max_minutes`.execute(database);
  },
};
