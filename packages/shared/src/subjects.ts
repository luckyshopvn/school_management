import type { SchoolLevelCode } from './school-levels.js';

// Môn học và hoạt động giáo dục (DT-20 phần 20a, YCTD-158). Bộ mẫu Tiểu học theo Chương trình giáo dục phổ thông 2018
// (Thông tư 32/2018/TT-BGDĐT): số tiết mỗi tuần là thời lượng cả năm chia 35 tuần, khối K1 đến K5 là khối mẫu của 19b. Bộ
// mẫu chỉ là điểm bắt đầu; nhà trường đối chiếu kế hoạch giáo dục của trường và sửa ở "Môn học và hoạt động giáo dục". Cách
// đánh giá ghi môn có bài kiểm tra định kỳ (nhận xét và điểm) theo Thông tư 27/2020/TT-BGDĐT, 20c rà lại khi làm đánh giá.
// Mã môn có tiền tố cấp để THCS, THPT (DT-21) thêm môn cùng tên mà không trùng mã. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11
export type SubjectKind = 'subject' | 'activity';
// `score`: môn đánh giá bằng điểm số (THCS, THPT theo Thông tư 22/2021, DT-21 phần 21a)
export type SubjectAssessment = 'comment' | 'comment_and_score' | 'score';

export const SUBJECT_KIND_LABELS: Record<SubjectKind, string> = {
  subject: 'Môn học',
  activity: 'Hoạt động giáo dục',
};

export const SUBJECT_ASSESSMENT_LABELS: Record<SubjectAssessment, string> = {
  comment: 'Nhận xét',
  comment_and_score: 'Nhận xét và điểm kiểm tra định kỳ',
  score: 'Điểm số',
};

export interface SubjectTemplate {
  code: string;
  name: string;
  kind: SubjectKind;
  assessment: SubjectAssessment;
  order_no: number;
  // Số tiết mỗi tuần theo mã khối; khối không có trong bảng là không học môn này
  periods: Partial<Record<string, number>>;
  // Khối học môn này theo hình thức tự chọn
  elective_grades?: string[];
  // Nhóm môn học lựa chọn của THPT (DT-21 phần 21a); môn không thuộc nhóm nào thì không ghi
  option_group?: SubjectOptionGroup;
}

// Ba nhóm môn học lựa chọn ở THPT theo Chương trình giáo dục phổ thông 2018 (DT-21 phần 21a). Tổ hợp môn của trường gồm
// một số môn lựa chọn thuộc ít nhất vài nhóm; số môn và số nhóm tối thiểu là mặc định theo chương trình (4 môn, 2 nhóm), nhà
// trường đối chiếu văn bản gốc trước khi dùng (tài liệu 32 mục 12.2, 12.4)
export type SubjectOptionGroup = 'social_science' | 'natural_science' | 'technology_arts';

export const SUBJECT_OPTION_GROUP_LABELS: Record<SubjectOptionGroup, string> = {
  social_science: 'Khoa học xã hội',
  natural_science: 'Khoa học tự nhiên',
  technology_arts: 'Công nghệ và nghệ thuật',
};

export const SUBJECT_OPTION_GROUPS = Object.keys(SUBJECT_OPTION_GROUP_LABELS) as SubjectOptionGroup[];

export const COMBINATION_RULE = { subject_count: 4, min_groups: 2 } as const;

const SECONDARY_GRADES = ['K6', 'K7', 'K8', 'K9'] as const;
const HIGH_GRADES = ['K10', 'K11', 'K12'] as const;
const across = (grades: readonly string[], periods: number): Partial<Record<string, number>> =>
  Object.fromEntries(grades.map((grade) => [grade, periods]));

const ALL_PRIMARY = (periods: number) => ({ K1: periods, K2: periods, K3: periods, K4: periods, K5: periods });

export const SUBJECT_TEMPLATES: Record<SchoolLevelCode, SubjectTemplate[]> = {
  MN: [],
  TH: [
    {
      code: 'TH-TV',
      name: 'Tiếng Việt',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 1,
      periods: { K1: 12, K2: 10, K3: 7, K4: 7, K5: 7 },
    },
    {
      code: 'TH-TOAN',
      name: 'Toán',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 2,
      periods: { K1: 3, K2: 5, K3: 5, K4: 5, K5: 5 },
    },
    {
      code: 'TH-NN1',
      name: 'Ngoại ngữ 1',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 3,
      periods: { K1: 2, K2: 2, K3: 4, K4: 4, K5: 4 },
      elective_grades: ['K1', 'K2'],
    },
    { code: 'TH-DD', name: 'Đạo đức', kind: 'subject', assessment: 'comment', order_no: 4, periods: ALL_PRIMARY(1) },
    {
      code: 'TH-TNXH',
      name: 'Tự nhiên và Xã hội',
      kind: 'subject',
      assessment: 'comment',
      order_no: 5,
      periods: { K1: 2, K2: 2, K3: 2 },
    },
    {
      code: 'TH-LSDL',
      name: 'Lịch sử và Địa lí',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 6,
      periods: { K4: 2, K5: 2 },
    },
    {
      code: 'TH-KH',
      name: 'Khoa học',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 7,
      periods: { K4: 2, K5: 2 },
    },
    {
      code: 'TH-TINCN',
      name: 'Tin học và Công nghệ',
      kind: 'subject',
      assessment: 'comment_and_score',
      order_no: 8,
      periods: { K3: 2, K4: 2, K5: 2 },
    },
    {
      code: 'TH-GDTC',
      name: 'Giáo dục thể chất',
      kind: 'subject',
      assessment: 'comment',
      order_no: 9,
      periods: ALL_PRIMARY(2),
    },
    {
      code: 'TH-AN',
      name: 'Nghệ thuật (Âm nhạc)',
      kind: 'subject',
      assessment: 'comment',
      order_no: 10,
      periods: ALL_PRIMARY(1),
    },
    {
      code: 'TH-MT',
      name: 'Nghệ thuật (Mĩ thuật)',
      kind: 'subject',
      assessment: 'comment',
      order_no: 11,
      periods: ALL_PRIMARY(1),
    },
    {
      code: 'TH-HDTN',
      name: 'Hoạt động trải nghiệm',
      kind: 'activity',
      assessment: 'comment',
      order_no: 12,
      periods: ALL_PRIMARY(3),
    },
    {
      code: 'TH-TDTTS',
      name: 'Tiếng dân tộc thiểu số',
      kind: 'subject',
      assessment: 'comment',
      order_no: 13,
      periods: ALL_PRIMARY(2),
      elective_grades: ['K1', 'K2', 'K3', 'K4', 'K5'],
    },
  ],
  THCS: [
    {
      code: 'THCS-NV',
      name: 'Ngữ văn',
      kind: 'subject',
      assessment: 'score',
      order_no: 1,
      periods: across(SECONDARY_GRADES, 4),
    },
    {
      code: 'THCS-TOAN',
      name: 'Toán',
      kind: 'subject',
      assessment: 'score',
      order_no: 2,
      periods: across(SECONDARY_GRADES, 4),
    },
    {
      code: 'THCS-NN1',
      name: 'Ngoại ngữ 1',
      kind: 'subject',
      assessment: 'score',
      order_no: 3,
      periods: across(SECONDARY_GRADES, 3),
    },
    {
      code: 'THCS-GDCD',
      name: 'Giáo dục công dân',
      kind: 'subject',
      assessment: 'score',
      order_no: 4,
      periods: across(SECONDARY_GRADES, 1),
    },
    {
      code: 'THCS-LSDL',
      name: 'Lịch sử và Địa lí',
      kind: 'subject',
      assessment: 'score',
      order_no: 5,
      periods: across(SECONDARY_GRADES, 3),
    },
    {
      code: 'THCS-KHTN',
      name: 'Khoa học tự nhiên',
      kind: 'subject',
      assessment: 'score',
      order_no: 6,
      periods: across(SECONDARY_GRADES, 4),
    },
    {
      code: 'THCS-CN',
      name: 'Công nghệ',
      kind: 'subject',
      assessment: 'score',
      order_no: 7,
      periods: { K6: 1.5, K7: 1.5, K8: 2, K9: 2 },
    },
    {
      code: 'THCS-TIN',
      name: 'Tin học',
      kind: 'subject',
      assessment: 'score',
      order_no: 8,
      periods: across(SECONDARY_GRADES, 1),
    },
    {
      code: 'THCS-GDTC',
      name: 'Giáo dục thể chất',
      kind: 'subject',
      assessment: 'comment',
      order_no: 9,
      periods: across(SECONDARY_GRADES, 2),
    },
    {
      code: 'THCS-AN',
      name: 'Nghệ thuật (Âm nhạc)',
      kind: 'subject',
      assessment: 'comment',
      order_no: 10,
      periods: across(SECONDARY_GRADES, 1),
    },
    {
      code: 'THCS-MT',
      name: 'Nghệ thuật (Mĩ thuật)',
      kind: 'subject',
      assessment: 'comment',
      order_no: 11,
      periods: across(SECONDARY_GRADES, 1),
    },
    {
      code: 'THCS-HDTN',
      name: 'Hoạt động trải nghiệm, hướng nghiệp',
      kind: 'activity',
      assessment: 'comment',
      order_no: 12,
      periods: across(SECONDARY_GRADES, 3),
    },
    {
      code: 'THCS-GDDP',
      name: 'Nội dung giáo dục của địa phương',
      kind: 'subject',
      assessment: 'comment',
      order_no: 13,
      periods: across(SECONDARY_GRADES, 1),
    },
    {
      code: 'THCS-TDTTS',
      name: 'Tiếng dân tộc thiểu số',
      kind: 'subject',
      assessment: 'score',
      order_no: 14,
      periods: across(SECONDARY_GRADES, 3),
      elective_grades: [...SECONDARY_GRADES],
    },
  ],
  THPT: [
    {
      code: 'THPT-NV',
      name: 'Ngữ văn',
      kind: 'subject',
      assessment: 'score',
      order_no: 1,
      periods: across(HIGH_GRADES, 3),
    },
    {
      code: 'THPT-TOAN',
      name: 'Toán',
      kind: 'subject',
      assessment: 'score',
      order_no: 2,
      periods: across(HIGH_GRADES, 3),
    },
    {
      code: 'THPT-NN1',
      name: 'Ngoại ngữ 1',
      kind: 'subject',
      assessment: 'score',
      order_no: 3,
      periods: across(HIGH_GRADES, 3),
    },
    {
      code: 'THPT-LS',
      name: 'Lịch sử',
      kind: 'subject',
      assessment: 'score',
      order_no: 4,
      periods: across(HIGH_GRADES, 2),
    },
    {
      code: 'THPT-GDTC',
      name: 'Giáo dục thể chất',
      kind: 'subject',
      assessment: 'comment',
      order_no: 5,
      periods: across(HIGH_GRADES, 2),
    },
    {
      code: 'THPT-GDQPAN',
      name: 'Giáo dục quốc phòng và an ninh',
      kind: 'subject',
      assessment: 'score',
      order_no: 6,
      periods: across(HIGH_GRADES, 1),
    },
    {
      code: 'THPT-HDTN',
      name: 'Hoạt động trải nghiệm, hướng nghiệp',
      kind: 'activity',
      assessment: 'comment',
      order_no: 7,
      periods: across(HIGH_GRADES, 3),
    },
    {
      code: 'THPT-GDDP',
      name: 'Nội dung giáo dục của địa phương',
      kind: 'subject',
      assessment: 'comment',
      order_no: 8,
      periods: across(HIGH_GRADES, 1),
    },
    ...(
      [
        ['THPT-DL', 'Địa lí', 'social_science'],
        ['THPT-GDKTPL', 'Giáo dục kinh tế và pháp luật', 'social_science'],
        ['THPT-VL', 'Vật lí', 'natural_science'],
        ['THPT-HH', 'Hóa học', 'natural_science'],
        ['THPT-SH', 'Sinh học', 'natural_science'],
        ['THPT-CN', 'Công nghệ', 'technology_arts'],
        ['THPT-TIN', 'Tin học', 'technology_arts'],
        ['THPT-AN', 'Âm nhạc', 'technology_arts'],
        ['THPT-MT', 'Mĩ thuật', 'technology_arts'],
      ] as const
    ).map(([code, name, group], index): SubjectTemplate => ({
      code,
      name,
      kind: 'subject',
      assessment: group === 'technology_arts' && (code === 'THPT-AN' || code === 'THPT-MT') ? 'comment' : 'score',
      order_no: 9 + index,
      periods: across(HIGH_GRADES, 2),
      elective_grades: [...HIGH_GRADES],
      option_group: group,
    })),
  ],
};

// Mã chương trình mặc định tạo khi nạp bộ mẫu cho cấp chưa có chương trình mặc định
export const DEFAULT_CURRICULUM_CODES: Partial<Record<SchoolLevelCode, { code: string; name: string }>> = {
  TH: { code: 'CT-TH-2018', name: 'Chương trình giáo dục phổ thông 2018 cấp Tiểu học' },
  THCS: { code: 'CT-THCS-2018', name: 'Chương trình giáo dục phổ thông 2018 cấp Trung học cơ sở' },
  THPT: { code: 'CT-THPT-2018', name: 'Chương trình giáo dục phổ thông 2018 cấp Trung học phổ thông' },
};

// Thời khoá biểu (DT-20 phần 22c1, YCTD-160): thứ theo ISO (1 là thứ Hai) như ngày học trong tuần của năm học; buổi của tiết
export const TIMETABLE_WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ nhật',
};

export const PERIOD_SESSION_LABELS: Record<'morning' | 'afternoon', string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
};
