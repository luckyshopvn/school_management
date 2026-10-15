import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { administrativeNameKey } from '../administrative-names.js';
import { HCM_ADMINISTRATIVE_UNITS } from '../data/hcm-administrative-units.js';

// Danh mục địa danh hành chính trước và sau sắp xếp năm 2025 (DT-15 phần 15h1, mục 4.1.11 của Sở): đơn vị cũ gồm tỉnh,
// quận/huyện, xã/phường/thị trấn; đơn vị mới gồm tỉnh và xã/phường/đặc khu (chính quyền địa phương hai cấp, không còn cấp
// huyện); bảng đối chiếu xã cũ sang xã mới (huyện Côn Đảo không có cấp xã nên đối chiếu theo huyện). Gieo sẵn TP.HCM mới
// cùng đơn vị cũ của TP.HCM, Bình Dương, Bà Rịa - Vũng Tàu theo Nghị quyết 202/2025/QH15, Nghị quyết 1685/NQ-UBTVQH15, mã số
// theo danh mục của Cục Thống kê (Quyết định 19/2025/QĐ-TTg); tỉnh khác do người dùng nhập từ Excel (nguồn `import`). Đặt
// ở cơ sở dữ liệu hệ thống vì dùng chung mọi năm học
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const BATCH = 500;

async function insertUnits(
  database: Parameters<Migration['up']>[0],
  rows: Array<{ period: string; level: string; code: string | null; name: string; parent_id: string | null }>,
): Promise<string[]> {
  const ids: string[] = [];
  for (let start = 0; start < rows.length; start += BATCH) {
    const inserted = await database
      .insertInto('administrative_units')
      .values(rows.slice(start, start + BATCH).map((row) => ({ ...row, name_key: administrativeNameKey(row.name) })))
      .returning('id')
      .execute();
    ids.push(...inserted.map((row: { id: string }) => row.id));
  }
  return ids;
}

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('administrative_units')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('period', 'text', (column) => column.notNull())
      .addColumn('level', 'text', (column) => column.notNull())
      .addColumn('code', 'text')
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('name_key', 'text', (column) => column.notNull())
      .addColumn('parent_id', 'uuid', (column) => column.references('administrative_units.id').onDelete('cascade'))
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('official'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_by', 'uuid')
      .addCheckConstraint('administrative_units_period_check', sql`period in ('old', 'new')`)
      .addCheckConstraint('administrative_units_level_check', sql`level in ('province', 'district', 'ward')`)
      .addCheckConstraint('administrative_units_source_check', sql`source in ('official', 'import')`)
      // Tỉnh không có đơn vị cha; đơn vị mới không có cấp huyện
      .addCheckConstraint('administrative_units_parent_check', sql`(level = 'province') = (parent_id is null)`)
      .addCheckConstraint('administrative_units_new_level_check', sql`period = 'old' or level <> 'district'`)
      .addCheckConstraint('administrative_units_name_check', sql`length(name) between 1 and 200`)
      .addCheckConstraint('administrative_units_code_check', sql`code is null or code ~ '^[0-9]{2,5}$'`)
      .execute();
    // Một tên trong một đơn vị cha của cùng thời kỳ; mã số không trùng trong cùng thời kỳ, cấp
    await sql`create unique index administrative_units_name_unique on administrative_units
      (period, level, coalesce(parent_id, ${sql.lit(ZERO_ID)}::uuid), name_key)`.execute(database);
    await sql`create unique index administrative_units_code_unique on administrative_units (period, level, code)
      where code is not null`.execute(database);
    await database.schema
      .createIndex('administrative_units_parent_index')
      .on('administrative_units')
      .column('parent_id')
      .execute();

    await database.schema
      .createTable('administrative_unit_mappings')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('old_unit_id', 'uuid', (column) =>
        column.notNull().references('administrative_units.id').onDelete('cascade'),
      )
      .addColumn('new_unit_id', 'uuid', (column) =>
        column.notNull().references('administrative_units.id').onDelete('cascade'),
      )
      .addColumn('source', 'text', (column) => column.notNull().defaultTo('official'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('created_by', 'uuid')
      .addCheckConstraint('administrative_unit_mappings_source_check', sql`source in ('official', 'import')`)
      .addUniqueConstraint('administrative_unit_mappings_unique', ['old_unit_id', 'new_unit_id'])
      .execute();
    await database.schema
      .createIndex('administrative_unit_mappings_new_index')
      .on('administrative_unit_mappings')
      .column('new_unit_id')
      .execute();

    // Gieo danh mục chính thức của TP.HCM
    const data = HCM_ADMINISTRATIVE_UNITS;
    const provinceIds = await insertUnits(
      database,
      data.provinces.map(([period, code, name]) => ({ period, level: 'province', code, name, parent_id: null })),
    );
    const districtIds = await insertUnits(
      database,
      data.districts.map(([province, code, name]) => ({
        period: 'old',
        level: 'district',
        code,
        name,
        parent_id: provinceIds[province] ?? null,
      })),
    );
    const oldWardIds = await insertUnits(
      database,
      data.oldWards.map(([district, code, name]) => ({
        period: 'old',
        level: 'ward',
        code,
        name,
        parent_id: districtIds[district] ?? null,
      })),
    );
    const newWardIds = await insertUnits(
      database,
      data.newWards.map(([province, code, name]) => ({
        period: 'new',
        level: 'ward',
        code,
        name,
        parent_id: provinceIds[province] ?? null,
      })),
    );
    const mappings = [
      ...data.newWards.flatMap(([, , , from], index) =>
        from.map((oldWard) => ({ old_unit_id: oldWardIds[oldWard] ?? '', new_unit_id: newWardIds[index] ?? '' })),
      ),
      ...data.districtMappings.map(([district, newWard]) => ({
        old_unit_id: districtIds[district] ?? '',
        new_unit_id: newWardIds[newWard] ?? '',
      })),
    ];
    for (let start = 0; start < mappings.length; start += BATCH) {
      await database
        .insertInto('administrative_unit_mappings')
        .values(mappings.slice(start, start + BATCH))
        .execute();
    }
  },
  async down(database) {
    await database.schema.dropTable('administrative_unit_mappings').execute();
    await database.schema.dropTable('administrative_units').execute();
  },
};
