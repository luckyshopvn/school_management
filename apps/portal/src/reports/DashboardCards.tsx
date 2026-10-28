import { useQuery } from '@tanstack/react-query';
import { PERMISSION_CODES } from '@school-management/shared';
import { useHasPermission } from '../session/permissions.js';
import { useSchoolLevelTerms } from '../school-levels/working-level.js';
import { formatNumber, readBirthdays, readDashboard } from './reports-api.js';

// MH-01 Bảng điều khiển trên trang chủ (P17-01, P17-02, P17-13; YCTD-62): Ban Giám hiệu thấy toàn phạm vi, quản lý
// đơn vị thấy đơn vị được gán; sinh nhật trẻ trong tháng theo phạm vi quyền hoặc lớp được phân công
const vietnamMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);

const percent = (value: number) => `${String(value).replace('.', ',')}%`;

// Thẻ chỉ số theo mẫu giao diện Tổng quan: nhãn, số lớn, một dòng ghi chú; ghi chú cảnh báo tô màu warning
function Card({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-label text-text-secondary">{label}</p>
      <p className="text-[30px] font-bold leading-tight tracking-tight text-text">{value}</p>
      {note ? <p className={`text-[13px] ${warn ? 'text-warning' : 'text-text-secondary'}`}>{note}</p> : null}
    </div>
  );
}

export function DashboardCards() {
  const terms = useSchoolLevelTerms();
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
  const { tuition, debt, attendance } = data;
  const paidPercent =
    tuition.payable_amount > 0 ? Math.round((tuition.paid_amount / tuition.payable_amount) * 1000) / 10 : null;
  return (
    <section className="flex flex-col gap-3" aria-label="Bảng điều khiển">
      <h2 className="text-section-title font-semibold text-text">Bảng điều khiển tháng {Number(month.slice(5))}</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Card
          label={`${terms.learner} đang học`}
          value={formatNumber(data.children_count)}
          note={`${formatNumber(data.classes_count)} lớp đang hoạt động`}
        />
        <Card
          label="Tỷ lệ đi học trong tháng"
          value={attendance.rate_percent === null ? 'Chưa có số liệu' : percent(attendance.rate_percent)}
          note={
            attendance.record_count
              ? `${formatNumber(attendance.present_count)} / ${formatNumber(attendance.record_count)} lượt có mặt`
              : undefined
          }
        />
        <Card label="Nhân sự đang làm" value={formatNumber(data.staff_count)} />
        <Card
          label="Học phí đã thu tháng này"
          value={paidPercent === null ? 'Chưa có khoản thu' : percent(paidPercent)}
          note={`Đã thu ${formatNumber(tuition.paid_amount)} / ${formatNumber(tuition.payable_amount)}`}
        />
        <Card
          label="Công nợ còn phải thu"
          value={formatNumber(debt.outstanding_amount)}
          note={
            debt.overdue_amount ? `Trong đó quá hạn ${formatNumber(debt.overdue_amount)}` : 'Không có khoản quá hạn'
          }
          warn={debt.overdue_amount > 0}
        />
      </div>
    </section>
  );
}

export function BirthdayList() {
  const month = vietnamMonth();
  const birthdays = useQuery({ queryKey: ['birthdays', month], queryFn: () => readBirthdays(month), retry: false });
  if (!birthdays.data) {
    return null;
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-label="Sinh nhật trong tháng">
      <h2 className="text-section-title font-semibold text-text">Sinh nhật trẻ trong tháng</h2>
      {birthdays.data.length === 0 ? <p className="mt-2 text-content text-text-secondary">Trống</p> : null}
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
