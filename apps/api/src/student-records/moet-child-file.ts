import type { SchoolYearDatabase } from '@school-management/database';
import ExcelJS from 'exceljs';
import type { Kysely, Transaction } from 'kysely';
import type { ChildDataProtection } from '../common/child-data-protection.js';
import type { ImportCatalog } from '../imports/excel.js';
import { foldText, MOET_CHILD_COLUMNS, type MoetColumn } from '../imports/moet-columns.js';

// Tệp học sinh theo mẫu 82 cột của CSDL ngành (DT-16 phần 16g) dựng từ hồ sơ: dùng cho "Tải file mẫu kèm dữ liệu" của 4.1.2,
// tệp đề nghị cấp mã định danh Bộ (4.1.1) và hồ sơ chuyển trường (4.2). Tệp đọc lại được bằng chính bộ nhập tệp CSDL ngành
// (cùng tiêu đề, cột quận/huyện cũ không tên ngay sau cột tỉnh). Số định danh của học sinh ghi đủ mười hai số vì Bộ, trường
// nhận cần số này; số căn cước, hộ chiếu, số định danh của cha mẹ chỉ lưu mã hóa nên để trống
type Executor = Kysely<SchoolYearDatabase> | Transaction<SchoolYearDatabase>;

export const MOET_FILE_SHEET = 'Học sinh';

// Thứ tự cột của tệp: mỗi cột có tiêu đề; cột quận/huyện cũ không tên (YCTD-100)
export function moetFileColumns(): Array<{ key: string; header: string }> {
  return MOET_CHILD_COLUMNS.flatMap((column: MoetColumn) => [
    { key: column.key, header: column.header },
    ...(column.blankAfter ? [{ key: column.blankAfter, header: '' }] : []),
  ]);
}

const RELATION_ROLES: Array<{ prefix: string; names: string[] }> = [
  { prefix: 'father', names: ['cha', 'bo', 'ba'] },
  { prefix: 'mother', names: ['me', 'ma'] },
  { prefix: 'legal_guardian', names: ['nguoi giam ho', 'giam ho'] },
];

// Số định danh không giải mã được (dữ liệu hỏng) ghi trống để tệp vẫn xuất được và báo ở Xuất file lỗi
export function readNationalId(protection: ChildDataProtection, encrypted: string): string {
  try {
    return protection.decrypt(encrypted);
  } catch {
    return '';
  }
}

const formatDate = (value: string | null | undefined) => (value ? value.split('-').reverse().join('/') : '');

// Giá trị từng cột của một học sinh, khóa theo khóa cột của tệp CSDL ngành
export async function loadMoetChildRows(
  database: Executor,
  protection: ChildDataProtection,
  childIds: string[],
): Promise<Array<{ id: string; values: Record<string, string> }>> {
  if (childIds.length === 0) {
    return [];
  }
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
      'children.gender',
      'children.moet_student_code',
      'children.national_id_encrypted',
      'children.place_of_birth',
      'children.address',
      'children.moet_profile',
      'children.two_sessions_per_day',
      'children.boarding',
      'classes.code as class_code',
    ])
    .where('children.id', 'in', childIds)
    .execute();
  const guardians = await database
    .selectFrom('child_guardians')
    .innerJoin('guardians', 'guardians.id', 'child_guardians.guardian_id')
    .innerJoin('catalog_items', 'catalog_items.id', 'child_guardians.relationship_item_id')
    .select([
      'child_guardians.child_id',
      'child_guardians.is_primary',
      'guardians.full_name',
      'guardians.phone',
      'guardians.occupation',
      'guardians.birth_year',
      'catalog_items.name as relationship',
    ])
    .where('child_guardians.child_id', 'in', childIds)
    .execute();
  const order = new Map(childIds.map((id, index) => [id, index]));
  return children
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    .map((child) => {
      const profile = (child.moet_profile ?? {}) as Record<string, unknown>;
      const values: Record<string, string> = {};
      for (const column of MOET_CHILD_COLUMNS) {
        const raw = profile[column.key];
        if (column.core || column.kind === 'secret' || raw === undefined || raw === null) {
          continue;
        }
        values[column.key] = column.kind === 'date' ? formatDate(String(raw)) : raw === true ? 'x' : String(raw);
      }
      for (const column of MOET_CHILD_COLUMNS.filter((item) => item.blankAfter)) {
        const district = profile[column.blankAfter ?? ''];
        if (district) {
          values[column.blankAfter ?? ''] = String(district);
        }
      }
      values.class_label = child.class_code ?? '';
      values.moet_student_code = child.moet_student_code ?? '';
      values.full_name = child.full_name;
      values.dob = formatDate(child.dob);
      values.gender = child.gender === 'male' ? 'Nam' : 'Nữ';
      values.national_id = readNationalId(protection, child.national_id_encrypted);
      values.place_of_birth = child.place_of_birth ?? '';
      values.address = child.address ?? '';
      values.two_sessions_per_day = child.two_sessions_per_day ? 'x' : '';
      values.boarding_class = child.boarding ? 'x' : '';
      for (const guardian of guardians.filter((item) => item.child_id === child.id)) {
        const role = RELATION_ROLES.find((item) => item.names.includes(foldText(guardian.relationship)));
        if (!role || values[`${role.prefix}_name`]) {
          continue;
        }
        values[`${role.prefix}_name`] = guardian.full_name;
        values[`${role.prefix}_phone`] = guardian.phone ?? '';
        values[`${role.prefix}_occupation`] = guardian.occupation ?? '';
        values[`${role.prefix}_birth_year`] = guardian.birth_year ? String(guardian.birth_year) : '';
        if (guardian.is_primary && guardian.phone && !values.contact_phone) {
          values.contact_phone = guardian.phone;
        }
      }
      return { id: child.id, values };
    });
}

// Tệp xlsx: trang "Học sinh" có dòng tiêu đề theo mẫu, từng dòng học sinh có STT; trang "Danh mục" khi có danh mục tra cứu
export async function buildMoetChildFile(
  rows: Array<Record<string, string>>,
  catalogs: ImportCatalog[] = [],
): Promise<Buffer> {
  const columns = moetFileColumns();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(MOET_FILE_SHEET);
  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row, index) => {
    sheet.addRow(columns.map((column) => (column.key === 'row_number' ? index + 1 : (row[column.key] ?? ''))));
  });
  // Số định danh, số điện thoại ghi dạng chữ để Excel không cắt số 0 đầu
  sheet.columns.forEach((column) => {
    column.width = 18;
    column.numFmt = '@';
  });
  if (catalogs.length > 0) {
    const lookup = workbook.addWorksheet('Danh mục');
    lookup.addRow(['Danh mục', 'Cột trong tệp', 'Mã', 'Tên', 'Ghi chú']).font = { bold: true };
    for (const catalog of catalogs) {
      for (const item of catalog.items) {
        lookup.addRow([catalog.title, catalog.column, item.code, item.name, item.note ?? '']);
      }
    }
    [24, 30, 20, 40, 30].forEach((width, index) => {
      lookup.getColumn(index + 1).width = width;
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
