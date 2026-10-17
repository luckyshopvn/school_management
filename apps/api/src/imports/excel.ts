import ExcelJS from 'exceljs';
import { validationError } from '@school-management/server';
import * as XLSX from 'xlsx';

// Đọc và tạo tệp Excel cho nhập dữ liệu (P01-13, P02-12, BM-27, BM-63)
export const MAXIMUM_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAXIMUM_IMPORT_ROWS = 2000;

export interface ImportColumn {
  key: string;
  header: string;
  note: string;
}

// Danh mục tra cứu khi điền tệp nhập (DT-16 phần 16a, "Tra cứu danh mục" của Sở): mã, tên của các danh mục dùng trong tệp
export interface ImportCatalog {
  key: string;
  title: string;
  // Cột của tệp nhập ghi mã hoặc tên của danh mục này
  column: string;
  items: Array<{ code: string; name: string; note?: string }>;
}

export interface RowError {
  row: number;
  column: string | null;
  message: string;
}

export type SheetRow = { row: number; values: Record<string, string> };

// Tệp xlsx là tệp nén, bắt đầu bằng chữ ký PK; không tin phần mở rộng của tên tệp (BM-27)
function isZip(body: Buffer): boolean {
  return body.length > 4 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value instanceof Date) {
    // Excel lưu ngày dạng nửa đêm giờ quốc tế
    return value.toISOString().slice(0, 10);
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'result' in value && value.result instanceof Date) {
    return value.result.toISOString().slice(0, 10);
  }
  return cell.text.trim();
}

// Đọc trang tính đầu tiên; dòng 1 là tiêu đề phải khớp mẫu; bỏ qua dòng trống. Có danh sách cột được chọn để nhập
// (DT-16 phần 16a) thì tìm cột theo tiêu đề, tệp chỉ cần có các cột được chọn; cột không chọn đọc là rỗng
export async function readSheet(body: Buffer, columns: ImportColumn[], selected?: Set<string>): Promise<SheetRow[]> {
  if (!isZip(body)) {
    throw validationError([{ field: 'file', message: 'Tệp không phải Excel dạng xlsx' }]);
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(body as unknown as ArrayBuffer);
  } catch {
    throw validationError([{ field: 'file', message: 'Không đọc được tệp Excel' }]);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw validationError([{ field: 'file', message: 'Tệp không có trang tính' }]);
  }
  const header = sheet.getRow(1);
  // Vị trí (bắt đầu từ 1) của từng cột trong tệp; 0 là không đọc
  let positions: number[];
  if (selected) {
    const headers: string[] = [];
    header.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      headers[columnNumber] = normalizeHeader(cellText(cell));
    });
    positions = columns.map((column) => (selected.has(column.key) ? headers.indexOf(column.header) : 0));
    const missing = columns.filter((column, index) => selected.has(column.key) && (positions[index] ?? -1) < 1);
    if (missing.length > 0) {
      throw validationError([
        { field: 'file', message: `Tiêu đề cột không đúng mẫu: ${missing.map((column) => column.header).join(', ')}` },
      ]);
    }
  } else {
    const mismatched = columns.filter((column, index) => cellText(header.getCell(index + 1)) !== column.header);
    if (mismatched.length > 0) {
      throw validationError([
        {
          field: 'file',
          message: `Tiêu đề cột không đúng mẫu: ${mismatched.map((column) => column.header).join(', ')}`,
        },
      ]);
    }
    positions = columns.map((_column, index) => index + 1);
  }
  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const values = Object.fromEntries(
      columns.map((column, index) => {
        const position = positions[index] ?? 0;
        return [column.key, position > 0 ? cellText(row.getCell(position)) : ''];
      }),
    );
    if (Object.values(values).some((value) => value !== '')) {
      rows.push({ row: rowNumber, values });
    }
  });
  if (rows.length === 0) {
    throw validationError([{ field: 'file', message: 'Tệp chưa có dòng dữ liệu nào' }]);
  }
  if (rows.length > MAXIMUM_IMPORT_ROWS) {
    throw validationError([{ field: 'file', message: `Mỗi tệp tối đa ${MAXIMUM_IMPORT_ROWS} dòng` }]);
  }
  return rows;
}

// Tệp mẫu: trang dữ liệu (có thể kèm dữ liệu đang có, "Tải file mẫu kèm dữ liệu"), trang Hướng dẫn và trang Danh mục để tra
// mã, tên khi điền (DT-16 phần 16a)
export async function buildTemplate(
  title: string,
  columns: ImportColumn[],
  options: { rows?: Array<Record<string, unknown>>; catalogs?: ImportCatalog[] } = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(1).font = { bold: true };
  for (const row of options.rows ?? []) {
    sheet.addRow(columns.map((column) => row[column.key] ?? ''));
  }
  sheet.columns.forEach((column) => {
    column.width = 24;
  });
  const guide = workbook.addWorksheet('Hướng dẫn');
  guide.addRow(['Cột', 'Cách ghi']);
  guide.getRow(1).font = { bold: true };
  for (const column of columns) {
    guide.addRow([column.header, column.note]);
  }
  guide.getColumn(1).width = 32;
  guide.getColumn(2).width = 90;
  if (options.catalogs?.length) {
    const lookup = workbook.addWorksheet('Danh mục');
    lookup.addRow(['Danh mục', 'Cột trong tệp', 'Mã', 'Tên', 'Ghi chú']).font = { bold: true };
    for (const catalog of options.catalogs) {
      for (const item of catalog.items) {
        lookup.addRow([catalog.title, catalog.column, item.code, item.name, item.note ?? '']);
      }
    }
    [20, 24, 20, 40, 30].forEach((width, index) => {
      lookup.getColumn(index + 1).width = width;
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Số dòng (như Excel hiển thị) của dòng tiêu đề trong năm dòng đầu có đủ các tiêu đề nhận diện; không thấy thì là dòng 1
export function findHeaderRowNumber(body: Buffer, identifyingHeaders: string[]): number {
  try {
    const workbook = XLSX.read(body, { type: 'buffer' });
    const firstName = workbook.SheetNames[0];
    const sheet = firstName ? workbook.Sheets[firstName] : undefined;
    if (!sheet) {
      return 1;
    }
    const firstRow = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r : 0;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });
    const wanted = identifyingHeaders.map((header) => header.toLowerCase());
    const index = grid.slice(0, 5).findIndex((cells) => {
      const texts = cells.map((cell) => normalizeHeader(plainCell(cell)).toLowerCase());
      return wanted.every((header) => texts.includes(header));
    });
    return index < 0 ? 1 : firstRow + index + 1;
  } catch {
    return 1;
  }
}

// "Xuất file lỗi" (DT-16 phần 16a): tệp gốc người dùng tải lên kèm cột "Nội dung lỗi" sau cột cuối, mỗi dòng lỗi ghi các
// lỗi của dòng đó; tệp xls cũng trả về dạng xlsx. Dòng tiêu đề của cột lỗi là dòng tiêu đề của tệp
export function buildErrorWorkbook(body: Buffer, errors: RowError[], headerRowNumber: number): Buffer {
  const workbook = XLSX.read(body, { type: 'buffer', cellDates: true });
  const firstName = workbook.SheetNames[0];
  const sheet = firstName ? workbook.Sheets[firstName] : undefined;
  if (!sheet) {
    throw validationError([{ field: 'file', message: 'Tệp không có trang tính' }]);
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const errorColumn = range.e.c + 1;
  const messages = new Map<number, string[]>();
  for (const error of errors) {
    const list = messages.get(error.row) ?? [];
    list.push(error.column ? `${error.column}: ${error.message}` : error.message);
    messages.set(error.row, list);
  }
  XLSX.utils.sheet_add_aoa(sheet, [[ERROR_COLUMN_HEADER]], { origin: { r: headerRowNumber - 1, c: errorColumn } });
  for (const [row, list] of messages) {
    XLSX.utils.sheet_add_aoa(sheet, [[list.join('; ')]], { origin: { r: row - 1, c: errorColumn } });
  }
  sheet['!cols'] = [...(sheet['!cols'] ?? [])];
  sheet['!cols'][errorColumn] = { wch: 60 };
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
}

export const ERROR_COLUMN_HEADER = 'Nội dung lỗi';

// Ngày ghi dạng YYYY-MM-DD hoặc DD/MM/YYYY
export function parseDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const vietnamese = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : vietnamese
      ? [Number(vietnamese[3]), Number(vietnamese[2]), Number(vietnamese[1])]
      : [0, 0, 0];
  if (!year) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

// Tệp xls (Excel 97-2003) là tệp ghép OLE2, bắt đầu bằng chữ ký D0 CF 11 E0 A1 B1 1A E1
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function isOle2(body: Buffer): boolean {
  return body.length > 8 && OLE2_SIGNATURE.every((byte, index) => body[index] === byte);
}

export interface WorkbookTable {
  // Tiêu đề từng cột theo vị trí, đã gộp khoảng trắng và xuống dòng; cột không tiêu đề là chuỗi rỗng
  headers: string[];
  // Dòng dữ liệu (số dòng như Excel hiển thị) và giá trị từng ô theo vị trí, dạng chữ; ô ngày đổi thành YYYY-MM-DD
  rows: Array<{ row: number; cells: string[] }>;
}

export const normalizeHeader = (text: string) => text.replace(/\s+/g, ' ').trim();

function plainCell(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

// Đọc trang tính đầu tiên của tệp xls hoặc xlsx bằng SheetJS (tệp xuất từ CSDL ngành là xls, exceljs không đọc được);
// dòng tiêu đề là dòng đầu tiên trong năm dòng đầu có đủ các tiêu đề nhận diện; bỏ qua dòng trống (YCTD-100)
export function readWorkbookTable(body: Buffer, identifyingHeaders: string[]): WorkbookTable {
  if (!isZip(body) && !isOle2(body)) {
    throw validationError([{ field: 'file', message: 'Tệp không phải Excel dạng xls hoặc xlsx' }]);
  }
  let grid: unknown[][];
  // Dòng đầu của vùng dữ liệu trang tính (bắt đầu từ 0), để báo số dòng đúng như Excel
  let firstRow = 0;
  try {
    const workbook = XLSX.read(body, { type: 'buffer', cellDates: true, UTC: true, dense: true });
    const firstName = workbook.SheetNames[0];
    const sheet = firstName ? workbook.Sheets[firstName] : undefined;
    firstRow = sheet?.['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r : 0;
    grid = sheet
      ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true, UTC: true })
      : [];
  } catch {
    throw validationError([{ field: 'file', message: 'Không đọc được tệp Excel' }]);
  }
  const wanted = identifyingHeaders.map((header) => header.toLowerCase());
  const headerIndex = grid.slice(0, 5).findIndex((cells) => {
    const texts = cells.map((cell) => normalizeHeader(plainCell(cell)).toLowerCase());
    return wanted.every((header) => texts.includes(header));
  });
  if (headerIndex < 0) {
    throw validationError([
      { field: 'file', message: `Không tìm thấy dòng tiêu đề có các cột: ${identifyingHeaders.join(', ')}` },
    ]);
  }
  const headers = (grid[headerIndex] ?? []).map((cell) => normalizeHeader(plainCell(cell)));
  const rows: WorkbookTable['rows'] = [];
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const texts = headers.map((_, index) => plainCell(cells[index]));
    if (texts.some((text) => text !== '')) {
      rows.push({ row: firstRow + headerIndex + offset + 2, cells: texts });
    }
  });
  if (rows.length === 0) {
    throw validationError([{ field: 'file', message: 'Tệp chưa có dòng dữ liệu nào' }]);
  }
  if (rows.length > MAXIMUM_IMPORT_ROWS) {
    throw validationError([{ field: 'file', message: `Mỗi tệp tối đa ${MAXIMUM_IMPORT_ROWS} dòng` }]);
  }
  return { headers, rows };
}
