import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// Số liệu nhập tay của các biểu báo cáo EMIS (DT-16 phần 16j; khảo sát mục 5 của Sở): thẻ Ngân sách nhà nước của 1.1, năm
// thẻ của 1.2 Báo cáo cơ sở vật chất, 2.3 Đề án ngoại ngữ. Mỗi dòng là một chỉ tiêu của một thẻ trong một biểu; `values`
// giữ số của từng cột (khóa là mã cột của biểu, giá trị là số hoặc null). "Lấy dữ liệu" và "Lấy dữ liệu năm trước" chỉ điền
// vào màn hình, bấm Ghi mới lưu vào bảng này
export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('emis_report_values')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('form_code', 'text', (column) => column.notNull())
      .addColumn('tab_key', 'text', (column) => column.notNull())
      .addColumn('row_code', 'text', (column) => column.notNull())
      .addColumn('values', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn('note', 'text')
      .addColumn('updated_by', 'uuid', (column) => column.notNull())
      .addColumn('updated_by_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addUniqueConstraint('emis_report_values_row_unique', ['form_code', 'tab_key', 'row_code'])
      .addCheckConstraint('emis_report_values_values_check', sql`jsonb_typeof("values") = 'object'`)
      .execute();
  },
  async down(database) {
    await database.schema.dropTable('emis_report_values').execute();
  },
};
