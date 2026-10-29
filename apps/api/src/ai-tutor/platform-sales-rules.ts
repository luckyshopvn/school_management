import type { FieldError } from '@school-management/server';
import type { AiTutorPlanKind, AiTutorSchoolLevel } from './ai-tutor-rules.js';

// Quy tắc thuần của việc nền tảng bán thẳng gói gia sư AI cho phụ huynh (YCTD-383 lát L1b; đề xuất Eric duyệt ngày 2026-10-30, Q1):
// mã giao dịch, nội dung chuyển khoản, số biên lai, cách xử lý một khoản tiền vào, kiểm tra gói của nền tảng và yêu cầu hoàn tiền. Không đọc
// cơ sở dữ liệu; `platform-sales.ts` dùng các hàm này. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11: giữ chỗ chờ thanh toán 15
// phút; nội dung chuyển khoản bắt đầu bằng `GSAI` để không lẫn với hóa đơn dịch vụ (`HD...`); giá gói từ 1.000 đến 10.000.000 đồng.

export const PENDING_PAYMENT_MINUTES = 15;
export const TRANSFER_PREFIX = 'GSAI';
export const PLAN_PRICE_MIN = 1_000;
export const PLAN_PRICE_MAX = 10_000_000;
export const SCHOOL_LEVELS: readonly AiTutorSchoolLevel[] = ['TH', 'THCS', 'THPT'];

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const TRANSFER_PATTERN = new RegExp(`${TRANSFER_PREFIX}(\\d{8})(\\d{4,})`);

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded' | 'needs_refund';

// Ngày theo giờ Việt Nam dạng `YYYYMMDD`
function vietnamDay(moment: Date): string {
  return new Date(moment.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10).replaceAll('-', '');
}

function padded(sequence: number): string {
  return String(sequence).padStart(4, '0');
}

// Mã giao dịch hiện cho người dùng: `GD-20261030-0142`
export function orderCode(moment: Date, sequence: number): string {
  return `GD-${vietnamDay(moment)}-${padded(sequence)}`;
}

// Nội dung chuyển khoản: chỉ chữ in hoa và số vì ngân hàng bỏ dấu, bỏ ký tự đặc biệt
export function transferContentOf(moment: Date, sequence: number): string {
  return `${TRANSFER_PREFIX}${vietnamDay(moment)}${padded(sequence)}`;
}

export function receiptNumber(moment: Date, sequence: number): string {
  return `BL-${vietnamDay(moment)}-${padded(sequence)}`;
}

// Mã giao dịch nằm trong nội dung chuyển khoản của ngân hàng (có thể kèm chữ khác); không có thì trả null và khoản tiền không thuộc gia sư AI
export function transferCodeIn(content: string): string | null {
  const normalized = content.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = TRANSFER_PATTERN.exec(normalized);
  return match ? `${TRANSFER_PREFIX}${match[1]}${match[2]}` : null;
}

export function pendingExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PENDING_PAYMENT_MINUTES * 60 * 1000);
}

export type PaymentDecision = 'activate' | 'already_settled' | 'amount_mismatch' | 'late';

// Cách xử lý một khoản tiền vào khớp giao dịch:
// - giao dịch đã thu, đã hoàn hoặc đang chờ hoàn: không làm gì thêm;
// - sai số tiền: giữ nguyên giao dịch, nhân viên vận hành đối soát;
// - giao dịch đã hủy, đã quá hạn, hoặc tiền ghi nhận sau hạn giữ chỗ: không kích hoạt, chuyển chờ hoàn tiền;
// - còn lại: kích hoạt
export function decidePayment(
  order: { status: OrderStatus; amount: number; pendingExpiresAt: Date },
  payment: { amount: number; receivedAt: Date },
): PaymentDecision {
  if (order.status === 'paid' || order.status === 'refunded' || order.status === 'needs_refund') {
    return 'already_settled';
  }
  if (payment.amount !== order.amount) {
    return 'amount_mismatch';
  }
  if (order.status !== 'pending' || payment.receivedAt.getTime() > order.pendingExpiresAt.getTime()) {
    return 'late';
  }
  return 'activate';
}

export function canCancel(status: OrderStatus): boolean {
  return status === 'pending';
}

export function canRefund(status: OrderStatus): boolean {
  return status === 'paid' || status === 'needs_refund';
}

export interface PlatformPlanInput {
  kind: AiTutorPlanKind;
  name: string;
  price: number;
  turns: number;
  allowImages: boolean;
  schoolLevels: AiTutorSchoolLevel[];
}

// Kiểm tra dữ liệu gói của nền tảng. Khi sửa (`existingKind` có giá trị) không đổi được loại gói
export function readPlanInput(
  body: Record<string, unknown> | undefined,
  existingKind: AiTutorPlanKind | null,
): { value: PlatformPlanInput | null; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const kind = existingKind ?? body?.kind;
  if (kind !== 'monthly' && kind !== 'top_up') {
    errors.push({ field: 'kind', message: 'Loại gói là gói tháng (monthly) hoặc gói lượt (top_up)' });
  }
  if (existingKind && body?.kind !== undefined && body.kind !== existingKind) {
    errors.push({ field: 'kind', message: 'Không đổi được loại gói; hãy ngừng bán gói này và tạo gói mới' });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 80) {
    errors.push({ field: 'name', message: 'Tên gói từ 1 đến 80 ký tự' });
  }
  const price = body?.price;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < PLAN_PRICE_MIN || price > PLAN_PRICE_MAX) {
    errors.push({
      field: 'price',
      message: `Giá là số nguyên đồng từ ${PLAN_PRICE_MIN.toLocaleString('vi-VN')} đến ${PLAN_PRICE_MAX.toLocaleString('vi-VN')}`,
    });
  }
  const turns = body?.turns;
  if (typeof turns !== 'number' || !Number.isInteger(turns) || turns < 1 || turns > 100_000) {
    errors.push({ field: 'turns', message: 'Số lượt là số nguyên từ 1 đến 100.000' });
  }
  const allowImages = body?.allow_images ?? false;
  if (typeof allowImages !== 'boolean') {
    errors.push({ field: 'allow_images', message: 'Chọn có hoặc không cho gửi ảnh' });
  } else if (allowImages && kind === 'top_up') {
    errors.push({ field: 'allow_images', message: 'Chỉ gói tháng mới cho gửi ảnh' });
  }
  const levels = body?.school_levels;
  const validLevels =
    Array.isArray(levels) &&
    levels.length > 0 &&
    levels.every((level) => SCHOOL_LEVELS.includes(level as AiTutorSchoolLevel));
  if (!validLevels) {
    errors.push({
      field: 'school_levels',
      message: 'Chọn ít nhất một cấp: Tiểu học, Trung học cơ sở, Trung học phổ thông',
    });
  }
  if (errors.length > 0) {
    return { value: null, errors };
  }
  return {
    value: {
      kind: kind as AiTutorPlanKind,
      name,
      price: price as number,
      turns: turns as number,
      allowImages: allowImages as boolean,
      schoolLevels: SCHOOL_LEVELS.filter((level) => (levels as string[]).includes(level)),
    },
    errors,
  };
}

// Yêu cầu hoàn tiền: số hoàn là số nguyên dương không quá số đã thu; lý do bắt buộc
export function readRefundInput(
  body: Record<string, unknown> | undefined,
  paidAmount: number,
): { value: { amount: number; reason: string } | null; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const amount = body?.amount ?? paidAmount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > paidAmount) {
    errors.push({
      field: 'amount',
      message: `Số hoàn là số nguyên đồng từ 1 đến ${paidAmount.toLocaleString('vi-VN')}`,
    });
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 500) {
    errors.push({ field: 'reason', message: 'Nhập lý do hoàn tiền (tối đa 500 ký tự)' });
  }
  return errors.length > 0 ? { value: null, errors } : { value: { amount: amount as number, reason }, errors };
}

// Dòng mô tả trên biên lai
export function receiptDescription(order: {
  planName: string;
  planKind: AiTutorPlanKind;
  periodMonth: string | null;
  turns: number;
  kind: 'purchase' | 'upgrade';
}): string {
  const head = order.kind === 'upgrade' ? `Nâng lên gói ${order.planName}` : `Gói ${order.planName}`;
  if (order.planKind === 'monthly' && order.periodMonth) {
    const [year, month] = order.periodMonth.split('-');
    const detail =
      order.kind === 'upgrade'
        ? 'phần chênh lệch theo số ngày còn lại của tháng'
        : `${order.turns.toLocaleString('vi-VN')} lượt hỏi`;
    return `${head} tháng ${Number(month)}/${year} (${detail})`;
  }
  return `${head} (${order.turns.toLocaleString('vi-VN')} lượt hỏi, dùng trong 12 tháng)`;
}
