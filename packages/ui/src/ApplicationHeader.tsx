// Thanh tiêu đề dùng chung cho ba ứng dụng giao diện. Thanh chỉ ghi tên ứng dụng (`hideInShell`) ẩn từ 1024 px khi nằm trong
// `RoleNavigationShell` vì thanh bên đã có tên ứng dụng; thanh ghi tên màn vẫn hiện vì là tiêu đề của màn (YCTD-395)
export interface ApplicationHeaderProperties {
  title: string;
  hideInShell?: boolean;
}

export function ApplicationHeader({ title, hideInShell = false }: ApplicationHeaderProperties) {
  return (
    <header
      data-application-header={hideInShell ? '' : undefined}
      className="border-b border-slate-200 bg-white px-4 py-3"
    >
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    </header>
  );
}
