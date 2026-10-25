// Báo cáo, thống kê và EMIS Tiểu học (DT-20 phần 20f, YCTD-165). Biểu EMIS Tiểu học là khung cấu hình được: mỗi biểu có các
// cột tách số (tổng, nữ, dân tộc thiểu số, nữ dân tộc, khuyết tật) và các dòng chỉ tiêu; dòng tính từ dữ liệu ghi công thức
// theo cú pháp ở đây (đối tượng rồi các điều kiện nối bằng dấu chấm), dòng nhập tay để trường điền. Chưa khảo sát hệ thống
// của Sở cấp Tiểu học nên bộ dòng mặc định chỉ là khung, sửa cho khớp sau khảo sát. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11. THCS, THPT (DT-21 phần 21g, YCTD-175) dùng cùng cú pháp với bộ điều kiện của cấp (xếp loại học tập, rèn
// luyện cả năm, danh hiệu, lên lớp, tổ hợp, tốt nghiệp): gọi `parseFormula(text, cấp)`
export type ReportColumnKey = 'total' | 'female' | 'ethnic' | 'ethnic_female' | 'disabled';
export type ReportRowKind = 'heading' | 'formula' | 'manual';

export const REPORT_COLUMN_LABELS: Record<ReportColumnKey, string> = {
  total: 'Tổng số',
  female: 'Nữ',
  ethnic: 'Dân tộc thiểu số',
  ethnic_female: 'Nữ dân tộc thiểu số',
  disabled: 'Khuyết tật',
};

export interface PrimaryStudentFact {
  female: boolean;
  ethnic: boolean;
  disabled: boolean;
  grade: string;
  two_sessions: boolean;
  boarding: boolean;
  year_result: string | null;
  completion: string | null;
  awarded: boolean;
}

export interface PrimaryClassFact {
  grade: string;
  two_sessions: boolean;
  boarding: boolean;
}

export interface ParsedFormula {
  entity: 'students' | 'classes';
  filters: Array<{ key: string; value: string | null }>;
}

type FilterSet = {
  values: Record<ParsedFormula['entity'], Record<string, readonly string[] | null>>;
  flags: Record<ParsedFormula['entity'], readonly string[]>;
};

const VALUE_FILTERS: Record<ParsedFormula['entity'], Record<string, readonly string[] | null>> = {
  students: {
    grade: null,
    year_result: ['excellent', 'good', 'completed', 'not_completed'],
    completion: ['promoted', 'level_completed', 'pending_support', 'retained'],
  },
  classes: { grade: null },
};
const FLAG_FILTERS: Record<ParsedFormula['entity'], readonly string[]> = {
  students: ['two_sessions', 'boarding', 'awarded'],
  classes: ['two_sessions', 'boarding'],
};

const RATINGS = ['good', 'fair', 'pass', 'fail'] as const;
const COMPLETIONS = ['promoted', 'level_completed', 'pending_support', 'retained'] as const;
// Điều kiện của THCS, THPT (21g): xếp loại học tập, rèn luyện cả năm (21c), danh hiệu Xuất sắc, Giỏi (21e), lên lớp (21e),
// tổ hợp theo mã (21a), tốt nghiệp đã xác nhận (21f), nội trú
const SECONDARY_FILTERS: FilterSet = {
  values: {
    students: {
      grade: null,
      learning: RATINGS,
      conduct: RATINGS,
      title: ['excellent', 'good'],
      completion: COMPLETIONS,
      combination: null,
      graduation: ['graduated', 'not_graduated'],
    },
    classes: { grade: null },
  },
  flags: { students: ['boarding', 'awarded'], classes: ['boarding'] },
};
const PRIMARY_FILTERS: FilterSet = { values: VALUE_FILTERS, flags: FLAG_FILTERS };

export function formulaFilters(level: string): FilterSet {
  return level === 'THCS' || level === 'THPT' ? SECONDARY_FILTERS : PRIMARY_FILTERS;
}

// Ví dụ: "students", "students.grade=K1", "students.year_result=excellent", "classes.grade=K5.two_sessions"; THCS, THPT:
// "students.learning=good", "students.title=excellent", "students.combination=TN1", "students.graduation=graduated"
export function parseFormula(text: string, level = 'TH'): ParsedFormula {
  const { values: valueFilters, flags: flagFilters } = formulaFilters(level);
  const parts = text.trim().split('.');
  const entity = parts.shift();
  if (entity !== 'students' && entity !== 'classes') {
    throw new Error('Công thức bắt đầu bằng students (học sinh) hoặc classes (lớp)');
  }
  const filters = parts.map((part) => {
    const [key, value, extra] = part.split('=');
    if (!key || extra !== undefined) {
      throw new Error(`Điều kiện "${part}" không hợp lệ`);
    }
    if (value === undefined) {
      if (!flagFilters[entity].includes(key)) {
        throw new Error(`Điều kiện "${key}" không dùng được với ${entity}`);
      }
      return { key, value: null };
    }
    const allowed = valueFilters[entity][key];
    if (allowed === undefined || value === '' || (allowed !== null && !allowed.includes(value))) {
      throw new Error(`Điều kiện "${part}" không dùng được với ${entity}`);
    }
    return { key, value };
  });
  return { entity, filters };
}

function matches(fact: Record<string, unknown>, filters: ParsedFormula['filters']): boolean {
  return filters.every((filter) =>
    filter.value === null ? fact[filter.key] === true : fact[filter.key] === filter.value,
  );
}

// Giá trị ô: số học sinh hoặc số lớp thoả điều kiện, tách theo cột; lớp chỉ có cột tổng số (cột khác để trống)
export function evaluateFormula(
  formula: ParsedFormula,
  column: ReportColumnKey,
  facts: {
    students: Array<Pick<PrimaryStudentFact, 'female' | 'ethnic' | 'disabled'>>;
    classes: object[];
  },
): number | null {
  if (formula.entity === 'classes') {
    return column === 'total'
      ? facts.classes.filter((row) => matches(row as unknown as Record<string, unknown>, formula.filters)).length
      : null;
  }
  return facts.students.filter((row) => {
    if (!matches(row as unknown as Record<string, unknown>, formula.filters)) {
      return false;
    }
    switch (column) {
      case 'female':
        return row.female;
      case 'ethnic':
        return row.ethnic;
      case 'ethnic_female':
        return row.ethnic && row.female;
      case 'disabled':
        return row.disabled;
      default:
        return true;
    }
  }).length;
}

// Số liệu một học sinh THCS, THPT cho biểu EMIS và thống kê (DT-21 phần 21g, YCTD-175): xếp loại cả năm đã xác nhận (21c),
// danh hiệu đã duyệt (21e), kết quả lên lớp (21e), mã tổ hợp đang hiệu lực (21a), kết quả tốt nghiệp đã xác nhận (21f)
export interface SecondaryStudentFact {
  female: boolean;
  ethnic: boolean;
  disabled: boolean;
  grade: string;
  boarding: boolean;
  learning: string | null;
  conduct: string | null;
  title: 'excellent' | 'good' | null;
  completion: string | null;
  combination: string | null;
  graduation: 'graduated' | 'not_graduated' | null;
  awarded: boolean;
}

export interface SecondaryClassFact {
  grade: string;
  boarding: boolean;
}

// Phổ điểm trung bình môn: khoảng theo các ngưỡng xếp loại của Thông tư 22/2021 (dưới 3,5; 3,5 đến dưới 5; 5 đến dưới 6,5; 6,5
// đến dưới 8; từ 8)
export const SCORE_DISTRIBUTION_BANDS = [
  { key: 'duoi-3.5', label: 'Dưới 3,5', from: 0, to: 3.5 },
  { key: '3.5-5', label: '3,5 đến dưới 5', from: 3.5, to: 5 },
  { key: '5-6.5', label: '5 đến dưới 6,5', from: 5, to: 6.5 },
  { key: '6.5-8', label: '6,5 đến dưới 8', from: 6.5, to: 8 },
  { key: 'tu-8', label: 'Từ 8', from: 8, to: 10.01 },
] as const;

export function scoreBand(average: number): (typeof SCORE_DISTRIBUTION_BANDS)[number]['key'] {
  const band = SCORE_DISTRIBUTION_BANDS.find((item) => average >= item.from && average < item.to);
  return band ? band.key : 'tu-8';
}
