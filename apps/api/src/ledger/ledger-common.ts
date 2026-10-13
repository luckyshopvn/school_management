import { Injectable } from '@nestjs/common';
import type { SchoolYearDatabase } from '@school-management/database';
import { ApplicationError, validationError, type FieldError } from '@school-management/server';
import { PERMISSION_CODES } from '@school-management/shared';
import type { Kysely } from 'kysely';
import type { CurrentUser } from '../authentication/current-user.js';
import { OrganizationScopes } from '../organization/organization-scopes.js';

// Phần dùng chung của sổ kế toán kép (G3-06, N5; YCTD-88): loại chứng từ ghi sổ, phân quyền theo đơn vị, đọc dữ liệu vào.
// Hệ thống tài khoản và quy tắc ghi sổ dùng chung toàn trường nên chỉ người có quyền quản lý sổ ở Trường chính sửa; bút
// toán thủ công và báo cáo theo đơn vị trong phạm vi được gán
export type MoneySide = 'debit' | 'credit' | 'account' | null;

export interface DocumentTypeInfo {
  label: string;
  // debit: phía Nợ là tài khoản tiền của quỹ (phiếu thu); credit: phía Có là tài khoản tiền (phiếu chi); account: quy
  // tắc chỉ khai báo tài khoản tiền ở phía Nợ; null: khai báo đủ hai phía
  moneySide: MoneySide;
  // Được khai báo quy tắc riêng theo khoản mục thu chi (P06-10, RR-05)
  byCategory: boolean;
}

export const DOCUMENT_TYPES: Record<string, DocumentTypeInfo> = {
  money_cash: { label: 'Tài khoản tiền của quỹ tiền mặt', moneySide: 'account', byCategory: false },
  money_bank: { label: 'Tài khoản tiền của tài khoản ngân hàng', moneySide: 'account', byCategory: false },
  receipt: { label: 'Phiếu thu của trẻ', moneySide: 'debit', byCategory: true },
  receipt_staff: { label: 'Phiếu thu thu hồi lương của nhân sự', moneySide: 'debit', byCategory: true },
  payment: { label: 'Phiếu chi thường', moneySide: 'credit', byCategory: true },
  payment_refund: { label: 'Phiếu chi hoàn tiền cho trẻ', moneySide: 'credit', byCategory: true },
  payment_payroll: { label: 'Phiếu chi trả lương, quyết toán', moneySide: 'credit', byCategory: true },
  invoice: { label: 'Hóa đơn học phí đã phát hành (ghi nhận doanh thu)', moneySide: null, byCategory: false },
  invoice_opening: { label: 'Hóa đơn công nợ đầu kỳ nhập từ hệ thống cũ', moneySide: null, byCategory: false },
  discount: { label: 'Miễn giảm đã duyệt', moneySide: null, byCategory: false },
  invoice_adjustment: { label: 'Phiếu điều chỉnh hóa đơn đã duyệt', moneySide: null, byCategory: false },
  payroll_income: { label: 'Bảng lương đã duyệt: tổng thu nhập', moneySide: null, byCategory: false },
  payroll_deduction: { label: 'Bảng lương đã duyệt: các khoản khấu trừ', moneySide: null, byCategory: false },
  payroll_tax: { label: 'Bảng lương đã duyệt: thuế thu nhập cá nhân', moneySide: null, byCategory: false },
  settlement: { label: 'Quyết toán lương thôi việc đã duyệt', moneySide: null, byCategory: false },
};

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function check(errors: FieldError[]): void {
  if (errors.length > 0) {
    throw validationError(errors);
  }
}

export function readDateRange(query: Record<string, string | undefined>, errors: FieldError[]) {
  const from = query.from ?? '';
  const to = query.to ?? '';
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    errors.push({ field: 'from', message: 'Khoảng ngày from, to theo dạng YYYY-MM-DD, from không sau to' });
  }
  return { from, to };
}

@Injectable()
export class LedgerAccess {
  constructor(private readonly organizationScopes: OrganizationScopes) {}

  // Các đơn vị được xem sổ: theo quyền xem hoặc quyền quản lý sổ; chọn một đơn vị thì chỉ đơn vị đó, bỏ trống là cả phạm vi
  async viewUnits(
    currentUser: CurrentUser,
    database: Kysely<SchoolYearDatabase>,
    orgUnitId: string | null,
  ): Promise<string[]> {
    const scopes = await Promise.all(
      [PERMISSION_CODES.ledgerView, PERMISSION_CODES.ledgerManage].map((code) =>
        this.organizationScopes.resolveStaff(currentUser, code),
      ),
    );
    let units: string[];
    if (scopes.some((scope) => scope.wholeSchool)) {
      units = (await database.selectFrom('org_units').select('id').execute()).map((row) => row.id);
    } else {
      units = [...new Set(scopes.flatMap((scope) => scope.orgUnitIds))];
    }
    if (units.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền xem sổ kế toán');
    }
    if (orgUnitId) {
      if (!units.includes(orgUnitId)) {
        throw new ApplicationError('ERR_FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
      }
      return [orgUnitId];
    }
    return units;
  }

  async canManageSchoolWide(currentUser: CurrentUser): Promise<boolean> {
    return (await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.ledgerManage)).wholeSchool;
  }

  // Hệ thống tài khoản, quy tắc ghi sổ: chỉ người quản lý sổ được gán ở Trường chính
  async assertManageSchoolWide(currentUser: CurrentUser, message: string): Promise<void> {
    if (!(await this.canManageSchoolWide(currentUser))) {
      throw new ApplicationError('ERR_FORBIDDEN', message);
    }
  }

  async assertManageAny(currentUser: CurrentUser): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.ledgerManage);
    if (!scope.wholeSchool && scope.orgUnitIds.length === 0) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền quản lý sổ kế toán');
    }
  }

  async assertManageUnit(currentUser: CurrentUser, orgUnitId: string): Promise<void> {
    const scope = await this.organizationScopes.resolveStaff(currentUser, PERMISSION_CODES.ledgerManage);
    if (!scope.wholeSchool && !scope.orgUnitIds.includes(orgUnitId)) {
      throw new ApplicationError('ERR_FORBIDDEN', 'Bạn không có quyền ghi sổ kế toán của đơn vị này');
    }
  }
}
