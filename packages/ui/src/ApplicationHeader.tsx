// Thanh tiêu đề dùng chung cho ba ứng dụng giao diện
export interface ApplicationHeaderProperties {
  title: string;
}

export function ApplicationHeader({ title }: ApplicationHeaderProperties) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    </header>
  );
}
