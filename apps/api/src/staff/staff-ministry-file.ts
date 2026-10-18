import { matchStaffCatalog, STAFF_CATALOGS, type StaffCatalogKey } from '@school-management/shared';
import ExcelJS from 'exceljs';
import { MOET_STAFF_COLUMNS, type MoetColumn } from '../imports/moet-columns.js';

// Tệp hồ sơ cán bộ, giáo viên theo mẫu 75 cột của CSDL ngành (DT-16 phần 16f, bản chạy nội bộ của "Đồng bộ hồ sơ lên CSDL
// Bộ" mục 3.1.1 của Sở). Chưa có giao diện lập trình của Bộ nên trường xuất tệp rồi tự nộp; tệp đọc lại được bằng "Nhập nhân
// sự từ Excel" (cùng tiêu đề cột, cột quận/huyện cũ không tên ngay sau cột tỉnh). Hàm thuần, không đọc cơ sở dữ liệu
export interface MinistryStaffRecord {
  code: string;
  moet_staff_code: string | null;
  full_name: string;
  gender: 'male' | 'female' | null;
  dob: string | null;
  email: string | null;
  phone: string | null;
  // Số định danh, số sổ BHXH đã giải mã (chỉ dùng để dựng tệp, không trả về giao diện)
  id_number: string | null;
  social_insurance_number: string | null;
  moet_profile: Record<string, unknown> | null;
}

export interface MinistryIssue {
  code: string;
  full_name: string;
  column: string;
  message: string;
}

const formatDate = (value: unknown) => (typeof value === 'string' && value ? value.split('-').reverse().join('/') : '');
const GENDER_LABELS = { male: 'Nam', female: 'Nữ' } as const;
const PHONE_PATTERN = /^0\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_NUMBER_PATTERN = /^\d{12}$/;

// Cột của tệp theo thứ tự, kèm cột quận/huyện cũ không tên sau cột tỉnh của từng nhóm địa chỉ
export const MINISTRY_STAFF_LAYOUT: Array<{ key: string; header: string; kind: MoetColumn['kind']; core: boolean }> =
  MOET_STAFF_COLUMNS.flatMap((column) => [
    { key: column.key, header: column.header, kind: column.kind, core: column.core === true },
    ...(column.blankAfter ? [{ key: column.blankAfter, header: '', kind: 'text' as const, core: false }] : []),
  ]);

// Giá trị một ô của tệp: ngày ghi ngày/tháng/năm, ô đánh dấu ghi "x"
export function ministryCells(record: MinistryStaffRecord, rowNumber: number): string[] {
  const profile = record.moet_profile ?? {};
  const core: Record<string, string> = {
    row_number: String(rowNumber),
    moet_staff_code: record.moet_staff_code ?? '',
    full_name: record.full_name,
    gender: record.gender ? GENDER_LABELS[record.gender] : '',
    dob: formatDate(record.dob),
    id_number: record.id_number ?? '',
    email: record.email ?? '',
    phone: record.phone ?? '',
  };
  return MINISTRY_STAFF_LAYOUT.map((column) => {
    if (column.core) {
      return core[column.key] ?? '';
    }
    if (column.kind === 'secret') {
      return column.key === 'social_insurance_number' ? (record.social_insurance_number ?? '') : '';
    }
    const value = profile[column.key];
    if (column.kind === 'date') {
      return formatDate(value);
    }
    if (column.kind === 'flag') {
      return value === true ? 'x' : typeof value === 'string' ? value : '';
    }
    return typeof value === 'string' ? value : '';
  });
}

const headerOf = (key: string) => MOET_STAFF_COLUMNS.find((column) => column.key === key)?.header ?? key;
const textOf = (record: MinistryStaffRecord, key: string) => {
  const value = record.moet_profile?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

// Ô bắt buộc theo danh mục của Bộ (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, theo các ô mục 5.9 của Sở xét
// thiếu và các cột có danh mục của tệp CSDL ngành)
const REQUIRED_CATALOG_FIELDS: StaffCatalogKey[] = [
  'staff_status',
  'ethnicity',
  'religion',
  'job_position',
  'position_group',
  'contract_form',
  'professional_qualification',
];

// Kiểm tra một hồ sơ trước khi nộp: thiếu ô bắt buộc, sai định dạng, giá trị ngoài danh mục của Bộ
export function checkMinistryRecord(record: MinistryStaffRecord): MinistryIssue[] {
  const issues: MinistryIssue[] = [];
  const add = (key: string, message: string) =>
    issues.push({ code: record.code, full_name: record.full_name, column: headerOf(key), message });
  if (!record.full_name.trim()) {
    add('full_name', 'Thiếu họ tên');
  }
  if (!record.gender) {
    add('gender', 'Thiếu giới tính');
  }
  if (!record.dob) {
    add('dob', 'Thiếu ngày sinh');
  }
  if (!record.id_number) {
    add('id_number', 'Thiếu số định danh cá nhân');
  } else if (!ID_NUMBER_PATTERN.test(record.id_number)) {
    add('id_number', 'Số định danh cá nhân phải đủ 12 chữ số');
  }
  if (record.phone && !PHONE_PATTERN.test(record.phone)) {
    add('phone', 'Điện thoại phải gồm 10 chữ số bắt đầu bằng 0');
  }
  if (record.email && !EMAIL_PATTERN.test(record.email)) {
    add('email', 'Email không đúng định dạng');
  }
  for (const key of REQUIRED_CATALOG_FIELDS) {
    const value = textOf(record, key);
    if (!value) {
      add(key, `Thiếu ${STAFF_CATALOGS[key].title.toLowerCase()}`);
    } else if (!matchStaffCatalog(key, value)) {
      add(key, `"${value}" không có trong danh mục ${STAFF_CATALOGS[key].title.toLowerCase()} của Bộ`);
    }
  }
  if (!textOf(record, 'permanent_province') || !textOf(record, 'permanent_ward')) {
    add('permanent_province', 'Thiếu tỉnh/thành phố hoặc xã/phường thường trú');
  }
  if (!textOf(record, 'recruitment_date')) {
    add('recruitment_date', 'Thiếu ngày tuyển dụng');
  }
  return issues;
}

const ISSUE_COLUMNS = ['STT', 'Mã nhân sự', 'Họ tên', 'Cột', 'Lỗi'];

function addIssueSheet(workbook: ExcelJS.Workbook, title: string, issues: MinistryIssue[]) {
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(ISSUE_COLUMNS).font = { bold: true };
  issues.forEach((issue, index) => {
    sheet.addRow([index + 1, issue.code, issue.full_name, issue.column, issue.message]);
  });
  [6, 16, 28, 32, 70].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

// Tệp theo mẫu Bộ: trang "Hồ sơ" (75 cột), trang "Kiểm tra dữ liệu" (số hồ sơ, số hồ sơ đạt, từng lỗi) và trang "Danh mục"
// (danh mục của Bộ để tra khi sửa). Dùng cho "Xuất tệp theo mẫu Bộ", "Tải file mẫu" (không có dòng) và tệp hồ sơ chuyển đi
export async function buildMinistryWorkbook(
  records: MinistryStaffRecord[],
  options: { checks?: boolean; catalogs?: boolean } = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hồ sơ');
  sheet.addRow(MINISTRY_STAFF_LAYOUT.map((column) => column.header)).font = { bold: true };
  records.forEach((record, index) => {
    // Ghi chữ để Excel không cắt số 0 đầu của số định danh, điện thoại
    const row = sheet.addRow(ministryCells(record, index + 1));
    row.eachCell((cell) => {
      cell.numFmt = '@';
    });
  });
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  if (options.checks) {
    const issues = records.flatMap(checkMinistryRecord);
    const failed = new Set(issues.map((issue) => issue.code));
    const summary = workbook.addWorksheet('Kiểm tra dữ liệu');
    summary.addRow(['Số hồ sơ', records.length]);
    summary.addRow(['Hồ sơ đủ thông tin', records.length - failed.size]);
    summary.addRow(['Hồ sơ còn lỗi', failed.size]);
    summary.addRow(['Tệp chưa được gửi đi; trường tự nộp tệp lên CSDL ngành']);
    summary.addRow([]);
    summary.addRow(ISSUE_COLUMNS).font = { bold: true };
    issues.forEach((issue, index) => {
      summary.addRow([index + 1, issue.code, issue.full_name, issue.column, issue.message]);
    });
    [20, 16, 28, 32, 70].forEach((width, index) => {
      summary.getColumn(index + 1).width = width;
    });
  }
  if (options.catalogs) {
    addCatalogSheet(workbook);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// "Xuất file lỗi": chỉ các hồ sơ thiếu hoặc sai ô bắt buộc, mỗi lỗi một dòng
export async function buildMinistryErrorWorkbook(issues: MinistryIssue[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addIssueSheet(workbook, 'Hồ sơ lỗi', issues);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addCatalogSheet(workbook: ExcelJS.Workbook) {
  const lookup = workbook.addWorksheet('Danh mục');
  lookup.addRow(['Danh mục', 'Cột trong tệp', 'Giá trị']).font = { bold: true };
  for (const [key, catalog] of Object.entries(STAFF_CATALOGS)) {
    for (const item of catalog.items) {
      lookup.addRow([catalog.title, headerOf(key), item]);
    }
  }
  [24, 28, 50].forEach((width, index) => {
    lookup.getColumn(index + 1).width = width;
  });
}

// Danh mục của Bộ cho "Tra cứu danh mục" của màn hình nhập
export function ministryCatalogs() {
  return Object.entries(STAFF_CATALOGS).map(([key, catalog]) => ({
    key,
    title: catalog.title,
    column: headerOf(key),
    items: catalog.items.map((item) => ({ code: item, name: item })),
  }));
}
