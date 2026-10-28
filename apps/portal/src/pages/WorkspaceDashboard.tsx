import { useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { listPortalMenuEntries } from '@school-management/shared';
import { BirthdayList, DashboardCards } from '../reports/DashboardCards.js';
import { listIncoming } from '../incoming-documents/incoming-api.js';
import { listOutgoing } from '../outgoing-documents/outgoing-api.js';
import { MyWorkSummary } from '../my-work/MyWorkSummary.js';
import { listExpiringContracts } from '../staff/staff-api.js';
import { WorkspaceContext } from './workspaces.js';

// Bảng điều khiển theo phân hệ đang chọn trên trang chủ (Eric yêu cầu ngày 2026-10-28, YCTD-307): chọn phân hệ ở thanh đầu
// trang thì về trang chủ và bảng điều khiển đổi theo phân hệ. Khối chỉ hiện khi menu đã lọc theo quyền có trang tương ứng;
// khối không có số liệu thì ghi "Trống". Phân hệ chưa có khối số liệu riêng vẫn có Việc cần xử lý
const LATEST_COUNT = 5;
// Máy chủ văn bản đến, đi chỉ nhận số dòng mỗi trang 10, 20, 50, 100, 200: lấy trang 10 dòng rồi hiện LATEST_COUNT dòng đầu
const FETCH_PAGE_SIZE = 10;

const linkClass = 'inline-flex items-center text-label font-medium text-link underline max-xl:min-h-11';

export function EmptyText() {
  return <p className="text-content text-text-secondary">Trống</p>;
}

function DashboardBlock({
  title,
  path,
  summary,
  children,
}: {
  title: string;
  path: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-section-title font-semibold text-text">{title}</h2>
        <Link to={path} className={linkClass}>
          Xem tất cả
        </Link>
      </div>
      {summary ? <p className="text-label text-text-secondary">{summary}</p> : null}
      {children}
    </section>
  );
}

function RowList({ rows }: { rows: Array<{ id: string; title: string; note: string | null }> }) {
  if (rows.length === 0) {
    return <EmptyText />;
  }
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col border-t border-border py-2">
          <span className="font-medium text-text">{row.title}</span>
          {row.note ? <span className="text-label text-text-secondary">{row.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

// Văn bản chuyển tới tôi đang chờ xử lý, như thẻ Chờ xử lý của trang Văn bản đến
function IncomingBlock() {
  const inbox = useQuery({
    queryKey: ['dashboard', 'incoming-inbox'],
    queryFn: () => listIncoming({ view: 'inbox', page: 1, pageSize: FETCH_PAGE_SIZE }),
  });
  const rows = (inbox.data?.items ?? []).slice(0, LATEST_COUNT).map((item) => ({
    id: item.id,
    title: `${item.symbol} – ${item.summary}`,
    note: item.effective_deadline ? `${item.issuer_name} · hạn ${item.effective_deadline}` : item.issuer_name,
  }));
  return (
    <DashboardBlock
      title="Công văn đến của tôi"
      path="/incoming-documents"
      summary={inbox.data?.total ? `Chờ xử lý: ${inbox.data.total}` : undefined}
    >
      {inbox.error ? <p className="text-content text-danger">{inbox.error.message}</p> : <RowList rows={rows} />}
    </DashboardBlock>
  );
}

// Văn bản đi chờ tôi xử lý và dự thảo của tôi, như hai thẻ Chờ xử lý, Dự thảo của trang Văn bản đi
function OutgoingBlock() {
  const pending = useQuery({
    queryKey: ['dashboard', 'outgoing-pending'],
    queryFn: () => listOutgoing({ view: 'pending', page: 1, pageSize: FETCH_PAGE_SIZE }),
  });
  const drafts = useQuery({
    queryKey: ['dashboard', 'outgoing-drafts'],
    queryFn: () => listOutgoing({ view: 'drafts', page: 1, pageSize: FETCH_PAGE_SIZE }),
  });
  const rows = [
    ...(pending.data?.items ?? []).map((item) => ({ item, state: 'Chờ xử lý' })),
    ...(drafts.data?.items ?? []).map((item) => ({ item, state: 'Dự thảo' })),
  ]
    .slice(0, LATEST_COUNT)
    .map(({ item, state }) => ({
      id: item.id,
      title: `eOffice ${item.eoffice_number}: ${item.summary}`,
      note: state,
    }));
  const pendingTotal = pending.data?.total ?? 0;
  const draftTotal = drafts.data?.total ?? 0;
  const error = pending.error ?? drafts.error;
  return (
    <DashboardBlock
      title="Công văn đi của tôi"
      path="/outgoing-documents"
      summary={pendingTotal || draftTotal ? `Chờ xử lý: ${pendingTotal} · Dự thảo: ${draftTotal}` : undefined}
    >
      {error ? <p className="text-content text-danger">{error.message}</p> : <RowList rows={rows} />}
    </DashboardBlock>
  );
}

// Cảnh báo hợp đồng lao động sắp hết hạn theo số ngày cấu hình của đơn vị (BR-38, AC-38, YCTD-58)
function ExpiringContracts() {
  const contracts = useQuery({ queryKey: ['expiring-contracts'], queryFn: listExpiringContracts });
  const rows = (contracts.data ?? []).map((contract) => ({
    id: contract.id,
    title: contract.full_name,
    note: `Hợp đồng ${contract.contract_no} hết hạn ngày ${contract.end_date}`,
  }));
  return (
    <DashboardBlock title="Hợp đồng sắp hết hạn" path="/staff">
      <RowList rows={rows} />
    </DashboardBlock>
  );
}

export function WorkspaceDashboard() {
  const { current, workspaces } = useContext(WorkspaceContext);
  const workspace = workspaces.find((item) => item.key === current);
  if (!workspace) {
    return null;
  }
  const paths = new Set<string>(listPortalMenuEntries([workspace]).map((entry) => entry.node.path));
  const blocks: ReactNode[] = [];
  if (workspace.key === 'education' || workspace.key === 'finance' || workspace.key === 'reports') {
    blocks.push(<DashboardCards key="cards" />);
  }
  const panels: ReactNode[] = [<MyWorkSummary key="my-work" />];
  if (workspace.key === 'documents') {
    if (paths.has('/incoming-documents')) {
      panels.unshift(<IncomingBlock key="incoming" />);
    }
    if (paths.has('/outgoing-documents')) {
      panels.splice(paths.has('/incoming-documents') ? 1 : 0, 0, <OutgoingBlock key="outgoing" />);
    }
  }
  if (workspace.key === 'education') {
    panels.push(<BirthdayList key="birthdays" />);
  }
  // Hợp đồng sắp hết hạn đi theo phân hệ có trang Hồ sơ cán bộ, giáo viên
  if (paths.has('/staff')) {
    panels.push(<ExpiringContracts key="contracts" />);
  }
  return (
    // Tên vùng tránh chữ "Bảng điều khiển" để không trùng vùng MH-01 bên trong (kiểm thử tìm vùng theo tên)
    // YCTD-330: bỏ tiêu đề "Tổng quan phân hệ" (tên phân hệ đã có ở thanh bên) và khối Lối tắt (trùng cây menu ở thanh bên)
    <section className="flex flex-col gap-4" aria-label={`Tổng quan phân hệ ${workspace.label}`}>
      {blocks}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-4">{panels}</div>
    </section>
  );
}
