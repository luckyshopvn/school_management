import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentLesson, vietnamClock, type PeriodSlot, type TimetableLesson } from './classroom-mode-logic.ts';

const SLOTS: PeriodSlot[] = [
  { period_no: 1, start_time: '07:00', end_time: '07:45' },
  { period_no: 2, start_time: '07:50', end_time: '08:35' },
  { period_no: 3, start_time: '08:55', end_time: '09:40' },
];
const LESSONS: TimetableLesson[] = [
  { class_name: '6A1', weekday: 1, period_no: 3, subject_name: 'Toán' },
  { class_name: '6A2', weekday: 1, period_no: 1, subject_name: 'Toán' },
  { class_name: '7B1', weekday: 2, period_no: 2, subject_name: 'Tin học' },
];

describe('chọn tiết đang dạy cho chế độ lớp học (26d)', () => {
  it('đang trong giờ tiết thì chọn tiết đó', () => {
    const found = currentLesson(LESSONS, SLOTS, { weekday: 1, minutes: 7 * 60 + 10 });
    assert.equal(found?.lesson.class_name, '6A2');
    assert.equal(found?.when, 'now');
  });

  it('giữa hai tiết thì chọn tiết sắp tới, sắp theo giờ chứ không theo thứ tự dữ liệu', () => {
    const found = currentLesson(LESSONS, SLOTS, { weekday: 1, minutes: 8 * 60 + 40 });
    assert.equal(found?.lesson.class_name, '6A1');
    assert.equal(found?.when, 'next');
    assert.equal(currentLesson(LESSONS, SLOTS, { weekday: 1, minutes: 6 * 60 })?.lesson.class_name, '6A2');
  });

  it('hết tiết trong ngày, ngày không có tiết, tiết thiếu giờ thì không chọn', () => {
    assert.equal(currentLesson(LESSONS, SLOTS, { weekday: 1, minutes: 10 * 60 }), undefined);
    assert.equal(currentLesson(LESSONS, SLOTS, { weekday: 7, minutes: 8 * 60 }), undefined);
    assert.equal(currentLesson(LESSONS, [], { weekday: 1, minutes: 7 * 60 + 10 }), undefined);
  });

  it('giờ theo múi giờ Việt Nam, thứ Hai là 1', () => {
    // 2026-10-26 là thứ Hai; 00:30 giờ quốc tế là 07:30 giờ Việt Nam
    assert.deepEqual(vietnamClock(new Date('2026-10-26T00:30:00Z')), { weekday: 1, minutes: 7 * 60 + 30 });
    // 2026-10-25 20:00 giờ quốc tế đã sang thứ Hai 03:00 ở Việt Nam
    assert.deepEqual(vietnamClock(new Date('2026-10-25T20:00:00Z')), { weekday: 1, minutes: 3 * 60 });
  });
});
