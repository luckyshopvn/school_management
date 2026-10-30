import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';
import { TT25_THCS } from '../data/tt25-thcs.js';

// YCTD-385 lát L2: nạp 03.ĐN-THCS, 03.CN-THCS theo Thông tư 25/2024 vào khung biểu nhiều phần (tệp 0135); hai biểu khung THCS
// cũ đổi tên thêm "(khung cũ)" và ẩn, số đã nhập giữ nguyên. Biểu khung THPT để lát L3
const OLD_FORMS = ['emis-thcs-dau-nam', 'emis-thcs-cuoi-nam'];

export const migration: Migration = {
  async up(database) {
    await sql`update report_forms set name = name || ' (khung cũ)', archived = true
      where code in (${sql.join(OLD_FORMS)})`.execute(database);
    for (const form of TT25_THCS) {
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
    await sql`delete from report_forms where code in (${sql.join(TT25_THCS.map((form) => form.code))})`.execute(
      database,
    );
    await sql`update report_forms set name = replace(name, ' (khung cũ)', ''), archived = false
      where code in (${sql.join(OLD_FORMS)})`.execute(database);
  },
};
