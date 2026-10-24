import pdfmake, { type PdfContent, type PdfDocumentDefinition } from 'pdfmake';
import type { TableFileSheet } from '../exports/table-file.js';
import { ensureFonts } from '../exports/table-file.js';

// Học bạ số dạng PDF (DT-20 phần 20e, YCTD-163) theo bố cục học bạ tiểu học: thông tin học sinh, quá trình học tập của năm,
// kết quả môn học và hoạt động giáo dục (mức đạt, điểm kiểm tra định kỳ cuối năm, nhận xét), phẩm chất chủ yếu, năng lực
// (mức đạt), đánh giá kết quả giáo dục, khen thưởng, hoàn thành chương trình, nhận xét của giáo viên chủ nhiệm, xác nhận của
// Hiệu trưởng. Nội dung đọc từ bản chốt lúc lập (`learning_records.content`), số định danh in đủ hay che do nơi gọi quyết
export interface LearningRecordContent {
  school_name: string;
  academic_year_name: string;
  class_name: string;
  grade_name: string;
  student: {
    full_name: string;
    gender: string;
    dob: string;
    place_of_birth: string | null;
    address: string | null;
    moet_student_code: string | null;
    guardians: string[];
  };
  homeroom_teacher: string | null;
  subjects: Array<{ name: string; level: string | null; score: number | null; comment: string | null }>;
  competencies: Array<{ group: string; name: string; level: string | null }>;
  year_result: string | null;
  awards: string[];
  completion: string | null;
  // Học bạ THCS, THPT (DT-21 phần 21e): điểm trung bình môn học kỳ I, II, cả năm (môn nhận xét ghi Đạt, Chưa đạt), xếp loại
  // học tập, rèn luyện theo học kỳ và cả năm; không có thì là học bạ Tiểu học
  secondary?: {
    subjects: Array<{
      name: string;
      mode: 'score' | 'comment';
      first: string | null;
      second: string | null;
      year: string | null;
    }>;
    ratings: Record<'first' | 'second' | 'year', { learning: string | null; conduct: string | null }>;
  };
}

const dateText = (value: string | null) => (value ? value.split('-').reverse().join('/') : '');

function infoRows(content: LearningRecordContent, nationalId: string): Array<[string, string]> {
  return [
    ['Họ và tên học sinh', content.student.full_name],
    ['Giới tính', content.student.gender],
    ['Ngày sinh', dateText(content.student.dob)],
    ['Nơi sinh', content.student.place_of_birth ?? ''],
    ['Số định danh cá nhân', nationalId],
    ['Mã học sinh', content.student.moet_student_code ?? ''],
    ['Nơi ở', content.student.address ?? ''],
    ['Cha mẹ hoặc người giám hộ', content.student.guardians.join('; ')],
  ];
}

// Bảng số liệu cho khối xác nhận kí nội bộ (DossierSigner) và tệp kèm
export function learningRecordSheets(
  content: LearningRecordContent,
  nationalId: string,
  homeroomComment: string | null,
): TableFileSheet[] {
  return [
    {
      title: 'Học bạ',
      columns: [
        { key: 'label', label: 'Mục', width: 30 },
        { key: 'value', label: 'Nội dung', width: 70 },
      ],
      rows: [
        ...infoRows(content, nationalId),
        ['Năm học, lớp', `${content.academic_year_name}, lớp ${content.class_name}`],
        ...(content.secondary?.subjects ?? []).map((subject): [string, string] => [
          subject.name,
          `HK I ${subject.first ?? '-'}; HK II ${subject.second ?? '-'}; cả năm ${subject.year ?? '-'}`,
        ]),
        ...(content.secondary
          ? (['first', 'second', 'year'] as const).map((term): [string, string] => [
              `Xếp loại ${term === 'first' ? 'học kỳ I' : term === 'second' ? 'học kỳ II' : 'cả năm'}`,
              `Học tập: ${content.secondary?.ratings[term].learning ?? '-'}; rèn luyện: ${content.secondary?.ratings[term].conduct ?? '-'}`,
            ])
          : []),
        ...content.subjects.map((subject): [string, string] => [
          subject.name,
          [subject.level, subject.score === null ? null : `điểm ${subject.score}`, subject.comment]
            .filter(Boolean)
            .join('; '),
        ]),
        ...content.competencies.map((item): [string, string] => [item.name, item.level ?? '']),
        ['Đánh giá kết quả giáo dục', content.year_result ?? ''],
        ['Khen thưởng', content.awards.join('; ')],
        ['Hoàn thành chương trình', content.completion ?? ''],
        ['Nhận xét của giáo viên chủ nhiệm', homeroomComment ?? ''],
      ].map(([label, value]) => ({ label, value })),
    },
  ];
}

export async function learningRecordPdf(
  content: LearningRecordContent,
  nationalId: string,
  homeroomComment: string | null,
  status: { signed: boolean; signer_name: string | null },
): Promise<Buffer> {
  ensureFonts();
  const table = (widths: string[], header: string[], rows: string[][]): PdfContent => ({
    table: {
      headerRows: 1,
      widths,
      body: [header.map((text) => ({ text, bold: true })), ...rows.map((row) => row.map((text) => ({ text })))],
    },
    margin: [0, 4, 0, 8],
  });
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 36, 40, 40],
    info: { title: `Học bạ ${content.student.full_name} ${content.academic_year_name}`, creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    content: [
      { text: content.school_name.toUpperCase(), bold: true, alignment: 'center' },
      { text: 'HỌC BẠ', fontSize: 16, bold: true, alignment: 'center', margin: [0, 6, 0, 2] },
      {
        text: `Năm học ${content.academic_year_name} · Lớp ${content.class_name} (${content.grade_name})`,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: ['32%', '*'],
          body: infoRows(content, nationalId).map(([label, value]) => [{ text: label, bold: true }, { text: value }]),
        },
        layout: 'noBorders',
      },
      ...(content.secondary
        ? [
            { text: '1. Kết quả học tập các môn học', bold: true, margin: [0, 10, 0, 0] } as PdfContent,
            table(
              ['40%', '20%', '20%', '*'],
              ['Môn học', 'Học kỳ I', 'Học kỳ II', 'Cả năm'],
              content.secondary.subjects.map((subject) => [
                subject.name,
                subject.first ?? '',
                subject.second ?? '',
                subject.year ?? '',
              ]),
            ),
            { text: '2. Kết quả học tập, rèn luyện', bold: true } as PdfContent,
            table(
              ['40%', '30%', '*'],
              ['Kỳ', 'Học tập', 'Rèn luyện'],
              (['first', 'second', 'year'] as const).map((term) => [
                term === 'first' ? 'Học kỳ I' : term === 'second' ? 'Học kỳ II' : 'Cả năm',
                content.secondary?.ratings[term].learning ?? '',
                content.secondary?.ratings[term].conduct ?? '',
              ]),
            ),
          ]
        : [
            { text: '1. Môn học và hoạt động giáo dục', bold: true, margin: [0, 10, 0, 0] } as PdfContent,
            table(
              ['30%', '20%', '12%', '*'],
              ['Môn học, hoạt động giáo dục', 'Mức đạt', 'Điểm KTĐK', 'Nhận xét'],
              content.subjects.map((subject) => [
                subject.name,
                subject.level ?? '',
                subject.score === null ? '' : String(subject.score),
                subject.comment ?? '',
              ]),
            ),
            { text: '2. Phẩm chất chủ yếu và năng lực', bold: true } as PdfContent,
            table(
              ['30%', '40%', '*'],
              ['Nhóm', 'Phẩm chất, năng lực', 'Mức đạt'],
              content.competencies.map((item) => [item.group, item.name, item.level ?? '']),
            ),
          ]),
      {
        table: {
          widths: ['32%', '*'],
          body: [
            ['3. Đánh giá kết quả giáo dục', content.year_result ?? ''],
            ['4. Khen thưởng', content.awards.join('; ')],
            ['5. Hoàn thành chương trình', content.completion ?? ''],
            ['6. Nhận xét của giáo viên chủ nhiệm', homeroomComment ?? ''],
          ].map(([label, value]) => [{ text: label, bold: true }, { text: value }]),
        },
        layout: 'noBorders',
      },
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            stack: [
              { text: 'Giáo viên chủ nhiệm', bold: true },
              { text: content.homeroom_teacher ?? '', margin: [0, 30, 0, 0] },
            ],
          },
          {
            stack: [
              { text: 'Hiệu trưởng', bold: true },
              {
                text: status.signed ? `Đã xác nhận và kí: ${status.signer_name ?? ''}` : '(Chưa xác nhận)',
                italics: !status.signed,
                margin: [0, 30, 0, 0],
              },
            ],
          },
        ],
        alignment: 'center',
      },
    ],
  };
  return pdfmake.createPdf(definition).getBuffer();
}
