import type { SchoolYearDatabase, SigningObjectType } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import {
  CLASS_STAGE_LABELS,
  SCHOOL_LEVELS,
  classStageOf,
  SCHOOL_PROFILE_SECTIONS,
  SIGNING_DOSSIER_ROOTS,
  SIGNING_OBJECT_LABELS,
  type ClassAgeGroupKey,
  type ClassStage,
  type SigningDocument,
  type SigningDocumentItem,
  type SigningDocumentSection,
} from '@school-management/shared';
import type { Kysely } from 'kysely';
import { createHash } from 'node:crypto';
import { cellText, type TableFileSheet } from '../exports/table-file.js';
import { notFoundError } from '../common/request-fields.js';
import { foldText } from '../imports/moet-columns.js';
import { LEVEL_LABELS } from '../professional-standards/standard-rating.js';
import { classAgeGroup } from '../statistics/statistics-calc.js';

// Nội dung hồ sơ kí theo bốn mẫu của Sở (DT-17 phần 17b, YCTD-133; tài liệu 46 mục 10.3.3): số liệu lấy từ dữ liệu của năm
// học đang dùng tại thời điểm tạo hồ sơ, dựng thành các phần và mục theo đúng tên, thứ tự của Sở:
// - hồ sơ trường: phần "Thông tin chung" và mỗi phân hiệu, điểm trường một phần "Thông tin điểm trường";
// - hồ sơ lớp: thông tin lớp và các ô chương trình, lớp ghép; không có danh sách học sinh, giáo viên;
// - hồ sơ nhân sự: mười hai phần lấy từ hồ sơ nhân sự, danh mục Bộ (16f), hợp đồng, chứng chỉ, quá trình công tác, phiếu
//   chuẩn nghề nghiệp đã chốt;
// - hồ sơ học sinh: "Thông tin chung" và "Thông tin gia đình".
// Mục chưa có dữ liệu ở phần mềm để trống. Số định danh, số CCCD, số sổ BHXH in đủ theo mẫu vì hồ sơ là bản nộp cơ quan quản
// lý (quyết định của Eric ngày 2026-10-19); chỉ người có quyền xem số định danh tạo, xem được hồ sơ nhân sự, học sinh. Sổ đầu
// bài của lớp theo tháng (16k) giữ lại cho cấp học khác. Cách lấy từng mục do Claude tự chọn theo ủy quyền của Eric ngày
// 2026-10-11 (ghi ở YCTD-133)
export interface DossierContent {
  label: string;
  document: SigningDocument;
  // Mục bắt buộc còn trống: có thì không tạo hồ sơ, ghi lý do vào "Tải file lỗi"
  missing: string[];
}

// Giải mã số định danh, CCCD, sổ BHXH đã lưu mã hóa
export type Decrypt = (encoded: string) => string;

export interface SigningObject {
  object_id: string;
  object_label: string;
  // Thông tin phụ để tìm trên lưới
  detail: string | null;
  // Cột riêng theo loại như lưới của Sở: mã trường, mã nhân sự, mã học sinh; tên hiệu trưởng; khối; ngày sinh; trạng thái
  // nhân sự, học sinh; vị trí việc làm; lớp
  code: string | null;
  principal_name: string | null;
  stage: ClassStage | null;
  dob: string | null;
  person_status: string | null;
  job_position: string | null;
  class_id: string | null;
  class_name: string | null;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ' };
const CHILD_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  withdrawn: 'Thôi học',
  graduated: 'Hoàn thành chương trình',
};
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  probation: 'Thử việc',
  fixed_term: 'Xác định thời hạn',
  indefinite: 'Không xác định thời hạn',
};
const ATTENDED = ['present', 'late', 'early_leave', 'late_and_early_leave'];
// Mục bắt buộc của từng mẫu (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: mục định danh đối tượng trên lưới của Sở)
const REQUIRED: Record<SigningObjectType, string[]> = {
  school: ['Tên trường', 'Mã trường'],
  class: ['Tên lớp', 'Khối'],
  staff: ['Họ tên', 'Ngày sinh', 'Giới tính'],
  child: ['Họ tên', 'Ngày sinh', 'Giới tính'],
  class_log: [],
};

export function isSigningMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

const dateText = (value: string | Date | null | undefined) =>
  value ? cellText(value).split('-').reverse().join('/') : '';
const yesNo = (value: unknown) => (value === true ? 'Có' : value === false ? 'Không' : '');
const textOf = (value: unknown): string =>
  value === null || value === undefined ? '' : typeof value === 'string' ? value.trim() : cellText(value);
const joined = (...values: unknown[]) =>
  values
    .map(textOf)
    .filter((value) => value !== '')
    .join(', ');

// Tên phần tử XML suy từ nhãn mục: bỏ dấu, viết hoa, ký tự khác chữ số nối bằng gạch dưới ("Diện tích (m²)" → DIEN_TICH_M2)
export function elementName(label: string): string {
  const name = foldText(label)
    .replace(/²/g, '2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[A-Z]/.test(name) ? name : `MUC_${name}`;
}

type Entry = [label: string, value: unknown] | [label: string, value: unknown, secret: true];

function itemsOf(entries: Entry[]): SigningDocumentItem[] {
  return entries.map(([label, value, secret]) => ({
    key: elementName(label),
    label,
    value: textOf(value),
    ...(secret ? { secret: true } : {}),
  }));
}

const section = (title: string, entries: Entry[], key = elementName(title)): SigningDocumentSection => ({
  key,
  title,
  items: itemsOf(entries),
});

const tableSection = (
  title: string,
  columns: string[],
  rows: unknown[][],
  key = elementName(title),
): SigningDocumentSection => {
  const keys = columns.map(elementName);
  return {
    key,
    title,
    table: {
      columns: columns.map((label, index) => ({ key: keys[index] ?? '', label })),
      rows: rows.map((row) => Object.fromEntries(keys.map((column, index) => [column, textOf(row[index])]))),
    },
  };
};

function missingOf(type: SigningObjectType, document: SigningDocument): string[] {
  const first = document.sections[0]?.items ?? [];
  return REQUIRED[type].filter((label) => !first.find((item) => item.label === label)?.value);
}

// Bảng của tệp PDF: mỗi phần một bảng; phần dạng mục có hai cột Mục, Nội dung
export function documentSheets(document: SigningDocument): TableFileSheet[] {
  return document.sections.map((part) =>
    part.table
      ? {
          title: part.title,
          numbered: true,
          columns: part.table.columns.map((column) => ({ key: column.key, label: column.label })),
          rows: part.table.rows,
        }
      : {
          title: part.title,
          columns: [
            { key: 'item', label: 'Mục', width: 40 },
            { key: 'value', label: 'Nội dung', width: 80 },
          ],
          rows: (part.items ?? []).map((item) => ({
            item: item.label,
            value: item.value,
            ...(item.secret ? { secret: true } : {}),
          })),
        },
  );
}

// Hồ sơ lập trước phần 17b chỉ lưu bảng của tệp PDF: đổi lại thành phần và mục để hiện ở cửa sổ "Xem hồ sơ kí"
export function sheetsDocument(type: SigningObjectType, title: string, sheets: TableFileSheet[]): SigningDocument {
  return {
    root: SIGNING_DOSSIER_ROOTS[type],
    title,
    sections: sheets.map((sheet) =>
      sheet.columns.some((column) => column.key === 'item')
        ? {
            key: elementName(sheet.title),
            title: sheet.title,
            items: sheet.rows.map((row) => ({
              key: elementName(textOf(row.item)),
              label: [row.section, row.item].filter(Boolean).map(textOf).join(' – '),
              value: textOf(row.value),
            })),
          }
        : tableSection(
            sheet.title,
            sheet.columns.map((column) => column.label),
            sheet.rows.map((row) => sheet.columns.map((column) => row[column.key])),
          ),
    ),
  };
}

// Mã băm của số liệu hồ sơ: chỉ tính các bảng, không tính dòng tiêu đề có thời điểm tạo
export function contentHash(sheets: TableFileSheet[]): string {
  return createHash('sha256')
    .update(JSON.stringify(sheets.map((sheet) => ({ columns: sheet.columns, rows: sheet.rows }))))
    .digest('hex');
}

// Tóm tắt khác biệt giữa số liệu đã lập hồ sơ và số liệu hiện tại để người dùng biết cần tạo lại hồ sơ nào. Mục số định danh,
// CCCD, sổ BHXH chỉ ghi "đã thay đổi" vì nội dung thay đổi hiện trên lưới cho cả người không xem được số định danh
export function describeChanges(before: TableFileSheet[], after: TableFileSheet[]): string | null {
  const changes: string[] = [];
  for (const sheet of after) {
    const old = before.find((item) => item.title === sheet.title);
    if (!old) {
      changes.push(`thêm phần "${sheet.title}"`);
      continue;
    }
    if (sheet.columns.some((column) => column.key === 'item')) {
      for (const row of sheet.rows) {
        const previous = old.rows.find((item) => item.item === row.item);
        if (!previous) {
          changes.push(`thêm "${String(row.item)}"`);
        } else if (previous.value !== row.value) {
          changes.push(
            row.secret || previous.secret
              ? `${String(row.item)}: đã thay đổi`
              : `${String(row.item)}: "${cellText(previous.value)}" → "${cellText(row.value)}"`,
          );
        }
      }
    } else if (JSON.stringify(old.rows) !== JSON.stringify(sheet.rows)) {
      changes.push(`${sheet.title}: ${old.rows.length} → ${sheet.rows.length} dòng, có dòng thay đổi`);
    }
  }
  for (const sheet of before) {
    if (!after.some((item) => item.title === sheet.title)) {
      changes.push(`bỏ phần "${sheet.title}"`);
    }
  }
  return changes.length > 0 ? changes.join('; ').slice(0, 2000) : null;
}

async function rootUnit(database: Kysely<SchoolYearDatabase>) {
  const root = await database
    .selectFrom('org_units')
    .select(['id', 'code', 'name', 'address', 'phone'])
    .where('unit_type', '=', 'truong_chinh')
    .executeTakeFirst();
  if (!root) {
    throw new ApplicationError('ERR_VALIDATION', 'Chưa có Trường chính trong cây đơn vị');
  }
  return root;
}

type ProfileValues = Record<string, unknown>;

// Thẻ của 1.1 Hồ sơ trường; ô chọn đổi thành nhãn
async function schoolProfile(database: Kysely<SchoolYearDatabase>, rootId: string) {
  const profile = (await database
    .selectFrom('school_profiles')
    .selectAll()
    .where('org_unit_id', '=', rootId)
    .executeTakeFirst()) as Record<string, unknown> | undefined;
  const sections: Record<string, ProfileValues> = {};
  for (const part of SCHOOL_PROFILE_SECTIONS) {
    const values = (profile?.[part.key] ?? {}) as ProfileValues;
    sections[part.key] = Object.fromEntries(
      Object.entries(values).map(([key, raw]) => {
        const field = part.fields.find((item) => item.key === key);
        return [key, field?.options?.find((option) => option.value === raw)?.label ?? raw];
      }),
    );
  }
  return { general: sections.general ?? {}, other: sections.other_info ?? {} };
}

// Mã, tên trường như Sở: mã trường là mã định danh Bộ ở hồ sơ trường, chưa nhập thì mã đơn vị của cây đơn vị
async function schoolIdentity(database: Kysely<SchoolYearDatabase>) {
  const root = await rootUnit(database);
  const { general, other } = await schoolProfile(database, root.id);
  return { root, general, other, code: textOf(general.moet_code) || root.code, name: root.name };
}

async function stageOf(database: Kysely<SchoolYearDatabase>) {
  const grades = await database.selectFrom('grade_levels').select(['code', 'age_from_months']).execute();
  const ages = new Map(grades.map((grade) => [grade.code, grade.age_from_months]));
  return (ageGroup: ClassAgeGroupKey | null, gradeLevel: string): ClassStage => {
    const age = ages.get(gradeLevel);
    const group = ageGroup ?? (age === undefined || age === null ? null : classAgeGroup(age));
    return group && group !== 'over_6' ? classStageOf(group as ClassAgeGroupKey) : 'mau_giao';
  };
}

// Ô "Khối" của hồ sơ lớp, học sinh: Mầm non ghi nhóm lớp (Nhà trẻ, Mẫu giáo) như Sở; cấp khác ghi tên khối (DT-19 phần 19d,
// YCTD-154)
async function blockLabelOf(database: Kysely<SchoolYearDatabase>) {
  const [stage, grades] = await Promise.all([
    stageOf(database),
    database.selectFrom('grade_levels').select(['code', 'name', 'school_level']).execute(),
  ]);
  return (ageGroup: ClassAgeGroupKey | null, gradeLevel: string): string => {
    const grade = grades.find((item) => item.code === gradeLevel);
    return grade && grade.school_level !== 'MN' ? grade.name : CLASS_STAGE_LABELS[stage(ageGroup, gradeLevel)];
  };
}

// Ô "Cấp dạy" của hồ sơ nhân sự: các cấp của đơn vị chính của nhân sự; đơn vị chưa khai báo cấp là Mầm non (YCTD-154)
async function teachingLevelsOf(database: Kysely<SchoolYearDatabase>, staffId: string): Promise<string> {
  const rows = await database
    .selectFrom('staff')
    .innerJoin('org_unit_levels', 'org_unit_levels.org_unit_id', 'staff.org_unit_id')
    .select('org_unit_levels.school_level')
    .where('staff.id', '=', staffId)
    .execute();
  const codes = rows.map((row) => row.school_level);
  return SCHOOL_LEVELS.filter((level) => (codes.length > 0 ? codes : ['MN']).includes(level.value))
    .map((level) => level.label)
    .join(', ');
}

// Danh sách đối tượng lập hồ sơ của từng loại (lưới của 2.2): trường là Trường chính; lớp, sổ đầu bài là các lớp của năm học;
// nhân sự đang làm việc; học sinh đã duyệt hồ sơ (bỏ hồ sơ nháp, chờ duyệt, đã xóa)
export async function listSigningObjects(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  type: SigningObjectType,
): Promise<SigningObject[]> {
  const empty = {
    detail: null,
    code: null,
    principal_name: null,
    stage: null,
    dob: null,
    person_status: null,
    job_position: null,
    class_id: null,
    class_name: null,
  };
  if (type === 'school') {
    const school = await schoolIdentity(database);
    return [
      {
        ...empty,
        object_id: school.root.id,
        object_label: school.name,
        detail: school.code,
        code: school.code,
        principal_name: textOf(school.general.principal_name) || null,
      },
    ];
  }
  if (type === 'class' || type === 'class_log') {
    const stage = await stageOf(database);
    const classes = await database
      .selectFrom('classes')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .select([
        'classes.id',
        'classes.name',
        'classes.code',
        'classes.age_group',
        'classes.grade_level',
        'org_units.name as unit_name',
      ])
      .where('classes.academic_year_id', '=', academicYearId)
      .orderBy('classes.sort_order')
      .orderBy('classes.name')
      .execute();
    return classes.map((row) => ({
      ...empty,
      object_id: row.id,
      object_label: row.name,
      detail: `${row.code} – ${row.unit_name}`,
      code: row.code,
      stage: stage(row.age_group, row.grade_level),
      class_id: row.id,
      class_name: row.name,
    }));
  }
  if (type === 'staff') {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name', 'dob', 'status', 'moet_profile'])
      .where('status', '=', 'active')
      .orderBy('full_name')
      .execute();
    return staff.map((row) => ({
      ...empty,
      object_id: row.id,
      object_label: row.full_name,
      detail: row.code,
      code: row.code,
      dob: row.dob,
      person_status: textOf(row.moet_profile?.staff_status) || 'Đang làm việc',
      job_position: textOf(row.moet_profile?.job_position) || null,
    }));
  }
  const stage = await stageOf(database);
  const children = await database
    .selectFrom('children')
    .leftJoin('class_enrollments', (join) =>
      join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
    )
    .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .select([
      'children.id',
      'children.full_name',
      'children.dob',
      'children.status',
      'children.moet_student_code',
      'classes.id as class_id',
      'classes.name as class_name',
      'classes.age_group',
      'classes.grade_level',
    ])
    .where('children.deleted_at', 'is', null)
    .where('children.status', 'in', ['active', 'paused', 'withdrawn', 'graduated'])
    .orderBy('classes.name')
    .orderBy('children.full_name')
    .execute();
  return children.map((row) => ({
    ...empty,
    object_id: row.id,
    object_label: row.full_name,
    detail: row.class_name,
    code: row.moet_student_code,
    dob: row.dob,
    person_status: CHILD_STATUS_LABELS[row.status] ?? row.status,
    stage: row.grade_level ? stage(row.age_group, row.grade_level) : null,
    class_id: row.class_id,
    class_name: row.class_name,
  }));
}

async function schoolContent(database: Kysely<SchoolYearDatabase>, objectId: string): Promise<DossierContent> {
  const { root, general, other, code, name } = await schoolIdentity(database);
  if (root.id !== objectId) {
    throw notFoundError('Không có trường này', 'org_unit');
  }
  // Các ô có/không về học sinh, lớp tính từ dữ liệu: học sinh có loại khuyết tật, học sinh bán trú, lớp học 2 buổi/ngày
  const [children, classes, points] = await Promise.all([
    database
      .selectFrom('children')
      .select(['boarding', 'moet_profile'])
      .where('deleted_at', 'is', null)
      .where('status', '=', 'active')
      .execute(),
    database.selectFrom('classes').select(['two_sessions_per_day']).where('status', '=', 'active').execute(),
    database
      .selectFrom('org_units')
      .select(['code', 'name', 'address', 'phone', 'area_m2', 'distance_km'])
      .where('unit_type', 'in', ['phan_hieu', 'diem_truong'])
      .where('status', '=', 'active')
      .orderBy('code')
      .execute(),
  ]);
  const document: SigningDocument = {
    root: SIGNING_DOSSIER_ROOTS.school,
    title: SIGNING_OBJECT_LABELS.school,
    sections: [
      section('Thông tin chung', [
        ['Tên trường', name],
        ['Mã trường', code],
        ['Mã định danh tổ chức (NĐ 69)', general.electronic_id_code],
        ['Điện thoại', textOf(general.phone) || root.phone],
        ['Fax', general.fax],
        ['Website', general.website],
        ['Email', general.email],
        ['Mã số thuế', general.tax_code],
        ['Loại hình trường', general.ownership_type],
        ['Loại trường', general.institution_type],
        ['Tên hiệu trưởng', general.principal_name],
        ['Điện thoại hiệu trưởng', general.principal_phone],
        ['Tỉnh/Thành phố', general.province],
        ['Phường/Xã', general.ward],
        ['Địa chỉ', textOf(general.address) || root.address],
        ['Khu vực', general.area],
        ['Chi bộ đảng', yesNo(other.party_cell)],
        ['Chuẩn quốc gia mức độ', general.national_standard_level],
        ['Vùng', general.region],
        ['Vùng đặc biệt khó khăn', yesNo(other.disadvantaged_commune)],
        ['Diện tích (m²)', general.land_area_m2],
        ['Trường quốc tế', yesNo(other.international_school)],
        ['Có học sinh khuyết tật', yesNo(children.some((child) => textOf(child.moet_profile?.disability_type)))],
        ['Có học sinh bán trú', yesNo(children.some((child) => child.boarding))],
        ['Có dạy 2 buổi/ngày', yesNo(classes.some((item) => item.two_sessions_per_day))],
        ['Dùng máy vi tính phục vụ quản lý và giáo dục trẻ', yesNo(other.has_computers)],
        ['Có điện lưới', yesNo(other.grid_electricity)],
        ['Kết nối Internet', yesNo(other.has_internet)],
        ['Có công trình vệ sinh', yesNo(other.gender_separated_toilets)],
        ['Có chỗ rửa tay thuận tiện (nước và xà phòng)', yesNo(other.handwashing)],
        ['Có nguồn nước sạch', yesNo(other.clean_water)],
        ['Có chương trình giáo dục về giới tính, phòng chống bạo lực, xâm hại', yesNo(other.sex_education)],
      ]),
      ...points.map((point, index) =>
        section(
          `Thông tin điểm trường: ${point.name}`,
          [
            ['Tên điểm trường', point.name],
            ['Mã điểm trường', point.code],
            ['Địa chỉ', point.address],
            ['Điện thoại', point.phone],
            ['Diện tích (m²)', point.area_m2 === null ? null : Number(point.area_m2)],
            ['Phương tiện đi lại', null],
            ['Khoảng cách đến trường chính (km)', point.distance_km === null ? null : Number(point.distance_km)],
          ],
          `THONG_TIN_DIEM_TRUONG_${index + 1}`,
        ),
      ),
    ],
  };
  return { label: name, document, missing: missingOf('school', document) };
}

async function classRow(database: Kysely<SchoolYearDatabase>, academicYearId: string, classId: string) {
  const row = await database
    .selectFrom('classes')
    .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
    .leftJoin('org_units as parent_units', 'parent_units.id', 'org_units.parent_id')
    .leftJoin('classes as combined', 'combined.id', 'classes.combined_into_class_id')
    .select([
      'classes.id',
      'classes.code',
      'classes.name',
      'classes.grade_level',
      'classes.age_group',
      'classes.two_sessions_per_day',
      'classes.boarding',
      'classes.is_combined',
      'classes.mixed_age_count',
      'combined.name as combined_name',
      'org_units.code as unit_code',
      'org_units.name as unit_name',
      'org_units.unit_type',
      'parent_units.code as parent_code',
      'parent_units.name as parent_name',
      'parent_units.unit_type as parent_type',
    ])
    .where('classes.id', '=', classId)
    .where('classes.academic_year_id', '=', academicYearId)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có lớp này trong năm học đang dùng', 'class');
  }
  return row;
}

// Phân hiệu, điểm trường của đơn vị: phân hiệu là chính nó; điểm trường thuộc phân hiệu thì lấy phân hiệu cha
function branchOf(unit: {
  unit_type: string | null;
  unit_code: string | null;
  unit_name: string | null;
  parent_type: string | null;
  parent_code: string | null;
  parent_name: string | null;
}) {
  if (unit.unit_type === 'phan_hieu') {
    return { code: unit.unit_code, name: unit.unit_name, point: null };
  }
  if (unit.unit_type === 'diem_truong') {
    return unit.parent_type === 'phan_hieu'
      ? { code: unit.parent_code, name: unit.parent_name, point: unit.unit_name }
      : { code: null, name: null, point: unit.unit_name };
  }
  return { code: null, name: null, point: null };
}

async function classContent(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  classId: string,
): Promise<DossierContent> {
  const [row, school, blockLabel] = await Promise.all([
    classRow(database, academicYearId, classId),
    schoolIdentity(database),
    blockLabelOf(database),
  ]);
  const children = await database
    .selectFrom('class_enrollments')
    .innerJoin('children', 'children.id', 'class_enrollments.child_id')
    .select(['children.moet_profile'])
    .where('class_enrollments.class_id', '=', classId)
    .where('class_enrollments.is_current', '=', true)
    .where('children.deleted_at', 'is', null)
    .execute();
  const branch = branchOf(row);
  const document: SigningDocument = {
    root: SIGNING_DOSSIER_ROOTS.class,
    title: SIGNING_OBJECT_LABELS.class,
    sections: [
      section('Thông tin lớp', [
        ['Tên trường', school.name],
        ['Mã trường', school.code],
        ['Khối', blockLabel(row.age_group, row.grade_level)],
        ['Tên lớp', row.name],
        ['Mã phân hiệu', branch.code],
        ['Tên phân hiệu', branch.name],
        ['Điểm trường', branch.point],
        ['Lớp dạy tăng cường tiếng Việt', null],
        ['Lớp ghép', yesNo(row.is_combined)],
        ['Tên lớp ghép', row.combined_name],
        ['Nhóm trẻ ghép', row.mixed_age_count ? `Ghép ${row.mixed_age_count} độ tuổi` : null],
        ['Bán trú', yesNo(row.boarding)],
        ['Học 2 buổi', yesNo(row.two_sessions_per_day)],
        ['Dạy chương trình làm quen tiếng Anh', null],
        ['Có trẻ khuyết tật', yesNo(children.some((child) => textOf(child.moet_profile?.disability_type)))],
        ['Chương trình giáo dục mầm non mới', null],
        ['Chương trình chăm sóc giáo dục', null],
      ]),
    ],
  };
  return { label: row.name, document, missing: missingOf('class', document) };
}

const profileText = (profile: Record<string, unknown> | null, key: string) => textOf(profile?.[key]);
const profileDate = (profile: Record<string, unknown> | null, key: string) => {
  const value = profile?.[key];
  return typeof value === 'string' ? dateText(value) : '';
};
const profileFlag = (profile: Record<string, unknown> | null, key: string) => {
  const value = profile?.[key];
  return value === true ? 'Có' : typeof value === 'string' ? value : '';
};
const secretOf = (profile: Record<string, unknown> | null, key: string, decrypt: Decrypt) => {
  const value = profile?.[`${key}_encrypted`];
  return typeof value === 'string' && value ? decrypt(value) : '';
};

async function staffContent(
  database: Kysely<SchoolYearDatabase>,
  staffId: string,
  decrypt: Decrypt,
): Promise<DossierContent> {
  const row = await database
    .selectFrom('staff')
    .select([
      'staff.full_name',
      'staff.dob',
      'staff.gender',
      'staff.phone',
      'staff.email',
      'staff.status',
      'staff.id_number_encrypted',
      'staff.moet_profile',
    ])
    .where('staff.id', '=', staffId)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có nhân sự này', 'staff');
  }
  const [school, contracts, certificates, history, evaluation, teachingLevels] = await Promise.all([
    schoolIdentity(database),
    database
      .selectFrom('employment_contracts')
      .select(['contract_no', 'contract_type', 'start_date', 'end_date', 'base_salary'])
      .where('staff_id', '=', staffId)
      .orderBy('start_date')
      .execute(),
    database
      .selectFrom('staff_certificates')
      .select(['name', 'certificate_no', 'issued_by', 'issued_date', 'expire_date'])
      .where('staff_id', '=', staffId)
      .orderBy('issued_date')
      .execute(),
    database
      .selectFrom('staff_work_history')
      .innerJoin('org_units', 'org_units.id', 'staff_work_history.org_unit_id')
      .leftJoin('departments', 'departments.id', 'staff_work_history.department_id')
      .leftJoin('job_titles', 'job_titles.id', 'staff_work_history.job_title_id')
      .select([
        'staff_work_history.from_date',
        'staff_work_history.to_date',
        'staff_work_history.note',
        'org_units.name as unit_name',
        'departments.name as department_name',
        'job_titles.name as job_title_name',
      ])
      .where('staff_work_history.staff_id', '=', staffId)
      .orderBy('staff_work_history.from_date')
      .execute(),
    // Phiếu chuẩn nghề nghiệp đã chốt gần nhất
    database
      .selectFrom('professional_evaluations')
      .select(['id'])
      .where('staff_id', '=', staffId)
      .where('status', '=', 'finalized')
      .orderBy('finalized_at', 'desc')
      .executeTakeFirst(),
    teachingLevelsOf(database, staffId),
  ]);
  const ratings = evaluation
    ? await database
        .selectFrom('professional_evaluation_items')
        .select(['criterion_code', 'criterion_name', 'self_rating', 'assessor_rating'])
        .where('evaluation_id', '=', evaluation.id)
        .orderBy('order_no')
        .execute()
    : [];
  const profile = row.moet_profile;
  const p = (key: string) => profileText(profile, key);
  const idNumber = row.id_number_encrypted ? decrypt(row.id_number_encrypted) : '';
  const sessions = profile?.two_sessions_per_day === true ? '2' : profile?.one_session_per_day === true ? '1' : '';
  const languageRows = p('main_foreign_language')
    ? [
        [
          p('main_foreign_language'),
          p('language_training_level'),
          joined(p('language_certificate_group'), p('language_certificate_type')),
          p('language_score'),
          p('language_framework_level'),
        ],
      ]
    : [];
  const document: SigningDocument = {
    root: SIGNING_DOSSIER_ROOTS.staff,
    title: SIGNING_OBJECT_LABELS.staff,
    sections: [
      section('Thông tin chung', [
        ['Tên trường', school.name],
        ['Họ tên', row.full_name],
        ['Ngày sinh', dateText(row.dob)],
        ['Đoàn viên', profileFlag(profile, 'youth_union_member')],
        ['Đảng viên', profileFlag(profile, 'party_member')],
        ['Giới tính', row.gender ? GENDER_LABELS[row.gender] : ''],
        ['Số sổ BHXH', secretOf(profile, 'social_insurance_number', decrypt), true],
        ['Trạng thái cán bộ', p('staff_status') || (row.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc')],
        ['Nơi thường trú – tỉnh/thành phố', p('permanent_province')],
        ['Nơi thường trú – xã/phường', p('permanent_ward')],
        ['Nơi thường trú – chi tiết', p('permanent_hamlet')],
        ['Số CMND/CCCD', idNumber, true],
        ['Điện thoại', row.phone],
        ['Email', row.email],
        // Số CCCD gắn chip là số định danh cá nhân nên hai mục cùng một số
        ['Số định danh cá nhân', idNumber, true],
        ['Dân tộc', p('ethnicity')],
        ['Tôn giáo', p('religion')],
        ['Quê quán', joined(p('hometown_hamlet'), p('hometown_ward'), p('hometown_province'))],
      ]),
      section('Vị trí việc làm, tiêu chuẩn chức danh', [
        ['Vị trí việc làm', p('job_position')],
        ['Cấp dạy', teachingLevels],
        ['Biên chế cấp dạy chính', null],
        ['Dạy nhóm lớp', p('teaching_group')],
        ['Dạy nhóm lớp kiêm nhiệm', null],
        ['Đã tập huấn kĩ năng sống', profileFlag(profile, 'life_skills_trained')],
        ['Dạy học sinh khuyết tật hòa nhập', profileFlag(profile, 'teaches_inclusive')],
        ['Số buổi dạy/ngày', sessions],
        ['Nhóm chức vụ', p('position_group')],
        ['Hình thức hợp đồng', p('contract_form')],
        ['Ngày tuyển dụng', profileDate(profile, 'recruitment_date')],
        ['Cơ quan tuyển dụng', p('recruiting_agency')],
        ['Nghề nghiệp khi tuyển dụng', p('occupation_at_recruitment')],
        ['Mã số', null],
        ['Ngạch/Hạng', p('civil_service_rank')],
      ]),
      section('Phụ cấp', [
        ['Phụ cấp thu hút (%)', p('attraction_allowance_percent')],
        ['Phụ cấp thâm niên (%)', p('seniority_allowance_percent')],
        ['Phụ cấp ưu đãi nghề (%)', p('incentive_allowance_percent')],
        ['Hệ số phụ cấp chức vụ', p('leadership_allowance_percent')],
        ['Phần trăm vượt khung (%)', p('over_frame_percent')],
        ['Mã bậc lương', p('salary_step')],
        ['Tên bậc lương', null],
        ['Hệ số lương', p('salary_coefficient')],
        ['Ngày hưởng lương', profileDate(profile, 'salary_effective_date')],
      ]),
      section('Quy trình đào tạo', [
        ['Kết quả bồi dưỡng thường xuyên', p('regular_training_result')],
        ['Chuyên ngành chính', p('main_major')],
        ['Chuyên ngành khác', p('other_major')],
        ['Trình độ chính', p('main_major_level') || p('professional_qualification')],
        ['Trình độ khác', p('other_major_level')],
        ['Lý luận chính trị', p('political_theory_level')],
        ['Quản lý giáo dục', p('education_management_level')],
        ['Ngoại ngữ chính', p('main_foreign_language')],
        ['Trình độ ngoại ngữ', p('language_training_level')],
        ['Nhóm chứng chỉ ngoại ngữ', p('language_certificate_group')],
        ['Loại chứng chỉ ngoại ngữ', p('language_certificate_type')],
        ['Điểm', p('language_score')],
        ['Khung năng lực', p('language_framework_level')],
      ]),
      section('Đánh giá, phân loại', [
        ['Đánh giá viên chức/công chức', p('civil_servant_evaluation')],
        ['Danh hiệu phong tặng', p('honorary_titles')],
        ['Giáo viên dạy giỏi', p('excellent_teacher')],
      ]),
      tableSection(
        'Đánh giá chuẩn nghề nghiệp',
        ['Tiêu chí', 'Mức tự đánh giá', 'Mức cấp trên đánh giá'],
        ratings.map((item) => [
          `${item.criterion_code} ${item.criterion_name}`,
          item.self_rating ? LEVEL_LABELS[item.self_rating] : '',
          item.assessor_rating ? LEVEL_LABELS[item.assessor_rating] : '',
        ]),
      ),
      tableSection(
        'Quá trình lương',
        ['Từ ngày', 'Đến ngày', 'Số hợp đồng', 'Loại hợp đồng', 'Lương cơ bản'],
        contracts.map((contract) => [
          dateText(contract.start_date),
          dateText(contract.end_date),
          contract.contract_no,
          CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type,
          Number(contract.base_salary).toLocaleString('vi-VN'),
        ]),
      ),
      tableSection(
        'Quá trình bồi dưỡng',
        ['Nội dung bồi dưỡng', 'Số chứng chỉ', 'Nơi cấp', 'Ngày cấp', 'Ngày hết hạn'],
        certificates.map((item) => [
          item.name,
          item.certificate_no,
          item.issued_by,
          dateText(item.issued_date),
          dateText(item.expire_date),
        ]),
      ),
      tableSection(
        'Quá trình ngoại ngữ',
        ['Ngoại ngữ', 'Trình độ', 'Chứng chỉ', 'Điểm', 'Khung năng lực'],
        languageRows,
      ),
      tableSection('Quá trình khen thưởng', ['Năm', 'Hình thức khen thưởng', 'Cấp khen thưởng'], []),
      tableSection('Quan hệ gia đình', ['Quan hệ', 'Họ tên', 'Năm sinh', 'Nghề nghiệp'], []),
      tableSection(
        'Quá trình công tác',
        ['Từ ngày', 'Đến ngày', 'Đơn vị', 'Tổ, phòng ban', 'Chức danh', 'Ghi chú'],
        history.map((item) => [
          dateText(item.from_date),
          dateText(item.to_date),
          item.unit_name,
          item.department_name,
          item.job_title_name,
          item.note,
        ]),
      ),
    ],
  };
  return { label: row.full_name, document, missing: missingOf('staff', document) };
}

// Quan hệ với trẻ của danh mục do trường tự đặt: tên có "cha", "bố" là cha; "mẹ", "má" là mẹ; còn lại là người đỡ đầu
function relationshipOf(name: string | null): 'father' | 'mother' | 'guardian' {
  const folded = ` ${foldText(name ?? '')} `;
  if (/ (cha|bo|ba) /.test(folded)) {
    return 'father';
  }
  if (/ (me|ma) /.test(folded)) {
    return 'mother';
  }
  return 'guardian';
}

async function childContent(
  database: Kysely<SchoolYearDatabase>,
  childId: string,
  decrypt: Decrypt,
): Promise<DossierContent> {
  const row = await database
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
    .leftJoin('org_units as parent_units', 'parent_units.id', 'org_units.parent_id')
    .leftJoin('class_enrollments', (join) =>
      join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
    )
    .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .select([
      'children.full_name',
      'children.dob',
      'children.gender',
      'children.place_of_birth',
      'children.address',
      'children.national_id_encrypted',
      'children.status',
      'children.boarding',
      'children.moet_profile',
      'org_units.code as unit_code',
      'org_units.name as unit_name',
      'org_units.unit_type',
      'parent_units.code as parent_code',
      'parent_units.name as parent_name',
      'parent_units.unit_type as parent_type',
      'classes.name as class_name',
      'classes.age_group',
      'classes.grade_level',
    ])
    .where('children.id', '=', childId)
    .where('children.deleted_at', 'is', null)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có học sinh này', 'child');
  }
  const [school, blockLabel, guardians] = await Promise.all([
    schoolIdentity(database),
    blockLabelOf(database),
    database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .leftJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'guardians.full_name',
        'guardians.occupation',
        'guardians.birth_year',
        'catalog_items.name as relationship',
      ])
      .where('child_guardians.child_id', '=', childId)
      .orderBy('child_guardians.is_primary', 'desc')
      .orderBy('guardians.full_name')
      .execute(),
  ]);
  const profile = row.moet_profile;
  const p = (key: string) => profileText(profile, key);
  const branch = branchOf(row);
  const family = (kind: 'father' | 'mother' | 'guardian') =>
    guardians.find((guardian) => relationshipOf(guardian.relationship) === kind);
  const father = family('father');
  const mother = family('mother');
  const guardian = family('guardian');
  const document: SigningDocument = {
    root: SIGNING_DOSSIER_ROOTS.child,
    title: SIGNING_OBJECT_LABELS.child,
    sections: [
      section('Thông tin chung', [
        ['Tên trường', school.name],
        ['Khối', row.grade_level ? blockLabel(row.age_group, row.grade_level) : ''],
        ['Tên lớp', row.class_name],
        ['Mã phân hiệu', branch.code],
        ['Tên phân hiệu', branch.name],
        ['Họ tên', row.full_name],
        ['Ngày sinh', dateText(row.dob)],
        ['Giới tính', GENDER_LABELS[row.gender] ?? ''],
        ['Trạng thái', CHILD_STATUS_LABELS[row.status] ?? row.status],
        ['Dân tộc', p('ethnicity')],
        ['Dân tộc khai sinh', null],
        ['Quốc tịch', p('nationality')],
        ['Điện thoại liên hệ', p('contact_phone')],
        ['Số CMND/CCCD', secretOf(profile, 'citizen_id', decrypt), true],
        ['Số định danh cá nhân', decrypt(row.national_id_encrypted), true],
        ['Ngày cấp', profileDate(profile, 'citizen_id_issued_date')],
        ['Nơi cấp', p('citizen_id_issued_place')],
        ['Quê quán – tỉnh/thành phố', p('hometown_province')],
        ['Quê quán – xã/phường', p('hometown_ward')],
        ['Quê quán – tổ/thôn', p('hometown_hamlet')],
        ['Nơi thường trú – tỉnh/thành phố', p('permanent_province')],
        ['Nơi thường trú – xã/phường', p('permanent_ward')],
        ['Nơi thường trú – chi tiết', p('permanent_hamlet')],
        ['Chỗ ở hiện nay', row.address],
        ['Nơi sinh', row.place_of_birth],
        ['Khu vực', p('area')],
        ['Loại khuyết tật', p('disability_type')],
        ['Đối tượng chính sách', p('policy_target')],
        ['Có cha dân tộc', profileFlag(profile, 'father_ethnic_minority')],
        ['Có mẹ dân tộc', profileFlag(profile, 'mother_ethnic_minority')],
        ['Bán trú', yesNo(row.boarding)],
      ]),
      section('Thông tin gia đình', [
        ['Họ tên cha', father?.full_name],
        ['Nghề nghiệp cha', father?.occupation],
        ['Năm sinh cha', father?.birth_year ? String(father.birth_year) : null],
        ['Họ tên mẹ', mother?.full_name],
        ['Nghề nghiệp mẹ', mother?.occupation],
        ['Năm sinh mẹ', mother?.birth_year ? String(mother.birth_year) : null],
        ['Họ tên người đỡ đầu', guardian?.full_name],
        ['Nghề nghiệp người đỡ đầu', guardian?.occupation],
        ['Năm sinh người đỡ đầu', guardian?.birth_year ? String(guardian.birth_year) : null],
      ]),
    ],
  };
  return { label: row.full_name, document, missing: missingOf('child', document) };
}

// Số liệu sổ đầu bài của lớp trong tháng: mỗi ngày có điểm danh hoặc có lịch hoạt động là một dòng. Dùng cho hồ sơ sổ đầu
// bài và xuất dữ liệu sổ đầu bài (cấp Mầm non ẩn hai chức năng này từ phần 17b)
export async function classLogRows(database: Kysely<SchoolYearDatabase>, classId: string, month: string) {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const [attendance, activities] = await Promise.all([
    database
      .selectFrom('attendance_records')
      .select(['attendance_date', 'status'])
      .where('class_id', '=', classId)
      .where('attendance_date', '>=', from)
      .where('attendance_date', '<=', to)
      .execute(),
    database
      .selectFrom('class_activity_schedules')
      .select(['activity_date', 'start_time', 'activity_name'])
      .where('class_id', '=', classId)
      .where('activity_date', '>=', from)
      .where('activity_date', '<=', to)
      .where('status', '=', 'published')
      .orderBy('start_time')
      .execute(),
  ]);
  const dates = [
    ...new Set([
      ...attendance.map((item) => cellText(item.attendance_date)),
      ...activities.map((item) => cellText(item.activity_date)),
    ]),
  ].sort();
  return dates.map((date) => {
    const records = attendance.filter((item) => cellText(item.attendance_date) === date);
    return {
      date: dateText(date),
      recorded: records.length,
      present: records.filter((item) => ATTENDED.includes(item.status)).length,
      absent_notified: records.filter((item) => item.status === 'absent_notified').length,
      absent_unnotified: records.filter((item) => item.status === 'absent_unnotified').length,
      activities: activities
        .filter((item) => cellText(item.activity_date) === date)
        .map((item) => `${String(item.start_time).slice(0, 5)} ${item.activity_name}`)
        .join('; '),
    };
  });
}

export const CLASS_LOG_COLUMNS = [
  { key: 'date', label: 'Ngày', width: 12 },
  { key: 'recorded', label: 'Sĩ số điểm danh', width: 14 },
  { key: 'present', label: 'Có mặt', width: 10 },
  { key: 'absent_notified', label: 'Vắng có phép', width: 12 },
  { key: 'absent_unnotified', label: 'Vắng không phép', width: 14 },
  { key: 'activities', label: 'Hoạt động trong ngày', width: 60 },
];

async function classLogContent(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  classId: string,
  month: string,
): Promise<DossierContent> {
  const row = await classRow(database, academicYearId, classId);
  const [year, monthNumber] = month.split('-');
  const rows = await classLogRows(database, classId, month);
  return {
    label: `${row.name} – tháng ${monthNumber}/${year}`,
    document: {
      root: SIGNING_DOSSIER_ROOTS.class_log,
      title: SIGNING_OBJECT_LABELS.class_log,
      sections: [
        tableSection(
          'Sổ đầu bài',
          CLASS_LOG_COLUMNS.map((column) => column.label),
          rows.map((item) => CLASS_LOG_COLUMNS.map((column) => item[column.key as keyof typeof item])),
        ),
      ],
    },
    missing: [],
  };
}

// Số liệu hồ sơ của một đối tượng tại thời điểm gọi
export function buildDossierContent(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  type: SigningObjectType,
  objectId: string,
  period: string,
  decrypt: Decrypt,
): Promise<DossierContent> {
  switch (type) {
    case 'school':
      return schoolContent(database, objectId);
    case 'class':
      return classContent(database, academicYearId, objectId);
    case 'staff':
      return staffContent(database, objectId, decrypt);
    case 'child':
      return childContent(database, objectId, decrypt);
    case 'class_log':
      return classLogContent(database, academicYearId, objectId, period);
  }
}

export function dossierTitle(type: SigningObjectType, label: string): string {
  return `${SIGNING_OBJECT_LABELS[type]}: ${label}`;
}
