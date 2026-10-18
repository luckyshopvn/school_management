import type { SchoolYearDatabase, SigningObjectType } from '@school-management/database';
import { ApplicationError } from '@school-management/server';
import { CLASS_AGE_GROUPS, SCHOOL_PROFILE_SECTIONS, SIGNING_OBJECT_LABELS } from '@school-management/shared';
import type { Kysely } from 'kysely';
import { createHash } from 'node:crypto';
import { cellText, type TableFileSheet } from '../exports/table-file.js';
import { notFoundError } from '../common/request-fields.js';

// Nội dung hồ sơ kí (DT-16 phần 16k): số liệu lấy từ dữ liệu của năm học đang dùng tại thời điểm tạo hồ sơ, dựng thành các
// bảng của tệp PDF. Hồ sơ trường theo sáu thẻ của 1.1 Hồ sơ trường; hồ sơ lớp có thông tin lớp, giáo viên phụ trách và danh
// sách học sinh; hồ sơ nhân sự, học sinh là thông tin chính của hồ sơ (không in số định danh, tài khoản ngân hàng); sổ đầu bài
// của lớp theo tháng gồm sĩ số, có mặt, vắng theo điểm danh và hoạt động trong ngày theo lịch hoạt động của lớp. Claude tự chọn
// các mục theo ủy quyền của Eric ngày 2026-10-11 vì khảo sát chưa có mẫu hồ sơ của Sở
export interface DossierContent {
  label: string;
  sheets: TableFileSheet[];
}

export interface SigningObject {
  object_id: string;
  object_label: string;
  // Thông tin phụ để tìm và hiện trên lưới: lớp của học sinh, mã nhân sự, khối của lớp
  detail: string | null;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const INFO_COLUMNS = [
  { key: 'item', label: 'Mục', width: 40 },
  { key: 'value', label: 'Nội dung', width: 80 },
];
const GENDER_LABELS: Record<string, string> = { male: 'Nam', female: 'Nữ' };
const CHILD_STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  active: 'Đang học',
  paused: 'Tạm nghỉ',
  withdrawn: 'Thôi học',
  graduated: 'Hoàn thành chương trình',
};
const ATTENDED = ['present', 'late', 'early_leave', 'late_and_early_leave'];

export function isSigningMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

const dateText = (value: string | Date | null | undefined) =>
  value ? cellText(value).split('-').reverse().join('/') : '';
const info = (rows: Array<[string, unknown]>) =>
  rows.map(([item, value]) => ({ item, value: typeof value === 'string' ? value : cellText(value) }));

// Mã băm của số liệu hồ sơ: chỉ tính các bảng, không tính dòng tiêu đề có thời điểm tạo
export function contentHash(sheets: TableFileSheet[]): string {
  return createHash('sha256')
    .update(JSON.stringify(sheets.map((sheet) => ({ columns: sheet.columns, rows: sheet.rows }))))
    .digest('hex');
}

// Tóm tắt khác biệt giữa số liệu đã lập hồ sơ và số liệu hiện tại để người dùng biết cần tạo lại hồ sơ nào
export function describeChanges(before: TableFileSheet[], after: TableFileSheet[]): string | null {
  const changes: string[] = [];
  for (const sheet of after) {
    const old = before.find((item) => item.title === sheet.title);
    if (!old) {
      changes.push(`thêm bảng "${sheet.title}"`);
      continue;
    }
    if (sheet.columns.some((column) => column.key === 'item')) {
      for (const row of sheet.rows) {
        const previous = old.rows.find((item) => item.item === row.item);
        if (!previous) {
          changes.push(`thêm "${String(row.item)}"`);
        } else if (previous.value !== row.value) {
          changes.push(`${String(row.item)}: "${cellText(previous.value)}" → "${cellText(row.value)}"`);
        }
      }
    } else if (JSON.stringify(old.rows) !== JSON.stringify(sheet.rows)) {
      changes.push(`${sheet.title}: ${old.rows.length} → ${sheet.rows.length} dòng, có dòng thay đổi`);
    }
  }
  for (const sheet of before) {
    if (!after.some((item) => item.title === sheet.title)) {
      changes.push(`bỏ bảng "${sheet.title}"`);
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

// Danh sách đối tượng lập hồ sơ của từng loại (lưới của 2.2): trường là Trường chính; lớp, sổ đầu bài là các lớp của năm học;
// nhân sự đang làm việc; học sinh đã duyệt hồ sơ (bỏ hồ sơ nháp, chờ duyệt, đã xóa)
export async function listSigningObjects(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  type: SigningObjectType,
): Promise<SigningObject[]> {
  if (type === 'school') {
    const root = await rootUnit(database);
    return [{ object_id: root.id, object_label: root.name, detail: root.code }];
  }
  if (type === 'class' || type === 'class_log') {
    const classes = await database
      .selectFrom('classes')
      .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
      .select(['classes.id', 'classes.name', 'classes.code', 'org_units.name as unit_name'])
      .where('classes.academic_year_id', '=', academicYearId)
      .orderBy('classes.sort_order')
      .orderBy('classes.name')
      .execute();
    return classes.map((row) => ({
      object_id: row.id,
      object_label: row.name,
      detail: `${row.code} – ${row.unit_name}`,
    }));
  }
  if (type === 'staff') {
    const staff = await database
      .selectFrom('staff')
      .select(['id', 'code', 'full_name'])
      .where('status', '=', 'active')
      .orderBy('full_name')
      .execute();
    return staff.map((row) => ({ object_id: row.id, object_label: row.full_name, detail: row.code }));
  }
  const children = await database
    .selectFrom('children')
    .leftJoin('class_enrollments', (join) =>
      join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
    )
    .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
    .select(['children.id', 'children.full_name', 'classes.name as class_name'])
    .where('children.deleted_at', 'is', null)
    .where('children.status', 'in', ['active', 'paused', 'withdrawn', 'graduated'])
    .orderBy('classes.name')
    .orderBy('children.full_name')
    .execute();
  return children.map((row) => ({ object_id: row.id, object_label: row.full_name, detail: row.class_name }));
}

async function schoolContent(database: Kysely<SchoolYearDatabase>, objectId: string): Promise<DossierContent> {
  const root = await rootUnit(database);
  if (root.id !== objectId) {
    throw notFoundError('Không có trường này', 'org_unit');
  }
  const profile = await database
    .selectFrom('school_profiles')
    .selectAll()
    .where('org_unit_id', '=', root.id)
    .executeTakeFirst();
  const rows: Array<Record<string, unknown>> = [];
  for (const section of SCHOOL_PROFILE_SECTIONS) {
    const values = ((profile as Record<string, unknown> | undefined)?.[section.key] ?? {}) as Record<string, unknown>;
    for (const field of section.fields) {
      const raw = values[field.key];
      const value = field.options?.find((option) => option.value === raw)?.label ?? raw;
      rows.push({ section: section.label, item: field.label, value: cellText(value) });
    }
  }
  const units = await database
    .selectFrom('org_units')
    .select(['code', 'name', 'unit_type', 'address', 'phone', 'status'])
    .orderBy('unit_type')
    .orderBy('code')
    .execute();
  const unitTypes: Record<string, string> = {
    truong_chinh: 'Trường chính',
    phan_hieu: 'Phân hiệu',
    diem_truong: 'Điểm trường',
  };
  return {
    label: root.name,
    sheets: [
      {
        title: 'Thông tin trường',
        columns: [
          { key: 'section', label: 'Thẻ', width: 24 },
          { key: 'item', label: 'Mục', width: 40 },
          { key: 'value', label: 'Nội dung', width: 60 },
        ],
        rows: info([
          ['Tên đơn vị', root.name],
          ['Mã đơn vị', root.code],
          ['Địa chỉ', root.address],
          ['Điện thoại', root.phone],
        ])
          .map((row) => ({ section: 'Cây đơn vị', ...row }))
          .concat(rows as Array<{ section: string; item: string; value: string }>),
      },
      {
        title: 'Phân hiệu, điểm trường',
        numbered: true,
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Tên' },
          { key: 'type', label: 'Loại' },
          { key: 'address', label: 'Địa chỉ' },
          { key: 'status', label: 'Trạng thái' },
        ],
        rows: units.map((unit) => ({
          code: unit.code,
          name: unit.name,
          type: unitTypes[unit.unit_type] ?? unit.unit_type,
          address: unit.address ?? '',
          status: unit.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động',
        })),
      },
    ],
  };
}

async function classRow(database: Kysely<SchoolYearDatabase>, academicYearId: string, classId: string) {
  const row = await database
    .selectFrom('classes')
    .innerJoin('org_units', 'org_units.id', 'classes.org_unit_id')
    .select([
      'classes.id',
      'classes.code',
      'classes.name',
      'classes.grade_level',
      'classes.age_group',
      'classes.max_size',
      'classes.status',
      'classes.two_sessions_per_day',
      'classes.boarding',
      'org_units.name as unit_name',
    ])
    .where('classes.id', '=', classId)
    .where('classes.academic_year_id', '=', academicYearId)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có lớp này trong năm học đang dùng', 'class');
  }
  return row;
}

async function classContent(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  classId: string,
): Promise<DossierContent> {
  const row = await classRow(database, academicYearId, classId);
  const [teachers, children] = await Promise.all([
    database
      .selectFrom('class_staff_assignments')
      .select(['staff_name', 'assignment_role', 'subject_name', 'from_date'])
      .where('class_id', '=', classId)
      .where('status', '=', 'active')
      .orderBy('assignment_role')
      .orderBy('staff_name')
      .execute(),
    database
      .selectFrom('class_enrollments')
      .innerJoin('children', 'children.id', 'class_enrollments.child_id')
      .select(['children.full_name', 'children.dob', 'children.gender', 'children.moet_student_code'])
      .where('class_enrollments.class_id', '=', classId)
      .where('class_enrollments.is_current', '=', true)
      .where('children.deleted_at', 'is', null)
      .orderBy('children.full_name')
      .execute(),
  ]);
  const ageGroup = CLASS_AGE_GROUPS.find((group) => group.key === row.age_group)?.label ?? '';
  return {
    label: row.name,
    sheets: [
      {
        title: 'Thông tin lớp',
        columns: INFO_COLUMNS,
        rows: info([
          ['Mã lớp', row.code],
          ['Tên lớp', row.name],
          ['Đơn vị', row.unit_name],
          ['Khối', row.grade_level],
          ['Nhóm tuổi', ageGroup],
          ['Sĩ số tối đa', row.max_size],
          ['Sĩ số hiện tại', children.length],
          ['Học 2 buổi/ngày', row.two_sessions_per_day],
          ['Lớp bán trú', row.boarding],
          ['Trạng thái', row.status === 'active' ? 'Đang hoạt động' : 'Đã giải thể'],
        ]),
      },
      {
        title: 'Giáo viên phụ trách',
        numbered: true,
        columns: [
          { key: 'name', label: 'Họ tên' },
          { key: 'role', label: 'Phân công' },
          { key: 'from', label: 'Từ ngày' },
        ],
        rows: teachers.map((teacher) => ({
          name: teacher.staff_name,
          role: teacher.assignment_role === 'homeroom' ? 'Chủ nhiệm' : `Bộ môn ${teacher.subject_name ?? ''}`.trimEnd(),
          from: dateText(teacher.from_date),
        })),
      },
      {
        title: 'Danh sách học sinh',
        numbered: true,
        columns: [
          { key: 'name', label: 'Họ tên' },
          { key: 'dob', label: 'Ngày sinh' },
          { key: 'gender', label: 'Giới tính' },
          { key: 'code', label: 'Mã định danh Bộ' },
        ],
        rows: children.map((child) => ({
          name: child.full_name,
          dob: dateText(child.dob),
          gender: GENDER_LABELS[child.gender] ?? '',
          code: child.moet_student_code ?? '',
        })),
      },
    ],
  };
}

async function staffContent(database: Kysely<SchoolYearDatabase>, staffId: string): Promise<DossierContent> {
  const row = await database
    .selectFrom('staff')
    .innerJoin('org_units', 'org_units.id', 'staff.org_unit_id')
    .leftJoin('departments', 'departments.id', 'staff.department_id')
    .leftJoin('job_titles', 'job_titles.id', 'staff.job_title_id')
    .select([
      'staff.code',
      'staff.full_name',
      'staff.dob',
      'staff.gender',
      'staff.phone',
      'staff.email',
      'staff.start_date',
      'staff.end_date',
      'staff.status',
      'staff.moet_staff_code',
      'org_units.name as unit_name',
      'departments.name as department_name',
      'job_titles.name as job_title_name',
    ])
    .where('staff.id', '=', staffId)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có nhân sự này', 'staff');
  }
  const classes = await database
    .selectFrom('class_staff_assignments')
    .innerJoin('classes', 'classes.id', 'class_staff_assignments.class_id')
    .innerJoin('staff', 'staff.user_id', 'class_staff_assignments.staff_user_id')
    .select(['classes.name', 'class_staff_assignments.assignment_role'])
    .where('staff.id', '=', staffId)
    .where('class_staff_assignments.status', '=', 'active')
    .orderBy('classes.name')
    .execute();
  return {
    label: row.full_name,
    sheets: [
      {
        title: 'Thông tin nhân sự',
        columns: INFO_COLUMNS,
        rows: info([
          ['Mã nhân sự', row.code],
          ['Mã định danh Bộ', row.moet_staff_code],
          ['Họ tên', row.full_name],
          ['Ngày sinh', dateText(row.dob)],
          ['Giới tính', row.gender ? GENDER_LABELS[row.gender] : ''],
          ['Đơn vị', row.unit_name],
          ['Tổ, phòng ban', row.department_name],
          ['Chức danh', row.job_title_name],
          ['Điện thoại', row.phone],
          ['Thư điện tử', row.email],
          ['Ngày vào làm', dateText(row.start_date)],
          ['Ngày nghỉ việc', dateText(row.end_date)],
          ['Trạng thái', row.status === 'active' ? 'Đang làm việc' : 'Đã nghỉ việc'],
          [
            'Lớp phụ trách',
            classes
              .map((item) => `${item.name} (${item.assignment_role === 'homeroom' ? 'chủ nhiệm' : 'bộ môn'})`)
              .join(', '),
          ],
        ]),
      },
    ],
  };
}

async function childContent(database: Kysely<SchoolYearDatabase>, childId: string): Promise<DossierContent> {
  const row = await database
    .selectFrom('children')
    .innerJoin('org_units', 'org_units.id', 'children.org_unit_id')
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
      'children.moet_student_code',
      'children.enroll_date',
      'children.leave_date',
      'children.status',
      'children.two_sessions_per_day',
      'children.boarding',
      'org_units.name as unit_name',
      'classes.name as class_name',
    ])
    .where('children.id', '=', childId)
    .where('children.deleted_at', 'is', null)
    .executeTakeFirst();
  if (!row) {
    throw notFoundError('Không có học sinh này', 'child');
  }
  const guardians = await database
    .selectFrom('child_guardians')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .leftJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
    .select(['guardians.full_name', 'catalog_items.name as relationship', 'child_guardians.is_primary'])
    .where('child_guardians.child_id', '=', childId)
    .orderBy('child_guardians.is_primary', 'desc')
    .orderBy('guardians.full_name')
    .execute();
  return {
    label: row.full_name,
    sheets: [
      {
        title: 'Thông tin học sinh',
        columns: INFO_COLUMNS,
        rows: info([
          ['Họ tên', row.full_name],
          ['Mã định danh Bộ', row.moet_student_code],
          ['Ngày sinh', dateText(row.dob)],
          ['Giới tính', GENDER_LABELS[row.gender] ?? ''],
          ['Nơi sinh', row.place_of_birth],
          ['Địa chỉ', row.address],
          ['Đơn vị', row.unit_name],
          ['Lớp', row.class_name],
          ['Ngày nhập học', dateText(row.enroll_date)],
          ['Ngày thôi học', dateText(row.leave_date)],
          ['Học 2 buổi/ngày', row.two_sessions_per_day],
          ['Bán trú', row.boarding],
          ['Trạng thái', CHILD_STATUS_LABELS[row.status] ?? row.status],
        ]),
      },
      {
        title: 'Cha mẹ, người giám hộ',
        numbered: true,
        columns: [
          { key: 'name', label: 'Họ tên' },
          { key: 'relationship', label: 'Quan hệ' },
          { key: 'primary', label: 'Liên hệ chính' },
        ],
        rows: guardians.map((guardian) => ({
          name: guardian.full_name,
          relationship: guardian.relationship ?? '',
          primary: guardian.is_primary ? 'Có' : '',
        })),
      },
    ],
  };
}

// Số liệu sổ đầu bài của lớp trong tháng: mỗi ngày có điểm danh hoặc có lịch hoạt động là một dòng. Dùng cho hồ sơ sổ đầu
// bài và nút "Xuất dữ liệu sổ đầu bài"
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
  return {
    label: `${row.name} – tháng ${monthNumber}/${year}`,
    sheets: [
      {
        title: 'Sổ đầu bài',
        numbered: true,
        columns: CLASS_LOG_COLUMNS,
        rows: await classLogRows(database, classId, month),
      },
    ],
  };
}

// Số liệu hồ sơ của một đối tượng tại thời điểm gọi
export function buildDossierContent(
  database: Kysely<SchoolYearDatabase>,
  academicYearId: string,
  type: SigningObjectType,
  objectId: string,
  period: string,
): Promise<DossierContent> {
  switch (type) {
    case 'school':
      return schoolContent(database, objectId);
    case 'class':
      return classContent(database, academicYearId, objectId);
    case 'staff':
      return staffContent(database, objectId);
    case 'child':
      return childContent(database, objectId);
    case 'class_log':
      return classLogContent(database, academicYearId, objectId, period);
  }
}

export function dossierTitle(type: SigningObjectType, label: string): string {
  return `${SIGNING_OBJECT_LABELS[type]}: ${label}`;
}
