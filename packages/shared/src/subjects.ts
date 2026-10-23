import type { SchoolLevelCode } from './school-levels.js';

// Môn học và hoạt động giáo dục (DT-20 phần 20a, YCTD-158). Bộ mẫu Tiểu học theo Chương trình giáo dục phổ thông 2018
// (Thông tư 32/2018/TT-BGDĐT): số tiết mỗi tuần là thời lượng cả năm chia 35 tuần, khối K1 đến K5 là khối mẫu của 19b. Bộ
// mẫu chỉ là điểm bắt đầu; nhà trường đối chiếu kế hoạch giáo dục của trường và sửa ở "Môn học và hoạt động giáo dục". Cách
// đánh giá ghi môn có bài kiểm tra định kỳ (nhận xét và điểm) theo Thông tư 27/2020/TT-BGDĐT, 20c rà lại khi làm đánh giá.
// Mã môn có tiền tố cấp để THCS, THPT (DT-21) thêm môn cùng tên mà không trùng mã. Claude tự chọn theo ủy quyền của Eric
// ngày 2026-10-11
export type SubjectKind = 'subject' | 'activity';
export type SubjectAssessment = 'comment' | 'comment_and_score';

export const SUBJECT_KIND_LABELS: Record<SubjectKind, string> = {
  subject: 'Môn học',
  activity: 'Hoạt động giáo dục',
};

export const SUBJECT_ASSESSMENT_LABELS: Record<SubjectAssessment, string> = {
  comment: 'Nhận xét',
  comment_and_score: 'Nhận xét và điểm kiểm tra định kỳ',
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
}

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
  THCS: [],
  THPT: [],
};

// Mã chương trình mặc định tạo khi nạp bộ mẫu cho cấp chưa có chương trình mặc định
export const DEFAULT_CURRICULUM_CODES: Partial<Record<SchoolLevelCode, { code: string; name: string }>> = {
  TH: { code: 'CT-TH-2018', name: 'Chương trình giáo dục phổ thông 2018 cấp Tiểu học' },
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
