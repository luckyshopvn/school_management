import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-19 phần 19b (YCTD-152): cấu trúc theo cấp học. Bốn mã cấp cố định như 18d, 18g, 22i; mọi cột mới mặc định `MN` nên
// trường chỉ có Mầm non chạy y như trước. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - `grade_levels.school_level`: khối thuộc một cấp; tháng tuổi thành tùy chọn, cơ sở dữ liệu vẫn bắt buộc ở khối Mầm non;
// - `classes.school_level`: cấp của lớp, máy chủ lấy theo khối và không cho lệch khối; `classes.curriculum_id`: chương trình
//   của lớp, trống là chương trình mặc định của cấp;
// - `curricula`: khung chương trình theo cấp (mã, tên, khối áp dụng; danh sách khối trống là mọi khối của cấp), mỗi cấp một
//   chương trình mặc định. Nạp sẵn chương trình giáo dục mầm non làm mặc định của cấp Mầm non; môn học, số tiết là DT-20,
//   DT-21;
// - `org_unit_levels`: trường chính, phân hiệu, điểm trường có những cấp nào; đơn vị đang có nhận `MN`.
const SCHOOL_LEVELS = `'MN', 'TH', 'THCS', 'THPT'`;

export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('grade_levels')
      .addColumn('school_level', 'text', (column) =>
        column
          .notNull()
          .defaultTo('MN')
          .check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .alterColumn('age_from_months', (column) => column.dropNotNull())
      .alterColumn('age_to_months', (column) => column.dropNotNull())
      .execute();
    await sql`alter table grade_levels drop constraint grade_levels_age_check`.execute(database);
    // Nhập cả hai hoặc bỏ trống cả hai tháng tuổi; khối Mầm non bắt buộc nhập
    await sql`alter table grade_levels add constraint grade_levels_age_check check (
      (age_from_months is null) = (age_to_months is null)
      and (school_level <> 'MN' or age_from_months is not null)
      and (age_from_months is null or (age_from_months >= 0 and age_from_months <= age_to_months)))`.execute(database);

    await database.schema
      .createTable('curricula')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 50`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('grade_level_codes', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .addColumn('is_default', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('note', 'text', (column) => column.check(sql`char_length(note) <= 1000`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('curricula_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint('curricula_default_active_check', sql`not is_default or status = 'active'`)
      .execute();
    // Mỗi cấp chỉ một chương trình mặc định
    await sql`create unique index curricula_single_default on curricula (school_level) where is_default`.execute(
      database,
    );
    await sql`insert into curricula (code, name, school_level, is_default)
      values ('CT-GDMN', 'Chương trình giáo dục mầm non', 'MN', true)
      on conflict (code) do nothing`.execute(database);

    await database.schema
      .alterTable('classes')
      .addColumn('school_level', 'text', (column) =>
        column
          .notNull()
          .defaultTo('MN')
          .check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('curriculum_id', 'uuid', (column) => column.references('curricula.id'))
      .execute();
    // Lớp đang có lấy cấp theo khối (mọi khối hiện có là Mầm non nên không đổi giá trị)
    await sql`update classes set school_level = grade_levels.school_level
      from grade_levels where grade_levels.code = classes.grade_level
        and classes.school_level <> grade_levels.school_level`.execute(database);
    await database.schema.createIndex('classes_school_level_index').on('classes').column('school_level').execute();

    await database.schema
      .createTable('org_unit_levels')
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id').onDelete('cascade'))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql.raw(`school_level in (${SCHOOL_LEVELS})`)),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addPrimaryKeyConstraint('org_unit_levels_pkey', ['org_unit_id', 'school_level'])
      .execute();
    await sql`insert into org_unit_levels (org_unit_id, school_level)
      select id, 'MN' from org_units on conflict do nothing`.execute(database);
  },
  async down(database) {
    await database.schema.dropTable('org_unit_levels').execute();
    await database.schema.dropIndex('classes_school_level_index').execute();
    await database.schema.alterTable('classes').dropColumn('curriculum_id').dropColumn('school_level').execute();
    await database.schema.dropTable('curricula').execute();
    await sql`alter table grade_levels drop constraint grade_levels_age_check`.execute(database);
    await database.schema
      .alterTable('grade_levels')
      .dropColumn('school_level')
      .alterColumn('age_from_months', (column) => column.setNotNull())
      .alterColumn('age_to_months', (column) => column.setNotNull())
      .execute();
    await sql`alter table grade_levels add constraint grade_levels_age_check
      check (age_from_months >= 0 and age_from_months <= age_to_months)`.execute(database);
  },
};
