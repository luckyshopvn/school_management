import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Danh mục đơn vị giáo dục toàn quốc (DT-24, YCTD-220; tài liệu 47 mục 16): dữ liệu tham chiếu của nền tảng, không thuộc trường nào.
// - catalog_departments: Sở GD&ĐT theo tỉnh sau sáp nhập, mã 2 chữ số là mã tỉnh (không suy ra từ mã trường);
// - catalog_levels: cấp học theo mã của Bộ (01 Mầm non, 02 Tiểu học, 03 THCS, 04 THPT, 05 GDTX), nạp sẵn ở đây vì là danh mục
//   chuẩn, không phải dữ liệu thu thập;
// - catalog_communes: phường, xã theo mã đơn vị hành chính cấp xã 5 chữ số;
// - catalog_units: đơn vị trường; mã Bộ là chuỗi bất biến (giữ số 0 đầu, có thể có chữ), cờ chất lượng ghi chỗ đã làm sạch
//   (tên rỗng, mã không chuẩn, thiếu xã...), không bỏ âm thầm; name_search là tên bỏ dấu, chữ thường để tìm;
// - catalog_unit_levels: trường liên cấp là nhiều dòng (nhiều-nhiều với cấp học);
// - catalog_import_runs: mỗi lần nhập một dòng báo cáo (thêm, sửa, giữ nguyên, bỏ qua kèm lý do).
// Kho mã công khai không chứa dữ liệu danh mục thật: chỉ có công cụ nhập và tệp mẫu giả.
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('catalog_departments')
      .addColumn('code', 'text', (column) => column.primaryKey().check(sql`code ~ '^[0-9]{2}$'`))
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('catalog_departments_status_check', sql`status in ('active', 'inactive')`)
      .execute();

    await database.schema
      .createTable('catalog_levels')
      .addColumn('code', 'text', (column) => column.primaryKey())
      .addColumn('moet_code', 'text', (column) => column.notNull().unique())
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('sort', 'integer', (column) => column.notNull())
      .execute();
    await database
      .insertInto('catalog_levels' as never)
      .values([
        { code: 'MN', moet_code: '01', name: 'Mầm non', sort: 1 },
        { code: 'TH', moet_code: '02', name: 'Tiểu học', sort: 2 },
        { code: 'THCS', moet_code: '03', name: 'Trung học cơ sở', sort: 3 },
        { code: 'THPT', moet_code: '04', name: 'Trung học phổ thông', sort: 4 },
        { code: 'GDTX', moet_code: '05', name: 'Giáo dục thường xuyên', sort: 5 },
      ] as never)
      .execute();

    await database.schema
      .createTable('catalog_communes')
      .addColumn('code', 'text', (column) => column.primaryKey().check(sql`code ~ '^[0-9]{5}$'`))
      .addColumn('department_code', 'text', (column) =>
        column.notNull().references('catalog_departments.code').onDelete('restrict'),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('name_search', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('catalog_communes_status_check', sql`status in ('active', 'inactive')`)
      .execute();
    await database.schema
      .createIndex('catalog_communes_department_idx')
      .on('catalog_communes')
      .columns(['department_code', 'name_search'])
      .execute();

    await database.schema
      .createTable('catalog_units')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('moet_code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(moet_code) between 1 and 40 and moet_code !~ '[[:cntrl:]]'`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 300`))
      .addColumn('name_search', 'text', (column) => column.notNull())
      .addColumn('department_code', 'text', (column) =>
        column.notNull().references('catalog_departments.code').onDelete('restrict'),
      )
      .addColumn('commune_code', 'text', (column) => column.references('catalog_communes.code').onDelete('set null'))
      // Tên xã như ở nguồn khi không ghép được mã (giữ để quản trị nền tảng sửa tay)
      .addColumn('commune_name_raw', 'text')
      .addColumn('school_year', 'text')
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('active'))
      .addColumn('quality_flags', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'::text[]`))
      .addColumn('first_seen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('last_seen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('catalog_units_status_check', sql`status in ('active', 'inactive')`)
      .addCheckConstraint(
        'catalog_units_school_year_check',
        sql`school_year is null or school_year ~ '^[0-9]{4}-[0-9]{4}$'`,
      )
      .execute();
    await database.schema
      .createIndex('catalog_units_department_idx')
      .on('catalog_units')
      .columns(['department_code', 'name_search'])
      .execute();
    await database.schema.createIndex('catalog_units_commune_idx').on('catalog_units').column('commune_code').execute();

    await database.schema
      .createTable('catalog_unit_levels')
      .addColumn('unit_id', 'uuid', (column) => column.notNull().references('catalog_units.id').onDelete('cascade'))
      .addColumn('level_code', 'text', (column) =>
        column.notNull().references('catalog_levels.code').onDelete('restrict'),
      )
      .addPrimaryKeyConstraint('catalog_unit_levels_pk', ['unit_id', 'level_code'])
      .execute();
    await database.schema
      .createIndex('catalog_unit_levels_level_idx')
      .on('catalog_unit_levels')
      .columns(['level_code', 'unit_id'])
      .execute();

    await database.schema
      .createTable('catalog_import_runs')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('source', 'text', (column) => column.notNull())
      .addColumn('file_name', 'text')
      .addColumn('dry_run', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('totals', 'jsonb', (column) => column.notNull())
      // Dòng bỏ qua (số dòng, lý do; mã che khi trùng khuôn số định danh cá nhân), tối đa 500 dòng đầu
      .addColumn('skipped', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('actor_type', 'text', (column) => column.notNull())
      .addColumn('actor_id', 'text')
      .addColumn('actor_name', 'text', (column) => column.notNull())
      .addColumn('started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('finished_at', 'timestamptz')
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('catalog_import_runs').execute();
    await database.schema.dropTable('catalog_unit_levels').execute();
    await database.schema.dropTable('catalog_units').execute();
    await database.schema.dropTable('catalog_communes').execute();
    await database.schema.dropTable('catalog_levels').execute();
    await database.schema.dropTable('catalog_departments').execute();
  },
};
