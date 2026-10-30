import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  daysInMonth,
  monthlyWindow,
  prorate,
  purchaseBlock,
  remainingDaysOfMonth,
  upgradeQuote,
  type UpgradeCurrent,
  type UpgradeTarget,
  topUpValidUntil,
  turnBalance,
  turnOrder,
  vietnamMonthOf,
  type ExistingSubscription,
  type PurchaseRequest,
  type TurnCandidate,
} from './ai-tutor-rules.js';

// Quy tắc thuần của gia sư AI trả phí (YCTD-383 lát L0): khoảng dùng của gói tháng và lượt mua thêm, chặn mua trùng gói tháng giữa hai
// nguồn bán, thứ tự trừ lượt. Dữ liệu bịa
const NOW = new Date('2026-10-30T03:00:00Z');
const monthlyRequest: PurchaseRequest = {
  planKind: 'monthly',
  planStatus: 'active',
  planSchoolLevels: ['TH', 'THCS', 'THPT'],
  childSchoolLevel: 'THCS',
  periodMonth: '2026-10-01',
};
const existing = (overrides: Partial<ExistingSubscription> = {}): ExistingSubscription => ({
  planKind: 'monthly',
  planSource: 'school',
  periodMonth: '2026-10-01',
  status: 'active',
  pendingExpiresAt: null,
  ...overrides,
});
const candidate = (overrides: Partial<TurnCandidate> = {}): TurnCandidate => ({
  id: 'a',
  planKind: 'monthly',
  status: 'active',
  turns: 100,
  usedTurns: 0,
  heldTurns: 0,
  validFrom: new Date('2026-09-30T17:00:00Z'),
  validUntil: new Date('2026-10-31T17:00:00Z'),
  activatedAt: new Date('2026-10-01T01:00:00Z'),
  ...overrides,
});

describe('Gia sư AI: khoảng dùng của gói', () => {
  it('gói tháng tính theo giờ Việt Nam, tháng 12 sang tháng 1 năm sau', () => {
    assert.deepEqual(monthlyWindow('2026-10-01'), {
      validFrom: new Date('2026-09-30T17:00:00Z'),
      validUntil: new Date('2026-10-31T17:00:00Z'),
    });
    assert.deepEqual(monthlyWindow('2026-12-01').validUntil, new Date('2026-12-31T17:00:00Z'));
    assert.throws(() => monthlyWindow('2026-10-15'));
    assert.throws(() => monthlyWindow('2026-13-01'));
  });

  it('tháng của một thời điểm theo giờ Việt Nam: 23:30 ngày 31/10 giờ quốc tế đã là tháng 11', () => {
    assert.equal(vietnamMonthOf(new Date('2026-10-31T16:59:59Z')), '2026-10-01');
    assert.equal(vietnamMonthOf(new Date('2026-10-31T17:00:00Z')), '2026-11-01');
  });

  it('lượt mua thêm giữ 12 tháng từ lúc mua; 29/02 lùi về 28/02 năm sau', () => {
    assert.deepEqual(topUpValidUntil(new Date('2026-10-30T03:00:00Z')), new Date('2027-10-30T03:00:00Z'));
    // 29/02/2028 lúc 10:00 giờ Việt Nam
    assert.deepEqual(topUpValidUntil(new Date('2028-02-29T03:00:00Z')), new Date('2029-02-28T03:00:00Z'));
    // 00:30 ngày 01/01/2027 giờ Việt Nam (vẫn là 31/12 giờ quốc tế)
    assert.deepEqual(topUpValidUntil(new Date('2026-12-31T17:30:00Z')), new Date('2027-12-31T17:30:00Z'));
  });
});

describe('Gia sư AI: chặn mua trùng gói tháng', () => {
  it('chưa có gói tháng nào thì được mua; gói lượt luôn được mua kể cả khi đã có gói tháng', () => {
    assert.equal(purchaseBlock(monthlyRequest, [], NOW), null);
    assert.equal(purchaseBlock({ ...monthlyRequest, planKind: 'top_up', periodMonth: null }, [existing()], NOW), null);
  });

  it('đã có gói tháng của trường (đang dùng hoặc đang chờ) thì nền tảng không bán thêm, và ngược lại', () => {
    assert.deepEqual(purchaseBlock(monthlyRequest, [existing()], NOW), {
      code: 'monthly_exists',
      source: 'school',
      status: 'active',
    });
    assert.deepEqual(purchaseBlock(monthlyRequest, [existing({ planSource: 'platform', status: 'pending' })], NOW), {
      code: 'monthly_exists',
      source: 'platform',
      status: 'pending',
    });
  });

  it('gói tháng khác tháng, đã hủy, đã hoàn tiền thì không chặn', () => {
    assert.equal(purchaseBlock(monthlyRequest, [existing({ periodMonth: '2026-11-01' })], NOW), null);
    assert.equal(purchaseBlock(monthlyRequest, [existing({ status: 'cancelled' })], NOW), null);
    assert.equal(purchaseBlock(monthlyRequest, [existing({ status: 'refunded' })], NOW), null);
  });

  it('dòng chờ thanh toán: còn hạn giữ chỗ thì chặn, đúng lúc hết hạn thì không chặn', () => {
    const pending = (expiresAt: string) => existing({ status: 'pending', pendingExpiresAt: new Date(expiresAt) });
    assert.equal(purchaseBlock(monthlyRequest, [pending('2026-10-30T03:00:01Z')], NOW)?.code, 'monthly_exists');
    assert.equal(purchaseBlock(monthlyRequest, [pending('2026-10-30T03:00:00Z')], NOW), null);
  });

  it('gói ngừng bán, sai cấp học, tháng sai mẫu, tháng đã qua thì không cho mua; tháng sau được mua trước', () => {
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, planStatus: 'archived' }, [], NOW), { code: 'plan_archived' });
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, planSchoolLevels: ['THPT'] }, [], NOW), {
      code: 'level_not_allowed',
    });
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, periodMonth: '2026-10-15' }, [], NOW), {
      code: 'period_invalid',
    });
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, periodMonth: null }, [], NOW), { code: 'period_invalid' });
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, planKind: 'top_up' }, [], NOW), { code: 'period_invalid' });
    assert.deepEqual(purchaseBlock({ ...monthlyRequest, periodMonth: '2026-09-01' }, [], NOW), {
      code: 'period_past',
    });
    assert.equal(purchaseBlock({ ...monthlyRequest, periodMonth: '2026-11-01' }, [], NOW), null);
  });
});

describe('Gia sư AI: thứ tự trừ lượt', () => {
  it('lượt gói tháng trước, rồi lượt mua thêm sắp hết hạn trước', () => {
    const topUpLate = candidate({
      id: 't2',
      planKind: 'top_up',
      validFrom: new Date('2026-10-05T00:00:00Z'),
      validUntil: new Date('2027-10-05T00:00:00Z'),
    });
    const topUpEarly = candidate({
      id: 't1',
      planKind: 'top_up',
      validFrom: new Date('2026-03-01T00:00:00Z'),
      validUntil: new Date('2027-03-01T00:00:00Z'),
    });
    const order = turnOrder([topUpLate, topUpEarly, candidate({ id: 'm' })], NOW).map((item) => item.id);
    assert.deepEqual(order, ['m', 't1', 't2']);
  });

  it('bỏ gói hết lượt (kể cả lượt đang giữ), chưa tới hạn, hết hạn, chưa kích hoạt', () => {
    const order = turnOrder(
      [
        candidate({ id: 'het', usedTurns: 99, heldTurns: 1 }),
        candidate({
          id: 'sau',
          validFrom: new Date('2026-10-31T17:00:00Z'),
          validUntil: new Date('2026-11-30T17:00:00Z'),
        }),
        candidate({ id: 'qua', planKind: 'top_up', validUntil: NOW }),
        candidate({ id: 'cho', status: 'pending', validFrom: null, validUntil: null }),
        candidate({ id: 'con', planKind: 'top_up', turns: 50, usedTurns: 49 }),
      ],
      NOW,
    ).map((item) => item.id);
    assert.deepEqual(order, ['con']);
  });

  it('số lượt còn tách theo gói tháng và lượt mua thêm', () => {
    assert.deepEqual(
      turnBalance(
        [
          candidate({ usedTurns: 38, heldTurns: 2 }),
          candidate({ id: 't', planKind: 'top_up', turns: 50, usedTurns: 0 }),
          candidate({ id: 'x', planKind: 'top_up', turns: 50, validUntil: NOW }),
        ],
        NOW,
      ),
      { monthly: 60, topUp: 50 },
    );
  });
});

describe('Gia sư AI: nâng gói giữa tháng', () => {
  const current = (overrides: Partial<UpgradeCurrent> = {}): UpgradeCurrent => ({
    planSource: 'school',
    planKind: 'monthly',
    planId: 'co-ban',
    status: 'active',
    periodMonth: '2026-10-01',
    monthlyPrice: 79000,
    monthlyTurns: 100,
    ...overrides,
  });
  const target = (overrides: Partial<UpgradeTarget> = {}): UpgradeTarget => ({
    source: 'school',
    id: 'nang-cao',
    kind: 'monthly',
    status: 'active',
    price: 149000,
    turns: 300,
    schoolLevels: ['TH', 'THCS', 'THPT'],
    ...overrides,
  });

  it('số ngày của tháng: 31, 30, tháng 2 năm thường 28, năm nhuận 29', () => {
    assert.equal(daysInMonth('2026-10-01'), 31);
    assert.equal(daysInMonth('2026-11-01'), 30);
    assert.equal(daysInMonth('2026-02-01'), 28);
    assert.equal(daysInMonth('2028-02-01'), 29);
  });

  it('ngày còn lại tính cả hôm nay theo giờ Việt Nam; tháng chưa tới là cả tháng; tháng đã qua là 0', () => {
    assert.deepEqual(remainingDaysOfMonth('2026-10-01', NOW), { remainingDays: 2, daysInMonth: 31 });
    // 0 giờ ngày 1/10 giờ Việt Nam: cả tháng
    assert.deepEqual(remainingDaysOfMonth('2026-10-01', new Date('2026-09-30T17:00:00Z')).remainingDays, 31);
    // 23:59 ngày 31/10 giờ Việt Nam: còn đúng một ngày; một giây sau đã sang tháng 11
    assert.equal(remainingDaysOfMonth('2026-10-01', new Date('2026-10-31T16:59:59Z')).remainingDays, 1);
    assert.equal(remainingDaysOfMonth('2026-10-01', new Date('2026-10-31T17:00:00Z')).remainingDays, 0);
    assert.equal(remainingDaysOfMonth('2026-11-01', NOW).remainingDays, 30);
  });

  it('phần theo tỉ lệ làm tròn tới đơn vị; không âm, không vượt cả phần', () => {
    assert.equal(prorate(70000, 2, 31), 4516);
    assert.equal(prorate(200, 2, 31), 13);
    assert.equal(prorate(70000, 31, 31), 70000);
    assert.equal(prorate(70000, 40, 31), 70000);
    assert.equal(prorate(70000, 0, 31), 0);
    assert.equal(prorate(70000, 5, 0), 0);
  });

  it('ngày 30/10 nâng Cơ bản lên Nâng cao: trả 4.516 đồng, cộng 13 lượt', () => {
    assert.deepEqual(upgradeQuote(current(), target(), 'THCS', NOW), {
      ok: true,
      quote: {
        remainingDays: 2,
        daysInMonth: 31,
        fromPrice: 79000,
        toPrice: 149000,
        fromTurns: 100,
        toTurns: 300,
        priceDifference: 4516,
        extraTurns: 13,
      },
    });
  });

  it('ngày đầu tháng trả đủ chênh lệch; gói tháng sau đã mua trước thì cũng trả đủ', () => {
    const firstDay = new Date('2026-09-30T17:00:00Z');
    const quote = upgradeQuote(current(), target(), 'THCS', firstDay);
    assert.equal(quote.ok && quote.quote.priceDifference, 70000);
    assert.equal(quote.ok && quote.quote.extraTurns, 200);
    const nextMonth = upgradeQuote(current({ periodMonth: '2026-11-01' }), target(), 'THCS', NOW);
    assert.equal(nextMonth.ok && nextMonth.quote.remainingDays, 30);
  });

  it('không cho nâng: gói lượt, chưa kích hoạt, khác nguồn, gói ngừng bán, sai cấp, cùng gói, không cao hơn, tháng đã qua', () => {
    const blocked = (value: ReturnType<typeof upgradeQuote>) => (value.ok ? 'ok' : value.code);
    assert.equal(
      blocked(upgradeQuote(current({ planKind: 'top_up', periodMonth: null }), target(), 'THCS', NOW)),
      'not_monthly',
    );
    assert.equal(blocked(upgradeQuote(current(), target({ kind: 'top_up' }), 'THCS', NOW)), 'not_monthly');
    assert.equal(blocked(upgradeQuote(current({ status: 'pending' }), target(), 'THCS', NOW)), 'not_active');
    assert.equal(blocked(upgradeQuote(current({ status: 'cancelled' }), target(), 'THCS', NOW)), 'not_active');
    assert.equal(blocked(upgradeQuote(current(), target({ source: 'platform' }), 'THCS', NOW)), 'source_mismatch');
    assert.equal(blocked(upgradeQuote(current(), target({ status: 'archived' }), 'THCS', NOW)), 'plan_archived');
    assert.equal(
      blocked(upgradeQuote(current(), target({ schoolLevels: ['THPT'] }), 'THCS', NOW)),
      'level_not_allowed',
    );
    assert.equal(blocked(upgradeQuote(current(), target({ id: 'co-ban' }), 'THCS', NOW)), 'same_plan');
    assert.equal(blocked(upgradeQuote(current(), target({ price: 79000 }), 'THCS', NOW)), 'not_higher');
    assert.equal(blocked(upgradeQuote(current(), target({ turns: 99 }), 'THCS', NOW)), 'not_higher');
    assert.equal(blocked(upgradeQuote(current({ periodMonth: '2026-09-01' }), target(), 'THCS', NOW)), 'period_ended');
  });

  it('giá cao hơn một đồng, cùng số lượt (chỉ thêm quyền gửi ảnh) vẫn được nâng, không cộng lượt', () => {
    const quote = upgradeQuote(current(), target({ price: 79001, turns: 100 }), 'THCS', NOW);
    assert.equal(quote.ok && quote.quote.priceDifference, 0);
    assert.equal(quote.ok && quote.quote.extraTurns, 0);
  });
});
