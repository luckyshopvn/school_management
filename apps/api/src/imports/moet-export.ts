import ExcelJS from 'exceljs';
import type { SchoolYearDatabase } from '@school-management/database';
import type { Kysely } from 'kysely';
import { foldText, MOET_CHILD_COLUMNS, MOET_STAFF_COLUMNS, type MoetColumn } from './moet-columns.js';

// Tệp hồ sơ theo mẫu CSDL ngành của Bộ (82 cột học sinh, 75 cột cán bộ, giáo viên; YCTD-100), ghi ngược từ hồ sơ đã có:
// cột riêng lấy ở bảng học sinh, phụ huynh, nhân sự; cột khác lấy ở `moet_profile`; số bí mật giải mã để trường nhận nhập
// lại được. Cột quận/huyện cũ không tên ngay sau cột tỉnh như tệp thật. Tệp này nhập được bằng màn hình 4.1.2 Nhập dữ liệu
// từ Excel (tệp CSDL ngành) của trường nhận (DT-16 phần 16e, 1.8 Tách trường)
export interface MoetSheet {
  headers: string[];
  rows: string[][];
}

type ProfileData = Record<string, unknown>;

const formatDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : '';

// Thứ tự cột của tệp: mỗi cột có blankAfter thêm một cột không tên ngay sau
function layout(columns: MoetColumn[]): Array<{ key: string; header: string; column: MoetColumn | null }> {
  return columns.flatMap((column) => [
    { key: column.key, header: column.header, column },
    ...(column.blankAfter ? [{ key: column.blankAfter, header: '', column: null }] : []),
  ]);
}

// Giá trị một ô từ moet_profile theo kiểu cột
function profileCell(column: MoetColumn | null, key: string, profile: ProfileData, decrypt: (text: string) => string) {
  const value = profile[key];
  if (column?.kind === 'secret') {
    const encrypted = profile[`${key}_encrypted`];
    return typeof encrypted === 'string' ? decrypt(encrypted) : '';
  }
  if (value === undefined || value === null) {
    return '';
  }
  if (column?.kind === 'date') {
    return formatDate(value);
  }
  if (column?.kind === 'flag') {
    return value === true ? 'x' : String(value);
  }
  return String(value);
}

export function buildMoetSheet(
  columns: MoetColumn[],
  records: Array<{ core: Record<string, string>; profile: ProfileData | null }>,
  decrypt: (text: string) => string,
): MoetSheet {
  const cells = layout(columns);
  return {
    headers: cells.map((cell) => cell.header),
    rows: records.map((record, index) =>
      cells.map((cell) => {
        if (cell.key === 'row_number') {
          return String(index + 1);
        }
        if (cell.column?.core) {
          return record.core[cell.key] ?? '';
        }
        return profileCell(cell.column, cell.key, record.profile ?? {}, decrypt);
      }),
    ),
  };
}

export async function moetWorkbookBuffer(sheet: MoetSheet, title: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title);
  worksheet.addRow(sheet.headers);
  worksheet.getRow(1).font = { bold: true };
  for (const row of sheet.rows) {
    // Ô dạng chữ để số định danh, điện thoại giữ số 0 đầu
    worksheet.addRow(row);
  }
  worksheet.columns.forEach((column) => {
    column.numFmt = '@';
    column.width = 18;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const GUARDIAN_ROLES = [
  { prefix: 'father', names: ['cha', 'bo', 'ba'] },
  { prefix: 'mother', names: ['me', 'ma'] },
  { prefix: 'legal_guardian', names: ['nguoi giam ho', 'giam ho'] },
];

// Hồ sơ học sinh theo mẫu 82 cột: lớp ghi mã lớp hiện tại, cha, mẹ, người giám hộ theo quan hệ trong danh mục
export async function childMoetSheet(
  database: Kysely<SchoolYearDatabase>,
  childIds: string[],
  decrypt: (text: string) => string,
): Promise<MoetSheet> {
  if (childIds.length === 0) {
    return buildMoetSheet(MOET_CHILD_COLUMNS, [], decrypt);
  }
  const [children, guardians] = await Promise.all([
    database
      .selectFrom('children')
      .leftJoin('class_enrollments', (join) =>
        join.onRef('class_enrollments.child_id', '=', 'children.id').on('class_enrollments.is_current', '=', true),
      )
      .leftJoin('classes', 'classes.id', 'class_enrollments.class_id')
      .select([
        'children.id',
        'children.full_name',
        'children.dob',
        'children.gender',
        'children.national_id_encrypted',
        'children.moet_student_code',
        'children.place_of_birth',
        'children.address',
        'children.moet_profile',
        'classes.code as class_code',
      ])
      .where('children.id', 'in', childIds)
      .orderBy('classes.code')
      .orderBy('children.full_name')
      .execute(),
    database
      .selectFrom('child_guardians')
      .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
      .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
      .select([
        'child_guardians.child_id',
        'catalog_items.name as relationship',
        'guardians.full_name',
        'guardians.phone',
        'guardians.occupation',
        'guardians.birth_year',
        'guardians.id_number_encrypted',
      ])
      .where('child_guardians.child_id', 'in', childIds)
      .execute(),
  ]);
  const records = children.map((child) => {
    const core: Record<string, string> = {
      class_label: child.class_code ?? '',
      moet_student_code: child.moet_student_code ?? '',
      full_name: child.full_name,
      dob: formatDate(child.dob),
      gender: child.gender === 'female' ? 'Nữ' : 'Nam',
      national_id: decrypt(child.national_id_encrypted),
      place_of_birth: child.place_of_birth ?? '',
      address: child.address ?? '',
    };
    for (const role of GUARDIAN_ROLES) {
      const guardian = guardians.find(
        (item) => item.child_id === child.id && role.names.includes(foldText(item.relationship)),
      );
      if (guardian) {
        core[`${role.prefix}_name`] = guardian.full_name;
        core[`${role.prefix}_occupation`] = guardian.occupation ?? '';
        core[`${role.prefix}_birth_year`] = guardian.birth_year ? String(guardian.birth_year) : '';
        core[`${role.prefix}_phone`] = guardian.phone ?? '';
        core[`${role.prefix}_id_number`] = guardian.id_number_encrypted ? decrypt(guardian.id_number_encrypted) : '';
      }
    }
    return { core, profile: child.moet_profile };
  });
  return buildMoetSheet(MOET_CHILD_COLUMNS, records, decrypt);
}

// Hồ sơ cán bộ, giáo viên theo mẫu 75 cột
export async function staffMoetSheet(
  database: Kysely<SchoolYearDatabase>,
  staffIds: string[],
  decrypt: (text: string) => string,
): Promise<MoetSheet> {
  if (staffIds.length === 0) {
    return buildMoetSheet(MOET_STAFF_COLUMNS, [], decrypt);
  }
  const staff = await database
    .selectFrom('staff')
    .select([
      'full_name',
      'dob',
      'gender',
      'phone',
      'email',
      'id_number_encrypted',
      'moet_staff_code',
      'moet_profile',
    ])
    .where('id', 'in', staffIds)
    .orderBy('full_name')
    .execute();
  const records = staff.map((member) => ({
    core: {
      moet_staff_code: member.moet_staff_code ?? '',
      full_name: member.full_name,
      gender: member.gender === 'female' ? 'Nữ' : member.gender === 'male' ? 'Nam' : '',
      dob: member.dob ? formatDate(member.dob) : '',
      id_number: member.id_number_encrypted ? decrypt(member.id_number_encrypted) : '',
      email: member.email ?? '',
      phone: member.phone ?? '',
    },
    profile: member.moet_profile,
  }));
  return buildMoetSheet(MOET_STAFF_COLUMNS, records, decrypt);
}
