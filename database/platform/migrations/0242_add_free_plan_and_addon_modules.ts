import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Mở mọi trường trong danh mục, gói cơ bản miễn phí (YCTD-314, Eric yêu cầu ngày 2026-10-28; tài liệu 47 mục 16.11):
// - ba tính năng mới không phải phân hệ của cây menu: `ai-assistant` (trợ lý AI), `online-learning` (học trực tuyến, lớp trực
//   tiếp), `sms-zalo` (tin nhắn SMS, Zalo gửi ra ngoài; sổ liên lạc trong ứng dụng vẫn miễn phí). Gói đã có danh sách phân hệ thêm
//   ba mã này để trường đang dùng không mất tính năng;
// - gói `co-ban-mien-phi`: mọi phân hệ trừ các tính năng trả phí (trợ lý AI, thi trực tuyến, học trực tuyến, gia sư, báo cáo nâng
//   cao gồm Báo cáo và Đánh giá KPI, tin nhắn SMS, Zalo); trường tự khởi tạo từ danh mục nhận gói này, không hạn dùng. Người vận hành sửa gói ở trang Gói
//   dịch vụ của cổng nền tảng;
// - schools.addon_modules: tính năng trả phí nền tảng bật riêng cho một trường, cộng thêm vào phân hệ của gói hiện hành.
export const migration: Migration = {
  async up(database) {
    await sql`update plans set modules = modules || '["ai-assistant","online-learning","sms-zalo"]'::jsonb
      where modules is not null`.execute(database);
    await sql`insert into plans (code, name, description, modules, trial_days)
      values (
        'co-ban-mien-phi',
        'Cơ bản miễn phí',
        'Gói mặc định của trường tự khởi tạo từ danh mục: hồ sơ trường, cán bộ, lớp, học sinh, điểm danh, sổ liên lạc, thông báo, văn bản. Tính năng trả phí bật riêng từng trường.',
        '["education","facilities","entry-admissions","emis","signing","documents","system","finance","personnel","logistics","interaction","teaching","admissions","website","professional-records","emulation","quality-assurance","library","learning-resources"]'::jsonb,
        0
      )
      on conflict (code) do nothing`.execute(database);
    await database.schema
      .alterTable('schools')
      .addColumn('addon_modules', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .execute();
  },
  async down(database) {
    await database.schema.alterTable('schools').dropColumn('addon_modules').execute();
    await sql`delete from plans p where p.code = 'co-ban-mien-phi'
      and not exists (select 1 from school_plans sp where sp.plan_id = p.id)`.execute(database);
    await sql`update plans set modules = modules - 'ai-assistant' - 'online-learning' - 'sms-zalo' where modules is not null`.execute(
      database,
    );
  },
};
