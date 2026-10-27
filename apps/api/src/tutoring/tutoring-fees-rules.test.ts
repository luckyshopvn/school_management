import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTutoringCredits,
  feeRuleViolations,
  perProgramSessionShare,
  teacherPayFor,
  tutoringChargeAmount,
} from '@school-management/shared';

// Thu phí, khoản trừ buổi hủy và thù lao gia sư trong trường (DT-27 phần 27c, YCTD-253), kịch bản CT-27c-1, CT-27c-2: hàm thuần dùng
// chung cho máy chủ và giao diện
const base = {
  contentType: 'enrichment' as const,
  chargesFee: true,
  feeBasis: 'per_session' as const,
  feeAmount: 50_000,
  fundingSource: 'tutoring_fees' as const,
  payRatePerPeriod: 100_000,
};
const codes = (program: Parameters<typeof feeRuleViolations>[0]) =>
  feeRuleViolations(program).map((violation) => violation.code);

describe('Quy tắc thu phí và thù lao gia sư', () => {
  it('CT-27c-1: môn học trong trường khóa cứng không thu tiền, chi từ kinh phí trường; bổ trợ có thu phải có giá', () => {
    assert.deepEqual(codes(base), []);
    assert.deepEqual(
      codes({ ...base, contentType: 'curriculum', chargesFee: false, feeBasis: null, feeAmount: null }),
      ['funding_source'],
    );
    assert.deepEqual(
      codes({
        ...base,
        contentType: 'curriculum',
        chargesFee: false,
        feeBasis: null,
        feeAmount: null,
        fundingSource: 'school_budget',
      }),
      [],
    );
    assert.deepEqual(codes({ ...base, contentType: 'curriculum', fundingSource: 'school_budget' }), ['curriculum_fee']);
    assert.deepEqual(
      codes({ ...base, contentType: 'curriculum', chargesFee: false, fundingSource: 'school_budget' }),
      ['curriculum_fee'],
      'môn học không đặt giá kể cả khi tắt thu tiền',
    );
    assert.deepEqual(codes({ ...base, feeBasis: null, feeAmount: null }), ['fee_missing']);
    assert.deepEqual(codes({ ...base, chargesFee: false }), ['fee_missing'], 'không thu thì không đặt giá');
    assert.deepEqual(codes({ ...base, feeAmount: 12.5 }), ['fee_amount']);
    assert.deepEqual(codes({ ...base, feeAmount: -1 }), ['fee_amount']);
    assert.deepEqual(codes({ ...base, payRatePerPeriod: 0 }), ['pay_rate']);
    assert.deepEqual(codes({ ...base, teacherPayRates: [null, 80_000, 1.5] }), ['pay_rate']);
  });

  it('CT-27c-2: khoản thu theo buổi, trọn gói; chia khoản trừ buổi hủy; trừ không để dòng âm; thù lao theo tiết', () => {
    assert.equal(tutoringChargeAmount('per_session', 50_000, 4), 200_000);
    assert.equal(tutoringChargeAmount('per_program', 1_000_000, 4), 1_000_000);
    assert.equal(perProgramSessionShare(1_000_000, 3), 333_333);
    assert.equal(perProgramSessionShare(1_000_000, 0), 0);

    assert.deepEqual(
      applyTutoringCredits(50_000, [
        { id: 'a', remaining: 30_000 },
        { id: 'b', remaining: 40_000 },
      ]),
      {
        net: 0,
        applied: [
          { id: 'a', amount: 30_000 },
          { id: 'b', amount: 20_000 },
        ],
      },
    );
    assert.deepEqual(applyTutoringCredits(100_000, [{ id: 'a', remaining: 30_000 }]), {
      net: 70_000,
      applied: [{ id: 'a', amount: 30_000 }],
    });
    assert.deepEqual(applyTutoringCredits(100_000, []), { net: 100_000, applied: [] });

    assert.deepEqual(teacherPayFor(2, 100_000, null), { rate: 100_000, amount: 200_000 });
    assert.deepEqual(teacherPayFor(2, 100_000, 120_000), { rate: 120_000, amount: 240_000 }, 'đơn giá riêng');
    assert.equal(teacherPayFor(2, null, null), null);
    assert.equal(teacherPayFor(0, 100_000, null), null);
  });
});
