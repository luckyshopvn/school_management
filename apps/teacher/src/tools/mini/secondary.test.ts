import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateExpression, ExpressionError, formatResult } from './expression.ts';
import {
  angleAt,
  centroid,
  circumcenter,
  classifyTriangle,
  distance,
  foot,
  orthocenter,
  triangleArea,
} from './geometry.ts';
import { expressionProblem, gridStep, plotPath, toScreen } from './graph-logic.ts';
import { ELEMENTS, findElements } from './periodic-table.ts';
import { convertUnit } from './units.ts';

// Mini app THCS, THPT của Hộp công cụ giảng dạy (DT-29 phần 29d, YCTD-328)
describe('Mini app THCS, THPT', () => {
  it('CT-29d-1: máy tính khoa học: thứ tự phép tính, hàm, hằng, nhân ngầm, độ và radian, lỗi rõ ràng', () => {
    const close = (source: string, expected: number, options = {}) =>
      assert.ok(Math.abs(evaluateExpression(source, options) - expected) < 1e-9, source);
    close('1 + 2 × 3', 7);
    close('(1 + 2) × 3', 9);
    close('-2^2', -4);
    close('2^-1', 0.5);
    close('2^3^2', 512);
    close('1,5 + 0.5', 2);
    close('sin(30)', 0.5);
    close('sin 30', 0.5);
    close('sin(30)^2', 0.25);
    close('cos(90)', 0);
    close('sin(pi/6)', 0.5, { unit: 'rad' });
    close('√16 + cbrt(27)', 7);
    close('log(1000) + ln(e)', 4);
    close('5!', 120);
    close('50%', 0.5);
    close('2π', 2 * Math.PI);
    close('2(3 + 1)', 8);
    close('asin(1)', 90);
    for (const bad of ['', '1 +', '(1 + 2', '1 / 0', 'sqrt(-1)', 'tan(90)', 'abc', '1..2', 'x + 1', '3.5!']) {
      assert.throws(() => evaluateExpression(bad), ExpressionError, bad);
    }
    assert.equal(formatResult(0.1 + 0.2), '0,3');
    assert.equal(formatResult(1e15), '1 × 10^15');
    assert.equal(formatResult(-1234.5), '-1234,5');
  });

  it('CT-29d-2: vẽ đồ thị: biến x, ngắt nét ở điểm không xác định, bước lưới, báo lỗi cú pháp', () => {
    const close = (source: string, x: number, expected: number) =>
      assert.ok(Math.abs(evaluateExpression(source, { x }) - expected) < 1e-9, source);
    close('2x + 1', 3, 7);
    close('x^2 - 2x - 3', 3, 0);
    const viewport = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, width: 480, height: 480 };
    assert.deepEqual(toScreen(viewport, 0, 0), { left: 240, top: 240 });
    const line = plotPath('x', viewport, 4);
    assert.equal(line, 'M 0.0 480.0 L 120.0 360.0 L 240.0 240.0 L 360.0 120.0 L 480.0 0.0');
    // 1/x không xác định tại 0: nét bị ngắt (hai chữ M)
    assert.equal((plotPath('1/x', viewport, 4).match(/M/g) ?? []).length, 2);
    assert.equal(expressionProblem('x^2'), null);
    assert.equal(expressionProblem('sqrt(x)'), null);
    assert.ok(expressionProblem('x +'));
    assert.equal(gridStep(20), 2);
    assert.equal(gridStep(4), 0.5);
  });

  it('CT-29d-3: bảng tuần hoàn: 118 nguyên tố đúng chu kì, nhóm, loại; mỗi ô một nguyên tố; tìm theo kí hiệu, số hiệu', () => {
    assert.equal(ELEMENTS.length, 118);
    const check = (number: number, symbol: string, period: number, group: number | null, category: string) => {
      const element = ELEMENTS[number - 1];
      assert.deepEqual(
        [element?.symbol, element?.period, element?.group, element?.category],
        [symbol, period, group, category],
        symbol,
      );
    };
    check(1, 'H', 1, 1, 'nonmetal');
    check(2, 'He', 1, 18, 'noble-gas');
    check(11, 'Na', 3, 1, 'alkali');
    check(13, 'Al', 3, 13, 'post-transition');
    check(17, 'Cl', 3, 17, 'halogen');
    check(26, 'Fe', 4, 8, 'transition');
    check(57, 'La', 6, 3, 'lanthanide');
    check(58, 'Ce', 6, null, 'lanthanide');
    check(72, 'Hf', 6, 4, 'transition');
    check(89, 'Ac', 7, 3, 'actinide');
    check(103, 'Lr', 7, null, 'actinide');
    check(118, 'Og', 7, 18, 'noble-gas');
    assert.equal(ELEMENTS[5]?.mass, '12,011');
    const cells = ELEMENTS.filter((element) => element.group !== null).map(
      (element) => `${element.period}-${element.group}`,
    );
    assert.equal(new Set(cells).size, cells.length);
    assert.equal(cells.length, 90);
    assert.equal(findElements('fe')[0]?.name, 'iron');
    assert.equal(findElements('8')[0]?.symbol, 'O');
  });

  it('CT-29d-4: hình học động và đổi đơn vị', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 4, y: 0 };
    const c = { x: 0, y: 3 };
    assert.equal(distance(b, c), 5);
    assert.ok(Math.abs(angleAt(a, b, c) - 90) < 1e-9);
    assert.equal(triangleArea(a, b, c), 6);
    assert.deepEqual(centroid(a, b, c), { x: 4 / 3, y: 1 });
    assert.deepEqual(circumcenter(a, b, c), { x: 2, y: 1.5 });
    assert.deepEqual(orthocenter(a, b, c), { x: 0, y: 0 });
    assert.deepEqual(foot({ x: 2, y: 5 }, a, b), { x: 2, y: 0 });
    assert.deepEqual(classifyTriangle(a, b, c), ['Tam giác vuông']);
    assert.deepEqual(classifyTriangle({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: Math.sqrt(3) }), ['Tam giác đều']);
    assert.deepEqual(classifyTriangle(a, b, { x: 8, y: 0 }), ['Ba điểm thẳng hàng']);
    assert.equal(circumcenter(a, b, { x: 8, y: 0 }), null);
    assert.equal(convertUnit('length', 1.5, 'km', 'm'), 1500);
    assert.equal(convertUnit('speed', 36, 'km/h', 'm/s'), 10);
    assert.equal(convertUnit('temperature', 100, 'C', 'F'), 212);
    assert.equal(convertUnit('temperature', 0, 'C', 'K'), 273.15);
    assert.equal(convertUnit('mass', 2, 't', 'kg'), 2000);
    assert.equal(convertUnit('khong-co', 1, 'm', 'm'), null);
  });
});
