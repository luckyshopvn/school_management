import type { BillingPeriod } from '../../platform/schema.js';

// Kỳ thu theo lịch (DT-SaaS phần S5b): tháng, quý, năm bắt đầu từ ngày đầu tháng, đầu quý, đầu năm theo giờ Việt Nam. Ngày dạng yyyy-mm-dd

export interface BillingRange {
  start: string;
  end: string;
}

const MONTHS: Record<BillingPeriod, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const pad = (value: number) => String(value).padStart(2, '0');

function monthStart(year: number, monthIndex: number): string {
  const total = year * 12 + monthIndex;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

// Kỳ chứa ngày `date`
export function periodContaining(date: string, period: BillingPeriod): BillingRange {
  const [year, month] = date.split('-').map(Number) as [number, number];
  const length = MONTHS[period];
  const firstMonth = Math.floor((month - 1) / length) * length;
  const start = monthStart(year, firstMonth);
  const end = dayBefore(monthStart(year, firstMonth + length));
  return { start, end };
}

export function previousPeriod(range: BillingRange, period: BillingPeriod): BillingRange {
  return periodContaining(dayBefore(range.start), period);
}

export function nextPeriod(range: BillingRange, period: BillingPeriod): BillingRange {
  const following = new Date(Date.parse(`${range.end}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return periodContaining(following, period);
}

export function periodLabel(range: BillingRange, period: BillingPeriod): string {
  const [year, month] = range.start.split('-').map(Number) as [number, number];
  if (period === 'yearly') {
    return `năm ${year}`;
  }
  if (period === 'quarterly') {
    return `quý ${Math.floor((month - 1) / 3) + 1}/${year}`;
  }
  return `tháng ${month}/${year}`;
}
