import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { foldVietnamese, scanContactInfo } from '@school-management/shared';
import {
  calendarStart,
  guardianGroupView,
  isOpenNow,
  openHoursOf,
  questionPending,
  studentCanSee,
  weekCalendar,
} from './discussion-rules.js';

// Quy tắc thuần của giao tiếp trong lớp và nhóm (DT-28 phần 28e, YCTD-275) và hàm lọc thông tin liên lạc dùng chung. Dữ liệu là giả
describe('Quy tắc thảo luận, không gian nhóm, lịch học tập', () => {
  it('CT-28e-1: lọc che số điện thoại, thư điện tử, liên kết, mạng xã hội, từ ngữ của trường (không phân biệt dấu, hoa thường)', () => {
    const result = scanContactInfo(
      'Gọi mình 0912 345 678 hoặc +84912345678, mail ban.a@example.com, vào https://trang.example/x, zalo: banA, @ban_a_123, xem hocbai.vn. Đồ NGỐC!',
      ['đồ ngốc'],
    );
    assert.equal(result.masked, 'Gọi mình *** hoặc ***, mail ***, vào ***, ***, ***, xem ***. ***!');
    assert.deepEqual([...new Set(result.findings.map((finding) => finding.kind))].sort(), [
      'email',
      'link',
      'phone',
      'social',
      'word',
    ]);
    assert.deepEqual(scanContactInfo('Bài 3 có 12 câu, làm trong 45 phút').findings, []);
    assert.equal(foldVietnamese('Đồ Ngốc'), 'do ngoc');
    assert.deepEqual(scanContactInfo('Nguyễn Văn An', ['ngu']).findings, [], 'chỉ khớp nguyên từ');
  });

  it('CT-28e-2: giờ mở theo giờ Việt Nam (ngày học, cuối tuần); chưa cấu hình là luôn mở (GD-144 đã chốt 2026-10-28: trường tự cấu hình)', () => {
    assert.equal(openHoursOf(null), null);
    assert.equal(openHoursOf({ school_days: { from: '6:00', to: '21:00' } }), null, 'giờ sai dạng bị bỏ');
    const hours = openHoursOf({ school_days: { from: '06:00', to: '21:00' }, weekend: { from: '08:00', to: '20:00' } });
    assert.equal(isOpenNow(null, new Date('2026-10-28T20:00:00Z')), true);
    assert.equal(isOpenNow(hours, new Date('2026-10-28T03:00:00Z')), true, 'thứ Tư 10 giờ sáng');
    assert.equal(isOpenNow(hours, new Date('2026-10-28T15:00:00Z')), false, 'thứ Tư 22 giờ');
    assert.equal(isOpenNow(hours, new Date('2026-10-31T00:30:00Z')), false, 'thứ Bảy 7 giờ 30 trước giờ mở cuối tuần');
    assert.equal(isOpenNow(hours, new Date('2026-10-31T02:00:00Z')), true);
  });

  it('CT-28e-3: học sinh không thấy chủ đề đã ẩn, câu hỏi riêng của bạn; câu hỏi chờ quá 48 giờ là quá hạn; phụ huynh xem nhóm theo GD-145', () => {
    assert.equal(studentCanSee({ hidden_at: null, private: false, author_child_id: 'b' }, 'a'), true);
    assert.equal(studentCanSee({ hidden_at: new Date(), private: false, author_child_id: 'a' }, 'a'), false);
    assert.equal(studentCanSee({ hidden_at: null, private: true, author_child_id: 'b' }, 'a'), false);
    assert.equal(studentCanSee({ hidden_at: null, private: true, author_child_id: 'a' }, 'a'), true);
    const now = new Date('2026-10-28T10:00:00Z');
    assert.deepEqual(
      questionPending({ created_at: new Date('2026-10-26T09:00:00Z'), accepted_post_id: null }, false, now),
      { pending: true, overdue: true },
    );
    assert.deepEqual(
      questionPending({ created_at: new Date('2026-10-26T09:00:00Z'), accepted_post_id: null }, true, now).pending,
      false,
    );
    assert.deepEqual(guardianGroupView('TH'), { discussions: true, notes: true });
    assert.deepEqual(guardianGroupView('THCS'), { discussions: false, notes: false });
  });

  it('CT-28e-4: lịch tuần ghép tiết theo thứ, ngày mở và hạn của hoạt động theo giờ Việt Nam, xếp theo ngày giờ', () => {
    assert.equal(calendarStart(undefined, new Date('2026-10-29T03:00:00Z')), '2026-10-26');
    const items = weekCalendar({
      from: '2026-10-26',
      lessons: [
        { weekday: 1, period_no: 2, subject_name: 'Toán', start_time: '07:50:00' },
        { weekday: 1, period_no: 1, subject_name: 'Ngữ văn', start_time: '07:00:00' },
        { weekday: 3, period_no: 1, subject_name: 'Toán', start_time: null },
      ],
      activities: [
        { title: 'Bài tập 1', space: 'Toán - Lớp 7A', due_at: new Date('2026-10-26T16:30:00Z'), opens_at: null },
        { title: 'Bài cũ', space: 'Toán - Lớp 7A', due_at: new Date('2026-10-20T00:00:00Z'), opens_at: null },
      ],
    });
    assert.deepEqual(
      items.map((item) => [item.date, item.kind, item.title, item.time]),
      [
        ['2026-10-26', 'lesson', 'Ngữ văn', '07:00'],
        ['2026-10-26', 'lesson', 'Toán', '07:50'],
        ['2026-10-26', 'due', 'Bài tập 1', '23:30'],
        ['2026-10-28', 'lesson', 'Toán', null],
      ],
    );
  });
});
