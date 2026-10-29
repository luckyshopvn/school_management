import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Gắn trường đã khởi tạo với danh mục và quyền truy cập của quản trị nền tảng (DT-24, YCTD-220; tài liệu 47 mục 16):
// - schools.moet_code: mã Bộ của đơn vị trong danh mục (liên kết mềm, không khóa ngoại để nạp lại danh mục không vướng trường);
//   mỗi mã chỉ gắn một trường; đăng nhập theo đơn vị ở tên miền chung tra trường theo mã này;
// - support_sessions.access_basis: căn cứ mở phiên: `school_grant` (trường cho phép, S4), `platform_policy` (quản trị nền tảng vào
//   theo chính sách nền tảng, không cần trường đồng ý, Eric quyết định ngày 2026-10-26), `access_request` (cấp trên, S6);
// - platform_settings.support_access_policy: mặc định `any_school` (vào mọi trường đã khởi tạo, bắt buộc xác thực hai lớp ngay lúc
//   mở, lý do, có hạn); đổi sang `school_grant` để quay lại chỉ vào khi trường cho phép.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('schools')
      .addColumn('moet_code', 'text', (column) =>
        column.check(sql`moet_code is null or char_length(moet_code) between 1 and 40`),
      )
      .execute();
    await sql`create unique index schools_moet_code_unique on schools (moet_code) where moet_code is not null`.execute(
      database,
    );

    await database.schema
      .alterTable('support_sessions')
      .addColumn('access_basis', 'text', (column) => column.notNull().defaultTo('school_grant'))
      .execute();
    await sql`update support_sessions set access_basis = 'access_request' where requester_kind = 'parent_org'`.execute(
      database,
    );
    await sql`alter table support_sessions add constraint support_sessions_access_basis_check
      check (access_basis in ('school_grant', 'platform_policy', 'access_request'))`.execute(database);

    await sql`insert into platform_settings (key, value)
      values ('support_access_policy', '{"mode":"any_school","default_hours":2,"max_hours":8}'::jsonb)
      on conflict (key) do nothing`.execute(database);
  },
  async down(database) {
    await sql`delete from platform_settings where key = 'support_access_policy'`.execute(database);
    await database.schema
      .alterTable('support_sessions')
      .dropConstraint('support_sessions_access_basis_check')
      .execute();
    await database.schema.alterTable('support_sessions').dropColumn('access_basis').execute();
    await sql`drop index if exists schools_moet_code_unique`.execute(database);
    await database.schema.alterTable('schools').dropColumn('moet_code').execute();
  },
};
