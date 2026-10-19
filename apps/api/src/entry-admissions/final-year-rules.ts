import { ruleViolationError } from '@school-management/server';
import {
  FINAL_YEAR_CHECK_LABELS,
  FINAL_YEAR_CONFIRMED_STATUSES,
  FINAL_YEAR_STATUS_LABELS,
  type FinalYearCheckItem,
  type FinalYearIdentityType,
  type FinalYearReviewStatus,
  type FinalYearStatus,
} from '@school-management/shared';

// Quy tắc của hồ sơ cuối cấp (DT-17 phần 17c, YCTD-134; khảo sát mục 10.2.3), không đọc cơ sở dữ liệu để kiểm thử riêng.
// Luồng trạng thái (Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11, khảo sát chỉ có tên sáu trạng thái):
// - hồ sơ mới là "PHHS chưa xác nhận";
// - phụ huynh xác nhận: chưa xác nhận thành "PHHS đã xác nhận"; "Chờ PHHS xác nhận lại" hoặc "Đã chỉnh sửa" thành "PHHS đã xác
//   nhận sau chỉnh sửa". Trường bấm "Xác nhận hồ sơ" khi phụ huynh xác nhận trên giấy, cùng cách chuyển trạng thái;
// - phụ huynh đề xuất sửa (ghi nội dung): mọi trạng thái trừ "Chờ đơn vị chỉnh sửa" thành "Chờ đơn vị chỉnh sửa";
// - trường sửa thông tin rồi bấm "Đã chỉnh sửa thông tin": "Chờ đơn vị chỉnh sửa" thành "Chờ PHHS xác nhận lại"; trường tự
//   sửa hồ sơ chưa có đề xuất ("PHHS chưa xác nhận", đã xác nhận) thành "Đã chỉnh sửa" để phụ huynh xác nhận lại.
// Hồ sơ đã duyệt không đổi trạng thái, không sửa được cho tới khi hủy duyệt. Duyệt cần phụ huynh đã xác nhận và kiểm dò đủ
export const ENTRY_ADMISSION_RULE = 'YCTD-134';

export type FinalYearAction = 'parent_confirm' | 'school_confirm' | 'parent_propose' | 'school_edited';

export interface TransitionResult {
  ok: boolean;
  status?: FinalYearStatus;
  reason?: string;
}

const AFTER_EDIT: FinalYearStatus[] = ['awaiting_parent_reconfirm', 'school_edited'];

export function nextStatus(
  action: FinalYearAction,
  status: FinalYearStatus,
  review: FinalYearReviewStatus,
): TransitionResult {
  if (review === 'approved') {
    return { ok: false, reason: 'Hồ sơ đã duyệt; hủy duyệt trước khi thay đổi' };
  }
  const label = FINAL_YEAR_STATUS_LABELS[status];
  switch (action) {
    case 'parent_confirm':
    case 'school_confirm':
      if (status === 'parent_pending') {
        return { ok: true, status: 'parent_confirmed' };
      }
      if (AFTER_EDIT.includes(status)) {
        return { ok: true, status: 'parent_confirmed_after_edit' };
      }
      return {
        ok: false,
        reason:
          status === 'awaiting_school_edit'
            ? 'Hồ sơ đang chờ đơn vị chỉnh sửa theo đề xuất của phụ huynh'
            : `Hồ sơ đã ở trạng thái "${label}"`,
      };
    case 'parent_propose':
      return status === 'awaiting_school_edit'
        ? { ok: false, reason: 'Đề xuất trước đang chờ đơn vị chỉnh sửa' }
        : { ok: true, status: 'awaiting_school_edit' };
    case 'school_edited':
      if (status === 'awaiting_school_edit') {
        return { ok: true, status: 'awaiting_parent_reconfirm' };
      }
      if (status === 'parent_pending' || FINAL_YEAR_CONFIRMED_STATUSES.includes(status)) {
        return { ok: true, status: 'school_edited' };
      }
      return { ok: false, reason: `Hồ sơ đã ở trạng thái "${label}", đang chờ phụ huynh xác nhận lại` };
  }
}

// Điều kiện duyệt hồ sơ: phụ huynh đã xác nhận (lần đầu hoặc sau chỉnh sửa) và kiểm dò đủ thông tin
export function approvalProblem(status: FinalYearStatus, missing: FinalYearCheckItem[]): string | null {
  if (!FINAL_YEAR_CONFIRMED_STATUSES.includes(status)) {
    return 'Phụ huynh chưa xác nhận hồ sơ';
  }
  if (missing.length > 0) {
    return `Hồ sơ thiếu thông tin: ${missing.map((item) => FINAL_YEAR_CHECK_LABELS[item]).join('; ')}`;
  }
  return null;
}

export interface CheckFacts {
  identity_type: FinalYearIdentityType;
  current_residence: string | null;
  ward: string | null;
  province: string | null;
  contact_phone: string | null;
  has_birth_certificate: boolean;
  has_residence_proof: boolean;
}

const filled = (value: string | null | undefined) => typeof value === 'string' && value.trim() !== '';

// Kiểm dò: các mục bắt buộc của hồ sơ cuối cấp (định danh, nơi ở hiện tại, liên hệ, giấy khai sinh, ảnh cư trú); trả danh
// sách mục còn thiếu theo thứ tự cột của Sở. Số định danh tạm tính là đã có số
export function checkRecord(facts: CheckFacts): FinalYearCheckItem[] {
  const missing: FinalYearCheckItem[] = [];
  if (facts.identity_type === 'no_id') {
    missing.push('identity');
  }
  if (!filled(facts.current_residence) || !filled(facts.ward) || !filled(facts.province)) {
    missing.push('residence');
  }
  if (!filled(facts.contact_phone)) {
    missing.push('contact');
  }
  if (!facts.has_birth_certificate) {
    missing.push('birth_certificate');
  }
  if (!facts.has_residence_proof) {
    missing.push('residence_proof');
  }
  return missing;
}

// Hạn điều chỉnh thông tin do trường đặt (ngày, tính hết ngày theo giờ Việt Nam): quá hạn thì phụ huynh không xác nhận, đề
// xuất sửa hay tải giấy tờ được nữa; chưa đặt hạn là không giới hạn
export function assertBeforeDeadline(deadline: string | null, today: string): void {
  if (deadline && today > deadline) {
    throw ruleViolationError(
      ENTRY_ADMISSION_RULE,
      `Đã quá hạn điều chỉnh thông tin (${deadline.split('-').reverse().join('/')}); liên hệ nhà trường để được hỗ trợ`,
    );
  }
}

// Sắp xếp A–Z theo tên rồi họ đệm theo thứ tự tiếng Việt, như danh sách học sinh của Sở
export function compareVietnameseNames(left: string, right: string): number {
  const given = (name: string) => name.trim().split(/\s+/).pop() ?? '';
  return given(left).localeCompare(given(right), 'vi') || left.localeCompare(right, 'vi');
}
