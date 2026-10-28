import { useContext, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { portalMenuText, type PortalMenuNode } from '@school-management/shared';
import { AppShell } from './AppShell.js';
import { normalizeSearchText } from './function-search.js';
import { WorkspaceContext } from './workspaces.js';

// Trang "Tất cả chức năng" (YCTD-332): toàn bộ cây menu đánh số của mọi phân hệ người dùng được thấy trên một trang, phân hệ
// đang chọn đứng đầu; ô lọc theo tên hoặc số, gõ không dấu vẫn khớp. Là đường vào cho mọi mục khi các trang gom bớt mục khỏi
// thanh bên ở các phần sau
function filterNodes(nodes: PortalMenuNode[], keyword: string): PortalMenuNode[] {
  if (!keyword) {
    return nodes;
  }
  const words = keyword.split(' ');
  return nodes.flatMap((node) => {
    const own = normalizeSearchText(portalMenuText(node));
    if (words.every((word) => own.includes(word))) {
      return [node];
    }
    const children = node.children ? filterNodes(node.children, keyword) : [];
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

function NodeList({ nodes }: { nodes: PortalMenuNode[] }): ReactNode {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <li key={node.number} className="flex flex-col gap-1">
          {node.children ? (
            <>
              <span className="font-medium text-text">{portalMenuText(node)}</span>
              <div className="pl-4">
                <NodeList nodes={node.children} />
              </div>
            </>
          ) : (
            <Link to={node.path} className="text-link hover:underline">
              {portalMenuText(node)}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function AllFunctions() {
  const { current, workspaces } = useContext(WorkspaceContext);
  const [filter, setFilter] = useState('');
  const keyword = normalizeSearchText(filter);
  const ordered = [
    ...workspaces.filter((workspace) => workspace.key === current),
    ...workspaces.filter((workspace) => workspace.key !== current),
  ];
  const sections = ordered
    .map((workspace) => ({ workspace, nodes: filterNodes(workspace.menu, keyword) }))
    .filter((section) => section.nodes.length > 0);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-page-title font-bold text-text">Tất cả chức năng</h1>
        <input
          type="search"
          aria-label="Lọc chức năng"
          placeholder="Lọc theo tên hoặc số"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-10 w-full max-w-xs rounded-md border border-border-strong bg-card px-3 text-base"
        />
      </div>
      {sections.length === 0 ? <p className="text-content text-text-secondary">Không có chức năng phù hợp</p> : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] items-start gap-4">
        {sections.map(({ workspace, nodes }) => (
          <section
            key={workspace.key}
            aria-label={workspace.label}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-section-title font-semibold text-text">{workspace.label}</h2>
            <NodeList nodes={nodes} />
          </section>
        ))}
      </div>
    </section>
  );
}

export function AllFunctionsPage() {
  return (
    <AppShell>
      <AllFunctions />
    </AppShell>
  );
}
