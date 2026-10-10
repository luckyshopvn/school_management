import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { PERMISSION_CODES } from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';
import { useSession } from '../session/session.js';

type NavigationPath =
  | '/'
  | '/academic-years'
  | '/org-units'
  | '/accounts'
  | '/roles'
  | '/settings'
  | '/audit-logs'
  | '/departments'
  | '/catalogs'
  | '/approval-thresholds'
  | '/rooms'
  | '/classes'
  | '/children'
  | '/imports'
  | '/attendance'
  | '/fees'
  | '/cashflow-categories'
  | '/registrations'
  | '/invoices'
  | '/fee-approvals'
  | '/debts'
  | '/receipts'
  | '/cash-accounts'
  | '/payments'
  | '/cash-book'
  | '/staff'
  | '/staff-attendance'
  | '/school-days';

function NavItem({ to, label }: { to: NavigationPath; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="block rounded-lg px-3 py-2 text-label font-medium text-text hover:bg-selected"
        activeProps={{ className: 'bg-selected' }}
      >
        {label}
      </Link>
    </li>
  );
}

// Khung trang của cổng quản trị: điều hướng dọc bên trái rộng 240 điểm ảnh (BC-01, KC-08)
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  // Chỉ hiện mục người dùng có quyền; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
  const canManageAllAccounts = useHasPermission(PERMISSION_CODES.accountManage);
  const canManageAccountsInUnit = useHasPermission(PERMISSION_CODES.accountManageInUnit);
  const canSeeAccounts = canManageAllAccounts || canManageAccountsInUnit;
  const canViewPlatform = useHasPermission('P01.view');
  const canManageSettings = useHasPermission(PERMISSION_CODES.settingManage);
  const canManageDepartments = useHasPermission(PERMISSION_CODES.departmentManage);
  const canManageCatalogs = useHasPermission(PERMISSION_CODES.catalogManage);
  const canManageRooms = useHasPermission(PERMISSION_CODES.roomManage);
  const canManageClasses = useHasPermission(PERMISSION_CODES.classManage);
  const canViewChildren = useHasPermission('P02.view');
  const canEditChildren = useHasPermission('P02.edit');
  const canImportChildren = useHasPermission(PERMISSION_CODES.importChildren);
  const canManageChildren = useHasPermission(PERMISSION_CODES.childManage);
  const canImportOpeningDebts = useHasPermission(PERMISSION_CODES.openingDebtImport);
  const canImportStaff = useHasPermission(PERMISSION_CODES.importStaff);
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffView);
  const canImport = canImportChildren || canManageChildren || canImportOpeningDebts || canImportStaff;
  const canViewTuition = useHasPermission('P05.view');
  const canManageFeeCatalog = useHasPermission(PERMISSION_CODES.feeCatalogManage);
  const canManageDiscountTypes = useHasPermission(PERMISSION_CODES.discountTypeManage);
  const canViewFinance = useHasPermission('P06.view');
  const canManageCashflowCategories = useHasPermission(PERMISSION_CODES.cashflowCategoryManage);
  const canManageRegistrations = useHasPermission(PERMISSION_CODES.registrationManage);
  const canApproveLateRegistrations = useHasPermission(PERMISSION_CODES.lateRegistrationApprove);
  const canViewFees = canViewTuition || canManageFeeCatalog || canManageDiscountTypes;
  const canSeeRegistrations = canViewTuition || canManageRegistrations || canApproveLateRegistrations;
  const canCalculateFees = useHasPermission(PERMISSION_CODES.feeCalculationManage);
  const canSeeInvoices = canViewTuition || canCalculateFees;
  const canApproveFeeDocuments = useHasPermission(PERMISSION_CODES.feeDocumentApprove);
  const canViewCashflow = canViewFinance || canManageCashflowCategories;
  const canViewDebts = useHasPermission(PERMISSION_CODES.debtView);
  const canCollect = useHasPermission(PERMISSION_CODES.receiptManage);
  const canManageCashAccounts = useHasPermission(PERMISSION_CODES.cashAccountManage);
  const canManagePayments = useHasPermission(PERMISSION_CODES.paymentManage);
  const canApprovePayments = useHasPermission(PERMISSION_CODES.paymentApprove);
  const canSeeAccountsAndReceipts = canViewFinance || canCollect || canManageCashAccounts;
  const canSeePayments = canViewFinance || canManagePayments || canApprovePayments;

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Điều hướng chính"
        className="flex w-60 shrink-0 flex-col gap-4 border-r border-border bg-card p-4"
      >
        <span className="text-section-title font-semibold text-brand-strong">School Management</span>
        <ul className="flex flex-col gap-1">
          <NavItem to="/" label="Trang chủ" />
        </ul>
        {canManageClasses || canViewChildren || canEditChildren ? (
          <>
            <span className="px-3 text-label font-semibold text-text-muted">TRẺ VÀ LỚP</span>
            <ul className="flex flex-col gap-1">
              <NavItem to="/children" label="Hồ sơ trẻ" />
              <NavItem to="/classes" label="Lớp học" />
              <NavItem to="/attendance" label="Điểm danh" />
              {canImport ? <NavItem to="/imports" label="Nhập dữ liệu" /> : null}
            </ul>
          </>
        ) : null}
        {canViewFees || canViewCashflow || canSeeRegistrations || canViewDebts ? (
          <>
            <span className="px-3 text-label font-semibold text-text-muted">HỌC PHÍ VÀ TÀI CHÍNH</span>
            <ul className="flex flex-col gap-1">
              {canViewFees ? <NavItem to="/fees" label="Biểu phí và dịch vụ" /> : null}
              {canSeeRegistrations ? <NavItem to="/registrations" label="Đăng ký dịch vụ" /> : null}
              {canSeeInvoices ? <NavItem to="/invoices" label="Học phí" /> : null}
              {canApproveFeeDocuments ? <NavItem to="/fee-approvals" label="Duyệt miễn giảm và điều chỉnh" /> : null}
              {canViewDebts ? <NavItem to="/debts" label="Công nợ" /> : null}
              {canSeeAccountsAndReceipts ? <NavItem to="/receipts" label="Phiếu thu" /> : null}
              {canSeePayments ? <NavItem to="/payments" label="Phiếu chi" /> : null}
              {canSeeAccountsAndReceipts ? <NavItem to="/cash-accounts" label="Quỹ và ngân hàng" /> : null}
              {canSeeAccountsAndReceipts ? <NavItem to="/cash-book" label="Sổ quỹ" /> : null}
              {canViewCashflow ? <NavItem to="/cashflow-categories" label="Khoản mục thu chi" /> : null}
            </ul>
          </>
        ) : null}
        <span className="px-3 text-label font-semibold text-text-muted">NHÂN SỰ</span>
        <ul className="flex flex-col gap-1">
          {canViewStaff ? <NavItem to="/staff" label="Hồ sơ nhân sự" /> : null}
          <NavItem to="/staff-attendance" label="Chấm công" />
          <NavItem to="/school-days" label="Ngày lễ và lịch bù" />
          {canViewStaff && canImportStaff && !(canManageClasses || canViewChildren || canEditChildren) ? (
            <NavItem to="/imports" label="Nhập dữ liệu" />
          ) : null}
        </ul>
        <span className="px-3 text-label font-semibold text-text-muted">THIẾT LẬP</span>
        <ul className="flex flex-col gap-1">
          <NavItem to="/academic-years" label="Năm học" />
          <NavItem to="/org-units" label="Cây đơn vị" />
          {canSeeAccounts ? (
            <>
              <NavItem to="/accounts" label="Tài khoản" />
              <NavItem to="/roles" label="Vai trò và quyền" />
            </>
          ) : null}
          {canViewPlatform || canManageDepartments ? (
            <NavItem to="/departments" label="Phòng ban và chức danh" />
          ) : null}
          {canViewPlatform || canManageCatalogs ? <NavItem to="/catalogs" label="Danh mục dùng chung" /> : null}
          {canViewPlatform ? <NavItem to="/approval-thresholds" label="Hạn mức phê duyệt" /> : null}
          {canViewPlatform || canManageRooms || canManageCatalogs ? (
            <NavItem to="/rooms" label="Phòng học và bậc học" />
          ) : null}
          {canViewPlatform || canManageSettings ? <NavItem to="/settings" label="Cấu hình" /> : null}
          {canViewPlatform ? <NavItem to="/audit-logs" label="Nhật ký thao tác" /> : null}
        </ul>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-border bg-card px-6 py-3">
          {currentUser.data ? (
            <span className="text-label font-medium text-text" data-testid="current-user-name">
              {currentUser.data.full_name}
            </span>
          ) : (
            <span className="h-4 w-32 animate-pulse rounded bg-border" aria-hidden="true" />
          )}
          <Link to="/change-password" className="text-label text-link hover:underline">
            Đổi mật khẩu
          </Link>
          <Button onClick={() => void session.logout()}>Đăng xuất</Button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
