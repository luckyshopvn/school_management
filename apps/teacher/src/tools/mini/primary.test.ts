import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  circleSlice,
  clockHandAngles,
  fractionProblem,
  minutesFromAngle,
  multiplicationQuestion,
  multiplicationRows,
  readTime,
  ruledLines,
  simplifyFraction,
} from './primary-logic.ts';

// Mini app Tiểu học của Hộp công cụ giảng dạy (DT-29 phần 29c, YCTD-327)
describe('Mini app Tiểu học', () => {
  it('CT-29c-1: bảng cửu chương: mười dòng của bảng, câu hỏi trong bảng hoặc trộn bảng 2 đến 9', () => {
    assert.deepEqual(multiplicationRows(7)[7], { right: 8, product: 56 });
    assert.equal(multiplicationRows(9).length, 10);
    assert.deepEqual(
      multiplicationQuestion(6, () => 0.99),
      { left: 6, right: 10 },
    );
    assert.deepEqual(
      multiplicationQuestion(null, () => 0),
      { left: 2, right: 1 },
    );
    assert.equal(multiplicationQuestion(null, () => 0.99).left, 9);
  });

  it('CT-29c-2: đồng hồ kim: góc kim, phút theo bước khi kéo, đọc giờ theo cách nói ở lớp', () => {
    assert.deepEqual(clockHandAngles(3, 0), { hour: 90, minute: 0 });
    assert.deepEqual(clockHandAngles(7, 30), { hour: 225, minute: 180 });
    assert.equal(minutesFromAngle(92, 15), 15);
    assert.equal(minutesFromAngle(-3, 5), 0);
    assert.equal(minutesFromAngle(357, 1), 0);
    assert.equal(readTime(7, 0), '7 giờ');
    assert.equal(readTime(0, 15), '12 giờ 15 phút');
    assert.equal(readTime(7, 30), '7 giờ rưỡi');
    assert.equal(readTime(7, 45, 'before'), '8 giờ kém 15 phút');
    assert.equal(readTime(11, 50, 'before'), '12 giờ kém 10 phút');
    assert.equal(readTime(7, 45), '7 giờ 45 phút');
  });

  it('CT-29c-3: phân số: kiểm tử, mẫu; tối giản; hình tròn chia phần; kẻ ô li có dòng đậm mỗi bốn ô', () => {
    assert.equal(fractionProblem(3, 4), null);
    assert.ok(fractionProblem(5, 4));
    assert.ok(fractionProblem(1, 0));
    assert.ok(fractionProblem(1, 13));
    assert.deepEqual(simplifyFraction(6, 8), [3, 4]);
    assert.deepEqual(simplifyFraction(0, 5), [0, 1]);
    assert.match(circleSlice(0, 1), /^M 50 5 A/);
    assert.equal(circleSlice(0, 4), 'M 50 50 L 50.00 5.00 A 45 45 0 0 1 95.00 50.00 Z');
    const lines = ruledLines(40, 20, 2.5);
    const horizontal = lines.filter((line) => line.y1 === line.y2);
    assert.equal(horizontal.length, 7);
    assert.deepEqual(
      horizontal.filter((line) => line.bold).map((line) => line.y1),
      [10],
    );
    assert.equal(lines.filter((line) => line.x1 === line.x2).length, 3);
  });
});
