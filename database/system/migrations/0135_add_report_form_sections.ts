import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { TT25_TIEU_HOC } from '../data/tt25-tieu-hoc.js';

// YCTD-385 lát L1: khung biểu nhiều phần cho biểu thống kê Thông tư 25/2024.
// - `report_forms.sections`: các phần của biểu, mỗi phần mã, tên, bộ cột riêng, có lặp theo nhóm loại hình (Tổng số, Công lập,
//   Tư thục) hay không; biểu cũ không có (một phần `main` dùng `columns` như trước). Claude tự chọn theo ủy quyền của Eric ngày
//   2026-10-11: lưu ở cột JSON cùng kiểu với `columns` có sẵn thay vì bảng riêng như đặc tả L0 (phần không có thuộc tính riêng
//   nào cần truy vấn);
// - `report_forms.source`: `custom` (khung tự đặt, sửa được), `tt25` (biểu pháp định, khóa dòng và mã), `eqms` (biểu EQMS của
//   phần mềm Bộ, lát L6); `form_number` là ký hiệu biểu (02.ĐN-TH); `archived` ẩn biểu khỏi danh sách mặc định;
// - kỳ thêm `mid_year` (EQMS giữa năm);
// - `report_form_rows.section`: mã phần của dòng, mặc định `main`;
// - nạp 02.ĐN-TH, 02.CN-TH; hai biểu khung Tiểu học cũ đổi tên thêm "(khung cũ)" và ẩn, số đã nhập giữ nguyên
export const migration: Migration = {
  async up(database) {
    await database.schema
      .alterTable('report_forms')
      .addColumn('source', 'text', (column) =>
        column
          .notNull()
          .defaultTo('custom')
          .check(sql`source in ('custom', 'tt25', 'eqms')`),
      )
      .addColumn('form_number', 'text', (column) => column.check(sql`char_length(form_number) between 1 and 30`))
      .addColumn('sections', 'jsonb')
      .addColumn('archived', 'boolean', (column) => column.notNull().defaultTo(false))
      .execute();
    await sql`alter table report_forms drop constraint report_forms_period_check`.execute(database);
    await sql`alter table report_forms add constraint report_forms_period_check
      check (period in ('start_of_year', 'mid_year', 'end_of_year'))`.execute(database);
    await database.schema
      .alterTable('report_form_rows')
      .addColumn('section', 'text', (column) =>
        column
          .notNull()
          .defaultTo('main')
          .check(sql`char_length(section) between 1 and 20`),
      )
      .execute();
    await sql`update report_forms set name = name || ' (khung cũ)', archived = true
      where code in ('emis-th-dau-nam', 'emis-th-cuoi-nam')`.execute(database);
    for (const form of TT25_TIEU_HOC) {
      const sections = form.sections.map(({ code, name, columns }) => ({
        code,
        name,
        columns,
        ownership_groups: true,
      }));
      const created = await sql<{ id: string }>`insert into report_forms
          (code, name, school_level, period, columns, note, source, form_number, sections)
        values (${form.code}, ${form.name}, ${form.school_level}, ${form.period},
          ${JSON.stringify(form.sections[0]!.columns)}::jsonb, ${form.note}, 'tt25', ${form.form_number},
          ${JSON.stringify(sections)}::jsonb)
        on conflict (code) do nothing returning id`.execute(database);
      const formId = created.rows[0]?.id;
      if (!formId) {
        continue;
      }
      let order = 0;
      for (const section of form.sections) {
        for (const [code, label, unit, source] of section.rows) {
          order += 1;
          const kind = source === 'manual' || source === 'heading' ? source : 'formula';
          await sql`insert into report_form_rows (form_id, order_no, code, label, unit, kind, formula, section)
            values (${formId}, ${order}, ${code}, ${label}, ${unit}, ${kind}, ${kind === 'formula' ? source : null},
              ${section.code})`.execute(database);
        }
      }
    }
  },
  async down(database) {
    await sql`delete from report_forms where source = 'tt25'`.execute(database);
    await sql`update report_forms set name = replace(name, ' (khung cũ)', ''), archived = false
      where code in ('emis-th-dau-nam', 'emis-th-cuoi-nam')`.execute(database);
    await database.schema.alterTable('report_form_rows').dropColumn('section').execute();
    await sql`delete from report_forms where period = 'mid_year'`.execute(database);
    await sql`alter table report_forms drop constraint report_forms_period_check`.execute(database);
    await sql`alter table report_forms add constraint report_forms_period_check
      check (period in ('start_of_year', 'end_of_year'))`.execute(database);
    await database.schema
      .alterTable('report_forms')
      .dropColumn('source')
      .dropColumn('form_number')
      .dropColumn('sections')
      .dropColumn('archived')
      .execute();
  },
};
