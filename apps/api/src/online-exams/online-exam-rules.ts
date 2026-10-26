import { randomInt } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import {
  ANSWER_SAVE_GRACE_SECONDS,
  VIOLATION_EVENT_TYPES,
  VIOLATION_MERGE_SECONDS,
  type ExamAttemptPolicy,
  type ExamResultMode,
  type ExamVariantMode,
  type ExamViolationAction,
} from '@school-management/shared';
import { TRUE_FALSE_VALUES } from '../exams/exam-inputs.js';
import { createRandom, OPTION_KEYS, type QuestionType, type VariantItem } from '../exams/exam-rules.js';

// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211): hàm thuần của giao đề, xếp câu của từng lượt, hạn nộp, đáp án lưu nháp,
// đếm lần rời bài, chọn lượt được tính, chế độ hiện kết quả. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - đồng hồ ở máy chủ: hạn nộp của lượt là lúc bắt đầu cộng thời lượng nhưng không quá giờ đóng; lưu nháp được chấp nhận đến hạn
//   nộp cộng vài giây chờ mạng, sau đó chỉ còn nộp;
// - đảo câu hỏi trong từng phần (phần theo dạng câu, giữ thứ tự phần) và đảo lựa chọn câu nhiều lựa chọn theo hạt giống của lượt,
//   tải lại trang vẫn ra đúng thứ tự cũ; các mã đề đã trộn của 22g1 vẫn được phát (ngẫu nhiên hoặc một mã cố định) rồi mới đảo
//   thêm; học sinh thấy nhãn A, B, C, D theo vị trí hiển thị, máy chủ đổi về khoá lựa chọn của mã đề để chấm bằng hàm chấm của
//   22g2 (một cách chấm duy nhất);
// - sự kiện rời bài (thoát toàn màn hình, rời trang, đổi cửa sổ) xảy ra liền nhau trong vài giây tính là một lần; quá số lần cho
//   phép thì đánh dấu cho giáo viên xét hoặc tự nộp theo cấu hình của bài; sự kiện camera chỉ là căn cứ, không tính vào số lần;
// - lượt được tính vào phiếu chấm: lượt điểm cao nhất hoặc lượt nộp sau cùng theo cấu hình của bài.

export interface AttemptLayout {
  // Số câu (theo mã đề) theo thứ tự hiển thị
  order: number[];
  // Câu nhiều lựa chọn: khoá lựa chọn của mã đề theo thứ tự hiển thị (vị trí i hiện nhãn A, B, C, ...)
  options: Record<string, string[]>;
}

export interface LayoutOptions {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

// Chọn mã đề của lượt: một mã cố định (cấu hình), hoặc ngẫu nhiên trong các mã của đề
export function pickVariantCode(
  codes: string[],
  mode: ExamVariantMode,
  fixedCode: string | null,
  random: () => number,
): string | null {
  if (codes.length === 0) {
    return null;
  }
  if (mode === 'fixed') {
    return fixedCode !== null && codes.includes(fixedCode) ? fixedCode : null;
  }
  return codes[Math.floor(random() * codes.length)] as string;
}

// Xếp câu và lựa chọn của một lượt theo hạt giống; cùng hạt giống cho cùng kết quả
export function buildAttemptLayout(
  items: VariantItem[],
  types: Record<string, QuestionType>,
  seed: number,
  options: LayoutOptions,
): AttemptLayout {
  const random = createRandom(seed);
  const sections: VariantItem[][] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && types[last[0]?.question_id ?? ''] === types[item.question_id]) {
      last.push(item);
    } else {
      sections.push([item]);
    }
  }
  const order = sections.flatMap((section) => (options.shuffleQuestions ? shuffled(section, random) : section));
  const optionMap: Record<string, string[]> = {};
  for (const item of items) {
    if (types[item.question_id] === 'multiple_choice') {
      const keys = OPTION_KEYS.slice(0, item.option_order.length);
      optionMap[String(item.number)] = options.shuffleOptions ? shuffled(keys, random) : keys;
    }
  }
  return { order: order.map((item) => item.number), options: optionMap };
}

// Học sinh nhập nhãn hiển thị (A, B, ...), máy chủ lưu khoá lựa chọn của mã đề, và ngược lại khi hiện lại câu đã chọn
export function labelsToKeys(layout: AttemptLayout, number: number, labels: string[]): string[] | null {
  const keys = layout.options[String(number)];
  if (!keys) {
    return labels;
  }
  const result: string[] = [];
  for (const label of labels) {
    const position = OPTION_KEYS.indexOf(label.toUpperCase());
    const key = position >= 0 ? keys[position] : undefined;
    if (key === undefined) {
      return null;
    }
    result.push(key);
  }
  return [...new Set(result)].sort();
}

export function keysToLabels(layout: AttemptLayout, number: number, keys: string[]): string[] {
  const order = layout.options[String(number)];
  if (!order) {
    return keys;
  }
  return keys
    .map((key) => OPTION_KEYS[order.indexOf(key)])
    .filter((label): label is string => label !== undefined)
    .sort();
}

export const ESSAY_MAXIMUM_LENGTH = 20_000;
export const SHORT_ANSWER_MAXIMUM_LENGTH = 200;

export interface AnswerError {
  number: number;
  message: string;
}

// Kiểm tra và đổi câu trả lời học sinh gửi (khoá là số câu, giá trị là mảng chữ theo nhãn hiển thị) sang dạng lưu theo khoá lựa
// chọn của mã đề; câu không thuộc lượt, giá trị lạ đều bị từ chối
export function normalizeAnswers(
  raw: unknown,
  layout: AttemptLayout,
  types: Record<number, QuestionType>,
  trueFalseCounts: Record<number, number>,
): { answers: Record<string, string[]>; errors: AnswerError[] } {
  const answers: Record<string, string[]> = {};
  const errors: AnswerError[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { answers, errors: [{ number: 0, message: 'Câu trả lời phải là một đối tượng theo số câu' }] };
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const number = Number(key);
    const type = types[number];
    if (!Number.isInteger(number) || type === undefined || !layout.order.includes(number)) {
      errors.push({ number, message: 'Câu không thuộc bài làm này' });
      continue;
    }
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
      errors.push({ number, message: 'Câu trả lời phải là danh sách chữ' });
      continue;
    }
    const entries = (value as string[]).map((entry) => entry.trim());
    if (type === 'essay') {
      const text = (value as string[])[0] ?? '';
      if (value.length > 1 || text.length > ESSAY_MAXIMUM_LENGTH) {
        errors.push({ number, message: `Bài tự luận dài tối đa ${ESSAY_MAXIMUM_LENGTH} ký tự` });
        continue;
      }
      answers[key] = text.trim() === '' ? [] : [text];
    } else if (type === 'short_answer') {
      if (entries.length > 1 || (entries[0] ?? '').length > SHORT_ANSWER_MAXIMUM_LENGTH) {
        errors.push({ number, message: `Đáp số dài tối đa ${SHORT_ANSWER_MAXIMUM_LENGTH} ký tự` });
        continue;
      }
      answers[key] = entries[0] ? [entries[0]] : [];
    } else if (type === 'true_false') {
      const count = trueFalseCounts[number] ?? 0;
      if (entries.length > count || entries.some((entry) => entry !== '' && !TRUE_FALSE_VALUES.includes(entry))) {
        errors.push({ number, message: 'Mỗi ý chỉ chọn Đ hoặc S' });
        continue;
      }
      answers[key] = entries.some((entry) => entry !== '')
        ? Array.from({ length: count }, (_u, i) => entries[i] ?? '')
        : [];
    } else {
      const keys = labelsToKeys(
        layout,
        number,
        entries.filter((entry) => entry !== ''),
      );
      if (keys === null) {
        errors.push({ number, message: 'Lựa chọn không có trong câu' });
        continue;
      }
      answers[key] = keys;
    }
  }
  return { answers, errors };
}

// Đáp án đúng sai chưa chọn đủ ý: ý trống thành "?" để vị trí các ý không bị xô lệch khi hàm chấm bỏ ô trống
export function answersForGrading(
  answers: Record<string, string[]>,
  types: Record<number, QuestionType>,
): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const [key, value] of Object.entries(answers)) {
    const number = Number(key);
    if (types[number] === 'essay') {
      continue;
    }
    result[number] = types[number] === 'true_false' ? value.map((entry) => (entry === '' ? '?' : entry)) : value;
  }
  return result;
}

export type AssignmentWindowState = 'upcoming' | 'open' | 'closed';

export function windowState(now: Date, opensAt: Date, closesAt: Date): AssignmentWindowState {
  if (now < opensAt) {
    return 'upcoming';
  }
  return now < closesAt ? 'open' : 'closed';
}

// Hạn nộp của lượt: lúc bắt đầu cộng thời lượng, không quá giờ đóng của bài
export function attemptDeadline(startedAt: Date, durationMinutes: number, closesAt: Date): Date {
  const byDuration = new Date(startedAt.getTime() + durationMinutes * 60_000);
  return byDuration < closesAt ? byDuration : closesAt;
}

export function remainingSeconds(now: Date, deadline: Date): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

// Lưu nháp còn nhận được không (mạng chậm cho thêm vài giây sau hạn)
export function canSaveAnswers(now: Date, deadline: Date): boolean {
  return now.getTime() <= deadline.getTime() + ANSWER_SAVE_GRACE_SECONDS * 1000;
}

export interface TimedEvent {
  event_type: string;
  occurred_at: Date;
}

// Số lần rời bài: sự kiện thoát toàn màn hình, rời trang, đổi cửa sổ liên tiếp trong VIOLATION_MERGE_SECONDS tính một lần
export function countViolations(events: TimedEvent[]): number {
  const times = events
    .filter((event) => (VIOLATION_EVENT_TYPES as readonly string[]).includes(event.event_type))
    .map((event) => event.occurred_at.getTime())
    .sort((left, right) => left - right);
  let count = 0;
  let lastCounted: number | null = null;
  for (const time of times) {
    if (lastCounted === null || time - lastCounted > VIOLATION_MERGE_SECONDS * 1000) {
      count += 1;
      lastCounted = time;
    }
  }
  return count;
}

export type ViolationOutcome = 'none' | 'warn' | 'flag' | 'auto_submit';

// Sau mỗi sự kiện: chưa quá số lần cho phép thì chỉ cảnh báo; quá thì theo cấu hình của bài (đánh dấu hoặc tự nộp). Số lần cho phép
// bằng 0 nghĩa là lần rời bài đầu tiên đã là quá
export function violationOutcome(violations: number, maximum: number, action: ExamViolationAction): ViolationOutcome {
  if (violations === 0) {
    return 'none';
  }
  if (violations <= maximum) {
    return 'warn';
  }
  return action === 'auto_submit' ? 'auto_submit' : 'flag';
}

export interface AttemptScore {
  id: string;
  status: 'in_progress' | 'submitted';
  submitted_at: Date | null;
  total: number | null;
  objective: number | null;
}

// Lượt được tính vào phiếu chấm: chỉ xét lượt đã nộp; "cao nhất" so điểm tổng (chưa đủ điểm tự luận thì so điểm trắc nghiệm),
// bằng điểm thì lấy lượt nộp sớm hơn; "sau cùng" lấy lượt nộp muộn nhất
export function countedAttempt(attempts: AttemptScore[], policy: ExamAttemptPolicy): AttemptScore | undefined {
  const submitted = attempts.filter((attempt) => attempt.status === 'submitted');
  if (submitted.length === 0) {
    return undefined;
  }
  const time = (attempt: AttemptScore) => attempt.submitted_at?.getTime() ?? 0;
  if (policy === 'last') {
    return [...submitted].sort((left, right) => time(right) - time(left))[0];
  }
  const score = (attempt: AttemptScore) => attempt.total ?? attempt.objective ?? 0;
  return [...submitted].sort((left, right) => score(right) - score(left) || time(left) - time(right))[0];
}

// Học sinh xem được kết quả khi nào: hiện ngay sau khi nộp, sau giờ đóng của bài, hoặc khi giáo viên công bố
export function resultsVisible(
  mode: ExamResultMode,
  now: Date,
  closesAt: Date,
  releasedAt: Date | null,
  attemptSubmitted: boolean,
): boolean {
  if (!attemptSubmitted) {
    return false;
  }
  if (mode === 'immediate') {
    return true;
  }
  if (mode === 'after_close') {
    return now >= closesAt;
  }
  return releasedAt !== null && releasedAt <= now;
}

// Chế độ thi và phòng thi (DT-23 phần 23a, Eric chốt 2026-10-26: mặc định chỉ thi tại trường): ở `at-school` học sinh vào bài bằng
// mã phòng thi đang mở và, nếu trường cấu hình dải mạng, từ địa chỉ nằm trong dải đó. Địa chỉ lấy từ yêu cầu đã qua cấu hình tin
// cậy cổng biên của máy chủ (trust proxy), không đọc tiêu đề do học sinh tự gửi
export interface NetworkRange {
  address: string;
  prefix: number;
  family: 'ipv4' | 'ipv6';
}

// IPv4 viết dạng ánh xạ IPv6 (::ffff:10.0.0.5) đổi về IPv4 để so với dải
export function normalizeIp(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip.trim());
  return mapped ? (mapped[1] as string) : ip.trim();
}

// "10.0.0.0/8", "192.168.1.0/24", "2001:db8::/32" hoặc một địa chỉ đơn; sai thì null
export function parseNetworkRange(text: string): NetworkRange | null {
  const [address, rawPrefix, extra] = text.trim().split('/');
  if (!address || extra !== undefined) {
    return null;
  }
  const version = isIP(address);
  if (version === 0) {
    return null;
  }
  const maximum = version === 4 ? 32 : 128;
  const prefix = rawPrefix === undefined ? maximum : /^\d{1,3}$/.test(rawPrefix) ? Number(rawPrefix) : -1;
  if (prefix < 0 || prefix > maximum) {
    return null;
  }
  return { address, prefix, family: version === 4 ? 'ipv4' : 'ipv6' };
}

// Danh sách dải trống nghĩa là trường không giới hạn mạng
export function ipAllowed(ip: string | undefined, ranges: string[]): boolean {
  if (ranges.length === 0) {
    return true;
  }
  const normalized = ip ? normalizeIp(ip) : '';
  const version = isIP(normalized);
  if (version === 0) {
    return false;
  }
  const list = new BlockList();
  for (const text of ranges) {
    const range = parseNetworkRange(text);
    if (range) {
      list.addSubnet(range.address, range.prefix, range.family);
    }
  }
  return list.check(normalized, version === 4 ? 'ipv4' : 'ipv6');
}

// Mã phòng thi 6 chữ số, ngắn hạn
export function generateRoomCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
