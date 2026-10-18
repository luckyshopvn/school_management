import type { PortalQuickLinkPath } from './index.js';

// Quyền quyết định mục menu nào hiện với người dùng (DT-15 phần 15e, chuyển từ cổng quản trị sang gói dùng chung để màn
// hình "Phân quyền theo menu" dùng cùng một nguồn). Điều kiện giữ đúng như thanh điều hướng cũ trước DT-15; mục không có
// điều kiện thì ai đăng nhập cũng thấy. Máy chủ vẫn kiểm tra quyền ở mọi yêu cầu (AI-12).
//
// Một điều kiện là một mã quyền, "một trong" (anyOf), "tất cả" (allOf) hoặc "cổng" (gate): mục hiện khi thỏa cả cổng lẫn
// điều kiện chính. Cổng là điều kiện chung của cả nhóm menu cũ (ví dụ phải có một quyền tài chính bất kỳ); quyền của cổng
// không tính là quyền của mục nên tích chọn mục không cấp kèm cả nhóm quyền của cổng. Mã quyền viết thẳng chuỗi vì tệp
// này được index.ts xuất lại, đọc PERMISSION_CODES ở đây sẽ vướng vòng nạp mô đun
export type MenuPermissionRule =
  | string
  | { anyOf: MenuPermissionRule[] }
  | { allOf: MenuPermissionRule[] }
  | { gate: MenuPermissionRule; rule: MenuPermissionRule };

const anyOf = (...rules: MenuPermissionRule[]): MenuPermissionRule => ({ anyOf: rules });
const gated = (gate: MenuPermissionRule, rule: MenuPermissionRule): MenuPermissionRule => ({ gate, rule });

const ACCOUNTS = anyOf('P01.account.manage', 'P01.account.manage-in-unit');
// Điều kiện của nhóm "Trẻ và lớp" cũ
const CHILDREN_AND_CLASSES = anyOf('P02.class.manage', 'P02.view', 'P02.edit');
const STATISTICS = anyOf('P17.child-statistics.view', 'P17.staff-statistics.view');
const VIEW_FEES = anyOf('P05.view', 'P05.fee-catalog.manage', 'P05.discount-type.manage');
const VIEW_CASHFLOW = anyOf('P06.view', 'P06.cashflow-category.manage');
const REGISTRATIONS = anyOf('P05.view', 'P05.registration.manage', 'P05.late-registration.approve');
const DEBT_COLLECTION = anyOf('P05.debt-reminder.manage', 'P05.overdue-debt.propose', 'P05.overdue-debt.decide');
const FISCAL_PERIODS = anyOf('P06.period-close.request', 'P06.period-close.approve');
const LEDGER = anyOf('P06.ledger.view', 'P06.ledger.manage');
// Điều kiện của nhóm "Học phí và tài chính" cũ, áp cho từng mục của phân hệ Tài chính – học phí
const FINANCE = anyOf(
  VIEW_FEES,
  VIEW_CASHFLOW,
  REGISTRATIONS,
  'P05.debt.view',
  DEBT_COLLECTION,
  FISCAL_PERIODS,
  LEDGER,
);

// Mục có quyền thuộc sẵn cổng (ví dụ Biểu phí cần một quyền xem phí, quyền đó đã thỏa nhóm tài chính) thì viết gọn không
// kèm cổng; kết quả hiện hay ẩn vẫn như điều kiện cũ
export const MENU_PERMISSION_RULES: Partial<Record<PortalQuickLinkPath, MenuPermissionRule>> = {
  // Quản lý giáo dục Mầm non
  '/school-profile': anyOf('P01.school-profile.manage', 'P17.report.emis'),
  // Phân hiệu, điểm trường: như mục Phòng ban, sửa cần quyền quản lý cây đơn vị (YCTD-111)
  '/branches': anyOf('P01.view', 'P01.org-unit.manage'),
  '/school-sites': anyOf('P01.view', 'P01.org-unit.manage'),
  '/settings': anyOf('P01.view', 'P01.setting.manage'),
  // Rà soát kiểm định xem như hồ sơ trường; tách trường cần quyền cập nhật hồ sơ trường (DT-16 phần 16e)
  '/accreditation-review': anyOf('P01.school-profile.manage', 'P17.report.emis'),
  '/school-splits': 'P01.school-profile.manage',
  '/classes': CHILDREN_AND_CLASSES,
  // Nhập lớp học tách khỏi trang Nhập dữ liệu; cùng quyền nhập dữ liệu ban đầu của máy chủ (YCTD-111)
  '/class-imports': gated(CHILDREN_AND_CLASSES, 'P01.import.children'),
  // Phân công phụ trách lớp: ai xem được lớp đều xem được, phân công cần quyền quản lý lớp (YCTD-111)
  '/class-assignments': CHILDREN_AND_CLASSES,
  // Khai báo tuần: ai xem được thiết lập thì xem, sửa cần quyền quản lý năm học như 2.1 Năm học (DT-16 phần 16e)
  '/school-weeks': anyOf('P01.view', 'P01.academic-year.manage'),
  '/staff': 'P07.staff.view',
  '/children': CHILDREN_AND_CLASSES,
  // Biến động học sinh: người lập hoặc duyệt hồ sơ học sinh (YCTD-108)
  '/student-movements': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  // Trước đây hiện ở nhóm Trẻ và lớp, hoặc ở nhóm Nhân sự cho người chỉ nhập nhân sự
  // Nhập nhân sự tách sang "3.1.3. Nhập nhân sự từ Excel" (DT-16 phần 16f); nhập học sinh sang "4.1.2. Nhập học sinh từ Excel"
  // (DT-16 phần 16g): trang còn công nợ đầu kỳ cho kế toán
  '/imports': 'P05.opening-debt.import',
  '/staff-imports': gated('P07.staff.view', 'P01.import.staff'),
  // Nhân sự đủ theo Sở (DT-16 phần 16f): xem như hồ sơ nhân sự, thao tác cần quyền quản lý hồ sơ (máy chủ kiểm tra)
  '/staff-branches': 'P07.staff.view',
  '/staff-identity': 'P07.staff.view',
  '/staff-movements': 'P07.staff.view',
  '/staff-statistics': 'P17.staff-statistics.view',
  '/staff-identity-progress': 'P17.staff-statistics.view',
  '/child-groups': gated(CHILDREN_AND_CLASSES, anyOf('P02.child-group.manage', 'P02.view')),
  // Cập nhật địa danh hành chính: như Biến động học sinh, người lập hoặc duyệt hồ sơ học sinh (YCTD-116)
  '/administrative-units': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  // Học sinh đủ theo Sở (DT-16 phần 16g): nhập học sinh như nhập trẻ; sắp xếp, điện thoại nhận tin, số định danh, tiến độ
  // xác thực cho người lập hoặc duyệt hồ sơ; tài khoản học và thi, mật khẩu mặc định cho người quản lý tài khoản
  '/student-imports': gated(CHILDREN_AND_CLASSES, anyOf('P01.import.children', 'P02.child.manage', 'P02.approve')),
  '/student-order': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/sms-phones': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/national-ids': gated(CHILDREN_AND_CLASSES, anyOf('P02.child.manage', 'P02.approve')),
  '/learning-accounts': gated(CHILDREN_AND_CLASSES, 'P01.account.manage'),
  '/default-passwords': 'P01.account.manage',
  '/national-id-progress': anyOf('P02.child.manage', 'P02.approve'),
  '/growth': anyOf('P10.health.manage', 'P17.report.growth'),
  '/growth-report': 'P17.report.growth',
  '/program-completion': gated(
    CHILDREN_AND_CLASSES,
    anyOf('P02.program-completion.manage', 'P02.program-completion.approve'),
  ),
  '/kitchen': anyOf('P12.kitchen.manage', 'P12.menu.approve', 'P17.report.kitchen'),
  // Thông tin sức khỏe học sinh theo học kỳ (DT-16 phần 16h): như nhập cân đo
  '/student-health': anyOf('P10.health.manage', 'P17.report.growth'),
  '/health': anyOf('P10.health.manage', 'P10.medical-event.record'),
  '/medicines': anyOf('P10.medicine.manage', 'P10.medication.administer', 'P10.medicine-purchase.approve'),
  '/attendance': CHILDREN_AND_CLASSES,
  '/statistics': STATISTICS,
  // Chuyển hồ sơ lên năm học mới: như mở năm học (DT-16 phần 16e)
  '/year-rollover': 'P01.academic-year.manage',
  '/missing-profiles': STATISTICS,
  '/student-statistics': STATISTICS,
  // Văn thư lưu trữ (YCTD-118): người có quyền quản lý, xuất thì cũng được cấp quyền xem
  '/archive-records': anyOf('P09.archive.view', 'P09.archive.manage', 'P09.archive.export'),
  '/archive-fonds': anyOf('P09.archive.view', 'P09.archive.manage'),
  '/archive-holdings': anyOf('P09.archive.view', 'P09.archive.manage'),
  '/archive-report': anyOf('P09.archive.view', 'P09.archive.export'),
  // Cơ sở vật chất, TBDH; Báo cáo số liệu
  '/facility-rooms': anyOf('P17.report.facilities', 'P13.equipment.manage', 'P01.room.manage'),
  '/equipment': anyOf('P17.report.facilities', 'P13.equipment.manage'),
  '/emis': 'P17.report.emis',
  // Quản trị hệ thống
  '/roles': ACCOUNTS,
  '/role-workspaces': ACCOUNTS,
  '/role-permissions': ACCOUNTS,
  '/accounts': ACCOUNTS,
  '/departments': anyOf('P01.view', 'P01.department.manage'),
  '/catalogs': anyOf('P01.view', 'P01.catalog.manage'),
  '/rooms': anyOf('P01.view', 'P01.room.manage', 'P01.catalog.manage'),
  '/approval-thresholds': 'P01.view',
  '/api-clients': gated(ACCOUNTS, 'P01.api-client.manage'),
  '/integrations': 'P01.integration.manage',
  // Tài khoản đồng bộ của Bộ, của Sở (DT-16 phần 16d)
  '/sync-accounts': 'P01.integration.manage',
  '/audit-logs': 'P01.view',
  // Ý kiến phản hồi (YCTD-110)
  '/feedback': 'P01.feedback.manage',
  // Tệp đã tạo của tác vụ xuất nền (DT-16 phần 16a): người xuất được dữ liệu
  '/generated-files': 'P17.data.export',
  // Thông báo hệ thống, ứng dụng liên kết (DT-16 phần 16c)
  '/system-announcements': 'P01.announcement.manage',
  '/app-links': 'P01.announcement.manage',
  // Tài chính – học phí
  '/fees': VIEW_FEES,
  '/registrations': REGISTRATIONS,
  '/invoices': anyOf('P05.view', gated(FINANCE, 'P05.fee-calculation.manage')),
  '/fee-approvals': gated(FINANCE, 'P05.fee-document.approve'),
  '/debts': 'P05.debt.view',
  '/debt-collection': DEBT_COLLECTION,
  '/receipts': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/payments': anyOf('P06.view', gated(FINANCE, anyOf('P06.payment.manage', 'P06.payment.approve'))),
  '/cash-accounts': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/cash-book': anyOf('P06.view', gated(FINANCE, anyOf('P06.receipt.manage', 'P06.cash-account.manage'))),
  '/bank-reconciliation': anyOf('P06.view', gated(FINANCE, 'P06.bank-transaction.manage')),
  '/payables': anyOf('P06.view', gated(FINANCE, 'P06.payable.manage')),
  '/cashflow-categories': VIEW_CASHFLOW,
  '/ledger': LEDGER,
  '/fiscal-periods': FISCAL_PERIODS,
  // Nhân sự – chấm công, lương
  '/work-schedules': anyOf('P08.work-schedule.manage', 'P08.attendance.view'),
  '/payrolls': 'P08.payroll.view',
  '/payroll-settlements': 'P08.payroll.view',
  '/pay-items': anyOf('P08.payroll.view', 'P08.pay-item-type.manage'),
  '/bonus-deductions': anyOf('P08.payroll.view', 'P08.bonus-deduction.manage'),
  // Bếp – kho, mua hàng; Tương tác – truyền thông; Giảng dạy; Tuyển sinh, tuyển dụng
  '/inventory': anyOf(
    'P13.asset.manage',
    'P13.purchase-order.manage',
    'P13.stocktake.approve',
    'P13.purchase-request.approve',
  ),
  '/purchase-requests': anyOf('P13.purchase-request.create', 'P13.purchase-request.approve'),
  '/interactions': anyOf('P15.interaction.manage', 'P15.message.send', 'P02.lost-item.manage'),
  '/activities': anyOf(
    'P14.activity.approve',
    'P14.content.manage',
    'P14.library.manage',
    'P14.extracurricular.manage',
  ),
  '/teaching': anyOf('P03.lesson-plan.review', 'P03.curriculum.manage', 'P03.lesson.manage'),
  '/admissions': anyOf(
    'P16.admission-campaign.manage',
    'P16.application.manage',
    'P16.application.review',
    'P16.admission-post.manage',
  ),
  '/recruitment': anyOf(
    'P18.recruitment-request.create',
    'P18.recruitment-request.approve',
    'P18.recruitment.manage',
    'P18.interview.manage',
  ),
};

export function isMenuRuleSatisfied(rule: MenuPermissionRule, has: (code: string) => boolean): boolean {
  if (typeof rule === 'string') {
    return has(rule);
  }
  if ('anyOf' in rule) {
    return rule.anyOf.some((child) => isMenuRuleSatisfied(child, has));
  }
  if ('allOf' in rule) {
    return rule.allOf.every((child) => isMenuRuleSatisfied(child, has));
  }
  return isMenuRuleSatisfied(rule.gate, has) && isMenuRuleSatisfied(rule.rule, has);
}

// Mục menu có hiện với người có các quyền này không; mục không có điều kiện thì luôn hiện
export function isMenuPathVisible(path: PortalQuickLinkPath, has: (code: string) => boolean): boolean {
  const rule = MENU_PERMISSION_RULES[path];
  return rule === undefined || isMenuRuleSatisfied(rule, has);
}

function collect(rule: MenuPermissionRule, includeGates: boolean, inGate: boolean, into: string[]): void {
  if (typeof rule === 'string') {
    if (includeGates === inGate && !into.includes(rule)) {
      into.push(rule);
    }
    return;
  }
  if ('anyOf' in rule || 'allOf' in rule) {
    for (const child of 'anyOf' in rule ? rule.anyOf : rule.allOf) {
      collect(child, includeGates, inGate, into);
    }
    return;
  }
  collect(rule.gate, includeGates, true, into);
  collect(rule.rule, includeGates, inGate, into);
}

// Quyền của một mục menu: các mã trong điều kiện, không kể quyền chỉ nằm ở cổng; tích chọn mục là chọn hết các mã này
export function menuPermissionCodes(path: PortalQuickLinkPath): string[] {
  const rule = MENU_PERMISSION_RULES[path];
  const codes: string[] = [];
  if (rule !== undefined) {
    collect(rule, false, false, codes);
  }
  return codes;
}

// Quyền ở cổng của mục: người dùng cần thêm ít nhất một trong các quyền này thì mục mới hiện
export function menuGatePermissionCodes(path: PortalQuickLinkPath): string[] {
  const rule = MENU_PERMISSION_RULES[path];
  const codes: string[] = [];
  if (rule !== undefined) {
    collect(rule, true, false, codes);
  }
  return codes.filter((code) => !menuPermissionCodes(path).includes(code));
}
