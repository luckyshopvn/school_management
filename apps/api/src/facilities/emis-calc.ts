import type { RoomCondition, SchoolOwnershipType } from '@school-management/shared';
import { isNurseryGroup } from './facility-rules.js';

// Biểu 1 của báo cáo EMIS đầu năm (khảo sát mục 5, dòng 1.1; YCTD-102), tính từ dữ liệu của năm học đang dùng. Hàm thuần,
// không đọc cơ sở dữ liệu. Tên chỉ tiêu là tên Claude suy ra được chắc chắn từ dữ liệu của hệ thống; mã số đánh theo thẻ
// (1.01, 1.02...), không phải mã số của Bộ: cần đối chiếu danh mục chỉ tiêu chính thức trước khi dùng thay biểu của Sở.
// Quy tắc:
// - cột công lập, tư thục, dân lập: cả số của trường vào cột theo loại hình trong hồ sơ trường; chưa khai báo thì để trống;
// - học sinh: trẻ trạng thái đang học; nhà trẻ hay mẫu giáo theo nhóm tuổi của lớp hiện tại, chưa có lớp thì theo tuổi;
// - tuổi = năm bắt đầu năm học − năm sinh;
// - dân tộc thiểu số: có ghi dân tộc (từ tệp CSDL ngành) và không phải dân tộc Kinh;
// - khuyết tật: có ghi loại khuyết tật khác "Không";
// - đội ngũ: nhân sự đang làm việc; cán bộ quản lý, giáo viên, nhân viên theo nhóm chức vụ của tệp CSDL ngành, không có thì
//   theo tên chức danh (có "hiệu trưởng" là cán bộ quản lý, có "giáo viên" là giáo viên, còn lại là nhân viên)
export interface EmisChild {
  gender: 'male' | 'female';
  birth_year: number;
  age_group: string | null;
  ethnicity: string | null;
  disability: string | null;
}

export interface EmisStaff {
  gender: 'male' | 'female' | null;
  ethnicity: string | null;
  position_group: string | null;
  job_title: string | null;
  party_member: boolean;
}

export interface EmisRoom {
  room_type: string | null;
  condition: RoomCondition | string | null;
  area_m2: number | null;
}

export interface EmisInput {
  ownership: SchoolOwnershipType | null;
  startYear: number;
  units: Array<{ unit_type: string }>;
  classes: Array<{ age_group: string | null }>;
  children: EmisChild[];
  staff: EmisStaff[];
  rooms: EmisRoom[];
}

export interface EmisRow {
  code: string;
  label: string;
  unit: string;
  total: number;
  public: number | null;
  private: number | null;
  people_founded: number | null;
  female: number | null;
  ethnic_minority: number | null;
}

export interface EmisTab {
  key: string;
  label: string;
  rows: EmisRow[];
}

const normalize = (value: string | null) => (value ?? '').trim().toLowerCase().normalize('NFC');

export function isEthnicMinority(ethnicity: string | null): boolean {
  const value = normalize(ethnicity);
  return value !== '' && value !== 'kinh' && value !== 'dân tộc kinh';
}

export function hasDisability(disability: string | null): boolean {
  const value = normalize(disability);
  return value !== '' && !['không', 'khong', 'không có', 'không khuyết tật'].includes(value);
}

export function staffCategory(
  staff: Pick<EmisStaff, 'position_group' | 'job_title'>,
): 'manager' | 'teacher' | 'employee' {
  const group = normalize(staff.position_group);
  if (group) {
    if (group.includes('quản lý') || group.includes('hiệu trưởng')) {
      return 'manager';
    }
    if (group.includes('giáo viên')) {
      return 'teacher';
    }
    if (group.includes('nhân viên')) {
      return 'employee';
    }
  }
  const title = normalize(staff.job_title);
  if (title.includes('hiệu trưởng')) {
    return 'manager';
  }
  if (title.includes('giáo viên')) {
    return 'teacher';
  }
  return 'employee';
}

export function childIsNursery(child: Pick<EmisChild, 'age_group' | 'birth_year'>, startYear: number): boolean {
  if (child.age_group) {
    return isNurseryGroup(child.age_group);
  }
  return startYear - child.birth_year < 3;
}

export function buildEmisStartOfYear(input: EmisInput): { tabs: EmisTab[]; warnings: string[] } {
  const row = (
    code: string,
    label: string,
    unit: string,
    total: number,
    people?: { female: number; ethnic_minority: number },
  ): EmisRow => ({
    code,
    label,
    unit,
    total,
    public: input.ownership === null ? null : input.ownership === 'public' ? total : 0,
    private: input.ownership === null ? null : input.ownership === 'private' ? total : 0,
    people_founded: input.ownership === null ? null : input.ownership === 'people_founded' ? total : 0,
    female: people ? people.female : null,
    ethnic_minority: people ? people.ethnic_minority : null,
  });
  const childCount = (children: EmisChild[]) => ({
    female: children.filter((child) => child.gender === 'female').length,
    ethnic_minority: children.filter((child) => isEthnicMinority(child.ethnicity)).length,
  });
  const staffCount = (staff: EmisStaff[]) => ({
    female: staff.filter((member) => member.gender === 'female').length,
    ethnic_minority: staff.filter((member) => isEthnicMinority(member.ethnicity)).length,
  });

  const nurseryClasses = input.classes.filter((item) => item.age_group !== null && isNurseryGroup(item.age_group));
  const kindergartenClasses = input.classes.filter(
    (item) => item.age_group !== null && !isNurseryGroup(item.age_group),
  );
  const unclassified = input.classes.filter((item) => item.age_group === null);
  const schoolTab: EmisTab = {
    key: 'school_classes',
    label: 'Trường – lớp học',
    rows: [
      row('1.01', 'Số trường', 'Trường', input.units.some((unit) => unit.unit_type === 'truong_chinh') ? 1 : 0),
      row('1.02', 'Số phân hiệu', 'Phân hiệu', input.units.filter((unit) => unit.unit_type === 'phan_hieu').length),
      row(
        '1.03',
        'Số điểm trường',
        'Điểm trường',
        input.units.filter((unit) => unit.unit_type === 'diem_truong').length,
      ),
      row('1.04', 'Tổng số nhóm, lớp', 'Nhóm, lớp', input.classes.length),
      row('1.05', 'Nhóm trẻ (nhà trẻ)', 'Nhóm', nurseryClasses.length),
      row('1.06', 'Lớp mẫu giáo', 'Lớp', kindergartenClasses.length),
      row(
        '1.07',
        'Trong đó: lớp mẫu giáo 5–6 tuổi',
        'Lớp',
        kindergartenClasses.filter((item) => item.age_group === 'mg_5_6').length,
      ),
      row('1.08', 'Nhóm, lớp chưa xếp được nhóm tuổi', 'Nhóm, lớp', unclassified.length),
    ],
  };

  const nurseryChildren = input.children.filter((child) => childIsNursery(child, input.startYear));
  const kindergartenChildren = input.children.filter((child) => !childIsNursery(child, input.startYear));
  const fiveToSix = kindergartenChildren.filter((child) =>
    child.age_group ? child.age_group === 'mg_5_6' : input.startYear - child.birth_year === 5,
  );
  const disabled = input.children.filter((child) => hasDisability(child.disability));
  const childrenTab: EmisTab = {
    key: 'children',
    label: 'Học sinh',
    rows: [
      row('2.01', 'Tổng số học sinh', 'Học sinh', input.children.length, childCount(input.children)),
      row('2.02', 'Học sinh nhà trẻ', 'Học sinh', nurseryChildren.length, childCount(nurseryChildren)),
      row('2.03', 'Học sinh mẫu giáo', 'Học sinh', kindergartenChildren.length, childCount(kindergartenChildren)),
      row('2.04', 'Trong đó: mẫu giáo 5–6 tuổi', 'Học sinh', fiveToSix.length, childCount(fiveToSix)),
      row('2.05', 'Học sinh khuyết tật học hòa nhập', 'Học sinh', disabled.length, childCount(disabled)),
    ],
  };

  const ageRows: EmisRow[] = [];
  for (let age = 0; age <= 6; age += 1) {
    const children = input.children.filter((child) => {
      const value = Math.max(0, input.startYear - child.birth_year);
      return age === 6 ? value >= 6 : value === age;
    });
    const label =
      age === 0
        ? `Dưới 1 tuổi (sinh năm ${input.startYear})`
        : age === 6
          ? `Từ 6 tuổi trở lên (sinh năm ${input.startYear - 6} trở về trước)`
          : `${age} tuổi (sinh năm ${input.startYear - age})`;
    ageRows.push(row(`3.0${age + 1}`, label, 'Học sinh', children.length, childCount(children)));
  }
  const ageTab: EmisTab = { key: 'children_by_age', label: 'Học sinh theo độ tuổi', rows: ageRows };

  const byCategory = (category: 'manager' | 'teacher' | 'employee') =>
    input.staff.filter((member) => staffCategory(member) === category);
  const managers = byCategory('manager');
  const teachers = byCategory('teacher');
  const employees = byCategory('employee');
  const party = input.staff.filter((member) => member.party_member);
  const staffTab: EmisTab = {
    key: 'staff',
    label: 'Đội ngũ',
    rows: [
      row('4.01', 'Tổng số cán bộ quản lý, giáo viên, nhân viên', 'Người', input.staff.length, staffCount(input.staff)),
      row('4.02', 'Cán bộ quản lý', 'Người', managers.length, staffCount(managers)),
      row('4.03', 'Giáo viên', 'Người', teachers.length, staffCount(teachers)),
      row('4.04', 'Nhân viên', 'Người', employees.length, staffCount(employees)),
      row('4.05', 'Trong tổng số: đảng viên', 'Người', party.length, staffCount(party)),
    ],
  };

  const rooms = input.rooms;
  const byCondition = (condition: string | null) =>
    rooms.filter((room) => (room.condition ?? null) === condition).length;
  const byType = (type: string) => rooms.filter((room) => room.room_type === type).length;
  const area = Math.round(rooms.reduce((sum, room) => sum + (room.area_m2 ?? 0), 0) * 100) / 100;
  const roomTab: EmisTab = {
    key: 'rooms',
    label: 'Phòng học',
    rows: [
      row('5.01', 'Tổng số phòng', 'Phòng', rooms.length),
      row('5.02', 'Kiên cố', 'Phòng', byCondition('permanent')),
      row('5.03', 'Bán kiên cố', 'Phòng', byCondition('semi_permanent')),
      row('5.04', 'Tạm', 'Phòng', byCondition('temporary')),
      row('5.05', 'Nhờ, mượn, thuê', 'Phòng', byCondition('borrowed')),
      row('5.06', 'Chưa khai báo hiện trạng', 'Phòng', byCondition(null)),
      row('5.07', 'Phòng sinh hoạt chung (phòng học)', 'Phòng', byType('group_room')),
      row('5.08', 'Phòng giáo dục thể chất', 'Phòng', byType('physical_education')),
      row('5.09', 'Phòng giáo dục nghệ thuật', 'Phòng', byType('arts_education')),
      row('5.10', 'Bếp ăn', 'Phòng', byType('kitchen')),
      row('5.11', 'Tổng diện tích các phòng', 'm²', area),
    ],
  };

  const warnings: string[] = [];
  if (input.ownership === null) {
    warnings.push('Chưa khai báo loại hình trường trong hồ sơ trường: cột công lập, tư thục, dân lập để trống');
  }
  if (unclassified.length > 0) {
    warnings.push(`${unclassified.length} nhóm, lớp có khối không có trong danh mục bậc học, chưa xếp được nhóm tuổi`);
  }
  if (rooms.some((room) => !room.condition)) {
    warnings.push('Có phòng chưa khai báo hiện trạng trong 1.1 Khai báo cơ sở vật chất');
  }
  warnings.push('Mã số và tên chỉ tiêu do hệ thống đặt, cần đối chiếu danh mục chỉ tiêu EMIS chính thức trước khi nộp');
  return { tabs: [schoolTab, childrenTab, ageTab, staffTab, roomTab], warnings };
}
