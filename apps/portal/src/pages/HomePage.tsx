import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { Alert } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { useHasPermission } from '../session/permissions.js';
import { BirthdayList, DashboardCards } from '../reports/DashboardCards.js';
import { listExpiringContracts } from '../staff/staff-api.js';
import { AppShell } from './AppShell.js';

// Cảnh báo hợp đồng lao động sắp hết hạn theo số ngày cấu hình của đơn vị (BR-38, AC-38, YCTD-58)
function ExpiringContracts() {
  const contracts = useQuery({ queryKey: ['expiring-contracts'], queryFn: listExpiringContracts });
  if (!contracts.data || contracts.data.length === 0) {
    return null;
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="Hợp đồng sắp hết hạn">
      <h2 className="text-section-title font-semibold text-text">Hợp đồng sắp hết hạn</h2>
      <ul className="mt-2 flex flex-col gap-1 text-content">
        {contracts.data.map((contract) => (
          <li key={contract.id}>
            {contract.full_name}: hợp đồng {contract.contract_no} hết hạn ngày {contract.end_date}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Trang chủ: lời chào, bảng điều khiển MH-01 theo quyền (YCTD-62), sinh nhật trẻ trong tháng, cảnh báo hợp đồng, vai trò
export function HomePage() {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });
  const canViewStaff = useHasPermission(PERMISSION_CODES.staffView);

  return (
    <AppShell>
      {currentUser.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-7 w-64 animate-pulse rounded bg-border" />
          <div className="h-4 w-48 animate-pulse rounded bg-border" />
        </div>
      ) : currentUser.isError ? (
        <Alert tone="danger">{currentUser.error.message}</Alert>
      ) : (
        <section className="flex flex-col gap-4">
          <h1 className="text-page-title font-bold text-text">Xin chào, {currentUser.data.full_name}</h1>
          <DashboardCards />
          <BirthdayList />
          {canViewStaff ? <ExpiringContracts /> : null}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-section-title font-semibold text-text">Vai trò của bạn</h2>
            <ul className="mt-2 flex flex-col gap-1" data-testid="role-list">
              {currentUser.data.assignments.map((assignment) => (
                <li key={`${assignment.role_code}-${assignment.org_unit_id ?? 'all'}`} className="text-content">
                  {assignment.role_name}
                  <span className="text-label text-text-secondary">
                    {' '}
                    — {assignment.org_unit_id === null ? 'Toàn trường' : 'Theo đơn vị được gán'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </AppShell>
  );
}
