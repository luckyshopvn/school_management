import { randomInt } from 'node:crypto';
import type { FieldError } from '@school-management/server';
import type { EquipmentReportRow } from './equipment-report-calc.js';

// Quy tắc của kiểm kê thiết bị và đối sánh danh mục tối thiểu (DT-18 phần 18g, YCTD-143). Hàm thuần để kiểm thử từng quy tắc:
// - một dòng kiểm kê là một tài sản (từng thiết bị, số theo sổ là 1) hoặc một lô (số theo sổ là số hiện có của lô);
// - quét tài sản thì chọn tình trạng: dùng được, hỏng cần sửa, hỏng không dùng được (đếm được 1, dùng được 1 nếu dùng
//   được), không tìm thấy (đếm được 0); quét lô thì nhập số đếm được và số dùng được (không quá số đếm được), tình trạng
//   suy ra: đếm được 0 là không tìm thấy, dùng được bằng số đếm được là dùng được, còn lại là hỏng cần sửa;
// - chênh lệch = số đếm được − số theo sổ: âm là thiếu, dương là thừa, 0 là khớp; dòng chưa quét là chưa kiểm;
// - tỷ lệ sử dụng được = tổng số dùng được / tổng số đếm được, một chữ số thập phân;
// - đối sánh danh mục tối thiểu: thiết bị có định mức mà hiện có đủ định mức là "Đủ", có nhưng chưa đủ là "Thiếu", hiện
//   có 0 là "Chưa có"
export type Condition = 'good' | 'damaged' | 'unusable' | 'missing';
export type TargetType = 'asset' | 'holding';

export interface ScanInput {
  condition: Condition | null;
  counted_quantity: number | null;
  usable_quantity: number | null;
}

export interface ScanResult {
  condition: Condition;
  counted_quantity: number;
  usable_quantity: number;
}

const CONDITIONS: Condition[] = ['good', 'damaged', 'unusable', 'missing'];
const MAX_QUANTITY = 100_000;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && (CONDITIONS as string[]).includes(value);
}

export function normalizeScan(targetType: TargetType, input: ScanInput, errors: FieldError[]): ScanResult | null {
  if (targetType === 'asset') {
    if (!input.condition) {
      errors.push({ field: 'condition', message: 'Bắt buộc chọn tình trạng' });
      return null;
    }
    const counted = input.condition === 'missing' ? 0 : 1;
    return {
      condition: input.condition,
      counted_quantity: counted,
      usable_quantity: input.condition === 'good' ? 1 : 0,
    };
  }
  const counted = input.counted_quantity;
  if (counted === null || !Number.isFinite(counted) || counted < 0 || counted > MAX_QUANTITY) {
    errors.push({ field: 'counted_quantity', message: `Số đếm được từ 0 đến ${MAX_QUANTITY}` });
    return null;
  }
  const usable = input.usable_quantity ?? (input.condition === 'good' || input.condition === null ? counted : 0);
  if (!Number.isFinite(usable) || usable < 0 || usable > counted) {
    errors.push({ field: 'usable_quantity', message: 'Số dùng được từ 0 đến số đếm được' });
    return null;
  }
  const countedRounded = round2(counted);
  const usableRounded = round2(usable);
  const condition: Condition =
    countedRounded === 0
      ? 'missing'
      : usableRounded === countedRounded
        ? 'good'
        : input.condition === 'unusable'
          ? 'unusable'
          : 'damaged';
  return {
    condition,
    counted_quantity: countedRounded,
    usable_quantity: usableRounded,
  };
}

export interface LineForSummary {
  in_scope: boolean;
  expected_quantity: number;
  counted_quantity: number | null;
  usable_quantity: number | null;
  condition: Condition | null;
}

export type LineStatus = 'unchecked' | 'matched' | 'shortage' | 'surplus';

export function lineStatus(line: LineForSummary): { status: LineStatus; difference: number | null } {
  if (line.counted_quantity === null) {
    return { status: 'unchecked', difference: null };
  }
  const difference = round2(line.counted_quantity - line.expected_quantity);
  return { status: difference === 0 ? 'matched' : difference < 0 ? 'shortage' : 'surplus', difference };
}

export interface StocktakeSummary {
  line_count: number;
  counted_count: number;
  unchecked_count: number;
  matched_count: number;
  shortage_count: number;
  surplus_count: number;
  out_of_scope_count: number;
  expected_total: number;
  counted_total: number;
  usable_total: number;
  shortage_quantity: number;
  surplus_quantity: number;
  usable_rate_percent: number | null;
  conditions: Record<Condition, number>;
}

export function summarizeStocktake(lines: LineForSummary[]): StocktakeSummary {
  const summary: StocktakeSummary = {
    line_count: lines.length,
    counted_count: 0,
    unchecked_count: 0,
    matched_count: 0,
    shortage_count: 0,
    surplus_count: 0,
    out_of_scope_count: lines.filter((line) => !line.in_scope).length,
    expected_total: 0,
    counted_total: 0,
    usable_total: 0,
    shortage_quantity: 0,
    surplus_quantity: 0,
    usable_rate_percent: null,
    conditions: { good: 0, damaged: 0, unusable: 0, missing: 0 },
  };
  for (const line of lines) {
    summary.expected_total = round2(summary.expected_total + line.expected_quantity);
    const { status, difference } = lineStatus(line);
    if (status === 'unchecked') {
      summary.unchecked_count += 1;
      continue;
    }
    summary.counted_count += 1;
    summary.counted_total = round2(summary.counted_total + (line.counted_quantity ?? 0));
    summary.usable_total = round2(summary.usable_total + (line.usable_quantity ?? 0));
    if (line.condition) {
      summary.conditions[line.condition] += 1;
    }
    if (status === 'matched') {
      summary.matched_count += 1;
    } else if (status === 'shortage') {
      summary.shortage_count += 1;
      summary.shortage_quantity = round2(summary.shortage_quantity - (difference ?? 0));
    } else {
      summary.surplus_count += 1;
      summary.surplus_quantity = round2(summary.surplus_quantity + (difference ?? 0));
    }
  }
  summary.usable_rate_percent =
    summary.counted_total > 0 ? Math.round((summary.usable_total / summary.counted_total) * 1000) / 10 : null;
  return summary;
}

// Mã tem: "TB-" và 10 ký tự Crockford base32 (bỏ I, L, O, U để đọc tay không nhầm)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateQrCode(next: (max: number) => number = randomInt): string {
  let code = 'TB-';
  for (let index = 0; index < 10; index += 1) {
    code += ALPHABET[next(ALPHABET.length)];
  }
  return code;
}

export type ComparisonStatus = 'enough' | 'short' | 'none';

export interface ComparisonRow {
  equipment_item_id: string;
  code: string;
  name: string;
  unit: string;
  age_group: string;
  equipment_group: string;
  norm: number;
  available: number;
  shortage: number;
  status: ComparisonStatus;
}

export interface Comparison {
  rows: ComparisonRow[];
  totals: { item_count: number; enough: number; short: number; none: number; rate_percent: number | null };
}

// Chỉ thiết bị tối thiểu có định mức (nhóm tuổi có lớp trong phạm vi); thiết bị của nhóm tuổi không có lớp không áp dụng
export function compareMinimum(rows: EquipmentReportRow[]): Comparison {
  const result: ComparisonRow[] = rows
    .filter((row) => row.is_minimum && row.norm !== null && row.norm > 0)
    .map((row) => {
      const norm = row.norm ?? 0;
      const status: ComparisonStatus = row.available <= 0 ? 'none' : row.available >= norm ? 'enough' : 'short';
      return {
        equipment_item_id: row.equipment_item_id,
        code: row.code,
        name: row.name,
        unit: row.unit,
        age_group: row.age_group,
        equipment_group: row.equipment_group,
        norm,
        available: row.available,
        shortage: row.shortage ?? 0,
        status,
      };
    });
  const enough = result.filter((row) => row.status === 'enough').length;
  return {
    rows: result,
    totals: {
      item_count: result.length,
      enough,
      short: result.filter((row) => row.status === 'short').length,
      none: result.filter((row) => row.status === 'none').length,
      rate_percent: result.length > 0 ? Math.round((enough / result.length) * 1000) / 10 : null,
    },
  };
}
