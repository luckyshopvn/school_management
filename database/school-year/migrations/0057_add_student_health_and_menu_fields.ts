import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Sức khỏe, dinh dưỡng và thống kê học sinh theo hệ thống của Sở (DT-16 phần 16h; khảo sát mục 4.5, 4.6, 5.3):
// - `menus`: thêm tên thực đơn, tháng, tuần, từ ngày–đến ngày và khối áp dụng (nhiều khối) như màn hình 4.5 của Sở. Thực
//   đơn cũ lấy giá trị ban đầu từ tuần bắt đầu và độ tuổi đã có; `age_group` giữ làm khóa không trùng (all hoặc các mã khối
//   nối bằng dấu phẩy);
// - `menu_import_jobs`: lần nhập thực đơn từ Excel (kiểm tra cả tệp, ghi khi không còn dòng lỗi, xuất file lỗi);
// - `student_health_records`: thông tin sức khỏe của học sinh theo học kỳ (mục 4.6): cân nặng, chiều cao (lấy được từ đợt
//   cân đo 4.3), kết quả giáo dục thể chất, biết bơi, bệnh về mắt (cận, viễn, loạn thị, đục thủy tinh thể, thoái hóa điểm
//   vàng, khô mắt, lác) để thống kê 5.3 theo học kỳ. Mỗi học sinh một dòng trong một học kỳ của năm học
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('menus')
      .addColumn('name', 'text')
      .addColumn('month', 'text')
      .addColumn('week_no', 'integer')
      .addColumn('from_date', 'date')
      .addColumn('to_date', 'date')
      .addColumn('grade_levels', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .execute();
    await sql`update menus set
        name = 'Thực đơn tuần ' || to_char(week_start_date, 'DD/MM/YYYY'),
        month = to_char(week_start_date, 'YYYY-MM'),
        from_date = week_start_date,
        to_date = week_start_date + 6,
        grade_levels = case when age_group = 'all' then '{}'::text[] else string_to_array(age_group, ',') end`.execute(
      database,
    );
    await sql`alter table menus add constraint menus_month_check
      check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')`.execute(database);
    await sql`alter table menus add constraint menus_dates_check check (to_date >= from_date)`.execute(database);

    await database.schema
      .createTable('menu_import_jobs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('file_id', 'uuid', (column) => column.notNull().references('files.id'))
      .addColumn('status', 'text', (column) => column.notNull())
      .addColumn('total_rows', 'integer', (column) => column.notNull())
      .addColumn('error_rows', 'integer', (column) => column.notNull())
      .addColumn('errors', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('menus', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('committed_at', 'timestamptz')
      .addCheckConstraint('menu_import_jobs_status_check', sql`status in ('validated', 'failed', 'committed')`)
      .execute();

    await database.schema
      .createTable('student_health_records')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('child_id', 'uuid', (column) => column.notNull().references('children.id'))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('term_type', 'text', (column) => column.notNull())
      .addColumn('measured_on', 'date')
      .addColumn('weight_kg', 'numeric(5, 2)')
      .addColumn('height_cm', 'numeric(4, 1)')
      .addColumn('growth_round_id', 'uuid', (column) => column.references('growth_rounds.id'))
      .addColumn('physical_education', 'text')
      .addColumn('can_swim', 'boolean')
      .addColumn('eye_conditions', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .addColumn('note', 'text')
      .addColumn('recorded_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('student_health_records_child_term_unique', ['child_id', 'term_type'])
      .addCheckConstraint('student_health_records_term_check', sql`term_type in ('first_term', 'second_term')`)
      .addCheckConstraint(
        'student_health_records_physical_education_check',
        sql`physical_education is null or physical_education in ('passed', 'not_passed')`,
      )
      .addCheckConstraint(
        'student_health_records_eye_conditions_check',
        sql`eye_conditions <@ array['myopia', 'hyperopia', 'astigmatism', 'cataract', 'macular_degeneration',
          'dry_eye', 'strabismus']::text[]`,
      )
      .execute();
    await database.schema
      .createIndex('student_health_records_unit_term')
      .on('student_health_records')
      .columns(['org_unit_id', 'term_type'])
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('student_health_records').execute();
    await database.schema.dropTable('menu_import_jobs').execute();
    await sql`alter table menus drop constraint menus_dates_check`.execute(database);
    await sql`alter table menus drop constraint menus_month_check`.execute(database);
    await database.schema
      .alterTable('menus')
      .dropColumn('grade_levels')
      .dropColumn('to_date')
      .dropColumn('from_date')
      .dropColumn('week_no')
      .dropColumn('month')
      .dropColumn('name')
      .execute();
  },
};
