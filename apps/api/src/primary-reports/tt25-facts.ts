import type { SchoolYearDatabase } from '@school-management/database';
import { foldCatalogText, type FormulaFacts, type OwnershipGroup } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { contractOf, employeeRoleOf, isPrincipal, rankOf } from '../emis/emis-01-calc.js';
import { hasDisability, isEthnicMinority, staffCategory } from '../facilities/emis-calc.js';
import { profileText } from '../statistics/statistics-calc.js';
import type { PrimaryClassRow, PrimaryStudentRow } from './primary-facts.js';

// Số liệu nền của biểu Thông tư 25/2024 (YCTD-385 lát L1), thêm vào số liệu lớp, học sinh của 20f:
// - tuổi theo năm sinh: năm đầu của năm học trừ năm sinh (quyết định của Eric ngày 2026-10-30, Q-385-3);
// - lưu ban năm trước: kết quả "Ở lại lớp" của học sinh ở cơ sở dữ liệu năm học trước (mã học sinh giữ nguyên khi mở năm học,
//   AI-41); năm học đầu tiên trên hệ thống thì không có ai; mới tuyển đầu cấp là học sinh lớp 1 không lưu ban;
// - dạng khuyết tật so khớp chữ ở ô "Loại khuyết tật" của hồ sơ CSDL ngành (ô chữ tự do, chưa có danh mục), không khớp là "khác";
// - trường: cờ ở "Thông tin khác" của hồ sơ trường, mức chuẩn quốc gia; điểm trường đang hoạt động;
// - đội ngũ: đang làm việc, cộng người nghỉ hưu, nghỉ hoặc chuyển đi trong năm học (chỉ đếm ở dòng nghỉ hưu, nghỉ, chuyển đi);
//   trường nhiều cấp: giáo viên đếm ở cấp có lớp được phân công, người không dạy lớp nào đếm ở cấp thấp nhất của trường. Claude tự
//   chọn theo ủy quyền của Eric ngày 2026-10-11;
// - phòng học tập: phòng học là phòng gắn với lớp đang học của cấp; phòng đa chức năng theo loại phòng; cột kiên cố, bán kiên cố,
//   tạm theo hiện trạng; phòng nhờ, mượn không xếp được cột cấp công trình;
// - học sinh rời trường trong năm học: thôi học (bỏ học) và chuyển đi ngoài tỉnh đã duyệt
const fold = (value: string | null | undefined) => foldCatalogText(value ?? '');

const DISABILITY_RULES: Array<[RegExp, string]> = [
  [/nhin|thi giac|khiem thi|mu\b/, 'vision'],
  [/nghe|noi|thinh|cam\b|diec/, 'hearing_speech'],
  [/tri tue|tu duy|chan phat trien/, 'intellectual'],
  [/van dong/, 'mobility'],
  [/than kinh|tam than|tu ky/, 'neuro_mental'],
];

export function disabilityKindOf(text: string | null): string | null {
  if (!hasDisability(text)) {
    return null;
  }
  const value = fold(text);
  return DISABILITY_RULES.find(([pattern]) => pattern.test(value))?.[1] ?? 'other';
}

// Vị trí việc làm theo Thông tư 25/2024: theo danh mục Bộ ở hồ sơ (ô "Vị trí việc làm"), không có thì theo tên chức danh
const JOB_RULES: Array<[string, string]> = [
  ['giao vu', 'academic_affairs'],
  ['tu van', 'counselor'],
  ['quan tri cong so', 'office_management'],
  ['cong nghe thong tin', 'information_technology'],
  ['an toan thong tin', 'information_technology'],
];
const ROLE_TO_JOB: Record<string, string> = {
  clerk: 'clerical',
  accountant: 'accounting',
  treasurer: 'treasurer',
  librarian: 'library',
  medical: 'health',
  cook: 'cook',
  service: 'service',
  guard: 'security',
  disability_support: 'disability_support',
  other: 'other_staff',
};

export function staffJobOf(jobPosition: string | null, jobTitle: string | null): string {
  const value = fold(jobPosition) || fold(jobTitle);
  const rule = JOB_RULES.find(([text]) => value.includes(text));
  return rule ? rule[1] : ROLE_TO_JOB[employeeRoleOf({ job_position: jobPosition, job_title: jobTitle })]!;
}

export function ageBandOf(age: number | null): string | null {
  if (age === null || age < 20) {
    return null;
  }
  if (age >= 60) {
    return '60';
  }
  const from = Math.floor(age / 10) * 10;
  return `${from}_${from + 9}`;
}

const yearOf = (value: unknown): number | null => {
  const text = value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : '';
  const year = Number(text.slice(0, 4));
  return Number.isInteger(year) && year > 1900 ? year : null;
};
const dateText = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value.slice(0, 10) : null;

export interface Tt25Context {
  database: Kysely<SchoolYearDatabase>;
  previous: Kysely<SchoolYearDatabase> | null;
  level: 'TH' | 'THCS' | 'THPT';
  enabledLevels: string[];
  startYear: number;
  yearStart: string;
  yearEnd: string;
}

export interface Tt25Facts extends FormulaFacts {
  ownership: OwnershipGroup;
}

export async function loadTt25Facts(
  context: Tt25Context,
  base: { classes: PrimaryClassRow[]; students: PrimaryStudentRow[] },
): Promise<Tt25Facts> {
  const { database, level, startYear } = context;
  const inYear = (date: string | null) => date !== null && date >= context.yearStart && date <= context.yearEnd;
  const root = await database
    .selectFrom('org_units')
    .select('id')
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirst();
  const [
    profile,
    sites,
    children,
    completion,
    previousRetained,
    leavers,
    transfers,
    staff,
    assignments,
    evaluations,
    rooms,
  ] = await Promise.all([
    root
      ? database
          .selectFrom('school_profiles')
          .select(['general', 'other_info'])
          .where('org_unit_id', '=', root.id)
          .executeTakeFirst()
      : undefined,
    database
      .selectFrom('org_units')
      .select('id')
      .where('unit_type', '=', 'diem_truong')
      .where('status', '=', 'active')
      .execute(),
    database
      .selectFrom('children')
      .select(['id', 'dob', 'moet_profile', 'special_needs_note'])
      .where('id', 'in', [...base.students.map((row) => row.id), '00000000-0000-0000-0000-000000000000'])
      .execute(),
    database
      .selectFrom('completion_results')
      .select(['child_id', 'support_plan'])
      .where('class_id', 'in', [...base.classes.map((row) => row.id), '00000000-0000-0000-0000-000000000000'])
      .execute(),
    context.previous
      ? context.previous.selectFrom('completion_results').select('child_id').where('outcome', '=', 'retained').execute()
      : Promise.resolve([] as Array<{ child_id: string }>),
    database
      .selectFrom('children')
      .innerJoin('class_enrollments', 'class_enrollments.child_id', 'children.id')
      .innerJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select(['children.id', 'children.gender', 'children.moet_profile', 'children.leave_date', 'classes.grade_level'])
      .where('children.status', '=', 'withdrawn')
      .where('classes.school_level', '=', level)
      .execute(),
    database
      .selectFrom('student_transfers')
      .innerJoin('children', 'children.id', 'student_transfers.child_id')
      .select([
        'student_transfers.child_id',
        'student_transfers.province_name',
        'student_transfers.transfer_date',
        'children.gender',
        'children.moet_profile',
      ])
      .where('student_transfers.direction', '=', 'out')
      .where('student_transfers.status', 'in', ['approved', 'received'])
      .execute(),
    database
      .selectFrom('staff')
      .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
      .select([
        'staff.id',
        'staff.gender',
        'staff.dob',
        'staff.status',
        'staff.start_date',
        'staff.end_date',
        'staff.moet_profile',
        'staff.user_id',
        'job_titles.name as job_title',
      ])
      .execute(),
    database
      .selectFrom('class_staff_assignments')
      .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
      .select(['class_staff_assignments.staff_user_id', 'classes.school_level'])
      .where('classes.status', '=', 'active')
      .where('class_staff_assignments.status', '=', 'active')
      .execute(),
    database
      .selectFrom('professional_evaluations')
      .select(['staff_id', 'overall_level', 'updated_at'])
      .where('status', '=', 'finalized')
      .orderBy('updated_at', 'asc')
      .execute(),
    database.selectFrom('rooms').select(['id', 'room_type', 'condition']).where('status', '=', 'active').execute(),
  ]);
  const general = (profile?.general ?? {}) as Record<string, unknown>;
  const other = (profile?.other_info ?? {}) as Record<string, unknown>;
  const flag = (key: string) => other[key] === true;
  const province = fold(typeof general.province === 'string' ? general.province : '');
  const otherProvince = (name: string | null) => fold(name) !== '' && province !== '' && fold(name) !== province;
  const ownership: OwnershipGroup = general.ownership_type === 'public' ? 'public' : 'private';

  const childById = new Map(children.map((row) => [row.id, row]));
  const retained = new Set(previousRetained.map((row) => row.child_id));
  const summer = new Set(
    completion
      .filter((row) => row.support_plan === 'summer_training' || row.support_plan === 'retest')
      .map((row) => row.child_id),
  );
  const multiLevel = context.enabledLevels.length > 1;
  const combined = new Set(
    (
      await database
        .selectFrom('classes')
        .select('id')
        .where('is_combined', '=', true)
        .where('id', 'in', [...base.classes.map((row) => row.id), '00000000-0000-0000-0000-000000000000'])
        .execute()
    ).map((row) => row.id),
  );

  const students = base.students.map((row) => {
    const child = childById.get(row.id);
    const birthYear = yearOf(child?.dob);
    const repeater = retained.has(row.id);
    return {
      ...row,
      age: birthYear === null ? null : startYear - birthYear,
      repeater,
      new_entrant: row.grade === 'K1' && !repeater,
      disability: disabilityKindOf(
        profileText(child?.moet_profile, 'disability_type') ?? child?.special_needs_note ?? null,
      ),
      ethnic_boarding: row.ethnic && row.boarding,
      summer_support: summer.has(row.id),
      transfer_in_province: otherProvince(profileText(child?.moet_profile, 'transfer_from_province')),
    };
  });

  const leaverFacts: object[] = [
    ...leavers
      .filter((row) => inYear(dateText(row.leave_date)))
      .map((row) => ({
        grade: row.grade_level,
        female: row.gender === 'female',
        ethnic: isEthnicMinority(profileText(row.moet_profile, 'ethnicity')),
        dropout: true,
        transfer_out_province: false,
      })),
    ...transfers
      .filter((row) => inYear(dateText(row.transfer_date)) && otherProvince(row.province_name))
      .map((row) => ({
        grade: null,
        female: row.gender === 'female',
        ethnic: isEthnicMinority(profileText(row.moet_profile, 'ethnicity')),
        dropout: false,
        transfer_out_province: true,
      })),
  ];

  const levelsOfStaff = new Map<string, Set<string>>();
  for (const row of assignments) {
    const set = levelsOfStaff.get(row.staff_user_id) ?? new Set<string>();
    set.add(row.school_level);
    levelsOfStaff.set(row.staff_user_id, set);
  }
  const lowestLevel = ['MN', 'TH', 'THCS', 'THPT'].find((item) => context.enabledLevels.includes(item)) ?? level;
  const standardOf = new Map(evaluations.map((row) => [row.staff_id, row.overall_level]));
  const staffFacts = staff.flatMap((row) => {
    const text = (key: string) => profileText(row.moet_profile, key);
    const status = fold(text('staff_status'));
    const end = dateText(row.end_date);
    const active = row.status === 'active';
    const retired = !active && inYear(end) && status.includes('nghi huu');
    const left = !active && inYear(end) && !retired;
    if (!active && !retired && !left) {
      return [];
    }
    const taught = row.user_id ? levelsOfStaff.get(row.user_id) : undefined;
    if (multiLevel && (taught ? !taught.has(level) : level !== lowestLevel)) {
      return [];
    }
    const jobPosition = text('job_position');
    const principal = isPrincipal({ job_title: row.job_title, job_position: jobPosition });
    const category = staffCategory({ position_group: text('position_group') ?? jobPosition, job_title: row.job_title });
    const contract = contractOf(text('contract_form'));
    const birthYear = yearOf(row.dob);
    const rank = rankOf(text('civil_service_rank'));
    return [
      {
        active,
        female: row.gender === 'female',
        ethnic: isEthnicMinority(text('ethnicity')),
        indefinite: contract === 'indefinite',
        fixed_term: contract === 'fixed_term',
        labor_contract: contract === 'labor',
        principal: principal === 'principal',
        vice_principal: principal === 'vice',
        manager: principal !== null || category === 'manager',
        teacher: principal === null && category === 'teacher',
        job: principal === null && category === 'employee' ? staffJobOf(jobPosition, row.job_title) : null,
        rank: rank ? String(rank.level) : null,
        age_band: ageBandOf(birthYear === null ? null : startYear - birthYear),
        standard: standardOf.get(row.id) ?? null,
        new_hire: active && inYear(dateText(row.start_date)),
        retired,
        left,
      },
    ];
  });

  const classroomIds = new Set(
    (
      await database
        .selectFrom('classes')
        .select('room_id')
        .where('school_level', '=', level)
        .where('status', '=', 'active')
        .where('room_id', 'is not', null)
        .execute()
    ).map((row) => row.room_id),
  );
  const roomFacts = rooms.map((row) => ({
    classroom: classroomIds.has(row.id),
    multi_purpose: row.room_type === 'multi_purpose',
    borrowed: row.condition === 'borrowed',
    permanent: row.condition === 'permanent',
    semi_permanent: row.condition === 'semi_permanent',
    temporary: row.condition === 'temporary',
  }));

  const level1 = general.national_standard_level === '1';
  const level2 = general.national_standard_level === '2';
  return {
    ownership,
    classes: base.classes.map((row) => ({ ...row, multigrade: combined.has(row.id), multi_level: multiLevel })),
    students,
    school: [
      {
        standard_1: level1,
        standard_2: level2,
        electricity: flag('grid_electricity'),
        internet: flag('has_internet'),
        computers: flag('has_computers'),
        drinking_water: flag('drinking_water'),
        separate_toilets: flag('gender_separated_toilets'),
        handwashing: flag('handwashing'),
        sex_education: flag('sex_education'),
        disaster_plan: flag('disaster_prevention'),
        multi_level: multiLevel,
      },
    ],
    sites: sites.map(() => ({})),
    staff: staffFacts,
    rooms: roomFacts,
    leavers: leaverFacts,
  };
}
