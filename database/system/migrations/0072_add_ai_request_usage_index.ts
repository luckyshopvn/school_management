import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-23 phần 23d (YCTD-214): chỉ mục cho việc tổng hợp token theo ngày (giờ Việt Nam), mô hình, cấu hình dùng để lên cơ sở dữ liệu nền
// tảng tính phí, và cho đếm hạn mức tháng. Chỉ tính yêu cầu thành công; yêu cầu bị chặn hoặc lỗi không tốn token nên không thành phí
export const migration: Migration = {
  async up(database) {
    await sql`create index ai_requests_usage_idx on ai_requests (key_mode, created_at) where status = 'success'`.execute(
      database,
    );
  },
  async down(database) {
    await sql`drop index ai_requests_usage_idx`.execute(database);
  },
};
