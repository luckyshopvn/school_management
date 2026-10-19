import { foldCatalogText, type ClassAgeGroupKey, type SchoolOwnershipType } from '@school-management/shared';
import type { EmisValues } from '@school-management/database';
import { isEthnicMinority } from '../facilities/emis-calc.js';
import type { EmisFormRow, EmisRowTemplate } from './emis-form-calc.js';

// Biểu 01.ĐN-MN và Biểu 08.ĐN-NSNN của 1.1.1 Lập báo cáo đầu năm theo đúng tên chỉ tiêu, mã số, đơn vị, cột của Sở (DT-17
// phần 17a, YCTD-132; khảo sát mục 10.4.2). Hàm thuần, không đọc cơ sở dữ liệu. Quy tắc (Claude tự chọn theo ủy quyền của
// Eric ngày 2026-10-11):
// - cột công lập, tư thục, dân lập của thẻ 1: cả số của trường vào cột theo loại hình trong hồ sơ trường;
// - trường thuộc khối nhà trẻ, trường mẫu giáo hay trường mầm non theo ô "Cơ sở giáo dục mầm non" của hồ sơ trường; tiêu chí
//   trường (điện, internet, máy tính, nước uống, vệ sinh, rửa tay, chương trình giới tính, phòng chống thiên tai, chuẩn quốc
//   gia) theo thẻ Thông tin khác và Thông tin chung của hồ sơ trường;
// - nhóm trẻ hay lớp mẫu giáo, nhóm tuổi theo lớp (15b), lớp ghép 2, 3 độ tuổi theo số độ tuổi ghép của lớp;
// - tuổi = năm bắt đầu năm học − năm sinh như Biểu 1 cũ; trẻ nhà trẻ hay mẫu giáo theo lớp đang học, chưa có lớp thì dưới 3
//   tuổi là nhà trẻ;
// - dinh dưỡng: số đo gần nhất của các đợt cân đo thuộc học kỳ I, đánh giá theo chuẩn WHO như mục 4.3; còi cọc là gầy còm
//   (cân nặng theo chiều cao), thừa cân, béo phì gộp một dòng;
// - đội ngũ: nhân sự đang làm việc; cán bộ quản lý ở khối nhà trẻ khi trường là nhà trẻ, còn lại ở khối mẫu giáo, mầm non;
//   giáo viên nhà trẻ theo vị trí việc làm (danh mục Bộ, 16f), không có thì theo ô "Dạy nhóm lớp", không có nữa thì theo
//   loại trường; nhân viên theo vị trí việc làm, không có thì theo tên chức danh;
// - phòng: phòng đang dùng; phòng học của nhóm trẻ là phòng gắn với lớp nhóm trẻ, phòng khác thuộc khối theo loại trường;
// - chỉ tiêu cơ sở độc lập, lớp giáo dục chuyên biệt: hệ thống chỉ quản lý một trường nên để 0.
// Dòng không có dữ liệu để 0 và ghi lý do ở danh sách cảnh báo
export type InstitutionType = 'truong_mam_non' | 'truong_mau_giao' | 'nha_tre' | 'nhom_tre_doc_lap';

export interface Bieu01School {
  ownership: SchoolOwnershipType | null;
  institution_type: InstitutionType | null;
  // Thẻ Thông tin khác của hồ sơ trường
  other_info: Record<string, unknown>;
  national_standard_level: string | null;
  branches: number;
  sites: number;
}

export interface Bieu01Class {
  id: string;
  stage: 'nursery' | 'kindergarten' | null;
  age_group: ClassAgeGroupKey | null;
  mixed_age_count: number | null;
  room_id: string | null;
  two_sessions_per_day: boolean;
  boarding: boolean;
}

export interface Nutrition {
  weight_status: string | null;
  height_status: string | null;
  weight_height_status: string | null;
}

export interface Bieu01Child {
  gender: 'male' | 'female';
  ethnicity: string | null;
  birth_year: number;
  class_id: string | null;
  disabled: boolean;
  two_sessions_per_day: boolean;
  boarding: boolean;
  policy_benefits: string[];
  // Đánh giá dinh dưỡng của lần cân đo gần nhất học kỳ I; chưa cân đo là null
  nutrition: Nutrition | null;
}

export interface Bieu01Staff {
  gender: 'male' | 'female' | null;
  ethnicity: string | null;
  birth_year: number | null;
  category: 'manager' | 'teacher' | 'employee';
  job_title: string | null;
  job_position: string | null;
  teaching_group: string | null;
  qualification: string | null;
  rank: string | null;
  contract_form: string | null;
  concurrent_disability_support: boolean;
  concurrent_shared_position: boolean;
}

export interface Bieu01Room {
  id: string;
  room_type: string | null;
  condition: string | null;
  attributes: Record<string, unknown>;
}

export interface Bieu01Input {
  school: Bieu01School;
  startYear: number;
  classes: Bieu01Class[];
  children: Bieu01Child[];
  staff: Bieu01Staff[];
  rooms: Bieu01Room[];
}

export interface Bieu01Result {
  school_classes: EmisFormRow[];
  children: EmisFormRow[];
  staff: EmisFormRow[];
  rooms: EmisFormRow[];
  warnings: string[];
}

const fold = (value: string | null | undefined) => foldCatalogText(value ?? '');

// Dựng các dòng của một thẻ: dòng tiêu đề không có mã số (mã nội bộ "#n" để làm khóa), dòng chỉ tiêu có mã số của Sở
export class RowList {
  readonly rows: EmisFormRow[] = [];
  private headings = 0;

  heading(order: string, label: string): void {
    this.headings += 1;
    this.rows.push({ code: `#${this.headings}`, order, label, unit: '', heading: true, values: {} });
  }

  add(order: string, label: string, code: string, unit: string, values: EmisValues): void {
    this.rows.push({ code, order, label, unit, values });
  }
}

export const isHeading = (row: { heading?: boolean }) => row.heading === true;

// Dòng mẫu (không số liệu) của thẻ nhập tay
export function templates(rows: EmisFormRow[]): EmisRowTemplate[] {
  return rows.map((row) => {
    const { values, ...template } = row;
    void values;
    return template;
  });
}

const code2 = (value: number) => String(value).padStart(2, '0');

// ---------------------------------------------------------------------------------------------------------------------
// Phân loại dùng chung của Biểu 01, 2.1, 2.2

export type QualificationLevel =
  'intermediate' | 'college' | 'university' | 'master' | 'doctor' | 'untrained' | 'other';

export function qualificationOf(text: string | null): QualificationLevel {
  const value = fold(text);
  if (value.includes('tien si')) {
    return 'doctor';
  }
  if (value.includes('thac si')) {
    return 'master';
  }
  if (value.includes('dai hoc')) {
    return 'university';
  }
  if (value.includes('cao dang')) {
    return 'college';
  }
  if (value.includes('trung cap')) {
    return 'intermediate';
  }
  if (value.includes('chua qua dao tao')) {
    return 'untrained';
  }
  return 'other';
}

// Hạng chức danh nghề nghiệp ghi ở ô "Ngạch/Hạng": số hạng (I đến IV) và hạng theo Thông tư 01/2021/TT-BGDĐT hay hạng cũ
export function rankOf(text: string | null): { level: 1 | 2 | 3 | 4; tt01: boolean } | null {
  const value = fold(text);
  const match = /hang\s*(iv|iii|ii|i|4|3|2|1)\b/.exec(value);
  if (!match) {
    return null;
  }
  const roman: Record<string, 1 | 2 | 3 | 4> = { i: 1, ii: 2, iii: 3, iv: 4, '1': 1, '2': 2, '3': 3, '4': 4 };
  return { level: roman[match[1] ?? ''] ?? 1, tt01: /tt\s*0?1\b|01\/2021/.test(value) };
}

// Hình thức hợp đồng (danh mục Bộ, 16f) sang bốn cột phân loại của thẻ Đội ngũ
export function contractOf(text: string | null): 'indefinite' | 'fixed_term' | 'labor' | null {
  const value = fold(text);
  if (value === '') {
    return null;
  }
  if (value.startsWith('vien chuc')) {
    return value.includes('khong xac dinh') ? 'indefinite' : 'fixed_term';
  }
  return 'labor';
}

export type EmployeeRole =
  | 'clerk'
  | 'accountant'
  | 'treasurer'
  | 'librarian'
  | 'medical'
  | 'cook'
  | 'service'
  | 'guard'
  | 'disability_support'
  | 'other';

// Vị trí việc làm của nhân viên: theo danh mục Bộ (16f), không có thì theo tên chức danh
export function employeeRoleOf(member: Pick<Bieu01Staff, 'job_position' | 'job_title'>): EmployeeRole {
  const value = fold(member.job_position) || fold(member.job_title);
  const rules: Array<[string, EmployeeRole]> = [
    ['khuyet tat', 'disability_support'],
    ['van thu', 'clerk'],
    ['ke toan', 'accountant'],
    ['thu quy', 'treasurer'],
    ['thu vien', 'librarian'],
    ['y te', 'medical'],
    ['nau an', 'cook'],
    ['cap duong', 'cook'],
    ['bao mau', 'service'],
    ['phuc vu', 'service'],
    ['bao ve', 'guard'],
  ];
  return rules.find(([text]) => value.includes(text))?.[1] ?? 'other';
}

const SHARED_ROLES: EmployeeRole[] = ['clerk', 'accountant', 'treasurer', 'librarian', 'medical'];

export function isPrincipal(member: Pick<Bieu01Staff, 'job_title' | 'job_position'>): 'principal' | 'vice' | null {
  const value = `${fold(member.job_title)} ${fold(member.job_position)}`;
  if (value.includes('pho hieu truong')) {
    return 'vice';
  }
  return value.includes('hieu truong') ? 'principal' : null;
}

// Giáo viên dạy nhóm trẻ (nhà trẻ)
export function teachesNursery(
  member: Pick<Bieu01Staff, 'job_position' | 'teaching_group'>,
  institution: InstitutionType | null,
): boolean {
  const position = fold(member.job_position);
  if (position.includes('nha tre')) {
    return true;
  }
  if (position.includes('mau giao')) {
    return false;
  }
  const group = fold(member.teaching_group);
  if (group.includes('nha tre') || group.includes('nhom tre')) {
    return true;
  }
  if (group.includes('mau giao')) {
    return false;
  }
  return institution === 'nha_tre';
}

// ---------------------------------------------------------------------------------------------------------------------

function ownershipValues(ownership: SchoolOwnershipType | null, total: number): EmisValues {
  const by = (type: SchoolOwnershipType) => (ownership === null ? null : ownership === type ? total : 0);
  return { total, public: by('public'), private: by('private'), people_founded: by('people_founded') };
}

function childValues(children: Bieu01Child[]): EmisValues {
  const ethnic = children.filter((child) => isEthnicMinority(child.ethnicity));
  return {
    total: children.length,
    female: children.filter((child) => child.gender === 'female').length,
    ethnic_total: ethnic.length,
    ethnic_female: ethnic.filter((child) => child.gender === 'female').length,
  };
}

function staffValues(staff: Bieu01Staff[]): EmisValues {
  const contracts = staff.map((member) => contractOf(member.contract_form));
  const count = (kind: string) => contracts.filter((value) => value === kind).length;
  return {
    total: staff.length,
    female: staff.filter((member) => member.gender === 'female').length,
    ethnic: staff.filter((member) => isEthnicMinority(member.ethnicity)).length,
    civil_servant: count('indefinite') + count('fixed_term'),
    labor_contract: count('labor'),
    indefinite_contract: count('indefinite'),
    fixed_term_contract: count('fixed_term'),
  };
}

function roomValues(rooms: Bieu01Room[]): EmisValues {
  const count = (condition: string) => rooms.filter((room) => room.condition === condition).length;
  return {
    total: rooms.length,
    permanent: count('permanent'),
    semi_permanent: count('semi_permanent'),
    temporary: count('temporary'),
  };
}

export function buildBieu01(input: Bieu01Input): Bieu01Result {
  const { school, startYear } = input;
  const warnings: string[] = [];
  const own = (total: number) => ownershipValues(school.ownership, total);
  const flag = (key: string) => (school.other_info[key] === true ? 1 : 0);
  const institution = school.institution_type;

  // Thẻ 1. Trường – Lớp
  const first = new RowList();
  const isSchool = institution !== null && institution !== 'nhom_tre_doc_lap';
  first.heading('I.', 'Cơ sở giáo dục mầm non');
  first.add('1.1.', 'Trường', '01', 'trường', own(isSchool ? 1 : 0));
  const nursery = institution === 'nha_tre' ? 1 : 0;
  first.add('1.1.1.', 'Nhà trẻ', '02', 'trường', own(nursery));
  const nurseryCriteria: Array<[string, string]> = [
    ['grid_electricity', 'Trường có điện'],
    ['has_internet', 'Trường được kết nối internet'],
    ['has_computers', 'Trường có sử dụng máy vi tính phục vụ quản lý và giáo dục trẻ'],
    ['drinking_water', 'Trường có nước uống'],
    ['gender_separated_toilets', 'Trường có hệ thống vệ sinh tiện lợi'],
    ['handwashing', 'Trường có chỗ rửa tay thuận tiện'],
  ];
  nurseryCriteria.forEach(([key, label], index) => {
    first.add('', `– ${label}`, code2(3 + index), 'trường', own(nursery * flag(key)));
  });
  const standard = (level: string) => (school.national_standard_level === level ? 1 : 0);
  const schoolBlock = (order: string, label: string, start: number, applies: boolean) => {
    const value = applies ? 1 : 0;
    first.add(order, label, code2(start), 'trường', own(value));
    const items: Array<[string, number]> = [
      ['Trường đạt chuẩn quốc gia mức độ 1', standard('1')],
      ['Trường đạt chuẩn quốc gia mức độ 2', standard('2')],
      ['Trường có lớp giáo dục chuyên biệt', 0],
      ['Trường có điện', flag('grid_electricity')],
      ['Trường được kết nối internet', flag('has_internet')],
      ['Trường có sử dụng máy vi tính phục vụ quản lý và giáo dục trẻ', flag('has_computers')],
      ['Trường có nước uống', flag('drinking_water')],
      ['Trường có hệ thống vệ sinh tiện lợi và riêng rẽ cho từng giới tính', flag('gender_separated_toilets')],
      ['Trường có chỗ rửa tay thuận tiện (bao gồm nước và xà phòng)', flag('handwashing')],
      ['Trường có chương trình giáo dục cơ bản về giới tính, phòng chống bạo lực, xâm hại', flag('sex_education')],
      ['Trường có kế hoạch giáo dục phòng, chống thiên tai và ứng phó biến đổi khí hậu', flag('disaster_prevention')],
    ];
    items.forEach(([text, count], index) => {
      first.add('', `– ${text}`, code2(start + 1 + index), 'trường', own(value * count));
    });
  };
  schoolBlock('1.1.2.', 'Trường mẫu giáo', 9, institution === 'truong_mau_giao');
  schoolBlock('1.1.3.', 'Trường mầm non', 21, institution === 'truong_mam_non');
  const independent = institution === 'nhom_tre_doc_lap';
  const smallGroup = independent && input.children.length <= 7 ? 1 : 0;
  first.add('1.2.', 'Cơ sở giáo dục mầm non độc lập', '33', 'cơ sở', own(independent ? 1 : 0));
  first.add('1.2.1.', 'Nhóm trẻ độc lập quy mô tối đa 7 trẻ', '34', 'cơ sở', own(smallGroup));
  first.add('1.2.2.', 'Nhóm trẻ độc lập quy mô trên 7 trẻ', '35', 'cơ sở', own(independent ? 1 - smallGroup : 0));
  first.add('1.2.3.', 'Lớp mẫu giáo độc lập', '36', 'cơ sở', own(0));
  first.add('1.2.4.', 'Lớp mầm non độc lập', '37', 'cơ sở', own(0));
  first.add('1.3.', 'Số phân hiệu', '38', 'cơ sở', own(school.branches));
  first.add('1.4.', 'Số điểm trường', '39', 'điểm', own(school.sites));

  const classesOf = (stage: 'nursery' | 'kindergarten') => input.classes.filter((item) => item.stage === stage);
  const disabledByClass = new Map<string, number>();
  for (const child of input.children) {
    if (child.disabled && child.class_id) {
      disabledByClass.set(child.class_id, (disabledByClass.get(child.class_id) ?? 0) + 1);
    }
  }
  const withDisabled = (classes: Bieu01Class[], count: 1 | 2) =>
    classes.filter((item) =>
      count === 1 ? disabledByClass.get(item.id) === 1 : (disabledByClass.get(item.id) ?? 0) >= 2,
    ).length;
  const nurseryClasses = classesOf('nursery');
  const kindergartenClasses = classesOf('kindergarten');
  const byAge = (classes: Bieu01Class[], age: ClassAgeGroupKey) =>
    classes.filter((item) => item.age_group === age).length;
  const mixed = (classes: Bieu01Class[], count: number) =>
    classes.filter((item) => item.mixed_age_count === count).length;
  first.heading('II.', 'Nhóm, lớp');
  first.add('2.', 'Tổng số Nhóm/lớp', '40', 'nhóm/lớp', own(nurseryClasses.length + kindergartenClasses.length));
  first.add('2.1.', 'Nhóm trẻ', '41', 'nhóm', own(nurseryClasses.length));
  const nurseryRows: Array<[string, number]> = [
    ['Nhóm trẻ 3–12 tháng', byAge(nurseryClasses, 'months_3_12')],
    ['Nhóm trẻ 13–24 tháng', byAge(nurseryClasses, 'months_13_24')],
    ['Nhóm trẻ 25–36 tháng', byAge(nurseryClasses, 'months_25_36')],
    ['Nhóm trẻ ghép 2 độ tuổi', mixed(nurseryClasses, 2)],
    ['Nhóm trẻ ghép 3 độ tuổi', mixed(nurseryClasses, 3)],
    ['Nhóm trẻ độc lập quy mô tối đa 7 trẻ', 0],
    ['Nhóm trẻ độc lập quy mô trên 7 trẻ', 0],
    ['Nhóm trẻ có 01 trẻ khuyết tật học hòa nhập', withDisabled(nurseryClasses, 1)],
    ['Nhóm trẻ có 02 trẻ khuyết tật học hòa nhập', withDisabled(nurseryClasses, 2)],
  ];
  nurseryRows.forEach(([label, count], index) => first.add('', `– ${label}`, code2(42 + index), 'nhóm', own(count)));
  first.add('2.2.', 'Lớp mẫu giáo', '51', 'lớp', own(kindergartenClasses.length));
  const kindergartenRows: Array<[string, number]> = [
    ['Lớp mẫu giáo 3–4 tuổi', byAge(kindergartenClasses, 'years_3_4')],
    ['Lớp mẫu giáo 4–5 tuổi', byAge(kindergartenClasses, 'years_4_5')],
    ['Lớp mẫu giáo 5–6 tuổi (lớp MG 5 tuổi)', byAge(kindergartenClasses, 'years_5_6')],
    ['Lớp giáo dục chuyên biệt', 0],
    ['Lớp mẫu giáo ghép 2 độ tuổi', mixed(kindergartenClasses, 2)],
    ['Lớp mẫu giáo ghép 3 độ tuổi', mixed(kindergartenClasses, 3)],
    ['Lớp mẫu giáo độc lập', 0],
    ['Lớp mầm non độc lập', 0],
    ['Lớp có 01 trẻ khuyết tật học hòa nhập', withDisabled(kindergartenClasses, 1)],
    ['Lớp có 02 trẻ khuyết tật học hòa nhập', withDisabled(kindergartenClasses, 2)],
  ];
  kindergartenRows.forEach(([label, count], index) =>
    first.add('', `– ${label}`, code2(52 + index), 'lớp', own(count)),
  );
  if (institution === null) {
    warnings.push(
      'Chưa chọn "Cơ sở giáo dục mầm non" ở thẻ Thông tin chung của hồ sơ trường: thẻ Trường – Lớp để 0 các dòng nhà trẻ, trường mẫu giáo, trường mầm non',
    );
  }
  const unstaged = input.classes.filter((item) => item.stage === null).length;
  if (unstaged > 0) {
    warnings.push(`${unstaged} nhóm, lớp chưa xếp được nhóm tuổi: không tính vào thẻ Trường – Lớp`);
  }

  // Thẻ 2. Trẻ em
  const classById = new Map(input.classes.map((item) => [item.id, item]));
  const childClass = (child: Bieu01Child) => (child.class_id ? classById.get(child.class_id) : undefined);
  const isNursery = (child: Bieu01Child) => {
    const stage = childClass(child)?.stage;
    return stage ? stage === 'nursery' : startYear - child.birth_year < 3;
  };
  const twoSessions = (child: Bieu01Child) => child.two_sessions_per_day || childClass(child)?.two_sessions_per_day;
  const boarding = (child: Bieu01Child) => child.boarding || childClass(child)?.boarding;
  const nurseryChildren = input.children.filter(isNursery);
  const kindergartenChildren = input.children.filter((child) => !isNursery(child));
  const second = new RowList();
  second.add('3.1.', 'Quy mô trẻ', '62', 'người', childValues(input.children));
  second.add('3.1.1.', 'Trẻ em nhà trẻ', '63', 'người', childValues(nurseryChildren));
  const scaleRows = (children: Bieu01Child[], start: number, kindergarten: boolean) => {
    const rows: Array<[string, Bieu01Child[]]> = [
      ['Học 2 buổi/ngày', children.filter(twoSessions)],
      ['Bán trú (có tổ chức ăn trưa)', children.filter(boarding)],
      ['Khuyết tật học hòa nhập', children.filter((child) => child.disabled)],
      ...(kindergarten ? ([['Khuyết tật học lớp giáo dục chuyên biệt', []]] as Array<[string, Bieu01Child[]]>) : []),
      [
        kindergarten
          ? 'Học trong lớp mẫu giáo độc lập, lớp mầm non độc lập'
          : 'Học trong nhóm trẻ độc lập, lớp mầm non độc lập',
        [],
      ],
      ...(kindergarten
        ? ([
            ['Học trong lớp mẫu giáo 5 tuổi', children.filter((child) => childClass(child)?.age_group === 'years_5_6')],
          ] as Array<[string, Bieu01Child[]]>)
        : []),
    ];
    rows.forEach(([label, members], index) =>
      second.add('', `– ${label}`, code2(start + index), 'người', childValues(members)),
    );
  };
  scaleRows(nurseryChildren, 64, false);
  second.add('3.1.2.', 'Trẻ em mẫu giáo', '68', 'người', childValues(kindergartenChildren));
  scaleRows(kindergartenChildren, 69, true);
  const ageOf = (child: Bieu01Child) => Math.max(0, startYear - child.birth_year);
  const aged = (children: Bieu01Child[], test: (age: number) => boolean) =>
    childValues(children.filter((child) => test(ageOf(child))));
  second.heading('3.2.', 'Quy mô trẻ chia theo độ tuổi');
  second.add('3.2.1.', 'Trẻ em nhà trẻ', '75', 'người', childValues(nurseryChildren));
  const nurseryAges: Array<[string, (age: number) => boolean]> = [
    ['03–12 tháng (dưới 1 tuổi)', (age) => age === 0],
    ['13–24 tháng (dưới 2 tuổi)', (age) => age === 1],
    ['25–36 tháng (dưới 3 tuổi)', (age) => age === 2],
    ['3 tuổi', (age) => age === 3],
    ['4 tuổi', (age) => age === 4],
    ['5 tuổi', (age) => age === 5],
    ['Trên 5 tuổi', (age) => age > 5],
  ];
  nurseryAges.forEach(([label, test], index) =>
    second.add('', `– ${label}`, code2(76 + index), 'người', aged(nurseryChildren, test)),
  );
  second.add('3.2.2.', 'Trẻ em mẫu giáo', '83', 'người', childValues(kindergartenChildren));
  const kindergartenAges: Array<[string, (age: number) => boolean]> = [
    ['Dưới 2 tuổi', (age) => age < 2],
    ...[2, 3, 4, 5, 6, 7].map((year): [string, (age: number) => boolean] => [`${year} tuổi`, (age) => age === year]),
    ['Trên 7 tuổi', (age) => age > 7],
  ];
  kindergartenAges.forEach(([label, test], index) =>
    second.add('', `– ${label}`, code2(84 + index), 'người', aged(kindergartenChildren, test)),
  );
  second.add('3.2.3.', 'Tổng quy mô chia theo độ tuổi', '92', 'người', childValues(input.children));
  const totalAges: Array<[string, (age: number) => boolean]> = [
    ['Dưới 1 tuổi', (age) => age === 0],
    ['Dưới 2 tuổi', (age) => age === 1],
    ...[2, 3, 4, 5, 6, 7].map((year): [string, (age: number) => boolean] => [`${year} tuổi`, (age) => age === year]),
    ['Trên 7 tuổi', (age) => age > 7],
  ];
  totalAges.forEach(([label, test], index) =>
    second.add('', `– ${label}`, code2(93 + index), 'người', aged(input.children, test)),
  );
  second.heading('3.3.', 'Tình trạng dinh dưỡng trẻ em');
  const nutritionRows = (order: string, label: string, children: Bieu01Child[], start: number) => {
    const measured = children.filter((child) => child.nutrition !== null);
    const by = (test: (nutrition: Nutrition) => boolean) =>
      childValues(measured.filter((child) => child.nutrition !== null && test(child.nutrition)));
    second.add(order, label, code2(start), 'người', childValues(measured));
    second.add(
      '',
      '– Suy dinh dưỡng thể nhẹ cân',
      code2(start + 1),
      'người',
      by((n) => n.weight_status === 'underweight'),
    );
    second.add(
      '',
      '– Suy dinh dưỡng thể thấp còi',
      code2(start + 2),
      'người',
      by((n) => n.height_status === 'stunted'),
    );
    second.add(
      '',
      '– Suy dinh dưỡng thể còi cọc',
      code2(start + 3),
      'người',
      by((n) => n.weight_height_status === 'wasted'),
    );
    second.add(
      '',
      '– Thừa cân, béo phì',
      code2(start + 4),
      'người',
      by((n) => n.weight_height_status === 'overweight' || n.weight_height_status === 'obese'),
    );
  };
  nutritionRows(
    '3.3.1.',
    'Trẻ em nhà trẻ được kiểm tra sức khỏe và đánh giá tình trạng dinh dưỡng',
    nurseryChildren,
    102,
  );
  nutritionRows(
    '3.3.2.',
    'Trẻ em mẫu giáo được kiểm tra sức khỏe và đánh giá tình trạng dinh dưỡng',
    kindergartenChildren,
    107,
  );
  if (!input.children.some((child) => child.nutrition !== null)) {
    warnings.push('Chưa có số đo của đợt cân đo nào thuộc học kỳ I (mục 4.3.1): mục 3.3 Tình trạng dinh dưỡng để 0');
  }
  second.heading('3.4.', 'Trẻ em thuộc đối tượng chính sách (theo quy định của Chính phủ)');
  const policy: Array<[string, string]> = [
    ['nd238_learning_cost', 'Trẻ em mầm non được hỗ trợ chi phí học tập (Điều 17. NĐ 238/2025)'],
    ['nd66_nursery_boarding', 'Trẻ em nhà trẻ bán trú (NĐ 66/2025/NĐ-CP)'],
    ['nd57_small_ethnic', 'Trẻ em MG các dân tộc thiểu số rất ít người được hỗ trợ học tập (NĐ 57/2017/NĐ-CP)'],
    ['nd105_lunch', 'Trẻ em học MG được hỗ trợ ăn trưa (NĐ 105/2020/NĐ-CP)'],
    ['nd105_allowance', 'Trẻ em học MN được hưởng trợ cấp (NĐ 105/2020/NĐ-CP)'],
  ];
  policy.forEach(([value, label], index) =>
    second.add(
      '',
      `– ${label}`,
      String(112 + index),
      'người',
      childValues(input.children.filter((child) => child.policy_benefits.includes(value))),
    ),
  );

  // Thẻ 3. Đội ngũ
  const third = new RowList();
  const managers = input.staff.filter((member) => member.category === 'manager');
  const teachers = input.staff.filter((member) => member.category === 'teacher');
  const employees = input.staff.filter((member) => member.category === 'employee');
  const nurseryInstitution = institution === 'nha_tre';
  const qualificationRows = (members: Bieu01Staff[], start: number, withOther: boolean) => {
    const level = (value: QualificationLevel) =>
      members.filter((member) => qualificationOf(member.qualification) === value);
    const rows: Array<[string, Bieu01Staff[]]> = [
      ['Trung cấp sư phạm', level('intermediate')],
      ['Cao đẳng sư phạm, Cao đẳng GDMN', level('college')],
      ['Đại học sư phạm, Đại học GDMN', level('university')],
      ['Thạc sĩ', level('master')],
      ['Tiến sĩ, Tiến sĩ khoa học', level('doctor')],
      withOther
        ? ['Khác', members.filter((member) => ['untrained', 'other'].includes(qualificationOf(member.qualification)))]
        : ['Chưa qua đào tạo', level('untrained')],
    ];
    rows.forEach(([label, list], index) =>
      third.add('', `– ${label}`, String(start + index), 'người', staffValues(list)),
    );
  };
  third.add('4.1.', 'Cán bộ quản lý', '117', 'người', staffValues(managers));
  const managerBlock = (order: string, label: string, start: number, applies: boolean) => {
    const members = applies ? managers : [];
    third.add(order, label, String(start), 'người', staffValues(members));
    third.add(
      '',
      '– Hiệu trưởng',
      String(start + 1),
      'người',
      staffValues(members.filter((member) => isPrincipal(member) !== 'vice')),
    );
    third.add(
      '',
      '– Phó hiệu trưởng',
      String(start + 2),
      'người',
      staffValues(members.filter((member) => isPrincipal(member) === 'vice')),
    );
    qualificationRows(members, start + 3, true);
  };
  managerBlock('4.1.1.', 'Cán bộ quản lý nhà trẻ', 118, nurseryInstitution);
  managerBlock('4.1.2.', 'Cán bộ quản lý mẫu giáo, mầm non', 127, !nurseryInstitution);
  third.add('4.2.', 'Vị trí việc làm chức danh nghề nghiệp chuyên ngành', '136', 'người', staffValues(teachers));
  const teacherBlock = (order: string, label: string, start: number, members: Bieu01Staff[]) => {
    third.add(order, label, String(start), 'người', staffValues(members));
    qualificationRows(members, start + 1, false);
    [1, 2, 3].forEach((level, index) =>
      third.add(
        '',
        `– Hạng ${'I'.repeat(level)}`,
        String(start + 7 + index),
        'người',
        staffValues(members.filter((member) => rankOf(member.rank)?.level === level)),
      ),
    );
    const ageOfStaff = (member: Bieu01Staff) => (member.birth_year === null ? null : startYear - member.birth_year);
    const ages: Array<[string, (age: number) => boolean]> = [
      ['Độ tuổi từ 20 đến 29', (age) => age < 30],
      ['Độ tuổi từ 30 đến 39', (age) => age >= 30 && age < 40],
      ['Độ tuổi từ 40 đến 49', (age) => age >= 40 && age < 50],
      ['Độ tuổi từ 50 đến 59', (age) => age >= 50 && age < 60],
      ['Độ tuổi từ 60 trở lên', (age) => age >= 60],
    ];
    ages.forEach(([text, test], index) =>
      third.add(
        '',
        `– ${text}`,
        String(start + 10 + index),
        'người',
        staffValues(
          members.filter((member) => {
            const age = ageOfStaff(member);
            return age !== null && test(age);
          }),
        ),
      ),
    );
    third.add(
      '',
      '– Kiêm nhiệm hỗ trợ giáo dục người khuyết tật',
      String(start + 15),
      'người',
      staffValues(members.filter((member) => member.concurrent_disability_support)),
    );
    third.add(
      '',
      '– Kiêm nhiệm vị trí việc làm chuyên môn dùng chung',
      String(start + 16),
      'người',
      staffValues(members.filter((member) => member.concurrent_shared_position)),
    );
  };
  const nurseryTeachers = teachers.filter((member) => teachesNursery(member, institution));
  teacherBlock('4.2.1.', 'Giáo viên nhà trẻ', 137, nurseryTeachers);
  teacherBlock(
    '4.2.2.',
    'Giáo viên mẫu giáo',
    154,
    teachers.filter((member) => !teachesNursery(member, institution)),
  );
  const disabilitySupport = employees.filter((member) => employeeRoleOf(member) === 'disability_support');
  third.add('4.2.3.', 'Hỗ trợ giáo dục người khuyết tật', '171', 'người', staffValues(disabilitySupport));
  const supportAt = (type: InstitutionType) => staffValues(institution === type ? disabilitySupport : []);
  third.add('', '– Tại nhà trẻ', '172', 'người', supportAt('nha_tre'));
  third.add('', '– Tại trường mẫu giáo', '173', 'người', supportAt('truong_mau_giao'));
  third.add('', '– Tại trường mầm non', '174', 'người', supportAt('truong_mam_non'));
  const shared = employees.filter((member) => SHARED_ROLES.includes(employeeRoleOf(member)));
  third.add('4.3.', 'Vị trí việc làm chuyên môn dùng chung', '175', 'người', staffValues(shared));
  const sharedBlock = (order: string, label: string, start: number, applies: boolean) => {
    const members = applies ? shared : [];
    const role = (value: EmployeeRole) => members.filter((member) => employeeRoleOf(member) === value);
    third.add(order, label, String(start), 'người', staffValues(members));
    const rows: Array<[string, Bieu01Staff[]]> = [
      ['Văn thư', role('clerk')],
      ['Kế toán', role('accountant')],
      ['Thủ quỹ', role('treasurer')],
      ['Thư viện', role('librarian')],
      ['Y tế trường học', role('medical')],
      ['Kiêm nhiệm 2 hoặc 3 vị trí việc làm', members.filter((member) => member.concurrent_shared_position)],
    ];
    rows.forEach(([text, list], index) =>
      third.add('', `– ${text}`, String(start + 1 + index), 'người', staffValues(list)),
    );
  };
  sharedBlock('4.3.1.', 'Vị trí việc làm chuyên môn dùng chung nhà trẻ', 176, nurseryInstitution);
  sharedBlock('4.3.2.', 'Vị trí việc làm chuyên môn dùng chung mẫu giáo, mầm non', 183, !nurseryInstitution);
  const support = employees.filter(
    (member) => !SHARED_ROLES.includes(employeeRoleOf(member)) && employeeRoleOf(member) !== 'disability_support',
  );
  third.add('4.4.', 'Vị trí việc làm hỗ trợ, phục vụ', '190', 'người', staffValues(support));
  const supportBlock = (order: string, label: string, start: number, applies: boolean) => {
    const members = applies ? support : [];
    const role = (value: EmployeeRole) => members.filter((member) => employeeRoleOf(member) === value);
    third.add(order, label, String(start), 'người', staffValues(members));
    const rows: Array<[string, Bieu01Staff[]]> = [
      ['Nấu ăn', role('cook')],
      ['Phục vụ', role('service')],
      ['Bảo vệ', role('guard')],
      ['Khác', role('other')],
    ];
    rows.forEach(([text, list], index) =>
      third.add('', `– ${text}`, String(start + 1 + index), 'người', staffValues(list)),
    );
  };
  supportBlock('4.4.1.', 'Vị trí việc làm hỗ trợ, phục vụ nhà trẻ', 191, nurseryInstitution);
  supportBlock('4.4.2.', 'Vị trí việc làm hỗ trợ, phục vụ mẫu giáo, mầm non', 196, !nurseryInstitution);
  const withoutContract = input.staff.filter((member) => contractOf(member.contract_form) === null).length;
  if (withoutContract > 0) {
    warnings.push(
      `${withoutContract} nhân sự chưa ghi hình thức hợp đồng (mục 3.1.1): không tính vào bốn cột phân loại của thẻ Đội ngũ`,
    );
  }
  const teachersWithoutLevel = teachers.filter((member) => qualificationOf(member.qualification) === 'other').length;
  if (teachersWithoutLevel > 0) {
    warnings.push(
      `${teachersWithoutLevel} giáo viên chưa ghi trình độ chuyên môn hoặc trình độ ngoài danh mục: không tính vào các dòng trình độ`,
    );
  }

  // Thẻ 4. Cơ sở vật chất
  const nurseryRooms = new Set(
    input.classes.filter((item) => item.stage === 'nursery' && item.room_id).map((item) => item.room_id as string),
  );
  const kindergartenRooms = new Set(
    input.classes.filter((item) => item.stage === 'kindergarten' && item.room_id).map((item) => item.room_id as string),
  );
  const roomIsNursery = (room: Bieu01Room) =>
    nurseryRooms.has(room.id) ? true : kindergartenRooms.has(room.id) ? false : nurseryInstitution;
  const fourth = new RowList();
  fourth.add('', 'Tổng số', '201', 'phòng', roomValues(input.rooms));
  const roomBlock = (order: string, label: string, start: number, nurseryBlock: boolean) => {
    const rooms = input.rooms.filter((room) => roomIsNursery(room) === nurseryBlock);
    const type = (...types: string[]) => rooms.filter((room) => types.includes(room.room_type ?? ''));
    const number = order.slice(0, -1);
    fourth.heading(order, label);
    const classrooms = type('group_room');
    fourth.add(`${number}1.`, 'Phòng học (nuôi, dạy, chăm sóc trẻ)', String(start), 'phòng', roomValues(classrooms));
    fourth.add(
      '',
      '– Phòng học nhờ, mượn',
      String(start + 1),
      'phòng',
      roomValues(classrooms.filter((room) => room.condition === 'borrowed')),
    );
    fourth.add(
      `${number}2.`,
      'Phòng giáo dục thể chất, giáo dục nghệ thuật',
      String(start + 2),
      'phòng',
      roomValues(type('physical_education', 'arts_education', 'multi_purpose')),
    );
    fourth.add('', '– Phòng giáo dục thể chất', String(start + 3), 'phòng', roomValues(type('physical_education')));
    fourth.add('', '– Phòng giáo dục nghệ thuật', String(start + 4), 'phòng', roomValues(type('arts_education')));
    fourth.add('', '– Phòng đa năng', String(start + 5), 'phòng', roomValues(type('multi_purpose')));
    fourth.add(
      `${number}3.`,
      'Sân chơi riêng',
      String(start + 6),
      'sân',
      roomValues(rooms.filter((room) => room.attributes.has_private_playground === true)),
    );
    fourth.add(`${number}4.`, 'Phòng tin học', String(start + 7), 'phòng', roomValues(type('computer_room')));
  };
  roomBlock('5.1.', 'Nhà trẻ', 202, true);
  roomBlock('5.2.', 'Mẫu giáo', 210, false);
  if (input.rooms.some((room) => !room.condition)) {
    warnings.push('Có phòng chưa khai báo hiện trạng trong 1.1 Khai báo cơ sở vật chất: chỉ tính vào cột Tổng số');
  }

  return {
    school_classes: first.rows,
    children: second.rows,
    staff: third.rows,
    rooms: fourth.rows,
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Thẻ 5. Ngân sách nhà nước theo Biểu 08.ĐN-NSNN, mã 1 đến 71 (khảo sát mục 10.4.2). Ghi chép không có mã 6 nên không có
// dòng mã 6; tên các mục 2 đến 5 của chi thường xuyên (mã 24–55) chưa ghi được nên đặt "Mục 2" đến "Mục 5", chia như mục 1,
// chờ đối chiếu biểu của Sở (tài liệu 32 mục 8.3)
export const BUDGET_PENDING_NOTE =
  'Biểu 08.ĐN-NSNN: tên các mục 2 đến 5 của chi thường xuyên (mã 24 đến 55) chưa khảo sát được, đặt "Mục 2" đến "Mục 5", chờ đối chiếu biểu của Sở';

function buildBudgetRows(): EmisFormRow[] {
  const list = new RowList();
  const unit = 'triệu đồng';
  const add = (order: string, label: string, code: number) => list.add(order, label, String(code), unit, {});
  add('', 'Tổng chi các nguồn thuộc NSNN', 1);
  add('I.', 'Chi đầu tư', 2);
  add('1.', 'Vốn đầu tư từ ngân sách địa phương', 3);
  add('1.1.', 'Trong cân đối ngân sách địa phương', 4);
  add('', '– Cấp tỉnh quản lý', 5);
  add('', '– Cấp xã quản lý', 7);
  add('1.2.', 'Vốn trái phiếu chính quyền địa phương', 8);
  add('2.', 'Nguồn vốn ngân sách trung ương', 9);
  add('', '– Chương trình mục tiêu quốc gia', 10);
  add('', '– Chương trình mục tiêu', 11);
  add('', '– Vốn ODA', 12);
  add('', '– Vốn trái phiếu Chính phủ', 13);
  add('', '– Ngân sách nhà nước khác', 14);
  add('II.', 'Chi thường xuyên', 15);
  const items = [
    'Giáo dục mầm non',
    'Mục 2 (chờ đối chiếu)',
    'Mục 3 (chờ đối chiếu)',
    'Mục 4 (chờ đối chiếu)',
    'Mục 5 (chờ đối chiếu)',
    'Đào tạo khác trong nước',
    'Đào tạo lại, bồi dưỡng nghiệp vụ cho cán bộ, công chức, viên chức',
  ];
  items.forEach((label, index) => {
    const start = 16 + index * 8;
    add(`${index + 1}.`, label, start);
    add('', '– Chia theo nguồn: Ngân sách nhà nước', start + 1);
    add('', '– Chia theo nguồn: Phí, lệ phí để lại', start + 2);
    add('', '– Chia theo nguồn: Khác', start + 3);
    add('', '– Chia theo nhóm chi: Thanh toán cá nhân', start + 4);
    add('', '– Chia theo nhóm chi: Hàng hóa, dịch vụ', start + 5);
    add('', '– Chia theo nhóm chi: Hỗ trợ và bổ sung', start + 6);
    add('', '– Chia theo nhóm chi: Khác', start + 7);
  });
  return list.rows;
}

export const BUDGET_ROWS: EmisRowTemplate[] = templates(buildBudgetRows());
