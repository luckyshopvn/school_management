import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19d (YCTD-154): biểu phí theo cấp học. Mỗi cấp có chuỗi phiên bản biểu phí riêng (BR-18 áp dụng trong từng cấp);
// biểu phí đang có là của Mầm non. Dòng giá vẫn theo mã khối nên tính phí, công nợ, phiếu thu không đổi. Claude tự chọn theo ủy
// quyền của Eric ngày 2026-10-11: ngày hiệu lực không trùng trong cùng cấp thay cho không trùng toàn trường
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('fee_schedules')
      .addColumn('school_level', 'text', (column) =>
        column
          .notNull()
          .defaultTo('MN')
          .check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .execute();
    await sql`alter table fee_schedules drop constraint fee_schedules_effective_from_key`.execute(database);
    await sql`alter table fee_schedules add constraint fee_schedules_level_effective_from_unique
      unique (school_level, effective_from)`.execute(database);
  },
  async down(database) {
    await sql`delete from fee_schedules where school_level <> 'MN'`.execute(database);
    await sql`alter table fee_schedules drop constraint fee_schedules_level_effective_from_unique`.execute(database);
    await sql`alter table fee_schedules add constraint fee_schedules_effective_from_key unique (effective_from)`.execute(
      database,
    );
    await database.schema.alterTable('fee_schedules').dropColumn('school_level').execute();
  },
};
