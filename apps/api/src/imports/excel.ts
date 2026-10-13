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

// Đọc trang tính đầu tiên; dòng 1 là tiêu đề phải khớp mẫu; bỏ qua dòng trống
export async function readSheet(body: Buffer, columns: ImportColumn[]): Promise<SheetRow[]> {
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
  const mismatched = columns.filter((column, index) => cellText(header.getCell(index + 1)) !== column.header);
  if (mismatched.length > 0) {
    throw validationError([
      { field: 'file', message: `Tiêu đề cột không đúng mẫu: ${mismatched.map((column) => column.header).join(', ')}` },
    ]);
  }
  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const values = Object.fromEntries(columns.map((column, index) => [column.key, cellText(row.getCell(index + 1))]));
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

export async function buildTemplate(title: string, columns: ImportColumn[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title);
  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(1).font = { bold: true };
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
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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
