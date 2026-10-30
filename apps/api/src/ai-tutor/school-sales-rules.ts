import type { FieldError } from '@school-management/server';
import type { RequestBody } from '../common/request-fields.js';
import { isPeriodMonth, type AiTutorPlanKind, type AiTutorSchoolLevel } from './ai-tutor-rules.js';

// Quy tắc thuần của gia sư AI do trường bán (YCTD-383 lát L1a; bản mẫu MH-598, MH-599): đọc cài đặt và gói từ thân yêu cầu, điều
// kiện hủy lần mua, câu chữ dòng thu trên hóa đơn học phí. Không đọc cơ sở dữ liệu

export const AI_TUTOR_LEVELS: readonly AiTutorSchoolLevel[] = ['TH', 'THCS', 'THPT'];
export const DEFAULT_QUIET_START = '22:00';
export const DEFAULT_QUIET_END = '06:00';
// Giá gói tối đa 100 triệu đồng, số lượt theo ràng buộc của bảng
export const MAX_PLAN_PRICE = 100_000_000;
export const MAX_PLAN_TURNS = 100_000;
export const INVOICE_PREFIX = 'Gia sư AI';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function asAiTutorLevel(value: string | null | undefined): AiTutorSchoolLevel | null {
  return AI_TUTOR_LEVELS.find((level) => level === value) ?? null;
}

function readLevels(value: unknown, field: string, errors: FieldError[], allowEmpty: boolean): AiTutorSchoolLevel[] {
  if (!Array.isArray(value) || value.some((item) => asAiTutorLevel(typeof item === 'string' ? item : null) === null)) {
    errors.push({ field, message: 'Chọn trong các cấp TH, THCS, THPT' });
    return [];
  }
  const levels = AI_TUTOR_LEVELS.filter((level) => value.includes(level));
  if (!allowEmpty && levels.length === 0) {
    errors.push({ field, message: 'Chọn ít nhất một cấp học' });
  }
  return levels;
}

export interface SchoolSettingsInput {
  enabled_levels: AiTutorSchoolLevel[];
  quiet_start: string;
  quiet_end: string;
}

// Cài đặt của trường: cấp học được dùng (được để trống là tắt), khung giờ khóa giờ Việt Nam, giờ bắt đầu khác giờ kết thúc
export function parseSchoolSettings(body: RequestBody, errors: FieldError[]): SchoolSettingsInput {
  const enabledLevels = readLevels(body?.enabled_levels, 'enabled_levels', errors, true);
  const times = (['quiet_start', 'quiet_end'] as const).map((field) => {
    const value = body?.[field];
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
      errors.push({ field, message: 'Giờ dạng HH:MM, từ 00:00 đến 23:59' });
      return '';
    }
    return value;
  });
  if (times[0] && times[0] === times[1]) {
    errors.push({ field: 'quiet_end', message: 'Giờ mở lại phải khác giờ bắt đầu khóa' });
  }
  return { enabled_levels: enabledLevels, quiet_start: times[0] ?? '', quiet_end: times[1] ?? '' };
}

export interface PlanInput {
  kind: AiTutorPlanKind;
  name: string;
  price: number;
  turns: number;
  allow_images: boolean;
  school_levels: AiTutorSchoolLevel[];
  status: 'active' | 'archived';
}

// Gói của trường: loại chỉ chọn khi tạo (`kind` của gói đang sửa truyền vào); gói lượt không cho gửi ảnh (theo gói tháng đang có)
export function parsePlanInput(body: RequestBody, errors: FieldError[], existingKind?: AiTutorPlanKind): PlanInput {
  let kind: AiTutorPlanKind = existingKind ?? 'monthly';
  if (existingKind === undefined) {
    if (body?.kind !== 'monthly' && body?.kind !== 'top_up') {
      errors.push({ field: 'kind', message: 'Chọn gói tháng (monthly) hoặc gói lượt (top_up)' });
    } else {
      kind = body.kind;
    }
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 80) {
    errors.push({ field: 'name', message: 'Tên gói từ 1 đến 80 ký tự' });
  }
  const price = body?.price;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > MAX_PLAN_PRICE) {
    errors.push({
      field: 'price',
      message: `Giá là số nguyên đồng từ 0 đến ${MAX_PLAN_PRICE.toLocaleString('vi-VN')}`,
    });
  }
  const turns = body?.turns;
  if (typeof turns !== 'number' || !Number.isInteger(turns) || turns < 1 || turns > MAX_PLAN_TURNS) {
    errors.push({ field: 'turns', message: `Số lượt là số nguyên từ 1 đến ${MAX_PLAN_TURNS.toLocaleString('vi-VN')}` });
  }
  const allowImages = body?.allow_images ?? false;
  if (typeof allowImages !== 'boolean') {
    errors.push({ field: 'allow_images', message: 'Chọn có (true) hoặc không (false)' });
  } else if (allowImages && kind === 'top_up') {
    errors.push({ field: 'allow_images', message: 'Gói lượt dùng quyền gửi ảnh của gói tháng, không bật riêng' });
  }
  const status = body?.status ?? 'active';
  if (status !== 'active' && status !== 'archived') {
    errors.push({ field: 'status', message: 'Trạng thái là đang bán (active) hoặc ngừng bán (archived)' });
  }
  return {
    kind,
    name,
    price: typeof price === 'number' ? price : 0,
    turns: typeof turns === 'number' ? turns : 1,
    allow_images: allowImages === true,
    school_levels: readLevels(body?.school_levels, 'school_levels', errors, false),
    status: status === 'archived' ? 'archived' : 'active',
  };
}

// Tháng dùng của lần mua gói tháng (`YYYY-MM-01`); gói lượt không có tháng
export function readPeriodMonth(body: RequestBody, kind: AiTutorPlanKind, errors: FieldError[]): string | null {
  const value = body?.period_month;
  if (kind === 'top_up') {
    if (value !== undefined && value !== null) {
      errors.push({ field: 'period_month', message: 'Gói lượt không chọn tháng' });
    }
    return null;
  }
  if (typeof value !== 'string' || !isPeriodMonth(value)) {
    errors.push({ field: 'period_month', message: 'Chọn tháng dùng dạng YYYY-MM-01' });
    return null;
  }
  return value;
}

export type CancelBlock = 'not_school' | 'not_cancellable' | 'invoiced' | 'turns_used';

// Phụ huynh hủy được lần mua của trường khi chưa lên hóa đơn học phí nào (kể cả hóa đơn nháp) và con chưa dùng lượt nào
export function cancelBlock(
  subscription: { planSource: string; status: string; usedTurns: number; heldTurns: number },
  invoiced: boolean,
): CancelBlock | null {
  if (subscription.planSource !== 'school') {
    return 'not_school';
  }
  if (subscription.status !== 'pending' && subscription.status !== 'active') {
    return 'not_cancellable';
  }
  if (invoiced) {
    return 'invoiced';
  }
  if (subscription.usedTurns > 0 || subscription.heldTurns > 0) {
    return 'turns_used';
  }
  return null;
}

export const CANCEL_MESSAGES: Record<CancelBlock, string> = {
  not_school: 'Gói mua trực tiếp từ nền tảng hủy ở mục Mua trực tiếp',
  not_cancellable: 'Lần mua này đã hủy hoặc đã hoàn tiền',
  invoiced: 'Gói đã lên hóa đơn học phí nên không hủy được; liên hệ kế toán của trường',
  turns_used: 'Con đã dùng lượt của gói nên không hủy được',
};

export const monthLabel = (periodMonth: string) => `${periodMonth.slice(5, 7)}/${periodMonth.slice(0, 4)}`;
const vietnamDate = (moment: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(moment);

// Câu chữ dòng thu của lần mua
export function purchaseLine(subscription: {
  planKind: AiTutorPlanKind;
  planName: string;
  periodMonth: string | null;
  turns: number;
  createdAt: Date;
}): { description: string; basisNote: string } {
  if (subscription.planKind === 'monthly' && subscription.periodMonth) {
    return {
      description: `${INVOICE_PREFIX}: ${subscription.planName} tháng ${monthLabel(subscription.periodMonth)}`,
      basisNote: `Mua ngày ${vietnamDate(subscription.createdAt)}`,
    };
  }
  return {
    description: `${INVOICE_PREFIX}: ${subscription.planName}`,
    basisNote: `${subscription.turns} lượt, mua ngày ${vietnamDate(subscription.createdAt)}, dùng trong 12 tháng`,
  };
}

// Câu chữ dòng thu phần chênh lệch của lần nâng gói
export function upgradeLine(upgrade: {
  fromPlanName: string;
  toPlanName: string;
  periodMonth: string;
  remainingDays: number;
  daysInMonth: number;
  extraTurns: number;
}): { description: string; basisNote: string } {
  return {
    description: `${INVOICE_PREFIX}: nâng ${upgrade.fromPlanName} lên ${upgrade.toPlanName} tháng ${monthLabel(upgrade.periodMonth)}`,
    basisNote: `Chênh lệch theo ${upgrade.remainingDays}/${upgrade.daysInMonth} ngày còn lại; cộng ${upgrade.extraTurns} lượt`,
  };
}
