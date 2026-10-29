import { sql } from 'kysely';
import type { Migration } from 'kysely/migration';

// DT-21 phần 21g (YCTD-175): nạp biểu khung EMIS THCS, THPT vào danh mục biểu cấu hình được của 20f (`report_forms`,
// `report_form_rows`, tệp hệ thống 0027). Mỗi cấp hai biểu: đầu năm (lớp, học sinh theo khối, nữ, dân tộc thiểu số, khuyết
// tật, nội trú, tổ hợp ở THPT) và cuối năm (xếp loại học tập, rèn luyện cả năm, danh hiệu, lên lớp, tốt nghiệp). Công thức
// theo cú pháp ở `packages/shared/src/primary-reports.ts` với bộ điều kiện của THCS, THPT. Chưa khảo sát hệ thống của Sở cấp
// THCS, THPT nên dòng, mã số chỉ là khung, sửa cho khớp sau khảo sát bằng "Sửa khung biểu". Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11
const COLUMNS = JSON.stringify([
  { key: 'total', label: 'Tổng số' },
  { key: 'female', label: 'Nữ' },
  { key: 'ethnic', label: 'Dân tộc thiểu số' },
  { key: 'ethnic_female', label: 'Nữ dân tộc thiểu số' },
  { key: 'disabled', label: 'Khuyết tật' },
]);

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

const RATING_ROWS: Array<[string, string]> = [
  ['good', 'Tốt'],
  ['fair', 'Khá'],
  ['pass', 'Đạt'],
  ['fail', 'Chưa đạt'],
];

function startOfYear(grades: string[], firstGrade: number): Row[] {
  return [
    heading('I', 'I. Lớp học'),
    formula('101', 'Tổng số lớp', 'Lớp', 'classes'),
    ...grades.map((grade, index) =>
      formula(`1${pad(index + 2)}`, `Lớp ${firstGrade + index}`, 'Lớp', `classes.grade=${grade}`),
    ),
    heading('II', 'II. Học sinh'),
    formula('201', 'Tổng số học sinh', 'Học sinh', 'students'),
    ...grades.map((grade, index) =>
      formula(`2${pad(index + 2)}`, `Lớp ${firstGrade + index}`, 'Học sinh', `students.grade=${grade}`),
    ),
    formula('220', 'Học sinh nội trú, bán trú', 'Học sinh', 'students.boarding'),
    manual('221', 'Học sinh lưu ban năm học trước', 'Học sinh'),
  ];
}

function endOfYear(): Row[] {
  return [
    heading('I', 'I. Kết quả học tập cả năm'),
    ...RATING_ROWS.map(([code, label], index) =>
      formula(`10${index + 1}`, label, 'Học sinh', `students.learning=${code}`),
    ),
    heading('II', 'II. Kết quả rèn luyện cả năm'),
    ...RATING_ROWS.map(([code, label], index) =>
      formula(`20${index + 1}`, label, 'Học sinh', `students.conduct=${code}`),
    ),
    heading('III', 'III. Khen thưởng'),
    formula('301', 'Học sinh Xuất sắc', 'Học sinh', 'students.title=excellent'),
    formula('302', 'Học sinh Giỏi', 'Học sinh', 'students.title=good'),
    manual('303', 'Học sinh đạt giải học sinh giỏi cấp tỉnh trở lên', 'Học sinh'),
    heading('IV', 'IV. Lên lớp, hoàn thành chương trình'),
    formula('401', 'Lên lớp', 'Học sinh', 'students.completion=promoted'),
    formula('402', 'Hoàn thành chương trình cấp học', 'Học sinh', 'students.completion=level_completed'),
    formula('403', 'Rèn luyện trong hè, kiểm tra lại', 'Học sinh', 'students.completion=pending_support'),
    formula('404', 'Ở lại lớp', 'Học sinh', 'students.completion=retained'),
    heading('V', 'V. Tốt nghiệp'),
    formula('501', 'Được công nhận tốt nghiệp', 'Học sinh', 'students.graduation=graduated'),
    formula('502', 'Không được công nhận tốt nghiệp', 'Học sinh', 'students.graduation=not_graduated'),
  ];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const FORMS: Array<{ code: string; name: string; level: 'THCS' | 'THPT'; period: string; rows: Row[] }> = [
  {
    code: 'emis-thcs-dau-nam',
    name: 'Biểu EMIS THCS đầu năm (khung)',
    level: 'THCS',
    period: 'start_of_year',
    rows: startOfYear(['K6', 'K7', 'K8', 'K9'], 6),
  },
  {
    code: 'emis-thcs-cuoi-nam',
    name: 'Biểu EMIS THCS cuối năm (khung)',
    level: 'THCS',
    period: 'end_of_year',
    rows: endOfYear(),
  },
  {
    code: 'emis-thpt-dau-nam',
    name: 'Biểu EMIS THPT đầu năm (khung)',
    level: 'THPT',
    period: 'start_of_year',
    rows: [
      ...startOfYear(['K10', 'K11', 'K12'], 10),
      heading('III', 'III. Học sinh theo tổ hợp môn'),
      manual('301', 'Số tổ hợp môn nhà trường tổ chức', 'Tổ hợp'),
    ],
  },
  {
    code: 'emis-thpt-cuoi-nam',
    name: 'Biểu EMIS THPT cuối năm (khung)',
    level: 'THPT',
    period: 'end_of_year',
    rows: endOfYear(),
  },
];

export const migration: Migration = {
  async up(database) {
    for (const form of FORMS) {
      const created = await sql<{
        id: string;
      }>`insert into report_forms (code, name, school_level, period, columns, note)
        values (${form.code}, ${form.name}, ${form.level}, ${form.period}, ${COLUMNS}::jsonb,
          ${'Khung chờ đối chiếu với hệ thống của Sở cấp THCS, THPT (tài liệu 46)'})
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
    await sql`delete from report_forms where code in (${sql.join(FORMS.map((form) => form.code))})`.execute(database);
  },
};
