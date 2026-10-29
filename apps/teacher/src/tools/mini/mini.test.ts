import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changeStars,
  DICE_PIPS,
  drawNumber,
  noiseLight,
  noiseThreshold,
  numberRangeProblem,
  remainingArc,
  remainingFraction,
  rollDice,
  rootMeanSquare,
  VIETNAMESE_LETTERS,
} from './mini-logic.ts';

// Mini app chung và Mầm non của Hộp công cụ giảng dạy (DT-29 phần 29b, YCTD-326)
describe('Mini app chung và Mầm non', () => {
  it('CT-29b-1: xúc xắc một đến ba con, mặt 1 đến 6 có đủ chấm; bốc số không lặp đến khi hết', () => {
    const sequence = [0, 0.99, 0.5];
    let position = 0;
    const random = () => sequence[position++ % sequence.length] ?? 0;
    assert.deepEqual(rollDice(3, random), [1, 6, 4]);
    assert.equal(rollDice(9, random).length, 3);
    for (let face = 1; face <= 6; face += 1) {
      assert.equal(DICE_PIPS[face]?.length, face);
    }
    const state = { min: 1, max: 3, drawn: [] as number[] };
    for (let round = 0; round < 3; round += 1) {
      const value = drawNumber(state, true);
      assert.ok(value !== null && !state.drawn.includes(value));
      state.drawn.push(value);
    }
    assert.equal(drawNumber(state, true), null);
    assert.ok(drawNumber(state, false) !== null);
    assert.equal(numberRangeProblem(1, 30), null);
    assert.ok(numberRangeProblem(5, 1));
    assert.ok(numberRangeProblem(1.5, 3));
    assert.ok(numberRangeProblem(0, 20_000));
  });

  it('CT-29b-2: đồng hồ hình ảnh vơi theo thời điểm kết thúc tuyệt đối; đèn trật tự theo độ nhạy', () => {
    assert.equal(remainingFraction(10_000, 10_000, 0), 1);
    assert.equal(remainingFraction(10_000, 10_000, 5_000), 0.5);
    assert.equal(remainingFraction(10_000, 10_000, 20_000), 0);
    assert.equal(remainingArc(0), '');
    assert.match(remainingArc(1), /^M 50 5 A/);
    assert.match(remainingArc(0.25), /A 45 45 0 0 1 95\.00 50\.00 Z$/);
    assert.match(remainingArc(0.75), /A 45 45 0 1 1 5\.00 50\.00 Z$/);
    assert.equal(rootMeanSquare([0.5, -0.5]), 0.5);
    assert.equal(rootMeanSquare([]), 0);
    assert.ok(noiseThreshold(10) < noiseThreshold(1));
    assert.equal(noiseLight(0.01, 5), 'green');
    assert.equal(noiseLight(noiseThreshold(5) * 0.7, 5), 'yellow');
    assert.equal(noiseLight(noiseThreshold(5), 5), 'red');
    // Cùng độ ồn, độ nhạy cao hơn thì đèn đỏ sớm hơn
    assert.equal(noiseLight(0.1, 1), 'green');
    assert.equal(noiseLight(0.1, 10), 'red');
  });

  it('CT-29b-3: bảng sao giữ trong khoảng 0 đến mục tiêu; đủ 29 chữ cái tiếng Việt', () => {
    assert.deepEqual(changeStars([0, 9], 1, 1, 10), [0, 10]);
    assert.deepEqual(changeStars([0, 10], 1, 1, 10), [0, 10]);
    assert.deepEqual(changeStars([0, 10], 0, -1, 10), [0, 10]);
    assert.equal(VIETNAMESE_LETTERS.length, 29);
    assert.equal(new Set(VIETNAMESE_LETTERS).size, 29);
    assert.ok(VIETNAMESE_LETTERS.includes('Đ') && VIETNAMESE_LETTERS.includes('Ư'));
    assert.equal(VIETNAMESE_LETTERS.includes('F'), false);
  });
});
