import { PricingError, type ChargeLine } from './pricing.js';

// Thành phần phí AI của quy tắc tính phí (DT-23 phần 23d, YCTD-214, GD-103). Hàm thuần, số nguyên đồng. Claude tự chọn theo ủy quyền
// của Eric ngày 2026-10-11:
// - đơn giá tính theo một nghìn token vào và ra (đồng), có thể khác nhau, có thể riêng theo mô hình (thiếu thì dùng đơn giá chung);
//   đơn giá để trống (chưa nhập lúc triển khai) thì mô hình đó chưa tính được: không thu, ghi vào danh sách `unpriced`;
// - token miễn phí mỗi kỳ trừ **theo tỷ lệ** vào chi phí của mọi mô hình (không phụ thuộc thứ tự mô hình, không ưu tiên token vào hay ra):
//   phần phải trả của một mô hình = chi phí thô × (tổng token − token miễn phí) ÷ tổng token; dùng số nguyên lớn nên không lệch do làm tròn;
// - mỗi dòng làm tròn **lên** theo bội của bước làm tròn (đồng); tổng các dòng nhỏ hơn phí tối thiểu thì thêm dòng bù (chỉ khi kỳ có
//   dùng AI ở cấu hình `platform`, kỳ không dùng thì không có dòng nào);
// - dòng phí AI không tính vào phí tối thiểu chung của quy tắc (thành phần riêng) nhưng có trong tổng trước giảm giá và chịu VAT.

export interface AiPricing {
  freeTokens: number;
  inputPricePer1k: number | null;
  outputPricePer1k: number | null;
  modelPrices: Record<string, { input: number; output: number }>;
  minimumFee: number;
  roundingStep: number;
}

export interface AiModelUsage {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AiCharges {
  lines: ChargeLine[];
  unpriced: string[];
  totalTokens: number;
  freeTokensApplied: number;
}

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

const natural = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PricingError(`${label} phải là số nguyên không âm`);
  }
  return value;
};

export function validateAiPricing(pricing: AiPricing): void {
  natural(pricing.freeTokens, 'Số token miễn phí');
  natural(pricing.minimumFee, 'Phí tối thiểu AI');
  if (!Number.isSafeInteger(pricing.roundingStep) || pricing.roundingStep < 1) {
    throw new PricingError('Bước làm tròn phải là số nguyên từ 1');
  }
  if (pricing.inputPricePer1k !== null) natural(pricing.inputPricePer1k, 'Đơn giá token vào');
  if (pricing.outputPricePer1k !== null) natural(pricing.outputPricePer1k, 'Đơn giá token ra');
  for (const [model, price] of Object.entries(pricing.modelPrices)) {
    natural(price.input, `Đơn giá token vào của ${model}`);
    natural(price.output, `Đơn giá token ra của ${model}`);
  }
}

// Gói đã đặt đủ đơn giá chung để thu phí theo token (số tiền để trống cho đến khi nhập lúc triển khai)
export function aiPricingReady(pricing: AiPricing | null): pricing is AiPricing {
  return pricing !== null && pricing.inputPricePer1k !== null && pricing.outputPricePer1k !== null;
}

function priceOf(pricing: AiPricing, model: string): { input: number; output: number } | null {
  const own = Object.hasOwn(pricing.modelPrices, model) ? pricing.modelPrices[model] : undefined;
  if (own) {
    return own;
  }
  return pricing.inputPricePer1k !== null && pricing.outputPricePer1k !== null
    ? { input: pricing.inputPricePer1k, output: pricing.outputPricePer1k }
    : null;
}

const ceilDivide = (numerator: bigint, denominator: bigint): bigint =>
  numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;

export function computeAiCharges(pricing: AiPricing, usage: AiModelUsage[]): AiCharges {
  validateAiPricing(pricing);
  const used = usage.filter((item) => item.requests > 0 || item.inputTokens > 0 || item.outputTokens > 0);
  for (const item of used) {
    natural(item.inputTokens, 'Số token vào');
    natural(item.outputTokens, 'Số token ra');
  }
  const priced = used.flatMap((item) => {
    const price = priceOf(pricing, item.model);
    return price ? [{ ...item, price }] : [];
  });
  const unpriced = used.filter((item) => priceOf(pricing, item.model) === null).map((item) => item.model);
  const total = priced.reduce((sum, item) => sum + BigInt(item.inputTokens) + BigInt(item.outputTokens), 0n);
  if (priced.length === 0) {
    return { lines: [], unpriced, totalTokens: 0, freeTokensApplied: 0 };
  }
  const free = BigInt(pricing.freeTokens) < total ? BigInt(pricing.freeTokens) : total;
  const step = BigInt(pricing.roundingStep);
  const lines: ChargeLine[] = [];
  for (const item of priced) {
    const tokens = BigInt(item.inputTokens) + BigInt(item.outputTokens);
    if (tokens === 0n) {
      continue;
    }
    const raw = BigInt(item.inputTokens) * BigInt(item.price.input) + BigInt(item.outputTokens) * BigInt(item.price.output);
    const payableRaw = total === 0n ? 0n : (raw * (total - free)) / total;
    const amount = ceilDivide(payableRaw, 1000n * step) * step;
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new PricingError('Số tiền vượt giới hạn');
    }
    if (amount > 0n) {
      lines.push({
        kind: 'ai',
        description: `Trợ lý AI, mô hình ${item.model}: ${formatNumber(item.inputTokens)} token vào, ${formatNumber(item.outputTokens)} token ra`,
        quantity: 1,
        unitPrice: Number(amount),
        amount: Number(amount),
      });
    }
  }
  const sum = lines.reduce((acc, line) => acc + line.amount, 0);
  if (sum < pricing.minimumFee) {
    const gap = pricing.minimumFee - sum;
    lines.push({
      kind: 'ai',
      description: `Bù phí tối thiểu của trợ lý AI ${formatNumber(pricing.minimumFee)} đồng`,
      quantity: 1,
      unitPrice: gap,
      amount: gap,
    });
  }
  if (free > 0n && lines.length > 0) {
    const first = lines[0] as ChargeLine;
    first.description += `; đã trừ ${formatNumber(Number(free))} token miễn phí chia theo tỷ lệ`;
  }
  return { lines, unpriced, totalTokens: Number(total), freeTokensApplied: Number(free) };
}
