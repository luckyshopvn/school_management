import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FieldError } from '@school-management/server';
import { attendanceOf, parseBreakoutRequest, parseLiveSettings, splitRandom, teacherWatching } from './live-rules.js';

// Quy tắc thuần của giờ học trực tuyến, phòng chia nhỏ (DT-28 phần 28g, YCTD-277)
const at = (minute: number) => new Date(Date.UTC(2026, 9, 28, 1, minute));

test('CT-28g-1: thời lượng giờ học mặc định 45 phút, ngoài khoảng 5 đến 240 phút thì báo lỗi', () => {
  const errors: FieldError[] = [];
  assert.deepEqual(parseLiveSettings(undefined, 'settings', errors), { duration_minutes: 45 });
  assert.deepEqual(parseLiveSettings({ duration_minutes: 60 }, 'settings', errors), { duration_minutes: 60 });
  assert.equal(errors.length, 0);
  parseLiveSettings({ duration_minutes: 300 }, 'settings', errors);
  parseLiveSettings({ duration_minutes: 2.5 }, 'settings', errors);
  assert.deepEqual(
    errors.map((error) => error.field),
    ['settings.duration_minutes', 'settings.duration_minutes'],
  );
});

test('CT-28g-2: điểm danh gợi ý từ nhật ký vào ra, gộp cả phòng chia nhỏ', () => {
  const rows = attendanceOf(
    ['a', 'b', 'c'],
    [
      { identity: 's:a', kind: 'join', at: at(0) },
      { identity: 's:a', kind: 'leave', at: at(20) },
      { identity: 's:a', kind: 'join', at: at(22) },
      { identity: 's:a', kind: 'leave', at: at(40) },
      { identity: 's:b', kind: 'join', at: at(30) },
      { identity: 's:b', kind: 'leave', at: at(40) },
      { identity: 'h:giao-vien', kind: 'join', at: at(0) },
    ],
    at(45),
    45,
  );
  assert.deepEqual(
    rows.map((row) => [row.child_id, row.minutes, row.suggestion]),
    [
      ['a', 38, 'present'],
      ['b', 10, 'partial'],
      ['c', 0, 'absent'],
    ],
  );
  assert.deepEqual(rows[0]?.first_join, at(0));
});

test('CT-28g-3: chia ngẫu nhiên có hạt cho cùng kết quả, mỗi học sinh đúng một phòng, số người lệch tối đa một', () => {
  const children = Array.from({ length: 11 }, (_, index) => `hs-${index}`);
  const first = splitRandom(children, 3, 42);
  assert.deepEqual(first, splitRandom(children, 3, 42));
  assert.notDeepEqual(first, splitRandom(children, 3, 43));
  assert.deepEqual([...first.flat()].sort(), [...children].sort());
  const sizes = first.map((room) => room.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test('CT-28g-4: yêu cầu chia phòng cần bộ nhóm hoặc số phòng hợp lệ và thời lượng', () => {
  assert.deepEqual(parseBreakoutRequest({ count: 2, minutes: 10, seed: 7 }, 6), {
    count: 2,
    groupSetId: null,
    minutes: 10,
    seed: 7,
    errors: [],
  });
  assert.equal(parseBreakoutRequest({ group_set_id: 'bo-nhom', minutes: 5 }, 6).count, null);
  assert.deepEqual(
    parseBreakoutRequest({ count: 1, minutes: 0 }, 6).errors.map((error) => error.field),
    ['count', 'minutes'],
  );
  assert.equal(parseBreakoutRequest({ count: 7, minutes: 5 }, 6).errors[0]?.field, 'count');
});

test('CT-28g-5: học sinh thấy "giáo viên đang xem" khi chủ phòng hoặc người xem còn trong phòng', () => {
  assert.equal(teacherWatching([{ role: 'student', left_at: null }]), false);
  assert.equal(teacherWatching([{ role: 'observer', left_at: at(5) }]), false);
  assert.equal(teacherWatching([{ role: 'host', left_at: null }]), true);
});
