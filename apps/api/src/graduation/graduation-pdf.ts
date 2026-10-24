import pdfmake, { type PdfDocumentDefinition } from 'pdfmake';
import { ensureFonts } from '../exports/table-file.js';

// Giấy chứng nhận tốt nghiệp tạm thời và biên bản của kỳ xét, kỳ thi tốt nghiệp (DT-21 phần 21f, YCTD-174), bố cục chung;
// mẫu của Bộ, Sở khớp khi khảo sát. Nội dung do nơi gọi truyền vào
const dateText = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

export interface GraduationCertificateContent {
  school_name: string;
  level_label: string;
  session_name: string;
  certificate_no: string;
  student: { full_name: string; dob: string; place_of_birth: string | null; gender: string };
  score: string | null;
  decided_at: string | null;
}

export async function graduationCertificatePdf(content: GraduationCertificateContent): Promise<Buffer> {
  ensureFonts();
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [50, 40, 50, 40],
    info: { title: `Giấy chứng nhận tốt nghiệp ${content.student.full_name}`, creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 13 },
    content: [
      {
        columns: [
          { stack: [{ text: content.school_name.toUpperCase(), bold: true, alignment: 'center' }] },
          {
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, alignment: 'center' },
              { text: 'Độc lập - Tự do - Hạnh phúc', alignment: 'center' },
            ],
          },
        ],
        margin: [0, 0, 0, 24],
      },
      {
        text: 'GIẤY CHỨNG NHẬN TỐT NGHIỆP TẠM THỜI',
        fontSize: 24,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      { text: content.level_label, fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: content.session_name, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: 'Chứng nhận', italics: true, alignment: 'center' },
      { text: content.student.full_name, fontSize: 22, bold: true, alignment: 'center', margin: [0, 6, 0, 6] },
      {
        text: `${content.student.gender}, sinh ngày ${dateText(content.student.dob)}${
          content.student.place_of_birth ? `, nơi sinh ${content.student.place_of_birth}` : ''
        }`,
        alignment: 'center',
      },
      { text: 'đã được công nhận tốt nghiệp.', alignment: 'center', margin: [0, 6, 0, 0] },
      content.score ? { text: `Điểm xét tốt nghiệp: ${content.score}`, alignment: 'center', margin: [0, 4, 0, 0] } : '',
      {
        columns: [
          { text: `Số: ${content.certificate_no}`, alignment: 'left' },
          {
            text: `Ngày ${dateText(content.decided_at)}\nHiệu trưởng`,
            alignment: 'center',
            margin: [0, 0, 0, 0],
          },
        ],
        margin: [0, 28, 0, 0],
      },
    ],
  };
  return pdfmake.createPdf(definition).getBuffer();
}

export interface GraduationMinutesContent {
  school_name: string;
  session_name: string;
  kind_label: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

export async function graduationMinutesPdf(content: GraduationMinutesContent): Promise<Buffer> {
  ensureFonts();
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 40, 50, 50],
    info: { title: content.title, creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 11 },
    content: [
      { text: content.school_name.toUpperCase(), bold: true, alignment: 'center' },
      { text: content.kind_label.toUpperCase(), fontSize: 15, bold: true, alignment: 'center', margin: [0, 8, 0, 2] },
      { text: content.session_name, alignment: 'center', margin: [0, 0, 0, 10] },
      { text: content.title, bold: true, margin: [0, 0, 0, 6] },
      { text: content.content, margin: [0, 0, 0, 16] },
      {
        columns: [
          { text: '' },
          {
            stack: [
              { text: `Ngày ${dateText(content.created_at.slice(0, 10))}`, italics: true },
              { text: 'Người lập biên bản', bold: true },
              { text: content.author, margin: [0, 28, 0, 0] },
            ],
            alignment: 'center',
          },
        ],
      },
    ],
  };
  return pdfmake.createPdf(definition).getBuffer();
}
