import pdfmake, { type PdfContent, type PdfDocumentDefinition } from 'pdfmake';
import { crc32, deflateRawSync } from 'node:zlib';
import { ensureFonts } from '../exports/table-file.js';

// Phiếu hồ sơ cuối cấp dạng PDF (DT-17 phần 17c, khảo sát mục 10.2.3): "Xuất PDF" khổ A5 (mỗi hồ sơ một trang dọc) hoặc A4
// gập đôi (mỗi hồ sơ một trang A4 ngang chia hai nửa A5, nửa trái thông tin học sinh và nơi ở, nửa phải tuyển sinh, trạng
// thái và chữ ký, có đường gập ở giữa); "Tách file" là mỗi hồ sơ một tệp PDF gói trong tệp nén zip. "In phiếu kê khai" để
// trống ô chưa có dữ liệu thành dòng chấm cho phụ huynh điền tay; "In phiếu thông tin" in đủ thông tin và trạng thái hồ sơ
export type FinalYearPdfFormat = 'a5' | 'a4_folded';
export type FinalYearPdfKind = 'information' | 'declaration';

export interface FinalYearSheet {
  file_stem: string;
  school_name: string;
  level_label: string;
  sections: Array<{ title: string; rows: Array<[string, string | null]> }>;
  // Phần cuối nửa phải: trạng thái hồ sơ (phiếu thông tin), không có ở phiếu kê khai
  status_rows: Array<[string, string | null]>;
  // Tiêu đề riêng của phiếu (phiếu đăng ký, phiếu thông tin hồ sơ tuyển sinh của DT-17 phần 17d); trống là phiếu cuối cấp
  title?: string;
}

const DOTS = '..................................................';

function sectionContent(sheet: FinalYearSheet['sections'][number], kind: FinalYearPdfKind): PdfContent[] {
  return [
    { text: sheet.title, style: 'section' },
    {
      table: {
        widths: ['38%', '*'],
        body: sheet.rows.map(([label, value]) => [
          { text: label, style: 'label' },
          { text: value && value.trim() !== '' ? value : kind === 'declaration' ? DOTS : '' },
        ]),
      },
      layout: 'noBorders',
    },
  ];
}

function signatures(): PdfContent {
  return {
    margin: [0, 12, 0, 0],
    columns: [
      {
        stack: [
          { text: 'Xác nhận của nhà trường', bold: true },
          { text: '(Ký, ghi rõ họ tên)', italics: true },
        ],
      },
      {
        stack: [
          { text: 'Ngày ..... tháng ..... năm ........', italics: true },
          { text: 'Phụ huynh học sinh', bold: true },
          { text: '(Ký, ghi rõ họ tên)', italics: true },
        ],
      },
    ],
    alignment: 'center',
  };
}

function header(sheet: FinalYearSheet, kind: FinalYearPdfKind): PdfContent[] {
  const title =
    sheet.title ??
    (kind === 'declaration'
      ? `PHIẾU KÊ KHAI THÔNG TIN HỌC SINH CUỐI CẤP ${sheet.level_label.toUpperCase()}`
      : `PHIẾU THÔNG TIN HỌC SINH CUỐI CẤP ${sheet.level_label.toUpperCase()}`);
  return [
    { text: sheet.school_name.toUpperCase(), style: 'school' },
    { text: title, style: 'title' },
  ];
}

// Nửa trái và nửa phải của một hồ sơ; khổ A5 xếp nối tiếp trên một trang
function halves(sheet: FinalYearSheet, kind: FinalYearPdfKind): { left: PdfContent[]; right: PdfContent[] } {
  const [first, second, ...rest] = sheet.sections;
  const left = [...header(sheet, kind), ...(first ? sectionContent(first, kind) : [])];
  left.push(...(second ? sectionContent(second, kind) : []));
  const right: PdfContent[] = rest.flatMap((section) => sectionContent(section, kind));
  if (kind === 'information' && sheet.status_rows.length > 0) {
    right.push(...sectionContent({ title: 'Trạng thái hồ sơ', rows: sheet.status_rows }, kind));
  }
  right.push(signatures());
  return { left, right };
}

export async function buildFinalYearPdf(
  sheets: FinalYearSheet[],
  format: FinalYearPdfFormat,
  kind: FinalYearPdfKind,
  createdAt: Date,
): Promise<Buffer> {
  // Dùng chung phông chữ có dấu tiếng Việt của tệp bảng
  ensureFonts();
  const content: PdfContent[] = [];
  sheets.forEach((sheet, index) => {
    const { left, right } = halves(sheet, kind);
    const pageBreak = index > 0 ? { pageBreak: 'before' } : {};
    if (format === 'a5') {
      content.push({ stack: [...left, ...right], ...pageBreak });
    } else {
      content.push({ columns: [{ stack: left }, { stack: right }], columnGap: 56, ...pageBreak });
    }
  });
  if (sheets.length === 0) {
    content.push({ text: 'Không có hồ sơ.' });
  }
  const definition: PdfDocumentDefinition = {
    pageSize: format === 'a5' ? 'A5' : 'A4',
    pageOrientation: format === 'a5' ? 'portrait' : 'landscape',
    pageMargins: [28, 28, 28, 28],
    info: {
      title: sheets.length === 1 ? sheets[0]!.file_stem : 'Hồ sơ cuối cấp',
      creator: 'School Management',
      creationDate: createdAt,
    },
    defaultStyle: { font: 'Roboto', fontSize: format === 'a5' ? 8 : 9 },
    styles: {
      school: { fontSize: 8, bold: true },
      title: { fontSize: 11, bold: true, alignment: 'center', margin: [0, 6, 0, 6] },
      section: { bold: true, margin: [0, 6, 0, 2] },
      label: { color: '#444444' },
    },
    content,
    // Đường gập ở giữa trang A4 ngang
    ...(format === 'a4_folded'
      ? {
          background: (_page: number, size: { width: number; height: number }) => ({
            canvas: [
              {
                type: 'line',
                x1: size.width / 2,
                y1: 16,
                x2: size.width / 2,
                y2: size.height - 16,
                dash: { length: 4 },
                lineWidth: 0.5,
                lineColor: '#999999',
              },
            ],
          }),
        }
      : {}),
  };
  return pdfmake.createPdf(definition).getBuffer();
}

// Tệp nén zip tối thiểu (nén deflate, không mật khẩu) cho "Tách file": mỗi hồ sơ một tệp PDF. Tên tệp mã UTF-8 (cờ bit 11)
export function buildZip(entries: Array<{ name: string; body: Buffer }>, createdAt: Date): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const time = (createdAt.getHours() << 11) | (createdAt.getMinutes() << 5) | Math.floor(createdAt.getSeconds() / 2);
  const date = ((createdAt.getFullYear() - 1980) << 9) | ((createdAt.getMonth() + 1) << 5) | createdAt.getDate();
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.body);
    const checksum = crc32(entry.body);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(checksum, 14);
    head.writeUInt32LE(compressed.length, 18);
    head.writeUInt32LE(entry.body.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, name, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x0800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt16LE(time, 12);
    record.writeUInt16LE(date, 14);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(compressed.length, 20);
    record.writeUInt32LE(entry.body.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += head.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
