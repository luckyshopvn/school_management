import ExcelJS from 'exceljs';
import type { BankStatementDateFormat } from '@school-management/database';
import { validationError } from '@school-management/server';

// Đọc tệp sao kê ngân hàng dạng Excel (.xlsx) hoặc CSV thành bảng chữ; đọc ngày và số tiền theo cách ghi phổ biến của các
// ngân hàng (G3-05; P06-06; YCTD-89). Tệp CSV đọc theo UTF-8 (có hoặc không có BOM), dấu phân cách phẩy, chấm phẩy hoặc tab
export type StatementFileFormat = 'xlsx' | 'csv';

function isZip(body: Buffer): boolean {
  return body.length > 4 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
}

// Không tin phần mở rộng: tệp nén chữ ký PK là Excel; tệp chữ đọc được theo UTF-8 là CSV
export function detectFormat(body: Buffer): StatementFileFormat {
  if (isZip(body)) {
    return 'xlsx';
  }
  const text = body.toString('utf8');
  if (text.includes('�') || text.includes('\u0000')) {
    throw validationError([{ field: 'file', message: 'Tệp không phải Excel dạng xlsx hoặc CSV mã UTF-8' }]);
  }
  return 'csv';
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object' && 'result' in value) {
    const result = value.result;
    if (result instanceof Date) {
      return result.toISOString().slice(0, 10);
    }
    if (typeof result === 'number') {
      return String(result);
    }
  }
  return cell.text.trim();
}

async function readWorkbook(body: Buffer): Promise<string[][]> {
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
  const rows: string[][] = [];
  const columns = sheet.columnCount;
  for (let index = 1; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    const values: string[] = [];
    for (let column = 1; column <= columns; column += 1) {
      values.push(cellText(row.getCell(column)));
    }
    rows.push(values);
  }
  return rows;
}

// Dấu phân cách là ký tự xuất hiện nhiều nhất ngoài ngoặc kép ở dòng đầu có chữ
function delimiterOf(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  let best = ',';
  let bestCount = -1;
  for (const candidate of [',', ';', '\t']) {
    let count = 0;
    let quoted = false;
    for (const character of firstLine) {
      if (character === '"') {
        quoted = !quoted;
      } else if (!quoted && character === candidate) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string): string[][] {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const delimiter = delimiterOf(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

export async function readStatementRows(body: Buffer, format: StatementFileFormat): Promise<string[][]> {
  return format === 'xlsx' ? readWorkbook(body) : parseCsv(body.toString('utf8'));
}

// Tên cột so sánh không phân biệt hoa thường, bỏ khoảng trắng thừa
export const normalizeHeader = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

// Số tiền nguyên đồng: chấp nhận dấu chấm hoặc phẩy phân cách hàng nghìn, phần lẻ ",00" hoặc ".00", dấu trừ, ngoặc
// đơn là số âm; phần lẻ khác 0 là lỗi. Ô trống trả 0
export function parseAmount(text: string): number | null {
  const raw = text.trim();
  if (raw === '') {
    return 0;
  }
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-') || raw.endsWith('-');
  let value = raw.replace(/[^\d.,]/g, '');
  if (value === '') {
    return null;
  }
  const decimal = /[.,](\d{1,2})$/.exec(value);
  if (decimal) {
    if (Number(decimal[1]) !== 0) {
      return null;
    }
    value = value.slice(0, decimal.index);
  }
  const digits = value.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  const amount = Number(digits);
  return negative ? -amount : amount;
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

// Ngày theo cách ghi của cấu hình (ngày/tháng/năm, năm/tháng/ngày, tháng/ngày/năm; phân cách / - .), bỏ phần giờ phía
// sau; ô ngày của Excel đã đọc thành năm-tháng-ngày nên luôn nhận
export function parseStatementDate(text: string, format: BankStatementDateFormat): string | null {
  const value = text.trim().split(/[\sT]/)[0] ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const parts = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/.exec(value);
  if (!parts) {
    return null;
  }
  const [first, second, third] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const yearFirst = (parts[1] ?? '').length === 4;
  const yearLast = (parts[3] ?? '').length === 4;
  if (format === 'ymd') {
    return yearFirst ? validDate(first, second, third) : null;
  }
  if (!yearLast) {
    return null;
  }
  return format === 'dmy' ? validDate(third, second, first) : validDate(third, first, second);
}
