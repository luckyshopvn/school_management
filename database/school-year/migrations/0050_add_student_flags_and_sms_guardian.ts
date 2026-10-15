import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Hồ sơ học sinh theo hệ thống của Sở (DT-15 phần 15c, YCTD-108):
// - `children.two_sessions_per_day`, `children.boarding`: học 2 buổi/ngày, học sinh lớp bán trú (mục 4.1.12 của Sở, đánh
//   dấu hàng loạt); lấy giá trị ban đầu từ cột "Học 2 buổi/ngày", "Học sinh lớp bán trú" của tệp CSDL ngành đã nhập
//   (`moet_profile`, YCTD-100);
// - `child_guardians.receives_sms`: phụ huynh có số điện thoại nhận tin của học sinh (mục 4.1.5 của Sở); mỗi học sinh tối đa
//   một phụ huynh. Đặt trên dòng gắn phụ huynh với học sinh để chuyển năm học cùng dòng gắn
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('children')
      .addColumn('two_sessions_per_day', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('boarding', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await sql`update children
      set two_sessions_per_day = coalesce(moet_profile->>'two_sessions_per_day' = 'true', false),
        boarding = coalesce(moet_profile->>'boarding_class' = 'true', false)
      where moet_profile is not null`.execute(database);
    await database.schema
      .alterTable('child_guardians')
      .addColumn('receives_sms', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await sql`create unique index child_guardians_receives_sms_unique on child_guardians (child_id)
      where receives_sms`.execute(database);
  },
  async down(database) {
    await database.schema.dropIndex('child_guardians_receives_sms_unique').execute();
    await database.schema.alterTable('child_guardians').dropColumn('receives_sms').execute();
    await database.schema.alterTable('children').dropColumn('two_sessions_per_day').dropColumn('boarding').execute();
  },
};
