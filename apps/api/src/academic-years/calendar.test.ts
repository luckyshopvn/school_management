import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateWeeks, parseCalendar } from './calendar.js';

// Kiểm thử đơn vị cho lịch năm học (BR-91)
const calendarBody = {
  first_term: { start_date: '2026-09-05', end_date: '2027-01-15' },
  second_term: { start_date: '2027-01-18', end_date: '2027-05-25' },
  summer_term: { start_date: '2027-06-01', end_date: '2027-07-31' },
  school_days_of_week: [1, 2, 3, 4, 5],
};

describe('Lịch năm học', () => {
  it('CTC-P01-099: đánh số tuần liên tục từ tuần chứa 05/09/2026 đến hết kỳ hè', () => {
    const { calendar, errors } = parseCalendar(calendarBody);
    assert.deepEqual(errors, []);
    assert.ok(calendar);
    const weeks = generateWeeks(calendar);
    assert.deepEqual(weeks[0], { week_no: 1, start_date: '2026-08-31', end_date: '2026-09-06' });
    const last = weeks.at(-1);
    assert.ok(last && last.start_date <= '2027-07-31' && last.end_date >= '2027-07-31');
    weeks.forEach((week, index) => assert.equal(week.week_no, index + 1));
    const tetWeek = weeks.find((week) => week.start_date <= '2027-02-08' && week.end_date >= '2027-02-08');
    assert.equal(tetWeek?.start_date, '2027-02-08');
  });

  it('CTC-P01-100: học kỳ 1 kết thúc sau ngày bắt đầu học kỳ 2 bị từ chối', () => {
    const { errors } = parseCalendar({
      ...calendarBody,
      first_term: { start_date: '2026-09-05', end_date: '2027-01-20' },
    });
    assert.ok(errors.some((error) => error.field === 'second_term.start_date'));
  });

  it('CTC-P01-101: kỳ hè bắt đầu trước khi học kỳ 2 kết thúc bị từ chối', () => {
    const { errors } = parseCalendar({
      ...calendarBody,
      summer_term: { start_date: '2027-05-20', end_date: '2027-07-31' },
    });
    assert.ok(errors.some((error) => error.field === 'summer_term.start_date'));
  });

  it('Không có kỳ hè thì năm học kết thúc ở học kỳ 2; mặc định học thứ hai đến thứ sáu', () => {
    const { calendar } = parseCalendar({ first_term: calendarBody.first_term, second_term: calendarBody.second_term });
    assert.ok(calendar);
    assert.deepEqual(calendar.school_days_of_week, [1, 2, 3, 4, 5]);
    assert.ok((generateWeeks(calendar).at(-1)?.end_date ?? '') >= '2027-05-25');
  });

  it('Ngày sai định dạng, ngày không tồn tại, ngày học ngoài 1 đến 7 bị từ chối', () => {
    const { errors } = parseCalendar({
      first_term: { start_date: '05/09/2026', end_date: '2027-02-30' },
      second_term: calendarBody.second_term,
      school_days_of_week: [0, 8],
    });
    const fields = errors.map((error) => error.field);
    assert.ok(fields.includes('first_term.start_date'));
    assert.ok(fields.includes('first_term.end_date'));
    assert.ok(fields.includes('school_days_of_week'));
  });
});
