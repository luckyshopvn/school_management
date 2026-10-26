import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Clock } from '@school-management/server';
import { createFaceWatch } from '@school-management/shared';
import { EXAM_LIMITS, ExamRateLimiter } from './exam-rate-limit.js';
import { createRandom, type QuestionType, type VariantItem } from '../exams/exam-rules.js';
import { gradeSheet, type GradedQuestion } from '../exam-grading/grading-rules.js';
import {
  answersForGrading,
  attemptDeadline,
  buildAttemptLayout,
  canSaveAnswers,
  countViolations,
  generateRoomCode,
  ipAllowed,
  normalizeIp,
  parseNetworkRange,
  countedAttempt,
  keysToLabels,
  labelsToKeys,
  normalizeAnswers,
  pickVariantCode,
  remainingSeconds,
  resultsVisible,
  violationOutcome,
  windowState,
  type AttemptLayout,
} from './online-exam-rules.js';

// Thi trực tuyến cho học sinh (DT-23 phần 23a, YCTD-211), kịch bản CT-23a-1: hàm thuần. Dữ liệu giả
const items: VariantItem[] = [
  { question_id: 'q1', number: 1, option_order: ['A', 'B', 'C', 'D'], answer: ['B'] },
  { question_id: 'q2', number: 2, option_order: ['A', 'B', 'C', 'D'], answer: ['C'] },
  { question_id: 'q3', number: 3, option_order: [], answer: ['Đ', 'S', 'Đ', 'S'] },
  { question_id: 'q4', number: 4, option_order: [], answer: ['12,5'] },
  { question_id: 'q5', number: 5, option_order: [], answer: [] },
];
const types: Record<string, QuestionType> = {
  q1: 'multiple_choice',
  q2: 'multiple_choice',
  q3: 'true_false',
  q4: 'short_answer',
  q5: 'essay',
};
const byNumber: Record<number, QuestionType> = {
  1: 'multiple_choice',
  2: 'multiple_choice',
  3: 'true_false',
  4: 'short_answer',
  5: 'essay',
};

const at = (iso: string) => new Date(iso);

describe('Xếp câu và lựa chọn của lượt', () => {
  it('CT-23a-1a: cùng hạt giống cho cùng thứ tự; đảo trong từng phần, giữ thứ tự phần; tắt đảo thì giữ nguyên', () => {
    const first = buildAttemptLayout(items, types, 12345, { shuffleQuestions: true, shuffleOptions: true });
    const again = buildAttemptLayout(items, types, 12345, { shuffleQuestions: true, shuffleOptions: true });
    assert.deepEqual(first, again, 'tải lại trang ra đúng thứ tự cũ');
    // Phần nhiều lựa chọn (câu 1, 2) đứng trước phần đúng sai, trả lời ngắn, tự luận
    assert.deepEqual([...first.order.slice(0, 2)].sort(), [1, 2]);
    assert.deepEqual(first.order.slice(2), [3, 4, 5]);
    assert.deepEqual([...(first.options['1'] ?? [])].sort(), ['A', 'B', 'C', 'D']);
    assert.equal(first.options['3'], undefined, 'chỉ câu nhiều lựa chọn đảo lựa chọn');
    const fixed = buildAttemptLayout(items, types, 12345, { shuffleQuestions: false, shuffleOptions: false });
    assert.deepEqual(fixed.order, [1, 2, 3, 4, 5]);
    assert.deepEqual(fixed.options['2'], ['A', 'B', 'C', 'D']);
    // Nhiều hạt giống cho nhiều thứ tự khác nhau
    const orders = new Set(
      Array.from({ length: 30 }, (_u, seed) =>
        JSON.stringify(buildAttemptLayout(items, types, seed + 1, { shuffleQuestions: true, shuffleOptions: true })),
      ),
    );
    assert.ok(orders.size > 5);
  });

  it('CT-23a-1b: nhãn hiển thị đổi qua lại với khoá lựa chọn của mã đề, hàm chấm của 22g2 chấm đúng', () => {
    const layout: AttemptLayout = {
      order: [2, 1, 3, 4, 5],
      options: { '1': ['C', 'A', 'B', 'D'], '2': ['A', 'B', 'C', 'D'] },
    };
    // Học sinh chọn nhãn B ở câu 1: vị trí thứ hai là khoá A của mã đề
    assert.deepEqual(labelsToKeys(layout, 1, ['B']), ['A']);
    assert.deepEqual(
      labelsToKeys(layout, 1, ['C', 'a']),
      ['B', 'C'],
      'nhãn chữ thường vẫn đọc được, kết quả xếp theo khoá',
    );
    assert.equal(labelsToKeys(layout, 1, ['Z']), null);
    assert.deepEqual(keysToLabels(layout, 1, ['B']), ['C']);
    assert.deepEqual(keysToLabels(layout, 3, ['Đ']), ['Đ'], 'câu không đảo giữ nguyên');
    // Câu 1 đáp án khoá B của mã đề ở vị trí thứ ba: học sinh phải chọn nhãn C
    const normalized = normalizeAnswers(
      { '1': ['C'], '2': ['A'], '3': ['Đ', 'S', 'Đ', 'S'], '4': [' 12.5 '], '5': ['Bài làm'] },
      layout,
      byNumber,
      { 3: 4 },
    );
    assert.deepEqual(normalized.errors, []);
    assert.deepEqual(normalized.answers['1'], ['B']);
    const questions: GradedQuestion[] = items.map((item) => ({
      question_id: item.question_id,
      question_type: types[item.question_id] as QuestionType,
      cognitive_level: 'recognition',
      topic_name: null,
      score: types[item.question_id] === 'essay' ? 4 : 1,
    }));
    const graded = gradeSheet(
      items,
      questions,
      { answers: answersForGrading(normalized.answers, byNumber), essay: { q5: { first: 3, second: null } } },
      { rule: 'tiered', doubleMarking: false, tolerance: 1 },
    );
    // Câu 1 đúng (khoá B), câu 2 sai (đáp án C, chọn A), đúng sai đủ 4 ý, trả lời ngắn đúng, tự luận 3 điểm
    assert.deepEqual([graded.objective, graded.essay, graded.total, graded.missing_essay], [3, 3, 6, 0]);
  });

  it('CT-23a-1c: kiểm tra câu trả lời: câu lạ, dạng sai, lựa chọn lạ, ý đúng sai; ý trống giữ vị trí khi chấm', () => {
    const layout = buildAttemptLayout(items, types, 7, { shuffleQuestions: true, shuffleOptions: true });
    const bad = normalizeAnswers(
      { '9': ['A'], '1': 'A', '2': ['Z'], '3': ['Đ', 'X'], '4': ['x'.repeat(201)], '5': ['y'.repeat(20001)] },
      layout,
      byNumber,
      { 3: 4 },
    );
    assert.deepEqual(bad.errors.map((error) => error.number).sort(), [1, 2, 3, 4, 5, 9]);
    assert.equal(normalizeAnswers([], layout, byNumber, {}).errors.length, 1);
    const partial = normalizeAnswers({ '3': ['', 'S', '', ''] }, layout, byNumber, { 3: 4 });
    assert.deepEqual(partial.answers['3'], ['', 'S', '', '']);
    assert.deepEqual(answersForGrading(partial.answers, byNumber)[3], ['?', 'S', '?', '?']);
    const empty = normalizeAnswers({ '3': ['', '', '', ''], '4': ['  '], '5': ['   '] }, layout, byNumber, { 3: 4 });
    assert.deepEqual(empty.answers, { '3': [], '4': [], '5': [] });
  });

  it('CT-23a-1d: phát mã đề: ngẫu nhiên hoặc cố định', () => {
    const random = createRandom(5);
    const picks = new Set(
      Array.from({ length: 40 }, () => pickVariantCode(['101', '102', '103'], 'random', null, random)),
    );
    assert.deepEqual([...picks].sort(), ['101', '102', '103']);
    assert.equal(pickVariantCode(['101', '102'], 'fixed', '102', random), '102');
    assert.equal(pickVariantCode(['101', '102'], 'fixed', '109', random), null);
    assert.equal(pickVariantCode([], 'random', null, random), null);
  });
});

describe('Đồng hồ máy chủ, sự kiện rời bài, lượt được tính', () => {
  it('CT-23a-1e: hạn nộp không quá giờ đóng; lưu nháp được chờ mạng vài giây; trạng thái cửa sổ giờ', () => {
    const opens = at('2026-11-02T01:00:00Z');
    const closes = at('2026-11-02T02:00:00Z');
    assert.equal(attemptDeadline(at('2026-11-02T01:05:00Z'), 30, closes).toISOString(), '2026-11-02T01:35:00.000Z');
    assert.equal(attemptDeadline(at('2026-11-02T01:50:00Z'), 30, closes).toISOString(), closes.toISOString());
    const deadline = at('2026-11-02T01:35:00Z');
    assert.equal(remainingSeconds(at('2026-11-02T01:34:30Z'), deadline), 30);
    assert.equal(remainingSeconds(at('2026-11-02T01:40:00Z'), deadline), 0);
    assert.equal(canSaveAnswers(at('2026-11-02T01:35:05Z'), deadline), true);
    assert.equal(canSaveAnswers(at('2026-11-02T01:35:11Z'), deadline), false);
    assert.equal(windowState(at('2026-11-02T00:59:59Z'), opens, closes), 'upcoming');
    assert.equal(windowState(opens, opens, closes), 'open');
    assert.equal(windowState(closes, opens, closes), 'closed');
  });

  it('CT-23a-1f: số lần rời bài gộp sự kiện liền nhau; camera không tính; quá số lần thì theo cấu hình', () => {
    const event = (type: string, iso: string) => ({ event_type: type, occurred_at: at(iso) });
    assert.equal(countViolations([]), 0);
    assert.equal(
      countViolations([
        event('fullscreen_exit', '2026-11-02T01:00:00Z'),
        event('window_blur', '2026-11-02T01:00:01Z'),
        event('page_hidden', '2026-11-02T01:00:02Z'),
      ]),
      1,
      'thoát toàn màn hình kéo theo mất tiêu điểm là một lần',
    );
    assert.equal(
      countViolations([
        event('fullscreen_exit', '2026-11-02T01:00:00Z'),
        event('fullscreen_exit', '2026-11-02T01:00:10Z'),
        event('no_face', '2026-11-02T01:00:20Z'),
        event('multiple_faces', '2026-11-02T01:00:21Z'),
        event('camera_lost', '2026-11-02T01:00:22Z'),
        event('second_session', '2026-11-02T01:00:23Z'),
      ]),
      2,
      'sự kiện camera và phiên thứ hai không tính vào số lần rời bài',
    );
    assert.equal(violationOutcome(0, 3, 'auto_submit'), 'none');
    assert.equal(violationOutcome(3, 3, 'auto_submit'), 'warn');
    assert.equal(violationOutcome(4, 3, 'flag'), 'flag');
    assert.equal(violationOutcome(4, 3, 'auto_submit'), 'auto_submit');
    assert.equal(violationOutcome(1, 0, 'flag'), 'flag', 'cho phép 0 lần: lần đầu đã là quá');
  });

  it('CT-23a-1g: lượt được tính theo cách chọn của bài; chế độ hiện kết quả', () => {
    const attempts = [
      { id: 'a', status: 'submitted' as const, submitted_at: at('2026-11-02T01:10:00Z'), total: 5, objective: 5 },
      { id: 'b', status: 'submitted' as const, submitted_at: at('2026-11-02T01:20:00Z'), total: 8, objective: 8 },
      { id: 'c', status: 'submitted' as const, submitted_at: at('2026-11-02T01:30:00Z'), total: 3, objective: 3 },
      { id: 'd', status: 'in_progress' as const, submitted_at: null, total: null, objective: null },
    ];
    assert.equal(countedAttempt(attempts, 'best')?.id, 'b');
    assert.equal(countedAttempt(attempts, 'last')?.id, 'c');
    assert.equal(countedAttempt([attempts[3] as (typeof attempts)[number]], 'best'), undefined);
    const tie = [
      { id: 'x', status: 'submitted' as const, submitted_at: at('2026-11-02T01:20:00Z'), total: null, objective: 4 },
      { id: 'y', status: 'submitted' as const, submitted_at: at('2026-11-02T01:10:00Z'), total: null, objective: 4 },
    ];
    assert.equal(countedAttempt(tie, 'best')?.id, 'y', 'bằng điểm thì lấy lượt nộp sớm hơn');
    const closes = at('2026-11-02T02:00:00Z');
    const before = at('2026-11-02T01:30:00Z');
    const after = at('2026-11-02T02:30:00Z');
    assert.equal(resultsVisible('immediate', before, closes, null, true), true);
    assert.equal(resultsVisible('immediate', before, closes, null, false), false);
    assert.equal(resultsVisible('after_close', before, closes, null, true), false);
    assert.equal(resultsVisible('after_close', after, closes, null, true), true);
    assert.equal(resultsVisible('teacher_release', after, closes, null, true), false);
    assert.equal(resultsVisible('teacher_release', after, closes, at('2026-11-02T02:10:00Z'), true), true);
  });

  it('CT-23a-1h: bộ đọc khuôn mặt trên máy học sinh: chỉ báo khi kéo dài, báo lại theo chu kỳ, hết tình trạng thì bắt đầu lại', () => {
    const watch = createFaceWatch({ noFaceSeconds: 5, multipleFacesSeconds: 2, repeatSeconds: 60 });
    assert.deepEqual(watch.push(1, 0), []);
    assert.deepEqual(watch.push(0, 1_000), [], 'mới mất mặt');
    assert.deepEqual(watch.push(0, 4_000), []);
    assert.deepEqual(watch.push(1, 4_500), [], 'cúi nhìn giấy nháp rồi quay lại thì không báo');
    assert.deepEqual(watch.push(0, 5_000), []);
    assert.deepEqual(watch.push(0, 10_000), [{ type: 'no_face', duration_ms: 5_000, faces: 0 }]);
    assert.deepEqual(watch.push(0, 20_000), [], 'một lần cho mỗi đợt');
    assert.deepEqual(
      watch.push(0, 70_000),
      [{ type: 'no_face', duration_ms: 65_000, faces: 0 }],
      'kéo dài thì báo lại',
    );
    assert.deepEqual(watch.push(1, 71_000), []);
    assert.deepEqual(watch.push(2, 72_000), []);
    assert.deepEqual(watch.push(3, 74_000), [{ type: 'multiple_faces', duration_ms: 2_000, faces: 3 }]);
    assert.deepEqual(watch.push(1, 75_000), []);
    assert.deepEqual(watch.push(0, 76_000), [], 'đợt mới tính lại từ đầu');
    assert.deepEqual(watch.push(0, 81_000), [{ type: 'no_face', duration_ms: 5_000, faces: 0 }]);
  });

  it('CT-23a-1i: giới hạn tần suất lưu nháp theo học sinh và theo trường, cửa sổ cố định mở lại sau một phút', () => {
    let now = Date.parse('2026-11-02T01:00:00Z');
    const limiter = new ExamRateLimiter({ now: () => new Date(now) } as unknown as Clock);
    for (let index = 0; index < EXAM_LIMITS.student.limit; index += 1) {
      limiter.hit('hoc-sinh-a');
    }
    assert.throws(() => limiter.hit('hoc-sinh-a'), /quá nhiều yêu cầu/);
    limiter.hit('hoc-sinh-b');
    now += 61_000;
    limiter.hit('hoc-sinh-a');
    limiter.reset();
    for (let index = 0; index < 125; index += 1) {
      for (let student = 0; student < 240; student += 1) {
        limiter.hit(`hs-${student}`);
      }
    }
    assert.throws(() => limiter.hit('hs-0'), /quá tải/);
  });

  it('CT-23a-1j: dải mạng của trường và mã phòng thi', () => {
    assert.deepEqual(parseNetworkRange('10.0.0.0/8'), { address: '10.0.0.0', prefix: 8, family: 'ipv4' });
    assert.deepEqual(parseNetworkRange('192.168.1.5'), { address: '192.168.1.5', prefix: 32, family: 'ipv4' });
    assert.deepEqual(parseNetworkRange('2001:db8::/32'), { address: '2001:db8::', prefix: 32, family: 'ipv6' });
    for (const bad of ['', 'abc', '10.0.0.0/33', '10.0.0.0/8/1', '10.0.0/8', '::1/129', '10.0.0.0/x']) {
      assert.equal(parseNetworkRange(bad), null, bad);
    }
    assert.equal(normalizeIp('::ffff:10.1.2.3'), '10.1.2.3');
    assert.equal(ipAllowed('203.0.113.9', []), true, 'không khai dải thì không giới hạn');
    assert.equal(ipAllowed('10.20.30.40', ['10.0.0.0/8', '192.168.0.0/16']), true);
    assert.equal(ipAllowed('::ffff:192.168.5.5', ['10.0.0.0/8', '192.168.0.0/16']), true, 'IPv4 dạng ánh xạ IPv6');
    assert.equal(ipAllowed('172.16.0.1', ['10.0.0.0/8', '192.168.0.0/16']), false);
    assert.equal(ipAllowed('2001:db8::1', ['2001:db8::/32']), true);
    assert.equal(ipAllowed('2001:db9::1', ['2001:db8::/32']), false);
    assert.equal(ipAllowed(undefined, ['10.0.0.0/8']), false, 'không rõ địa chỉ thì từ chối khi có giới hạn');
    assert.equal(ipAllowed('khong-phai-dia-chi', ['10.0.0.0/8']), false);
    for (let index = 0; index < 50; index += 1) {
      assert.match(generateRoomCode(), /^\d{6}$/);
    }
  });
});
