import { validationError } from '@school-management/server';
import { normalizeHeader, parseDate, type RowError, type WorkbookTable } from './excel.js';

// Cột của tệp xuất từ cơ sở dữ liệu ngành (CSDL ngành) mầm non TP.HCM: học sinh (82 cột) và cán bộ, giáo viên (75 cột)
// (DT-13 phần 13a, YCTD-100). Mỗi cột có khóa tiếng Anh cố định:
// - cột `core` ghi vào cột riêng của hồ sơ (họ tên, ngày sinh, số định danh, lớp, cha mẹ...);
// - cột còn lại lưu vào `moet_profile` (jsonb) theo khóa; cột không tên ngay sau cột "Tỉnh/Thành phố (...)" là quận/huyện
//   cũ của cùng nhóm địa chỉ (`blankAfter`);
// - cột có trong tệp mà không có trong danh sách (mẫu đổi phiên bản) lưu vào `moet_profile.extra_columns` theo tiêu đề.
// Kiểu giá trị: text giữ nguyên chữ; date đổi về YYYY-MM-DD; flag "x" là có; phone chuẩn hóa 10 chữ số; secret (số căn
// cước, hộ chiếu, sổ bảo hiểm) chỉ lưu mã hóa kèm bốn số cuối
export type MoetValueKind = 'text' | 'date' | 'flag' | 'phone' | 'secret';

export interface MoetColumn {
  key: string;
  header: string;
  kind: MoetValueKind;
  core?: boolean;
  required?: boolean;
  blankAfter?: string;
}

const text = (key: string, header: string, blankAfter?: string): MoetColumn => ({
  key,
  header,
  kind: 'text',
  ...(blankAfter ? { blankAfter } : {}),
});
const date = (key: string, header: string): MoetColumn => ({ key, header, kind: 'date' });
const flag = (key: string, header: string): MoetColumn => ({ key, header, kind: 'flag' });
const core = (key: string, header: string, kind: MoetValueKind = 'text', required = false): MoetColumn => ({
  key,
  header,
  kind,
  core: true,
  ...(required ? { required } : {}),
});

// Nhóm địa chỉ: tỉnh, (quận/huyện ở cột không tên), xã/phường, tổ/thôn/xóm
const addressGroup = (prefix: string, label: string, withHamlet: boolean): MoetColumn[] => [
  text(`${prefix}_province`, `Tỉnh/Thành phố (${label})`, `${prefix}_district`),
  text(`${prefix}_ward`, `Xã/Phường (${label})`),
  ...(withHamlet ? [text(`${prefix}_hamlet`, `Tổ/Thôn/Xóm (${label})`)] : []),
];

export const MOET_CHILD_COLUMNS: MoetColumn[] = [
  core('row_number', 'STT'),
  core('class_label', 'Mã lớp', 'text', true),
  core('moet_student_code', 'Mã học sinh'),
  core('full_name', 'Họ tên', 'text', true),
  core('dob', 'Ngày sinh', 'date', true),
  core('gender', 'Giới tính', 'text', true),
  text('student_status', 'Trạng thái HS'),
  date('status_date', 'Ngày nhập trạng thái'),
  text('transfer_from_province', 'Chuyển đến từ Tỉnh/Thành Phố'),
  text('transfer_from_ward', 'Chuyển đến từ Xã'),
  text('dropout_reason', 'Lý do thôi học'),
  text('ethnicity', 'Dân tộc'),
  text('nationality', 'Quốc tịch'),
  text('religion', 'Tôn giáo'),
  ...addressGroup('permanent', 'Theo địa chỉ thường trú', true),
  ...addressGroup('hometown', 'Theo quê quán', true),
  ...addressGroup('birth_registration', 'Theo nơi khai sinh', false),
  ...addressGroup('birthplace', 'Theo nơi sinh', false),
  core('place_of_birth', 'Nơi sinh'),
  core('address', 'Chỗ ở hiện nay chi tiết'),
  ...addressGroup('current', 'Theo chỗ ở hiện nay', false),
  text('current_quarter', 'Khu phố mới'),
  { key: 'contact_phone', header: 'Số điện thoại liên hệ', kind: 'phone' },
  { key: 'passport_number', header: 'Số hộ chiếu', kind: 'secret' },
  text('passport_issued_place', 'Nơi cấp (Hộ chiếu)'),
  date('passport_issued_date', 'Ngày cấp (Hộ chiếu)'),
  { key: 'citizen_id', header: 'Số CCCD', kind: 'secret' },
  text('citizen_id_issued_place', 'Nơi cấp'),
  date('citizen_id_issued_date', 'Ngày cấp'),
  core('national_id', 'Số định danh cá nhân'),
  text('area', 'Khu vực'),
  text('disability_type', 'Loại khuyết tật'),
  text('policy_target', 'Đối tượng chính sách'),
  text('tuition_exemption', 'Miễn học phí'),
  text('tuition_reduction', 'Giảm học phí'),
  text('learning_cost_support', 'Hỗ trợ chi phí học tập'),
  text('lunch_support', 'Hỗ trợ ăn trưa'),
  flag('language_familiarization', 'Học Ch.trình làm quen Ng.ngữ'),
  flag('newly_enrolled', 'Học sinh tuyển mới'),
  date('newly_enrolled_date', 'Ngày tuyển mới'),
  flag('two_sessions_per_day', 'Học 2 buổi/ngày'),
  flag('boarding_class', 'Học sinh lớp bán trú'),
  text('boarding_type', 'Học bán trú'),
  flag('mother_ethnic_minority', 'Có mẹ dân tộc'),
  text('mother_ethnicity', 'Dân tộc mẹ'),
  flag('father_ethnic_minority', 'Có cha dân tộc'),
  text('father_ethnicity', 'Dân tộc cha'),
  flag('can_swim', 'Học sinh biết bơi'),
  text('eye_disease', 'Bệnh về mắt'),
  flag('parent_has_smartphone', 'P.huynh có Smartphone'),
  flag('parent_has_internet_computer', 'P.huynh có M.tính kết nối Internet'),
  text('development_education', 'Giáo dục phát triển của trẻ'),
  flag('no_father_info', 'Không có thông tin cha'),
  core('father_name', 'Họ tên cha'),
  core('father_occupation', 'Nghề nghiệp cha'),
  core('father_birth_year', 'Năm sinh cha'),
  core('father_phone', 'Số điện thoại cha'),
  core('father_id_number', 'Số CCCD/CMND/DDCN cha'),
  flag('no_mother_info', 'Không có thông tin mẹ'),
  core('mother_name', 'Họ tên mẹ'),
  core('mother_occupation', 'Nghề nghiệp mẹ'),
  core('mother_birth_year', 'Năm sinh mẹ'),
  core('mother_phone', 'Số điện thoại mẹ'),
  core('mother_id_number', 'Số CCCD/CMND/DDCN mẹ'),
  core('legal_guardian_name', 'Họ tên người giám hộ'),
  core('legal_guardian_occupation', 'Nghề nghiệp người giám hộ'),
  core('legal_guardian_birth_year', 'Năm sinh người giám hộ'),
  core('legal_guardian_phone', 'Số điện thoại người giám hộ'),
  text('legal_guardian_gender', 'Giới tính người giám hộ'),
  core('legal_guardian_id_number', 'Số CCCD/CMND/DDCN người giám hộ'),
];

export const MOET_STAFF_COLUMNS: MoetColumn[] = [
  core('row_number', 'STT'),
  core('moet_staff_code', 'Mã định danh Bộ GD&ĐT'),
  core('full_name', 'Họ tên', 'text', true),
  core('gender', 'Giới tính'),
  core('dob', 'Ngày sinh', 'date'),
  text('staff_status', 'Trạng thái CB'),
  date('status_date', 'Ngày nhập trạng thái'),
  core('id_number', 'CMND/CCCD'),
  date('id_issued_date', 'Ngày cấp'),
  text('id_issued_place', 'Nơi cấp'),
  flag('vneid_level2', 'VNeId mức độ 2'),
  core('email', 'Email'),
  core('phone', 'Điện thoại'),
  text('ethnicity', 'Dân tộc'),
  text('religion', 'Tôn giáo'),
  ...addressGroup('permanent', 'Theo địa chỉ thường trú', true),
  ...addressGroup('hometown', 'Theo quê quán', true),
  ...addressGroup('birth_registration', 'Theo nơi khai sinh', false),
  ...addressGroup('current', 'Theo chỗ ở hiện nay', false),
  flag('youth_union_member', 'Là Đoàn viên'),
  flag('party_member', 'Là Đảng viên'),
  date('party_probation_date', 'Ngày vào đảng dự bị'),
  date('party_official_date', 'Ngày vào đảng chính thức'),
  { key: 'social_insurance_number', header: 'Số sổ BHXH', kind: 'secret' },
  text('job_position', 'Vị trí việc làm'),
  text('position_group', 'Nhóm chức vụ'),
  text('contract_form', 'Hình thức hợp đồng'),
  date('recruitment_date', 'Ngày tuyển dụng'),
  text('recruiting_agency', 'Cơ quan tuyển dụng'),
  text('occupation_at_recruitment', 'Nghề nghiệp khi được tuyển dụng'),
  text('teaching_group', 'Dạy nhóm lớp'),
  text('civil_service_rank', 'Ngạch/Hạng'),
  text('teaching_periods_per_week', 'S.tiết thực dạy trên tuần'),
  text('concurrent_periods_per_week', 'S.tiết thực k.nhiệm trên tuần'),
  flag('life_skills_trained', 'Đã tập huấn dạy KN sống'),
  flag('teaches_inclusive', 'Dạy HSKT học hòa nhập'),
  flag('one_session_per_day', 'Dạy 1 buổi/ngày'),
  flag('two_sessions_per_day', 'Dạy 2 buổi/ngày'),
  text('attraction_allowance_percent', 'Mức phụ cấp thu hút nghề (%)'),
  text('seniority_allowance_percent', 'Mức phụ cấp thâm niên (%)'),
  text('incentive_allowance_percent', 'Mức phụ cấp ưu đãi nghề (%)'),
  text('leadership_allowance_percent', 'Mức phụ cấp chức vụ lãnh đạo (%)'),
  text('salary_step', 'Bậc lương'),
  text('over_frame_percent', 'Phần trăm vượt khung (%)'),
  text('salary_coefficient', 'Hệ số lương'),
  date('salary_effective_date', 'Ngày hưởng'),
  text('regular_training_result', 'KQ B.dưỡng t.xuyên'),
  text('professional_qualification', 'T.độ c.môn n.vụ'),
  text('political_theory_level', 'T.độ LLCT'),
  text('education_management_level', 'T.độ quản lý GD'),
  text('main_foreign_language', 'Ngoại ngữ chính'),
  text('language_certificate_group', 'Nhóm C.Chỉ N.Ngữ'),
  text('language_certificate_type', 'Loại C.Chỉ N.Ngữ'),
  text('language_score', 'Điểm ngoại ngữ'),
  text('language_framework_level', 'Khung N.Lực N.Ngữ'),
  text('language_training_level', 'Trình độ đào tạo ngoại ngữ'),
  text('it_level', 'T.độ tin học'),
  text('main_major', 'Chuyên ngành chính'),
  text('main_major_level', 'Trình độ chuyên ngành chính'),
  text('other_major', 'Chuyên ngành khác'),
  text('other_major_level', 'Trình độ chuyên ngành khác'),
  text('training_institution', 'Cơ sở đào tạo'),
  text('civil_servant_evaluation', 'Đánh giá viên chức/công chức'),
  text('excellent_teacher', 'Giáo viên dạy giỏi'),
  text('honorary_titles', 'Danh hiệu phong tặng'),
];

// Nhãn cột quận/huyện không tên trong tệp, dùng khi hiển thị
const blankLabel = (column: MoetColumn) => `Quận/Huyện cũ ${column.header.slice(column.header.indexOf('('))}`;

export interface MoetRow {
  row: number;
  values: Record<string, string>;
  extra: Record<string, string>;
}

const lower = (value: string) => normalizeHeader(value).toLowerCase();

// Gắn từng cột của tệp với khóa; thiếu cột bắt buộc thì từ chối cả tệp
export function mapMoetRows(table: WorkbookTable, columns: MoetColumn[], alternatives: string[][] = []): MoetRow[] {
  const byHeader = new Map(columns.map((column) => [lower(column.header), column]));
  const keys: Array<string | null> = [];
  const extraHeaders: Array<string | null> = [];
  table.headers.forEach((header, index) => {
    const column = header ? byHeader.get(lower(header)) : undefined;
    const previous = index > 0 ? table.headers[index - 1] : undefined;
    const previousColumn = previous ? byHeader.get(lower(previous)) : undefined;
    if (column && !keys.includes(column.key)) {
      keys.push(column.key);
      extraHeaders.push(null);
    } else if (!header && previousColumn?.blankAfter) {
      keys.push(previousColumn.blankAfter);
      extraHeaders.push(null);
    } else {
      keys.push(null);
      extraHeaders.push(header || null);
    }
  });
  const missing = columns.filter((column) => column.required && !keys.includes(column.key));
  const missingAlternatives = alternatives.filter((group) => !group.some((key) => keys.includes(key)));
  if (missing.length > 0 || missingAlternatives.length > 0) {
    const names = [
      ...missing.map((column) => column.header),
      ...missingAlternatives.map((group) =>
        group.map((key) => columns.find((column) => column.key === key)?.header ?? key).join(' hoặc '),
      ),
    ];
    throw validationError([{ field: 'file', message: `Tệp thiếu cột: ${names.join(', ')}` }]);
  }
  return table.rows.map(({ row, cells }) => {
    const values: Record<string, string> = {};
    const extra: Record<string, string> = {};
    cells.forEach((cell, index) => {
      const key = keys[index];
      const extraHeader = extraHeaders[index];
      if (key) {
        values[key] = cell;
      } else if (extraHeader && cell) {
        extra[extraHeader] = cell;
      }
    });
    return { row, values, extra };
  });
}

// Tên có dấu so khớp không phân biệt hoa thường, dấu và khoảng trắng thừa ("Lá Hồng" = "la hong")
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Số điện thoại: bỏ ký tự không phải số, đổi đầu 84 thành 0, thêm số 0 bị Excel cắt khi ô là số
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length === 9 && !digits.startsWith('0')) {
    digits = `0${digits}`;
  }
  return digits;
}

// Số định danh: bỏ khoảng trắng, dấu chấm; thêm số 0 đầu bị Excel cắt khi ô là số (11 chữ số thành 12)
export function normalizeIdNumber(value: string): string {
  const digits = value.replace(/[\s.]/g, '');
  return /^\d{11}$/.test(digits) ? `0${digits}` : digits;
}

const YES_VALUES = new Set(['x', 'có', 'co', '1', 'true']);

// Đổi các cột không phải cột riêng thành nội dung `moet_profile`; ngày sai báo lỗi theo dòng
export function buildMoetProfile(
  record: MoetRow,
  columns: MoetColumn[],
  encrypt: (plainText: string) => string,
  errors: RowError[],
): Record<string, unknown> {
  const profile: Record<string, unknown> = {};
  const all: MoetColumn[] = [
    ...columns,
    ...columns.filter((column) => column.blankAfter).map((column) => text(column.blankAfter ?? '', blankLabel(column))),
  ];
  for (const column of all) {
    const value = record.values[column.key] ?? '';
    if (column.core || !value) {
      continue;
    }
    if (column.kind === 'date') {
      const parsed = parseDate(value);
      if (!parsed) {
        errors.push({ row: record.row, column: column.header, message: 'Ngày không hợp lệ, ghi dạng ngày/tháng/năm' });
      } else {
        profile[column.key] = parsed;
      }
    } else if (column.kind === 'flag') {
      profile[column.key] = YES_VALUES.has(value.toLowerCase()) ? true : value;
    } else if (column.kind === 'phone') {
      profile[column.key] = normalizePhone(value);
    } else if (column.kind === 'secret') {
      const plain = value.replace(/\s/g, '');
      profile[`${column.key}_encrypted`] = encrypt(plain);
      profile[`${column.key}_last4`] = plain.slice(-4);
    } else {
      profile[column.key] = value;
    }
  }
  if (Object.keys(record.extra).length > 0) {
    profile.extra_columns = record.extra;
  }
  return profile;
}

export interface MoetProfileEntry {
  key: string;
  label: string;
  value: string;
}

// Nội dung hiển thị chỉ đọc: nhãn là tiêu đề cột trong tệp; ngày dạng ngày/tháng/năm; số bí mật chỉ hiện bốn số cuối
export function describeMoetProfile(profile: unknown, columns: MoetColumn[]): MoetProfileEntry[] | null {
  if (!profile || typeof profile !== 'object') {
    return null;
  }
  const data = profile as Record<string, unknown>;
  const entries: MoetProfileEntry[] = [];
  const push = (key: string, label: string, raw: unknown, kind: MoetValueKind) => {
    if (raw === undefined || raw === null || raw === '') {
      return;
    }
    const value =
      kind === 'date' && typeof raw === 'string'
        ? raw.split('-').reverse().join('/')
        : raw === true
          ? 'Có'
          : String(raw);
    entries.push({ key, label, value });
  };
  for (const column of columns) {
    if (column.core) {
      continue;
    }
    if (column.kind === 'secret') {
      const lastFour = data[`${column.key}_last4`];
      if (typeof lastFour === 'string' && lastFour) {
        entries.push({ key: column.key, label: column.header, value: `********${lastFour}` });
      }
    } else {
      push(column.key, column.header, data[column.key], column.kind);
    }
    if (column.blankAfter) {
      push(column.blankAfter, blankLabel(column), data[column.blankAfter], 'text');
    }
  }
  const extra = data.extra_columns;
  if (extra && typeof extra === 'object') {
    for (const [header, value] of Object.entries(extra as Record<string, unknown>)) {
      push(`extra:${header}`, header, value, 'text');
    }
  }
  return entries;
}
