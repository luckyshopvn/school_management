import pdfmake, { type PdfDocumentDefinition } from 'pdfmake';
import { dateParts } from '../emulation/emulation-documents.js';
import { ensureFonts } from '../exports/table-file.js';

// Chứng nhận hoàn thành khoá bồi dưỡng do trường cấp (DT-22 phần 22e, YCTD-182): khổ A4 ngang như giấy khen của 22d, mã QR
// dẫn tới trang tra cứu công khai trên cổng của trường; nhiều chứng nhận thì mỗi chứng nhận một trang
export interface TrainingCertificateContent {
  issuer: string;
  staff_name: string;
  department: string | null;
  course_name: string;
  start_date: string;
  end_date: string;
  periods: number | null;
  issued_date: string;
  lookup_code: string;
  verification_text: string;
}

const dateText = (date: string) => date.split('-').reverse().join('/');

function certificatePage(content: TrainingCertificateContent, breakBefore: boolean): PdfDocumentDefinition['content'] {
  const issued = dateParts(content.issued_date);
  return [
    {
      columns: [
        { stack: [{ text: content.issuer.toUpperCase(), bold: true, alignment: 'center' }] },
        {
          stack: [
            { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, alignment: 'center' },
            { text: 'Độc lập - Tự do - Hạnh phúc', alignment: 'center' },
          ],
        },
      ],
      margin: [0, 0, 0, 30],
      ...(breakBefore ? { pageBreak: 'before' as const } : {}),
    },
    { text: 'GIẤY CHỨNG NHẬN', fontSize: 30, bold: true, alignment: 'center', margin: [0, 0, 0, 16] },
    { text: 'Chứng nhận', italics: true, alignment: 'center' },
    { text: content.staff_name, fontSize: 24, bold: true, alignment: 'center', margin: [0, 6, 0, 6] },
    ...(content.department ? [{ text: content.department, alignment: 'center' as const }] : []),
    { text: 'Đã hoàn thành khoá bồi dưỡng', alignment: 'center', margin: [0, 10, 0, 4] },
    { text: content.course_name, fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 6] },
    {
      text: [
        `Từ ngày ${dateText(content.start_date)} đến ngày ${dateText(content.end_date)}`,
        content.periods ? `, thời lượng ${content.periods} tiết` : '',
      ].join(''),
      alignment: 'center',
      margin: [0, 0, 0, 24],
    },
    {
      columns: [
        {
          width: 120,
          stack: [
            { qr: content.verification_text, fit: 100 },
            { text: `Mã tra cứu: ${content.lookup_code}`, fontSize: 9, margin: [0, 4, 0, 0] },
          ],
        },
        {
          text: `Ngày ${issued.day} tháng ${issued.month} năm ${issued.year}`,
          italics: true,
          alignment: 'center',
        },
      ],
    },
  ];
}

export async function trainingCertificatesPdf(contents: TrainingCertificateContent[]): Promise<Buffer> {
  ensureFonts();
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [50, 40, 50, 40],
    info: { title: 'Giấy chứng nhận bồi dưỡng', creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 13 },
    content: contents.flatMap((content, index) => certificatePage(content, index > 0) as never[]),
  };
  return pdfmake.createPdf(definition).getBuffer();
}
