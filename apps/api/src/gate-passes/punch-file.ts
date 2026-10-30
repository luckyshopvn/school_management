import ExcelJS from 'exceljs';
import type { GatePassDirection } from '@school-management/database';

// Đọc tệp xuất từ máy chấm công (YCTD-389 lát L2): CSV (phân cách dấu phẩy hoặc chấm phẩy, mã UTF-8) hoặc Excel xlsx, dòng 1 là
// tiêu đề. Cột bắt buộc "Mã" (mã thẻ của học sinh hoặc mã cán bộ đã khai trên máy) và "Thời điểm" (giờ Việt Nam); cột "Hướng" (Vào,
// Ra) không bắt buộc. Hàm thuần để kiểm thử không cần cơ sở dữ liệu
export const MAXIMUM_PUNCH_ROWS = 5000;

export interface PunchRow {
  line: number;
  code: string;
  occurredAt: Date | null;
  direction: GatePassDirection | null;
  error: string | null;
}

const HEADER_KEYS: Record<string, 'code' | 'time' | 'direction'> = {
  ma: 'code',
  code: 'code',
  'ma cham cong': 'code',
  'thoi diem': 'time',
  time: 'time',
  'thoi gian': 'time',
  huong: 'direction',
  direction: 'direction',
};

// Bỏ dấu, chữ thường, gộp khoảng trắng để so tiêu đề
function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();
}

// "2026-10-30 07:12", "2026-10-30 07:12:05", "30/10/2026 07:12" theo giờ Việt Nam
export function parseVietnamDateTime(value: string): Date | null {
  const text = value.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  let parts: string[] | null = match
    ? [match[1], match[2], match[3], match[4], match[5], match[6] ?? '00'].map(String)
    : null;
  if (!parts) {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    parts = match ? [match[3], match[2], match[1], match[4], match[5], match[6] ?? '00'].map(String) : null;
  }
  if (!parts) {
    return null;
  }
  const [year, month, day, hour, minute, second] = parts.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const moment = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  // Ngày không có thật (31/02) bị Date tự chuyển sang tháng sau
  const check = new Date(moment.getTime() + 7 * 3_600_000);
  return check.getUTCDate() === day && check.getUTCMonth() === month - 1 ? moment : null;
}

export function parseDirection(value: string): GatePassDirection | null | 'invalid' {
  const text = plain(value);
  if (text === '') {
    return null;
  }
  if (['vao', 'in', 'v'].includes(text)) {
    return 'in';
  }
  if (['ra', 'out', 'r'].includes(text)) {
    return 'out';
  }
  return 'invalid';
}

// Bảng chuỗi (dòng 1 là tiêu đề) thành các dòng chấm công; dòng trống bị bỏ qua
export function rowsToPunches(table: string[][]): PunchRow[] {
  const header = (table[0] ?? []).map((cell) => HEADER_KEYS[plain(cell)]);
  const position = (key: 'code' | 'time' | 'direction') => header.indexOf(key);
  if (position('code') < 0 || position('time') < 0) {
    throw new Error('Tiêu đề phải có cột "Mã" và "Thời điểm"');
  }
  const rows: PunchRow[] = [];
  for (const [index, cells] of table.slice(1).entries()) {
    if (cells.every((cell) => cell.trim() === '')) {
      continue;
    }
    const code = (cells[position('code')] ?? '').trim();
    const timeText = cells[position('time')] ?? '';
    const occurredAt = parseVietnamDateTime(timeText);
    const direction = position('direction') >= 0 ? parseDirection(cells[position('direction')] ?? '') : null;
    let error: string | null = null;
    if (!code) {
      error = 'Thiếu mã';
    } else if (!occurredAt) {
      error = `Thời điểm "${timeText.trim()}" không đúng dạng năm-tháng-ngày giờ:phút`;
    } else if (direction === 'invalid') {
      error = 'Hướng chỉ là Vào hoặc Ra';
    }
    rows.push({ line: index + 2, code, occurredAt, direction: direction === 'invalid' ? null : direction, error });
    if (rows.length > MAXIMUM_PUNCH_ROWS) {
      throw new Error(`Mỗi tệp tối đa ${MAXIMUM_PUNCH_ROWS} dòng`);
    }
  }
  return rows;
}

// CSV đơn giản: hỗ trợ ô trong dấu ngoặc kép, phân cách dấu phẩy hoặc chấm phẩy (Excel tiếng Việt xuất chấm phẩy)
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < body.length; index++) {
    const character = body[index];
    if (quoted) {
      if (character === '"' && body[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === separator) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && body[index + 1] === '\n') {
        index++;
      }
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    table.push(row);
  }
  return table;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value instanceof Date) {
    // Excel lưu giờ địa phương như giờ quốc tế: lấy nguyên con số
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && 'text' in value) {
    return String(value.text);
  }
  if (typeof value === 'object' && 'result' in value) {
    return value.result instanceof Date ? cellText(value.result) : String(value.result ?? '');
  }
  return String(value);
}

export async function readPunchFile(fileName: string, body: Buffer): Promise<PunchRow[]> {
  const isZip = body.length > 3 && body[0] === 0x50 && body[1] === 0x4b;
  if (!isZip) {
    if (!/\.csv$/i.test(fileName)) {
      throw new Error('Chỉ nhận tệp CSV hoặc Excel xlsx');
    }
    return rowsToPunches(parseCsv(body.toString('utf8')));
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(body as unknown as ArrayBuffer);
  } catch {
    throw new Error('Không đọc được tệp Excel');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Tệp không có trang tính');
  }
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cells[column - 1] = cellText(cell.value);
    });
    table.push(Array.from(cells, (cell) => cell ?? ''));
  });
  return rowsToPunches(table);
}
