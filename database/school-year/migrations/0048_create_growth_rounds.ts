import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Cân nặng, chiều cao theo đợt cân đo (DT-14 phần 14a, YCTD-102; mục 4.3.1, 4.3.2 của hệ thống Sở):
// - `growth_rounds`: đợt cân đo của một đơn vị (tháng, quý...) có ngày cân đo chung;
// - `health_measurements.growth_round_id`: số đo của đợt lưu ngay trong bảng số đo sức khỏe sẵn có (không lưu hai nơi),
//   mỗi trẻ một dòng trong một đợt. Chỉ số Z và kênh tăng trưởng không lưu, tính lại theo bảng WHO mỗi lần đọc
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('growth_rounds')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('org_unit_id', 'uuid', (column) => column.notNull().references('org_units.id'))
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('measured_on', 'date', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('created_by', 'uuid', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('growth_rounds_name_unique', ['org_unit_id', 'name'])
      .execute();
    await database.schema
      .alterTable('health_measurements')
      .addColumn('growth_round_id', 'uuid', (column) => column.references('growth_rounds.id'))
      .execute();
    await sql`create unique index health_measurements_round_child_unique
      on health_measurements (growth_round_id, child_id) where growth_round_id is not null`.execute(database);
  },
  async down(database) {
    await sql`drop index health_measurements_round_child_unique`.execute(database);
    await database.schema.alterTable('health_measurements').dropColumn('growth_round_id').execute();
    await database.schema.dropTable('growth_rounds').execute();
  },
};
