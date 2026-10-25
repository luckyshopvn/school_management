import type { BillingPeriod, InvoiceLineKind, PriceComponent, StudentTier } from '../../platform/schema.js';

// Hàm tính phí thuần của thu phí tự động (DT-SaaS phần S5b, YCTD-196, GD-94). Số tiền là số nguyên đồng; mọi phép tính trên số
// nguyên, VAT làm tròn nửa lên. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11:
// - bậc thang theo học sinh có hai cách: lũy tiến (`graduated`, mỗi bậc tính phần học sinh rơi vào bậc đó) và theo bậc cả gói
//   (`volume`, mọi học sinh tính theo đơn giá của bậc chứa tổng số học sinh);
// - theo phân hệ: chỉ tính phân hệ có giá trong quy tắc và đang bật trong gói (gói bật mọi phân hệ thì tính mọi phân hệ có giá);
// - phí tối thiểu so với tổng các thành phần trước giảm giá, thiếu thì thêm dòng bù; giảm giá không vượt tổng trước giảm giá;
// - VAT tính trên số sau giảm giá.

export interface PriceRule {
  code: string;
  name: string;
  components: PriceComponent[];
  studentTiers: StudentTier[];
  tierMode: 'graduated' | 'volume';
  schoolFee: number;
  modulePrices: Record<string, number>;
  minimumFee: number;
  period: BillingPeriod;
  vatPercent: number;
  dueDays: number;
}

export interface BillingUsage {
  activeStudents: number;
  storageMb: number;
  schoolLevels: number;
  // Phân hệ được bật; null là mọi phân hệ
  modules: string[] | null;
}

export interface ChargeLine {
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Charges {
  lines: ChargeLine[];
  subtotal: number;
  discountTotal: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
}

export class PricingError extends Error {}

const money = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new PricingError(`${label} phải là số nguyên đồng không âm`);
  }
  return value;
};

const formatNumber = (value: number) => value.toLocaleString('vi-VN');

// Kiểm tra quy tắc trước khi lưu và trước khi tính: bậc tăng dần, bậc cuối không giới hạn, số tiền nguyên không âm
export function validatePriceRule(rule: PriceRule): void {
  if (rule.components.length === 0) {
    throw new PricingError('Quy tắc phải có ít nhất một thành phần tính phí');
  }
  let previous = 0;
  rule.studentTiers.forEach((tier, index) => {
    money(tier.unit_price, 'Đơn giá bậc');
    const last = index === rule.studentTiers.length - 1;
    if (tier.up_to === null) {
      if (!last) {
        throw new PricingError('Chỉ bậc cuối được để trống số học sinh tối đa');
      }
      return;
    }
    if (!Number.isSafeInteger(tier.up_to) || tier.up_to <= previous) {
      throw new PricingError('Số học sinh tối đa của các bậc phải tăng dần');
    }
    previous = tier.up_to;
  });
  if (rule.components.includes('per_student') && rule.studentTiers.at(-1)?.up_to !== null) {
    throw new PricingError('Bậc cuối của bảng giá theo học sinh phải để trống số học sinh tối đa');
  }
  money(rule.schoolFee, 'Phí theo trường');
  money(rule.minimumFee, 'Phí tối thiểu');
  for (const [module, price] of Object.entries(rule.modulePrices)) {
    money(price, `Giá phân hệ ${module}`);
  }
  if (!Number.isInteger(rule.vatPercent) || rule.vatPercent < 0 || rule.vatPercent > 100) {
    throw new PricingError('VAT là số nguyên từ 0 đến 100');
  }
}

function studentLines(rule: PriceRule, students: number): ChargeLine[] {
  if (students <= 0 || rule.studentTiers.length === 0) {
    return [];
  }
  if (rule.tierMode === 'volume') {
    const tier = rule.studentTiers.find((item) => item.up_to === null || students <= item.up_to) as StudentTier;
    return [
      {
        kind: 'per_student',
        description: `Học sinh đang học (${formatNumber(students)} học sinh)`,
        quantity: students,
        unitPrice: tier.unit_price,
        amount: students * tier.unit_price,
      },
    ];
  }
  const lines: ChargeLine[] = [];
  let lower = 0;
  for (const tier of rule.studentTiers) {
    const upper = tier.up_to === null ? students : Math.min(students, tier.up_to);
    const quantity = upper - lower;
    if (quantity > 0) {
      const band =
        tier.up_to === null
          ? `từ ${formatNumber(lower + 1)}`
          : `${formatNumber(lower + 1)}–${formatNumber(tier.up_to)}`;
      lines.push({
        kind: 'per_student',
        description: `Học sinh đang học, bậc ${band}`,
        quantity,
        unitPrice: tier.unit_price,
        amount: quantity * tier.unit_price,
      });
    }
    if (tier.up_to === null || students <= tier.up_to) {
      break;
    }
    lower = tier.up_to;
  }
  return lines;
}

// Tính dòng và tổng tiền một kỳ. `moduleLabels` cho tên phân hệ trên dòng; `allModules` là danh sách phân hệ khi gói bật mọi phân hệ
export function computeCharges(
  rule: PriceRule,
  usage: BillingUsage,
  options: { discount?: number; allModules: string[]; moduleLabels?: Record<string, string> },
): Charges {
  validatePriceRule(rule);
  if (!Number.isSafeInteger(usage.activeStudents) || usage.activeStudents < 0) {
    throw new PricingError('Số học sinh phải là số nguyên không âm');
  }
  const lines: ChargeLine[] = [];
  if (rule.components.includes('per_student')) {
    lines.push(...studentLines(rule, usage.activeStudents));
  }
  if (rule.components.includes('per_school') && rule.schoolFee > 0) {
    lines.push({
      kind: 'per_school',
      description: 'Phí theo trường',
      quantity: 1,
      unitPrice: rule.schoolFee,
      amount: rule.schoolFee,
    });
  }
  if (rule.components.includes('per_module')) {
    const enabled = usage.modules ?? options.allModules;
    for (const module of enabled) {
      const price = rule.modulePrices[module] ?? 0;
      if (price > 0) {
        lines.push({
          kind: 'per_module',
          description: `Phân hệ ${options.moduleLabels?.[module] ?? module}`,
          quantity: 1,
          unitPrice: price,
          amount: price,
        });
      }
    }
  }
  const charged = lines.reduce((sum, line) => sum + line.amount, 0);
  if (charged < rule.minimumFee) {
    const gap = rule.minimumFee - charged;
    lines.push({
      kind: 'minimum',
      description: `Bù phí tối thiểu ${formatNumber(rule.minimumFee)} đồng`,
      quantity: 1,
      unitPrice: gap,
      amount: gap,
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const discountTotal = Math.min(money(options.discount ?? 0, 'Giảm giá'), subtotal);
  if (discountTotal > 0) {
    lines.push({
      kind: 'discount',
      description: 'Giảm giá',
      quantity: 1,
      unitPrice: -discountTotal,
      amount: -discountTotal,
    });
  }
  const base = subtotal - discountTotal;
  const vatAmount = Math.floor((base * rule.vatPercent + 50) / 100);
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(base + vatAmount)) {
    throw new PricingError('Số tiền vượt giới hạn');
  }
  return { lines, subtotal, discountTotal, vatPercent: rule.vatPercent, vatAmount, total: base + vatAmount };
}

// Kỳ thu của gói chưa chọn quy tắc: học kỳ (`term`) tính là quý
export function periodOfCycle(cycle: 'monthly' | 'term' | 'yearly'): BillingPeriod {
  return cycle === 'term' ? 'quarterly' : cycle;
}

// Quy tắc suy ra từ giá niêm yết của gói (S5a) khi gói chưa chọn quy tắc
export function ruleFromPlanPrices(plan: {
  code: string;
  name: string;
  pricing_mode: PriceComponent;
  unit_price: number;
  minimum_fee: number;
  module_prices: Record<string, number>;
  billing_cycle: 'monthly' | 'term' | 'yearly';
}): PriceRule {
  return {
    code: `goi-${plan.code}`,
    name: `Giá niêm yết của gói ${plan.name}`,
    components: [plan.pricing_mode],
    studentTiers: plan.pricing_mode === 'per_student' ? [{ up_to: null, unit_price: plan.unit_price }] : [],
    tierMode: 'graduated',
    schoolFee: plan.pricing_mode === 'per_school' ? plan.unit_price : 0,
    modulePrices: plan.module_prices,
    minimumFee: plan.minimum_fee,
    period: periodOfCycle(plan.billing_cycle),
    vatPercent: 0,
    dueDays: 15,
  };
}
