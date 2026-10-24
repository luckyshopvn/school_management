import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-20 phần 20f (YCTD-165): danh mục biểu báo cáo cấu hình được (khung EMIS Tiểu học) ở cơ sở dữ liệu hệ thống, dùng chung
// mọi năm học. `report_forms`: mã, tên, cấp, kỳ (đầu năm, cuối năm), các cột tách số; `report_form_rows`: dòng chỉ tiêu theo
// thứ tự (đề mục, công thức tính từ dữ liệu theo cú pháp ở `packages/shared/src/primary-reports.ts`, hoặc nhập tay). Số nhập
// tay lưu ở `emis_report_values` của năm học như biểu Mầm non. Nạp hai biểu khung Tiểu học; chưa khảo sát hệ thống của Sở
// cấp Tiểu học nên dòng, mã số chỉ là khung, sửa cho khớp sau khảo sát. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
const COLUMNS = JSON.stringify([
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic', label: 'Dân tộc thiểu số' },
  { key: 'ethnic_female', label: 'Nữ dân tộc thiểu số' },
  { key: 'disabled', label: 'Khuyết tật' },
]);
const GRADES = ['K1', 'K2', 'K3', 'K4', 'K5'];

type Row = {
  code: string;
  label: string;
  unit: string | null;
  kind: 'heading' | 'formula' | 'manual';
  formula: string | null;
};
const heading = (code: string, label: string): Row => ({ code, label, unit: null, kind: 'heading', formula: null });
const formula = (code: string, label: string, unit: string, text: string): Row => ({
  code,
  label,
  unit,
  kind: 'formula',
  formula: text,
});
const manual = (code: string, label: string, unit: string): Row => ({
  code,
  label,
  unit,
  kind: 'manual',
  formula: null,
});

const FORMS: Array<{ code: string; name: string; period: string; rows: Row[] }> = [
  {
    code: 'emis-th-dau-nam',
    name: 'Biểu EMIS Tiểu học đầu năm (khung)',
    period: 'start_of_year',
    rows: [
      heading('I', 'I. Lớp học'),
      formula('101', 'Tổng số lớp', 'Lớp', 'classes'),
      ...GRADES.map((grade, index) => formula(`10${index + 2}`, `Lớp ${index + 1}`, 'Lớp', `classes.grade=${grade}`)),
      formula('107', 'Lớp học 2 buổi/ngày', 'Lớp', 'classes.two_sessions'),
      formula('108', 'Lớp có học sinh bán trú', 'Lớp', 'classes.boarding'),
      heading('II', 'II. Học sinh'),
      formula('201', 'Tổng số học sinh', 'Học sinh', 'students'),
      ...GRADES.map((grade, index) =>
        formula(`20${index + 2}`, `Lớp ${index + 1}`, 'Học sinh', `students.grade=${grade}`),
      ),
      formula('207', 'Học sinh học 2 buổi/ngày', 'Học sinh', 'students.two_sessions'),
      formula('208', 'Học sinh bán trú', 'Học sinh', 'students.boarding'),
      manual('209', 'Học sinh học tiếng dân tộc thiểu số', 'Học sinh'),
    ],
  },
  {
    code: 'emis-th-cuoi-nam',
    name: 'Biểu EMIS Tiểu học cuối năm (khung)',
    period: 'end_of_year',
    rows: [
      heading('I', 'I. Kết quả giáo dục'),
      formula('101', 'Hoàn thành xuất sắc', 'Học sinh', 'students.year_result=excellent'),
      formula('102', 'Hoàn thành tốt', 'Học sinh', 'students.year_result=good'),
      formula('103', 'Hoàn thành', 'Học sinh', 'students.year_result=completed'),
      formula('104', 'Chưa hoàn thành', 'Học sinh', 'students.year_result=not_completed'),
      heading('II', 'II. Hoàn thành chương trình, lên lớp'),
      formula('201', 'Lên lớp', 'Học sinh', 'students.completion=promoted'),
      formula('202', 'Hoàn thành chương trình tiểu học', 'Học sinh', 'students.completion=level_completed'),
      formula('203', 'Đang rèn luyện, kiểm tra lại', 'Học sinh', 'students.completion=pending_support'),
      formula('204', 'Ở lại lớp', 'Học sinh', 'students.completion=retained'),
      heading('III', 'III. Khen thưởng'),
      formula('301', 'Học sinh được khen thưởng', 'Học sinh', 'students.awarded'),
      manual('302', 'Học sinh đạt giải các cuộc thi cấp huyện trở lên', 'Học sinh'),
    ],
  },
];

export const migration: Migration = {
  async up(database) {
    await database.schema
      .createTable('report_forms')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('code', 'text', (column) =>
        column
          .notNull()
          .unique()
          .check(sql`char_length(code) between 1 and 50`),
      )
      .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 200`))
      .addColumn('school_level', 'text', (column) =>
        column.notNull().check(sql`school_level in ('MN', 'TH', 'THCS', 'THPT')`),
      )
      .addColumn('period', 'text', (column) => column.notNull().check(sql`period in ('start_of_year', 'end_of_year')`))
      .addColumn('columns', 'jsonb', (column) => column.notNull())
      .addColumn('note', 'text')
      .addColumn('updated_by_name', 'text')
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await database.schema
      .createTable('report_form_rows')
      .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
      .addColumn('form_id', 'uuid', (column) => column.notNull().references('report_forms.id').onDelete('cascade'))
      .addColumn('order_no', 'integer', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().check(sql`char_length(code) between 1 and 20`))
      .addColumn('label', 'text', (column) => column.notNull().check(sql`char_length(label) between 1 and 300`))
      .addColumn('unit', 'text')
      .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('heading', 'formula', 'manual')`))
      .addColumn('formula', 'text')
      .addCheckConstraint('report_form_rows_formula_check', sql`(kind = 'formula') = (formula is not null)`)
      .addUniqueConstraint('report_form_rows_code_unique', ['form_id', 'code'])
      .execute();
    for (const form of FORMS) {
      const created = await sql<{
        id: string;
      }>`insert into report_forms (code, name, school_level, period, columns, note)
        values (${form.code}, ${form.name}, 'TH', ${form.period}, ${COLUMNS}::jsonb,
          ${'Khung chờ đối chiếu với hệ thống của Sở cấp Tiểu học (tài liệu 31)'})
        on conflict (code) do nothing returning id`.execute(database);
      const formId = created.rows[0]?.id;
      if (!formId) {
        continue;
      }
      let order = 0;
      for (const row of form.rows) {
        order += 1;
        await sql`insert into report_form_rows (form_id, order_no, code, label, unit, kind, formula)
          values (${formId}, ${order}, ${row.code}, ${row.label}, ${row.unit}, ${row.kind}, ${row.formula})`.execute(
          database,
        );
      }
    }
  },
  async down(database) {
    await database.schema.dropTable('report_form_rows').execute();
    await database.schema.dropTable('report_forms').execute();
  },
};
