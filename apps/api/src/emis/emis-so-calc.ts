import type { EmisValues } from '@school-management/database';
import { foldCatalogText } from '@school-management/shared';
import { overallLevel } from '../professional-standards/standard-rating.js';
import {
  employeeRoleOf,
  isPrincipal,
  qualificationOf,
  rankOf,
  RowList,
  teachesNursery,
  type Bieu01Staff,
  type InstitutionType,
  type Nutrition,
} from './emis-01-calc.js';
import type { EmisFormRow } from './emis-form-calc.js';

// Các biểu khác của phân hệ Báo cáo số liệu Mầm non theo cấu trúc của Sở (DT-17 phần 17a, YCTD-132; khảo sát mục 10.4.4,
// 10.4.5): thẻ 1 của 1.2.1 Báo cáo cơ sở vật chất của TP.HCM, 2.1 EMIS cuối năm, ba biểu của 2.2 Báo cáo đội ngũ, 2.3 Đề án
// ngoại ngữ. Hàm thuần, không đọc cơ sở dữ liệu. Mã số của 2.1, 2.2, 2.3 Sở không hiện nên mã là số thứ tự của dòng (Claude
// tự chọn theo ủy quyền của Eric ngày 2026-10-11)
const fold = (value: string | null | undefined) => foldCatalogText(value ?? '');
const code2 = (value: number) => String(value).padStart(2, '0');

// ---------------------------------------------------------------------------------------------------------------------
// 1.2.1 thẻ 1. Cơ sở vật chất: sáu khối A đến F, mã 01 đến 84 (khảo sát mục 10.4.4). Bảng ánh xạ loại phòng của mình sang
// dòng của Sở ở HCM_ROOM_MAP; khối A đến D chia nhà trẻ, mẫu giáo như Biểu 01 (phòng gắn với lớp nhóm trẻ là nhà trẻ, phòng
// khác theo loại trường). Tên dòng chi tiết của khối B ghi chép chưa đủ nên đánh mã theo thứ tự đọc được, chờ đối chiếu
export interface HcmRoom {
  room_type: string | null;
  condition: string | null;
  built_this_year: boolean;
  nursery: boolean;
  attributes: Record<string, unknown>;
}

export const HCM_PENDING_NOTE =
  '1.2.1 thẻ 1: mã số các dòng chi tiết của khối B (15 đến 34) đánh theo thứ tự ghi chép được, chờ đối chiếu biểu của Sở; thẻ 2 đến 5 chưa khảo sát được nội dung, tên chỉ tiêu do hệ thống đặt';

type RoomTest = (room: HcmRoom) => boolean;
const ofType =
  (...types: string[]): RoomTest =>
  (room) =>
    types.includes(room.room_type ?? '');
const childToilet: RoomTest = (room) => room.room_type === 'toilet' && room.attributes.toilet_users !== 'staff';
const staffToilet: RoomTest = (room) => room.room_type === 'toilet' && room.attributes.toilet_users === 'staff';
const ensuiteClassroom: RoomTest = (room) => room.room_type === 'group_room' && room.attributes.toilet === 'ensuite';
const none: RoomTest = () => false;

// Dòng của từng khối: nhãn và phép chọn phòng; dòng đầu "Số phòng" là tổng các dòng sau (trừ dòng "trong đó")
interface HcmLine {
  label: string;
  test: RoomTest;
  // Dòng "trong đó" không cộng vào số phòng của khối
  within?: boolean;
}

export const HCM_ROOM_MAP: Record<'A' | 'B_all' | 'B_nursery' | 'B_kindergarten' | 'C' | 'D' | 'E' | 'F', HcmLine[]> = {
  A: [
    { label: 'Phòng học (nuôi, dạy, chăm sóc trẻ)', test: ofType('group_room') },
    { label: 'Phòng vệ sinh', test: childToilet },
    { label: 'Phòng ngủ', test: ofType('bedroom') },
    { label: 'Phòng khác', test: ofType('veranda') },
  ],
  B_all: [
    { label: 'Thư viện', test: ofType('library') },
    { label: 'Phòng giáo dục thể chất', test: ofType('physical_education') },
    { label: 'Phòng đa chức năng (nghệ thuật)', test: ofType('multi_purpose', 'arts_education') },
    { label: 'Phòng khác', test: ofType('english_room', 'computer_room') },
  ],
  B_nursery: [
    { label: 'Thư viện', test: ofType('library') },
    { label: 'Phòng giáo dục thể chất', test: ofType('physical_education') },
    { label: 'Phòng giáo dục nghệ thuật', test: ofType('arts_education') },
    { label: 'Phòng đa chức năng', test: ofType('multi_purpose') },
    { label: 'Phòng khác', test: ofType('english_room', 'computer_room') },
  ],
  B_kindergarten: [
    { label: 'Thư viện', test: ofType('library') },
    { label: 'Phòng giáo dục thể chất', test: ofType('physical_education') },
    { label: 'Phòng giáo dục nghệ thuật', test: ofType('arts_education') },
    { label: 'Phòng đa chức năng', test: ofType('multi_purpose') },
    { label: 'Phòng hỗ trợ giáo dục hòa nhập', test: none },
    { label: 'Phòng khác', test: ofType('english_room', 'computer_room') },
  ],
  C: [
    { label: 'Nhà bếp', test: ofType('kitchen') },
    { label: 'Nhà kho', test: ofType('food_storage') },
    { label: 'Phòng khác', test: ofType('dining_hall') },
  ],
  D: [
    { label: 'Phòng y tế', test: ofType('health_room') },
    { label: 'Khu vệ sinh dành cho giáo viên', test: staffToilet },
    { label: 'Khu vệ sinh dành cho học sinh', test: childToilet },
    { label: 'Trong đó: bố trí trong lớp học', test: ensuiteClassroom, within: true },
  ],
  E: [
    { label: 'Phòng Hiệu trưởng', test: ofType('principal_office') },
    { label: 'Phòng Phó hiệu trưởng', test: ofType('vice_principal_office') },
    { label: 'Văn phòng trường', test: ofType('office') },
    { label: 'Phòng họp', test: ofType('meeting_room') },
    { label: 'Phòng hành chính quản trị', test: ofType('administration_office') },
    { label: 'Phòng bảo vệ', test: ofType('guard_house') },
    { label: 'Phòng truyền thống', test: none },
    { label: 'Nhà công vụ giáo viên', test: ofType('teacher_housing') },
    { label: 'Phòng nhân viên', test: ofType('staff_room') },
    { label: 'Nhà kho', test: ofType('storage') },
    { label: 'Phòng khác', test: ofType('other') },
  ],
  F: [
    { label: 'Nhà xe giáo viên', test: ofType('parking') },
    { label: 'Phòng khác', test: none },
  ],
};

function hcmValues(rooms: HcmRoom[]): EmisValues {
  const count = (test: RoomTest) => rooms.filter(test).length;
  return {
    total: rooms.length,
    permanent: count((room) => room.condition === 'permanent'),
    permanent_new: count((room) => room.condition === 'permanent' && room.built_this_year),
    semi_permanent: count((room) => room.condition === 'semi_permanent'),
    semi_permanent_new: count((room) => room.condition === 'semi_permanent' && room.built_this_year),
    temporary: count((room) => room.condition === 'temporary'),
  };
}

export function buildHcmFacilities(rooms: HcmRoom[]): EmisFormRow[] {
  const list = new RowList();
  let next = 1;
  const add = (order: string, label: string, members: HcmRoom[]) => {
    list.add(order, label, code2(next), 'phòng', hcmValues(members));
    next += 1;
  };
  const pick = (members: HcmRoom[], lines: HcmLine[]) =>
    members.filter((room) => lines.some((line) => !line.within && line.test(room)));
  const lines = (members: HcmRoom[], items: HcmLine[], first: string) => {
    add('', `– ${first}`, pick(members, items));
    for (const line of items) {
      add('', `– ${line.label}`, members.filter(line.test));
    }
  };
  const nursery = rooms.filter((room) => room.nursery);
  const kindergarten = rooms.filter((room) => !room.nursery);
  // A: 01 khối, 02 nhà trẻ (03–07), 08 mẫu giáo (09–13)
  add('A.', 'Khối phòng nuôi dưỡng, chăm sóc trẻ', pick(rooms, HCM_ROOM_MAP.A));
  add('1.', 'Nhà trẻ', pick(nursery, HCM_ROOM_MAP.A));
  lines(nursery, HCM_ROOM_MAP.A, 'Số phòng học theo chức năng');
  add('2.', 'Mẫu giáo', pick(kindergarten, HCM_ROOM_MAP.A));
  lines(kindergarten, HCM_ROOM_MAP.A, 'Số phòng học theo chức năng');
  // B: 14 khối (15–19), 20 nhà trẻ (21–26), 27 mẫu giáo (28–34)
  add('B.', 'Khối phòng phục vụ học tập', pick(rooms, HCM_ROOM_MAP.B_all));
  lines(rooms, HCM_ROOM_MAP.B_all, 'Số phòng theo chức năng');
  add('1.', 'Nhà trẻ', pick(nursery, HCM_ROOM_MAP.B_nursery));
  lines(nursery, HCM_ROOM_MAP.B_nursery, 'Số phòng theo chức năng');
  add('2.', 'Mẫu giáo', pick(kindergarten, HCM_ROOM_MAP.B_kindergarten));
  lines(kindergarten, HCM_ROOM_MAP.B_kindergarten, 'Số phòng theo chức năng');
  // C: 35 khối (36–39), 40 nhà trẻ (41–44), 45 mẫu giáo (46–49)
  add('C.', 'Khối phòng tổ chức ăn', pick(rooms, HCM_ROOM_MAP.C));
  lines(rooms, HCM_ROOM_MAP.C, 'Số phòng');
  add('1.', 'Nhà trẻ', pick(nursery, HCM_ROOM_MAP.C));
  lines(nursery, HCM_ROOM_MAP.C, 'Số phòng');
  add('2.', 'Mẫu giáo', pick(kindergarten, HCM_ROOM_MAP.C));
  lines(kindergarten, HCM_ROOM_MAP.C, 'Số phòng');
  // D: 50 khối (51–55), 56 nhà trẻ (57–61), 62 mẫu giáo (63–67)
  add('D.', 'Khối phòng khác', pick(rooms, HCM_ROOM_MAP.D));
  lines(rooms, HCM_ROOM_MAP.D, 'Số phòng');
  add('1.', 'Nhà trẻ', pick(nursery, HCM_ROOM_MAP.D));
  lines(nursery, HCM_ROOM_MAP.D, 'Số phòng');
  add('2.', 'Mẫu giáo', pick(kindergarten, HCM_ROOM_MAP.D));
  lines(kindergarten, HCM_ROOM_MAP.D, 'Số phòng');
  // E: 68 khối (69–80); F: 81 khối (82–84)
  add('E.', 'Khối phòng hành chính quản trị', pick(rooms, HCM_ROOM_MAP.E));
  lines(rooms, HCM_ROOM_MAP.E, 'Số phòng');
  add('F.', 'Khối công trình công cộng', pick(rooms, HCM_ROOM_MAP.F));
  lines(rooms, HCM_ROOM_MAP.F, 'Số phòng');
  return list.rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2.1 Lập báo cáo cuối năm: mục I Trường, II Nhóm lớp, III Trẻ em, VI Cán bộ quản lý, giáo viên, nhân viên (khảo sát mục
// 10.4.5; Sở ghi VI, mục con đánh 4.x). Một cột Tổng số. Trẻ, nhóm lớp là số tại thời điểm xem; dinh dưỡng theo lần cân đo
// gần nhất học kỳ II; giáo viên theo mức chuẩn nghề nghiệp là xếp loại chung của phiếu đã chốt gần nhất; nghỉ hưu trong năm
// là nhân sự có ngày nghỉ việc trong năm học và trạng thái cán bộ "Đã nghỉ hưu"; tuyển mới là ngày vào làm trong năm học
export interface EndOfYearStaff extends Bieu01Staff {
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  staff_status: string | null;
  // Xếp loại chung của phiếu chuẩn nghề nghiệp giáo viên đã chốt gần nhất
  standard_level: 'not_met' | 'met' | 'good' | 'excellent' | null;
}

export interface EndOfYearInput {
  institution_type: InstitutionType | null;
  sites: number;
  nursery_classes: number;
  kindergarten_classes: number;
  children: Array<{ nursery: boolean; five_to_six: boolean; nutrition: Nutrition | null }>;
  staff: EndOfYearStaff[];
  // Khoảng ngày của năm học (YYYY-MM-DD)
  year: { from: string; to: string };
}

export function buildEndOfYear(input: EndOfYearInput): EmisFormRow[] {
  const list = new RowList();
  const total = (value: number): EmisValues => ({ total: value });
  const institution = input.institution_type;
  const independent = institution === 'nhom_tre_doc_lap';
  list.heading('I', 'Trường');
  list.add('I.1', 'Nhà trẻ', 'I.1', 'trường', total(institution === 'nha_tre' ? 1 : 0));
  list.add('I.2', 'Trường mẫu giáo', 'I.2', 'trường', total(institution === 'truong_mau_giao' ? 1 : 0));
  list.add('I.3', 'Trường mầm non', 'I.3', 'trường', total(institution === 'truong_mam_non' ? 1 : 0));
  list.add('I.4', 'Nhóm trẻ độc lập', 'I.4', 'nhóm', total(independent ? 1 : 0));
  list.add('I.5', 'Lớp mẫu giáo độc lập', 'I.5', 'lớp', total(0));
  list.add('I.6', 'Nhóm trẻ, Lớp MG độc lập', 'I.6', 'nhóm, lớp', total(independent ? 1 : 0));
  list.add('I.7', 'Số điểm trường', 'I.7', 'điểm', total(input.sites));
  list.heading('II', 'Nhóm, lớp');
  list.add('II.1', 'Nhóm trẻ', 'II.1', 'nhóm', total(input.nursery_classes));
  list.add('II.2', 'Lớp mẫu giáo', 'II.2', 'lớp', total(input.kindergarten_classes));
  list.heading('III', 'Trẻ em');
  const nursery = input.children.filter((child) => child.nursery);
  const kindergarten = input.children.filter((child) => !child.nursery);
  list.add('3.1', 'Quy mô trẻ', '3.1', 'trẻ', total(input.children.length));
  list.add('3.1.1', 'Nhà trẻ', '3.1.1', 'trẻ', total(nursery.length));
  list.add('3.1.2', 'Mẫu giáo', '3.1.2', 'trẻ', total(kindergarten.length));
  list.add('3.1.3', 'Trong đó: trẻ 5–6 tuổi', '3.1.3', 'trẻ', total(kindergarten.filter((child) => child.five_to_six).length));
  list.heading('3.2', 'Tình trạng dinh dưỡng');
  const nutrition = (order: string, label: string, children: typeof input.children) => {
    const measured = children.filter((child) => child.nutrition !== null);
    const by = (test: (value: Nutrition) => boolean) =>
      total(measured.filter((child) => child.nutrition !== null && test(child.nutrition)).length);
    list.add(order, label, order, 'trẻ', total(measured.length));
    list.add('', '– Suy dinh dưỡng thể nhẹ cân', `${order}.1`, 'trẻ', by((n) => n.weight_status === 'underweight'));
    list.add('', '– Suy dinh dưỡng thể thấp còi', `${order}.2`, 'trẻ', by((n) => n.height_status === 'stunted'));
    list.add('', '– Suy dinh dưỡng thể còi cọc', `${order}.3`, 'trẻ', by((n) => n.weight_height_status === 'wasted'));
    list.add(
      '',
      '– Thừa cân, béo phì',
      `${order}.4`,
      'trẻ',
      by((n) => n.weight_height_status === 'overweight' || n.weight_height_status === 'obese'),
    );
  };
  nutrition('3.2.1', 'Trẻ nhà trẻ được kiểm tra sức khỏe và đánh giá tình trạng dinh dưỡng', nursery);
  nutrition('3.2.2', 'Trẻ mẫu giáo được kiểm tra sức khỏe và đánh giá tình trạng dinh dưỡng', kindergarten);

  list.heading('VI', 'Cán bộ quản lý, giáo viên và nhân viên');
  const active = input.staff.filter((member) => member.active);
  const managers = active.filter((member) => member.category === 'manager');
  const nurseryInstitution = institution === 'nha_tre';
  list.heading('4.1', 'Cán bộ quản lý');
  const managerRows = (order: string, label: string, members: EndOfYearStaff[]) => {
    list.heading(order, label);
    list.add('', '– Nhà trẻ', `${order}.1`, 'người', total(nurseryInstitution ? members.length : 0));
    list.add('', '– Mẫu giáo, mầm non', `${order}.2`, 'người', total(nurseryInstitution ? 0 : members.length));
  };
  managerRows(
    '4.1.1',
    'Hiệu trưởng',
    managers.filter((member) => isPrincipal(member) !== 'vice'),
  );
  managerRows(
    '4.1.2',
    'Phó hiệu trưởng',
    managers.filter((member) => isPrincipal(member) === 'vice'),
  );
  const teachers = (members: EndOfYearStaff[], nurseryTeachers: boolean) =>
    members.filter((member) => member.category === 'teacher' && teachesNursery(member, institution) === nurseryTeachers);
  list.heading('4.2', 'Giáo viên');
  const teacherRows = (order: string, label: string, members: EndOfYearStaff[]) => {
    list.add(order, label, order, 'người', total(members.length));
    const levels: Array<[string, EndOfYearStaff['standard_level']]> = [
      ['Tốt', 'excellent'],
      ['Khá', 'good'],
      ['Đạt', 'met'],
      ['Chưa đạt chuẩn', 'not_met'],
    ];
    levels.forEach(([text, level], index) =>
      list.add(
        '',
        `– Đánh giá chuẩn nghề nghiệp: ${text}`,
        `${order}.${index + 1}`,
        'người',
        total(members.filter((member) => member.standard_level === level).length),
      ),
    );
  };
  teacherRows('4.2.1', 'Giáo viên nhà trẻ', teachers(active, true));
  teacherRows('4.2.2', 'Giáo viên mẫu giáo', teachers(active, false));
  const inYear = (date: string | null) => date !== null && date >= input.year.from && date <= input.year.to;
  const retired = input.staff.filter(
    (member) => !member.active && inYear(member.end_date) && fold(member.staff_status).includes('nghi huu'),
  );
  const hired = input.staff.filter((member) => inYear(member.start_date));
  const female = (members: EndOfYearStaff[]) => members.filter((member) => member.gender === 'female').length;
  const movementRows = (order: string, label: string, members: EndOfYearStaff[]) => {
    list.heading(order, label);
    const ofNursery = teachers(members, true);
    const ofKindergarten = teachers(members, false);
    list.add('', '– Nhà trẻ', `${order}.1`, 'người', total(ofNursery.length));
    list.add('', '  Trong đó: nữ', `${order}.2`, 'người', total(female(ofNursery)));
    list.add('', '– Mẫu giáo', `${order}.3`, 'người', total(ofKindergarten.length));
    list.add('', '  Trong đó: nữ', `${order}.4`, 'người', total(female(ofKindergarten)));
  };
  movementRows('4.3', 'Giáo viên nghỉ hưu trong năm', retired);
  movementRows('4.4', 'Giáo viên tuyển mới trong năm', hired);
  const employees = active.filter((member) => member.category === 'employee');
  list.heading('4.5', 'Nhân viên');
  list.add('', '– Nhà trẻ', '4.5.1', 'người', total(nurseryInstitution ? employees.length : 0));
  list.add('', '  Trong đó: nữ', '4.5.2', 'người', total(nurseryInstitution ? female(employees) : 0));
  list.add('', '– Mẫu giáo, mầm non', '4.5.3', 'người', total(nurseryInstitution ? 0 : employees.length));
  list.add('', '  Trong đó: nữ', '4.5.4', 'người', total(nurseryInstitution ? 0 : female(employees)));
  return list.rows;
}

// ---------------------------------------------------------------------------------------------------------------------
// 2.2 Báo cáo đội ngũ: ba biểu của Sở (2.2.1 tổng hợp chung, 2.2.2 ngoại ngữ – tin học, 2.2.3 chuẩn nghề nghiệp), mỗi biểu
// hai thẻ (khảo sát mục 10.4.5). Nhân sự đang làm việc; trình độ, hạng, đánh giá viên chức, dạy giỏi, ngoại ngữ, tin học
// đọc từ hồ sơ theo mẫu của Bộ (mục 3.1.1); chuẩn nghề nghiệp từ phiếu đã chốt gần nhất của mỗi người
export interface StaffReportPerson extends Bieu01Staff {
  civil_servant_evaluation: string | null;
  excellent_teacher: string | null;
  language_framework_level: string | null;
  language_training_level: string | null;
  language_certificate_type: string | null;
  main_foreign_language: string | null;
  it_level: string | null;
}

export interface StaffEvaluation {
  standard_type: 'principal' | 'teacher';
  // Người được đánh giá là phó hiệu trưởng (chuẩn hiệu trưởng dùng cho cả hiệu trưởng, phó hiệu trưởng)
  vice: boolean;
  overall_level: 'not_met' | 'met' | 'good' | 'excellent' | null;
  items: Array<{
    order_no: number;
    is_key: boolean;
    self_rating: 'not_met' | 'met' | 'good' | 'excellent' | null;
    assessor_rating: 'not_met' | 'met' | 'good' | 'excellent' | null;
  }>;
}

export interface StaffReportInput {
  schools: number;
  classes: number;
  institution_type: InstitutionType | null;
  startYear: number;
  staff: StaffReportPerson[];
  evaluations: StaffEvaluation[];
}

export interface StaffReportTabs {
  general_managers: EmisFormRow[];
  general_teachers: EmisFormRow[];
  skills_managers: EmisFormRow[];
  skills_teachers: EmisFormRow[];
  standards_managers: EmisFormRow[];
  standards_teachers: EmisFormRow[];
}

const totalFemale = (members: Array<{ gender: 'male' | 'female' | null }>): EmisValues => ({
  total: members.length,
  female: members.filter((member) => member.gender === 'female').length,
});

type Split = Array<[string, (member: StaffReportPerson) => boolean]>;

function civilEvaluationOf(text: string | null): 'excellent' | 'good' | 'done' | 'failed' | null {
  const value = fold(text);
  if (value === '') {
    return null;
  }
  if (value.includes('khong hoan thanh')) {
    return 'failed';
  }
  if (value.includes('xuat sac')) {
    return 'excellent';
  }
  if (value.includes('tot')) {
    return 'good';
  }
  return value.includes('hoan thanh') ? 'done' : null;
}

function excellentLevelOf(text: string | null): 'school' | 'district' | 'province' | 'national' | null {
  const value = fold(text);
  if (value.includes('toan quoc') || value.includes('quoc gia')) {
    return 'national';
  }
  if (value.includes('tinh') || value.includes('thanh pho')) {
    return 'province';
  }
  if (value.includes('huyen') || value.includes('quan')) {
    return 'district';
  }
  return value.includes('truong') ? 'school' : null;
}

// Bậc theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam (A1, A2, B1, B2, C1, C2 tương đương bậc 1–6)
export function frameworkStepOf(text: string | null): number | null {
  const value = fold(text);
  const step = /bac\s*([1-6])/.exec(value)?.[1] ?? /^([1-6])$/.exec(value)?.[1];
  if (step) {
    return Number(step);
  }
  const cefr = /\b(a1|a2|b1|b2|c1|c2)\b/.exec(value)?.[1];
  return cefr ? ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].indexOf(cefr) + 1 : null;
}

function trainingLevelOf(text: string | null): 'postgraduate' | 'university' | 'college' | 'intermediate' | 'other' | null {
  const value = fold(text);
  if (value === '') {
    return null;
  }
  if (value.includes('thac si') || value.includes('tien si') || value.includes('tren dai hoc') || value.includes('sau dai hoc')) {
    return 'postgraduate';
  }
  if (value.includes('dai hoc')) {
    return 'university';
  }
  if (value.includes('cao dang')) {
    return 'college';
  }
  return value.includes('trung cap') ? 'intermediate' : 'other';
}

const QUALIFICATION_SPLIT: Split = [
  ['Trung cấp', (member) => qualificationOf(member.qualification) === 'intermediate'],
  ['Cao đẳng', (member) => qualificationOf(member.qualification) === 'college'],
  ['Đại học', (member) => qualificationOf(member.qualification) === 'university'],
  ['Thạc sĩ', (member) => qualificationOf(member.qualification) === 'master'],
  ['Tiến sĩ, TSKH', (member) => qualificationOf(member.qualification) === 'doctor'],
  ['Khác', (member) => ['untrained', 'other'].includes(qualificationOf(member.qualification))],
];

const RANK_SPLIT: Split = [
  ['Hạng II', (member) => rankOf(member.rank)?.tt01 === false && rankOf(member.rank)?.level === 2],
  ['Hạng III', (member) => rankOf(member.rank)?.tt01 === false && rankOf(member.rank)?.level === 3],
  ['Hạng IV', (member) => rankOf(member.rank)?.level === 4],
  ['Hạng I (TT01)', (member) => rankOf(member.rank)?.tt01 === true && rankOf(member.rank)?.level === 1],
  ['Hạng II (TT01)', (member) => rankOf(member.rank)?.tt01 === true && rankOf(member.rank)?.level === 2],
  ['Hạng III (TT01)', (member) => rankOf(member.rank)?.tt01 === true && rankOf(member.rank)?.level === 3],
  [
    'Khác',
    (member) => {
      const rank = rankOf(member.rank);
      return rank === null || (rank.level === 1 && !rank.tt01);
    },
  ],
];

const EVALUATION_SPLIT: Split = [
  ['Hoàn thành xuất sắc nhiệm vụ', (member) => civilEvaluationOf(member.civil_servant_evaluation) === 'excellent'],
  ['Hoàn thành tốt nhiệm vụ', (member) => civilEvaluationOf(member.civil_servant_evaluation) === 'good'],
  ['Hoàn thành nhiệm vụ', (member) => civilEvaluationOf(member.civil_servant_evaluation) === 'done'],
  ['Không hoàn thành nhiệm vụ', (member) => civilEvaluationOf(member.civil_servant_evaluation) === 'failed'],
];

export function buildStaffForms(input: StaffReportInput): StaffReportTabs {
  const active = input.staff;
  const managers = active.filter((member) => member.category === 'manager');
  const principals = managers.filter((member) => isPrincipal(member) !== 'vice');
  const vices = managers.filter((member) => isPrincipal(member) === 'vice');
  const teachers = active.filter((member) => member.category === 'teacher');
  const employees = active.filter((member) => member.category === 'employee');
  const ageOf = (member: StaffReportPerson) => (member.birth_year === null ? null : input.startYear - member.birth_year);
  const ageSplit: Split = [
    ['Dưới 31', (member) => (ageOf(member) ?? 99) < 31],
    ...[31, 36, 41, 46, 51, 56].map((from): [string, (member: StaffReportPerson) => boolean] => [
      `${from}–${from + 4}`,
      (member) => {
        const age = ageOf(member);
        return age !== null && age >= from && age <= from + 4;
      },
    ]),
    [
      'Khác',
      (member) => {
        const age = ageOf(member);
        return age === null || age > 60;
      },
    ],
  ];
  const splits = (list: RowList, prefix: string, members: StaffReportPerson[], groups: Array<[string, string, Split]>) => {
    groups.forEach(([key, title, split]) => {
      list.heading('', title);
      split.forEach(([label, test], index) =>
        list.add('', `– ${label}`, `${prefix}.${key}.${index + 1}`, 'người', totalFemale(members.filter(test))),
      );
    });
  };

  // 2.2.1 thẻ 1. Cán bộ quản lý
  const generalManagers = new RowList();
  generalManagers.add('1', 'Tổng số trường', '1', 'trường', { total: input.schools, female: null });
  generalManagers.add('2', 'Tổng số lớp', '2', 'lớp', { total: input.classes, female: null });
  const managerGroups: Array<[string, string, Split]> = [
    ['TD', 'Trình độ đào tạo', QUALIFICATION_SPLIT],
    ['DT', 'Độ tuổi', ageSplit],
    ['HG', 'Hạng chức danh nghề nghiệp', RANK_SPLIT],
    ['DG', 'Kết quả đánh giá viên chức/công chức (NĐ 90)', EVALUATION_SPLIT],
  ];
  for (const [order, label, prefix, members] of [
    ['3', 'Cán bộ quản lý', '3', managers],
    ['3.1', 'Hiệu trưởng', '3.1', principals],
    ['3.2', 'Phó hiệu trưởng', '3.2', vices],
  ] as const) {
    generalManagers.add(order, label, prefix, 'người', totalFemale(members));
    splits(generalManagers, prefix, members, managerGroups);
  }

  // 2.2.1 thẻ 2. Giáo viên – Nhân viên
  const generalTeachers = new RowList();
  generalTeachers.add('1', 'Số trường', '1', 'trường', { total: input.schools, female: null });
  generalTeachers.add('2', 'Lớp', '2', 'lớp', { total: input.classes, female: null });
  generalTeachers.add('3', 'Số giáo viên', '3', 'người', totalFemale(teachers));
  splits(generalTeachers, '3', teachers, [
    [
      'ND',
      '3.1 Theo nhóm dạy',
      [
        ['Nhà trẻ', (member) => teachesNursery(member, input.institution_type)],
        ['Mẫu giáo', (member) => !teachesNursery(member, input.institution_type)],
      ],
    ],
    ['TD', '3.2 Trình độ đào tạo', QUALIFICATION_SPLIT],
    ['HG', '3.3 Hạng chức danh nghề nghiệp', RANK_SPLIT],
    ['DG', '3.4 Kết quả đánh giá viên chức/công chức (NĐ 90)', EVALUATION_SPLIT],
    [
      'GV',
      '3.5 Giáo viên dạy giỏi',
      [
        ['Cấp trường', (member) => excellentLevelOf(member.excellent_teacher) === 'school'],
        ['Cấp huyện', (member) => excellentLevelOf(member.excellent_teacher) === 'district'],
        ['Cấp tỉnh', (member) => excellentLevelOf(member.excellent_teacher) === 'province'],
        ['Toàn quốc', (member) => excellentLevelOf(member.excellent_teacher) === 'national'],
      ],
    ],
  ]);
  generalTeachers.add('4', 'Nhân viên', '4', 'người', totalFemale(employees));
  const role = (...values: string[]) => (member: StaffReportPerson) => values.includes(employeeRoleOf(member));
  splits(generalTeachers, '4', employees, [
    [
      'VT',
      'Chia theo vị trí',
      [
        ['Văn thư', role('clerk')],
        ['Kế toán', role('accountant')],
        ['Y tế', role('medical')],
        ['Thủ quỹ', role('treasurer')],
        ['Khác', (member) => !['clerk', 'accountant', 'medical', 'treasurer'].includes(employeeRoleOf(member))],
      ],
    ],
  ]);

  // 2.2.2 Ngoại ngữ – tin học
  const hasLanguage = (member: StaffReportPerson) =>
    [member.language_framework_level, member.language_certificate_type, member.main_foreign_language].some(
      (value) => fold(value) !== '' && !['khong', 'khong co', 'chua co'].includes(fold(value)),
    );
  const frameworkSplit: Split = [
    ...[1, 2, 3, 4, 5, 6].map((step): [string, (member: StaffReportPerson) => boolean] => [
      `Bậc ${step}`,
      (member) => frameworkStepOf(member.language_framework_level) === step,
    ]),
    ['Khác', (member) => hasLanguage(member) && frameworkStepOf(member.language_framework_level) === null],
  ];
  const itText = (member: StaffReportPerson) => fold(member.it_level);
  const itPresent = (member: StaffReportPerson) => itText(member) !== '' && itText(member) !== 'khong';
  const skillsManagers = new RowList();
  for (const [order, label, members] of [
    ['1', 'Cán bộ quản lý', managers],
    ['2', 'Hiệu trưởng', principals],
    ['3', 'Phó hiệu trưởng', vices],
  ] as const) {
    skillsManagers.add(order, label, order, 'người', totalFemale(members));
    splits(skillsManagers, order, members, [
      ['NN', 'Trình độ ngoại ngữ: chứng chỉ theo khung năng lực 6 bậc', frameworkSplit],
      [
        'TH',
        'Trình độ tin học: chứng chỉ',
        [
          ['Cơ bản', (member) => itText(member).includes('co ban')],
          ['Nâng cao', (member) => itText(member).includes('nang cao')],
          [
            'Khác',
            (member) => itPresent(member) && !itText(member).includes('co ban') && !itText(member).includes('nang cao'),
          ],
        ],
      ],
    ]);
  }
  const skillsTeachers = new RowList();
  skillsTeachers.add('1', 'Giáo viên', '1', 'người', totalFemale(teachers));
  const languageTraining = (level: string) => (member: StaffReportPerson) =>
    trainingLevelOf(member.language_training_level) === level;
  const itTraining = (level: string) => (member: StaffReportPerson) => trainingLevelOf(member.it_level) === level;
  splits(skillsTeachers, '1', teachers, [
    [
      'NNDT',
      'Trình độ ngoại ngữ: đào tạo',
      [
        ['Trên đại học', languageTraining('postgraduate')],
        ['Đại học', languageTraining('university')],
        ['Cao đẳng', languageTraining('college')],
        ['Khác', (member) => ['intermediate', 'other'].includes(trainingLevelOf(member.language_training_level) ?? '')],
      ],
    ],
    ['NN', 'Trình độ ngoại ngữ: chứng chỉ theo khung năng lực 6 bậc', frameworkSplit],
    [
      'TH',
      'Trình độ tin học',
      [
        ['Trên đại học', itTraining('postgraduate')],
        ['Đại học', itTraining('university')],
        ['Cao đẳng', itTraining('college')],
        ['Trung cấp', itTraining('intermediate')],
        ['Chứng chỉ: Cơ bản', (member) => itText(member).includes('co ban')],
        ['Chứng chỉ: Nâng cao', (member) => itText(member).includes('nang cao')],
        [
          'Khác',
          (member) =>
            trainingLevelOf(member.it_level) === 'other' &&
            !itText(member).includes('co ban') &&
            !itText(member).includes('nang cao'),
        ],
      ],
    ],
  ]);

  // 2.2.3 Chuẩn nghề nghiệp: xếp loại chung và từng tiêu chí; tự đánh giá là mức của người được đánh giá (xếp loại chung tính
  // theo cách xếp loại của phiếu), cấp trên đánh giá là mức của người đánh giá
  const levelValues = (levels: Array<string | null>): EmisValues => {
    const known = levels.filter((level): level is string => level !== null);
    const count = (level: string) => known.filter((value) => value === level).length;
    return {
      total: known.length,
      excellent: count('excellent'),
      good: count('good'),
      met: count('met'),
      not_met: count('not_met'),
    };
  };
  const standardBlock = (
    list: RowList,
    order: string,
    label: string,
    evaluations: StaffEvaluation[],
    by: 'self' | 'assessor',
    criteria: number,
  ) => {
    list.heading(order, label);
    const overall = evaluations.map((evaluation) => {
      if (by === 'assessor') {
        return evaluation.overall_level;
      }
      const ratings = evaluation.items.filter((item) => item.self_rating !== null);
      return ratings.length === 0
        ? null
        : overallLevel(ratings.map((item) => ({ rating: item.self_rating!, isKey: item.is_key })));
    });
    list.add('', '– Xếp loại chung', `${order}.0`, 'người', levelValues(overall));
    for (let index = 1; index <= criteria; index += 1) {
      list.add(
        '',
        `– Tiêu chí ${index}`,
        `${order}.${index}`,
        'người',
        levelValues(
          evaluations.map((evaluation) => {
            const item = [...evaluation.items].sort((a, b) => a.order_no - b.order_no)[index - 1];
            return (by === 'self' ? item?.self_rating : item?.assessor_rating) ?? null;
          }),
        ),
      );
    }
  };
  const principalEvaluations = input.evaluations.filter((evaluation) => evaluation.standard_type === 'principal');
  const teacherEvaluations = input.evaluations.filter((evaluation) => evaluation.standard_type === 'teacher');
  const blank = { total: null, excellent: null, good: null, met: null, not_met: null };
  const standardsManagers = new RowList();
  standardsManagers.add('1', 'Tổng số lớp', '1', 'lớp', { ...blank, total: input.classes });
  standardBlock(
    standardsManagers,
    '2.1',
    'Hiệu trưởng tự đánh giá theo chuẩn',
    principalEvaluations.filter((evaluation) => !evaluation.vice),
    'self',
    18,
  );
  standardBlock(
    standardsManagers,
    '2.2',
    'Phó hiệu trưởng tự đánh giá theo chuẩn',
    principalEvaluations.filter((evaluation) => evaluation.vice),
    'self',
    18,
  );
  standardBlock(
    standardsManagers,
    '2.3',
    'Cấp trên đánh giá Phó hiệu trưởng',
    principalEvaluations.filter((evaluation) => evaluation.vice),
    'assessor',
    18,
  );
  const standardsTeachers = new RowList();
  standardsTeachers.add('1', 'Lớp', '1', 'lớp', { ...blank, total: input.classes });
  standardsTeachers.add('2', 'Giáo viên', '2', 'người', { ...blank, total: teachers.length });
  standardBlock(standardsTeachers, '2.1', 'Giáo viên tự đánh giá theo chuẩn', teacherEvaluations, 'self', 15);
  standardBlock(standardsTeachers, '2.2', 'Cấp trên đánh giá giáo viên', teacherEvaluations, 'assessor', 15);

  return {
    general_managers: generalManagers.rows,
    general_teachers: generalTeachers.rows,
    skills_managers: skillsManagers.rows,
    skills_teachers: skillsTeachers.rows,
    standards_managers: standardsManagers.rows,
    standards_teachers: standardsTeachers.rows,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2.3 Đề án ngoại ngữ: năm chỉ tiêu của Sở; chỉ tiêu 1 đến 4 máy chủ tính, chỉ tiêu 5 nhập tay vào cột Tổng số. Trẻ được làm
// quen tiếng Anh là trẻ mẫu giáo của trường có đánh dấu "Cho trẻ làm quen tiếng Anh" ở hồ sơ trường (hệ thống chưa ghi việc
// làm quen tiếng Anh theo từng trẻ; Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11)
export const FOREIGN_LANGUAGE_ROWS = [
  { code: '1', order: '1', label: 'Tổng số trường mầm non', unit: 'trường', computed: true },
  {
    code: '2',
    order: '2',
    label: 'Số trường mầm non triển khai cho trẻ mẫu giáo làm quen với tiếng Anh',
    unit: 'trường',
    computed: true,
  },
  { code: '3', order: '3', label: 'Tổng số trẻ mầm non', unit: 'trẻ', computed: true },
  { code: '4', order: '4', label: 'Số trẻ mầm non được làm quen với tiếng Anh', unit: 'trẻ', computed: true },
  { code: '5', order: '5', label: 'Số giáo viên tham gia cho trẻ làm quen với tiếng Anh', unit: 'người' },
];

export function fillForeignLanguage(input: {
  english_familiarization: boolean;
  children: number;
  kindergarten_children: number;
}): Record<string, EmisValues> {
  return {
    '1': { total: 1 },
    '2': { total: input.english_familiarization ? 1 : 0 },
    '3': { total: input.children },
    '4': { total: input.english_familiarization ? input.kindergarten_children : 0 },
  };
}
