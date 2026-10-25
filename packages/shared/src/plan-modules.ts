import { MENU_PERMISSION_RULES, menuPermissionCodes } from './menu-permissions.js';
import { listPortalMenuEntries, PORTAL_WORKSPACES, type PortalWorkspaceKey } from './portal-menu.js';

// Phân hệ của gói dịch vụ (DT-SaaS phần S5a, YCTD-194; tài liệu 32 mục 14.5). Phân hệ của gói là phân hệ của cây menu cổng quản
// trị (PORTAL_WORKSPACES); quyền `P..` gắn với phân hệ qua bảng ánh xạ tính một nơi ở tệp này từ quy tắc quyền của từng mục menu
// (MENU_PERMISSION_RULES): quyền dùng ở mục menu của phân hệ nào thì thuộc phân hệ đó. Quyền thuộc nhiều phân hệ thì dùng được khi
// gói bật một trong các phân hệ đó; quyền không gắn mục menu nào (quyền nền, quyền của ứng dụng giáo viên, phụ huynh) luôn dùng
// được. Claude tự chọn theo ủy quyền của Eric ngày 2026-10-11
export type PlanModuleKey = PortalWorkspaceKey;

// Phân hệ luôn bật ở mọi gói: quản trị hệ thống (tài khoản, phân quyền, cấu hình trường) để trường còn đăng nhập, quản trị được
export const CORE_PLAN_MODULES: readonly PlanModuleKey[] = ['system'];

export interface PlanModule {
  key: PlanModuleKey;
  label: string;
  core: boolean;
}

export const PLAN_MODULES: readonly PlanModule[] = PORTAL_WORKSPACES.map((workspace) => ({
  key: workspace.key,
  label: workspace.levelTitle ?? workspace.label,
  core: CORE_PLAN_MODULES.includes(workspace.key),
}));

export function isPlanModuleKey(value: unknown): value is PlanModuleKey {
  return typeof value === 'string' && PLAN_MODULES.some((module) => module.key === value);
}

let permissionModules: Map<string, Set<PlanModuleKey>> | undefined;

// Bảng ánh xạ quyền → phân hệ (tính một lần)
export function permissionPlanModules(): ReadonlyMap<string, ReadonlySet<PlanModuleKey>> {
  if (!permissionModules) {
    const map = new Map<string, Set<PlanModuleKey>>();
    for (const entry of listPortalMenuEntries()) {
      if (!MENU_PERMISSION_RULES[entry.node.path]) {
        continue;
      }
      for (const code of menuPermissionCodes(entry.node.path)) {
        const modules = map.get(code) ?? new Set<PlanModuleKey>();
        modules.add(entry.workspace.key);
        map.set(code, modules);
      }
    }
    permissionModules = map;
  }
  return permissionModules;
}

// Gói có `modules` (null là không giới hạn phân hệ: trường chưa gán gói, chế độ một trường)
export function isModuleInPlan(module: PlanModuleKey, modules: readonly string[] | null): boolean {
  return modules === null || CORE_PLAN_MODULES.includes(module) || modules.includes(module);
}

export function isPermissionInPlan(code: string, modules: readonly string[] | null): boolean {
  if (modules === null) {
    return true;
  }
  const owners = permissionPlanModules().get(code);
  if (!owners || owners.size === 0) {
    return true;
  }
  return [...owners].some((module) => isModuleInPlan(module, modules));
}

// Cách tính phí cấu hình được theo gói (Eric chốt 2026-10-25, GD-94): theo số học sinh đang học (mặc định), theo trường, theo phân
// hệ. Phần thu tiền làm ở S5b; S5a chỉ lưu cấu hình giá niêm yết ở gói
export type PlanPricingMode = 'per_student' | 'per_school' | 'per_module';
export const PLAN_PRICING_MODES: readonly PlanPricingMode[] = ['per_student', 'per_school', 'per_module'];
export const PLAN_PRICING_MODE_LABELS: Record<PlanPricingMode, string> = {
  per_student: 'Theo số học sinh đang học',
  per_school: 'Theo trường',
  per_module: 'Theo phân hệ',
};
export type PlanBillingCycle = 'monthly' | 'term' | 'yearly';
export const PLAN_BILLING_CYCLES: readonly PlanBillingCycle[] = ['monthly', 'term', 'yearly'];

// Trạng thái gói của trường mà ứng dụng của trường đọc (GET /api/v1/school-plan)
export type SchoolPlanStatus = 'trial' | 'active' | 'read_only' | 'suspended';

export interface SchoolPlanView {
  // false ở chế độ một trường hoặc trường chưa gán gói: không giới hạn
  restricted: boolean;
  status: SchoolPlanStatus | null;
  plan: { code: string; name: string } | null;
  modules: string[] | null;
  limits: { max_active_students: number | null; max_storage_mb: number | null; max_school_levels: number | null };
  usage: { active_students: number | null; storage_mb: number | null };
  // Hạn dùng thử hoặc hạn đã trả phí; số ngày còn lại (âm là đã quá hạn)
  due_on: string | null;
  days_left: number | null;
  read_only: boolean;
}
