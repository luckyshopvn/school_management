import type { AttendanceStatus } from '@school-management/database';
import { dayOfWeek } from '../attendance/school-calendar.js';

// Điểm danh và suất ăn theo ngày, tuần, tháng (DT-13 phần 13c, YCTD-100). Các hàm thuần tính loại ngày, mã vắng của từng
// trẻ, số liệu từng lớp từng ngày và nhóm theo khối; dịch vụ đọc dữ liệu rồi gọi các hàm này để màn hình, tệp Excel và
// màn hình suất ăn của bếp dùng cùng một con số

// Mã loại ngày theo bảng "Data" của mẫu điểm danh: ngày học và ngày học bù tính là ngày ăn, còn lại không tính
export type DayCode = 'NH' | 'HB' | 'T7' | 'CN' | 'NL' | 'NB' | 'NK';
export const DAY_CODES: Array<{ code: DayCode; label: string; counted: 0 | 1 }> = [
  { code: 'NH', label: 'Ngày học', counted: 1 },
  { code: 'HB', label: 'Ngày học bù', counted: 1 },
  { code: 'T7', label: 'Thứ Bảy', counted: 0 },
  { code: 'CN', label: 'Chủ Nhật', counted: 0 },
  { code: 'NL', label: 'Ngày lễ, Tết', counted: 0 },
  { code: 'NB', label: 'Ngày nghỉ bù', counted: 0 },
  { code: 'NK', label: 'Ngày nghỉ khác', counted: 0 },
];
const WEEKDAY_SHORT = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_LONG = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

// Mã của trẻ trong ngày theo mẫu bảng điểm danh lớp: trống là có mặt; P nghỉ có phép, K nghỉ không phép, B nghỉ bệnh;
// N là ngày không tính với trẻ (ngày nghỉ trong tuần làm việc hoặc trẻ chưa vào lớp, đã rời lớp, không học hè); "?" là
// ngày đã qua mà lớp chưa điểm danh trẻ; ngày chưa tới để trống và không tính
export type ChildDayCode = '' | 'P' | 'K' | 'B' | 'N' | '?' | 'future' | 'off';

export const PRESENT_STATUSES: AttendanceStatus[] = ['present', 'late', 'early_leave', 'late_and_early_leave'];

export interface CalendarInput {
  schoolDaysOfWeek: number[];
  terms: Array<{ start_date: string; end_date: string; term_type: string }>;
  offWeeks: Array<{ start_date: string; end_date: string }>;
  holidays: Array<{ holiday_date: string; name: string }>;
  changes: Array<{ change_date: string; change_type: 'makeup_school_day' | 'compensatory_day_off' }>;
}

export interface ReportDay {
  date: string;
  weekday: string;
  weekday_long: string;
  code: DayCode;
  counted: 0 | 1;
  holiday_name: string | null;
  summer: boolean;
  // Ngày đã tới (đến hết hôm nay); ngày chưa tới không tính vào tổng
  passed: boolean;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

// Khoảng ngày của kỳ: một ngày; tuần từ thứ hai đến chủ nhật chứa ngày chọn; tháng chứa ngày chọn
export type Period = 'day' | 'week' | 'month';
export function periodRange(period: Period, date: string): { from: string; to: string } {
  if (period === 'day') {
    return { from: date, to: date };
  }
  if (period === 'week') {
    const from = addDays(date, 1 - dayOfWeek(date));
    return { from, to: addDays(from, 6) };
  }
  const from = `${date.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 1));
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

// Phân loại ngày (YCTD-100): thứ bảy học bù là HB; ngày không học trong tuần là T7, CN (hoặc NK nếu là ngày thường không
// học); ngày lễ NL; ngày nghỉ bù NB; ngoài các học kỳ hoặc thuộc tuần nghỉ là NK; còn lại là ngày học NH. Thứ tự giống công
// thức của mẫu: thứ bảy, chủ nhật đứng trước ngày lễ
export function classifyDay(date: string, calendar: CalendarInput, today: string): ReportDay {
  const dow = dayOfWeek(date);
  const holiday = calendar.holidays.find((row) => row.holiday_date === date) ?? null;
  const change = calendar.changes.find((row) => row.change_date === date)?.change_type;
  const term = calendar.terms.find((row) => row.start_date <= date && row.end_date >= date);
  let code: DayCode;
  if (change === 'makeup_school_day' && !holiday) {
    code = 'HB';
  } else if (!calendar.schoolDaysOfWeek.includes(dow)) {
    code = dow === 7 ? 'CN' : dow === 6 ? 'T7' : 'NK';
  } else if (holiday) {
    code = 'NL';
  } else if (change === 'compensatory_day_off') {
    code = 'NB';
  } else if (!term || calendar.offWeeks.some((week) => week.start_date <= date && week.end_date >= date)) {
    code = 'NK';
  } else {
    code = 'NH';
  }
  return {
    date,
    weekday: WEEKDAY_SHORT[dow] ?? '',
    weekday_long: WEEKDAY_LONG[dow] ?? '',
    code,
    counted: code === 'NH' || code === 'HB' ? 1 : 0,
    holiday_name: holiday?.name ?? null,
    summer: term?.term_type === 'summer_term',
    passed: date <= today,
  };
}

// Lý do có từ khóa bệnh thì là nghỉ bệnh B. Hệ thống không có trường riêng cho nghỉ bệnh nên suy từ lý do báo vắng của
// phụ huynh, giáo viên và ghi chú điểm danh
const ILLNESS_KEYWORDS = [
  'ốm',
  'bệnh',
  'sốt',
  'ho',
  'cảm',
  'cúm',
  'viêm',
  'tiêu chảy',
  'nôn',
  'ói',
  'sổ mũi',
  'đau',
  'tay chân miệng',
  'thủy đậu',
  'thuỷ đậu',
  'sởi',
  'nhập viện',
  'nằm viện',
];

export function isIllnessReason(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  const normalized = ` ${text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return ILLNESS_KEYWORDS.some((keyword) => normalized.includes(` ${keyword} `));
}

// Mã vắng (YCTD-100): vắng có lý do bệnh là B; vắng có báo (điểm danh "vắng có báo" hoặc có báo vắng trước giờ học mà lớp
// chưa điểm danh) là P; vắng không báo là K
export function absenceCode(
  status: AttendanceStatus | null,
  note: string | null,
  absence: { reason: string | null; is_advised: boolean } | null,
): 'P' | 'K' | 'B' | null {
  if (status && PRESENT_STATUSES.includes(status)) {
    return null;
  }
  if (status === null && !absence) {
    return null;
  }
  if (isIllnessReason(note) || isIllnessReason(absence?.reason)) {
    return 'B';
  }
  if (status === 'absent_notified' || (status === null && absence?.is_advised)) {
    return 'P';
  }
  // Vắng không báo, hoặc báo vắng sau giờ bắt đầu học mà lớp chưa điểm danh (báo muộn, BR-13)
  return 'K';
}

export interface ChildRoll {
  child_id: string;
  full_name: string;
  status: string;
  enrollments: Array<{ class_id: string; from_date: string; to_date: string | null }>;
}

export interface AttendanceRow {
  child_id: string;
  class_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
}

export interface AbsenceRow {
  child_id: string;
  absence_date: string;
  reason: string | null;
  is_advised: boolean;
}

export interface ReportInput {
  days: ReportDay[];
  classes: Array<{
    id: string;
    name: string;
    org_unit_id: string;
    grade_level: string;
    status: string;
  }>;
  gradeLevels: Array<{ code: string; name: string; age_from_months: number; order_no: number }>;
  children: ChildRoll[];
  attendance: AttendanceRow[];
  absences: AbsenceRow[];
  // Trẻ đã đăng ký học hè theo tháng YYYY-MM (BR-92)
  summerChildren: Map<string, Set<string>>;
}

export interface DayCounts {
  date: string;
  enrolled: number;
  expected: number;
  present: number;
  absent: number;
  absent_p: number;
  absent_k: number;
  absent_b: number;
  unmarked: number;
  meal_count: number;
  // Trẻ chưa điểm danh và không báo vắng của ngày hôm nay: bếp dự tính thêm số suất này
  pending: number;
}

export interface Totals {
  enrolled: number;
  expected: number;
  present: number;
  absent: number;
  absent_p: number;
  absent_k: number;
  absent_b: number;
  unmarked: number;
  meal_count: number;
  rate_percent: number | null;
}

export interface ClassReport extends Totals {
  class_id: string;
  class_name: string;
  org_unit_id: string;
  grade_level: string;
  grade_level_name: string;
  stage: 'nha_tre' | 'mau_giao';
  days: DayCounts[];
}

export interface GroupReport extends Totals {
  kind: 'grade' | 'stage' | 'school';
  key: string;
  label: string;
  class_ids: string[];
  days: DayCounts[];
}

export interface ChildMatrixRow {
  child_id: string;
  full_name: string;
  codes: Record<string, ChildDayCode>;
  present: number;
  absent: number;
  absent_b: number;
  expected: number;
  rate_percent: number | null;
}

const ROLL_STATUSES = new Set(['active', 'withdrawn', 'graduated']);

function emptyDay(date: string): DayCounts {
  return {
    date,
    enrolled: 0,
    expected: 0,
    present: 0,
    absent: 0,
    absent_p: 0,
    absent_k: 0,
    absent_b: 0,
    unmarked: 0,
    meal_count: 0,
    pending: 0,
  };
}

export function ratePercent(present: number, expected: number): number | null {
  return expected > 0 ? Math.round((present * 10_000) / expected) / 100 : null;
}

// Tổng của kỳ: chỉ cộng các ngày ăn đã tới; sĩ số là sĩ số của ngày tham chiếu (hôm nay hoặc ngày cuối kỳ nếu kỳ đã qua)
function sumDays(days: DayCounts[], reportDays: ReportDay[], referenceDate: string): Totals {
  const totals: Totals = {
    enrolled: days.find((day) => day.date === referenceDate)?.enrolled ?? 0,
    expected: 0,
    present: 0,
    absent: 0,
    absent_p: 0,
    absent_k: 0,
    absent_b: 0,
    unmarked: 0,
    meal_count: 0,
    rate_percent: null,
  };
  for (const day of days) {
    const info = reportDays.find((item) => item.date === day.date);
    if (!info?.counted || !info.passed) {
      continue;
    }
    totals.expected += day.expected;
    totals.present += day.present;
    totals.absent += day.absent;
    totals.absent_p += day.absent_p;
    totals.absent_k += day.absent_k;
    totals.absent_b += day.absent_b;
    totals.unmarked += day.unmarked;
    totals.meal_count += day.meal_count;
  }
  totals.rate_percent = ratePercent(totals.present, totals.expected);
  return totals;
}

// Ngày tham chiếu cho sĩ số: hôm nay nếu thuộc kỳ, ngày cuối kỳ nếu kỳ đã qua, ngày đầu kỳ nếu kỳ chưa tới
export function referenceDate(days: ReportDay[]): string {
  const passed = days.filter((day) => day.passed);
  return (passed.at(-1) ?? days[0])?.date ?? '';
}

// Mã của từng trẻ thuộc lớp trong từng ngày của kỳ; trẻ thuộc lớp trong ngày theo quá trình lớp (từ ngày vào lớp đến trước
// ngày rời lớp) hoặc có bản ghi điểm danh của lớp trong ngày đó
export function childMatrix(input: ReportInput, classId: string): ChildMatrixRow[] {
  const attendance = new Map(input.attendance.map((row) => [`${row.child_id}|${row.attendance_date}`, row]));
  const absences = new Map(input.absences.map((row) => [`${row.child_id}|${row.absence_date}`, row]));
  const rows: ChildMatrixRow[] = [];
  for (const child of input.children) {
    const codes: Record<string, ChildDayCode> = {};
    let belongs = false;
    let present = 0;
    let absent = 0;
    let sick = 0;
    let expected = 0;
    for (const day of input.days) {
      const record = attendance.get(`${child.child_id}|${day.date}`);
      const onRoll = record
        ? record.class_id === classId
        : child.enrollments.some(
            (enrollment) =>
              enrollment.class_id === classId &&
              enrollment.from_date <= day.date &&
              (enrollment.to_date === null || day.date < enrollment.to_date),
          ) &&
          ROLL_STATUSES.has(child.status) &&
          (!day.summer || input.summerChildren.get(day.date.slice(0, 7))?.has(child.child_id) === true);
      if (onRoll) {
        belongs = true;
      }
      if (!day.counted) {
        codes[day.date] = day.code === 'T7' || day.code === 'CN' ? 'off' : 'N';
        continue;
      }
      if (!onRoll) {
        codes[day.date] = 'N';
        continue;
      }
      if (!day.passed) {
        codes[day.date] = 'future';
        continue;
      }
      expected += 1;
      const absence = absences.get(`${child.child_id}|${day.date}`) ?? null;
      const code = absenceCode(record?.status ?? null, record?.note ?? null, absence);
      if (record && PRESENT_STATUSES.includes(record.status)) {
        codes[day.date] = '';
        present += 1;
      } else if (code) {
        codes[day.date] = code;
        absent += 1;
        sick += code === 'B' ? 1 : 0;
      } else {
        codes[day.date] = '?';
      }
    }
    if (belongs) {
      rows.push({
        child_id: child.child_id,
        full_name: child.full_name,
        codes,
        present,
        absent,
        absent_b: sick,
        expected,
        rate_percent: ratePercent(present, expected),
      });
    }
  }
  return rows.sort((left, right) => left.full_name.localeCompare(right.full_name, 'vi', { numeric: true }));
}

// Số liệu từng ngày của một lớp từ ma trận mã của trẻ
export function classDays(input: ReportInput, matrix: ChildMatrixRow[]): DayCounts[] {
  return input.days.map((day) => {
    const counts = emptyDay(day.date);
    for (const row of matrix) {
      const code = row.codes[day.date];
      if (code === undefined || code === 'N' || code === 'off') {
        continue;
      }
      counts.enrolled += 1;
      if (code === 'future') {
        continue;
      }
      counts.expected += 1;
      if (code === '') {
        counts.present += 1;
        counts.meal_count += 1;
      } else if (code === '?') {
        counts.unmarked += 1;
        counts.pending += 1;
      } else {
        counts.absent_p += code === 'P' ? 1 : 0;
        counts.absent_k += code === 'K' ? 1 : 0;
        counts.absent_b += code === 'B' ? 1 : 0;
      }
    }
    // Vắng mặt là số lượt phải có mặt trừ số lượt có mặt, gồm cả trẻ chưa điểm danh (công thức của mẫu)
    counts.absent = counts.expected - counts.present;
    return counts;
  });
}

// Sĩ số những ngày không tính (thứ bảy, chủ nhật, nghỉ lễ) vẫn là số trẻ thuộc lớp trong ngày đó
function enrolledOn(children: ChildRoll[], classId: string, date: string): number {
  return children.filter((child) =>
    child.enrollments.some(
      (enrollment) =>
        enrollment.class_id === classId &&
        enrollment.from_date <= date &&
        (enrollment.to_date === null || date < enrollment.to_date),
    ),
  ).length;
}

export function buildReport(input: ReportInput) {
  const reference = referenceDate(input.days);
  const grades = new Map(input.gradeLevels.map((grade) => [grade.code, grade]));
  const classes: ClassReport[] = [];
  const matrices = new Map<string, ChildMatrixRow[]>();
  for (const classRecord of input.classes) {
    const matrix = childMatrix(input, classRecord.id);
    if (matrix.length === 0 && classRecord.status !== 'active') {
      continue;
    }
    matrices.set(classRecord.id, matrix);
    const days = classDays(input, matrix).map((day) => {
      const info = input.days.find((item) => item.date === day.date);
      return info && !info.counted ? { ...day, enrolled: enrolledOn(input.children, classRecord.id, day.date) } : day;
    });
    const grade = grades.get(classRecord.grade_level);
    classes.push({
      class_id: classRecord.id,
      class_name: classRecord.name,
      org_unit_id: classRecord.org_unit_id,
      grade_level: classRecord.grade_level,
      grade_level_name: grade?.name ?? classRecord.grade_level,
      // Nhà trẻ là khối cho trẻ dưới 36 tháng tuổi; còn lại là mẫu giáo
      stage: grade && grade.age_from_months < 36 ? 'nha_tre' : 'mau_giao',
      days,
      ...sumDays(days, input.days, reference),
    });
  }
  const gradeOrder = (code: string) => grades.get(code)?.order_no ?? Number.MAX_SAFE_INTEGER;
  classes.sort(
    (left, right) =>
      (left.stage === right.stage ? 0 : left.stage === 'nha_tre' ? -1 : 1) ||
      gradeOrder(left.grade_level) - gradeOrder(right.grade_level) ||
      left.grade_level.localeCompare(right.grade_level) ||
      left.class_name.localeCompare(right.class_name, 'vi', { numeric: true }),
  );
  const group = (kind: GroupReport['kind'], key: string, label: string, members: ClassReport[]): GroupReport => {
    const days = input.days.map((day) => {
      const counts = emptyDay(day.date);
      for (const member of members) {
        const memberDay = member.days.find((item) => item.date === day.date);
        if (!memberDay) {
          continue;
        }
        for (const field of [
          'enrolled',
          'expected',
          'present',
          'absent',
          'absent_p',
          'absent_k',
          'absent_b',
          'unmarked',
          'meal_count',
          'pending',
        ] as const) {
          counts[field] += memberDay[field];
        }
      }
      return counts;
    });
    return {
      kind,
      key,
      label,
      class_ids: members.map((member) => member.class_id),
      days,
      ...sumDays(days, input.days, reference),
    };
  };
  const groups: GroupReport[] = [];
  for (const stage of ['nha_tre', 'mau_giao'] as const) {
    const members = classes.filter((row) => row.stage === stage);
    if (members.length === 0) {
      continue;
    }
    const gradeCodes = [...new Set(members.map((row) => row.grade_level))];
    if (gradeCodes.length > 1) {
      for (const code of gradeCodes) {
        const gradeMembers = members.filter((row) => row.grade_level === code);
        groups.push(group('grade', code, blockLabel(gradeMembers[0]?.grade_level_name ?? code), gradeMembers));
      }
    }
    groups.push(group('stage', stage, stage === 'nha_tre' ? 'Khối Nhà trẻ' : 'Khối Mẫu giáo', members));
  }
  const school = group('school', 'school', 'Toàn trường', classes);
  return { classes, groups, totals: school, matrices, reference_date: reference };
}

export function blockLabel(name: string): string {
  return /^khối\s/i.test(name) ? name : `Khối ${name}`;
}
