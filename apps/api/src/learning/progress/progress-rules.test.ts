import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApplicationError } from '@school-management/server';
import {
  attentionReasons,
  combineScore,
  correctRates,
  levelCounts,
  medianResponseHours,
  parseScoreBookInput,
  parseTermReport,
  sectionProgress,
  suggestComment,
  suggestSubjectLevel,
  weekStart,
  weightedAverage,
  type ActivityInfo,
  type ResultCell,
} from './progress-rules.js';

// Quy tắc thuần của tiến độ, bảng điểm hoạt động, sổ điểm, báo cáo (DT-28 phần 28d, YCTD-274). Dữ liệu là giả
const now = new Date('2026-10-28T03:00:00Z');
const day = 86_400_000;
const activity = (id: string, overrides: Partial<ActivityInfo> = {}): ActivityInfo => ({
  id,
  section_id: 's1',
  required: true,
  due_at: null,
  graded: false,
  weight: 1,
  ...overrides,
});
const cell = (
  status: ResultCell['status'],
  score: number | null = null,
  level: ResultCell['level'] = null,
): ResultCell => ({
  status,
  score,
  level,
});
const fieldsOf = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    return (error.details ?? []).map((detail) => detail.field);
  }
  assert.fail('phải báo lỗi');
};

describe('Quy tắc tiến độ và bảng điểm hoạt động', () => {
  it('CT-28d-1: cần chú ý khi quá hạn từ 2 hoạt động, hoàn thành dưới một nửa số đã đến hạn, 14 ngày chưa mở; theo chương', () => {
    const past = new Date(now.getTime() - day);
    const activities = [
      activity('a', { due_at: past }),
      activity('b', { due_at: past }),
      activity('c', { due_at: past }),
      activity('d', { section_id: 's2' }),
    ];
    const results = new Map([['a', cell('completed')]]);
    assert.deepEqual(attentionReasons({ activities, results, lastOpenedAt: null, now }), [
      'Quá hạn 2 hoạt động',
      'Mới hoàn thành 1/3 hoạt động đã đến hạn',
      '14 ngày chưa mở hoạt động nào',
    ]);
    const fine = new Map([
      ['a', cell('completed')],
      ['b', cell('passed')],
      ['c', cell('excused')],
    ]);
    assert.deepEqual(
      attentionReasons({ activities, results: fine, lastOpenedAt: new Date(now.getTime() - 2 * day), now }),
      [],
    );
    assert.deepEqual(
      sectionProgress(
        [
          { id: 's1', title: 'Chương 1' },
          { id: 's2', title: 'Chương 2' },
        ],
        activities,
        fine,
      ).map((row) => row.percent),
      [100, 0],
    );
  });

  it('CT-28d-2: bảng điểm: trung bình có trọng số chỉ hoạt động tính điểm đã có điểm (tham khảo); đếm mức cho Tiểu học', () => {
    const activities = [
      activity('a', { graded: true, weight: 1 }),
      activity('b', { graded: true, weight: 2 }),
      activity('c', { graded: false }),
    ];
    const results = new Map([
      ['a', cell('completed', 8)],
      ['b', cell('passed', 9)],
      ['c', cell('completed', 2)],
    ]);
    assert.equal(weightedAverage(activities, results), 8.7);
    assert.equal(weightedAverage(activities, new Map()), null);
    assert.deepEqual(
      levelCounts(
        activities,
        new Map([
          ['a', cell('completed', null, 'excellent')],
          ['b', cell('completed', null, 'not_completed')],
        ]),
      ),
      { excellent: 1, completed: 0, not_completed: 1 },
    );
  });

  it('CT-28d-3: vào sổ điểm: một hoạt động lấy đúng điểm, gộp lấy trung bình có trọng số; chưa có điểm hoặc miễn mọi hoạt động thì bỏ trống', () => {
    const chosen = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 2 },
    ];
    assert.deepEqual(combineScore([{ id: 'a', weight: 3 }], new Map([['a', cell('completed', 7.25)]])), {
      score: 7.3,
      reason: null,
    });
    assert.deepEqual(
      combineScore(
        chosen,
        new Map([
          ['a', cell('completed', 8)],
          ['b', cell('passed', 9)],
        ]),
      ).score,
      8.7,
    );
    assert.deepEqual(
      combineScore(
        chosen,
        new Map([
          ['a', cell('completed', 8)],
          ['b', cell('excused')],
        ]),
      ).score,
      8,
    );
    assert.match(String(combineScore(chosen, new Map([['a', cell('completed', 8)]])).reason), /chưa nộp/);
    assert.equal(
      combineScore(
        chosen,
        new Map([
          ['a', cell('excused')],
          ['b', cell('excused')],
        ]),
      ).reason,
      'Được miễn',
    );
    assert.deepEqual(
      fieldsOf(() => parseScoreBookInput({ activity_ids: [], method: 'single', term_type: 'year', seq: 11 })).sort(),
      ['activity_ids', 'seq', 'term_type'],
    );
    assert.deepEqual(
      fieldsOf(() =>
        parseScoreBookInput({
          activity_ids: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
          method: 'single',
          term_type: 'first_term',
          seq: 1,
        }),
      ),
      ['method'],
    );
  });

  it('CT-28d-4: Tiểu học: gợi ý mức đạt môn theo mức, điểm của hoạt động (hòa nghiêng về mức thấp); câu nhận xét có số hoạt động đã xong', () => {
    assert.equal(suggestSubjectLevel([cell('completed', null, 'excellent'), cell('completed', 9.5)]), 'T');
    assert.equal(suggestSubjectLevel([cell('completed', null, 'excellent'), cell('completed', 6)]), 'H');
    assert.equal(suggestSubjectLevel([cell('completed', 4), cell('excused')]), 'C');
    assert.equal(suggestSubjectLevel([cell('excused'), cell('not_started')]), null);
    assert.equal(
      suggestComment({ level: 'T', done: 3, required: 4, templates: { T: 'Em học tốt.' } }),
      'Em học tốt. Em đã hoàn thành 3/4 hoạt động học trực tuyến.',
    );
  });

  it('CT-28d-5: tuần bắt đầu thứ Hai giờ Việt Nam; trung vị giờ trả bài; tỷ lệ đúng của lớp mỗi câu; báo cáo học kỳ giới hạn chữ', () => {
    assert.equal(
      weekStart(new Date('2026-10-25T18:00:00Z')),
      '2026-10-26',
      'đêm Chủ nhật giờ UTC đã là thứ Hai giờ Việt Nam',
    );
    assert.equal(weekStart(new Date('2026-11-01T10:00:00Z')), '2026-10-26');
    const submitted = new Date('2026-10-26T00:00:00Z');
    assert.equal(
      medianResponseHours([
        { submitted_at: submitted, returned_at: new Date(submitted.getTime() + 2 * 3_600_000) },
        { submitted_at: submitted, returned_at: new Date(submitted.getTime() + 6 * 3_600_000) },
        { submitted_at: submitted, returned_at: null },
      ]),
      4,
    );
    assert.deepEqual(
      correctRates(
        [
          { id: 'i1', question_id: 'q1' },
          { id: 'i2', question_id: 'q2' },
        ],
        [{ i1: true }, { i1: false }, { i1: true }],
      ),
      [{ question_id: 'q1', attempts: 3, correct_rate: 66.67 }],
    );
    assert.deepEqual(parseTermReport({ evaluation: '  Tốt  ', causes: '' }), {
      evaluation: 'Tốt',
      difficulties: null,
      causes: null,
      recommendations: null,
    });
    assert.deepEqual(
      fieldsOf(() => parseTermReport({ difficulties: 'x'.repeat(4001) })),
      ['difficulties'],
    );
  });
});
