import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canRefund,
  decidePayment,
  orderCode,
  pendingExpiresAt,
  readPlanInput,
  readRefundInput,
  receiptDescription,
  receiptNumber,
  transferCodeIn,
  transferContentOf,
} from './platform-sales-rules.js';

// Quy tắc thuần của việc nền tảng bán thẳng gói gia sư AI (YCTD-383 lát L1b): mã giao dịch, nội dung chuyển khoản, cách xử lý tiền vào,
// kiểm tra gói và hoàn tiền. Dữ liệu bịa
describe('Gia sư AI nền tảng bán: quy tắc thuần', () => {
  // 23:30 ngày 29/10 giờ UTC là 06:30 ngày 30/10 giờ Việt Nam
  const MOMENT = new Date('2026-10-29T23:30:00Z');

  it('mã giao dịch, nội dung chuyển khoản, số biên lai theo ngày giờ Việt Nam', () => {
    assert.equal(orderCode(MOMENT, 142), 'GD-20261030-0142');
    assert.equal(transferContentOf(MOMENT, 142), 'GSAI202610300142');
    assert.equal(receiptNumber(MOMENT, 7), 'BL-20261030-0007');
    assert.equal(transferContentOf(MOMENT, 123456), 'GSAI20261030123456');
  });

  it('tìm mã giao dịch trong nội dung chuyển khoản của ngân hàng', () => {
    assert.equal(transferCodeIn('CK gsai-20261030 0142 thanh toan'), 'GSAI202610300142');
    assert.equal(transferCodeIn('MBVCB.123 GSAI202610300142 GIA LAP'), 'GSAI202610300142');
    assert.equal(transferCodeIn('HD000123 thanh toan hoa don'), null, 'hóa đơn dịch vụ không thuộc gia sư AI');
    assert.equal(transferCodeIn('GSAI2026'), null);
  });

  it('giữ chỗ chờ thanh toán 15 phút', () => {
    assert.equal(pendingExpiresAt(MOMENT).toISOString(), '2026-10-29T23:45:00.000Z');
  });

  it('xử lý tiền vào: đúng hạn đúng tiền thì kích hoạt; sai tiền; đến muộn; giao dịch đã đóng', () => {
    const order = { status: 'pending' as const, amount: 89_000, pendingExpiresAt: pendingExpiresAt(MOMENT) };
    const inTime = new Date(MOMENT.getTime() + 60_000);
    assert.equal(decidePayment(order, { amount: 89_000, receivedAt: inTime }), 'activate');
    assert.equal(decidePayment(order, { amount: 80_000, receivedAt: inTime }), 'amount_mismatch');
    assert.equal(
      decidePayment(order, { amount: 89_000, receivedAt: new Date(MOMENT.getTime() + 16 * 60_000) }),
      'late',
    );
    assert.equal(decidePayment({ ...order, status: 'expired' }, { amount: 89_000, receivedAt: inTime }), 'late');
    assert.equal(decidePayment({ ...order, status: 'cancelled' }, { amount: 89_000, receivedAt: inTime }), 'late');
    for (const status of ['paid', 'refunded', 'needs_refund'] as const) {
      assert.equal(decidePayment({ ...order, status }, { amount: 89_000, receivedAt: inTime }), 'already_settled');
    }
  });

  it('chỉ hoàn được giao dịch đã thu hoặc tiền đến muộn', () => {
    assert.equal(canRefund('paid'), true);
    assert.equal(canRefund('needs_refund'), true);
    for (const status of ['pending', 'expired', 'cancelled', 'refunded'] as const) {
      assert.equal(canRefund(status), false);
    }
  });

  it('kiểm tra gói: giá, số lượt, cấp học, ảnh chỉ ở gói tháng, không đổi loại gói khi sửa', () => {
    const valid = readPlanInput(
      { kind: 'monthly', name: ' Cơ bản tháng ', price: 89_000, turns: 100, school_levels: ['THPT', 'TH'] },
      null,
    );
    assert.deepEqual(valid.errors, []);
    assert.deepEqual(valid.value, {
      kind: 'monthly',
      name: 'Cơ bản tháng',
      price: 89_000,
      turns: 100,
      allowImages: false,
      schoolLevels: ['TH', 'THPT'],
    });
    const invalid = readPlanInput(
      { kind: 'top_up', name: '', price: 0, turns: 0, allow_images: true, school_levels: ['MN'] },
      null,
    );
    assert.deepEqual(
      invalid.errors.map((error) => error.field),
      ['name', 'price', 'turns', 'allow_images', 'school_levels'],
    );
    const changedKind = readPlanInput(
      { kind: 'top_up', name: 'Gói', price: 45_000, turns: 50, school_levels: ['TH'] },
      'monthly',
    );
    assert.deepEqual(
      changedKind.errors.map((error) => error.field),
      ['kind'],
    );
  });

  it('hoàn tiền: mặc định hoàn đủ, không quá số đã thu, bắt buộc lý do', () => {
    assert.deepEqual(readRefundInput({ reason: 'Phụ huynh mua nhầm' }, 89_000).value, {
      amount: 89_000,
      reason: 'Phụ huynh mua nhầm',
    });
    assert.deepEqual(
      readRefundInput({ amount: 90_000, reason: '' }, 89_000).errors.map((error) => error.field),
      ['amount', 'reason'],
    );
  });

  it('dòng mô tả trên biên lai', () => {
    assert.equal(
      receiptDescription({
        planName: 'Cơ bản tháng',
        planKind: 'monthly',
        periodMonth: '2026-10-01',
        turns: 100,
        kind: 'purchase',
      }),
      'Gói Cơ bản tháng tháng 10/2026 (100 lượt hỏi)',
    );
    assert.equal(
      receiptDescription({ planName: 'Mua thêm 50 lượt', planKind: 'top_up', periodMonth: null, turns: 50, kind: 'purchase' }),
      'Gói Mua thêm 50 lượt (50 lượt hỏi, dùng trong 12 tháng)',
    );
  });
});
