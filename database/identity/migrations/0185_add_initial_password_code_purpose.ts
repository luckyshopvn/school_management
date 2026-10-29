import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// YCTD-323: đổi mật khẩu mặc định lần đầu (YCTD-311) phải kèm mã gửi tới số điện thoại của tài khoản; mã một lần có thêm mục đích
// `initial_password`
export const migration: Migration = {
  async up(database) {
    await sql`alter table one_time_codes drop constraint one_time_codes_purpose_check`.execute(database);
    await sql`alter table one_time_codes add constraint one_time_codes_purpose_check
      check (purpose in ('login', 'password_reset', 'initial_password'))`.execute(database);
  },
  async down(database) {
    await sql`delete from one_time_codes where purpose = 'initial_password'`.execute(database);
    await sql`alter table one_time_codes drop constraint one_time_codes_purpose_check`.execute(database);
    await sql`alter table one_time_codes add constraint one_time_codes_purpose_check
      check (purpose in ('login', 'password_reset'))`.execute(database);
  },
};
