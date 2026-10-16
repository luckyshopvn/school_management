import type { PortalQuickLinkPath } from './index.js';

// Cây menu ngang của cổng quản trị theo hệ thống của Sở (DT-15 phần 15a, tài liệu 32 mục 3): mỗi phân hệ một menu đánh số
// thứ bậc 1., 1.1., 1.1.1.; số giữ đúng số của Sở ở phân hệ Quản lý giáo dục Mầm non, Cơ sở vật chất, Báo cáo số liệu,
// Quản trị hệ thống (mục chưa có thì để trống số); phân hệ riêng đánh số liên tục. Mỗi trang chỉ có ở một chỗ. Quyền hiện
// từng mục do cổng quản trị kiểm tra; máy chủ vẫn kiểm tra quyền ở mọi yêu cầu
export type PortalWorkspaceKey =
  | 'education'
  | 'facilities'
  | 'emis'
  | 'system'
  | 'finance'
  | 'personnel'
  | 'logistics'
  | 'interaction'
  | 'teaching'
  | 'admissions'
  | 'reports';

export interface PortalMenuNode {
  // Số thứ bậc có dấu chấm cuối như của Sở, ví dụ "4.1.1."
  number: string;
  label: string;
  path?: PortalQuickLinkPath;
  children?: PortalMenuNode[];
}

export interface PortalWorkspace {
  key: PortalWorkspaceKey;
  label: string;
  menu: PortalMenuNode[];
}

const leaf = (number: string, label: string, path: PortalQuickLinkPath): PortalMenuNode => ({ number, label, path });
const group = (number: string, label: string, children: PortalMenuNode[]): PortalMenuNode => ({
  number,
  label,
  children,
});

export const PORTAL_WORKSPACES: PortalWorkspace[] = [
  {
    key: 'education',
    label: 'Quản lý giáo dục Mầm non',
    menu: [
      group('1.', 'Trường học', [
        leaf('1.1.', 'Hồ sơ trường', '/school-profile'),
        leaf('1.2.', 'Quản lý phân hiệu', '/branches'),
        leaf('1.3.', 'Quản lý điểm trường', '/school-sites'),
        leaf('1.4.', 'Cấu hình trường', '/settings'),
        leaf('1.6.', 'Tài khoản đồng bộ của Bộ, của Sở', '/sync-accounts'),
      ]),
      group('2.', 'Lớp học', [
        leaf('2.1.', 'Hồ sơ lớp học', '/classes'),
        leaf('2.2.', 'Nhập lớp học từ Excel', '/class-imports'),
      ]),
      group('3.', 'Nhân sự', [
        group('3.1.', 'Hồ sơ nhân sự', [leaf('3.1.1.', 'Hồ sơ cán bộ, giáo viên', '/staff')]),
        leaf('3.2.', 'Đánh giá chuẩn nghề nghiệp', '/professional-standards'),
        leaf('3.3.', 'Phân công phụ trách lớp', '/class-assignments'),
      ]),
      group('4.', 'Học sinh', [
        group('4.1.', 'Hồ sơ học sinh', [
          leaf('4.1.1.', 'Quản lý hồ sơ học sinh', '/children'),
          leaf('4.1.2.', 'Nhập dữ liệu từ Excel', '/imports'),
          leaf('4.1.6.', 'Nhóm học sinh', '/child-groups'),
          leaf('4.1.11.', 'Cập nhật địa danh hành chính', '/administrative-units'),
        ]),
        leaf('4.2.', 'Biến động học sinh', '/student-movements'),
        group('4.3.', 'Cân nặng, chiều cao', [
          leaf('4.3.1.', 'Nhập kết quả sức khỏe nuôi dưỡng', '/growth'),
          leaf('4.3.2.', 'Tổng hợp cân nặng, chiều cao', '/growth-report'),
        ]),
        leaf('4.4.', 'Hoàn thành chương trình', '/program-completion'),
        leaf('4.5.', 'Thực đơn bữa ăn', '/kitchen'),
        group('4.6.', 'Sức khỏe học sinh', [
          leaf('4.6.1.', 'Y tế học đường', '/health'),
          leaf('4.6.2.', 'Thuốc và dặn thuốc', '/medicines'),
        ]),
        leaf('4.7.', 'Điểm danh', '/attendance'),
      ]),
      group('5.', 'Công cụ hỗ trợ', [
        leaf('5.1.', 'Thống kê lớp, nhân sự, học sinh', '/statistics'),
        leaf('5.8.', 'Thống kê hồ sơ chưa nhập đủ', '/missing-profiles'),
      ]),
    ],
  },
  {
    key: 'facilities',
    label: 'Quản lý cơ sở vật chất, TBDH',
    menu: [
      group('1.', 'Cơ sở vật chất', [leaf('1.1.', 'Khai báo cơ sở vật chất', '/facility-rooms')]),
      group('2.', 'Thiết bị dạy học', [leaf('2.1.', 'Tổng hợp thiết bị dạy học', '/equipment')]),
    ],
  },
  {
    key: 'emis',
    label: 'Báo cáo số liệu',
    menu: [group('1.', 'Báo cáo đầu năm', [leaf('1.1.', 'Báo cáo EMIS đầu năm', '/emis')])],
  },
  {
    key: 'system',
    label: 'Quản trị hệ thống',
    menu: [
      group('1.', 'Người dùng và phân quyền', [
        leaf('1.1.', 'Nhóm người dùng', '/roles'),
        leaf('1.2.', 'Phân quyền nhóm theo phần mềm', '/role-workspaces'),
        leaf('1.3.', 'Phân quyền nhóm theo menu', '/role-permissions'),
        leaf('1.4.', 'Danh sách người dùng', '/accounts'),
      ]),
      group('2.', 'Thiết lập', [
        leaf('2.1.', 'Năm học', '/academic-years'),
        leaf('2.2.', 'Cây đơn vị', '/org-units'),
        leaf('2.3.', 'Phòng ban và chức danh', '/departments'),
        leaf('2.4.', 'Danh mục dùng chung', '/catalogs'),
        leaf('2.5.', 'Phòng học và bậc học', '/rooms'),
        leaf('2.6.', 'Hạn mức phê duyệt', '/approval-thresholds'),
      ]),
      group('3.', 'Kết nối và nhật ký', [
        leaf('3.1.', 'Khóa API cho đối tác', '/api-clients'),
        leaf('3.2.', 'Kết nối ngoài', '/integrations'),
        leaf('3.3.', 'Nhật ký thao tác', '/audit-logs'),
        leaf('3.4.', 'Ý kiến phản hồi', '/feedback'),
      ]),
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính – học phí',
    menu: [
      group('1.', 'Học phí và dịch vụ', [
        leaf('1.1.', 'Biểu phí và dịch vụ', '/fees'),
        leaf('1.2.', 'Đăng ký dịch vụ', '/registrations'),
        leaf('1.3.', 'Học phí', '/invoices'),
        leaf('1.4.', 'Duyệt miễn giảm và điều chỉnh', '/fee-approvals'),
        leaf('1.5.', 'Công nợ', '/debts'),
        leaf('1.6.', 'Nhắc nợ và xử lý quá hạn', '/debt-collection'),
      ]),
      group('2.', 'Thu chi', [
        leaf('2.1.', 'Phiếu thu', '/receipts'),
        leaf('2.2.', 'Phiếu chi', '/payments'),
        leaf('2.3.', 'Quỹ và ngân hàng', '/cash-accounts'),
        leaf('2.4.', 'Sổ quỹ', '/cash-book'),
        leaf('2.5.', 'Đối chiếu ngân hàng', '/bank-reconciliation'),
        leaf('2.6.', 'Nợ nhà cung cấp', '/payables'),
        leaf('2.7.', 'Khoản mục thu chi', '/cashflow-categories'),
      ]),
      group('3.', 'Kế toán', [
        leaf('3.1.', 'Sổ kế toán', '/ledger'),
        leaf('3.2.', 'Chốt kỳ tài chính', '/fiscal-periods'),
      ]),
    ],
  },
  {
    key: 'personnel',
    label: 'Nhân sự – chấm công, lương',
    menu: [
      group('1.', 'Chấm công và nghỉ phép', [
        leaf('1.1.', 'Chấm công', '/staff-attendance'),
        leaf('1.2.', 'Đơn nghỉ phép', '/leave-requests'),
        leaf('1.3.', 'Quy định phép năm', '/leave-policies'),
        leaf('1.4.', 'Ngày lễ và lịch bù', '/school-days'),
        leaf('1.5.', 'Lịch công tác', '/work-schedules'),
      ]),
      group('2.', 'Lương', [
        leaf('2.1.', 'Bảng lương', '/payrolls'),
        leaf('2.2.', 'Quyết toán và điều chỉnh lương', '/payroll-settlements'),
        leaf('2.3.', 'Danh mục lương và biểu thuế', '/pay-items'),
        leaf('2.4.', 'Thưởng và khấu trừ', '/bonus-deductions'),
        leaf('2.5.', 'Phiếu lương của tôi', '/my-payslips'),
      ]),
      group('3.', 'Công việc và đánh giá', [
        leaf('3.1.', 'Công việc và kế hoạch', '/work'),
        leaf('3.2.', 'Đánh giá nhân sự', '/evaluations'),
      ]),
    ],
  },
  {
    key: 'logistics',
    label: 'Bếp – kho, mua hàng',
    menu: [leaf('1.', 'Kho và tài sản', '/inventory'), leaf('2.', 'Đề nghị mua hàng', '/purchase-requests')],
  },
  {
    key: 'interaction',
    label: 'Tương tác – truyền thông',
    menu: [leaf('1.', 'Tương tác với phụ huynh', '/interactions'), leaf('2.', 'Hoạt động và tin tức', '/activities')],
  },
  {
    key: 'teaching',
    label: 'Giảng dạy',
    menu: [leaf('1.', 'Bài học và giáo án', '/teaching')],
  },
  {
    key: 'admissions',
    label: 'Tuyển sinh, tuyển dụng',
    menu: [leaf('1.', 'Tuyển sinh', '/admissions'), leaf('2.', 'Tuyển dụng', '/recruitment')],
  },
  {
    key: 'reports',
    label: 'Báo cáo',
    menu: [leaf('1.', 'Báo cáo và bảng điều khiển', '/reports')],
  },
];

// Một mục lá kèm phân hệ và chuỗi mục cha, dùng cho Truy cập nhanh và trợ giúp kiểm thử
export interface PortalMenuEntry {
  workspace: PortalWorkspace;
  trail: PortalMenuNode[];
  node: PortalMenuNode & { path: PortalQuickLinkPath };
}

export function listPortalMenuEntries(workspaces: PortalWorkspace[] = PORTAL_WORKSPACES): PortalMenuEntry[] {
  const entries: PortalMenuEntry[] = [];
  const walk = (workspace: PortalWorkspace, nodes: PortalMenuNode[], trail: PortalMenuNode[]) => {
    for (const node of nodes) {
      if (node.path) {
        entries.push({ workspace, trail: [...trail, node], node: node as PortalMenuEntry['node'] });
      }
      if (node.children) {
        walk(workspace, node.children, [...trail, node]);
      }
    }
  };
  for (const workspace of workspaces) {
    walk(workspace, workspace.menu, []);
  }
  return entries;
}

// Mục hiển thị trên menu: số và tên, ví dụ "4.1.1. Quản lý hồ sơ học sinh"
export function portalMenuText(node: PortalMenuNode): string {
  return `${node.number} ${node.label}`;
}
