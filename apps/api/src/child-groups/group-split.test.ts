import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findViolations,
  groupCount,
  nextLeader,
  pickLeader,
  seededRandom,
  splitStudents,
  timetableGroups,
  type SplitOptions,
  type SplitStudent,
} from './group-split.js';

// Hàm chia nhóm thuần của bộ nhóm (DT-28 phần 28a, YCTD-271)
const students = (count: number, ability?: (index: number) => number | null): SplitStudent[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `hs-${String(index + 1).padStart(2, '0')}`,
    gender: index % 2 === 0 ? 'male' : 'female',
    ability: ability ? ability(index) : null,
  }));

const options = (patch: Partial<SplitOptions>): SplitOptions => ({
  method: 'random',
  mode: { by: 'count', value: 4 },
  seed: 7,
  balanceGender: false,
  apart: [],
  together: [],
  ...patch,
});

const sizes = (groups: string[][]) => groups.map((group) => group.length).sort((a, b) => a - b);

describe('Chia nhóm của bộ nhóm', () => {
  it('CT-28a-1: số nhóm theo số nhóm hoặc số người; ngẫu nhiên có hạt lặp lại được, mỗi học sinh đúng một nhóm', () => {
    assert.equal(groupCount(0, { by: 'count', value: 4 }), 0);
    assert.equal(groupCount(3, { by: 'count', value: 6 }), 3);
    assert.equal(groupCount(31, { by: 'size', value: 4 }), 8);
    assert.equal(groupCount(500, { by: 'size', value: 1 }), 50, 'tối đa 50 nhóm');

    const pool = students(31);
    const first = splitStudents(pool, options({}));
    const again = splitStudents(pool, options({}));
    assert.deepEqual(first, again, 'cùng hạt cùng kết quả');
    assert.notDeepEqual(splitStudents(pool, options({ seed: 8 })).groups, first.groups, 'hạt khác cho bản chia khác');
    assert.deepEqual(sizes(first.groups), [7, 8, 8, 8]);
    assert.deepEqual(first.groups.flat().sort(), pool.map((student) => student.id).sort());
    assert.deepEqual(splitStudents([], options({})), { groups: [], violations: [] });
    const a = seededRandom(1)();
    assert.ok(a >= 0 && a < 1);
  });

  it('CT-28a-2: trộn năng lực cho tổng năng lực các nhóm gần nhau; gom tầng xếp giỏi vào cùng nhóm', () => {
    const pool = students(24, (index) => 10 - (index % 12) * 0.5);
    const mixed = splitStudents(pool, options({ method: 'ability_mixed' }));
    const totals = mixed.groups.map((group) =>
      group.reduce((total, id) => total + (pool.find((student) => student.id === id)?.ability ?? 0), 0),
    );
    assert.ok(Math.max(...totals) - Math.min(...totals) <= 2, `tổng năng lực lệch ít: ${totals.join(', ')}`);
    assert.deepEqual(sizes(mixed.groups), [6, 6, 6, 6]);

    const tiered = splitStudents(pool, options({ method: 'ability_tiered' }));
    const abilityOf = (id: string) => pool.find((student) => student.id === id)?.ability ?? 0;
    const minima = tiered.groups.map((group) => Math.min(...group.map(abilityOf)));
    const maxima = tiered.groups.map((group) => Math.max(...group.map(abilityOf)));
    for (let index = 1; index < tiered.groups.length; index += 1) {
      assert.ok((maxima[index] as number) <= (minima[index - 1] as number), 'tầng sau không giỏi hơn tầng trước');
    }
    assert.deepEqual(sizes(tiered.groups), [6, 6, 6, 6]);

    // Học sinh chưa có điểm vẫn được chia, xếp sau người đã có điểm ở gom tầng
    const partial = students(8, (index) => (index < 4 ? 9 - index : null));
    const partialTiered = splitStudents(
      partial,
      options({ method: 'ability_tiered', mode: { by: 'count', value: 2 } }),
    );
    assert.deepEqual([...(partialTiered.groups[0] as string[])].sort(), ['hs-01', 'hs-02', 'hs-03', 'hs-04']);
  });

  it('CT-28a-3: cân bằng giới: mỗi nhóm chênh nhau không quá một bạn cùng giới', () => {
    const pool = students(20);
    const result = splitStudents(pool, options({ method: 'gender_balanced', mode: { by: 'count', value: 5 } }));
    const males = result.groups.map(
      (group) => group.filter((id) => pool.find((student) => student.id === id)?.gender === 'male').length,
    );
    assert.ok(Math.max(...males) - Math.min(...males) <= 1, males.join(', '));
  });

  it('CT-28a-4: ràng buộc cùng nhóm luôn giữ; không cùng nhóm được tách khi còn cách, không tách được thì báo', () => {
    const pool = students(12);
    const result = splitStudents(
      pool,
      options({
        apart: [
          ['hs-01', 'hs-02'],
          ['hs-03', 'hs-04'],
        ],
        together: [
          ['hs-05', 'hs-06'],
          ['hs-06', 'hs-07'],
        ],
      }),
    );
    assert.deepEqual(result.violations, []);
    const groupOf = (id: string) => result.groups.findIndex((group) => group.includes(id));
    assert.notEqual(groupOf('hs-01'), groupOf('hs-02'));
    assert.equal(groupOf('hs-05'), groupOf('hs-07'));
    const impossible = splitStudents(
      students(2),
      options({ mode: { by: 'count', value: 1 }, apart: [['hs-01', 'hs-02']] }),
    );
    assert.deepEqual(impossible.violations, [{ kind: 'apart', child_ids: ['hs-01', 'hs-02'] }]);
    assert.deepEqual(findViolations([['a'], ['b']], { apart: [], together: [['a', 'b']] }), [
      { kind: 'together', child_ids: ['a', 'b'] },
    ]);
  });

  it('CT-28a-5: nhóm trưởng ngẫu nhiên trong nhóm, luân phiên theo thứ tự rồi quay về đầu', () => {
    assert.equal(pickLeader([], seededRandom(1)), null);
    assert.ok(['a', 'b', 'c'].includes(pickLeader(['a', 'b', 'c'], seededRandom(3)) as string));
    assert.equal(nextLeader(['a', 'b', 'c'], null), 'a');
    assert.equal(nextLeader(['a', 'b', 'c'], 'b'), 'c');
    assert.equal(nextLeader(['a', 'b', 'c'], 'c'), 'a');
    assert.equal(nextLeader(['a', 'b'], 'đã chuyển lớp'), 'a');
  });

  it('CT-28a-6: bộ nhóm từ tiết nhóm 21b theo tổ hợp môn; học sinh học nhiều môn nhóm có ở nhiều nhóm', () => {
    const groups = timetableGroups(
      [
        { group_no: 0, subject_id: 'toan', subject_name: 'Toán' },
        { group_no: 1, subject_id: 'ly', subject_name: 'Vật lí' },
        { group_no: 2, subject_id: 'su', subject_name: 'Lịch sử' },
        { group_no: 1, subject_id: 'hoa', subject_name: 'Hóa học' },
      ],
      [
        { id: 'hs-a', subject_ids: new Set(['ly', 'hoa']) },
        { id: 'hs-b', subject_ids: new Set(['su']) },
        { id: 'hs-c', subject_ids: new Set(['hoa', 'su']) },
        { id: 'hs-d', subject_ids: new Set() },
      ],
    );
    assert.deepEqual(groups, [
      { name: 'Nhóm 1: Hóa học, Vật lí', group_no: 1, child_ids: ['hs-a', 'hs-c'] },
      { name: 'Nhóm 2: Lịch sử', group_no: 2, child_ids: ['hs-b', 'hs-c'] },
    ]);
  });
});
