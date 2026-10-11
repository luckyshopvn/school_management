import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';
import { formatNumber, readBirthdays, readDashboard } from './reports-api.js';

// MH-01 Bảng điều khiển trên trang chủ (P17-01, P17-02, P17-13; YCTD-62): Ban Giám hiệu thấy toàn phạm vi, quản lý
// đơn vị thấy đơn vị được gán; sinh nhật trẻ trong tháng theo phạm vi quyền hoặc lớp được phân công
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-label text-text-secondary">{label}</p>
      <p className="text-section-title font-semibold text-text">{value}</p>
    </div>
  );
}

export function DashboardCards() {
  const canLead = useHasPermission(PERMISSION_CODES.leadershipDashboard);
  const canUnit = useHasPermission(PERMISSION_CODES.unitDashboard);
  const month = vietnamMonth();
  const kind = canLead ? 'leadership' : 'unit';
  const dashboard = useQuery({
    queryKey: ['dashboard', kind, month],
    queryFn: () => readDashboard(kind, month, null),
    enabled: canLead || canUnit,
  });
  const data = dashboard.data;
  if (!data) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Bảng điều khiển">
      <h2 className="text-section-title font-semibold text-text">Bảng điều khiển tháng {Number(month.slice(5))}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Trẻ đang học" value={formatNumber(data.children_count)} />
        <Card label="Lớp đang hoạt động" value={formatNumber(data.classes_count)} />
        <Card label="Nhân sự đang làm" value={formatNumber(data.staff_count)} />
        <Card
          label="Tỷ lệ đi học trong tháng"
          value={
            data.attendance.rate_percent === null
              ? 'Chưa có số liệu'
              : `${String(data.attendance.rate_percent).replace('.', ',')}%`
          }
        />
        <Card label="Học phí phải thu tháng này" value={formatNumber(data.tuition.payable_amount)} />
        <Card label="Đã thu" value={formatNumber(data.tuition.paid_amount)} />
        <Card label="Công nợ còn phải thu" value={formatNumber(data.debt.outstanding_amount)} />
        <Card label="Trong đó quá hạn" value={formatNumber(data.debt.overdue_amount)} />
      </div>
    </section>
  );
}

export function BirthdayList() {
  const month = vietnamMonth();
  const birthdays = useQuery({ queryKey: ['birthdays', month], queryFn: () => readBirthdays(month), retry: false });
  if (!birthdays.data || birthdays.data.length === 0) {
    return null;
  }
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="Sinh nhật trong tháng">
      <h2 className="text-section-title font-semibold text-text">Sinh nhật trẻ trong tháng</h2>
      <ul className="mt-2 flex flex-col gap-1 text-content">
        {birthdays.data.map((child) => (
          <li key={child.id}>
            {child.full_name} ({child.class_name}): ngày {Number(child.dob.slice(8))}, tròn {child.turning_age} tuổi
          </li>
        ))}
      </ul>
    </section>
  );
}
