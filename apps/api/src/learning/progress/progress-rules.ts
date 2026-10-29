import { ruleViolationError, validationError, type FieldError } from '@school-management/server';
import { isUuid, type RequestBody } from '../../common/request-fields.js';
import { isDone, type ResultStatus } from '../learning-rules.js';

// Quy tắc thuần của tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274; tài liệu 47 mục 20.7). Claude tự chọn
// theo ủy quyền của Eric ngày 2026-10-11, ghi ở YCTD-274:
// - Không xếp hạng: lưới tiến độ, bảng điểm sắp theo số thứ tự, họ tên; không có cột thứ hạng, không có bảng xếp hạng cho học sinh.
// - "Cần chú ý": quá hạn từ 2 hoạt động bắt buộc, hoặc đã có ít nhất 3 hoạt động bắt buộc đến hạn mà hoàn thành dưới một nửa, hoặc
//   14 ngày không mở hoạt động nào (khi lớp đã giao hoạt động); chỉ giáo viên, chủ nhiệm, Ban Giám hiệu thấy.
// - Điểm trung bình hoạt động có trọng số là số tham khảo, không phải điểm trung bình môn của Thông tư 22.
// - Vào sổ điểm (GD-141, THCS, THPT): chỉ điểm đánh giá thường xuyên; một hoạt động lấy đúng điểm hoạt động; gộp nhiều hoạt động lấy
//   trung bình có trọng số; em được miễn ở mọi hoạt động đã chọn hoặc còn hoạt động chưa có điểm (chưa nộp, chưa chấm) thì bỏ trống,
//   giáo viên tự nhập; điểm làm tròn một chữ số thập phân như sổ điểm.
// - Tiểu học (GD-141): không ghi điểm số; máy gợi ý mức đạt môn (T, H, C) và câu nhận xét từ kết quả hoạt động, giáo viên sửa rồi ghi.
export const PROGRESS_RULE_CODE = 'YCTD-274';
export const ATTENTION_OVERDUE = 2;
export const ATTENTION_MIN_DUE = 3;
export const ATTENTION_IDLE_DAYS = 14;
export const MAX_REPORT_TEXT = 4000;

export function progressRule(message: string, fields?: FieldError[]) {
  return ruleViolationError(PROGRESS_RULE_CODE, message, fields);
}

export interface ResultCell {
  status: ResultStatus;
  score: number | null;
  level: 'excellent' | 'completed' | 'not_completed' | null;
}

export interface ActivityInfo {
  id: string;
  section_id: string;
  required: boolean;
  due_at: Date | null;
  graded: boolean;
  weight: number;
}

// ---------- Tiến độ, cần chú ý

export function attentionReasons(input: {
  activities: ActivityInfo[];
  results: Map<string, ResultCell>;
  lastOpenedAt: Date | null;
  now: Date;
}): string[] {
  const required = input.activities.filter((activity) => activity.required);
  const due = required.filter((activity) => activity.due_at !== null && activity.due_at < input.now);
  const overdue = due.filter((activity) => !isDone(input.results.get(activity.id)?.status));
  const reasons: string[] = [];
  if (overdue.length >= ATTENTION_OVERDUE) {
    reasons.push(`Quá hạn ${overdue.length} hoạt động`);
  }
  if (due.length >= ATTENTION_MIN_DUE && (due.length - overdue.length) * 2 < due.length) {
    reasons.push(`Mới hoàn thành ${due.length - overdue.length}/${due.length} hoạt động đã đến hạn`);
  }
  if (input.activities.length > 0) {
    const idleSince = input.now.getTime() - ATTENTION_IDLE_DAYS * 86_400_000;
    if (input.lastOpenedAt === null || input.lastOpenedAt.getTime() < idleSince) {
      reasons.push(`${ATTENTION_IDLE_DAYS} ngày chưa mở hoạt động nào`);
    }
  }
  return reasons;
}

// Phần trăm hoàn thành hoạt động bắt buộc theo chương
export function sectionProgress(
  sections: Array<{ id: string; title: string }>,
  activities: ActivityInfo[],
  results: Map<string, ResultCell>,
) {
  return sections.map((section) => {
    const own = activities.filter((activity) => activity.section_id === section.id && activity.required);
    const done = own.filter((activity) => isDone(results.get(activity.id)?.status)).length;
    return {
      section_id: section.id,
      title: section.title,
      required: own.length,
      done,
      percent: own.length === 0 ? 0 : Math.round((done / own.length) * 100),
    };
  });
}

// ---------- Bảng điểm hoạt động

const roundOne = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

// Trung bình có trọng số của các hoạt động tính điểm đã có điểm (tham khảo); không có điểm nào thì rỗng
export function weightedAverage(activities: ActivityInfo[], results: Map<string, ResultCell>): number | null {
  let total = 0;
  let weights = 0;
  for (const activity of activities) {
    const score = results.get(activity.id)?.score;
    if (!activity.graded || score === null || score === undefined || activity.weight <= 0) continue;
    total += score * activity.weight;
    weights += activity.weight;
  }
  return weights === 0 ? null : roundOne(total / weights);
}

// Số mức của các hoạt động chấm theo mức (Tiểu học)
export function levelCounts(activities: ActivityInfo[], results: Map<string, ResultCell>) {
  const counts = { excellent: 0, completed: 0, not_completed: 0 };
  for (const activity of activities) {
    const level = results.get(activity.id)?.level;
    if (level) counts[level] += 1;
  }
  return counts;
}

// ---------- Vào sổ điểm (THCS, THPT)

export interface ScoreBookInput {
  activity_ids: string[];
  method: 'single' | 'weighted';
  term_type: 'first_term' | 'second_term';
  seq: number;
}

export function parseScoreBookInput(body: RequestBody): ScoreBookInput {
  const errors: FieldError[] = [];
  const ids = Array.isArray(body?.activity_ids) ? body.activity_ids.filter(isUuid) : [];
  const unique = [...new Set(ids)];
  if (unique.length === 0 || unique.length > 20) {
    errors.push({ field: 'activity_ids', message: 'Chọn từ 1 đến 20 hoạt động' });
  }
  const method = body?.method ?? (unique.length > 1 ? 'weighted' : 'single');
  if (method !== 'single' && method !== 'weighted') {
    errors.push({
      field: 'method',
      message: 'Cách gộp là single (một hoạt động) hoặc weighted (trung bình có trọng số)',
    });
  } else if (method === 'single' && unique.length > 1) {
    errors.push({ field: 'method', message: 'Lấy điểm một hoạt động thì chỉ chọn một hoạt động' });
  }
  const term = body?.term_type;
  if (term !== 'first_term' && term !== 'second_term') {
    errors.push({ field: 'term_type', message: 'Học kỳ là first_term hoặc second_term' });
  }
  const seq = body?.seq;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1 || seq > 10) {
    errors.push({ field: 'seq', message: 'Lần đánh giá thường xuyên từ 1 đến 10' });
  }
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return {
    activity_ids: unique,
    method: method as ScoreBookInput['method'],
    term_type: term as ScoreBookInput['term_type'],
    seq: seq as number,
  };
}

// Điểm đưa vào sổ của một em: rỗng kèm lý do khi được miễn mọi hoạt động hoặc còn hoạt động chưa có điểm
export function combineScore(
  activities: Array<{ id: string; weight: number }>,
  results: Map<string, ResultCell>,
): { score: number | null; reason: string | null } {
  let total = 0;
  let weights = 0;
  let excused = 0;
  for (const activity of activities) {
    const result = results.get(activity.id);
    if (result?.status === 'excused') {
      excused += 1;
      continue;
    }
    if (result?.score === null || result?.score === undefined) {
      return { score: null, reason: 'Chưa có điểm hoạt động (chưa nộp hoặc chưa chấm)' };
    }
    const weight = activities.length === 1 ? 1 : activity.weight;
    total += result.score * weight;
    weights += weight;
  }
  if (excused === activities.length) {
    return { score: null, reason: 'Được miễn' };
  }
  if (weights === 0) {
    return { score: null, reason: 'Hoạt động không có trọng số' };
  }
  return { score: roundOne(total / weights), reason: null };
}

// ---------- Sổ nhận xét (Tiểu học)

export type SubjectLevelCode = 'T' | 'H' | 'C';

// Gợi ý mức đạt môn từ kết quả các hoạt động: hoạt động chấm theo mức lấy mức, hoạt động có điểm quy 9 trở lên là Hoàn thành tốt,
// 5 trở lên là Hoàn thành; mức chiếm nhiều nhất (hòa thì nghiêng về mức thấp hơn để giáo viên xem lại); chưa có kết quả thì rỗng
export function suggestSubjectLevel(cells: ResultCell[]): SubjectLevelCode | null {
  const counts: Record<SubjectLevelCode, number> = { T: 0, H: 0, C: 0 };
  for (const cell of cells) {
    if (cell.status === 'excused') continue;
    const level =
      cell.level ??
      (cell.score === null ? null : cell.score >= 9 ? 'excellent' : cell.score >= 5 ? 'completed' : 'not_completed');
    if (level === 'excellent') counts.T += 1;
    else if (level === 'completed') counts.H += 1;
    else if (level === 'not_completed') counts.C += 1;
  }
  const total = counts.T + counts.H + counts.C;
  if (total === 0) return null;
  const order: SubjectLevelCode[] = ['C', 'H', 'T'];
  return order.reduce((best, code) => (counts[code] > counts[best] ? code : best), 'C' as SubjectLevelCode);
}

// Câu nhận xét gợi ý: câu của thư viện câu nhận xét theo mức (20c) cộng số hoạt động đã hoàn thành; giáo viên sửa trước khi ghi
export function suggestComment(input: {
  level: SubjectLevelCode | null;
  done: number;
  required: number;
  templates: { T?: string; H?: string; C?: string };
}): string {
  const base = input.level ? (input.templates[input.level] ?? '') : '';
  const progress =
    input.required > 0 ? `Em đã hoàn thành ${input.done}/${input.required} hoạt động học trực tuyến.` : '';
  return [base.trim(), progress].filter(Boolean).join(' ').slice(0, 1000);
}

// ---------- Báo cáo

// Tuần bắt đầu thứ Hai (giờ Việt Nam) của một thời điểm, dạng YYYY-MM-DD
export function weekStart(date: Date): string {
  const local = new Date(date.getTime() + 7 * 3_600_000);
  const day = local.getUTCDay();
  const monday = new Date(local.getTime() - ((day + 6) % 7) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

// Trung vị số giờ từ lúc nộp đến lúc giáo viên trả bài; không có bài trả thì rỗng
export function medianResponseHours(
  pairs: Array<{ submitted_at: Date | null; returned_at: Date | null }>,
): number | null {
  const hours = pairs
    .filter((pair) => pair.submitted_at && pair.returned_at)
    .map((pair) => ((pair.returned_at as Date).getTime() - (pair.submitted_at as Date).getTime()) / 3_600_000)
    .sort((left, right) => left - right);
  if (hours.length === 0) return null;
  const middle = Math.floor(hours.length / 2);
  const value =
    hours.length % 2 === 1
      ? (hours[middle] as number)
      : ((hours[middle - 1] as number) + (hours[middle] as number)) / 2;
  return roundOne(value);
}

// Tỷ lệ đúng của lớp cho mỗi câu trắc nghiệm của bài tập (phần trăm, hai chữ số thập phân), từ các bài đã nộp
export function correctRates(
  questionItems: Array<{ id: string; question_id: string }>,
  correctness: Array<Record<string, boolean>>,
): Array<{ question_id: string; attempts: number; correct_rate: number }> {
  return questionItems
    .map((item) => {
      const answered = correctness.filter((row) => item.id in row);
      const right = answered.filter((row) => row[item.id]).length;
      return {
        question_id: item.question_id,
        attempts: answered.length,
        correct_rate: answered.length === 0 ? 0 : Math.round((right / answered.length) * 10_000) / 100,
      };
    })
    .filter((row) => row.attempts > 0);
}

export interface TermReportInput {
  evaluation: string | null;
  difficulties: string | null;
  causes: string | null;
  recommendations: string | null;
}

export function parseTermReport(body: RequestBody): TermReportInput {
  const errors: FieldError[] = [];
  const read = (field: keyof TermReportInput) => {
    const value = body?.[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > MAX_REPORT_TEXT) {
      errors.push({ field, message: `Tối đa ${MAX_REPORT_TEXT} ký tự` });
      return null;
    }
    return value.trim() === '' ? null : value.trim();
  };
  const input = {
    evaluation: read('evaluation'),
    difficulties: read('difficulties'),
    causes: read('causes'),
    recommendations: read('recommendations'),
  };
  if (errors.length > 0) {
    throw validationError(errors);
  }
  return input;
}
