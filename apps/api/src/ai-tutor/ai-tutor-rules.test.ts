import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  monthlyWindow,
  purchaseBlock,
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
