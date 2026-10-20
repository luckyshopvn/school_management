import pdfmake, { type PdfContent, type PdfDocumentDefinition } from 'pdfmake';
import { ensureFonts } from '../exports/table-file.js';

// Mẫu báo cáo KPI dạng văn bản (DT-18 phần 18d, YCTD-139): một nội dung dựng thành tệp Word (.docx) hoặc PDF. Tệp Word ghi
// trực tiếp WordprocessingML trong gói nén không nén (không thêm thư viện); phông Times New Roman cỡ 13 như văn bản hành chính
export type DocumentBlock =
  | { kind: 'header'; left: string[]; right: string[] }
  | { kind: 'title'; text: string; subtitle?: string }
  | { kind: 'heading'; text: string }
  | {
      kind: 'paragraph';
      text: string;
      bold?: boolean;
      italic?: boolean;
      align?: 'left' | 'center' | 'right' | 'justify';
    }
  | { kind: 'table'; header: string[]; rows: string[][]; widths?: number[]; boldRows?: number[] }
  | {
      kind: 'signatures';
      left?: { title: string; note?: string; name?: string };
      right: { title: string; note?: string; name?: string };
    };

export interface DocumentOptions {
  title: string;
  landscape?: boolean;
}

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_TYPE = 'application/pdf';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run(text: string, options: { bold?: boolean; italic?: boolean; size?: number } = {}): string {
  const properties = [
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.size ? `<w:sz w:val="${options.size * 2}"/><w:szCs w:val="${options.size * 2}"/>` : '',
  ].join('');
  const lines = text.split('\n');
  return lines
    .map(
      (line, index) =>
        `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}${index > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escape(line)}</w:t></w:r>`,
    )
    .join('');
}

function paragraph(
  text: string,
  options: { bold?: boolean; italic?: boolean; align?: string; size?: number; spacingAfter?: number } = {},
): string {
  const align = options.align === 'justify' ? 'both' : (options.align ?? 'left');
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${options.spacingAfter ?? 60}"/></w:pPr>${run(text, options)}</w:p>`;
}

function cell(content: string, width: number, bold = false): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph(content, { bold, size: 11, spacingAfter: 0 })}</w:tc>`;
}

function table(header: string[], rows: string[][], widths: number[], boldRows: number[] = []): string {
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
    .join('');
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join('');
  const line = (cells: string[], bold: boolean) =>
    `<w:tr>${cells.map((text, index) => cell(text, widths[index] ?? 1000, bold)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${line(header, true)}${rows
    .map((row, index) => line(row, boldRows.includes(index)))
    .join('')}</w:tbl>${paragraph('')}`;
}

// Hai cột không viền: tiêu đề cơ quan bên trái, quốc hiệu hoặc khối chữ ký bên phải
function twoColumns(left: string[], right: string[], width: number, bold: boolean[] = []): string {
  const half = Math.floor(width / 2);
  const column = (lines: string[]) =>
    `<w:tc><w:tcPr><w:tcW w:w="${half}" w:type="dxa"/></w:tcPr>${
      lines
        .map((text, index) => paragraph(text, { bold: bold[index] ?? false, align: 'center', spacingAfter: 0 }))
        .join('') || paragraph('')
    }</w:tc>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="${half}"/><w:gridCol w:w="${half}"/></w:tblGrid><w:tr>${column(left)}${column(right)}</w:tr></w:tbl>${paragraph('')}`;
}

export function buildDocx(blocks: DocumentBlock[], options: DocumentOptions): Buffer {
  const pageWidth = options.landscape ? 16838 : 11906;
  const pageHeight = options.landscape ? 11906 : 16838;
  const contentWidth = pageWidth - 2 * 1134;
  const body = blocks
    .map((block) => {
      switch (block.kind) {
        case 'header':
          return twoColumns(block.left, block.right, contentWidth, [false, true, false]);
        case 'title':
          return (
            paragraph(block.text, { bold: true, align: 'center', size: 14, spacingAfter: 0 }) +
            (block.subtitle ? paragraph(block.subtitle, { bold: true, align: 'center' }) : '')
          );
        case 'heading':
          return paragraph(block.text, { bold: true });
        case 'paragraph':
          return paragraph(block.text, block);
        case 'table': {
          const total = (block.widths ?? block.header.map(() => 1)).reduce((sum, width) => sum + width, 0);
          const widths = (block.widths ?? block.header.map(() => 1)).map((width) =>
            Math.floor((width / total) * contentWidth),
          );
          return table(block.header, block.rows, widths, block.boldRows);
        }
        case 'signatures': {
          const side = (value?: { title: string; note?: string; name?: string }) =>
            value ? [value.title, value.note ?? '', '', '', value.name ?? ''] : [];
          return twoColumns(side(block.left), side(block.right), contentWidth, [true]);
        }
      }
    })
    .join('');
  const orientation = options.landscape ? ' w:orient="landscape"' : '';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"${orientation}/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escape(options.title)}</dc:title><dc:creator>School Management</dc:creator></cp:coreProperties>`;
  return zipStored([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['docProps/core.xml', core],
    ['word/document.xml', document],
    ['word/styles.xml', styles],
    ['word/_rels/document.xml.rels', documentRels],
  ]);
}

export async function buildDocumentPdf(blocks: DocumentBlock[], options: DocumentOptions): Promise<Buffer> {
  ensureFonts();
  const content: PdfContent[] = blocks.map((block): PdfContent => {
    switch (block.kind) {
      case 'header':
        return {
          columns: [
            { stack: block.left.map((text) => ({ text, alignment: 'center' })) },
            { stack: block.right.map((text, index) => ({ text, alignment: 'center', bold: index === 0 })) },
          ],
          margin: [0, 0, 0, 10],
        };
      case 'title':
        return {
          stack: [
            { text: block.text, bold: true, fontSize: 13, alignment: 'center' },
            ...(block.subtitle ? [{ text: block.subtitle, bold: true, alignment: 'center' }] : []),
          ],
          margin: [0, 0, 0, 8],
        };
      case 'heading':
        return { text: block.text, bold: true, margin: [0, 6, 0, 3] };
      case 'paragraph':
        return {
          text: block.text,
          bold: block.bold ?? false,
          italics: block.italic ?? false,
          alignment: block.align ?? 'left',
          margin: [0, 0, 0, 3],
        };
      case 'table': {
        const widths = block.widths ?? block.header.map(() => 1);
        const total = widths.reduce((sum, width) => sum + width, 0);
        return {
          table: {
            headerRows: 1,
            widths: widths.map((width) => `${(width / total) * 100}%`),
            body: [
              block.header.map((text) => ({ text, bold: true })),
              ...block.rows.map((row, index) =>
                row.map((text) => ({ text, bold: block.boldRows?.includes(index) ?? false })),
              ),
            ],
          },
          fontSize: 9,
          margin: [0, 0, 0, 8],
        };
      }
      case 'signatures': {
        const side = (value?: { title: string; note?: string; name?: string }) =>
          value
            ? {
                stack: [
                  { text: value.title, bold: true, alignment: 'center' },
                  { text: value.note ?? '', italics: true, alignment: 'center' },
                  { text: '\n\n\n' },
                  { text: value.name ?? '', bold: true, alignment: 'center' },
                ],
              }
            : { text: '' };
        return { columns: [side(block.left), side(block.right)], margin: [0, 12, 0, 0] };
      }
    }
  });
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageOrientation: options.landscape ? 'landscape' : 'portrait',
    pageMargins: [40, 36, 40, 36],
    info: { title: options.title, creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    content,
  };
  return pdfmake.createPdf(definition).getBuffer();
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Gói nén ZIP chỉ lưu (không nén); đủ cho tệp Office
export function zipStored(entries: Array<[string, string | Buffer]>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const data = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    const fileName = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, fileName, data);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt32LE(0, 12);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(fileName.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}
