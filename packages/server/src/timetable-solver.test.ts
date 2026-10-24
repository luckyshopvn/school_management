import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkTimetableInput,
  normalizeWeights,
  scoreTimetable,
  solveTimetable,
  type SolverDemand,
  type SolverInput,
  type SolverPlacement,
} from './timetable-solver.js';

// Máy xếp thời khoá biểu (DT-20 phần 22c2, YCTD-164); kịch bản CT-22c2-1 đến CT-22c2-6. Dữ liệu là tên giả
const MORNING = [1, 2, 3, 4].map((period_no) => ({ period_no, session: 'morning' as const }));
const FULL_DAY = [...MORNING, ...[5, 6, 7].map((period_no) => ({ period_no, session: 'afternoon' as const }))];
const WEEK = [1, 2, 3, 4, 5];

const demand = (overrides: Partial<SolverDemand> & Pick<SolverDemand, 'class_id' | 'subject_id'>): SolverDemand => ({
  class_name: overrides.class_id,
  subject_name: overrides.subject_id,
  teacher_id: null,
  teacher_name: null,
  room_id: null,
  room_name: null,
  periods: 1,
  ...overrides,
});

// Kiểm tra độc lập với máy xếp: không lớp, giáo viên, phòng nào hai tiết cùng ô; giáo viên không dạy tiết đã báo bận; đủ tiết
function assertValid(input: SolverInput, placements: SolverPlacement[]) {
  const seen = new Set<string>();
  for (const placement of placements) {
    const slot = `${placement.weekday}:${placement.period_no}`;
    for (const key of [
      `class:${placement.class_id}:${slot}`,
      placement.teacher_id ? `teacher:${placement.teacher_id}:${slot}` : null,
      placement.room_id ? `room:${placement.room_id}:${slot}` : null,
    ]) {
      if (key) {
        assert.ok(!seen.has(key), `trùng ${key}`);
        seen.add(key);
      }
    }
    assert.ok(input.days.includes(placement.weekday));
    assert.ok(input.periods.some((period) => period.period_no === placement.period_no));
    const busy = placement.teacher_id ? (input.teacher_unavailable?.[placement.teacher_id] ?? []) : [];
    assert.ok(
      !busy.some((item) => item.weekday === placement.weekday && item.period_no === placement.period_no),
      'giáo viên dạy vào tiết đã báo bận',
    );
  }
  for (const item of input.demands) {
    const count = placements.filter(
      (placement) => placement.class_id === item.class_id && placement.subject_id === item.subject_id,
    ).length;
    assert.equal(count, Math.ceil(item.periods), `${item.class_id} ${item.subject_id}`);
  }
}

// Hai lớp 20 tiết/tuần, giáo viên chủ nhiệm dạy môn chính, giáo viên bộ môn dạy cả hai lớp
function smallSchool(): SolverInput {
  const demands: SolverDemand[] = [];
  for (const [classId, homeroom] of [
    ['1A', 'GV-A'],
    ['1B', 'GV-B'],
  ] as const) {
    demands.push(
      demand({ class_id: classId, subject_id: 'TV', teacher_id: homeroom, periods: 7, double_period: true }),
      demand({ class_id: classId, subject_id: 'TOAN', teacher_id: homeroom, periods: 5 }),
      demand({ class_id: classId, subject_id: 'DD', teacher_id: homeroom, periods: 1, avoid_last_period: true }),
      demand({ class_id: classId, subject_id: 'TA', teacher_id: 'GV-TA', periods: 2 }),
      demand({ class_id: classId, subject_id: 'GDTC', teacher_id: 'GV-TC', periods: 2 }),
      demand({ class_id: classId, subject_id: 'TIN', teacher_id: 'GV-TIN', room_id: 'P-MAY', periods: 1 }),
      demand({ class_id: classId, subject_id: 'HDTN', teacher_id: homeroom, periods: 2 }),
    );
  }
  return {
    days: WEEK,
    periods: MORNING,
    demands,
    teacher_unavailable: {
      'GV-TA': [
        { weekday: 1, period_no: 1 },
        { weekday: 1, period_no: 2 },
      ],
    },
  };
}

describe('Máy xếp thời khoá biểu', () => {
  it('CT-22c2-1: trường hợp nhỏ xếp đủ tiết, không trùng giáo viên, phòng, không dạy tiết đã báo bận', async () => {
    const input = smallSchool();
    assert.deepEqual(checkTimetableInput(input), []);
    const result = await solveTimetable(input, { time_limit_ms: 1500, variant_count: 1, seed: 1 });
    assert.equal(result.status, 'feasible');
    const best = result.variants[0];
    assert.ok(best);
    assert.equal(best.hard_count, 0);
    assert.deepEqual(best.violations, []);
    assertValid(input, best.placements);
    // Hai lớp dùng hết 20 ô của tuần nên không có tiết trống giữa buổi
    assert.equal(best.soft.find((item) => item.code === 'class_gaps')?.penalty, 0);
  });

  it('CT-22c2-2: ràng buộc mềm theo mức quan trọng: tiết đôi, tránh tiết cuối, rải đều; mức 0 là tắt', async () => {
    const input: SolverInput = {
      days: WEEK,
      periods: FULL_DAY,
      demands: [
        demand({ class_id: '2A', subject_id: 'TV', teacher_id: 'GV-1', periods: 4, double_period: true }),
        demand({ class_id: '2A', subject_id: 'TOAN', teacher_id: 'GV-1', periods: 5 }),
        demand({ class_id: '2A', subject_id: 'DD', teacher_id: 'GV-1', periods: 1, avoid_last_period: true }),
      ],
      weights: { double_period: 10, avoid_last_period: 10, spread_week: 10, class_gaps: 0, teacher_gaps: 0 },
    };
    const result = await solveTimetable(input, { time_limit_ms: 800, variant_count: 1, seed: 2 });
    const best = result.variants[0];
    assert.ok(best);
    assertValid(input, best.placements);
    const penalty = (code: string) => best.soft.find((item) => item.code === code)?.penalty;
    assert.equal(penalty('double_period'), 0);
    assert.equal(penalty('avoid_last_period'), 0);
    assert.equal(penalty('spread_week'), 0);
    // Tiết đôi: 4 tiết Tiếng Việt thành 2 cặp liền nhau trong một buổi
    const pairs = best.placements
      .filter((item) => item.subject_id === 'TV')
      .filter((item, _, all) =>
        all.some((other) => other.weekday === item.weekday && Math.abs(other.period_no - item.period_no) === 1),
      );
    assert.equal(pairs.length, 4);
    // Toán 5 tiết rải đều 5 ngày
    assert.equal(
      new Set(best.placements.filter((item) => item.subject_id === 'TOAN').map((item) => item.weekday)).size,
      5,
    );
    // Mức 0: điểm phạt vẫn đếm để xem nhưng không cộng vào điểm của phương án
    assert.equal(best.soft.find((item) => item.code === 'class_gaps')?.weight, 0);
    assert.deepEqual(normalizeWeights({ double_period: 14, spread_week: -2, teacher_gaps: 2.6 }), {
      double_period: 10,
      avoid_last_period: 3,
      spread_week: 0,
      teacher_gaps: 3,
      class_gaps: 8,
    });
  });

  it('CT-22c2-3: không thể xếp vì giáo viên quá tải: báo trước ràng buộc nào, phương án ghi từng tiết trùng', async () => {
    // Một giáo viên dạy 2 lớp × 12 tiết = 24 tiết nhưng tuần chỉ có 20 ô
    const input: SolverInput = {
      days: WEEK,
      periods: MORNING,
      demands: [
        demand({
          class_id: '3A',
          class_name: '3A',
          subject_id: 'TOAN',
          subject_name: 'Toán',
          teacher_id: 'GV-X',
          teacher_name: 'Cô X',
          periods: 12,
        }),
        demand({
          class_id: '3B',
          class_name: '3B',
          subject_id: 'TOAN',
          subject_name: 'Toán',
          teacher_id: 'GV-X',
          teacher_name: 'Cô X',
          periods: 12,
        }),
      ],
    };
    const issues = checkTimetableInput(input);
    assert.deepEqual(
      issues.map((issue) => [issue.code, issue.severity]),
      [['teacher_capacity', 'hard']],
    );
    assert.match(issues[0]?.message ?? '', /Cô X được phân 24 tiết\/tuần nhưng chỉ có 20 ô/);
    const result = await solveTimetable(input, { time_limit_ms: 500, variant_count: 1, seed: 3 });
    assert.equal(result.status, 'infeasible');
    const best = result.variants[0];
    assert.ok(best);
    // Ít nhất 4 tiết trùng (24 tiết vào 20 ô), máy dồn trùng về mức thấp nhất
    assert.equal(best.hard_count, 4);
    assert.ok(best.violations.every((violation) => violation.code === 'teacher_clash'));
    assert.match(best.violations[0]?.message ?? '', /Giáo viên Cô X dạy 2 lớp cùng Thứ \d tiết \d: 3A, 3B/);
  });

  it('CT-22c2-4: lớp cần nhiều tiết hơn khung, phòng quá tải, giáo viên bận: báo rõ ràng buộc', async () => {
    const input: SolverInput = {
      days: [1, 2],
      periods: MORNING,
      demands: [
        demand({ class_id: '4A', class_name: '4A', subject_id: 'TV', subject_name: 'Tiếng Việt', periods: 9 }),
        demand({
          class_id: '4B',
          class_name: '4B',
          subject_id: 'TIN',
          subject_name: 'Tin học',
          room_id: 'P1',
          room_name: 'Phòng máy',
          periods: 5,
        }),
        demand({
          class_id: '4C',
          class_name: '4C',
          subject_id: 'TIN',
          subject_name: 'Tin học',
          room_id: 'P1',
          room_name: 'Phòng máy',
          periods: 4,
        }),
        demand({
          class_id: '4D',
          class_name: '4D',
          subject_id: 'TA',
          subject_name: 'Tiếng Anh',
          teacher_id: 'GV-Y',
          teacher_name: 'Thầy Y',
          periods: 1,
        }),
      ],
      teacher_unavailable: {
        'GV-Y': [1, 2, 3, 4].flatMap((period_no) => [
          { weekday: 1, period_no },
          { weekday: 2, period_no },
        ]),
      },
    };
    const issues = checkTimetableInput(input);
    assert.deepEqual(
      issues.map((issue) => issue.code),
      ['class_capacity', 'teacher_capacity', 'room_capacity', 'missing_teacher'],
    );
    assert.match(issues[0]?.message ?? '', /Lớp 4A cần 9 tiết\/tuần nhưng khung chỉ có 8 ô/);
    const result = await solveTimetable(input, { time_limit_ms: 500, variant_count: 1, seed: 4 });
    const codes = new Set(result.variants[0]?.violations.map((violation) => violation.code));
    assert.deepEqual([...codes].sort(), ['room_clash', 'teacher_unavailable', 'unplaced']);
    assert.ok(
      result.variants[0]?.violations.some((violation) =>
        /Lớp 4A: còn 1 tiết môn Tiếng Việt không xếp được vì lớp hết ô/.test(violation.message),
      ),
    );
    // Chưa có khung giờ: không xếp, báo ngay
    const empty = await solveTimetable({ ...input, periods: [] }, { time_limit_ms: 100, variant_count: 1 });
    assert.equal(empty.status, 'infeasible');
    assert.deepEqual(
      empty.issues.map((issue) => issue.code),
      ['no_periods'],
    );
    // Môn chưa phân công giáo viên chỉ là cảnh báo
    assert.deepEqual(
      checkTimetableInput({
        days: WEEK,
        periods: MORNING,
        demands: [demand({ class_id: '5A', subject_id: 'TV', periods: 2 })],
      }).map((issue) => [issue.code, issue.severity]),
      [['missing_teacher', 'soft']],
    );
  });

  it('CT-22c2-5: nhiều phương án khác nhau, xếp theo điểm; báo tiến độ; dừng khi người dùng huỷ', async () => {
    const input = { ...smallSchool(), periods: FULL_DAY };
    const progress: number[] = [];
    const result = await solveTimetable(input, {
      time_limit_ms: 1500,
      variant_count: 3,
      seed: 5,
      on_progress: (value) => {
        progress.push(value.percent);
      },
    });
    assert.ok(result.variants.length >= 2, `số phương án ${result.variants.length}`);
    assert.deepEqual(
      result.variants.map((variant) => variant.variant_no),
      result.variants.map((_, index) => index + 1),
    );
    for (let index = 1; index < result.variants.length; index += 1) {
      assert.ok((result.variants[index]?.score ?? 0) >= (result.variants[index - 1]?.score ?? 0));
    }
    for (const variant of result.variants) {
      assert.equal(variant.hard_count, 0);
      assertValid(input, variant.placements);
    }
    assert.ok(progress.length > 0);
    assert.ok(progress.every((percent) => percent >= 0 && percent <= 99));

    const stopped = await solveTimetable(input, {
      time_limit_ms: 5000,
      variant_count: 2,
      seed: 6,
      on_progress: () => true,
    });
    assert.equal(stopped.status, 'stopped');
    assert.ok(stopped.variants.length <= 1);
  });

  it('CT-22c2-6: chấm bản sửa tay theo cùng thang điểm: tiết trùng giáo viên, tiết thiếu', () => {
    const input = smallSchool();
    const placements: SolverPlacement[] = [
      { class_id: '1A', subject_id: 'TA', teacher_id: 'GV-TA', room_id: null, weekday: 2, period_no: 1 },
      { class_id: '1B', subject_id: 'TA', teacher_id: 'GV-TA', room_id: null, weekday: 2, period_no: 1 },
      { class_id: '1A', subject_id: 'TA', teacher_id: 'GV-TA', room_id: null, weekday: 1, period_no: 1 },
    ];
    const scored = scoreTimetable(input, placements);
    const codes = scored.violations.map((violation) => violation.code);
    assert.ok(codes.includes('teacher_clash'));
    assert.ok(codes.includes('teacher_unavailable'));
    assert.ok(codes.includes('unplaced'));
    assert.ok(scored.hard_count >= 2);
  });
});
