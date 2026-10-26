import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { aiPricingReady, computeAiCharges, validateAiPricing, type AiPricing } from './ai-pricing.js';
import { computeCharges, type PriceRule } from './pricing.js';

// Kiểm thử hàm tính phí AI thuần (DT-23 phần 23d, YCTD-214, GD-103): số nguyên đồng, token miễn phí chia theo tỷ lệ, làm tròn lên,
// phí tối thiểu, đơn giá theo mô hình, đơn giá để trống

const PRICING: AiPricing = {
  freeTokens: 0,
  inputPricePer1k: 100,
  outputPricePer1k: 500,
  modelPrices: {},
  minimumFee: 0,
  roundingStep: 1,
};

describe('computeAiCharges (CT-AI-1)', () => {
  test('kỳ không dùng AI thì không có dòng nào, kể cả khi có phí tối thiểu', () => {
    const result = computeAiCharges({ ...PRICING, minimumFee: 50_000 }, []);
    assert.deepEqual(result.lines, []);
    const idle = computeAiCharges({ ...PRICING, minimumFee: 50_000 }, [
      { model: 'm', requests: 0, inputTokens: 0, outputTokens: 0 },
    ]);
    assert.deepEqual(idle.lines, []);
  });

  test('một mô hình: token vào và ra nhân đơn giá theo một nghìn token', () => {
    const result = computeAiCharges(PRICING, [{ model: 'm', requests: 3, inputTokens: 20_000, outputTokens: 10_000 }]);
    // 20 nghìn × 100 + 10 nghìn × 500 = 7.000
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]?.amount, 7000);
    assert.equal(result.lines[0]?.kind, 'ai');
    assert.equal(result.totalTokens, 30_000);
  });

  test('làm tròn lên theo bội của bước làm tròn', () => {
    const result = computeAiCharges({ ...PRICING, roundingStep: 1000 }, [
      { model: 'm', requests: 1, inputTokens: 1_000, outputTokens: 1 },
    ]);
    // 1.000 token vào = 100; 1 token ra = 0,5 đồng; tổng 100,5 → làm tròn lên 1.000
    assert.equal(result.lines[0]?.amount, 1000);
  });

  test('token miễn phí trừ theo tỷ lệ vào mọi mô hình, không phụ thuộc thứ tự', () => {
    const usage = [
      { model: 'a', requests: 1, inputTokens: 10_000, outputTokens: 0 },
      { model: 'b', requests: 1, inputTokens: 0, outputTokens: 10_000 },
    ];
    const pricing = { ...PRICING, freeTokens: 10_000 };
    const forward = computeAiCharges(pricing, usage);
    const backward = computeAiCharges(pricing, [...usage].reverse());
    // chi phí thô a = 1.000, b = 5.000; một nửa token miễn phí nên trả một nửa: 500 và 2.500
    assert.deepEqual(
      forward.lines.map((line) => line.amount).sort((left, right) => left - right),
      [500, 2500],
    );
    assert.deepEqual(
      backward.lines.map((line) => line.amount).sort((left, right) => left - right),
      [500, 2500],
    );
    assert.equal(forward.freeTokensApplied, 10_000);
    assert.match(forward.lines[0]?.description ?? '', /miễn phí/);
  });

  test('dùng trong hạn token miễn phí thì không thu, trừ phí tối thiểu', () => {
    const usage = [{ model: 'm', requests: 2, inputTokens: 5_000, outputTokens: 5_000 }];
    const free = computeAiCharges({ ...PRICING, freeTokens: 100_000 }, usage);
    assert.deepEqual(free.lines, []);
    const minimum = computeAiCharges({ ...PRICING, freeTokens: 100_000, minimumFee: 20_000 }, usage);
    assert.equal(minimum.lines.length, 1);
    assert.equal(minimum.lines[0]?.amount, 20_000);
  });

  test('phí tối thiểu chỉ bù phần thiếu', () => {
    const result = computeAiCharges({ ...PRICING, minimumFee: 10_000 }, [
      { model: 'm', requests: 1, inputTokens: 20_000, outputTokens: 10_000 },
    ]);
    assert.deepEqual(
      result.lines.map((line) => line.amount),
      [7000, 3000],
    );
  });

  test('đơn giá riêng theo mô hình thay đơn giá chung; mô hình thiếu đơn giá vào danh sách chưa tính', () => {
    const result = computeAiCharges({ ...PRICING, modelPrices: { rieng: { input: 1000, output: 1000 } } }, [
      { model: 'rieng', requests: 1, inputTokens: 1000, outputTokens: 1000 },
      { model: 'chung', requests: 1, inputTokens: 1000, outputTokens: 1000 },
    ]);
    assert.deepEqual(result.lines.map((line) => line.amount).sort((left, right) => left - right), [600, 2000]);
    const empty = computeAiCharges({ ...PRICING, inputPricePer1k: null, outputPricePer1k: null }, [
      { model: 'x', requests: 1, inputTokens: 10, outputTokens: 10 },
    ]);
    assert.deepEqual(empty.lines, []);
    assert.deepEqual(empty.unpriced, ['x']);
  });

  test('đơn giá để trống thì chưa sẵn sàng thu phí; số liệu không hợp lệ bị từ chối', () => {
    assert.equal(aiPricingReady(null), false);
    assert.equal(aiPricingReady({ ...PRICING, inputPricePer1k: null }), false);
    assert.equal(aiPricingReady(PRICING), true);
    assert.throws(() => validateAiPricing({ ...PRICING, roundingStep: 0 }));
    assert.throws(() => validateAiPricing({ ...PRICING, freeTokens: -1 }));
    assert.throws(() => validateAiPricing({ ...PRICING, outputPricePer1k: 1.5 }));
  });

  test('số lớn không tràn: một nghìn tỷ token vẫn tính bằng số nguyên lớn', () => {
    const result = computeAiCharges({ ...PRICING, inputPricePer1k: 1, outputPricePer1k: 1 }, [
      { model: 'm', requests: 1, inputTokens: 1_000_000_000_000, outputTokens: 0 },
    ]);
    assert.equal(result.lines[0]?.amount, 1_000_000_000);
  });
});

describe('computeCharges với thành phần AI (CT-AI-2)', () => {
  const rule: PriceRule = {
    code: 'goi',
    name: 'Gói',
    components: ['per_school'],
    studentTiers: [],
    tierMode: 'graduated',
    schoolFee: 100_000,
    modulePrices: {},
    minimumFee: 0,
    period: 'monthly',
    vatPercent: 10,
    dueDays: 15,
  };

  test('dòng AI nằm trong tổng trước giảm giá và chịu VAT', () => {
    const charges = computeCharges(
      rule,
      { activeStudents: 0, storageMb: 0, schoolLevels: 1, modules: null },
      {
        allModules: [],
        ai: { pricing: PRICING, usage: [{ model: 'm', requests: 1, inputTokens: 20_000, outputTokens: 10_000 }] },
      },
    );
    assert.deepEqual(
      charges.lines.map((line) => [line.kind, line.amount]),
      [
        ['per_school', 100_000],
        ['ai', 7000],
      ],
    );
    assert.equal(charges.subtotal, 107_000);
    assert.equal(charges.vatAmount, 10_700);
    assert.equal(charges.total, 117_700);
  });

  test('không có thành phần AI thì kết quả như cũ', () => {
    const charges = computeCharges(
      rule,
      { activeStudents: 0, storageMb: 0, schoolLevels: 1, modules: null },
      { allModules: [] },
    );
    assert.equal(charges.lines.length, 1);
    assert.equal(charges.total, 110_000);
  });

  test('phí tối thiểu chung không tính dòng AI', () => {
    const charges = computeCharges(
      { ...rule, minimumFee: 150_000 },
      { activeStudents: 0, storageMb: 0, schoolLevels: 1, modules: null },
      {
        allModules: [],
        ai: { pricing: PRICING, usage: [{ model: 'm', requests: 1, inputTokens: 20_000, outputTokens: 10_000 }] },
      },
    );
    // phí theo trường 100.000 thiếu 50.000 so với tối thiểu chung 150.000 dù đã có dòng AI
    assert.deepEqual(
      charges.lines.map((line) => [line.kind, line.amount]),
      [
        ['per_school', 100_000],
        ['minimum', 50_000],
        ['ai', 7000],
      ],
    );
  });
});
