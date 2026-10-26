import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attendanceFromRoomEvents,
  isoWeekday,
  periodsForSession,
  programRuleViolations,
  timesOverlap,
  weekStart,
  weeklyDates,
  weeklyLoadViolations,
  type TutoringRuleSet,
} from '@school-management/shared';

// Quy định dạy thêm của gia sư trong trường (DT-27 phần 27b, YCTD-252), kịch bản CT-27b-1, CT-27b-2: mỗi dòng của bảng ở tài liệu 32
// mục 19.2 có ca kiểm thử (Thông tư 29/2024 sửa bởi Thông tư 19/2026)
const RULES: TutoringRuleSet = {
  effectiveFrom: '2026-05-15',
  maxCurriculumPeriodsPerWeek: 2,
  curriculumBlockedLevels: ['TH'],
  defaultPeriodMinutes: { TH: 35, THCS: 45, THPT: 45 },
};
const program = (overrides: Partial<Parameters<typeof programRuleViolations>[0]> = {}) => ({
  contentType: 'curriculum' as const,
  chargesFee: false,
  audience: 'below_standard' as const,
  subjectId: 'mon-toan',
  schoolLevel: 'THCS' as const,
  ...overrides,
});
const codes = (violations: Array<{ code: string }>) => violations.map((violation) => violation.code);

describe('quy định dạy thêm ở máy chủ', () => {
  it('CT-27b-1: `curriculum` trong trường không thu tiền, bắt buộc nhóm đối tượng và môn, không cho Tiểu học; `enrichment` không chịu khóa', () => {
    assert.deepEqual(programRuleViolations(program(), RULES), []);
    assert.deepEqual(codes(programRuleViolations(program({ chargesFee: true }), RULES)), ['curriculum_fee']);
    assert.deepEqual(codes(programRuleViolations(program({ audience: null }), RULES)), ['curriculum_audience']);
    assert.deepEqual(codes(programRuleViolations(program({ subjectId: null }), RULES)), ['curriculum_subject']);
    assert.deepEqual(codes(programRuleViolations(program({ schoolLevel: 'TH' }), RULES)), ['curriculum_level']);
    assert.deepEqual(
      programRuleViolations(
        program({ contentType: 'enrichment', chargesFee: true, audience: null, subjectId: null, schoolLevel: 'TH' }),
        RULES,
      ),
      [],
      'bổ trợ ngoài chương trình (nghệ thuật, thể thao, kỹ năng sống) không thuộc phạm vi',
    );
    assert.deepEqual(
      programRuleViolations(program({ schoolLevel: 'TH' }), { ...RULES, curriculumBlockedLevels: [] }),
      [],
      'quy định đổi thì đổi dữ liệu, không sửa mã',
    );
  });

  it('CT-27b-2: tối đa 2 tiết/tuần/môn/học sinh cộng mọi chương trình, quyết định của Sở nâng giới hạn; quy đổi tiết, tuần, trùng giờ, điểm danh từ nhật ký phòng', () => {
    assert.equal(periodsForSession('17:00', '17:45', 45), 1);
    assert.equal(periodsForSession('17:00', '18:30', 45), 2);
    assert.equal(periodsForSession('17:00', '18:31', 45), 3, 'làm tròn lên');
    assert.equal(isoWeekday('2026-11-02'), 1);
    assert.equal(isoWeekday('2026-11-08'), 7);
    assert.equal(weekStart('2026-11-05'), '2026-11-02');
    assert.deepEqual(weeklyDates('2026-11-02', '2026-11-15', [2, 4]), [
      '2026-11-03',
      '2026-11-05',
      '2026-11-10',
      '2026-11-12',
    ]);
    assert.equal(timesOverlap({ start: '07:00', end: '07:45' }, { start: '07:30', end: '08:00' }), true);
    assert.equal(
      timesOverlap({ start: '07:00', end: '07:45' }, { start: '07:45', end: '08:30' }),
      false,
      'liền nhau không trùng',
    );

    const load = (periods: number, week = '2026-11-02', childId = 'a', subjectId = 'toan') => ({
      childId,
      subjectId,
      week,
      periods,
    });
    assert.deepEqual(weeklyLoadViolations([load(1), load(1)], 2, []), []);
    const over = weeklyLoadViolations([load(1), load(2)], 2, []);
    assert.equal(over.length, 1);
    assert.equal(over[0]?.periods, 3);
    assert.deepEqual(weeklyLoadViolations([load(2), load(2, '2026-11-09')], 2, []), [], 'mỗi tuần đếm riêng');
    assert.deepEqual(
      weeklyLoadViolations([load(2), load(2, '2026-11-02', 'a', 'van')], 2, []),
      [],
      'mỗi môn đếm riêng',
    );
    assert.deepEqual(weeklyLoadViolations([load(2), load(2, '2026-11-02', 'b')], 2, []), [], 'mỗi học sinh đếm riêng');
    assert.deepEqual(
      weeklyLoadViolations([load(1), load(2)], 2, [{ childId: 'a', subjectId: 'toan', maxPeriods: 4 }]),
      [],
    );
    assert.equal(
      weeklyLoadViolations([load(3), load(2)], 2, [{ childId: 'a', subjectId: 'toan', maxPeriods: 4 }])[0]?.limit,
      4,
    );
    assert.equal(
      weeklyLoadViolations([load(3)], 2, [{ childId: 'a', subjectId: 'van', maxPeriods: 4 }]).length,
      1,
      'quyết định cho môn khác không áp dụng',
    );

    const session = { date: '2026-11-03', startTime: '17:00', endTime: '18:00' };
    const at = (time: string) => new Date(`2026-11-03T${time}:00+07:00`);
    assert.equal(attendanceFromRoomEvents([], session).status, 'absent');
    assert.equal(
      attendanceFromRoomEvents(
        [
          { kind: 'join', at: at('17:05') },
          { kind: 'leave', at: at('18:00') },
        ],
        session,
      ).status,
      'present',
    );
    assert.equal(attendanceFromRoomEvents([{ kind: 'join', at: at('17:20') }], session).status, 'late');
    assert.equal(
      attendanceFromRoomEvents(
        [
          { kind: 'join', at: at('16:58') },
          { kind: 'leave', at: at('17:30') },
        ],
        session,
      ).status,
      'left_early',
    );
    assert.equal(
      attendanceFromRoomEvents(
        [
          { kind: 'join', at: at('17:00') },
          { kind: 'leave', at: at('17:20') },
          { kind: 'join', at: at('17:25') },
        ],
        session,
      ).status,
      'present',
      'rớt mạng rồi vào lại thì tính theo lần cuối',
    );
  });
});
