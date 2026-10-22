import {
  EMULATION_CHECK_STATE_LABELS,
  EMULATION_DECISION_KIND_LABELS,
  EMULATION_POSITION_LABELS,
  EMULATION_TARGET_LABELS,
  type EmulationCheck,
  type EmulationCriterion,
  type EmulationPositionCode,
  type EmulationTargetCode,
} from '@school-management/shared';
import pdfmake, { type PdfDocumentDefinition } from 'pdfmake';
import { ensureFonts } from '../exports/table-file.js';
import type { DocumentBlock } from '../kpi/kpi-documents.js';

// Văn bản của thi đua, khen thưởng (DT-18 phần 22d, YCTD-148) dựng thành khối nội dung chung với mẫu báo cáo KPI (tệp Word
// hoặc PDF): thông báo phát động, báo cáo thành tích, biên bản họp hội đồng, quyết định hoặc tờ trình; giấy khen là PDF ngang
// riêng có mã QR tra cứu. Bố cục theo thể thức văn bản hành chính, do Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11

const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

export function dateParts(date: Date | string): { day: string; month: string; year: string } {
  const value = typeof date === 'string' ? new Date(`${date}T12:00:00+07:00`) : date;
  const parts = DAY_FORMAT.formatToParts(value).reduce<Record<string, string>>(
    (result, part) => ({ ...result, [part.type]: part.value }),
    {},
  );
  return { day: parts.day ?? '', month: parts.month ?? '', year: parts.year ?? '' };
}

const dateLine = (date: Date | string) => {
  const parts = dateParts(date);
  return `..., ngày ${parts.day} tháng ${parts.month} năm ${parts.year}`;
};

export const displayDate = (date: string | null) => (date ? date.split('-').reverse().join('/') : '');

function header(school: string, date: Date | string, number?: string): DocumentBlock {
  return {
    kind: 'header',
    left: [school.toUpperCase(), number ? `Số: ${number}` : ''],
    right: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', dateLine(date)],
  };
}

const paragraphs = (text: string | null): DocumentBlock[] =>
  (text ?? '')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => ({ kind: 'paragraph', text: line, align: 'justify' }));

export interface LaunchContent {
  school: string;
  name: string;
  description: string | null;
  year_name: string;
  registration_deadline: string | null;
  nomination_deadline: string | null;
  titles: Array<{ name: string; target: EmulationTargetCode; description: string | null }>;
  date: Date;
  signer: string;
}

export function launchBlocks(content: LaunchContent): DocumentBlock[] {
  return [
    header(content.school, content.date),
    { kind: 'title', text: 'THÔNG BÁO PHÁT ĐỘNG THI ĐUA', subtitle: content.name },
    { kind: 'paragraph', text: `Năm học ${content.year_name}`, italic: true, align: 'center' },
    { kind: 'heading', text: 'I. NỘI DUNG PHÁT ĐỘNG' },
    ...paragraphs(content.description),
    { kind: 'heading', text: 'II. DANH HIỆU, HÌNH THỨC KHEN THƯỞNG' },
    {
      kind: 'table',
      header: ['TT', 'Danh hiệu, hình thức', 'Đối tượng', 'Tiêu chuẩn'],
      rows: content.titles.map((title, index) => [
        String(index + 1),
        title.name,
        EMULATION_TARGET_LABELS[title.target],
        title.description ?? '',
      ]),
      widths: [1, 5, 2, 9],
    },
    { kind: 'heading', text: 'III. TỔ CHỨC THỰC HIỆN' },
    {
      kind: 'paragraph',
      text: `Cá nhân, tập thể đăng ký thi đua trên phần mềm${content.registration_deadline ? ` trước ngày ${displayDate(content.registration_deadline)}` : ''}; nộp hồ sơ đề nghị kèm minh chứng${content.nomination_deadline ? ` trước ngày ${displayDate(content.nomination_deadline)}` : ''}.`,
      align: 'justify',
    },
    { kind: 'signatures', right: { title: 'HIỆU TRƯỞNG', name: content.signer } },
  ];
}

export interface NominationContent {
  school: string;
  title_name: string;
  target: EmulationTargetCode;
  subject_name: string;
  department_name: string | null;
  year_name: string;
  achievements: string | null;
  initiative: string | null;
  criteria: EmulationCriterion[];
  scores: Record<string, number>;
  total_score: number;
  kpi: { period: string | null; rank: string | null; score: string | null };
  evidence: Array<{ title: string; note: string | null }>;
  checks: EmulationCheck[];
  owner_name: string;
  date: Date;
}

export function nominationBlocks(content: NominationContent): DocumentBlock[] {
  const subject = content.target === 'individual' ? 'cá nhân' : 'tập thể';
  return [
    header(content.school, content.date),
    {
      kind: 'title',
      text: `BÁO CÁO THÀNH TÍCH ĐỀ NGHỊ ${content.title_name.toUpperCase()}`,
      subtitle: `Năm học ${content.year_name}`,
    },
    { kind: 'heading', text: 'I. THÔNG TIN' },
    { kind: 'paragraph', text: `Tên ${subject}: ${content.subject_name}` },
    ...(content.department_name
      ? [{ kind: 'paragraph' as const, text: `Tổ, bộ phận: ${content.department_name}` }]
      : []),
    { kind: 'heading', text: 'II. THÀNH TÍCH ĐẠT ĐƯỢC' },
    ...paragraphs(content.achievements),
    ...(content.initiative
      ? [{ kind: 'heading' as const, text: 'Sáng kiến, giải pháp' }, ...paragraphs(content.initiative)]
      : []),
    { kind: 'heading', text: 'III. KẾT QUẢ ĐÁNH GIÁ' },
    {
      kind: 'paragraph',
      text: `Kết quả đánh giá, xếp loại KPI${content.kpi.period ? ` (${content.kpi.period})` : ''}: ${content.kpi.rank ?? 'chưa có'}${content.kpi.score ? `, ${content.kpi.score} điểm` : ''}`,
    },
    {
      kind: 'table',
      header: ['TT', 'Tiêu chí', 'Trọng số', 'Điểm tối đa', 'Tự chấm'],
      rows: [
        ...content.criteria.map((criterion, index) => [
          String(index + 1),
          criterion.title,
          String(criterion.weight),
          String(criterion.max_score),
          String(content.scores[criterion.code] ?? 0),
        ]),
        ['', 'Điểm quy về thang 100', '', '', String(content.total_score)],
      ],
      widths: [1, 8, 2, 2, 2],
      boldRows: [content.criteria.length],
    },
    { kind: 'heading', text: 'IV. ĐIỀU KIỆN CỦA DANH HIỆU' },
    {
      kind: 'table',
      header: ['Điều kiện', 'Kết quả', 'Chi tiết'],
      rows: content.checks.map((check) => [check.label, EMULATION_CHECK_STATE_LABELS[check.state], check.detail]),
      widths: [4, 2, 8],
    },
    { kind: 'heading', text: 'V. MINH CHỨNG' },
    ...(content.evidence.length === 0
      ? [{ kind: 'paragraph' as const, text: 'Không có minh chứng đính kèm.', italic: true }]
      : [
          {
            kind: 'table' as const,
            header: ['TT', 'Hồ sơ minh chứng (kho hồ sơ chuyên môn)', 'Ghi chú'],
            rows: content.evidence.map((item, index) => [String(index + 1), item.title, item.note ?? '']),
            widths: [1, 9, 5],
          },
        ]),
    { kind: 'signatures', right: { title: 'NGƯỜI BÁO CÁO', name: content.owner_name } },
  ];
}

export interface MinutesContent {
  school: string;
  campaign_name: string;
  held_at: Date;
  location: string | null;
  content: string | null;
  conclusion: string | null;
  members: Array<{ name: string; position: EmulationPositionCode }>;
  member_count: number;
  attendee_count: number | null;
  results: Array<{
    subject_name: string;
    title_name: string;
    agree: number;
    disagree: number;
    abstain: number;
    percent: number;
    threshold: number;
    passed: boolean;
  }>;
  chair: string;
  secretary: string;
}

export function minutesBlocks(content: MinutesContent): DocumentBlock[] {
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(content.held_at);
  const day = dateParts(content.held_at);
  return [
    header(content.school, content.held_at),
    { kind: 'title', text: 'BIÊN BẢN HỌP HỘI ĐỒNG THI ĐUA, KHEN THƯỞNG', subtitle: content.campaign_name },
    {
      kind: 'paragraph',
      text: `Thời gian: ${time} ngày ${day.day}/${day.month}/${day.year}${content.location ? `. Địa điểm: ${content.location}` : ''}.`,
    },
    {
      kind: 'paragraph',
      text: `Thành phần: hội đồng có ${content.member_count} thành viên${content.attendee_count !== null ? `, có mặt ${content.attendee_count}` : ''}.`,
    },
    {
      kind: 'table',
      header: ['TT', 'Họ và tên', 'Chức danh trong hội đồng'],
      rows: content.members.map((member, index) => [
        String(index + 1),
        member.name,
        EMULATION_POSITION_LABELS[member.position],
      ]),
      widths: [1, 6, 5],
    },
    { kind: 'heading', text: 'I. NỘI DUNG' },
    ...paragraphs(content.content ?? 'Bình xét, bỏ phiếu kín đề nghị danh hiệu thi đua, hình thức khen thưởng.'),
    { kind: 'heading', text: 'II. KẾT QUẢ BỎ PHIẾU KÍN' },
    {
      kind: 'paragraph',
      text: 'Tỉ lệ đồng ý tính trên tổng số thành viên hội đồng; hồ sơ đạt khi tỉ lệ đồng ý không thấp hơn tỉ lệ tối thiểu của danh hiệu.',
      italic: true,
    },
    {
      kind: 'table',
      header: [
        'TT',
        'Cá nhân, tập thể',
        'Danh hiệu, hình thức',
        'Đồng ý',
        'Không đồng ý',
        'Không biểu quyết',
        'Tỉ lệ',
        'Kết quả',
      ],
      rows: content.results.map((row, index) => [
        String(index + 1),
        row.subject_name,
        row.title_name,
        String(row.agree),
        String(row.disagree),
        String(row.abstain),
        `${row.percent}% (tối thiểu ${row.threshold}%)`,
        row.passed ? 'Thông qua' : 'Không thông qua',
      ]),
      widths: [1, 5, 5, 2, 2, 2, 3, 3],
    },
    { kind: 'heading', text: 'III. KẾT LUẬN' },
    ...paragraphs(content.conclusion ?? 'Hội đồng thống nhất kết quả bỏ phiếu nêu trên.'),
    {
      kind: 'signatures',
      left: { title: 'THƯ KÝ', name: content.secretary },
      right: { title: 'CHỦ TỊCH HỘI ĐỒNG', name: content.chair },
    },
  ];
}

export interface DecisionContent {
  school: string;
  kind: 'decision' | 'proposal';
  title: string;
  basis: string | null;
  number: string | null;
  date: Date | string;
  signer_name: string | null;
  signer_title: string | null;
  rows: Array<{ subject_name: string; department: string | null; title_name: string; target: EmulationTargetCode }>;
}

export function decisionBlocks(content: DecisionContent): DocumentBlock[] {
  const decision = content.kind === 'decision';
  const table: DocumentBlock = {
    kind: 'table',
    header: ['TT', 'Cá nhân, tập thể', 'Tổ, bộ phận', 'Đối tượng', 'Danh hiệu, hình thức khen thưởng'],
    rows: content.rows.map((row, index) => [
      String(index + 1),
      row.subject_name,
      row.department ?? '',
      EMULATION_TARGET_LABELS[row.target],
      row.title_name,
    ]),
    widths: [1, 6, 4, 2, 6],
  };
  return [
    header(content.school, content.date, content.number ?? '...'),
    { kind: 'title', text: decision ? 'QUYẾT ĐỊNH' : 'TỜ TRÌNH', subtitle: content.title },
    ...paragraphs(content.basis),
    ...(decision
      ? [
          { kind: 'paragraph' as const, text: 'QUYẾT ĐỊNH:', bold: true, align: 'center' as const },
          {
            kind: 'paragraph' as const,
            text: `Điều 1. Công nhận danh hiệu thi đua, khen thưởng cho ${content.rows.length} cá nhân, tập thể có tên sau:`,
            align: 'justify' as const,
          },
          table,
          {
            kind: 'paragraph' as const,
            text: 'Điều 2. Quyết định có hiệu lực kể từ ngày ký. Các cá nhân, tập thể có tên tại Điều 1 và bộ phận liên quan chịu trách nhiệm thi hành quyết định này.',
            align: 'justify' as const,
          },
        ]
      : [
          {
            kind: 'paragraph' as const,
            text: `Trường kính đề nghị cấp có thẩm quyền xem xét khen thưởng ${content.rows.length} cá nhân, tập thể có tên sau (hồ sơ kèm theo):`,
            align: 'justify' as const,
          },
          table,
        ]),
    {
      kind: 'signatures',
      right: { title: (content.signer_title ?? 'HIỆU TRƯỞNG').toUpperCase(), name: content.signer_name ?? undefined },
    },
  ];
}

export interface CertificateContent {
  school: string;
  title_name: string;
  kind_label: string;
  subject_name: string;
  department: string | null;
  year_name: string;
  decision_number: string | null;
  decision_date: string | null;
  issuer: string | null;
  lookup_code: string;
  verification_text: string;
}

export const DECISION_KIND_LABELS = EMULATION_DECISION_KIND_LABELS;

// Giấy khen, giấy chứng nhận danh hiệu: khổ A4 ngang, mã QR dẫn tới trang tra cứu công khai trên cổng của trường
export async function certificatePdf(content: CertificateContent): Promise<Buffer> {
  ensureFonts();
  const date = content.decision_date ? dateParts(content.decision_date) : null;
  const definition: PdfDocumentDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [50, 40, 50, 40],
    info: { title: `${content.title_name} - ${content.subject_name}`, creator: 'School Management' },
    defaultStyle: { font: 'Roboto', fontSize: 13 },
    content: [
      {
        columns: [
          { stack: [{ text: (content.issuer ?? content.school).toUpperCase(), bold: true, alignment: 'center' }] },
          {
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, alignment: 'center' },
              { text: 'Độc lập - Tự do - Hạnh phúc', alignment: 'center' },
            ],
          },
        ],
        margin: [0, 0, 0, 30],
      },
      { text: content.kind_label.toUpperCase(), fontSize: 30, bold: true, alignment: 'center', margin: [0, 0, 0, 16] },
      { text: content.title_name, fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 12] },
      { text: 'Tặng', italics: true, alignment: 'center' },
      { text: content.subject_name, fontSize: 24, bold: true, alignment: 'center', margin: [0, 6, 0, 6] },
      ...(content.department ? [{ text: content.department, alignment: 'center' as const }] : []),
      { text: `Đã có thành tích trong năm học ${content.year_name}`, alignment: 'center', margin: [0, 10, 0, 24] },
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
            stack: [
              {
                text: [
                  content.decision_number ? `Quyết định số ${content.decision_number}` : 'Quyết định số ...',
                  date ? `, ngày ${date.day} tháng ${date.month} năm ${date.year}` : '',
                ].join(''),
                italics: true,
                alignment: 'center',
              },
            ],
          },
        ],
      },
    ],
  };
  return pdfmake.createPdf(definition).getBuffer();
}
