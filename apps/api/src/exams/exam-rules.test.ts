import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseExam, parseMatrix, parsePlan, parseQuestion, readDecision } from './exam-inputs.js';
import {
  buildVariants,
  checkMatrix,
  createRandom,
  pickQuestions,
  summarizeMatrix,
  variantCodes,
  type MatrixRow,
  type PoolQuestion,
} from './exam-rules.js';

// Kiểm tra, đánh giá phần đề (DT-21 phần 22g1, YCTD-168), kịch bản CT-22g1-1 đến CT-22g1-4: hàm thuần, dữ liệu giả
const SUBJECT = '00000000-0000-4000-8000-000000000001';
const TOPIC_A = '00000000-0000-4000-8000-0000000000a1';
const TOPIC_B = '00000000-0000-4000-8000-0000000000b1';

const row = (overrides: Partial<MatrixRow>): MatrixRow => ({
  topic_id: TOPIC_A,
  topic_name: 'Số hữu tỉ',
  cognitive_level: 'recognition',
  question_type: 'multiple_choice',
  count: 1,
  score_each: 0.25,
  ...overrides,
});

// Ma trận mẫu 10 điểm: 4 điểm nhận biết, 3 thông hiểu, 2 vận dụng, 1 vận dụng cao
const MATRIX: MatrixRow[] = [
  row({ count: 12, score_each: 0.25 }),
  row({ topic_id: TOPIC_B, cognitive_level: 'recognition', question_type: 'true_false', count: 1, score_each: 1 }),
  row({ cognitive_level: 'comprehension', question_type: 'short_answer', count: 4, score_each: 0.5 }),
  row({ topic_id: TOPIC_B, cognitive_level: 'comprehension', question_type: 'essay', count: 1, score_each: 1 }),
  row({ cognitive_level: 'application', question_type: 'essay', count: 1, score_each: 2 }),
  row({ topic_id: TOPIC_B, cognitive_level: 'high_application', question_type: 'essay', count: 1, score_each: 1 }),
];

describe('Ma trận, bốc câu, trộn đề', () => {
  it('CT-22g1-1: ma trận đúng tổng điểm và tỉ lệ mẫu; lệch tỉ lệ, sai tổng điểm, trống thì báo', () => {
    const summary = summarizeMatrix(MATRIX);
    assert.equal(summary.count, 20);
    assert.equal(summary.score, 10);
    assert.deepEqual(summary.ratios, { recognition: 40, comprehension: 30, application: 20, high_application: 10 });
    const ratios = { recognition: 40, comprehension: 30, application: 20, high_application: 10 };
    assert.deepEqual(checkMatrix({ total_score: 10, target_ratios: ratios, tolerance: 5, rows: MATRIX }), []);
    const skewed = checkMatrix({
      total_score: 10,
      target_ratios: { recognition: 30, comprehension: 30, application: 30, high_application: 10 },
      tolerance: 5,
      rows: MATRIX,
    });
    assert.deepEqual(
      skewed.map((issue) => issue.message),
      [
        'Mức Nhận biết chiếm 40% điểm, mẫu 30% (sai số cho phép 5%)',
        'Mức Vận dụng chiếm 20% điểm, mẫu 30% (sai số cho phép 5%)',
      ],
    );
    assert.deepEqual(
      checkMatrix({ total_score: 9, target_ratios: ratios, tolerance: 5, rows: MATRIX }).map((issue) => issue.code),
      ['total_score'],
    );
    assert.deepEqual(
      checkMatrix({ total_score: 10, target_ratios: ratios, tolerance: 5, rows: [] }).map((issue) => issue.code),
      ['empty'],
    );
  });

  it('CT-22g1-2: bốc câu đúng chủ đề, mức, dạng, không trùng, tránh câu dùng gần đây; thiếu câu báo từng dòng', () => {
    const pool: PoolQuestion[] = [];
    const add = (count: number, base: Omit<PoolQuestion, 'id'>) => {
      for (let index = 0; index < count; index += 1) {
        pool.push({ ...base, id: `${base.topic_id}-${base.cognitive_level}-${base.question_type}-${pool.length}` });
      }
    };
    add(15, {
      topic_id: TOPIC_A,
      cognitive_level: 'recognition',
      question_type: 'multiple_choice',
      last_used_at: null,
    });
    add(2, {
      topic_id: TOPIC_A,
      cognitive_level: 'recognition',
      question_type: 'multiple_choice',
      last_used_at: '2026-10-20',
    });
    add(1, { topic_id: TOPIC_B, cognitive_level: 'recognition', question_type: 'true_false', last_used_at: null });
    add(4, { topic_id: TOPIC_A, cognitive_level: 'comprehension', question_type: 'short_answer', last_used_at: null });
    add(1, { topic_id: TOPIC_B, cognitive_level: 'comprehension', question_type: 'essay', last_used_at: null });
    add(1, { topic_id: TOPIC_A, cognitive_level: 'application', question_type: 'essay', last_used_at: null });
    add(1, { topic_id: TOPIC_B, cognitive_level: 'high_application', question_type: 'essay', last_used_at: null });
    const result = pickQuestions(MATRIX, pool, { usedSince: '2026-10-01', random: createRandom(1) });
    assert.deepEqual(result.shortages, []);
    assert.equal(result.picked.length, 20);
    assert.equal(new Set(result.picked.map((item) => item.question_id)).size, 20);
    for (const item of result.picked) {
      const question = pool.find((candidate) => candidate.id === item.question_id) as PoolQuestion;
      const matrixRow = MATRIX[item.row - 1] as MatrixRow;
      assert.equal(question.cognitive_level, matrixRow.cognitive_level);
      assert.equal(question.question_type, matrixRow.question_type);
      assert.equal(question.topic_id, matrixRow.topic_id);
      assert.equal(question.last_used_at, null);
      assert.equal(item.score, matrixRow.score_each);
    }
    // Hai lần bốc với hạt giống khác cho đề khác nhau
    const other = pickQuestions(MATRIX, pool, { usedSince: null, random: createRandom(2) });
    assert.notDeepEqual(
      other.picked.map((item) => item.question_id).sort(),
      result.picked.map((item) => item.question_id).sort(),
    );
    // Thiếu câu: không bốc nửa chừng, báo dòng thiếu
    const short = pickQuestions(MATRIX, pool.slice(0, 10), { usedSince: null, random: createRandom(3) });
    assert.deepEqual(short.picked, []);
    assert.equal(
      short.shortages[0]?.message,
      'Dòng 1 (Số hữu tỉ, Nhận biết, Nhiều lựa chọn) cần 12 câu, ngân hàng có 10 câu dùng được',
    );
    assert.deepEqual(
      short.shortages.map((item) => item.row),
      [1, 2, 3, 4, 5, 6],
    );
  });

  it('CT-22g1-3: trộn nhiều mã đề: mã đầu giữ thứ tự, các mã sau trộn câu trong phần và lựa chọn, đáp án đúng theo mã', () => {
    const questions = [
      ...Array.from({ length: 8 }, (_value, index) => ({
        question_id: `mc-${index}`,
        question_type: 'multiple_choice' as const,
        option_count: 4,
        answer: [['A', 'B', 'C', 'D'][index % 4] as string],
      })),
      { question_id: 'tf-1', question_type: 'true_false' as const, option_count: 4, answer: ['Đ', 'S', 'S', 'Đ'] },
      { question_id: 'sa-1', question_type: 'short_answer' as const, option_count: 0, answer: ['3,5'] },
      { question_id: 'es-1', question_type: 'essay' as const, option_count: 0, answer: [] },
      { question_id: 'es-2', question_type: 'essay' as const, option_count: 0, answer: [] },
    ];
    assert.deepEqual(variantCodes(3), ['101', '102', '103']);
    const variants = buildVariants(questions, 4, 42);
    assert.deepEqual(
      variants[0]?.items.map((item) => item.question_id),
      questions.map((question) => question.question_id),
    );
    for (const variant of variants) {
      assert.equal(variant.items.length, questions.length);
      assert.deepEqual(
        variant.items.map((item) => item.number),
        questions.map((_question, index) => index + 1),
      );
      // Phần giữ thứ tự: 8 câu nhiều lựa chọn, rồi đúng sai, trả lời ngắn, tự luận
      assert.deepEqual(
        variant.items.map((item) => item.question_id.split('-')[0]),
        ['mc', 'mc', 'mc', 'mc', 'mc', 'mc', 'mc', 'mc', 'tf', 'sa', 'es', 'es'],
      );
      for (const item of variant.items) {
        const question = questions.find((candidate) => candidate.question_id === item.question_id);
        if (question?.question_type === 'multiple_choice') {
          // Đáp án của mã đề trỏ đúng lựa chọn gốc đúng
          const shown = item.answer[0] as string;
          assert.equal(item.option_order[['A', 'B', 'C', 'D'].indexOf(shown)], question.answer[0]);
          assert.deepEqual([...item.option_order].sort(), ['A', 'B', 'C', 'D']);
        } else {
          assert.deepEqual(item.answer, question?.answer);
          assert.deepEqual(item.option_order, []);
        }
      }
    }
    const orders = new Set(variants.map((variant) => variant.items.map((item) => item.question_id).join(',')));
    assert.ok(orders.size >= 3, 'các mã đề khác thứ tự câu');
    assert.deepEqual(buildVariants(questions, 4, 42), variants);
  });

  it('CT-22g1-4: kiểm tra dữ liệu câu hỏi, ma trận, kế hoạch, đề, quyết định thẩm định', () => {
    const base = {
      school_level: 'THCS',
      subject_id: SUBJECT,
      grade_level_code: 'K6',
      cognitive_level: 'recognition',
      content: 'Số nào là số hữu tỉ?',
    };
    const choice = parseQuestion({
      ...base,
      question_type: 'multiple_choice',
      options: ['1/2', 'căn 2', 'pi', 'e'],
      answer: ['a'],
    });
    assert.deepEqual(
      choice.options.map((option) => option.key),
      ['A', 'B', 'C', 'D'],
    );
    assert.deepEqual(choice.answer, ['A']);
    assert.equal(choice.score, 1);
    for (const body of [
      { ...base, question_type: 'multiple_choice', options: ['1/2'], answer: ['A'] },
      { ...base, question_type: 'multiple_choice', options: ['1', '2', '3'], answer: ['D'] },
      { ...base, question_type: 'true_false', options: ['ý 1', 'ý 2'], answer: ['Đ'] },
      { ...base, question_type: 'short_answer', answer: [] },
      { ...base, question_type: 'essay' },
      { ...base, school_level: 'MN', question_type: 'essay', guidance: 'Chấm theo ý' },
      { ...base, question_type: 'essay', guidance: 'Chấm theo ý', score: 11 },
    ]) {
      assert.throws(() => parseQuestion(body), { code: 'ERR_VALIDATION' }, JSON.stringify(body));
    }
    assert.deepEqual(
      parseQuestion({ ...base, question_type: 'true_false', options: ['ý 1', 'ý 2'], answer: ['Đ', 'S'] }).options.map(
        (option) => option.key,
      ),
      ['a', 'b'],
    );
    const matrix = parseMatrix({
      school_level: 'THCS',
      subject_id: SUBJECT,
      grade_level_code: 'K6',
      name: 'Giữa học kỳ I',
      rows: [{ topic_id: null, cognitive_level: 'recognition', question_type: 'essay', count: 2, score_each: 5 }],
    });
    assert.equal(matrix.total_score, 10);
    assert.equal(matrix.tolerance, 5);
    assert.throws(
      () =>
        parseMatrix({
          school_level: 'THCS',
          subject_id: SUBJECT,
          grade_level_code: 'K6',
          name: 'X',
          target_ratios: { recognition: 50, comprehension: 30, application: 20, high_application: 10 },
          rows: [],
        }),
      { code: 'ERR_VALIDATION' },
    );
    assert.equal(
      parsePlan({
        school_level: 'THPT',
        term: 'HK2',
        grade_level_code: 'K10',
        subject_id: SUBJECT,
        kind: 'final',
        form: 'mixed',
        duration_minutes: 90,
        planned_date: '2027-05-10',
      }).planned_date,
      '2027-05-10',
    );
    assert.throws(() => parsePlan({ school_level: 'THPT', term: 'HK3' }), { code: 'ERR_VALIDATION' });
    assert.equal(
      parseExam({
        school_level: 'THCS',
        subject_id: SUBJECT,
        grade_level_code: 'K6',
        title: 'Đề giữa kỳ',
        author_user_id: SUBJECT,
      }).variant_count,
      4,
    );
    assert.throws(() => readDecision({ decision: 'return' }), { code: 'ERR_VALIDATION' });
    assert.deepEqual(readDecision({ decision: 'approve' }), { approve: true, note: null });
  });
});
