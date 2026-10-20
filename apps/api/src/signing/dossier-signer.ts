import type { PdfContent } from 'pdfmake';
import { buildPdf, type TableFileSheet } from '../exports/table-file.js';

// Chỗ nối chữ ký số (DT-16 phần 16k). Bản nội bộ không có chữ ký số: lập lại tệp PDF từ đúng số liệu đã tạo hồ sơ rồi thêm
// khối "Xác nhận kí nội bộ" ghi người kí, chức danh, thời điểm kí, thông tin chứng thư đã khai báo, ảnh con dấu (nếu có) và
// mã băm SHA-256 của tệp hồ sơ gốc; tệp không mang chữ ký số nên không có giá trị pháp lý của văn bản điện tử kí số. Khi có
// nhà cung cấp kí số (ví dụ kí từ xa của VNPT-CA) thì thay InternalDossierSigner bằng lớp gọi giao diện lập trình của nhà
// cung cấp: nhận tệp gốc, trả tệp đã kí số và đặt digital = true; phần còn lại của quy trình không đổi
export interface DossierSignatureInput {
  code: string;
  title: string;
  heading: string[];
  sheets: TableFileSheet[];
  originalPdf: Buffer;
  originalSha256: string;
  signedAt: Date;
  signerName: string;
  certificate: {
    signatureTypeLabel: string;
    provider: string | null;
    holderName: string | null;
    holderTitle: string | null;
    serialNumber: string | null;
  };
  // Ảnh con dấu dạng data:image/png;base64,… hoặc data:image/jpeg;base64,…
  sealImage: string | null;
  // Mã tra cứu in thành mã QR ở khối xác nhận (văn bản đi, DT-18 phần 18b); text là nội dung của mã QR (địa chỉ trang tra
  // cứu hoặc chính mã khi chưa biết địa chỉ)
  verification?: { code: string; text: string } | null;
}

export interface DossierSignatureResult {
  pdf: Buffer;
  // Ghi vào hồ sơ (cột signature_method) để biết tệp kí bằng cách nào
  method: string;
}

export abstract class DossierSigner {
  // true khi tệp trả về có chữ ký số thật
  abstract readonly digital: boolean;
  abstract readonly description: string;
  abstract sign(input: DossierSignatureInput): Promise<DossierSignatureResult>;
}

const VIETNAM_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function withHeading(sheets: TableFileSheet[], heading: string[]): TableFileSheet[] {
  return sheets.map((sheet, index) => (index === 0 ? { ...sheet, heading } : sheet));
}

export class InternalDossierSigner extends DossierSigner {
  readonly digital = false;
  readonly description =
    'Chưa có nhà cung cấp kí số: hồ sơ được kí xác nhận nội bộ (ghi người kí, thời điểm kí, mã băm của tệp gốc), không phải chữ ký số';

  async sign(input: DossierSignatureInput): Promise<DossierSignatureResult> {
    const certificate = input.certificate;
    const lines = [
      `Người kí: ${input.signerName}`,
      `Thời điểm kí: ${VIETNAM_TIME.format(input.signedAt)}`,
      `Người đứng tên chứng thư: ${[certificate.holderName, certificate.holderTitle].filter(Boolean).join(', ') || '—'}`,
      `Chứng thư đã khai báo: ${[certificate.signatureTypeLabel, certificate.provider, certificate.serialNumber]
        .filter(Boolean)
        .join(' – ')}`,
      `Mã định danh hồ sơ: ${input.code}`,
      `Mã băm SHA-256 của tệp hồ sơ gốc: ${input.originalSha256}`,
      ...(input.verification ? [`Mã tra cứu: ${input.verification.code}`] : []),
    ];
    const closing: PdfContent[] = [
      {
        unbreakable: true,
        margin: [0, 16, 0, 0],
        stack: [
          { text: 'XÁC NHẬN KÍ NỘI BỘ', style: 'title' },
          {
            text: 'Hồ sơ được kí xác nhận trên phần mềm quản lý của nhà trường; đây không phải chữ ký số.',
            italics: true,
            margin: [0, 0, 0, 4],
          },
          {
            columns: [
              { width: '*', stack: lines.map((text) => ({ text, fontSize: 9, margin: [0, 0, 0, 2] })) },
              ...(input.sealImage ? [{ width: 110, image: input.sealImage, fit: [110, 110] }] : []),
              ...(input.verification ? [{ width: 90, qr: input.verification.text, fit: 90 }] : []),
            ],
            columnGap: 12,
          },
        ],
      },
    ];
    const pdf = await buildPdf(withHeading(input.sheets, input.heading), input.signedAt, {
      orientation: 'portrait',
      closing,
      subject: `${input.title} – đã kí xác nhận nội bộ`,
    });
    return { pdf, method: 'internal' };
  }
}
