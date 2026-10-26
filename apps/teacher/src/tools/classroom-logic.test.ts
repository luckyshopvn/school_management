import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatClock,
  groupCount,
  isSnapshotExpired,
  pickStudent,
  remainingMilliseconds,
  shuffle,
  splitIntoGroups,
  tallyScores,
  type RosterStudent,
  type ScoreEvent,
} from './classroom-logic.ts';

// Công cụ lớp học (DT-23 phần 23b, YCTD-212): phần thuần chạy với nguồn ngẫu nhiên cố định. Học sinh là dữ liệu giả
const students: RosterStudent[] = Array.from({ length: 10 }, (_, index) => ({
  id: `hs-${index + 1}`,
  order_no: index + 1,
  full_name: `Học sinh ${index + 1}`,
  code: `M${index + 1}`,
}));

// Bộ sinh giả lập (tuyến tính, cố định) để kết quả lặp lại được
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('CT-23b-1: gọi tên ngẫu nhiên', () => {
  it('không lặp thì gọi hết mọi học sinh đúng một lần rồi báo hết', () => {
    const random = seeded(7);
    const called = new Set<string>();
    let exhausted = false;
    for (let round = 0; round < students.length; round += 1) {
      const result = pickStudent(students, called, new Set(), { noRepeat: true, excludeAbsent: false }, random);
      assert.ok(result.student);
      assert.ok(!called.has(result.student.id), 'không gọi lại người đã gọi');
      called.add(result.student.id);
      exhausted = result.exhausted;
    }
    assert.equal(called.size, students.length);
    assert.equal(exhausted, true, 'lần gọi cuối báo hết');
    const after = pickStudent(students, called, new Set(), { noRepeat: true, excludeAbsent: false }, random);
    assert.deepEqual(after, { student: null, exhausted: true });
  });

  it('cho lặp thì không bao giờ hết; loại học sinh vắng thì không gọi em vắng', () => {
    const random = seeded(11);
    const absent = new Set(['hs-1', 'hs-2', 'hs-3']);
    const seen = new Set<string>();
    for (let round = 0; round < 200; round += 1) {
      const result = pickStudent(
        students,
        new Set(students.map((student) => student.id)),
        absent,
        {
          noRepeat: false,
          excludeAbsent: true,
        },
        random,
      );
      assert.ok(result.student);
      assert.equal(result.exhausted, false);
      assert.ok(!absent.has(result.student.id));
      seen.add(result.student.id);
    }
    assert.equal(seen.size, 7, 'mọi em có mặt đều có lúc được gọi');
  });

  it('lớp chỉ còn học sinh vắng, hoặc lớp trống, thì báo hết', () => {
    const random = seeded(1);
    const everyone = new Set(students.map((student) => student.id));
    assert.deepEqual(pickStudent(students, new Set(), everyone, { noRepeat: false, excludeAbsent: true }, random), {
      student: null,
      exhausted: true,
    });
    assert.deepEqual(pickStudent([], new Set(), new Set(), { noRepeat: false, excludeAbsent: false }, random), {
      student: null,
      exhausted: true,
    });
  });

  it('nguồn ngẫu nhiên sát 1 vẫn trong khoảng', () => {
    const result = pickStudent(
      students,
      new Set(),
      new Set(),
      { noRepeat: false, excludeAbsent: false },
      () => 0.9999999,
    );
    assert.equal(result.student?.id, 'hs-10');
  });
});

describe('CT-23b-2: chia nhóm ngẫu nhiên', () => {
  it('chia theo số nhóm: mọi học sinh vào đúng một nhóm, các nhóm chênh nhau tối đa một người', () => {
    const groups = splitIntoGroups(students, { by: 'count', value: 3 }, seeded(5));
    assert.equal(groups.length, 3);
    assert.deepEqual(
      groups.map((group) => group.name),
      ['Nhóm 1', 'Nhóm 2', 'Nhóm 3'],
    );
    const members = groups.flatMap((group) => group.child_ids);
    assert.equal(new Set(members).size, students.length);
    assert.equal(members.length, students.length);
    const sizes = groups.map((group) => group.child_ids.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `kích thước ${sizes.join(',')}`);
  });

  it('chia theo số người mỗi nhóm lấy tròn lên; không vượt số học sinh, ít nhất một nhóm', () => {
    assert.equal(groupCount(10, { by: 'size', value: 4 }), 3);
    assert.equal(groupCount(10, { by: 'count', value: 50 }), 10);
    assert.equal(groupCount(10, { by: 'count', value: 0 }), 1);
    assert.equal(groupCount(0, { by: 'count', value: 3 }), 0);
    assert.deepEqual(splitIntoGroups([], { by: 'count', value: 3 }, seeded(1)), []);
  });

  it('chia lại cho kết quả khác nhưng vẫn đủ người; xáo trộn không đổi dữ liệu gốc', () => {
    const original = students.map((student) => student.id);
    const first = shuffle(students, seeded(1)).map((student) => student.id);
    const second = shuffle(students, seeded(2)).map((student) => student.id);
    assert.notDeepEqual(first, second);
    assert.deepEqual([...first].sort(), [...original].sort());
    assert.deepEqual(
      students.map((student) => student.id),
      original,
    );
  });
});

describe('CT-23b-3: bảng điểm nhanh', () => {
  const event = (key: string, delta: number, confirmed = false, kind: 'group' | 'student' = 'group'): ScoreEvent => ({
    client_id: `${key}-${delta}-${Math.random()}`,
    target_kind: kind,
    key,
    delta,
    occurred_at: '2026-10-26T01:00:00.000Z',
    confirmed,
  });

  it('cộng dồn theo nhóm và học sinh; phần chưa chuyển vào nề nếp tách riêng', () => {
    const totals = tallyScores([
      event('Nhóm 1', 2),
      event('Nhóm 1', 3, true),
      event('Nhóm 2', -1),
      event('hs-4', 1, false, 'student'),
    ]);
    const find = (kind: string, key: string) => totals.find((total) => total.target_kind === kind && total.key === key);
    assert.deepEqual(find('group', 'Nhóm 1'), { target_kind: 'group', key: 'Nhóm 1', total: 5, pending: 2 });
    assert.deepEqual(find('group', 'Nhóm 2'), { target_kind: 'group', key: 'Nhóm 2', total: -1, pending: -1 });
    assert.deepEqual(find('student', 'hs-4'), { target_kind: 'student', key: 'hs-4', total: 1, pending: 1 });
    assert.deepEqual(tallyScores([]), []);
  });
});

describe('CT-23b-4: hạn bản chụp danh sách lớp và đồng hồ', () => {
  const saved = '2026-10-26T01:00:00.000Z';
  it('hết hạn đúng sau số giờ cấu hình; thời điểm lưu hỏng coi là hết hạn', () => {
    assert.equal(isSnapshotExpired(saved, 24, new Date('2026-10-27T00:59:59.000Z')), false);
    assert.equal(isSnapshotExpired(saved, 24, new Date('2026-10-27T01:00:00.000Z')), true);
    assert.equal(isSnapshotExpired(saved, 1, new Date('2026-10-26T02:00:00.000Z')), true);
    assert.equal(isSnapshotExpired('không phải ngày', 24, new Date(saved)), true);
  });

  it('đếm ngược theo thời điểm kết thúc tuyệt đối: tạm dừng màn hình rồi mở lại vẫn đúng, không âm', () => {
    assert.equal(remainingMilliseconds(10_000, 4_000), 6_000);
    assert.equal(remainingMilliseconds(10_000, 12_000), 0);
    assert.equal(formatClock(61_000, true), '01:01');
    assert.equal(formatClock(59_001, true), '01:00');
    assert.equal(formatClock(59_999, false), '00:59');
    assert.equal(formatClock(3_661_000, false), '1:01:01');
    assert.equal(formatClock(-5, true), '00:00');
  });
});
