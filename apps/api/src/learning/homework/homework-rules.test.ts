import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkWorkload,
  gradeNumber,
  homeworkStatus,
  inQuietHours,
  nextLessonDue,
  parsePolicyInput,
  planReminders,
  policyFor,
  reminderText,
  workloadDays,
  type PolicyRow,
  type ReminderCandidate,
} from './homework-rules.js';

// Quy tắc thuần của bài về nhà (DT-28 phần 28f, YCTD-276)
const policy = (values: Partial<PolicyRow>): PolicyRow => ({
  school_level: 'TH',
  grade: 0,
  no_homework: false,
  max_items_per_day: null,
  max_minutes_per_day: null,
  blocked_weekdays: [],
  skip_holidays: false,
  action: 'warn',
  basis: null,
  ...values,
});

describe('Quy tắc bài về nhà', () => {
  it('CT-28f-1: trường chưa đặt quy tắc thì không chặn, không cảnh báo; quy tắc của khối thay quy tắc chung của cấp', () => {
    assert.deepEqual(
      checkWorkload({
        policy: null,
        dueDate: '2026-11-02',
        holiday: true,
        existing: { count: 9, minutes: 500 },
        minutes: 60,
      }),
      { violations: [], action: null },
    );
    const level = policy({ max_items_per_day: 3 });
    const gradeOne = policy({ grade: 1, no_homework: true, action: 'block' });
    assert.equal(policyFor([level, gradeOne], 'TH', 1), gradeOne);
    assert.equal(policyFor([level, gradeOne], 'TH', 4), level);
    assert.equal(policyFor([level, gradeOne], 'THCS', 7), null);
    assert.equal(gradeNumber('K7'), 7);
    assert.equal(gradeNumber('K10'), 10);
    assert.equal(gradeNumber(null), 0);
    const blocked = checkWorkload({
      policy: gradeOne,
      dueDate: '2026-11-03',
      holiday: false,
      existing: { count: 0, minutes: 0 },
      minutes: null,
    });
    assert.equal(blocked.action, 'block');
    assert.match(blocked.violations[0] ?? '', /không giao bài về nhà/);
  });

  it('CT-28f-2: vượt số bài, số phút mỗi ngày, thứ không để hạn, ngày lễ; nhập quy tắc sai báo theo ô', () => {
    // 2026-11-08 là Chủ nhật
    const result = checkWorkload({
      policy: policy({ max_items_per_day: 2, max_minutes_per_day: 45, blocked_weekdays: [7], skip_holidays: true }),
      dueDate: '2026-11-08',
      holiday: true,
      existing: { count: 2, minutes: 30 },
      minutes: 20,
    });
    assert.equal(result.action, 'warn');
    assert.equal(result.violations.length, 4, result.violations.join(' | '));
    assert.ok(result.violations.some((text) => text.includes('Chủ nhật')));
    assert.ok(result.violations.some((text) => text.includes('50 phút')));
    const fine = checkWorkload({
      policy: policy({ max_items_per_day: 3, max_minutes_per_day: 60 }),
      dueDate: '2026-11-04',
      holiday: false,
      existing: { count: 2, minutes: 40 },
      minutes: 20,
    });
    assert.deepEqual(fine, { violations: [], action: null });
    assert.throws(
      () => parsePolicyInput({ school_level: 'MN', grade: 13, blocked_weekdays: [0], action: 'stop' }),
      (error: unknown) => {
        const details = (error as { details: Array<{ field: string }> }).details.map((detail) => detail.field);
        return ['school_level', 'grade', 'blocked_weekdays', 'action'].every((field) => details.includes(field));
      },
    );
    assert.deepEqual(
      parsePolicyInput({ school_level: 'TH', grade: 1, no_homework: true, blocked_weekdays: [7, 6, 7] }),
      {
        school_level: 'TH',
        grade: 1,
        no_homework: true,
        max_items_per_day: null,
        max_minutes_per_day: null,
        blocked_weekdays: [6, 7],
        skip_holidays: false,
        action: 'warn',
        basis: null,
      },
    );
  });

  it('CT-28f-3: hạn là đầu tiết kế tiếp của môn; không có tiết thì 7 giờ sáng sau 7 ngày; lịch 7 ngày theo ngày đến hạn', () => {
    const next = nextLessonDue('2026-11-02', [
      { date: '2026-11-05', period_no: 3, start_time: '09:00' },
      { date: '2026-11-04', period_no: 2, start_time: '07:50' },
      { date: '2026-11-02', period_no: 5, start_time: '10:00' },
    ]);
    assert.equal(next.basis, 'next_lesson');
    assert.equal(next.due_at.toISOString(), '2026-11-04T00:50:00.000Z');
    const fallback = nextLessonDue('2026-11-02', []);
    assert.equal(fallback.basis, 'default');
    assert.equal(fallback.due_at.toISOString(), '2026-11-09T00:00:00.000Z');
    const days = workloadDays('2026-11-02', [
      {
        activity_id: 'a',
        title: 'Toán',
        subject_name: 'Toán',
        due_at: new Date('2026-11-03T00:50:00Z'),
        minutes: 20,
        released: true,
      },
      // 23:30 ngày 3 giờ Việt Nam là ngày 3
      {
        activity_id: 'b',
        title: 'Văn',
        subject_name: 'Ngữ văn',
        due_at: new Date('2026-11-03T16:30:00Z'),
        minutes: 15,
        released: true,
      },
      {
        activity_id: 'c',
        title: 'Bài đang soạn',
        subject_name: 'Toán',
        due_at: new Date('2026-11-03T02:00:00Z'),
        minutes: 30,
        released: false,
      },
    ]);
    assert.equal(days.length, 7);
    assert.equal(days[1]?.date, '2026-11-03');
    assert.equal(days[1]?.count, 2);
    assert.equal(days[1]?.minutes, 35);
    assert.equal(days[1]?.items.length, 3, 'bài đang soạn hiện trong lịch nhưng không tính vào tổng');
    assert.equal(days[0]?.items.length, 0);
    assert.equal(
      homeworkStatus({ excused: false, latest: null, dueAt: new Date('2026-11-01'), now: new Date('2026-11-02') }),
      'overdue',
    );
    assert.equal(homeworkStatus({ excused: true, latest: null, dueAt: null, now: new Date() }), 'excused');
    assert.equal(homeworkStatus({ excused: false, latest: 'returned', dueAt: null, now: new Date() }), 'returned');
  });

  it('CT-28f-4: nhắc có giờ yên lặng 21:00 đến 6:00, sắp đến hạn từ giờ nhắc hôm trước, gộp nhiều bài một em, không nhắc lại', () => {
    const base: ReminderCandidate = {
      assignment_id: 'a1',
      child_id: 'c1',
      title: 'Toán trang 12',
      due_at: new Date('2026-11-04T00:50:00Z'),
      released_at: new Date('2026-11-03T03:00:00Z'),
      excused: false,
      submitted: false,
      returned_at: null,
      sent: [],
    };
    const second = { ...base, assignment_id: 'a2', title: 'Văn đoạn văn' };
    // 21:30 ngày 3 giờ Việt Nam: giờ yên lặng
    assert.equal(inQuietHours(new Date('2026-11-03T14:30:00Z')), true);
    assert.deepEqual(planReminders(new Date('2026-11-03T14:30:00Z'), '19:00', [base, second]), []);
    // 18:00 ngày 3: mới giao, chưa tới giờ nhắc sắp đến hạn
    const early = planReminders(new Date('2026-11-03T11:00:00Z'), '19:00', [base, second]);
    assert.deepEqual(
      early.map((item) => [item.kind, item.items.length]),
      [['assigned', 2]],
    );
    // 19:30 ngày 3: đã nhắc "đã giao", nhắc sắp đến hạn gộp hai bài; em được miễn không nhắc
    const evening = planReminders(new Date('2026-11-03T12:30:00Z'), '19:00', [
      { ...base, sent: ['assigned'] },
      { ...second, sent: ['assigned'] },
      { ...base, assignment_id: 'a3', child_id: 'c2', excused: true },
    ]);
    assert.deepEqual(
      evening.map((item) => [item.kind, item.child_id, item.items.map((entry) => entry.assignment_id)]),
      [['due_soon', 'c1', ['a1', 'a2']]],
    );
    // 8:00 ngày 4 (quá hạn 7:50): chưa nộp thì nhắc; đã nộp thì không; đã trả thì nhắc đã trả
    const morning = planReminders(new Date('2026-11-04T01:00:00Z'), '19:00', [
      { ...base, sent: ['assigned', 'due_soon'] },
      { ...second, sent: ['assigned', 'due_soon'], submitted: true },
      {
        ...base,
        assignment_id: 'a4',
        sent: ['assigned'],
        submitted: true,
        returned_at: new Date('2026-11-04T00:30:00Z'),
      },
    ]);
    assert.deepEqual(morning.map((item) => item.kind).sort(), ['missing', 'returned']);
    const text = reminderText(evening[0] ?? { kind: 'due_soon', child_id: 'c1', items: [] }, 'Học sinh An');
    assert.equal(text.title, 'Học sinh An có 2 bài về nhà đến hạn ngày mai');
    assert.equal(text.body, 'Toán trang 12; Văn đoạn văn');
  });
});
