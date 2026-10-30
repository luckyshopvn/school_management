import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeMathDelimiters, remainingPercent } from './ai-tutor-math.ts';

// Chuẩn hóa công thức và thanh số lượt của gia sư AI (YCTD-383 lát L2)
describe('Gia sư AI: hiển thị công thức', () => {
  it('đổi \\( \\) thành $ $ và \\[ \\] thành khối $$', () => {
    assert.equal(normalizeMathDelimiters('Ta có \\( x + 1 \\) nhé'), 'Ta có $x + 1$ nhé');
    assert.equal(normalizeMathDelimiters('Xét \\[ a^2 + b^2 = c^2 \\]'), 'Xét \n$$\na^2 + b^2 = c^2\n$$\n');
  });

  it('giữ nguyên chữ đã đúng dạng và khối chưa đóng', () => {
    assert.equal(normalizeMathDelimiters('Đã đúng $x = 2$'), 'Đã đúng $x = 2$');
    assert.equal(normalizeMathDelimiters('Chưa đóng \\( x + 1'), 'Chưa đóng \\( x + 1');
  });

  it('phần trăm lượt còn lại nằm trong 0 đến 100', () => {
    assert.equal(remainingPercent(62, 100), 62);
    assert.equal(remainingPercent(5, 0), 0);
    assert.equal(remainingPercent(120, 100), 100);
  });
});
