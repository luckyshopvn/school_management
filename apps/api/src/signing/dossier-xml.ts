import type { SigningDocument } from '@school-management/shared';

// Tệp dữ liệu XML của hồ sơ kí (DT-17 phần 17b, YCTD-133). Hệ thống của Sở dựng cửa sổ "Xem hồ sơ ký" từ tệp XML theo mã
// định danh hồ sơ và mã loại (HO_SO_TRUONG, HO_SO_LOP, HO_SO_NHAN_SU, HO_SO_HOC_SINH); khảo sát chỉ thấy tên mục, chưa có
// lược đồ của Bộ. Bản nội bộ tự đặt lược đồ theo tên mục: phần tử gốc là mã loại, mỗi phần một phần tử (tên suy từ tiêu đề
// phần), mỗi mục một phần tử con (tên suy từ nhãn mục, thuộc tính "nhan" là nhãn đầy đủ), phần dạng bảng có các phần tử DONG.
// Khi có lược đồ của Bộ thì thay InternalDossierXmlWriter bằng lớp dựng theo lược đồ đó; phần còn lại của quy trình không đổi
export interface DossierXmlInput {
  code: string;
  academicYearName: string | null;
  createdAt: Date;
  document: SigningDocument;
}

export abstract class DossierXmlWriter {
  // Ghi vào tài liệu và tệp để biết tệp theo lược đồ nào
  abstract readonly schema: string;
  abstract write(input: DossierXmlInput): Buffer;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

// Bỏ ký tự điều khiển XML 1.0 không cho phép rồi thoát ký tự đặc biệt
export function escapeXml(value: string): string {
  return [...value]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
    })
    .join('')
    .replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export class InternalDossierXmlWriter extends DossierXmlWriter {
  readonly schema = 'school-management/ho-so-ki/1';

  write(input: DossierXmlInput): Buffer {
    const { document } = input;
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<${document.root} ma_dinh_danh_ho_so="${escapeXml(input.code)}" loai_ho_so="${document.root}" luoc_do="${this.schema}"` +
        ` thoi_diem_lap="${input.createdAt.toISOString()}"` +
        (input.academicYearName ? ` nam_hoc="${escapeXml(input.academicYearName)}"` : '') +
        ` tieu_de="${escapeXml(document.title)}">`,
    ];
    for (const part of document.sections) {
      lines.push(`  <${part.key} ten="${escapeXml(part.title)}">`);
      for (const item of part.items ?? []) {
        lines.push(`    <${item.key} nhan="${escapeXml(item.label)}">${escapeXml(item.value)}</${item.key}>`);
      }
      if (part.table) {
        part.table.rows.forEach((row, index) => {
          lines.push(`    <DONG stt="${index + 1}">`);
          for (const column of part.table?.columns ?? []) {
            lines.push(
              `      <${column.key} nhan="${escapeXml(column.label)}">${escapeXml(row[column.key] ?? '')}</${column.key}>`,
            );
          }
          lines.push('    </DONG>');
        });
      }
      lines.push(`  </${part.key}>`);
    }
    lines.push(`</${document.root}>`, '');
    return Buffer.from(lines.join('\n'), 'utf8');
  }
}
