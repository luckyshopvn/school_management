import { ApplicationHeader } from '@school-management/ui';

// Giao diện chỉ gọi giao diện lập trình ứng dụng, không chứa quy tắc nghiệp vụ (QU-09)
export function Application() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ApplicationHeader title="Ứng dụng giáo viên" />
    </div>
  );
}
