import type { FieldError } from '@school-management/server';
import {
  FOOD_LOT_EXPIRY_WARNING_DAYS,
  FOOD_SAMPLE_MINIMUM,
  FOOD_SAMPLE_RETENTION_HOURS,
  FOOD_SAMPLE_SERVINGS_THRESHOLD,
  FOOD_SAMPLE_TEMPERATURE,
} from '@school-management/shared';
import type { FoodCheckResult, FoodSampleForm } from '@school-management/database';

// Hàm tính của bán trú, kiểm thực ba bước và lưu mẫu (DT-18 phần 22b, YCTD-146), tách khỏi truy vấn để kiểm thử đơn vị.
// Ngưỡng theo Quyết định 1246/QĐ-BYT; quy tắc BR-142 đến BR-145
const HOUR = 3_600_000;
const DAY = 86_400_000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
// Ngày giờ theo giờ Việt Nam không có múi giờ (ô datetime-local của trình duyệt) hoặc thời điểm ISO có múi giờ
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// Giờ trong ngày dạng HH:MM; trả null khi bỏ trống, ghi lỗi khi sai dạng
export function readClockTime(value: unknown, field: string, errors: FieldError[]): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    errors.push({ field, message: 'Giờ dạng HH:MM' });
    return null;
  }
  return value.slice(0, 5);
}

// Thời điểm: chuỗi không có múi giờ hiểu là giờ Việt Nam
export function readMoment(value: unknown, field: string, errors: FieldError[], required: boolean): Date | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      errors.push({ field, message: 'Bắt buộc nhập thời điểm' });
    }
    return null;
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: 'Thời điểm dạng YYYY-MM-DDTHH:MM' });
    return null;
  }
  const text = LOCAL_DATE_TIME.test(value) ? `${value.length === 16 ? `${value}:00` : value}+07:00` : value;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field, message: 'Thời điểm dạng YYYY-MM-DDTHH:MM' });
    return null;
  }
  return parsed;
}

// Giờ Việt Nam của một thời điểm, dạng "HH:MM ngày DD/MM/YYYY" như cột thời gian của mẫu số 5
export function vietnamMoment(value: Date | null): string {
  if (!value) {
    return '';
  }
  const local = new Date(value.getTime() + 7 * HOUR).toISOString();
  return `${local.slice(11, 16)} ngày ${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)}`;
}

// BR-142: lượng mẫu, nhiệt độ bảo quản; trả danh sách lỗi theo trường
export function sampleViolations(input: {
  food_form: FoodSampleForm;
  quantity: number;
  storage_temperature: number;
}): FieldError[] {
  const errors: FieldError[] = [];
  const minimum = FOOD_SAMPLE_MINIMUM[input.food_form];
  if (input.quantity < minimum) {
    errors.push({
      field: 'quantity',
      message:
        input.food_form === 'solid'
          ? `Mẫu thức ăn đặc tối thiểu ${minimum} gam`
          : `Mẫu thức ăn lỏng tối thiểu ${minimum} ml`,
    });
  }
  if (
    input.storage_temperature < FOOD_SAMPLE_TEMPERATURE.minimum ||
    input.storage_temperature > FOOD_SAMPLE_TEMPERATURE.maximum
  ) {
    errors.push({
      field: 'storage_temperature',
      message: `Nhiệt độ bảo quản mẫu từ ${FOOD_SAMPLE_TEMPERATURE.minimum} °C đến ${FOOD_SAMPLE_TEMPERATURE.maximum} °C`,
    });
  }
  return errors;
}

// Thời điểm sớm nhất được hủy mẫu: 24 giờ sau lúc lấy mẫu
export function earliestDestroyAt(sampledAt: Date): Date {
  return new Date(sampledAt.getTime() + FOOD_SAMPLE_RETENTION_HOURS * HOUR);
}

// Trạng thái hủy của mẫu đang lưu tại một thời điểm: chưa đủ thời gian, đến hạn hủy; mẫu giữ (nghi ngộ độc, cơ quan yêu cầu)
// không được hủy đến khi bỏ giữ
export function sampleDestroyState(
  sample: { status: 'stored' | 'held' | 'destroyed'; sampled_at: Date },
  now: Date,
): 'destroyed' | 'held' | 'retaining' | 'due' {
  if (sample.status !== 'stored') {
    return sample.status;
  }
  return now.getTime() >= earliestDestroyAt(sample.sampled_at).getTime() ? 'due' : 'retaining';
}

// Bữa dưới 30 suất không bắt buộc lưu mẫu (chỉ nhắc, vẫn cho lưu)
export function sampleRequired(servings: number): boolean {
  return servings >= FOOD_SAMPLE_SERVINGS_THRESHOLD;
}

// BR-145: hạn dùng của lô tại một ngày: hết hạn khi hạn dùng trước ngày xem; sắp hết hạn khi còn trong 3 ngày
export function lotExpiryState(expiryDate: string | null, today: string): 'none' | 'ok' | 'expiring' | 'expired' {
  if (!expiryDate) {
    return 'none';
  }
  if (expiryDate < today) {
    return 'expired';
  }
  return expiryDate <= addDays(today, FOOD_LOT_EXPIRY_WARNING_DAYS) ? 'expiring' : 'ok';
}

// BR-143: dòng kiểm thực có kết quả cảm quan; không đạt (cảm quan, xét nghiệm nhanh, vệ sinh) thì phải ghi biện pháp xử lý
export interface InspectionLineCheck {
  line_no: number;
  sensory_result: FoodCheckResult | null;
  rapid_test_result?: FoodCheckResult | null;
  hygiene_people?: FoodCheckResult | null;
  hygiene_equipment?: FoodCheckResult | null;
  hygiene_area?: FoodCheckResult | null;
  action: string | null;
}

export function lineFailed(line: InspectionLineCheck): boolean {
  return [
    line.sensory_result,
    line.rapid_test_result,
    line.hygiene_people,
    line.hygiene_equipment,
    line.hygiene_area,
  ].includes('fail');
}

// Lỗi khi xác nhận phiếu: phiếu trống, dòng chưa có kết quả cảm quan, dòng bước 2 thiếu kết quả vệ sinh, dòng không đạt chưa
// ghi biện pháp xử lý
export function confirmViolations(step: number, lines: InspectionLineCheck[]): string[] {
  const problems: string[] = [];
  if (lines.length === 0) {
    problems.push('Phiếu chưa có dòng nào');
  }
  for (const line of lines) {
    if (!line.sensory_result) {
      problems.push(`Dòng ${line.line_no}: chưa ghi kết quả kiểm tra cảm quan`);
    }
    if (step === 2 && (!line.hygiene_people || !line.hygiene_equipment || !line.hygiene_area)) {
      problems.push(`Dòng ${line.line_no}: chưa ghi đủ kết quả kiểm tra điều kiện vệ sinh`);
    }
    if (lineFailed(line) && !line.action) {
      problems.push(`Dòng ${line.line_no}: không đạt thì phải ghi biện pháp xử lý`);
    }
  }
  return problems;
}

// Gợi ý lô cho món ở bước 2 khi chưa chọn tay: với mỗi nguyên liệu của món, các lô đã đạt bước 1, nhập không sau ngày chế
// biến, chưa hết hạn vào ngày đó; lấy lô nhập gần nhất trước (lô cũ hơn thường đã dùng)
export interface LotCandidate {
  id: string;
  ingredient_id: string;
  received_date: string;
  expiry_date: string | null;
  status: string;
}

export function suggestLots(ingredientIds: string[], lots: LotCandidate[], date: string): string[] {
  const chosen: string[] = [];
  for (const ingredientId of new Set(ingredientIds)) {
    const usable = lots
      .filter(
        (lot) =>
          lot.ingredient_id === ingredientId &&
          lot.status === 'accepted' &&
          lot.received_date <= date &&
          (lot.expiry_date === null || lot.expiry_date >= date),
      )
      .sort((left, right) => right.received_date.localeCompare(left.received_date));
    if (usable[0]) {
      chosen.push(usable[0].id);
    }
  }
  return chosen;
}

// Lô chọn được cho món vào một ngày (BR-143, BR-145): đã đạt bước 1 (hoặc đã dùng hết sau đó), nhập không sau ngày, chưa hết
// hạn vào ngày đó; trả lý do khi không chọn được
export function lotUnusableReason(
  lot: { code: string; status: string; received_date: string; expiry_date: string | null },
  date: string,
): string | null {
  if (lot.status !== 'accepted' && lot.status !== 'used_up') {
    return `Lô ${lot.code} chưa đạt kiểm tra trước khi chế biến`;
  }
  if (lot.received_date > date) {
    return `Lô ${lot.code} nhập sau ngày chế biến`;
  }
  if (lot.expiry_date !== null && lot.expiry_date < date) {
    return `Lô ${lot.code} đã hết hạn dùng`;
  }
  return null;
}
