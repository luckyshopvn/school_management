import type { PayslipSection, TaxBracket } from '@school-management/database';

// Phép tính bảng lương không phụ thuộc cơ sở dữ liệu (BR-43, BR-44, BR-82, Q-154, Q-155; YCTD-60). Số tiền làm tròn
// đến đồng; thu nhập mang dấu dương, khấu trừ mang dấu âm
export interface PayItemAssignment {
  kind: 'allowance' | 'deduction';
  code: string;
  name: string;
  calculation_method: 'fixed_monthly' | 'per_workday' | 'percent_of_base';
  amount: number | null;
  rate_percent: number | null;
  is_tax_exempt: boolean;
  is_mandatory_insurance: boolean;
}

export interface TimesheetTotals {
  workdayRows: number;
  unpaidDays: number;
  workedDays: number;
  overtimeMinutes: number;
}

export interface PayslipLine {
  section: PayslipSection;
  line_type: string;
  code: string;
  name: string;
  amount: number;
  basis: string;
  tax_exempt: boolean;
  mandatory_insurance: boolean;
}

export interface PayslipInput {
  prepaid: {
    contractNo: string;
    baseSalary: number;
    contractAllowances: Array<{ name: string; amount: number }>;
  } | null;
  adjustment: {
    contractNo: string;
    baseSalary: number;
    // Đã được trả trước tháng trước thì trừ ngày không hưởng lương; mới vào làm trong tháng trước thì trả phần tháng đầu
    prepaidLastMonth: boolean;
    standardDays: number;
    standardMinutes: number;
    overtimeRatePercent: number | null;
    totals: TimesheetTotals;
    month: string;
  } | null;
  items: PayItemAssignment[];
  // Khoản điều chỉnh đã duyệt cho tháng này (BR-45)
  manualAdjustments?: Array<{ amount: number; reason: string }>;
  dependents: number;
  taxTable: { personal_deduction: number; dependent_deduction: number; brackets: TaxBracket[] };
}

const money = new Intl.NumberFormat('vi-VN');

function formatDays(value: number): string {
  return String(value).replace('.', ',');
}

// Thuế lũy tiến từng phần: mỗi bậc chịu thuế suất của bậc trên phần thu nhập nằm trong bậc đó
export function progressiveTax(taxable: number, brackets: TaxBracket[]): number {
  let remaining = taxable;
  let lower = 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) {
      break;
    }
    const width = bracket.up_to === null ? remaining : Math.min(remaining, bracket.up_to - lower);
    tax += (width * bracket.rate_percent) / 100;
    remaining -= width;
    lower = bracket.up_to ?? lower;
  }
  return Math.round(tax);
}

function itemLine(section: PayslipSection, item: PayItemAssignment, amount: number, basis: string): PayslipLine {
  const signed = item.kind === 'allowance' ? amount : -amount;
  return {
    section,
    line_type: item.kind,
    code: item.code,
    name: item.name,
    amount: signed,
    basis,
    tax_exempt: item.is_tax_exempt,
    mandatory_insurance: item.is_mandatory_insurance,
  };
}

export function calculatePayslip(input: PayslipInput) {
  const lines: PayslipLine[] = [];
  const plain = { tax_exempt: false, mandatory_insurance: false };
  if (input.prepaid) {
    const base = input.prepaid.baseSalary;
    lines.push({
      section: 'prepaid',
      line_type: 'base_salary',
      code: 'LUONG_HD',
      name: 'Lương hợp đồng',
      amount: base,
      basis: `Hợp đồng ${input.prepaid.contractNo}`,
      ...plain,
    });
    for (const allowance of input.prepaid.contractAllowances) {
      lines.push({
        section: 'prepaid',
        line_type: 'contract_allowance',
        code: 'PC_HD',
        name: allowance.name,
        amount: allowance.amount,
        basis: `Phụ cấp theo hợp đồng ${input.prepaid.contractNo}`,
        ...plain,
      });
    }
    for (const item of input.items) {
      if (item.calculation_method === 'fixed_monthly' && item.amount !== null) {
        lines.push(itemLine('prepaid', item, item.amount, 'Số tiền cố định mỗi tháng'));
      }
      if (item.calculation_method === 'percent_of_base' && item.rate_percent !== null) {
        lines.push(
          itemLine(
            'prepaid',
            item,
            Math.round((base * item.rate_percent) / 100),
            `${money.format(base)} × ${formatDays(item.rate_percent)}%`,
          ),
        );
      }
    }
  }
  const adjustment = input.adjustment;
  if (adjustment && adjustment.standardDays > 0) {
    const { baseSalary: base, standardDays, totals } = adjustment;
    const label = `tháng ${Number(adjustment.month.slice(5))}/${adjustment.month.slice(0, 4)}`;
    if (adjustment.prepaidLastMonth) {
      if (totals.unpaidDays > 0) {
        lines.push({
          section: 'adjustment',
          line_type: 'unpaid_days',
          code: 'NGAY_KHONG_LUONG',
          name: `Trừ ngày không hưởng lương ${label}`,
          amount: -Math.round((base * totals.unpaidDays) / standardDays),
          basis: `${money.format(base)} × ${formatDays(totals.unpaidDays)} / ${standardDays} ngày công chuẩn`,
          ...plain,
        });
      }
    } else {
      const paidDays = totals.workdayRows - totals.unpaidDays;
      lines.push({
        section: 'adjustment',
        line_type: 'first_month',
        code: 'LUONG_THANG_DAU',
        name: `Lương ${label} theo ngày công`,
        amount: Math.round((base * paidDays) / standardDays),
        basis: `${money.format(base)} × ${formatDays(paidDays)} / ${standardDays} ngày công chuẩn`,
        ...plain,
      });
    }
    if (totals.overtimeMinutes > 0 && adjustment.overtimeRatePercent !== null && adjustment.standardMinutes > 0) {
      lines.push({
        section: 'adjustment',
        line_type: 'overtime',
        code: 'LAM_THEM',
        name: `Làm thêm giờ ${label}`,
        amount: Math.round(
          (base * totals.overtimeMinutes * adjustment.overtimeRatePercent) /
            (standardDays * adjustment.standardMinutes * 100),
        ),
        basis: `${money.format(base)} / ${standardDays} ngày / ${formatDays(adjustment.standardMinutes / 60)} giờ × ${adjustment.overtimeRatePercent}% × ${formatDays(totals.overtimeMinutes / 60)} giờ`,
        ...plain,
      });
    }
    for (const item of input.items) {
      if (item.calculation_method === 'per_workday' && item.amount !== null && totals.workedDays > 0) {
        lines.push(
          itemLine(
            'adjustment',
            item,
            Math.round(item.amount * totals.workedDays),
            `${money.format(item.amount)} × ${formatDays(totals.workedDays)} ngày đi làm ${label}`,
          ),
        );
      }
    }
  }
  for (const manual of input.manualAdjustments ?? []) {
    lines.push({
      section: 'adjustment',
      line_type: 'manual_adjustment',
      code: 'DIEU_CHINH',
      name: `Điều chỉnh: ${manual.reason}`,
      amount: manual.amount,
      basis: 'Khoản điều chỉnh đã được phê duyệt (BR-45)',
      ...plain,
    });
  }
  const income = lines.filter((line) => line.line_type !== 'deduction').reduce((total, line) => total + line.amount, 0);
  const exempt = lines.filter((line) => line.tax_exempt).reduce((total, line) => total + line.amount, 0);
  const insurance = lines.filter((line) => line.mandatory_insurance).reduce((total, line) => total - line.amount, 0);
  const familyDeduction = input.taxTable.personal_deduction + input.dependents * input.taxTable.dependent_deduction;
  const taxable = Math.max(0, income - exempt - insurance - familyDeduction);
  const tax = progressiveTax(taxable, input.taxTable.brackets);
  if (tax > 0) {
    lines.push({
      section: 'tax',
      line_type: 'tax',
      code: 'THUE_TNCN',
      name: 'Thuế thu nhập cá nhân',
      amount: -tax,
      basis: `Thu nhập tính thuế ${money.format(taxable)} = ${money.format(income)} − miễn thuế ${money.format(exempt)} − bảo hiểm ${money.format(insurance)} − giảm trừ gia cảnh ${money.format(familyDeduction)} (${input.dependents} người phụ thuộc)`,
      ...plain,
    });
  }
  const sum = (section: PayslipSection) =>
    lines.filter((line) => line.section === section).reduce((total, line) => total + line.amount, 0);
  return {
    lines,
    prepaid_amount: sum('prepaid'),
    adjustment_amount: sum('adjustment'),
    taxable_income: taxable,
    tax_amount: tax,
    net_amount: lines.reduce((total, line) => total + line.amount, 0),
  };
}
