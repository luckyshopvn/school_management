import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextPeriod, periodContaining, periodLabel, previousPeriod } from './periods.js';
import { computeCharges, PricingError, ruleFromPlanPrices, validatePriceRule, type PriceRule } from './pricing.js';

// Hàm tính phí thuần và kỳ thu (DT-SaaS phần S5b, YCTD-196), kịch bản CT-S5b-1, CT-S5b-2. Số tiền là số nguyên đồng
const base: PriceRule = {
  code: 'thu',
  name: 'Thử',
  components: ['per_student'],
  studentTiers: [
    { up_to: 100, unit_price: 10_000 },
    { up_to: 300, unit_price: 8_000 },
    { up_to: null, unit_price: 5_000 },
  ],
  tierMode: 'graduated',
  schoolFee: 0,
  modulePrices: {},
  minimumFee: 0,
  period: 'monthly',
  vatPercent: 0,
  dueDays: 15,
};
const usage = (activeStudents: number, modules: string[] | null = null) => ({
  activeStudents,
  storageMb: 0,
  schoolLevels: 1,
  modules,
});
const ALL = ['education', 'finance', 'library'];

describe('tính phí theo quy tắc cấu hình được', () => {
  it('CT-S5b-1: lũy tiến, theo bậc cả gói, theo trường, theo phân hệ, kết hợp, phí tối thiểu, giảm giá, VAT, số liệu sai', () => {
    const graduated = computeCharges(base, usage(350), { allModules: ALL });
    assert.deepEqual(
      graduated.lines.map((line) => [line.quantity, line.unitPrice, line.amount]),
      [
        [100, 10_000, 1_000_000],
        [200, 8_000, 1_600_000],
        [50, 5_000, 250_000],
      ],
    );
    assert.equal(graduated.total, 2_850_000);
    assert.equal(computeCharges(base, usage(100), { allModules: ALL }).total, 1_000_000, 'đúng biên bậc');
    assert.equal(computeCharges(base, usage(0), { allModules: ALL }).total, 0);

    const volume = computeCharges({ ...base, tierMode: 'volume' }, usage(350), { allModules: ALL });
    assert.deepEqual(
      volume.lines.map((line) => [line.quantity, line.unitPrice]),
      [[350, 5_000]],
    );
    assert.equal(volume.total, 1_750_000);
    assert.equal(computeCharges({ ...base, tierMode: 'volume' }, usage(101), { allModules: ALL }).total, 808_000);

    const school = computeCharges({ ...base, components: ['per_school'], schoolFee: 2_000_000 }, usage(999), {
      allModules: ALL,
    });
    assert.deepEqual(
      school.lines.map((line) => line.kind),
      ['per_school'],
    );
    assert.equal(school.total, 2_000_000);

    const modules = { education: 500_000, finance: 300_000, website: 900_000 };
    const perModule = computeCharges({ ...base, components: ['per_module'], modulePrices: modules }, usage(10, ['education', 'finance']), {
      allModules: ALL,
      moduleLabels: { education: 'Quản lý giáo dục' },
    });
    assert.equal(perModule.total, 800_000, 'chỉ phân hệ bật trong gói và có giá');
    assert.equal(perModule.lines[0]?.description, 'Phân hệ Quản lý giáo dục');
    assert.equal(
      computeCharges({ ...base, components: ['per_module'], modulePrices: modules }, usage(10, null), { allModules: ALL }).total,
      800_000,
      'gói bật mọi phân hệ thì tính mọi phân hệ có giá trong danh sách phân hệ',
    );

    const combined = computeCharges(
      { ...base, components: ['per_student', 'per_school', 'per_module'], schoolFee: 1_000_000, modulePrices: modules },
      usage(50, ['finance']),
      { allModules: ALL },
    );
    assert.equal(combined.total, 500_000 + 1_000_000 + 300_000);

    const minimum = computeCharges({ ...base, minimumFee: 1_500_000 }, usage(20), { allModules: ALL });
    assert.equal(minimum.subtotal, 1_500_000);
    assert.equal(minimum.lines.at(-1)?.kind, 'minimum');
    assert.equal(minimum.lines.at(-1)?.amount, 1_300_000);
    assert.equal(
      computeCharges({ ...base, minimumFee: 1_500_000 }, usage(200), { allModules: ALL }).lines.some((line) => line.kind === 'minimum'),
      false,
    );

    const taxed = computeCharges({ ...base, vatPercent: 8 }, usage(3), { allModules: ALL, discount: 1_001 });
    assert.equal(taxed.subtotal, 30_000);
    assert.equal(taxed.discountTotal, 1_001);
    assert.equal(taxed.vatAmount, 2_320, '28.999 × 8% = 2.319,92 làm tròn nửa lên');
    assert.equal(taxed.total, 31_319);
    assert.equal(computeCharges(base, usage(1), { allModules: ALL, discount: 99_999 }).total, 0, 'giảm giá không vượt tổng');
    assert.equal(computeCharges({ ...base, vatPercent: 10 }, usage(1), { allModules: ALL }).vatAmount, 1_000);

    assert.throws(() => validatePriceRule({ ...base, studentTiers: [{ up_to: 100, unit_price: 1 }] }), PricingError);
    assert.throws(
      () =>
        validatePriceRule({
          ...base,
          studentTiers: [
            { up_to: 100, unit_price: 1 },
            { up_to: 50, unit_price: 1 },
            { up_to: null, unit_price: 1 },
          ],
        }),
      PricingError,
    );
    assert.throws(() => validatePriceRule({ ...base, components: [] }), PricingError);
    assert.throws(() => validatePriceRule({ ...base, schoolFee: 1.5 }), PricingError);
    assert.throws(() => validatePriceRule({ ...base, vatPercent: 101 }), PricingError);
    assert.throws(() => computeCharges(base, usage(-1), { allModules: ALL }), PricingError);

    const fromPlan = ruleFromPlanPrices({
      code: 'co-ban',
      name: 'Cơ bản',
      pricing_mode: 'per_student',
      unit_price: 12_000,
      minimum_fee: 500_000,
      module_prices: {},
      billing_cycle: 'term',
    });
    assert.equal(fromPlan.period, 'quarterly');
    assert.equal(computeCharges(fromPlan, usage(100), { allModules: ALL }).total, 1_200_000);
    assert.equal(computeCharges(fromPlan, usage(10), { allModules: ALL }).total, 500_000);
  });

  it('CT-S5b-2: kỳ tháng, quý, năm theo lịch; kỳ trước, kỳ sau, tên kỳ', () => {
    assert.deepEqual(periodContaining('2026-02-14', 'monthly'), { start: '2026-02-01', end: '2026-02-28' });
    assert.deepEqual(periodContaining('2028-02-29', 'monthly'), { start: '2028-02-01', end: '2028-02-29' });
    assert.deepEqual(periodContaining('2026-11-20', 'quarterly'), { start: '2026-10-01', end: '2026-12-31' });
    assert.deepEqual(periodContaining('2026-11-20', 'yearly'), { start: '2026-01-01', end: '2026-12-31' });
    assert.deepEqual(previousPeriod(periodContaining('2026-01-05', 'monthly'), 'monthly'), {
      start: '2025-12-01',
      end: '2025-12-31',
    });
    assert.deepEqual(nextPeriod(periodContaining('2026-12-05', 'quarterly'), 'quarterly'), {
      start: '2027-01-01',
      end: '2027-03-31',
    });
    assert.equal(periodLabel(periodContaining('2026-11-20', 'quarterly'), 'quarterly'), 'quý 4/2026');
    assert.equal(periodLabel(periodContaining('2026-11-20', 'monthly'), 'monthly'), 'tháng 11/2026');
  });
});
