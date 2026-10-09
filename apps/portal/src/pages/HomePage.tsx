import { useQuery } from '@tanstack/react-query';
import { Alert } from '@school-management/ui';
import { fetchCurrentUser } from '../session/api-client.js';
import { AppShell } from './AppShell.js';

// Trang chủ tạm thời: lời chào và vai trò hiện hành; bảng điều khiển MH-01 làm ở đợt sau
export function HomePage() {
  const currentUser = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser });

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
