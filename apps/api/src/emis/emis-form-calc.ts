import {
  EQUIPMENT_AGE_GROUPS,
  ROOM_BLOCKS,
  ROOM_TYPES,
  type SchoolOwnershipType,
} from '@school-management/shared';
import type { EmisValues } from '@school-management/database';
import { isEthnicMinority, staffCategory, type EmisRow } from '../facilities/emis-calc.js';
import type { EquipmentReport } from '../facilities/equipment-report-calc.js';

// Số liệu các biểu EMIS của phần 16j (khảo sát mục 5 của Sở). Hàm thuần, không đọc cơ sở dữ liệu. Nội dung chỉ tiêu của Sở
// chưa xem được nên tên chỉ tiêu, mã số do Claude đặt theo dữ liệu có trong hệ thống (Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11); cột theo khảo sát. Quy tắc chung như Biểu 1 (emis-calc.ts): cả số của trường vào cột theo loại hình;
// dân tộc thiểu số là có ghi dân tộc và không phải dân tộc Kinh
export interface EmisRowTemplate {
  code: string;
  label: string;
  unit: string;
}

export interface EmisFormRow extends EmisRowTemplate {
  values: EmisValues;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase().normalize('NFC');
const present = (value: string | null | undefined) => {
  const text = normalize(value);
  return text !== '' && !['không', 'khong', 'không có', 'chưa có'].includes(text);
};

export function fromEmisRow(row: EmisRow, code = row.code, label = row.label): EmisFormRow {
  return {
    code,
    label,
    unit: row.unit,
    values: {
      total: row.total,
      public: row.public,
      private: row.private,
      people_founded: row.people_founded,
      female: row.female,
      ethnic_minority: row.ethnic_minority,
    },
  };
}

export interface PersonFacts {
  gender: 'male' | 'female' | null;
  ethnicity: string | null;
}

// Dòng theo số người: tổng số, công lập, tư thục, dân lập, nữ, dân tộc thiểu số
export function populationRow(
  ownership: SchoolOwnershipType | null,
  template: EmisRowTemplate,
  members: PersonFacts[],
): EmisFormRow {
  const total = members.length;
  const byOwnership = (type: SchoolOwnershipType) => (ownership === null ? null : ownership === type ? total : 0);
  return {
    ...template,
    values: {
      total,
      public: byOwnership('public'),
      private: byOwnership('private'),
      people_founded: byOwnership('people_founded'),
      female: members.filter((member) => member.gender === 'female').length,
      ethnic_minority: members.filter((member) => isEthnicMinority(member.ethnicity)).length,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 1.2 Báo cáo cơ sở vật chất: năm thẻ. "Lấy dữ liệu" tính từ 1.1 Khai báo cơ sở vật chất, hồ sơ trường và 2.1 Tổng hợp
// thiết bị dạy học; số liệu chỉ lưu khi bấm Ghi
export interface FacilityRoom {
  room_type: string | null;
  condition: string | null;
  area_m2: number | null;
  attributes: Record<string, unknown>;
}

export const FACILITY_ROWS: EmisRowTemplate[] = [
  { code: 'CS.00', label: 'Tổng số phòng', unit: 'Phòng' },
  ...ROOM_BLOCKS.flatMap((block, blockIndex) => [
    { code: `CS.${blockIndex + 1}`, label: block.label, unit: 'Phòng' },
    ...ROOM_TYPES.filter((type) => type.block === block.value).map((type, typeIndex) => ({
      code: `CS.${blockIndex + 1}.${String(typeIndex + 1).padStart(2, '0')}`,
      label: `– ${type.label}`,
      unit: 'Phòng',
    })),
  ]),
];

function conditionValues(rooms: FacilityRoom[]): EmisValues {
  const count = (condition: string) => rooms.filter((room) => room.condition === condition).length;
  return {
    total: rooms.length,
    permanent: count('permanent'),
    semi_permanent: count('semi_permanent'),
    temporary: count('temporary'),
    borrowed: count('borrowed'),
    area_m2: round2(rooms.reduce((sum, room) => sum + (room.area_m2 ?? 0), 0)),
  };
}

export function fillFacilities(rooms: FacilityRoom[]): Record<string, EmisValues> {
  const result: Record<string, EmisValues> = { 'CS.00': conditionValues(rooms) };
  ROOM_BLOCKS.forEach((block, blockIndex) => {
    const types = ROOM_TYPES.filter((type) => type.block === block.value);
    result[`CS.${blockIndex + 1}`] = conditionValues(
      rooms.filter((room) => types.some((type) => type.value === room.room_type)),
    );
    types.forEach((type, typeIndex) => {
      result[`CS.${blockIndex + 1}.${String(typeIndex + 1).padStart(2, '0')}`] = conditionValues(
        rooms.filter((room) => room.room_type === type.value),
      );
    });
  });
  return result;
}

export const TOILET_ROWS: EmisRowTemplate[] = [
  { code: 'VS.01', label: 'Phòng vệ sinh (khai báo ở 1.1)', unit: 'Phòng' },
  { code: 'VS.02', label: 'Phòng sinh hoạt chung có vệ sinh khép kín', unit: 'Phòng' },
  { code: 'VS.03', label: 'Phòng sinh hoạt chung có vệ sinh liền kề', unit: 'Phòng' },
  { code: 'VS.04', label: 'Phòng sinh hoạt chung chưa có vệ sinh khép kín, liền kề', unit: 'Phòng' },
  { code: 'VS.05', label: 'Nhà vệ sinh dành cho giáo viên, nhân viên', unit: 'Phòng' },
  { code: 'VS.06', label: 'Nhà vệ sinh đạt chuẩn', unit: 'Phòng' },
];

// VS.05, VS.06 nhập tay (1.1 chưa có thông tin này)
export function fillToilets(rooms: FacilityRoom[]): Record<string, EmisValues> {
  const groupRooms = rooms.filter((room) => room.room_type === 'group_room');
  const withToilet = (kind: string) => groupRooms.filter((room) => room.attributes.toilet === kind);
  const others = groupRooms.filter((room) => room.attributes.toilet !== 'ensuite' && room.attributes.toilet !== 'adjacent');
  return {
    'VS.01': conditionValues(rooms.filter((room) => room.room_type === 'toilet')),
    'VS.02': conditionValues(withToilet('ensuite')),
    'VS.03': conditionValues(withToilet('adjacent')),
    'VS.04': conditionValues(others),
  };
}

export const OTHER_FACILITY_ROWS: EmisRowTemplate[] = [
  { code: 'KH.01', label: 'Diện tích đất', unit: 'm²' },
  { code: 'KH.02', label: 'Diện tích xây dựng', unit: 'm²' },
  { code: 'KH.03', label: 'Phòng có sân chơi riêng', unit: 'Phòng' },
  { code: 'KH.04', label: 'Phòng có sân vườn khám phá', unit: 'Phòng' },
  { code: 'KH.05', label: 'Phòng học kết hợp nghỉ trưa', unit: 'Phòng' },
  { code: 'KH.06', label: 'Số chỗ ngủ', unit: 'Chỗ' },
  { code: 'KH.07', label: 'Số chỗ nhà ăn', unit: 'Chỗ' },
  { code: 'KH.08', label: 'Số chỗ thư viện', unit: 'Chỗ' },
  { code: 'KH.09', label: 'Phòng đọc, kho sách', unit: 'Phòng' },
];

const numberOf = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function fillOtherFacilities(rooms: FacilityRoom[], general: Record<string, unknown>): Record<string, EmisValues> {
  const flagged = (key: string) => rooms.filter((room) => room.attributes[key] === true).length;
  const sum = (key: string) => rooms.reduce((total, room) => total + (numberOf(room.attributes[key]) ?? 0), 0);
  const total = (value: number | null) => ({ total: value });
  return {
    'KH.01': total(numberOf(general.land_area_m2)),
    'KH.02': total(numberOf(general.building_area_m2)),
    'KH.03': total(flagged('has_private_playground')),
    'KH.04': total(flagged('has_discovery_garden')),
    'KH.05': total(flagged('combined_nap')),
    'KH.06': total(sum('sleeping_places')),
    'KH.07': total(sum('dining_seats')),
    'KH.08': total(sum('library_seats')),
    'KH.09': total(rooms.filter((room) => room.attributes.has_reading_room === true || room.attributes.has_book_storage === true).length),
  };
}

export const EQUIPMENT_ROWS: EmisRowTemplate[] = [
  { code: 'TB.00', label: 'Toàn trường', unit: 'Nhóm, lớp' },
  ...EQUIPMENT_AGE_GROUPS.map((group, index) => ({
    code: `TB.${String(index + 1).padStart(2, '0')}`,
    label: group.label,
    unit: 'Nhóm, lớp',
  })),
];

// Nhóm, lớp đủ thiết bị tối thiểu: tỷ lệ đáp ứng của lớp đạt 100%; thiết bị đủ định mức: không thiếu
export function fillEquipment(report: EquipmentReport): Record<string, EmisValues> {
  const minimum = report.rows.filter((row) => row.is_minimum);
  const values = (ageGroup: string | null): EmisValues => {
    const classes = report.classes.filter((row) => ageGroup === null || row.age_group === ageGroup);
    const items = minimum.filter((row) => ageGroup === null || row.age_group === ageGroup);
    const norm = classes.reduce((sum, row) => sum + row.norm, 0);
    const covered = classes.reduce((sum, row) => sum + row.covered, 0);
    return {
      classes: classes.length,
      equipped_classes: classes.filter((row) => row.rate_percent !== null && row.rate_percent >= 100).length,
      items: items.length,
      met_items: items.filter((row) => (row.shortage ?? 0) === 0).length,
      rate_percent: norm > 0 ? Math.round((covered / norm) * 1000) / 10 : null,
    };
  };
  const result: Record<string, EmisValues> = { 'TB.00': values(null) };
  EQUIPMENT_AGE_GROUPS.forEach((group, index) => {
    result[`TB.${String(index + 1).padStart(2, '0')}`] = values(group.value);
  });
  return result;
}

export const FACILITY_INFO_ROWS: EmisRowTemplate[] = [
  { code: 'TT.01', label: 'Có điện lưới (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.02', label: 'Có nước sạch (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.03', label: 'Có kết nối internet (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.04', label: 'Có bếp ăn tại trường (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.05', label: 'Có công trình vệ sinh riêng theo giới (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.06', label: 'Đủ đồ chơi ngoài trời tối thiểu (1 có, 0 không)', unit: 'Có/không' },
  { code: 'TT.07', label: 'Số máy tính dùng cho quản lý', unit: 'Máy' },
  { code: 'TT.08', label: 'Số máy chiếu', unit: 'Máy' },
  { code: 'TT.09', label: 'Số ti vi thông minh', unit: 'Chiếc' },
];

export function fillFacilityInfo(
  otherInfo: Record<string, unknown>,
  itInfrastructure: Record<string, unknown>,
): Record<string, EmisValues> {
  const flag = (key: string) => ({ total: otherInfo[key] === true ? 1 : otherInfo[key] === false ? 0 : null });
  const count = (key: string) => ({ total: numberOf(itInfrastructure[key]) });
  return {
    'TT.01': flag('grid_electricity'),
    'TT.02': flag('clean_water'),
    'TT.03': flag('has_internet'),
    'TT.04': flag('onsite_kitchen'),
    'TT.05': flag('gender_separated_toilets'),
    'TT.06': flag('minimum_outdoor_toys'),
    'TT.07': count('management_computers'),
    'TT.08': count('projectors'),
    'TT.09': count('smart_tvs'),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2.2 Báo cáo đội ngũ: tổng hợp chung, ngoại ngữ – tin học, chuẩn nghề nghiệp (khảo sát mục 5, dòng 2.2). Nhân sự đang
// làm việc; trình độ, ngoại ngữ, tin học đọc từ hồ sơ theo mẫu của Bộ (mục 3.1.1); chuẩn nghề nghiệp là phiếu đã chốt
export interface StaffReportMember extends PersonFacts {
  position_group: string | null;
  job_title: string | null;
  party_member: boolean;
  qualification: string | null;
  main_foreign_language: string | null;
  language_certificate_type: string | null;
  language_framework_level: string | null;
  language_training_level: string | null;
  it_level: string | null;
}

export interface StaffReportEvaluation {
  standard_type: 'principal' | 'teacher';
  overall_level: 'not_met' | 'met' | 'good' | 'excellent' | null;
}

const STAFF_GROUPS: Array<{ code: string; label: string; category: 'manager' | 'teacher' | 'employee' | null }> = [
  { code: '01', label: 'Tổng số cán bộ quản lý, giáo viên, nhân viên', category: null },
  { code: '02', label: 'Cán bộ quản lý', category: 'manager' },
  { code: '03', label: 'Giáo viên', category: 'teacher' },
  { code: '04', label: 'Nhân viên', category: 'employee' },
];

export function qualificationLevel(
  qualification: string | null,
): 'postgraduate' | 'university' | 'college' | 'intermediate' | 'other_qualification' {
  const value = normalize(qualification);
  if (value.includes('tiến sĩ') || value.includes('thạc sĩ') || value.includes('sau đại học')) {
    return 'postgraduate';
  }
  if (value.includes('đại học')) {
    return 'university';
  }
  if (value.includes('cao đẳng')) {
    return 'college';
  }
  if (value.includes('trung cấp')) {
    return 'intermediate';
  }
  return 'other_qualification';
}

export function hasForeignLanguage(member: StaffReportMember): boolean {
  return [
    member.main_foreign_language,
    member.language_certificate_type,
    member.language_framework_level,
    member.language_training_level,
  ].some(present);
}

export function isEnglish(member: StaffReportMember): boolean {
  const text = `${normalize(member.main_foreign_language)} ${normalize(member.language_certificate_type)}`;
  return /anh|english|toeic|ielts|toefl/.test(text);
}

// Bậc 3 trở lên theo Khung năng lực ngoại ngữ 6 bậc (B1, B2, C1, C2 tương đương bậc 3–6)
export function frameworkLevelAtLeast3(member: StaffReportMember): boolean {
  const text = normalize(member.language_framework_level);
  const step = /bậc\s*([1-6])/.exec(text)?.[1] ?? /^([1-6])$/.exec(text)?.[1];
  if (step) {
    return Number(step) >= 3;
  }
  return /\b(b1|b2|c1|c2)\b/.test(text);
}

export function buildStaffReport(
  ownership: SchoolOwnershipType | null,
  staff: StaffReportMember[],
  evaluations: StaffReportEvaluation[],
): { general: EmisFormRow[]; skills: EmisFormRow[]; standards: EmisFormRow[] } {
  const groups = STAFF_GROUPS.map((group) => ({
    ...group,
    members: group.category === null ? staff : staff.filter((member) => staffCategory(member) === group.category),
  }));
  const general = groups.map((group) => {
    const base = populationRow(ownership, { code: `DN.${group.code}`, label: group.label, unit: 'Người' }, group.members);
    const levels = group.members.map((member) => qualificationLevel(member.qualification));
    const count = (level: string) => levels.filter((value) => value === level).length;
    return {
      ...base,
      values: {
        total: base.values.total ?? 0,
        female: base.values.female ?? 0,
        ethnic_minority: base.values.ethnic_minority ?? 0,
        party_member: group.members.filter((member) => member.party_member).length,
        postgraduate: count('postgraduate'),
        university: count('university'),
        college: count('college'),
        intermediate: count('intermediate'),
        other_qualification: count('other_qualification'),
      },
    };
  });
  const skills = groups.map((group) => {
    const languages = group.members.filter(hasForeignLanguage);
    return {
      code: `NN.${group.code}`,
      label: group.label,
      unit: 'Người',
      values: {
        total: group.members.length,
        foreign_language: languages.length,
        english: languages.filter(isEnglish).length,
        framework_level_3: group.members.filter(frameworkLevelAtLeast3).length,
        it: group.members.filter((member) => present(member.it_level)).length,
        it_advanced: group.members.filter((member) => normalize(member.it_level).includes('nâng cao')).length,
      },
    };
  });
  const standardRow = (code: string, label: string, type: 'principal' | 'teacher'): EmisFormRow => {
    const own = evaluations.filter((evaluation) => evaluation.standard_type === type && evaluation.overall_level);
    const count = (level: string) => own.filter((evaluation) => evaluation.overall_level === level).length;
    return {
      code,
      label,
      unit: 'Người',
      values: {
        evaluated: own.length,
        not_met: count('not_met'),
        met: count('met'),
        good: count('good'),
        excellent: count('excellent'),
      },
    };
  };
  return {
    general,
    skills,
    standards: [
      standardRow('CN.01', 'Cán bộ quản lý (chuẩn hiệu trưởng)', 'principal'),
      standardRow('CN.02', 'Giáo viên (chuẩn nghề nghiệp giáo viên)', 'teacher'),
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2.1 Báo cáo EMIS cuối năm, thẻ II Học sinh và IV Kết quả giáo dục
export interface YearChild extends PersonFacts {
  status: string;
  nursery: boolean;
  disabled: boolean;
  five_to_six: boolean;
  // Hoàn thành chương trình giáo dục mầm non (mục 4.4), chỉ có ở trẻ 5–6 tuổi
  completion: 'completed' | 'not_completed' | null;
}

export function buildEndOfYearChildren(
  ownership: SchoolOwnershipType | null,
  children: YearChild[],
  transfersIn: PersonFacts[],
  transfersOut: PersonFacts[],
): EmisFormRow[] {
  const active = children.filter((child) => child.status === 'active');
  const left = children.filter((child) => child.status === 'withdrawn');
  const row = (code: string, label: string, members: PersonFacts[]) =>
    populationRow(ownership, { code, label, unit: 'Học sinh' }, members);
  return [
    row('II.01', 'Học sinh cuối năm (đang học)', active),
    row('II.02', 'Trong đó: nhà trẻ', active.filter((child) => child.nursery)),
    row('II.03', 'Trong đó: mẫu giáo', active.filter((child) => !child.nursery)),
    row('II.04', 'Trong đó: học sinh khuyết tật học hòa nhập', active.filter((child) => child.disabled)),
    row('II.05', 'Học sinh nhận chuyển đến trong năm', transfersIn),
    row('II.06', 'Học sinh chuyển đi trong năm (có hồ sơ chuyển trường)', transfersOut),
    row('II.07', 'Học sinh thôi học, nghỉ học trong năm', left),
  ];
}

export function buildEducationResults(ownership: SchoolOwnershipType | null, children: YearChild[]): EmisFormRow[] {
  const fiveToSix = children.filter((child) => child.status === 'active' && child.five_to_six);
  const row = (code: string, label: string, members: PersonFacts[]) =>
    populationRow(ownership, { code, label, unit: 'Học sinh' }, members);
  return [
    row('IV.01', 'Học sinh mẫu giáo 5–6 tuổi', fiveToSix),
    row(
      'IV.02',
      'Hoàn thành chương trình giáo dục mầm non',
      fiveToSix.filter((child) => child.completion === 'completed'),
    ),
    row(
      'IV.03',
      'Chưa hoàn thành chương trình giáo dục mầm non',
      fiveToSix.filter((child) => child.completion === 'not_completed'),
    ),
    row('IV.04', 'Chưa đánh giá', fiveToSix.filter((child) => child.completion === null)),
  ];
}

// Đổi mã số các dòng của một thẻ sang tiền tố của biểu (ví dụ Biểu 1 dùng 1.01, biểu cuối năm dùng I.01)
export function recode(rows: EmisFormRow[], prefix: string): EmisFormRow[] {
  return rows.map((row) => ({ ...row, code: `${prefix}.${row.code.split('.').pop()}` }));
}
