import { useQuery } from '@tanstack/react-query';
import {
  isModuleInPlan,
  listPortalMenuEntries,
  paidFeatureMessage,
  type PlanModuleKey,
  type SchoolPlanView,
} from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { requestJson } from '../session/api-client.js';

// Gói dịch vụ của trường (DT-SaaS phần S5a, YCTD-194): cổng quản trị ẩn phân hệ ngoài gói, nhắc hạn dùng thử hoặc hạn đã trả phí,
// báo chế độ chỉ đọc. Máy chủ vẫn chặn ở mọi yêu cầu (MODULE_NOT_IN_PLAN, SCHOOL_READ_ONLY); chế độ một trường không giới hạn
export const readSchoolPlan = (): Promise<SchoolPlanView> => requestJson('/api/v1/school-plan');

export function useSchoolPlan() {
  return useQuery({ queryKey: ['school-plan'], queryFn: readSchoolPlan, staleTime: 5 * 60_000 });
}

// Danh sách phân hệ được bật để lọc menu; null là không lọc (chưa tải, không giới hạn)
export function usePlanModules(): readonly string[] | null {
  const plan = useSchoolPlan();
  return plan.data?.restricted ? plan.data.modules : null;
}

export function isWorkspaceInPlan(key: PlanModuleKey, modules: readonly string[] | null): boolean {
  return isModuleInPlan(key, modules);
}

// Trang thuộc phân hệ ngoài gói (mở bằng đường dẫn, dấu trang, liên kết cũ): trả mã phân hệ để khung trang hiện lời báo tính năng
// trả phí thay cho nội dung (YCTD-314); trang có ở nhiều phân hệ thì chỉ báo khi mọi phân hệ đó đều ngoài gói
export function usePaidFeatureFor(pathname: string): PlanModuleKey | null {
  const modules = usePlanModules();
  if (!modules) {
    return null;
  }
  const owners = listPortalMenuEntries()
    .filter((entry) => pathname === entry.node.path || pathname.startsWith(`${entry.node.path}/`))
    .map((entry) => entry.workspace.key);
  if (owners.length === 0 || owners.some((key) => isModuleInPlan(key, modules))) {
    return null;
  }
  return owners[0] ?? null;
}

export function PaidFeatureNotice({ module }: { module: PlanModuleKey }) {
  return (
    <div aria-label="Tính năng trả phí" data-testid="paid-feature">
      <Alert tone="warning">{paidFeatureMessage(module)}</Alert>
    </div>
  );
}

// Số ngày còn lại để nhắc (giả định GD-99: từ 15 ngày trở xuống)
const REMIND_FROM_DAYS = 15;

export function SchoolPlanBanner() {
  const plan = useSchoolPlan();
  const data = plan.data;
  if (!data || !data.status) {
    return null;
  }
  const due = data.due_on ? data.due_on.split('-').reverse().join('/') : null;
  if (data.read_only) {
    return (
      <div
        role="alert"
        aria-label="Chế độ chỉ đọc"
        className="bg-danger px-4 py-1.5 text-center text-label font-medium text-white"
      >
        Trường đang ở chế độ chỉ đọc do quá hạn sử dụng{due ? ` (hạn ${due})` : ''}: chỉ xem, xuất dữ liệu được; liên hệ
        nhà cung cấp để gia hạn. Dữ liệu được giữ nguyên.
      </div>
    );
  }
  if (data.days_left === null || data.days_left > REMIND_FROM_DAYS) {
    return null;
  }
  const label = data.status === 'trial' ? 'Thời gian dùng thử' : 'Gói dịch vụ';
  return (
    <div
      role="note"
      aria-label="Nhắc hạn gói dịch vụ"
      className="bg-header-accent px-4 py-1.5 text-center text-label font-medium text-text"
    >
      {data.days_left >= 0
        ? `${label} còn ${data.days_left} ngày (hạn ${due}).`
        : `${label} đã quá hạn ${-data.days_left} ngày (hạn ${due}); trường sẽ chuyển sang chỉ đọc nếu chưa gia hạn.`}
    </div>
  );
}
