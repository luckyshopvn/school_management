import type { TutoringContentType } from './tutoring.js';

// Thu phí, khoản trừ buổi hủy và thù lao của chương trình gia sư trong trường (DT-27 phần 27c, YCTD-253; tài liệu 32 mục 19.5).
// Hàm thuần dùng chung cho máy chủ API (kiểm ở máy chủ, có kiểm thử đơn vị) và giao diện (giải thích ngay trên màn hình)
export type TutoringFeeBasis = 'per_session' | 'per_program';
export type TutoringCancelRefund = 'deduct_next' | 'adjust_invoice';
export type TutoringFundingSource = 'school_budget' | 'tutoring_fees';
export type TutoringCreditStatus = 'open' | 'adjusted' | 'closed';

export const TUTORING_FEE_BASIS_LABELS: Record<TutoringFeeBasis, string> = {
  per_session: 'Theo buổi học',
  per_program: 'Trọn gói chương trình',
};

export const TUTORING_CANCEL_REFUND_LABELS: Record<TutoringCancelRefund, string> = {
  deduct_next: 'Trừ vào khoản gia sư kỳ sau',
  adjust_invoice: 'Điều chỉnh giảm hóa đơn đã lập (chờ duyệt)',
};

export const TUTORING_FUNDING_SOURCE_LABELS: Record<TutoringFundingSource, string> = {
  school_budget: 'Kinh phí hợp pháp của trường',
  tutoring_fees: 'Từ khoản thu của chương trình',
};

export const TUTORING_CREDIT_STATUS_LABELS: Record<TutoringCreditStatus, string> = {
  open: 'Chờ trừ hoặc hoàn',
  adjusted: 'Đã lập điều chỉnh hóa đơn',
  closed: 'Đã hoàn, đã đóng',
};

// Căn cứ hiện trên màn hình khi chương trình là dạy thêm môn học trong trường
export const TUTORING_NO_FEE_BASIS =
  'Dạy thêm môn học trong nhà trường không được thu tiền của học sinh (Thông tư 29/2024/TT-BGDĐT sửa đổi bởi Thông tư 19/2026/TT-BGDĐT); thù lao giáo viên chi từ kinh phí hợp pháp của trường.';

// Tên khoản mục lương và mô tả dòng trên hóa đơn
export const TUTORING_PAY_ITEM_NAME = 'Thù lao dạy phụ đạo, bồi dưỡng';
export const TUTORING_INVOICE_PREFIX = 'Gia sư';

const MAX_AMOUNT = 1_000_000_000;

export interface TutoringFeeViolation {
  code: 'curriculum_fee' | 'fee_missing' | 'fee_amount' | 'funding_source' | 'pay_rate';
  message: string;
}

const validAmount = (value: number | null) =>
  value === null || (Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT);

// Quy tắc thu phí và thù lao của chương trình: `curriculum` khóa cứng không đặt giá (bật thu tiền do programRuleViolations báo),
// nguồn chi là kinh phí của trường;
// chương trình có thu thì phải có cách tính và số tiền
export function feeRuleViolations(program: {
  contentType: TutoringContentType;
  chargesFee: boolean;
  feeBasis: TutoringFeeBasis | null;
  feeAmount: number | null;
  fundingSource: TutoringFundingSource;
  payRatePerPeriod: number | null;
  teacherPayRates?: (number | null)[];
}): TutoringFeeViolation[] {
  const violations: TutoringFeeViolation[] = [];
  if (program.contentType === 'curriculum') {
    if (program.feeBasis !== null || program.feeAmount !== null) {
      violations.push({ code: 'curriculum_fee', message: TUTORING_NO_FEE_BASIS });
    }
    if (program.fundingSource !== 'school_budget') {
      violations.push({
        code: 'funding_source',
        message:
          'Dạy thêm môn học trong trường chi thù lao từ kinh phí của trường, không gắn với khoản thu của học sinh',
      });
    }
  } else if (program.chargesFee) {
    if (program.feeBasis === null || program.feeAmount === null) {
      violations.push({ code: 'fee_missing', message: 'Chương trình có thu tiền phải có cách tính và số tiền' });
    }
  } else if (program.feeBasis !== null || program.feeAmount !== null) {
    violations.push({ code: 'fee_missing', message: 'Chương trình không thu tiền thì không đặt giá' });
  }
  if (!validAmount(program.feeAmount)) {
    violations.push({ code: 'fee_amount', message: 'Số tiền là số nguyên đồng, lớn hơn 0, không quá 1 tỷ' });
  }
  if (!validAmount(program.payRatePerPeriod) || (program.teacherPayRates ?? []).some((rate) => !validAmount(rate))) {
    violations.push({ code: 'pay_rate', message: 'Đơn giá thù lao mỗi tiết là số nguyên đồng, lớn hơn 0' });
  }
  return violations;
}

// Khoản thu theo buổi: số buổi nhân đơn giá; trọn gói: cả số tiền một lần
export function tutoringChargeAmount(basis: TutoringFeeBasis, feeAmount: number, sessions: number): number {
  return basis === 'per_session' ? feeAmount * sessions : feeAmount;
}

// Khoản trừ một buổi bị hủy của chương trình trọn gói: chia đều theo số buổi lúc thu, làm tròn đến đồng
export function perProgramSessionShare(feeAmount: number, sessionsTotal: number): number {
  return sessionsTotal > 0 ? Math.round(feeAmount / sessionsTotal) : 0;
}

// Trừ các khoản trừ còn lại vào khoản thu (cũ trước), không để dòng hóa đơn âm; trả phần trừ của từng khoản
export function applyTutoringCredits(
  gross: number,
  credits: { id: string; remaining: number }[],
): { net: number; applied: { id: string; amount: number }[] } {
  let net = gross;
  const applied: { id: string; amount: number }[] = [];
  for (const credit of credits) {
    if (net <= 0) {
      break;
    }
    const amount = Math.min(net, credit.remaining);
    if (amount > 0) {
      applied.push({ id: credit.id, amount });
      net -= amount;
    }
  }
  return { net, applied };
}

// Thù lao một buổi: số tiết quy đổi nhân đơn giá; đơn giá riêng của giáo viên thay đơn giá của chương trình
export function teacherPayFor(
  periods: number,
  programRate: number | null,
  teacherRate: number | null,
): { rate: number; amount: number } | null {
  const rate = teacherRate ?? programRate;
  if (rate === null || periods <= 0) {
    return null;
  }
  return { rate, amount: rate * periods };
}
