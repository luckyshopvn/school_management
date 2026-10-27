import pdfmake, { type PdfDocumentDefinition } from 'pdfmake';
import { ensureFonts } from '../../exports/table-file.js';
import { issuedDateText, type RecognitionConfig } from './recognition-rules.js';

// Tệp PDF chứng nhận hoàn thành khoá tự chọn (DT-28 phần 28i, YCTD-279): A4 ngang theo mẫu của trường (tên chứng nhận, chức danh
// và họ tên người ký ở cấu hình), họ tên đầy đủ của học sinh, tên khoá, ngày cấp, mã kiểm tra và đường dẫn trang kiểm tra công khai
export async function buildCertificatePdf(input: {
  certificate: { code: string; course_title: string; school_name: string; holder_name: string; issued_at: Date };
  template: RecognitionConfig['certificate'];
  verifyUrl: string;
}): Promise<Buffer> {
  ensureFonts();
  const { certificate, template } = input;
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [56, 56, 56, 56],
    info: {
      title: `${template.title} ${certificate.code}`,
      creator: 'School Management',
      creationDate: certificate.issued_at,
    },
    defaultStyle: { font: 'Roboto', fontSize: 13, alignment: 'center' },
    content: [
      { text: certificate.school_name.toUpperCase(), bold: true, fontSize: 14 },
      { text: template.title.toUpperCase(), bold: true, fontSize: 26, margin: [0, 48, 0, 24] },
      { text: 'Chứng nhận học sinh', margin: [0, 0, 0, 8] },
      { text: certificate.holder_name, bold: true, fontSize: 22, margin: [0, 0, 0, 16] },
      { text: 'đã hoàn thành khoá học', margin: [0, 0, 0, 8] },
      { text: certificate.course_title, bold: true, fontSize: 18, margin: [0, 0, 0, 32] },
      {
        columns: [
          {
            width: '*',
            alignment: 'left',
            fontSize: 10,
            stack: [`Mã kiểm tra: ${certificate.code}`, `Kiểm tra tại: ${input.verifyUrl}`],
          },
          {
            width: 260,
            stack: [
              `Ngày ${issuedDateText(certificate.issued_at)}`,
              { text: template.signer_title.toUpperCase(), bold: true, margin: [0, 4, 0, 48] },
              template.signer_name || ' ',
            ],
          },
        ],
      },
    ],
    background: (_page: number, size: { width: number; height: number }) => ({
      canvas: [
        { type: 'rect', x: 24, y: 24, w: size.width - 48, h: size.height - 48, lineWidth: 2, lineColor: '#1e3a8a' },
      ],
    }),
  };
  return pdfmake.createPdf(definition).getBuffer();
}
