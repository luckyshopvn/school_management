// Báo cáo, thống kê và EMIS Tiểu học (DT-20 phần 20f, YCTD-165). Biểu EMIS Tiểu học là khung cấu hình được: mỗi biểu có các
// cột tách số (tổng, nữ, dân tộc thiểu số, nữ dân tộc, khuyết tật) và các dòng chỉ tiêu; dòng tính từ dữ liệu ghi công thức
// theo cú pháp ở đây (đối tượng rồi các điều kiện nối bằng dấu chấm), dòng nhập tay để trường điền. Chưa khảo sát hệ thống
// của Sở cấp Tiểu học nên bộ dòng mặc định chỉ là khung, sửa cho khớp sau khảo sát. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11
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

// Ví dụ: "students", "students.grade=K1", "students.year_result=excellent", "classes.grade=K5.two_sessions"
export function parseFormula(text: string): ParsedFormula {
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
      if (!FLAG_FILTERS[entity].includes(key)) {
        throw new Error(`Điều kiện "${key}" không dùng được với ${entity}`);
      }
      return { key, value: null };
    }
    const allowed = VALUE_FILTERS[entity][key];
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
  facts: { students: PrimaryStudentFact[]; classes: PrimaryClassFact[] },
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
