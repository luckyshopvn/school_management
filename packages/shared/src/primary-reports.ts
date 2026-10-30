// Báo cáo, thống kê và EMIS Tiểu học (DT-20 phần 20f, YCTD-165). Biểu EMIS Tiểu học là khung cấu hình được: mỗi biểu có các
// cột tách số (tổng, nữ, dân tộc thiểu số, nữ dân tộc, khuyết tật) và các dòng chỉ tiêu; dòng tính từ dữ liệu ghi công thức
// theo cú pháp ở đây (đối tượng rồi các điều kiện nối bằng dấu chấm), dòng nhập tay để trường điền. Chưa khảo sát hệ thống
// của Sở cấp Tiểu học nên bộ dòng mặc định chỉ là khung, sửa cho khớp sau khảo sát. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11. THCS, THPT (DT-21 phần 21g, YCTD-175) dùng cùng cú pháp với bộ điều kiện của cấp (xếp loại học tập, rèn
// luyện cả năm, danh hiệu, lên lớp, tổ hợp, tốt nghiệp): gọi `parseFormula(text, cấp)`
// Cột tách số. Biểu Thông tư 25/2024 (YCTD-385) thêm cột phân loại hợp đồng của đội ngũ công lập và cột cấp công trình của
// phòng học tập
export type ReportColumnKey =
  | 'total'
  | 'female'
  | 'ethnic'
  | 'ethnic_female'
  | 'disabled'
  | 'indefinite'
  | 'fixed_term'
  | 'labor_contract'
  | 'permanent'
  | 'semi_permanent'
  | 'temporary';
export type ReportRowKind = 'heading' | 'formula' | 'manual';

export const REPORT_COLUMN_LABELS: Record<ReportColumnKey, string> = {
  total: 'Tổng số',
  female: 'Nữ',
  ethnic: 'Dân tộc thiểu số',
  ethnic_female: 'Nữ dân tộc thiểu số',
  disabled: 'Khuyết tật',
  indefinite: 'Viên chức HĐLV không xác định thời hạn',
  fixed_term: 'Viên chức HĐLV xác định thời hạn',
  labor_contract: 'Hợp đồng lao động',
  permanent: 'Kiên cố',
  semi_permanent: 'Bán kiên cố',
  temporary: 'Tạm',
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
  // YCTD-385: tuổi theo năm sinh (năm đầu của năm học trừ năm sinh, quyết định của Eric ngày 2026-10-30), học sinh mới tuyển
  // lớp 1, lưu ban năm học trước, dạng khuyết tật, dân tộc học bán trú, học lại hoặc thi lại trong hè, chuyển đến từ tỉnh khác
  age?: number | null;
  new_entrant?: boolean;
  repeater?: boolean;
  disability?: string | null;
  ethnic_boarding?: boolean;
  summer_support?: boolean;
  transfer_in_province?: boolean;
}

export interface PrimaryClassFact {
  grade: string;
  two_sessions: boolean;
  boarding: boolean;
  multigrade?: boolean;
  multi_level?: boolean;
}

// Đối tượng của công thức. YCTD-385 thêm trường (`school`, một dòng, giá trị 0 hoặc 1), điểm trường (`sites`), đội ngũ
// (`staff`), phòng học tập (`rooms`), học sinh rời trường trong năm (`leavers`: bỏ học, chuyển đi)
export const FORMULA_ENTITIES = ['students', 'classes', 'school', 'sites', 'staff', 'rooms', 'leavers'] as const;
export type FormulaEntity = (typeof FORMULA_ENTITIES)[number];

export interface ParsedFormula {
  entity: FormulaEntity;
  filters: Array<{ key: string; value: string | null }>;
}

type FilterSet = {
  values: Record<FormulaEntity, Record<string, readonly string[] | null>>;
  flags: Record<FormulaEntity, readonly string[]>;
};

export const DISABILITY_KINDS = ['vision', 'hearing_speech', 'intellectual', 'mobility', 'neuro_mental', 'other'] as const;
export const STAFF_JOBS = [
  'academic_affairs',
  'counselor',
  'disability_support',
  'library',
  'office_management',
  'accounting',
  'treasurer',
  'clerical',
  'health',
  'information_technology',
  'security',
  'cook',
  'service',
  'other_staff',
] as const;
export const STAFF_AGE_BANDS = ['20_29', '30_39', '40_49', '50_59', '60'] as const;
export const STANDARD_LEVELS = ['excellent', 'good', 'met', 'not_met'] as const;

// Điều kiện dùng chung mọi cấp phổ thông cho các đối tượng mới của YCTD-385
const COMMON_VALUES = {
  school: {},
  sites: {},
  staff: { job: STAFF_JOBS, rank: ['1', '2', '3'], age_band: STAFF_AGE_BANDS, standard: STANDARD_LEVELS },
  rooms: {},
  leavers: { grade: null },
} as const;
const COMMON_FLAGS = {
  school: [
    'standard_1',
    'standard_2',
    'electricity',
    'internet',
    'computers',
    'drinking_water',
    'separate_toilets',
    'handwashing',
    'sex_education',
    'disaster_plan',
    'multi_level',
  ],
  sites: [],
  staff: ['principal', 'vice_principal', 'manager', 'teacher', 'new_hire', 'retired', 'left'],
  rooms: ['classroom', 'borrowed', 'multi_purpose'],
  leavers: ['dropout', 'transfer_out_province'],
} as const;

const VALUE_FILTERS: Record<FormulaEntity, Record<string, readonly string[] | null>> = {
  students: {
    grade: null,
    year_result: ['excellent', 'good', 'completed', 'not_completed'],
    completion: ['promoted', 'level_completed', 'pending_support', 'retained'],
    age: null,
    age_under: null,
    age_over: null,
    disability: DISABILITY_KINDS,
  },
  classes: { grade: null },
  ...COMMON_VALUES,
};
const FLAG_FILTERS: Record<FormulaEntity, readonly string[]> = {
  students: [
    'two_sessions',
    'boarding',
    'awarded',
    'new_entrant',
    'repeater',
    'ethnic_boarding',
    'disabled',
    'summer_support',
    'transfer_in_province',
  ],
  classes: ['two_sessions', 'boarding', 'multigrade', 'multi_level'],
  ...COMMON_FLAGS,
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
    ...COMMON_VALUES,
  },
  flags: { students: ['boarding', 'awarded'], classes: ['boarding'], ...COMMON_FLAGS },
};
const PRIMARY_FILTERS: FilterSet = { values: VALUE_FILTERS, flags: FLAG_FILTERS };

export function formulaFilters(level: string): FilterSet {
  return level === 'THCS' || level === 'THPT' ? SECONDARY_FILTERS : PRIMARY_FILTERS;
}

// Điều kiện so sánh số: `age_under=11` là tuổi nhỏ hơn 11, `age_over=11` là tuổi lớn hơn 11
const COMPARISONS: Record<string, { key: string; test: (fact: number, limit: number) => boolean }> = {
  age_under: { key: 'age', test: (fact, limit) => fact < limit },
  age_over: { key: 'age', test: (fact, limit) => fact > limit },
};
const NUMERIC_VALUES = new Set(['age', 'age_under', 'age_over']);

// Ví dụ: "students", "students.grade=K1", "students.year_result=excellent", "classes.grade=K5.two_sessions"; THCS, THPT:
// "students.learning=good", "students.title=excellent", "students.combination=TN1", "students.graduation=graduated";
// YCTD-385: "students.grade=K1.age=6", "students.completion=level_completed.age_under=11", "school.electricity",
// "staff.teacher.rank=2", "rooms.classroom", "leavers.dropout"
export function parseFormula(text: string, level = 'TH'): ParsedFormula {
  const { values: valueFilters, flags: flagFilters } = formulaFilters(level);
  const parts = text.trim().split('.');
  const entity = parts.shift() as FormulaEntity | undefined;
  if (!entity || !(FORMULA_ENTITIES as readonly string[]).includes(entity)) {
    throw new Error(
      'Công thức bắt đầu bằng students (học sinh), classes (lớp), school (trường), sites (điểm trường), staff (đội ngũ), rooms (phòng học tập) hoặc leavers (học sinh rời trường)',
    );
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
    if (
      allowed === undefined ||
      value === '' ||
      (allowed !== null && !allowed.includes(value)) ||
      (NUMERIC_VALUES.has(key) && !/^\d{1,3}$/.test(value))
    ) {
      throw new Error(`Điều kiện "${part}" không dùng được với ${entity}`);
    }
    return { key, value };
  });
  return { entity, filters };
}

// Dòng cộng các dòng khác của cùng phần (YCTD-385), ví dụ "rows:156+158+164": dùng cho dòng tổng gồm cả dòng nhập tay
export function parseRowSum(text: string | null): string[] | null {
  const match = /^rows:([0-9A-Za-z.]+(?:\+[0-9A-Za-z.]+)*)$/.exec((text ?? '').trim());
  return match ? match[1]!.split('+') : null;
}

function matches(fact: Record<string, unknown>, filters: ParsedFormula['filters']): boolean {
  return filters.every((filter) => {
    if (filter.value === null) {
      return fact[filter.key] === true;
    }
    const comparison = COMPARISONS[filter.key];
    if (comparison) {
      const value = fact[comparison.key];
      return typeof value === 'number' && comparison.test(value, Number(filter.value));
    }
    return NUMERIC_VALUES.has(filter.key) ? fact[filter.key] === Number(filter.value) : fact[filter.key] === filter.value;
  });
}

export type FormulaFacts = { students: object[]; classes: object[] } & Partial<Record<FormulaEntity, object[]>>;

// Giá trị ô: số đối tượng thoả điều kiện, tách theo cột. Học sinh tách theo nữ, dân tộc, khuyết tật; đội ngũ, phòng học tập,
// học sinh rời trường tách theo cờ cùng tên cột của từng dòng số liệu; lớp, trường, điểm trường chỉ có cột tổng số
export function evaluateFormula(formula: ParsedFormula, column: ReportColumnKey, facts: FormulaFacts): number | null {
  // Đội ngũ chỉ đếm người đang làm việc, trừ dòng nghỉ hưu, nghỉ hoặc chuyển đi trong năm học
  const leaving = formula.filters.some((filter) => filter.key === 'retired' || filter.key === 'left');
  const rows = (facts[formula.entity] ?? []).filter((row) => {
    const fact = row as unknown as Record<string, unknown>;
    return (formula.entity !== 'staff' || leaving || fact.active !== false) && matches(fact, formula.filters);
  });
  if (column === 'total') {
    return rows.length;
  }
  if (formula.entity === 'classes' || formula.entity === 'school' || formula.entity === 'sites') {
    return null;
  }
  return rows.filter((row) => {
    const fact = row as unknown as Record<string, unknown>;
    return column === 'ethnic_female' ? fact.ethnic === true && fact.female === true : fact[column] === true;
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

// Phần của biểu (YCTD-385): biểu Thông tư 25/2024 chia phần Trường, Lớp, Học sinh, Đội ngũ, Phòng học tập, mỗi phần một bộ cột.
// Cột của phần là cột của một loại hình; biểu của Sở lặp bộ cột cho ba nhóm Tổng số, Công lập, Tư thục (`ownership_groups`).
// Cột `public_only` chỉ có ở nhóm Công lập (phân loại viên chức, hợp đồng của đội ngũ). Một trường chỉ điền nhóm theo loại
// hình của mình; màn hình hiện nhóm đó, tệp Excel xuất đủ ba nhóm, nhóm kia để trống
export interface ReportSectionColumn {
  key: ReportColumnKey;
  label: string;
  public_only?: boolean;
}

export interface ReportSection {
  code: string;
  name: string;
  columns: ReportSectionColumn[];
  ownership_groups: boolean;
}

export type OwnershipGroup = 'public' | 'private';

export const OWNERSHIP_GROUP_LABELS: Record<'total' | OwnershipGroup, string> = {
  total: 'Tổng số',
  public: 'Công lập',
  private: 'Tư thục',
};

// Cột trường thấy trên màn hình theo loại hình
export function sectionColumns(section: ReportSection, ownership: OwnershipGroup): ReportSectionColumn[] {
  return section.columns.filter((column) => ownership === 'public' || !column.public_only);
}

// Cột của tệp xuất theo đúng mẫu: ba nhóm khi phần có nhóm loại hình, một nhóm khi không
export function expandSectionColumns(
  section: ReportSection,
): Array<{ group: 'total' | OwnershipGroup | null; column: ReportSectionColumn }> {
  if (!section.ownership_groups) {
    return section.columns.map((column) => ({ group: null, column }));
  }
  return (['total', 'public', 'private'] as const).flatMap((group) =>
    section.columns
      .filter((column) => group === 'public' || !column.public_only)
      .map((column) => ({ group, column })),
  );
}
