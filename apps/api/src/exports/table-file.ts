import ExcelJS from 'exceljs';
import pdfmake from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Tệp bảng dùng chung cho Xuất Excel và Xuất PDF của lưới dữ liệu (DT-16 phần 16a, khảo sát mục 2.3 của Sở): cùng cột theo
// thứ tự người dùng chọn, cùng dòng theo bộ lọc. PDF khổ A4 ngang, dòng tiêu đề lặp lại mỗi trang, phông Roboto có dấu tiếng
// Việt đi kèm thư viện pdfmake
export type TableFileFormat = 'xlsx' | 'pdf';
export const TABLE_FILE_FORMATS: TableFileFormat[] = ['xlsx', 'pdf'];

export const CONTENT_TYPES: Record<TableFileFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export interface TableFileColumn {
  key: string;
  label: string;
  width?: number;
}

export interface TableFileSheet {
  title: string;
  // Dòng tiêu đề, ghi chú trên bảng (ví dụ tên trường, năm học)
  heading?: string[];
  columns: TableFileColumn[];
  rows: Array<Record<string, unknown>>;
  // Thêm cột STT đầu bảng
  numbered?: boolean;
}

const FONT_FILES = ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf'];
let fontsReady = false;

// Phông chữ đọc từ gói pdfmake một lần; Roboto-Medium dùng cho chữ đậm
function ensureFonts(): void {
  if (fontsReady) {
    return;
  }
  const require = createRequire(import.meta.url);
  // Ghi phông vào bộ nhớ của pdfmake rồi gọi theo tên tệp, không cho thư viện đọc ổ đĩa
  const virtualFiles = (pdfmake as unknown as { virtualfs: { writeFileSync(name: string, body: Buffer): void } })
    .virtualfs;
  for (const name of FONT_FILES) {
    virtualFiles.writeFileSync(name, readFileSync(require.resolve(`pdfmake/build/fonts/Roboto/${name}`)));
  }
  pdfmake.setFonts({
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });
  // Tài liệu chỉ có chữ, không tải ảnh hay tệp từ mạng hoặc ổ đĩa
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  fontsReady = true;
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    return value.toLocaleString('vi-VN');
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  return String(value);
}

function sheetColumns(sheet: TableFileSheet): TableFileColumn[] {
  return sheet.numbered ? [{ key: '__index', label: 'STT', width: 6 }, ...sheet.columns] : sheet.columns;
}

function sheetRows(sheet: TableFileSheet): Array<Record<string, unknown>> {
  return sheet.numbered ? sheet.rows.map((row, index) => ({ ...row, __index: index + 1 })) : sheet.rows;
}

async function buildWorkbook(sheets: TableFileSheet[], createdAt: Date): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'School Management';
  workbook.created = createdAt;
  for (const sheet of sheets) {
    // Tên bảng tính tối đa 31 ký tự, không có ký tự đặc biệt
    const worksheet = workbook.addWorksheet(sheet.title.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31));
    for (const line of sheet.heading ?? []) {
      worksheet.addRow([line]).font = { bold: true };
    }
    if (sheet.heading?.length) {
      worksheet.addRow([]);
    }
    const columns = sheetColumns(sheet);
    worksheet.addRow(columns.map((column) => column.label)).font = { bold: true };
    for (const row of sheetRows(sheet)) {
      worksheet.addRow(columns.map((column) => row[column.key] ?? ''));
    }
    columns.forEach((column, index) => {
      worksheet.getColumn(index + 1).width = column.width ?? 22;
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildPdf(sheets: TableFileSheet[], createdAt: Date): Promise<Buffer> {
  ensureFonts();
  const content: Content[] = [];
  sheets.forEach((sheet, sheetIndex) => {
    const columns = sheetColumns(sheet);
    const heading = sheet.heading?.length ? sheet.heading : [sheet.title];
    heading.forEach((line, index) => {
      content.push({
        text: line,
        style: index === 0 ? 'title' : 'note',
        ...(index === 0 && sheetIndex > 0 ? { pageBreak: 'before' as const } : {}),
      });
    });
    const header: TableCell[] = columns.map((column) => ({ text: column.label, style: 'header' }));
    const body: TableCell[][] = [
      header,
      ...sheetRows(sheet).map((row) => columns.map((column) => ({ text: cellText(row[column.key]) }))),
    ];
    if (sheet.rows.length === 0) {
      body.push([{ text: 'Không có dữ liệu.', colSpan: columns.length }, ...columns.slice(1).map(() => ({ text: '' }))]);
    }
    content.push({
      table: {
        headerRows: 1,
        // Cột STT hẹp, các cột khác chia đều theo độ rộng gợi ý
        widths: columns.map((column) => (column.key === '__index' ? 'auto' : '*')),
        body,
      },
      layout: { fillColor: (rowIndex: number) => (rowIndex === 0 ? '#eef2f7' : null) },
    });
  });
  const stamp = createdAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const definition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 28, 24, 32],
    info: { title: sheets[0]?.title ?? 'Danh sách', creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    styles: {
      title: { fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
      note: { fontSize: 9, margin: [0, 0, 0, 2] },
      header: { bold: true },
    },
    content: [...content],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Xuất lúc ${stamp}`, fontSize: 7 },
        { text: `Trang ${currentPage}/${pageCount}`, alignment: 'right', fontSize: 7 },
      ],
      margin: [24, 8, 24, 0],
    }),
  };
  return pdfmake.createPdf(definition).getBuffer();
}

export function buildTableFile(format: TableFileFormat, sheets: TableFileSheet[], createdAt: Date): Promise<Buffer> {
  return format === 'pdf' ? buildPdf(sheets, createdAt) : buildWorkbook(sheets, createdAt);
}

// Đổi phần mở rộng của tên tệp theo định dạng
export function withExtension(fileName: string, format: TableFileFormat): string {
  return fileName.replace(/\.(xlsx|pdf)$/i, '') + `.${format}`;
}

// Đọc định dạng xuất trong thân yêu cầu; bỏ trống là Excel
export function readTableFileFormat(value: unknown): TableFileFormat | undefined {
  if (value === undefined || value === null) {
    return 'xlsx';
  }
  return TABLE_FILE_FORMATS.includes(value as TableFileFormat) ? (value as TableFileFormat) : undefined;
}
